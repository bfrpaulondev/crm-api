// =============================================================================
// Reporting & Analytics Service
// =============================================================================

import { getDb } from '@/infrastructure/mongo/connection.js';
import { getRedis, cacheGet, cacheSet } from '@/infrastructure/redis/client.js';
import { logger } from '@/infrastructure/logging/index.js';
import { LeadStatus, OpportunityStatus, ActivityStatus } from '@/types/entities.js';

// =============================================================================
// Types
// =============================================================================

export interface DateRange {
  startDate: Date;
  endDate: Date;
}

export interface PipelineAnalytics {
  totalOpen: number;
  totalValue: number;
  weightedValue: number;
  byStage: Array<{
    stageId: string;
    stageName: string;
    count: number;
    value: number;
    probability: number;
  }>;
  conversionRate: number;
  avgDealSize: number;
  avgDaysToClose: number;
}

export interface RevenueAnalytics {
  totalRevenue: number;
  periodRevenue: number;
  forecastedRevenue: number;
  byMonth: Array<{
    month: string;
    revenue: number;
    deals: number;
  }>;
  bySource: Array<{
    source: string;
    revenue: number;
    count: number;
  }>;
}

export interface LeadAnalytics {
  totalLeads: number;
  newLeads: number;
  convertedLeads: number;
  conversionRate: number;
  byStatus: Record<string, number>;
  bySource: Array<{
    source: string;
    count: number;
    converted: number;
    conversionRate: number;
  }>;
  avgTimeToConvert: number;
}

export interface ActivityAnalytics {
  totalActivities: number;
  completedActivities: number;
  completionRate: number;
  byType: Record<string, number>;
  byStatus: Record<string, number>;
  overdueTasks: number;
  avgCompletionTime: number;
}

export interface TeamPerformance {
  users: Array<{
    userId: string;
    userName: string;
    leadsCreated: number;
    leadsConverted: number;
    opportunitiesCreated: number;
    opportunitiesWon: number;
    revenueClosed: number;
    activitiesCompleted: number;
    conversionRate: number;
    winRate: number;
  }>;
  topPerformer: {
    userId: string;
    userName: string;
    metric: string;
    value: number;
  } | null;
}

export interface DashboardStats {
  leads: {
    total: number;
    new: number;
    qualified: number;
    converted: number;
  };
  opportunities: {
    total: number;
    open: number;
    won: number;
    lost: number;
    pipelineValue: number;
  };
  activities: {
    total: number;
    pending: number;
    completed: number;
    overdue: number;
  };
  revenue: {
    totalWon: number;
    thisMonth: number;
    forecasted: number;
  };
}

// Cache TTL in seconds
const CACHE_TTL = 300; // 5 minutes

// =============================================================================
// Reporting Service
// =============================================================================

export class ReportingService {
  /**
   * Get pipeline analytics
   */
  async getPipelineAnalytics(tenantId: string, dateRange?: DateRange): Promise<PipelineAnalytics> {
    const cacheKey = `analytics:pipeline:${tenantId}:${dateRange?.startDate?.getTime() || 'all'}`;

    // Check cache
    const cached = await cacheGet<PipelineAnalytics>(cacheKey);
    if (cached) return cached;

    const db = getDb();

    // Match stage
    const matchStage: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
    };

    if (dateRange) {
      matchStage.createdAt = {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate,
      };
    }

    // Get opportunities grouped by stage
    const [byStage, totals, wonStats] = await Promise.all([
      // By stage
      db.collection('opportunities')
        .aggregate<{
          stageId: string;
          count: number;
          value: number;
          probability: number;
        }>([
          { $match: { ...matchStage, status: OpportunityStatus.OPEN } },
          {
            $lookup: {
              from: 'stages',
              localField: 'stageId',
              foreignField: '_id',
              as: 'stage',
            },
          },
          { $unwind: '$stage' },
          {
            $group: {
              _id: '$stageId',
              count: { $sum: 1 },
              value: { $sum: '$amount' },
              probability: { $first: '$stage.probability' },
              stageName: { $first: '$stage.name' },
            },
          },
          { $sort: { probability: 1 } },
        ])
        .toArray(),

      // Totals
      db.collection('opportunities')
        .aggregate<{
          totalOpen: number;
          totalValue: number;
          weightedValue: number;
        }>([
          { $match: { ...matchStage, status: OpportunityStatus.OPEN } },
          {
            $group: {
              _id: null,
              totalOpen: { $sum: 1 },
              totalValue: { $sum: '$amount' },
              weightedValue: { $sum: { $multiply: ['$amount', { $divide: ['$probability', 100] }] } },
            },
          },
        ])
        .toArray(),

      // Won stats for conversion rate
      db.collection('opportunities')
        .aggregate<{
          won: number;
          lost: number;
          avgDays: number;
        }>([
          {
            $match: {
              tenantId,
              deletedAt: null,
              status: { $in: [OpportunityStatus.WON, OpportunityStatus.LOST] },
            },
          },
          {
            $group: {
              _id: null,
              won: { $sum: { $cond: [{ $eq: ['$status', OpportunityStatus.WON] }, 1, 0] } },
              lost: { $sum: { $cond: [{ $eq: ['$status', OpportunityStatus.LOST] }, 1, 0] } },
              avgDays: {
                $avg: {
                  $divide: [
                    { $subtract: ['$actualCloseDate', '$createdAt'] },
                    1000 * 60 * 60 * 24,
                  ],
                },
              },
            },
          },
        ])
        .toArray(),
    ]);

    const totalData = totals[0] || { totalOpen: 0, totalValue: 0, weightedValue: 0 };
    const wonData = wonStats[0] || { won: 0, lost: 0, avgDays: 0 };
    const totalClosed = wonData.won + wonData.lost;

    const result: PipelineAnalytics = {
      totalOpen: totalData.totalOpen,
      totalValue: totalData.totalValue,
      weightedValue: totalData.weightedValue,
      byStage: byStage.map((s) => ({
        stageId: s._id,
        stageName: s.stageName || 'Unknown',
        count: s.count,
        value: s.value,
        probability: s.probability,
      })),
      conversionRate: totalClosed > 0 ? (wonData.won / totalClosed) * 100 : 0,
      avgDealSize: totalData.totalOpen > 0 ? totalData.totalValue / totalData.totalOpen : 0,
      avgDaysToClose: wonData.avgDays || 0,
    };

    // Cache result
    await cacheSet(cacheKey, result, CACHE_TTL);

    return result;
  }

  /**
   * Get revenue analytics
   */
  async getRevenueAnalytics(tenantId: string, dateRange?: DateRange): Promise<RevenueAnalytics> {
    const cacheKey = `analytics:revenue:${tenantId}:${dateRange?.startDate?.getTime() || 'all'}`;

    const cached = await cacheGet<RevenueAnalytics>(cacheKey);
    if (cached) return cached;

    const db = getDb();

    const matchStage: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
      status: OpportunityStatus.WON,
    };

    if (dateRange) {
      matchStage.actualCloseDate = {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate,
      };
    }

    const [byMonth, bySource, totals, forecast] = await Promise.all([
      // By month
      db.collection('opportunities')
        .aggregate<{ month: string; revenue: number; deals: number }>([
          { $match: { ...matchStage, actualCloseDate: { $ne: null } } },
          {
            $group: {
              _id: {
                $dateToString: { format: '%Y-%m', date: '$actualCloseDate' },
              },
              revenue: { $sum: '$amount' },
              deals: { $sum: 1 },
            },
          },
          { $sort: { _id: 1 } },
          { $project: { month: '$_id', revenue: 1, deals: 1, _id: 0 } },
        ])
        .toArray(),

      // By source
      db.collection('opportunities')
        .aggregate<{ source: string; revenue: number; count: number }>([
          { $match: matchStage },
          {
            $group: {
              _id: '$leadSource',
              revenue: { $sum: '$amount' },
              count: { $sum: 1 },
            },
          },
          { $project: { source: { $ifNull: ['$_id', 'Unknown'] }, revenue: 1, count: 1, _id: 0 } },
          { $sort: { revenue: -1 } },
        ])
        .toArray(),

      // Total revenue
      db.collection('opportunities')
        .aggregate<{ total: number }>([
          { $match: { tenantId, deletedAt: null, status: OpportunityStatus.WON } },
          { $group: { _id: null, total: { $sum: '$amount' } } },
        ])
        .toArray(),

      // Forecast (open opportunities weighted)
      db.collection('opportunities')
        .aggregate<{ forecast: number }>([
          { $match: { tenantId, deletedAt: null, status: OpportunityStatus.OPEN } },
          {
            $group: {
              _id: null,
              forecast: { $sum: { $multiply: ['$amount', { $divide: ['$probability', 100] }] } },
            },
          },
        ])
        .toArray(),
    ]);

    const result: RevenueAnalytics = {
      totalRevenue: totals[0]?.total || 0,
      periodRevenue: byMonth.reduce((sum, m) => sum + m.revenue, 0),
      forecastedRevenue: forecast[0]?.forecast || 0,
      byMonth,
      bySource,
    };

    await cacheSet(cacheKey, result, CACHE_TTL);

    return result;
  }

  /**
   * Get lead analytics
   */
  async getLeadAnalytics(tenantId: string, dateRange?: DateRange): Promise<LeadAnalytics> {
    const cacheKey = `analytics:leads:${tenantId}:${dateRange?.startDate?.getTime() || 'all'}`;

    const cached = await cacheGet<LeadAnalytics>(cacheKey);
    if (cached) return cached;

    const db = getDb();

    const matchStage: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
    };

    if (dateRange) {
      matchStage.createdAt = {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate,
      };
    }

    const [byStatus, bySource, conversionStats] = await Promise.all([
      // By status
      db.collection('leads')
        .aggregate<{ status: string; count: number }>([
          { $match: matchStage },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        .toArray(),

      // By source
      db.collection('leads')
        .aggregate<{
          source: string;
          count: number;
          converted: number;
        }>([
          { $match: matchStage },
          {
            $group: {
              _id: '$source',
              count: { $sum: 1 },
              converted: {
                $sum: { $cond: [{ $eq: ['$status', LeadStatus.CONVERTED] }, 1, 0] },
              },
            },
          },
        ])
        .toArray(),

      // Conversion timing
      db.collection('leads')
        .aggregate<{ avgDays: number }>([
          {
            $match: {
              tenantId,
              deletedAt: null,
              status: LeadStatus.CONVERTED,
              convertedAt: { $ne: null },
            },
          },
          {
            $group: {
              _id: null,
              avgDays: {
                $avg: {
                  $divide: [
                    { $subtract: ['$convertedAt', '$createdAt'] },
                    1000 * 60 * 60 * 24,
                  ],
                },
              },
            },
          },
        ])
        .toArray(),
    ]);

    const statusMap: Record<string, number> = {};
    for (const s of byStatus) {
      statusMap[s._id || 'UNKNOWN'] = s.count;
    }

    const total = byStatus.reduce((sum, s) => sum + s.count, 0);
    const converted = statusMap[LeadStatus.CONVERTED] || 0;

    const result: LeadAnalytics = {
      totalLeads: total,
      newLeads: statusMap[LeadStatus.NEW] || 0,
      convertedLeads: converted,
      conversionRate: total > 0 ? (converted / total) * 100 : 0,
      byStatus: statusMap,
      bySource: bySource.map((s) => ({
        source: s._id || 'Unknown',
        count: s.count,
        converted: s.converted,
        conversionRate: s.count > 0 ? (s.converted / s.count) * 100 : 0,
      })),
      avgTimeToConvert: conversionStats[0]?.avgDays || 0,
    };

    await cacheSet(cacheKey, result, CACHE_TTL);

    return result;
  }

  /**
   * Get activity analytics
   */
  async getActivityAnalytics(tenantId: string, dateRange?: DateRange): Promise<ActivityAnalytics> {
    const cacheKey = `analytics:activities:${tenantId}:${dateRange?.startDate?.getTime() || 'all'}`;

    const cached = await cacheGet<ActivityAnalytics>(cacheKey);
    if (cached) return cached;

    const db = getDb();

    const matchStage: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
    };

    if (dateRange) {
      matchStage.createdAt = {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate,
      };
    }

    const [byType, byStatus, overdue, completionStats] = await Promise.all([
      // By type
      db.collection('activities')
        .aggregate<{ type: string; count: number }>([
          { $match: matchStage },
          { $group: { _id: '$type', count: { $sum: 1 } } },
        ])
        .toArray(),

      // By status
      db.collection('activities')
        .aggregate<{ status: string; count: number }>([
          { $match: matchStage },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        .toArray(),

      // Overdue
      db.collection('activities').countDocuments({
        ...matchStage,
        status: { $ne: ActivityStatus.COMPLETED },
        dueDate: { $lt: new Date() },
      }),

      // Completion time
      db.collection('activities')
        .aggregate<{ avgTime: number }>([
          {
            $match: {
              ...matchStage,
              status: ActivityStatus.COMPLETED,
              completedAt: { $ne: null },
            },
          },
          {
            $group: {
              _id: null,
              avgTime: {
                $avg: {
                  $divide: [
                    { $subtract: ['$completedAt', '$createdAt'] },
                    1000 * 60 * 60, // hours
                  ],
                },
              },
            },
          },
        ])
        .toArray(),
    ]);

    const typeMap: Record<string, number> = {};
    for (const t of byType) {
      typeMap[t._id || 'UNKNOWN'] = t.count;
    }

    const statusMap: Record<string, number> = {};
    for (const s of byStatus) {
      statusMap[s._id || 'UNKNOWN'] = s.count;
    }

    const total = byStatus.reduce((sum, s) => sum + s.count, 0);
    const completed = statusMap[ActivityStatus.COMPLETED] || 0;

    const result: ActivityAnalytics = {
      totalActivities: total,
      completedActivities: completed,
      completionRate: total > 0 ? (completed / total) * 100 : 0,
      byType: typeMap,
      byStatus: statusMap,
      overdueTasks: overdue,
      avgCompletionTime: completionStats[0]?.avgTime || 0,
    };

    await cacheSet(cacheKey, result, CACHE_TTL);

    return result;
  }

  /**
   * Get team performance
   */
  async getTeamPerformance(tenantId: string, dateRange?: DateRange): Promise<TeamPerformance> {
    const cacheKey = `analytics:team:${tenantId}:${dateRange?.startDate?.getTime() || 'all'}`;

    const cached = await cacheGet<TeamPerformance>(cacheKey);
    if (cached) return cached;

    const db = getDb();

    const matchStage: Record<string, unknown> = {
      tenantId,
      deletedAt: null,
    };

    if (dateRange) {
      matchStage.createdAt = {
        $gte: dateRange.startDate,
        $lte: dateRange.endDate,
      };
    }

    // Get users with their stats
    const userStats = await db
      .collection('users')
      .aggregate<{
        userId: string;
        userName: string;
        leadsCreated: number;
        leadsConverted: number;
        opportunitiesCreated: number;
        opportunitiesWon: number;
        revenueClosed: number;
        activitiesCompleted: number;
      }>([
        { $match: { tenantId, deletedAt: null } },
        {
          $lookup: {
            from: 'leads',
            let: { ownerId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$ownerId', '$$ownerId'] },
                  ...matchStage,
                },
              },
              {
                $group: {
                  _id: null,
                  created: { $sum: 1 },
                  converted: {
                    $sum: { $cond: [{ $eq: ['$status', LeadStatus.CONVERTED] }, 1, 0] },
                  },
                },
              },
            ],
            as: 'leadStats',
          },
        },
        {
          $lookup: {
            from: 'opportunities',
            let: { ownerId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$ownerId', '$$ownerId'] },
                  ...matchStage,
                },
              },
              {
                $group: {
                  _id: null,
                  created: { $sum: 1 },
                  won: {
                    $sum: { $cond: [{ $eq: ['$status', OpportunityStatus.WON] }, 1, 0] },
                  },
                  revenue: {
                    $sum: {
                      $cond: [
                        { $eq: ['$status', OpportunityStatus.WON] },
                        '$amount',
                        0,
                      ],
                    },
                  },
                },
              },
            ],
            as: 'oppStats',
          },
        },
        {
          $lookup: {
            from: 'activities',
            let: { ownerId: '$_id' },
            pipeline: [
              {
                $match: {
                  $expr: { $eq: ['$ownerId', '$$ownerId'] },
                  status: ActivityStatus.COMPLETED,
                },
              },
              { $count: 'count' },
            ],
            as: 'activityStats',
          },
        },
        {
          $project: {
            userId: { $toString: '$_id' },
            userName: { $concat: ['$firstName', ' ', '$lastName'] },
            leadsCreated: { $ifNull: [{ $arrayElemAt: ['$leadStats.created', 0] }, 0] },
            leadsConverted: { $ifNull: [{ $arrayElemAt: ['$leadStats.converted', 0] }, 0] },
            opportunitiesCreated: { $ifNull: [{ $arrayElemAt: ['$oppStats.created', 0] }, 0] },
            opportunitiesWon: { $ifNull: [{ $arrayElemAt: ['$oppStats.won', 0] }, 0] },
            revenueClosed: { $ifNull: [{ $arrayElemAt: ['$oppStats.revenue', 0] }, 0] },
            activitiesCompleted: { $ifNull: [{ $arrayElemAt: ['$activityStats.count', 0] }, 0] },
          },
        },
      ])
      .toArray();

    // Calculate rates and find top performer
    const users = userStats.map((u) => ({
      ...u,
      conversionRate: u.leadsCreated > 0 ? (u.leadsConverted / u.leadsCreated) * 100 : 0,
      winRate: u.opportunitiesCreated > 0 ? (u.opportunitiesWon / u.opportunitiesCreated) * 100 : 0,
    }));

    // Find top performer by revenue
    const topPerformer = users.reduce<{
      userId: string;
      userName: string;
      metric: string;
      value: number;
    } | null>(
      (top, u) =>
        u.revenueClosed > (top?.value || 0)
          ? {
              userId: u.userId,
              userName: u.userName,
              metric: 'revenueClosed',
              value: u.revenueClosed,
            }
          : top,
      null
    );

    const result: TeamPerformance = {
      users,
      topPerformer,
    };

    await cacheSet(cacheKey, result, CACHE_TTL);

    return result;
  }

  /**
   * Get dashboard stats (quick overview)
   */
  async getDashboardStats(tenantId: string): Promise<DashboardStats> {
    const cacheKey = `analytics:dashboard:${tenantId}`;

    const cached = await cacheGet<DashboardStats>(cacheKey);
    if (cached) return cached;

    const db = getDb();

    const now = new Date();
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1);

    const [
      leadStats,
      opportunityStats,
      activityStats,
      revenueStats,
    ] = await Promise.all([
      // Lead stats
      db.collection('leads')
        .aggregate<{
          total: number;
          new: number;
          qualified: number;
          converted: number;
        }>([
          { $match: { tenantId, deletedAt: null } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              new: { $sum: { $cond: [{ $eq: ['$status', LeadStatus.NEW] }, 1, 0] } },
              qualified: { $sum: { $cond: [{ $eq: ['$status', LeadStatus.QUALIFIED] }, 1, 0] } },
              converted: { $sum: { $cond: [{ $eq: ['$status', LeadStatus.CONVERTED] }, 1, 0] } },
            },
          },
        ])
        .toArray(),

      // Opportunity stats
      db.collection('opportunities')
        .aggregate<{
          total: number;
          open: number;
          won: number;
          lost: number;
          pipelineValue: number;
        }>([
          { $match: { tenantId, deletedAt: null } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              open: { $sum: { $cond: [{ $eq: ['$status', OpportunityStatus.OPEN] }, 1, 0] } },
              won: { $sum: { $cond: [{ $eq: ['$status', OpportunityStatus.WON] }, 1, 0] } },
              lost: { $sum: { $cond: [{ $eq: ['$status', OpportunityStatus.LOST] }, 1, 0] } },
              pipelineValue: {
                $sum: { $cond: [{ $eq: ['$status', OpportunityStatus.OPEN] }, '$amount', 0] },
              },
            },
          },
        ])
        .toArray(),

      // Activity stats
      db.collection('activities')
        .aggregate<{
          total: number;
          pending: number;
          completed: number;
          overdue: number;
        }>([
          { $match: { tenantId, deletedAt: null } },
          {
            $group: {
              _id: null,
              total: { $sum: 1 },
              pending: { $sum: { $cond: [{ $eq: ['$status', ActivityStatus.PENDING] }, 1, 0] } },
              completed: {
                $sum: { $cond: [{ $eq: ['$status', ActivityStatus.COMPLETED] }, 1, 0] },
              },
              overdue: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $ne: ['$status', ActivityStatus.COMPLETED] },
                        { $lt: ['$dueDate', now] },
                      ],
                    },
                    1,
                    0,
                  ],
                },
              },
            },
          },
        ])
        .toArray(),

      // Revenue stats
      db.collection('opportunities')
        .aggregate<{
          totalWon: number;
          thisMonth: number;
          forecasted: number;
        }>([
          { $match: { tenantId, deletedAt: null } },
          {
            $group: {
              _id: null,
              totalWon: {
                $sum: { $cond: [{ $eq: ['$status', OpportunityStatus.WON] }, '$amount', 0] },
              },
              thisMonth: {
                $sum: {
                  $cond: [
                    {
                      $and: [
                        { $eq: ['$status', OpportunityStatus.WON] },
                        { $gte: ['$actualCloseDate', startOfMonth] },
                      ],
                    },
                    '$amount',
                    0,
                  ],
                },
              },
              forecasted: {
                $sum: {
                  $cond: [
                    { $eq: ['$status', OpportunityStatus.OPEN] },
                    { $multiply: ['$amount', { $divide: ['$probability', 100] }] },
                    0,
                  ],
                },
              },
            },
          },
        ])
        .toArray(),
    ]);

    const result: DashboardStats = {
      leads: leadStats[0] || { total: 0, new: 0, qualified: 0, converted: 0 },
      opportunities: opportunityStats[0] || { total: 0, open: 0, won: 0, lost: 0, pipelineValue: 0 },
      activities: activityStats[0] || { total: 0, pending: 0, completed: 0, overdue: 0 },
      revenue: revenueStats[0] || { totalWon: 0, thisMonth: 0, forecasted: 0 },
    };

    // Shorter cache for dashboard (1 minute)
    await cacheSet(cacheKey, result, 60);

    return result;
  }

  /**
   * Invalidate analytics cache for tenant
   */
  async invalidateCache(tenantId: string): Promise<void> {
    const redis = getRedis();
    const pattern = `crm:${tenantId}:analytics:*`;

    let cursor = '0';
    do {
      const result = await redis.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
      cursor = result[0];
      const keys = result[1];

      if (keys.length > 0) {
        await redis.del(...keys);
      }
    } while (cursor !== '0');

    logger.debug('Analytics cache invalidated', { tenantId });
  }
}

// Singleton export
export const reportingService = new ReportingService();
