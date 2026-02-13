// =============================================================================
// Rate Limiting Middleware
// =============================================================================

import { config } from '@/config/index.js';
import { getRedis } from '@/infrastructure/redis/client.js';
import { Errors } from '@/types/errors.js';
import { logger } from '@/infrastructure/logging/index.js';

interface RateLimitConfig {
  windowMs: number;
  maxRequests: number;
  keyPrefix: string;
}

const DEFAULT_CONFIG: RateLimitConfig = {
  windowMs: config.RATE_LIMIT_WINDOW_MS,
  maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
  keyPrefix: 'ratelimit',
};

/**
 * Rate limiter using Redis sliding window
 */
export class RateLimiter {
  private readonly config: RateLimitConfig;

  constructor(config?: Partial<RateLimitConfig>) {
    this.config = { ...DEFAULT_CONFIG, ...config };
  }

  /**
   * Check rate limit and return remaining requests
   */
  async checkLimit(identifier: string): Promise<{
    allowed: boolean;
    remaining: number;
    resetAt: Date;
    retryAfter: number;
  }> {
    const redis = getRedis();
    const key = `${config.REDIS_PREFIX}${this.config.keyPrefix}:${identifier}`;
    const now = Date.now();
    const windowStart = now - this.config.windowMs;

    try {
      // Usar Lua script para operação atômica
      const luaScript = `
        local key = KEYS[1]
        local now = tonumber(ARGV[1])
        local windowStart = tonumber(ARGV[2])
        local maxRequests = tonumber(ARGV[3])
        local windowMs = tonumber(ARGV[4])

        -- Remove expired entries
        redis.call('ZREMRANGEBYSCORE', key, 0, windowStart)

        -- Count current entries
        local current = redis.call('ZCARD', key)

        if current < maxRequests then
          -- Add new entry
          redis.call('ZADD', key, now, now .. '-' .. math.random())
          redis.call('PEXPIRE', key, windowMs)
          return {current + 1, maxRequests - current - 1}
        else
          -- Rate limit exceeded
          return {current, 0}
        end
      `;

      const result = (await redis.eval(
        luaScript,
        1,
        key,
        now.toString(),
        windowStart.toString(),
        this.config.maxRequests.toString(),
        this.config.windowMs.toString()
      )) as [number, number];

      const [, remaining] = result;

      const resetAt = new Date(now + this.config.windowMs);

      return {
        allowed: remaining >= 0,
        remaining: Math.max(0, remaining),
        resetAt,
        retryAfter: remaining < 0 ? Math.ceil(this.config.windowMs / 1000) : 0,
      };
    } catch (error) {
      logger.error('Rate limit check failed', { error: String(error) });
      // Em caso de erro, permitir a requisição (fail-open)
      return {
        allowed: true,
        remaining: this.config.maxRequests,
        resetAt: new Date(now + this.config.windowMs),
        retryAfter: 0,
      };
    }
  }

  /**
   * Middleware function for Apollo Server
   */
  createMiddleware() {
    return async (req: { headers: Record<string, string | undefined> }, res: unknown) => {
      // Determinar identificador (IP ou userId)
      const ip = (req.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ||
        req.headers['x-real-ip'] as string ||
        'unknown';

      // Limitar por IP (e depois por userId se autenticado)
      const ipResult = await this.checkLimit(`ip:${ip}`);

      if (!ipResult.allowed) {
        throw Errors.rateLimited(ipResult.retryAfter);
      }

      // Adicionar headers de rate limit à resposta
      if (res && typeof res === 'object') {
        const headers = (res as { setHeader?: (name: string, value: string) => void }).setHeader;
        if (headers) {
          headers('X-RateLimit-Limit', this.config.maxRequests.toString());
          headers('X-RateLimit-Remaining', ipResult.remaining.toString());
          headers('X-RateLimit-Reset', ipResult.resetAt.toISOString());
        }
      }
    };
  }
}

/**
 * Rate limiter para operações específicas
 */
export const operationRateLimiters = {
  // Login attempts
  login: new RateLimiter({
    windowMs: 15 * 60 * 1000, // 15 minutes
    maxRequests: 5,
    keyPrefix: 'login',
  }),

  // Lead conversion
  convertLead: new RateLimiter({
    windowMs: 60 * 1000, // 1 minute
    maxRequests: 10,
    keyPrefix: 'convert',
  }),

  // API geral
  api: new RateLimiter({
    windowMs: config.RATE_LIMIT_WINDOW_MS,
    maxRequests: config.RATE_LIMIT_MAX_REQUESTS,
    keyPrefix: 'api',
  }),
};

/**
 * Check rate limit for a specific operation
 */
export async function checkOperationRateLimit(
  operation: keyof typeof operationRateLimiters,
  identifier: string
): Promise<void> {
  const limiter = operationRateLimiters[operation];
  const result = await limiter.checkLimit(identifier);

  if (!result.allowed) {
    throw Errors.rateLimited(result.retryAfter);
  }
}
