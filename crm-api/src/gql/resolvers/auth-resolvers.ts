// =============================================================================
// Authentication Resolvers
// =============================================================================

import { builder } from '../schema/builder.js';
import { userService } from '@/services/user.service.js';
import { GraphQLContext } from '@/types/context.js';

// =============================================================================
// Auth Types
// =============================================================================

const UserType = builder.simpleObject('User', {
  fields: (t) => ({
    id: t.string({ nullable: false }),
    email: t.string({ nullable: false }),
    firstName: t.string({ nullable: false }),
    lastName: t.string({ nullable: false }),
    role: t.string({ nullable: false }),
  }),
});

const TenantType = builder.simpleObject('Tenant', {
  fields: (t) => ({
    id: t.string({ nullable: false }),
    name: t.string({ nullable: false }),
    slug: t.string({ nullable: false }),
    plan: t.string({ nullable: false }),
  }),
});

const AuthResultType = builder.simpleObject('AuthResult', {
  fields: (t) => ({
    accessToken: t.string({ nullable: false }),
    refreshToken: t.string({ nullable: false }),
    user: t.field({ type: UserType, nullable: false }),
    tenant: t.field({ type: TenantType, nullable: false }),
  }),
});

const TokenPayload = builder.simpleObject('TokenPayload', {
  fields: (t) => ({
    accessToken: t.string({ nullable: false }),
    refreshToken: t.string({ nullable: false }),
  }),
});

const MessagePayload = builder.simpleObject('MessagePayload', {
  fields: (t) => ({
    success: t.boolean({ nullable: false }),
    message: t.string({ nullable: true }),
  }),
});

// =============================================================================
// Input Types
// =============================================================================

const RegisterInput = builder.inputType('RegisterInput', {
  fields: (t) => ({
    email: t.string({ required: true }),
    password: t.string({ required: true }),
    firstName: t.string({ required: true }),
    lastName: t.string({ required: true }),
    tenantName: t.string({ required: true }),
    tenantSlug: t.string({ required: true }),
  }),
});

const LoginInput = builder.inputType('LoginInput', {
  fields: (t) => ({
    email: t.string({ required: true }),
    password: t.string({ required: true }),
    tenantId: t.string({ required: true }),
  }),
});

const RefreshTokenInput = builder.inputType('RefreshTokenInput', {
  fields: (t) => ({
    refreshToken: t.string({ required: true }),
  }),
});

// =============================================================================
// Auth Mutations
// =============================================================================

builder.mutationFields((t) => ({
  register: t.field({
    type: AuthResultType,
    nullable: false,
    args: {
      input: t.arg({ type: RegisterInput, required: true }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      const result = await userService.register(
        {
          email: args.input.email,
          password: args.input.password,
          firstName: args.input.firstName,
          lastName: args.input.lastName,
          tenantName: args.input.tenantName,
          tenantSlug: args.input.tenantSlug.toLowerCase(),
        },
        ctx.requestId
      );

      return {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: {
          id: result.user._id.toHexString(),
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          role: result.user.role,
        },
        tenant: {
          id: result.tenant._id.toHexString(),
          name: result.tenant.name,
          slug: result.tenant.slug,
          plan: result.tenant.plan,
        },
      };
    },
  }),

  login: t.field({
    type: AuthResultType,
    nullable: false,
    args: {
      input: t.arg({ type: LoginInput, required: true }),
    },
    resolve: async (_root, args, ctx: GraphQLContext) => {
      const result = await userService.login(
        {
          email: args.input.email,
          password: args.input.password,
          tenantId: args.input.tenantId,
        },
        ctx.requestId
      );

      return {
        accessToken: result.accessToken,
        refreshToken: result.refreshToken,
        user: {
          id: result.user._id.toHexString(),
          email: result.user.email,
          firstName: result.user.firstName,
          lastName: result.user.lastName,
          role: result.user.role,
        },
        tenant: {
          id: result.tenant._id.toHexString(),
          name: result.tenant.name,
          slug: result.tenant.slug,
          plan: result.tenant.plan,
        },
      };
    },
  }),

  refreshToken: t.field({
    type: TokenPayload,
    nullable: false,
    args: {
      input: t.arg({ type: RefreshTokenInput, required: true }),
    },
    resolve: async (_root, args) => {
      const result = await userService.refreshToken(args.input.refreshToken);
      return result;
    },
  }),

  logout: t.field({
    type: MessagePayload,
    nullable: false,
    resolve: async (_root, _args, ctx: GraphQLContext) => {
      ctx.requireAuth();
      return {
        success: true,
        message: 'Logged out successfully',
      };
    },
  }),
}));

// =============================================================================
// Auth Queries
// =============================================================================

builder.queryFields((t) => ({
  me: t.field({
    type: UserType,
    nullable: true,
    resolve: async (_root, _args, ctx: GraphQLContext) => {
      if (!ctx.user) return null;
      const user = await userService.getUserById(ctx.user.id, ctx.tenant?.id || '');
      if (!user) return null;
      return {
        id: user._id.toHexString(),
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        role: user.role,
      };
    },
  }),

  tenant: t.field({
    type: TenantType,
    nullable: true,
    resolve: async (_root, _args, ctx: GraphQLContext) => {
      ctx.requireAuth();
      ctx.requireTenant();
      const tenant = await userService.getTenantById(ctx.tenant.id);
      if (!tenant) return null;
      return {
        id: tenant._id.toHexString(),
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
      };
    },
  }),

  tenantBySlug: t.field({
    type: TenantType,
    nullable: true,
    args: {
      slug: t.arg.string({ required: true }),
    },
    resolve: async (_root, args) => {
      const tenant = await userService.getTenantBySlug(args.slug);
      if (!tenant) return null;
      return {
        id: tenant._id.toHexString(),
        name: tenant.name,
        slug: tenant.slug,
        plan: tenant.plan,
      };
    },
  }),
}));

export { UserType, TenantType, AuthResultType };
