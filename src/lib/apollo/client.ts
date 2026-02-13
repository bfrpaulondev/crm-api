'use client';

import {
  ApolloClient,
  InMemoryCache,
  ApolloLink,
  HttpLink,
  from,
} from '@apollo/client';
import { authLink, errorLink } from './auth-link';

const GRAPHQL_API_URL = 'https://crm-api-89lh.onrender.com/graphql';

function createApolloClient() {
  const httpLink = new HttpLink({
    uri: GRAPHQL_API_URL,
  });

  const link = from([
    errorLink,
    authLink,
    httpLink,
  ]);

  return new ApolloClient({
    link,
    cache: new InMemoryCache({
      typePolicies: {
        Query: {
          fields: {
            leads: {
              keyArgs: ['filter'],
              merge(existing, incoming, { args }) {
                if (!existing || !args) return incoming;
                
                const { first, after, last, before } = args;
                // If paginating forward, append to existing
                if (first && after) {
                  return {
                    ...incoming,
                    edges: [...existing.edges, ...incoming.edges],
                  };
                }
                // If paginating backward, prepend to existing
                if (last && before) {
                  return {
                    ...incoming,
                    edges: [...incoming.edges, ...existing.edges],
                  };
                }
                // Fresh query
                return incoming;
              },
            },
            opportunities: {
              keyArgs: ['filter'],
            },
          },
        },
        Lead: {
          fields: {
            fullName: {
              read(_, { readField }) {
                return `${readField('firstName')} ${readField('lastName')}`;
              },
            },
          },
        },
      },
    }),
    defaultOptions: {
      watchQuery: {
        fetchPolicy: 'cache-and-network',
        errorPolicy: 'all',
      },
      query: {
        fetchPolicy: 'cache-first',
        errorPolicy: 'all',
      },
      mutate: {
        errorPolicy: 'all',
      },
    },
  });
}

let apolloClient: ApolloClient<unknown> | undefined;

export function getApolloClient() {
  if (typeof window === 'undefined') {
    // Server: always create a new client
    return createApolloClient();
  }
  
  // Client: create client once
  if (!apolloClient) {
    apolloClient = createApolloClient();
  }
  
  return apolloClient;
}

export default getApolloClient;
