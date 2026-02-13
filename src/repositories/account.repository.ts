// =============================================================================
// Account Repository
// =============================================================================

import { BaseRepository, PaginatedResult } from './base.repository.js';
import { Account, AccountStatus } from '@/types/entities.js';
import { Filter, ObjectId } from 'mongodb';
import { AccountFilter } from '@/types/validation.js';

export class AccountRepository extends BaseRepository<Account> {
  protected collectionName = 'accounts';

  async findByDomain(domain: string, tenantId: string): Promise<Account | null> {
    return this.findOne({ domain } as Filter<Account>, tenantId);
  }

  async domainExists(domain: string, tenantId: string, excludeId?: string): Promise<boolean> {
    const filter: Filter<Account> = { domain };
    if (excludeId) {
      filter._id = { $ne: new ObjectId(excludeId) };
    }
    return this.exists(filter, tenantId);
  }

  async findWithFilters(
    tenantId: string,
    filter?: AccountFilter,
    pagination?: { limit?: number; cursor?: string }
  ): Promise<PaginatedResult<Account>> {
    const queryFilter: Filter<Account> = {};

    if (filter) {
      if (filter.type) queryFilter.type = filter.type;
      if (filter.tier) queryFilter.tier = filter.tier;
      if (filter.status) queryFilter.status = filter.status;
      if (filter.ownerId) queryFilter.ownerId = filter.ownerId;
      if (filter.industry) queryFilter.industry = filter.industry;

      if (filter.search) {
        queryFilter.$or = [
          { name: { $regex: filter.search, $options: 'i' } },
          { domain: { $regex: filter.search, $options: 'i' } },
          { website: { $regex: filter.search, $options: 'i' } },
        ];
      }
    }

    return this.findMany({ filter: queryFilter, pagination }, tenantId);
  }

  async findByOwner(ownerId: string, tenantId: string): Promise<Account[]> {
    return this.findAll(tenantId, { ownerId } as Filter<Account>);
  }

  async updateStatus(
    id: string,
    tenantId: string,
    status: AccountStatus,
    userId?: string
  ): Promise<Account | null> {
    return this.updateById(id, tenantId, { status }, userId);
  }

  async getAccountStats(tenantId: string): Promise<{
    byType: Record<string, number>;
    byTier: Record<string, number>;
    byStatus: Record<string, number>;
  }> {
    const collection = this.getCollection();

    const [byType, byTier, byStatus] = await Promise.all([
      collection
        .aggregate([
          { $match: { tenantId, deletedAt: null } },
          { $group: { _id: '$type', count: { $sum: 1 } } },
        ])
        .toArray(),
      collection
        .aggregate([
          { $match: { tenantId, deletedAt: null } },
          { $group: { _id: '$tier', count: { $sum: 1 } } },
        ])
        .toArray(),
      collection
        .aggregate([
          { $match: { tenantId, deletedAt: null } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        .toArray(),
    ]);

    const toRecord = (arr: Array<{ _id: string | null; count: number }>) =>
      arr.reduce((acc, { _id, count }) => {
        if (_id) acc[_id] = count;
        return acc;
      }, {} as Record<string, number>);

    return {
      byType: toRecord(byType as Array<{ _id: string | null; count: number }>),
      byTier: toRecord(byTier as Array<{ _id: string | null; count: number }>),
      byStatus: toRecord(byStatus as Array<{ _id: string | null; count: number }>),
    };
  }
}

export const accountRepository = new AccountRepository();
