# Database Architecture

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Prerequisite**: [04_multi_tenancy.md](./04_multi_tenancy.md)

---

## Introduction

This document explains how HTA Calibration structures and manages its database. We use PostgreSQL on Google Cloud SQL with a multi-tenant schema design.

---

## Part 1: Why PostgreSQL?

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WHY POSTGRESQL?                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DATABASE OPTIONS:                                                          │
│  ═════════════════                                                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   MySQL/MariaDB     │  Good, but PostgreSQL has better features     │   │
│  │   MongoDB           │  Document store, harder for relational data   │   │
│  │   SQLite            │  Great for dev, not for production scale      │   │
│  │   PostgreSQL ✅     │  Best mix of features, reliability, scale     │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  WHY WE CHOSE POSTGRESQL:                                                   │
│  ═══════════════════════                                                    │
│                                                                             │
│  1. JSONB Support                                                           │
│     Store flexible data (settings, metadata) alongside structured data      │
│     Query JSON fields efficiently with indexes                              │
│                                                                             │
│  2. Row-Level Security (RLS)                                                │
│     Database-enforced tenant isolation                                      │
│     Extra protection against data leaks                                     │
│                                                                             │
│  3. Full-Text Search                                                        │
│     Search certificates by content without external service                 │
│                                                                             │
│  4. Excellent Prisma Support                                                │
│     Our ORM (Prisma) works great with PostgreSQL                            │
│                                                                             │
│  5. Cloud SQL Managed Service                                               │
│     Google manages backups, patches, high availability                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Database Schema Overview

### Entity Relationship Diagram

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ENTITY RELATIONSHIPS                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   ┌───────────┐                                                      │   │
│  │   │  TENANT   │ ◄─────────── All tables reference tenant            │   │
│  │   │───────────│                                                      │   │
│  │   │ id        │                                                      │   │
│  │   │ name      │                                                      │   │
│  │   │ settings  │                                                      │   │
│  │   └─────┬─────┘                                                      │   │
│  │         │                                                            │   │
│  │         │ has many                                                   │   │
│  │         ▼                                                            │   │
│  │   ┌───────────┐         ┌───────────────┐         ┌───────────┐     │   │
│  │   │   USER    │         │  CERTIFICATE  │         │ CUSTOMER  │     │   │
│  │   │───────────│         │───────────────│         │───────────│     │   │
│  │   │ id        │◄────────│ createdById   │         │ id        │     │   │
│  │   │ tenantId  │         │ reviewerId    │────────▶│ tenantId  │     │   │
│  │   │ email     │         │ customerId    │─────────│ name      │     │   │
│  │   │ role      │         │ tenantId      │         │ company   │     │   │
│  │   │ name      │         │ number        │         └───────────┘     │   │
│  │   └───────────┘         │ status        │                           │   │
│  │                         │ data (JSONB)  │                           │   │
│  │                         └───────┬───────┘                           │   │
│  │                                 │                                    │   │
│  │                    ┌────────────┼────────────┐                      │   │
│  │                    │            │            │                       │   │
│  │                    ▼            ▼            ▼                       │   │
│  │            ┌───────────┐ ┌───────────┐ ┌───────────┐                │   │
│  │            │  EVENT    │ │ FEEDBACK  │ │ PARAMETER │                │   │
│  │            │───────────│ │───────────│ │───────────│                │   │
│  │            │ id        │ │ id        │ │ id        │                │   │
│  │            │ certId    │ │ certId    │ │ certId    │                │   │
│  │            │ eventType │ │ type      │ │ name      │                │   │
│  │            │ userId    │ │ content   │ │ value     │                │   │
│  │            │ data      │ │ userId    │ │ unit      │                │   │
│  │            └───────────┘ └───────────┘ └───────────┘                │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Core Tables

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CORE TABLES                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TENANTS                                                                    │
│  ═══════                                                                    │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  id          VARCHAR(50)   PRIMARY KEY   -- "hta", "abc"           │    │
│  │  name        VARCHAR(255)                -- "HTA Calibration Lab"  │    │
│  │  domain      VARCHAR(255)                -- "hta.calibr8s.com"     │    │
│  │  settings    JSONB                       -- branding, workflow     │    │
│  │  status      VARCHAR(20)   DEFAULT 'active'                        │    │
│  │  createdAt   TIMESTAMP     DEFAULT NOW()                           │    │
│  │  updatedAt   TIMESTAMP                                             │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  USERS                                                                      │
│  ═════                                                                      │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  id              UUID        PRIMARY KEY DEFAULT uuid_generate_v4()│    │
│  │  tenantId        VARCHAR(50) NOT NULL REFERENCES tenants(id)       │    │
│  │  email           VARCHAR(255) NOT NULL                             │    │
│  │  passwordHash    VARCHAR(255)          -- bcrypt hashed            │    │
│  │  name            VARCHAR(255)                                      │    │
│  │  role            VARCHAR(20)  NOT NULL -- LAB_ADMIN, ENGINEER, etc │    │
│  │  status          VARCHAR(20)  DEFAULT 'active'                     │    │
│  │  signatureUrl    VARCHAR(500)          -- path to signature image  │    │
│  │  createdAt       TIMESTAMP    DEFAULT NOW()                        │    │
│  │  updatedAt       TIMESTAMP                                         │    │
│  │                                                                    │    │
│  │  UNIQUE(tenantId, email)  -- Same email can exist in different labs│    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  CUSTOMERS                                                                  │
│  ═════════                                                                  │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  id              UUID        PRIMARY KEY                           │    │
│  │  tenantId        VARCHAR(50) NOT NULL REFERENCES tenants(id)       │    │
│  │  companyName     VARCHAR(255) NOT NULL                             │    │
│  │  contactName     VARCHAR(255)                                      │    │
│  │  email           VARCHAR(255)                                      │    │
│  │  phone           VARCHAR(50)                                       │    │
│  │  address         TEXT                                              │    │
│  │  createdAt       TIMESTAMP    DEFAULT NOW()                        │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  CERTIFICATES                                                               │
│  ════════════                                                               │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  id                  UUID        PRIMARY KEY                       │    │
│  │  tenantId            VARCHAR(50) NOT NULL REFERENCES tenants(id)   │    │
│  │  certificateNumber   VARCHAR(50) NOT NULL                          │    │
│  │  status              VARCHAR(30) NOT NULL                          │    │
│  │  createdById         UUID        REFERENCES users(id)              │    │
│  │  reviewerId          UUID        REFERENCES users(id)              │    │
│  │  customerId          UUID        REFERENCES customers(id)          │    │
│  │                                                                    │    │
│  │  -- Instrument details                                             │    │
│  │  instrumentName      VARCHAR(255)                                  │    │
│  │  manufacturer        VARCHAR(255)                                  │    │
│  │  model               VARCHAR(255)                                  │    │
│  │  serialNumber        VARCHAR(100)                                  │    │
│  │                                                                    │    │
│  │  -- Calibration data                                               │    │
│  │  calibrationDate     DATE                                          │    │
│  │  dueDate             DATE                                          │    │
│  │  temperature         DECIMAL(5,2)                                  │    │
│  │  humidity            DECIMAL(5,2)                                  │    │
│  │                                                                    │    │
│  │  -- Flexible data storage                                          │    │
│  │  data                JSONB       -- additional fields              │    │
│  │                                                                    │    │
│  │  createdAt           TIMESTAMP   DEFAULT NOW()                     │    │
│  │  updatedAt           TIMESTAMP                                     │    │
│  │  submittedAt         TIMESTAMP                                     │    │
│  │  approvedAt          TIMESTAMP                                     │    │
│  │  authorizedAt        TIMESTAMP                                     │    │
│  │                                                                    │    │
│  │  UNIQUE(tenantId, certificateNumber)                               │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Supporting Tables

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           SUPPORTING TABLES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CERTIFICATE_EVENTS (Audit Trail)                                           │
│  ═════════════════════════════════                                          │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  id              UUID        PRIMARY KEY                           │    │
│  │  tenantId        VARCHAR(50) NOT NULL                              │    │
│  │  certificateId   UUID        NOT NULL REFERENCES certificates(id)  │    │
│  │  eventType       VARCHAR(50) NOT NULL  -- CREATED, SUBMITTED, etc  │    │
│  │  userId          UUID        REFERENCES users(id)                  │    │
│  │  data            JSONB                 -- event-specific data      │    │
│  │  createdAt       TIMESTAMP   DEFAULT NOW()                         │    │
│  │                                                                    │    │
│  │  INDEX(certificateId, createdAt)  -- Fast event history lookup     │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  FEEDBACKS                                                                  │
│  ═════════                                                                  │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  id              UUID        PRIMARY KEY                           │    │
│  │  tenantId        VARCHAR(50) NOT NULL                              │    │
│  │  certificateId   UUID        NOT NULL REFERENCES certificates(id)  │    │
│  │  feedbackType    VARCHAR(30) NOT NULL  -- REVISION_REQUEST, COMMENT│    │
│  │  section         VARCHAR(50)           -- which part of certificate│    │
│  │  content         TEXT        NOT NULL                              │    │
│  │  userId          UUID        REFERENCES users(id)                  │    │
│  │  status          VARCHAR(20) DEFAULT 'open'                        │    │
│  │  createdAt       TIMESTAMP   DEFAULT NOW()                         │    │
│  │  resolvedAt      TIMESTAMP                                         │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  CALIBRATION_PARAMETERS                                                     │
│  ══════════════════════                                                     │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  id              UUID        PRIMARY KEY                           │    │
│  │  certificateId   UUID        NOT NULL REFERENCES certificates(id)  │    │
│  │  parameterName   VARCHAR(255) NOT NULL                             │    │
│  │  nominalValue    VARCHAR(100)                                      │    │
│  │  measuredValue   VARCHAR(100)                                      │    │
│  │  unit            VARCHAR(50)                                       │    │
│  │  uncertainty     VARCHAR(100)                                      │    │
│  │  tolerance       VARCHAR(100)                                      │    │
│  │  pass            BOOLEAN                                           │    │
│  │  sortOrder       INTEGER     DEFAULT 0                             │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  WEBHOOKS (Per-Tenant Configuration)                                        │
│  ═══════════════════════════════════                                        │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  id              UUID        PRIMARY KEY                           │    │
│  │  tenantId        VARCHAR(50) NOT NULL REFERENCES tenants(id)       │    │
│  │  name            VARCHAR(255) NOT NULL                             │    │
│  │  url             VARCHAR(500) NOT NULL                             │    │
│  │  secret          VARCHAR(255)          -- for signature            │    │
│  │  events          VARCHAR[]   NOT NULL  -- array of event types     │    │
│  │  status          VARCHAR(20) DEFAULT 'active'                      │    │
│  │  createdAt       TIMESTAMP   DEFAULT NOW()                         │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Indexes for Performance

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE INDEXES                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  WHAT ARE INDEXES?                                                          │
│  ═════════════════                                                          │
│                                                                             │
│  Think of a book index - instead of reading every page to find "Kubernetes"│
│  you look it up in the index and go directly to page 245.                  │
│                                                                             │
│  WITHOUT INDEX:                      WITH INDEX:                            │
│  ══════════════                      ═══════════                            │
│  SELECT * FROM certificates          SELECT * FROM certificates            │
│  WHERE tenantId = 'hta'              WHERE tenantId = 'hta'                │
│  AND status = 'PENDING';             AND status = 'PENDING';               │
│                                                                             │
│  Scans ALL 1,000,000 rows            Directly finds 50 matching rows        │
│  Time: 5000ms 😱                     Time: 5ms ✅                           │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  KEY INDEXES FOR HTA CALIBRATION:                                           │
│  ════════════════════════════════                                           │
│                                                                             │
│  -- Tenant-based queries (MOST IMPORTANT!)                                  │
│  CREATE INDEX idx_certificates_tenant_status                                │
│    ON certificates(tenantId, status);                                       │
│                                                                             │
│  CREATE INDEX idx_certificates_tenant_created                               │
│    ON certificates(tenantId, createdAt DESC);                               │
│                                                                             │
│  CREATE INDEX idx_users_tenant_email                                        │
│    ON users(tenantId, email);                                               │
│                                                                             │
│  -- Foreign key lookups                                                     │
│  CREATE INDEX idx_certificates_customer                                     │
│    ON certificates(customerId);                                             │
│                                                                             │
│  CREATE INDEX idx_certificates_creator                                      │
│    ON certificates(createdById);                                            │
│                                                                             │
│  CREATE INDEX idx_certificates_reviewer                                     │
│    ON certificates(reviewerId);                                             │
│                                                                             │
│  -- Event history                                                           │
│  CREATE INDEX idx_events_certificate_time                                   │
│    ON certificate_events(certificateId, createdAt DESC);                    │
│                                                                             │
│  -- Feedback lookup                                                         │
│  CREATE INDEX idx_feedbacks_certificate                                     │
│    ON feedbacks(certificateId, createdAt DESC);                             │
│                                                                             │
│  -- Certificate number search                                               │
│  CREATE INDEX idx_certificates_number                                       │
│    ON certificates(tenantId, certificateNumber);                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 4: Cloud SQL Configuration

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           CLOUD SQL SETUP                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INSTANCE CONFIGURATION:                                                    │
│  ═══════════════════════                                                    │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   Production Instance                                                │   │
│  │   ────────────────────                                               │   │
│  │   Name:       hta-calibration-prod                                   │   │
│  │   Region:     asia-southeast1 (Singapore)                            │   │
│  │   Type:       db-custom-4-16384 (4 vCPU, 16GB RAM)                   │   │
│  │   Storage:    100GB SSD (auto-increase enabled)                      │   │
│  │   Version:    PostgreSQL 15                                          │   │
│  │                                                                      │   │
│  │   HIGH AVAILABILITY:                                                 │   │
│  │   ├── Primary: asia-southeast1-a                                     │   │
│  │   └── Standby: asia-southeast1-b (automatic failover)                │   │
│  │                                                                      │   │
│  │   BACKUPS:                                                           │   │
│  │   ├── Automated: Daily at 3 AM SGT                                   │   │
│  │   ├── Retention: 30 days                                             │   │
│  │   └── Point-in-time recovery: Enabled (7 days)                       │   │
│  │                                                                      │   │
│  │   SECURITY:                                                          │   │
│  │   ├── Private IP only (no public access)                             │   │
│  │   ├── SSL required for connections                                   │   │
│  │   └── Cloud SQL Auth Proxy for GKE                                   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  CONNECTION FROM GKE:                                                       │
│  ════════════════════                                                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   ┌─────────────┐     ┌─────────────────┐     ┌─────────────┐       │   │
│  │   │   HTA App   │     │   Cloud SQL     │     │  Cloud SQL  │       │   │
│  │   │    Pod      │────▶│   Auth Proxy    │────▶│  Instance   │       │   │
│  │   │             │     │   (sidecar)     │     │             │       │   │
│  │   └─────────────┘     └─────────────────┘     └─────────────┘       │   │
│  │                                                                      │   │
│  │   The Auth Proxy:                                                    │   │
│  │   • Handles SSL certificates automatically                           │   │
│  │   • Uses IAM for authentication                                      │   │
│  │   • No need to manage database passwords in code                     │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 5: Prisma ORM

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PRISMA ORM                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  WHAT IS AN ORM?                                                            │
│  ═══════════════                                                            │
│                                                                             │
│  ORM = Object-Relational Mapping                                            │
│  Translates between database tables and JavaScript objects                  │
│                                                                             │
│  WITHOUT ORM:                           WITH PRISMA:                        │
│  ───────────                            ───────────                         │
│  const result = await db.query(         const cert = await prisma          │
│    `SELECT * FROM certificates            .certificate.findUnique({        │
│     WHERE id = $1                           where: { id: certId }           │
│     AND tenant_id = $2`,                  });                               │
│    [certId, tenantId]                                                       │
│  );                                     // Type-safe! IDE autocomplete!     │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  PRISMA SCHEMA (prisma/schema.prisma):                                      │
│  ══════════════════════════════════════                                     │
│                                                                             │
│  model Tenant {                                                             │
│    id        String   @id                                                   │
│    name      String                                                         │
│    domain    String?                                                        │
│    settings  Json?                                                          │
│    status    String   @default("active")                                    │
│    createdAt DateTime @default(now())                                       │
│    updatedAt DateTime @updatedAt                                            │
│                                                                             │
│    users        User[]                                                      │
│    customers    Customer[]                                                  │
│    certificates Certificate[]                                               │
│  }                                                                          │
│                                                                             │
│  model User {                                                               │
│    id           String   @id @default(uuid())                               │
│    tenantId     String                                                      │
│    email        String                                                      │
│    passwordHash String?                                                     │
│    name         String?                                                     │
│    role         String                                                      │
│    status       String   @default("active")                                 │
│    createdAt    DateTime @default(now())                                    │
│    updatedAt    DateTime @updatedAt                                         │
│                                                                             │
│    tenant              Tenant        @relation(fields: [tenantId])          │
│    createdCertificates Certificate[] @relation("CreatedBy")                 │
│    reviewedCertificates Certificate[] @relation("ReviewedBy")               │
│                                                                             │
│    @@unique([tenantId, email])                                              │
│    @@index([tenantId, role])                                                │
│  }                                                                          │
│                                                                             │
│  model Certificate {                                                        │
│    id                String   @id @default(uuid())                          │
│    tenantId          String                                                 │
│    certificateNumber String                                                 │
│    status            String                                                 │
│    // ... other fields                                                      │
│                                                                             │
│    tenant    Tenant    @relation(fields: [tenantId])                        │
│    createdBy User      @relation("CreatedBy", fields: [createdById])        │
│    reviewer  User?     @relation("ReviewedBy", fields: [reviewerId])        │
│    customer  Customer? @relation(fields: [customerId])                      │
│    events    CertificateEvent[]                                             │
│    feedbacks Feedback[]                                                     │
│                                                                             │
│    @@unique([tenantId, certificateNumber])                                  │
│    @@index([tenantId, status])                                              │
│    @@index([tenantId, createdAt])                                           │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 6: Query Patterns

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COMMON QUERY PATTERNS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ALWAYS FILTER BY TENANT!                                                   │
│  ═══════════════════════                                                    │
│                                                                             │
│  // ✅ CORRECT: Always include tenantId                                     │
│  const certificates = await prisma.certificate.findMany({                   │
│    where: {                                                                 │
│      tenantId: session.user.tenantId,  // NEVER forget this!                │
│      status: 'PENDING_REVIEW',                                              │
│    },                                                                       │
│    include: {                                                               │
│      createdBy: { select: { name: true, email: true } },                    │
│      customer: { select: { companyName: true } },                           │
│    },                                                                       │
│    orderBy: { createdAt: 'desc' },                                          │
│    take: 20,                                                                │
│  });                                                                        │
│                                                                             │
│  // ❌ WRONG: Missing tenantId filter - SECURITY BUG!                       │
│  const certificates = await prisma.certificate.findMany({                   │
│    where: { status: 'PENDING_REVIEW' },  // Returns ALL tenants' data!      │
│  });                                                                        │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  PAGINATION:                                                                │
│  ═══════════                                                                │
│                                                                             │
│  // Cursor-based pagination (recommended for large datasets)                │
│  const certificates = await prisma.certificate.findMany({                   │
│    where: { tenantId },                                                     │
│    take: 20,                                                                │
│    skip: 1,  // Skip the cursor itself                                      │
│    cursor: { id: lastSeenId },                                              │
│    orderBy: { createdAt: 'desc' },                                          │
│  });                                                                        │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  TRANSACTIONS:                                                              │
│  ═════════════                                                              │
│                                                                             │
│  // When multiple operations must succeed together                          │
│  await prisma.$transaction(async (tx) => {                                  │
│    // Update certificate status                                             │
│    const cert = await tx.certificate.update({                               │
│      where: { id: certId },                                                 │
│      data: { status: 'APPROVED', approvedAt: new Date() },                  │
│    });                                                                      │
│                                                                             │
│    // Create event record                                                   │
│    await tx.certificateEvent.create({                                       │
│      data: {                                                                │
│        certificateId: certId,                                               │
│        tenantId: cert.tenantId,                                             │
│        eventType: 'APPROVED',                                               │
│        userId: reviewerId,                                                  │
│      },                                                                     │
│    });                                                                      │
│                                                                             │
│    // Both succeed or both fail - no partial updates!                       │
│  });                                                                        │
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
│  1. POSTGRESQL ON CLOUD SQL                                                 │
│     Managed, high-availability, automatic backups                           │
│                                                                             │
│  2. TENANT_ID ON EVERY TABLE                                                │
│     Essential for multi-tenancy isolation                                   │
│                                                                             │
│  3. INDEXES ARE CRITICAL                                                    │
│     Always index tenantId + frequently filtered columns                     │
│                                                                             │
│  4. PRISMA FOR TYPE SAFETY                                                  │
│     Autocomplete, type checking, migrations                                 │
│                                                                             │
│  5. ALWAYS FILTER BY TENANT                                                 │
│     Use tenant-scoped database client or middleware                         │
│                                                                             │
│  6. USE TRANSACTIONS                                                        │
│     For operations that must succeed together                               │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

- [06. GCP Fundamentals](./06_gcp_fundamentals.md) - Understanding Google Cloud
- [16. Disaster Recovery](./16_disaster_recovery.md) - Backup and recovery strategies
