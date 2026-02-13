// =============================================================================
// GraphQL Schema Builder with Pothos v4
// =============================================================================

import SchemaBuilder from '@pothos/core';
import SimpleObjectsPlugin from '@pothos/plugin-simple-objects';
import ZodPlugin from '@pothos/plugin-zod';
import WithInputPlugin from '@pothos/plugin-with-input';
import { GraphQLContext } from '@/types/context.js';
import { DateTimeResolver } from 'graphql-scalars';

// =============================================================================
// Builder Setup
// =============================================================================

export const builder = new SchemaBuilder<{
  Context: GraphQLContext;
  Scalars: {
    ID: { Input: string; Output: string };
    DateTime: { Input: Date; Output: Date };
  };
}>({
  plugins: [SimpleObjectsPlugin, ZodPlugin, WithInputPlugin],
  notStrict: "Pothos may not work correctly when strict mode is not enabled in tsconfig.json" as const,
});

// =============================================================================
// Register Scalars
// =============================================================================

builder.scalarType('DateTime', {
  serialize: (n) => DateTimeResolver.serialize(n),
  parseValue: (n) => DateTimeResolver.parseValue(n),
});

// =============================================================================
// Query & Mutation Setup
// =============================================================================

builder.queryType({
  fields: (t) => ({
    _empty: t.string({
      resolve: () => 'CRM Pipeline API',
    }),
  }),
});

builder.mutationType({
  fields: (t) => ({
    _empty: t.string({
      resolve: () => 'ok',
    }),
  }),
});

// =============================================================================
// Simple Objects
// =============================================================================

// PageInfo for Relay-style pagination
builder.simpleObject('PageInfo', {
  fields: (t) => ({
    hasNextPage: t.boolean(),
    hasPreviousPage: t.boolean(),
    startCursor: t.string({ nullable: true }),
    endCursor: t.string({ nullable: true }),
    totalCount: t.int(),
  }),
});

// FieldError for validation errors
builder.simpleObject('FieldError', {
  fields: (t) => ({
    field: t.string(),
    message: t.string(),
  }),
});

// =============================================================================
// Export buildSchema function
// =============================================================================

export const buildSchema = () => builder.toSchema();
