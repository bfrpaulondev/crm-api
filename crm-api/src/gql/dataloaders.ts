// =============================================================================
// DataLoader Factory - N+1 Query Prevention
// =============================================================================

import DataLoader from 'dataloader';
import { ObjectId } from 'mongodb';
import { getDb } from '@/infrastructure/mongo/connection.js';
import {
  LeadLoaderResult,
  ContactLoaderResult,
  AccountLoaderResult,
  OpportunityLoaderResult,
  StageLoaderResult,
  ActivityLoaderResult,
} from '@/types/context.js';

// ============================================================================
// Loader Functions
// ============================================================================

async function batchLoadLeads(
  tenantId: string,
  ids: readonly string[]
): Promise<(LeadLoaderResult | null)[]> {
  const db = getDb();
  const objectIds = ids.map((id) => new ObjectId(id));

  const leads = await db
    .collection<LeadLoaderResult>('leads')
    .find({
      _id: { $in: objectIds },
      tenantId,
    })
    .toArray();

  // Map para lookup rápido
  const leadMap = new Map<string, LeadLoaderResult>();
  for (const lead of leads) {
    leadMap.set(lead._id.toHexString(), lead);
  }

  // Retornar na mesma ordem dos ids
  return ids.map((id) => leadMap.get(id) ?? null);
}

async function batchLoadContacts(
  tenantId: string,
  ids: readonly string[]
): Promise<(ContactLoaderResult | null)[]> {
  const db = getDb();
  const objectIds = ids.map((id) => new ObjectId(id));

  const contacts = await db
    .collection<ContactLoaderResult>('contacts')
    .find({
      _id: { $in: objectIds },
      tenantId,
    })
    .toArray();

  const contactMap = new Map<string, ContactLoaderResult>();
  for (const contact of contacts) {
    contactMap.set(contact._id.toHexString(), contact);
  }

  return ids.map((id) => contactMap.get(id) ?? null);
}

async function batchLoadAccounts(
  tenantId: string,
  ids: readonly string[]
): Promise<(AccountLoaderResult | null)[]> {
  const db = getDb();
  const objectIds = ids.map((id) => new ObjectId(id));

  const accounts = await db
    .collection<AccountLoaderResult>('accounts')
    .find({
      _id: { $in: objectIds },
      tenantId,
    })
    .toArray();

  const accountMap = new Map<string, AccountLoaderResult>();
  for (const account of accounts) {
    accountMap.set(account._id.toHexString(), account);
  }

  return ids.map((id) => accountMap.get(id) ?? null);
}

async function batchLoadOpportunities(
  tenantId: string,
  ids: readonly string[]
): Promise<(OpportunityLoaderResult | null)[]> {
  const db = getDb();
  const objectIds = ids.map((id) => new ObjectId(id));

  const opportunities = await db
    .collection<OpportunityLoaderResult>('opportunities')
    .find({
      _id: { $in: objectIds },
      tenantId,
    })
    .toArray();

  const opportunityMap = new Map<string, OpportunityLoaderResult>();
  for (const opp of opportunities) {
    opportunityMap.set(opp._id.toHexString(), opp);
  }

  return ids.map((id) => opportunityMap.get(id) ?? null);
}

async function batchLoadStages(
  tenantId: string,
  ids: readonly string[]
): Promise<(StageLoaderResult | null)[]> {
  const db = getDb();
  const objectIds = ids.map((id) => new ObjectId(id));

  const stages = await db
    .collection<StageLoaderResult>('stages')
    .find({
      _id: { $in: objectIds },
      tenantId,
    })
    .toArray();

  const stageMap = new Map<string, StageLoaderResult>();
  for (const stage of stages) {
    stageMap.set(stage._id.toHexString(), stage);
  }

  return ids.map((id) => stageMap.get(id) ?? null);
}

async function batchLoadContactsByAccount(
  tenantId: string,
  accountIds: readonly string[]
): Promise<ContactLoaderResult[][]> {
  const db = getDb();

  const contacts = await db
    .collection<ContactLoaderResult>('contacts')
    .find({
      accountId: { $in: accountIds },
      tenantId,
      deletedAt: null,
    })
    .toArray();

  // Agrupar por accountId
  const contactsByAccount = new Map<string, ContactLoaderResult[]>();
  for (const contact of contacts) {
    const existing = contactsByAccount.get(contact.accountId!) ?? [];
    existing.push(contact);
    contactsByAccount.set(contact.accountId!, existing);
  }

  return accountIds.map((id) => contactsByAccount.get(id) ?? []);
}

async function batchLoadOpportunitiesByAccount(
  tenantId: string,
  accountIds: readonly string[]
): Promise<OpportunityLoaderResult[][]> {
  const db = getDb();

  const opportunities = await db
    .collection<OpportunityLoaderResult>('opportunities')
    .find({
      accountId: { $in: accountIds },
      tenantId,
      deletedAt: null,
    })
    .toArray();

  const oppsByAccount = new Map<string, OpportunityLoaderResult[]>();
  for (const opp of opportunities) {
    const existing = oppsByAccount.get(opp.accountId) ?? [];
    existing.push(opp);
    oppsByAccount.set(opp.accountId, existing);
  }

  return accountIds.map((id) => oppsByAccount.get(id) ?? []);
}

async function batchLoadActivitiesByRelatedTo(
  tenantId: string,
  keys: readonly string[]
): Promise<ActivityLoaderResult[][]> {
  const db = getDb();

  // Keys são "type:id"
  const parsedKeys = keys.map((k) => {
    const [type, id] = k.split(':');
    return { type, id };
  });

  const activities = await db
    .collection<ActivityLoaderResult>('activities')
    .find({
      tenantId,
      deletedAt: null,
      $or: parsedKeys.map((k) => ({
        relatedToType: k.type,
        relatedToId: k.id,
      })),
    })
    .toArray();

  const activitiesByKey = new Map<string, ActivityLoaderResult[]>();
  for (const activity of activities) {
    const key = `${activity.relatedToType}:${activity.relatedToId}`;
    const existing = activitiesByKey.get(key) ?? [];
    existing.push(activity);
    activitiesByKey.set(key, existing);
  }

  return keys.map((k) => activitiesByKey.get(k) ?? []);
}

// ============================================================================
// DataLoaders Factory
// ============================================================================

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

export function createDataLoaders(tenantId: string): DataLoaders {
  return {
    leadById: new DataLoader<string, LeadLoaderResult | null>((ids) =>
      batchLoadLeads(tenantId, ids)
    ),
    contactById: new DataLoader<string, ContactLoaderResult | null>((ids) =>
      batchLoadContacts(tenantId, ids)
    ),
    accountById: new DataLoader<string, AccountLoaderResult | null>((ids) =>
      batchLoadAccounts(tenantId, ids)
    ),
    opportunityById: new DataLoader<string, OpportunityLoaderResult | null>((ids) =>
      batchLoadOpportunities(tenantId, ids)
    ),
    stageById: new DataLoader<string, StageLoaderResult | null>((ids) =>
      batchLoadStages(tenantId, ids)
    ),
    contactsByAccountId: new DataLoader<string, ContactLoaderResult[]>((ids) =>
      batchLoadContactsByAccount(tenantId, ids)
    ),
    opportunitiesByAccountId: new DataLoader<string, OpportunityLoaderResult[]>((ids) =>
      batchLoadOpportunitiesByAccount(tenantId, ids)
    ),
    activitiesByRelatedTo: new DataLoader<string, ActivityLoaderResult[]>((keys) =>
      batchLoadActivitiesByRelatedTo(tenantId, keys)
    ),
  };
}
