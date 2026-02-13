// =============================================================================
// GraphQL Code Generator Configuration
// =============================================================================

import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  // Schema source - use introspection or local schema file
  schema: 'http://localhost:4000/graphql',

  // Documents (queries, mutations, fragments)
  documents: ['src/**/*.graphql', 'src/**/*.tsx'],

  // Output configuration
  generates: {
    // TypeScript types from schema
    'src/generated/graphql.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-react-apollo',
      ],
      config: {
        // Use TypeScript enums
        enumsAsTypes: false,

        // Use exact types for better type safety
        strictScalars: true,

        // Add custom scalars
        scalars: {
          DateTime: 'Date',
          Email: 'string',
          ObjectId: 'string',
        },

        // React Apollo hooks configuration
        withHooks: true,
        withComponent: false,
        withHOC: false,

        // Better type names
        dedupeOperationSuffix: true,
        omitOperationSuffix: true,
      },
    },

    // Schema introspection file (for tools)
    'src/generated/schema.graphql': {
      plugins: ['schema-ast'],
    },

    // Type resolvers (for server-side)
    'src/generated/resolvers.ts': {
      plugins: ['typescript-resolvers'],
      config: {
        contextType: '../types#Context',
        useIndexSignature: true,
      },
    },
  },
};

export default config;
