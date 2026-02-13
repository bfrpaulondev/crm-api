# CRM Pipeline API - Overview

## Architecture Overview

This document provides a comprehensive overview of the CRM Pipeline API architecture, design decisions, and technical tradeoffs.

### System Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              Client Layer                                    │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │   Web App   │  │  Mobile App │  │   CLI Tool  │  │  Integrations│        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
└─────────┼────────────────┼────────────────┼────────────────┼────────────────┘
          │                │                │                │
          └────────────────┴────────────────┴────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           API Gateway Layer                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    Apollo Server v4 (GraphQL)                        │   │
│  │  • Query/Mutation Operations                                         │   │
│  │  • Subscription Support (future)                                     │   │
│  │  • Persisted Queries (APQ)                                           │   │
│  │  • Complexity & Depth Limits                                         │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Middleware Stack                             │   │
│  │  • JWT Authentication                                                │   │
│  │  • Tenant Context Resolution                                         │   │
│  │  • Rate Limiting (Redis)                                             │   │
│  │  • Request Tracing (OpenTelemetry)                                   │   │
│  │  • Error Handling & Logging                                          │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                           Service Layer                                      │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐        │
│  │LeadService  │  │AccountService│  │OppService   │  │ActivitySvc  │        │
│  │• Create     │  │• CRUD       │  │• Pipeline   │  │• Logging    │        │
│  │• Qualify    │  │• Relations  │  │• Stage Move │  │• Tasks      │        │
│  │• Convert    │  │• Hierarchy  │  │• Won/Lost   │  │• Completion │        │
│  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘  └──────┬──────┘        │
└─────────┼────────────────┼────────────────┼────────────────┼────────────────┘
          │                │                │                │
          └────────────────┴────────────────┴────────────────┘
                                    │
                                    ▼
┌─────────────────────────────────────────────────────────────────────────────┐
│                          Data Access Layer                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                         Repository Pattern                            │   │
│  │  • BaseRepository<T> (CRUD + Pagination)                             │   │
│  │  • LeadRepository, AccountRepository, etc.                           │   │
│  │  • DataLoader (N+1 Prevention)                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
                                    │
                    ┌───────────────┼───────────────┐
                    ▼               ▼               ▼
            ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
            │   MongoDB   │ │    Redis    │ │   Audit     │
            │  (Primary)  │ │   (Cache)   │ │    Logs     │
            │             │ │             │ │             │
            │ • Leads     │ │ • Sessions  │ │ • Changes   │
            │ • Accounts  │ │ • Rate Limit│ │ • Actions   │
            │ • Opps      │ │ • Cache     │ │ • Actors    │
            └─────────────┘ └─────────────┘ └─────────────┘
```

## Key Design Decisions

### 1. Schema-First with Pothos (TypeScript)

**Decision**: Use Pothos for GraphQL schema definition instead of Nexus or SDL-first approach.

**Rationale**:
- Full TypeScript type safety from schema to resolvers
- Better IDE support and autocomplete
- Refactoring is easier with type checking
- Plugin ecosystem for Zod validation, directives, etc.

**Tradeoffs**:
- Learning curve for developers used to SDL
- Schema code is more verbose than pure SDL

### 2. MongoDB with Native Driver

**Decision**: Use MongoDB native driver instead of Mongoose.

**Rationale**:
- Better performance (no ODM overhead)
- Full control over queries and aggregations
- TypeScript types are defined separately (cleaner separation)
- Transaction support with sessions

**Tradeoffs**:
- More boilerplate for simple operations
- No built-in middleware/hooks
- Manual index management

### 3. Soft Delete by Default

**Decision**: Implement soft delete for all entities.

**Rationale**:
- Data recovery capability
- Audit trail preservation
- Compliance requirements (GDPR data retention)
- Relationship integrity

**Implementation**:
- `deletedAt` field on all entities
- Queries filter out soft-deleted records by default
- Hard delete available for admin operations

### 4. Cursor-Based Pagination

**Decision**: Use cursor-based pagination instead of offset-based.

**Rationale**:
- Consistent results even with data changes
- Better performance for large datasets
- Relay-style connections for better client integration

**Implementation**:
- `edges` with `node` and `cursor`
- `pageInfo` with `hasNextPage`, `hasPreviousPage`, `startCursor`, `endCursor`

### 5. Multi-Tenancy at Database Level

**Decision**: Use `tenantId` field on all documents instead of separate databases.

**Rationale**:
- Simpler infrastructure (single MongoDB instance)
- Cross-tenant analytics possible
- Easier backup/restore
- Lower operational costs

**Security**:
- All queries MUST include `tenantId` filter
- Context enforces tenant scope
- Repository layer automatically adds tenant filter

### 6. JWT Authentication with Refresh Tokens

**Decision**: Use JWT access tokens + refresh tokens instead of sessions.

**Rationale**:
- Stateless authentication
- Better scalability
- Works well with microservices
- Mobile-friendly

**Security**:
- Short-lived access tokens (15 min default)
- Long-lived refresh tokens (7 days default)
- Token revocation via Redis blacklist

## Technology Stack

| Component | Technology | Version | Purpose |
|-----------|-----------|---------|---------|
| Runtime | Node.js | 20+ | JavaScript runtime |
| Language | TypeScript | 5.3+ | Type safety |
| API Framework | Apollo Server | 4.x | GraphQL server |
| Schema Builder | Pothos | 3.x | Type-safe schema |
| Database | MongoDB | 7.0 | Primary data store |
| Cache | Redis | 7.2 | Caching, rate limiting |
| Validation | Zod | 3.x | Input validation |
| Logging | Pino | 8.x | Structured logging |
| Tracing | OpenTelemetry | 1.x | Distributed tracing |
| Testing | Vitest | 1.x | Unit/integration tests |

## Project Structure

```
crm-api/
├── src/
│   ├── config/           # Environment configuration
│   ├── graphql/          # GraphQL schema and resolvers
│   │   ├── schema/       # Pothos schema definitions
│   │   │   ├── builder.ts
│   │   │   └── types/    # Entity type definitions
│   │   ├── resolvers/    # Query and mutation resolvers
│   │   └── dataloaders.ts
│   ├── infrastructure/   # External services
│   │   ├── mongo/        # MongoDB connection
│   │   ├── redis/        # Redis client
│   │   ├── logging/      # Pino logger
│   │   └── otel/         # OpenTelemetry
│   ├── middlewares/      # Request processing
│   │   ├── auth.middleware.ts
│   │   └── rate-limit.middleware.ts
│   ├── repositories/     # Data access layer
│   ├── services/         # Business logic layer
│   ├── types/            # TypeScript types
│   │   ├── entities.ts   # Entity interfaces
│   │   ├── context.ts    # GraphQL context
│   │   ├── errors.ts     # Error definitions
│   │   └── validation.ts # Zod schemas
│   ├── utils/            # Helper functions
│   ├── __tests__/        # Test files
│   │   ├── unit/
│   │   ├── integration/
│   │   └── contract/
│   └── index.ts          # Entry point
├── docker/               # Docker configuration
│   ├── Dockerfile.dev
│   ├── Dockerfile.prod
│   └── docker-compose.*.yml
├── docs/                 # Documentation
├── scripts/              # Utility scripts
│   ├── create-indexes.ts
│   └── seed-dev.ts
├── examples/             # Client examples
│   ├── operations/       # GraphQL operations
│   └── client/           # Codegen example
├── package.json
├── tsconfig.json
└── .eslintrc.json
```

## Entity Relationship Diagram

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Lead     │────▶│   Contact   │     │   Account   │
│             │     │             │◀────│             │
│ • id        │     │ • id        │     │ • id        │
│ • tenantId  │     │ • tenantId  │     │ • tenantId  │
│ • ownerId   │     │ • accountId │     │ • ownerId   │
│ • status    │     │ • ownerId   │     │ • name      │
│ • email     │     │ • email     │     │ • type      │
│ • name      │     │ • name      │     │ • tier      │
└─────────────┘     └──────┬──────┘     └──────┬──────┘
                           │                   │
                           │                   │
                           ▼                   ▼
                    ┌─────────────────────────────────┐
                    │         Opportunity             │
                    │                                 │
                    │ • id, tenantId, ownerId         │
                    │ • accountId (FK)                │
                    │ • contactId (FK)                │
                    │ • stageId (FK)                  │
                    │ • amount, probability           │
                    │ • status (OPEN/WON/LOST)        │
                    └────────────┬────────────────────┘
                                 │
                    ┌────────────┴────────────┐
                    ▼                         ▼
            ┌─────────────┐          ┌─────────────┐
            │  Activity   │          │    Note     │
            │             │          │             │
            │ • type      │          │ • body      │
            │ • subject   │          │ • visibility│
            │ • relatedTo │          │ • relatedTo │
            └─────────────┘          └─────────────┘
                                 │
                                 ▼
                         ┌─────────────┐
                         │  AuditLog   │
                         │ (append-only)│
                         │             │
                         │ • action    │
                         │ • changes   │
                         │ • actorId   │
                         └─────────────┘
```

## Next Steps

1. Review [Setup Guide](./02-setup.md) for local development
2. Read [Authentication](./03-auth.md) for security details
3. Check [API Reference](./05-api-reference.md) for GraphQL operations
4. See [Cookbook](./06-cookbook.md) for common workflows
