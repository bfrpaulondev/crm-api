// =============================================================================
// API Error Types
// =============================================================================

import { GraphQLError, GraphQLFormattedError } from 'graphql';

/**
 * Códigos de erro padronizados
 */
export enum ErrorCode {
  // Authentication
  UNAUTHENTICATED = 'UNAUTHENTICATED',
  INVALID_TOKEN = 'INVALID_TOKEN',
  TOKEN_EXPIRED = 'TOKEN_EXPIRED',
  INVALID_CREDENTIALS = 'INVALID_CREDENTIALS',

  // Authorization
  FORBIDDEN = 'FORBIDDEN',
  INSUFFICIENT_PERMISSIONS = 'INSUFFICIENT_PERMISSIONS',
  TENANT_ACCESS_DENIED = 'TENANT_ACCESS_DENIED',

  // Input Validation
  BAD_USER_INPUT = 'BAD_USER_INPUT',
  VALIDATION_ERROR = 'VALIDATION_ERROR',
  INVALID_FILTER = 'INVALID_FILTER',

  // Resource
  NOT_FOUND = 'NOT_FOUND',
  ALREADY_EXISTS = 'ALREADY_EXISTS',
  CONFLICT = 'CONFLICT',

  // Business Logic
  BUSINESS_RULE_VIOLATION = 'BUSINESS_RULE_VIOLATION',
  INVALID_STATE_TRANSITION = 'INVALID_STATE_TRANSITION',
  LEAD_ALREADY_CONVERTED = 'LEAD_ALREADY_CONVERTED',
  OPPORTUNITY_ALREADY_CLOSED = 'OPPORTUNITY_ALREADY_CLOSED',

  // Rate Limiting
  RATE_LIMITED = 'RATE_LIMITED',
  TOO_MANY_REQUESTS = 'TOO_MANY_REQUESTS',

  // Server
  INTERNAL = 'INTERNAL',
  SERVICE_UNAVAILABLE = 'SERVICE_UNAVAILABLE',
  DATABASE_ERROR = 'DATABASE_ERROR',

  // GraphQL Specific
  GRAPHQL_VALIDATION_FAILED = 'GRAPHQL_VALIDATION_FAILED',
  QUERY_TOO_COMPLEX = 'QUERY_TOO_COMPLEX',
  QUERY_TOO_DEEP = 'QUERY_TOO_DEEP',
  PERSISTED_QUERY_NOT_FOUND = 'PERSISTED_QUERY_NOT_FOUND',
}

/**
 * Classe de erro personalizada para a API
 */
export class APIError extends Error {
  public readonly code: ErrorCode;
  public readonly httpStatus: number;
  public readonly extensions: Record<string, unknown>;

  constructor(
    code: ErrorCode,
    message: string,
    options?: {
      httpStatus?: number;
      extensions?: Record<string, unknown>;
      cause?: Error;
    }
  ) {
    super(message, { cause: options?.cause });
    this.name = 'APIError';
    this.code = code;
    this.httpStatus = options?.httpStatus ?? this.getHttpStatus(code);
    this.extensions = options?.extensions ?? {};

    // Manter stack trace
    if (Error.captureStackTrace) {
      Error.captureStackTrace(this, APIError);
    }
  }

  private getHttpStatus(code: ErrorCode): number {
    switch (code) {
      case ErrorCode.UNAUTHENTICATED:
      case ErrorCode.INVALID_TOKEN:
      case ErrorCode.TOKEN_EXPIRED:
      case ErrorCode.INVALID_CREDENTIALS:
        return 401;
      case ErrorCode.FORBIDDEN:
      case ErrorCode.INSUFFICIENT_PERMISSIONS:
      case ErrorCode.TENANT_ACCESS_DENIED:
        return 403;
      case ErrorCode.BAD_USER_INPUT:
      case ErrorCode.VALIDATION_ERROR:
      case ErrorCode.INVALID_FILTER:
        return 400;
      case ErrorCode.NOT_FOUND:
        return 404;
      case ErrorCode.ALREADY_EXISTS:
      case ErrorCode.CONFLICT:
      case ErrorCode.LEAD_ALREADY_CONVERTED:
      case ErrorCode.OPPORTUNITY_ALREADY_CLOSED:
      case ErrorCode.INVALID_STATE_TRANSITION:
        return 409;
      case ErrorCode.RATE_LIMITED:
      case ErrorCode.TOO_MANY_REQUESTS:
        return 429;
      case ErrorCode.INTERNAL:
      case ErrorCode.DATABASE_ERROR:
        return 500;
      case ErrorCode.SERVICE_UNAVAILABLE:
        return 503;
      default:
        return 500;
    }
  }

  /**
   * Converter para GraphQLError
   */
  toGraphQLError(): GraphQLError {
    return new GraphQLError(this.message, {
      extensions: {
        code: this.code,
        http: { status: this.httpStatus },
        ...this.extensions,
      },
    });
  }
}

/**
 * Fábrica de erros comuns
 */
export const Errors = {
  unauthenticated: (message = 'Authentication required'): APIError =>
    new APIError(ErrorCode.UNAUTHENTICATED, message),

  invalidToken: (message = 'Invalid or expired token'): APIError =>
    new APIError(ErrorCode.INVALID_TOKEN, message),

  tokenExpired: (message = 'Token has expired'): APIError =>
    new APIError(ErrorCode.TOKEN_EXPIRED, message),

  forbidden: (message = 'Access denied'): APIError =>
    new APIError(ErrorCode.FORBIDDEN, message),

  insufficientPermissions: (permission: string): APIError =>
    new APIError(ErrorCode.INSUFFICIENT_PERMISSIONS, `Missing permission: ${permission}`, {
      extensions: { permission },
    }),

  badUserInput: (message: string, details?: Record<string, unknown>): APIError =>
    new APIError(ErrorCode.BAD_USER_INPUT, message, { extensions: { details } }),

  notFound: (resource: string, id?: string): APIError =>
    new APIError(ErrorCode.NOT_FOUND, `${resource} not found${id ? `: ${id}` : ''}`, {
      extensions: { resource, id },
    }),

  conflict: (message: string, details?: Record<string, unknown>): APIError =>
    new APIError(ErrorCode.CONFLICT, message, { extensions: { details } }),

  alreadyExists: (resource: string, field: string, value: string): APIError =>
    new APIError(ErrorCode.ALREADY_EXISTS, `${resource} with ${field} '${value}' already exists`, {
      extensions: { resource, field, value },
    }),

  leadAlreadyConverted: (leadId: string): APIError =>
    new APIError(ErrorCode.LEAD_ALREADY_CONVERTED, 'Lead has already been converted', {
      extensions: { leadId },
    }),

  opportunityAlreadyClosed: (opportunityId: string, status: string): APIError =>
    new APIError(ErrorCode.OPPORTUNITY_ALREADY_CLOSED, `Opportunity is already ${status}`, {
      extensions: { opportunityId, status },
    }),

  invalidStateTransition: (entity: string, from: string, to: string): APIError =>
    new APIError(ErrorCode.INVALID_STATE_TRANSITION, `Cannot transition ${entity} from ${from} to ${to}`, {
      extensions: { entity, from, to },
    }),

  rateLimited: (retryAfter: number): APIError =>
    new APIError(ErrorCode.RATE_LIMITED, 'Too many requests', {
      extensions: { retryAfter },
      httpStatus: 429,
    }),

  queryTooComplex: (complexity: number, max: number): APIError =>
    new APIError(ErrorCode.QUERY_TOO_COMPLEX, `Query complexity ${complexity} exceeds maximum ${max}`, {
      extensions: { complexity, max },
    }),

  queryTooDeep: (depth: number, max: number): APIError =>
    new APIError(ErrorCode.QUERY_TOO_DEEP, `Query depth ${depth} exceeds maximum ${max}`, {
      extensions: { depth, max },
    }),

  internal: (message = 'Internal server error', cause?: Error): APIError =>
    new APIError(ErrorCode.INTERNAL, message, { cause }),
} as const;

/**
 * Formatar erro para resposta GraphQL
 */
export function formatError(error: GraphQLError): GraphQLFormattedError {
  // Se já é um APIError, usar diretamente
  const originalError = error.originalError;

  if (originalError instanceof APIError) {
    return originalError.toGraphQLError();
  }

  // Se é erro de validação GraphQL
  if (error.extensions?.code === 'GRAPHQL_VALIDATION_FAILED') {
    return new GraphQLError(error.message, {
      extensions: {
        code: ErrorCode.GRAPHQL_VALIDATION_FAILED,
        http: { status: 400 },
      },
    });
  }

  // Erro genérico - não vazar detalhes
  return new GraphQLError('Internal server error', {
    extensions: {
      code: ErrorCode.INTERNAL,
      http: { status: 500 },
    },
  });
}
