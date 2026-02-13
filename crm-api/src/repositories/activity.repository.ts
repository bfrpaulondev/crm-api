// =============================================================================
// Activity Repository
// =============================================================================

import { BaseRepository, PaginatedResult } from './base.repository.js';
import { Activity, ActivityType, ActivityStatus, Note } from '@/types/entities.js';
import { Filter, ObjectId, Db } from 'mongodb';
import { ActivityFilter } from '@/types/validation.js';
import { getDb } from '@/infrastructure/mongo/connection.js';

export class ActivityRepository extends BaseRepository<Activity> {
  protected collectionName = 'activities';

  async findWithFilters(
    tenantId: string,
    filter?: ActivityFilter,
    pagination?: { limit?: number; cursor?: string }
  ): Promise<PaginatedResult<Activity>> {
    const queryFilter: Filter<Activity> = {};

    if (filter) {
      if (filter.type) queryFilter.type = filter.type;
      if (filter.status) queryFilter.status = filter.status;
      if (filter.priority) queryFilter.priority = filter.priority;
      if (filter.ownerId) queryFilter.ownerId = filter.ownerId;
      if (filter.relatedToType) queryFilter.relatedToType = filter.relatedToType;
      if (filter.relatedToId) queryFilter.relatedToId = filter.relatedToId;

      if (filter.dueAfter || filter.dueBefore) {
        queryFilter.dueDate = {};
        if (filter.dueAfter) queryFilter.dueDate.$gte = filter.dueAfter;
        if (filter.dueBefore) queryFilter.dueDate.$lte = filter.dueBefore;
      }
    }

    return this.findMany({ filter: queryFilter, pagination }, tenantId);
  }

  async findByRelatedTo(
    tenantId: string,
    relatedToType: string,
    relatedToId: string
  ): Promise<Activity[]> {
    return this.findAll(tenantId, {
      relatedToType,
      relatedToId,
    } as Filter<Activity>);
  }

  async findByOwner(ownerId: string, tenantId: string): Promise<Activity[]> {
    return this.findAll(tenantId, { ownerId } as Filter<Activity>);
  }

  async findUpcoming(
    tenantId: string,
    ownerId?: string,
    limit?: number
  ): Promise<Activity[]> {
    const collection = this.getCollection();

    const filter: Filter<Activity> = {
      tenantId,
      status: { $in: [ActivityStatus.PENDING, ActivityStatus.IN_PROGRESS] },
      dueDate: { $gte: new Date() },
      deletedAt: null,
    };

    if (ownerId) {
      filter.ownerId = ownerId;
    }

    return collection
      .find(filter)
      .sort({ dueDate: 1 })
      .limit(limit ?? 20)
      .toArray();
  }

  async complete(
    id: string,
    tenantId: string,
    outcome?: string,
    userId?: string
  ): Promise<Activity | null> {
    return this.updateById(
      id,
      tenantId,
      {
        status: ActivityStatus.COMPLETED,
        completedAt: new Date(),
        outcome: outcome ?? null,
      },
      userId
    );
  }

  async getStats(tenantId: string): Promise<{
    byType: Record<string, number>;
    byStatus: Record<string, number>;
    completedThisWeek: number;
  }> {
    const collection = this.getCollection();

    const oneWeekAgo = new Date();
    oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

    const [byType, byStatus, completedThisWeek] = await Promise.all([
      collection
        .aggregate([
          { $match: { tenantId, deletedAt: null } },
          { $group: { _id: '$type', count: { $sum: 1 } } },
        ])
        .toArray(),
      collection
        .aggregate([
          { $match: { tenantId, deletedAt: null } },
          { $group: { _id: '$status', count: { $sum: 1 } } },
        ])
        .toArray(),
      collection.countDocuments({
        tenantId,
        status: ActivityStatus.COMPLETED,
        completedAt: { $gte: oneWeekAgo },
        deletedAt: null,
      }),
    ]);

    const toRecord = (arr: Array<{ _id: string | null; count: number }>) =>
      arr.reduce((acc, { _id, count }) => {
        if (_id) acc[_id] = count;
        return acc;
      }, {} as Record<string, number>);

    return {
      byType: toRecord(byType),
      byStatus: toRecord(byStatus),
      completedThisWeek,
    };
  }

  // ==========================================================================
  // Notes (stored in separate collection but managed together)
  // ==========================================================================

  private notesCollectionName = 'notes';

  private getNotesCollection() {
    if (!this.db) {
      this.db = getDb();
    }
    return this.db.collection<Note>(this.notesCollectionName);
  }

  async createNote(data: {
    tenantId: string;
    body: string;
    visibility: string;
    relatedToType: string;
    relatedToId: string;
    createdBy: string;
  }): Promise<Note> {
    const collection = this.getNotesCollection();
    const now = new Date();

    const note: Note = {
      _id: new ObjectId(),
      tenantId: data.tenantId,
      body: data.body,
      visibility: data.visibility as Note['visibility'],
      relatedToType: data.relatedToType as Note['relatedToType'],
      relatedToId: data.relatedToId,
      createdBy: data.createdBy,
      createdAt: now,
      updatedAt: now,
    };

    await collection.insertOne(note);

    return note;
  }

  async findNotesByRelatedTo(
    tenantId: string,
    relatedToType: string,
    relatedToId: string
  ): Promise<Note[]> {
    const collection = this.getNotesCollection();

    return collection
      .find({
        tenantId,
        relatedToType,
        relatedToId,
      })
      .sort({ createdAt: -1 })
      .toArray();
  }

  async updateNote(
    id: string,
    tenantId: string,
    data: { body?: string; visibility?: string }
  ): Promise<Note | null> {
    const collection = this.getNotesCollection();
    const _id = new ObjectId(id);

    const result = await collection.findOneAndUpdate(
      { _id, tenantId },
      {
        $set: {
          ...data,
          updatedAt: new Date(),
        },
      },
      { returnDocument: 'after' }
    );

    return result;
  }

  async deleteNote(id: string, tenantId: string): Promise<boolean> {
    const collection = this.getNotesCollection();
    const _id = new ObjectId(id);

    const result = await collection.deleteOne({ _id, tenantId });

    return result.deletedCount > 0;
  }
}

export const activityRepository = new ActivityRepository();
