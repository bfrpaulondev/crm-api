// =============================================================================
// Pothos Schema Builder - Core Configuration
// =============================================================================

import SchemaBuilder from '@pothos/core';
import DirectivesPlugin from '@pothos/plugin-directives';
import SimpleObjectsPlugin from '@pothos/plugin-simple-objects';
import WithInputPlugin from '@pothos/plugin-with-input';
import ZodPlugin from '@pothos/plugin-zod';
import { GraphQLContext } from '@/types/context.js';
import { ObjectId } from 'mongodb';
import { DateTimeResolver, EmailAddressResolver } from 'graphql-scalars';

// ============================================================================
// Schema Builder Configuration
// ============================================================================

export const builder = new SchemaBuilder<{
  Context: GraphQLContext;
  Scalars: {
    ID: { Input: string; Output: string };
    DateTime: { Input: Date; Output: Date };
    Email: { Input: string; Output: string };
    ObjectId: { Input: string; Output: string };
  };
}>({
  plugins: [DirectivesPlugin, SimpleObjectsPlugin, WithInputPlugin, ZodPlugin],
  zod: {
    // Configurações do plugin Zod
  },
  withInput: {
    typeOptions: {
      name: ({ parentTypeName, fieldName }) =>
        `${parentTypeName}${fieldName.charAt(0).toUpperCase() + fieldName.slice(1)}Input`,
    },
  },
});

// ============================================================================
// Scalar Types
// ============================================================================

// DateTime scalar
builder.scalarType('DateTime', {
  serialize: (date) => date.toISOString(),
  parseValue: (value) => {
    if (value instanceof Date) return value;
    if (typeof value === 'string' || typeof value === 'number') {
      return new Date(value);
    }
    throw new TypeError('DateTime must be a Date, string, or number');
  },
});

// Email scalar
builder.scalarType('Email', {
  serialize: (email) => email.toLowerCase(),
  parseValue: (value) => {
    if (typeof value !== 'string') {
      throw new TypeError('Email must be a string');
    }
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    if (!emailRegex.test(value)) {
      throw new TypeError('Invalid email format');
    }
    return value.toLowerCase();
  },
});

// ObjectId scalar
builder.scalarType('ObjectId', {
  serialize: (id) => (id instanceof ObjectId ? id.toHexString() : String(id)),
  parseValue: (value) => {
    if (typeof value !== 'string') {
      throw new TypeError('ObjectId must be a string');
    }
    if (!/^[a-f\d]{24}$/i.test(value)) {
      throw new TypeError('Invalid ObjectId format');
    }
    return value;
  },
});

// ============================================================================
// Custom Directives
// ============================================================================

// @auth directive - exige autenticação
builder.directiveType({
  name: 'auth',
  locations: ['FIELD_DEFINITION', 'OBJECT'],
});

// @tenant directive - exige tenant no contexto
builder.directiveType({
  name: 'tenant',
  locations: ['FIELD_DEFINITION', 'OBJECT'],
});

// @hasPermission directive - exige permissão específica
builder.directiveType({
  name: 'hasPermission',
  locations: ['FIELD_DEFINITION'],
  args: {
    permission: 'String!',
  },
});

// @deprecated directive com reason
builder.directiveType({
  name: 'deprecated',
  locations: ['FIELD_DEFINITION', 'ENUM_VALUE', 'ARGUMENT_DEFINITION', 'INPUT_FIELD_DEFINITION'],
  args: {
    reason: 'String',
  },
  isRepeatable: false,
});

// @sensitive directive - marca campo como sensível (field-level auth)
builder.directiveType({
  name: 'sensitive',
  locations: ['FIELD_DEFINITION'],
  args: {
    requiresRole: 'String',
  },
});

// ============================================================================
// Base Types / Interfaces
// ============================================================================

// Interface para entidades com timestamps
builder.interfaceType('Timestamped', {
  fields: (t) => ({
    createdAt: t.field({
      type: 'DateTime',
      nullable: false,
      description: 'Creation timestamp',
    }),
    updatedAt: t.field({
      type: 'DateTime',
      nullable: false,
      description: 'Last update timestamp',
    }),
  }),
});

// Interface para entidades soft-deletable
builder.interfaceType('SoftDeletable', {
  fields: (t) => ({
    deletedAt: t.field({
      type: 'DateTime',
      nullable: true,
      description: 'Soft delete timestamp',
    }),
  }),
});

// Node interface para Relay-style pagination
builder.interfaceType('Node', {
  fields: (t) => ({
    id: t.globalID({
      description: 'Unique identifier',
    }),
  }),
});

// ============================================================================
// Connection Types (Pagination)
// ============================================================================

// PageInfo para cursor-based pagination
builder.simpleObject('PageInfo', {
  fields: (t) => ({
    hasNextPage: 'Boolean!',
    hasPreviousPage: 'Boolean!',
    startCursor: 'String',
    endCursor: 'String',
    totalCount: 'Int!',
  }),
});

// Generic connection type factory
export function createConnectionType<T>(name: string, nodeType: unknown) {
  const edgeType = builder.simpleObject(`${name}Edge`, {
    fields: (t) => ({
      node: nodeType as never,
      cursor: 'String!',
    }),
  });

  return builder.simpleObject(`${name}Connection`, {
    fields: (t) => ({
      edges: edgeType as never,
      pageInfo: 'PageInfo!',
    }),
  });
}

// ============================================================================
// Base Input Types
// ============================================================================

// Pagination input padrão
builder.inputType('PaginationInput', {
  fields: (t) => ({
    first: t.int({
      description: 'Returns the first n elements from the list',
      validate: { min: 1, max: 100 },
    }),
    after: t.string({
      description: 'Cursor to paginate after',
    }),
    last: t.int({
      description: 'Returns the last n elements from the list',
      validate: { min: 1, max: 100 },
    }),
    before: t.string({
      description: 'Cursor to paginate before',
    }),
  }),
});

// ============================================================================
// Error Types
// ============================================================================

// Erro de validação de campo
builder.simpleObject('FieldError', {
  fields: (t) => ({
    field: 'String!',
    message: 'String!',
  }),
});

// Response base com erros
builder.interfaceType('MutationResponse', {
  fields: (t) => ({
    success: t.exposeBoolean('success'),
    message: t.exposeString('message', { nullable: true }),
    errors: t.field({
      type: ['FieldError'],
      nullable: true,
    }),
  }),
});

// ============================================================================
// Export
// ============================================================================

export { builder as schemaBuilder };
