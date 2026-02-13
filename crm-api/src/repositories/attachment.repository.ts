// =============================================================================
// Attachment Repository - File Attachment Data Access
// =============================================================================

import { BaseRepository, PaginatedResult, FindManyOptions } from './base.repository.js';
import { Attachment, RelatedToType } from '@/types/entities.js';
import { Filter, ObjectId } from 'mongodb';
import { logger } from '@/infrastructure/logging/index.js';

export interface AttachmentFilter {
  relatedToType?: RelatedToType;
  relatedToId?: string;
  uploadedBy?: string;
  mimeType?: string;
  isAvatar?: boolean;
  mimeTypeGroup?: 'image' | 'document' | 'spreadsheet' | 'other';
}

export interface AttachmentListOptions {
  filter?: AttachmentFilter;
  pagination?: {
    limit?: number;
    cursor?: string;
  };
  sort?: {
    field: 'createdAt' | 'fileName' | 'size';
    direction: 1 | -1;
  };
}

export class AttachmentRepository extends BaseRepository<Attachment> {
  protected collectionName = 'attachments';

  // ===========================================================================
  // Specialized Queries
  // ===========================================================================

  /**
   * Find attachments by related entity
   */
  async findByRelatedEntity(
    relatedToType: RelatedToType,
    relatedToId: string,
    tenantId: string
  ): Promise<Attachment[]> {
    return this.findAll(tenantId, {
      relatedToType,
      relatedToId,
    } as Filter<Attachment>);
  }

  /**
   * Find avatar for an entity
   */
  async findAvatar(
    relatedToType: RelatedToType,
    relatedToId: string,
    tenantId: string
  ): Promise<Attachment | null> {
    return this.findOne(
      {
        relatedToType,
        relatedToId,
        isAvatar: true,
      } as Filter<Attachment>,
      tenantId
    );
  }

  /**
   * Find attachments by MIME type group
   */
  async findByMimeTypeGroup(
    mimeTypeGroup: 'image' | 'document' | 'spreadsheet' | 'other',
    tenantId: string,
    limit?: number
  ): Promise<Attachment[]> {
    const collection = this.getCollection();

    let mimeTypeRegex: RegExp;
    switch (mimeTypeGroup) {
      case 'image':
        mimeTypeRegex = /^image\//;
        break;
      case 'document':
        mimeTypeRegex = /^application\/(pdf|msword|vnd\.openxmlformats)/;
        break;
      case 'spreadsheet':
        mimeTypeRegex = /^application\/(vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml)/;
        break;
      default:
        mimeTypeRegex = /^(?!image\/|application\/pdf|application\/msword|application\/vnd\.openxmlformats|application\/vnd\.ms-excel)/;
    }

    const query = {
      tenantId,
      mimeType: mimeTypeRegex,
      deletedAt: null,
    };

    const cursor = collection.find(query).sort({ createdAt: -1 });

    if (limit) {
      cursor.limit(limit);
    }

    return cursor.toArray();
  }

  /**
   * List attachments with pagination and filtering
   */
  async listWithFilters(
    tenantId: string,
    options: AttachmentListOptions
  ): Promise<PaginatedResult<Attachment>> {
    const { filter = {}, pagination = {}, sort = { field: 'createdAt', direction: -1 } } = options;

    const queryFilter: Filter<Attachment> = {};

    if (filter.relatedToType) {
      queryFilter.relatedToType = filter.relatedToType;
    }

    if (filter.relatedToId) {
      queryFilter.relatedToId = filter.relatedToId;
    }

    if (filter.uploadedBy) {
      queryFilter.uploadedBy = filter.uploadedBy;
    }

    if (filter.mimeType) {
      queryFilter.mimeType = filter.mimeType;
    }

    if (filter.isAvatar !== undefined) {
      queryFilter.isAvatar = filter.isAvatar;
    }

    if (filter.mimeTypeGroup) {
      switch (filter.mimeTypeGroup) {
        case 'image':
          queryFilter.mimeType = { $regex: /^image\// };
          break;
        case 'document':
          queryFilter.mimeType = { $regex: /^application\/(pdf|msword|vnd\.openxmlformats)/ };
          break;
        case 'spreadsheet':
          queryFilter.mimeType = { $regex: /^application\/(vnd\.ms-excel|vnd\.openxmlformats-officedocument\.spreadsheetml)/ };
          break;
      }
    }

    const sortDirection = sort.direction === 1 ? 1 : -1;
    const sortObj = { [sort.field]: sortDirection };

    return this.findMany(
      {
        filter: queryFilter,
        pagination,
        sort: sortObj,
      },
      tenantId
    );
  }

  // ===========================================================================
  // Attachment-specific Operations
  // ===========================================================================

  /**
   * Create attachment metadata
   */
  async createAttachment(data: {
    tenantId: string;
    fileName: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    storageType: 'LOCAL' | 'S3';
    storageKey: string;
    relatedToType: RelatedToType;
    relatedToId: string;
    uploadedBy: string;
    description?: string;
    isAvatar?: boolean;
    metadata?: Attachment['metadata'];
  }): Promise<Attachment> {
    return this.create({
      ...data,
      description: data.description ?? null,
      isAvatar: data.isAvatar ?? false,
      metadata: data.metadata ?? null,
      createdBy: data.uploadedBy,
    });
  }

  /**
   * Set avatar for an entity (unsets other avatars for same entity)
   */
  async setAvatar(
    attachmentId: string,
    tenantId: string,
    userId?: string
  ): Promise<Attachment | null> {
    const collection = this.getCollection();
    const _id = new ObjectId(attachmentId);

    // First get the attachment to know the related entity
    const attachment = await this.findById(attachmentId, tenantId);
    if (!attachment) {
      return null;
    }

    // Unset all other avatars for the same entity
    await collection.updateMany(
      {
        tenantId,
        relatedToType: attachment.relatedToType,
        relatedToId: attachment.relatedToId,
        isAvatar: true,
        _id: { $ne: _id },
        deletedAt: null,
      } as Filter<Attachment>,
      {
        $set: {
          isAvatar: false,
          updatedAt: new Date(),
          updatedBy: userId,
        },
      }
    );

    // Set this attachment as avatar
    return this.updateById(attachmentId, tenantId, { isAvatar: true }, userId);
  }

  /**
   * Unset avatar status for an attachment
   */
  async unsetAvatar(
    attachmentId: string,
    tenantId: string,
    userId?: string
  ): Promise<Attachment | null> {
    return this.updateById(attachmentId, tenantId, { isAvatar: false }, userId);
  }

  /**
   * Update virus scan status
   */
  async updateVirusScanStatus(
    attachmentId: string,
    tenantId: string,
    status: 'PENDING' | 'CLEAN' | 'INFECTED' | 'ERROR'
  ): Promise<Attachment | null> {
    return this.updateById(attachmentId, tenantId, {
      metadata: {
        virusScanStatus: status,
        virusScannedAt: new Date(),
      },
    });
  }

  /**
   * Update description
   */
  async updateDescription(
    attachmentId: string,
    tenantId: string,
    description: string,
    userId?: string
  ): Promise<Attachment | null> {
    return this.updateById(attachmentId, tenantId, { description }, userId);
  }

  /**
   * Soft delete attachment
   */
  async deleteAttachment(
    attachmentId: string,
    tenantId: string,
    userId?: string
  ): Promise<boolean> {
    return this.deleteById(attachmentId, tenantId, userId);
  }

  /**
   * Hard delete attachments by related entity (use with caution!)
   */
  async hardDeleteByRelatedEntity(
    relatedToType: RelatedToType,
    relatedToId: string,
    tenantId: string
  ): Promise<number> {
    const collection = this.getCollection();

    const result = await collection.deleteMany({
      tenantId,
      relatedToType,
      relatedToId,
    } as Filter<Attachment>);

    logger.warn('Hard deleted attachments by related entity', {
      relatedToType,
      relatedToId,
      count: result.deletedCount,
      tenantId,
    });

    return result.deletedCount;
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  /**
   * Get storage statistics for tenant
   */
  async getStorageStats(tenantId: string): Promise<{
    totalFiles: number;
    totalSize: number;
    byType: Record<string, { count: number; size: number }>;
    byEntity: Record<string, number>;
  }> {
    const collection = this.getCollection();

    // Total count and size
    const totalPipeline = [
      { $match: { tenantId, deletedAt: null } },
      {
        $group: {
          _id: null,
          totalFiles: { $sum: 1 },
          totalSize: { $sum: '$size' },
        },
      },
    ];

    const totalResult = await collection.aggregate(totalPipeline).toArray();
    const { totalFiles = 0, totalSize = 0 } = totalResult[0] || {};

    // By MIME type group
    const byTypePipeline = [
      { $match: { tenantId, deletedAt: null } },
      {
        $project: {
          mimeType: 1,
          size: 1,
          typeGroup: {
            $switch: {
              branches: [
                { case: { $regexMatch: { input: '$mimeType', regex: /^image\// } }, then: 'image' },
                { case: { $regexMatch: { input: '$mimeType', regex: /^video\// } }, then: 'video' },
                { case: { $regexMatch: { input: '$mimeType', regex: /^audio\// } }, then: 'audio' },
                { case: { $eq: ['$mimeType', 'application/pdf'] }, then: 'pdf' },
                {
                  case: {
                    $regexMatch: {
                      input: '$mimeType',
                      regex: /^application\/vnd\.openxmlformats-officedocument/,
                    },
                  },
                  then: 'office',
                },
                { case: { $regexMatch: { input: '$mimeType', regex: /^text\// } }, then: 'text' },
              ],
              default: 'other',
            },
          },
        },
      },
      {
        $group: {
          _id: '$typeGroup',
          count: { $sum: 1 },
          size: { $sum: '$size' },
        },
      },
    ];

    const byTypeResult = await collection.aggregate(byTypePipeline).toArray();
    const byType: Record<string, { count: number; size: number }> = {};
    for (const result of byTypeResult) {
      byType[result._id] = {
        count: result.count,
        size: result.size,
      };
    }

    // By related entity type
    const byEntityPipeline = [
      { $match: { tenantId, deletedAt: null } },
      {
        $group: {
          _id: '$relatedToType',
          count: { $sum: 1 },
        },
      },
    ];

    const byEntityResult = await collection.aggregate(byEntityPipeline).toArray();
    const byEntity: Record<string, number> = {};
    for (const result of byEntityResult) {
      byEntity[result._id] = result.count;
    }

    return {
      totalFiles,
      totalSize,
      byType,
      byEntity,
    };
  }

  /**
   * Get recent attachments
   */
  async getRecent(tenantId: string, limit: number = 10): Promise<Attachment[]> {
    const collection = this.getCollection();

    return collection
      .find({
        tenantId,
        deletedAt: null,
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();
  }
}

// Singleton export
export const attachmentRepository = new AttachmentRepository();
