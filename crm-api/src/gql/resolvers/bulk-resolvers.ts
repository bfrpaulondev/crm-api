// =============================================================================
// Bulk Operations Resolvers
// =============================================================================

import { builder } from '../schema/builder.js';
import { bulkOperationsService } from '@/services/bulk-operations.service.js';
import { GraphQLContext } from '@/types/context.js';

// =============================================================================
// Types
// =============================================================================

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

// =============================================================================
// Bulk Mutations
// =============================================================================

builder.mutationFields((t) => ({
  bulkDeleteLeads: t.field({
    type: BulkOperationResultType,
    nullable: false,
    args: {
      ids: t.arg.stringList({ required: true }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      ctx.requireAuth();
      ctx.requireTenant();

      const result = await bulkOperationsService.bulkDeleteLeads(
        ctx.tenant.id,
        ctx.user.id,
        args.ids,
        ctx.requestId
      );

      return {
        success: result.success,
        processedCount: result.processedCount,
        successCount: result.successCount,
        failedCount: result.failedCount,
        errors: result.errors,
      };
    },
  }),
}));

export { BulkOperationResultType };
