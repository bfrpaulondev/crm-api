import { NodeSDK } from '@opentelemetry/sdk-node';
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-grpc';
import { Resource } from '@opentelemetry/resources';
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions';
import { BatchSpanProcessor } from '@opentelemetry/sdk-trace-base';
import { MongoDBInstrumentation } from '@opentelemetry/instrumentation-mongodb';
import { IORedisInstrumentation } from '@opentelemetry/instrumentation-ioredis';
import { HttpInstrumentation } from '@opentelemetry/instrumentation-http';
import { config, isDevelopment } from '@/config/index.js';
import { logger } from '@/infrastructure/logging/index.js';

let sdk: NodeSDK | null = null;

/**
 * Inicializar OpenTelemetry
 */
export function initOpenTelemetry(): NodeSDK | null {
  // Desabilitar em desenvolvimento se não tiver endpoint
  if (isDevelopment && !config.OTEL_EXPORTER_OTLP_ENDPOINT) {
    logger.warn('OpenTelemetry disabled in development (no OTLP endpoint)');
    return null;
  }

  // Resource com metadados do serviço
  const resource = new Resource({
    [SemanticResourceAttributes.SERVICE_NAME]: config.OTEL_SERVICE_NAME,
    [SemanticResourceAttributes.SERVICE_VERSION]: config.API_VERSION,
    [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: config.NODE_ENV,
  });

  // Trace exporter (OTLP gRPC)
  const traceExporter = new OTLPTraceExporter({
    url: config.OTEL_EXPORTER_OTLP_ENDPOINT,
  });

  // SDK com instrumentações
  sdk = new NodeSDK({
    resource,
    spanProcessor: new BatchSpanProcessor(traceExporter),
    instrumentations: [
      // HTTP (Fastify usa Node.js HTTP)
      new HttpInstrumentation({
        requestHook: (span, request) => {
          span.setAttribute('http.request.body.size', request.headers['content-length'] || 0);
        },
      }),
      // MongoDB
      new MongoDBInstrumentation({
        enhancedDatabaseReporting: true,
        dbStatementSerializer: (statement) => {
          // Truncar queries muito longas
          return statement.length > 500 ? statement.substring(0, 500) + '...' : statement;
        },
      }),
      // Redis
      new IORedisInstrumentation({
        requireParentSpan: true,
      }),
    ],
  });

  // Iniciar SDK
  sdk.start();

  logger.info('OpenTelemetry initialized', {
    serviceName: config.OTEL_SERVICE_NAME,
    endpoint: config.OTEL_EXPORTER_OTLP_ENDPOINT,
  });

  return sdk;
}

/**
 * Encerrar OpenTelemetry (graceful shutdown)
 */
export async function shutdownOpenTelemetry(): Promise<void> {
  if (sdk) {
    await sdk.shutdown();
    logger.info('OpenTelemetry shutdown completed');
  }
}
