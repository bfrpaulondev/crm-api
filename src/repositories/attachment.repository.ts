// =============================================================================
// Attachment Repository - File Attachment Data Access
// =============================================================================

import { BaseRepository, PaginatedResult } from './base.repository.js';
import { Attachment, RelatedToType, StorageType, VirusScanStatus } from '@/types/entities.js';
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
   * Create attachment metadata
   */
  async createAttachment(data: {
    tenantId: string;
    fileName: string;
    originalName: string;
    mimeType: string;
    size: number;
    url: string;
    storageType: StorageType;
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
    } as Omit<Attachment, '_id' | 'createdAt' | 'updatedAt'>);
  }

  /**
   * Update virus scan status
   */
  async updateVirusScanStatus(
    attachmentId: string,
    tenantId: string,
    status: VirusScanStatus
  ): Promise<Attachment | null> {
    return this.updateById(attachmentId, tenantId, {
      metadata: {
        virusScanStatus: status,
        virusScannedAt: new Date(),
      },
    } as Partial<Attachment>);
  }

  /**
   * Get recent attachments
   */
  async getRecent(tenantId: string, limit: number = 10): Promise<Attachment[]> {
    const collection = this.getCollection();

    const result = await collection
      .find({
        tenantId,
        deletedAt: null,
      })
      .sort({ createdAt: -1 })
      .limit(limit)
      .toArray();

    return result as Attachment[];
  }
}

// Singleton export
export const attachmentRepository = new AttachmentRepository();
