// =============================================================================
// GraphQL Mutations
// =============================================================================

import { builder } from '../schema/builder.js';
import { leadService } from '@/services/lead.service.js';
import { userService } from '@/services/user.service.js';
import { webhookService } from '@/services/webhook.service.js';
import { GraphQLContext } from '@/types/context.js';

// =============================================================================
// Result Types
// =============================================================================

const LoginResult = builder.simpleObject('LoginResult', {
  fields: (t) => ({
    accessToken: t.string({ nullable: false }),
    refreshToken: t.string({ nullable: false }),
    userId: t.string({ nullable: false }),
    email: t.string({ nullable: false }),
  }),
});

const CreateLeadResult = builder.simpleObject('CreateLeadResult', {
  fields: (t) => ({
    id: t.string({ nullable: false }),
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

// =============================================================================
// Mutations
// =============================================================================

builder.mutationFields((t) => ({
  login: t.field({
    type: LoginResult,
    args: {
      email: t.arg.string({ required: true }),
      password: t.arg.string({ required: true }),
      tenantId: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      const result = await userService.login(
        { email: args.email, password: args.password, tenantId: args.tenantId },
        ctx.requestId
      );
      return {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        userId: result.user._id.toHexString(),
        email: result.user.email,
      };
    },
  }),

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
}));
