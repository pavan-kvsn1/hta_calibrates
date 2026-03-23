# Database Testing

## Testing Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATABASE TESTING PYRAMID                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                              ┌─────────┐                                    │
│                              │   E2E   │  ← Full app with real DB           │
│                            ┌─┴─────────┴─┐    (Playwright + PostgreSQL)     │
│                            │ Integration │  ← Database operations           │
│                          ┌─┴─────────────┴─┐  (Vitest + SQLite/PostgreSQL)  │
│                          │      Unit       │  ← Pure logic, mocked DB       │
│                          └─────────────────┘  (Vitest, no DB)               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Unit Tests (No Database)

For testing business logic without database:

```typescript
// src/services/__tests__/certificate-service.unit.test.ts
import { describe, it, expect, vi } from 'vitest'
import { calculateDueDate } from '../certificate-service'

// No database needed - testing pure functions
describe('calculateDueDate', () => {
  it('adds calibration tenure to calibration date', () => {
    const calibrationDate = new Date('2024-01-15')
    const tenureMonths = 12

    const dueDate = calculateDueDate(calibrationDate, tenureMonths)

    expect(dueDate).toEqual(new Date('2025-01-15'))
  })

  it('handles leap year correctly', () => {
    const calibrationDate = new Date('2024-02-29')
    const tenureMonths = 12

    const dueDate = calculateDueDate(calibrationDate, tenureMonths)

    // 2025 is not a leap year, so Feb 28
    expect(dueDate).toEqual(new Date('2025-02-28'))
  })
})
```

### Mocking Prisma

```typescript
// src/services/__tests__/user-service.unit.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { getUserWithCertificates } from '../user-service'

// Mock the entire Prisma module
vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findUnique: vi.fn(),
    },
  },
}))

describe('getUserWithCertificates', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('returns user with their certificates', async () => {
    // Arrange
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      createdCertificates: [
        { id: 'cert-1', certificateNumber: 'HTA-001' },
      ],
    }

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)

    // Act
    const result = await getUserWithCertificates('user-1')

    // Assert
    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      include: { createdCertificates: true },
    })
    expect(result).toEqual(mockUser)
  })

  it('returns null for non-existent user', async () => {
    vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

    const result = await getUserWithCertificates('non-existent')

    expect(result).toBeNull()
  })
})
```

---

## Integration Tests with SQLite

Fast tests using in-memory SQLite:

### Test Setup

```typescript
// tests/setup/database.ts
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { execSync } from 'child_process'

let prisma: PrismaClient

export async function setupTestDatabase() {
  // Use in-memory SQLite for speed
  const adapter = new PrismaBetterSqlite3({
    url: 'file::memory:?cache=shared',
  })

  prisma = new PrismaClient({ adapter })

  // Apply schema to in-memory database
  // Note: db push doesn't work with in-memory, need workaround
  await prisma.$executeRawUnsafe(`
    CREATE TABLE IF NOT EXISTS User (
      id TEXT PRIMARY KEY,
      email TEXT UNIQUE NOT NULL,
      name TEXT NOT NULL,
      passwordHash TEXT,
      role TEXT DEFAULT 'ENGINEER',
      adminType TEXT,
      isAdmin INTEGER DEFAULT 0,
      assignedAdminId TEXT,
      isActive INTEGER DEFAULT 1,
      createdAt TEXT DEFAULT CURRENT_TIMESTAMP,
      updatedAt TEXT DEFAULT CURRENT_TIMESTAMP
    )
  `)
  // ... more tables

  return prisma
}

export async function teardownTestDatabase() {
  await prisma.$disconnect()
}

export function getTestPrisma() {
  return prisma
}
```

### Alternative: File-based Test Database

```typescript
// tests/setup/database.ts
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import { execSync } from 'child_process'
import * as fs from 'fs'

const TEST_DB_PATH = './test.db'

export async function setupTestDatabase() {
  // Remove old test database
  if (fs.existsSync(TEST_DB_PATH)) {
    fs.unlinkSync(TEST_DB_PATH)
  }

  // Push schema to test database
  execSync(`DATABASE_URL="file:${TEST_DB_PATH}" npx prisma db push --skip-generate`, {
    stdio: 'inherit',
  })

  // Create client
  const adapter = new PrismaBetterSqlite3({
    url: `file:${TEST_DB_PATH}`,
  })

  const prisma = new PrismaClient({ adapter })

  return prisma
}

export async function cleanupTestDatabase(prisma: PrismaClient) {
  // Delete all data between tests
  await prisma.$transaction([
    prisma.certificateEvent.deleteMany(),
    prisma.certificate.deleteMany(),
    prisma.customerUser.deleteMany(),
    prisma.customerAccount.deleteMany(),
    prisma.user.deleteMany(),
  ])
}
```

### Integration Test Example

```typescript
// tests/integration/certificate.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { setupTestDatabase, cleanupTestDatabase } from '../setup/database'
import { PrismaClient } from '@prisma/client'

let prisma: PrismaClient

describe('Certificate Integration Tests', () => {
  beforeAll(async () => {
    prisma = await setupTestDatabase()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await cleanupTestDatabase(prisma)
  })

  describe('createCertificate', () => {
    it('creates certificate with all required fields', async () => {
      // Arrange: Create user first
      const user = await prisma.user.create({
        data: {
          email: 'engineer@test.com',
          name: 'Test Engineer',
          role: 'ENGINEER',
        },
      })

      // Act: Create certificate
      const certificate = await prisma.certificate.create({
        data: {
          certificateNumber: 'TEST-001',
          status: 'DRAFT',
          customerName: 'Test Customer',
          createdById: user.id,
          lastModifiedById: user.id,
        },
      })

      // Assert
      expect(certificate.id).toBeDefined()
      expect(certificate.certificateNumber).toBe('TEST-001')
      expect(certificate.status).toBe('DRAFT')
      expect(certificate.createdById).toBe(user.id)
    })

    it('enforces unique certificate number', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'engineer@test.com',
          name: 'Test Engineer',
          role: 'ENGINEER',
        },
      })

      await prisma.certificate.create({
        data: {
          certificateNumber: 'TEST-001',
          createdById: user.id,
          lastModifiedById: user.id,
        },
      })

      // Act & Assert: Second certificate with same number should fail
      await expect(
        prisma.certificate.create({
          data: {
            certificateNumber: 'TEST-001',  // Duplicate
            createdById: user.id,
            lastModifiedById: user.id,
          },
        })
      ).rejects.toThrow(/Unique constraint/)
    })
  })

  describe('certificate status transitions', () => {
    it('allows DRAFT -> PENDING_REVIEW transition', async () => {
      const user = await prisma.user.create({
        data: { email: 'eng@test.com', name: 'Eng', role: 'ENGINEER' },
      })

      const cert = await prisma.certificate.create({
        data: {
          certificateNumber: 'TEST-001',
          status: 'DRAFT',
          createdById: user.id,
          lastModifiedById: user.id,
        },
      })

      const updated = await prisma.certificate.update({
        where: { id: cert.id },
        data: { status: 'PENDING_REVIEW' },
      })

      expect(updated.status).toBe('PENDING_REVIEW')
    })
  })

  describe('event sourcing', () => {
    it('creates event when certificate is created', async () => {
      const user = await prisma.user.create({
        data: { email: 'eng@test.com', name: 'Eng', role: 'ENGINEER' },
      })

      const cert = await prisma.certificate.create({
        data: {
          certificateNumber: 'TEST-001',
          createdById: user.id,
          lastModifiedById: user.id,
        },
      })

      // Create event
      await prisma.certificateEvent.create({
        data: {
          certificateId: cert.id,
          sequenceNumber: 1,
          revision: 1,
          eventType: 'CERTIFICATE_CREATED',
          eventData: '{}',
          userId: user.id,
          userRole: 'ENGINEER',
        },
      })

      // Verify
      const events = await prisma.certificateEvent.findMany({
        where: { certificateId: cert.id },
      })

      expect(events).toHaveLength(1)
      expect(events[0].eventType).toBe('CERTIFICATE_CREATED')
    })
  })
})
```

---

## Integration Tests with PostgreSQL

For testing PostgreSQL-specific behavior:

### Docker Setup for PostgreSQL Tests

```yaml
# docker-compose.test.yml
version: '3.8'
services:
  test-db:
    image: postgres:15-alpine
    environment:
      POSTGRES_USER: test
      POSTGRES_PASSWORD: test
      POSTGRES_DB: hta_test
    ports:
      - "5433:5432"  # Different port to avoid conflicts
    tmpfs:
      - /var/lib/postgresql/data  # In-memory for speed
```

### PostgreSQL Test Setup

```typescript
// tests/setup/postgres-database.ts
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { execSync } from 'child_process'

const TEST_DATABASE_URL = 'postgresql://test:test@localhost:5433/hta_test'

export async function setupPostgresTestDatabase() {
  // Start Docker container if not running
  execSync('docker-compose -f docker-compose.test.yml up -d', {
    stdio: 'inherit',
  })

  // Wait for PostgreSQL to be ready
  await waitForPostgres()

  // Push schema
  execSync(`DATABASE_URL="${TEST_DATABASE_URL}" npx prisma db push --skip-generate`, {
    stdio: 'inherit',
  })

  // Create client
  const adapter = new PrismaPg({ connectionString: TEST_DATABASE_URL })
  const prisma = new PrismaClient({ adapter })

  return prisma
}

async function waitForPostgres(maxAttempts = 30) {
  const { PrismaPg } = require('@prisma/adapter-pg')

  for (let i = 0; i < maxAttempts; i++) {
    try {
      const adapter = new PrismaPg({ connectionString: TEST_DATABASE_URL })
      const prisma = new PrismaClient({ adapter })
      await prisma.$queryRaw`SELECT 1`
      await prisma.$disconnect()
      return
    } catch {
      await new Promise(r => setTimeout(r, 1000))
    }
  }
  throw new Error('PostgreSQL not ready')
}
```

### PostgreSQL-Specific Tests

```typescript
// tests/integration/postgres-specific.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupPostgresTestDatabase } from '../setup/postgres-database'

describe('PostgreSQL-specific features', () => {
  let prisma: PrismaClient

  beforeAll(async () => {
    prisma = await setupPostgresTestDatabase()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  it('handles concurrent writes correctly', async () => {
    const user = await prisma.user.create({
      data: { email: 'test@test.com', name: 'Test', role: 'ENGINEER' },
    })

    // Simulate concurrent certificate creation
    const promises = Array.from({ length: 10 }, (_, i) =>
      prisma.certificate.create({
        data: {
          certificateNumber: `CONCURRENT-${i}`,
          createdById: user.id,
          lastModifiedById: user.id,
        },
      })
    )

    const results = await Promise.all(promises)

    expect(results).toHaveLength(10)
    expect(new Set(results.map(r => r.certificateNumber)).size).toBe(10)
  })

  it('handles large JSON data', async () => {
    const user = await prisma.user.create({
      data: { email: 'test2@test.com', name: 'Test', role: 'ENGINEER' },
    })

    // Large JSON payload
    const largeEventData = JSON.stringify({
      changes: Array.from({ length: 1000 }, (_, i) => ({
        field: `field_${i}`,
        oldValue: `old_${i}`,
        newValue: `new_${i}`,
      })),
    })

    const event = await prisma.certificateEvent.create({
      data: {
        certificateId: 'test-cert',
        sequenceNumber: 1,
        revision: 1,
        eventType: 'BULK_UPDATE',
        eventData: largeEventData,
        userId: user.id,
        userRole: 'ENGINEER',
      },
    })

    const retrieved = await prisma.certificateEvent.findUnique({
      where: { id: event.id },
    })

    expect(JSON.parse(retrieved!.eventData).changes).toHaveLength(1000)
  })

  it('rolls back transaction on error', async () => {
    const user = await prisma.user.create({
      data: { email: 'test3@test.com', name: 'Test', role: 'ENGINEER' },
    })

    const initialCount = await prisma.certificate.count()

    try {
      await prisma.$transaction(async (tx) => {
        await tx.certificate.create({
          data: {
            certificateNumber: 'TX-001',
            createdById: user.id,
            lastModifiedById: user.id,
          },
        })

        // This should fail - duplicate
        await tx.certificate.create({
          data: {
            certificateNumber: 'TX-001',  // Same number
            createdById: user.id,
            lastModifiedById: user.id,
          },
        })
      })
    } catch {
      // Expected
    }

    // Transaction should have rolled back
    const finalCount = await prisma.certificate.count()
    expect(finalCount).toBe(initialCount)
  })
})
```

---

## Testing Both Databases

### Vitest Configuration

```typescript
// vitest.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    // Run SQLite tests by default
    include: ['tests/**/*.test.ts'],
    exclude: ['tests/**/*.postgres.test.ts'],

    // Separate config for PostgreSQL tests
    // Run with: npm run test:postgres
  },
})

// vitest.postgres.config.ts
import { defineConfig } from 'vitest/config'

export default defineConfig({
  test: {
    include: ['tests/**/*.postgres.test.ts'],
    setupFiles: ['tests/setup/postgres-global.ts'],
  },
})
```

### Package.json Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:unit": "vitest run tests/unit",
    "test:integration": "vitest run tests/integration",
    "test:postgres": "docker-compose -f docker-compose.test.yml up -d && vitest run -c vitest.postgres.config.ts",
    "test:postgres:cleanup": "docker-compose -f docker-compose.test.yml down -v"
  }
}
```

---

## CI/CD Testing Pipeline

```yaml
# .github/workflows/test.yml
name: Tests

on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npm run test:unit

  integration-tests-sqlite:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx prisma generate
      - run: npm run test:integration

  integration-tests-postgres:
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: hta_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
      - run: npm ci
      - run: npx prisma generate
      - run: DATABASE_URL="postgresql://test:test@localhost:5432/hta_test" npx prisma db push
      - run: DATABASE_URL="postgresql://test:test@localhost:5432/hta_test" npm run test:postgres
```

---

## Test Coverage Goals

| Layer | Target | Current |
|-------|--------|---------|
| Unit tests | 80% | TBD |
| Integration (SQLite) | 70% | TBD |
| Integration (PostgreSQL) | 50% | TBD |
| E2E | Critical paths | TBD |

---

## Common Test Failures

### "Cannot find module '@prisma/adapter-pg'"

**In CI**: Ensure `npx prisma generate` runs before tests

### "Unique constraint failed" in parallel tests

**Cause**: Tests running in parallel share database

**Fix**: Use unique identifiers:
```typescript
const uniqueEmail = `test-${Date.now()}-${Math.random()}@test.com`
```

### "Database is locked" (SQLite)

**Cause**: Concurrent writes to SQLite file

**Fix**: Use in-memory database or run tests serially:
```typescript
// vitest.config.ts
export default defineConfig({
  test: {
    pool: 'forks',  // Not threads
    poolOptions: {
      forks: {
        singleFork: true,  // Run serially
      },
    },
  },
})
```
