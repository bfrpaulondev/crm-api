// =============================================================================
// Tenant Repository - Special case (no tenantId, as Tenant IS the tenant)
// =============================================================================

import { Db, ObjectId } from 'mongodb';
import { getDb } from '@/infrastructure/mongo/connection.js';
import { Tenant, TenantPlan } from '@/types/entities.js';
import { traceRepositoryOperation } from '@/infrastructure/otel/tracing.js';
import { logger } from '@/infrastructure/logging/index.js';

export class TenantRepository {
  protected collectionName = 'tenants';
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
    return this.db.collection<Tenant>(this.collectionName);
  }

  async findBySlug(slug: string): Promise<Tenant | null> {
    return traceRepositoryOperation(this.collectionName, 'findBySlug', async () => {
      const collection = this.getCollection();
      return collection.findOne({ slug: slug.toLowerCase() }) as Promise<Tenant | null>;
    });
  }

  async findByIdGlobally(id: string): Promise<Tenant | null> {
    return traceRepositoryOperation(this.collectionName, 'findByIdGlobally', async () => {
      const collection = this.getCollection();
      // Try to find by string ID first (UUID), then by ObjectId
      let result = await collection.findOne({ _id: id as any });
      if (!result) {
        try {
          const _id = new ObjectId(id);
          result = await collection.findOne({ _id });
        } catch {
          // Not a valid ObjectId, ignore
        }
      }
      return result as Tenant | null;
    });
  }

  async slugExists(slug: string): Promise<boolean> {
    const tenant = await this.findBySlug(slug);
    return !!tenant;
  }

  async create(data: Omit<Tenant, '_id' | 'createdAt' | 'updatedAt'> & { _id?: string | ObjectId; deletedAt?: Date | null }): Promise<Tenant> {
    return traceRepositoryOperation(this.collectionName, 'create', async () => {
      const collection = this.getCollection();

      const now = new Date();
      const document = {
        ...data,
        _id: (data as any)._id || new ObjectId(),
        createdAt: now,
        updatedAt: now,
      } as unknown as Tenant;

      await collection.insertOne(document as any);

      const id = document._id;
      logger.debug(`Created ${this.collectionName}`, {
        id: typeof id === 'string' ? id : id.toHexString(),
      });

      return document;
    });
  }

  async updatePlan(tenantId: string, plan: TenantPlan): Promise<Tenant | null> {
    return traceRepositoryOperation(this.collectionName, 'updatePlan', async () => {
      const collection = this.getCollection();

      // Try with string ID first (UUID)
      let result = await collection.findOneAndUpdate(
        { _id: tenantId as any },
        { $set: { plan, updatedAt: new Date() } },
        { returnDocument: 'after' }
      );

      // If not found and it's a string, try as ObjectId
      if (!result && typeof tenantId === 'string') {
        try {
          const _id = new ObjectId(tenantId);
          result = await collection.findOneAndUpdate(
            { _id },
            { $set: { plan, updatedAt: new Date() } },
            { returnDocument: 'after' }
          );
        } catch {
          // Not a valid ObjectId, ignore
        }
      }

      return result as Tenant | null;
    });
  }

  async deactivate(tenantId: string): Promise<void> {
    await this.updateIsActive(tenantId, false);
  }

  async activate(tenantId: string): Promise<void> {
    await this.updateIsActive(tenantId, true);
  }

  private async updateIsActive(tenantId: string, isActive: boolean): Promise<void> {
    return traceRepositoryOperation(this.collectionName, 'updateIsActive', async () => {
      const collection = this.getCollection();

      // Try with string ID first (UUID)
      let result = await collection.findOneAndUpdate(
        { _id: tenantId as any },
        { $set: { isActive, updatedAt: new Date() } },
        { returnDocument: 'after' }
      );

      // If not found and it's a string, try as ObjectId
      if (!result && typeof tenantId === 'string') {
        try {
          const _id = new ObjectId(tenantId);
          result = await collection.findOneAndUpdate(
            { _id },
            { $set: { isActive, updatedAt: new Date() } },
            { returnDocument: 'after' }
          );
        } catch {
          // Not a valid ObjectId, ignore
        }
      }
    });
  }
}

export const tenantRepository = new TenantRepository();
