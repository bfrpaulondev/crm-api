// =============================================================================
// Unit Tests - Lead Service
// =============================================================================

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { LeadService } from '@/services/lead.service.js';
import { LeadRepository } from '@/repositories/lead.repository.js';
import { AccountRepository } from '@/repositories/account.repository.js';
import { ContactRepository } from '@/repositories/contact.repository.js';
import { OpportunityRepository } from '@/repositories/opportunity.repository.js';
import { StageRepository } from '@/repositories/stage.repository.js';
import { AuditLogRepository } from '@/repositories/audit-log.repository.js';
import { LeadStatus } from '@/types/entities.js';
import { Errors } from '@/types/errors.js';

// Mock repositories
const mockLeadRepo = {
  create: vi.fn(),
  findById: vi.fn(),
  findWithFilters: vi.fn(),
  updateById: vi.fn(),
  deleteById: vi.fn(),
  emailExists: vi.fn(),
  qualify: vi.fn(),
  convert: vi.fn(),
  count: vi.fn(),
  getCountsByStatus: vi.fn(),
  getCountsBySource: vi.fn(),
} as unknown as LeadRepository;

const mockAccountRepo = {
  create: vi.fn(),
} as unknown as AccountRepository;

const mockContactRepo = {
  create: vi.fn(),
} as unknown as ContactRepository;

const mockOpportunityRepo = {
  create: vi.fn(),
} as unknown as OpportunityRepository;

const mockStageRepo = {
  findActiveStages: vi.fn(),
} as unknown as StageRepository;

const mockAuditRepo = {
  log: vi.fn(),
} as unknown as AuditLogRepository;

// Service instance
let leadService: LeadService;

describe('LeadService', () => {
  beforeEach(() => {
    vi.clearAllMocks();

    leadService = new LeadService(
      mockLeadRepo as LeadRepository,
      mockAccountRepo as AccountRepository,
      mockContactRepo as ContactRepository,
      mockOpportunityRepo as OpportunityRepository,
      mockStageRepo as StageRepository,
      mockAuditRepo as AuditLogRepository
    );
  });

  // ===========================================================================
  // Create Lead Tests
  // ===========================================================================

  describe('create', () => {
    const tenantId = 'tenant-123';
    const userId = 'user-456';
    const requestId = 'req-789';

    const validInput = {
      firstName: 'John',
      lastName: 'Doe',
      email: 'john.doe@example.com',
    };

    it('should create a lead successfully', async () => {
      // Arrange
      vi.mocked(mockLeadRepo.emailExists).mockResolvedValue(false);
      vi.mocked(mockLeadRepo.create).mockResolvedValue({
        _id: { toHexString: () => 'lead-123' },
        tenantId,
        ownerId: userId,
        status: LeadStatus.NEW,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: null,
        companyName: null,
        title: null,
        website: null,
        industry: null,
        tags: [],
        score: 0,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);
      vi.mocked(mockAuditRepo.log).mockResolvedValue({} as any);

      // Act
      const result = await leadService.create(tenantId, userId, validInput, requestId);

      // Assert
      expect(result.firstName).toBe('John');
      expect(result.email).toBe('john.doe@example.com');
      expect(mockLeadRepo.create).toHaveBeenCalled();
    });

    it('should throw error if email already exists', async () => {
      // Arrange
      vi.mocked(mockLeadRepo.emailExists).mockResolvedValue(true);

      // Act & Assert
      await expect(
        leadService.create(tenantId, userId, validInput, requestId)
      ).rejects.toThrow();

      expect(mockLeadRepo.create).not.toHaveBeenCalled();
    });

    it('should normalize email to lowercase', async () => {
      // Arrange
      vi.mocked(mockLeadRepo.emailExists).mockResolvedValue(false);
      vi.mocked(mockLeadRepo.create).mockResolvedValue({
        _id: { toHexString: () => 'lead-123' },
        tenantId,
        ownerId: userId,
        status: LeadStatus.NEW,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john.doe@example.com',
        phone: null,
        companyName: null,
        title: null,
        website: null,
        industry: null,
        tags: [],
        score: 0,
        notes: null,
        createdAt: new Date(),
        updatedAt: new Date(),
      } as any);

      const inputWithUppercaseEmail = {
        ...validInput,
        email: 'JOHN.DOE@EXAMPLE.COM',
      };

      // Act
      await leadService.create(tenantId, userId, inputWithUppercaseEmail, requestId);

      // Assert
      expect(mockLeadRepo.create).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'john.doe@example.com',
        })
      );
    });
  });

  // ===========================================================================
  // Get Lead Tests
  // ===========================================================================

  describe('getById', () => {
    const tenantId = 'tenant-123';
    const leadId = 'lead-456';

    it('should return lead when found', async () => {
      // Arrange
      const mockLead = {
        _id: { toHexString: () => leadId },
        tenantId,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      };
      vi.mocked(mockLeadRepo.findById).mockResolvedValue(mockLead as any);

      // Act
      const result = await leadService.getById(leadId, tenantId);

      // Assert
      expect(result).toEqual(mockLead);
    });

    it('should throw NOT_FOUND error when lead not found', async () => {
      // Arrange
      vi.mocked(mockLeadRepo.findById).mockResolvedValue(null);

      // Act & Assert
      await expect(leadService.getById(leadId, tenantId)).rejects.toThrow();
    });
  });

  // ===========================================================================
  // Qualify Lead Tests
  // ===========================================================================

  describe('qualify', () => {
    const tenantId = 'tenant-123';
    const userId = 'user-456';
    const leadId = 'lead-789';

    it('should qualify a lead successfully', async () => {
      // Arrange
      const mockLead = {
        _id: { toHexString: () => leadId },
        tenantId,
        status: LeadStatus.NEW,
        firstName: 'John',
        lastName: 'Doe',
        email: 'john@example.com',
      };
      vi.mocked(mockLeadRepo.findById).mockResolvedValue(mockLead as any);
      vi.mocked(mockLeadRepo.updateById).mockResolvedValue({
        ...mockLead,
        status: LeadStatus.QUALIFIED,
        qualifiedAt: new Date(),
      } as any);
      vi.mocked(mockAuditRepo.log).mockResolvedValue({} as any);

      // Act
      const result = await leadService.qualify(leadId, tenantId, userId);

      // Assert
      expect(result.status).toBe(LeadStatus.QUALIFIED);
    });

    it('should throw error if lead is already converted', async () => {
      // Arrange
      const mockLead = {
        _id: { toHexString: () => leadId },
        tenantId,
        status: LeadStatus.CONVERTED,
      };
      vi.mocked(mockLeadRepo.findById).mockResolvedValue(mockLead as any);

      // Act & Assert
      await expect(
        leadService.qualify(leadId, tenantId, userId)
      ).rejects.toThrow();
    });
  });

  // ===========================================================================
  // Statistics Tests
  // ===========================================================================

  describe('getStatistics', () => {
    const tenantId = 'tenant-123';

    it('should return lead statistics', async () => {
      // Arrange
      vi.mocked(mockLeadRepo.getCountsByStatus).mockResolvedValue({
        [LeadStatus.NEW]: 10,
        [LeadStatus.QUALIFIED]: 5,
        [LeadStatus.CONVERTED]: 3,
        [LeadStatus.CONTACTED]: 2,
        [LeadStatus.UNQUALIFIED]: 1,
      });
      vi.mocked(mockLeadRepo.getCountsBySource).mockResolvedValue({
        WEBSITE: 8,
        REFERRAL: 5,
      });
      vi.mocked(mockLeadRepo.count).mockResolvedValue(21);

      // Act
      const result = await leadService.getStatistics(tenantId);

      // Assert
      expect(result.total).toBe(21);
      expect(result.byStatus[LeadStatus.NEW]).toBe(10);
      expect(result.bySource.WEBSITE).toBe(8);
    });
  });
});
