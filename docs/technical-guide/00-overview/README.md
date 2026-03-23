# 00 - System Overview

## Documentation Index

| File | Description | When to Read |
|------|-------------|--------------|
| [01-system-flows.md](./01-system-flows.md) | Complete system flows with Mermaid diagrams | Understanding full system |
| [02-environment-pipeline-strategy.md](./02-environment-pipeline-strategy.md) | CI/CD, testing, deployment across all environments | DevOps & deployment |
| README.md (this file) | Architecture decisions, structure | Getting started |

The **01-system-flows.md** file contains:
- All application workflows (certificate lifecycle, review, authorization)
- Authentication flows (staff login, customer login, session validation)
- Complete API reference (77 endpoints)
- All scripts and commands (npm, Docker, Kubernetes, Terraform)
- CI/CD pipeline details (GitHub Actions)
- Production deployment flows
- Service architecture diagrams

---

## What is HTA Calibration System?

A web application for managing calibration certificates for instrumentation equipment. It handles the complete lifecycle:

1. **Engineers** create calibration certificates with measurements
2. **Reviewers** (Admins) approve or request revisions
3. **Customers** view, approve, and download signed certificates
4. **System** generates PDFs with digital signatures

---

## Architecture Decisions

### 1. Monolithic over Microservices

**Decision**: Single Next.js application handling frontend + backend

**Rationale**:
- Small team (< 5 developers)
- Shared data model (certificates are the core entity)
- Simpler deployment and debugging
- Can split later if needed

**Trade-offs**:
- All-or-nothing deployments
- Single failure domain
- Harder to scale specific components

---

### 2. SQLite for Local, PostgreSQL for Production

**Decision**: Use Prisma driver adapters to support both databases

**Rationale**:
- Zero-setup local development (SQLite)
- Production-grade reliability (PostgreSQL)
- Same Prisma schema works for both

**Implementation**:
```typescript
// src/lib/prisma.ts
const isPostgres = process.env.DATABASE_URL?.startsWith('postgresql://')

if (isPostgres) {
  const { PrismaPg } = require('@prisma/adapter-pg')
  const adapter = new PrismaPg({ connectionString: process.env.DATABASE_URL })
  prisma = new PrismaClient({ adapter })
} else {
  const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')
  const adapter = new PrismaBetterSqlite3({ url: process.env.DATABASE_URL })
  prisma = new PrismaClient({ adapter })
}
```

**Trade-offs**:
- Schema must be compatible with both (no PostgreSQL-specific features)
- Must test on both databases
- Prisma 7 driver adapters are newer (less community support)

---

### 3. Event Sourcing for Certificates

**Decision**: Store certificate changes as immutable events

**Rationale**:
- Full audit trail (regulatory requirement)
- Can reconstruct state at any point in time
- Clear history of who changed what

**Schema**:
```
Certificate (current state) ← derived from → CertificateEvent[] (immutable log)
                           ↓
                    CertificateRevision (snapshots at workflow transitions)
```

**Trade-offs**:
- More complex queries
- Storage grows over time
- Must handle event replay correctly

---

### 4. Role-Based Access Control (RBAC)

**Decision**: Simple role system with admin types

**Roles**:
| Role | adminType | Capabilities |
|------|-----------|--------------|
| ADMIN | MASTER | Full system control, manage all users |
| ADMIN | WORKER | Review certificates (future use) |
| ENGINEER | - | Create/edit certificates |
| CUSTOMER | - | View/approve certificates |

**Implementation**: NextAuth session contains role info, checked in API routes and server components.

---

### 5. GKE with Kustomize

**Decision**: Kubernetes on GKE with Kustomize overlays

**Rationale**:
- Managed Kubernetes (less ops burden)
- Environment-specific configs via overlays
- Native GCP integration (Workload Identity)

**Structure**:
```
k8s/
├── base/           # Common manifests
└── overlays/
    ├── development/  # Low resources, 1 replica
    ├── staging/      # Medium resources, 2 replicas
    └── production/   # High resources, 3+ replicas
```

---

## Directory Structure

```
hta-calibration/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── (auth)/            # Auth pages (login, customer login)
│   │   ├── (dashboard)/       # Protected dashboard routes
│   │   ├── api/               # API routes
│   │   └── customer/          # Customer portal
│   ├── components/            # React components
│   │   ├── ui/               # shadcn/ui components
│   │   └── certificates/     # Certificate-specific components
│   ├── lib/                   # Utilities
│   │   ├── prisma.ts         # Database client
│   │   ├── auth.ts           # NextAuth config
│   │   └── utils.ts          # Helper functions
│   ├── services/              # Business logic
│   ├── hooks/                 # React hooks
│   └── types/                 # TypeScript types
├── prisma/
│   ├── schema.prisma          # Database schema
│   ├── seed.ts               # Seed data
│   └── migrations/           # Migration history
├── k8s/
│   ├── base/                 # Base K8s manifests
│   └── overlays/             # Environment patches
├── terraform/
│   ├── shared/               # Shared resources (registry, etc.)
│   └── environments/         # Per-environment infra
├── public/                    # Static assets
└── docs/                      # Documentation
```

---

## Data Flow

### Certificate Creation Flow
```
Engineer → Create Certificate → Save to DB → Status: DRAFT
    ↓
Submit for Review → CertificateEvent logged → Status: PENDING_REVIEW
    ↓
Reviewer approves/rejects → CertificateRevision created
    ↓
Send to Customer → ApprovalToken generated → Email sent
    ↓
Customer approves → Signatures collected → PDF generated → Status: APPROVED
```

### Authentication Flow
```
User → Login Page → NextAuth Credentials Provider
    ↓
Verify password (bcrypt) → Create JWT session
    ↓
Session stored in cookie → Available in server/client components
```

---

## Key Files Quick Reference

| File | Purpose |
|------|---------|
| `src/lib/prisma.ts` | Database client with adapter selection |
| `src/lib/auth.ts` | NextAuth configuration |
| `prisma/schema.prisma` | Database schema (867 lines) |
| `prisma/seed.ts` | Test data seeding |
| `k8s/base/deployment.yaml` | Main deployment manifest |
| `k8s/base/configmap.yaml` | Environment configuration |
| `terraform/environments/dev/main.tf` | Dev infrastructure |
| `Dockerfile` | Container build instructions |
| `docker-entrypoint.sh` | Container startup script |

---

## Environment Variables

### Required
| Variable | Description | Example |
|----------|-------------|---------|
| `DATABASE_URL` | Database connection string | `postgresql://user:pass@host:5432/db` |
| `NEXTAUTH_SECRET` | JWT signing secret | Random 32+ char string |
| `AUTH_SECRET` | Same as NEXTAUTH_SECRET | (NextAuth v5 uses both) |
| `NEXTAUTH_URL` | App URL | `http://localhost:3000` |

### Optional
| Variable | Description | Default |
|----------|-------------|---------|
| `GCS_CERTIFICATES_BUCKET` | Certificate storage bucket | - |
| `GCS_SIGNATURES_BUCKET` | Signature storage bucket | - |
| `AUTH_TRUST_HOST` | Trust proxy headers | `false` |

---

## Security Considerations

1. **Password Hashing**: bcrypt with cost factor 12
2. **Session**: JWT in httpOnly cookie, 24h expiry
3. **CSRF**: NextAuth built-in protection
4. **SQL Injection**: Prisma parameterized queries
5. **XSS**: React auto-escaping, CSP headers
6. **Container**: Non-root user, read-only filesystem where possible

---

## Next Steps

- [01 - Frontend](../01-frontend/) - Deep dive into React components
- [02 - Backend](../02-backend/) - API and server actions
- [03 - Database](../03-database/) - Schema and Prisma
