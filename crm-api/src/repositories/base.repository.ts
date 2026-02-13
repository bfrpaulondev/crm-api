// =============================================================================
// Base Repository - Common MongoDB Operations
// =============================================================================

import { Db, ObjectId, Filter, Sort, FindOptions, UpdateFilter, Document } from 'mongodb';
import { getDb, getClient } from '@/infrastructure/mongo/connection.js';
import { BaseEntity } from '@/types/entities.js';
import { traceRepositoryOperation } from '@/infrastructure/otel/tracing.js';
import { logger } from '@/infrastructure/logging/index.js';

// ============================================================================
// Types
// ============================================================================

export interface PaginationOptions {
  limit?: number;
  offset?: number;
  cursor?: string;
  sort?: Sort;
}

export interface PaginatedResult<T> {
  data: T[];
  totalCount: number;
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor: string | null;
  endCursor: string | null;
}

export interface FindManyOptions<T> {
  filter: Filter<T>;
  pagination?: PaginationOptions;
  sort?: Sort;
  projection?: Document;
}

// ============================================================================
// Base Repository Class
// ============================================================================

export abstract class BaseRepository<T extends BaseEntity> {
  protected abstract collectionName: string;
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
    return this.db.collection<T>(this.collectionName);
  }

  // ===========================================================================
  // Read Operations
  // ===========================================================================

  /**
   * Find by ID
   */
  async findById(id: string | ObjectId, tenantId: string): Promise<T | null> {
    return traceRepositoryOperation(this.collectionName, 'findById', async () => {
      const _id = typeof id === 'string' ? new ObjectId(id) : id;
      const collection = this.getCollection();

      const result = await collection.findOne({
        _id,
        tenantId,
        deletedAt: null,
      } as Filter<T>);

      return result;
    });
  }

  /**
   * Find one by filter
   */
  async findOne(filter: Filter<T>, tenantId: string): Promise<T | null> {
    return traceRepositoryOperation(this.collectionName, 'findOne', async () => {
      const collection = this.getCollection();

      const result = await collection.findOne({
        ...filter,
        tenantId,
        deletedAt: null,
      } as Filter<T>);

      return result;
    });
  }

  /**
   * Find many with pagination
   */
  async findMany(options: FindManyOptions<T>, tenantId: string): Promise<PaginatedResult<T>> {
    return traceRepositoryOperation(this.collectionName, 'findMany', async () => {
      const collection = this.getCollection();
      const { filter, pagination = {}, sort = { createdAt: -1 }, projection } = options;
      const { limit = 20, cursor } = pagination;

      // Build query filter
      const queryFilter: Filter<T> = {
        ...filter,
        tenantId,
        deletedAt: null,
      };

      // Cursor-based pagination
      if (cursor) {
        const cursorId = new ObjectId(cursor);
        (queryFilter as Record<string, unknown>)._id = { $lt: cursorId };
      }

      // Count total
      const totalCount = await collection.countDocuments(queryFilter);

      // Find with pagination
      const findOptions: FindOptions = {
        limit: limit + 1, // Fetch one extra to check hasNextPage
        sort,
      };

      if (projection) {
        findOptions.projection = projection;
      }

      const cursor_result = collection.find(queryFilter, findOptions);
      const data = await cursor_result.toArray();

      // Check if there's a next page
      const hasNextPage = data.length > limit;
      if (hasNextPage) {
        data.pop(); // Remove the extra item
      }

      return {
        data,
        totalCount,
        hasNextPage,
        hasPreviousPage: !!cursor,
        startCursor: data.length > 0 ? data[0]._id.toHexString() : null,
        endCursor: data.length > 0 ? data[data.length - 1]._id.toHexString() : null,
      };
    });
  }

  /**
   * Find all (no pagination) - use sparingly
   */
  async findAll(tenantId: string, filter?: Filter<T>): Promise<T[]> {
    return traceRepositoryOperation(this.collectionName, 'findAll', async () => {
      const collection = this.getCollection();

      const queryFilter: Filter<T> = {
        ...filter,
        tenantId,
        deletedAt: null,
      };

      return collection.find(queryFilter).toArray();
    });
  }

  /**
   * Count documents
   */
  async count(filter: Filter<T>, tenantId: string): Promise<number> {
    return traceRepositoryOperation(this.collectionName, 'count', async () => {
      const collection = this.getCollection();

      return collection.countDocuments({
        ...filter,
        tenantId,
        deletedAt: null,
      } as Filter<T>);
    });
  }

  /**
   * Check if exists
   */
  async exists(filter: Filter<T>, tenantId: string): Promise<boolean> {
    const count = await this.count(filter, tenantId);
    return count > 0;
  }

  // ===========================================================================
  // Write Operations
  // ===========================================================================

  /**
   * Create a new document
   */
  async create(data: Omit<T, '_id' | 'createdAt' | 'updatedAt'>): Promise<T> {
    return traceRepositoryOperation(this.collectionName, 'create', async () => {
      const collection = this.getCollection();

      const now = new Date();
      const document = {
        ...data,
        _id: new ObjectId(),
        createdAt: now,
        updatedAt: now,
      } as T;

      await collection.insertOne(document as Document);

      logger.debug(`Created ${this.collectionName}`, {
        id: document._id.toHexString(),
        tenantId: document.tenantId,
      });

      return document;
    });
  }

  /**
   * Update by ID
   */
  async updateById(
    id: string | ObjectId,
    tenantId: string,
    update: Partial<T>,
    userId?: string
  ): Promise<T | null> {
    return traceRepositoryOperation(this.collectionName, 'updateById', async () => {
      const collection = this.getCollection();
      const _id = typeof id === 'string' ? new ObjectId(id) : id;

      const updateDoc = {
        $set: {
          ...update,
          updatedAt: new Date(),
          updatedBy: userId,
        },
      };

      const result = await collection.findOneAndUpdate(
        { _id, tenantId, deletedAt: null } as Filter<T>,
        updateDoc as UpdateFilter<T>,
        { returnDocument: 'after' }
      );

      if (result) {
        logger.debug(`Updated ${this.collectionName}`, {
          id: _id.toHexString(),
          tenantId,
        });
      }

      return result;
    });
  }

  /**
   * Update many
   */
  async updateMany(
    filter: Filter<T>,
    tenantId: string,
    update: Partial<T>
  ): Promise<number> {
    return traceRepositoryOperation(this.collectionName, 'updateMany', async () => {
      const collection = this.getCollection();

      const updateDoc = {
        $set: {
          ...update,
          updatedAt: new Date(),
        },
      };

      const result = await collection.updateMany(
        { ...filter, tenantId, deletedAt: null } as Filter<T>,
        updateDoc as UpdateFilter<T>
      );

      logger.debug(`Updated ${result.modifiedCount} ${this.collectionName} documents`);

      return result.modifiedCount;
    });
  }

  /**
   * Soft delete by ID
   */
  async deleteById(id: string | ObjectId, tenantId: string, userId?: string): Promise<boolean> {
    return traceRepositoryOperation(this.collectionName, 'deleteById', async () => {
      const collection = this.getCollection();
      const _id = typeof id === 'string' ? new ObjectId(id) : id;

      const result = await collection.updateOne(
        { _id, tenantId, deletedAt: null } as Filter<T>,
        {
          $set: {
            deletedAt: new Date(),
            updatedAt: new Date(),
            updatedBy: userId,
          },
        }
      );

      if (result.modifiedCount > 0) {
        logger.debug(`Soft deleted ${this.collectionName}`, {
          id: _id.toHexString(),
          tenantId,
        });
      }

      return result.modifiedCount > 0;
    });
  }

  /**
   * Hard delete by ID (use with caution)
   */
  async hardDeleteById(id: string | ObjectId, tenantId: string): Promise<boolean> {
    return traceRepositoryOperation(this.collectionName, 'hardDeleteById', async () => {
      const collection = this.getCollection();
      const _id = typeof id === 'string' ? new ObjectId(id) : id;

      const result = await collection.deleteOne({
        _id,
        tenantId,
      } as Filter<T>);

      if (result.deletedCount > 0) {
        logger.warn(`Hard deleted ${this.collectionName}`, {
          id: _id.toHexString(),
          tenantId,
        });
      }

      return result.deletedCount > 0;
    });
  }

  // ===========================================================================
  // Bulk Operations
  // ===========================================================================

  /**
   * Bulk insert
   */
  async bulkInsert(documents: Array<Omit<T, '_id' | 'createdAt' | 'updatedAt'>>): Promise<T[]> {
    return traceRepositoryOperation(this.collectionName, 'bulkInsert', async () => {
      const collection = this.getCollection();
      const now = new Date();

      const docsToInsert = documents.map((doc) => ({
        ...doc,
        _id: new ObjectId(),
        createdAt: now,
        updatedAt: now,
      })) as T[];

      await collection.insertMany(docsToInsert as Document[]);

      logger.debug(`Bulk inserted ${docsToInsert.length} ${this.collectionName} documents`);

      return docsToInsert;
    });
  }

  /**
   * Transaction support
   */
  protected async withTransaction<R>(
    callback: (session: import('mongodb').ClientSession) => Promise<R>
  ): Promise<R> {
    const client = getClient();
    const session = client.startSession();

    try {
      let result: R;

      await session.withTransaction(async () => {
        result = await callback(session);
      });

      return result!;
    } finally {
      await session.endSession();
    }
  }
}
