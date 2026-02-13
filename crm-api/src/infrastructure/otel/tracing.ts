import {
  trace,
  Span,
  SpanStatusCode,
  SpanOptions,
  context,
  Context,
} from '@opentelemetry/api';
import { logger } from '@/infrastructure/logging/index.js';

// Tracer para a API
const tracer = trace.getTracer('crm-api', '1.0.0');

/**
 * Criar span ativo
 */
export function createSpan(name: string, options?: SpanOptions): Span {
  return tracer.startSpan(name, options);
}

/**
 * Executar função dentro de um span
 */
export async function withSpan<T>(
  name: string,
  fn: (span: Span) => Promise<T>,
  options?: SpanOptions
): Promise<T> {
  const span = createSpan(name, options);

  try {
    const result = await fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: (error as Error).message,
    });
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Executar função dentro de um span (síncrono)
 */
export function withSpanSync<T>(name: string, fn: (span: Span) => T, options?: SpanOptions): T {
  const span = createSpan(name, options);

  try {
    const result = fn(span);
    span.setStatus({ code: SpanStatusCode.OK });
    return result;
  } catch (error) {
    span.recordException(error as Error);
    span.setStatus({
      code: SpanStatusCode.ERROR,
      message: (error as Error).message,
    });
    throw error;
  } finally {
    span.end();
  }
}

/**
 * Adicionar atributos ao span atual
 */
export function addSpanAttributes(attributes: Record<string, string | number | boolean>): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.setAttributes(attributes);
  }
}

/**
 * Adicionar evento ao span atual
 */
export function addSpanEvent(name: string, attributes?: Record<string, string | number | boolean>): void {
  const span = trace.getActiveSpan();
  if (span) {
    span.addEvent(name, attributes);
  }
}

/**
 * Obter span atual
 */
export function getCurrentSpan(): Span | undefined {
  return trace.getActiveSpan();
}

/**
 * Obter contexto atual
 */
export function getCurrentContext(): Context {
  return context.active();
}

/**
 * Criar span para resolver GraphQL
 */
export async function traceGraphQLResolver<T>(
  typeName: string,
  fieldName: string,
  fn: () => Promise<T>
): Promise<T> {
  return withSpan(`graphql.resolve.${typeName}.${fieldName}`, async (span) => {
    span.setAttribute('graphql.type', typeName);
    span.setAttribute('graphql.field', fieldName);

    const startTime = Date.now();
    try {
      const result = await fn();
      span.setAttribute('graphql.duration_ms', Date.now() - startTime);
      return result;
    } catch (error) {
      span.setAttribute('graphql.error', true);
      logger.error(`GraphQL resolver error: ${typeName}.${fieldName}`, {
        error: (error as Error).message,
        durationMs: Date.now() - startTime,
      });
      throw error;
    }
  });
}

/**
 * Criar span para operação de serviço
 */
export async function traceServiceOperation<T>(
  serviceName: string,
  operationName: string,
  fn: () => Promise<T>
): Promise<T> {
  return withSpan(`service.${serviceName}.${operationName}`, async (span) => {
    span.setAttribute('service.name', serviceName);
    span.setAttribute('service.operation', operationName);

    return fn();
  });
}

/**
 * Criar span para operação de repositório
 */
export async function traceRepositoryOperation<T>(
  repositoryName: string,
  operationName: string,
  fn: () => Promise<T>
): Promise<T> {
  return withSpan(`repository.${repositoryName}.${operationName}`, async (span) => {
    span.setAttribute('repository.name', repositoryName);
    span.setAttribute('repository.operation', operationName);

    return fn();
  });
}
