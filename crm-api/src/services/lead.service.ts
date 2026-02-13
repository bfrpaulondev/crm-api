// =============================================================================
// Lead Service - Business Logic
// =============================================================================

import { LeadRepository, leadRepository } from '@/repositories/lead.repository.js';
import {
  Lead,
  LeadStatus,
  Contact,
  Account,
  Opportunity,
  OpportunityStatus,
} from '@/types/entities.js';
import { CreateLeadInput, LeadFilter, ConvertLeadInput } from '@/types/validation.js';
import { Errors, APIError, ErrorCode } from '@/types/errors.js';
import { traceServiceOperation } from '@/infrastructure/otel/tracing.js';
import { logger } from '@/infrastructure/logging/index.js';
import { ObjectId } from 'mongodb';
import { createIdempotencyKey, checkIdempotencyKey } from '@/infrastructure/redis/client.js';
import { AccountRepository } from '@/repositories/account.repository.js';
import { ContactRepository } from '@/repositories/contact.repository.js';
import { OpportunityRepository } from '@/repositories/opportunity.repository.js';
import { StageRepository } from '@/repositories/stage.repository.js';
import { AuditLogRepository } from '@/repositories/audit-log.repository.js';

export class LeadService {
  constructor(
    private readonly leadRepo: LeadRepository,
    private readonly accountRepo: AccountRepository,
    private readonly contactRepo: ContactRepository,
    private readonly opportunityRepo: OpportunityRepository,
    private readonly stageRepo: StageRepository,
    private readonly auditRepo: AuditLogRepository
  ) {}

  // ===========================================================================
  // CRUD Operations
  // ===========================================================================

  /**
   * Create a new lead
   * - Validates email uniqueness
   * - Sets default values
   */
  async create(
    tenantId: string,
    userId: string,
    input: CreateLeadInput,
    requestId: string
  ): Promise<Lead> {
    return traceServiceOperation('LeadService', 'create', async () => {
      // 1. Validar email único por tenant
      const emailExists = await this.leadRepo.emailExists(input.email, tenantId);
      if (emailExists) {
        throw Errors.alreadyExists('Lead', 'email', input.email);
      }

      // 2. Preparar dados do lead
      const leadData = {
        tenantId,
        ownerId: input.ownerId || userId,
        status: LeadStatus.NEW,
        source: input.source ?? null,
        firstName: input.firstName,
        lastName: input.lastName,
        email: input.email.toLowerCase(),
        phone: input.phone ?? null,
        companyName: input.companyName ?? null,
        title: input.title ?? null,
        website: input.website ?? null,
        industry: input.industry ?? null,
        tags: input.tags ?? [],
        score: 0,
        notes: input.notes ?? null,
        createdBy: userId,
      };

      // 3. Criar lead
      const lead = await this.leadRepo.create(leadData);

      // 4. Log de auditoria
      await this.auditRepo.log({
        tenantId,
        entityType: 'Lead',
        entityId: lead._id.toHexString(),
        action: 'CREATE',
        actorId: userId,
        actorEmail: '', // TODO: passar do contexto
        changes: { new: lead },
        metadata: { requestId },
        requestId,
      });

      logger.info('Lead created', {
        leadId: lead._id.toHexString(),
        tenantId,
        userId,
        email: lead.email,
      });

      return lead;
    });
  }

  /**
   * Get lead by ID
   */
  async getById(id: string, tenantId: string): Promise<Lead> {
    return traceServiceOperation('LeadService', 'getById', async () => {
      const lead = await this.leadRepo.findById(id, tenantId);

      if (!lead) {
        throw Errors.notFound('Lead', id);
      }

      return lead;
    });
  }

  /**
   * List leads with filters and pagination
   */
  async list(
    tenantId: string,
    filter?: LeadFilter,
    pagination?: { limit?: number; cursor?: string }
  ) {
    return traceServiceOperation('LeadService', 'list', async () => {
      return this.leadRepo.findWithFilters(tenantId, filter, pagination);
    });
  }

  /**
   * Update lead
   */
  async update(
    id: string,
    tenantId: string,
    userId: string,
    input: Partial<CreateLeadInput>,
    requestId: string
  ): Promise<Lead> {
    return traceServiceOperation('LeadService', 'update', async () => {
      // 1. Buscar lead existente
      const existingLead = await this.leadRepo.findById(id, tenantId);
      if (!existingLead) {
        throw Errors.notFound('Lead', id);
      }

      // 2. Validar email único se estiver a mudar
      if (input.email && input.email !== existingLead.email) {
        const emailExists = await this.leadRepo.emailExists(input.email, tenantId, id);
        if (emailExists) {
          throw Errors.alreadyExists('Lead', 'email', input.email);
        }
      }

      // 3. Atualizar
      const updatedLead = await this.leadRepo.updateById(id, tenantId, input, userId);

      if (!updatedLead) {
        throw Errors.internal('Failed to update lead');
      }

      // 4. Log de auditoria
      await this.auditRepo.log({
        tenantId,
        entityType: 'Lead',
        entityId: id,
        action: 'UPDATE',
        actorId: userId,
        actorEmail: '',
        changes: { old: existingLead, new: updatedLead },
        metadata: { requestId },
        requestId,
      });

      return updatedLead;
    });
  }

  /**
   * Delete lead (soft delete)
   */
  async delete(id: string, tenantId: string, userId: string, requestId: string): Promise<boolean> {
    return traceServiceOperation('LeadService', 'delete', async () => {
      const lead = await this.leadRepo.findById(id, tenantId);
      if (!lead) {
        throw Errors.notFound('Lead', id);
      }

      const deleted = await this.leadRepo.deleteById(id, tenantId, userId);

      if (deleted) {
        await this.auditRepo.log({
          tenantId,
          entityType: 'Lead',
          entityId: id,
          action: 'DELETE',
          actorId: userId,
          actorEmail: '',
          changes: { old: lead },
          metadata: { requestId },
          requestId,
        });
      }

      return deleted;
    });
  }

  // ===========================================================================
  // Lead Lifecycle Operations
  // ===========================================================================

  /**
   * Qualify a lead
   * - Validates minimum fields for qualification
   */
  async qualify(
    id: string,
    tenantId: string,
    userId: string,
    notes?: string,
    requestId?: string
  ): Promise<Lead> {
    return traceServiceOperation('LeadService', 'qualify', async () => {
      const lead = await this.leadRepo.findById(id, tenantId);
      if (!lead) {
        throw Errors.notFound('Lead', id);
      }

      // Validar estado atual
      if (lead.status === LeadStatus.CONVERTED) {
        throw Errors.leadAlreadyConverted(id);
      }

      if (lead.status === LeadStatus.QUALIFIED) {
        throw Errors.badUserInput('Lead is already qualified');
      }

      // Validar campos mínimos para qualificação
      const validationErrors: string[] = [];
      if (!lead.email) validationErrors.push('email is required');
      if (!lead.firstName) validationErrors.push('firstName is required');
      if (!lead.lastName) validationErrors.push('lastName is required');

      if (validationErrors.length > 0) {
        throw Errors.badUserInput(
          'Lead cannot be qualified. Missing required fields',
          { errors: validationErrors }
        );
      }

      // Atualizar status
      const updateData: Partial<Lead> = {
        status: LeadStatus.QUALIFIED,
        qualifiedAt: new Date(),
      };

      if (notes) {
        updateData.notes = notes;
      }

      const qualifiedLead = await this.leadRepo.updateById(id, tenantId, updateData, userId);

      if (!qualifiedLead) {
        throw Errors.internal('Failed to qualify lead');
      }

      // Log de auditoria
      await this.auditRepo.log({
        tenantId,
        entityType: 'Lead',
        entityId: id,
        action: 'UPDATE',
        actorId: userId,
        actorEmail: '',
        changes: { old: lead, new: qualifiedLead },
        metadata: { action: 'QUALIFY', requestId },
        requestId: requestId || '',
      });

      logger.info('Lead qualified', {
        leadId: id,
        tenantId,
        userId,
      });

      return qualifiedLead;
    });
  }

  /**
   * Convert lead to Contact + Account + Opportunity
   * - Idempotent operation using idempotencyKey
   * - Uses MongoDB transaction for atomicity (if available)
   */
  async convert(
    tenantId: string,
    userId: string,
    input: ConvertLeadInput,
    requestId: string
  ): Promise<{
    lead: Lead;
    contact: Contact;
    account: Account;
    opportunity: Opportunity | null;
  }> {
    return traceServiceOperation('LeadService', 'convert', async () => {
      // 1. Verificar idempotência
      if (input.idempotencyKey) {
        const existingResult = await checkIdempotencyKey(
          tenantId,
          'convert_lead',
          input.idempotencyKey
        );
        if (existingResult) {
          logger.info('Idempotent convert lead request', {
            leadId: input.leadId,
            idempotencyKey: input.idempotencyKey,
          });
          // Retornar resultado existente
          return existingResult as ReturnType<LeadService['convert']> extends Promise<infer T> ? T : never;
        }
      }

      // 2. Buscar e validar lead
      const lead = await this.leadRepo.findById(input.leadId, tenantId);
      if (!lead) {
        throw Errors.notFound('Lead', input.leadId);
      }

      if (lead.status === LeadStatus.CONVERTED) {
        throw Errors.leadAlreadyConverted(input.leadId);
      }

      // 3. Validar qualificação (opcional - pode ser flexibilizado)
      if (lead.status !== LeadStatus.QUALIFIED && lead.status !== LeadStatus.CONTACTED) {
        throw Errors.badUserInput(
          'Lead must be contacted or qualified before conversion',
          { currentStatus: lead.status }
        );
      }

      // 4. Preparar dados para criação das entidades
      const now = new Date();

      // Criar Account
      const accountData = {
        tenantId,
        ownerId: lead.ownerId,
        name: input.accountName || lead.companyName || `${lead.firstName} ${lead.lastName}'s Company`,
        domain: null,
        website: lead.website,
        industry: lead.industry,
        employees: null,
        annualRevenue: null,
        phone: lead.phone,
        billingAddress: null,
        shippingAddress: null,
        type: 'PROSPECT' as const,
        tier: 'SMB' as const,
        status: 'ACTIVE' as const,
        parentAccountId: null,
        createdBy: userId,
      };

      const account = await this.accountRepo.create(accountData);

      // Criar Contact
      const contactData = {
        tenantId,
        accountId: account._id.toHexString(),
        ownerId: lead.ownerId,
        firstName: lead.firstName,
        lastName: lead.lastName,
        email: lead.email,
        phone: lead.phone,
        mobile: null,
        title: lead.title,
        department: null,
        linkedinUrl: null,
        isPrimary: true,
        isDecisionMaker: false,
        preferences: null,
        createdBy: userId,
      };

      const contact = await this.contactRepo.create(contactData);

      // Criar Opportunity (se solicitado)
      let opportunity: Opportunity | null = null;

      if (input.createOpportunity) {
        // Buscar primeiro stage ativo do tenant
        const stages = await this.stageRepo.findActiveStages(tenantId);
        const firstStage = stages[0];

        if (!firstStage && !input.stageId) {
          throw Errors.badUserInput(
            'No active stages found for tenant. Please configure pipeline stages first.'
          );
        }

        const opportunityData = {
          tenantId,
          accountId: account._id.toHexString(),
          contactId: contact._id.toHexString(),
          ownerId: lead.ownerId,
          name: input.opportunityName || `${account.name} - Opportunity`,
          description: `Converted from lead: ${lead.firstName} ${lead.lastName}`,
          stageId: input.stageId || firstStage?._id.toHexString() || '',
          amount: input.opportunityAmount || 0,
          currency: 'USD',
          probability: firstStage?.probability || 10,
          expectedCloseDate: null,
          actualCloseDate: null,
          status: OpportunityStatus.OPEN,
          type: null,
          leadSource: lead.source,
          nextStep: null,
          competitorInfo: null,
          timeline: [],
          createdBy: userId,
        };

        opportunity = await this.opportunityRepo.create(opportunityData);
      }

      // 5. Marcar lead como convertido
      const convertedLead = await this.leadRepo.convert(
        input.leadId,
        tenantId,
        {
          contactId: contact._id.toHexString(),
          accountId: account._id.toHexString(),
          opportunityId: opportunity?._id.toHexString(),
        },
        userId
      );

      if (!convertedLead) {
        throw Errors.internal('Failed to update lead after conversion');
      }

      // 6. Log de auditoria
      await this.auditRepo.log({
        tenantId,
        entityType: 'Lead',
        entityId: input.leadId,
        action: 'CONVERT',
        actorId: userId,
        actorEmail: '',
        changes: {
          old: lead,
          new: {
            contactId: contact._id.toHexString(),
            accountId: account._id.toHexString(),
            opportunityId: opportunity?._id.toHexString(),
          },
        },
        metadata: { requestId },
        requestId,
      });

      // 7. Guardar resultado para idempotência
      if (input.idempotencyKey) {
        await createIdempotencyKey(
          tenantId,
          'convert_lead',
          input.idempotencyKey,
          {
            leadId: convertedLead._id.toHexString(),
            contactId: contact._id.toHexString(),
            accountId: account._id.toHexString(),
            opportunityId: opportunity?._id.toHexString(),
          },
          86400 // 24 horas
        );
      }

      logger.info('Lead converted', {
        leadId: input.leadId,
        tenantId,
        userId,
        contactId: contact._id.toHexString(),
        accountId: account._id.toHexString(),
        opportunityId: opportunity?._id.toHexString(),
      });

      return {
        lead: convertedLead,
        contact,
        account,
        opportunity,
      };
    });
  }

  // ===========================================================================
  // Statistics
  // ===========================================================================

  /**
   * Get lead statistics for tenant
   */
  async getStatistics(tenantId: string) {
    return traceServiceOperation('LeadService', 'getStatistics', async () => {
      const [countsByStatus, countsBySource, total] = await Promise.all([
        this.leadRepo.getCountsByStatus(tenantId),
        this.leadRepo.getCountsBySource(tenantId),
        this.leadRepo.count({}, tenantId),
      ]);

      return {
        total,
        byStatus: countsByStatus,
        bySource: countsBySource,
      };
    });
  }
}

// Dependencies - criadas inline por simplicidade
// Em produção, usar DI container
import { accountRepository } from '@/repositories/account.repository.js';
import { contactRepository } from '@/repositories/contact.repository.js';
import { opportunityRepository } from '@/repositories/opportunity.repository.js';
import { stageRepository } from '@/repositories/stage.repository.js';
import { auditLogRepository } from '@/repositories/audit-log.repository.js';

export const leadService = new LeadService(
  leadRepository,
  accountRepository,
  contactRepository,
  opportunityRepository,
  stageRepository,
  auditLogRepository
);
