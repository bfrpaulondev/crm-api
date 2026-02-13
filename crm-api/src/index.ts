// =============================================================================
// CRM Pipeline API - Main Server Entry Point
// =============================================================================

import Fastify from 'fastify';
import fastifyCors from '@fastify/cors';
import fastifyStatic from '@fastify/static';
import { ApolloServer } from '@apollo/server';
import { fastifyApolloHandler } from '@as-integrations/fastify';
import { config, isProduction, isDevelopment, corsOrigins } from './config/index.js';
import {
  connectToMongo,
  closeMongo,
  mongoHealthCheck,
} from './infrastructure/mongo/connection.js';
import {
  connectToRedis,
  closeRedis,
  redisHealthCheck,
} from './infrastructure/redis/client.js';
import {
  initOpenTelemetry,
  shutdownOpenTelemetry,
} from './infrastructure/otel/index.js';
import { logger } from './infrastructure/logging/index.js';
import { builder } from './gql/schema/builder.js';
import { GraphQLContext } from './types/context.js';
import { Permission, ROLE_PERMISSIONS } from './types/context.js';
import * as path from 'path';
import { GraphQLError, GraphQLFormattedError } from 'graphql';

// Import resolvers
import './gql/resolvers/index.js';
import './gql/resolvers/mutations.js';
import './gql/resolvers/reporting-resolvers.js';
import './gql/resolvers/auth-resolvers.js';
import './gql/resolvers/bulk-resolvers.js';
import './gql/resolvers/upload-resolvers.js';

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
  formatError: (formattedError: GraphQLFormattedError, error: unknown) => {
    const err = error as GraphQLError | undefined;
    
    logger.error('GraphQL error', {
      message: formattedError.message,
      code: err?.extensions?.code,
    });

    return {
      message: formattedError.message,
      code: err?.extensions?.code || 'INTERNAL',
    };
  },
  plugins: [
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
              hasErrors: response.body && 'errors' in response.body
                ? (response.body as { errors: unknown[] }).errors.length > 0
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
  logger: false,
  requestIdHeader: 'x-request-id',
  requestIdLogLabel: 'requestId',
  trustProxy: isProduction,
});

// =============================================================================
// CORS Configuration - IMPORTANT FOR RENDER
// =============================================================================

void fastify.register(fastifyCors, {
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
  maxAge: 86400,
});

// =============================================================================
// Static Files (for local uploads in development)
// =============================================================================

if (isDevelopment || process.env.STORAGE_TYPE === 'local') {
  const uploadDir = process.env.UPLOAD_DIR || path.join(process.cwd(), 'uploads');

  void fastify.register(fastifyStatic, {
    root: uploadDir,
    prefix: '/uploads/',
  });
}

// =============================================================================
// Health Check Endpoints
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
  return reply.send({
    name: 'CRM Pipeline API',
    version: config.API_VERSION,
    author: 'Bruno Paulon',
    endpoints: {
      graphql: '/graphql',
      playground: '/playground',
      docs: '/docs',
      health: '/health',
    },
  });
});

// =============================================================================
// Documentation Endpoint
// =============================================================================

fastify.get('/docs', async (_request, reply) => {
  return reply.type('text/html').send(getDocsHTML());
});

// =============================================================================
// GraphQL Playground (always available in production)
// =============================================================================

fastify.get('/playground', async (_request, reply) => {
  return reply.type('text/html').send(getPlaygroundHTML());
});

// GraphQL Schema SDL endpoint
fastify.get('/graphql/schema', async (_request, reply) => {
  const { printSchema } = await import('graphql');
  const sdl = printSchema(schema);
  return reply.type('text/plain').send(sdl);
});

// =============================================================================
// GraphQL Endpoint
// =============================================================================

async function setupGraphQL() {
  await apolloServer.start();

  fastify.route({
    method: ['GET', 'POST', 'OPTIONS'],
    url: '/graphql',
    handler: fastifyApolloHandler(apolloServer, {
      context: async (request) => {
        const { buildContext } = await import('./middlewares/auth.middleware.js');
        const { createDataLoaders } = await import('./gql/dataloaders.js');
        
        const baseContext = await buildContext({
          headers: request.headers as Record<string, string | undefined>,
        });

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
}

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
// Playground HTML
// =============================================================================

function getPlaygroundHTML(): string {
  return `
<!DOCTYPE html>
<html>
  <head>
    <title>CRM Pipeline API - GraphQL Playground</title>
    <meta charset="utf-8">
    <meta name="viewport" content="width=device-width, initial-scale=1">
    <link rel="stylesheet" href="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/static/css/index.css" />
    <link rel="shortcut icon" href="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/static/favicon.png" />
    <style>
      body { margin: 0; padding: 0; }
    </style>
  </head>
  <body>
    <div id="root"></div>
    <script src="https://cdn.jsdelivr.net/npm/graphql-playground-react/build/static/js/middleware.js"></script>
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

// =============================================================================
// Documentation HTML
// =============================================================================

function getDocsHTML(): string {
  return `
<!DOCTYPE html>
<html lang="pt-BR">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>CRM Pipeline API - Documentação</title>
  <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600;700&display=swap" rel="stylesheet">
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body {
      font-family: 'Inter', -apple-system, BlinkMacSystemFont, sans-serif;
      background: linear-gradient(135deg, #1a1a2e 0%, #16213e 100%);
      min-height: 100vh;
      color: #e4e4e7;
      line-height: 1.6;
    }
    .container { max-width: 1200px; margin: 0 auto; padding: 40px 20px; }
    header {
      text-align: center;
      padding: 40px 0;
      border-bottom: 1px solid rgba(255,255,255,0.1);
      margin-bottom: 40px;
    }
    h1 {
      font-size: 2.5rem;
      background: linear-gradient(90deg, #6366f1, #8b5cf6);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      margin-bottom: 10px;
    }
    .subtitle { color: #a1a1aa; font-size: 1.1rem; }
    .author { color: #71717a; font-size: 0.9rem; margin-top: 10px; }
    
    .section {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 30px;
      margin-bottom: 30px;
      border: 1px solid rgba(255,255,255,0.1);
    }
    .section h2 {
      color: #8b5cf6;
      margin-bottom: 20px;
      font-size: 1.4rem;
      display: flex;
      align-items: center;
      gap: 10px;
    }
    .section h3 { color: #a78bfa; margin: 20px 0 10px; font-size: 1.1rem; }
    
    .endpoint {
      display: inline-block;
      background: #3b82f6;
      color: white;
      padding: 4px 12px;
      border-radius: 4px;
      font-family: monospace;
      font-size: 0.9rem;
      margin-right: 10px;
    }
    .endpoint.get { background: #22c55e; }
    .endpoint.post { background: #f59e0b; }
    
    code {
      background: rgba(139, 92, 246, 0.2);
      padding: 2px 8px;
      border-radius: 4px;
      font-family: 'Fira Code', monospace;
      font-size: 0.9rem;
    }
    
    pre {
      background: #0f0f1a;
      padding: 20px;
      border-radius: 8px;
      overflow-x: auto;
      margin: 15px 0;
      font-size: 0.85rem;
      border: 1px solid rgba(255,255,255,0.1);
    }
    
    table {
      width: 100%;
      border-collapse: collapse;
      margin: 15px 0;
    }
    th, td {
      text-align: left;
      padding: 12px;
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    th { color: #8b5cf6; font-weight: 600; }
    td code { background: transparent; }
    
    .btn {
      display: inline-block;
      padding: 12px 24px;
      background: linear-gradient(90deg, #6366f1, #8b5cf6);
      color: white;
      text-decoration: none;
      border-radius: 8px;
      font-weight: 500;
      transition: transform 0.2s, box-shadow 0.2s;
      margin: 5px;
    }
    .btn:hover {
      transform: translateY(-2px);
      box-shadow: 0 10px 30px rgba(99, 102, 241, 0.3);
    }
    .btn-secondary {
      background: rgba(255,255,255,0.1);
      border: 1px solid rgba(255,255,255,0.2);
    }
    
    .cards { display: grid; grid-template-columns: repeat(auto-fit, minmax(280px, 1fr)); gap: 20px; }
    .card {
      background: rgba(255,255,255,0.05);
      border-radius: 12px;
      padding: 25px;
      border: 1px solid rgba(255,255,255,0.1);
      transition: border-color 0.3s;
    }
    .card:hover { border-color: #8b5cf6; }
    .card h4 { color: #a78bfa; margin-bottom: 10px; }
    .card p { color: #a1a1aa; font-size: 0.9rem; }
    
    .status-ok { color: #22c55e; }
    .status-error { color: #ef4444; }
    
    footer {
      text-align: center;
      padding: 40px 0;
      border-top: 1px solid rgba(255,255,255,0.1);
      margin-top: 40px;
      color: #71717a;
    }
  </style>
</head>
<body>
  <div class="container">
    <header>
      <h1>🚀 CRM Pipeline API</h1>
      <p class="subtitle">GraphQL API para gestão de pipeline de vendas</p>
      <p class="author">Desenvolvido por <strong>Bruno Paulon</strong></p>
      <div style="margin-top: 30px;">
        <a href="/playground" class="btn">🎮 GraphQL Playground</a>
        <a href="/graphql/schema" class="btn btn-secondary">📄 Ver Schema SDL</a>
      </div>
    </header>

    <div class="section">
      <h2>📍 Endpoints Disponíveis</h2>
      <table>
        <tr><th>Método</th><th>Endpoint</th><th>Descrição</th></tr>
        <tr><td><span class="endpoint get">GET</span></td><td><code>/</code></td><td>Informações da API</td></tr>
        <tr><td><span class="endpoint post">POST</span></td><td><code>/graphql</code></td><td>Endpoint GraphQL principal</td></tr>
        <tr><td><span class="endpoint get">GET</span></td><td><code>/playground</code></td><td>Interface interativa para testar queries</td></tr>
        <tr><td><span class="endpoint get">GET</span></td><td><code>/docs</code></td><td>Esta documentação</td></tr>
        <tr><td><span class="endpoint get">GET</span></td><td><code>/graphql/schema</code></td><td>Schema GraphQL em formato SDL</td></tr>
        <tr><td><span class="endpoint get">GET</span></td><td><code>/health</code></td><td>Health check completo</td></tr>
        <tr><td><span class="endpoint get">GET</span></td><td><code>/ready</code></td><td>Readiness probe</td></tr>
        <tr><td><span class="endpoint get">GET</span></td><td><code>/live</code></td><td>Liveness probe</td></tr>
      </table>
    </div>

    <div class="section">
      <h2>🔐 Autenticação</h2>
      <p>A API utiliza JWT (JSON Web Tokens) para autenticação. Inclua o token no header:</p>
      <pre>Authorization: Bearer &lt;seu-access-token&gt;</pre>
      
      <h3>Fluxo de Autenticação</h3>
      <div class="cards">
        <div class="card">
          <h4>1. Registrar</h4>
          <p>Crie uma nova conta e tenant com <code>register</code> mutation</p>
        </div>
        <div class="card">
          <h4>2. Login</h4>
          <p>Obtenha access token + refresh token com <code>login</code> mutation</p>
        </div>
        <div class="card">
          <h4>3. Renovar</h4>
          <p>Use refresh token para obter novo access token</p>
        </div>
      </div>
    </div>

    <div class="section">
      <h2>📝 Queries Disponíveis</h2>
      <table>
        <tr><th>Query</th><th>Descrição</th><th>Autenticação</th></tr>
        <tr><td><code>me</code></td><td>Dados do usuário autenticado</td><td>✅ Obrigatória</td></tr>
        <tr><td><code>tenant</code></td><td>Dados do tenant atual</td><td>✅ Obrigatória</td></tr>
        <tr><td><code>tenantBySlug</code></td><td>Buscar tenant por slug</td><td>❌ Opcional</td></tr>
        <tr><td><code>lead(id)</code></td><td>Buscar lead por ID</td><td>✅ Obrigatória</td></tr>
        <tr><td><code>leads</code></td><td>Listar leads com paginação</td><td>✅ Obrigatória</td></tr>
        <tr><td><code>account(id)</code></td><td>Buscar conta por ID</td><td>✅ Obrigatória</td></tr>
        <tr><td><code>accounts</code></td><td>Listar contas</td><td>✅ Obrigatória</td></tr>
        <tr><td><code>contact(id)</code></td><td>Buscar contato por ID</td><td>✅ Obrigatória</td></tr>
        <tr><td><code>contacts</code></td><td>Listar contatos</td><td>✅ Obrigatória</td></tr>
        <tr><td><code>opportunity(id)</code></td><td>Buscar oportunidade por ID</td><td>✅ Obrigatória</td></tr>
        <tr><td><code>opportunities</code></td><td>Listar oportunidades</td><td>✅ Obrigatória</td></tr>
        <tr><td><code>stages</code></td><td>Estágios do pipeline</td><td>✅ Obrigatória</td></tr>
        <tr><td><code>dashboard</code></td><td>Estatísticas do dashboard</td><td>✅ Obrigatória</td></tr>
      </table>
    </div>

    <div class="section">
      <h2>⚡ Mutations Disponíveis</h2>
      <table>
        <tr><th>Mutation</th><th>Descrição</th></tr>
        <tr><td><code>register</code></td><td>Criar nova conta e tenant</td></tr>
        <tr><td><code>login</code></td><td>Autenticar usuário</td></tr>
        <tr><td><code>refreshToken</code></td><td>Renovar access token</td></tr>
        <tr><td><code>logout</code></td><td>Encerrar sessão</td></tr>
        <tr><td><code>createLead</code></td><td>Criar novo lead</td></tr>
        <tr><td><code>qualifyLead</code></td><td>Qualificar um lead</td></tr>
        <tr><td><code>convertLead</code></td><td>Converter lead em Account + Contact + Opportunity</td></tr>
        <tr><td><code>deleteLead</code></td><td>Deletar lead</td></tr>
        <tr><td><code>createWebhook</code></td><td>Criar webhook</td></tr>
        <tr><td><code>bulkDeleteLeads</code></td><td>Deletar múltiplos leads</td></tr>
        <tr><td><code>uploadFile</code></td><td>Upload de arquivo</td></tr>
      </table>
    </div>

    <div class="section">
      <h2>💡 Exemplos de Uso</h2>
      
      <h3>Registro de novo usuário</h3>
      <pre>mutation Register {
  register(input: {
    email: "usuario@empresa.com"
    password: "senhaSegura123"
    firstName: "João"
    lastName: "Silva"
    tenantName: "Empresa ABC"
    tenantSlug: "empresa-abc"
  }) {
    accessToken
    refreshToken
    user { id email firstName lastName role }
    tenant { id name slug plan }
  }
}</pre>

      <h3>Login</h3>
      <pre>mutation Login {
  login(input: {
    email: "usuario@empresa.com"
    password: "senhaSegura123"
    tenantId: "tenant-id"
  }) {
    accessToken
    refreshToken
    user { id email role }
    tenant { id name }
  }
}</pre>

      <h3>Criar Lead</h3>
      <pre>mutation CreateLead {
  createLead(input: {
    firstName: "Maria"
    lastName: "Santos"
    email: "maria@cliente.com"
    companyName: "Cliente Corp"
    phone: "+55 11 99999-9999"
  }) {
    success
    message
    lead { id email status }
  }
}</pre>

      <h3>Converter Lead</h3>
      <pre>mutation ConvertLead {
  convertLead(input: {
    leadId: "lead-id"
    createOpportunity: true
    opportunityName: "Projeto Enterprise"
    opportunityAmount: 50000
  }) {
    success
    lead { id status convertedAt }
  }
}</pre>
    </div>

    <div class="section">
      <h2>📊 Enums</h2>
      <div class="cards">
        <div class="card">
          <h4>LeadStatus</h4>
          <p><code>NEW</code> <code>CONTACTED</code> <code>QUALIFIED</code> <code>CONVERTED</code> <code>UNQUALIFIED</code></p>
        </div>
        <div class="card">
          <h4>OpportunityStatus</h4>
          <p><code>OPEN</code> <code>WON</code> <code>LOST</code></p>
        </div>
        <div class="card">
          <h4>AccountType</h4>
          <p><code>PROSPECT</code> <code>CUSTOMER</code> <code>PARTNER</code> <code>COMPETITOR</code></p>
        </div>
        <div class="card">
          <h4>UserRole</h4>
          <p><code>ADMIN</code> <code>SALES_REP</code> <code>SALES_MANAGER</code> <code>READ_ONLY</code></p>
        </div>
      </div>
    </div>

    <footer>
      <p>CRM Pipeline API v1.0.0 | © 2024 Bruno Paulon</p>
      <p style="margin-top: 10px;">
        <a href="https://github.com/bfrpaulondev/crm-api" style="color: #8b5cf6;">GitHub</a>
      </p>
    </footer>
  </div>
</body>
</html>
  `;
}

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

    // Setup GraphQL
    await setupGraphQL();

    // Start Fastify server
    const port = parseInt(process.env.PORT || '4000', 10);
    const host = '0.0.0.0';

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

// Start the server
start();
