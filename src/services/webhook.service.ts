// =============================================================================
// Webhook Service
// =============================================================================

import { webhookConfigRepository, webhookDeliveryRepository } from '@/repositories/webhook.repository.js';
import { WebhookConfig, WebhookDelivery, WebhookEvent, UpdateWebhookInput } from '@/types/webhook.js';
import { logger } from '@/infrastructure/logging/index.js';
import { traceServiceOperation } from '@/infrastructure/otel/tracing.js';

interface CreateWebhookInput {
  name: string;
  url: string;
  events: WebhookEvent[];
  secret?: string;
  isActive?: boolean;
}

interface TestWebhookResult {
  success: boolean;
  statusCode: number | null;
  responseTime: number | null;
  error: string | null;
}

export class WebhookService {
  private readonly timeout = 30000; // 30 seconds

  async create(
    tenantId: string,
    userId: string,
    input: CreateWebhookInput
  ): Promise<WebhookConfig> {
    return traceServiceOperation('WebhookService', 'create', async () => {
      const webhook = await webhookConfigRepository.create(tenantId, userId, {
        name: input.name,
        url: input.url,
        events: input.events,
        secret: input.secret || crypto.randomUUID(),
        isActive: input.isActive ?? true,
      });

      logger.info('Webhook created', {
        webhookId: webhook._id.toHexString(),
        tenantId,
        events: input.events,
      });

      return webhook;
    });
  }

  async list(tenantId: string): Promise<WebhookConfig[]> {
    const result = await webhookConfigRepository.findByTenant(tenantId);
    return result.data;
  }

  async getById(id: string, tenantId: string): Promise<WebhookConfig | null> {
    return webhookConfigRepository.findById(id, tenantId);
  }

  async update(
    id: string,
    tenantId: string,
    updates: Partial<CreateWebhookInput>
  ): Promise<WebhookConfig | null> {
    return traceServiceOperation('WebhookService', 'update', async () => {
      const updateInput: UpdateWebhookInput = {};
      if (updates.name !== undefined) updateInput.name = updates.name;
      if (updates.url !== undefined) updateInput.url = updates.url;
      if (updates.events !== undefined) updateInput.events = updates.events;
      if (updates.isActive !== undefined) updateInput.isActive = updates.isActive;

      const webhook = await webhookConfigRepository.updateById(id, tenantId, updateInput);

      if (webhook) {
        logger.info('Webhook updated', { webhookId: id, tenantId });
      }

      return webhook;
    });
  }

  async delete(id: string, tenantId: string): Promise<boolean> {
    return traceServiceOperation('WebhookService', 'delete', async () => {
      const deleted = await webhookConfigRepository.deleteById(id, tenantId);

      if (deleted) {
        logger.info('Webhook deleted', { webhookId: id, tenantId });
      }

      return deleted;
    });
  }

  async test(id: string, tenantId: string): Promise<TestWebhookResult> {
    return traceServiceOperation('WebhookService', 'test', async () => {
      const webhook = await webhookConfigRepository.findById(id, tenantId);

      if (!webhook) {
        throw new Error('Webhook not found');
      }

      const startTime = Date.now();

      try {
        const response = await fetch(webhook.url, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'X-Webhook-Test': 'true',
            'X-Webhook-Secret': webhook.secret,
          },
          body: JSON.stringify({
            test: true,
            timestamp: new Date().toISOString(),
            webhookId: id,
          }),
          signal: AbortSignal.timeout(this.timeout),
        });

        const responseTime = Date.now() - startTime;

        return {
          success: response.ok,
          statusCode: response.status,
          responseTime,
          error: response.ok ? null : `HTTP ${response.status}`,
        };
      } catch (error) {
        const responseTime = Date.now() - startTime;

        return {
          success: false,
          statusCode: null,
          responseTime,
          error: error instanceof Error ? error.message : 'Unknown error',
        };
      }
    });
  }

  async triggerEvent(
    tenantId: string,
    event: string,
    payload: unknown
  ): Promise<void> {
    return traceServiceOperation('WebhookService', 'triggerEvent', async () => {
      const webhooks = await webhookConfigRepository.findByEvent(tenantId, event as WebhookEvent);

      if (webhooks.length === 0) {
        return;
      }

      const deliveries: Promise<void>[] = webhooks.map(webhook =>
        this.deliverWebhook(webhook, event, payload)
      );

      await Promise.allSettled(deliveries);
    });
  }

  private async deliverWebhook(
    webhook: WebhookConfig,
    event: string,
    payload: unknown
  ): Promise<void> {
    const deliveryId = crypto.randomUUID();
    const startTime = Date.now();

    let success = false;
    let statusCode: number | undefined;
    let error: string | undefined;

    try {
      const response = await fetch(webhook.url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'X-Webhook-Event': event,
          'X-Webhook-Secret': webhook.secret,
          'X-Webhook-Delivery': deliveryId,
        },
        body: JSON.stringify({
          id: deliveryId,
          event,
          timestamp: new Date().toISOString(),
          data: payload,
        }),
        signal: AbortSignal.timeout(this.timeout),
      });

      success = response.ok;
      statusCode = response.status;

      if (!response.ok) {
        error = `HTTP ${response.status}`;
      }
    } catch (err) {
      error = err instanceof Error ? err.message : 'Unknown error';
    }

    const responseTime = Date.now() - startTime;

    logger.info('Webhook delivered', {
      webhookId: webhook._id.toHexString(),
      event,
      success,
      statusCode,
      responseTime,
      error,
    });
  }

  async getDeliveryHistory(
    webhookId: string,
    tenantId: string,
    limit = 50
  ): Promise<WebhookDelivery[]> {
    const result = await webhookDeliveryRepository.findByWebhook(webhookId, tenantId, { limit });
    return result.data;
  }
}

export const webhookService = new WebhookService();
