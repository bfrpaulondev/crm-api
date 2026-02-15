// =============================================================================
// GraphQL Mutations
// =============================================================================

import { builder } from '../schema/builder.js';
import { leadService } from '@/services/lead.service.js';
import { webhookService } from '@/services/webhook.service.js';
import { activityRepository } from '@/repositories/activity.repository.js';
import { userRepository } from '@/repositories/user.repository.js';
import { userService } from '@/services/user.service.js';
import { GraphQLContext } from '@/types/context.js';
import { ActivityType, ActivityStatus, ActivityPriority } from '@/types/entities.js';

// =============================================================================
// Result Types
// =============================================================================

const CreateLeadResult = builder.simpleObject('CreateLeadResult', {
  fields: (t) => ({
    id: t.string({ nullable: false }),
    email: t.string({ nullable: false }),
    status: t.string({ nullable: false }),
  }),
});

const UpdateLeadResult = builder.simpleObject('UpdateLeadResult', {
  fields: (t) => ({
    id: t.string({ nullable: false }),
    firstName: t.string({ nullable: false }),
    lastName: t.string({ nullable: false }),
    email: t.string({ nullable: false }),
    status: t.string({ nullable: false }),
  }),
});

const QualifyLeadResult = builder.simpleObject('QualifyLeadResult', {
  fields: (t) => ({
    id: t.string({ nullable: false }),
    status: t.string({ nullable: false }),
  }),
});

const ConvertLeadResult = builder.simpleObject('ConvertLeadResult', {
  fields: (t) => ({
    leadId: t.string({ nullable: false }),
    accountId: t.string({ nullable: false }),
    contactId: t.string({ nullable: false }),
    opportunityId: t.string({ nullable: true }),
  }),
});

const WebhookResult = builder.simpleObject('WebhookResult', {
  fields: (t) => ({
    id: t.string({ nullable: false }),
    name: t.string({ nullable: false }),
    url: t.string({ nullable: false }),
    isActive: t.boolean({ nullable: false }),
  }),
});

const ActivityResult = builder.simpleObject('ActivityResult', {
  fields: (t) => ({
    id: t.string({ nullable: false }),
    subject: t.string({ nullable: false }),
    status: t.string({ nullable: false }),
  }),
});

const InviteUserResult = builder.simpleObject('InviteUserResult', {
  fields: (t) => ({
    id: t.string({ nullable: false }),
    email: t.string({ nullable: false }),
    firstName: t.string({ nullable: false }),
    lastName: t.string({ nullable: false }),
    role: t.string({ nullable: false }),
  }),
});

// =============================================================================
// Mutations
// =============================================================================

builder.mutationFields((t) => ({
  createLead: t.field({
    type: CreateLeadResult,
    args: {
      firstName: t.arg.string({ required: true }),
      lastName: t.arg.string({ required: true }),
      email: t.arg.string({ required: true }),
      phone: t.arg.string({ required: false }),
      companyName: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      if (!ctx.tenant || !ctx.user) {
        throw new Error('Authentication required');
      }

      const lead = await leadService.create(
        ctx.tenant.id,
        ctx.user.id,
        {
          firstName: args.firstName,
          lastName: args.lastName,
          email: args.email,
          phone: args.phone ?? null,
          companyName: args.companyName ?? null,
          tags: [],
        },
        ctx.requestId
      );

      return {
        id: lead._id.toHexString(),
        email: lead.email,
        status: lead.status,
      };
    },
  }),

  updateLead: t.field({
    type: UpdateLeadResult,
    args: {
      id: t.arg.string({ required: true }),
      firstName: t.arg.string({ required: false }),
      lastName: t.arg.string({ required: false }),
      email: t.arg.string({ required: false }),
      phone: t.arg.string({ required: false }),
      companyName: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      if (!ctx.tenant || !ctx.user) {
        throw new Error('Authentication required');
      }

      const updates: Record<string, unknown> = {};
      if (args.firstName) updates.firstName = args.firstName;
      if (args.lastName) updates.lastName = args.lastName;
      if (args.email) updates.email = args.email;
      if (args.phone !== undefined) updates.phone = args.phone;
      if (args.companyName !== undefined) updates.companyName = args.companyName;

      const lead = await leadService.update(
        args.id,
        ctx.tenant.id,
        ctx.user.id,
        updates,
        ctx.requestId
      );

      return {
        id: lead._id.toHexString(),
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        status: lead.status,
      };
    },
  }),

  qualifyLead: t.field({
    type: QualifyLeadResult,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      if (!ctx.tenant || !ctx.user) {
        throw new Error('Authentication required');
      }

      const lead = await leadService.qualify(args.id, ctx.tenant.id, ctx.user.id);

      return {
        id: lead._id.toHexString(),
        status: lead.status,
      };
    },
  }),

  convertLead: t.field({
    type: ConvertLeadResult,
    args: {
      leadId: t.arg.string({ required: true }),
      createOpportunity: t.arg.boolean({ required: false }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      if (!ctx.tenant || !ctx.user) {
        throw new Error('Authentication required');
      }

      const result = await leadService.convert(
        ctx.tenant.id,
        ctx.user.id,
        {
          leadId: args.leadId,
          createAccount: true,
          createOpportunity: args.createOpportunity ?? true,
        },
        ctx.requestId
      );

      return {
        leadId: result.lead._id.toHexString(),
        accountId: result.account._id.toHexString(),
        contactId: result.contact._id.toHexString(),
        opportunityId: result.opportunity?._id.toHexString() ?? null,
      };
    },
  }),

  deleteLead: t.field({
    type: 'Boolean',
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      if (!ctx.tenant || !ctx.user) {
        throw new Error('Authentication required');
      }

      return leadService.delete(args.id, ctx.tenant.id, ctx.user.id, ctx.requestId);
    },
  }),

  createWebhook: t.field({
    type: WebhookResult,
    args: {
      name: t.arg.string({ required: true }),
      url: t.arg.string({ required: true }),
      events: t.arg.stringList({ required: true }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      if (!ctx.tenant || !ctx.user) {
        throw new Error('Authentication required');
      }

      const webhook = await webhookService.create(ctx.tenant.id, ctx.user.id, {
        name: args.name,
        url: args.url,
        events: args.events as never[],
      });

      return {
        id: webhook._id.toHexString(),
        name: webhook.name,
        url: webhook.url,
        isActive: webhook.isActive,
      };
    },
  }),

  deleteWebhook: t.field({
    type: 'Boolean',
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      if (!ctx.tenant) {
        throw new Error('Tenant required');
      }

      return webhookService.delete(args.id, ctx.tenant.id);
    },
  }),

  // Activity Mutations
  createActivity: t.field({
    type: ActivityResult,
    args: {
      type: t.arg.string({ required: true }),
      subject: t.arg.string({ required: true }),
      description: t.arg.string({ required: false }),
      priority: t.arg.string({ required: false }),
      dueDate: t.arg.string({ required: false }),
      relatedToType: t.arg.string({ required: false }),
      relatedToId: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      if (!ctx.tenant || !ctx.user) {
        throw new Error('Authentication required');
      }

      const activity = await activityRepository.create({
        tenantId: ctx.tenant.id,
        type: args.type as ActivityType,
        subject: args.subject,
        description: args.description ?? null,
        ownerId: ctx.user.id,
        status: ActivityStatus.PENDING,
        priority: (args.priority as ActivityPriority) ?? ActivityPriority.MEDIUM,
        dueDate: args.dueDate ? new Date(args.dueDate) : null,
        relatedToType: (args.relatedToType as 'LEAD' | 'CONTACT' | 'ACCOUNT' | 'OPPORTUNITY') ?? null,
        relatedToId: args.relatedToId ?? null,
        completedAt: null,
        location: null,
        durationMinutes: null,
        outcome: null,
        deletedAt: null,
      });

      return {
        id: activity._id.toHexString(),
        subject: activity.subject,
        status: activity.status,
      };
    },
  }),

  updateActivity: t.field({
    type: ActivityResult,
    args: {
      id: t.arg.string({ required: true }),
      subject: t.arg.string({ required: false }),
      description: t.arg.string({ required: false }),
      status: t.arg.string({ required: false }),
      priority: t.arg.string({ required: false }),
      dueDate: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      if (!ctx.tenant || !ctx.user) {
        throw new Error('Authentication required');
      }

      const updates: Record<string, unknown> = {};
      if (args.subject) updates.subject = args.subject;
      if (args.description !== undefined) updates.description = args.description;
      if (args.status) updates.status = args.status;
      if (args.priority) updates.priority = args.priority;
      if (args.dueDate) updates.dueDate = new Date(args.dueDate);

      const activity = await activityRepository.updateById(
        args.id,
        ctx.tenant.id,
        updates,
        ctx.user.id
      );

      if (!activity) {
        throw new Error('Activity not found');
      }

      return {
        id: activity._id.toHexString(),
        subject: activity.subject,
        status: activity.status,
      };
    },
  }),

  deleteActivity: t.field({
    type: 'Boolean',
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      if (!ctx.tenant || !ctx.user) {
        throw new Error('Authentication required');
      }

      return activityRepository.deleteById(args.id, ctx.tenant.id, ctx.user.id);
    },
  }),

  completeActivity: t.field({
    type: ActivityResult,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      if (!ctx.tenant || !ctx.user) {
        throw new Error('Authentication required');
      }

      const activity = await activityRepository.complete(
        args.id,
        ctx.tenant.id,
        undefined,
        ctx.user.id
      );

      if (!activity) {
        throw new Error('Activity not found');
      }

      return {
        id: activity._id.toHexString(),
        subject: activity.subject,
        status: activity.status,
      };
    },
  }),

  // User Mutations
  inviteUser: t.field({
    type: InviteUserResult,
    args: {
      email: t.arg.string({ required: true }),
      firstName: t.arg.string({ required: true }),
      lastName: t.arg.string({ required: true }),
      role: t.arg.string({ required: true }),
      password: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      if (!ctx.tenant || !ctx.user) {
        throw new Error('Authentication required');
      }

      // Only admins and managers can invite users
      if (ctx.user.role !== 'ADMIN' && ctx.user.role !== 'MANAGER') {
        throw new Error('Only admins and managers can invite users');
      }

      const user = await userService.createUser(
        ctx.tenant.id,
        ctx.user.id,
        {
          email: args.email,
          firstName: args.firstName,
          lastName: args.lastName,
          role: args.role as any,
          password: args.password || 'TempPassword123!',
        },
        ctx.requestId
      );

      return {
        id: user._id.toHexString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      };
    },
  }),

  updateUser: t.field({
    type: 'Boolean',
    args: {
      id: t.arg.string({ required: true }),
      role: t.arg.string({ required: false }),
      firstName: t.arg.string({ required: false }),
      lastName: t.arg.string({ required: false }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      if (!ctx.tenant || !ctx.user) {
        throw new Error('Authentication required');
      }

      const updates: Record<string, unknown> = {};
      if (args.role) updates.role = args.role;
      if (args.firstName) updates.firstName = args.firstName;
      if (args.lastName) updates.lastName = args.lastName;

      await userRepository.updateById(args.id, ctx.tenant.id, updates, ctx.user.id);
      return true;
    },
  }),

  deleteUser: t.field({
    type: 'Boolean',
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      if (!ctx.tenant || !ctx.user) {
        throw new Error('Authentication required');
      }

      return userRepository.deleteById(args.id, ctx.tenant.id, ctx.user.id);
    },
  }),
}));
