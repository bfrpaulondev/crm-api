// =============================================================================
// Webhook Types - Types for webhook system
// =============================================================================

import { ObjectId } from 'mongodb';

/**
 * Webhook events that can be subscribed to
 */
export enum WebhookEvent {
  // Lead events
  LEAD_CREATED = 'LEAD_CREATED',
  LEAD_UPDATED = 'LEAD_UPDATED',
  LEAD_DELETED = 'LEAD_DELETED',
  LEAD_CONVERTED = 'LEAD_CONVERTED',
  LEAD_QUALIFIED = 'LEAD_QUALIFIED',

  // Opportunity events
  OPPORTUNITY_CREATED = 'OPPORTUNITY_CREATED',
  OPPORTUNITY_UPDATED = 'OPPORTUNITY_UPDATED',
  OPPORTUNITY_DELETED = 'OPPORTUNITY_DELETED',
  OPPORTUNITY_WON = 'OPPORTUNITY_WON',
  OPPORTUNITY_LOST = 'OPPORTUNITY_LOST',
  OPPORTUNITY_STAGE_CHANGED = 'OPPORTUNITY_STAGE_CHANGED',

  // Account events
  ACCOUNT_CREATED = 'ACCOUNT_CREATED',
  ACCOUNT_UPDATED = 'ACCOUNT_UPDATED',
  ACCOUNT_DELETED = 'ACCOUNT_DELETED',

  // Contact events
  CONTACT_CREATED = 'CONTACT_CREATED',
  CONTACT_UPDATED = 'CONTACT_UPDATED',
  CONTACT_DELETED = 'CONTACT_DELETED',

  // Activity events
  ACTIVITY_CREATED = 'ACTIVITY_CREATED',
  ACTIVITY_UPDATED = 'ACTIVITY_UPDATED',
  ACTIVITY_COMPLETED = 'ACTIVITY_COMPLETED',
  ACTIVITY_DELETED = 'ACTIVITY_DELETED',
}

/**
 * Delivery status for webhook attempts
 */
export enum WebhookDeliveryStatus {
  PENDING = 'PENDING',
  SUCCESS = 'SUCCESS',
  FAILED = 'FAILED',
  RETRYING = 'RETRYING',
}

/**
 * Webhook configuration document
 */
export interface WebhookConfig {
  _id: ObjectId;
  tenantId: string;
  name: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  isActive: boolean;
  description: string | null;
  headers: Record<string, string> | null;
  retryCount: number;
  timeoutMs: number;
  createdBy: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

/**
 * Input type for creating a webhook
 */
export interface CreateWebhookInput {
  name: string;
  url: string;
  events: WebhookEvent[];
  secret: string;
  description?: string;
  headers?: Record<string, string>;
  isActive?: boolean;
}

/**
 * Input type for updating a webhook
 */
export interface UpdateWebhookInput {
  name?: string;
  url?: string;
  events?: WebhookEvent[];
  secret?: string;
  description?: string | null;
  headers?: Record<string, string> | null;
  isActive?: boolean;
}

/**
 * Payload sent to webhook endpoints
 */
export interface WebhookPayload {
  id: string;
  event: WebhookEvent;
  timestamp: string;
  tenantId: string;
  data: WebhookEventData;
  metadata: WebhookMetadata;
}

/**
 * Event data included in webhook payload
 */
export interface WebhookEventData {
  entityType: string;
  entityId: string;
  action: 'CREATE' | 'UPDATE' | 'DELETE' | 'CONVERT' | 'WON' | 'LOST' | 'COMPLETE' | 'STAGE_CHANGE';
  current: Record<string, unknown>;
  previous?: Record<string, unknown> | null;
  changes?: Record<string, { old: unknown; new: unknown }> | null;
}

/**
 * Metadata included in webhook payload
 */
export interface WebhookMetadata {
  requestId: string;
  actorId: string;
  actorEmail: string;
  source: string;
  version: string;
}

/**
 * Delivery attempt record
 */
export interface WebhookDelivery {
  _id: ObjectId;
  tenantId: string;
  webhookId: string;
  webhookUrl: string;
  event: WebhookEvent;
  payload: WebhookPayload;
  status: WebhookDeliveryStatus;
  attemptNumber: number;
  maxAttempts: number;
  responseStatusCode: number | null;
  responseBody: string | null;
  responseHeaders: Record<string, string> | null;
  error: string | null;
  durationMs: number | null;
  deliveredAt: Date | null;
  nextRetryAt: Date | null;
  createdAt: Date;
}

/**
 * Input for creating a delivery record
 */
export interface CreateWebhookDeliveryInput {
  tenantId: string;
  webhookId: string;
  webhookUrl: string;
  event: WebhookEvent;
  payload: WebhookPayload;
  status: WebhookDeliveryStatus;
  attemptNumber: number;
  maxAttempts: number;
  responseStatusCode?: number;
  responseBody?: string;
  responseHeaders?: Record<string, string>;
  error?: string;
  durationMs?: number;
  deliveredAt?: Date;
  nextRetryAt?: Date;
}

/**
 * Result of a webhook dispatch
 */
export interface WebhookDispatchResult {
  success: boolean;
  delivery: WebhookDelivery;
}

/**
 * Filter options for listing webhooks
 */
export interface WebhookFilter {
  isActive?: boolean;
  events?: WebhookEvent[];
}

/**
 * Filter options for listing deliveries
 */
export interface WebhookDeliveryFilter {
  webhookId?: string;
  status?: WebhookDeliveryStatus;
  event?: WebhookEvent;
  startDate?: Date;
  endDate?: Date;
}

/**
 * Test webhook result
 */
export interface TestWebhookResult {
  success: boolean;
  statusCode: number | null;
  responseTime: number | null;
  error: string | null;
}

/**
 * All webhook events grouped by category
 */
export const WEBHOOK_EVENTS_BY_CATEGORY = {
  LEAD: [
    WebhookEvent.LEAD_CREATED,
    WebhookEvent.LEAD_UPDATED,
    WebhookEvent.LEAD_DELETED,
    WebhookEvent.LEAD_CONVERTED,
    WebhookEvent.LEAD_QUALIFIED,
  ],
  OPPORTUNITY: [
    WebhookEvent.OPPORTUNITY_CREATED,
    WebhookEvent.OPPORTUNITY_UPDATED,
    WebhookEvent.OPPORTUNITY_DELETED,
    WebhookEvent.OPPORTUNITY_WON,
    WebhookEvent.OPPORTUNITY_LOST,
    WebhookEvent.OPPORTUNITY_STAGE_CHANGED,
  ],
  ACCOUNT: [
    WebhookEvent.ACCOUNT_CREATED,
    WebhookEvent.ACCOUNT_UPDATED,
    WebhookEvent.ACCOUNT_DELETED,
  ],
  CONTACT: [
    WebhookEvent.CONTACT_CREATED,
    WebhookEvent.CONTACT_UPDATED,
    WebhookEvent.CONTACT_DELETED,
  ],
  ACTIVITY: [
    WebhookEvent.ACTIVITY_CREATED,
    WebhookEvent.ACTIVITY_UPDATED,
    WebhookEvent.ACTIVITY_COMPLETED,
    WebhookEvent.ACTIVITY_DELETED,
  ],
} as const;

/**
 * All webhook events as an array
 */
export const ALL_WEBHOOK_EVENTS = Object.values(WebhookEvent);

/**
 * Default retry count for webhooks
 */
export const DEFAULT_WEBHOOK_RETRY_COUNT = 3;

/**
 * Default timeout for webhook requests (5 seconds)
 */
export const DEFAULT_WEBHOOK_TIMEOUT_MS = 5000;

/**
 * Webhook API version
 */
export const WEBHOOK_API_VERSION = '1.0.0';
