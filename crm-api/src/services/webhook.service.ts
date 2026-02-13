// =============================================================================
// Webhook Service - Webhook dispatch, retry, and management
// =============================================================================

import { createHash, createHmac } from 'crypto';
import {
  WebhookConfig,
  WebhookDelivery,
  WebhookEvent,
  WebhookDeliveryStatus,
  CreateWebhookInput,
  UpdateWebhookInput,
  WebhookPayload,
  WebhookEventData,
  WebhookMetadata,
  WebhookDispatchResult,
  TestWebhookResult,
  WebhookFilter,
  DEFAULT_WEBHOOK_RETRY_COUNT,
  DEFAULT_WEBHOOK_TIMEOUT_MS,
  WEBHOOK_API_VERSION,
} from '@/types/webhook.js';
import {
  webhookConfigRepository,
  webhookDeliveryRepository,
} from '@/repositories/webhook.repository.js';
import { traceServiceOperation } from '@/infrastructure/otel/tracing.js';
import { logger } from '@/infrastructure/logging/index.js';

// ============================================================================
// Types
// ============================================================================

interface DispatchOptions {
  requestId: string;
  actorId: string;
  actorEmail: string;
  entityType: string;
  entityId: string;
  action: WebhookEventData['action'];
  current: Record<string, unknown>;
  previous?: Record<string, unknown> | null;
  changes?: Record<string, { old: unknown; new: unknown }> | null;
}

// ============================================================================
// Webhook Service Class
// ============================================================================

export class WebhookService {
  private static instance: WebhookService;

  private constructor() {}

  static getInstance(): WebhookService {
    if (!WebhookService.instance) {
      WebhookService.instance = new WebhookService();
    }
    return WebhookService.instance;
  }

  // ===========================================================================
  // Webhook Configuration Management
  // ===========================================================================

  /**
   * Register a new webhook subscription
   */
  async createWebhook(
    tenantId: string,
    userId: string,
    input: CreateWebhookInput
  ): Promise<WebhookConfig> {
    return traceServiceOperation('WebhookService', 'createWebhook', async () => {
      // Validate URL
      this.validateWebhookUrl(input.url);

      // Validate events
      this.validateEvents(input.events);

      // Validate secret strength
      if (input.secret.length < 16) {
        throw new Error('Webhook secret must be at least 16 characters long');
      }

      const webhook = await webhookConfigRepository.create(tenantId, userId, input);

      logger.info('Webhook created', {
        webhookId: webhook._id.toHexString(),
        tenantId,
        userId,
        events: input.events,
        url: this.redactUrl(input.url),
      });

      return webhook;
    });
  }

  /**
   * Update a webhook subscription
   */
  async updateWebhook(
    id: string,
    tenantId: string,
    userId: string,
    input: UpdateWebhookInput
  ): Promise<WebhookConfig> {
    return traceServiceOperation('WebhookService', 'updateWebhook', async () => {
      // Check if webhook exists
      const existing = await webhookConfigRepository.findById(id, tenantId);
      if (!existing) {
        throw new Error(`Webhook not found: ${id}`);
      }

      // Validate URL if provided
      if (input.url) {
        this.validateWebhookUrl(input.url);
      }

      // Validate events if provided
      if (input.events) {
        this.validateEvents(input.events);
      }

      // Validate secret strength if provided
      if (input.secret !== undefined && input.secret.length < 16) {
        throw new Error('Webhook secret must be at least 16 characters long');
      }

      const webhook = await webhookConfigRepository.updateById(id, tenantId, input, userId);

      if (!webhook) {
        throw new Error('Failed to update webhook');
      }

      logger.info('Webhook updated', {
        webhookId: id,
        tenantId,
        userId,
      });

      return webhook;
    });
  }

  /**
   * Delete a webhook subscription
   */
  async deleteWebhook(
    id: string,
    tenantId: string,
    userId: string
  ): Promise<boolean> {
    return traceServiceOperation('WebhookService', 'deleteWebhook', async () => {
      const deleted = await webhookConfigRepository.deleteById(id, tenantId, userId);

      if (deleted) {
        logger.info('Webhook deleted', {
          webhookId: id,
          tenantId,
          userId,
        });
      }

      return deleted;
    });
  }

  /**
   * Get webhook by ID
   */
  async getWebhook(id: string, tenantId: string): Promise<WebhookConfig> {
    return traceServiceOperation('WebhookService', 'getWebhook', async () => {
      const webhook = await webhookConfigRepository.findById(id, tenantId);

      if (!webhook) {
        throw new Error(`Webhook not found: ${id}`);
      }

      return webhook;
    });
  }

  /**
   * List webhooks for a tenant
   */
  async listWebhooks(
    tenantId: string,
    filter?: WebhookFilter,
    pagination?: { limit?: number; skip?: number }
  ) {
    return traceServiceOperation('WebhookService', 'listWebhooks', async () => {
      return webhookConfigRepository.findByTenant(tenantId, filter, pagination);
    });
  }

  // ===========================================================================
  // Webhook Dispatch
  // ===========================================================================

  /**
   * Dispatch an event to all subscribed webhooks
   */
  async dispatchEvent(
    tenantId: string,
    event: WebhookEvent,
    options: DispatchOptions
  ): Promise<WebhookDispatchResult[]> {
    return traceServiceOperation('WebhookService', 'dispatchEvent', async () => {
      // Find all webhooks subscribed to this event
      const webhooks = await webhookConfigRepository.findByEvent(tenantId, event);

      if (webhooks.length === 0) {
        logger.debug('No webhooks subscribed to event', {
          tenantId,
          event,
        });
        return [];
      }

      // Build the payload
      const payload = this.buildPayload(tenantId, event, options);

      // Dispatch to all webhooks concurrently
      const results = await Promise.all(
        webhooks.map((webhook) => this.dispatchToWebhook(webhook, payload))
      );

      logger.info('Webhook event dispatched', {
        tenantId,
        event,
        webhookCount: webhooks.length,
        successCount: results.filter((r) => r.success).length,
        failCount: results.filter((r) => !r.success).length,
      });

      return results;
    });
  }

  /**
   * Dispatch a payload to a single webhook
   */
  private async dispatchToWebhook(
    webhook: WebhookConfig,
    payload: WebhookPayload
  ): Promise<WebhookDispatchResult> {
    const attemptNumber = 1;

    try {
      const result = await this.sendWebhook(webhook, payload);

      // Create delivery record
      const delivery = await webhookDeliveryRepository.create({
        tenantId: webhook.tenantId,
        webhookId: webhook._id.toHexString(),
        webhookUrl: webhook.url,
        event: payload.event,
        payload,
        status: result.success ? WebhookDeliveryStatus.SUCCESS : WebhookDeliveryStatus.FAILED,
        attemptNumber,
        maxAttempts: webhook.retryCount,
        responseStatusCode: result.statusCode,
        responseBody: result.responseBody,
        responseHeaders: result.responseHeaders,
        error: result.error,
        durationMs: result.durationMs,
        deliveredAt: result.success ? new Date() : null,
      });

      return {
        success: result.success,
        delivery,
      };
    } catch (error) {
      // Log unexpected error
      logger.error('Webhook dispatch failed with unexpected error', {
        webhookId: webhook._id.toHexString(),
        error: (error as Error).message,
      });

      // Create failed delivery record
      const delivery = await webhookDeliveryRepository.create({
        tenantId: webhook.tenantId,
        webhookId: webhook._id.toHexString(),
        webhookUrl: webhook.url,
        event: payload.event,
        payload,
        status: WebhookDeliveryStatus.FAILED,
        attemptNumber,
        maxAttempts: webhook.retryCount,
        error: (error as Error).message,
      });

      return {
        success: false,
        delivery,
      };
    }
  }

  /**
   * Send HTTP request to webhook endpoint
   */
  private async sendWebhook(
    webhook: WebhookConfig,
    payload: WebhookPayload
  ): Promise<{
    success: boolean;
    statusCode?: number;
    responseBody?: string;
    responseHeaders?: Record<string, string>;
    error?: string;
    durationMs?: number;
  }> {
    const startTime = Date.now();
    const payloadString = JSON.stringify(payload);
    const signature = this.signPayload(payloadString, webhook.secret);

    try {
      const controller = new AbortController();
      const timeoutId = setTimeout(
        () => controller.abort(),
        webhook.timeoutMs || DEFAULT_WEBHOOK_TIMEOUT_MS
      );

      const headers: Record<string, string> = {
        'Content-Type': 'application/json',
        'X-Webhook-Signature': signature,
        'X-Webhook-Event': payload.event,
        'X-Webhook-ID': payload.id,
        'X-Webhook-Timestamp': payload.timestamp,
        'User-Agent': 'CRM-Webhook/1.0',
        ...webhook.headers,
      };

      const response = await fetch(webhook.url, {
        method: 'POST',
        headers,
        body: payloadString,
        signal: controller.signal,
      });

      clearTimeout(timeoutId);

      const durationMs = Date.now() - startTime;
      const responseBody = await response.text();

      const responseHeaders: Record<string, string> = {};
      response.headers.forEach((value, key) => {
        responseHeaders[key] = value;
      });

      // Consider 2xx responses as success
      const success = response.status >= 200 && response.status < 300;

      if (success) {
        logger.debug('Webhook delivered successfully', {
          webhookId: webhook._id.toHexString(),
          event: payload.event,
          statusCode: response.status,
          durationMs,
        });
      } else {
        logger.warn('Webhook delivery failed with non-2xx status', {
          webhookId: webhook._id.toHexString(),
          event: payload.event,
          statusCode: response.status,
          durationMs,
        });
      }

      return {
        success,
        statusCode: response.status,
        responseBody: responseBody.substring(0, 10000), // Limit response body size
        responseHeaders,
        durationMs,
      };
    } catch (error) {
      const durationMs = Date.now() - startTime;
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';

      if (error instanceof Error && error.name === 'AbortError') {
        logger.warn('Webhook delivery timed out', {
          webhookId: webhook._id.toHexString(),
          event: payload.event,
          timeoutMs: webhook.timeoutMs,
        });

        return {
          success: false,
          error: `Request timed out after ${webhook.timeoutMs}ms`,
          durationMs,
        };
      }

      logger.error('Webhook delivery failed', {
        webhookId: webhook._id.toHexString(),
        event: payload.event,
        error: errorMessage,
        durationMs,
      });

      return {
        success: false,
        error: errorMessage,
        durationMs,
      };
    }
  }

  // ===========================================================================
  // Retry Logic
  // ===========================================================================

  /**
   * Process pending retry deliveries
   */
  async processRetries(): Promise<void> {
    return traceServiceOperation('WebhookService', 'processRetries', async () => {
      const pendingDeliveries = await webhookDeliveryRepository.findPendingRetries(100);

      logger.debug('Processing webhook retries', {
        count: pendingDeliveries.length,
      });

      for (const delivery of pendingDeliveries) {
        try {
          // Get the webhook config
          const webhook = await webhookConfigRepository.findById(
            delivery.webhookId,
            delivery.tenantId
          );

          if (!webhook || !webhook.isActive) {
            // Mark as failed if webhook no longer exists or is inactive
            await webhookDeliveryRepository.updateStatus(
              delivery._id.toHexString(),
              delivery.tenantId,
              {
                status: WebhookDeliveryStatus.FAILED,
                error: 'Webhook no longer active',
              }
            );
            continue;
          }

          // Retry sending
          const result = await this.sendWebhook(webhook, delivery.payload);

          const newAttemptNumber = delivery.attemptNumber + 1;
          const finalAttempt = newAttemptNumber >= delivery.maxAttempts;

          if (result.success) {
            // Mark as success
            await webhookDeliveryRepository.updateStatus(
              delivery._id.toHexString(),
              delivery.tenantId,
              {
                status: WebhookDeliveryStatus.SUCCESS,
                responseStatusCode: result.statusCode,
                responseBody: result.responseBody,
                responseHeaders: result.responseHeaders,
                durationMs: result.durationMs,
                deliveredAt: new Date(),
                attemptNumber: newAttemptNumber,
                nextRetryAt: null,
              }
            );
          } else if (finalAttempt) {
            // Mark as failed (no more retries)
            await webhookDeliveryRepository.updateStatus(
              delivery._id.toHexString(),
              delivery.tenantId,
              {
                status: WebhookDeliveryStatus.FAILED,
                responseStatusCode: result.statusCode,
                responseBody: result.responseBody,
                error: result.error,
                durationMs: result.durationMs,
                attemptNumber: newAttemptNumber,
                nextRetryAt: null,
              }
            );

            logger.warn('Webhook delivery failed after max retries', {
              deliveryId: delivery._id.toHexString(),
              webhookId: delivery.webhookId,
              attempts: newAttemptNumber,
            });
          } else {
            // Schedule next retry with exponential backoff
            const backoffMs = Math.pow(2, newAttemptNumber) * 1000; // 2s, 4s, 8s...
            const nextRetryAt = new Date(Date.now() + backoffMs);

            await webhookDeliveryRepository.updateStatus(
              delivery._id.toHexString(),
              delivery.tenantId,
              {
                status: WebhookDeliveryStatus.RETRYING,
                responseStatusCode: result.statusCode,
                error: result.error,
                durationMs: result.durationMs,
                attemptNumber: newAttemptNumber,
                nextRetryAt,
              }
            );
          }
        } catch (error) {
          logger.error('Error processing webhook retry', {
            deliveryId: delivery._id.toHexString(),
            error: (error as Error).message,
          });
        }
      }
    });
  }

  // ===========================================================================
  // Test Webhook
  // ===========================================================================

  /**
   * Test a webhook endpoint
   */
  async testWebhook(
    id: string,
    tenantId: string
  ): Promise<TestWebhookResult> {
    return traceServiceOperation('WebhookService', 'testWebhook', async () => {
      const webhook = await webhookConfigRepository.findById(id, tenantId);

      if (!webhook) {
        throw new Error(`Webhook not found: ${id}`);
      }

      // Create a test payload
      const testPayload: WebhookPayload = {
        id: `test_${Date.now()}`,
        event: WebhookEvent.LEAD_CREATED,
        timestamp: new Date().toISOString(),
        tenantId,
        data: {
          entityType: 'Lead',
          entityId: 'test_id',
          action: 'CREATE',
          current: {
            id: 'test_id',
            firstName: 'Test',
            lastName: 'Lead',
            email: 'test@example.com',
          },
          previous: null,
          changes: null,
        },
        metadata: {
          requestId: 'test_request',
          actorId: 'test_actor',
          actorEmail: 'test@example.com',
          source: 'test',
          version: WEBHOOK_API_VERSION,
        },
      };

      const result = await this.sendWebhook(webhook, testPayload);

      logger.info('Webhook test completed', {
        webhookId: id,
        success: result.success,
        statusCode: result.statusCode,
      });

      return {
        success: result.success,
        statusCode: result.statusCode,
        responseTime: result.durationMs,
        error: result.error,
      };
    });
  }

  // ===========================================================================
  // Delivery Logs
  // ===========================================================================

  /**
   * Get delivery logs for a webhook
   */
  async getDeliveryLogs(
    webhookId: string,
    tenantId: string,
    options?: { limit?: number; skip?: number }
  ) {
    return traceServiceOperation('WebhookService', 'getDeliveryLogs', async () => {
      return webhookDeliveryRepository.findByWebhook(webhookId, tenantId, options);
    });
  }

  /**
   * Get all delivery logs for a tenant
   */
  async getAllDeliveryLogs(
    tenantId: string,
    filter?: {
      webhookId?: string;
      status?: WebhookDeliveryStatus;
      event?: WebhookEvent;
      startDate?: Date;
      endDate?: Date;
    },
    options?: { limit?: number; skip?: number }
  ) {
    return traceServiceOperation('WebhookService', 'getAllDeliveryLogs', async () => {
      return webhookDeliveryRepository.findByTenant(tenantId, filter, options);
    });
  }

  // ===========================================================================
  // Helper Methods
  // ===========================================================================

  /**
   * Sign payload with HMAC-SHA256
   */
  private signPayload(payload: string, secret: string): string {
    const hmac = createHmac('sha256', secret);
    hmac.update(payload);
    return `sha256=${hmac.digest('hex')}`;
  }

  /**
   * Build webhook payload
   */
  private buildPayload(
    tenantId: string,
    event: WebhookEvent,
    options: DispatchOptions
  ): WebhookPayload {
    return {
      id: this.generatePayloadId(),
      event,
      timestamp: new Date().toISOString(),
      tenantId,
      data: {
        entityType: options.entityType,
        entityId: options.entityId,
        action: options.action,
        current: options.current,
        previous: options.previous ?? null,
        changes: options.changes ?? null,
      },
      metadata: {
        requestId: options.requestId,
        actorId: options.actorId,
        actorEmail: options.actorEmail,
        source: 'crm-api',
        version: WEBHOOK_API_VERSION,
      },
    };
  }

  /**
   * Generate unique payload ID
   */
  private generatePayloadId(): string {
    const timestamp = Date.now().toString(36);
    const randomBytes = createHash('md5')
      .update(Math.random().toString())
      .digest('hex')
      .substring(0, 8);
    return `${timestamp}_${randomBytes}`;
  }

  /**
   * Validate webhook URL
   */
  private validateWebhookUrl(url: string): void {
    try {
      const parsed = new URL(url);

      // Only allow http and https
      if (parsed.protocol !== 'http:' && parsed.protocol !== 'https:') {
        throw new Error('Webhook URL must use http or https protocol');
      }

      // Disallow localhost in production (optional)
      // if (process.env.NODE_ENV === 'production') {
      //   if (parsed.hostname === 'localhost' || parsed.hostname === '127.0.0.1') {
      //     throw new Error('Localhost URLs are not allowed in production');
      //   }
      // }
    } catch (error) {
      if (error instanceof TypeError) {
        throw new Error('Invalid webhook URL');
      }
      throw error;
    }
  }

  /**
   * Validate webhook events
   */
  private validateEvents(events: WebhookEvent[]): void {
    if (!events || events.length === 0) {
      throw new Error('At least one event must be specified');
    }

    const validEvents = Object.values(WebhookEvent);
    for (const event of events) {
      if (!validEvents.includes(event)) {
        throw new Error(`Invalid event: ${event}`);
      }
    }
  }

  /**
   * Redact sensitive parts of URL for logging
   */
  private redactUrl(url: string): string {
    try {
      const parsed = new URL(url);
      // Redact query params that might contain sensitive data
      parsed.searchParams.forEach((_, key) => {
        parsed.searchParams.set(key, '[REDACTED]');
      });
      return parsed.toString();
    } catch {
      return '[INVALID_URL]';
    }
  }
}

// ============================================================================
// Singleton Export
// ============================================================================

export const webhookService = WebhookService.getInstance();
