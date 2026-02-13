// =============================================================================
// MongoDB Index Creation Script
// Run with: npm run indexes:create
// =============================================================================

import { connectToMongo, closeMongo } from '../src/infrastructure/mongo/connection.js';
import { Db, IndexDirection } from 'mongodb';
import { logger } from '../src/infrastructure/logging/index.js';

interface IndexDefinition {
  key: { [key: string]: IndexDirection };
  options?: {
    unique?: boolean;
    sparse?: boolean;
    background?: boolean;
    name?: string;
  };
}

interface CollectionIndexes {
  [collectionName: string]: IndexDefinition[];
}

// Index definitions aligned with real query patterns
const INDEXES: CollectionIndexes = {
  // ===========================================================================
  // Leads
  // ===========================================================================
  leads: [
    // Tenant + ID (for findById)
    {
      key: { tenantId: 1, _id: 1 },
      options: { name: 'idx_tenant_id' },
    },
    // Tenant + Email (for deduplication, unique)
    {
      key: { tenantId: 1, email: 1 },
      options: { unique: true, sparse: true, name: 'idx_tenant_email_unique' },
    },
    // Tenant + Status (for filtering)
    {
      key: { tenantId: 1, status: 1 },
      options: { name: 'idx_tenant_status' },
    },
    // Tenant + Owner (for owner-based queries)
    {
      key: { tenantId: 1, ownerId: 1 },
      options: { name: 'idx_tenant_owner' },
    },
    // Tenant + CreatedAt (for sorting and filtering)
    {
      key: { tenantId: 1, createdAt: -1 },
      options: { name: 'idx_tenant_created' },
    },
    // Tenant + DeletedAt (for soft delete queries)
    {
      key: { tenantId: 1, deletedAt: 1 },
      options: { sparse: true, name: 'idx_tenant_deleted' },
    },
    // Compound for list queries
    {
      key: { tenantId: 1, status: 1, createdAt: -1 },
      options: { name: 'idx_tenant_status_created' },
    },
    // Text search index
    {
      key: { firstName: 'text', lastName: 'text', email: 'text', companyName: 'text' },
      options: { name: 'idx_text_search' },
    },
  ],

  // ===========================================================================
  // Contacts
  // ===========================================================================
  contacts: [
    {
      key: { tenantId: 1, _id: 1 },
      options: { name: 'idx_tenant_id' },
    },
    {
      key: { tenantId: 1, email: 1 },
      options: { unique: true, sparse: true, name: 'idx_tenant_email_unique' },
    },
    {
      key: { tenantId: 1, accountId: 1 },
      options: { name: 'idx_tenant_account' },
    },
    {
      key: { tenantId: 1, ownerId: 1 },
      options: { name: 'idx_tenant_owner' },
    },
    {
      key: { tenantId: 1, createdAt: -1 },
      options: { name: 'idx_tenant_created' },
    },
    {
      key: { tenantId: 1, deletedAt: 1 },
      options: { sparse: true, name: 'idx_tenant_deleted' },
    },
  ],

  // ===========================================================================
  // Accounts
  // ===========================================================================
  accounts: [
    {
      key: { tenantId: 1, _id: 1 },
      options: { name: 'idx_tenant_id' },
    },
    {
      key: { tenantId: 1, domain: 1 },
      options: { unique: true, sparse: true, name: 'idx_tenant_domain_unique' },
    },
    {
      key: { tenantId: 1, ownerId: 1 },
      options: { name: 'idx_tenant_owner' },
    },
    {
      key: { tenantId: 1, type: 1 },
      options: { name: 'idx_tenant_type' },
    },
    {
      key: { tenantId: 1, status: 1 },
      options: { name: 'idx_tenant_status' },
    },
    {
      key: { tenantId: 1, createdAt: -1 },
      options: { name: 'idx_tenant_created' },
    },
    {
      key: { tenantId: 1, deletedAt: 1 },
      options: { sparse: true, name: 'idx_tenant_deleted' },
    },
  ],

  // ===========================================================================
  // Opportunities
  // ===========================================================================
  opportunities: [
    {
      key: { tenantId: 1, _id: 1 },
      options: { name: 'idx_tenant_id' },
    },
    {
      key: { tenantId: 1, accountId: 1 },
      options: { name: 'idx_tenant_account' },
    },
    {
      key: { tenantId: 1, ownerId: 1 },
      options: { name: 'idx_tenant_owner' },
    },
    {
      key: { tenantId: 1, stageId: 1 },
      options: { name: 'idx_tenant_stage' },
    },
    {
      key: { tenantId: 1, status: 1 },
      options: { name: 'idx_tenant_status' },
    },
    {
      key: { tenantId: 1, expectedCloseDate: 1 },
      options: { name: 'idx_tenant_close_date' },
    },
    {
      key: { tenantId: 1, createdAt: -1 },
      options: { name: 'idx_tenant_created' },
    },
    {
      key: { tenantId: 1, deletedAt: 1 },
      options: { sparse: true, name: 'idx_tenant_deleted' },
    },
    // Compound for pipeline queries
    {
      key: { tenantId: 1, status: 1, stageId: 1 },
      options: { name: 'idx_tenant_status_stage' },
    },
  ],

  // ===========================================================================
  // Stages
  // ===========================================================================
  stages: [
    {
      key: { tenantId: 1, _id: 1 },
      options: { name: 'idx_tenant_id' },
    },
    {
      key: { tenantId: 1, order: 1 },
      options: { name: 'idx_tenant_order' },
    },
    {
      key: { tenantId: 1, isActive: 1 },
      options: { name: 'idx_tenant_active' },
    },
  ],

  // ===========================================================================
  // Activities
  // ===========================================================================
  activities: [
    {
      key: { tenantId: 1, _id: 1 },
      options: { name: 'idx_tenant_id' },
    },
    {
      key: { tenantId: 1, ownerId: 1 },
      options: { name: 'idx_tenant_owner' },
    },
    {
      key: { tenantId: 1, relatedToType: 1, relatedToId: 1 },
      options: { name: 'idx_tenant_related' },
    },
    {
      key: { tenantId: 1, status: 1 },
      options: { name: 'idx_tenant_status' },
    },
    {
      key: { tenantId: 1, dueDate: 1 },
      options: { name: 'idx_tenant_due' },
    },
    {
      key: { tenantId: 1, createdAt: -1 },
      options: { name: 'idx_tenant_created' },
    },
    {
      key: { tenantId: 1, deletedAt: 1 },
      options: { sparse: true, name: 'idx_tenant_deleted' },
    },
  ],

  // ===========================================================================
  // Notes
  // ===========================================================================
  notes: [
    {
      key: { tenantId: 1, _id: 1 },
      options: { name: 'idx_tenant_id' },
    },
    {
      key: { tenantId: 1, relatedToType: 1, relatedToId: 1 },
      options: { name: 'idx_tenant_related' },
    },
    {
      key: { tenantId: 1, createdAt: -1 },
      options: { name: 'idx_tenant_created' },
    },
  ],

  // ===========================================================================
  // Audit Logs (append-only)
  // ===========================================================================
  audit_logs: [
    {
      key: { tenantId: 1, createdAt: -1 },
      options: { name: 'idx_tenant_created' },
    },
    {
      key: { tenantId: 1, entityType: 1, entityId: 1 },
      options: { name: 'idx_tenant_entity' },
    },
    {
      key: { tenantId: 1, actorId: 1 },
      options: { name: 'idx_tenant_actor' },
    },
    {
      key: { requestId: 1 },
      options: { name: 'idx_request' },
    },
  ],

  // ===========================================================================
  // Users
  // ===========================================================================
  users: [
    {
      key: { tenantId: 1, email: 1 },
      options: { unique: true, name: 'idx_tenant_email_unique' },
    },
    {
      key: { tenantId: 1, _id: 1 },
      options: { name: 'idx_tenant_id' },
    },
  ],

  // ===========================================================================
  // Tenants
  // ===========================================================================
  tenants: [
    {
      key: { slug: 1 },
      options: { unique: true, name: 'idx_slug_unique' },
    },
  ],
};

async function createIndexes(db: Db): Promise<void> {
  logger.info('Starting index creation...');

  for (const [collectionName, indexes] of Object.entries(INDEXES)) {
    logger.info(`Creating indexes for collection: ${collectionName}`);

    const collection = db.collection(collectionName);

    for (const indexDef of indexes) {
      try {
        await collection.createIndex(indexDef.key, indexDef.options || {});
        logger.info(`  ✓ Index created: ${indexDef.options?.name || JSON.stringify(indexDef.key)}`);
      } catch (error) {
        logger.error(`  ✗ Failed to create index: ${indexDef.options?.name}`, {
          error: String(error),
        });
      }
    }
  }

  logger.info('Index creation completed!');
}

async function main(): Promise<void> {
  try {
    const db = await connectToMongo();
    await createIndexes(db);
    await closeMongo();
    process.exit(0);
  } catch (error) {
    logger.error('Index creation failed', { error: String(error) });
    process.exit(1);
  }
}

main();
