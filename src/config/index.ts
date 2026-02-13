import dotenv from 'dotenv';
import { z } from 'zod';

// Carregar variáveis de ambiente
dotenv.config();

// Schema de validação das variáveis de ambiente
const envSchema = z.object({
  // Application
  NODE_ENV: z.enum(['development', 'test', 'staging', 'production']).default('development'),
  PORT: z.coerce.number().default(4000),
  API_VERSION: z.string().default('1.0.0'),
  RENDER: z.string().optional(), // Set by Render automatically

  // MongoDB
  MONGODB_URI: z.string().default('mongodb://localhost:27017/crm_api'),
  MONGODB_DB_NAME: z.string().default('crm_api'),
  MONGODB_POOL_SIZE: z.coerce.number().default(10),

  // Redis - Traditional URL
  REDIS_URL: z.string().optional(),
  REDIS_PREFIX: z.string().default('crm:'),

  // Redis - Upstash (REST API)
  UPSTASH_REDIS_REST_URL: z.string().optional(),
  UPSTASH_REDIS_REST_TOKEN: z.string().optional(),

  // CORS
  CORS_ORIGINS: z.string().default('*'),

  // JWT
  JWT_SECRET: z.string().min(32).default('dev-jwt-secret-change-in-production-32ch'),
  JWT_EXPIRES_IN: z.string().default('15m'),
  JWT_REFRESH_SECRET: z.string().min(32).default('dev-refresh-secret-change-in-prod-32ch'),
  JWT_REFRESH_EXPIRES_IN: z.string().default('7d'),

  // Security
  RATE_LIMIT_WINDOW_MS: z.coerce.number().default(60000),
  RATE_LIMIT_MAX_REQUESTS: z.coerce.number().default(100),
  GRAPHQL_DEPTH_LIMIT: z.coerce.number().default(10),
  GRAPHQL_COMPLEXITY_LIMIT: z.coerce.number().default(1000),
  INTROSPECTION_ENABLED: z.coerce.boolean().default(true),
  PLAYGROUND_ENABLED: z.coerce.boolean().default(true),

  // Observability
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_SERVICE_NAME: z.string().default('crm-api'),
  LOG_LEVEL: z.enum(['trace', 'debug', 'info', 'warn', 'error', 'fatal']).default('info'),
  LOG_FORMAT: z.enum(['json', 'pretty']).default('json'),

  // Feature Flags
  ENABLE_PERSISTED_QUERIES: z.coerce.boolean().default(true),
  ENABLE_RESPONSE_CACHE: z.coerce.boolean().default(true),
  ENABLE_SOFT_DELETE: z.coerce.boolean().default(true),

  // File Upload / Storage
  STORAGE_TYPE: z.enum(['local', 's3']).default('local'),
  UPLOAD_DIR: z.string().default('./uploads'),
  MAX_FILE_SIZE: z.coerce.number().default(10485760), // 10MB in bytes
  ALLOWED_FILE_TYPES: z.string().default('image/jpeg,image/png,image/gif,image/webp,application/pdf,text/csv,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.openxmlformats-officedocument.wordprocessingml.document'),

  // AWS S3 Configuration
  AWS_S3_BUCKET: z.string().optional(),
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_REGION: z.string().default('us-east-1'),
  AWS_S3_ENDPOINT: z.string().optional(), // For S3-compatible services (MinIO, etc.)

  // Image Processing
  AVATAR_MAX_WIDTH: z.coerce.number().default(400),
  AVATAR_MAX_HEIGHT: z.coerce.number().default(400),
  IMAGE_QUALITY: z.coerce.number().default(85),
});

// Parse e validação
const parsed = envSchema.safeParse(process.env);

if (!parsed.success) {
  console.error('❌ Invalid environment variables:', parsed.error.flatten().fieldErrors);
  process.exit(1);
}

export const config = Object.freeze(parsed.data);

// Warn if using default secrets in production
if (config.NODE_ENV === 'production') {
  if (config.JWT_SECRET === 'dev-jwt-secret-change-in-production-32ch') {
    console.warn('⚠️ WARNING: Using default JWT_SECRET in production! Please set a secure secret.');
  }
  if (config.JWT_REFRESH_SECRET === 'dev-refresh-secret-change-in-prod-32ch') {
    console.warn('⚠️ WARNING: Using default JWT_REFRESH_SECRET in production! Please set a secure secret.');
  }
  if (config.MONGODB_URI === 'mongodb://localhost:27017/crm_api') {
    console.warn('⚠️ WARNING: Using default MONGODB_URI. Please configure your MongoDB connection.');
  }
}

// Types export
export type Config = typeof config;

// Feature flags helpers
export const isProduction = config.NODE_ENV === 'production';
export const isDevelopment = config.NODE_ENV === 'development';
export const isTest = config.NODE_ENV === 'test';

// Upstash Redis helper
export const useUpstash = !!(config.UPSTASH_REDIS_REST_URL && config.UPSTASH_REDIS_REST_TOKEN);

// CORS origins as array
export const corsOrigins = config.CORS_ORIGINS === '*'
  ? '*'
  : config.CORS_ORIGINS.split(',').map(origin => origin.trim());
