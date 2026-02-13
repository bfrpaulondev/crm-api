// =============================================================================
// Redis Client - Upstash REST + ioredis fallback
// =============================================================================

import Redis from 'ioredis';
import { config, useUpstash } from '@/config/index.js';
import { logger } from '@/infrastructure/logging/index.js';

// Types
interface UpstashResponse {
  result: string | null;
  error?: string;
}

// Cliente Redis global (ioredis)
let redis: Redis | null = null;

// Upstash REST config
let upstashConfig: { url: string; token: string } | null = null;

/**
 * Conectar ao Redis (ioredis ou Upstash REST)
 */
export function connectToRedis(): Redis | null {
  // Se usando Upstash REST, não precisa de conexão ioredis
  if (useUpstash) {
    upstashConfig = {
      url: config.UPSTASH_REDIS_REST_URL!,
      token: config.UPSTASH_REDIS_REST_TOKEN!,
    };
    logger.info('Upstash Redis REST client configured', { url: config.UPSTASH_REDIS_REST_URL });
    return null;
  }

  // Conexão tradicional com ioredis
  if (redis) {
    return redis;
  }

  if (!config.REDIS_URL) {
    logger.warn('No Redis URL configured, caching disabled');
    return null;
  }

  redis = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    lazyConnect: false,
    keepAlive: 10000,
    connectTimeout: 10000,
    commandTimeout: 5000,
    tls: config.REDIS_URL.startsWith('rediss://') ? {} : undefined,
    retryStrategy: (times: number) => {
      if (times > 3) {
        logger.error('Redis connection failed after 3 retries');
        return null;
      }
      const delay = Math.min(times * 200, 2000);
      logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times})`);
      return delay;
    },
  });

  redis.on('connect', () => {
    logger.info('Redis connected');
  });

  redis.on('error', (error) => {
    logger.error('Redis error', { error: error.message });
  });

  redis.on('close', () => {
    logger.warn('Redis connection closed');
  });

  return redis;
}

/**
 * Obter cliente Redis (ioredis)
 */
export function getRedis(): Redis {
  if (!redis && !useUpstash) {
    throw new Error('Redis not connected. Call connectToRedis() first.');
  }
  return redis!;
}

// =============================================================================
// Upstash REST API Commands
// =============================================================================

async function upstashCommand<T = unknown>(command: string[]): Promise<T | null> {
  if (!upstashConfig) {
    throw new Error('Upstash not configured');
  }

  try {
    // Upstash REST API format: GET https://<endpoint>/<command>/<arg1>/<arg2>/...
    // For commands with arguments, use the command and args in URL path
    const cmdPath = command.map(encodeURIComponent).join('/');
    const response = await fetch(`${upstashConfig.url}/${cmdPath}`, {
      method: 'GET',
      headers: {
        'Authorization': `Bearer ${upstashConfig.token}`,
      },
    });

    if (!response.ok) {
      const errorText = await response.text();
      logger.error('Upstash REST error', { status: response.status, error: errorText });
      return null;
    }

    const data = await response.json() as UpstashResponse;

    if (data.error) {
      logger.error('Upstash command error', { error: data.error });
      return null;
    }

    return data.result as T;
  } catch (error) {
    logger.error('Upstash fetch error', { error: String(error) });
    return null;
  }
}

async function upstashGet(key: string): Promise<string | null> {
  return upstashCommand<string>(['GET', key]);
}

async function upstashSet(key: string, value: string, ttlSeconds?: number): Promise<void> {
  if (ttlSeconds) {
    await upstashCommand(['SETEX', key, String(ttlSeconds), value]);
  } else {
    await upstashCommand(['SET', key, value]);
  }
}

// =============================================================================
// Unified Redis Operations
// =============================================================================

/**
 * Fechar conexão Redis
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    logger.info('Redis connection closed');
  }
  upstashConfig = null;
}

/**
 * Health check do Redis
 */
export async function redisHealthCheck(): Promise<boolean> {
  try {
    if (useUpstash) {
      const result = await upstashCommand<string>(['PING']);
      return result === 'PONG';
    }

    if (!redis) return false;
    const result = await redis.ping();
    return result === 'PONG';
  } catch {
    return false;
  }
}

// =============================================================================
// Cache Utilities
// =============================================================================

/**
 * Criar chave com prefixo do tenant
 */
export function createCacheKey(tenantId: string, ...parts: string[]): string {
  return `${config.REDIS_PREFIX}${tenantId}:${parts.join(':')}`;
}

/**
 * Obter valor do cache (JSON parsed)
 */
export async function cacheGet<T>(key: string): Promise<T | null> {
  let value: string | null = null;

  if (useUpstash) {
    value = await upstashGet(key);
  } else if (redis) {
    value = await redis.get(key);
  } else {
    return null;
  }

  if (!value) return null;

  try {
    return JSON.parse(value) as T;
  } catch {
    return value as unknown as T;
  }
}

/**
 * Definir valor no cache
 */
export async function cacheSet(key: string, value: unknown, ttlSeconds?: number): Promise<void> {
  const serialized = JSON.stringify(value);

  if (useUpstash) {
    await upstashSet(key, serialized, ttlSeconds);
  } else if (redis) {
    if (ttlSeconds) {
      await redis.setex(key, ttlSeconds, serialized);
    } else {
      await redis.set(key, serialized);
    }
  }
}

/**
 * Delete key(s)
 */
export async function cacheDel(...keys: string[]): Promise<number> {
  if (useUpstash) {
    await upstashCommand(['DEL', ...keys]);
    return keys.length;
  }

  if (!redis || keys.length === 0) return 0;
  return redis.del(...keys);
}
