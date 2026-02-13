// =============================================================================
// Upload Resolvers
// =============================================================================

import { builder } from '../schema/builder.js';
import { uploadService } from '@/services/upload.service.js';
import { GraphQLContext } from '@/types/context.js';

// =============================================================================
// Types
// =============================================================================

const AttachmentType = builder.simpleObject('Attachment', {
  fields: (t) => ({
    id: t.string({ nullable: false }),
    filename: t.string({ nullable: false }),
    mimeType: t.string({ nullable: false }),
    size: t.int({ nullable: false }),
    url: t.string({ nullable: false }),
  }),
});

const UploadResult = builder.simpleObject('UploadResult', {
  fields: (t) => ({
    id: t.string({ nullable: false }),
    filename: t.string({ nullable: false }),
    mimeType: t.string({ nullable: false }),
    size: t.int({ nullable: false }),
    url: t.string({ nullable: false }),
  }),
});

// =============================================================================
// Mutations
// =============================================================================

builder.mutationFields((t) => ({
  uploadFile: t.field({
    type: UploadResult,
    nullable: false,
    args: {
      file: t.arg.string({ required: true }),
      relatedToType: t.arg.string({ required: false }),
      relatedToId: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      if (!ctx.tenant || !ctx.user) {
        throw new Error('Authentication required');
      }

      const result = await uploadService.uploadFile(
        ctx.tenant.id,
        ctx.user.id,
        {
          filename: args.file,
          mimetype: 'application/octet-stream',
          data: Buffer.from(''),
        },
        args.relatedToType ?? undefined,
        args.relatedToId ?? undefined
      );

      return result;
    },
  }),

  deleteAttachment: t.field({
    type: 'Boolean',
    nullable: false,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      if (!ctx.tenant) {
        throw new Error('Tenant required');
      }

      return uploadService.deleteFile(args.id, ctx.tenant.id);
    },
  }),
}));
