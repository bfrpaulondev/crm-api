# Cookbook

This document provides step-by-step guides for common workflows in the CRM Pipeline API.

## Table of Contents

1. [Lead Lifecycle](#lead-lifecycle)
2. [Opportunity Pipeline](#opportunity-pipeline)
3. [Account Management](#account-management)
4. [Activity Tracking](#activity-tracking)
5. [Reporting Queries](#reporting-queries)

---

## Lead Lifecycle

### Complete Lead to Customer Journey

This is the full workflow from creating a lead to closing a won deal.

#### Step 1: Create a Lead

```graphql
mutation CreateLead {
  createLead(input: {
    firstName: "Jane"
    lastName: "Smith"
    email: "jane.smith@techcorp.com"
    phone: "+1-555-987-6543"
    companyName: "TechCorp Inc"
    title: "VP of Engineering"
    website: "https://techcorp.com"
    industry: "Technology"
    source: REFERRAL
    tags: ["enterprise", "high-priority", "referred-by-john"]
    notes: "Referred by John from Acme Corp. Very interested in enterprise plan."
  }) {
    success
    lead {
      id
      status
      score
    }
  }
}
```

#### Step 2: Log Initial Activity

```graphql
mutation LogCall {
  createActivity(input: {
    type: CALL
    subject: "Initial discovery call"
    description: "Discussed current pain points and requirements"
    relatedToType: LEAD
    relatedToId: "<lead-id>"
    priority: HIGH
  }) {
    success
    activity { id status }
  }
}
```

#### Step 3: Qualify the Lead

After confirming budget, authority, need, and timeline (BANT):

```graphql
mutation QualifyLead {
  qualifyLead(input: {
    leadId: "<lead-id>"
    notes: "BANT confirmed. Budget: $100K. Decision: Q1. Looking for enterprise solution."
  }) {
    success
    lead {
      id
      status
      qualifiedAt
    }
  }
}
```

#### Step 4: Convert Lead

```graphql
mutation ConvertLead {
  convertLead(input: {
    leadId: "<lead-id>"
    createAccount: true
    accountName: "TechCorp Inc"
    createOpportunity: true
    opportunityName: "TechCorp - Enterprise License"
    opportunityAmount: 100000
    idempotencyKey: "convert-techcorp-jane-2024"
  }) {
    success
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

---

## Opportunity Pipeline

### Move Opportunity Through Stages

#### Step 1: Get Pipeline Stages

```graphql
query GetStages {
  stages {
    id
    name
    order
    probability
    color
    isWonStage
    isLostStage
  }
}
```

Response:
```json
{
  "data": {
    "stages": [
      { "id": "1", "name": "Discovery", "order": 1, "probability": 10 },
      { "id": "2", "name": "Qualification", "order": 2, "probability": 25 },
      { "id": "3", "name": "Proposal", "order": 3, "probability": 50 },
      { "id": "4", "name": "Negotiation", "order": 4, "probability": 75 },
      { "id": "5", "name": "Closed Won", "order": 5, "probability": 100, "isWonStage": true },
      { "id": "6", "name": "Closed Lost", "order": 6, "probability": 0, "isLostStage": true }
    ]
  }
}
```

#### Step 2: Move to Next Stage

```graphql
mutation MoveStage {
  moveOpportunityStage(input: {
    opportunityId: "<opportunity-id>"
    stageId: "<next-stage-id>"
    notes: "Completed discovery call, moving to qualification"
  }) {
    success
    opportunity {
      id
      stageId
      probability
      stage { name }
    }
  }
}
```

#### Step 3: Update Amount and Close Date

```graphql
mutation UpdateOpportunity {
  updateOpportunity(id: "<opportunity-id>", input: {
    amount: 125000
    probability: 50
    expectedCloseDate: "2024-03-15"
    nextStep: "Schedule technical demo with engineering team"
  }) {
    success
    opportunity {
      id
      amount
      probability
      expectedCloseDate
      nextStep
    }
  }
}
```

#### Step 4: Close as Won

```graphql
mutation CloseWon {
  closeOpportunity(input: {
    opportunityId: "<opportunity-id>"
    status: WON
    reason: "Contract signed for 3-year enterprise license"
    actualCloseDate: "2024-02-28"
    idempotencyKey: "close-won-techcorp-2024"
  }) {
    success
    opportunity {
      id
      status
      actualCloseDate
    }
    dealId
  }
}
```

---

## Account Management

### Create Account with Multiple Contacts

#### Step 1: Create Account

```graphql
mutation CreateAccount {
  createAccount(input: {
    name: "Global Industries"
    domain: "globalindustries.com"
    website: "https://globalindustries.com"
    industry: "Manufacturing"
    type: PROSPECT
    tier: ENTERPRISE
    employees: 5000
    annualRevenue: 500000000
    billingAddress: {
      street: "123 Corporate Plaza"
      city: "New York"
      state: "NY"
      postalCode: "10001"
      country: "USA"
    }
  }) {
    success
    account { id name }
  }
}
```

#### Step 2: Add Primary Contact

```graphql
mutation CreatePrimaryContact {
  createContact(input: {
    accountId: "<account-id>"
    firstName: "Michael"
    lastName: "Johnson"
    email: "michael.johnson@globalindustries.com"
    phone: "+1-555-111-2222"
    title: "CIO"
    department: "IT"
    isPrimary: true
    isDecisionMaker: true
  }) {
    success
    contact { id isPrimary isDecisionMaker }
  }
}
```

#### Step 3: Add Secondary Contacts

```graphql
mutation CreateSecondaryContact {
  createContact(input: {
    accountId: "<account-id>"
    firstName: "Sarah"
    lastName: "Williams"
    email: "sarah.williams@globalindustries.com"
    phone: "+1-555-111-3333"
    title: "IT Director"
    department: "IT"
    isPrimary: false
    isDecisionMaker: false
  }) {
    success
    contact { id }
  }
}
```

---

## Activity Tracking

### Complete Task Workflow

#### Step 1: Create Task

```graphql
mutation CreateTask {
  createActivity(input: {
    type: TASK
    subject: "Prepare proposal for TechCorp"
    description: "Create detailed proposal including pricing and timeline"
    relatedToType: OPPORTUNITY
    relatedToId: "<opportunity-id>"
    dueDate: "2024-01-25T17:00:00Z"
    priority: HIGH
  }) {
    success
    activity { id status dueDate }
  }
}
```

#### Step 2: Log Meeting

```graphql
mutation LogMeeting {
  createActivity(input: {
    type: MEETING
    subject: "Product demo with TechCorp team"
    description: "Demonstrated enterprise features and answered technical questions"
    relatedToType: OPPORTUNITY
    relatedToId: "<opportunity-id>"
    dueDate: "2024-01-20T14:00:00Z"
    location: "Virtual - Zoom"
    durationMinutes: 60
  }) {
    success
    activity { id }
  }
}
```

#### Step 3: Add Note

```graphql
mutation AddNote {
  createNote(input: {
    body: "Key points from demo:\n- Very interested in SSO integration\n- Need custom reporting\n- Looking for Q1 implementation\n- Decision expected within 2 weeks"
    visibility: TEAM
    relatedToType: OPPORTUNITY
    relatedToId: "<opportunity-id>"
  }) {
    success
    note { id createdAt }
  }
}
```

---

## Reporting Queries

### Pipeline Summary

```graphql
query PipelineSummary {
  opportunities(filter: { status: OPEN }) {
    edges {
      node {
        id
        name
        amount
        weightedAmount
        probability
        stage { name color }
        expectedCloseDate
        owner { firstName lastName }
      }
    }
    pageInfo { totalCount }
  }
}
```

### Leads by Source

```graphql
query LeadsBySource {
  leads(first: 100) {
    edges {
      node {
        id
        source
        status
        convertedAt
      }
    }
    pageInfo { totalCount }
  }
}
```

### Activities This Week

```graphql
query UpcomingActivities {
  activities(filter: {
    dueAfter: "2024-01-22T00:00:00Z"
    dueBefore: "2024-01-28T23:59:59Z"
    status: PENDING
  }) {
    edges {
      node {
        id
        type
        subject
        dueDate
        priority
        relatedToType
        relatedToId
      }
    }
  }
}
```

### High-Value Opportunities

```graphql
query HighValueOpportunities {
  opportunities(filter: {
    status: OPEN
    minAmount: 50000
  }) {
    edges {
      node {
        id
        name
        amount
        probability
        expectedCloseDate
        account { name tier }
        stage { name }
      }
    }
    pageInfo { totalCount }
  }
}
```

---

## Common Patterns

### Upsert Lead by Email

```graphql
# Check if lead exists
query CheckLead($email: String!) {
  leads(filter: { search: $email }) {
    edges {
      node {
        id
        email
        status
      }
    }
  }
}

# If exists, update
mutation UpdateLead($id: String!, $input: UpdateLeadInput!) {
  updateLead(id: $id, input: $input) {
    success
    lead { id }
  }
}

# If not exists, create
mutation CreateLead($input: CreateLeadInput!) {
  createLead(input: $input) {
    success
    lead { id }
  }
}
```

### Bulk Tagging

```graphql
# Add tag to multiple leads (requires multiple mutations)
mutation AddTag($id: String!) {
  updateLead(id: $id, input: { tags: ["enterprise", "priority"] }) {
    success
    lead { id tags }
  }
}
```

### Soft Delete and Restore

```graphql
# Soft delete
mutation DeleteLead($id: String!) {
  deleteLead(id: $id)
}

# Note: Restore requires admin access or direct DB update
# Deleted records are filtered out from normal queries
```

---

## Best Practices

### 1. Use Idempotency Keys

For critical mutations (convert lead, close opportunity), always use `idempotencyKey`:

```graphql
mutation ConvertLead {
  convertLead(input: {
    leadId: "<lead-id>"
    idempotencyKey: "unique-key-for-this-conversion"
    # ...
  }) { success }
}
```

### 2. Request Only Needed Fields

```graphql
# Good - only needed fields
query Leads {
  leads(first: 10) {
    edges { node { id name email } }
  }
}

# Avoid - over-fetching
query Leads {
  leads {
    edges {
      node {
        id
        name
        # ... all fields
      }
    }
  }
}
```

### 3. Use Pagination

Always paginate large lists:

```graphql
query Leads {
  leads(first: 20, after: $cursor) {
    edges { node { id name } cursor }
    pageInfo { hasNextPage endCursor }
  }
}
```

### 4. Handle Errors Gracefully

```typescript
try {
  const result = await client.mutation({ mutation: CONVERT_LEAD, variables });
  if (!result.data.convertLead.success) {
    // Handle business error
    console.error(result.data.convertLead.message);
  }
} catch (error) {
  // Handle GraphQL/network error
  if (error.extensions?.code === 'LEAD_ALREADY_CONVERTED') {
    // Specific handling
  }
}
```
