// =============================================================================
// User Service - Authentication & User Management
// =============================================================================

import { getDb } from '@/infrastructure/mongo/connection.js';
import { logger } from '@/infrastructure/logging/index.js';
import { auditLogRepository } from '@/repositories/audit-log.repository.js';
import { emailService } from './email.service.js';
import {
  generateAccessToken,
  generateRefreshToken,
  verifyRefreshToken,
  revokeToken,
  isTokenRevoked,
} from '@/middlewares/auth.middleware.js';
import { Errors } from '@/types/errors.js';
import { User, UserRole } from '@/types/entities.js';
import { ObjectId } from 'mongodb';
import * as crypto from 'crypto';

// =============================================================================
// Types
// =============================================================================

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantName: string;
  tenantSlug: string;
}

export interface LoginInput {
  email: string;
  password: string;
  tenantId: string;
}

export interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: {
    id: string;
    email: string;
    firstName: string;
    lastName: string;
    role: UserRole;
  };
  tenant: {
    id: string;
    name: string;
    slug: string;
  };
}

export interface CreateUserInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string;
}

// =============================================================================
// Password Utilities
// =============================================================================

const SALT_LENGTH = 16;
const HASH_ITERATIONS = 100000;
const HASH_LENGTH = 64;
const HASH_ALGORITHM = 'sha512';

async function hashPassword(password: string): Promise<string> {
  const salt = crypto.randomBytes(SALT_LENGTH).toString('hex');
  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      salt,
      HASH_ITERATIONS,
      HASH_LENGTH,
      HASH_ALGORITHM,
      (err, derivedKey) => {
        if (err) reject(err);
        resolve(`${salt}:${derivedKey.toString('hex')}`);
      }
    );
  });
}

async function verifyPassword(password: string, storedHash: string): Promise<boolean> {
  const [salt, hash] = storedHash.split(':');
  if (!salt || !hash) return false;

  return new Promise((resolve, reject) => {
    crypto.pbkdf2(
      password,
      salt,
      HASH_ITERATIONS,
      HASH_LENGTH,
      HASH_ALGORITHM,
      (err, derivedKey) => {
        if (err) reject(err);
        resolve(derivedKey.toString('hex') === hash);
      }
    );
  });
}

// =============================================================================
// User Service
// =============================================================================

export class UserService {
  /**
   * Register new tenant and admin user
   */
  async register(input: RegisterInput, requestId: string): Promise<AuthResult> {
    const db = getDb();

    // Check if tenant slug is available
    const existingTenant = await db.collection('tenants').findOne({
      slug: input.tenantSlug.toLowerCase(),
    });

    if (existingTenant) {
      throw Errors.conflict('Tenant slug already taken');
    }

    // Check if email is already used
    const existingUser = await db.collection('users').findOne({
      email: input.email.toLowerCase(),
    });

    if (existingUser) {
      throw Errors.alreadyExists('User', 'email', input.email);
    }

    const now = new Date();

    // Create tenant
    const tenantResult = await db.collection('tenants').insertOne({
      name: input.tenantName,
      slug: input.tenantSlug.toLowerCase(),
      plan: 'STARTER',
      isActive: true,
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
          maxUsers: 5,
          maxRecords: 1000,
        },
      },
      createdAt: now,
      updatedAt: now,
    });

    const tenantId = tenantResult.insertedId.toHexString();

    // Create default stages for the tenant
    await this.createDefaultStages(tenantId);

    // Hash password
    const passwordHash = await hashPassword(input.password);

    // Create admin user
    const userResult = await db.collection('users').insertOne({
      tenantId,
      email: input.email.toLowerCase(),
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: UserRole.ADMIN,
      isActive: true,
      lastLoginAt: null,
      preferences: {
        timezone: 'UTC',
        language: 'en',
        emailNotifications: true,
      },
      createdAt: now,
      updatedAt: now,
      createdBy: 'system',
    });

    const userId = userResult.insertedId.toHexString();

    // Generate tokens
    const accessToken = generateAccessToken({
      id: userId,
      email: input.email,
      tenantId,
      role: UserRole.ADMIN,
    });

    const refreshToken = generateRefreshToken(userId, tenantId);

    // Send welcome email (async, don't wait)
    emailService.sendWelcomeEmail(input.email, input.firstName, input.tenantName).catch((err) => {
      logger.error('Failed to send welcome email', { error: String(err) });
    });

    // Log audit
    await auditLogRepository.log({
      tenantId,
      entityType: 'Tenant',
      entityId: tenantId,
      action: 'CREATE',
      actorId: userId,
      actorEmail: input.email,
      changes: { name: input.tenantName, slug: input.tenantSlug },
      metadata: { requestId, operation: 'register' },
      requestId,
    });

    logger.info('New tenant registered', {
      tenantId,
      userId,
      email: input.email,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: userId,
        email: input.email.toLowerCase(),
        firstName: input.firstName,
        lastName: input.lastName,
        role: UserRole.ADMIN,
      },
      tenant: {
        id: tenantId,
        name: input.tenantName,
        slug: input.tenantSlug.toLowerCase(),
      },
    };
  }

  /**
   * Login user
   */
  async login(input: LoginInput, requestId: string): Promise<AuthResult> {
    const db = getDb();

    // Find user
    const user = await db.collection('users').findOne({
      email: input.email.toLowerCase(),
      tenantId: input.tenantId,
      isActive: true,
    });

    if (!user) {
      throw Errors.badUserInput('Invalid email or password');
    }

    // Verify password
    const isValid = await verifyPassword(input.password, user.passwordHash);

    if (!isValid) {
      throw Errors.badUserInput('Invalid email or password');
    }

    // Get tenant
    const tenant = await db.collection('tenants').findOne({
      _id: new ObjectId(input.tenantId),
      isActive: true,
    });

    if (!tenant) {
      throw Errors.badUserInput('Tenant not found or inactive');
    }

    // Update last login
    await db.collection('users').updateOne(
      { _id: user._id },
      { $set: { lastLoginAt: new Date() } }
    );

    // Generate tokens
    const accessToken = generateAccessToken({
      id: user._id.toHexString(),
      email: user.email,
      tenantId: input.tenantId,
      role: user.role,
    });

    const refreshToken = generateRefreshToken(user._id.toHexString(), input.tenantId);

    // Log audit
    await auditLogRepository.log({
      tenantId: input.tenantId,
      entityType: 'User',
      entityId: user._id.toHexString(),
      action: 'UPDATE',
      actorId: user._id.toHexString(),
      actorEmail: user.email,
      changes: { lastLoginAt: new Date() },
      metadata: { requestId, operation: 'login' },
      requestId,
    });

    logger.info('User logged in', {
      userId: user._id.toHexString(),
      tenantId: input.tenantId,
      email: user.email,
    });

    return {
      accessToken,
      refreshToken,
      user: {
        id: user._id.toHexString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      },
      tenant: {
        id: tenant._id.toHexString(),
        name: tenant.name,
        slug: tenant.slug,
      },
    };
  }

  /**
   * Refresh access token
   */
  async refreshToken(token: string): Promise<{ accessToken: string; refreshToken: string }> {
    const payload = verifyRefreshToken(token);

    if (payload.type !== 'refresh') {
      throw Errors.invalidToken();
    }

    // Check if token is revoked
    const revoked = await isTokenRevoked(payload.jti, payload.tenantId);
    if (revoked) {
      throw Errors.invalidToken();
    }

    // Revoke old refresh token
    await revokeToken(payload.jti, payload.tenantId, 86400 * 7);

    // Get user to verify still active
    const db = getDb();
    const user = await db.collection('users').findOne({
      _id: new ObjectId(payload.userId),
      tenantId: payload.tenantId,
      isActive: true,
    });

    if (!user) {
      throw Errors.invalidToken();
    }

    // Generate new tokens
    const accessToken = generateAccessToken({
      id: payload.userId,
      email: user.email,
      tenantId: payload.tenantId,
      role: user.role,
    });

    const refreshToken = generateRefreshToken(payload.userId, payload.tenantId);

    return { accessToken, refreshToken };
  }

  /**
   * Logout (revoke tokens)
   */
  async logout(userId: string, tenantId: string, jti: string): Promise<void> {
    await revokeToken(jti, tenantId, 86400); // 24 hours

    logger.info('User logged out', { userId, tenantId });
  }

  /**
   * Create user (by admin)
   */
  async createUser(
    tenantId: string,
    adminId: string,
    input: CreateUserInput,
    requestId: string
  ): Promise<User> {
    const db = getDb();

    // Check if email exists in tenant
    const existing = await db.collection('users').findOne({
      email: input.email.toLowerCase(),
      tenantId,
    });

    if (existing) {
      throw Errors.alreadyExists('User', 'email', input.email);
    }

    const passwordHash = await hashPassword(input.password);
    const now = new Date();

    const result = await db.collection('users').insertOne({
      tenantId,
      email: input.email.toLowerCase(),
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      isActive: true,
      lastLoginAt: null,
      preferences: {
        timezone: 'UTC',
        language: 'en',
        emailNotifications: true,
      },
      createdAt: now,
      updatedAt: now,
      createdBy: adminId,
    });

    // Log audit
    await auditLogRepository.log({
      tenantId,
      entityType: 'User',
      entityId: result.insertedId.toHexString(),
      action: 'CREATE',
      actorId: adminId,
      actorEmail: '',
      changes: { email: input.email, role: input.role },
      metadata: { requestId },
      requestId,
    });

    logger.info('User created', {
      tenantId,
      userId: result.insertedId.toHexString(),
      email: input.email,
      role: input.role,
    });

    return {
      _id: result.insertedId,
      tenantId,
      email: input.email.toLowerCase(),
      passwordHash,
      firstName: input.firstName,
      lastName: input.lastName,
      role: input.role,
      isActive: true,
      lastLoginAt: null,
      preferences: null,
      createdAt: now,
      updatedAt: now,
    };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(
    email: string,
    tenantId: string,
    resetUrl: string
  ): Promise<void> {
    const db = getDb();

    const user = await db.collection('users').findOne({
      email: email.toLowerCase(),
      tenantId,
      isActive: true,
    });

    if (!user) {
      // Don't reveal if user exists
      logger.warn('Password reset requested for non-existent user', { email, tenantId });
      return;
    }

    // Generate reset token
    const resetToken = crypto.randomBytes(32).toString('hex');
    const resetTokenHash = crypto
      .createHash('sha256')
      .update(resetToken)
      .digest('hex');

    // Store reset token (expires in 1 hour)
    await db.collection('password_resets').insertOne({
      tenantId,
      userId: user._id.toHexString(),
      email: user.email,
      tokenHash: resetTokenHash,
      createdAt: new Date(),
      expiresAt: new Date(Date.now() + 3600000), // 1 hour
    });

    // Send reset email
    await emailService.sendPasswordResetEmail(
      user.email,
      `${user.firstName} ${user.lastName}`,
      resetToken,
      resetUrl
    );

    logger.info('Password reset requested', { email, tenantId });
  }

  /**
   * Reset password with token
   */
  async resetPassword(
    token: string,
    newPassword: string,
    tenantId: string
  ): Promise<boolean> {
    const db = getDb();

    const tokenHash = crypto.createHash('sha256').update(token).digest('hex');

    const resetRecord = await db.collection('password_resets').findOne({
      tokenHash,
      tenantId,
      expiresAt: { $gt: new Date() },
    });

    if (!resetRecord) {
      throw Errors.badUserInput('Invalid or expired reset token');
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update user password
    await db.collection('users').updateOne(
      {
        _id: new ObjectId(resetRecord.userId),
        tenantId,
      },
      {
        $set: {
          passwordHash,
          updatedAt: new Date(),
        },
      }
    );

    // Delete used reset token
    await db.collection('password_resets').deleteOne({ _id: resetRecord._id });

    logger.info('Password reset completed', {
      userId: resetRecord.userId,
      tenantId,
    });

    return true;
  }

  /**
   * Change password
   */
  async changePassword(
    userId: string,
    tenantId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<boolean> {
    const db = getDb();

    const user = await db.collection('users').findOne({
      _id: new ObjectId(userId),
      tenantId,
    });

    if (!user) {
      throw Errors.notFound('User', userId);
    }

    // Verify current password
    const isValid = await verifyPassword(currentPassword, user.passwordHash);

    if (!isValid) {
      throw Errors.badUserInput('Current password is incorrect');
    }

    // Hash new password
    const passwordHash = await hashPassword(newPassword);

    // Update password
    await db.collection('users').updateOne(
      { _id: user._id },
      {
        $set: {
          passwordHash,
          updatedAt: new Date(),
        },
      }
    );

    logger.info('Password changed', { userId, tenantId });

    return true;
  }

  /**
   * Get users by tenant
   */
  async getUsers(tenantId: string): Promise<User[]> {
    const db = getDb();

    return db
      .collection('users')
      .find({ tenantId, deletedAt: null })
      .project({ passwordHash: 0 })
      .toArray() as Promise<User[]>;
  }

  /**
   * Get user by ID
   */
  async getUserById(userId: string, tenantId: string): Promise<User | null> {
    const db = getDb();

    return db.collection('users').findOne(
      {
        _id: new ObjectId(userId),
        tenantId,
        deletedAt: null,
      },
      { projection: { passwordHash: 0 } }
    ) as Promise<User | null>;
  }

  /**
   * Update user
   */
  async updateUser(
    userId: string,
    tenantId: string,
    updates: Partial<{
      firstName: string;
      lastName: string;
      role: UserRole;
      isActive: boolean;
      preferences: Record<string, unknown>;
    }>,
    actorId: string
  ): Promise<User | null> {
    const db = getDb();

    const result = await db.collection('users').findOneAndUpdate(
      {
        _id: new ObjectId(userId),
        tenantId,
        deletedAt: null,
      },
      {
        $set: {
          ...updates,
          updatedAt: new Date(),
          updatedBy: actorId,
        },
      },
      {
        returnDocument: 'after',
        projection: { passwordHash: 0 },
      }
    );

    return result as User | null;
  }

  /**
   * Delete user (soft delete)
   */
  async deleteUser(userId: string, tenantId: string, actorId: string): Promise<boolean> {
    const db = getDb();

    const result = await db.collection('users').updateOne(
      {
        _id: new ObjectId(userId),
        tenantId,
        deletedAt: null,
      },
      {
        $set: {
          deletedAt: new Date(),
          isActive: false,
          updatedAt: new Date(),
          updatedBy: actorId,
        },
      }
    );

    return result.modifiedCount > 0;
  }

  /**
   * Create default stages for new tenant
   */
  private async createDefaultStages(tenantId: string): Promise<void> {
    const db = getDb();
    const now = new Date();

    const defaultStages = [
      { name: 'Discovery', order: 1, probability: 10, color: '#3498db' },
      { name: 'Qualification', order: 2, probability: 25, color: '#9b59b6' },
      { name: 'Proposal', order: 3, probability: 50, color: '#f1c40f' },
      { name: 'Negotiation', order: 4, probability: 75, color: '#e67e22' },
      { name: 'Closed Won', order: 5, probability: 100, color: '#27ae60', isWonStage: true },
      { name: 'Closed Lost', order: 6, probability: 0, color: '#e74c3c', isLostStage: true },
    ];

    await db.collection('stages').insertMany(
      defaultStages.map((stage) => ({
        tenantId,
        ...stage,
        isWonStage: stage.isWonStage || false,
        isLostStage: stage.isLostStage || false,
        isActive: true,
        description: null,
        createdAt: now,
        updatedAt: now,
      }))
    );
  }

  /**
   * Get tenant by ID
   */
  async getTenantById(tenantId: string) {
    const db = getDb();

    return db.collection('tenants').findOne({
      _id: new ObjectId(tenantId),
      isActive: true,
    });
  }

  /**
   * Get tenant by slug
   */
  async getTenantBySlug(slug: string) {
    const db = getDb();

    return db.collection('tenants').findOne({
      slug: slug.toLowerCase(),
      isActive: true,
    });
  }
}

// Singleton export
export const userService = new UserService();
