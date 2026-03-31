# 03 - Database Architecture

## Documentation Index

| File | Description | When to Read |
|------|-------------|--------------|
| [01-prisma-setup.md](./01-prisma-setup.md) | Prisma client configuration, driver adapters, connection handling | Setting up local dev, debugging connection issues |
| [02-schema-deep-dive.md](./02-schema-deep-dive.md) | All models explained, relationships, status flows | Understanding data model, adding fields |
| [03-seed-script.md](./03-seed-script.md) | Test data generation, how seeding works | Populating dev/test databases |
| [04-environments.md](./04-environments.md) | Local/Dev/Staging/Prod database operations | Connecting to different environments |
| [05-testing.md](./05-testing.md) | Unit tests, integration tests (PostgreSQL) | Writing database tests |
| [06-multi-tenancy-future.md](./06-multi-tenancy-future.md) | Future architecture for multi-tenant support | Planning multi-tenant migration |

---

## Quick Reference

### Local Development

```bash
npm run db:start        # Start PostgreSQL via Docker
npm run db:setup        # Generate client + push schema
npm run db:seed         # Add test data
npx prisma studio       # GUI browser
```

### Cloud SQL (Dev/Staging/Prod)

```bash
# Start proxy
cloud-sql-proxy PROJECT:REGION:INSTANCE

# Connect
export DATABASE_URL="postgresql://user:pass@127.0.0.1:5432/db"
npx prisma studio
```

### Database Connection

```typescript
// src/lib/prisma.ts - PostgreSQL adapter
import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })
```

---

## Database Stack

| Component | Local | CI | Production |
|-----------|-------|-----|------------|
| Database | PostgreSQL 16 | PostgreSQL 16 | PostgreSQL 15 |
| ORM | Prisma 7 | Prisma 7 | Prisma 7 |
| Adapter | @prisma/adapter-pg | @prisma/adapter-pg | @prisma/adapter-pg |
| Location | Docker container | GitHub Actions service | Cloud SQL |
| GUI | Prisma Studio | - | DBeaver / Prisma Studio |

---

## Schema Overview

```
27 Models in prisma/schema.prisma:

USERS & AUTH
├── User                 # Staff (engineers, admins)
├── CustomerUser         # Customer portal users
├── CustomerAccount      # Company accounts
└── AllowedGoogleEmail   # OAuth whitelist

CERTIFICATES (Core Business)
├── Certificate          # Main certificate record
├── CertificateEvent     # Event sourcing log (immutable)
├── CertificateRevision  # Workflow snapshots
├── Parameter            # Measurement parameters
├── CalibrationResult    # Measurement values
└── ReviewFeedback       # Reviewer comments

INSTRUMENTS
├── MasterInstrument     # Calibration instruments (versioned)
└── CertificateMasterInstrument  # Certificate ↔ Instrument links

SIGNATURES & APPROVAL
├── Signature            # Digital signatures
├── ApprovalToken        # Customer approval tokens
└── SigningEvidence      # Signing audit trail

COMMUNICATION
├── ChatThread           # Discussion threads
├── ChatMessage          # Chat messages
└── Notification         # User notifications

SYSTEM
├── AuditLog             # General audit trail
├── JobQueue             # Background jobs
└── RealtimeEvent        # Real-time event queue
```

---

## Common Issues & Solutions

| Problem | Solution | Doc Reference |
|---------|----------|---------------|
| "Driver Adapter not compatible" | Check DATABASE_URL format matches schema provider | [01-prisma-setup.md](./01-prisma-setup.md#error-driver-adapter-is-not-compatible-with-provider) |
| Connection timeout | Check Cloud SQL IP, VPC peering, firewall | [04-environments.md](./04-environments.md#checking-connection-from-pod) |
| "too many connections" | Add `?connection_limit=5` to URL | [01-prisma-setup.md](./01-prisma-setup.md#error-too-many-connections) |
| Prisma error during build | Set `SKIP_DB_INIT=true` | [01-prisma-setup.md](./01-prisma-setup.md#the-build-phase-problem) |
| Seed fails with unique constraint | Use `upsert` instead of `create` | [03-seed-script.md](./03-seed-script.md#error-unique-constraint-failed) |
| Can't connect to prod | Use Cloud SQL Proxy | [04-environments.md](./04-environments.md#connecting-to-production) |

---

## Related Documentation

- [04-authentication](../04-authentication/) - How auth uses the database
- [12-debugging](../12-debugging/) - General troubleshooting
- [13-tools](../13-tools/) - DBeaver, Cloud SQL Proxy setup
- [14-environments](../14-environments/) - Environment-specific configs
