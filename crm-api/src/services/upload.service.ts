// =============================================================================
// File Upload Service - S3 and Local Storage Support
// =============================================================================

import { S3Client, PutObjectCommand, GetObjectCommand, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { config, isDevelopment } from '@/config/index.js';
import { logger } from '@/infrastructure/logging/index.js';
import { ObjectId } from 'mongodb';
import * as fs from 'fs';
import * as path from 'path';

// =============================================================================
// Types
// =============================================================================

export interface UploadOptions {
  file: FileData;
  tenantId: string;
  userId: string;
  relatedToType?: 'LEAD' | 'CONTACT' | 'ACCOUNT' | 'OPPORTUNITY';
  relatedToId?: string;
  folder?: string;
}

export interface FileData {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
}

export interface UploadResult {
  id: string;
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  key: string;
}

export interface StorageProvider {
  upload(key: string, file: FileData): Promise<string>;
  delete(key: string): Promise<boolean>;
  getUrl(key: string): string;
}

// Allowed file types
const ALLOWED_MIME_TYPES = [
  // Images
  'image/jpeg',
  'image/png',
  'image/gif',
  'image/webp',
  // Documents
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'text/plain',
  'text/csv',
  // Archives
  'application/zip',
  'application/x-rar-compressed',
];

const MAX_FILE_SIZE = parseInt(process.env.MAX_FILE_SIZE || '10485760', 10); // 10MB default

// =============================================================================
// Local Storage Provider (Development)
// =============================================================================

class LocalStorageProvider implements StorageProvider {
  private uploadDir: string;

  constructor() {
    this.uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');
    this.ensureUploadDir();
  }

  private ensureUploadDir(): void {
    if (!fs.existsSync(this.uploadDir)) {
      fs.mkdirSync(this.uploadDir, { recursive: true });
    }
  }

  async upload(key: string, file: FileData): Promise<string> {
    const filePath = path.join(this.uploadDir, key);
    const dir = path.dirname(filePath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    await fs.promises.writeFile(filePath, file.buffer);

    return `/uploads/${key}`;
  }

  async delete(key: string): Promise<boolean> {
    const filePath = path.join(this.uploadDir, key);

    try {
      if (fs.existsSync(filePath)) {
        await fs.promises.unlink(filePath);
      }
      return true;
    } catch {
      return false;
    }
  }

  getUrl(key: string): string {
    return `/uploads/${key}`;
  }
}

// =============================================================================
// S3 Storage Provider (Production)
// =============================================================================

class S3StorageProvider implements StorageProvider {
  private client: S3Client;
  private bucket: string;
  private region: string;

  constructor() {
    this.region = process.env.AWS_REGION || 'us-east-1';
    this.bucket = process.env.AWS_S3_BUCKET || '';

    this.client = new S3Client({
      region: this.region,
      credentials: {
        accessKeyId: process.env.AWS_ACCESS_KEY_ID || '',
        secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY || '',
      },
    });
  }

  async upload(key: string, file: FileData): Promise<string> {
    const command = new PutObjectCommand({
      Bucket: this.bucket,
      Key: key,
      Body: file.buffer,
      ContentType: file.mimetype,
      ContentDisposition: `attachment; filename="${file.originalname}"`,
    });

    await this.client.send(command);

    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async delete(key: string): Promise<boolean> {
    try {
      const command = new DeleteObjectCommand({
        Bucket: this.bucket,
        Key: key,
      });

      await this.client.send(command);
      return true;
    } catch {
      return false;
    }
  }

  getUrl(key: string): string {
    return `https://${this.bucket}.s3.${this.region}.amazonaws.com/${key}`;
  }

  async getSignedUrl(key: string, expiresIn: number = 3600): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: this.bucket,
      Key: key,
    });

    return getSignedUrl(this.client, command, { expiresIn });
  }
}

// =============================================================================
// Upload Service
// =============================================================================

export class UploadService {
  private provider: StorageProvider;

  constructor() {
    this.provider = this.createProvider();
  }

  private createProvider(): StorageProvider {
    const storageType = process.env.STORAGE_TYPE || (isDevelopment ? 'local' : 's3');

    if (storageType === 's3') {
      logger.info('Using S3 storage provider');
      return new S3StorageProvider();
    }

    logger.info('Using local storage provider');
    return new LocalStorageProvider();
  }

  /**
   * Validate file before upload
   */
  private validate(file: FileData): { valid: boolean; error?: string } {
    // Check file size
    if (file.size > MAX_FILE_SIZE) {
      return {
        valid: false,
        error: `File size exceeds limit. Maximum: ${MAX_FILE_SIZE / 1024 / 1024}MB`,
      };
    }

    // Check mime type
    if (!ALLOWED_MIME_TYPES.includes(file.mimetype)) {
      return {
        valid: false,
        error: `File type not allowed: ${file.mimetype}`,
      };
    }

    return { valid: true };
  }

  /**
   * Generate unique filename
   */
  private generateKey(
    tenantId: string,
    originalName: string,
    folder?: string
  ): string {
    const ext = path.extname(originalName);
    const id = new ObjectId().toHexString();
    const timestamp = Date.now();

    const parts = [tenantId];
    if (folder) parts.push(folder);
    parts.push(`${timestamp}-${id}${ext}`);

    return parts.join('/');
  }

  /**
   * Upload a file
   */
  async upload(options: UploadOptions): Promise<UploadResult> {
    const { file, tenantId, userId, relatedToType, relatedToId, folder } = options;

    // Validate
    const validation = this.validate(file);
    if (!validation.valid) {
      throw new Error(validation.error);
    }

    // Generate key
    const key = this.generateKey(tenantId, file.originalname, folder);

    // Upload
    const url = await this.provider.upload(key, file);

    logger.info('File uploaded', {
      key,
      tenantId,
      userId,
      size: file.size,
      mimeType: file.mimetype,
    });

    return {
      id: new ObjectId().toHexString(),
      fileName: path.basename(key),
      originalName: file.originalname,
      mimeType: file.mimetype,
      size: file.size,
      url,
      key,
    };
  }

  /**
   * Delete a file
   */
  async delete(key: string, tenantId: string): Promise<boolean> {
    // Security: verify key starts with tenantId
    if (!key.startsWith(tenantId)) {
      logger.warn('Attempted to delete file from different tenant', { key, tenantId });
      return false;
    }

    const result = await this.provider.delete(key);

    if (result) {
      logger.info('File deleted', { key, tenantId });
    }

    return result;
  }

  /**
   * Get URL for a file
   */
  getUrl(key: string): string {
    return this.provider.getUrl(key);
  }

  /**
   * Upload avatar image with resizing info
   */
  async uploadAvatar(
    file: FileData,
    tenantId: string,
    userId: string
  ): Promise<UploadResult> {
    // For production, you'd use Sharp to resize:
    // const resized = await sharp(file.buffer)
    //   .resize(200, 200, { fit: 'cover' })
    //   .jpeg({ quality: 85 })
    //   .toBuffer();

    return this.upload({
      file,
      tenantId,
      userId,
      folder: 'avatars',
    });
  }

  /**
   * Upload document attachment
   */
  async uploadAttachment(
    file: FileData,
    tenantId: string,
    userId: string,
    relatedToType: 'LEAD' | 'CONTACT' | 'ACCOUNT' | 'OPPORTUNITY',
    relatedToId: string
  ): Promise<UploadResult> {
    return this.upload({
      file,
      tenantId,
      userId,
      relatedToType,
      relatedToId,
      folder: `attachments/${relatedToType.toLowerCase()}`,
    });
  }
}

// Singleton export
export const uploadService = new UploadService();
