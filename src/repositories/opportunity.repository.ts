// =============================================================================
// Opportunity Repository
// =============================================================================

import { BaseRepository, PaginatedResult } from './base.repository.js';
import { Opportunity, OpportunityStatus, OpportunityTimeline } from '@/types/entities.js';
import { Filter, ObjectId } from 'mongodb';
import { OpportunityFilter } from '@/types/validation.js';

export class OpportunityRepository extends BaseRepository<Opportunity> {
  protected collectionName = 'opportunities';

  async findWithFilters(
    tenantId: string,
    filter?: OpportunityFilter,
    pagination?: { limit?: number; cursor?: string }
  ): Promise<PaginatedResult<Opportunity>> {
    const queryFilter: Filter<Opportunity> = {};

    if (filter) {
      if (filter.accountId) queryFilter.accountId = filter.accountId;
      if (filter.ownerId) queryFilter.ownerId = filter.ownerId;
      if (filter.stageId) queryFilter.stageId = filter.stageId;
      if (filter.status) queryFilter.status = filter.status;
      if (filter.type) queryFilter.type = filter.type;

      if (filter.minAmount !== undefined || filter.maxAmount !== undefined) {
        queryFilter.amount = {};
        if (filter.minAmount !== undefined) queryFilter.amount.$gte = filter.minAmount;
        if (filter.maxAmount !== undefined) queryFilter.amount.$lte = filter.maxAmount;
      }

      if (filter.expectedCloseAfter || filter.expectedCloseBefore) {
        queryFilter.expectedCloseDate = {};
        if (filter.expectedCloseAfter) queryFilter.expectedCloseDate.$gte = filter.expectedCloseAfter;
        if (filter.expectedCloseBefore) queryFilter.expectedCloseDate.$lte = filter.expectedCloseBefore;
      }

      if (filter.search) {
        queryFilter.$or = [
          { name: { $regex: filter.search, $options: 'i' } },
          { description: { $regex: filter.search, $options: 'i' } },
        ];
      }
    }

    return this.findMany({ filter: queryFilter, pagination }, tenantId);
  }

  async findByAccount(accountId: string, tenantId: string): Promise<Opportunity[]> {
    return this.findAll(tenantId, { accountId } as Filter<Opportunity>);
  }

  async findByOwner(ownerId: string, tenantId: string): Promise<Opportunity[]> {
    return this.findAll(tenantId, { ownerId } as Filter<Opportunity>);
  }

  async findByStage(stageId: string, tenantId: string): Promise<Opportunity[]> {
    return this.findAll(tenantId, { stageId } as Filter<Opportunity>);
  }

  async moveStage(
    id: string,
    tenantId: string,
    stageId: string,
    probability?: number,
    userId?: string
  ): Promise<Opportunity | null> {
    const collection = this.getCollection();
    const _id = new ObjectId(id);

    // Adicionar ao timeline
    const timelineEntry: OpportunityTimeline = {
      date: new Date(),
      stageId,
      amount: 0, // Será preenchido se necessário
      notes: null,
    };

    const updateDoc: Record<string, unknown> = {
      $set: {
        stageId,
        updatedAt: new Date(),
        updatedBy: userId,
      },
      $push: { timeline: timelineEntry },
    };

    if (probability !== undefined) {
      (updateDoc.$set as Record<string, unknown>).probability = probability;
    }

    const result = await collection.findOneAndUpdate(
      { _id, tenantId, deletedAt: null } as Filter<Opportunity>,
      updateDoc,
      { returnDocument: 'after' }
    );

    return result;
  }

  async close(
    id: string,
    tenantId: string,
    status: OpportunityStatus.WON | OpportunityStatus.LOST,
    userId?: string,
    _reason?: string
  ): Promise<Opportunity | null> {
    const collection = this.getCollection();
    const _id = new ObjectId(id);

    const updateDoc = {
      $set: {
        status,
        actualCloseDate: new Date(),
        updatedAt: new Date(),
        updatedBy: userId,
      },
    };

    const result = await collection.findOneAndUpdate(
      { _id, tenantId, deletedAt: null, status: OpportunityStatus.OPEN } as Filter<Opportunity>,
      updateDoc,
      { returnDocument: 'after' }
    );

    return result;
  }

  async getPipelineStats(tenantId: string): Promise<{
    byStage: Array<{ stageId: string; count: number; totalAmount: number }>;
    totalOpen: number;
    totalValue: number;
    wonValue: number;
    lostValue: number;
  }> {
    const collection = this.getCollection();

    const [byStage, totals] = await Promise.all([
      collection
        .aggregate([
          {
            $match: {
              tenantId,
              deletedAt: null,
              status: OpportunityStatus.OPEN,
            },
          },
          {
            $group: {
              _id: '$stageId',
              count: { $sum: 1 },
              totalAmount: { $sum: '$amount' },
            },
          },
        ])
        .toArray(),
      collection
        .aggregate([
          { $match: { tenantId, deletedAt: null } },
          {
            $group: {
              _id: '$status',
              count: { $sum: 1 },
              total: { $sum: '$amount' },
            },
          },
        ])
        .toArray(),
    ]);

    const stats = {
      byStage: byStage.map((s) => ({
        stageId: s._id,
        count: s.count,
        totalAmount: s.totalAmount,
      })),
      totalOpen: 0,
      totalValue: 0,
      wonValue: 0,
      lostValue: 0,
    };

    for (const t of totals) {
      if (t._id === OpportunityStatus.OPEN) {
        stats.totalOpen = t.count;
        stats.totalValue = t.total;
      } else if (t._id === OpportunityStatus.WON) {
        stats.wonValue = t.total;
      } else if (t._id === OpportunityStatus.LOST) {
        stats.lostValue = t.total;
      }
    }

    return stats;
  }
}

export const opportunityRepository = new OpportunityRepository();
