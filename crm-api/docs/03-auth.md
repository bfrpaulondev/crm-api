# Authentication & Authorization

## Overview

The API uses JWT (JSON Web Token) based authentication with access and refresh tokens. All requests (except public endpoints) require a valid access token in the Authorization header.

## Authentication Flow

```
┌─────────────┐                    ┌─────────────┐                    ┌─────────────┐
│   Client    │                    │     API     │                    │   Redis     │
└──────┬──────┘                    └──────┬──────┘                    └──────┬──────┘
       │                                  │                                  │
       │  POST /graphql                   │                                  │
       │  mutation login { ... }          │                                  │
       │─────────────────────────────────▶│                                  │
       │                                  │                                  │
       │                                  │  Verify credentials              │
       │                                  │───────────────────────┐          │
       │                                  │                       │          │
       │                                  │◀──────────────────────┘          │
       │                                  │                                  │
       │  { accessToken, refreshToken }   │                                  │
       │◀─────────────────────────────────│                                  │
       │                                  │                                  │
       │  POST /graphql                   │                                  │
       │  Authorization: Bearer <token>   │                                  │
       │─────────────────────────────────▶│                                  │
       │                                  │                                  │
       │                                  │  Check if token revoked?         │
       │                                  │─────────────────────────────────▶│
       │                                  │                                  │
       │                                  │◀─────────── false ───────────────│
       │                                  │                                  │
       │                                  │  Verify JWT signature            │
       │                                  │───────────────────────┐          │
       │                                  │                       │          │
       │                                  │◀──────────────────────┘          │
       │                                  │                                  │
       │  { data: { ... } }               │                                  │
       │◀─────────────────────────────────│                                  │
       │                                  │                                  │
```

## Token Types

### Access Token

- **Lifetime**: 15 minutes (configurable via `JWT_EXPIRES_IN`)
- **Purpose**: Authenticate API requests
- **Storage**: Memory (frontend) / Secure storage (mobile)
- **Contains**: User ID, email, tenant ID, role

### Refresh Token

- **Lifetime**: 7 days (configurable via `JWT_REFRESH_EXPIRES_IN`)
- **Purpose**: Obtain new access tokens
- **Storage**: Secure HTTP-only cookie or secure storage
- **Rotation**: New refresh token issued on each use

## Obtaining Tokens

### Login Mutation

```graphql
mutation Login($email: String!, $password: String!, $tenantId: String!) {
  login(email: $email, password: $password, tenantId: $tenantId) {
    accessToken
    refreshToken
    user {
      id
      email
      role
    }
  }
}
```

### Refresh Token Mutation

```graphql
mutation RefreshToken($refreshToken: String!) {
  refreshToken(refreshToken: $refreshToken) {
    accessToken
    refreshToken
  }
}
```

## Using Tokens

Include the access token in the Authorization header:

```http
POST /graphql HTTP/1.1
Host: api.example.com
Content-Type: application/json
Authorization: Bearer eyJhbGciOiJIUzI1NiIs...

{
  "query": "query { me { id email } }"
}
```

## Authorization Model

### Role-Based Access Control (RBAC)

The API defines four user roles:

| Role | Description | Permissions |
|------|-------------|-------------|
| `ADMIN` | Full system access | All permissions |
| `MANAGER` | Team management | All except admin functions |
| `SALES_REP` | Sales operations | Read, create, update most entities |
| `READ_ONLY` | View only | Read access only |

### Permission Matrix

| Permission | ADMIN | MANAGER | SALES_REP | READ_ONLY |
|-----------|-------|---------|-----------|-----------|
| `LEAD_READ` | ✅ | ✅ | ✅ | ✅ |
| `LEAD_CREATE` | ✅ | ✅ | ✅ | ❌ |
| `LEAD_UPDATE` | ✅ | ✅ | ✅ | ❌ |
| `LEAD_DELETE` | ✅ | ✅ | ❌ | ❌ |
| `LEAD_CONVERT` | ✅ | ✅ | ✅ | ❌ |
| `OPPORTUNITY_CLOSE_WON` | ✅ | ✅ | ✅ | ❌ |
| `OPPORTUNITY_CLOSE_LOST` | ✅ | ✅ | ✅ | ❌ |
| `STAGE_MANAGE` | ✅ | ✅ | ❌ | ❌ |
| `ADMIN_ACCESS` | ✅ | ❌ | ❌ | ❌ |

### Owner-Based Access

In addition to RBAC, the API supports owner-based access:

- **Owners** can always access their own records
- **Admins** can access all records
- **Managers** can access their team's records
- **Sales Reps** can only access their own records

### Field-Level Authorization

Sensitive fields are protected with additional checks:

```graphql
type Lead {
  email: Email @sensitive(requiresRole: "SALES_REP")
  phone: String @sensitive(requiresRole: "SALES_REP")
  revenue: Float @sensitive(requiresRole: "MANAGER")
}
```

## Multi-Tenancy

### Tenant Context

Every authenticated request is scoped to a single tenant:

1. User authenticates with `tenantId`
2. JWT includes `tenantId` claim
3. All queries automatically filter by `tenantId`
4. Cross-tenant access is prevented

### Tenant Isolation

```typescript
// All queries are automatically filtered
const leads = await Lead.find({ tenantId: context.tenant.id });

// Attempting to access another tenant's data returns null
const otherTenantLead = await Lead.findOne({
  _id: someId,
  tenantId: 'different-tenant', // Will fail
});
```

## Token Revocation

### Logout

```graphql
mutation Logout {
  logout {
    success
  }
}
```

This adds the token's `jti` (JWT ID) to a Redis blacklist.

### Token Blacklist

- Revoked tokens are stored in Redis with TTL matching token expiration
- Blacklist is checked on every authenticated request
- Supports immediate revocation for security incidents

## Security Best Practices

### For Clients

1. **Store refresh tokens securely**
   - Web: HTTP-only, Secure, SameSite cookies
   - Mobile: Secure storage (Keychain/Keystore)

2. **Implement token rotation**
   - Request new tokens before expiration
   - Use refresh token rotation

3. **Handle token errors gracefully**
   - Redirect to login on 401
   - Clear tokens on 403

### For API

1. **Use short-lived access tokens** (15 min default)
2. **Rotate refresh tokens** on each use
3. **Implement rate limiting** on login endpoints
4. **Log authentication events** for audit
5. **Support token revocation** for security incidents

## Error Handling

| Code | Description | Action |
|------|-------------|--------|
| `UNAUTHENTICATED` | No token provided | Redirect to login |
| `INVALID_TOKEN` | Token is malformed | Clear tokens, redirect |
| `TOKEN_EXPIRED` | Access token expired | Try refresh token |
| `FORBIDDEN` | Insufficient permissions | Show error, no redirect |
| `RATE_LIMITED` | Too many requests | Wait and retry |

## Example: Complete Auth Flow

```typescript
// 1. Login
const loginResult = await client.mutation({
  mutation: LOGIN,
  variables: { email, password, tenantId },
});

// Store tokens
localStorage.setItem('accessToken', loginResult.accessToken);
secureStorage.setItem('refreshToken', loginResult.refreshToken);

// 2. Make authenticated request
const leadsResult = await client.query({
  query: GET_LEADS,
  context: {
    headers: {
      Authorization: `Bearer ${accessToken}`,
    },
  },
});

// 3. Handle token expiration
if (leadsResult.errors?.some(e => e.extensions.code === 'TOKEN_EXPIRED')) {
  // Refresh token
  const refreshResult = await client.mutation({
    mutation: REFRESH_TOKEN,
    variables: { refreshToken },
  });

  // Update stored tokens
  localStorage.setItem('accessToken', refreshResult.accessToken);
  secureStorage.setItem('refreshToken', refreshResult.refreshToken);

  // Retry original request
  // ...
}
```
