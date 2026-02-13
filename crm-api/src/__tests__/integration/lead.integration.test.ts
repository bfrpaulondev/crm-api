// =============================================================================
// Integration Tests - Lead Repository
// =============================================================================

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest';
import { MongoClient, ObjectId } from 'mongodb';
import { LeadRepository } from '@/repositories/lead.repository.js';
import { Lead, LeadStatus, LeadSource } from '@/types/entities.js';

// Test configuration
const MONGODB_URI = process.env.TEST_MONGODB_URI || 'mongodb://localhost:27017';
const TEST_DB = 'crm_api_test';

describe('LeadRepository Integration Tests', () => {
  let client: MongoClient;
  let repository: LeadRepository;

  beforeAll(async () => {
    client = new MongoClient(MONGODB_URI);
    await client.connect();

    const db = client.db(TEST_DB);
    repository = new LeadRepository();

    // Override the db property
    (repository as any).db = db;
  });

  afterAll(async () => {
    await client.db(TEST_DB).dropDatabase();
    await client.close();
  });

  beforeEach(async () => {
    // Clear leads collection before each test
    await client.db(TEST_DB).collection('leads').deleteMany({});
  });

  // ===========================================================================
  // Create Tests
  // ===========================================================================

  describe('create', () => {
    it('should create a lead with all fields', async () => {
      const leadData = {
        tenantId: 'tenant-1',
        ownerId: 'owner-1',
        status: LeadStatus.NEW,
        source: LeadSource.WEBSITE,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@test.com',
        phone: '+1234567890',
        companyName: 'Acme Corp',
        title: 'CEO',
        website: 'https://acme.com',
        industry: 'Technology',
        tags: ['enterprise', 'priority'],
        score: 50,
        notes: 'Important lead',
        createdBy: 'user-1',
      };

      const result = await repository.create(leadData);

      expect(result._id).toBeDefined();
      expect(result.tenantId).toBe('tenant-1');
      expect(result.firstName).toBe('John');
      expect(result.email).toBe('john.doe@test.com');
      expect(result.status).toBe(LeadStatus.NEW);
      expect(result.createdAt).toBeInstanceOf(Date);
      expect(result.updatedAt).toBeInstanceOf(Date);
    });
  });

  // ===========================================================================
  // FindById Tests
  // ===========================================================================

  describe('findById', () => {
    it('should find lead by id within tenant', async () => {
      // Create lead
      const created = await repository.create({
        tenantId: 'tenant-1',
        ownerId: 'owner-1',
        status: LeadStatus.NEW,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        tags: [],
        score: 0,
        createdBy: 'user-1',
      });

      // Find it
      const found = await repository.findById(created._id.toHexString(), 'tenant-1');

      expect(found).not.toBeNull();
      expect(found?.firstName).toBe('John');
    });

    it('should return null for different tenant', async () => {
      // Create lead in tenant-1
      const created = await repository.create({
        tenantId: 'tenant-1',
        ownerId: 'owner-1',
        status: LeadStatus.NEW,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@test.com',
        tags: [],
        score: 0,
        createdBy: 'user-1',
      });

      // Try to find from tenant-2
      const found = await repository.findById(created._id.toHexString(), 'tenant-2');

      expect(found).toBeNull();
    });
  });

  // ===========================================================================
  // Email Uniqueness Tests
  // ===========================================================================

  describe('emailExists', () => {
    it('should return true for existing email', async () => {
      await repository.create({
        tenantId: 'tenant-1',
        ownerId: 'owner-1',
        status: LeadStatus.NEW,
        firstName: 'John',
        lastName: 'Doe',
        email: 'unique@test.com',
        tags: [],
        score: 0,
        createdBy: 'user-1',
      });

      const exists = await repository.emailExists('unique@test.com', 'tenant-1');

      expect(exists).toBe(true);
    });

    it('should return false for non-existing email', async () => {
      const exists = await repository.emailExists('nonexistent@test.com', 'tenant-1');

      expect(exists).toBe(false);
    });

    it('should allow same email in different tenants', async () => {
      await repository.create({
        tenantId: 'tenant-1',
        ownerId: 'owner-1',
        status: LeadStatus.NEW,
        firstName: 'John',
        lastName: 'Doe',
        email: 'same@test.com',
        tags: [],
        score: 0,
        createdBy: 'user-1',
      });

      const existsInTenant2 = await repository.emailExists('same@test.com', 'tenant-2');

      expect(existsInTenant2).toBe(false);
    });
  });

  // ===========================================================================
  // Pagination Tests
  // ===========================================================================

  describe('findWithFilters', () => {
    beforeEach(async () => {
      // Create multiple leads
      for (let i = 1; i <= 25; i++) {
        await repository.create({
          tenantId: 'tenant-1',
          ownerId: `owner-${i % 3}`,
          status: i % 2 === 0 ? LeadStatus.QUALIFIED : LeadStatus.NEW,
          firstName: `Lead${i}`,
          lastName: 'Test',
          email: `lead${i}@test.com`,
          tags: [],
          score: i,
          createdBy: 'user-1',
        });
      }
    });

    it('should paginate results', async () => {
      const result = await repository.findWithFilters('tenant-1', undefined, { limit: 10 });

      expect(result.data.length).toBe(10);
      expect(result.hasNextPage).toBe(true);
      expect(result.totalCount).toBe(25);
    });

    it('should filter by status', async () => {
      const result = await repository.findWithFilters(
        'tenant-1',
        { status: LeadStatus.QUALIFIED },
        { limit: 20 }
      );

      expect(result.data.every((l) => l.status === LeadStatus.QUALIFIED)).toBe(true);
    });

    it('should use cursor for pagination', async () => {
      const firstPage = await repository.findWithFilters('tenant-1', undefined, { limit: 10 });

      expect(firstPage.endCursor).toBeDefined();

      const secondPage = await repository.findWithFilters('tenant-1', undefined, {
        limit: 10,
        cursor: firstPage.endCursor!,
      });

      expect(secondPage.hasPreviousPage).toBe(true);
      // Ensure no duplicates
      const firstIds = firstPage.data.map((l) => l._id.toHexString());
      const secondIds = secondPage.data.map((l) => l._id.toHexString());
      const intersection = firstIds.filter((id) => secondIds.includes(id));
      expect(intersection.length).toBe(0);
    });
  });

  // ===========================================================================
  // Soft Delete Tests
  // ===========================================================================

  describe('deleteById', () => {
    it('should soft delete lead', async () => {
      const created = await repository.create({
        tenantId: 'tenant-1',
        ownerId: 'owner-1',
        status: LeadStatus.NEW,
        firstName: 'John',
        lastName: 'Doe',
        email: 'to-delete@test.com',
        tags: [],
        score: 0,
        createdBy: 'user-1',
      });

      const deleted = await repository.deleteById(
        created._id.toHexString(),
        'tenant-1',
        'user-1'
      );

      expect(deleted).toBe(true);

      // Should not be found
      const found = await repository.findById(created._id.toHexString(), 'tenant-1');
      expect(found).toBeNull();
    });
  });
});
