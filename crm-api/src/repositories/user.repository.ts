// =============================================================================
// User Repository
// =============================================================================

import { BaseRepository } from './base.repository.js';
import { User, UserRole } from '@/types/entities.js';
import { Filter, ObjectId } from 'mongodb';

export class UserRepository extends BaseRepository<User> {
  protected collectionName = 'users';

  async findByEmail(email: string, tenantId: string): Promise<User | null> {
    return this.findOne({ email: email.toLowerCase() } as Filter<User>, tenantId);
  }

  async findByEmailGlobally(email: string): Promise<User | null> {
    const collection = this.getCollection();
    return collection.findOne({ email: email.toLowerCase() }) as Promise<User | null>;
  }

  async findAllByTenant(tenantId: string): Promise<User[]> {
    return this.findAll(tenantId);
  }

  async updateLastLogin(userId: string, tenantId: string): Promise<void> {
    await this.updateById(userId, tenantId, { lastLoginAt: new Date() } as Partial<User>);
  }

  async updatePassword(userId: string, tenantId: string, passwordHash: string): Promise<void> {
    await this.updateById(userId, tenantId, { passwordHash } as Partial<User>);
  }

  async updateProfile(userId: string, tenantId: string, updates: { firstName?: string; lastName?: string; role?: UserRole }): Promise<User | null> {
    return this.updateById(userId, tenantId, updates as Partial<User>);
  }

  async deactivate(userId: string, tenantId: string): Promise<void> {
    await this.updateById(userId, tenantId, { isActive: false } as Partial<User>);
  }

  async activate(userId: string, tenantId: string): Promise<void> {
    await this.updateById(userId, tenantId, { isActive: true } as Partial<User>);
  }
}

export const userRepository = new UserRepository();
