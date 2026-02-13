// =============================================================================
// Activity & Note GraphQL Types
// =============================================================================

import { builder } from '../builder.js';
import {
  Activity,
  ActivityType,
  ActivityStatus,
  ActivityPriority,
  Note,
  NoteVisibility,
  RelatedToType,
} from '@/types/entities.js';

// ============================================================================
// Enums
// ============================================================================

const ActivityTypeEnum = builder.enumType(ActivityType, {
  name: 'ActivityType',
  description: 'Type of activity',
});

const ActivityStatusEnum = builder.enumType(ActivityStatus, {
  name: 'ActivityStatus',
  description: 'Activity status',
});

const ActivityPriorityEnum = builder.enumType(ActivityPriority, {
  name: 'ActivityPriority',
  description: 'Activity priority level',
});

const NoteVisibilityEnum = builder.enumType(NoteVisibility, {
  name: 'NoteVisibility',
  description: 'Note visibility level',
});

const RelatedToTypeEnum = builder.enumType(RelatedToType, {
  name: 'RelatedToType',
  description: 'Type of entity an activity/note is related to',
});

// ============================================================================
// Activity Type
// ============================================================================

const ActivityGraphQLType = builder.objectRef<Activity>('Activity');

ActivityGraphQLType.implement({
  description: 'An activity (call, email, meeting, task) in the CRM',
  fields: (t) => ({
    id: t.field({
      type: 'ObjectId',
      nullable: false,
      resolve: (activity) => activity._id.toHexString(),
    }),

    tenantId: t.exposeString('tenantId', { nullable: false }),

    type: t.field({
      type: ActivityTypeEnum,
      nullable: false,
      resolve: (activity) => activity.type,
    }),

    subject: t.exposeString('subject', { nullable: false }),

    description: t.exposeString('description', { nullable: true }),

    ownerId: t.exposeString('ownerId', { nullable: false }),

    relatedToType: t.field({
      type: RelatedToTypeEnum,
      nullable: true,
      resolve: (activity) => activity.relatedToType ?? null,
    }),

    relatedToId: t.exposeString('relatedToId', { nullable: true }),

    dueDate: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: (activity) => activity.dueDate ?? null,
    }),

    completedAt: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: (activity) => activity.completedAt ?? null,
    }),

    status: t.field({
      type: ActivityStatusEnum,
      nullable: false,
      resolve: (activity) => activity.status,
    }),

    priority: t.field({
      type: ActivityPriorityEnum,
      nullable: false,
      resolve: (activity) => activity.priority,
    }),

    location: t.exposeString('location', { nullable: true }),

    durationMinutes: t.exposeInt('durationMinutes', { nullable: true }),

    outcome: t.exposeString('outcome', { nullable: true }),

    isCompleted: t.field({
      type: 'Boolean',
      nullable: false,
      resolve: (activity) => activity.status === ActivityStatus.COMPLETED,
    }),

    isOverdue: t.field({
      type: 'Boolean',
      nullable: false,
      resolve: (activity) => {
        if (!activity.dueDate) return false;
        return (
          activity.status !== ActivityStatus.COMPLETED &&
          new Date() > activity.dueDate
        );
      },
    }),

    createdAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (activity) => activity.createdAt,
    }),

    updatedAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (activity) => activity.updatedAt,
    }),

    deletedAt: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: (activity) => activity.deletedAt ?? null,
    }),
  }),
});

// ============================================================================
// Note Type
// ============================================================================

const NoteGraphQLType = builder.objectRef<Note>('Note');

NoteGraphQLType.implement({
  description: 'A note attached to an entity',
  fields: (t) => ({
    id: t.field({
      type: 'ObjectId',
      nullable: false,
      resolve: (note) => note._id.toHexString(),
    }),

    tenantId: t.exposeString('tenantId', { nullable: false }),

    body: t.exposeString('body', { nullable: false }),

    visibility: t.field({
      type: NoteVisibilityEnum,
      nullable: false,
      resolve: (note) => note.visibility,
    }),

    relatedToType: t.field({
      type: RelatedToTypeEnum,
      nullable: false,
      resolve: (note) => note.relatedToType,
    }),

    relatedToId: t.exposeString('relatedToId', { nullable: false }),

    createdBy: t.exposeString('createdBy', { nullable: true }),

    createdAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (note) => note.createdAt,
    }),

    updatedAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (note) => note.updatedAt,
    }),
  }),
});

// ============================================================================
// Input Types
// ============================================================================

const CreateActivityInput = builder.inputType('CreateActivityInput', {
  fields: (t) => ({
    type: t.field({ type: ActivityTypeEnum, required: true }),
    subject: t.string({ required: true }),
    description: t.string({ required: false }),
    relatedToType: t.field({ type: RelatedToTypeEnum, required: false }),
    relatedToId: t.id({ required: false }),
    dueDate: t.field({ type: 'DateTime', required: false }),
    priority: t.field({ type: ActivityPriorityEnum, required: false }),
    location: t.string({ required: false }),
    durationMinutes: t.int({ required: false }),
    ownerId: t.id({ required: false }),
  }),
});

const UpdateActivityInput = builder.inputType('UpdateActivityInput', {
  fields: (t) => ({
    subject: t.string({ required: false }),
    description: t.string({ required: false }),
    relatedToType: t.field({ type: RelatedToTypeEnum, required: false }),
    relatedToId: t.id({ required: false }),
    dueDate: t.field({ type: 'DateTime', required: false }),
    status: t.field({ type: ActivityStatusEnum, required: false }),
    priority: t.field({ type: ActivityPriorityEnum, required: false }),
    location: t.string({ required: false }),
    durationMinutes: t.int({ required: false }),
    outcome: t.string({ required: false }),
  }),
});

const CompleteActivityInput = builder.inputType('CompleteActivityInput', {
  fields: (t) => ({
    activityId: t.id({ required: true }),
    outcome: t.string({ required: false }),
  }),
});

const ActivityFilterInput = builder.inputType('ActivityFilterInput', {
  fields: (t) => ({
    type: t.field({ type: ActivityTypeEnum, required: false }),
    status: t.field({ type: ActivityStatusEnum, required: false }),
    priority: t.field({ type: ActivityPriorityEnum, required: false }),
    ownerId: t.id({ required: false }),
    relatedToType: t.field({ type: RelatedToTypeEnum, required: false }),
    relatedToId: t.id({ required: false }),
    dueAfter: t.field({ type: 'DateTime', required: false }),
    dueBefore: t.field({ type: 'DateTime', required: false }),
  }),
});

const CreateNoteInput = builder.inputType('CreateNoteInput', {
  fields: (t) => ({
    body: t.string({ required: true }),
    visibility: t.field({ type: NoteVisibilityEnum, required: false }),
    relatedToType: t.field({ type: RelatedToTypeEnum, required: true }),
    relatedToId: t.id({ required: true }),
  }),
});

const UpdateNoteInput = builder.inputType('UpdateNoteInput', {
  fields: (t) => ({
    body: t.string({ required: false }),
    visibility: t.field({ type: NoteVisibilityEnum, required: false }),
  }),
});

// ============================================================================
// Payload Types
// ============================================================================

const CreateActivityPayload = builder.simpleObject('CreateActivityPayload', {
  fields: (t) => ({
    success: t.boolean({ nullable: false }),
    message: t.string({ nullable: true }),
    activity: t.field({ type: ActivityGraphQLType, nullable: true }),
  }),
});

const CreateNotePayload = builder.simpleObject('CreateNotePayload', {
  fields: (t) => ({
    success: t.boolean({ nullable: false }),
    message: t.string({ nullable: true }),
    note: t.field({ type: NoteGraphQLType, nullable: true }),
  }),
});

// ============================================================================
// Exports
// ============================================================================

export {
  ActivityGraphQLType,
  NoteGraphQLType,
  ActivityTypeEnum,
  ActivityStatusEnum,
  ActivityPriorityEnum,
  NoteVisibilityEnum,
  RelatedToTypeEnum,
  CreateActivityInput,
  UpdateActivityInput,
  CompleteActivityInput,
  ActivityFilterInput,
  CreateNoteInput,
  UpdateNoteInput,
  CreateActivityPayload,
  CreateNotePayload,
};
