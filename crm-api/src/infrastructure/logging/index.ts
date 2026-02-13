import pino, { Logger } from 'pino';
import { config, isDevelopment } from '@/config/index.js';

// Interface para contexto de log
export interface LogContext {
  tenantId?: string;
  userId?: string;
  requestId?: string;
  correlationId?: string;
  operation?: string;
  [key: string]: unknown;
}

// Configuração do logger
function createLogger(): Logger {
  const isPretty = config.LOG_FORMAT === 'pretty' || isDevelopment;

  return pino({
    level: config.LOG_LEVEL,
    formatters: {
      level: (label) => ({ level: label }),
    },
    timestamp: pino.stdTimeFunctions.isoTime,
    base: {
      service: config.OTEL_SERVICE_NAME,
      version: config.API_VERSION,
      env: config.NODE_ENV,
    },
    transport: isPretty
      ? {
          target: 'pino-pretty',
          options: {
            colorize: true,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
            singleLine: false,
          },
        }
      : undefined,
    redact: {
      // Remover dados sensíveis dos logs
      paths: [
        'req.headers.authorization',
        'req.headers.cookie',
        'req.body.password',
        'req.body.token',
        'req.body.refreshToken',
        'res.body.token',
        'res.body.refreshToken',
      ],
      censor: '[REDACTED]',
    },
  });
}

// Instância global do logger
export const logger = createLogger();

/**
 * Criar logger com contexto (child logger)
 */
export function createContextLogger(context: LogContext): Logger {
  return logger.child(context);
}

/**
 * Log estruturado de operação GraphQL
 */
export function logGraphQLOperation(
  operation: string,
  operationName: string | undefined,
  context: LogContext,
  durationMs: number,
  success: boolean,
  error?: Error
): void {
  const logData = {
    ...context,
    operation,
    operationName,
    durationMs,
    success,
    error: error
      ? {
          message: error.message,
          name: error.name,
          // Stack trace apenas em desenvolvimento
          ...(isDevelopment && { stack: error.stack }),
        }
      : undefined,
  };

  if (success) {
    logger.info(logData, `GraphQL ${operation} completed`);
  } else {
    logger.error(logData, `GraphQL ${operation} failed`);
  }
}

/**
 * Log de requisição HTTP
 */
export function logHttpRequest(
  method: string,
  path: string,
  statusCode: number,
  durationMs: number,
  context: LogContext
): void {
  logger.info(
    {
      ...context,
      http: {
        method,
        path,
        statusCode,
        durationMs,
      },
    },
    'HTTP request completed'
  );
}
