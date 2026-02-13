// =============================================================================
// Activity Repository
// =============================================================================

import { BaseRepository, PaginatedResult } from './base.repository.js';
import { Activity, ActivityStatus, Note, NoteVisibility } from '@/types/entities.js';
import { Filter, ObjectId } from 'mongodb';
import { ActivityFilter } from '@/types/validation.js';
import { getDb } from '@/infrastructure/mongo/connection.js';

export class ActivityRepository extends BaseRepository<Activity> {
  protected collectionName = 'activities';

  async findWithFilters(
    tenantId: string,
    filter?: ActivityFilter,
    pagination?: { limit?: number; cursor?: string }
  ): Promise<PaginatedResult<Activity>> {
    const queryFilter: Record<string, unknown> = {};

    if (filter) {
      if (filter.type) queryFilter.type = filter.type;
      if (filter.status) queryFilter.status = filter.status;
      if (filter.priority) queryFilter.priority = filter.priority;
      if (filter.ownerId) queryFilter.ownerId = filter.ownerId;
      if (filter.relatedToType) queryFilter.relatedToType = filter.relatedToType;
      if (filter.relatedToId) queryFilter.relatedToId = filter.relatedToId;

      if (filter.dueAfter || filter.dueBefore) {
        const dateFilter: Record<string, unknown> = {};
        if (filter.dueAfter) dateFilter.$gte = filter.dueAfter;
        if (filter.dueBefore) dateFilter.$lte = filter.dueBefore;
        queryFilter.dueDate = dateFilter;
      }
    }

    return this.findMany({ filter: queryFilter as Filter<Activity>, pagination }, tenantId);
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

    const filter: Record<string, unknown> = {
      tenantId,
      status: { $in: [ActivityStatus.PENDING, ActivityStatus.IN_PROGRESS] },
      dueDate: { $gte: new Date() },
      deletedAt: null,
    };

    if (ownerId) {
      filter.ownerId = ownerId;
    }

    const result = await collection
      .find(filter)
      .sort({ dueDate: 1 })
      .limit(limit ?? 20)
      .toArray();

    return result as Activity[];
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

    const [byTypeResult, byStatusResult, completedThisWeek] = await Promise.all([
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

    const byType: Record<string, number> = {};
    for (const item of byTypeResult) {
      byType[String(item._id)] = item.count;
    }

    const byStatus: Record<string, number> = {};
    for (const item of byStatusResult) {
      byStatus[String(item._id)] = item.count;
    }

    return { byType, byStatus, completedThisWeek };
  }

  // ==========================================================================
  // Notes
  // ==========================================================================

  private notesCollectionName = 'notes';

  private getNotesCollection() {
    const db = getDb();
    return db.collection<Note>(this.notesCollectionName);
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
      visibility: data.visibility as NoteVisibility,
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
        relatedToType: relatedToType as Note['relatedToType'],
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

    const updateData: Record<string, unknown> = {
      updatedAt: new Date(),
    };
    if (data.body) updateData.body = data.body;
    if (data.visibility) updateData.visibility = data.visibility as NoteVisibility;

    const result = await collection.findOneAndUpdate(
      { _id, tenantId },
      { $set: updateData },
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
