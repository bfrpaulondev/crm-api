// =============================================================================
// User Service
// =============================================================================

import { logger } from '@/infrastructure/logging/index.js';
import { traceServiceOperation } from '@/infrastructure/otel/tracing.js';
import bcrypt from 'bcrypt';
import * as jwt from 'jsonwebtoken';
import { config } from '@/config/index.js';
import { auditLogRepository } from '@/repositories/audit-log.repository.js';
import { stageRepository } from '@/repositories/stage.repository.js';
import { UserRole } from '@/types/entities.js';

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

interface User {
  _id: { toHexString: () => string };
  tenantId: string;
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  createdAt: Date;
  updatedAt: Date;
}

interface Tenant {
  _id: { toHexString: () => string };
  name: string;
  slug: string;
  plan: string;
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

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
  user: User;
  tenant: Tenant;
}

interface LoginData {
  email: string;
  password: string;
  tenantId: string;
}

// Simple in-memory stores (replace with database in production)
const users = new Map<string, User>();
const tenants = new Map<string, Tenant>();
const refreshTokens = new Map<string, { userId: string; expiresAt: Date }>();
const passwordResetTokens = new Map<string, { email: string; tenantId: string; expiresAt: Date }>();

export class UserService {
  async register(data: RegisterData, requestId: string): Promise<AuthResult> {
    return traceServiceOperation('UserService', 'register', async () => {
      // Check if tenant slug already exists
      const existingTenant = Array.from(tenants.values()).find(t => t.slug === data.tenantSlug);
      if (existingTenant) {
        throw new Error('Tenant with this slug already exists');
      }

      // Check if user already exists
      const existingUser = Array.from(users.values()).find(u => u.email === data.email);
      if (existingUser) {
        throw new Error('User with this email already exists');
      }

      // Create tenant
      const tenantId = crypto.randomUUID();
      const tenant: Tenant = {
        _id: { toHexString: () => tenantId },
        name: data.tenantName,
        slug: data.tenantSlug.toLowerCase(),
        plan: 'free',
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      tenants.set(tenantId, tenant);

      // Create default stages for the new tenant
      await this.createDefaultStages(tenantId);

      // Create admin user
      const userId = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);
      const user: User = {
        _id: { toHexString: () => userId },
        tenantId,
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: UserRole.ADMIN,
        isActive: true,
        lastLoginAt: new Date(),
        createdAt: new Date(),
        updatedAt: new Date(),
      };
      users.set(userId, user);

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

      await auditLogRepository.log({
        tenantId,
        entityType: 'User',
        entityId: userId,
        action: 'CREATE',
        actorId: userId,
        actorEmail: user.email,
        changes: { created: { email: user.email, firstName: user.firstName, lastName: user.lastName } },
        metadata: {},
        requestId,
      });

      logger.info('User registered', { userId, email: user.email, tenantId, requestId });

      return { accessToken, refreshToken, user, tenant };
    });
  }

  async login(data: LoginData, requestId: string): Promise<AuthResult> {
    return traceServiceOperation('UserService', 'login', async () => {
      const user = Array.from(users.values()).find(
        u => u.email === data.email.toLowerCase() && u.tenantId === data.tenantId
      );

      if (!user || !user.isActive) {
        throw new Error('Invalid credentials');
      }

      const validPassword = await bcrypt.compare(data.password, user.passwordHash);
      if (!validPassword) {
        throw new Error('Invalid credentials');
      }

      // Get tenant
      const tenant = tenants.get(user.tenantId);
      if (!tenant || !tenant.isActive) {
        throw new Error('Tenant not found or inactive');
      }

      // Update last login
      user.lastLoginAt = new Date();

      // Generate tokens
      const accessToken = jwt.sign(
        {
          userId: user._id.toHexString(),
          tenantId: user.tenantId,
          email: user.email,
          role: user.role,
        },
        config.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const refreshToken = jwt.sign(
        {
          userId: user._id.toHexString(),
          type: 'refresh',
        },
        config.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      await auditLogRepository.log({
        tenantId: user.tenantId,
        entityType: 'User',
        entityId: user._id.toHexString(),
        action: 'LOGIN',
        actorId: user._id.toHexString(),
        actorEmail: user.email,
        changes: {},
        metadata: {},
        requestId,
      });

      logger.info('User logged in', {
        userId: user._id.toHexString(),
        email: user.email,
        tenantId: user.tenantId,
        requestId,
      });

      return { accessToken, refreshToken, user, tenant };
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

      const user = users.get(decoded.userId);
      if (!user || !user.isActive) {
        throw new Error('User not found or inactive');
      }

      const newAccessToken = jwt.sign(
        {
          userId: user._id.toHexString(),
          tenantId: user.tenantId,
          email: user.email,
          role: user.role,
        },
        config.JWT_SECRET,
        { expiresIn: '15m' }
      );

      const newRefreshToken = jwt.sign(
        {
          userId: user._id.toHexString(),
          type: 'refresh',
        },
        config.JWT_REFRESH_SECRET,
        { expiresIn: '7d' }
      );

      return {
        accessToken: newAccessToken,
        refreshToken: newRefreshToken,
      };
    });
  }

  async getUserById(userId: string, tenantId: string): Promise<User | null> {
    const user = users.get(userId);
    if (user && user.tenantId === tenantId) {
      return user;
    }
    return null;
  }

  async getTenantById(tenantId: string): Promise<Tenant | null> {
    return tenants.get(tenantId) || null;
  }

  async getTenantBySlug(slug: string): Promise<Tenant | null> {
    return Array.from(tenants.values()).find(t => t.slug === slug.toLowerCase()) || null;
  }

  async getUsers(tenantId: string): Promise<User[]> {
    return Array.from(users.values()).filter(u => u.tenantId === tenantId);
  }

  async createUser(
    tenantId: string,
    createdBy: string,
    data: { email: string; password: string; firstName: string; lastName: string; role: UserRole },
    requestId: string
  ): Promise<User> {
    return traceServiceOperation('UserService', 'createUser', async () => {
      // Check if user already exists
      const existingUser = Array.from(users.values()).find(
        u => u.email === data.email.toLowerCase() && u.tenantId === tenantId
      );
      if (existingUser) {
        throw new Error('User with this email already exists in this tenant');
      }

      const userId = crypto.randomUUID();
      const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

      const user: User = {
        _id: { toHexString: () => userId },
        tenantId,
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role,
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      users.set(userId, user);

      await auditLogRepository.log({
        tenantId,
        entityType: 'User',
        entityId: userId,
        action: 'CREATE',
        actorId: createdBy,
        actorEmail: '',
        changes: { created: { email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role } },
        metadata: {},
        requestId,
      });

      logger.info('User created', { userId, email: user.email, tenantId, createdBy, requestId });

      return user;
    });
  }

  async changePassword(
    userId: string,
    tenantId: string,
    currentPassword: string,
    newPassword: string
  ): Promise<void> {
    return traceServiceOperation('UserService', 'changePassword', async () => {
      const user = users.get(userId);
      if (!user || user.tenantId !== tenantId) {
        throw new Error('User not found');
      }

      const validPassword = await bcrypt.compare(currentPassword, user.passwordHash);
      if (!validPassword) {
        throw new Error('Current password is incorrect');
      }

      user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      user.updatedAt = new Date();

      logger.info('Password changed', { userId, tenantId });
    });
  }

  async requestPasswordReset(email: string, tenantId: string, resetUrl: string): Promise<void> {
    return traceServiceOperation('UserService', 'requestPasswordReset', async () => {
      const user = Array.from(users.values()).find(
        u => u.email === email.toLowerCase() && u.tenantId === tenantId
      );

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

      const user = Array.from(users.values()).find(
        u => u.email === resetData.email && u.tenantId === tenantId
      );

      if (!user) {
        throw new Error('User not found');
      }

      user.passwordHash = await bcrypt.hash(newPassword, SALT_ROUNDS);
      user.updatedAt = new Date();

      passwordResetTokens.delete(token);

      logger.info('Password reset completed', { email: user.email, tenantId });
    });
  }

  async create(data: CreateUserData, createdBy: string): Promise<User> {
    return traceServiceOperation('UserService', 'create', async () => {
      // Check if user exists
      const existing = Array.from(users.values()).find(
        u => u.email === data.email && u.tenantId === data.tenantId
      );

      if (existing) {
        throw new Error('User with this email already exists');
      }

      const passwordHash = await bcrypt.hash(data.password, SALT_ROUNDS);

      const user: User = {
        _id: { toHexString: () => crypto.randomUUID() },
        tenantId: data.tenantId,
        email: data.email.toLowerCase(),
        passwordHash,
        firstName: data.firstName,
        lastName: data.lastName,
        role: data.role || UserRole.SALES_REP,
        isActive: true,
        lastLoginAt: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      };

      users.set(user._id.toHexString(), user);

      await auditLogRepository.log({
        tenantId: data.tenantId,
        entityType: 'User',
        entityId: user._id.toHexString(),
        action: 'CREATE',
        actorId: createdBy,
        actorEmail: '',
        changes: { created: { email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role } },
        metadata: {},
        requestId: '',
      });

      logger.info('User created', {
        userId: user._id.toHexString(),
        email: user.email,
        tenantId: data.tenantId,
      });

      return user;
    });
  }

  async getById(id: string, tenantId: string): Promise<User | null> {
    const user = users.get(id);
    if (user && user.tenantId === tenantId) {
      return user;
    }
    return null;
  }

  async update(id: string, tenantId: string, updates: Partial<User>, updatedBy: string): Promise<User> {
    const user = users.get(id);
    if (!user || user.tenantId !== tenantId) {
      throw new Error('User not found');
    }

    const oldData = { email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role };

    if (updates.firstName) user.firstName = updates.firstName;
    if (updates.lastName) user.lastName = updates.lastName;
    if (updates.role) user.role = updates.role;
    user.updatedAt = new Date();

    await auditLogRepository.log({
      tenantId,
      entityType: 'User',
      entityId: id,
      action: 'UPDATE',
      actorId: updatedBy,
      actorEmail: '',
      changes: { previous: oldData, current: { email: user.email, firstName: user.firstName, lastName: user.lastName, role: user.role } },
      metadata: {},
      requestId: '',
    });

    logger.info('User updated', { userId: id, tenantId, updatedBy });

    return user;
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
