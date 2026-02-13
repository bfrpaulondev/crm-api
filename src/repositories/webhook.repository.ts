// =============================================================================
// Webhook Repository - Repository for webhook configs and deliveries
// =============================================================================

import { Db, ObjectId, Filter, Sort } from 'mongodb';
import { getDb } from '@/infrastructure/mongo/connection.js';
import { traceRepositoryOperation } from '@/infrastructure/otel/tracing.js';
import { logger } from '@/infrastructure/logging/index.js';
import {
  WebhookConfig,
  WebhookDelivery,
  WebhookEvent,
  WebhookDeliveryStatus,
  CreateWebhookInput,
  UpdateWebhookInput,
  CreateWebhookDeliveryInput,
  WebhookFilter,
  WebhookDeliveryFilter,
  DEFAULT_WEBHOOK_RETRY_COUNT,
  DEFAULT_WEBHOOK_TIMEOUT_MS,
} from '@/types/webhook.js';

// ============================================================================
// Types
// ============================================================================

export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
}

// ============================================================================
// Webhook Config Repository
// ============================================================================

export class WebhookConfigRepository {
  protected collectionName = 'webhook_configs';
  protected db!: Db;

  constructor() {
    this.initializeDb();
  }

  private initializeDb(): void {
    try {
      this.db = getDb();
    } catch {
      // DB not initialized yet, will be set on first operation
    }
  }

  protected getCollection() {
    if (!this.db) {
      this.db = getDb();
    }
    return this.db.collection<WebhookConfig>(this.collectionName);
  }

  // ===========================================================================
  // Create Operations
  // ===========================================================================

  /**
   * Create a new webhook config
   */
  async create(
    tenantId: string,
    userId: string,
    input: CreateWebhookInput
  ): Promise<WebhookConfig> {
    return traceRepositoryOperation(this.collectionName, 'create', async () => {
      const collection = this.getCollection();
      const now = new Date();

      const webhook: WebhookConfig = {
        _id: new ObjectId(),
        tenantId,
        name: input.name,
        url: input.url,
        events: input.events,
        secret: input.secret,
        isActive: input.isActive ?? true,
        description: input.description ?? null,
        headers: input.headers ?? null,
        retryCount: DEFAULT_WEBHOOK_RETRY_COUNT,
        timeoutMs: DEFAULT_WEBHOOK_TIMEOUT_MS,
        createdBy: userId,
        createdAt: now,
        updatedAt: now,
        deletedAt: null,
      };

      await collection.insertOne(webhook);

      logger.debug('Created webhook config', {
        webhookId: webhook._id.toHexString(),
        tenantId,
        userId,
        events: input.events,
      });

      return webhook;
    });
  }

  // ===========================================================================
  // Read Operations
  // ===========================================================================

  /**
   * Find webhook by ID
   */
  async findById(id: string, tenantId: string): Promise<WebhookConfig | null> {
    return traceRepositoryOperation(this.collectionName, 'findById', async () => {
      const _id = new ObjectId(id);
      const collection = this.getCollection();

      return collection.findOne({
        _id,
        tenantId,
        deletedAt: null,
      } as Filter<WebhookConfig>);
    });
  }

  /**
   * Find all webhooks for a tenant
   */
  async findByTenant(
    tenantId: string,
    filter?: WebhookFilter,
    options?: { limit?: number; skip?: number }
  ): Promise<PaginatedResult<WebhookConfig>> {
    return traceRepositoryOperation(this.collectionName, 'findByTenant', async () => {
      const collection = this.getCollection();
      const query: Filter<WebhookConfig> = {
        tenantId,
        deletedAt: null,
      };

      if (filter?.isActive !== undefined) {
        query.isActive = filter.isActive;
      }

      if (filter?.events && filter.events.length > 0) {
        query.events = { $in: filter.events };
      }

      const totalCount = await collection.countDocuments(query);
      const limit = options?.limit ?? 50;
      const skip = options?.skip ?? 0;

      const data = await collection
        .find(query)
        .sort({ createdAt: -1 } as Sort)
        .limit(limit)
        .skip(skip)
        .toArray();

      return {
        data,
        totalCount,
        hasNextPage: skip + data.length < totalCount,
        hasPreviousPage: skip > 0,
      };
    });
  }

  /**
   * Find webhooks subscribed to a specific event
   */
  async findByEvent(
    tenantId: string,
    event: WebhookEvent
  ): Promise<WebhookConfig[]> {
    return traceRepositoryOperation(this.collectionName, 'findByEvent', async () => {
      const collection = this.getCollection();

      return collection
        .find({
          tenantId,
          events: event,
          isActive: true,
          deletedAt: null,
        } as Filter<WebhookConfig>)
        .toArray();
    });
  }

  /**
   * Find all active webhooks for a tenant
   */
  async findActiveByTenant(tenantId: string): Promise<WebhookConfig[]> {
    return traceRepositoryOperation(this.collectionName, 'findActiveByTenant', async () => {
      const collection = this.getCollection();

      return collection
        .find({
          tenantId,
          isActive: true,
          deletedAt: null,
        } as Filter<WebhookConfig>)
        .toArray();
    });
  }

  // ===========================================================================
  // Update Operations
  // ===========================================================================

  /**
   * Update webhook by ID
   */
  async updateById(
    id: string,
    tenantId: string,
    input: UpdateWebhookInput,
    userId?: string
  ): Promise<WebhookConfig | null> {
    return traceRepositoryOperation(this.collectionName, 'updateById', async () => {
      const collection = this.getCollection();
      const _id = new ObjectId(id);

      const updateDoc: Record<string, unknown> = {
        updatedAt: new Date(),
      };

      if (input.name !== undefined) updateDoc.name = input.name;
      if (input.url !== undefined) updateDoc.url = input.url;
      if (input.events !== undefined) updateDoc.events = input.events;
      if (input.secret !== undefined) updateDoc.secret = input.secret;
      if (input.description !== undefined) updateDoc.description = input.description;
      if (input.headers !== undefined) updateDoc.headers = input.headers;
      if (input.isActive !== undefined) updateDoc.isActive = input.isActive;

      if (userId) {
        updateDoc.updatedBy = userId;
      }

      const result = await collection.findOneAndUpdate(
        { _id, tenantId, deletedAt: null } as Filter<WebhookConfig>,
        { $set: updateDoc },
        { returnDocument: 'after' }
      );

      if (result) {
        logger.debug('Updated webhook config', {
          webhookId: id,
          tenantId,
          userId,
        });
      }

      return result;
    });
  }

  /**
   * Soft delete webhook by ID
   */
  async deleteById(id: string, tenantId: string, userId?: string): Promise<boolean> {
    return traceRepositoryOperation(this.collectionName, 'deleteById', async () => {
      const collection = this.getCollection();
      const _id = new ObjectId(id);

      const result = await collection.updateOne(
        { _id, tenantId, deletedAt: null } as Filter<WebhookConfig>,
        {
          $set: {
            deletedAt: new Date(),
            updatedAt: new Date(),
            updatedBy: userId,
          },
        }
      );

      if (result.modifiedCount > 0) {
        logger.debug('Soft deleted webhook config', {
          webhookId: id,
          tenantId,
          userId,
        });
      }

      return result.modifiedCount > 0;
    });
  }
}

// ============================================================================
// Webhook Delivery Repository
// ============================================================================

export class WebhookDeliveryRepository {
  protected collectionName = 'webhook_deliveries';
  protected db!: Db;

  constructor() {
    this.initializeDb();
  }

  private initializeDb(): void {
    try {
      this.db = getDb();
    } catch {
      // DB not initialized yet, will be set on first operation
    }
  }

  protected getCollection() {
    if (!this.db) {
      this.db = getDb();
    }
    return this.db.collection<WebhookDelivery>(this.collectionName);
  }

  // ===========================================================================
  // Create Operations
  // ===========================================================================

  /**
   * Create a delivery record
   */
  async create(input: CreateWebhookDeliveryInput): Promise<WebhookDelivery> {
    return traceRepositoryOperation(this.collectionName, 'create', async () => {
      const collection = this.getCollection();

      const delivery: WebhookDelivery = {
        _id: new ObjectId(),
        tenantId: input.tenantId,
        webhookId: input.webhookId,
        webhookUrl: input.webhookUrl,
        event: input.event,
        payload: input.payload,
        status: input.status,
        attemptNumber: input.attemptNumber,
        maxAttempts: input.maxAttempts,
        responseStatusCode: input.responseStatusCode ?? null,
        responseBody: input.responseBody ?? null,
        responseHeaders: input.responseHeaders ?? null,
        error: input.error ?? null,
        durationMs: input.durationMs ?? null,
        deliveredAt: input.deliveredAt ?? null,
        nextRetryAt: input.nextRetryAt ?? null,
        createdAt: new Date(),
      };

      await collection.insertOne(delivery);

      logger.debug('Created webhook delivery record', {
        deliveryId: delivery._id.toHexString(),
        webhookId: input.webhookId,
        event: input.event,
        status: input.status,
        attemptNumber: input.attemptNumber,
      });

      return delivery;
    });
  }

  // ===========================================================================
  // Read Operations
  // ===========================================================================

  /**
   * Find delivery by ID
   */
  async findById(id: string, tenantId: string): Promise<WebhookDelivery | null> {
    return traceRepositoryOperation(this.collectionName, 'findById', async () => {
      const _id = new ObjectId(id);
      const collection = this.getCollection();

      return collection.findOne({
        _id,
        tenantId,
      } as Filter<WebhookDelivery>);
    });
  }

  /**
   * Find deliveries for a webhook
   */
  async findByWebhook(
    webhookId: string,
    tenantId: string,
    options?: { limit?: number; skip?: number }
  ): Promise<PaginatedResult<WebhookDelivery>> {
    return traceRepositoryOperation(this.collectionName, 'findByWebhook', async () => {
      const collection = this.getCollection();
      const query: Filter<WebhookDelivery> = {
        webhookId,
        tenantId,
      };

      const totalCount = await collection.countDocuments(query);
      const limit = options?.limit ?? 50;
      const skip = options?.skip ?? 0;

      const data = await collection
        .find(query)
        .sort({ createdAt: -1 } as Sort)
        .limit(limit)
        .skip(skip)
        .toArray();

      return {
        data,
        totalCount,
        hasNextPage: skip + data.length < totalCount,
        hasPreviousPage: skip > 0,
      };
    });
  }

  /**
   * Find deliveries by tenant with filters
   */
  async findByTenant(
    tenantId: string,
    filter?: WebhookDeliveryFilter,
    options?: { limit?: number; skip?: number }
  ): Promise<PaginatedResult<WebhookDelivery>> {
    return traceRepositoryOperation(this.collectionName, 'findByTenant', async () => {
      const collection = this.getCollection();
      const query: Filter<WebhookDelivery> = { tenantId };

      if (filter?.webhookId) {
        query.webhookId = filter.webhookId;
      }

      if (filter?.status) {
        query.status = filter.status;
      }

      if (filter?.event) {
        query.event = filter.event;
      }

      if (filter?.startDate || filter?.endDate) {
        query.createdAt = {};
        if (filter.startDate) {
          (query.createdAt as Record<string, unknown>).$gte = filter.startDate;
        }
        if (filter.endDate) {
          (query.createdAt as Record<string, unknown>).$lte = filter.endDate;
        }
      }

      const totalCount = await collection.countDocuments(query);
      const limit = options?.limit ?? 50;
      const skip = options?.skip ?? 0;

      const data = await collection
        .find(query)
        .sort({ createdAt: -1 } as Sort)
        .limit(limit)
        .skip(skip)
        .toArray();

      return {
        data,
        totalCount,
        hasNextPage: skip + data.length < totalCount,
        hasPreviousPage: skip > 0,
      };
    });
  }

  /**
   * Find pending deliveries for retry
   */
  async findPendingRetries(limit = 100): Promise<WebhookDelivery[]> {
    return traceRepositoryOperation(this.collectionName, 'findPendingRetries', async () => {
      const collection = this.getCollection();
      const now = new Date();

      return collection
        .find({
          status: WebhookDeliveryStatus.RETRYING,
          nextRetryAt: { $lte: now },
          attemptNumber: { $lt: 3 }, // Max 3 attempts
        } as Filter<WebhookDelivery>)
        .limit(limit)
        .toArray();
    });
  }

  // ===========================================================================
  // Update Operations
  // ===========================================================================

  /**
   * Update delivery status
   */
  async updateStatus(
    id: string,
    tenantId: string,
    update: {
      status: WebhookDeliveryStatus;
      responseStatusCode?: number;
      responseBody?: string;
      responseHeaders?: Record<string, string>;
      error?: string;
      durationMs?: number;
      deliveredAt?: Date;
      nextRetryAt?: Date;
      attemptNumber?: number;
    }
  ): Promise<WebhookDelivery | null> {
    return traceRepositoryOperation(this.collectionName, 'updateStatus', async () => {
      const collection = this.getCollection();
      const _id = new ObjectId(id);

      const updateDoc: Record<string, unknown> = {
        status: update.status,
      };

      if (update.responseStatusCode !== undefined) {
        updateDoc.responseStatusCode = update.responseStatusCode;
      }
      if (update.responseBody !== undefined) {
        updateDoc.responseBody = update.responseBody;
      }
      if (update.responseHeaders !== undefined) {
        updateDoc.responseHeaders = update.responseHeaders;
      }
      if (update.error !== undefined) {
        updateDoc.error = update.error;
      }
      if (update.durationMs !== undefined) {
        updateDoc.durationMs = update.durationMs;
      }
      if (update.deliveredAt !== undefined) {
        updateDoc.deliveredAt = update.deliveredAt;
      }
      if (update.nextRetryAt !== undefined) {
        updateDoc.nextRetryAt = update.nextRetryAt;
      }
      if (update.attemptNumber !== undefined) {
        updateDoc.attemptNumber = update.attemptNumber;
      }

      const result = await collection.findOneAndUpdate(
        { _id, tenantId } as Filter<WebhookDelivery>,
        { $set: updateDoc },
        { returnDocument: 'after' }
      );

      return result;
    });
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  /**
   * Get delivery statistics for a webhook
   */
  async getStats(
    webhookId: string,
    tenantId: string,
    startDate?: Date,
    endDate?: Date
  ): Promise<{
    totalDeliveries: number;
    successful: number;
    failed: number;
    pending: number;
    successRate: number;
  }> {
    return traceRepositoryOperation(this.collectionName, 'getStats', async () => {
      const collection = this.getCollection();

      const matchStage: Record<string, unknown> = { webhookId, tenantId };
      if (startDate || endDate) {
        const dateFilter: Record<string, unknown> = {};
        if (startDate) dateFilter.$gte = startDate;
        if (endDate) dateFilter.$lte = endDate;
        matchStage.createdAt = dateFilter;
      }

      const statsResult = await collection
        .aggregate([
          { $match: matchStage },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
            },
          },
        ])
        .toArray();

      const stats: Record<string, number> = {};
      for (const item of statsResult) {
        stats[item._id ?? 'UNKNOWN'] = item.count;
      }

      const totalDeliveries = Object.values(stats).reduce((a, b) => a + b, 0);
      const successful = stats[WebhookDeliveryStatus.SUCCESS] ?? 0;
      const failed = stats[WebhookDeliveryStatus.FAILED] ?? 0;
      const pending = (stats[WebhookDeliveryStatus.PENDING] ?? 0) +
        (stats[WebhookDeliveryStatus.RETRYING] ?? 0);

      return {
        totalDeliveries,
        successful,
        failed,
        pending,
        successRate: totalDeliveries > 0 ? (successful / totalDeliveries) * 100 : 0,
      };
    });
  }
}

// ============================================================================
// Singleton Instances
// ============================================================================

export const webhookConfigRepository = new WebhookConfigRepository();
export const webhookDeliveryRepository = new WebhookDeliveryRepository();
