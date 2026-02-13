// =============================================================================
// Bulk Operations Service
// =============================================================================

import { getDb, getClient } from '@/infrastructure/mongo/connection.js';
import { logger } from '@/infrastructure/logging/index.js';
import { auditLogRepository } from '@/repositories/audit-log.repository.js';
import { ObjectId, Filter, UpdateFilter } from 'mongodb';
import { z } from 'zod';

// =============================================================================
// Types
// =============================================================================

export interface BulkOperationResult {
  success: boolean;
  processedCount: number;
  successCount: number;
  failedCount: number;
  errors: Array<{ index: number; error: string }>;
}

export interface BulkLeadCreate {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  companyName?: string;
  title?: string;
  source?: string;
  tags?: string[];
}

export interface BulkLeadUpdate {
  id: string;
  data: Record<string, unknown>;
}

export interface BulkOpportunityUpdate {
  id: string;
  stageId?: string;
  amount?: number;
  probability?: number;
  expectedCloseDate?: Date;
}

// =============================================================================
// Bulk Operations Service
// =============================================================================

export class BulkOperationsService {
  private readonly BATCH_SIZE = 100;

  /**
   * Bulk create leads
   */
  async bulkCreateLeads(
    tenantId: string,
    userId: string,
    leads: BulkLeadCreate[],
    requestId: string
  ): Promise<BulkOperationResult> {
    const db = getDb();
    const now = new Date();

    const errors: Array<{ index: number; error: string }> = [];
    const validLeads: Array<Record<string, unknown>> = [];
    const emailSet = new Set<string>();

    // Get existing emails for deduplication
    const emails = leads.map((l) => l.email.toLowerCase());
    const existingEmails = await db
      .collection('leads')
      .distinct('email', {
        tenantId,
        email: { $in: emails },
        deletedAt: null,
      });

    const existingSet = new Set(existingEmails.map((e: string) => e.toLowerCase()));

    // Validate each lead
    for (let i = 0; i < leads.length; i++) {
      const lead = leads[i];
      const email = lead.email.toLowerCase();

      // Check for duplicates in input
      if (emailSet.has(email)) {
        errors.push({ index: i, error: 'Duplicate email in input' });
        continue;
      }

      // Check for existing email
      if (existingSet.has(email)) {
        errors.push({ index: i, error: 'Lead with this email already exists' });
        continue;
      }

      // Validate required fields
      if (!lead.firstName || !lead.lastName || !lead.email) {
        errors.push({ index: i, error: 'Missing required fields' });
        continue;
      }

      emailSet.add(email);

      validLeads.push({
        _id: new ObjectId(),
        tenantId,
        ownerId: userId,
        status: 'NEW',
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: email,
        phone: lead.phone ?? null,
        companyName: lead.companyName ?? null,
        title: lead.title ?? null,
        source: lead.source ?? null,
        tags: lead.tags ?? [],
        score: 0,
        notes: null,
        createdAt: now,
        updatedAt: now,
        createdBy: userId,
      });
    }

    // Insert in batches
    let insertedCount = 0;
    for (let i = 0; i < validLeads.length; i += this.BATCH_SIZE) {
      const batch = validLeads.slice(i, i + this.BATCH_SIZE);
      try {
        await db.collection('leads').insertMany(batch);
        insertedCount += batch.length;
      } catch (error) {
        logger.error('Bulk insert batch failed', { error: String(error), batch: i });
      }
    }

    // Log audit
    await auditLogRepository.log({
      tenantId,
      entityType: 'Lead',
      entityId: 'bulk',
      action: 'CREATE',
      actorId: userId,
      actorEmail: '',
      changes: { count: insertedCount },
      metadata: { requestId, operation: 'bulk_create' },
      requestId,
    });

    logger.info('Bulk lead creation completed', {
      tenantId,
      userId,
      total: leads.length,
      created: insertedCount,
      failed: errors.length,
    });

    return {
      success: true,
      processedCount: leads.length,
      successCount: insertedCount,
      failedCount: errors.length,
      errors,
    };
  }

  /**
   * Bulk update leads
   */
  async bulkUpdateLeads(
    tenantId: string,
    userId: string,
    updates: BulkLeadUpdate[],
    requestId: string
  ): Promise<BulkOperationResult> {
    const db = getDb();
    const errors: Array<{ index: number; error: string }> = [];
    let successCount = 0;

    // Process in batches
    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];

      try {
        const _id = new ObjectId(update.id);

        // Remove immutable fields
        const updateData = { ...update.data };
        delete updateData._id;
        delete updateData.tenantId;
        delete updateData.createdAt;

        const result = await db.collection('leads').updateOne(
          { _id, tenantId, deletedAt: null } as Filter<Document>,
          {
            $set: {
              ...updateData,
              updatedAt: new Date(),
              updatedBy: userId,
            },
          } as UpdateFilter<Document>
        );

        if (result.modifiedCount > 0) {
          successCount++;
        } else {
          errors.push({ index: i, error: 'Lead not found or no changes made' });
        }
      } catch (error) {
        errors.push({ index: i, error: String(error) });
      }
    }

    // Log audit
    await auditLogRepository.log({
      tenantId,
      entityType: 'Lead',
      entityId: 'bulk',
      action: 'UPDATE',
      actorId: userId,
      actorEmail: '',
      changes: { count: successCount },
      metadata: { requestId, operation: 'bulk_update' },
      requestId,
    });

    return {
      success: true,
      processedCount: updates.length,
      successCount,
      failedCount: errors.length,
      errors,
    };
  }

  /**
   * Bulk delete leads (soft delete)
   */
  async bulkDeleteLeads(
    tenantId: string,
    userId: string,
    ids: string[],
    requestId: string
  ): Promise<BulkOperationResult> {
    const db = getDb();
    const objectIds = ids.map((id) => {
      try {
        return new ObjectId(id);
      } catch {
        return null;
      }
    }).filter(Boolean) as ObjectId[];

    const result = await db.collection('leads').updateMany(
      {
        _id: { $in: objectIds },
        tenantId,
        deletedAt: null,
      } as Filter<Document>,
      {
        $set: {
          deletedAt: new Date(),
          updatedAt: new Date(),
          updatedBy: userId,
        },
      }
    );

    // Log audit
    await auditLogRepository.log({
      tenantId,
      entityType: 'Lead',
      entityId: 'bulk',
      action: 'DELETE',
      actorId: userId,
      actorEmail: '',
      changes: { count: result.modifiedCount },
      metadata: { requestId, operation: 'bulk_delete', ids },
      requestId,
    });

    return {
      success: true,
      processedCount: ids.length,
      successCount: result.modifiedCount,
      failedCount: ids.length - result.modifiedCount,
      errors: [],
    };
  }

  /**
   * Bulk update opportunity stages
   */
  async bulkUpdateOpportunityStages(
    tenantId: string,
    userId: string,
    updates: BulkOpportunityUpdate[],
    requestId: string
  ): Promise<BulkOperationResult> {
    const db = getDb();
    const errors: Array<{ index: number; error: string }> = [];
    let successCount = 0;

    for (let i = 0; i < updates.length; i++) {
      const update = updates[i];

      try {
        const _id = new ObjectId(update.id);
        const updateData: Record<string, unknown> = {
          updatedAt: new Date(),
          updatedBy: userId,
        };

        if (update.stageId) updateData.stageId = update.stageId;
        if (update.amount !== undefined) updateData.amount = update.amount;
        if (update.probability !== undefined) updateData.probability = update.probability;
        if (update.expectedCloseDate) updateData.expectedCloseDate = update.expectedCloseDate;

        const result = await db.collection('opportunities').updateOne(
          { _id, tenantId, deletedAt: null } as Filter<Document>,
          { $set: updateData }
        );

        if (result.modifiedCount > 0) {
          successCount++;
        } else {
          errors.push({ index: i, error: 'Opportunity not found or no changes made' });
        }
      } catch (error) {
        errors.push({ index: i, error: String(error) });
      }
    }

    // Log audit
    await auditLogRepository.log({
      tenantId,
      entityType: 'Opportunity',
      entityId: 'bulk',
      action: 'UPDATE',
      actorId: userId,
      actorEmail: '',
      changes: { count: successCount },
      metadata: { requestId, operation: 'bulk_stage_update' },
      requestId,
    });

    return {
      success: true,
      processedCount: updates.length,
      successCount,
      failedCount: errors.length,
      errors,
    };
  }

  /**
   * Bulk assign leads to owner
   */
  async bulkAssignLeads(
    tenantId: string,
    userId: string,
    leadIds: string[],
    newOwnerId: string,
    requestId: string
  ): Promise<BulkOperationResult> {
    const db = getDb();
    const objectIds = leadIds.map((id) => {
      try {
        return new ObjectId(id);
      } catch {
        return null;
      }
    }).filter(Boolean) as ObjectId[];

    const result = await db.collection('leads').updateMany(
      {
        _id: { $in: objectIds },
        tenantId,
        deletedAt: null,
      } as Filter<Document>,
      {
        $set: {
          ownerId: newOwnerId,
          updatedAt: new Date(),
          updatedBy: userId,
        },
      }
    );

    // Log audit
    await auditLogRepository.log({
      tenantId,
      entityType: 'Lead',
      entityId: 'bulk',
      action: 'UPDATE',
      actorId: userId,
      actorEmail: '',
      changes: { count: result.modifiedCount, newOwnerId },
      metadata: { requestId, operation: 'bulk_assign' },
      requestId,
    });

    return {
      success: true,
      processedCount: leadIds.length,
      successCount: result.modifiedCount,
      failedCount: leadIds.length - result.modifiedCount,
      errors: [],
    };
  }

  /**
   * Bulk add tags to leads
   */
  async bulkAddTags(
    tenantId: string,
    userId: string,
    leadIds: string[],
    tags: string[],
    requestId: string
  ): Promise<BulkOperationResult> {
    const db = getDb();
    const objectIds = leadIds.map((id) => {
      try {
        return new ObjectId(id);
      } catch {
        return null;
      }
    }).filter(Boolean) as ObjectId[];

    const result = await db.collection('leads').updateMany(
      {
        _id: { $in: objectIds },
        tenantId,
        deletedAt: null,
      } as Filter<Document>,
      {
        $addToSet: { tags: { $each: tags } },
        $set: {
          updatedAt: new Date(),
          updatedBy: userId,
        },
      }
    );

    return {
      success: true,
      processedCount: leadIds.length,
      successCount: result.modifiedCount,
      failedCount: leadIds.length - result.modifiedCount,
      errors: [],
    };
  }

  /**
   * Export leads to JSON
   */
  async exportLeads(
    tenantId: string,
    filter?: {
      status?: string;
      source?: string;
      ownerId?: string;
      createdAfter?: Date;
      createdBefore?: Date;
    }
  ): Promise<Record<string, unknown>[]> {
    const db = getDb();

    const query: Filter<Document> = { tenantId, deletedAt: null };

    if (filter?.status) query.status = filter.status;
    if (filter?.source) query.source = filter.source;
    if (filter?.ownerId) query.ownerId = filter.ownerId;
    if (filter?.createdAfter || filter?.createdBefore) {
      query.createdAt = {};
      if (filter.createdAfter) (query.createdAt as Record<string, unknown>).$gte = filter.createdAfter;
      if (filter.createdBefore) (query.createdAt as Record<string, unknown>).$lte = filter.createdBefore;
    }

    const leads = await db
      .collection('leads')
      .find(query)
      .project({
        _id: 0,
        id: { $toString: '$_id' },
        firstName: 1,
        lastName: 1,
        email: 1,
        phone: 1,
        companyName: 1,
        title: 1,
        status: 1,
        source: 1,
        score: 1,
        tags: 1,
        createdAt: 1,
      })
      .toArray();

    logger.info('Leads exported', { tenantId, count: leads.length });

    return leads;
  }

  /**
   * Import leads from JSON
   */
  async importLeads(
    tenantId: string,
    userId: string,
    data: Record<string, unknown>[],
    requestId: string
  ): Promise<BulkOperationResult> {
    const leads: BulkLeadCreate[] = data.map((row) => ({
      firstName: String(row.firstName || ''),
      lastName: String(row.lastName || ''),
      email: String(row.email || ''),
      phone: row.phone ? String(row.phone) : undefined,
      companyName: row.companyName ? String(row.companyName) : undefined,
      title: row.title ? String(row.title) : undefined,
      source: row.source ? String(row.source) : undefined,
      tags: Array.isArray(row.tags) ? row.tags as string[] : [],
    }));

    return this.bulkCreateLeads(tenantId, userId, leads, requestId);
  }
}

// Singleton export
export const bulkOperationsService = new BulkOperationsService();
