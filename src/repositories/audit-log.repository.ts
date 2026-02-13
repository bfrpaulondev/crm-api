// =============================================================================
// Audit Log Repository
// =============================================================================

import { Db, ObjectId } from 'mongodb';
import { AuditLog, AuditAction } from '@/types/entities.js';
import { getDb } from '@/infrastructure/mongo/connection.js';
import { traceRepositoryOperation } from '@/infrastructure/otel/tracing.js';

export interface CreateAuditLogInput {
  tenantId: string;
  entityType: string;
  entityId: string;
  action: AuditAction | string;
  actorId: string;
  actorEmail: string;
  changes: Record<string, unknown> | null;
  metadata: Record<string, unknown> | null;
  requestId: string;
}

export class AuditLogRepository {
  private collectionName = 'audit_logs';
  private db!: Db;

  constructor() {
    try {
      this.db = getDb();
    } catch {
      // DB not initialized yet
    }
  }

  private getCollection() {
    if (!this.db) {
      this.db = getDb();
    }
    return this.db.collection<AuditLog>(this.collectionName);
  }

  /**
   * Log an audit event (append-only)
   */
  async log(input: CreateAuditLogInput): Promise<AuditLog> {
    return traceRepositoryOperation(this.collectionName, 'log', async () => {
      const collection = this.getCollection();

      const auditLog: AuditLog = {
        _id: new ObjectId(),
        tenantId: input.tenantId,
        entityType: input.entityType,
        entityId: input.entityId,
        action: input.action as AuditAction,
        actorId: input.actorId,
        actorEmail: input.actorEmail,
        changes: input.changes as Record<string, { old: unknown; new: unknown }>,
        metadata: input.metadata,
        requestId: input.requestId,
        createdAt: new Date(),
      };

      await collection.insertOne(auditLog);

      return auditLog;
    });
  }

  /**
   * Find audit logs by entity
   */
  async findByEntity(
    tenantId: string,
    entityType: string,
    entityId: string,
    options?: { limit?: number; skip?: number }
  ): Promise<AuditLog[]> {
    return traceRepositoryOperation(this.collectionName, 'findByEntity', async () => {
      const collection = this.getCollection();

      return collection
        .find({
          tenantId,
          entityType,
          entityId,
        })
        .sort({ createdAt: -1 })
        .limit(options?.limit ?? 50)
        .skip(options?.skip ?? 0)
        .toArray();
    });
  }

  /**
   * Find audit logs by actor
   */
  async findByActor(
    tenantId: string,
    actorId: string,
    options?: { limit?: number; skip?: number }
  ): Promise<AuditLog[]> {
    return traceRepositoryOperation(this.collectionName, 'findByActor', async () => {
      const collection = this.getCollection();

      return collection
        .find({
          tenantId,
          actorId,
        })
        .sort({ createdAt: -1 })
        .limit(options?.limit ?? 50)
        .skip(options?.skip ?? 0)
        .toArray();
    });
  }

  /**
   * Find audit logs by tenant (with filters)
   */
  async findByTenant(
    tenantId: string,
    filters?: {
      entityType?: string;
      action?: string;
      startDate?: Date;
      endDate?: Date;
    },
    options?: { limit?: number; skip?: number }
  ): Promise<AuditLog[]> {
    return traceRepositoryOperation(this.collectionName, 'findByTenant', async () => {
      const collection = this.getCollection();

      const query: Record<string, unknown> = { tenantId };

      if (filters?.entityType) query.entityType = filters.entityType;
      if (filters?.action) query.action = filters.action;

      if (filters?.startDate || filters?.endDate) {
        const dateFilter: Record<string, unknown> = {};
        if (filters.startDate) dateFilter.$gte = filters.startDate;
        if (filters.endDate) dateFilter.$lte = filters.endDate;
        query.createdAt = dateFilter;
      }

      return collection
        .find(query)
        .sort({ createdAt: -1 })
        .limit(options?.limit ?? 100)
        .skip(options?.skip ?? 0)
        .toArray();
    });
  }

  /**
   * Get audit statistics
   */
  async getStats(tenantId: string, startDate?: Date, endDate?: Date): Promise<{
    totalLogs: number;
    byAction: Record<string, number>;
    byEntityType: Record<string, number>;
  }> {
    return traceRepositoryOperation(this.collectionName, 'getStats', async () => {
      const collection = this.getCollection();

      const matchStage: Record<string, unknown> = { tenantId };
      if (startDate || endDate) {
        const dateFilter: Record<string, unknown> = {};
        if (startDate) dateFilter.$gte = startDate;
        if (endDate) dateFilter.$lte = endDate;
        matchStage.createdAt = dateFilter;
      }

      const [totalResult, byActionResult, byEntityTypeResult] = await Promise.all([
        collection.countDocuments(matchStage),
        collection
          .aggregate([
            { $match: matchStage },
            { $group: { _id: '$action', count: { $sum: 1 } } },
          ])
          .toArray(),
        collection
          .aggregate([
            { $match: matchStage },
            { $group: { _id: '$entityType', count: { $sum: 1 } } },
          ])
          .toArray(),
      ]);

      const byAction: Record<string, number> = {};
      for (const item of byActionResult) {
        byAction[String(item._id ?? 'UNKNOWN')] = item.count;
      }

      const byEntityType: Record<string, number> = {};
      for (const item of byEntityTypeResult) {
        byEntityType[String(item._id ?? 'UNKNOWN')] = item.count;
      }

      return {
        totalLogs: totalResult,
        byAction,
        byEntityType,
      };
    });
  }
}

export const auditLogRepository = new AuditLogRepository();
