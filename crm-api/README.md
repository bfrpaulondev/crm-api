# CRM Pipeline API

A production-ready GraphQL API for CRM + Pipeline management, built with Node.js, TypeScript, MongoDB, and Redis.

## 🚀 Features

- **GraphQL API** - Apollo Server v4 with Pothos schema builder
- **Multi-tenancy** - Complete tenant isolation at data layer
- **Authentication** - JWT with refresh tokens, password reset
- **Authorization** - RBAC with 4 roles and 20+ permissions
- **Pipeline Management** - Configurable stages per tenant
- **Lead Lifecycle** - Create → Qualify → Convert workflow
- **Real-time Analytics** - Pipeline, revenue, team performance
- **Bulk Operations** - Import, export, bulk update
- **File Upload** - S3 or local storage support
- **Webhooks** - Event notifications with retry logic
- **Email Integration** - SendGrid, SES, or Resend support
- **Observability** - OpenTelemetry tracing, structured logging
- **Rate Limiting** - Redis-based with sliding window

## 📦 Tech Stack

| Component | Technology |
|-----------|-----------|
| Runtime | Node.js 20+ |
| Language | TypeScript 5.3+ |
| API | Apollo Server 4 + Pothos |
| Database | MongoDB 7.0 |
| Cache | Redis 7.2 |
| Validation | Zod |
| Logging | Pino |
| Tracing | OpenTelemetry |

## 🏃 Quick Start

```bash
# Clone and install
git clone <repo-url>
cd crm-api
npm install

# Configure environment
cp .env.example .env

# Start infrastructure (MongoDB, Redis)
npm run docker:dev

# Create database indexes
npm run indexes:create

# Start development server
npm run dev
```

## 📍 API Endpoints

| Endpoint | Description |
|----------|-------------|
| `/graphql` | GraphQL endpoint |
| `/health` | Full health check |
| `/ready` | Readiness check |
| `/live` | Liveness check |

## 🚢 Deploy to Render

### Prerequisites

1. Create a [Render account](https://render.com)
2. Have a GitHub repository with this code

### Step 1: Fork/Clone to GitHub

```bash
# Push to your GitHub account
git remote add origin https://github.com/YOUR_USERNAME/crm-api.git
git push -u origin main
```

### Step 2: Create New Blueprint Instance

1. Go to [Render Dashboard](https://dashboard.render.com)
2. Click **New** → **Blueprint**
3. Connect your GitHub repository
4. Render will detect the `render.yaml` file

### Step 3: Configure Environment Variables

In the Render dashboard, update these variables:

| Variable | Description | Example |
|----------|-------------|---------|
| `CORS_ORIGINS` | Your frontend URLs | `https://myapp.vercel.app,https://myapp.com` |
| `JWT_SECRET` | JWT signing secret | Auto-generated, or set your own (32+ chars) |
| `JWT_REFRESH_SECRET` | Refresh token secret | Auto-generated |

### Step 4: Deploy

Click **Apply** and Render will:
1. Create a MongoDB database
2. Create a Redis instance
3. Deploy the API
4. Provide a URL like `https://crm-api.onrender.com`

### Step 5: Create Indexes

After first deploy, run the index creation script:

```bash
# Connect to your Render web service shell
# Then run:
npm run indexes:create
```

Or use the Render shell:
```bash
render ssh crm-api
npm run indexes:create
```

## ⚙️ Configuration Checklist

Before going to production, update these in Render:

### Required Changes

- [ ] **CORS_ORIGINS**: Add your frontend domains
- [ ] **JWT_SECRET**: Should be auto-generated, verify it exists
- [ ] **JWT_REFRESH_SECRET**: Should be auto-generated, verify it exists

### Optional Changes

- [ ] **EMAIL_PROVIDER**: Set to `sendgrid`, `ses`, or `resend`
- [ ] **SENDGRID_API_KEY** or **RESEND_API_KEY**: For email sending
- [ ] **STORAGE_TYPE**: Set to `s3` for production file uploads
- [ ] **AWS_S3_BUCKET**: Your S3 bucket name
- [ ] **AWS_ACCESS_KEY_ID**: AWS credentials
- [ ] **AWS_SECRET_ACCESS_KEY**: AWS credentials

### Rate Limits (adjust if needed)

- [ ] `RATE_LIMIT_MAX_REQUESTS`: Default 100/min
- [ ] `GRAPHQL_DEPTH_LIMIT`: Default 10
- [ ] `GRAPHQL_COMPLEXITY_LIMIT`: Default 1000

## 🔧 Local Development

### Using Docker (Recommended)

```bash
# Start all services
npm run docker:dev

# The API will be available at http://localhost:4000
```

### Without Docker

You need MongoDB and Redis installed locally:

```bash
# Start MongoDB (macOS)
brew services start mongodb-community

# Start Redis (macOS)
brew services start redis

# Start API
npm run dev
```

### Database Operations

```bash
# Create indexes
npm run indexes:create

# Seed test data
npm run seed:dev
```

## 🧪 Testing

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

## 📁 Project Structure

```
src/
├── config/           # Environment configuration
├── graphql/
│   ├── schema/       # Pothos schema definitions
│   └── resolvers/    # Query and mutation resolvers
├── infrastructure/   # MongoDB, Redis, logging, OTEL
├── middlewares/      # Auth, rate limiting
├── repositories/     # Data access layer
├── services/         # Business logic
├── types/            # TypeScript types and Zod schemas
└── __tests__/        # Test files
```

## 📖 API Documentation

- [Overview](./docs/01-overview.md) - Architecture and design
- [Setup](./docs/02-setup.md) - Development setup
- [Authentication](./docs/03-auth.md) - Auth flow
- [API Reference](./docs/05-api-reference.md) - GraphQL operations
- [Cookbook](./docs/06-cookbook.md) - Common workflows

## 🔒 Security Features

- JWT access + refresh tokens
- Token revocation via Redis
- Rate limiting per IP/user
- Query depth/complexity limits
- Input validation with Zod
- Soft delete for data recovery
- Audit logging
- CORS configuration
- Introspection disabled in production

## 💰 Render Pricing

| Plan | Price | Resources |
|------|-------|-----------|
| Free | $0 | 750 hours/month, sleeps after inactivity |
| Starter | $7/month | Always on, more resources |
| Pro | $25/month | Production workloads |

**Note**: Free tier is good for testing, but for production use Starter or Pro.

## 🌐 Frontend Integration

### React/Next.js Example

```typescript
import { ApolloClient, InMemoryCache, createHttpLink } from '@apollo/client';
import { setContext } from '@apollo/client/link/context';

const httpLink = createHttpLink({
  uri: 'https://your-api.onrender.com/graphql',
});

const authLink = setContext((_, { headers }) => {
  const token = localStorage.getItem('accessToken');
  return {
    headers: {
      ...headers,
      authorization: token ? `Bearer ${token}` : '',
    },
  };
});

export const client = new ApolloClient({
  link: authLink.concat(httpLink),
  cache: new InMemoryCache(),
});
```

### Important: CORS

Make sure `CORS_ORIGINS` includes your frontend URL:

```
CORS_ORIGINS=https://myapp.vercel.app,https://myapp.com
```

## 🐛 Troubleshooting

### API returns 401 Unauthorized

- Check if JWT token is included in Authorization header
- Token format: `Bearer <token>`
- Token might be expired - use refresh token

### CORS errors

- Add your frontend URL to `CORS_ORIGINS`
- Include protocol: `https://` not just domain
- Multiple URLs: comma-separated

### MongoDB connection errors

- Wait a few minutes after creating database
- Check if MongoDB is in the same region as your web service
- Verify `MONGODB_URI` environment variable

### Redis connection errors

- Redis is a private service - only accessible within Render
- Check if Redis is running in the same region
- Verify `REDIS_URL` environment variable

## 📝 License

MIT

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Make your changes
4. Run tests: `npm test`
5. Submit a pull request

---

Built with ❤️ for modern CRM needs.
