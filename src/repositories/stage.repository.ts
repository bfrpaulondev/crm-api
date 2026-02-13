// =============================================================================
// Stage Repository
// =============================================================================

import { BaseRepository } from './base.repository.js';
import { Stage } from '@/types/entities.js';
import { Filter, ObjectId, AnyBulkWriteOperation } from 'mongodb';

export class StageRepository extends BaseRepository<Stage> {
  protected collectionName = 'stages';

  async findActiveStages(tenantId: string): Promise<Stage[]> {
    const collection = this.getCollection();

    return collection
      .find({
        tenantId,
        isActive: true,
        deletedAt: null,
      } as Filter<Stage>)
      .sort({ order: 1 })
      .toArray();
  }

  async findAllStages(tenantId: string): Promise<Stage[]> {
    return this.findAll(tenantId);
  }

  async findWonStage(tenantId: string): Promise<Stage | null> {
    return this.findOne({ isWonStage: true, isActive: true } as Filter<Stage>, tenantId);
  }

  async findLostStage(tenantId: string): Promise<Stage | null> {
    return this.findOne({ isLostStage: true, isActive: true } as Filter<Stage>, tenantId);
  }

  async findByOrder(tenantId: string, order: number): Promise<Stage | null> {
    return this.findOne({ order } as Filter<Stage>, tenantId);
  }

  async getNextStage(tenantId: string, currentOrder: number): Promise<Stage | null> {
    const collection = this.getCollection();

    return collection.findOne(
      {
        tenantId,
        order: { $gt: currentOrder },
        isActive: true,
        isWonStage: false,
        isLostStage: false,
        deletedAt: null,
      } as Filter<Stage>,
      { sort: { order: 1 } }
    );
  }

  async getPreviousStage(tenantId: string, currentOrder: number): Promise<Stage | null> {
    const collection = this.getCollection();

    return collection.findOne(
      {
        tenantId,
        order: { $lt: currentOrder },
        isActive: true,
        isWonStage: false,
        isLostStage: false,
        deletedAt: null,
      } as Filter<Stage>,
      { sort: { order: -1 } }
    );
  }

  async updateOrder(id: string, tenantId: string, order: number): Promise<Stage | null> {
    return this.updateById(id, tenantId, { order });
  }

  async reorderStages(tenantId: string, stageOrders: Array<{ id: string; order: number }>): Promise<void> {
    const collection = this.getCollection();

    const bulkOps: AnyBulkWriteOperation<Stage>[] = stageOrders.map(({ id, order }) => ({
      updateOne: {
        filter: { _id: new ObjectId(id), tenantId },
        update: { $set: { order, updatedAt: new Date() } },
      },
    }));

    if (bulkOps.length > 0) {
      await collection.bulkWrite(bulkOps);
    }
  }
}

export const stageRepository = new StageRepository();
