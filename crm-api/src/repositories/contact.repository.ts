// =============================================================================
// Contact Repository
// =============================================================================

import { BaseRepository, PaginatedResult } from './base.repository.js';
import { Contact } from '@/types/entities.js';
import { Filter, ObjectId } from 'mongodb';
import { ContactFilter } from '@/types/validation.js';

export class ContactRepository extends BaseRepository<Contact> {
  protected collectionName = 'contacts';

  async findByEmail(email: string, tenantId: string): Promise<Contact | null> {
    return this.findOne({ email: email.toLowerCase() } as Filter<Contact>, tenantId);
  }

  async emailExists(email: string, tenantId: string, excludeId?: string): Promise<boolean> {
    const filter: Filter<Contact> = { email: email.toLowerCase() };
    if (excludeId) {
      filter._id = { $ne: new ObjectId(excludeId) };
    }
    return this.exists(filter, tenantId);
  }

  async findWithFilters(
    tenantId: string,
    filter?: ContactFilter,
    pagination?: { limit?: number; cursor?: string }
  ): Promise<PaginatedResult<Contact>> {
    const queryFilter: Filter<Contact> = {};

    if (filter) {
      if (filter.accountId) queryFilter.accountId = filter.accountId;
      if (filter.ownerId) queryFilter.ownerId = filter.ownerId;
      if (filter.isPrimary !== undefined) queryFilter.isPrimary = filter.isPrimary;
      if (filter.isDecisionMaker !== undefined) queryFilter.isDecisionMaker = filter.isDecisionMaker;

      if (filter.search) {
        queryFilter.$or = [
          { firstName: { $regex: filter.search, $options: 'i' } },
          { lastName: { $regex: filter.search, $options: 'i' } },
          { email: { $regex: filter.search, $options: 'i' } },
          { title: { $regex: filter.search, $options: 'i' } },
        ];
      }
    }

    return this.findMany({ filter: queryFilter, pagination }, tenantId);
  }

  async findByAccount(accountId: string, tenantId: string): Promise<Contact[]> {
    return this.findAll(tenantId, { accountId } as Filter<Contact>);
  }

  async findByOwner(ownerId: string, tenantId: string): Promise<Contact[]> {
    return this.findAll(tenantId, { ownerId } as Filter<Contact>);
  }

  async setPrimary(id: string, tenantId: string, userId?: string): Promise<Contact | null> {
    return this.updateById(id, tenantId, { isPrimary: true }, userId);
  }

  async setDecisionMaker(id: string, tenantId: string, userId?: string): Promise<Contact | null> {
    return this.updateById(id, tenantId, { isDecisionMaker: true }, userId);
  }
}

export const contactRepository = new ContactRepository();
