// =============================================================================
// Bulk Operations Resolvers
// =============================================================================

import { builder } from '../builder.js';
import { bulkOperationsService } from '@/services/bulk-operations.service.js';
import { Errors } from '@/types/errors.js';

// =============================================================================
// Types
// =============================================================================

const BulkLeadCreateInput = builder.inputType('BulkLeadCreateInput', {
  fields: (t) => ({
    firstName: t.string({ required: true }),
    lastName: t.string({ required: true }),
    email: t.string({ required: true }),
    phone: t.string({ required: false }),
    companyName: t.string({ required: false }),
    title: t.string({ required: false }),
    source: t.string({ required: false }),
    tags: t.stringList({ required: false }),
  }),
});

const BulkLeadUpdateInput = builder.inputType('BulkLeadUpdateInput', {
  fields: (t) => ({
    id: t.string({ required: true }),
    firstName: t.string({ required: false }),
    lastName: t.string({ required: false }),
    email: t.string({ required: false }),
    phone: t.string({ required: false }),
    companyName: t.string({ required: false }),
    title: t.string({ required: false }),
    status: t.string({ required: false }),
    source: t.string({ required: false }),
    score: t.int({ required: false }),
    tags: t.stringList({ required: false }),
    ownerId: t.string({ required: false }),
  }),
});

const BulkOpportunityUpdateInput = builder.inputType('BulkOpportunityUpdateInput', {
  fields: (t) => ({
    id: t.string({ required: true }),
    stageId: t.string({ required: false }),
    amount: t.float({ required: false }),
    probability: t.int({ required: false }),
    expectedCloseDate: t.field({ type: 'DateTime', required: false }),
  }),
});

const BulkErrorType = builder.simpleObject('BulkError', {
  fields: (t) => ({
    index: t.int({ nullable: false }),
    error: t.string({ nullable: false }),
  }),
});

const BulkOperationResultType = builder.simpleObject('BulkOperationResult', {
  fields: (t) => ({
    success: t.boolean({ nullable: false }),
    processedCount: t.int({ nullable: false }),
    successCount: t.int({ nullable: false }),
    failedCount: t.int({ nullable: false }),
    errors: t.field({ type: [BulkErrorType], nullable: false }),
  }),
});

const ExportFilterInput = builder.inputType('ExportFilterInput', {
  fields: (t) => ({
    status: t.string({ required: false }),
    source: t.string({ required: false }),
    ownerId: t.string({ required: false }),
    createdAfter: t.field({ type: 'DateTime', required: false }),
    createdBefore: t.field({ type: 'DateTime', required: false }),
  }),
});

const LeadExportType = builder.simpleObject('LeadExport', {
  fields: (t) => ({
    id: t.string({ nullable: false }),
    firstName: t.string({ nullable: false }),
    lastName: t.string({ nullable: false }),
    email: t.string({ nullable: false }),
    phone: t.string({ nullable: true }),
    companyName: t.string({ nullable: true }),
    title: t.string({ nullable: true }),
    status: t.string({ nullable: false }),
    source: t.string({ nullable: true }),
    score: t.int({ nullable: false }),
    tags: t.stringList({ nullable: false }),
    createdAt: t.field({ type: 'DateTime', nullable: false }),
  }),
});

// =============================================================================
// Bulk Mutations
// =============================================================================

builder.mutationType({
  fields: (t) => ({
    // Bulk create leads
    bulkCreateLeads: t.field({
      type: BulkOperationResultType,
      nullable: false,
      args: {
        leads: t.arg({ type: [BulkLeadCreateInput], required: true }),
      },
      authScopes: { authenticated: true },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission('LEAD_CREATE')) {
          throw Errors.insufficientPermissions('LEAD_CREATE');
        }

        const leads = args.leads.map((l) => ({
          firstName: l.firstName,
          lastName: l.lastName,
          email: l.email,
          phone: l.phone ?? undefined,
          companyName: l.companyName ?? undefined,
          title: l.title ?? undefined,
          source: l.source ?? undefined,
          tags: l.tags ?? [],
        }));

        return bulkOperationsService.bulkCreateLeads(
          ctx.tenant.id,
          ctx.user.id,
          leads,
          ctx.requestId
        );
      },
    }),

    // Bulk update leads
    bulkUpdateLeads: t.field({
      type: BulkOperationResultType,
      nullable: false,
      args: {
        updates: t.arg({ type: [BulkLeadUpdateInput], required: true }),
      },
      authScopes: { authenticated: true },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission('LEAD_UPDATE')) {
          throw Errors.insufficientPermissions('LEAD_UPDATE');
        }

        const updates = args.updates.map((u) => {
          const data: Record<string, unknown> = {};
          if (u.firstName) data.firstName = u.firstName;
          if (u.lastName) data.lastName = u.lastName;
          if (u.email) data.email = u.email;
          if (u.phone !== undefined) data.phone = u.phone;
          if (u.companyName !== undefined) data.companyName = u.companyName;
          if (u.title !== undefined) data.title = u.title;
          if (u.status) data.status = u.status;
          if (u.source !== undefined) data.source = u.source;
          if (u.score !== undefined) data.score = u.score;
          if (u.tags) data.tags = u.tags;
          if (u.ownerId) data.ownerId = u.ownerId;

          return { id: u.id, data };
        });

        return bulkOperationsService.bulkUpdateLeads(
          ctx.tenant.id,
          ctx.user.id,
          updates,
          ctx.requestId
        );
      },
    }),

    // Bulk delete leads
    bulkDeleteLeads: t.field({
      type: BulkOperationResultType,
      nullable: false,
      args: {
        ids: t.arg.stringList({ required: true }),
      },
      authScopes: { authenticated: true },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission('LEAD_DELETE')) {
          throw Errors.insufficientPermissions('LEAD_DELETE');
        }

        return bulkOperationsService.bulkDeleteLeads(
          ctx.tenant.id,
          ctx.user.id,
          args.ids,
          ctx.requestId
        );
      },
    }),

    // Bulk assign leads
    bulkAssignLeads: t.field({
      type: BulkOperationResultType,
      nullable: false,
      args: {
        leadIds: t.arg.stringList({ required: true }),
        newOwnerId: t.arg.string({ required: true }),
      },
      authScopes: { authenticated: true },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission('LEAD_UPDATE')) {
          throw Errors.insufficientPermissions('LEAD_UPDATE');
        }

        return bulkOperationsService.bulkAssignLeads(
          ctx.tenant.id,
          ctx.user.id,
          args.leadIds,
          args.newOwnerId,
          ctx.requestId
        );
      },
    }),

    // Bulk add tags
    bulkAddTags: t.field({
      type: BulkOperationResultType,
      nullable: false,
      args: {
        leadIds: t.arg.stringList({ required: true }),
        tags: t.arg.stringList({ required: true }),
      },
      authScopes: { authenticated: true },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission('LEAD_UPDATE')) {
          throw Errors.insufficientPermissions('LEAD_UPDATE');
        }

        return bulkOperationsService.bulkAddTags(
          ctx.tenant.id,
          ctx.user.id,
          args.leadIds,
          args.tags,
          ctx.requestId
        );
      },
    }),

    // Bulk update opportunity stages
    bulkUpdateOpportunityStages: t.field({
      type: BulkOperationResultType,
      nullable: false,
      args: {
        updates: t.arg({ type: [BulkOpportunityUpdateInput], required: true }),
      },
      authScopes: { authenticated: true },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission('OPPORTUNITY_UPDATE')) {
          throw Errors.insufficientPermissions('OPPORTUNITY_UPDATE');
        }

        const updates = args.updates.map((u) => ({
          id: u.id,
          stageId: u.stageId ?? undefined,
          amount: u.amount ?? undefined,
          probability: u.probability ?? undefined,
          expectedCloseDate: u.expectedCloseDate ? new Date(u.expectedCloseDate) : undefined,
        }));

        return bulkOperationsService.bulkUpdateOpportunityStages(
          ctx.tenant.id,
          ctx.user.id,
          updates,
          ctx.requestId
        );
      },
    }),

    // Import leads from JSON
    importLeads: t.field({
      type: BulkOperationResultType,
      nullable: false,
      args: {
        data: t.field({ type: 'JSON', required: true }),
      },
      authScopes: { authenticated: true },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission('LEAD_CREATE')) {
          throw Errors.insufficientPermissions('LEAD_CREATE');
        }

        const data = args.data as Record<string, unknown>[];

        return bulkOperationsService.importLeads(
          ctx.tenant.id,
          ctx.user.id,
          data,
          ctx.requestId
        );
      },
    }),
  }),
});

// =============================================================================
// Export Query
// =============================================================================

builder.queryType({
  fields: (t) => ({
    // Export leads
    exportLeads: t.field({
      type: [LeadExportType],
      nullable: false,
      args: {
        filter: t.arg({ type: ExportFilterInput, required: false }),
      },
      authScopes: { authenticated: true },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission('LEAD_READ')) {
          throw Errors.insufficientPermissions('LEAD_READ');
        }

        const filter = args.filter
          ? {
              status: args.filter.status ?? undefined,
              source: args.filter.source ?? undefined,
              ownerId: args.filter.ownerId ?? undefined,
              createdAfter: args.filter.createdAfter
                ? new Date(args.filter.createdAfter)
                : undefined,
              createdBefore: args.filter.createdBefore
                ? new Date(args.filter.createdBefore)
                : undefined,
            }
          : undefined;

        const results = await bulkOperationsService.exportLeads(ctx.tenant.id, filter);

        return results.map((r) => ({
          id: r.id as string,
          firstName: r.firstName as string,
          lastName: r.lastName as string,
          email: r.email as string,
          phone: r.phone as string | null,
          companyName: r.companyName as string | null,
          title: r.title as string | null,
          status: r.status as string,
          source: r.source as string | null,
          score: r.score as number,
          tags: r.tags as string[],
          createdAt: r.createdAt as Date,
        }));
      },
    }),
  }),
});

export { BulkOperationResultType };
