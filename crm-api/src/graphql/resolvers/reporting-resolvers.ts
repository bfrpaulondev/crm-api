// =============================================================================
// Reporting Resolvers
// =============================================================================

import { builder } from '../builder.js';
import { reportingService } from '@/services/reporting.service.js';
import { Errors } from '@/types/errors.js';

// =============================================================================
// Analytics Types
// =============================================================================

const StageAnalyticsType = builder.simpleObject('StageAnalytics', {
  fields: (t) => ({
    stageId: t.string({ nullable: false }),
    stageName: t.string({ nullable: false }),
    count: t.int({ nullable: false }),
    value: t.float({ nullable: false }),
    probability: t.int({ nullable: false }),
  }),
});

const PipelineAnalyticsType = builder.simpleObject('PipelineAnalytics', {
  fields: (t) => ({
    totalOpen: t.int({ nullable: false }),
    totalValue: t.float({ nullable: false }),
    weightedValue: t.float({ nullable: false }),
    byStage: t.field({ type: [StageAnalyticsType], nullable: false }),
    conversionRate: t.float({ nullable: false }),
    avgDealSize: t.float({ nullable: false }),
    avgDaysToClose: t.float({ nullable: false }),
  }),
});

const MonthlyRevenueType = builder.simpleObject('MonthlyRevenue', {
  fields: (t) => ({
    month: t.string({ nullable: false }),
    revenue: t.float({ nullable: false }),
    deals: t.int({ nullable: false }),
  }),
});

const SourceRevenueType = builder.simpleObject('SourceRevenue', {
  fields: (t) => ({
    source: t.string({ nullable: false }),
    revenue: t.float({ nullable: false }),
    count: t.int({ nullable: false }),
  }),
});

const RevenueAnalyticsType = builder.simpleObject('RevenueAnalytics', {
  fields: (t) => ({
    totalRevenue: t.float({ nullable: false }),
    periodRevenue: t.float({ nullable: false }),
    forecastedRevenue: t.float({ nullable: false }),
    byMonth: t.field({ type: [MonthlyRevenueType], nullable: false }),
    bySource: t.field({ type: [SourceRevenueType], nullable: false }),
  }),
});

const SourceAnalyticsType = builder.simpleObject('SourceAnalytics', {
  fields: (t) => ({
    source: t.string({ nullable: false }),
    count: t.int({ nullable: false }),
    converted: t.int({ nullable: false }),
    conversionRate: t.float({ nullable: false }),
  }),
});

const LeadAnalyticsType = builder.simpleObject('LeadAnalytics', {
  fields: (t) => ({
    totalLeads: t.int({ nullable: false }),
    newLeads: t.int({ nullable: false }),
    convertedLeads: t.int({ nullable: false }),
    conversionRate: t.float({ nullable: false }),
    byStatus: t.field({ type: 'JSON', nullable: false }),
    bySource: t.field({ type: [SourceAnalyticsType], nullable: false }),
    avgTimeToConvert: t.float({ nullable: false }),
  }),
});

const ActivityAnalyticsType = builder.simpleObject('ActivityAnalytics', {
  fields: (t) => ({
    totalActivities: t.int({ nullable: false }),
    completedActivities: t.int({ nullable: false }),
    completionRate: t.float({ nullable: false }),
    byType: t.field({ type: 'JSON', nullable: false }),
    byStatus: t.field({ type: 'JSON', nullable: false }),
    overdueTasks: t.int({ nullable: false }),
    avgCompletionTime: t.float({ nullable: false }),
  }),
});

const UserPerformanceType = builder.simpleObject('UserPerformance', {
  fields: (t) => ({
    userId: t.string({ nullable: false }),
    userName: t.string({ nullable: false }),
    leadsCreated: t.int({ nullable: false }),
    leadsConverted: t.int({ nullable: false }),
    opportunitiesCreated: t.int({ nullable: false }),
    opportunitiesWon: t.int({ nullable: false }),
    revenueClosed: t.float({ nullable: false }),
    activitiesCompleted: t.int({ nullable: false }),
    conversionRate: t.float({ nullable: false }),
    winRate: t.float({ nullable: false }),
  }),
});

const TopPerformerType = builder.simpleObject('TopPerformer', {
  fields: (t) => ({
    userId: t.string({ nullable: false }),
    userName: t.string({ nullable: false }),
    metric: t.string({ nullable: false }),
    value: t.float({ nullable: false }),
  }),
});

const TeamPerformanceType = builder.simpleObject('TeamPerformance', {
  fields: (t) => ({
    users: t.field({ type: [UserPerformanceType], nullable: false }),
    topPerformer: t.field({ type: TopPerformerType, nullable: true }),
  }),
});

const LeadStatsType = builder.simpleObject('LeadStats', {
  fields: (t) => ({
    total: t.int({ nullable: false }),
    new: t.int({ nullable: false }),
    qualified: t.int({ nullable: false }),
    converted: t.int({ nullable: false }),
  }),
});

const OpportunityStatsType = builder.simpleObject('OpportunityStats', {
  fields: (t) => ({
    total: t.int({ nullable: false }),
    open: t.int({ nullable: false }),
    won: t.int({ nullable: false }),
    lost: t.int({ nullable: false }),
    pipelineValue: t.float({ nullable: false }),
  }),
});

const ActivityStatsType = builder.simpleObject('ActivityStats', {
  fields: (t) => ({
    total: t.int({ nullable: false }),
    pending: t.int({ nullable: false }),
    completed: t.int({ nullable: false }),
    overdue: t.int({ nullable: false }),
  }),
});

const RevenueStatsType = builder.simpleObject('RevenueStats', {
  fields: (t) => ({
    totalWon: t.float({ nullable: false }),
    thisMonth: t.float({ nullable: false }),
    forecasted: t.float({ nullable: false }),
  }),
});

const DashboardStatsType = builder.simpleObject('DashboardStats', {
  fields: (t) => ({
    leads: t.field({ type: LeadStatsType, nullable: false }),
    opportunities: t.field({ type: OpportunityStatsType, nullable: false }),
    activities: t.field({ type: ActivityStatsType, nullable: false }),
    revenue: t.field({ type: RevenueStatsType, nullable: false }),
  }),
});

const DateRangeInput = builder.inputType('DateRangeInput', {
  fields: (t) => ({
    startDate: t.field({ type: 'DateTime', required: true }),
    endDate: t.field({ type: 'DateTime', required: true }),
  }),
});

// Register JSON scalar
builder.scalarType('JSON', {
  serialize: (value) => value,
  parseValue: (value) => value,
});

// =============================================================================
// Reporting Queries
// =============================================================================

builder.queryType({
  fields: (t) => ({
    // Pipeline analytics
    pipelineAnalytics: t.field({
      type: PipelineAnalyticsType,
      nullable: false,
      args: {
        dateRange: t.arg({ type: DateRangeInput, required: false }),
      },
      authScopes: { authenticated: true },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission('OPPORTUNITY_READ')) {
          throw Errors.insufficientPermissions('OPPORTUNITY_READ');
        }

        const range = args.dateRange
          ? {
              startDate: new Date(args.dateRange.startDate),
              endDate: new Date(args.dateRange.endDate),
            }
          : undefined;

        return reportingService.getPipelineAnalytics(ctx.tenant.id, range);
      },
    }),

    // Revenue analytics
    revenueAnalytics: t.field({
      type: RevenueAnalyticsType,
      nullable: false,
      args: {
        dateRange: t.arg({ type: DateRangeInput, required: false }),
      },
      authScopes: { authenticated: true },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission('OPPORTUNITY_READ')) {
          throw Errors.insufficientPermissions('OPPORTUNITY_READ');
        }

        const range = args.dateRange
          ? {
              startDate: new Date(args.dateRange.startDate),
              endDate: new Date(args.dateRange.endDate),
            }
          : undefined;

        return reportingService.getRevenueAnalytics(ctx.tenant.id, range);
      },
    }),

    // Lead analytics
    leadAnalytics: t.field({
      type: LeadAnalyticsType,
      nullable: false,
      args: {
        dateRange: t.arg({ type: DateRangeInput, required: false }),
      },
      authScopes: { authenticated: true },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission('LEAD_READ')) {
          throw Errors.insufficientPermissions('LEAD_READ');
        }

        const range = args.dateRange
          ? {
              startDate: new Date(args.dateRange.startDate),
              endDate: new Date(args.dateRange.endDate),
            }
          : undefined;

        return reportingService.getLeadAnalytics(ctx.tenant.id, range);
      },
    }),

    // Activity analytics
    activityAnalytics: t.field({
      type: ActivityAnalyticsType,
      nullable: false,
      args: {
        dateRange: t.arg({ type: DateRangeInput, required: false }),
      },
      authScopes: { authenticated: true },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission('ACTIVITY_READ')) {
          throw Errors.insufficientPermissions('ACTIVITY_READ');
        }

        const range = args.dateRange
          ? {
              startDate: new Date(args.dateRange.startDate),
              endDate: new Date(args.dateRange.endDate),
            }
          : undefined;

        return reportingService.getActivityAnalytics(ctx.tenant.id, range);
      },
    }),

    // Team performance
    teamPerformance: t.field({
      type: TeamPerformanceType,
      nullable: false,
      args: {
        dateRange: t.arg({ type: DateRangeInput, required: false }),
      },
      authScopes: { authenticated: true },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasRole('ADMIN') && !ctx.hasRole('MANAGER')) {
          throw Errors.insufficientPermissions('ADMIN_ACCESS');
        }

        const range = args.dateRange
          ? {
              startDate: new Date(args.dateRange.startDate),
              endDate: new Date(args.dateRange.endDate),
            }
          : undefined;

        return reportingService.getTeamPerformance(ctx.tenant.id, range);
      },
    }),

    // Dashboard stats (quick overview)
    dashboardStats: t.field({
      type: DashboardStatsType,
      nullable: false,
      authScopes: { authenticated: true },
      resolve: async (_parent, _args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        return reportingService.getDashboardStats(ctx.tenant.id);
      },
    }),
  }),
});

export {
  PipelineAnalyticsType,
  RevenueAnalyticsType,
  LeadAnalyticsType,
  ActivityAnalyticsType,
  TeamPerformanceType,
  DashboardStatsType,
};
