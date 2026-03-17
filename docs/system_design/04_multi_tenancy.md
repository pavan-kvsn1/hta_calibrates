# Multi-Tenancy Architecture

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Prerequisite**: [03_system_architecture.md](./03_system_architecture.md)

---

## Introduction

This document explains how HTA Calibration serves multiple calibration labs (tenants) from a single application while keeping their data completely isolated.

---

## Part 1: Understanding Multi-Tenancy

### What is a Tenant?

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WHAT IS A TENANT?                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  In our system:                                                             │
│                                                                             │
│  TENANT = A Calibration Laboratory                                          │
│                                                                             │
│  Examples:                                                                  │
│  • HTA Calibration Lab (tenant-hta)                                         │
│  • ABC Metrology Services (tenant-abc)                                      │
│  • XYZ Testing Laboratory (tenant-xyz)                                      │
│                                                                             │
│  Each tenant is a COMPLETELY SEPARATE business that:                        │
│  • Has their own employees (engineers, reviewers, admin)                    │
│  • Has their own customers                                                  │
│  • Creates their own calibration certificates                               │
│  • Has their own branding and settings                                      │
│  • Pays for their own subscription                                          │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  WHY MULTI-TENANCY?                                                         │
│  ═══════════════════                                                        │
│                                                                             │
│  Alternative 1: Separate Deployment Per Customer                            │
│  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                           │
│  │  HTA App    │ │  ABC App    │ │  XYZ App    │                           │
│  │  HTA DB     │ │  ABC DB     │ │  XYZ DB     │                           │
│  │  HTA Server │ │  ABC Server │ │  XYZ Server │                           │
│  └─────────────┘ └─────────────┘ └─────────────┘                           │
│  Cost: $$$$$     Cost: $$$$$     Cost: $$$$$                               │
│  Total: $$$$$$$$$$$$$$$ (very expensive!)                                  │
│                                                                             │
│  Alternative 2: Multi-Tenant (Our Choice)                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     SHARED APPLICATION                               │   │
│  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐       │   │
│  │  │   HTA   │ │   ABC   │ │   XYZ   │ │   DEF   │ │   ...   │       │   │
│  │  │  Data   │ │  Data   │ │  Data   │ │  Data   │ │         │       │   │
│  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘ └─────────┘       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│  Total Cost: $$$ (shared infrastructure!)                                  │
│                                                                             │
│  Benefits:                                                                  │
│  • Lower cost per customer                                                  │
│  • Easier maintenance (one codebase)                                        │
│  • Faster feature rollout (all customers get updates)                       │
│  • Better resource utilization                                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 2: User Roles Hierarchy

### System-Level vs Tenant-Level Roles

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           USER ROLES HIERARCHY                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   SYSTEM LEVEL                                                       │   │
│  │   ════════════                                                       │   │
│  │   ┌────────────────────────────────────────────────────────────┐    │   │
│  │   │                                                             │    │   │
│  │   │   DEV-ADMIN (Platform Operators)                            │    │   │
│  │   │   ═════════════════════════════                             │    │   │
│  │   │                                                             │    │   │
│  │   │   Who: HTA Calibration platform developers/operators        │    │   │
│  │   │                                                             │    │   │
│  │   │   Responsibilities:                                         │    │   │
│  │   │   • Deploy and maintain the application                     │    │   │
│  │   │   • Provision new tenants (onboard new labs)                │    │   │
│  │   │   • Monitor system health across ALL tenants                │    │   │
│  │   │   • Manage infrastructure (servers, databases)              │    │   │
│  │   │   • Handle system-wide configurations                       │    │   │
│  │   │   • Access production logs and metrics                      │    │   │
│  │   │   • Manage system secrets and credentials                   │    │   │
│  │   │                                                             │    │   │
│  │   │   Access:                                                   │    │   │
│  │   │   • GCP Console                                             │    │   │
│  │   │   • Kubernetes cluster                                      │    │   │
│  │   │   • Secret Manager                                          │    │   │
│  │   │   • Database (direct access if needed)                      │    │   │
│  │   │   • All tenant data (for support/debugging only)            │    │   │
│  │   │                                                             │    │   │
│  │   └─────────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  └──────────────────────────────────┬───────────────────────────────────┘   │
│                                     │                                       │
│  ═══════════════════════════════════╪═══════════════════════════════════   │
│                                     │                                       │
│  ┌──────────────────────────────────┴───────────────────────────────────┐   │
│  │                                                                      │   │
│  │   TENANT LEVEL (Per Lab)                                             │   │
│  │   ══════════════════════                                             │   │
│  │                                                                      │   │
│  │   ┌────────────────────────────────────────────────────────────┐    │   │
│  │   │                                                             │    │   │
│  │   │   LAB-ADMIN (Laboratory Administrator)                      │    │   │
│  │   │   ════════════════════════════════════                      │    │   │
│  │   │                                                             │    │   │
│  │   │   Who: Manager or owner of the calibration lab              │    │   │
│  │   │                                                             │    │   │
│  │   │   Responsibilities:                                         │    │   │
│  │   │   • Manage their lab's users (add/remove engineers)         │    │   │
│  │   │   • Configure lab settings (branding, templates)            │    │   │
│  │   │   • View all certificates in their lab                      │    │   │
│  │   │   • Generate reports for their lab                          │    │   │
│  │   │   • Manage their lab's customers                            │    │   │
│  │   │   • Authorize/override certificate actions                  │    │   │
│  │   │                                                             │    │   │
│  │   │   CANNOT:                                                   │    │   │
│  │   │   • See other labs' data                                    │    │   │
│  │   │   • Access infrastructure (servers, databases)              │    │   │
│  │   │   • Access system secrets                                   │    │   │
│  │   │   • Modify system configuration                             │    │   │
│  │   │                                                             │    │   │
│  │   └─────────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  │   ┌────────────────────────────────────────────────────────────┐    │   │
│  │   │                                                             │    │   │
│  │   │   ENGINEER (Calibration Engineer)                           │    │   │
│  │   │   ══════════════════════════════                            │    │   │
│  │   │                                                             │    │   │
│  │   │   • Creates calibration certificates                        │    │   │
│  │   │   • Edits their own certificates                            │    │   │
│  │   │   • Submits certificates for review                         │    │   │
│  │   │   • Responds to revision requests                           │    │   │
│  │   │                                                             │    │   │
│  │   └─────────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  │   ┌────────────────────────────────────────────────────────────┐    │   │
│  │   │                                                             │    │   │
│  │   │   REVIEWER (Peer Reviewer)                                  │    │   │
│  │   │   ════════════════════════                                  │    │   │
│  │   │                                                             │    │   │
│  │   │   • Reviews submitted certificates                          │    │   │
│  │   │   • Approves or requests revisions                          │    │   │
│  │   │   • Cannot create certificates                              │    │   │
│  │   │                                                             │    │   │
│  │   └─────────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  │   ┌────────────────────────────────────────────────────────────┐    │   │
│  │   │                                                             │    │   │
│  │   │   CUSTOMER (External Client)                                │    │   │
│  │   │   ══════════════════════════                                │    │   │
│  │   │                                                             │    │   │
│  │   │   • Views certificates issued to them                       │    │   │
│  │   │   • Provides feedback on certificates                       │    │   │
│  │   │   • Downloads PDF certificates                              │    │   │
│  │   │   • Belongs to ONLY ONE tenant                              │    │   │
│  │   │                                                             │    │   │
│  │   └─────────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  └──────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Data Isolation Strategies

### How We Keep Tenant Data Separate

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA ISOLATION STRATEGIES                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STRATEGY 1: Separate Databases (Maximum Isolation)                         │
│  ══════════════════════════════════════════════════                         │
│                                                                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                         │
│  │   HTA DB    │  │   ABC DB    │  │   XYZ DB    │                         │
│  │  (database) │  │  (database) │  │  (database) │                         │
│  └─────────────┘  └─────────────┘  └─────────────┘                         │
│                                                                             │
│  Pros: Complete isolation, easy to migrate/backup per tenant                │
│  Cons: Expensive, complex connection management                             │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  STRATEGY 2: Separate Schemas (Good Isolation)                              │
│  ═════════════════════════════════════════════                              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     SINGLE DATABASE                                  │   │
│  │  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                  │   │
│  │  │ schema_hta  │  │ schema_abc  │  │ schema_xyz  │                  │   │
│  │  │  • users    │  │  • users    │  │  • users    │                  │   │
│  │  │  • certs    │  │  • certs    │  │  • certs    │                  │   │
│  │  └─────────────┘  └─────────────┘  └─────────────┘                  │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Pros: Good isolation, moderate complexity                                  │
│  Cons: Schema management overhead                                           │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  STRATEGY 3: Shared Tables with tenant_id (Our Choice) ✅                   │
│  ══════════════════════════════════════════════════════                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                     SINGLE DATABASE                                  │   │
│  │                                                                      │   │
│  │   users table:                                                       │   │
│  │   ┌────────┬───────────┬──────────────┬──────────────┐              │   │
│  │   │   id   │ tenant_id │    name      │    email     │              │   │
│  │   ├────────┼───────────┼──────────────┼──────────────┤              │   │
│  │   │   1    │   hta     │ John Smith   │ john@hta.com │              │   │
│  │   │   2    │   hta     │ Jane Doe     │ jane@hta.com │              │   │
│  │   │   3    │   abc     │ Bob Wilson   │ bob@abc.com  │              │   │
│  │   │   4    │   xyz     │ Alice Brown  │ alice@xyz.com│              │   │
│  │   └────────┴───────────┴──────────────┴──────────────┘              │   │
│  │                                                                      │   │
│  │   Every query automatically filters by tenant_id!                    │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Pros: Simple, cost-effective, easy to query across tenants (for admins)   │
│  Cons: Must NEVER forget the tenant_id filter (see below for safety)       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 4: Database Design for Multi-Tenancy

### Schema Design

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE SCHEMA                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TENANT TABLE (Master Table)                                                │
│  ═══════════════════════════                                                │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │   tenants                                                              │ │
│  │   ────────                                                             │ │
│  │   id            VARCHAR(50)   PRIMARY KEY  -- "hta", "abc", "xyz"      │ │
│  │   name          VARCHAR(255)               -- "HTA Calibration Lab"    │ │
│  │   domain        VARCHAR(255)               -- "hta.calibr8s.com"       │ │
│  │   settings      JSONB                      -- tenant-specific config   │ │
│  │   status        VARCHAR(20)                -- "active", "suspended"    │ │
│  │   created_at    TIMESTAMP                                              │ │
│  │   updated_at    TIMESTAMP                                              │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  TENANT-SCOPED TABLES                                                       │
│  ════════════════════                                                       │
│  All these tables have tenant_id as a required column:                      │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │   users                                                                │ │
│  │   ─────                                                                │ │
│  │   id            UUID          PRIMARY KEY                              │ │
│  │   tenant_id     VARCHAR(50)   NOT NULL REFERENCES tenants(id)          │ │
│  │   email         VARCHAR(255)  NOT NULL                                 │ │
│  │   name          VARCHAR(255)                                           │ │
│  │   role          VARCHAR(20)   -- "LAB_ADMIN", "ENGINEER", "REVIEWER"   │ │
│  │   ...                                                                  │ │
│  │                                                                        │ │
│  │   UNIQUE(tenant_id, email)  -- Same email can exist in different labs  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │   certificates                                                         │ │
│  │   ────────────                                                         │ │
│  │   id                  UUID          PRIMARY KEY                        │ │
│  │   tenant_id           VARCHAR(50)   NOT NULL REFERENCES tenants(id)    │ │
│  │   certificate_number  VARCHAR(50)   NOT NULL                           │ │
│  │   status              VARCHAR(20)                                      │ │
│  │   created_by_id       UUID          REFERENCES users(id)               │ │
│  │   customer_id         UUID          REFERENCES customers(id)           │ │
│  │   ...                                                                  │ │
│  │                                                                        │ │
│  │   UNIQUE(tenant_id, certificate_number)  -- Numbers unique per tenant  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  ┌───────────────────────────────────────────────────────────────────────┐ │
│  │   customers                                                            │ │
│  │   ─────────                                                            │ │
│  │   id            UUID          PRIMARY KEY                              │ │
│  │   tenant_id     VARCHAR(50)   NOT NULL REFERENCES tenants(id)          │ │
│  │   company_name  VARCHAR(255)                                           │ │
│  │   ...                                                                  │ │
│  └───────────────────────────────────────────────────────────────────────┘ │
│                                                                             │
│  KEY POINT: tenant_id appears in EVERY table that contains tenant data!    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Row-Level Security (RLS) - Defense in Depth

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    ROW-LEVEL SECURITY (RLS)                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  WHAT IS RLS?                                                               │
│  ════════════                                                               │
│  Database-enforced security that automatically filters rows.                │
│  Even if application code has a bug, data leaks are prevented!              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   WITHOUT RLS (Dangerous!):                                          │   │
│  │   ─────────────────────────                                          │   │
│  │                                                                      │   │
│  │   -- Bug in code: forgot to filter by tenant!                        │   │
│  │   SELECT * FROM certificates;                                        │   │
│  │                                                                      │   │
│  │   Result: ALL certificates from ALL tenants! 😱                      │   │
│  │                                                                      │   │
│  │   ─────────────────────────────────────────────────────────────────  │   │
│  │                                                                      │   │
│  │   WITH RLS (Safe!):                                                  │   │
│  │   ────────────────                                                   │   │
│  │                                                                      │   │
│  │   -- Same buggy query                                                │   │
│  │   SELECT * FROM certificates;                                        │   │
│  │                                                                      │   │
│  │   -- Database automatically adds:                                    │   │
│  │   -- WHERE tenant_id = current_setting('app.tenant_id')              │   │
│  │                                                                      │   │
│  │   Result: Only certificates from current tenant! ✅                  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  IMPLEMENTING RLS IN POSTGRESQL:                                            │
│  ════════════════════════════════                                           │
│                                                                             │
│  -- Step 1: Enable RLS on the table                                         │
│  ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;                        │
│                                                                             │
│  -- Step 2: Create policy                                                   │
│  CREATE POLICY tenant_isolation ON certificates                             │
│    USING (tenant_id = current_setting('app.tenant_id')::text);              │
│                                                                             │
│  -- Step 3: Force RLS for all users (except superuser)                      │
│  ALTER TABLE certificates FORCE ROW LEVEL SECURITY;                         │
│                                                                             │
│  -- Step 4: In application, set tenant before queries                       │
│  SET app.tenant_id = 'hta';                                                 │
│  SELECT * FROM certificates;  -- Only shows HTA certificates               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 5: Application-Level Tenant Isolation

### Middleware Pattern

```typescript
┌─────────────────────────────────────────────────────────────────────────────┐
│                    APPLICATION-LEVEL ISOLATION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: Tenant Resolution Middleware                                       │
│  ════════════════════════════════════                                       │
│                                                                             │
│  // src/middleware/tenant.ts                                                │
│                                                                             │
│  export async function resolveTenant(req: NextRequest) {                    │
│    // Option 1: From subdomain                                              │
│    // hta.calibr8s.com → tenant = "hta"                                     │
│    const host = req.headers.get('host');                                    │
│    const subdomain = host?.split('.')[0];                                   │
│                                                                             │
│    // Option 2: From authenticated user's JWT                               │
│    const token = req.cookies.get('auth-token');                             │
│    const decoded = verifyJWT(token);                                        │
│    const tenantId = decoded.tenantId;                                       │
│                                                                             │
│    // Option 3: From API key header                                         │
│    const apiKey = req.headers.get('x-api-key');                             │
│    const tenant = await lookupTenantByApiKey(apiKey);                       │
│                                                                             │
│    // Set tenant in request context                                         │
│    req.tenantId = tenantId;                                                 │
│    return tenantId;                                                         │
│  }                                                                          │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  STEP 2: Database Query Wrapper                                             │
│  ══════════════════════════════                                             │
│                                                                             │
│  // src/lib/db/tenant-context.ts                                            │
│                                                                             │
│  import { prisma } from './prisma';                                         │
│                                                                             │
│  export function getTenantPrisma(tenantId: string) {                        │
│    // Return Prisma client with automatic tenant filtering                  │
│    return prisma.$extends({                                                 │
│      query: {                                                               │
│        $allModels: {                                                        │
│          async $allOperations({ model, operation, args, query }) {          │
│            // Skip tenant filter for system tables                          │
│            if (model === 'Tenant') return query(args);                      │
│                                                                             │
│            // For reads: add tenant filter                                  │
│            if (['findMany', 'findFirst', 'findUnique', 'count']             │
│                .includes(operation)) {                                      │
│              args.where = { ...args.where, tenantId };                      │
│            }                                                                │
│                                                                             │
│            // For writes: inject tenantId                                   │
│            if (['create', 'createMany'].includes(operation)) {              │
│              args.data = { ...args.data, tenantId };                        │
│            }                                                                │
│                                                                             │
│            return query(args);                                              │
│          }                                                                  │
│        }                                                                    │
│      }                                                                      │
│    });                                                                      │
│  }                                                                          │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  STEP 3: Usage in API Routes                                                │
│  ═══════════════════════════                                                │
│                                                                             │
│  // src/app/api/certificates/route.ts                                       │
│                                                                             │
│  export async function GET(req: NextRequest) {                              │
│    const session = await getSession(req);                                   │
│    const tenantId = session.user.tenantId;                                  │
│                                                                             │
│    // Get tenant-scoped database client                                     │
│    const db = getTenantPrisma(tenantId);                                    │
│                                                                             │
│    // This query AUTOMATICALLY filters by tenant                            │
│    // Even if you forget, you can't see other tenants' data!                │
│    const certificates = await db.certificate.findMany();                    │
│                                                                             │
│    return Response.json(certificates);                                      │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 6: File Storage Isolation

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    FILE STORAGE ISOLATION                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Cloud Storage Structure:                                                   │
│  ═══════════════════════                                                    │
│                                                                             │
│  hta-calibration-files/                  (GCS Bucket)                       │
│  │                                                                          │
│  ├── tenants/                                                               │
│  │   ├── hta/                            (Tenant: HTA)                      │
│  │   │   ├── certificates/                                                  │
│  │   │   │   ├── CERT-2026-001.pdf                                          │
│  │   │   │   └── CERT-2026-002.pdf                                          │
│  │   │   ├── signatures/                                                    │
│  │   │   │   └── user-123-signature.png                                     │
│  │   │   └── uploads/                                                       │
│  │   │       └── evidence-456.jpg                                           │
│  │   │                                                                      │
│  │   ├── abc/                            (Tenant: ABC)                      │
│  │   │   ├── certificates/                                                  │
│  │   │   └── signatures/                                                    │
│  │   │                                                                      │
│  │   └── xyz/                            (Tenant: XYZ)                      │
│  │       └── ...                                                            │
│  │                                                                          │
│  └── system/                             (Shared resources)                 │
│      ├── templates/                                                         │
│      └── logos/                                                             │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ACCESS CONTROL:                                                            │
│  ═══════════════                                                            │
│                                                                             │
│  // Generate signed URL that only allows access to tenant's files           │
│                                                                             │
│  async function getSignedUrl(tenantId: string, filePath: string) {          │
│    const bucket = storage.bucket('hta-calibration-files');                  │
│    const fullPath = `tenants/${tenantId}/${filePath}`;                      │
│                                                                             │
│    // Verify the path starts with the tenant's folder                       │
│    if (!fullPath.startsWith(`tenants/${tenantId}/`)) {                      │
│      throw new Error('Access denied');                                      │
│    }                                                                        │
│                                                                             │
│    const [url] = await bucket                                               │
│      .file(fullPath)                                                        │
│      .getSignedUrl({                                                        │
│        action: 'read',                                                      │
│        expires: Date.now() + 15 * 60 * 1000 // 15 minutes                   │
│      });                                                                    │
│                                                                             │
│    return url;                                                              │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 7: Tenant-Specific Configuration

### Settings Per Tenant

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TENANT-SPECIFIC CONFIGURATION                             │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Each tenant can have their own:                                            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   BRANDING                                                           │   │
│  │   ════════                                                           │   │
│  │   • Company logo                                                     │   │
│  │   • Primary/secondary colors                                         │   │
│  │   • Certificate header/footer                                        │   │
│  │   • Email templates                                                  │   │
│  │                                                                      │   │
│  │   ─────────────────────────────────────────────────────────────────  │   │
│  │                                                                      │   │
│  │   WORKFLOW SETTINGS                                                  │   │
│  │   ═════════════════                                                  │   │
│  │   • Require reviewer approval? (Yes/No)                              │   │
│  │   • Require customer approval? (Yes/No)                              │   │
│  │   • Auto-generate certificate numbers?                               │   │
│  │   • Certificate number format (CERT-{YEAR}-{SEQ})                    │   │
│  │                                                                      │   │
│  │   ─────────────────────────────────────────────────────────────────  │   │
│  │                                                                      │   │
│  │   INTEGRATIONS                                                       │   │
│  │   ════════════                                                       │   │
│  │   • OpenSign API key (for digital signatures)                        │   │
│  │   • Custom SMTP server (for emails)                                  │   │
│  │   • Webhook URLs (for notifications)                                 │   │
│  │   • SSO configuration (SAML/OIDC)                                    │   │
│  │                                                                      │   │
│  │   ─────────────────────────────────────────────────────────────────  │   │
│  │                                                                      │   │
│  │   SUBSCRIPTION/LIMITS                                                │   │
│  │   ══════════════════                                                 │   │
│  │   • Plan tier (Free, Pro, Enterprise)                                │   │
│  │   • Max users                                                        │   │
│  │   • Max certificates per month                                       │   │
│  │   • Max storage                                                      │   │
│  │   • Feature flags                                                    │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  DATABASE REPRESENTATION:                                                   │
│  ═════════════════════════                                                  │
│                                                                             │
│  // tenants.settings (JSONB column)                                         │
│  {                                                                          │
│    "branding": {                                                            │
│      "logoUrl": "gs://bucket/tenants/hta/logo.png",                         │
│      "primaryColor": "#1e40af",                                             │
│      "companyName": "HTA Calibration Lab"                                   │
│    },                                                                       │
│    "workflow": {                                                            │
│      "requireReviewerApproval": true,                                       │
│      "requireCustomerApproval": true,                                       │
│      "certificateNumberFormat": "HTA-{YYYY}-{SEQ:5}"                        │
│    },                                                                       │
│    "limits": {                                                              │
│      "maxUsers": 50,                                                        │
│      "maxCertificatesPerMonth": 1000,                                       │
│      "maxStorageGB": 100                                                    │
│    },                                                                       │
│    "features": {                                                            │
│      "digitalSignatures": true,                                             │
│      "customerPortal": true,                                                │
│      "apiAccess": false                                                     │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 8: Tenant Provisioning

### Onboarding a New Lab

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TENANT PROVISIONING WORKFLOW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  When a new calibration lab signs up:                                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  STEP 1: Create Tenant Record                                        │   │
│  │  ─────────────────────────────                                       │   │
│  │  INSERT INTO tenants (id, name, domain, status)                      │   │
│  │  VALUES ('newlab', 'New Calibration Lab', 'newlab.calibr8s.com',     │   │
│  │          'provisioning');                                            │   │
│  │                                                                      │   │
│  │  ─────────────────────────────────────────────────────────────────   │   │
│  │                                                                      │   │
│  │  STEP 2: Create Storage Folders                                      │   │
│  │  ──────────────────────────────                                      │   │
│  │  gsutil mb gs://hta-calibration-files/tenants/newlab/                │   │
│  │  gsutil mb gs://hta-calibration-files/tenants/newlab/certificates/   │   │
│  │  gsutil mb gs://hta-calibration-files/tenants/newlab/signatures/     │   │
│  │                                                                      │   │
│  │  ─────────────────────────────────────────────────────────────────   │   │
│  │                                                                      │   │
│  │  STEP 3: Create Tenant Secrets                                       │   │
│  │  ─────────────────────────────                                       │   │
│  │  gcloud secrets create tenant-newlab-encryption-key                  │   │
│  │  gcloud secrets create tenant-newlab-webhook-secret                  │   │
│  │                                                                      │   │
│  │  ─────────────────────────────────────────────────────────────────   │   │
│  │                                                                      │   │
│  │  STEP 4: Create Initial Lab-Admin User                               │   │
│  │  ─────────────────────────────────────                               │   │
│  │  INSERT INTO users (tenant_id, email, role, status)                  │   │
│  │  VALUES ('newlab', 'admin@newlab.com', 'LAB_ADMIN',                  │   │
│  │          'pending_activation');                                      │   │
│  │                                                                      │   │
│  │  // Send activation email                                            │   │
│  │  sendActivationEmail('admin@newlab.com', activationToken);           │   │
│  │                                                                      │   │
│  │  ─────────────────────────────────────────────────────────────────   │   │
│  │                                                                      │   │
│  │  STEP 5: Configure DNS                                               │   │
│  │  ─────────────────────                                               │   │
│  │  // Add subdomain record                                             │   │
│  │  newlab.calibr8s.com → Load Balancer IP                              │   │
│  │                                                                      │   │
│  │  ─────────────────────────────────────────────────────────────────   │   │
│  │                                                                      │   │
│  │  STEP 6: Activate Tenant                                             │   │
│  │  ────────────────────────                                            │   │
│  │  UPDATE tenants SET status = 'active' WHERE id = 'newlab';           │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  This can be automated via Terraform or a provisioning script!             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KEY TAKEAWAYS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. TENANT = Calibration Lab                                                │
│     Each lab is a separate tenant with complete data isolation              │
│                                                                             │
│  2. TWO ADMIN LEVELS                                                        │
│     • Dev-Admin: Platform operators (system-wide access)                    │
│     • Lab-Admin: Tenant administrators (only their lab)                     │
│                                                                             │
│  3. TENANT ID EVERYWHERE                                                    │
│     Every table, every query, every file path includes tenant_id            │
│                                                                             │
│  4. DEFENSE IN DEPTH                                                        │
│     • Application-level filtering                                           │
│     • Database Row-Level Security (RLS)                                     │
│     • Storage path isolation                                                │
│                                                                             │
│  5. PER-TENANT CONFIGURATION                                                │
│     • Branding                                                              │
│     • Workflow settings                                                     │
│     • Integrations                                                          │
│     • Feature flags                                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

- [05. Database Architecture](./05_database_architecture.md) - Deep dive into schema design
- [13. Secrets Management](./13_secrets_management.md) - Per-tenant secrets handling
