// =============================================================================
// Core Entity Types - MongoDB Documents
// =============================================================================

import { ObjectId } from 'mongodb';

/**
 * Base para todas as entidades com soft delete
 */
export interface BaseEntity {
  _id: ObjectId;
  tenantId: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
  createdBy?: string;
  updatedBy?: string;
}

/**
 * Lead - Potencial cliente
 */
export interface Lead extends BaseEntity {
  ownerId: string;
  status: LeadStatus;
  source: LeadSource | null;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  companyName: string | null;
  title: string | null;
  website: string | null;
  industry: string | null;
  tags: string[];
  score: number;
  notes: string | null;
  qualifiedAt?: Date | null;
  convertedAt?: Date | null;
  convertedToContactId?: string | null;
  convertedToAccountId?: string | null;
  convertedToOpportunityId?: string | null;
}

export enum LeadStatus {
  NEW = 'NEW',
  CONTACTED = 'CONTACTED',
  QUALIFIED = 'QUALIFIED',
  CONVERTED = 'CONVERTED',
  UNQUALIFIED = 'UNQUALIFIED',
}

export enum LeadSource {
  WEBSITE = 'WEBSITE',
  REFERRAL = 'REFERRAL',
  COLD_CALL = 'COLD_CALL',
  TRADE_SHOW = 'TRADE_SHOW',
  SOCIAL_MEDIA = 'SOCIAL_MEDIA',
  ADVERTISEMENT = 'ADVERTISEMENT',
  PARTNER = 'PARTNER',
  OTHER = 'OTHER',
}

/**
 * Contact - Pessoa de contacto
 */
export interface Contact extends BaseEntity {
  accountId: string | null;
  ownerId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  mobile: string | null;
  title: string | null;
  department: string | null;
  linkedinUrl: string | null;
  isPrimary: boolean;
  isDecisionMaker: boolean;
  preferences: ContactPreferences | null;
}

export interface ContactPreferences {
  emailOptOut: boolean;
  phoneOptOut: boolean;
  preferredLanguage: string;
  timezone: string;
}

/**
 * Account - Empresa/Cliente
 */
export interface Account extends BaseEntity {
  ownerId: string;
  name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  employees: number | null;
  annualRevenue: number | null;
  phone: string | null;
  billingAddress: Address | null;
  shippingAddress: Address | null;
  type: AccountType;
  tier: AccountTier;
  status: AccountStatus;
  parentAccountId: string | null;
}

export interface Address {
  street: string;
  city: string;
  state: string;
  postalCode: string;
  country: string;
}

export enum AccountType {
  PROSPECT = 'PROSPECT',
  CUSTOMER = 'CUSTOMER',
  PARTNER = 'PARTNER',
  COMPETITOR = 'COMPETITOR',
  VENDOR = 'VENDOR',
}

export enum AccountTier {
  ENTERPRISE = 'ENTERPRISE',
  MID_MARKET = 'MID_MARKET',
  SMB = 'SMB',
  STARTUP = 'STARTUP',
}

export enum AccountStatus {
  ACTIVE = 'ACTIVE',
  INACTIVE = 'INACTIVE',
  CHURNED = 'CHURNED',
}

/**
 * Stage - Pipeline stage (configurável por tenant)
 */
export interface Stage extends BaseEntity {
  name: string;
  order: number;
  probability: number;
  isWonStage: boolean;
  isLostStage: boolean;
  isActive: boolean;
  color: string;
  description: string | null;
}

/**
 * Opportunity - Oportunidade de negócio
 */
export interface Opportunity extends BaseEntity {
  accountId: string;
  contactId: string | null;
  ownerId: string;
  name: string;
  description: string | null;
  stageId: string;
  amount: number;
  currency: string;
  probability: number;
  expectedCloseDate: Date | null;
  actualCloseDate: Date | null;
  status: OpportunityStatus;
  type: OpportunityType | null;
  leadSource: LeadSource | null;
  nextStep: string | null;
  competitorInfo: string | null;
  timeline: OpportunityTimeline[];
}

export enum OpportunityStatus {
  OPEN = 'OPEN',
  WON = 'WON',
  LOST = 'LOST',
}

export enum OpportunityType {
  NEW_BUSINESS = 'NEW_BUSINESS',
  EXISTING_BUSINESS = 'EXISTING_BUSINESS',
  RENEWAL = 'RENEWAL',
  UPSELL = 'UPSELL',
  CROSS_SELL = 'CROSS_SELL',
}

export interface OpportunityTimeline {
  date: Date;
  stageId: string;
  amount: number;
  notes: string | null;
}

/**
 * Activity - Atividades (calls, emails, meetings, tasks)
 */
export interface Activity extends BaseEntity {
  type: ActivityType;
  subject: string;
  description: string | null;
  ownerId: string;
  relatedToType: RelatedToType | null;
  relatedToId: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  status: ActivityStatus;
  priority: ActivityPriority;
  location: string | null;
  durationMinutes: number | null;
  outcome: string | null;
}

export enum ActivityType {
  CALL = 'CALL',
  EMAIL = 'EMAIL',
  MEETING = 'MEETING',
  TASK = 'TASK',
  NOTE = 'NOTE',
}

export enum ActivityStatus {
  PENDING = 'PENDING',
  IN_PROGRESS = 'IN_PROGRESS',
  COMPLETED = 'COMPLETED',
  CANCELLED = 'CANCELLED',
}

export enum ActivityPriority {
  HIGH = 'HIGH',
  MEDIUM = 'MEDIUM',
  LOW = 'LOW',
}

export type RelatedToType = 'LEAD' | 'CONTACT' | 'ACCOUNT' | 'OPPORTUNITY';

/**
 * Note - Notas anexadas a entidades
 */
export interface Note extends BaseEntity {
  body: string;
  visibility: NoteVisibility;
  relatedToType: RelatedToType;
  relatedToId: string;
}

export enum NoteVisibility {
  PRIVATE = 'PRIVATE',
  TEAM = 'TEAM',
  PUBLIC = 'PUBLIC',
}

/**
 * Attachment - File attachments for CRM entities
 */
export interface Attachment extends BaseEntity {
  fileName: string;
  originalName: string;
  mimeType: string;
  size: number;
  url: string;
  storageType: StorageType;
  storageKey: string;
  relatedToType: RelatedToType;
  relatedToId: string;
  uploadedBy: string;
  description: string | null;
  isAvatar: boolean;
  metadata: AttachmentMetadata | null;
}

/**
 * Storage type for attachments
 */
export enum StorageType {
  LOCAL = 'LOCAL',
  S3 = 'S3',
}

/**
 * Additional metadata for attachments
 */
export interface AttachmentMetadata {
  width?: number;
  height?: number;
  duration?: number;
  pages?: number;
  hash?: string;
  virusScanStatus?: VirusScanStatus;
  virusScannedAt?: Date;
}

/**
 * Virus scan status for uploaded files
 */
export enum VirusScanStatus {
  PENDING = 'PENDING',
  CLEAN = 'CLEAN',
  INFECTED = 'INFECTED',
  ERROR = 'ERROR',
}

/**
 * AuditLog - Log de auditoria (append-only)
 */
export interface AuditLog {
  _id: ObjectId;
  tenantId: string;
  entityType: string;
  entityId: string;
  action: AuditAction;
  actorId: string;
  actorEmail: string;
  changes: Record<string, { old: unknown; new: unknown }> | null;
  metadata: Record<string, unknown> | null;
  requestId: string;
  createdAt: Date;
}

export enum AuditAction {
  CREATE = 'CREATE',
  UPDATE = 'UPDATE',
  DELETE = 'DELETE',
  CONVERT = 'CONVERT',
  WON = 'WON',
  LOST = 'LOST',
}

/**
 * User - Utilizador do sistema
 */
export interface User extends BaseEntity {
  email: string;
  passwordHash: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  isActive: boolean;
  lastLoginAt: Date | null;
  preferences: UserPreferences | null;
}

export enum UserRole {
  ADMIN = 'ADMIN',
  MANAGER = 'MANAGER',
  SALES_REP = 'SALES_REP',
  READ_ONLY = 'READ_ONLY',
}

export interface UserPreferences {
  timezone: string;
  language: string;
  emailNotifications: boolean;
}

/**
 * Tenant - Multi-tenant
 */
export interface Tenant {
  _id: ObjectId;
  name: string;
  slug: string;
  plan: TenantPlan;
  isActive: boolean;
  settings: TenantSettings;
  createdAt: Date;
  updatedAt: Date;
}

export enum TenantPlan {
  FREE = 'FREE',
  STARTER = 'STARTER',
  PROFESSIONAL = 'PROFESSIONAL',
  ENTERPRISE = 'ENTERPRISE',
}

export interface TenantSettings {
  defaultCurrency: string;
  fiscalYearStart: number;
  dateFormat: string;
  timezone: string;
  features: TenantFeatures;
}

export interface TenantFeatures {
  customStages: boolean;
  advancedReporting: boolean;
  apiAccess: boolean;
  ssoEnabled: boolean;
  maxUsers: number;
  maxRecords: number;
}
