import Redis from 'ioredis';
import { config } from '@/config/index.js';
import { logger } from '@/infrastructure/logging/index.js';

// Cliente Redis global
let redis: Redis | null = null;

/**
 * Conectar ao Redis
 */
export function connectToRedis(): Redis {
  if (redis) {
    return redis;
  }

  redis = new Redis(config.REDIS_URL, {
    maxRetriesPerRequest: 3,
    retryDelayOnFailover: 100,
    lazyConnect: false,
    keepAlive: 10000,
    connectTimeout: 10000,
    commandTimeout: 5000,
    // Retry strategy
    retryStrategy: (times: number) => {
      if (times > 3) {
        logger.error('Redis connection failed after 3 retries');
        return null; // Para de tentar
      }
      const delay = Math.min(times * 200, 2000);
      logger.warn(`Redis reconnecting in ${delay}ms (attempt ${times})`);
      return delay;
    },
  });

  // Eventos
  redis.on('connect', () => {
    logger.info('Redis connected', { url: config.REDIS_URL.replace(/:[^:@]+@/, ':****@') });
  });

  redis.on('error', (error) => {
    logger.error('Redis error', { error: error.message });
  });

  redis.on('close', () => {
    logger.warn('Redis connection closed');
  });

  redis.on('reconnecting', () => {
    logger.info('Redis reconnecting...');
  });

  return redis;
}

/**
 * Obter cliente Redis
 */
export function getRedis(): Redis {
  if (!redis) {
    throw new Error('Redis not connected. Call connectToRedis() first.');
  }
  return redis;
}

/**
 * Fechar conexão Redis
 */
export async function closeRedis(): Promise<void> {
  if (redis) {
    await redis.quit();
    redis = null;
    logger.info('Redis connection closed');
  }
}

/**
 * Health check do Redis
 */
export async function redisHealthCheck(): Promise<boolean> {
  try {
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
  const client = getRedis();
  const value = await client.get(key);

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
  const client = getRedis();
  const serialized = JSON.stringify(value);

  if (ttlSeconds) {
    await client.setex(key, ttlSeconds, serialized);
  } else {
    await client.set(key, serialized);
  }
}

/**
 * Invalidar cache por padrão
 */
export async function cacheInvalidate(pattern: string): Promise<number> {
  const client = getRedis();

  // Usar SCAN para evitar bloqueio em produção
  let cursor = '0';
  let deleted = 0;

  do {
    const result = await client.scan(cursor, 'MATCH', pattern, 'COUNT', 100);
    cursor = result[0];
    const keys = result[1];

    if (keys.length > 0) {
      await client.del(...keys);
      deleted += keys.length;
    }
  } while (cursor !== '0');

  return deleted;
}

/**
 * Invalidar cache por tags (usando SETs)
 */
export async function cacheInvalidateByTag(tenantId: string, tag: string): Promise<number> {
  const client = getRedis();
  const tagKey = createCacheKey(tenantId, 'tags', tag);

  // Obter todas as chaves com esta tag
  const keys = await client.smembers(tagKey);

  if (keys.length === 0) return 0;

  // Remover as chaves e o tag set
  await client.del(...keys, tagKey);

  return keys.length;
}
