# Integration Tests Deep Dive

## Purpose

Integration tests verify that components work together:
- API routes with database
- Authentication flow
- Business logic with real data

---

## Configuration

```typescript
// vitest.integration.config.ts
export default defineConfig({
  test: {
    environment: 'node',           // Real Node.js, not jsdom
    globals: true,
    include: ['tests/integration/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    testTimeout: 30000,            // 30 seconds for DB operations
    sequence: { concurrent: false }, // Sequential execution
    fileParallelism: false,        // One file at a time
    env: {
      DATABASE_URL: 'postgresql://hta_test:hta_test_password@localhost:5433/hta_calibration_test',
    },
    setupFiles: ['./tests/integration/setup/postgres-setup.ts'],
  },
})
```

### Why Sequential?

```
┌─────────────────────────────────────────────────────────────────┐
│                 WHY SEQUENTIAL TESTS?                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Problem with parallel tests + shared database:                 │
│                                                                  │
│  Test A: INSERT user 'test@example.com'                         │
│  Test B: INSERT user 'test@example.com'                         │
│  → Unique constraint violation!                                 │
│                                                                  │
│  Test C: SELECT COUNT(*) → expects 5                            │
│  Test D: DELETE FROM users                                      │
│  → Test C fails because Test D ran first!                       │
│                                                                  │
│  Solution: Run tests sequentially with fresh DB per file        │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Test Database Setup

### PostgreSQL Setup

```typescript
// tests/integration/setup/postgres-setup.ts
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

let prisma: PrismaClient

export async function setupTestDb() {
  const connectionString = process.env.DATABASE_URL
    || 'postgresql://hta_test:hta_test_password@localhost:5433/hta_calibration_test'

  const adapter = new PrismaPg({ connectionString })
  prisma = new PrismaClient({ adapter })

  // Clean existing data
  await cleanupTestDb()

  return prisma
}

export async function cleanupTestDb() {
  // Delete all data in correct order (respecting foreign keys)
  await prisma.$transaction([
    prisma.certificateEvent.deleteMany(),
    prisma.reviewFeedback.deleteMany(),
    prisma.certificate.deleteMany(),
    prisma.user.deleteMany(),
  ])
}

export { prisma }
```

### Docker Compose for Tests

```yaml
# docker-compose.test.yml
version: '3.8'
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: hta_test
      POSTGRES_PASSWORD: hta_test_password
      POSTGRES_DB: hta_calibration_test
    ports:
      - "5433:5432"
    tmpfs:
      - /var/lib/postgresql/data  # In-memory for speed
```

---

## Integration Test Examples

### API Route Tests

```typescript
// tests/integration/api/certificates.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { setupTestDb, cleanupTestDb, prisma } from '../setup/postgres-setup'

describe('Certificate API', () => {
  beforeAll(async () => {
    await setupTestDb()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await cleanupTestDb()
  })

  describe('GET /api/certificates', () => {
    it('returns empty array when no certificates', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'engineer@test.com',
          name: 'Test Engineer',
          role: 'ENGINEER',
          authProvider: 'PASSWORD',
        },
      })

      // Call API and verify...
    })
  })

  describe('POST /api/certificates', () => {
    it('creates certificate', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'engineer@test.com',
          name: 'Test Engineer',
          role: 'ENGINEER',
          authProvider: 'PASSWORD',
        },
      })

      // Create certificate and verify...
    })
  })
})
```

### Database Transaction Tests

```typescript
// tests/integration/database/transactions.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTestDb, prisma } from '../setup/postgres-setup'

describe('Database Transactions', () => {
  beforeAll(async () => {
    await setupTestDb()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('rolls back on error', async () => {
    const initialCount = await prisma.certificate.count()

    try {
      await prisma.$transaction(async (tx) => {
        await tx.certificate.create({
          data: {
            certificateNumber: 'HTA-2024-001',
            status: 'DRAFT',
            createdById: 'nonexistent', // This will fail FK constraint
            lastModifiedById: 'nonexistent',
          },
        })
      })
    } catch (error) {
      // Expected to fail
    }

    const finalCount = await prisma.certificate.count()
    expect(finalCount).toBe(initialCount) // No change - rolled back
  })
})
```

---

## Running Integration Tests

### Local Development

```bash
# 1. Start test PostgreSQL
npm run db:test:start

# 2. Push schema to test database
DATABASE_URL="postgresql://hta_test:hta_test_password@localhost:5433/hta_calibration_test" \
  npx prisma db push

# 3. Run integration tests
npm run test:integration

# 4. Stop test database when done
npm run db:test:stop
```

### CI/CD (GitHub Actions)

```yaml
integration-tests:
  runs-on: ubuntu-latest
  services:
    postgres:
      image: postgres:16-alpine
      env:
        POSTGRES_USER: hta_test
        POSTGRES_PASSWORD: hta_test_password
        POSTGRES_DB: hta_calibration_test
      ports:
        - 5432:5432
      options: >-
        --health-cmd "pg_isready -U hta_test"
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5

  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
    - run: npm ci
    - run: npx prisma generate
    - run: npx prisma db push --accept-data-loss
    - run: npm run test:integration
```

---

## Test Helpers

```typescript
// tests/integration/helpers.ts
import { vi } from 'vitest'
import type { User } from '@prisma/client'

export function createMockSession(user: User) {
  return {
    user: {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    },
    expires: new Date(Date.now() + 86400000).toISOString(),
  }
}

export async function createTestUser(
  prisma: any,
  overrides: Partial<User> = {}
) {
  return prisma.user.create({
    data: {
      email: `test-${Date.now()}@example.com`,
      name: 'Test User',
      role: 'ENGINEER',
      authProvider: 'PASSWORD',
      isActive: true,
      ...overrides,
    },
  })
}

export async function createTestCertificate(
  prisma: any,
  userId: string,
  overrides: Record<string, unknown> = {}
) {
  const count = await prisma.certificate.count()
  return prisma.certificate.create({
    data: {
      certificateNumber: `HTA-2024-${String(count + 1).padStart(3, '0')}`,
      status: 'DRAFT',
      customerName: 'Test Customer',
      createdById: userId,
      lastModifiedById: userId,
      ...overrides,
    },
  })
}
```

---

## Common Issues

### "Unique constraint failed"

**Fix**: Clean up before each test
```typescript
beforeEach(async () => {
  await cleanupTestDb()
})
```

### "Foreign key constraint failed"

**Fix**: Create required relations first
```typescript
const user = await prisma.user.create({ ... })
const cert = await prisma.certificate.create({
  data: {
    createdById: user.id,  // Now exists
    ...
  },
})
```

### "Connection refused"

**Fix**: Start the test database
```bash
npm run db:test:start
```
