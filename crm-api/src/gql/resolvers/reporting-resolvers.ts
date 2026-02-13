// =============================================================================
// Reporting Resolvers
// =============================================================================

import { builder } from '../schema/builder.js';
import { reportingService } from '@/services/reporting.service.js';
import { GraphQLContext } from '@/types/context.js';

// =============================================================================
// Types
// =============================================================================

const DashboardStats = builder.simpleObject('DashboardStats', {
  fields: (t) => ({
    totalLeads: t.int({ nullable: false }),
    qualifiedLeads: t.int({ nullable: false }),
    convertedLeads: t.int({ nullable: false }),
    totalOpportunities: t.int({ nullable: false }),
    openOpportunities: t.int({ nullable: false }),
    totalPipelineValue: t.float({ nullable: false }),
    wonValue: t.float({ nullable: false }),
    lostValue: t.float({ nullable: false }),
  }),
});

const LeadSourceStats = builder.simpleObject('LeadSourceStats', {
  fields: (t) => ({
    source: t.string({ nullable: false }),
    total: t.int({ nullable: false }),
    converted: t.int({ nullable: false }),
    conversionRate: t.float({ nullable: false }),
  }),
});

const ActivityStats = builder.simpleObject('ActivityStats', {
  fields: (t) => ({
    type: t.string({ nullable: false }),
    count: t.int({ nullable: false }),
    completed: t.int({ nullable: false }),
  }),
});

// =============================================================================
// Queries
// =============================================================================

builder.queryFields((t) => ({
  dashboard: t.field({
    type: DashboardStats,
    nullable: false,
    resolve: async (_root, _args, ctx: GraphQLContext) => {
      if (!ctx.tenant) {
        throw new Error('Tenant required');
      }
      const stats = await reportingService.getDashboardStats(ctx.tenant.id);
      return stats;
    },
  }),

  leadConversionStats: t.field({
    type: [LeadSourceStats],
    nullable: false,
    resolve: async (_root, _args, ctx: GraphQLContext) => {
      if (!ctx.tenant) {
        throw new Error('Tenant required');
      }
      const stats = await reportingService.getLeadConversionStats(ctx.tenant.id);
      return stats.bySource;
    },
  }),

  activityStats: t.field({
    type: [ActivityStats],
    nullable: false,
    resolve: async (_root, _args, ctx: GraphQLContext) => {
      if (!ctx.tenant) {
        throw new Error('Tenant required');
      }
      const stats = await reportingService.getActivityStats(ctx.tenant.id);
      return stats.byType;
    },
  }),
}));
