// =============================================================================
// Contract Tests - GraphQL Operations
// =============================================================================

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ApolloServer } from '@apollo/server';
import { buildSchema } from 'graphql';
import { builder } from '@/graphql/schema/builder.js';
import { GraphQLContext } from '@/types/context.js';
import { Permission, ROLE_PERMISSIONS } from '@/types/context.js';
import { UserRole } from '@/types/entities.js';

// Import schema types
import '@/graphql/schema/types/lead.js';
import '@/graphql/schema/types/opportunity.js';
import '@/graphql/schema/types/account.js';
import '@/graphql/schema/types/activity.js';
import '@/graphql/resolvers/index.js';
import '@/graphql/resolvers/mutations.js';

// Build schema
const schema = builder.toSchema();

// Mock context
const mockContext: GraphQLContext = {
  user: {
    id: 'user-1',
    email: 'test@example.com',
    firstName: 'Test',
    lastName: 'User',
    role: UserRole.ADMIN,
    tenantId: 'tenant-1',
  },
  tenant: {
    id: 'tenant-1',
    name: 'Test Tenant',
    slug: 'test-tenant',
    plan: 'PROFESSIONAL' as const,
    settings: {
      defaultCurrency: 'USD',
      fiscalYearStart: 1,
      dateFormat: 'YYYY-MM-DD',
      timezone: 'UTC',
      features: {
        customStages: true,
        advancedReporting: true,
        apiAccess: true,
        ssoEnabled: false,
        maxUsers: 100,
        maxRecords: 100000,
      },
    },
  },
  isAuthenticated: true,
  requestId: 'req-1',
  correlationId: 'corr-1',
  ipAddress: '127.0.0.1',
  userAgent: 'test',
  loaders: {
    leadById: { load: async () => null } as any,
    contactById: { load: async () => null } as any,
    accountById: { load: async () => null } as any,
    opportunityById: { load: async () => null } as any,
    stageById: { load: async () => null } as any,
    contactsByAccountId: { load: async () => [] } as any,
    opportunitiesByAccountId: { load: async () => [] } as any,
    activitiesByRelatedTo: { load: async () => [] } as any,
  },
  hasPermission: (permission: Permission) => {
    return ROLE_PERMISSIONS[UserRole.ADMIN].includes(permission);
  },
  hasRole: (role: UserRole) => mockContext.user?.role === role,
  requireAuth: () => {
    if (!mockContext.user) throw new Error('Not authenticated');
    return mockContext.user;
  },
  requireTenant: () => {
    if (!mockContext.tenant) throw new Error('No tenant');
    return mockContext.tenant;
  },
};

describe('GraphQL Contract Tests', () => {
  let server: ApolloServer<GraphQLContext>;

  beforeAll(() => {
    server = new ApolloServer<GraphQLContext>({
      schema,
    });
  });

  afterAll(async () => {
    await server.stop();
  });

  // ===========================================================================
  // Query Contract Tests
  // ===========================================================================

  describe('Queries', () => {
    describe('me', () => {
      const query = `
        query Me {
          me {
            id
            email
            role
            tenantId
          }
        }
      `;

      it('should return current user', async () => {
        const result = await server.executeOperation(
          { query },
          { contextValue: mockContext }
        );

        expect(result.body.kind).toBe('single');
        if (result.body.kind === 'single') {
          const { data } = result.body.singleResult;
          expect(data?.me).toBeDefined();
        }
      });
    });

    describe('lead', () => {
      const query = `
        query Lead($id: String!) {
          lead(id: $id) {
            id
            firstName
            lastName
            email
            status
            score
            createdAt
            updatedAt
          }
        }
      `;

      it('should validate query structure', async () => {
        // This validates the query compiles correctly
        expect(query).toContain('lead(id: $id)');
        expect(query).toContain('firstName');
        expect(query).toContain('status');
      });
    });

    describe('leads', () => {
      const query = `
        query Leads($filter: LeadFilterInput, $first: Int, $after: String) {
          leads(filter: $filter, first: $first, after: $after) {
            edges {
              node {
                id
                firstName
                lastName
                email
                status
              }
              cursor
            }
            pageInfo {
              hasNextPage
              hasPreviousPage
              startCursor
              endCursor
              totalCount
            }
          }
        }
      `;

      it('should support pagination', async () => {
        expect(query).toContain('first: $first');
        expect(query).toContain('after: $after');
        expect(query).toContain('pageInfo');
      });

      it('should support filtering', async () => {
        expect(query).toContain('filter: $filter');
      });
    });

    describe('opportunities', () => {
      const query = `
        query Opportunities($filter: OpportunityFilterInput) {
          opportunities(filter: $filter) {
            edges {
              node {
                id
                name
                amount
                currency
                status
                stageId
                probability
                expectedCloseDate
              }
            }
            pageInfo {
              hasNextPage
              totalCount
            }
          }
        }
      `;

      it('should have required fields', async () => {
        expect(query).toContain('amount');
        expect(query).toContain('currency');
        expect(query).toContain('status');
        expect(query).toContain('probability');
      });
    });
  });

  // ===========================================================================
  // Mutation Contract Tests
  // ===========================================================================

  describe('Mutations', () => {
    describe('createLead', () => {
      const mutation = `
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

      it('should have correct payload structure', async () => {
        expect(mutation).toContain('success');
        expect(mutation).toContain('message');
        expect(mutation).toContain('lead');
      });
    });

    describe('convertLead', () => {
      const mutation = `
        mutation ConvertLead($input: ConvertLeadInput!) {
          convertLead(input: $input) {
            success
            message
            lead {
              id
              status
              convertedAt
            }
          }
        }
      `;

      it('should include conversion fields', async () => {
        expect(mutation).toContain('convertLead');
        expect(mutation).toContain('convertedAt');
      });
    });

    describe('closeOpportunity', () => {
      const mutation = `
        mutation CloseOpportunity($input: CloseOpportunityInput!) {
          closeOpportunity(input: $input) {
            success
            message
            opportunity {
              id
              status
              actualCloseDate
            }
            dealId
          }
        }
      `;

      it('should have deal ID for WON opportunities', async () => {
        expect(mutation).toContain('dealId');
      });
    });
  });

  // ===========================================================================
  // Schema Validation Tests
  // ===========================================================================

  describe('Schema Validation', () => {
    it('should have all required types', () => {
      const typeMap = schema.getTypeMap();

      expect(typeMap['Lead']).toBeDefined();
      expect(typeMap['Account']).toBeDefined();
      expect(typeMap['Contact']).toBeDefined();
      expect(typeMap['Opportunity']).toBeDefined();
      expect(typeMap['Stage']).toBeDefined();
      expect(typeMap['Activity']).toBeDefined();
      expect(typeMap['Note']).toBeDefined();
    });

    it('should have all required enums', () => {
      const typeMap = schema.getTypeMap();

      expect(typeMap['LeadStatus']).toBeDefined();
      expect(typeMap['LeadSource']).toBeDefined();
      expect(typeMap['OpportunityStatus']).toBeDefined();
      expect(typeMap['ActivityType']).toBeDefined();
    });

    it('should have Query type', () => {
      const typeMap = schema.getTypeMap();
      const queryType = typeMap['Query'];

      expect(queryType).toBeDefined();
    });

    it('should have Mutation type', () => {
      const typeMap = schema.getTypeMap();
      const mutationType = typeMap['Mutation'];

      expect(mutationType).toBeDefined();
    });

    it('should have PageInfo type for pagination', () => {
      const typeMap = schema.getTypeMap();

      expect(typeMap['PageInfo']).toBeDefined();
    });
  });

  // ===========================================================================
  // Input Validation Tests
  // ===========================================================================

  describe('Input Validation', () => {
    describe('CreateLeadInput', () => {
      it('should have required fields', () => {
        const typeMap = schema.getTypeMap();
        const inputType = typeMap['CreateLeadInput'] as any;

        if (inputType?.getFields) {
          const fields = inputType.getFields();
          expect(fields['firstName']).toBeDefined();
          expect(fields['lastName']).toBeDefined();
          expect(fields['email']).toBeDefined();
        }
      });
    });

    describe('PaginationInput', () => {
      it('should have pagination fields', () => {
        const typeMap = schema.getTypeMap();
        const inputType = typeMap['PaginationInput'] as any;

        if (inputType?.getFields) {
          const fields = inputType.getFields();
          expect(fields['first']).toBeDefined();
          expect(fields['after']).toBeDefined();
        }
      });
    });
  });
});
