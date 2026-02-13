# CRM Pipeline API

API GraphQL completa para gerenciamento de CRM e Pipeline de Vendas, construída com foco em performance, segurança e escalabilidade.

## Stack Tecnológica

- **Node.js 20+** com TypeScript
- **Apollo Server 4** - Servidor GraphQL
- **Pothos** - Schema-first GraphQL builder
- **MongoDB** - Banco de dados NoSQL
- **Redis** - Cache e rate limiting
- **JWT** - Autenticação com access/refresh tokens
- **OpenTelemetry** - Observabilidade e tracing
- **Pino** - Logging estruturado

## Arquitetura

```
src/
├── config/              # Configurações e variáveis de ambiente
├── infrastructure/      # Conexões com MongoDB, Redis, Logger, OpenTelemetry
├── types/               # Interfaces, tipos e validações Zod
├── graphql/
│   ├── schema/          # Schema GraphQL com Pothos
│   ├── resolvers/       # Queries e Mutations
│   └── dataloaders.ts   # DataLoaders para N+1 prevention
├── repositories/        # Camada de acesso a dados
├── services/            # Lógica de negócio
├── middlewares/         # Auth, rate limiting, CORS
└── __tests__/           # Testes unitários, integração e contrato
```

## Funcionalidades

### Gestão de Entidades
- **Leads**: Criação, qualificação, conversão para oportunidades
- **Contas**: Empresas/clientes
- **Contatos**: Pessoas vinculadas às contas
- **Oportunidades**: Pipeline de vendas com estágios
- **Atividades**: Tarefas, calls, meetings, emails
- **Notas**: Anotações em entidades

### Segurança
- Autenticação JWT com refresh tokens
- Rate limiting com sliding window
- RBAC (Role-Based Access Control)
- Multi-tenancy isolado por tenantId
- Input sanitization e validação Zod
- Audit logging (append-only)

### Performance
- DataLoader para N+1 prevention
- Cursor-based pagination (Relay-style)
- Índices otimizados no MongoDB
- Cache Redis para queries frequentes
- Persisted Queries (APQ)

### Observabilidade
- Structured logging (Pino)
- Distributed tracing (OpenTelemetry + Jaeger)
- Health checks
- Metrics endpoint

## Quick Start

### Pré-requisitos
- Node.js 20+
- MongoDB 6+
- Redis 7+

### Instalação

```bash
# Clone o repositório
git clone https://github.com/bfrpaulondev/crm-api.git
cd crm-api

# Instale as dependências
npm install

# Configure as variáveis de ambiente
cp .env.example .env
# Edite o .env com suas configurações

# Crie os índices do MongoDB
npm run create-indexes

# Inicie em desenvolvimento
npm run dev
```

### Variáveis de Ambiente

```env
# Servidor
NODE_ENV=development
PORT=4000

# MongoDB
MONGODB_URI=mongodb://localhost:27017/crm

# Redis
REDIS_URL=redis://localhost:6379

# JWT
JWT_SECRET=sua-chave-secreta-muito-segura
JWT_REFRESH_SECRET=outra-chave-para-refresh-token
JWT_EXPIRES_IN=15m
JWT_REFRESH_EXPIRES_IN=7d

# CORS
CORS_ORIGINS=http://localhost:3000,http://localhost:3001

# Rate Limiting
RATE_LIMIT_MAX=100
RATE_LIMIT_WINDOW=60000
```

## Deploy no Render

### 1. MongoDB Atlas (Gratuito)

1. Acesse [MongoDB Atlas](https://www.mongodb.com/cloud/atlas)
2. Crie uma conta gratuita
3. Crie um cluster gratuito (M0 Sandbox)
4. Crie um usuário de banco de dados
5. Em Network Access, adicione `0.0.0.0/0`
6. Copie a connection string

### 2. Upstash Redis (Gratuito)

1. Acesse [Upstash](https://upstash.com)
2. Crie uma conta gratuita
3. Crie um Redis database
4. Copie a URL de conexão

### 3. Render Web Service

1. Acesse [Render](https://dashboard.render.com)
2. Clique em **New** → **Web Service**
3. Conecte seu GitHub e selecione o repositório
4. Configure:

| Campo | Valor |
|-------|-------|
| Name | `crm-api` |
| Region | Oregon (US West) |
| Branch | `main` |
| Runtime | `Node` |
| Build Command | `npm install && npm run build` |
| Start Command | `npm start` |
| Instance Type | `Free` |

5. Adicione as variáveis de ambiente:

| Variável | Valor |
|----------|-------|
| `NODE_ENV` | `production` |
| `PORT` | `10000` |
| `MONGODB_URI` | `sua-connection-string-atlas` |
| `REDIS_URL` | `sua-url-upstash` |
| `JWT_SECRET` | `string-aleatoria-longa-e-segura` |
| `JWT_REFRESH_SECRET` | `outra-string-aleatoria-longa` |
| `CORS_ORIGINS` | `https://seu-frontend.com` |

6. Clique em **Create Web Service**

## API Reference

### Endpoint
```
POST /graphql
```

### Headers
```
Authorization: Bearer <access_token>
Content-Type: application/json
```

### Queries Principais

```graphql
# Listar leads com paginação
query Leads($first: Int, $after: String, $filter: LeadFilterInput) {
  leads(first: $first, after: $after, filter: $filter) {
    edges {
      node { id name email status score }
    }
    pageInfo { hasNextPage endCursor }
  }
}

# Buscar oportunidade por ID
query Opportunity($id: ID!) {
  opportunity(id: $id) {
    id name value stage probability expectedCloseDate
    account { id name }
    contacts { id name email }
  }
}

# Dashboard com métricas
query Dashboard {
  dashboard {
    totalLeads
    qualifiedLeads
    totalOpportunities
    totalValue
    wonValue
    pipelineByStage {
      stage
      count
      value
    }
  }
}
```

### Mutations Principais

```graphql
# Criar lead
mutation CreateLead($input: CreateLeadInput!) {
  createLead(input: $input) {
    id name email company phone source status score
  }
}

# Qualificar lead
mutation QualifyLead($id: ID!, $score: Int!) {
  qualifyLead(id: $id, score: $score) {
    id status score qualifiedAt
  }
}

# Converter lead em oportunidade
mutation ConvertLead($id: ID!, $input: ConvertLeadInput!) {
  convertLead(id: $id, input: $input) {
    lead { id status convertedAt }
    opportunity { id name value }
    account { id name }
  }
}

# Criar oportunidade
mutation CreateOpportunity($input: CreateOpportunityInput!) {
  createOpportunity(input: $input) {
    id name value stage probability expectedCloseDate
  }
}

# Fechar oportunidade (ganha/perdida)
mutation CloseOpportunity($id: ID!, $won: Boolean!, $reason: String) {
  closeOpportunity(id: $id, won: $won, reason: $reason) {
    id status closedAt actualCloseDate lossReason
  }
}
```

### Autenticação

```graphql
# Login
mutation Login($email: String!, $password: String!) {
  login(email: $email, password: $password) {
    accessToken
    refreshToken
    user { id name email role }
  }
}

# Refresh token
mutation RefreshToken($token: String!) {
  refreshToken(token: $token) {
    accessToken
    refreshToken
  }
}
```

## Testes

```bash
# Todos os testes
npm test

# Testes com coverage
npm run test:coverage

# Apenas unitários
npm run test:unit

# Apenas integração
npm run test:integration
```

## Scripts Disponíveis

```bash
npm run dev          # Desenvolvimento com hot reload
npm run build        # Build para produção
npm start            # Inicia servidor produção
npm test             # Executa testes
npm run lint         # ESLint
npm run create-indexes # Cria índices MongoDB
```

## RBAC - Controle de Acesso

| Role | Permissões |
|------|------------|
| `ADMIN` | Acesso total, gestão de usuários |
| `MANAGER` | CRUD todas entidades, relatórios |
| `SALES_REP` | CRUD próprios leads/oportunidades |
| `READ_ONLY` | Apenas leitura |

## Contato

**Bruno Paulon**
- GitHub: [@bfrpaulondev](https://github.com/bfrpaulondev)
- Email: bfrpaulondev@gmail.com

---

Desenvolvido por Bruno Paulon
