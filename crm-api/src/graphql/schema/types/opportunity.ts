// =============================================================================
// Opportunity GraphQL Types
// =============================================================================

import { builder } from '../builder.js';
import { OpportunityStatus, OpportunityType, LeadSource } from '@/types/entities.js';

// ============================================================================
// Enums
// ============================================================================

const OpportunityStatusEnum = builder.enumType(OpportunityStatus, {
  name: 'OpportunityStatus',
  description: 'Opportunity status in the pipeline',
});

const OpportunityTypeEnum = builder.enumType(OpportunityType, {
  name: 'OpportunityType',
  description: 'Type of business opportunity',
});

const LeadSourceEnum = builder.enumType(LeadSource, {
  name: 'LeadSource',
  description: 'Source where the opportunity originated',
});

// ============================================================================
// Stage Type
// ============================================================================

const StageType = builder.objectRef<import('@/types/entities.js').Stage>('Stage');

StageType.implement({
  description: 'A stage in the sales pipeline',
  fields: (t) => ({
    id: t.field({
      type: 'ObjectId',
      nullable: false,
      resolve: (stage) => stage._id.toHexString(),
    }),

    tenantId: t.exposeString('tenantId', { nullable: false }),

    name: t.exposeString('name', { nullable: false }),

    order: t.exposeInt('order', { nullable: false }),

    probability: t.exposeInt('probability', {
      nullable: false,
      description: 'Win probability percentage (0-100)',
    }),

    isWonStage: t.exposeBoolean('isWonStage', {
      nullable: false,
      description: 'Whether this is a terminal "won" stage',
    }),

    isLostStage: t.exposeBoolean('isLostStage', {
      nullable: false,
      description: 'Whether this is a terminal "lost" stage',
    }),

    isActive: t.exposeBoolean('isActive', { nullable: false }),

    color: t.exposeString('color', { nullable: false }),

    description: t.exposeString('description', { nullable: true }),

    createdAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (stage) => stage.createdAt,
    }),

    updatedAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (stage) => stage.updatedAt,
    }),
  }),
});

// ============================================================================
// Opportunity Type
// ============================================================================

const OpportunityType = builder.objectRef<import('@/types/entities.js').Opportunity>('Opportunity');

OpportunityType.implement({
  description: 'A sales opportunity in the pipeline',
  fields: (t) => ({
    id: t.field({
      type: 'ObjectId',
      nullable: false,
      resolve: (opp) => opp._id.toHexString(),
    }),

    tenantId: t.exposeString('tenantId', { nullable: false }),

    accountId: t.exposeString('accountId', { nullable: false }),

    contactId: t.exposeString('contactId', { nullable: true }),

    ownerId: t.exposeString('ownerId', { nullable: false }),

    name: t.exposeString('name', { nullable: false }),

    description: t.exposeString('description', { nullable: true }),

    stageId: t.exposeString('stageId', { nullable: false }),

    stage: t.field({
      type: StageType,
      nullable: true,
      resolve: async (opp, _args, ctx) => {
        return ctx.loaders.stageById.load(opp.stageId);
      },
    }),

    amount: t.exposeFloat('amount', { nullable: false }),

    currency: t.exposeString('currency', { nullable: false }),

    formattedAmount: t.field({
      type: 'String',
      nullable: false,
      resolve: (opp) => {
        return new Intl.NumberFormat('en-US', {
          style: 'currency',
          currency: opp.currency,
        }).format(opp.amount);
      },
    }),

    probability: t.exposeInt('probability', { nullable: false }),

    weightedAmount: t.field({
      type: 'Float',
      nullable: false,
      description: 'Amount weighted by probability',
      resolve: (opp) => opp.amount * (opp.probability / 100),
    }),

    expectedCloseDate: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: (opp) => opp.expectedCloseDate ?? null,
    }),

    actualCloseDate: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: (opp) => opp.actualCloseDate ?? null,
    }),

    status: t.field({
      type: OpportunityStatusEnum,
      nullable: false,
      resolve: (opp) => opp.status,
    }),

    type: t.field({
      type: OpportunityTypeEnum,
      nullable: true,
      resolve: (opp) => opp.type ?? null,
    }),

    leadSource: t.field({
      type: LeadSourceEnum,
      nullable: true,
      resolve: (opp) => opp.leadSource ?? null,
    }),

    nextStep: t.exposeString('nextStep', { nullable: true }),

    competitorInfo: t.exposeString('competitorInfo', { nullable: true }),

    isOpen: t.field({
      type: 'Boolean',
      nullable: false,
      resolve: (opp) => opp.status === OpportunityStatus.OPEN,
    }),

    isWon: t.field({
      type: 'Boolean',
      nullable: false,
      resolve: (opp) => opp.status === OpportunityStatus.WON,
    }),

    isLost: t.field({
      type: 'Boolean',
      nullable: false,
      resolve: (opp) => opp.status === OpportunityStatus.LOST,
    }),

    createdAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (opp) => opp.createdAt,
    }),

    updatedAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (opp) => opp.updatedAt,
    }),

    deletedAt: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: (opp) => opp.deletedAt ?? null,
    }),
  }),
});

// ============================================================================
// Input Types
// ============================================================================

const CreateStageInput = builder.inputType('CreateStageInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    order: t.int({ required: true }),
    probability: t.int({ required: true }),
    isWonStage: t.boolean({ required: false, defaultValue: false }),
    isLostStage: t.boolean({ required: false, defaultValue: false }),
    color: t.string({ required: false }),
    description: t.string({ required: false }),
  }),
});

const UpdateStageInput = builder.inputType('UpdateStageInput', {
  fields: (t) => ({
    name: t.string({ required: false }),
    order: t.int({ required: false }),
    probability: t.int({ required: false }),
    isWonStage: t.boolean({ required: false }),
    isLostStage: t.boolean({ required: false }),
    isActive: t.boolean({ required: false }),
    color: t.string({ required: false }),
    description: t.string({ required: false }),
  }),
});

const CreateOpportunityInput = builder.inputType('CreateOpportunityInput', {
  fields: (t) => ({
    accountId: t.id({ required: true }),
    contactId: t.id({ required: false }),
    name: t.string({ required: true }),
    description: t.string({ required: false }),
    stageId: t.id({ required: true }),
    amount: t.float({ required: true }),
    currency: t.string({ required: false, defaultValue: 'USD' }),
    probability: t.int({ required: false }),
    expectedCloseDate: t.field({ type: 'DateTime', required: false }),
    type: t.field({ type: OpportunityTypeEnum, required: false }),
    leadSource: t.field({ type: LeadSourceEnum, required: false }),
    ownerId: t.id({ required: false }),
    nextStep: t.string({ required: false }),
  }),
});

const UpdateOpportunityInput = builder.inputType('UpdateOpportunityInput', {
  fields: (t) => ({
    name: t.string({ required: false }),
    description: t.string({ required: false }),
    stageId: t.id({ required: false }),
    amount: t.float({ required: false }),
    currency: t.string({ required: false }),
    probability: t.int({ required: false }),
    expectedCloseDate: t.field({ type: 'DateTime', required: false }),
    type: t.field({ type: OpportunityTypeEnum, required: false }),
    leadSource: t.field({ type: LeadSourceEnum, required: false }),
    ownerId: t.id({ required: false }),
    nextStep: t.string({ required: false }),
  }),
});

const MoveOpportunityStageInput = builder.inputType('MoveOpportunityStageInput', {
  fields: (t) => ({
    opportunityId: t.id({ required: true }),
    stageId: t.id({ required: true }),
    notes: t.string({ required: false }),
  }),
});

const CloseOpportunityInput = builder.inputType('CloseOpportunityInput', {
  fields: (t) => ({
    opportunityId: t.id({ required: true }),
    status: t.field({
      type: builder.enumType(['WON', 'LOST'] as const, { name: 'CloseStatus' }),
      required: true,
    }),
    reason: t.string({ required: false }),
    actualCloseDate: t.field({ type: 'DateTime', required: false }),
    idempotencyKey: t.string({ required: false }),
  }),
});

const OpportunityFilterInput = builder.inputType('OpportunityFilterInput', {
  fields: (t) => ({
    accountId: t.id({ required: false }),
    ownerId: t.id({ required: false }),
    stageId: t.id({ required: false }),
    status: t.field({ type: OpportunityStatusEnum, required: false }),
    type: t.field({ type: OpportunityTypeEnum, required: false }),
    search: t.string({ required: false }),
    minAmount: t.float({ required: false }),
    maxAmount: t.float({ required: false }),
    expectedCloseAfter: t.field({ type: 'DateTime', required: false }),
    expectedCloseBefore: t.field({ type: 'DateTime', required: false }),
  }),
});

// ============================================================================
// Payload Types
// ============================================================================

const CreateOpportunityPayload = builder.simpleObject('CreateOpportunityPayload', {
  fields: (t) => ({
    success: t.boolean({ nullable: false }),
    message: t.string({ nullable: true }),
    opportunity: t.field({ type: OpportunityType, nullable: true }),
  }),
});

const UpdateOpportunityPayload = builder.simpleObject('UpdateOpportunityPayload', {
  fields: (t) => ({
    success: t.boolean({ nullable: false }),
    message: t.string({ nullable: true }),
    opportunity: t.field({ type: OpportunityType, nullable: true }),
  }),
});

const CloseOpportunityPayload = builder.simpleObject('CloseOpportunityPayload', {
  fields: (t) => ({
    success: t.boolean({ nullable: false }),
    message: t.string({ nullable: true }),
    opportunity: t.field({ type: OpportunityType, nullable: true }),
    dealId: t.string({ nullable: true }),
  }),
});

// ============================================================================
// Exports
// ============================================================================

export {
  StageType,
  OpportunityType as OpportunityGraphQLType,
  OpportunityStatusEnum,
  OpportunityTypeEnum,
  CreateStageInput,
  UpdateStageInput,
  CreateOpportunityInput,
  UpdateOpportunityInput,
  MoveOpportunityStageInput,
  CloseOpportunityInput,
  OpportunityFilterInput,
  CreateOpportunityPayload,
  UpdateOpportunityPayload,
  CloseOpportunityPayload,
};
