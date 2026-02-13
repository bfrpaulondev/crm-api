// =============================================================================
// CRM Pipeline API - Main Server Entry Point
// =============================================================================

import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { ApolloServer } from '@apollo/server';
import { fastifyApolloHandler } from '@as-integrations/fastify';
import { config, isProduction, isDevelopment } from '@/config/index.js';
import {
  connectToMongo,
  closeMongo,
  mongoHealthCheck,
} from '@/infrastructure/mongo/connection.js';
import {
  connectToRedis,
  closeRedis,
  redisHealthCheck,
} from '@/infrastructure/redis/client.js';
import {
  initOpenTelemetry,
  shutdownOpenTelemetry,
} from '@/infrastructure/otel/index.js';
import { logger } from '@/infrastructure/logging/index.js';
import { builder } from '@/graphql/schema/builder.js';
import { formatError } from '@/types/errors.js';
import { buildContext } from '@/middlewares/auth.middleware.js';
import { createDataLoaders } from '@/graphql/dataloaders.js';
import { GraphQLContext } from '@/types/context.js';
import { Permission, ROLE_PERMISSIONS } from '@/types/context.js';
import depthLimit from 'graphql-depth-limit';
import * as path from 'path';

// Import schema types to register them
import '@/graphql/schema/types/lead.js';
import '@/graphql/schema/types/opportunity.js';
import '@/graphql/schema/types/account.js';
import '@/graphql/schema/types/activity.js';
import '@/graphql/schema/types/webhook.js';

// Import resolvers
import '@/graphql/resolvers/index.js';
import '@/graphql/resolvers/mutations.js';
import '@/graphql/resolvers/reporting-resolvers.js';
import '@/graphql/resolvers/auth-resolvers.js';
import '@/graphql/resolvers/bulk-resolvers.js';
import '@/graphql/resolvers/upload-resolvers.js';

// =============================================================================
// Build GraphQL Schema
// =============================================================================

const schema = builder.toSchema();

// =============================================================================
// Apollo Server Setup
// =============================================================================

const apolloServer = new ApolloServer<GraphQLContext>({
  schema,
  introspection: config.INTROSPECTION_ENABLED,
  formatError,
  plugins: [
    // Depth limit plugin
    {
      requestDidStart: () => ({
        didResolveOperation({ request, document }) {
          // Check depth limit
          const maxDepth = config.GRAPHQL_DEPTH_LIMIT;
          let maxDepthFound = 0;

          const visit = (node: any, depth: number) => {
            if (depth > maxDepthFound) maxDepthFound = depth;
            if (node.selectionSet) {
              for (const sel of node.selectionSet.selections) {
                visit(sel, depth + 1);
              }
            }
          };

          for (const def of document.definitions as any[]) {
            if (def.kind === 'OperationDefinition') {
              for (const sel of def.selectionSet.selections) {
                visit(sel, 1);
              }
            }
          }

          if (maxDepthFound > maxDepth) {
            throw new Error(
              `Query depth ${maxDepthFound} exceeds maximum ${maxDepth}`
            );
          }
        },
      }),
    },

    // Logging plugin
    {
      async requestDidStart({ request, contextValue }) {
        const startTime = Date.now();

        logger.info('GraphQL request started', {
          operationName: request.operationName,
          requestId: contextValue.requestId,
        });

        return {
          async willSendResponse({ response, contextValue }) {
            const duration = Date.now() - startTime;

            logger.info('GraphQL request completed', {
              operationName: request.operationName,
              requestId: contextValue.requestId,
              durationMs: duration,
              hasErrors:
                response.body && 'errors' in response.body
                  ? (response.body as any).errors.length > 0
                  : false,
            });
          },
        };
      },
    },
  ],
});

// =============================================================================
// Fastify Server Setup
// =============================================================================

const fastify = Fastify({
  logger: false, // Usamos pino diretamente
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'requestId',
  trustProxy: isProduction, // Trust Render's proxy
});

// =============================================================================
// CORS Configuration - IMPORTANT FOR RENDER
// =============================================================================

const corsOrigins = process.env.CORS_ORIGINS
  ? process.env.CORS_ORIGINS.split(',').map((o) => o.trim())
  : isProduction
    ? true // Allow all in production if not specified (configure properly!)
    : ['http://localhost:3000', 'http://localhost:4000', 'http://127.0.0.1:3000'];

await fastify.register(fastifyCors, {
  origin: corsOrigins,
  credentials: true,
  methods: ['GET', 'POST', 'OPTIONS'],
  allowedHeaders: [
    'Content-Type',
    'Authorization',
    'X-Requested-With',
    'X-Correlation-Id',
    'X-Request-Id',
  ],
  exposedHeaders: [
    'X-Request-Id',
    'X-RateLimit-Limit',
    'X-RateLimit-Remaining',
    'X-RateLimit-Reset',
  ],
  maxAge: 86400, // 24 hours
});

// =============================================================================
// Static Files (for local uploads in development)
// =============================================================================

if (isDevelopment || process.env.STORAGE_TYPE === 'local') {
  const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

  await fastify.register(fastifyStatic, {
    root: uploadDir,
    prefix: '/uploads/',
  });
}

// =============================================================================
// Health Check Endpoints (HTTP, outside GraphQL)
// Required for Render and Kubernetes
// =============================================================================

fastify.get('/health', async (_request, reply) => {
  const [mongoHealthy, redisHealthy] = await Promise.all([
    mongoHealthCheck(),
    redisHealthCheck(),
  ]);

  const healthy = mongoHealthy && redisHealthy;

  return reply.status(healthy ? 200 : 503).send({
    status: healthy ? 'healthy' : 'unhealthy',
    timestamp: new Date().toISOString(),
    version: config.API_VERSION,
    environment: config.NODE_ENV,
    checks: {
      mongodb: mongoHealthy ? 'ok' : 'error',
      redis: redisHealthy ? 'ok' : 'error',
    },
  });
});

fastify.get('/ready', async (_request, reply) => {
  const ready = await mongoHealthCheck();

  return reply.status(ready ? 200 : 503).send({
    ready,
    timestamp: new Date().toISOString(),
  });
});

fastify.get('/live', async (_request, reply) => {
  return reply.send({ live: true, timestamp: new Date().toISOString() });
});

// Root endpoint
fastify.get('/', async (_request, reply) => {
  if (isDevelopment && config.PLAYGROUND_ENABLED) {
    return reply.type('text/html').send(getPlaygroundHTML());
  }

  return reply.send({
    name: 'CRM Pipeline API',
    version: config.API_VERSION,
    graphql: '/graphql',
    health: '/health',
  });
});

// =============================================================================
// GraphQL Endpoint
// =============================================================================

await apolloServer.start();

fastify.route({
  method: ['GET', 'POST', 'OPTIONS'],
  url: '/graphql',
  handler: fastifyApolloHandler(apolloServer, {
    context: async (request) => {
      const baseContext = await buildContext({
        req: request.headers as Record<string, string | undefined>,
      });

      // Add DataLoaders if tenant is available
      const loaders = baseContext.tenant
        ? createDataLoaders(baseContext.tenant.id)
        : null;

      const context: GraphQLContext = {
        user: baseContext.user ?? null,
        tenant: baseContext.tenant ?? null,
        isAuthenticated: baseContext.isAuthenticated ?? false,
        requestId: baseContext.requestId ?? crypto.randomUUID(),
        correlationId: baseContext.correlationId ?? crypto.randomUUID(),
        ipAddress:
          (request.headers['x-forwarded-for'] as string)?.split(',')[0]?.trim() ??
          request.ip ??
          null,
        userAgent: request.headers['user-agent'] ?? null,
        loaders: loaders!,
        hasPermission: (permission: Permission) => {
          if (!baseContext.user) return false;
          const userPermissions = ROLE_PERMISSIONS[baseContext.user.role];
          return userPermissions.includes(permission);
        },
        hasRole: (role) => {
          return baseContext.user?.role === role;
        },
        requireAuth: () => {
          if (!baseContext.user) {
            throw new Error('UNAUTHENTICATED');
          }
          return baseContext.user;
        },
        requireTenant: () => {
          if (!baseContext.tenant) {
            throw new Error('Tenant context required');
          }
          return baseContext.tenant;
        },
      };

      return context;
    },
  }),
});

// =============================================================================
// Error Handling
// =============================================================================

fastify.setErrorHandler((error, _request, reply) => {
  logger.error('Unhandled error', {
    error: error.message,
    stack: isDevelopment ? error.stack : undefined,
  });

  return reply.status(500).send({
    error: 'Internal Server Error',
    message: isDevelopment ? error.message : 'An unexpected error occurred',
    code: 'INTERNAL',
  });
});

// =============================================================================
// Graceful Shutdown
// =============================================================================

const shutdown = async (signal: string) => {
  logger.info(`Received ${signal}, starting graceful shutdown...`);

  try {
    await apolloServer.stop();
    await fastify.close();
    await closeMongo();
    await closeRedis();
    await shutdownOpenTelemetry();

    logger.info('Graceful shutdown completed');
    process.exit(0);
  } catch (error) {
    logger.error('Error during shutdown', { error: String(error) });
    process.exit(1);
  }
};

process.on('SIGTERM', () => shutdown('SIGTERM'));
process.on('SIGINT', () => shutdown('SIGINT'));

// =============================================================================
// Start Server
// =============================================================================

async function start() {
  try {
    // Initialize OpenTelemetry
    initOpenTelemetry();

    // Connect to databases
    await connectToMongo();
    connectToRedis();

    // Start Fastify server
    // Render sets PORT environment variable
    const port = parseInt(process.env.PORT || '4000', 10);
    const host = '0.0.0.0'; // Must be 0.0.0.0 for Render

    await fastify.listen({ port, host });

    logger.info(`🚀 CRM Pipeline API started`, {
      port,
      host,
      env: config.NODE_ENV,
      graphql: '/graphql',
      health: '/health',
      playground: isDevelopment && config.PLAYGROUND_ENABLED,
      introspection: config.INTROSPECTION_ENABLED,
    });
  } catch (error) {
    logger.error('Failed to start server', { error: String(error) });
    process.exit(1);
  }
}

// =============================================================================
// Playground HTML
// =============================================================================

function getPlaygroundHTML(): string {
  return `
    <!DOCTYPE html>
    <html>
      <head>
        <title>CRM Pipeline API - GraphQL Playground</title>
        <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/static/css/index.css" />
        <link rel="shortcut icon" href="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/static/favicon.png" />
        <script src="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/static/js/middleware.js"></script>
      </head>
      <body>
        <div id="root"></div>
        <script>
          window.addEventListener('load', function (event) {
            GraphQLPlayground.init(document.getElementById('root'), {
              endpoint: '/graphql',
              settings: {
                'request.credentials': 'include',
                'tracing.hideTracingResponse': false,
              },
            });
          });
        </script>
      </body>
    </html>
  `;
}

// Start the server
start();
