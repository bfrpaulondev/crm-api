// =============================================================================
// Tenant Repository
// =============================================================================

import { BaseRepository } from './base.repository.js';
import { Tenant, TenantPlan } from '@/types/entities.js';
import { Filter, ObjectId } from 'mongodb';

export class TenantRepository extends BaseRepository<Tenant> {
  protected collectionName = 'tenants';

  async findBySlug(slug: string): Promise<Tenant | null> {
    const collection = this.getCollection();
    return collection.findOne({ slug: slug.toLowerCase(), deletedAt: null }) as Promise<Tenant | null>;
  }

  async findByIdGlobally(id: string): Promise<Tenant | null> {
    const collection = this.getCollection();
    // Try to find by string ID first (UUID), then by ObjectId
    let result = await collection.findOne({ _id: id as any, deletedAt: null });
    if (!result) {
      try {
        const _id = new ObjectId(id);
        result = await collection.findOne({ _id, deletedAt: null });
      } catch {
        // Not a valid ObjectId, ignore
      }
    }
    return result as Tenant | null;
  }

  async slugExists(slug: string): Promise<boolean> {
    const tenant = await this.findBySlug(slug);
    return !!tenant;
  }

  async updatePlan(tenantId: string, plan: TenantPlan): Promise<Tenant | null> {
    return this.updateById(tenantId, tenantId, { plan } as Partial<Tenant>);
  }

  async deactivate(tenantId: string): Promise<void> {
    await this.updateById(tenantId, tenantId, { isActive: false } as Partial<Tenant>);
  }

  async activate(tenantId: string): Promise<void> {
    await this.updateById(tenantId, tenantId, { isActive: true } as Partial<Tenant>);
  }
}

export const tenantRepository = new TenantRepository();
