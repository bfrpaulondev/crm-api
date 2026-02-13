// =============================================================================
// Lead GraphQL Types
// =============================================================================

import { builder } from '../builder.js';
import { LeadStatus, LeadSource } from '@/types/entities.js';

// ============================================================================
// Enums
// ============================================================================

const LeadStatusEnum = builder.enumType(LeadStatus, {
  name: 'LeadStatus',
  description: 'Lead status in the sales funnel',
});

const LeadSourceEnum = builder.enumType(LeadSource, {
  name: 'LeadSource',
  description: 'Source where the lead originated',
});

// ============================================================================
// Lead Type
// ============================================================================

const LeadType = builder.objectRef<import('@/types/entities.js').Lead>('Lead');

LeadType.implement({
  description: 'A potential customer in the sales funnel',
  fields: (t) => ({
    id: t.field({
      type: 'ObjectId',
      nullable: false,
      resolve: (lead) => lead._id.toHexString(),
    }),

    tenantId: t.exposeString('tenantId', { nullable: false }),

    ownerId: t.exposeString('ownerId', { nullable: false }),

    status: t.field({
      type: LeadStatusEnum,
      nullable: false,
      resolve: (lead) => lead.status,
    }),

    source: t.field({
      type: LeadSourceEnum,
      nullable: true,
      resolve: (lead) => lead.source ?? null,
    }),

    firstName: t.exposeString('firstName', { nullable: false }),

    lastName: t.exposeString('lastName', { nullable: false }),

    fullName: t.field({
      type: 'String',
      nullable: false,
      resolve: (lead) => `${lead.firstName} ${lead.lastName}`,
    }),

    email: t.field({
      type: 'Email',
      nullable: false,
      resolve: (lead) => lead.email,
    }),

    phone: t.exposeString('phone', { nullable: true }),

    companyName: t.exposeString('companyName', { nullable: true }),

    title: t.exposeString('title', { nullable: true }),

    website: t.exposeString('website', { nullable: true }),

    industry: t.exposeString('industry', { nullable: true }),

    tags: t.exposeStringList('tags', { nullable: false }),

    score: t.exposeInt('score', {
      nullable: false,
      description: 'Lead quality score (0-100)',
    }),

    notes: t.exposeString('notes', { nullable: true }),

    qualifiedAt: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: (lead) => lead.qualifiedAt ?? null,
    }),

    convertedAt: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: (lead) => lead.convertedAt ?? null,
    }),

    // Converted relations
    convertedToContactId: t.exposeString('convertedToContactId', { nullable: true }),

    convertedToAccountId: t.exposeString('convertedToAccountId', { nullable: true }),

    convertedToOpportunityId: t.exposeString('convertedToOpportunityId', { nullable: true }),

    isConverted: t.field({
      type: 'Boolean',
      nullable: false,
      resolve: (lead) => lead.status === LeadStatus.CONVERTED,
    }),

    isQualified: t.field({
      type: 'Boolean',
      nullable: false,
      resolve: (lead) =>
        lead.status === LeadStatus.QUALIFIED || lead.status === LeadStatus.CONVERTED,
    }),

    createdAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (lead) => lead.createdAt,
    }),

    updatedAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (lead) => lead.updatedAt,
    }),

    deletedAt: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: (lead) => lead.deletedAt ?? null,
    }),
  }),
});

// ============================================================================
// Lead Input Types
// ============================================================================

const CreateLeadInput = builder.inputType('CreateLeadInput', {
  fields: (t) => ({
    firstName: t.string({ required: true, validate: { minLength: 1, maxLength: 100 } }),
    lastName: t.string({ required: true, validate: { minLength: 1, maxLength: 100 } }),
    email: t.string({ required: true, validate: { email: true } }),
    phone: t.string({ required: false }),
    companyName: t.string({ required: false }),
    title: t.string({ required: false }),
    website: t.string({ required: false }),
    industry: t.string({ required: false }),
    source: t.field({ type: LeadSourceEnum, required: false }),
    ownerId: t.id({ required: false }),
    tags: t.stringList({ required: false }),
    notes: t.string({ required: false }),
  }),
});

const UpdateLeadInput = builder.inputType('UpdateLeadInput', {
  fields: (t) => ({
    firstName: t.string({ required: false }),
    lastName: t.string({ required: false }),
    email: t.string({ required: false }),
    phone: t.string({ required: false }),
    companyName: t.string({ required: false }),
    title: t.string({ required: false }),
    website: t.string({ required: false }),
    industry: t.string({ required: false }),
    source: t.field({ type: LeadSourceEnum, required: false }),
    status: t.field({ type: LeadStatusEnum, required: false }),
    ownerId: t.id({ required: false }),
    tags: t.stringList({ required: false }),
    notes: t.string({ required: false }),
    score: t.int({ required: false }),
  }),
});

const LeadFilterInput = builder.inputType('LeadFilterInput', {
  fields: (t) => ({
    status: t.field({ type: LeadStatusEnum, required: false }),
    source: t.field({ type: LeadSourceEnum, required: false }),
    ownerId: t.id({ required: false }),
    search: t.string({ required: false }),
    tags: t.stringList({ required: false }),
    createdAfter: t.field({ type: 'DateTime', required: false }),
    createdBefore: t.field({ type: 'DateTime', required: false }),
    hasCompany: t.boolean({ required: false }),
    minScore: t.int({ required: false }),
  }),
});

const QualifyLeadInput = builder.inputType('QualifyLeadInput', {
  fields: (t) => ({
    leadId: t.id({ required: true }),
    notes: t.string({ required: false }),
  }),
});

const ConvertLeadInput = builder.inputType('ConvertLeadInput', {
  fields: (t) => ({
    leadId: t.id({ required: true }),
    createAccount: t.boolean({ required: false, defaultValue: true }),
    accountName: t.string({ required: false }),
    createOpportunity: t.boolean({ required: false, defaultValue: true }),
    opportunityName: t.string({ required: false }),
    opportunityAmount: t.float({ required: false }),
    stageId: t.id({ required: false }),
    idempotencyKey: t.string({ required: false }),
  }),
});

// ============================================================================
// Lead Payload Types
// ============================================================================

const CreateLeadPayload = builder.simpleObject('CreateLeadPayload', {
  fields: (t) => ({
    success: t.boolean({ nullable: false }),
    message: t.string({ nullable: true }),
    lead: t.field({ type: LeadType, nullable: true }),
  }),
});

const UpdateLeadPayload = builder.simpleObject('UpdateLeadPayload', {
  fields: (t) => ({
    success: t.boolean({ nullable: false }),
    message: t.string({ nullable: true }),
    lead: t.field({ type: LeadType, nullable: true }),
  }),
});

const QualifyLeadPayload = builder.simpleObject('QualifyLeadPayload', {
  fields: (t) => ({
    success: t.boolean({ nullable: false }),
    message: t.string({ nullable: true }),
    lead: t.field({ type: LeadType, nullable: true }),
  }),
});

const ConvertLeadPayload = builder.simpleObject('ConvertLeadPayload', {
  fields: (t) => ({
    success: t.boolean({ nullable: false }),
    message: t.string({ nullable: true }),
    lead: t.field({ type: LeadType, nullable: true }),
  }),
});

// ============================================================================
// Exports
// ============================================================================

export {
  LeadType,
  LeadStatusEnum,
  LeadSourceEnum,
  CreateLeadInput,
  UpdateLeadInput,
  LeadFilterInput,
  QualifyLeadInput,
  ConvertLeadInput,
  CreateLeadPayload,
  UpdateLeadPayload,
  QualifyLeadPayload,
  ConvertLeadPayload,
};
