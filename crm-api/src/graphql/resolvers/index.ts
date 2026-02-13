// =============================================================================
// GraphQL Query Resolvers
// =============================================================================

import { builder } from '../builder.js';
import { leadService } from '@/services/lead.service.js';
import { webhookService } from '@/services/webhook.service.js';
import { leadRepository } from '@/repositories/lead.repository.js';
import { accountRepository } from '@/repositories/account.repository.js';
import { contactRepository } from '@/repositories/contact.repository.js';
import { opportunityRepository } from '@/repositories/opportunity.repository.js';
import { stageRepository } from '@/repositories/stage.repository.js';
import { Errors } from '@/types/errors.js';
import { Permission } from '@/types/context.js';
import {
  LeadType,
  LeadFilterInput,
  LeadStatusEnum,
  LeadSourceEnum,
} from '../types/lead.js';
import {
  AccountGraphQLType,
  ContactGraphQLType,
  AccountFilterInput,
  ContactFilterInput,
} from '../types/account.js';
import {
  OpportunityGraphQLType,
  StageType,
  OpportunityFilterInput,
  OpportunityStatusEnum,
} from '../types/opportunity.js';
import {
  ActivityGraphQLType,
  ActivityFilterInput,
} from '../types/activity.js';
import {
  WebhookConfigType,
  WebhookDeliveryType,
  WebhookFilterInput,
  WebhookDeliveryFilterInput,
  WebhookConnectionType,
  WebhookDeliveryConnectionType,
  WebhookEventEnum,
  WebhookEventCategoryType,
} from '../types/webhook.js';

// =============================================================================
// Me Query
// =============================================================================

const MeType = builder.simpleObject('Me', {
  fields: (t) => ({
    id: t.string({ nullable: false }),
    email: t.string({ nullable: false }),
    firstName: t.string({ nullable: false }),
    lastName: t.string({ nullable: false }),
    role: t.string({ nullable: false }),
    tenantId: t.string({ nullable: false }),
  }),
});

// =============================================================================
// Queries
// =============================================================================

builder.queryType({
  fields: (t) => ({
    // Me query - retorna utilizador atual
    me: t.field({
      type: MeType,
      nullable: true,
      resolve: (_parent, _args, ctx) => {
        if (!ctx.user) return null;

        return {
          id: ctx.user.id,
          email: ctx.user.email,
          firstName: '', // Would load from DB
          lastName: '',
          role: ctx.user.role,
          tenantId: ctx.user.tenantId,
        };
      },
    }),

    // =========================================================================
    // Lead Queries
    // =========================================================================

    lead: t.field({
      type: LeadType,
      nullable: true,
      args: {
        id: t.arg.string({ required: true }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.LEAD_READ)) {
          throw Errors.insufficientPermissions('LEAD_READ');
        }

        return leadRepository.findById(args.id, ctx.tenant.id);
      },
    }),

    leads: t.field({
      type: 'PaginatedLeads', // Definido abaixo
      nullable: false,
      args: {
        filter: t.arg({ type: LeadFilterInput, required: false }),
        first: t.arg.int({ required: false }),
        after: t.arg.string({ required: false }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.LEAD_READ)) {
          throw Errors.insufficientPermissions('LEAD_READ');
        }

        const result = await leadRepository.findWithFilters(
          ctx.tenant.id,
          args.filter ? {
            status: args.filter.status,
            source: args.filter.source,
            ownerId: args.filter.ownerId,
            search: args.filter.search,
            tags: args.filter.tags,
            createdAfter: args.filter.createdAfter,
            createdBefore: args.filter.createdBefore,
            hasCompany: args.filter.hasCompany,
            minScore: args.filter.minScore,
          } : undefined,
          { limit: args.first, cursor: args.after }
        );

        return {
          edges: result.data.map((lead) => ({
            node: lead,
            cursor: lead._id.toHexString(),
          })),
          pageInfo: {
            hasNextPage: result.hasNextPage,
            hasPreviousPage: result.hasPreviousPage,
            startCursor: result.startCursor,
            endCursor: result.endCursor,
            totalCount: result.totalCount,
          },
        };
      },
    }),

    // =========================================================================
    // Account Queries
    // =========================================================================

    account: t.field({
      type: AccountGraphQLType,
      nullable: true,
      args: {
        id: t.arg.string({ required: true }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.ACCOUNT_READ)) {
          throw Errors.insufficientPermissions('ACCOUNT_READ');
        }

        return accountRepository.findById(args.id, ctx.tenant.id);
      },
    }),

    accounts: t.field({
      type: 'PaginatedAccounts',
      nullable: false,
      args: {
        filter: t.arg({ type: AccountFilterInput, required: false }),
        first: t.arg.int({ required: false }),
        after: t.arg.string({ required: false }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.ACCOUNT_READ)) {
          throw Errors.insufficientPermissions('ACCOUNT_READ');
        }

        const result = await accountRepository.findWithFilters(
          ctx.tenant.id,
          args.filter ? {
            type: args.filter.type,
            tier: args.filter.tier,
            status: args.filter.status,
            ownerId: args.filter.ownerId,
            industry: args.filter.industry,
            search: args.filter.search,
          } : undefined,
          { limit: args.first, cursor: args.after }
        );

        return {
          edges: result.data.map((account) => ({
            node: account,
            cursor: account._id.toHexString(),
          })),
          pageInfo: {
            hasNextPage: result.hasNextPage,
            hasPreviousPage: result.hasPreviousPage,
            startCursor: result.startCursor,
            endCursor: result.endCursor,
            totalCount: result.totalCount,
          },
        };
      },
    }),

    // =========================================================================
    // Contact Queries
    // =========================================================================

    contact: t.field({
      type: ContactGraphQLType,
      nullable: true,
      args: {
        id: t.arg.string({ required: true }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.CONTACT_READ)) {
          throw Errors.insufficientPermissions('CONTACT_READ');
        }

        return contactRepository.findById(args.id, ctx.tenant.id);
      },
    }),

    contacts: t.field({
      type: 'PaginatedContacts',
      nullable: false,
      args: {
        filter: t.arg({ type: ContactFilterInput, required: false }),
        first: t.arg.int({ required: false }),
        after: t.arg.string({ required: false }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.CONTACT_READ)) {
          throw Errors.insufficientPermissions('CONTACT_READ');
        }

        const result = await contactRepository.findWithFilters(
          ctx.tenant.id,
          args.filter ? {
            accountId: args.filter.accountId,
            ownerId: args.filter.ownerId,
            search: args.filter.search,
            isPrimary: args.filter.isPrimary,
            isDecisionMaker: args.filter.isDecisionMaker,
          } : undefined,
          { limit: args.first, cursor: args.after }
        );

        return {
          edges: result.data.map((contact) => ({
            node: contact,
            cursor: contact._id.toHexString(),
          })),
          pageInfo: {
            hasNextPage: result.hasNextPage,
            hasPreviousPage: result.hasPreviousPage,
            startCursor: result.startCursor,
            endCursor: result.endCursor,
            totalCount: result.totalCount,
          },
        };
      },
    }),

    // =========================================================================
    // Opportunity Queries
    // =========================================================================

    opportunity: t.field({
      type: OpportunityGraphQLType,
      nullable: true,
      args: {
        id: t.arg.string({ required: true }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.OPPORTUNITY_READ)) {
          throw Errors.insufficientPermissions('OPPORTUNITY_READ');
        }

        return opportunityRepository.findById(args.id, ctx.tenant.id);
      },
    }),

    opportunities: t.field({
      type: 'PaginatedOpportunities',
      nullable: false,
      args: {
        filter: t.arg({ type: OpportunityFilterInput, required: false }),
        first: t.arg.int({ required: false }),
        after: t.arg.string({ required: false }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.OPPORTUNITY_READ)) {
          throw Errors.insufficientPermissions('OPPORTUNITY_READ');
        }

        const result = await opportunityRepository.findWithFilters(
          ctx.tenant.id,
          args.filter ? {
            accountId: args.filter.accountId,
            ownerId: args.filter.ownerId,
            stageId: args.filter.stageId,
            status: args.filter.status,
            type: args.filter.type,
            search: args.filter.search,
            minAmount: args.filter.minAmount,
            maxAmount: args.filter.maxAmount,
            expectedCloseAfter: args.filter.expectedCloseAfter,
            expectedCloseBefore: args.filter.expectedCloseBefore,
          } : undefined,
          { limit: args.first, cursor: args.after }
        );

        return {
          edges: result.data.map((opp) => ({
            node: opp,
            cursor: opp._id.toHexString(),
          })),
          pageInfo: {
            hasNextPage: result.hasNextPage,
            hasPreviousPage: result.hasPreviousPage,
            startCursor: result.startCursor,
            endCursor: result.endCursor,
            totalCount: result.totalCount,
          },
        };
      },
    }),

    // =========================================================================
    // Stage Queries
    // =========================================================================

    stages: t.field({
      type: [StageType],
      nullable: false,
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, _args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        return stageRepository.findActiveStages(ctx.tenant.id);
      },
    }),

    // =========================================================================
    // Webhook Queries
    // =========================================================================

    webhook: t.field({
      type: WebhookConfigType,
      nullable: true,
      args: {
        id: t.arg.string({ required: true }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.WEBHOOK_READ)) {
          throw Errors.insufficientPermissions('WEBHOOK_READ');
        }

        try {
          return await webhookService.getWebhook(args.id, ctx.tenant.id);
        } catch {
          return null;
        }
      },
    }),

    webhooks: t.field({
      type: WebhookConnectionType,
      nullable: false,
      args: {
        filter: t.arg({ type: WebhookFilterInput, required: false }),
        first: t.arg.int({ required: false }),
        skip: t.arg.int({ required: false }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.WEBHOOK_READ)) {
          throw Errors.insufficientPermissions('WEBHOOK_READ');
        }

        return webhookService.listWebhooks(ctx.tenant.id, args.filter ? {
          isActive: args.filter.isActive ?? undefined,
          events: args.filter.events as import('@/types/webhook.js').WebhookEvent[] | undefined,
        } : undefined, {
          limit: args.first ?? 50,
          skip: args.skip ?? 0,
        });
      },
    }),

    webhookDeliveries: t.field({
      type: WebhookDeliveryConnectionType,
      nullable: false,
      args: {
        filter: t.arg({ type: WebhookDeliveryFilterInput, required: false }),
        first: t.arg.int({ required: false }),
        skip: t.arg.int({ required: false }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.WEBHOOK_READ)) {
          throw Errors.insufficientPermissions('WEBHOOK_READ');
        }

        return webhookService.getAllDeliveryLogs(ctx.tenant.id, args.filter ? {
          webhookId: args.filter.webhookId ?? undefined,
          status: args.filter.status as import('@/types/webhook.js').WebhookDeliveryStatus | undefined,
          event: args.filter.event as import('@/types/webhook.js').WebhookEvent | undefined,
          startDate: args.filter.startDate ?? undefined,
          endDate: args.filter.endDate ?? undefined,
        } : undefined, {
          limit: args.first ?? 50,
          skip: args.skip ?? 0,
        });
      },
    }),

    webhookEvents: t.field({
      type: [WebhookEventCategoryType],
      nullable: false,
      resolve: async () => {
        const categories = [
          { category: 'LEAD', events: import('@/types/webhook.js').WEBHOOK_EVENTS_BY_CATEGORY.LEAD },
          { category: 'OPPORTUNITY', events: import('@/types/webhook.js').WEBHOOK_EVENTS_BY_CATEGORY.OPPORTUNITY },
          { category: 'ACCOUNT', events: import('@/types/webhook.js').WEBHOOK_EVENTS_BY_CATEGORY.ACCOUNT },
          { category: 'CONTACT', events: import('@/types/webhook.js').WEBHOOK_EVENTS_BY_CATEGORY.CONTACT },
          { category: 'ACTIVITY', events: import('@/types/webhook.js').WEBHOOK_EVENTS_BY_CATEGORY.ACTIVITY },
        ];
        return categories;
      },
    }),
  }),
});

// =============================================================================
// Pagination Types
// =============================================================================

// Lead Edge
const LeadEdge = builder.simpleObject('LeadEdge', {
  fields: (t) => ({
    node: t.field({ type: LeadType, nullable: false }),
    cursor: t.string({ nullable: false }),
  }),
});

// Lead Connection
const PaginatedLeads = builder.simpleObject('PaginatedLeads', {
  fields: (t) => ({
    edges: t.field({ type: [LeadEdge], nullable: false }),
    pageInfo: t.field({ type: 'PageInfo', nullable: false }),
  }),
});

// Account Edge
const AccountEdge = builder.simpleObject('AccountEdge', {
  fields: (t) => ({
    node: t.field({ type: AccountGraphQLType, nullable: false }),
    cursor: t.string({ nullable: false }),
  }),
});

// Account Connection
const PaginatedAccounts = builder.simpleObject('PaginatedAccounts', {
  fields: (t) => ({
    edges: t.field({ type: [AccountEdge], nullable: false }),
    pageInfo: t.field({ type: 'PageInfo', nullable: false }),
  }),
});

// Contact Edge
const ContactEdge = builder.simpleObject('ContactEdge', {
  fields: (t) => ({
    node: t.field({ type: ContactGraphQLType, nullable: false }),
    cursor: t.string({ nullable: false }),
  }),
});

// Contact Connection
const PaginatedContacts = builder.simpleObject('PaginatedContacts', {
  fields: (t) => ({
    edges: t.field({ type: [ContactEdge], nullable: false }),
    pageInfo: t.field({ type: 'PageInfo', nullable: false }),
  }),
});

// Opportunity Edge
const OpportunityEdge = builder.simpleObject('OpportunityEdge', {
  fields: (t) => ({
    node: t.field({ type: OpportunityGraphQLType, nullable: false }),
    cursor: t.string({ nullable: false }),
  }),
});

// Opportunity Connection
const PaginatedOpportunities = builder.simpleObject('PaginatedOpportunities', {
  fields: (t) => ({
    edges: t.field({ type: [OpportunityEdge], nullable: false }),
    pageInfo: t.field({ type: 'PageInfo', nullable: false }),
  }),
});

export {
  MeType,
  LeadEdge,
  PaginatedLeads,
  AccountEdge,
  PaginatedAccounts,
  ContactEdge,
  PaginatedContacts,
  OpportunityEdge,
  PaginatedOpportunities,
};
