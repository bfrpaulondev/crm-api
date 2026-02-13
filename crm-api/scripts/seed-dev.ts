// =============================================================================
// Development Seed Script
// Run with: npm run seed:dev
// =============================================================================

import { connectToMongo, closeMongo } from '../src/infrastructure/mongo/connection.js';
import { connectToRedis, closeRedis } from '../src/infrastructure/redis/client.js';
import { logger } from '../src/infrastructure/logging/index.js';
import { ObjectId } from 'mongodb';
import { LeadStatus, LeadSource, OpportunityStatus, AccountType, AccountTier, AccountStatus, ActivityType, ActivityStatus, ActivityPriority, UserRole } from '../src/types/entities.js';

const TENANT_ID = 'dev-tenant-001';
const ADMIN_USER_ID = 'dev-admin-001';
const SALES_USER_ID = 'dev-sales-001';

async function seed() {
  const db = await connectToMongo();
  connectToRedis();

  logger.info('Starting development seed...');

  const now = new Date();

  // ===========================================================================
  // Create Tenant
  // ===========================================================================

  await db.collection('tenants').deleteMany({});
  await db.collection('tenants').insertOne({
    _id: new ObjectId(TENANT_ID),
    name: 'Acme Corporation',
    slug: 'acme-corp',
    plan: 'PROFESSIONAL',
    isActive: true,
    settings: {
      defaultCurrency: 'USD',
      fiscalYearStart: 1,
      dateFormat: 'YYYY-MM-DD',
      timezone: 'America/New_York',
      features: {
        customStages: true,
        advancedReporting: true,
        apiAccess: true,
        ssoEnabled: false,
        maxUsers: 50,
        maxRecords: 100000,
      },
    },
    createdAt: now,
    updatedAt: now,
  });

  logger.info('Created tenant');

  // ===========================================================================
  // Create Users
  // ===========================================================================

  await db.collection('users').deleteMany({});
  await db.collection('users').insertMany([
    {
      _id: new ObjectId(ADMIN_USER_ID),
      tenantId: TENANT_ID,
      email: 'admin@acme.com',
      passwordHash: 'hashed_password_would_go_here', // In production, use proper hash
      firstName: 'Admin',
      lastName: 'User',
      role: UserRole.ADMIN,
      isActive: true,
      lastLoginAt: now,
      preferences: {
        timezone: 'America/New_York',
        language: 'en',
        emailNotifications: true,
      },
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: new ObjectId(SALES_USER_ID),
      tenantId: TENANT_ID,
      email: 'sales@acme.com',
      passwordHash: 'hashed_password_would_go_here',
      firstName: 'John',
      lastName: 'Sales',
      role: UserRole.SALES_REP,
      isActive: true,
      lastLoginAt: now,
      preferences: {
        timezone: 'America/New_York',
        language: 'en',
        emailNotifications: true,
      },
      createdAt: now,
      updatedAt: now,
    },
  ]);

  logger.info('Created users');

  // ===========================================================================
  // Create Stages
  // ===========================================================================

  await db.collection('stages').deleteMany({});
  const stages = await db.collection('stages').insertMany([
    {
      _id: new ObjectId(),
      tenantId: TENANT_ID,
      name: 'Discovery',
      order: 1,
      probability: 10,
      isWonStage: false,
      isLostStage: false,
      isActive: true,
      color: '#3498db',
      description: 'Initial discovery and research',
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: new ObjectId(),
      tenantId: TENANT_ID,
      name: 'Qualification',
      order: 2,
      probability: 25,
      isWonStage: false,
      isLostStage: false,
      isActive: true,
      color: '#9b59b6',
      description: 'Qualifying the lead',
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: new ObjectId(),
      tenantId: TENANT_ID,
      name: 'Proposal',
      order: 3,
      probability: 50,
      isWonStage: false,
      isLostStage: false,
      isActive: true,
      color: '#f1c40f',
      description: 'Proposal sent',
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: new ObjectId(),
      tenantId: TENANT_ID,
      name: 'Negotiation',
      order: 4,
      probability: 75,
      isWonStage: false,
      isLostStage: false,
      isActive: true,
      color: '#e67e22',
      description: 'Negotiating terms',
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: new ObjectId(),
      tenantId: TENANT_ID,
      name: 'Closed Won',
      order: 5,
      probability: 100,
      isWonStage: true,
      isLostStage: false,
      isActive: true,
      color: '#27ae60',
      description: 'Deal closed successfully',
      createdAt: now,
      updatedAt: now,
    },
    {
      _id: new ObjectId(),
      tenantId: TENANT_ID,
      name: 'Closed Lost',
      order: 6,
      probability: 0,
      isWonStage: false,
      isLostStage: true,
      isActive: true,
      color: '#e74c3c',
      description: 'Deal lost',
      createdAt: now,
      updatedAt: now,
    },
  ]);

  const stageIds = Object.keys(stages.insertedIds);
  logger.info('Created stages');

  // ===========================================================================
  // Create Leads
  // ===========================================================================

  await db.collection('leads').deleteMany({});
  const leadNames = [
    { first: 'Alice', last: 'Johnson', company: 'TechStart Inc', source: LeadSource.WEBSITE },
    { first: 'Bob', last: 'Smith', company: 'DataFlow Corp', source: LeadSource.REFERRAL },
    { first: 'Carol', last: 'Williams', company: 'CloudNine Ltd', source: LeadSource.LINKEDIN },
    { first: 'David', last: 'Brown', company: 'InnovateTech', source: LeadSource.TRADE_SHOW },
    { first: 'Eve', last: 'Davis', company: 'NextGen Systems', source: LeadSource.PARTNER },
    { first: 'Frank', last: 'Miller', company: 'Quantum Solutions', source: LeadSource.COLD_CALL },
    { first: 'Grace', last: 'Wilson', company: 'Alpha Dynamics', source: LeadSource.WEBSITE },
    { first: 'Henry', last: 'Moore', company: 'Beta Corp', source: LeadSource.ADVERTISEMENT },
    { first: 'Ivy', last: 'Taylor', company: 'Gamma Industries', source: LeadSource.REFERRAL },
    { first: 'Jack', last: 'Anderson', company: 'Delta Services', source: LeadSource.WEBSITE },
  ];

  const leadsData = leadNames.map((name, i) => ({
    _id: new ObjectId(),
    tenantId: TENANT_ID,
    ownerId: i % 2 === 0 ? ADMIN_USER_ID : SALES_USER_ID,
    status: i < 3 ? LeadStatus.NEW : i < 6 ? LeadStatus.CONTACTED : i < 8 ? LeadStatus.QUALIFIED : LeadStatus.CONVERTED,
    source: name.source,
    firstName: name.first,
    lastName: name.last,
    email: `${name.first.toLowerCase()}.${name.last.toLowerCase()}@example.com`,
    phone: `+1-555-${100 + i}`,
    companyName: name.company,
    title: ['CEO', 'CTO', 'VP Sales', 'Director', 'Manager'][i % 5],
    website: `https://${name.company.toLowerCase().replace(/\s+/g, '')}.com`,
    industry: ['Technology', 'Finance', 'Healthcare', 'Manufacturing', 'Retail'][i % 5],
    tags: [['enterprise'], ['smb'], ['priority'], ['follow-up'], ['hot']][i % 5],
    score: 20 + i * 8,
    notes: `Lead from ${name.source}`,
    qualifiedAt: i >= 6 && i < 8 ? now : null,
    convertedAt: i >= 8 ? now : null,
    createdAt: new Date(now.getTime() - i * 86400000),
    updatedAt: now,
  }));

  await db.collection('leads').insertMany(leadsData);
  logger.info('Created leads');

  // ===========================================================================
  // Create Accounts
  // ===========================================================================

  await db.collection('accounts').deleteMany({});
  const accountsData = [
    { name: 'TechStart Inc', domain: 'techstart.io', employees: 150, revenue: 5000000 },
    { name: 'DataFlow Corp', domain: 'dataflow.com', employees: 500, revenue: 25000000 },
    { name: 'CloudNine Ltd', domain: 'cloudnine.co', employees: 75, revenue: 2000000 },
  ].map((acc, i) => ({
    _id: new ObjectId(),
    tenantId: TENANT_ID,
    ownerId: i % 2 === 0 ? ADMIN_USER_ID : SALES_USER_ID,
    name: acc.name,
    domain: acc.domain,
    website: `https://${acc.domain}`,
    industry: 'Technology',
    employees: acc.employees,
    annualRevenue: acc.revenue,
    phone: '+1-555-1000',
    billingAddress: {
      street: '123 Main St',
      city: 'San Francisco',
      state: 'CA',
      postalCode: '94105',
      country: 'USA',
    },
    shippingAddress: null,
    type: [AccountType.PROSPECT, AccountType.CUSTOMER, AccountType.PARTNER][i % 3],
    tier: acc.employees > 200 ? AccountTier.ENTERPRISE : acc.employees > 50 ? AccountTier.MID_MARKET : AccountTier.SMB,
    status: AccountStatus.ACTIVE,
    parentAccountId: null,
    createdAt: now,
    updatedAt: now,
  }));

  await db.collection('accounts').insertMany(accountsData);
  const accountIds = Object.keys(accountsData.insertedIds);
  logger.info('Created accounts');

  // ===========================================================================
  // Create Contacts
  // ===========================================================================

  await db.collection('contacts').deleteMany({});
  const contactsData = [
    { firstName: 'Alice', lastName: 'Johnson', title: 'CEO' },
    { firstName: 'Bob', lastName: 'Smith', title: 'CTO' },
    { firstName: 'Carol', lastName: 'Williams', title: 'VP Sales' },
  ].map((contact, i) => ({
    _id: new ObjectId(),
    tenantId: TENANT_ID,
    accountId: accountIds[i] || null,
    ownerId: i % 2 === 0 ? ADMIN_USER_ID : SALES_USER_ID,
    firstName: contact.firstName,
    lastName: contact.lastName,
    email: `${contact.firstName.toLowerCase()}.${contact.lastName.toLowerCase()}@${i === 0 ? 'techstart' : i === 1 ? 'dataflow' : 'cloudnine'}.com`,
    phone: '+1-555-2000',
    mobile: '+1-555-3000',
    title: contact.title,
    department: 'Executive',
    linkedinUrl: null,
    isPrimary: true,
    isDecisionMaker: i === 0,
    preferences: null,
    createdAt: now,
    updatedAt: now,
  }));

  await db.collection('contacts').insertMany(contactsData);
  logger.info('Created contacts');

  // ===========================================================================
  // Create Opportunities
  // ===========================================================================

  await db.collection('opportunities').deleteMany({});
  const opportunitiesData = [
    { name: 'TechStart - Enterprise License', amount: 50000, probability: 75 },
    { name: 'DataFlow - Integration Project', amount: 120000, probability: 50 },
    { name: 'CloudNine - Annual Subscription', amount: 25000, probability: 90 },
    { name: 'TechStart - Support Package', amount: 15000, probability: 25 },
    { name: 'New Logo - Mega Corp', amount: 200000, probability: 10 },
  ].map((opp, i) => ({
    _id: new ObjectId(),
    tenantId: TENANT_ID,
    accountId: accountIds[i % 3] || null,
    contactId: null,
    ownerId: i % 2 === 0 ? ADMIN_USER_ID : SALES_USER_ID,
    name: opp.name,
    description: `Opportunity for ${opp.name}`,
    stageId: stageIds[i < 2 ? 3 : i < 4 ? 2 : 1] || stageIds[0],
    amount: opp.amount,
    currency: 'USD',
    probability: opp.probability,
    expectedCloseDate: new Date(now.getTime() + (i + 1) * 30 * 86400000),
    actualCloseDate: null,
    status: OpportunityStatus.OPEN,
    type: 'NEW_BUSINESS',
    leadSource: LeadSource.WEBSITE,
    nextStep: 'Schedule demo',
    competitorInfo: null,
    timeline: [],
    createdAt: new Date(now.getTime() - i * 86400000),
    updatedAt: now,
  }));

  await db.collection('opportunities').insertMany(opportunitiesData);
  logger.info('Created opportunities');

  // ===========================================================================
  // Create Activities
  // ===========================================================================

  await db.collection('activities').deleteMany({});
  const activitiesData = [
    { type: ActivityType.CALL, subject: 'Initial discovery call' },
    { type: ActivityType.EMAIL, subject: 'Follow-up email' },
    { type: ActivityType.MEETING, subject: 'Product demo' },
    { type: ActivityType.TASK, subject: 'Send proposal' },
    { type: ActivityType.CALL, subject: 'Check-in call' },
  ].map((act, i) => ({
    _id: new ObjectId(),
    tenantId: TENANT_ID,
    type: act.type,
    subject: act.subject,
    description: `${act.subject} description`,
    ownerId: i % 2 === 0 ? ADMIN_USER_ID : SALES_USER_ID,
    relatedToType: i % 2 === 0 ? 'LEAD' : 'OPPORTUNITY',
    relatedToId: null,
    dueDate: new Date(now.getTime() + i * 86400000),
    completedAt: i < 2 ? now : null,
    status: i < 2 ? ActivityStatus.COMPLETED : ActivityStatus.PENDING,
    priority: [ActivityPriority.HIGH, ActivityPriority.MEDIUM, ActivityPriority.LOW][i % 3],
    location: act.type === ActivityType.MEETING ? 'Zoom' : null,
    durationMinutes: act.type === ActivityType.CALL ? 30 : act.type === ActivityType.MEETING ? 60 : null,
    outcome: i < 2 ? 'Positive response' : null,
    createdAt: now,
    updatedAt: now,
  }));

  await db.collection('activities').insertMany(activitiesData);
  logger.info('Created activities');

  // ===========================================================================
  // Create Sample Webhook
  // ===========================================================================

  await db.collection('webhook_configs').deleteMany({});
  await db.collection('webhook_configs').insertOne({
    _id: new ObjectId(),
    tenantId: TENANT_ID,
    name: 'Test Webhook',
    url: 'https://webhook.site/test',
    events: ['LEAD_CREATED', 'OPPORTUNITY_WON'],
    secret: 'test-secret-key',
    isActive: true,
    retryCount: 3,
    timeout: 5000,
    createdAt: now,
    updatedAt: now,
    createdBy: ADMIN_USER_ID,
  });

  logger.info('Created sample webhook');

  // ===========================================================================
  // Summary
  // ===========================================================================

  logger.info('✅ Development seed completed!', {
    tenant: 1,
    users: 2,
    stages: stageIds.length,
    leads: leadsData.length,
    accounts: accountsData.length,
    contacts: contactsData.length,
    opportunities: opportunitiesData.length,
    activities: activitiesData.length,
  });

  logger.info('\n📋 Test Credentials:');
  logger.info('   Tenant ID: dev-tenant-001');
  logger.info('   Admin: admin@acme.com');
  logger.info('   Sales: sales@acme.com');
  logger.info('   (Note: Password hash is placeholder - use actual password in real auth)');

  await closeMongo();
  await closeRedis();
}

seed().catch((err) => {
  console.error('Seed failed:', err);
  process.exit(1);
});
