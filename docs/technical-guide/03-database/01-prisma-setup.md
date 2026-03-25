# Prisma Setup Deep Dive

## Overview

This application uses **PostgreSQL** for all environments (local development, CI, and production) with Prisma 7 driver adapters.

---

## File: `src/lib/prisma.ts`

This is the **most critical file** for database connectivity.

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

const connectionString = process.env.DATABASE_URL ||
  'postgresql://hta_user:hta_dev_password@localhost:5432/hta_calibration'

const adapter = new PrismaPg({ connectionString })

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
    log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
  })

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma
```

### Key Points

1. **Single Adapter**: Uses `@prisma/adapter-pg` for PostgreSQL everywhere
2. **Singleton Pattern**: Prevents connection exhaustion during Next.js hot reload
3. **Default URL**: Falls back to local Docker PostgreSQL if DATABASE_URL not set

---

## Local Development Setup

### Prerequisites

- Docker installed and running
- Node.js 20+

### Commands

```bash
# Start PostgreSQL container
npm run db:start

# Generate Prisma client and push schema
npm run db:setup

# Seed test data
npm run db:seed

# Open GUI browser
npx prisma studio

# Stop PostgreSQL
npm run db:stop

# Reset database (delete all data)
npm run db:reset
```

### Docker Compose Configuration

```yaml
# docker-compose.dev.yml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: hta_user
      POSTGRES_PASSWORD: hta_dev_password
      POSTGRES_DB: hta_calibration
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

---

## DATABASE_URL Format

```bash
# Local development (Docker)
DATABASE_URL="postgresql://hta_user:hta_dev_password@localhost:5432/hta_calibration"

# CI (GitHub Actions)
DATABASE_URL="postgresql://hta_test:hta_test_password@localhost:5432/hta_calibration_test"

# Production (Cloud SQL private IP)
DATABASE_URL="postgresql://hta_app:secretpass@10.0.0.5:5432/hta_calibration"

# With connection pooling options
DATABASE_URL="postgresql://hta_app:pass@10.0.0.5:5432/hta_calibration?connection_limit=10&pool_timeout=30"

# Via Cloud SQL Proxy (local connection to production)
DATABASE_URL="postgresql://hta_app:pass@127.0.0.1:5432/hta_calibration"
```

---

## Connection Pool Configuration

### PostgreSQL Connection Limits

Cloud SQL db-f1-micro allows ~25 connections. With 2 pods:

```
Pod 1: 10 connections
Pod 2: 10 connections
Prisma Migrate: 2 connections
Cloud SQL Proxy: 1 connection
Buffer: 2 connections
─────────────────────────────
Total: 25 connections (at limit)
```

### Configure in DATABASE_URL

```bash
# Limit each client to 5 connections, timeout after 30s
DATABASE_URL="postgresql://...?connection_limit=5&pool_timeout=30"
```

---

## Debugging Connection Issues

### Test 1: Verify Environment Variable

```bash
# In pod
kubectl exec -it deployment/hta-web -n hta-calibration -- printenv DATABASE_URL

# Expected output (masked):
# postgresql://hta_app:***@10.x.x.x:5432/hta_calibration
```

### Test 2: Network Connectivity

```bash
# In pod - test TCP connection
kubectl exec -it deployment/hta-web -n hta-calibration -- \
  sh -c "nc -zv 10.x.x.x 5432"

# Expected output:
# 10.x.x.x (10.x.x.x:5432) open
```

### Test 3: Authentication

```bash
# Via Cloud SQL Proxy locally
psql "postgresql://hta_app:PASSWORD@127.0.0.1:5432/hta_calibration" -c "SELECT 1"

# Expected output:
#  ?column?
# ----------
#         1
```

### Test 4: Prisma Connection

```bash
# Create test script
cat > /tmp/test-db.ts << 'EOF'
import { prisma } from './src/lib/prisma'

async function main() {
  try {
    const result = await prisma.$queryRaw`SELECT 1 as test`
    console.log('SUCCESS:', result)
  } catch (error) {
    console.error('FAILED:', error)
  } finally {
    await prisma.$disconnect()
  }
}
main()
EOF

# Run it
npx tsx /tmp/test-db.ts
```

---

## Common Errors and Solutions

### Error: "Cannot find module '@prisma/adapter-pg'"

```
Error: Cannot find module '@prisma/adapter-pg'
```

**Cause**: Adapter package not installed

**Solution**:
```bash
npm install @prisma/adapter-pg
```

---

### Error: "PrismaClientInitializationError: Unable to require"

```
PrismaClientInitializationError: Unable to require(`/app/node_modules/.prisma/client/libquery_engine-linux-musl-openssl-3.0.x.so.node`)
```

**Cause**: Prisma engine binary not generated or wrong platform

**Solution**:
```bash
# Regenerate Prisma client
npx prisma generate

# In Docker, make sure to generate in deps stage
# AND copy node_modules/.prisma to production stage
```

---

### Error: "Connection refused"

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Causes**:
1. PostgreSQL container not running
2. Wrong port
3. Docker not started

**Debug**:
```bash
# Check if PostgreSQL is running
docker ps | grep postgres

# Start it
npm run db:start

# Check logs
docker logs hta-calibration-postgres-1
```

---

### Error: "too many connections"

```
Error: remaining connection slots are reserved for non-replication superuser connections
```

**Cause**: Connection pool exhausted

**Solutions**:
1. Add connection limit to URL: `?connection_limit=5`
2. Upgrade Cloud SQL tier (more connections)
3. Reduce number of pods
4. Ensure connections are released (`prisma.$disconnect()`)

---

## File Dependencies

```
src/lib/prisma.ts
    │
    ├── imports from: @prisma/client (generated)
    │                  @prisma/adapter-pg
    │
    ├── reads: DATABASE_URL env var
    │          NODE_ENV env var
    │
    └── used by: ALL server-side code
                 API routes
                 Server Components
                 Server Actions
                 Seed script
```

---

## Related Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma` | Database schema definition |
| `prisma/seed.ts` | Seed data script |
| `package.json` | Prisma dependencies |
| `.env` / `.env.local` | DATABASE_URL definition |
| `docker-compose.dev.yml` | Local PostgreSQL container |

---

## Quick Reference

```bash
# Start local database
npm run db:start

# Check database connection
npx prisma db execute --stdin <<< "SELECT 1"

# View connection info
npx prisma db execute --stdin <<< "SELECT current_database(), current_user, inet_server_addr()"

# Reset and reseed
npm run db:reset && npm run db:setup && npm run db:seed
```
