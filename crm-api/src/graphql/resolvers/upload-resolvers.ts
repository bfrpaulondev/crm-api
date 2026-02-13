// =============================================================================
// Upload Resolvers
// =============================================================================

import { builder } from '../builder.js';
import { uploadService } from '@/services/upload.service.js';
import { Errors } from '@/types/errors.js';

// =============================================================================
// Types
// =============================================================================

const AttachmentType = builder.objectRef<import('@/types/entities.js').Attachment>('Attachment');

AttachmentType.implement({
  fields: (t) => ({
    id: t.field({
      type: 'String',
      nullable: false,
      resolve: (att) => att._id.toHexString(),
    }),
    tenantId: t.exposeString('tenantId', { nullable: false }),
    fileName: t.exposeString('fileName', { nullable: false }),
    originalName: t.exposeString('originalName', { nullable: false }),
    mimeType: t.exposeString('mimeType', { nullable: false }),
    size: t.exposeInt('size', { nullable: false }),
    url: t.exposeString('url', { nullable: false }),
    relatedToType: t.exposeString('relatedToType', { nullable: false }),
    relatedToId: t.exposeString('relatedToId', { nullable: false }),
    uploadedBy: t.exposeString('uploadedBy', { nullable: false }),
    createdAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (att) => att.createdAt,
    }),
  }),
});

const UploadResultType = builder.simpleObject('UploadResult', {
  fields: (t) => ({
    id: t.string({ nullable: false }),
    fileName: t.string({ nullable: false }),
    originalName: t.string({ nullable: false }),
    mimeType: t.string({ nullable: false }),
    size: t.int({ nullable: false }),
    url: t.string({ nullable: false }),
    key: t.string({ nullable: false }),
  }),
});

// =============================================================================
// Upload Mutation (using base64 for simplicity)
// In production, you'd use multipart upload
// =============================================================================

builder.mutationType({
  fields: (t) => ({
    // Upload file (base64 encoded)
    uploadFile: t.field({
      type: UploadResultType,
      nullable: false,
      args: {
        fileName: t.arg.string({ required: true }),
        mimeType: t.arg.string({ required: true }),
        base64Data: t.arg.string({ required: true }),
        relatedToType: t.arg.string({ required: true }),
        relatedToId: t.arg.string({ required: true }),
      },
      authScopes: { authenticated: true },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        // Check permission based on related entity
        const permissionMap: Record<string, string> = {
          LEAD: 'LEAD_UPDATE',
          CONTACT: 'CONTACT_UPDATE',
          ACCOUNT: 'ACCOUNT_UPDATE',
          OPPORTUNITY: 'OPPORTUNITY_UPDATE',
        };

        const requiredPermission = permissionMap[args.relatedToType];
        if (requiredPermission && !ctx.hasPermission(requiredPermission as any)) {
          throw Errors.insufficientPermissions(requiredPermission);
        }

        // Decode base64
        const buffer = Buffer.from(args.base64Data, 'base64');

        const result = await uploadService.uploadAttachment(
          {
            originalname: args.fileName,
            mimetype: args.mimeType,
            size: buffer.length,
            buffer,
          },
          ctx.tenant.id,
          ctx.user.id,
          args.relatedToType as any,
          args.relatedToId
        );

        // Save attachment metadata to DB
        const db = (await import('@/infrastructure/mongo/connection.js')).getDb();
        const { ObjectId } = await import('mongodb');

        await db.collection('attachments').insertOne({
          _id: new ObjectId(result.id),
          tenantId: ctx.tenant.id,
          fileName: result.fileName,
          originalName: result.originalName,
          mimeType: result.mimeType,
          size: result.size,
          url: result.url,
          relatedToType: args.relatedToType,
          relatedToId: args.relatedToId,
          uploadedBy: ctx.user.id,
          createdAt: new Date(),
        });

        return result;
      },
    }),

    // Upload avatar
    uploadAvatar: t.field({
      type: UploadResultType,
      nullable: false,
      args: {
        fileName: t.arg.string({ required: true }),
        mimeType: t.arg.string({ required: true }),
        base64Data: t.arg.string({ required: true }),
      },
      authScopes: { authenticated: true },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        const buffer = Buffer.from(args.base64Data, 'base64');

        return uploadService.uploadAvatar(
          {
            originalname: args.fileName,
            mimetype: args.mimeType,
            size: buffer.length,
            buffer,
          },
          ctx.tenant.id,
          ctx.user.id
        );
      },
    }),

    // Delete file
    deleteFile: t.field({
      type: 'Boolean',
      nullable: false,
      args: {
        key: t.arg.string({ required: true }),
      },
      authScopes: { authenticated: true },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        return uploadService.delete(args.key, ctx.tenant.id);
      },
    }),
  }),
});

// =============================================================================
// Attachment Queries
// =============================================================================

builder.queryType({
  fields: (t) => ({
    // Get attachments for entity
    attachments: t.field({
      type: [AttachmentType],
      nullable: false,
      args: {
        relatedToType: t.arg.string({ required: true }),
        relatedToId: t.arg.string({ required: true }),
      },
      authScopes: { authenticated: true },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        const db = (await import('@/infrastructure/mongo/connection.js')).getDb();

        return db
          .collection('attachments')
          .find({
            tenantId: ctx.tenant.id,
            relatedToType: args.relatedToType,
            relatedToId: args.relatedToId,
          })
          .sort({ createdAt: -1 })
          .toArray();
      },
    }),
  }),
});

export { AttachmentType, UploadResultType };
