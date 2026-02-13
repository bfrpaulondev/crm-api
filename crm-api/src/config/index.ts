import dotenv from 'dotenv';
import { z } from 'zod';

// Carregar variáveis de ambiente
dotenv.config();

// Schema de validação das variáveis de ambiente
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.string().transform(Number).default('4000'),
  API_VERSION: z.string().default('1.0.0'),

  // MongoDB
  MONGODB_URI: z.string().url(),
  MONGODB_DB_NAME: z.string().default('crm_api'),
  MONGODB_POOL_SIZE: z.string().transform(Number).default('10'),

  // Redis
  REDIS_URL: z.string().url(),
  REDIS_PREFIX: z.string().default('crm:'),

  // JWT
  JWT_SECRET: z.string().min(32),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Security
  RATE_LIMIT_WINDOW_MS: z.string().transform(Number).default('60000'),
  RATE_LIMIT_MAX_REQUESTS: z.string().transform(Number).default('100'),
  GRAPHQL_DEPTH_LIMIT: z.string().transform(Number).default('10'),
  GRAPHQL_COMPLEXITY_LIMIT: z.string().transform(Number).default('1000'),
  INTROSPECTION_ENABLED: z.string().transform(v => v === 'true').default('true'),
  PLAYGROUND_ENABLED: z.string().transform(v => v === 'true').default('true'),

  // Observability
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().default('crm-api'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),

  // Feature Flags
  ENABLE_PERSISTED_QUERIES: z.string().transform(v => v === 'true').default('true'),
  ENABLE_RESPONSE_CACHE: z.string().transform(v => v === 'true').default('true'),
  ENABLE_SOFT_DELETE: z.string().transform(v => v === 'true').default('true'),

  // File Upload / Storage
  STORAGE_TYPE: z.enum(['local', 's3']).default('local'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE: z.string().transform(Number).default('10485760'), // 10MB in bytes
  ALLOWED_FILE_TYPES: z.string().default('image/jpeg,image/png,image/gif,image/webp,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document'),

  // AWS S3 Configuration
  AWS_S3_BUCKET: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_ENDPOINT: z.string().optional(), // For S3-compatible services (MinIO, etc.)

  // Image Processing
  AVATAR_MAX_WIDTH: z.string().transform(Number).default('400'),
  AVATAR_MAX_HEIGHT: z.string().transform(Number).default('400'),
  IMAGE_QUALITY: z.string().transform(Number).default('85'),
});

// Parse e validação
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = Object.freeze(parsed.data);

// Types export
export type Config = typeof config;

// Feature flags helpers
export const isProduction = config.NODE_ENV === 'production';
export const isDevelopment = config.NODE_ENV === 'development';
export const isTest = config.NODE_ENV === 'test';
