// =============================================================================
// Authentication Middleware
// =============================================================================

import jwt from 'jsonwebtoken';
import { config } from '@/config/index.js';
import { ContextUser, GraphQLContext } from '@/types/context.js';
import { Errors, APIError, ErrorCode } from '@/types/errors.js';
import { getRedis } from '@/infrastructure/redis/client.js';
import { logger } from '@/infrastructure/logging/index.js';

export interface JWTPayload {
  userId: string;
  email: string;
  tenantId: string;
  role: string;
  iat: number;
  exp: number;
  jti: string; // JWT ID for revocation
}

export interface RefreshTokenPayload {
  userId: string;
  tenantId: string;
  type: 'refresh';
  iat: number;
  exp: number;
  jti: string;
}

/**
 * Verify JWT access token
 */
export function verifyAccessToken(token: string): JWTPayload {
  try {
    return jwt.verify(token, config.JWT_SECRET) as JWTPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw Errors.tokenExpired();
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw Errors.invalidToken();
    }
    throw Errors.invalidToken();
  }
}

/**
 * Verify JWT refresh token
 */
export function verifyRefreshToken(token: string): RefreshTokenPayload {
  try {
    return jwt.verify(token, config.JWT_REFRESH_SECRET) as RefreshTokenPayload;
  } catch {
    throw Errors.invalidToken();
  }
}

/**
 * Generate access token
 */
export function generateAccessToken(user: {
  id: string;
  email: string;
  tenantId: string;
  role: string;
}): string {
  const payload: Omit<JWTPayload, 'iat' | 'exp'> = {
    userId: user.id,
    email: user.email,
    tenantId: user.tenantId,
    role: user.role,
    jti: crypto.randomUUID(),
  };

  return jwt.sign(payload, config.JWT_SECRET, {
    expiresIn: config.JWT_EXPIRES_IN,
  });
}

/**
 * Generate refresh token
 */
export function generateRefreshToken(userId: string, tenantId: string): string {
  const payload: Omit<RefreshTokenPayload, 'iat' | 'exp'> = {
    userId,
    tenantId,
    type: 'refresh',
    jti: crypto.randomUUID(),
  };

  return jwt.sign(payload, config.JWT_REFRESH_SECRET, {
    expiresIn: config.JWT_REFRESH_EXPIRES_IN,
  });
}

/**
 * Check if token is revoked
 */
export async function isTokenRevoked(jti: string, tenantId: string): Promise<boolean> {
  const redis = getRedis();
  const key = `${config.REDIS_PREFIX}${tenantId}:revoked:${jti}`;
  const exists = await redis.exists(key);
  return exists === 1;
}

/**
 * Revoke a token
 */
export async function revokeToken(jti: string, tenantId: string, ttlSeconds: number): Promise<void> {
  const redis = getRedis();
  const key = `${config.REDIS_PREFIX}${tenantId}:revoked:${jti}`;
  await redis.setex(key, ttlSeconds, '1');
}

/**
 * Authentication middleware for Apollo Server
 */
export async function authenticateUser(
  authHeader: string | undefined
): Promise<ContextUser | null> {
  if (!authHeader) {
    return null;
  }

  // Extract token from "Bearer <token>"
  const parts = authHeader.split(' ');
  if (parts.length !== 2 || parts[0] !== 'Bearer') {
    return null;
  }

  const token = parts[1];

  try {
    const payload = verifyAccessToken(token);

    // Check if token is revoked
    const revoked = await isTokenRevoked(payload.jti, payload.tenantId);
    if (revoked) {
      logger.warn('Attempt to use revoked token', {
        jti: payload.jti,
        userId: payload.userId,
      });
      return null;
    }

    return {
      id: payload.userId,
      email: payload.email,
      tenantId: payload.tenantId,
      role: payload.role as ContextUser['role'],
    };
  } catch (error) {
    if (error instanceof APIError) {
      throw error;
    }
    return null;
  }
}

/**
 * Context function for Apollo Server
 */
export async function buildContext({
  req,
}: {
  req: { headers: Record<string, string | undefined> };
}): Promise<Partial<GraphQLContext>> {
  const authHeader = req.headers.authorization;
  const user = await authenticateUser(authHeader);

  const requestId = crypto.randomUUID();
  const correlationId = (req.headers['x-correlation-id'] as string) || requestId;

  return {
    user,
    tenant: user
      ? {
          id: user.tenantId,
          name: '', // Would be loaded from DB
          slug: '',
          plan: 'STARTER' as const,
          settings: {
            defaultCurrency: 'USD',
            fiscalYearStart: 1,
            dateFormat: 'YYYY-MM-DD',
            timezone: 'UTC',
            features: {
              customStages: true,
              advancedReporting: false,
              apiAccess: true,
              ssoEnabled: false,
              maxUsers: 10,
              maxRecords: 10000,
            },
          },
        }
      : null,
    isAuthenticated: !!user,
    requestId,
    correlationId,
    ipAddress: req.headers['x-forwarded-for'] as string,
    userAgent: req.headers['user-agent'],
  };
}
