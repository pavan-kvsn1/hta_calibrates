# Multi-Tenancy Architecture (Future)

## Current State

The current database design is **single-tenant**:
- One HTA organization
- Multiple customer companies (but they're customers, not tenants)
- All data in shared tables

```
┌─────────────────────────────────────────────────────────────────┐
│                      CURRENT: SINGLE-TENANT                      │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                    HTA Organization                      │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │    │
│  │  │ Users   │  │Customers│  │  Certs  │  │Instrmts │    │    │
│  │  │ (staff) │  │(clients)│  │         │  │         │    │    │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Single database, single application instance                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Why Multi-Tenancy?

Future scenarios that would require multi-tenancy:

1. **Franchise Model**: HTA licenses the software to other calibration labs
2. **White-Label**: Other companies run their own branded version
3. **Regional Expansion**: Separate data for different countries (compliance)
4. **Enterprise Customers**: Large customers want isolated environments

---

## Multi-Tenancy Patterns

### Pattern 1: Database Per Tenant

```
┌─────────────────────────────────────────────────────────────────┐
│                  DATABASE PER TENANT                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐          │
│  │   Tenant A   │  │   Tenant B   │  │   Tenant C   │          │
│  │   Database   │  │   Database   │  │   Database   │          │
│  │              │  │              │  │              │          │
│  │ - Users      │  │ - Users      │  │ - Users      │          │
│  │ - Certs      │  │ - Certs      │  │ - Certs      │          │
│  │ - Instrmts   │  │ - Instrmts   │  │ - Instrmts   │          │
│  └──────────────┘  └──────────────┘  └──────────────┘          │
│                                                                  │
│  Pros: Complete isolation, easy compliance, easy backup         │
│  Cons: More infrastructure, harder to manage, higher cost       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation**:
```typescript
// Tenant database URLs stored in a master database or config
const TENANT_DATABASES = {
  'tenant-a': 'postgresql://...:5432/hta_tenant_a',
  'tenant-b': 'postgresql://...:5432/hta_tenant_b',
  'tenant-c': 'postgresql://...:5432/hta_tenant_c',
}

// Get Prisma client for specific tenant
function getPrismaForTenant(tenantId: string): PrismaClient {
  const url = TENANT_DATABASES[tenantId]
  if (!url) throw new Error(`Unknown tenant: ${tenantId}`)

  const adapter = new PrismaPg({ connectionString: url })
  return new PrismaClient({ adapter })
}

// Usage in API route
export async function GET(request: NextRequest) {
  const tenantId = request.headers.get('x-tenant-id')
  const prisma = getPrismaForTenant(tenantId)

  const certificates = await prisma.certificate.findMany()
  return NextResponse.json(certificates)
}
```

---

### Pattern 2: Schema Per Tenant (PostgreSQL)

```
┌─────────────────────────────────────────────────────────────────┐
│                  SCHEMA PER TENANT                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Single PostgreSQL Database                   │   │
│  │  ┌────────────┐  ┌────────────┐  ┌────────────┐         │   │
│  │  │ Schema:    │  │ Schema:    │  │ Schema:    │         │   │
│  │  │ tenant_a   │  │ tenant_b   │  │ tenant_c   │         │   │
│  │  │            │  │            │  │            │         │   │
│  │  │ - Users    │  │ - Users    │  │ - Users    │         │   │
│  │  │ - Certs    │  │ - Certs    │  │ - Certs    │         │   │
│  │  └────────────┘  └────────────┘  └────────────┘         │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Pros: Good isolation, single DB, easier backups                │
│  Cons: PostgreSQL only, schema management complexity            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Implementation**:
```typescript
// Set schema per request
async function setTenantSchema(prisma: PrismaClient, tenantId: string) {
  await prisma.$executeRawUnsafe(`SET search_path TO tenant_${tenantId}`)
}

// Or use connection URL with schema
function getDatabaseUrl(tenantId: string): string {
  return `postgresql://...:5432/hta?schema=tenant_${tenantId}`
}
```

---

### Pattern 3: Row-Level Security (Recommended for HTA)

```
┌─────────────────────────────────────────────────────────────────┐
│                  ROW-LEVEL MULTI-TENANCY                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Single Database, Shared Tables               │   │
│  │                                                           │   │
│  │  ┌─────────────────────────────────────────────────────┐ │   │
│  │  │ Users Table                                          │ │   │
│  │  │ ┌────────┬─────────────┬───────────────────────────┐│ │   │
│  │  │ │tenantId│ id          │ email                     ││ │   │
│  │  │ ├────────┼─────────────┼───────────────────────────┤│ │   │
│  │  │ │ A      │ user-1      │ admin@tenant-a.com        ││ │   │
│  │  │ │ A      │ user-2      │ eng@tenant-a.com          ││ │   │
│  │  │ │ B      │ user-3      │ admin@tenant-b.com        ││ │   │
│  │  │ └────────┴─────────────┴───────────────────────────┘│ │   │
│  │  └─────────────────────────────────────────────────────┘ │   │
│  │                                                           │   │
│  │  Every query automatically filtered by tenantId          │   │
│  │                                                           │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  Pros: Single codebase, efficient, easy to scale                │
│  Cons: Risk of data leak if filter forgotten, harder debugging  │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Migration Plan: Current → Row-Level Multi-Tenancy

### Phase 1: Add Tenant Column

```prisma
// prisma/schema.prisma

model Tenant {
  id        String   @id @default(uuid())
  name      String   @unique
  slug      String   @unique  // URL-friendly identifier
  isActive  Boolean  @default(true)
  createdAt DateTime @default(now())

  // Relations
  users         User[]
  certificates  Certificate[]
  instruments   MasterInstrument[]
  // ... all other models
}

model User {
  id       String @id @default(uuid())
  tenantId String  // NEW: Add to existing model
  tenant   Tenant  @relation(fields: [tenantId], references: [id])

  // ... existing fields

  @@index([tenantId])  // Important for query performance
}

model Certificate {
  id       String @id @default(uuid())
  tenantId String  // NEW
  tenant   Tenant  @relation(fields: [tenantId], references: [id])

  // ... existing fields

  @@index([tenantId])
}

// Add tenantId to ALL models that should be tenant-scoped
```

### Phase 2: Migration Script

```typescript
// scripts/migrate-to-multi-tenant.ts
import { prisma } from '../src/lib/prisma'

async function main() {
  // 1. Create default tenant for existing data
  const defaultTenant = await prisma.tenant.create({
    data: {
      name: 'HTA Instrumentation',
      slug: 'hta',
    },
  })

  // 2. Update all existing records
  await prisma.$transaction([
    prisma.user.updateMany({
      where: { tenantId: null },
      data: { tenantId: defaultTenant.id },
    }),
    prisma.certificate.updateMany({
      where: { tenantId: null },
      data: { tenantId: defaultTenant.id },
    }),
    // ... all other models
  ])

  // 3. Make tenantId required (second migration)
  // ALTER TABLE "User" ALTER COLUMN "tenantId" SET NOT NULL;
}
```

### Phase 3: Prisma Client Extension for Tenant Filtering

```typescript
// src/lib/prisma-tenant.ts
import { PrismaClient } from '@prisma/client'

export function createTenantPrisma(basePrisma: PrismaClient, tenantId: string) {
  return basePrisma.$extends({
    query: {
      $allModels: {
        async findMany({ args, query }) {
          args.where = { ...args.where, tenantId }
          return query(args)
        },
        async findFirst({ args, query }) {
          args.where = { ...args.where, tenantId }
          return query(args)
        },
        async findUnique({ args, query }) {
          // For unique queries, verify tenant after fetch
          const result = await query(args)
          if (result && result.tenantId !== tenantId) {
            return null  // Belongs to different tenant
          }
          return result
        },
        async create({ args, query }) {
          args.data = { ...args.data, tenantId }
          return query(args)
        },
        async update({ args, query }) {
          // Verify tenant before update
          args.where = { ...args.where, tenantId }
          return query(args)
        },
        async delete({ args, query }) {
          args.where = { ...args.where, tenantId }
          return query(args)
        },
      },
    },
  })
}

// Usage
const tenantPrisma = createTenantPrisma(prisma, 'tenant-abc')
const certs = await tenantPrisma.certificate.findMany()  // Auto-filtered
```

### Phase 4: Tenant Resolution Middleware

```typescript
// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  // Resolve tenant from subdomain, header, or path

  // Option 1: Subdomain (tenant-a.htacalibration.com)
  const host = request.headers.get('host') || ''
  const subdomain = host.split('.')[0]

  // Option 2: Header (X-Tenant-ID)
  const headerTenant = request.headers.get('x-tenant-id')

  // Option 3: Path (/tenant-a/dashboard)
  const pathTenant = request.nextUrl.pathname.split('/')[1]

  const tenantId = headerTenant || subdomain || pathTenant

  // Add to request headers for downstream use
  const response = NextResponse.next()
  response.headers.set('x-resolved-tenant', tenantId)

  return response
}
```

### Phase 5: Tenant Context Provider

```typescript
// src/lib/tenant-context.ts
import { createContext, useContext } from 'react'

interface TenantContext {
  tenantId: string
  tenantName: string
  tenantSlug: string
}

const TenantContext = createContext<TenantContext | null>(null)

export function TenantProvider({ tenant, children }) {
  return (
    <TenantContext.Provider value={tenant}>
      {children}
    </TenantContext.Provider>
  )
}

export function useTenant() {
  const context = useContext(TenantContext)
  if (!context) throw new Error('useTenant must be used within TenantProvider')
  return context
}
```

---

## Security Considerations

### Data Isolation Verification

```typescript
// tests/multi-tenant-security.test.ts
describe('Multi-tenant security', () => {
  it('cannot access data from other tenant', async () => {
    // Create data for tenant A
    const tenantAPrisma = createTenantPrisma(prisma, 'tenant-a')
    const cert = await tenantAPrisma.certificate.create({
      data: { certificateNumber: 'A-001', /* ... */ },
    })

    // Try to access from tenant B
    const tenantBPrisma = createTenantPrisma(prisma, 'tenant-b')
    const found = await tenantBPrisma.certificate.findUnique({
      where: { id: cert.id },
    })

    expect(found).toBeNull()  // Should not be accessible
  })

  it('cannot update data from other tenant', async () => {
    const tenantAPrisma = createTenantPrisma(prisma, 'tenant-a')
    const cert = await tenantAPrisma.certificate.create({
      data: { certificateNumber: 'A-002', /* ... */ },
    })

    const tenantBPrisma = createTenantPrisma(prisma, 'tenant-b')

    await expect(
      tenantBPrisma.certificate.update({
        where: { id: cert.id },
        data: { customerName: 'Hacked' },
      })
    ).rejects.toThrow()  // Should fail
  })
})
```

### PostgreSQL Row-Level Security (Additional Layer)

```sql
-- Enable RLS on tables
ALTER TABLE "Certificate" ENABLE ROW LEVEL SECURITY;

-- Create policy
CREATE POLICY tenant_isolation ON "Certificate"
  USING ("tenantId" = current_setting('app.tenant_id')::uuid);

-- Set tenant before queries (in application)
SET app.tenant_id = 'tenant-uuid';
SELECT * FROM "Certificate";  -- Automatically filtered
```

---

## Performance Considerations

### Indexes for Multi-Tenancy

```prisma
model Certificate {
  tenantId String
  // ...

  // Single-column index for tenant filtering
  @@index([tenantId])

  // Composite indexes for common queries
  @@index([tenantId, status])
  @@index([tenantId, createdAt])
  @@index([tenantId, createdById])
}
```

### Query Patterns

```typescript
// GOOD: Tenant filter first, then other conditions
const certs = await prisma.certificate.findMany({
  where: {
    tenantId: 'tenant-a',  // First
    status: 'DRAFT',
    createdAt: { gte: lastWeek },
  },
})

// BAD: Non-indexed column first
const certs = await prisma.certificate.findMany({
  where: {
    customerName: { contains: 'Test' },  // Full table scan
    tenantId: 'tenant-a',
  },
})
```

---

## Timeline Estimate

| Phase | Effort | Risk |
|-------|--------|------|
| 1. Add tenant columns | 2 days | Low |
| 2. Migration script | 1 day | Medium |
| 3. Prisma extension | 3 days | Medium |
| 4. Middleware | 1 day | Low |
| 5. Testing | 3 days | High |
| 6. UI changes | 5 days | Medium |
| **Total** | ~15 days | |

---

## Decision Checklist

Before implementing multi-tenancy:

- [ ] Clear business requirement (who are the tenants?)
- [ ] Data isolation requirements (legal/compliance)
- [ ] Performance requirements (queries per tenant)
- [ ] Tenant management UI (create, suspend, delete)
- [ ] Billing model (per tenant pricing)
- [ ] Backup/restore per tenant capability
- [ ] Tenant-specific customization needs
- [ ] Migration plan for existing customers
