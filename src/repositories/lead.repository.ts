// =============================================================================
// Lead Repository
// =============================================================================

import { BaseRepository, PaginatedResult } from './base.repository.js';
import { Lead, LeadStatus } from '@/types/entities.js';
import { Filter, ObjectId } from 'mongodb';
import { LeadFilter } from '@/types/validation.js';

export class LeadRepository extends BaseRepository<Lead> {
  protected collectionName = 'leads';

  // ===========================================================================
  // Specialized Queries
  // ===========================================================================

  /**
   * Find lead by email within tenant (for deduplication)
   */
  async findByEmail(email: string, tenantId: string): Promise<Lead | null> {
    return this.findOne({ email: email.toLowerCase() } as Filter<Lead>, tenantId);
  }

  /**
   * Check if email exists (for validation)
   */
  async emailExists(email: string, tenantId: string, excludeId?: string): Promise<boolean> {
    const filter: Filter<Lead> = { email: email.toLowerCase() };

    if (excludeId) {
      filter._id = { $ne: new ObjectId(excludeId) };
    }

    return this.exists(filter, tenantId);
  }

  /**
   * Find leads with filters
   */
  async findWithFilters(
    tenantId: string,
    filter?: LeadFilter,
    pagination?: { limit?: number; cursor?: string }
  ): Promise<PaginatedResult<Lead>> {
    const queryFilter: Filter<Lead> = {};

    if (filter) {
      if (filter.status) {
        queryFilter.status = filter.status;
      }
      if (filter.source) {
        queryFilter.source = filter.source;
      }
      if (filter.ownerId) {
        queryFilter.ownerId = filter.ownerId;
      }
      if (filter.tags && filter.tags.length > 0) {
        queryFilter.tags = { $all: filter.tags };
      }
      if (filter.hasCompany !== undefined) {
        if (filter.hasCompany) {
          queryFilter.companyName = { $exists: true, $nin: [null, ''] };
        } else {
          queryFilter.$or = [
            { companyName: null },
            { companyName: '' },
            { companyName: { $exists: false } },
          ];
        }
      }
      if (filter.minScore !== undefined) {
        queryFilter.score = { $gte: filter.minScore };
      }
      if (filter.createdAfter || filter.createdBefore) {
        queryFilter.createdAt = {};
        if (filter.createdAfter) {
          queryFilter.createdAt.$gte = filter.createdAfter;
        }
        if (filter.createdBefore) {
          queryFilter.createdAt.$lte = filter.createdBefore;
        }
      }
      if (filter.search) {
        queryFilter.$or = [
          { firstName: { $regex: filter.search, $options: 'i' } },
          { lastName: { $regex: filter.search, $options: 'i' } },
          { email: { $regex: filter.search, $options: 'i' } },
          { companyName: { $regex: filter.search, $options: 'i' } },
        ];
      }
    }

    return this.findMany(
      {
        filter: queryFilter,
        pagination,
        sort: { createdAt: -1 },
      },
      tenantId
    );
  }

  /**
   * Find leads by owner
   */
  async findByOwner(ownerId: string, tenantId: string): Promise<Lead[]> {
    return this.findAll(tenantId, { ownerId } as Filter<Lead>);
  }

  /**
   * Find converted leads
   */
  async findConverted(tenantId: string): Promise<Lead[]> {
    return this.findAll(tenantId, { status: LeadStatus.CONVERTED } as Filter<Lead>);
  }

  // ===========================================================================
  // Lead-specific Operations
  // ===========================================================================

  /**
   * Update lead status
   */
  async updateStatus(
    id: string,
    tenantId: string,
    status: LeadStatus,
    userId?: string
  ): Promise<Lead | null> {
    const update: Partial<Lead> = { status };

    if (status === LeadStatus.QUALIFIED) {
      update.qualifiedAt = new Date();
    }

    return this.updateById(id, tenantId, update, userId);
  }

  /**
   * Qualify a lead
   */
  async qualify(
    id: string,
    tenantId: string,
    userId?: string
  ): Promise<Lead | null> {
    return this.updateById(
      id,
      tenantId,
      {
        status: LeadStatus.QUALIFIED,
        qualifiedAt: new Date(),
      },
      userId
    );
  }

  /**
   * Convert a lead - mark as converted and store references
   */
  async convert(
    id: string,
    tenantId: string,
    convertedData: {
      contactId: string;
      accountId: string;
      opportunityId?: string;
    },
    userId?: string
  ): Promise<Lead | null> {
    return this.updateById(
      id,
      tenantId,
      {
        status: LeadStatus.CONVERTED,
        convertedAt: new Date(),
        convertedToContactId: convertedData.contactId,
        convertedToAccountId: convertedData.accountId,
        convertedToOpportunityId: convertedData.opportunityId || null,
      },
      userId
    );
  }

  /**
   * Increment lead score
   */
  async incrementScore(id: string, tenantId: string, points: number): Promise<Lead | null> {
    const collection = this.getCollection();
    const _id = new ObjectId(id);

    const result = await collection.findOneAndUpdate(
      { _id, tenantId, deletedAt: null } as Filter<Lead>,
      {
        $inc: { score: points },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    return result;
  }

  /**
   * Add tag to lead
   */
  async addTag(id: string, tenantId: string, tag: string): Promise<Lead | null> {
    const collection = this.getCollection();
    const _id = new ObjectId(id);

    const result = await collection.findOneAndUpdate(
      { _id, tenantId, deletedAt: null } as Filter<Lead>,
      {
        $addToSet: { tags: tag },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    return result;
  }

  /**
   * Remove tag from lead
   */
  async removeTag(id: string, tenantId: string, tag: string): Promise<Lead | null> {
    const collection = this.getCollection();
    const _id = new ObjectId(id);

    const result = await collection.findOneAndUpdate(
      { _id, tenantId, deletedAt: null } as Filter<Lead>,
      {
        $pull: { tags: tag },
        $set: { updatedAt: new Date() },
      },
      { returnDocument: 'after' }
    );

    return result;
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  /**
   * Get lead counts by status
   */
  async getCountsByStatus(tenantId: string): Promise<Record<LeadStatus, number>> {
    const collection = this.getCollection();

    const pipeline = [
      { $match: { tenantId, deletedAt: null } },
      { $group: { _id: '$status', count: { $sum: 1 } } },
    ];

    const results = await collection.aggregate(pipeline).toArray();

    const counts: Record<LeadStatus, number> = {
      [LeadStatus.NEW]: 0,
      [LeadStatus.CONTACTED]: 0,
      [LeadStatus.QUALIFIED]: 0,
      [LeadStatus.CONVERTED]: 0,
      [LeadStatus.UNQUALIFIED]: 0,
    };

    for (const result of results) {
      counts[result._id as LeadStatus] = result.count;
    }

    return counts;
  }

  /**
   * Get lead counts by source
   */
  async getCountsBySource(tenantId: string): Promise<Record<string, number>> {
    const collection = this.getCollection();

    const pipeline = [
      { $match: { tenantId, deletedAt: null, source: { $ne: null } } },
      { $group: { _id: '$source', count: { $sum: 1 } } },
    ];

    const results = await collection.aggregate(pipeline).toArray();

    const counts: Record<string, number> = {};
    for (const result of results) {
      if (result._id) {
        counts[result._id] = result.count;
      }
    }

    return counts;
  }
}

// Singleton export
export const leadRepository = new LeadRepository();
