# API Reference

This document provides comprehensive reference for all GraphQL operations.

## Queries

### me

Returns the currently authenticated user.

```graphql
query Me {
  me {
    id
    email
    firstName
    lastName
    role
    tenantId
  }
}
```

**Response:**
```json
{
  "data": {
    "me": {
      "id": "507f1f77bcf86cd799439011",
      "email": "john@example.com",
      "firstName": "John",
      "lastName": "Doe",
      "role": "SALES_REP",
      "tenantId": "tenant-123"
    }
  }
}
```

---

### lead

Returns a single lead by ID.

```graphql
query Lead($id: String!) {
  lead(id: $id) {
    id
    firstName
    lastName
    fullName
    email
    phone
    companyName
    title
    status
    source
    score
    tags
    isQualified
    isConverted
    qualifiedAt
    convertedAt
    createdAt
    updatedAt
  }
}
```

**Variables:**
```json
{
  "id": "507f1f77bcf86cd799439011"
}
```

---

### leads

Returns a paginated list of leads with optional filtering.

```graphql
query Leads($filter: LeadFilterInput, $first: Int, $after: String) {
  leads(filter: $filter, first: $first, after: $after) {
    edges {
      node {
        id
        firstName
        lastName
        email
        status
        score
        companyName
      }
      cursor
    }
    pageInfo {
      hasNextPage
      hasPreviousPage
      startCursor
      endCursor
      totalCount
    }
  }
}
```

**Variables:**
```json
{
  "filter": {
    "status": "NEW",
    "search": "john",
    "minScore": 50,
    "createdAfter": "2024-01-01T00:00:00Z"
  },
  "first": 20,
  "after": null
}
```

**Filter Options:**
| Field | Type | Description |
|-------|------|-------------|
| `status` | `LeadStatus` | Filter by status |
| `source` | `LeadSource` | Filter by source |
| `ownerId` | `String` | Filter by owner |
| `search` | `String` | Search in name, email, company |
| `tags` | `[String]` | Filter by tags (AND) |
| `createdAfter` | `DateTime` | Created after date |
| `createdBefore` | `DateTime` | Created before date |
| `hasCompany` | `Boolean` | Has company name |
| `minScore` | `Int` | Minimum score |

---

### account

Returns a single account by ID.

```graphql
query Account($id: String!) {
  account(id: $id) {
    id
    name
    domain
    website
    industry
    type
    tier
    status
    employees
    annualRevenue
    billingAddress {
      street
      city
      state
      postalCode
      country
      fullAddress
    }
  }
}
```

---

### accounts

Returns paginated accounts.

```graphql
query Accounts($filter: AccountFilterInput, $first: Int) {
  accounts(filter: $filter, first: $first) {
    edges {
      node {
        id
        name
        type
        tier
        industry
      }
      cursor
    }
    pageInfo {
      hasNextPage
      totalCount
    }
  }
}
```

---

### opportunity

Returns a single opportunity by ID.

```graphql
query Opportunity($id: String!) {
  opportunity(id: $id) {
    id
    name
    amount
    formattedAmount
    currency
    probability
    weightedAmount
    status
    stageId
    stage {
      id
      name
      probability
      color
    }
    expectedCloseDate
    accountId
    contactId
    ownerId
    isOpen
    isWon
    isLost
    createdAt
    updatedAt
  }
}
```

---

### opportunities

Returns paginated opportunities.

```graphql
query Opportunities($filter: OpportunityFilterInput, $first: Int) {
  opportunities(filter: $filter, first: $first) {
    edges {
      node {
        id
        name
        amount
        status
        probability
        expectedCloseDate
      }
      cursor
    }
    pageInfo {
      hasNextPage
      totalCount
    }
  }
}
```

**Filter Options:**
| Field | Type | Description |
|-------|------|-------------|
| `accountId` | `String` | Filter by account |
| `ownerId` | `String` | Filter by owner |
| `stageId` | `String` | Filter by stage |
| `status` | `OpportunityStatus` | Filter by status |
| `minAmount` | `Float` | Minimum amount |
| `maxAmount` | `Float` | Maximum amount |
| `expectedCloseAfter` | `DateTime` | Close date after |
| `expectedCloseBefore` | `DateTime` | Close date before |

---

### stages

Returns all active stages for the current tenant.

```graphql
query Stages {
  stages {
    id
    name
    order
    probability
    isWonStage
    isLostStage
    color
    isActive
  }
}
```

---

## Mutations

### createLead

Creates a new lead.

```graphql
mutation CreateLead($input: CreateLeadInput!) {
  createLead(input: $input) {
    success
    message
    lead {
      id
      firstName
      lastName
      email
      status
      score
    }
  }
}
```

**Variables:**
```json
{
  "input": {
    "firstName": "John",
    "lastName": "Doe",
    "email": "john.doe@acme.com",
    "phone": "+1-555-123-4567",
    "companyName": "Acme Corp",
    "title": "CTO",
    "website": "https://acme.com",
    "industry": "Technology",
    "source": "WEBSITE",
    "tags": ["enterprise", "priority"],
    "notes": "Met at TechConf 2024"
  }
}
```

---

### updateLead

Updates an existing lead.

```graphql
mutation UpdateLead($id: String!, $input: UpdateLeadInput!) {
  updateLead(id: $id, input: $input) {
    success
    message
    lead {
      id
      firstName
      lastName
      status
      score
    }
  }
}
```

---

### qualifyLead

Marks a lead as qualified.

```graphql
mutation QualifyLead($input: QualifyLeadInput!) {
  qualifyLead(input: $input) {
    success
    message
    lead {
      id
      status
      qualifiedAt
    }
  }
}
```

**Variables:**
```json
{
  "input": {
    "leadId": "507f1f77bcf86cd799439011",
    "notes": "Budget approved, decision maker identified"
  }
}
```

---

### convertLead

Converts a lead to Contact + Account + Opportunity.

```graphql
mutation ConvertLead($input: ConvertLeadInput!) {
  convertLead(input: $input) {
    success
    message
    lead {
      id
      status
      convertedAt
      convertedToAccountId
      convertedToContactId
      convertedToOpportunityId
    }
  }
}
```

**Variables:**
```json
{
  "input": {
    "leadId": "507f1f77bcf86cd799439011",
    "createAccount": true,
    "accountName": "Acme Corp",
    "createOpportunity": true,
    "opportunityName": "Acme Corp - Enterprise License",
    "opportunityAmount": 50000,
    "stageId": "507f1f77bcf86cd799439012",
    "idempotencyKey": "convert-lead-507f1f77"
  }
}
```

**Note:** The `idempotencyKey` ensures the conversion is idempotent. Reusing the same key returns the original result.

---

### createOpportunity

Creates a new opportunity.

```graphql
mutation CreateOpportunity($input: CreateOpportunityInput!) {
  createOpportunity(input: $input) {
    success
    message
    opportunity {
      id
      name
      amount
      currency
      status
      stageId
      probability
    }
  }
}
```

---

### moveOpportunityStage

Moves an opportunity to a different pipeline stage.

```graphql
mutation MoveOpportunityStage($input: MoveOpportunityStageInput!) {
  moveOpportunityStage(input: $input) {
    success
    message
    opportunity {
      id
      stageId
      probability
      stage {
        id
        name
      }
    }
  }
}
```

---

### closeOpportunity

Closes an opportunity as WON or LOST.

```graphql
mutation CloseOpportunity($input: CloseOpportunityInput!) {
  closeOpportunity(input: $input) {
    success
    message
    opportunity {
      id
      status
      actualCloseDate
    }
    dealId
  }
}
```

**Variables (WON):**
```json
{
  "input": {
    "opportunityId": "507f1f77bcf86cd799439011",
    "status": "WON",
    "reason": "Contract signed",
    "idempotencyKey": "close-won-507f1f77"
  }
}
```

**Note:** When status is `WON`, a `dealId` is returned referencing the generated Deal/Order.

---

### createAccount

Creates a new account.

```graphql
mutation CreateAccount($input: CreateAccountInput!) {
  createAccount(input: $input) {
    success
    message
    account {
      id
      name
      type
      tier
      status
    }
  }
}
```

---

### createContact

Creates a new contact.

```graphql
mutation CreateContact($input: CreateContactInput!) {
  createContact(input: $input) {
    success
    message
    contact {
      id
      firstName
      lastName
      email
      isPrimary
      isDecisionMaker
    }
  }
}
```

---

### createActivity

Creates a new activity (call, email, meeting, task).

```graphql
mutation CreateActivity($input: CreateActivityInput!) {
  createActivity(input: $input) {
    success
    message
    activity {
      id
      type
      subject
      status
      priority
      dueDate
    }
  }
}
```

**Variables:**
```json
{
  "input": {
    "type": "CALL",
    "subject": "Follow-up call with John",
    "description": "Discuss enterprise pricing",
    "relatedToType": "OPPORTUNITY",
    "relatedToId": "507f1f77bcf86cd799439011",
    "dueDate": "2024-01-20T10:00:00Z",
    "priority": "HIGH"
  }
}
```

---

### createNote

Creates a note attached to an entity.

```graphql
mutation CreateNote($input: CreateNoteInput!) {
  createNote(input: $input) {
    success
    message
    note {
      id
      body
      visibility
      createdAt
    }
  }
}
```

---

## Enums

### LeadStatus

```graphql
enum LeadStatus {
  NEW          # New lead, not yet contacted
  CONTACTED    # First contact made
  QUALIFIED    # Met qualification criteria
  CONVERTED    # Converted to opportunity
  UNQUALIFIED  # Does not meet criteria
}
```

### LeadSource

```graphql
enum LeadSource {
  WEBSITE
  REFERRAL
  COLD_CALL
  TRADE_SHOW
  SOCIAL_MEDIA
  ADVERTISEMENT
  PARTNER
  OTHER
}
```

### OpportunityStatus

```graphql
enum OpportunityStatus {
  OPEN   # Active opportunity
  WON    # Closed won
  LOST   # Closed lost
}
```

### ActivityType

```graphql
enum ActivityType {
  CALL
  EMAIL
  MEETING
  TASK
  NOTE
}
```

### AccountType

```graphql
enum AccountType {
  PROSPECT    # Potential customer
  CUSTOMER    # Current customer
  PARTNER     # Business partner
  COMPETITOR  # Competitor
  VENDOR      # Vendor/supplier
}
```

### AccountTier

```graphql
enum AccountTier {
  ENTERPRISE   # Large enterprise
  MID_MARKET   # Mid-market
  SMB          # Small/medium business
  STARTUP      # Startup
}
```

---

## Error Codes

| Code | HTTP Status | Description |
|------|-------------|-------------|
| `UNAUTHENTICATED` | 401 | No authentication provided |
| `INVALID_TOKEN` | 401 | Token is invalid or malformed |
| `TOKEN_EXPIRED` | 401 | Access token has expired |
| `FORBIDDEN` | 403 | Insufficient permissions |
| `BAD_USER_INPUT` | 400 | Invalid input data |
| `NOT_FOUND` | 404 | Resource not found |
| `ALREADY_EXISTS` | 409 | Resource already exists |
| `CONFLICT` | 409 | State conflict |
| `RATE_LIMITED` | 429 | Too many requests |
| `QUERY_TOO_COMPLEX` | 400 | Query exceeds complexity limit |
| `QUERY_TOO_DEEP` | 400 | Query exceeds depth limit |
| `INTERNAL` | 500 | Internal server error |

---

## Pagination

The API uses cursor-based pagination following the Relay specification.

### Connection Type

```graphql
type LeadConnection {
  edges: [LeadEdge]
  pageInfo: PageInfo!
}

type LeadEdge {
  node: Lead!
  cursor: String!
}

type PageInfo {
  hasNextPage: Boolean!
  hasPreviousPage: Boolean!
  startCursor: String
  endCursor: String
  totalCount: Int!
}
```

### Example: Paginating Through Results

```graphql
# First page
query {
  leads(first: 10) {
    edges { node { id name } cursor }
    pageInfo { hasNextPage endCursor }
  }
}

# Next page
query {
  leads(first: 10, after: "previous-end-cursor") {
    edges { node { id name } cursor }
    pageInfo { hasNextPage endCursor }
  }
}
```
