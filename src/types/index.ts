// CRM Entity Types

export interface User {
  id: string;
  email: string;
  firstName: string;
  lastName: string;
  role: UserRole;
}

export type UserRole = 'ADMIN' | 'SALES_REP' | 'SALES_MANAGER' | 'READ_ONLY';

export interface Tenant {
  id: string;
  name: string;
  slug: string;
  plan: TenantPlan;
}

export type TenantPlan = 'free' | 'starter' | 'professional' | 'enterprise';

export interface Lead {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  companyName?: string;
  title?: string;
  status: LeadStatus;
  score?: number;
  createdAt: string;
  updatedAt: string;
}

export type LeadStatus = 'NEW' | 'CONTACTED' | 'QUALIFIED' | 'CONVERTED' | 'UNQUALIFIED';

export interface Opportunity {
  id: string;
  name: string;
  amount: number;
  status: OpportunityStatus;
  probability: number;
  stageId?: string;
  stage?: Stage;
  accountId?: string;
  contactId?: string;
  expectedCloseDate?: string;
  createdAt: string;
  updatedAt: string;
}

export type OpportunityStatus = 'OPEN' | 'WON' | 'LOST';

export interface Stage {
  id: string;
  name: string;
  order: number;
  probability: number;
  color?: string;
  isActive: boolean;
}

export interface Account {
  id: string;
  name: string;
  domain?: string;
  website?: string;
  industry?: string;
  type?: AccountType;
  tier?: AccountTier;
  createdAt: string;
}

export type AccountType = 'PROSPECT' | 'CUSTOMER' | 'PARTNER' | 'COMPETITOR' | 'VENDOR';
export type AccountTier = 'ENTERPRISE' | 'MID_MARKET' | 'SMB' | 'STARTUP';

export interface Contact {
  id: string;
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  accountId?: string;
  createdAt: string;
}

// Auth Types
export interface AuthTokens {
  accessToken: string;
  refreshToken: string;
}

export interface LoginInput {
  email: string;
  password: string;
  tenantId: string;
}

export interface RegisterInput {
  email: string;
  password: string;
  firstName: string;
  lastName: string;
  tenantName: string;
  tenantSlug: string;
}

export interface RefreshTokenInput {
  refreshToken: string;
}

// Lead Mutations
export interface CreateLeadInput {
  firstName: string;
  lastName: string;
  email: string;
  phone?: string;
  companyName?: string;
}

export interface QualifyLeadInput {
  leadId: string;
  notes?: string;
}

export interface ConvertLeadInput {
  leadId: string;
  createOpportunity?: boolean;
  opportunityName?: string;
  opportunityAmount?: number;
  stageId?: string;
}

// Dashboard Types
export interface DashboardStats {
  totalLeads: number;
  qualifiedLeads: number;
  convertedLeads: number;
  totalOpportunities: number;
  openOpportunities: number;
  totalPipelineValue: number;
  wonValue: number;
  lostValue: number;
}

export interface LeadConversionStats {
  source: string;
  total: number;
  converted: number;
  conversionRate: number;
}

export interface ActivityStats {
  type: string;
  count: number;
  completed: number;
}

// Pagination Types (Relay-style)
export interface PageInfo {
  hasNextPage: boolean;
  hasPreviousPage: boolean;
  startCursor?: string;
  endCursor?: string;
  totalCount: number;
}

export interface Edge<T> {
  node: T;
  cursor: string;
}

export interface Connection<T> {
  edges: Edge<T>[];
  pageInfo: PageInfo;
}

// Filter Types
export interface LeadFilters {
  status?: LeadStatus;
  search?: string;
  minScore?: number;
}

export interface OpportunityFilters {
  status?: OpportunityStatus;
  stageId?: string;
  minAmount?: number;
  maxAmount?: number;
}

// Bulk Operations
export interface BulkOperationResult {
  success: boolean;
  processedCount: number;
  successCount: number;
  failedCount: number;
  errors: BulkError[];
}

export interface BulkError {
  index: number;
  error: string;
}

// Attachment
export interface Attachment {
  id: string;
  filename: string;
  mimeType: string;
  size: number;
  url: string;
}
