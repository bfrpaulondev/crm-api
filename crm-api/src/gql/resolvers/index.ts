// =============================================================================
// GraphQL Query Resolvers
// =============================================================================

import { builder } from '../schema/builder.js';
import { leadService } from '@/services/lead.service.js';
import { leadRepository } from '@/repositories/lead.repository.js';
import { accountRepository } from '@/repositories/account.repository.js';
import { contactRepository } from '@/repositories/contact.repository.js';
import { opportunityRepository } from '@/repositories/opportunity.repository.js';
import { stageRepository } from '@/repositories/stage.repository.js';
import { activityRepository } from '@/repositories/activity.repository.js';
import { userRepository } from '@/repositories/user.repository.js';
import { Errors } from '@/types/errors.js';
import { Permission, GraphQLContext } from '@/types/context.js';
import { Lead, Account, Contact, Opportunity, Stage, Activity, User } from '@/types/entities.js';
import { UserType } from './auth-resolvers.js';

// =============================================================================
// Object Types
// =============================================================================

const LeadType = builder.objectRef<Lead>('Lead');

LeadType.implement({
  fields: (t) => ({
    id: t.field({
      type: 'String',
      nullable: false,
      resolve: (lead) => lead._id.toHexString(),
    }),
    tenantId: t.exposeString('tenantId', { nullable: false }),
    ownerId: t.exposeString('ownerId', { nullable: true }),
    firstName: t.exposeString('firstName', { nullable: false }),
    lastName: t.exposeString('lastName', { nullable: false }),
    email: t.exposeString('email', { nullable: false }),
    phone: t.exposeString('phone', { nullable: true }),
    companyName: t.exposeString('companyName', { nullable: true }),
    status: t.exposeString('status', { nullable: false }),
    owner: t.field({
      type: UserType,
      nullable: true,
      resolve: async (lead, _args, ctx: GraphQLContext) => {
        if (!lead.ownerId) return null;
        return userRepository.findById(lead.ownerId, ctx.tenant.id);
      },
    }),
    createdAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (lead) => lead.createdAt,
    }),
  }),
});

const AccountType = builder.objectRef<Account>('Account');

AccountType.implement({
  fields: (t) => ({
    id: t.field({
      type: 'String',
      nullable: false,
      resolve: (account) => account._id.toHexString(),
    }),
    tenantId: t.exposeString('tenantId', { nullable: false }),
    name: t.exposeString('name', { nullable: false }),
    domain: t.exposeString('domain', { nullable: true }),
    website: t.exposeString('website', { nullable: true }),
    createdAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (account) => account.createdAt,
    }),
  }),
});

const ContactType = builder.objectRef<Contact>('Contact');

ContactType.implement({
  fields: (t) => ({
    id: t.field({
      type: 'String',
      nullable: false,
      resolve: (contact) => contact._id.toHexString(),
    }),
    tenantId: t.exposeString('tenantId', { nullable: false }),
    firstName: t.exposeString('firstName', { nullable: false }),
    lastName: t.exposeString('lastName', { nullable: false }),
    email: t.exposeString('email', { nullable: false }),
    createdAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (contact) => contact.createdAt,
    }),
  }),
});

const OpportunityType = builder.objectRef<Opportunity>('Opportunity');

OpportunityType.implement({
  fields: (t) => ({
    id: t.field({
      type: 'String',
      nullable: false,
      resolve: (opp) => opp._id.toHexString(),
    }),
    tenantId: t.exposeString('tenantId', { nullable: false }),
    name: t.exposeString('name', { nullable: false }),
    amount: t.exposeFloat('amount', { nullable: false }),
    status: t.exposeString('status', { nullable: false }),
    createdAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (opp) => opp.createdAt,
    }),
  }),
});

const StageType = builder.objectRef<Stage>('Stage');

StageType.implement({
  fields: (t) => ({
    id: t.field({
      type: 'String',
      nullable: false,
      resolve: (stage) => stage._id.toHexString(),
    }),
    tenantId: t.exposeString('tenantId', { nullable: false }),
    name: t.exposeString('name', { nullable: false }),
    order: t.exposeInt('order', { nullable: false }),
    probability: t.exposeInt('probability', { nullable: false }),
  }),
});

const ActivityType = builder.objectRef<Activity>('Activity');

ActivityType.implement({
  fields: (t) => ({
    id: t.field({
      type: 'String',
      nullable: false,
      resolve: (activity) => activity._id.toHexString(),
    }),
    tenantId: t.exposeString('tenantId', { nullable: false }),
    type: t.exposeString('type', { nullable: false }),
    subject: t.exposeString('subject', { nullable: false }),
    description: t.exposeString('description', { nullable: true }),
    status: t.exposeString('status', { nullable: false }),
    priority: t.exposeString('priority', { nullable: false }),
    ownerId: t.exposeString('ownerId', { nullable: false }),
    relatedToType: t.exposeString('relatedToType', { nullable: true }),
    relatedToId: t.exposeString('relatedToId', { nullable: true }),
    dueDate: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: (activity) => activity.dueDate,
    }),
    completedAt: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: (activity) => activity.completedAt,
    }),
    lead: t.field({
      type: LeadType,
      nullable: true,
      resolve: async (activity, _args, ctx: GraphQLContext) => {
        if (activity.relatedToType !== 'LEAD' || !activity.relatedToId) return null;
        return leadRepository.findById(activity.relatedToId, ctx.tenant.id);
      },
    }),
    createdAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (activity) => activity.createdAt,
    }),
  }),
});

// =============================================================================
// Query Fields
// =============================================================================

builder.queryFields((t) => ({
  lead: t.field({
    type: LeadType,
    nullable: true,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      ctx.requireAuth();
      ctx.requireTenant();
      return leadRepository.findById(args.id, ctx.tenant.id);
    },
  }),

  leads: t.field({
    type: [LeadType],
    nullable: false,
    resolve: async (_root, _args, ctx: GraphQLContext) => {
      ctx.requireAuth();
      ctx.requireTenant();
      return leadRepository.findAll(ctx.tenant.id);
    },
  }),

  account: t.field({
    type: AccountType,
    nullable: true,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      ctx.requireAuth();
      ctx.requireTenant();
      return accountRepository.findById(args.id, ctx.tenant.id);
    },
  }),

  accounts: t.field({
    type: [AccountType],
    nullable: false,
    resolve: async (_root, _args, ctx: GraphQLContext) => {
      ctx.requireAuth();
      ctx.requireTenant();
      return accountRepository.findAll(ctx.tenant.id);
    },
  }),

  contact: t.field({
    type: ContactType,
    nullable: true,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      ctx.requireAuth();
      ctx.requireTenant();
      return contactRepository.findById(args.id, ctx.tenant.id);
    },
  }),

  contacts: t.field({
    type: [ContactType],
    nullable: false,
    resolve: async (_root, _args, ctx: GraphQLContext) => {
      ctx.requireAuth();
      ctx.requireTenant();
      return contactRepository.findAll(ctx.tenant.id);
    },
  }),

  opportunity: t.field({
    type: OpportunityType,
    nullable: true,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      ctx.requireAuth();
      ctx.requireTenant();
      return opportunityRepository.findById(args.id, ctx.tenant.id);
    },
  }),

  opportunities: t.field({
    type: [OpportunityType],
    nullable: false,
    resolve: async (_root, _args, ctx: GraphQLContext) => {
      ctx.requireAuth();
      ctx.requireTenant();
      return opportunityRepository.findAll(ctx.tenant.id);
    },
  }),

  stages: t.field({
    type: [StageType],
    nullable: false,
    resolve: async (_root, _args, ctx: GraphQLContext) => {
      ctx.requireAuth();
      ctx.requireTenant();
      return stageRepository.findActiveStages(ctx.tenant.id);
    },
  }),

  activities: t.field({
    type: [ActivityType],
    nullable: false,
    resolve: async (_root, _args, ctx: GraphQLContext) => {
      ctx.requireAuth();
      ctx.requireTenant();
      return activityRepository.findAll(ctx.tenant.id);
    },
  }),

  activity: t.field({
    type: ActivityType,
    nullable: true,
    args: {
      id: t.arg.string({ required: true }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      ctx.requireAuth();
      ctx.requireTenant();
      return activityRepository.findById(args.id, ctx.tenant.id);
    },
  }),

  users: t.field({
    type: [UserType],
    nullable: false,
    resolve: async (_root, _args, ctx: GraphQLContext) => {
      ctx.requireAuth();
      ctx.requireTenant();
      const users = await userRepository.findAll(ctx.tenant.id);
      return users.map(user => ({
        id: user._id.toHexString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      }));
    },
  }),
}));

export { LeadType, AccountType, ContactType, OpportunityType, StageType, ActivityType };
