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

### SQLite Setup

```typescript
// tests/integration/setup/test-db.ts
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

let prisma: PrismaClient

export async function setupTestDb() {
  // Use in-memory SQLite for speed
  const adapter = new PrismaBetterSqlite3({
    url: 'file::memory:?cache=shared',
  })

  prisma = new PrismaClient({ adapter })

  // Push schema to in-memory database
  await prisma.$executeRaw`PRAGMA foreign_keys = ON`

  return prisma
}

export async function cleanupTestDb() {
  // Delete all data in reverse order of dependencies
  await prisma.certificateEvent.deleteMany()
  await prisma.certificate.deleteMany()
  await prisma.user.deleteMany()
  // ...
}

export { prisma }
```

### PostgreSQL Setup

```typescript
// tests/integration/setup/postgres-setup.ts
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'

let prisma: PrismaClient

export async function setupPostgresTestDb() {
  const connectionString = process.env.DATABASE_URL
    || 'postgresql://hta_test:hta_test_password@localhost:5433/hta_calibration_test'

  const adapter = new PrismaPg({ connectionString })
  prisma = new PrismaClient({ adapter })

  // Clean existing data
  await cleanupTestDb()

  return prisma
}

export async function cleanupTestDb() {
  // Use transaction to delete all data
  await prisma.$transaction([
    prisma.certificateEvent.deleteMany(),
    prisma.certificate.deleteMany(),
    prisma.user.deleteMany(),
  ])
}
```

---

## Integration Test Examples

### API Route Tests

```typescript
// tests/integration/api/certificates.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { setupTestDb, cleanupTestDb, prisma } from '../setup/test-db'
import { createMockRequest, createMockSession } from '../helpers'

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
      // Create test user
      const user = await prisma.user.create({
        data: {
          email: 'engineer@test.com',
          name: 'Test Engineer',
          role: 'ENGINEER',
          authProvider: 'PASSWORD',
        },
      })

      // Mock session
      const session = createMockSession(user)

      // Call API
      const request = createMockRequest('GET', '/api/certificates')
      const response = await GET(request, { session })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.certificates).toEqual([])
    })

    it('returns user certificates', async () => {
      // Create user and certificate
      const user = await prisma.user.create({
        data: {
          email: 'engineer@test.com',
          name: 'Test Engineer',
          role: 'ENGINEER',
          authProvider: 'PASSWORD',
        },
      })

      await prisma.certificate.create({
        data: {
          certificateNumber: 'HTA-2024-001',
          status: 'DRAFT',
          customerName: 'Test Customer',
          createdById: user.id,
          lastModifiedById: user.id,
        },
      })

      // Call API
      const session = createMockSession(user)
      const response = await GET(createMockRequest('GET'), { session })

      expect(response.status).toBe(200)
      const data = await response.json()
      expect(data.certificates).toHaveLength(1)
      expect(data.certificates[0].certificateNumber).toBe('HTA-2024-001')
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

      const request = createMockRequest('POST', '/api/certificates', {
        body: {
          customerName: 'Test Customer',
          uucDescription: 'Digital Multimeter',
        },
      })

      const response = await POST(request, { session: createMockSession(user) })

      expect(response.status).toBe(201)
      const data = await response.json()
      expect(data.certificateNumber).toMatch(/HTA-2024-\d{3}/)

      // Verify in database
      const cert = await prisma.certificate.findUnique({
        where: { id: data.id },
      })
      expect(cert).not.toBeNull()
      expect(cert!.customerName).toBe('Test Customer')
    })
  })
})
```

### Database Transaction Tests

```typescript
// tests/integration/database/transactions.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { setupTestDb, prisma } from '../setup/test-db'

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
    expect(finalCount).toBe(initialCount) // No change
  })

  it('commits all changes on success', async () => {
    const user = await prisma.user.create({
      data: {
        email: 'test@test.com',
        name: 'Test',
        role: 'ENGINEER',
        authProvider: 'PASSWORD',
      },
    })

    await prisma.$transaction(async (tx) => {
      // Create certificate
      const cert = await tx.certificate.create({
        data: {
          certificateNumber: 'HTA-2024-001',
          status: 'DRAFT',
          createdById: user.id,
          lastModifiedById: user.id,
        },
      })

      // Create event
      await tx.certificateEvent.create({
        data: {
          certificateId: cert.id,
          sequenceNumber: 1,
          revision: 0,
          eventType: 'CERTIFICATE_CREATED',
          eventData: '{}',
          userId: user.id,
          userRole: 'ENGINEER',
        },
      })
    })

    // Both should exist
    const cert = await prisma.certificate.findFirst()
    const event = await prisma.certificateEvent.findFirst()

    expect(cert).not.toBeNull()
    expect(event).not.toBeNull()
    expect(event!.certificateId).toBe(cert!.id)
  })
})
```

### Workflow Integration Tests

```typescript
// tests/integration/api/workflows.test.ts
import { describe, it, expect, beforeAll, beforeEach, afterAll } from 'vitest'
import { setupTestDb, cleanupTestDb, prisma } from '../setup/test-db'

describe('Certificate Workflow', () => {
  let engineer: any
  let reviewer: any
  let certificate: any

  beforeAll(async () => {
    await setupTestDb()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await cleanupTestDb()

    // Create users
    engineer = await prisma.user.create({
      data: {
        email: 'engineer@test.com',
        name: 'Test Engineer',
        role: 'ENGINEER',
        authProvider: 'PASSWORD',
      },
    })

    reviewer = await prisma.user.create({
      data: {
        email: 'reviewer@test.com',
        name: 'Test Reviewer',
        role: 'ENGINEER',
        authProvider: 'PASSWORD',
      },
    })

    // Create certificate
    certificate = await prisma.certificate.create({
      data: {
        certificateNumber: 'HTA-2024-001',
        status: 'DRAFT',
        createdById: engineer.id,
        lastModifiedById: engineer.id,
        reviewerId: reviewer.id,
      },
    })
  })

  it('complete workflow: DRAFT → AUTHORIZED', async () => {
    // 1. Submit for review
    await submitCertificate(certificate.id, engineer.id)
    let cert = await prisma.certificate.findUnique({
      where: { id: certificate.id },
    })
    expect(cert!.status).toBe('IN_REVIEW')

    // 2. Reviewer approves
    await approveCertificate(certificate.id, reviewer.id)
    cert = await prisma.certificate.findUnique({
      where: { id: certificate.id },
    })
    expect(cert!.status).toBe('APPROVED')

    // ... continue workflow
  })

  it('revision flow: submit → revision requested → resubmit', async () => {
    // Submit
    await submitCertificate(certificate.id, engineer.id)

    // Request revision
    await requestRevision(certificate.id, reviewer.id, {
      sections: ['results'],
      comment: 'Check measurement values',
    })

    let cert = await prisma.certificate.findUnique({
      where: { id: certificate.id },
    })
    expect(cert!.status).toBe('IN_REVIEW') // Status unchanged

    // Check feedback created
    const feedback = await prisma.reviewFeedback.findFirst({
      where: { certificateId: certificate.id },
    })
    expect(feedback).not.toBeNull()
    expect(feedback!.feedbackType).toBe('REVISION_REQUEST')

    // Resubmit
    await resubmitCertificate(certificate.id, engineer.id)
    cert = await prisma.certificate.findUnique({
      where: { id: certificate.id },
    })
    expect(cert!.currentRevision).toBe(2)
  })
})
```

---

## Running Integration Tests

### SQLite

```bash
# Run all integration tests with SQLite
npm run test:integration

# Or manually
DATABASE_URL="file:./test.db" npx vitest run --config vitest.integration.config.ts
```

### PostgreSQL

```bash
# Start PostgreSQL (Docker)
docker run -d \
  --name hta-postgres-test \
  -e POSTGRES_USER=hta_test \
  -e POSTGRES_PASSWORD=hta_test_password \
  -e POSTGRES_DB=hta_calibration_test \
  -p 5433:5432 \
  postgres:16-alpine

# Wait for it to be ready
until docker exec hta-postgres-test pg_isready; do sleep 1; done

# Push schema
DATABASE_URL="postgresql://hta_test:hta_test_password@localhost:5433/hta_calibration_test" \
  npx prisma db push --schema=prisma/schema.postgres.prisma

# Run tests
npm run test:integration:postgres
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

export function createMockRequest(
  method: string,
  url = '/api/test',
  options: {
    body?: Record<string, unknown>
    headers?: Record<string, string>
  } = {}
) {
  return {
    method,
    url,
    json: () => Promise.resolve(options.body || {}),
    headers: new Headers(options.headers || {}),
    nextUrl: new URL(`http://localhost:3000${url}`),
  } as unknown as Request
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

```
Error: Unique constraint failed on the fields: (`email`)
```

**Fix**: Clean up before each test
```typescript
beforeEach(async () => {
  await cleanupTestDb()
})
```

### "Foreign key constraint failed"

```
Error: Foreign key constraint failed on the field: `createdById`
```

**Fix**: Create required relations first
```typescript
// Create user BEFORE certificate
const user = await prisma.user.create({ ... })
const cert = await prisma.certificate.create({
  data: {
    createdById: user.id,  // Now exists
    ...
  },
})
```

### Tests Interfering with Each Other

**Fix**: Use sequential execution
```typescript
// vitest.integration.config.ts
sequence: { concurrent: false },
fileParallelism: false,
```
