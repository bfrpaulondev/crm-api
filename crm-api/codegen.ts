// =============================================================================
// GraphQL Code Generator Configuration
// =============================================================================

import type { CodegenConfig } from '@graphql-codegen/cli';

const config: CodegenConfig = {
  schema: 'http://localhost:4000/graphql',
  documents: ['examples/operations/*.graphql', 'src/**/*.graphql'],
  generates: {
    'examples/generated/graphql.ts': {
      plugins: [
        'typescript',
        'typescript-operations',
        'typescript-graphql-request',
      ],
      config: {
        scalars: {
          DateTime: 'Date',
          Email: 'string',
          ObjectId: 'string',
          JSON: 'Record<string, unknown>',
        },
        rawRequest: true,
      },
    },
    'examples/generated/schema.graphql': {
      plugins: ['schema-ast'],
    },
  },
};

export default config;
