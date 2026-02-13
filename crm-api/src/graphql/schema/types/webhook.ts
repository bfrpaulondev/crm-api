// =============================================================================
// Webhook GraphQL Types
// =============================================================================

import { builder } from '../builder.js';
import {
  WebhookEvent,
  WebhookDeliveryStatus,
  WEBHOOK_EVENTS_BY_CATEGORY,
  ALL_WEBHOOK_EVENTS,
} from '@/types/webhook.js';

// ============================================================================
// Enums
// ============================================================================

const WebhookEventEnum = builder.enumType(WebhookEvent, {
  name: 'WebhookEvent',
  description: 'Events that can trigger webhooks',
});

const WebhookDeliveryStatusEnum = builder.enumType(WebhookDeliveryStatus, {
  name: 'WebhookDeliveryStatus',
  description: 'Status of webhook delivery attempts',
});

// ============================================================================
// Webhook Config Type
// ============================================================================

const WebhookConfigType = builder.objectRef<import('@/types/webhook.js').WebhookConfig>('WebhookConfig');

WebhookConfigType.implement({
  description: 'A webhook subscription configuration',
  fields: (t) => ({
    id: t.field({
      type: 'ObjectId',
      nullable: false,
      resolve: (webhook) => webhook._id.toHexString(),
    }),

    tenantId: t.exposeString('tenantId', { nullable: false }),

    name: t.exposeString('name', { nullable: false }),

    url: t.exposeString('url', {
      nullable: false,
      description: 'The URL to receive webhook POST requests',
    }),

    events: t.field({
      type: [WebhookEventEnum],
      nullable: false,
      resolve: (webhook) => webhook.events,
    }),

    isActive: t.exposeBoolean('isActive', {
      nullable: false,
      description: 'Whether this webhook is currently active',
    }),

    description: t.exposeString('description', { nullable: true }),

    retryCount: t.exposeInt('retryCount', {
      nullable: false,
      description: 'Maximum retry attempts for failed deliveries',
    }),

    timeoutMs: t.exposeInt('timeoutMs', {
      nullable: false,
      description: 'Timeout in milliseconds for webhook requests',
    }),

    createdBy: t.exposeString('createdBy', { nullable: false }),

    createdAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (webhook) => webhook.createdAt,
    }),

    updatedAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (webhook) => webhook.updatedAt,
    }),

    deletedAt: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: (webhook) => webhook.deletedAt ?? null,
    }),
  }),
});

// ============================================================================
// Webhook Delivery Type
// ============================================================================

const WebhookDeliveryType = builder.objectRef<import('@/types/webhook.js').WebhookDelivery>('WebhookDelivery');

WebhookDeliveryType.implement({
  description: 'A record of a webhook delivery attempt',
  fields: (t) => ({
    id: t.field({
      type: 'ObjectId',
      nullable: false,
      resolve: (delivery) => delivery._id.toHexString(),
    }),

    webhookId: t.exposeString('webhookId', { nullable: false }),

    webhookUrl: t.exposeString('webhookUrl', { nullable: false }),

    event: t.field({
      type: WebhookEventEnum,
      nullable: false,
      resolve: (delivery) => delivery.event,
    }),

    status: t.field({
      type: WebhookDeliveryStatusEnum,
      nullable: false,
      resolve: (delivery) => delivery.status,
    }),

    attemptNumber: t.exposeInt('attemptNumber', { nullable: false }),

    maxAttempts: t.exposeInt('maxAttempts', { nullable: false }),

    responseStatusCode: t.exposeInt('responseStatusCode', { nullable: true }),

    responseBody: t.exposeString('responseBody', { nullable: true }),

    error: t.exposeString('error', { nullable: true }),

    durationMs: t.exposeInt('durationMs', { nullable: true }),

    deliveredAt: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: (delivery) => delivery.deliveredAt ?? null,
    }),

    nextRetryAt: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: (delivery) => delivery.nextRetryAt ?? null,
    }),

    createdAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (delivery) => delivery.createdAt,
    }),
  }),
});

// ============================================================================
// Webhook Statistics Type
// ============================================================================

const WebhookStatsType = builder.simpleObject('WebhookStats', {
  fields: (t) => ({
    totalDeliveries: t.int({ nullable: false }),
    successful: t.int({ nullable: false }),
    failed: t.int({ nullable: false }),
    pending: t.int({ nullable: false }),
    successRate: t.float({ nullable: false }),
  }),
});

// ============================================================================
// Input Types
// ============================================================================

const CreateWebhookInput = builder.inputType('CreateWebhookInput', {
  fields: (t) => ({
    name: t.string({
      required: true,
      validate: { minLength: 1, maxLength: 100 },
    }),
    url: t.string({
      required: true,
      validate: { minLength: 1, maxLength: 2048 },
    }),
    events: t.field({
      type: [WebhookEventEnum],
      required: true,
      validate: {
        minLength: 1,
      },
    }),
    secret: t.string({
      required: true,
      validate: { minLength: 16, maxLength: 256 },
      description: 'Secret key for HMAC-SHA256 signature (min 16 characters)',
    }),
    description: t.string({ required: false }),
    isActive: t.boolean({ required: false, defaultValue: true }),
  }),
});

const UpdateWebhookInput = builder.inputType('UpdateWebhookInput', {
  fields: (t) => ({
    name: t.string({ required: false, validate: { minLength: 1, maxLength: 100 } }),
    url: t.string({ required: false, validate: { minLength: 1, maxLength: 2048 } }),
    events: t.field({
      type: [WebhookEventEnum],
      required: false,
    }),
    secret: t.string({
      required: false,
      validate: { minLength: 16, maxLength: 256 },
    }),
    description: t.string({ required: false }),
    isActive: t.boolean({ required: false }),
  }),
});

const WebhookFilterInput = builder.inputType('WebhookFilterInput', {
  fields: (t) => ({
    isActive: t.boolean({ required: false }),
    events: t.field({ type: [WebhookEventEnum], required: false }),
  }),
});

const WebhookDeliveryFilterInput = builder.inputType('WebhookDeliveryFilterInput', {
  fields: (t) => ({
    webhookId: t.id({ required: false }),
    status: t.field({ type: WebhookDeliveryStatusEnum, required: false }),
    event: t.field({ type: WebhookEventEnum, required: false }),
    startDate: t.field({ type: 'DateTime', required: false }),
    endDate: t.field({ type: 'DateTime', required: false }),
  }),
});

// ============================================================================
// Payload Types
// ============================================================================

const CreateWebhookPayload = builder.simpleObject('CreateWebhookPayload', {
  fields: (t) => ({
    success: t.boolean({ nullable: false }),
    message: t.string({ nullable: true }),
    webhook: t.field({ type: WebhookConfigType, nullable: true }),
  }),
});

const UpdateWebhookPayload = builder.simpleObject('UpdateWebhookPayload', {
  fields: (t) => ({
    success: t.boolean({ nullable: false }),
    message: t.string({ nullable: true }),
    webhook: t.field({ type: WebhookConfigType, nullable: true }),
  }),
});

const DeleteWebhookPayload = builder.simpleObject('DeleteWebhookPayload', {
  fields: (t) => ({
    success: t.boolean({ nullable: false }),
    message: t.string({ nullable: true }),
  }),
});

const TestWebhookPayload = builder.simpleObject('TestWebhookPayload', {
  fields: (t) => ({
    success: t.boolean({ nullable: false }),
    message: t.string({ nullable: true }),
    statusCode: t.int({ nullable: true }),
    responseTime: t.int({ nullable: true }),
    error: t.string({ nullable: true }),
  }),
});

const WebhookConnectionType = builder.simpleObject('WebhookConnection', {
  fields: (t) => ({
    data: t.field({ type: [WebhookConfigType], nullable: false }),
    totalCount: t.int({ nullable: false }),
    hasNextPage: t.boolean({ nullable: false }),
    hasPreviousPage: t.boolean({ nullable: false }),
  }),
});

const WebhookDeliveryConnectionType = builder.simpleObject('WebhookDeliveryConnection', {
  fields: (t) => ({
    data: t.field({ type: [WebhookDeliveryType], nullable: false }),
    totalCount: t.int({ nullable: false }),
    hasNextPage: t.boolean({ nullable: false }),
    hasPreviousPage: t.boolean({ nullable: false }),
  }),
});

// ============================================================================
// Available Events Type
// ============================================================================

const WebhookEventCategoryType = builder.simpleObject('WebhookEventCategory', {
  fields: (t) => ({
    category: t.string({ nullable: false }),
    events: t.field({ type: [WebhookEventEnum], nullable: false }),
  }),
});

// ============================================================================
// Exports
// ============================================================================

export {
  WebhookEventEnum,
  WebhookDeliveryStatusEnum,
  WebhookConfigType,
  WebhookDeliveryType,
  WebhookStatsType,
  CreateWebhookInput,
  UpdateWebhookInput,
  WebhookFilterInput,
  WebhookDeliveryFilterInput,
  CreateWebhookPayload,
  UpdateWebhookPayload,
  DeleteWebhookPayload,
  TestWebhookPayload,
  WebhookConnectionType,
  WebhookDeliveryConnectionType,
  WebhookEventCategoryType,
};
