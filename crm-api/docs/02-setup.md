# Setup Guide

## Prerequisites

- Node.js 20+
- Docker & Docker Compose
- pnpm (recommended) or npm

## Quick Start

### 1. Clone and Install

```bash
git clone <repository-url>
cd crm-api
npm install
```

### 2. Environment Configuration

Copy the example environment file:

```bash
cp .env.example .env
```

Edit `.env` with your configuration:

```env
# Application
NODE_ENV=development
PORT=4000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/crm_api
MONGODB_DB_NAME=crm_api

# Redis
REDIS_URL=redis://localhost:6379

# JWT (generate secure secrets!)
JWT_SECRET=your-32-char-minimum-secret-key-here
JWT_REFRESH_SECRET=another-32-char-minimum-secret-key
```

### 3. Start Infrastructure

```bash
# Start MongoDB, Redis, and Jaeger (tracing)
npm run docker:dev
```

### 4. Create Database Indexes

```bash
npm run indexes:create
```

### 5. Seed Development Data (Optional)

```bash
npm run seed:dev
```

### 6. Start Development Server

```bash
npm run dev
```

The API will be available at:
- GraphQL Endpoint: http://localhost:4000/graphql
- Health Check: http://localhost:4000/health
- Playground: http://localhost:4000 (development only)

## Docker Setup

### Development

```bash
# Start all services
docker-compose -f docker/docker-compose.dev.yml up -d

# View logs
docker-compose -f docker/docker-compose.dev.yml logs -f api

# Stop services
docker-compose -f docker/docker-compose.dev.yml down
```

### Production

```bash
# Build and start
docker-compose -f docker/docker-compose.prod.yml up -d

# The production setup uses:
# - Non-root user in container
# - Health checks
# - Resource limits
# - No introspection/playground
```

## Environment Variables

### Required

| Variable | Description | Example |
|----------|-------------|---------|
| `MONGODB_URI` | MongoDB connection string | `mongodb://localhost:27017/crm_api` |
| `REDIS_URL` | Redis connection string | `redis://localhost:6379` |
| `JWT_SECRET` | JWT signing secret (min 32 chars) | `your-super-secret-key...` |
| `JWT_REFRESH_SECRET` | Refresh token secret | `another-secret-key...` |

### Optional

| Variable | Default | Description |
|----------|---------|-------------|
| `NODE_ENV` | `development` | Environment mode |
| `PORT` | `4000` | API port |
| `LOG_LEVEL` | `info` | Log verbosity |
| `LOG_FORMAT` | `json` | `json` or `pretty` |
| `RATE_LIMIT_MAX_REQUESTS` | `100` | Max requests per minute |
| `GRAPHQL_DEPTH_LIMIT` | `10` | Max query depth |
| `GRAPHQL_COMPLEXITY_LIMIT` | `1000` | Max query complexity |
| `INTROSPECTION_ENABLED` | `true` in dev | Enable GraphQL introspection |
| `PLAYGROUND_ENABLED` | `true` in dev | Enable GraphQL Playground |

## Development Workflow

### Running Tests

```bash
# All tests
npm test

# Unit tests only
npm run test:unit

# Integration tests (requires MongoDB)
npm run test:integration

# Contract tests
npm run test:contract

# Coverage report
npm run test:coverage
```

### Code Quality

```bash
# Lint check
npm run lint

# Fix lint issues
npm run lint:fix

# Format code
npm run format

# Type check
npm run typecheck
```

### Database Operations

```bash
# Create indexes
npm run indexes:create

# Seed development data
npm run seed:dev
```

## Health Checks

The API provides three health check endpoints:

### `/health` - Full Health Check

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "1.0.0",
  "checks": {
    "mongodb": "ok",
    "redis": "ok"
  }
}
```

### `/ready` - Readiness Check

Returns 200 when the API is ready to accept requests.

### `/live` - Liveness Check

Simple check if the process is running.

## Troubleshooting

### MongoDB Connection Issues

```bash
# Check if MongoDB is running
docker ps | grep mongo

# Connect to MongoDB shell
docker exec -it crm-mongo mongosh

# Check connection string
echo $MONGODB_URI
```

### Redis Connection Issues

```bash
# Check if Redis is running
docker ps | grep redis

# Test Redis connection
docker exec -it crm-redis redis-cli ping
```

### JWT Errors

- Ensure `JWT_SECRET` and `JWT_REFRESH_SECRET` are at least 32 characters
- Check that secrets are different from each other
- Verify token hasn't expired (access tokens: 15 min default)

### Query Complexity Errors

If you get `QUERY_TOO_COMPLEX` errors:
1. Reduce the number of fields requested
2. Use pagination instead of requesting all records
3. Increase `GRAPHQL_COMPLEXITY_LIMIT` (not recommended for production)
