// =============================================================================
// User Service - Using MongoDB for persistence
// =============================================================================

import { logger } from '@/infrastructure/logging/index.js';
import { traceServiceOperation } from '@/infrastructure/otel/tracing.js';
import bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { config } from '@/config/index.js';
import { auditLogRepository } from '@/repositories/audit-log.repository.js';
import { stageRepository } from '@/repositories/stage.repository.js';
import { userRepository } from '@/repositories/user.repository.js';
import { tenantRepository } from '@/repositories/tenant.repository.js';
import { UserRole } from '@/types/entities.js';
import { ObjectId } from 'mongodb';

const SALT_ROUNDS = 12;

// Default stages for new tenants
const DEFAULT_STAGES = [
  { name: 'Discovery', order: 1, probability: 10, isWonStage: false, isLostStage: false, color: '#3498db', description: 'Initial discovery and research' },
  { name: 'Qualification', order: 2, probability: 25, isWonStage: false, isLostStage: false, color: '#9b59b6', description: 'Qualifying the lead' },
  { name: 'Proposal', order: 3, probability: 50, isWonStage: false, isLostStage: false, color: '#f1c40f', description: 'Proposal sent' },
  { name: 'Negotiation', order: 4, probability: 75, isWonStage: false, isLostStage: false, color: '#e67e22', description: 'Negotiating terms' },
  { name: 'Closed Won', order: 5, probability: 100, isWonStage: true, isLostStage: false, color: '#27ae60', description: 'Deal closed successfully' },
  { name: 'Closed Lost', order: 6, probability: 0, isWonStage: false, isLostStage: true, color: '#e74c3c', description: 'Deal lost' },
];

interface CreateUserData {
  tenantId: string;
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  role?: UserRole;
}

interface RegisterData {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantName: string;
  tenantSlug: string;
}

interface AuthResult {
  accessToken: string;
  refreshToken: string;
  user: any;
  tenant: any;
}

interface LoginData {
  email: string;
  password: string;
  tenantId: string;
}

// In-memory stores for refresh tokens (can be moved to Redis later)
const refreshTokens = new Map<string, { userId: string; tenantId: string; expiresAt: Date }>();
const passwordResetTokens = new Map<string, { email: string; tenantId: string; expiresAt: Date }>();

export class UserService {
  async register(data: RegisterData, requestId: string): Promise<AuthResult> {
    return traceServiceOperation('UserService', 'register', async () => {
      // Check if tenant slug already exists
      const existingTenant = await tenantRepository.findBySlug(data.tenantSlug);
      if (existingTenant) {
        throw new Error('Tenant with this slug already exists');
      }

      // Check if user already exists globally
      const existingUser = await userRepository.findByEmailGlobally(data.email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Create tenant
      const tenant = await tenantRepository.create({
        name: data.tenantName,
        slug: data.tenantSlug.toLowerCase(),
        plan: 'FREE',
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
            maxUsers: 10,
            maxRecords: 10000,
          },
        },
        deletedAt: null,
      } as any);

      const tenantId = tenant._id.toHexString();

      // Create default stages for the new tenant
      await this.createDefaultStages(tenantId);

      // Create admin user
      const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
      const user = await userRepository.create({
        tenantId,
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: UserRole.ADMIN,
        isActive: true,
        lastLoginAt: new Date(),
        preferences: {
          timezone: 'UTC',
          language: 'en',
          emailNotifications: true,
        },
        deletedAt: null,
      } as any);

      const userId = user._id.toHexString();

      // Generate tokens
      const accessToken = jwt.sign(
        { userId, tenantId, email: user.email, role: user.role },
        config.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const refreshToken = jwt.sign(
        { userId, type: 'refresh' },
        config.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      // Store refresh token
      refreshTokens.set(refreshToken, { userId, tenantId, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });

      await auditLogRepository.log({
        tenantId,
        entityType: 'User',
        entityId: userId,
        action: 'CREATE' as any,
        actorId: userId,
        actorEmail: user.email,
        changes: { created: { email: user.email, firstName: user.firstName, lastName: user.lastName } },
        metadata: {},
        requestId,
      });

      logger.info('User registered', { userId, email: user.email, tenantId, requestId });

      return {
        accessToken,
        refreshToken,
        user: {
          _id: user._id,
          tenantId: user.tenantId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          toHexString: () => userId,
        },
        tenant: {
          _id: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
          plan: tenant.plan,
          toHexString: () => tenantId,
        },
      };
    });
  }

  async login(data: LoginData, requestId: string): Promise<AuthResult> {
    return traceServiceOperation('UserService', 'login', async () => {
      const user = await userRepository.findByEmail(data.email, data.tenantId);

      if (!user || !user.isActive) {
        throw new Error('Invalid credentials');
      }

      const validPassword = await bcrypt.compare(data.password, user.passwordHash);
      if (!validPassword) {
        throw new Error('Invalid credentials');
      }

      // Get tenant
      const tenant = await tenantRepository.findByIdGlobally(data.tenantId);
      if (!tenant || !tenant.isActive) {
        throw new Error('Tenant not found or inactive');
      }

      // Update last login
      await userRepository.updateLastLogin(user._id.toHexString(), data.tenantId);

      const userId = user._id.toHexString();
      const tenantId = tenant._id.toHexString();

      // Generate tokens
      const accessToken = jwt.sign(
        { userId, tenantId, email: user.email, role: user.role },
        config.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const refreshToken = jwt.sign(
        { userId, type: 'refresh' },
        config.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      // Store refresh token
      refreshTokens.set(refreshToken, { userId, tenantId, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });

      await auditLogRepository.log({
        tenantId: user.tenantId,
        entityType: 'User',
        entityId: userId,
        action: 'LOGIN' as any,
        actorId: userId,
        actorEmail: user.email,
        changes: {},
        metadata: {},
        requestId,
      });

      logger.info('User logged in', { userId, email: user.email, tenantId, requestId });

      return {
        accessToken,
        refreshToken,
        user: {
          _id: user._id,
          tenantId: user.tenantId,
          email: user.email,
          firstName: user.firstName,
          lastName: user.lastName,
          role: user.role,
          toHexString: () => userId,
        },
        tenant: {
          _id: tenant._id,
          name: tenant.name,
          slug: tenant.slug,
          plan: tenant.plan,
          toHexString: () => tenantId,
        },
      };
    });
  }

  async refreshToken(refreshToken: string): Promise<{ accessToken: string; refreshToken: string }> {
    return traceServiceOperation('UserService', 'refreshToken', async () => {
      const decoded = jwt.verify(refreshToken, config.JWT_REFRESH_SECRET) as {
        userId: string;
        type: string;
      };

      if (decoded.type !== 'refresh') {
        throw new Error('Invalid token type');
      }

      const tokenData = refreshTokens.get(refreshToken);
      if (!tokenData) {
        throw new Error('Invalid refresh token');
      }

      const user = await userRepository.getById(decoded.userId, tokenData.tenantId);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      const userId = user._id.toHexString();
      const tenantId = user.tenantId;

      const newAccessToken = jwt.sign(
        { userId, tenantId, email: user.email, role: user.role },
        config.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const newRefreshToken = jwt.sign(
        { userId, type: 'refresh' },
        config.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      // Remove old refresh token and add new one
      refreshTokens.delete(refreshToken);
      refreshTokens.set(newRefreshToken, { userId, tenantId, expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) });

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    });
  }

  async getUserById(userId: string, tenantId: string): Promise<any | null> {
    const user = await userRepository.getById(userId, tenantId);
    if (!user) return null;
    return {
      ...user,
      toHexString: () => user._id.toHexString(),
    };
  }

  async getTenantById(tenantId: string): Promise<any | null> {
    const tenant = await tenantRepository.findByIdGlobally(tenantId);
    if (!tenant) return null;
    return {
      ...tenant,
      toHexString: () => tenant._id.toHexString(),
    };
  }

  async getTenantBySlug(slug: string): Promise<any | null> {
    const tenant = await tenantRepository.findBySlug(slug);
    if (!tenant) return null;
    return {
      ...tenant,
      toHexString: () => tenant._id.toHexString(),
    };
  }

  async getUsers(tenantId: string): Promise<any[]> {
    return userRepository.findAllByTenant(tenantId);
  }

  async createUser(
    tenantId: string,
    createdBy: string,
    data: { email: string; password: string; firstName: string; lastName: string; role: UserRole },
    requestId: string
  ): Promise<any> {
    return traceServiceOperation('UserService', 'createUser', async () => {
      // Check if user already exists
      const existingUser = await userRepository.findByEmail(data.email, tenantId);
      if (existingUser) {
        throw new Error('User with this email already exists in this tenant');
      }

      const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

      const user = await userRepository.create({
        tenantId,
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        isActive: true,
        lastLoginAt: null,
        preferences: {
          timezone: 'UTC',
          language: 'en',
          emailNotifications: true,
        },
        deletedAt: null,
      } as any);

      const userId = user._id.toHexString();

      await auditLogRepository.log({
        tenantId,
        entityType: 'User',
        entityId: userId,
        action: 'CREATE' as any,
        actorId: createdBy,
        actorEmail: '',
        changes: { created: { email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role } },
        metadata: {},
        requestId,
      });

      logger.info('User created', { userId, email: user.email, tenantId, createdBy, requestId });

      return {
        ...user,
        toHexString: () => userId,
      };
    });
  }

  async changePassword(
    userId: string,
    tenantId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    return traceServiceOperation('UserService', 'changePassword', async () => {
      const user = await userRepository.getById(userId, tenantId);
      if (!user) {
        throw new Error('User not found');
      }

      const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!validPassword) {
        throw new Error('Current password is incorrect');
      }

      const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      await userRepository.updatePassword(userId, tenantId, passwordHash);

      logger.info('Password changed', { userId, tenantId });
    });
  }

  async requestPasswordReset(email: string, tenantId: string, resetUrl: string): Promise<void> {
    return traceServiceOperation('UserService', 'requestPasswordReset', async () => {
      const user = await userRepository.findByEmail(email, tenantId);

      // Always succeed to not reveal if user exists
      if (!user) {
        logger.info('Password reset requested for non-existent user', { email, tenantId });
        return;
      }

      // Generate reset token
      const resetToken = crypto.randomUUID();
      const expiresAt = new Date(Date.now() + 3600000); // 1 hour

      passwordResetTokens.set(resetToken, {
        email: email.toLowerCase(),
        tenantId,
        expiresAt,
      });

      // In production, send email with resetUrl containing the token
      logger.info('Password reset token generated', { email, tenantId, resetToken, resetUrl });
    });
  }

  async resetPassword(token: string, newPassword: string, tenantId: string): Promise<void> {
    return traceServiceOperation('UserService', 'resetPassword', async () => {
      const resetData = passwordResetTokens.get(token);

      if (!resetData) {
        throw new Error('Invalid or expired reset token');
      }

      if (resetData.expiresAt < new Date()) {
        passwordResetTokens.delete(token);
        throw new Error('Reset token has expired');
      }

      if (resetData.tenantId !== tenantId) {
        throw new Error('Invalid reset token');
      }

      const user = await userRepository.findByEmail(resetData.email, tenantId);

      if (!user) {
        throw new Error('User not found');
      }

      const passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      await userRepository.updatePassword(user._id.toHexString(), tenantId, passwordHash);

      passwordResetTokens.delete(token);

      logger.info('Password reset completed', { email: user.email, tenantId });
    });
  }

  async create(data: CreateUserData, createdBy: string): Promise<any> {
    return traceServiceOperation('UserService', 'create', async () => {
      // Check if user exists
      const existing = await userRepository.findByEmail(data.email, data.tenantId);

      if (existing) {
        throw new Error('User with this email already exists');
      }

      const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

      const user = await userRepository.create({
        tenantId: data.tenantId,
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || UserRole.SALES_REP,
        isActive: true,
        lastLoginAt: null,
        preferences: {
          timezone: 'UTC',
          language: 'en',
          emailNotifications: true,
        },
        deletedAt: null,
      } as any);

      const userId = user._id.toHexString();

      await auditLogRepository.log({
        tenantId: data.tenantId,
        entityType: 'User',
        entityId: userId,
        action: 'CREATE' as any,
        actorId: createdBy,
        actorEmail: '',
        changes: { created: { email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role } },
        metadata: {},
        requestId: '',
      });

      logger.info('User created', {
        userId,
        email: user.email,
        tenantId: data.tenantId,
      });

      return {
        ...user,
        toHexString: () => userId,
      };
    });
  }

  async getById(id: string, tenantId: string): Promise<any | null> {
    const user = await userRepository.getById(id, tenantId);
    if (!user) return null;
    return {
      ...user,
      toHexString: () => user._id.toHexString(),
    };
  }

  async update(id: string, tenantId: string, updates: Partial<any>, updatedBy: string): Promise<any> {
    const user = await userRepository.getById(id, tenantId);
    if (!user) {
      throw new Error('User not found');
    }

    const oldData = { email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role };

    const updateData: any = {};
    if (updates.firstName) updateData.firstName = updates.firstName;
    if (updates.lastName) updateData.lastName = updates.lastName;
    if (updates.role) updateData.role = updates.role;

    const updatedUser = await userRepository.updateProfile(id, tenantId, updateData);

    await auditLogRepository.log({
      tenantId,
      entityType: 'User',
      entityId: id,
      action: 'UPDATE' as any,
      actorId: updatedBy,
      actorEmail: '',
      changes: { previous: oldData, current: { email: user.email, firstName: updateData.firstName || user.firstName, lastName: updateData.lastName || user.lastName, role: updateData.role || user.role } },
      metadata: {},
      requestId: '',
    });

    logger.info('User updated', { userId: id, tenantId, updatedBy });

    return {
      ...updatedUser,
      toHexString: () => id,
    };
  }

  // Create default stages for a new tenant
  private async createDefaultStages(tenantId: string): Promise<void> {
    for (const stage of DEFAULT_STAGES) {
      await stageRepository.create({
        tenantId,
        name: stage.name,
        order: stage.order,
        probability: stage.probability,
        isWonStage: stage.isWonStage,
        isLostStage: stage.isLostStage,
        isActive: true,
        color: stage.color,
        description: stage.description,
        deletedAt: null,
      } as any);
    }

    logger.info('Default stages created for tenant', { tenantId, count: DEFAULT_STAGES.length });
  }
}

export const userService = new UserService();
