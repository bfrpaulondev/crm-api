// =============================================================================
// Bulk Operations Service
// =============================================================================

import { leadRepository } from '@/repositories/lead.repository.js';
import { opportunityRepository } from '@/repositories/opportunity.repository.js';
import { auditLogRepository } from '@/repositories/audit-log.repository.js';
import { logger } from '@/infrastructure/logging/index.js';
import { traceServiceOperation } from '@/infrastructure/otel/tracing.js';
import { LeadStatus } from '@/types/entities.js';

interface BulkUpdateItem {
  id: string;
  data: Record<string, unknown>;
}

interface BulkCreateLeadData {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  companyName?: string;
  title?: string;
  source?: string;
  tags?: string[];
}

interface BulkOpportunityUpdate {
  id: string;
  stageId?: string;
  amount?: number;
  probability?: number;
  expectedCloseDate?: Date;
}

interface ExportFilter {
  status?: string;
  source?: string;
  ownerId?: string;
  createdAfter?: Date;
  createdBefore?: Date;
}

interface BulkResult {
  success: boolean;
  processedCount: number;
  successCount: number;
  failedCount: number;
  errors: Array<{ index: number; error: string }>;
}

interface ExportResult {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  title: string | null;
  status: string;
  source: string | null;
  score: number;
  tags: string[];
  createdAt: Date;
}

export class BulkOperationsService {
  // ===========================================================================
  // Lead Bulk Operations
  // ===========================================================================

  async bulkCreateLeads(
    tenantId: string,
    userId: string,
    leads: BulkCreateLeadData[],
    _requestId: string
  ): Promise<BulkResult> {
    return traceServiceOperation('BulkOperationsService', 'bulkCreateLeads', async () => {
      const result: BulkResult = {
        success: true,
        processedCount: leads.length,
        successCount: 0,
        failedCount: 0,
        errors: [],
      };

      for (let i = 0; i < leads.length; i++) {
        try {
          const leadData = leads[i];
          await leadRepository.create({
            tenantId,
            ownerId: userId,
            firstName: leadData.firstName,
            lastName: leadData.lastName,
            email: leadData.email,
            phone: leadData.phone ?? null,
            companyName: leadData.companyName ?? null,
            title: leadData.title ?? null,
            website: null,
            industry: null,
            source: (leadData.source as never) ?? null,
            status: LeadStatus.NEW,
            tags: leadData.tags ?? [],
            score: 0,
            notes: null,
            createdBy: userId,
          });
          result.successCount++;
        } catch (error) {
          result.failedCount++;
          result.errors.push({
            index: i,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      result.success = result.failedCount === 0;

      logger.info('Bulk create leads completed', {
        tenantId,
        userId,
        successCount: result.successCount,
        failedCount: result.failedCount,
      });

      return result;
    });
  }

  async bulkUpdateLeads(
    tenantId: string,
    userId: string,
    updates: BulkUpdateItem[],
    _requestId: string
  ): Promise<BulkResult> {
    return traceServiceOperation('BulkOperationsService', 'bulkUpdateLeads', async () => {
      const result: BulkResult = {
        success: true,
        processedCount: updates.length,
        successCount: 0,
        failedCount: 0,
        errors: [],
      };

      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        try {
          const lead = await leadRepository.findById(update.id, tenantId);
          if (!lead) {
            result.failedCount++;
            result.errors.push({ index: i, error: 'Lead not found' });
            continue;
          }

          const updatedLead = await leadRepository.updateById(
            update.id,
            tenantId,
            update.data,
            userId
          );

          if (updatedLead) {
            result.successCount++;
            await auditLogRepository.log({
              tenantId,
              entityType: 'Lead',
              entityId: update.id,
              action: 'UPDATE',
              actorId: userId,
              actorEmail: '',
              changes: { previous: lead, current: updatedLead },
              metadata: { bulk: true },
              requestId: '',
            });
          }
        } catch (error) {
          result.failedCount++;
          result.errors.push({
            index: i,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      result.success = result.failedCount === 0;

      logger.info('Bulk update leads completed', {
        tenantId,
        userId,
        successCount: result.successCount,
        failedCount: result.failedCount,
      });

      return result;
    });
  }

  async bulkDeleteLeads(
    tenantId: string,
    userId: string,
    ids: string[],
    _requestId: string
  ): Promise<BulkResult> {
    return traceServiceOperation('BulkOperationsService', 'bulkDeleteLeads', async () => {
      const result: BulkResult = {
        success: true,
        processedCount: ids.length,
        successCount: 0,
        failedCount: 0,
        errors: [],
      };

      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        try {
          const lead = await leadRepository.findById(id, tenantId);
          if (!lead) {
            result.failedCount++;
            result.errors.push({ index: i, error: 'Lead not found' });
            continue;
          }

          const deleted = await leadRepository.deleteById(id, tenantId, userId);

          if (deleted) {
            result.successCount++;
            await auditLogRepository.log({
              tenantId,
              entityType: 'Lead',
              entityId: id,
              action: 'DELETE',
              actorId: userId,
              actorEmail: '',
              changes: { deleted: lead },
              metadata: { bulk: true },
              requestId: '',
            });
          }
        } catch (error) {
          result.failedCount++;
          result.errors.push({
            index: i,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      result.success = result.failedCount === 0;

      logger.info('Bulk delete leads completed', {
        tenantId,
        userId,
        successCount: result.successCount,
        failedCount: result.failedCount,
      });

      return result;
    });
  }

  async bulkAssignLeads(
    tenantId: string,
    userId: string,
    leadIds: string[],
    newOwnerId: string,
    _requestId: string
  ): Promise<BulkResult> {
    return traceServiceOperation('BulkOperationsService', 'bulkAssignLeads', async () => {
      const result: BulkResult = {
        success: true,
        processedCount: leadIds.length,
        successCount: 0,
        failedCount: 0,
        errors: [],
      };

      for (let i = 0; i < leadIds.length; i++) {
        const leadId = leadIds[i];
        try {
          const lead = await leadRepository.findById(leadId, tenantId);
          if (!lead) {
            result.failedCount++;
            result.errors.push({ index: i, error: 'Lead not found' });
            continue;
          }

          const updatedLead = await leadRepository.updateById(
            leadId,
            tenantId,
            { ownerId: newOwnerId },
            userId
          );

          if (updatedLead) {
            result.successCount++;
          }
        } catch (error) {
          result.failedCount++;
          result.errors.push({
            index: i,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      result.success = result.failedCount === 0;

      logger.info('Bulk assign leads completed', {
        tenantId,
        userId,
        newOwnerId,
        successCount: result.successCount,
        failedCount: result.failedCount,
      });

      return result;
    });
  }

  async bulkAddTags(
    tenantId: string,
    userId: string,
    leadIds: string[],
    tags: string[],
    _requestId: string
  ): Promise<BulkResult> {
    return traceServiceOperation('BulkOperationsService', 'bulkAddTags', async () => {
      const result: BulkResult = {
        success: true,
        processedCount: leadIds.length,
        successCount: 0,
        failedCount: 0,
        errors: [],
      };

      for (let i = 0; i < leadIds.length; i++) {
        const leadId = leadIds[i];
        try {
          const lead = await leadRepository.findById(leadId, tenantId);
          if (!lead) {
            result.failedCount++;
            result.errors.push({ index: i, error: 'Lead not found' });
            continue;
          }

          const existingTags = lead.tags || [];
          const newTags = [...new Set([...existingTags, ...tags])];

          const updatedLead = await leadRepository.updateById(
            leadId,
            tenantId,
            { tags: newTags },
            userId
          );

          if (updatedLead) {
            result.successCount++;
          }
        } catch (error) {
          result.failedCount++;
          result.errors.push({
            index: i,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      result.success = result.failedCount === 0;

      logger.info('Bulk add tags completed', {
        tenantId,
        userId,
        tags,
        successCount: result.successCount,
        failedCount: result.failedCount,
      });

      return result;
    });
  }

  async bulkUpdateOpportunityStages(
    tenantId: string,
    userId: string,
    updates: BulkOpportunityUpdate[],
    _requestId: string
  ): Promise<BulkResult> {
    return traceServiceOperation('BulkOperationsService', 'bulkUpdateOpportunityStages', async () => {
      const result: BulkResult = {
        success: true,
        processedCount: updates.length,
        successCount: 0,
        failedCount: 0,
        errors: [],
      };

      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        try {
          const opportunity = await opportunityRepository.findById(update.id, tenantId);
          if (!opportunity) {
            result.failedCount++;
            result.errors.push({ index: i, error: 'Opportunity not found' });
            continue;
          }

          const updateData: Record<string, unknown> = {};
          if (update.stageId) updateData.stageId = update.stageId;
          if (update.amount !== undefined) updateData.amount = update.amount;
          if (update.probability !== undefined) updateData.probability = update.probability;
          if (update.expectedCloseDate) updateData.expectedCloseDate = update.expectedCloseDate;

          const updatedOpp = await opportunityRepository.updateById(
            update.id,
            tenantId,
            updateData,
            userId
          );

          if (updatedOpp) {
            result.successCount++;
          }
        } catch (error) {
          result.failedCount++;
          result.errors.push({
            index: i,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      result.success = result.failedCount === 0;

      logger.info('Bulk update opportunity stages completed', {
        tenantId,
        userId,
        successCount: result.successCount,
        failedCount: result.failedCount,
      });

      return result;
    });
  }

  async importLeads(
    tenantId: string,
    userId: string,
    data: Record<string, unknown>[],
    requestId: string
  ): Promise<BulkResult> {
    return traceServiceOperation('BulkOperationsService', 'importLeads', async () => {
      const leads: BulkCreateLeadData[] = data.map(item => ({
        firstName: String(item.firstName || ''),
        lastName: String(item.lastName || ''),
        email: String(item.email || ''),
        phone: item.phone ? String(item.phone) : undefined,
        companyName: item.companyName ? String(item.companyName) : undefined,
        title: item.title ? String(item.title) : undefined,
        source: item.source ? String(item.source) : undefined,
        tags: Array.isArray(item.tags) ? item.tags as string[] : undefined,
      }));

      return this.bulkCreateLeads(tenantId, userId, leads, requestId);
    });
  }

  async exportLeads(
    tenantId: string,
    filter?: ExportFilter
  ): Promise<ExportResult[]> {
    return traceServiceOperation('BulkOperationsService', 'exportLeads', async () => {
      const query: Record<string, unknown> = { tenantId };

      if (filter?.status) query.status = filter.status;
      if (filter?.source) query.source = filter.source;
      if (filter?.ownerId) query.ownerId = filter.ownerId;
      if (filter?.createdAfter || filter?.createdBefore) {
        query.createdAt = {};
        if (filter.createdAfter) (query.createdAt as Record<string, Date>).$gte = filter.createdAfter;
        if (filter.createdBefore) (query.createdAt as Record<string, Date>).$lte = filter.createdBefore;
      }

      const leads = await leadRepository.findAll(tenantId, query as any);

      return leads.map(lead => ({
        id: lead._id.toHexString(),
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        companyName: lead.companyName,
        title: lead.title,
        status: lead.status,
        source: lead.source,
        score: lead.score,
        tags: lead.tags,
        createdAt: lead.createdAt,
      }));
    });
  }

  // ===========================================================================
  // Opportunity Bulk Operations
  // ===========================================================================

  async bulkUpdateOpportunities(
    tenantId: string,
    userId: string,
    updates: BulkUpdateItem[],
    _requestId: string
  ): Promise<BulkResult> {
    return traceServiceOperation('BulkOperationsService', 'bulkUpdateOpportunities', async () => {
      const result: BulkResult = {
        success: true,
        processedCount: updates.length,
        successCount: 0,
        failedCount: 0,
        errors: [],
      };

      for (let i = 0; i < updates.length; i++) {
        const update = updates[i];
        try {
          const opportunity = await opportunityRepository.findById(update.id, tenantId);
          if (!opportunity) {
            result.failedCount++;
            result.errors.push({ index: i, error: 'Opportunity not found' });
            continue;
          }

          const updatedOpp = await opportunityRepository.updateById(
            update.id,
            tenantId,
            update.data,
            userId
          );

          if (updatedOpp) {
            result.successCount++;
            await auditLogRepository.log({
              tenantId,
              entityType: 'Opportunity',
              entityId: update.id,
              action: 'UPDATE',
              actorId: userId,
              actorEmail: '',
              changes: { previous: opportunity, current: updatedOpp },
              metadata: { bulk: true },
              requestId: '',
            });
          }
        } catch (error) {
          result.failedCount++;
          result.errors.push({
            index: i,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      result.success = result.failedCount === 0;

      logger.info('Bulk update opportunities completed', {
        tenantId,
        userId,
        successCount: result.successCount,
        failedCount: result.failedCount,
      });

      return result;
    });
  }

  async bulkDeleteOpportunities(
    tenantId: string,
    userId: string,
    ids: string[],
    _requestId: string
  ): Promise<BulkResult> {
    return traceServiceOperation('BulkOperationsService', 'bulkDeleteOpportunities', async () => {
      const result: BulkResult = {
        success: true,
        processedCount: ids.length,
        successCount: 0,
        failedCount: 0,
        errors: [],
      };

      for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        try {
          const opportunity = await opportunityRepository.findById(id, tenantId);
          if (!opportunity) {
            result.failedCount++;
            result.errors.push({ index: i, error: 'Opportunity not found' });
            continue;
          }

          const deleted = await opportunityRepository.deleteById(id, tenantId, userId);

          if (deleted) {
            result.successCount++;
            await auditLogRepository.log({
              tenantId,
              entityType: 'Opportunity',
              entityId: id,
              action: 'DELETE',
              actorId: userId,
              actorEmail: '',
              changes: { deleted: opportunity },
              metadata: { bulk: true },
              requestId: '',
            });
          }
        } catch (error) {
          result.failedCount++;
          result.errors.push({
            index: i,
            error: error instanceof Error ? error.message : 'Unknown error',
          });
        }
      }

      result.success = result.failedCount === 0;

      logger.info('Bulk delete opportunities completed', {
        tenantId,
        userId,
        successCount: result.successCount,
        failedCount: result.failedCount,
      });

      return result;
    });
  }
}

export const bulkOperationsService = new BulkOperationsService();
