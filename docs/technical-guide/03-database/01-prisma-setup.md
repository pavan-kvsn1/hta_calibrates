# Prisma Setup Deep Dive

## The Problem We're Solving

This application needs to work with:
1. **SQLite** locally (zero setup for developers)
2. **PostgreSQL** in production (Cloud SQL)

Prisma 7 introduced **driver adapters** that let us switch databases without changing application code.

---

## File: `src/lib/prisma.ts`

This is the **most critical file** for database connectivity. Let's go line by line.

```typescript
// src/lib/prisma.ts - FULL FILE WITH ANNOTATIONS

import { PrismaClient } from '@prisma/client'

// ============================================================
// ENVIRONMENT DETECTION
// ============================================================

// Check if we're connecting to PostgreSQL
// This determines which driver adapter to use
const isPostgres = process.env.DATABASE_URL?.startsWith('postgresql://')

// Check if we're in the Next.js build phase
// During `npm run build`, Next.js tries to pre-render pages
// This would fail if Prisma tries to connect to a database that doesn't exist
const isBuildPhase = process.env.SKIP_DB_INIT === 'true'

// ============================================================
// PRISMA CLIENT FACTORY
// ============================================================

function createPrismaClient(): PrismaClient {
  // CASE 1: Build phase - return a mock client
  // This prevents "Cannot connect to database" errors during build
  if (isBuildPhase) {
    console.log('[Prisma] Build phase detected, using mock client')

    // Return a Proxy that throws helpful errors if accidentally used
    return new Proxy({} as PrismaClient, {
      get(_target, prop) {
        // Allow 'then' to return undefined (for Promise detection)
        if (prop === 'then') return undefined

        // Allow connect/disconnect to be no-ops
        if (prop === '$connect' || prop === '$disconnect') {
          return () => Promise.resolve()
        }

        // Any actual database operation should fail loudly
        throw new Error(
          `Prisma client method "${String(prop)}" called during build phase. ` +
          `This usually means a Server Component is trying to fetch data at build time. ` +
          `Make sure SKIP_DB_INIT=true is set during builds.`
        )
      },
    })
  }

  // CASE 2: PostgreSQL (production/Cloud SQL)
  if (isPostgres) {
    console.log('[Prisma] Using PostgreSQL adapter')

    // Dynamic import to avoid bundling both adapters
    const { PrismaPg } = require('@prisma/adapter-pg')

    // Create adapter with connection string
    const adapter = new PrismaPg({
      connectionString: process.env.DATABASE_URL
    })

    return new PrismaClient({
      adapter,
      log: [
        { level: 'query', emit: 'event' },  // Log all queries
        { level: 'error', emit: 'stdout' }, // Log errors to console
        { level: 'warn', emit: 'stdout' },  // Log warnings
      ],
    })
  }

  // CASE 3: SQLite (local development)
  else {
    console.log('[Prisma] Using SQLite adapter')

    const { PrismaBetterSqlite3 } = require('@prisma/adapter-better-sqlite3')

    const adapter = new PrismaBetterSqlite3({
      url: process.env.DATABASE_URL || 'file:./dev.db',
    })

    return new PrismaClient({
      adapter,
      log: [
        { level: 'query', emit: 'event' },
        { level: 'error', emit: 'stdout' },
        { level: 'warn', emit: 'stdout' },
      ],
    })
  }
}

// ============================================================
// SINGLETON PATTERN
// ============================================================

// In development, Next.js hot-reloads the server on file changes
// Without this pattern, each reload creates a new PrismaClient
// This exhausts database connections quickly

// Extend globalThis to store our singleton
const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

// Use existing instance or create new one
export const prisma = globalForPrisma.prisma ?? createPrismaClient()

// In development, store on globalThis to persist across hot reloads
if (process.env.NODE_ENV !== 'production') {
  globalForPrisma.prisma = prisma
}
```

---

## How Database Selection Works

```
┌─────────────────────────────────────────────────────────────┐
│                     Application Start                        │
└─────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────┐
│              Check DATABASE_URL environment variable         │
└─────────────────────────────────────────────────────────────┘
                              │
              ┌───────────────┼───────────────┐
              ▼               ▼               ▼
    ┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
    │ SKIP_DB_INIT=   │ │ postgresql: │ │ file:./dev.db   │
    │ true            │ │ //...       │ │ or undefined    │
    └─────────────────┘ └─────────────┘ └─────────────────┘
              │               │               │
              ▼               ▼               ▼
    ┌─────────────────┐ ┌─────────────┐ ┌─────────────────┐
    │  Mock Proxy     │ │  PrismaPg   │ │ BetterSqlite3   │
    │  (build only)   │ │  Adapter    │ │ Adapter         │
    └─────────────────┘ └─────────────┘ └─────────────────┘
```

---

## DATABASE_URL Formats

### SQLite (Local Development)

```bash
# Relative path (from project root)
DATABASE_URL="file:./dev.db"

# Absolute path
DATABASE_URL="file:/Users/you/project/dev.db"

# In-memory (for testing)
DATABASE_URL="file::memory:"
```

### PostgreSQL (Cloud SQL)

```bash
# Basic format
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE"

# With Cloud SQL private IP
DATABASE_URL="postgresql://hta_app:secretpass@10.0.0.5:5432/hta_calibration"

# With connection pooling options
DATABASE_URL="postgresql://hta_app:pass@10.0.0.5:5432/hta_calibration?connection_limit=10&pool_timeout=30"

# Via Cloud SQL Proxy (local)
DATABASE_URL="postgresql://hta_app:pass@127.0.0.1:5432/hta_calibration"
```

---

## The Build Phase Problem

### What Happens Without SKIP_DB_INIT

```
1. Run `npm run build`
2. Next.js analyzes pages to determine which can be statically generated
3. For Server Components, it tries to render them
4. Server Component imports `prisma` from `@/lib/prisma`
5. Prisma tries to connect to DATABASE_URL
6. DATABASE_URL points to Cloud SQL which isn't accessible during build
7. BUILD FAILS with "Cannot connect to database"
```

### The Solution

```dockerfile
# In Dockerfile
ENV SKIP_DB_INIT=true
RUN npm run build
```

The mock Proxy client allows the build to complete. Any actual database calls would fail with a clear error message, but during build, we're just analyzing the code structure, not executing queries.

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

### Configure in Prisma Client

```typescript
const prisma = new PrismaClient({
  adapter,
  datasources: {
    db: {
      url: process.env.DATABASE_URL,
    },
  },
})
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

### Error: "Driver Adapter is not compatible with provider"

```
PrismaClientInitializationError: The Driver Adapter `@prisma/adapter-better-sqlite3`,
based on `sqlite`, is not compatible with the provider `postgresql` specified in the Prisma schema.
```

**Cause**: Schema says `provider = "postgresql"` but DATABASE_URL is SQLite format (or vice versa)

**Solution**:
```bash
# Check schema provider
grep "provider" prisma/schema.prisma
# Output: provider = "postgresql"

# Check DATABASE_URL
echo $DATABASE_URL
# If it starts with "file:" - that's SQLite, not PostgreSQL!

# Fix: Use correct DATABASE_URL format
export DATABASE_URL="postgresql://..."
```

---

### Error: "Cannot find module '@prisma/adapter-pg'"

```
Error: Cannot find module '@prisma/adapter-pg'
```

**Cause**: Adapter package not installed

**Solution**:
```bash
npm install @prisma/adapter-pg
# or for SQLite
npm install @prisma/adapter-better-sqlite3
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
Error: connect ECONNREFUSED 10.x.x.x:5432
```

**Causes**:
1. Cloud SQL instance not running
2. Wrong IP address
3. Firewall blocking connection
4. VPC peering not configured

**Debug**:
```bash
# Check Cloud SQL status
gcloud sql instances describe hta-db-dev --format='value(state)'
# Should output: RUNNABLE

# Check IP
gcloud sql instances describe hta-db-dev --format='value(ipAddresses[0].ipAddress)'

# Test from pod
kubectl exec -it deployment/hta-web -n hta-calibration -- nc -zv IP 5432
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
    │                  @prisma/adapter-pg (dynamic)
    │                  @prisma/adapter-better-sqlite3 (dynamic)
    │
    ├── reads: DATABASE_URL env var
    │          SKIP_DB_INIT env var
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
| `Dockerfile` | SKIP_DB_INIT for builds |

---

## Quick Reference

```bash
# Check which adapter will be used
node -e "console.log(process.env.DATABASE_URL?.startsWith('postgresql://') ? 'PostgreSQL' : 'SQLite')"

# Test connection
npx prisma db execute --stdin <<< "SELECT 1"

# View connection info
npx prisma db execute --stdin <<< "SELECT current_database(), current_user, inet_server_addr()"
```
