// =============================================================================
// CRM Pipeline API - Client Example (Next.js + Apollo Client)
// =============================================================================

import { ApolloClient, InMemoryCache, createHttpLink, from } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';
import { onError } from '@apollo/client/link/error';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';

// =============================================================================
// Apollo Client Setup
// =============================================================================

const httpLink = createHttpLink({
  uri: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:4000/graphql',
});

// Auth link - adds JWT token to requests
const authLink = setContext((_, { headers }) => {
  // Get token from storage
  const token = typeof window !== 'undefined'
    ? localStorage.getItem('accessToken')
    : null;

  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

// Error link - handles auth errors
const errorLink = onError(({ graphQLErrors, operation }) => {
  if (graphQLErrors) {
    for (const error of graphQLErrors) {
      // Handle token expiration
      if (error.extensions?.code === 'TOKEN_EXPIRED') {
        // Try to refresh token
        refreshAccessToken().then((newToken) => {
          if (newToken) {
            // Retry the operation
            const oldHeaders = operation.getContext().headers;
            operation.setContext({
              headers: {
                ...oldHeaders,
                authorization: `Bearer ${newToken}`,
              },
            });
          } else {
            // Redirect to login
            window.location.href = '/login';
          }
        });
      }

      // Handle other errors
      if (error.extensions?.code === 'UNAUTHENTICATED') {
        window.location.href = '/login';
      }
    }
  }
});

// Create Apollo Client
export const apolloClient = new ApolloClient({
  link: from([errorLink, authLink, httpLink]),
  cache: new InMemoryCache({
    typePolicies: {
      // Configure cache policies for pagination
      Query: {
        fields: {
          leads: relayStylePagination(),
          accounts: relayStylePagination(),
          contacts: relayStylePagination(),
          opportunities: relayStylePagination(),
        },
      },
      // Type policies for entities
      Lead: {
        keyFields: ['id'],
      },
      Account: {
        keyFields: ['id'],
      },
      Opportunity: {
        keyFields: ['id'],
      },
    },
  }),
  defaultOptions: {
    watchQuery: {
      fetchPolicy: 'cache-and-network',
    },
  },
});

// =============================================================================
// Auth Helper
// =============================================================================

async function refreshAccessToken(): Promise<string | null> {
  const refreshToken = localStorage.getItem('refreshToken');

  if (!refreshToken) return null;

  try {
    const response = await fetch('/api/auth/refresh', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refreshToken }),
    });

    const data = await response.json();

    if (data.accessToken) {
      localStorage.setItem('accessToken', data.accessToken);
      if (data.refreshToken) {
        localStorage.setItem('refreshToken', data.refreshToken);
      }
      return data.accessToken;
    }

    return null;
  } catch {
    return null;
  }
}

// =============================================================================
// Example Hooks (using generated types)
// =============================================================================

// Example: useLeads hook
import { gql, useQuery, useMutation } from '@apollo/client';

const GET_LEADS = gql`
  query GetLeads($filter: LeadFilterInput, $first: Int, $after: String) {
    leads(filter: $filter, first: $first, after: $after) {
      edges {
        node {
          id
          firstName
          lastName
          email
          status
          score
          companyName
        }
        cursor
      }
      pageInfo {
        hasNextPage
        endCursor
        totalCount
      }
    }
  }
`;

export function useLeads(filter?: { status?: string; search?: string }) {
  return useQuery(GET_LEADS, {
    variables: { filter, first: 20 },
    fetchPolicy: 'cache-and-network',
  });
}

// Example: useCreateLead hook
const CREATE_LEAD = gql`
  mutation CreateLead($input: CreateLeadInput!) {
    createLead(input: $input) {
      success
      message
      lead {
        id
        firstName
        lastName
        email
        status
      }
    }
  }
`;

export function useCreateLead() {
  const [mutate] = useMutation(CREATE_LEAD, {
    // Update cache after creation
    update(cache, { data }) {
      if (data?.createLead.success && data.createLead.lead) {
        cache.modify({
          fields: {
            leads(existing = { edges: [] }) {
              const newLeadRef = cache.writeFragment({
                data: data.createLead.lead,
                fragment: gql`
                  fragment NewLead on Lead {
                    id
                    firstName
                    lastName
                    email
                    status
                  }
                `,
              });

              return {
                ...existing,
                edges: [{ node: newLeadRef, cursor: '' }, ...existing.edges],
              };
            },
          },
        });
      }
    },
  });

  return async (input: {
    firstName: string;
    lastName: string;
    email: string;
    companyName?: string;
  }) => {
    const result = await mutate({ variables: { input } });
    return result.data?.createLead;
  };
}

// Example: useConvertLead hook
const CONVERT_LEAD = gql`
  mutation ConvertLead($input: ConvertLeadInput!) {
    convertLead(input: $input) {
      success
      message
      lead {
        id
        status
        convertedAt
        convertedToAccountId
        convertedToContactId
        convertedToOpportunityId
      }
    }
  }
`;

export function useConvertLead() {
  const [mutate] = useMutation(CONVERT_LEAD);

  return async (
    leadId: string,
    options?: {
      createAccount?: boolean;
      accountName?: string;
      createOpportunity?: boolean;
      opportunityName?: string;
      opportunityAmount?: number;
    }
  ) => {
    const idempotencyKey = `convert-${leadId}-${Date.now()}`;

    const result = await mutate({
      variables: {
        input: {
          leadId,
          createAccount: options?.createAccount ?? true,
          accountName: options?.accountName,
          createOpportunity: options?.createOpportunity ?? true,
          opportunityName: options?.opportunityName,
          opportunityAmount: options?.opportunityAmount,
          idempotencyKey,
        },
      },
    });

    return result.data?.convertLead;
  };
}

// =============================================================================
// React Component Example
// =============================================================================

/*
import { useLeads, useCreateLead } from './client-example';

export function LeadsList() {
  const { loading, error, data, fetchMore } = useLeads({ status: 'NEW' });
  const createLead = useCreateLead();

  const handleCreateLead = async () => {
    const result = await createLead({
      firstName: 'John',
      lastName: 'Doe',
      email: 'john@example.com',
    });

    if (result?.success) {
      console.log('Lead created:', result.lead);
    }
  };

  const loadMore = () => {
    if (data?.leads.pageInfo.hasNextPage) {
      fetchMore({
        variables: {
          after: data.leads.pageInfo.endCursor,
        },
      });
    }
  };

  if (loading) return <div>Loading...</div>;
  if (error) return <div>Error: {error.message}</div>;

  return (
    <div>
      <button onClick={handleCreateLead}>Create Lead</button>
      <ul>
        {data?.leads.edges.map(({ node }) => (
          <li key={node.id}>
            {node.firstName} {node.lastName} - {node.email}
          </li>
        ))}
      </ul>
      {data?.leads.pageInfo.hasNextPage && (
        <button onClick={loadMore}>Load More</button>
      )}
    </div>
  );
}
*/

// =============================================================================
// Helper: Relay-style pagination
// =============================================================================

function relayStylePagination(): any {
  return {
    keyArgs: ['filter'],
    merge(existing: any, incoming: any, { args }: any) {
      if (!existing) return incoming;

      if (!args?.after) {
        // First page, replace all
        return incoming;
      }

      // Append new edges
      return {
        ...incoming,
        edges: [...existing.edges, ...incoming.edges],
      };
    },
  };
}
