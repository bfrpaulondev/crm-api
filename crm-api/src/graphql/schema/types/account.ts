// =============================================================================
// Account & Contact GraphQL Types
// =============================================================================

import { builder } from '../builder.js';
import {
  AccountType,
  AccountTier,
  AccountStatus,
  Account,
  Contact,
  Address,
} from '@/types/entities.js';

// ============================================================================
// Enums
// ============================================================================

const AccountTypeEnum = builder.enumType(AccountType, {
  name: 'AccountType',
  description: 'Type of account (customer, prospect, partner, etc.)',
});

const AccountTierEnum = builder.enumType(AccountTier, {
  name: 'AccountTier',
  description: 'Account tier/size classification',
});

const AccountStatusEnum = builder.enumType(AccountStatus, {
  name: 'AccountStatus',
  description: 'Account status',
});

// ============================================================================
// Address Type
// ============================================================================

const AddressType = builder.objectRef<Address>('Address');

AddressType.implement({
  description: 'Physical address',
  fields: (t) => ({
    street: t.exposeString('street', { nullable: false }),
    city: t.exposeString('city', { nullable: false }),
    state: t.exposeString('state', { nullable: false }),
    postalCode: t.exposeString('postalCode', { nullable: false }),
    country: t.exposeString('country', { nullable: false }),
    fullAddress: t.field({
      type: 'String',
      nullable: false,
      resolve: (addr) =>
        `${addr.street}, ${addr.city}, ${addr.state} ${addr.postalCode}, ${addr.country}`,
    }),
  }),
});

// ============================================================================
// Account Type
// ============================================================================

const AccountGraphQLType = builder.objectRef<Account>('Account');

AccountGraphQLType.implement({
  description: 'A company or organization in the CRM',
  fields: (t) => ({
    id: t.field({
      type: 'ObjectId',
      nullable: false,
      resolve: (account) => account._id.toHexString(),
    }),

    tenantId: t.exposeString('tenantId', { nullable: false }),

    ownerId: t.exposeString('ownerId', { nullable: false }),

    name: t.exposeString('name', { nullable: false }),

    domain: t.exposeString('domain', { nullable: true }),

    website: t.exposeString('website', { nullable: true }),

    industry: t.exposeString('industry', { nullable: true }),

    employees: t.exposeInt('employees', { nullable: true }),

    annualRevenue: t.exposeFloat('annualRevenue', { nullable: true }),

    phone: t.exposeString('phone', { nullable: true }),

    billingAddress: t.field({
      type: AddressType,
      nullable: true,
      resolve: (account) => account.billingAddress ?? null,
    }),

    shippingAddress: t.field({
      type: AddressType,
      nullable: true,
      resolve: (account) => account.shippingAddress ?? null,
    }),

    type: t.field({
      type: AccountTypeEnum,
      nullable: false,
      resolve: (account) => account.type,
    }),

    tier: t.field({
      type: AccountTierEnum,
      nullable: false,
      resolve: (account) => account.tier,
    }),

    status: t.field({
      type: AccountStatusEnum,
      nullable: false,
      resolve: (account) => account.status,
    }),

    parentAccountId: t.exposeString('parentAccountId', { nullable: true }),

    isActive: t.field({
      type: 'Boolean',
      nullable: false,
      resolve: (account) => account.status === AccountStatus.ACTIVE,
    }),

    createdAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (account) => account.createdAt,
    }),

    updatedAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (account) => account.updatedAt,
    }),

    deletedAt: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: (account) => account.deletedAt ?? null,
    }),
  }),
});

// ============================================================================
// Contact Type
// ============================================================================

const ContactGraphQLType = builder.objectRef<Contact>('Contact');

ContactGraphQLType.implement({
  description: 'A person contact associated with an account',
  fields: (t) => ({
    id: t.field({
      type: 'ObjectId',
      nullable: false,
      resolve: (contact) => contact._id.toHexString(),
    }),

    tenantId: t.exposeString('tenantId', { nullable: false }),

    accountId: t.exposeString('accountId', { nullable: true }),

    ownerId: t.exposeString('ownerId', { nullable: false }),

    firstName: t.exposeString('firstName', { nullable: false }),

    lastName: t.exposeString('lastName', { nullable: false }),

    fullName: t.field({
      type: 'String',
      nullable: false,
      resolve: (contact) => `${contact.firstName} ${contact.lastName}`,
    }),

    email: t.field({
      type: 'Email',
      nullable: false,
      resolve: (contact) => contact.email,
    }),

    phone: t.exposeString('phone', { nullable: true }),

    mobile: t.exposeString('mobile', { nullable: true }),

    title: t.exposeString('title', { nullable: true }),

    department: t.exposeString('department', { nullable: true }),

    linkedinUrl: t.exposeString('linkedinUrl', { nullable: true }),

    isPrimary: t.exposeBoolean('isPrimary', { nullable: false }),

    isDecisionMaker: t.exposeBoolean('isDecisionMaker', { nullable: false }),

    createdAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (contact) => contact.createdAt,
    }),

    updatedAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (contact) => contact.updatedAt,
    }),

    deletedAt: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: (contact) => contact.deletedAt ?? null,
    }),
  }),
});

// ============================================================================
// Input Types
// ============================================================================

const AddressInput = builder.inputType('AddressInput', {
  fields: (t) => ({
    street: t.string({ required: true }),
    city: t.string({ required: true }),
    state: t.string({ required: true }),
    postalCode: t.string({ required: true }),
    country: t.string({ required: true }),
  }),
});

const CreateAccountInput = builder.inputType('CreateAccountInput', {
  fields: (t) => ({
    name: t.string({ required: true }),
    domain: t.string({ required: false }),
    website: t.string({ required: false }),
    industry: t.string({ required: false }),
    employees: t.int({ required: false }),
    annualRevenue: t.float({ required: false }),
    phone: t.string({ required: false }),
    billingAddress: t.field({ type: AddressInput, required: false }),
    shippingAddress: t.field({ type: AddressInput, required: false }),
    type: t.field({ type: AccountTypeEnum, required: false }),
    tier: t.field({ type: AccountTierEnum, required: false }),
    ownerId: t.id({ required: false }),
    parentAccountId: t.id({ required: false }),
  }),
});

const UpdateAccountInput = builder.inputType('UpdateAccountInput', {
  fields: (t) => ({
    name: t.string({ required: false }),
    domain: t.string({ required: false }),
    website: t.string({ required: false }),
    industry: t.string({ required: false }),
    employees: t.int({ required: false }),
    annualRevenue: t.float({ required: false }),
    phone: t.string({ required: false }),
    billingAddress: t.field({ type: AddressInput, required: false }),
    shippingAddress: t.field({ type: AddressInput, required: false }),
    type: t.field({ type: AccountTypeEnum, required: false }),
    tier: t.field({ type: AccountTierEnum, required: false }),
    status: t.field({ type: AccountStatusEnum, required: false }),
    ownerId: t.id({ required: false }),
  }),
});

const AccountFilterInput = builder.inputType('AccountFilterInput', {
  fields: (t) => ({
    type: t.field({ type: AccountTypeEnum, required: false }),
    tier: t.field({ type: AccountTierEnum, required: false }),
    status: t.field({ type: AccountStatusEnum, required: false }),
    ownerId: t.id({ required: false }),
    industry: t.string({ required: false }),
    search: t.string({ required: false }),
  }),
});

const CreateContactInput = builder.inputType('CreateContactInput', {
  fields: (t) => ({
    accountId: t.id({ required: false }),
    firstName: t.string({ required: true }),
    lastName: t.string({ required: true }),
    email: t.string({ required: true }),
    phone: t.string({ required: false }),
    mobile: t.string({ required: false }),
    title: t.string({ required: false }),
    department: t.string({ required: false }),
    linkedinUrl: t.string({ required: false }),
    isPrimary: t.boolean({ required: false }),
    isDecisionMaker: t.boolean({ required: false }),
    ownerId: t.id({ required: false }),
  }),
});

const UpdateContactInput = builder.inputType('UpdateContactInput', {
  fields: (t) => ({
    accountId: t.id({ required: false }),
    firstName: t.string({ required: false }),
    lastName: t.string({ required: false }),
    email: t.string({ required: false }),
    phone: t.string({ required: false }),
    mobile: t.string({ required: false }),
    title: t.string({ required: false }),
    department: t.string({ required: false }),
    linkedinUrl: t.string({ required: false }),
    isPrimary: t.boolean({ required: false }),
    isDecisionMaker: t.boolean({ required: false }),
    ownerId: t.id({ required: false }),
  }),
});

const ContactFilterInput = builder.inputType('ContactFilterInput', {
  fields: (t) => ({
    accountId: t.id({ required: false }),
    ownerId: t.id({ required: false }),
    search: t.string({ required: false }),
    isPrimary: t.boolean({ required: false }),
    isDecisionMaker: t.boolean({ required: false }),
  }),
});

// ============================================================================
// Payload Types
// ============================================================================

const CreateAccountPayload = builder.simpleObject('CreateAccountPayload', {
  fields: (t) => ({
    success: t.boolean({ nullable: false }),
    message: t.string({ nullable: true }),
    account: t.field({ type: AccountGraphQLType, nullable: true }),
  }),
});

const CreateContactPayload = builder.simpleObject('CreateContactPayload', {
  fields: (t) => ({
    success: t.boolean({ nullable: false }),
    message: t.string({ nullable: true }),
    contact: t.field({ type: ContactGraphQLType, nullable: true }),
  }),
});

// ============================================================================
// Exports
// ============================================================================

export {
  AccountGraphQLType,
  ContactGraphQLType,
  AddressType,
  AccountTypeEnum,
  AccountTierEnum,
  AccountStatusEnum,
  AddressInput,
  CreateAccountInput,
  UpdateAccountInput,
  AccountFilterInput,
  CreateContactInput,
  UpdateContactInput,
  ContactFilterInput,
  CreateAccountPayload,
  CreateContactPayload,
};
