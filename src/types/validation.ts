// =============================================================================
// Zod Validation Schemas
// =============================================================================

import { z } from 'zod';
import {
  LeadStatus,
  LeadSource,
  AccountType,
  AccountTier,
  AccountStatus,
  OpportunityStatus,
  OpportunityType,
  ActivityType,
  ActivityStatus,
  ActivityPriority,
  NoteVisibility,
} from './entities.js';

// =============================================================================
// Common Schemas
// =============================================================================

export const ObjectIdSchema = z.string().regex(/^[a-f\d]{24}$/i, 'Invalid ObjectId');

export const EmailSchema = z.string().email('Invalid email address').toLowerCase().trim();

export const PhoneSchema = z.string().min(7).max(20).optional().nullable();

export const URLSchema = z.string().url('Invalid URL').optional().nullable();

export const PaginationLimitSchema = z.number().int().min(1).max(100).default(20);

export const CursorSchema = z.string().min(1).optional().nullable();

// =============================================================================
// Lead Schemas
// =============================================================================

export const LeadStatusSchema = z.nativeEnum(LeadStatus);

export const LeadSourceSchema = z.nativeEnum(LeadSource).optional().nullable();

export const CreateLeadInputSchema = z.object({
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: EmailSchema,
  phone: PhoneSchema,
  companyName: z.string().max(200).optional().nullable(),
  title: z.string().max(100).optional().nullable(),
  website: URLSchema,
  industry: z.string().max(100).optional().nullable(),
  source: LeadSourceSchema,
  ownerId: z.string().optional(), // Se não fornecido, usa o utilizador atual
  tags: z.array(z.string().max(50)).max(20).optional().default([]),
  notes: z.string().max(5000).optional().nullable(),
});

export const UpdateLeadInputSchema = CreateLeadInputSchema.partial();

export const LeadFilterSchema = z.object({
  status: LeadStatusSchema.optional(),
  source: LeadSourceSchema,
  ownerId: z.string().optional(),
  search: z.string().max(200).optional(),
  tags: z.array(z.string()).optional(),
  createdAfter: z.coerce.date().optional(),
  createdBefore: z.coerce.date().optional(),
  hasCompany: z.boolean().optional(),
  minScore: z.number().int().min(0).max(100).optional(),
});

export const QualifyLeadInputSchema = z.object({
  leadId: ObjectIdSchema,
  notes: z.string().max(5000).optional().nullable(),
});

export const ConvertLeadInputSchema = z.object({
  leadId: ObjectIdSchema,
  createAccount: z.boolean().default(true),
  accountName: z.string().max(200).optional(),
  createOpportunity: z.boolean().default(true),
  opportunityName: z.string().max(200).optional(),
  opportunityAmount: z.number().positive().optional(),
  stageId: ObjectIdSchema.optional(),
  idempotencyKey: z.string().max(100).optional(),
});

// =============================================================================
// Contact Schemas
// =============================================================================

export const CreateContactInputSchema = z.object({
  accountId: ObjectIdSchema.optional().nullable(),
  firstName: z.string().min(1).max(100),
  lastName: z.string().min(1).max(100),
  email: EmailSchema,
  phone: PhoneSchema,
  mobile: PhoneSchema,
  title: z.string().max(100).optional().nullable(),
  department: z.string().max(100).optional().nullable(),
  linkedinUrl: URLSchema,
  isPrimary: z.boolean().optional().default(false),
  isDecisionMaker: z.boolean().optional().default(false),
  ownerId: z.string().optional(),
});

export const UpdateContactInputSchema = CreateContactInputSchema.partial();

export const ContactFilterSchema = z.object({
  accountId: ObjectIdSchema.optional(),
  ownerId: z.string().optional(),
  search: z.string().max(200).optional(),
  isPrimary: z.boolean().optional(),
  isDecisionMaker: z.boolean().optional(),
});

// =============================================================================
// Account Schemas
// =============================================================================

export const AccountTypeSchema = z.nativeEnum(AccountType);

export const AccountTierSchema = z.nativeEnum(AccountTier);

export const AccountStatusSchema = z.nativeEnum(AccountStatus);

export const AddressSchema = z.object({
  street: z.string().max(200),
  city: z.string().max(100),
  state: z.string().max(100),
  postalCode: z.string().max(20),
  country: z.string().max(100),
});

export const CreateAccountInputSchema = z.object({
  name: z.string().min(1).max(200),
  domain: z.string().max(100).optional().nullable(),
  website: URLSchema,
  industry: z.string().max(100).optional().nullable(),
  employees: z.number().int().positive().optional().nullable(),
  annualRevenue: z.number().positive().optional().nullable(),
  phone: PhoneSchema,
  billingAddress: AddressSchema.optional().nullable(),
  shippingAddress: AddressSchema.optional().nullable(),
  type: AccountTypeSchema.optional().default(AccountType.PROSPECT),
  tier: AccountTierSchema.optional().default(AccountTier.SMB),
  ownerId: z.string().optional(),
  parentAccountId: ObjectIdSchema.optional().nullable(),
});

export const UpdateAccountInputSchema = CreateAccountInputSchema.partial();

export const AccountFilterSchema = z.object({
  type: AccountTypeSchema.optional(),
  tier: AccountTierSchema.optional(),
  status: AccountStatusSchema.optional(),
  ownerId: z.string().optional(),
  industry: z.string().max(100).optional(),
  search: z.string().max(200).optional(),
});

// =============================================================================
// Stage Schemas
// =============================================================================

export const CreateStageInputSchema = z.object({
  name: z.string().min(1).max(100),
  order: z.number().int().min(0),
  probability: z.number().min(0).max(100),
  isWonStage: z.boolean().optional().default(false),
  isLostStage: z.boolean().optional().default(false),
  color: z.string().regex(/^#[0-9A-Fa-f]{6}$/).optional().default('#808080'),
  description: z.string().max(500).optional().nullable(),
});

export const UpdateStageInputSchema = CreateStageInputSchema.partial();

// =============================================================================
// Opportunity Schemas
// =============================================================================

export const OpportunityStatusSchema = z.nativeEnum(OpportunityStatus);

export const OpportunityTypeSchema = z.nativeEnum(OpportunityType);

export const CreateOpportunityInputSchema = z.object({
  accountId: ObjectIdSchema,
  contactId: ObjectIdSchema.optional().nullable(),
  name: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  stageId: ObjectIdSchema,
  amount: z.number().positive(),
  currency: z.string().length(3).default('USD'),
  probability: z.number().min(0).max(100).optional(),
  expectedCloseDate: z.coerce.date().optional().nullable(),
  type: OpportunityTypeSchema.optional().nullable(),
  leadSource: LeadSourceSchema,
  ownerId: z.string().optional(),
  nextStep: z.string().max(500).optional().nullable(),
});

export const UpdateOpportunityInputSchema = CreateOpportunityInputSchema.partial();

export const OpportunityFilterSchema = z.object({
  accountId: ObjectIdSchema.optional(),
  ownerId: z.string().optional(),
  stageId: ObjectIdSchema.optional(),
  status: OpportunityStatusSchema.optional(),
  type: OpportunityTypeSchema.optional(),
  search: z.string().max(200).optional(),
  minAmount: z.number().positive().optional(),
  maxAmount: z.number().positive().optional(),
  expectedCloseAfter: z.coerce.date().optional(),
  expectedCloseBefore: z.coerce.date().optional(),
});

export const MoveOpportunityStageInputSchema = z.object({
  opportunityId: ObjectIdSchema,
  stageId: ObjectIdSchema,
  notes: z.string().max(5000).optional().nullable(),
});

export const CloseOpportunityInputSchema = z.object({
  opportunityId: ObjectIdSchema,
  status: z.enum(['WON', 'LOST']),
  reason: z.string().max(1000).optional().nullable(),
  actualCloseDate: z.coerce.date().optional(),
  idempotencyKey: z.string().max(100).optional(),
});

// =============================================================================
// Activity Schemas
// =============================================================================

export const ActivityTypeSchema = z.nativeEnum(ActivityType);

export const ActivityStatusSchema = z.nativeEnum(ActivityStatus);

export const ActivityPrioritySchema = z.nativeEnum(ActivityPriority);

export const CreateActivityInputSchema = z.object({
  type: ActivityTypeSchema,
  subject: z.string().min(1).max(200),
  description: z.string().max(5000).optional().nullable(),
  relatedToType: z.enum(['LEAD', 'CONTACT', 'ACCOUNT', 'OPPORTUNITY']).optional().nullable(),
  relatedToId: ObjectIdSchema.optional().nullable(),
  dueDate: z.coerce.date().optional().nullable(),
  priority: ActivityPrioritySchema.optional().default(ActivityPriority.MEDIUM),
  location: z.string().max(500).optional().nullable(),
  durationMinutes: z.number().int().positive().optional().nullable(),
  ownerId: z.string().optional(),
});

export const UpdateActivityInputSchema = CreateActivityInputSchema.partial().extend({
  status: ActivityStatusSchema.optional(),
  completedAt: z.coerce.date().optional().nullable(),
  outcome: z.string().max(2000).optional().nullable(),
});

export const ActivityFilterSchema = z.object({
  type: ActivityTypeSchema.optional(),
  status: ActivityStatusSchema.optional(),
  priority: ActivityPrioritySchema.optional(),
  ownerId: z.string().optional(),
  relatedToType: z.enum(['LEAD', 'CONTACT', 'ACCOUNT', 'OPPORTUNITY']).optional(),
  relatedToId: ObjectIdSchema.optional(),
  dueAfter: z.coerce.date().optional(),
  dueBefore: z.coerce.date().optional(),
});

export const CompleteActivityInputSchema = z.object({
  activityId: ObjectIdSchema,
  outcome: z.string().max(2000).optional().nullable(),
});

// =============================================================================
// Note Schemas
// =============================================================================

export const NoteVisibilitySchema = z.nativeEnum(NoteVisibility);

export const CreateNoteInputSchema = z.object({
  body: z.string().min(1).max(10000),
  visibility: NoteVisibilitySchema.optional().default(NoteVisibility.TEAM),
  relatedToType: z.enum(['LEAD', 'CONTACT', 'ACCOUNT', 'OPPORTUNITY']),
  relatedToId: ObjectIdSchema,
});

export const UpdateNoteInputSchema = z.object({
  body: z.string().min(1).max(10000).optional(),
  visibility: NoteVisibilitySchema.optional(),
});

// =============================================================================
// Auth Schemas
// =============================================================================

export const LoginInputSchema = z.object({
  email: EmailSchema,
  password: z.string().min(8).max(100),
  tenantId: z.string().min(1),
});

export const RefreshTokenInputSchema = z.object({
  refreshToken: z.string().min(1),
});

// =============================================================================
// Pagination Input
// =============================================================================

export const PaginationInputSchema = z.object({
  first: PaginationLimitSchema.optional(),
  after: CursorSchema,
  last: z.number().int().min(1).max(100).optional(),
  before: CursorSchema,
});

// Infer types
export type CreateLeadInput = z.infer<typeof CreateLeadInputSchema>;
export type UpdateLeadInput = z.infer<typeof UpdateLeadInputSchema>;
export type LeadFilter = z.infer<typeof LeadFilterSchema>;
export type QualifyLeadInput = z.infer<typeof QualifyLeadInputSchema>;
export type ConvertLeadInput = z.infer<typeof ConvertLeadInputSchema>;
export type CreateContactInput = z.infer<typeof CreateContactInputSchema>;
export type ContactFilter = z.infer<typeof ContactFilterSchema>;
export type CreateAccountInput = z.infer<typeof CreateAccountInputSchema>;
export type AccountFilter = z.infer<typeof AccountFilterSchema>;
export type CreateStageInput = z.infer<typeof CreateStageInputSchema>;
export type CreateOpportunityInput = z.infer<typeof CreateOpportunityInputSchema>;
export type OpportunityFilter = z.infer<typeof OpportunityFilterSchema>;
export type MoveOpportunityStageInput = z.infer<typeof MoveOpportunityStageInputSchema>;
export type CloseOpportunityInput = z.infer<typeof CloseOpportunityInputSchema>;
export type CreateActivityInput = z.infer<typeof CreateActivityInputSchema>;
export type ActivityFilter = z.infer<typeof ActivityFilterSchema>;
export type CreateNoteInput = z.infer<typeof CreateNoteInputSchema>;
export type LoginInput = z.infer<typeof LoginInputSchema>;
export type PaginationInput = z.infer<typeof PaginationInputSchema>;
