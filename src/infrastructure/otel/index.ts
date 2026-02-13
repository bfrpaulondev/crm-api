// =============================================================================
// OpenTelemetry Initialization
// =============================================================================

import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { config } from '@/config/index.js';

let sdk: NodeSDK | null = null;

export function initOpenTelemetry(): void {
  if (!config.OTEL_EXPORTER_OTLP_ENDPOINT) {
    return;
  }

  const exporter = new OTLPTraceExporter({
    url: config.OTEL_EXPORTER_OTLP_ENDPOINT,
  });

  sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: config.OTEL_SERVICE_NAME,
    }),
    traceExporter: exporter,
  });

  sdk.start();
}

export async function shutdownOpenTelemetry(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
  }
}

// Placeholder for tracing helper
export function traceServiceOperation(service: string, operation: string, fn: () => Promise<unknown>): Promise<unknown> {
  return fn();
}

export function traceRepositoryOperation(collection: string, operation: string, fn: () => Promise<unknown>): Promise<unknown> {
  return fn();
}
