// =============================================================================
// GraphQL Context Types
// =============================================================================

import { UserRole, TenantSettings, TenantPlan } from './entities.js';
import { ObjectId } from 'mongodb';
import DataLoader from 'dataloader';

// Re-export types for external use
export { TenantPlan, UserRole } from './entities.js';

/**
 * Utilizador autenticado no contexto
 */
export interface ContextUser {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
  tenantId: string;
}

/**
 * Tenant no contexto
 */
export interface ContextTenant {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
  settings: TenantSettings;
}

/**
 * DataLoaders disponíveis no contexto
 */
export interface DataLoaders {
  leadById: DataLoader<string, LeadLoaderResult | null, string>;
  contactById: DataLoader<string, ContactLoaderResult | null, string>;
  accountById: DataLoader<string, AccountLoaderResult | null, string>;
  opportunityById: DataLoader<string, OpportunityLoaderResult | null, string>;
  stageById: DataLoader<string, StageLoaderResult | null, string>;
  contactsByAccountId: DataLoader<string, ContactLoaderResult[], string>;
  opportunitiesByAccountId: DataLoader<string, OpportunityLoaderResult[], string>;
  activitiesByRelatedTo: DataLoader<string, ActivityLoaderResult[], string>;
}

/**
 * Contexto GraphQL
 */
export interface GraphQLContext {
  // Autenticação e autorização
  user: ContextUser | null;
  tenant: ContextTenant | null;
  isAuthenticated: boolean;

  // Request metadata
  requestId: string;
  correlationId: string;
  ipAddress: string | null;
  userAgent: string | null;

  // DataLoaders
  loaders: DataLoaders;

  // Helpers
  hasPermission: (permission: Permission) => boolean;
  hasRole: (role: UserRole) => boolean;
  requireAuth: () => ContextUser;
  requireTenant: () => ContextTenant;
}

/**
 * Permissões do sistema
 */
export enum Permission {
  // Leads
  LEAD_READ = 'LEAD_READ',
  LEAD_CREATE = 'LEAD_CREATE',
  LEAD_UPDATE = 'LEAD_UPDATE',
  LEAD_DELETE = 'LEAD_DELETE',
  LEAD_CONVERT = 'LEAD_CONVERT',

  // Contacts
  CONTACT_READ = 'CONTACT_READ',
  CONTACT_CREATE = 'CONTACT_CREATE',
  CONTACT_UPDATE = 'CONTACT_UPDATE',
  CONTACT_DELETE = 'CONTACT_DELETE',

  // Accounts
  ACCOUNT_READ = 'ACCOUNT_READ',
  ACCOUNT_CREATE = 'ACCOUNT_CREATE',
  ACCOUNT_UPDATE = 'ACCOUNT_UPDATE',
  ACCOUNT_DELETE = 'ACCOUNT_DELETE',

  // Opportunities
  OPPORTUNITY_READ = 'OPPORTUNITY_READ',
  OPPORTUNITY_CREATE = 'OPPORTUNITY_CREATE',
  OPPORTUNITY_UPDATE = 'OPPORTUNITY_UPDATE',
  OPPORTUNITY_DELETE = 'OPPORTUNITY_DELETE',
  OPPORTUNITY_CLOSE_WON = 'OPPORTUNITY_CLOSE_WON',
  OPPORTUNITY_CLOSE_LOST = 'OPPORTUNITY_CLOSE_LOST',

  // Activities
  ACTIVITY_READ = 'ACTIVITY_READ',
  ACTIVITY_CREATE = 'ACTIVITY_CREATE',
  ACTIVITY_UPDATE = 'ACTIVITY_UPDATE',
  ACTIVITY_DELETE = 'ACTIVITY_DELETE',

  // Pipeline/Stages
  STAGE_MANAGE = 'STAGE_MANAGE',

  // Webhooks
  WEBHOOK_READ = 'WEBHOOK_READ',
  WEBHOOK_CREATE = 'WEBHOOK_CREATE',
  WEBHOOK_UPDATE = 'WEBHOOK_UPDATE',
  WEBHOOK_DELETE = 'WEBHOOK_DELETE',
  WEBHOOK_TEST = 'WEBHOOK_TEST',

  // Admin
  ADMIN_ACCESS = 'ADMIN_ACCESS',
  USER_MANAGE = 'USER_MANAGE',
  TENANT_MANAGE = 'TENANT_MANAGE',
}

/**
 * Mapeamento de roles para permissões
 */
export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  [UserRole.ADMIN]: Object.values(Permission),
  [UserRole.MANAGER]: [
    Permission.LEAD_READ,
    Permission.LEAD_CREATE,
    Permission.LEAD_UPDATE,
    Permission.LEAD_DELETE,
    Permission.LEAD_CONVERT,
    Permission.CONTACT_READ,
    Permission.CONTACT_CREATE,
    Permission.CONTACT_UPDATE,
    Permission.CONTACT_DELETE,
    Permission.ACCOUNT_READ,
    Permission.ACCOUNT_CREATE,
    Permission.ACCOUNT_UPDATE,
    Permission.ACCOUNT_DELETE,
    Permission.OPPORTUNITY_READ,
    Permission.OPPORTUNITY_CREATE,
    Permission.OPPORTUNITY_UPDATE,
    Permission.OPPORTUNITY_DELETE,
    Permission.OPPORTUNITY_CLOSE_WON,
    Permission.OPPORTUNITY_CLOSE_LOST,
    Permission.ACTIVITY_READ,
    Permission.ACTIVITY_CREATE,
    Permission.ACTIVITY_UPDATE,
    Permission.ACTIVITY_DELETE,
    Permission.STAGE_MANAGE,
    Permission.WEBHOOK_READ,
    Permission.WEBHOOK_CREATE,
    Permission.WEBHOOK_UPDATE,
    Permission.WEBHOOK_DELETE,
    Permission.WEBHOOK_TEST,
  ],
  [UserRole.SALES_REP]: [
    Permission.LEAD_READ,
    Permission.LEAD_CREATE,
    Permission.LEAD_UPDATE,
    Permission.LEAD_CONVERT,
    Permission.CONTACT_READ,
    Permission.CONTACT_CREATE,
    Permission.CONTACT_UPDATE,
    Permission.ACCOUNT_READ,
    Permission.ACCOUNT_CREATE,
    Permission.ACCOUNT_UPDATE,
    Permission.OPPORTUNITY_READ,
    Permission.OPPORTUNITY_CREATE,
    Permission.OPPORTUNITY_UPDATE,
    Permission.OPPORTUNITY_CLOSE_WON,
    Permission.OPPORTUNITY_CLOSE_LOST,
    Permission.ACTIVITY_READ,
    Permission.ACTIVITY_CREATE,
    Permission.ACTIVITY_UPDATE,
    Permission.WEBHOOK_READ,
  ],
  [UserRole.READ_ONLY]: [
    Permission.LEAD_READ,
    Permission.CONTACT_READ,
    Permission.ACCOUNT_READ,
    Permission.OPPORTUNITY_READ,
    Permission.ACTIVITY_READ,
    Permission.WEBHOOK_READ,
  ],
};

// =============================================================================
// Loader Result Types
// =============================================================================

export interface LeadLoaderResult {
  _id: ObjectId;
  tenantId: string;
  ownerId: string;
  status: string;
  source: string | null;
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
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface ContactLoaderResult {
  _id: ObjectId;
  tenantId: string;
  accountId: string | null;
  ownerId: string;
  firstName: string;
  lastName: string;
  email: string;
  phone: string | null;
  mobile: string | null;
  title: string | null;
  department: string | null;
  isPrimary: boolean;
  isDecisionMaker: boolean;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface AccountLoaderResult {
  _id: ObjectId;
  tenantId: string;
  ownerId: string;
  name: string;
  domain: string | null;
  website: string | null;
  industry: string | null;
  employees: number | null;
  annualRevenue: number | null;
  phone: string | null;
  type: string;
  tier: string;
  status: string;
  parentAccountId: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface OpportunityLoaderResult {
  _id: ObjectId;
  tenantId: string;
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
  status: string;
  type: string | null;
  nextStep: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}

export interface StageLoaderResult {
  _id: ObjectId;
  tenantId: string;
  name: string;
  order: number;
  probability: number;
  isWonStage: boolean;
  isLostStage: boolean;
  isActive: boolean;
  color: string;
  description: string | null;
}

export interface ActivityLoaderResult {
  _id: ObjectId;
  tenantId: string;
  type: string;
  subject: string;
  description: string | null;
  ownerId: string;
  relatedToType: string | null;
  relatedToId: string | null;
  dueDate: Date | null;
  completedAt: Date | null;
  status: string;
  priority: string;
  createdAt: Date;
  updatedAt: Date;
  deletedAt?: Date | null;
}
