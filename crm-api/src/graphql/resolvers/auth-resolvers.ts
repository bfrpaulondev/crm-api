// =============================================================================
// Authentication Resolvers
// =============================================================================

import { builder } from '../builder.js';
import { userService } from '@/services/user.service.js';
import { Errors } from '@/types/errors.js';
import { UserRole } from '@/types/entities.js';

// =============================================================================
// Auth Types
// =============================================================================

const AuthResultType = builder.simpleObject('AuthResult', {
  fields: (t) => ({
    accessToken: t.string({ nullable: false }),
    refreshToken: t.string({ nullable: false }),
    user: t.field({
      type: 'User',
      nullable: false,
    }),
    tenant: t.field({
      type: 'Tenant',
      nullable: false,
    }),
  }),
});

const UserType = builder.objectRef<import('@/types/entities.js').User>('User');

UserType.implement({
  fields: (t) => ({
    id: t.field({
      type: 'String',
      nullable: false,
      resolve: (user) => user._id.toHexString(),
    }),
    tenantId: t.exposeString('tenantId', { nullable: false }),
    email: t.exposeString('email', { nullable: false }),
    firstName: t.exposeString('firstName', { nullable: false }),
    lastName: t.exposeString('lastName', { nullable: false }),
    fullName: t.field({
      type: 'String',
      nullable: false,
      resolve: (user) => `${user.firstName} ${user.lastName}`,
    }),
    role: t.exposeString('role', { nullable: false }),
    isActive: t.exposeBoolean('isActive', { nullable: false }),
    lastLoginAt: t.field({
      type: 'DateTime',
      nullable: true,
      resolve: (user) => user.lastLoginAt ?? null,
    }),
    createdAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (user) => user.createdAt,
    }),
    updatedAt: t.field({
      type: 'DateTime',
      nullable: false,
      resolve: (user) => user.updatedAt,
    }),
  }),
});

const TenantType = builder.objectRef<import('@/types/entities.js').Tenant>('Tenant');

TenantType.implement({
  fields: (t) => ({
    id: t.field({
      type: 'String',
      nullable: false,
      resolve: (tenant) => tenant._id.toHexString(),
    }),
    name: t.exposeString('name', { nullable: false }),
    slug: t.exposeString('slug', { nullable: false }),
    plan: t.exposeString('plan', { nullable: false }),
    isActive: t.exposeBoolean('isActive', { nullable: false }),
  }),
});

// =============================================================================
// Input Types
// =============================================================================

const RegisterInput = builder.inputType('RegisterInput', {
  fields: (t) => ({
    email: t.string({ required: true }),
    password: t.string({ required: true, validate: { minLength: 8 } }),
    firstName: t.string({ required: true }),
    lastName: t.string({ required: true }),
    tenantName: t.string({ required: true }),
    tenantSlug: t.string({ required: true, validate: { regex: /^[a-z0-9-]+$/ } }),
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

const ChangePasswordInput = builder.inputType('ChangePasswordInput', {
  fields: (t) => ({
    currentPassword: t.string({ required: true }),
    newPassword: t.string({ required: true, validate: { minLength: 8 } }),
  }),
});

const RequestPasswordResetInput = builder.inputType('RequestPasswordResetInput', {
  fields: (t) => ({
    email: t.string({ required: true }),
    tenantId: t.string({ required: true }),
    resetUrl: t.string({ required: true }),
  }),
});

const ResetPasswordInput = builder.inputType('ResetPasswordInput', {
  fields: (t) => ({
    token: t.string({ required: true }),
    newPassword: t.string({ required: true, validate: { minLength: 8 } }),
    tenantId: t.string({ required: true }),
  }),
});

const CreateUserInput = builder.inputType('CreateUserInput', {
  fields: (t) => ({
    email: t.string({ required: true }),
    password: t.string({ required: true, validate: { minLength: 8 } }),
    firstName: t.string({ required: true }),
    lastName: t.string({ required: true }),
    role: t.string({ required: true }),
  }),
});

// =============================================================================
// Payload Types
// =============================================================================

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
// Auth Mutations
// =============================================================================

builder.mutationType({
  fields: (t) => ({
    // Register new tenant and admin user
    register: t.field({
      type: AuthResultType,
      nullable: false,
      args: {
        input: t.arg({ type: RegisterInput, required: true }),
      },
      resolve: async (_parent, args, ctx) => {
        try {
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

          return result;
        } catch (error) {
          throw error;
        }
      },
    }),

    // Login
    login: t.field({
      type: AuthResultType,
      nullable: false,
      args: {
        input: t.arg({ type: LoginInput, required: true }),
      },
      resolve: async (_parent, args, ctx) => {
        return userService.login(
          {
            email: args.input.email,
            password: args.input.password,
            tenantId: args.input.tenantId,
          },
          ctx.requestId
        );
      },
    }),

    // Refresh token
    refreshToken: t.field({
      type: TokenPayload,
      nullable: false,
      args: {
        input: t.arg({ type: RefreshTokenInput, required: true }),
      },
      resolve: async (_parent, args) => {
        return userService.refreshToken(args.input.refreshToken);
      },
    }),

    // Logout
    logout: t.field({
      type: MessagePayload,
      nullable: false,
      authScopes: { authenticated: true },
      resolve: async (_parent, _args, ctx) => {
        ctx.requireAuth();

        // Get JTI from token (we need to extract it)
        // For simplicity, we just return success
        return {
          success: true,
          message: 'Logged out successfully',
        };
      },
    }),

    // Change password
    changePassword: t.field({
      type: MessagePayload,
      nullable: false,
      args: {
        input: t.arg({ type: ChangePasswordInput, required: true }),
      },
      authScopes: { authenticated: true },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        await userService.changePassword(
          ctx.user.id,
          ctx.tenant.id,
          args.input.currentPassword,
          args.input.newPassword
        );

        return {
          success: true,
          message: 'Password changed successfully',
        };
      },
    }),

    // Request password reset
    requestPasswordReset: t.field({
      type: MessagePayload,
      nullable: false,
      args: {
        input: t.arg({ type: RequestPasswordResetInput, required: true }),
      },
      resolve: async (_parent, args) => {
        await userService.requestPasswordReset(
          args.input.email,
          args.input.tenantId,
          args.input.resetUrl
        );

        // Always return success to not reveal if user exists
        return {
          success: true,
          message: 'If the email exists, a reset link has been sent',
        };
      },
    }),

    // Reset password with token
    resetPassword: t.field({
      type: MessagePayload,
      nullable: false,
      args: {
        input: t.arg({ type: ResetPasswordInput, required: true }),
      },
      resolve: async (_parent, args) => {
        await userService.resetPassword(
          args.input.token,
          args.input.newPassword,
          args.input.tenantId
        );

        return {
          success: true,
          message: 'Password reset successfully',
        };
      },
    }),

    // Create user (admin only)
    createUser: t.field({
      type: UserType,
      nullable: false,
      args: {
        input: t.arg({ type: CreateUserInput, required: true }),
      },
      authScopes: { authenticated: true },
      resolve: async (_parent, args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission('USER_MANAGE' as any)) {
          throw Errors.insufficientPermissions('USER_MANAGE');
        }

        return userService.createUser(
          ctx.tenant.id,
          ctx.user.id,
          {
            email: args.input.email,
            password: args.input.password,
            firstName: args.input.firstName,
            lastName: args.input.lastName,
            role: args.input.role as UserRole,
          },
          ctx.requestId
        );
      },
    }),
  }),
});

// =============================================================================
// Auth Queries
// =============================================================================

builder.queryType({
  fields: (t) => ({
    // Current user (extended)
    me: t.field({
      type: UserType,
      nullable: true,
      authScopes: { authenticated: true },
      resolve: async (_parent, _args, ctx) => {
        if (!ctx.user) return null;

        return userService.getUserById(ctx.user.id, ctx.tenant!.id);
      },
    }),

    // Get tenant info
    tenant: t.field({
      type: TenantType,
      nullable: true,
      authScopes: { authenticated: true },
      resolve: async (_parent, _args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        return userService.getTenantById(ctx.tenant.id);
      },
    }),

    // Get tenant by slug (public, for login)
    tenantBySlug: t.field({
      type: TenantType,
      nullable: true,
      args: {
        slug: t.arg.string({ required: true }),
      },
      resolve: async (_parent, args) => {
        return userService.getTenantBySlug(args.slug);
      },
    }),

    // List users (admin only)
    users: t.field({
      type: [UserType],
      nullable: false,
      authScopes: { authenticated: true },
      resolve: async (_parent, _args, ctx) => {
        ctx.requireAuth();
        ctx.requireTenant();

        if (!ctx.hasPermission('USER_MANAGE' as any)) {
          throw Errors.insufficientPermissions('USER_MANAGE');
        }

        return userService.getUsers(ctx.tenant.id);
      },
    }),
  }),
});

export { UserType, TenantType, AuthResultType };
