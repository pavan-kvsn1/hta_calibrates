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
│                          ┌─┴─────────────┴─┐  (Vitest + PostgreSQL)         │
│                          │      Unit       │  ← Pure logic, mocked DB       │
│                          └─────────────────┘  (Vitest, no DB)               │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Unit Tests (No Database)

For testing business logic without database:

```typescript
// tests/unit/certificate-service.test.ts
import { describe, it, expect, vi } from 'vitest'
import { calculateDueDate } from '@/lib/utils/tat-calculator'

// No database needed - testing pure functions
describe('calculateDueDate', () => {
  it('adds calibration tenure to calibration date', () => {
    const calibrationDate = new Date('2024-01-15')
    const tenureMonths = 12

    const dueDate = calculateDueDate(calibrationDate, tenureMonths)

    expect(dueDate).toEqual(new Date('2025-01-15'))
  })
})
```

### Mocking Prisma

```typescript
// tests/unit/user-service.test.ts
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { prisma } from '@/lib/prisma'
import { getUserWithCertificates } from '@/lib/services/user-service'

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
    const mockUser = {
      id: 'user-1',
      email: 'test@example.com',
      createdCertificates: [
        { id: 'cert-1', certificateNumber: 'HTA-001' },
      ],
    }

    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockUser)

    const result = await getUserWithCertificates('user-1')

    expect(prisma.user.findUnique).toHaveBeenCalledWith({
      where: { id: 'user-1' },
      include: { createdCertificates: true },
    })
    expect(result).toEqual(mockUser)
  })
})
```

---

## Integration Tests with PostgreSQL

All integration tests run against PostgreSQL (via Docker locally, via GitHub Actions service containers in CI).

### Docker Setup

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
      - "5433:5432"  # Different port to avoid conflicts with dev
    tmpfs:
      - /var/lib/postgresql/data  # In-memory for speed
```

### Test Setup

```typescript
// tests/integration/setup/postgres-setup.ts
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { execSync } from 'child_process'

let prisma: PrismaClient

const TEST_DATABASE_URL = process.env.DATABASE_URL ||
  'postgresql://hta_test:hta_test_password@localhost:5433/hta_calibration_test'

export async function setupTestDatabase() {
  const adapter = new PrismaPg({ connectionString: TEST_DATABASE_URL })
  prisma = new PrismaClient({ adapter })

  // Clean existing data
  await cleanupTestDatabase()

  return prisma
}

export async function cleanupTestDatabase() {
  // Delete all data in correct order (respecting foreign keys)
  await prisma.$transaction([
    prisma.certificateEvent.deleteMany(),
    prisma.reviewFeedback.deleteMany(),
    prisma.calibrationResult.deleteMany(),
    prisma.parameter.deleteMany(),
    prisma.certificate.deleteMany(),
    prisma.customerUser.deleteMany(),
    prisma.customerAccount.deleteMany(),
    prisma.user.deleteMany(),
  ])
}

export async function teardownTestDatabase() {
  await prisma.$disconnect()
}

export { prisma }
```

### Integration Test Example

```typescript
// tests/integration/api/certificates.test.ts
import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { setupTestDatabase, cleanupTestDatabase, prisma } from '../setup/postgres-setup'

describe('Certificate API', () => {
  beforeAll(async () => {
    await setupTestDatabase()
  })

  afterAll(async () => {
    await prisma.$disconnect()
  })

  beforeEach(async () => {
    await cleanupTestDatabase()
  })

  describe('createCertificate', () => {
    it('creates certificate with all required fields', async () => {
      // Arrange: Create user first
      const user = await prisma.user.create({
        data: {
          email: 'engineer@test.com',
          name: 'Test Engineer',
          role: 'ENGINEER',
          authProvider: 'PASSWORD',
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
          authProvider: 'PASSWORD',
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

  describe('transactions', () => {
    it('rolls back on error', async () => {
      const user = await prisma.user.create({
        data: {
          email: 'test@test.com',
          name: 'Test',
          role: 'ENGINEER',
          authProvider: 'PASSWORD',
        },
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
# .github/workflows/ci.yml
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
      with:
        node-version: '20'
    - run: npm ci
    - run: npx prisma generate
    - run: npx prisma db push --accept-data-loss
      env:
        DATABASE_URL: postgresql://hta_test:hta_test_password@localhost:5432/hta_calibration_test
    - run: npm run test:integration
      env:
        DATABASE_URL: postgresql://hta_test:hta_test_password@localhost:5432/hta_calibration_test
```

---

## Test Coverage Goals

| Layer | Target | Notes |
|-------|--------|-------|
| Unit tests | 80% | Business logic, utilities |
| Integration | 70% | API routes, database operations |
| E2E | Critical paths | Main user journeys |

---

## Common Test Failures

### "Unique constraint failed" in parallel tests

**Cause**: Tests running in parallel share database

**Fix**: Run tests sequentially
```typescript
// vitest.integration.config.ts
sequence: { concurrent: false },
fileParallelism: false,
```

Or use unique identifiers:
```typescript
const uniqueEmail = `test-${Date.now()}-${Math.random()}@test.com`
```

### "Foreign key constraint failed"

**Cause**: Related record doesn't exist

**Fix**: Create dependencies first
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

### "Connection refused"

**Cause**: PostgreSQL not running

**Fix**: Start the test database
```bash
npm run db:test:start
```
