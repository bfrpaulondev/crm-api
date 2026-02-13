// =============================================================================
// GraphQL Mutation Resolvers
// =============================================================================

import { builder } from '../builder.js';
import { leadService } from '@/services/lead.service.js';
import { webhookService } from '@/services/webhook.service.js';
import { leadRepository } from '@/repositories/lead.repository.js';
import { accountRepository } from '@/repositories/account.repository.js';
import { contactRepository } from '@/repositories/contact.repository.js';
import { opportunityRepository } from '@/repositories/opportunity.repository.js';
import { stageRepository } from '@/repositories/stage.repository.js';
import { activityRepository } from '@/repositories/activity.repository.js';
import { auditLogRepository } from '@/repositories/audit-log.repository.js';
import { Errors } from '@/types/errors.js';
import { Permission, ROLE_PERMISSIONS } from '@/types/context.js';
import { LeadStatus } from '@/types/entities.js';
import { OpportunityStatus } from '@/types/entities.js';
import {
  CreateLeadInput,
  UpdateLeadInput,
  QualifyLeadInput,
  ConvertLeadInput,
  CreateLeadPayload,
  UpdateLeadPayload,
  QualifyLeadPayload,
  ConvertLeadPayload,
} from '../types/lead.js';
import {
  CreateAccountInput,
  UpdateAccountInput,
  CreateContactInput,
  UpdateContactInput,
  CreateAccountPayload,
  CreateContactPayload,
} from '../types/account.js';
import {
  CreateOpportunityInput,
  UpdateOpportunityInput,
  CloseOpportunityInput,
  MoveOpportunityStageInput,
  CreateOpportunityPayload,
  UpdateOpportunityPayload,
  CloseOpportunityPayload,
  CreateStageInput,
  UpdateStageInput,
} from '../types/opportunity.js';
import {
  CreateActivityInput,
  UpdateActivityInput,
  CompleteActivityInput,
  CreateNoteInput,
  CreateActivityPayload,
  CreateNotePayload,
} from '../types/activity.js';
import {
  CreateWebhookInput,
  UpdateWebhookInput,
  CreateWebhookPayload,
  UpdateWebhookPayload,
  DeleteWebhookPayload,
  TestWebhookPayload,
} from '../types/webhook.js';

// =============================================================================
// Mutations
// =============================================================================

builder.mutationType({
  fields: (t) => ({
    // =========================================================================
    // Lead Mutations
    // =========================================================================

    createLead: t.field({
      type: CreateLeadPayload,
      nullable: false,
      args: {
        input: t.arg({ type: CreateLeadInput, required: true }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.LEAD_CREATE)) {
          throw Errors.insufficientPermissions('LEAD_CREATE');
        }

        try {
          const lead = await leadService.create(
            ctx.tenant.id,
            ctx.user.id,
            {
              firstName: args.input.firstName,
              lastName: args.input.lastName,
              email: args.input.email,
              phone: args.input.phone ?? null,
              companyName: args.input.companyName ?? null,
              title: args.input.title ?? null,
              website: args.input.website ?? null,
              industry: args.input.industry ?? null,
              source: args.input.source ?? null,
              ownerId: args.input.ownerId ?? undefined,
              tags: args.input.tags ?? [],
              notes: args.input.notes ?? null,
            },
            ctx.requestId
          );

          return {
            success: true,
            message: 'Lead created successfully',
            lead,
          };
        } catch (error) {
          return {
            success: false,
            message: (error as Error).message,
            lead: null,
          };
        }
      },
    }),

    updateLead: t.field({
      type: UpdateLeadPayload,
      nullable: false,
      args: {
        id: t.arg.string({ required: true }),
        input: t.arg({ type: UpdateLeadInput, required: true }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.LEAD_UPDATE)) {
          throw Errors.insufficientPermissions('LEAD_UPDATE');
        }

        try {
          const lead = await leadService.update(
            args.id,
            ctx.tenant.id,
            ctx.user.id,
            {
              firstName: args.input.firstName ?? undefined,
              lastName: args.input.lastName ?? undefined,
              email: args.input.email ?? undefined,
              phone: args.input.phone ?? null,
              companyName: args.input.companyName ?? null,
              title: args.input.title ?? null,
              website: args.input.website ?? null,
              industry: args.input.industry ?? null,
              source: args.input.source ?? null,
              status: args.input.status ?? undefined,
              ownerId: args.input.ownerId ?? undefined,
              tags: args.input.tags ?? undefined,
              notes: args.input.notes ?? null,
              score: args.input.score ?? undefined,
            },
            ctx.requestId
          );

          return {
            success: true,
            message: 'Lead updated successfully',
            lead,
          };
        } catch (error) {
          return {
            success: false,
            message: (error as Error).message,
            lead: null,
          };
        }
      },
    }),

    deleteLead: t.field({
      type: 'Boolean',
      nullable: false,
      args: {
        id: t.arg.string({ required: true }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.LEAD_DELETE)) {
          throw Errors.insufficientPermissions('LEAD_DELETE');
        }

        return leadService.delete(args.id, ctx.tenant.id, ctx.user.id, ctx.requestId);
      },
    }),

    qualifyLead: t.field({
      type: QualifyLeadPayload,
      nullable: false,
      args: {
        input: t.arg({ type: QualifyLeadInput, required: true }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.LEAD_CONVERT)) {
          throw Errors.insufficientPermissions('LEAD_CONVERT');
        }

        try {
          const lead = await leadService.qualify(
            args.input.leadId,
            ctx.tenant.id,
            ctx.user.id,
            args.input.notes ?? undefined,
            ctx.requestId
          );

          return {
            success: true,
            message: 'Lead qualified successfully',
            lead,
          };
        } catch (error) {
          return {
            success: false,
            message: (error as Error).message,
            lead: null,
          };
        }
      },
    }),

    convertLead: t.field({
      type: ConvertLeadPayload,
      nullable: false,
      args: {
        input: t.arg({ type: ConvertLeadInput, required: true }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.LEAD_CONVERT)) {
          throw Errors.insufficientPermissions('LEAD_CONVERT');
        }

        try {
          const result = await leadService.convert(
            ctx.tenant.id,
            ctx.user.id,
            {
              leadId: args.input.leadId,
              createAccount: args.input.createAccount ?? true,
              accountName: args.input.accountName ?? undefined,
              createOpportunity: args.input.createOpportunity ?? true,
              opportunityName: args.input.opportunityName ?? undefined,
              opportunityAmount: args.input.opportunityAmount ?? undefined,
              stageId: args.input.stageId ?? undefined,
              idempotencyKey: args.input.idempotencyKey ?? undefined,
            },
            ctx.requestId
          );

          return {
            success: true,
            message: 'Lead converted successfully',
            lead: result.lead,
          };
        } catch (error) {
          return {
            success: false,
            message: (error as Error).message,
            lead: null,
          };
        }
      },
    }),

    // =========================================================================
    // Opportunity Mutations
    // =========================================================================

    createOpportunity: t.field({
      type: CreateOpportunityPayload,
      nullable: false,
      args: {
        input: t.arg({ type: CreateOpportunityInput, required: true }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.OPPORTUNITY_CREATE)) {
          throw Errors.insufficientPermissions('OPPORTUNITY_CREATE');
        }

        try {
          const opportunity = await opportunityRepository.create({
            tenantId: ctx.tenant.id,
            accountId: args.input.accountId,
            contactId: args.input.contactId ?? null,
            ownerId: args.input.ownerId ?? ctx.user.id,
            name: args.input.name,
            description: args.input.description ?? null,
            stageId: args.input.stageId,
            amount: args.input.amount,
            currency: args.input.currency ?? 'USD',
            probability: args.input.probability ?? 10,
            expectedCloseDate: args.input.expectedCloseDate ?? null,
            actualCloseDate: null,
            status: OpportunityStatus.OPEN,
            type: args.input.type ?? null,
            leadSource: args.input.leadSource ?? null,
            nextStep: args.input.nextStep ?? null,
            competitorInfo: null,
            timeline: [],
            createdBy: ctx.user.id,
          });

          await auditLogRepository.log({
            tenantId: ctx.tenant.id,
            entityType: 'Opportunity',
            entityId: opportunity._id.toHexString(),
            action: 'CREATE',
            actorId: ctx.user.id,
            actorEmail: ctx.user.email,
            changes: { new: opportunity },
            metadata: { requestId: ctx.requestId },
            requestId: ctx.requestId,
          });

          return {
            success: true,
            message: 'Opportunity created successfully',
            opportunity,
          };
        } catch (error) {
          return {
            success: false,
            message: (error as Error).message,
            opportunity: null,
          };
        }
      },
    }),

    updateOpportunity: t.field({
      type: UpdateOpportunityPayload,
      nullable: false,
      args: {
        id: t.arg.string({ required: true }),
        input: t.arg({ type: UpdateOpportunityInput, required: true }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.OPPORTUNITY_UPDATE)) {
          throw Errors.insufficientPermissions('OPPORTUNITY_UPDATE');
        }

        try {
          const opportunity = await opportunityRepository.updateById(
            args.id,
            ctx.tenant.id,
            {
              name: args.input.name ?? undefined,
              description: args.input.description ?? null,
              stageId: args.input.stageId ?? undefined,
              amount: args.input.amount ?? undefined,
              currency: args.input.currency ?? undefined,
              probability: args.input.probability ?? undefined,
              expectedCloseDate: args.input.expectedCloseDate ?? null,
              type: args.input.type ?? null,
              leadSource: args.input.leadSource ?? null,
              ownerId: args.input.ownerId ?? undefined,
              nextStep: args.input.nextStep ?? null,
            },
            ctx.user.id
          );

          if (!opportunity) {
            throw Errors.notFound('Opportunity', args.id);
          }

          return {
            success: true,
            message: 'Opportunity updated successfully',
            opportunity,
          };
        } catch (error) {
          return {
            success: false,
            message: (error as Error).message,
            opportunity: null,
          };
        }
      },
    }),

    moveOpportunityStage: t.field({
      type: UpdateOpportunityPayload,
      nullable: false,
      args: {
        input: t.arg({ type: MoveOpportunityStageInput, required: true }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.OPPORTUNITY_UPDATE)) {
          throw Errors.insufficientPermissions('OPPORTUNITY_UPDATE');
        }

        try {
          // Validate stage belongs to tenant
          const stage = await stageRepository.findById(args.input.stageId, ctx.tenant.id);
          if (!stage) {
            throw Errors.badUserInput('Invalid stage');
          }

          const opportunity = await opportunityRepository.moveStage(
            args.input.opportunityId,
            ctx.tenant.id,
            args.input.stageId,
            stage.probability,
            ctx.user.id
          );

          if (!opportunity) {
            throw Errors.notFound('Opportunity', args.input.opportunityId);
          }

          return {
            success: true,
            message: 'Opportunity stage updated successfully',
            opportunity,
          };
        } catch (error) {
          return {
            success: false,
            message: (error as Error).message,
            opportunity: null,
          };
        }
      },
    }),

    closeOpportunity: t.field({
      type: CloseOpportunityPayload,
      nullable: false,
      args: {
        input: t.arg({ type: CloseOpportunityInput, required: true }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        const permission = args.input.status === 'WON'
          ? Permission.OPPORTUNITY_CLOSE_WON
          : Permission.OPPORTUNITY_CLOSE_LOST;

        if (!ctx.hasPermission(permission)) {
          throw Errors.insufficientPermissions(permission);
        }

        try {
          const status = args.input.status === 'WON'
            ? OpportunityStatus.WON
            : OpportunityStatus.LOST;

          const opportunity = await opportunityRepository.close(
            args.input.opportunityId,
            ctx.tenant.id,
            status,
            ctx.user.id,
            args.input.reason ?? undefined
          );

          if (!opportunity) {
            throw Errors.notFound('Opportunity', args.input.opportunityId);
          }

          // Log de auditoria
          await auditLogRepository.log({
            tenantId: ctx.tenant.id,
            entityType: 'Opportunity',
            entityId: args.input.opportunityId,
            action: args.input.status === 'WON' ? 'WON' : 'LOST',
            actorId: ctx.user.id,
            actorEmail: ctx.user.email,
            changes: { new: opportunity },
            metadata: { reason: args.input.reason, requestId: ctx.requestId },
            requestId: ctx.requestId,
          });

          // TODO: Se WON, criar Deal/Order

          return {
            success: true,
            message: `Opportunity marked as ${args.input.status}`,
            opportunity,
            dealId: status === OpportunityStatus.WON ? crypto.randomUUID() : null,
          };
        } catch (error) {
          return {
            success: false,
            message: (error as Error).message,
            opportunity: null,
            dealId: null,
          };
        }
      },
    }),

    // =========================================================================
    // Account & Contact Mutations
    // =========================================================================

    createAccount: t.field({
      type: CreateAccountPayload,
      nullable: false,
      args: {
        input: t.arg({ type: CreateAccountInput, required: true }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.ACCOUNT_CREATE)) {
          throw Errors.insufficientPermissions('ACCOUNT_CREATE');
        }

        try {
          const account = await accountRepository.create({
            tenantId: ctx.tenant.id,
            ownerId: args.input.ownerId ?? ctx.user.id,
            name: args.input.name,
            domain: args.input.domain ?? null,
            website: args.input.website ?? null,
            industry: args.input.industry ?? null,
            employees: args.input.employees ?? null,
            annualRevenue: args.input.annualRevenue ?? null,
            phone: args.input.phone ?? null,
            billingAddress: args.input.billingAddress ?? null,
            shippingAddress: args.input.shippingAddress ?? null,
            type: args.input.type ?? 'PROSPECT',
            tier: args.input.tier ?? 'SMB',
            status: 'ACTIVE',
            parentAccountId: args.input.parentAccountId ?? null,
            createdBy: ctx.user.id,
          });

          return {
            success: true,
            message: 'Account created successfully',
            account,
          };
        } catch (error) {
          return {
            success: false,
            message: (error as Error).message,
            account: null,
          };
        }
      },
    }),

    createContact: t.field({
      type: CreateContactPayload,
      nullable: false,
      args: {
        input: t.arg({ type: CreateContactInput, required: true }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.CONTACT_CREATE)) {
          throw Errors.insufficientPermissions('CONTACT_CREATE');
        }

        try {
          const contact = await contactRepository.create({
            tenantId: ctx.tenant.id,
            accountId: args.input.accountId ?? null,
            ownerId: args.input.ownerId ?? ctx.user.id,
            firstName: args.input.firstName,
            lastName: args.input.lastName,
            email: args.input.email,
            phone: args.input.phone ?? null,
            mobile: args.input.mobile ?? null,
            title: args.input.title ?? null,
            department: args.input.department ?? null,
            linkedinUrl: args.input.linkedinUrl ?? null,
            isPrimary: args.input.isPrimary ?? false,
            isDecisionMaker: args.input.isDecisionMaker ?? false,
            preferences: null,
            createdBy: ctx.user.id,
          });

          return {
            success: true,
            message: 'Contact created successfully',
            contact,
          };
        } catch (error) {
          return {
            success: false,
            message: (error as Error).message,
            contact: null,
          };
        }
      },
    }),

    // =========================================================================
    // Activity Mutations
    // =========================================================================

    createActivity: t.field({
      type: CreateActivityPayload,
      nullable: false,
      args: {
        input: t.arg({ type: CreateActivityInput, required: true }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.ACTIVITY_CREATE)) {
          throw Errors.insufficientPermissions('ACTIVITY_CREATE');
        }

        try {
          const activity = await activityRepository.create({
            tenantId: ctx.tenant.id,
            type: args.input.type,
            subject: args.input.subject,
            description: args.input.description ?? null,
            ownerId: args.input.ownerId ?? ctx.user.id,
            relatedToType: args.input.relatedToType ?? null,
            relatedToId: args.input.relatedToId ?? null,
            dueDate: args.input.dueDate ?? null,
            completedAt: null,
            status: 'PENDING',
            priority: args.input.priority ?? 'MEDIUM',
            location: args.input.location ?? null,
            durationMinutes: args.input.durationMinutes ?? null,
            outcome: null,
            createdBy: ctx.user.id,
          });

          return {
            success: true,
            message: 'Activity created successfully',
            activity,
          };
        } catch (error) {
          return {
            success: false,
            message: (error as Error).message,
            activity: null,
          };
        }
      },
    }),

    // =========================================================================
    // Note Mutations
    // =========================================================================

    createNote: t.field({
      type: CreateNotePayload,
      nullable: false,
      args: {
        input: t.arg({ type: CreateNoteInput, required: true }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        // Permission based on relatedToType
        const permissionMap: Record<string, Permission> = {
          LEAD: Permission.LEAD_UPDATE,
          CONTACT: Permission.CONTACT_UPDATE,
          ACCOUNT: Permission.ACCOUNT_UPDATE,
          OPPORTUNITY: Permission.OPPORTUNITY_UPDATE,
        };

        const requiredPermission = permissionMap[args.input.relatedToType];
        if (requiredPermission && !ctx.hasPermission(requiredPermission)) {
          throw Errors.insufficientPermissions(requiredPermission);
        }

        try {
          const note = await activityRepository.createNote({
            tenantId: ctx.tenant.id,
            body: args.input.body,
            visibility: args.input.visibility ?? 'TEAM',
            relatedToType: args.input.relatedToType,
            relatedToId: args.input.relatedToId,
            createdBy: ctx.user.id,
          });

          return {
            success: true,
            message: 'Note created successfully',
            note,
          };
        } catch (error) {
          return {
            success: false,
            message: (error as Error).message,
            note: null,
          };
        }
      },
    }),

    // =========================================================================
    // Webhook Mutations
    // =========================================================================

    createWebhook: t.field({
      type: CreateWebhookPayload,
      nullable: false,
      args: {
        input: t.arg({ type: CreateWebhookInput, required: true }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.WEBHOOK_CREATE)) {
          throw Errors.insufficientPermissions('WEBHOOK_CREATE');
        }

        try {
          const webhook = await webhookService.createWebhook(
            ctx.tenant.id,
            ctx.user.id,
            {
              name: args.input.name,
              url: args.input.url,
              events: args.input.events as import('@/types/webhook.js').WebhookEvent[],
              secret: args.input.secret,
              description: args.input.description ?? undefined,
              isActive: args.input.isActive ?? true,
            }
          );

          return {
            success: true,
            message: 'Webhook created successfully',
            webhook,
          };
        } catch (error) {
          return {
            success: false,
            message: (error as Error).message,
            webhook: null,
          };
        }
      },
    }),

    updateWebhook: t.field({
      type: UpdateWebhookPayload,
      nullable: false,
      args: {
        id: t.arg.string({ required: true }),
        input: t.arg({ type: UpdateWebhookInput, required: true }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.WEBHOOK_UPDATE)) {
          throw Errors.insufficientPermissions('WEBHOOK_UPDATE');
        }

        try {
          const webhook = await webhookService.updateWebhook(
            args.id,
            ctx.tenant.id,
            ctx.user.id,
            {
              name: args.input.name ?? undefined,
              url: args.input.url ?? undefined,
              events: args.input.events as import('@/types/webhook.js').WebhookEvent[] | undefined,
              secret: args.input.secret ?? undefined,
              description: args.input.description ?? undefined,
              isActive: args.input.isActive ?? undefined,
            }
          );

          return {
            success: true,
            message: 'Webhook updated successfully',
            webhook,
          };
        } catch (error) {
          return {
            success: false,
            message: (error as Error).message,
            webhook: null,
          };
        }
      },
    }),

    deleteWebhook: t.field({
      type: DeleteWebhookPayload,
      nullable: false,
      args: {
        id: t.arg.string({ required: true }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.WEBHOOK_DELETE)) {
          throw Errors.insufficientPermissions('WEBHOOK_DELETE');
        }

        try {
          const deleted = await webhookService.deleteWebhook(
            args.id,
            ctx.tenant.id,
            ctx.user.id
          );

          return {
            success: deleted,
            message: deleted ? 'Webhook deleted successfully' : 'Webhook not found',
          };
        } catch (error) {
          return {
            success: false,
            message: (error as Error).message,
          };
        }
      },
    }),

    testWebhook: t.field({
      type: TestWebhookPayload,
      nullable: false,
      args: {
        id: t.arg.string({ required: true }),
      },
      authScopes: {
        authenticated: true,
      },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission(Permission.WEBHOOK_TEST)) {
          throw Errors.insufficientPermissions('WEBHOOK_TEST');
        }

        try {
          const result = await webhookService.testWebhook(args.id, ctx.tenant.id);

          return {
            success: result.success,
            message: result.success
              ? `Webhook test successful (${result.statusCode})`
              : 'Webhook test failed',
            statusCode: result.statusCode,
            responseTime: result.responseTime,
            error: result.error,
          };
        } catch (error) {
          return {
            success: false,
            message: (error as Error).message,
            statusCode: null,
            responseTime: null,
            error: (error as Error).message,
          };
        }
      },
    }),
  }),
});

// Activity repository extension for notes
declare module '@/repositories/activity.repository.js' {
  interface ActivityRepository {
    createNote(data: {
      tenantId: string;
      body: string;
      visibility: string;
      relatedToType: string;
      relatedToId: string;
      createdBy: string;
    }): Promise<unknown>;
  }
}
