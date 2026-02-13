// =============================================================================
// Reporting Service
// =============================================================================

import { leadRepository } from '@/repositories/lead.repository.js';
import { opportunityRepository } from '@/repositories/opportunity.repository.js';
import { activityRepository } from '@/repositories/activity.repository.js';
import { stageRepository } from '@/repositories/stage.repository.js';
import { traceServiceOperation } from '@/infrastructure/otel/tracing.js';
import { ActivityStatus } from '@/types/entities.js';

interface DashboardStats {
  totalLeads: number;
  qualifiedLeads: number;
  convertedLeads: number;
  totalOpportunities: number;
  openOpportunities: number;
  totalPipelineValue: number;
  wonValue: number;
  lostValue: number;
  pipelineByStage: Array<{
    stageId: string;
    stageName: string;
    count: number;
    value: number;
    probability: number;
  }>;
}

interface LeadConversionStats {
  bySource: Array<{
    source: string;
    total: number;
    converted: number;
    conversionRate: number;
  }>;
  averageTimeToConvert: number;
}

interface ActivityStats {
  byType: Array<{
    type: string;
    count: number;
    completed: number;
  }>;
  byStatus: Array<{
    status: string;
    count: number;
  }>;
  overdue: number;
}

export class ReportingService {
  async getDashboardStats(tenantId: string): Promise<DashboardStats> {
    return traceServiceOperation('ReportingService', 'getDashboardStats', async () => {
      const [leadStats, pipelineStats, stages] = await Promise.all([
        leadRepository.getCountsByStatus(tenantId),
        opportunityRepository.getPipelineStats(tenantId),
        stageRepository.findActiveStages(tenantId),
      ]);

      // Build stage lookup
      const stageMap = new Map(stages.map(s => [s._id.toHexString(), s]));

      const pipelineByStage = pipelineStats.byStage.map(item => {
        const stage = stageMap.get(item.stageId);
        return {
          stageId: item.stageId,
          stageName: stage?.name || 'Unknown',
          count: item.count,
          value: item.totalAmount,
          probability: stage?.probability || 0,
        };
      });

      return {
        totalLeads: Object.values(leadStats).reduce((a, b) => a + b, 0),
        qualifiedLeads: leadStats.QUALIFIED || 0,
        convertedLeads: leadStats.CONVERTED || 0,
        totalOpportunities: pipelineStats.totalOpen + Math.floor(pipelineStats.wonValue / 1000),
        openOpportunities: pipelineStats.totalOpen,
        totalPipelineValue: pipelineStats.totalValue,
        wonValue: pipelineStats.wonValue,
        lostValue: pipelineStats.lostValue,
        pipelineByStage,
      };
    });
  }

  async getLeadConversionStats(tenantId: string): Promise<LeadConversionStats> {
    return traceServiceOperation('ReportingService', 'getLeadConversionStats', async () => {
      const bySourceStats = await leadRepository.getCountsBySource(tenantId);

      const bySource = Object.entries(bySourceStats).map(([source, total]) => ({
        source,
        total,
        converted: Math.floor(total * 0.3), // Placeholder
        conversionRate: 30, // Placeholder
      }));

      return {
        bySource,
        averageTimeToConvert: 14, // Placeholder in days
      };
    });
  }

  async getActivityStats(tenantId: string): Promise<ActivityStats> {
    return traceServiceOperation('ReportingService', 'getActivityStats', async () => {
      const stats = await activityRepository.getStats(tenantId);
      
      const overdue = await activityRepository.count({
        status: { $ne: ActivityStatus.COMPLETED },
        dueDate: { $lt: new Date() },
      }, tenantId);

      return {
        byType: Object.entries(stats.byType).map(([type, count]) => ({
          type,
          count,
          completed: Math.floor(count * 0.5), // Placeholder
        })),
        byStatus: Object.entries(stats.byStatus).map(([status, count]) => ({
          status,
          count,
        })),
        overdue,
      };
    });
  }
}

export const reportingService = new ReportingService();
