# Testing Patterns & Best Practices

## General Principles

### Test Naming Convention

```typescript
// Pattern: describe [what] when [condition] should [expectation]

describe('TAT Calculator', () => {
  describe('calculateCertificateTAT', () => {
    it('returns null when events array is empty', () => {})
    it('calculates total hours for completed certificate', () => {})
    it('tracks revision cycles when revisions requested', () => {})
  })
})
```

### Arrange-Act-Assert (AAA)

```typescript
it('creates certificate with correct number', async () => {
  // Arrange
  const user = await createTestUser()
  const input = { customerName: 'Test Co', uucDescription: 'DMM' }

  // Act
  const result = await createCertificate(input, user.id)

  // Assert
  expect(result.certificateNumber).toMatch(/HTA-2024-\d{3}/)
  expect(result.status).toBe('DRAFT')
})
```

---

## Mocking Patterns

### Mock Module

```typescript
// Mock entire module
vi.mock('@/lib/prisma', () => ({
  prisma: {
    certificate: {
      findMany: vi.fn(),
      create: vi.fn(),
    },
  },
}))

// Use mocked functions
vi.mocked(prisma.certificate.findMany).mockResolvedValue([mockCert])
```

### Mock Implementation

```typescript
// Mock specific implementation
vi.mocked(prisma.certificate.findUnique).mockImplementation(
  async ({ where }) => {
    if (where.id === 'existing-id') {
      return mockCertificate
    }
    return null
  }
)
```

### Spy on Function

```typescript
// Spy without replacing
const spy = vi.spyOn(console, 'log')

doSomething()

expect(spy).toHaveBeenCalledWith('expected message')
spy.mockRestore()
```

### Partial Mock

```typescript
// Mock only some exports
vi.mock('@/lib/utils', async () => {
  const actual = await vi.importActual<typeof import('@/lib/utils')>('@/lib/utils')
  return {
    ...actual,
    sendEmail: vi.fn(),  // Only mock this
  }
})
```

---

## Fixture Patterns

### Factory Functions

```typescript
// tests/factories/user.ts
export function createTestUser(overrides: Partial<User> = {}): User {
  return {
    id: `user-${Date.now()}`,
    email: `test-${Date.now()}@example.com`,
    name: 'Test User',
    role: 'ENGINEER',
    authProvider: 'PASSWORD',
    isActive: true,
    createdAt: new Date(),
    updatedAt: new Date(),
    ...overrides,
  }
}

// Usage
const admin = createTestUser({ role: 'ADMIN', name: 'Admin User' })
const engineer = createTestUser({ role: 'ENGINEER' })
```

### Builder Pattern

```typescript
// tests/builders/certificate.ts
export class CertificateBuilder {
  private data: Partial<Certificate> = {
    id: `cert-${Date.now()}`,
    status: 'DRAFT',
    currentRevision: 0,
  }

  withStatus(status: string) {
    this.data.status = status
    return this
  }

  withCustomer(name: string) {
    this.data.customerName = name
    return this
  }

  withReviewer(id: string) {
    this.data.reviewerId = id
    return this
  }

  inReview() {
    this.data.status = 'IN_REVIEW'
    this.data.submittedAt = new Date()
    return this
  }

  build(): Certificate {
    return this.data as Certificate
  }
}

// Usage
const cert = new CertificateBuilder()
  .withCustomer('Test Co')
  .withReviewer('reviewer-1')
  .inReview()
  .build()
```

### Shared Test Data

```typescript
// tests/fixtures/test-data.ts
export const testUsers = {
  admin: {
    id: 'admin-1',
    email: 'admin@htaipl.com',
    role: 'ADMIN',
  },
  engineer: {
    id: 'eng-1',
    email: 'kiran@htaipl.com',
    role: 'ENGINEER',
  },
}

export const testCertificates = {
  draft: {
    id: 'cert-draft',
    status: 'DRAFT',
    certificateNumber: 'HTA-2024-001',
  },
  inReview: {
    id: 'cert-review',
    status: 'IN_REVIEW',
    certificateNumber: 'HTA-2024-002',
  },
}
```

---

## Async Testing Patterns

### Await Promises

```typescript
it('fetches data', async () => {
  const result = await fetchCertificates()
  expect(result).toHaveLength(5)
})
```

### Test Rejected Promises

```typescript
it('throws on invalid input', async () => {
  await expect(createCertificate({})).rejects.toThrow('Missing required fields')
})
```

### Wait for Side Effects

```typescript
it('eventually updates status', async () => {
  await submitCertificate(certId)

  // Poll until status changes
  await vi.waitFor(async () => {
    const cert = await getCertificate(certId)
    expect(cert.status).toBe('IN_REVIEW')
  }, { timeout: 5000 })
})
```

---

## Database Testing Patterns

### Transaction Isolation

```typescript
describe('with transaction', () => {
  it('rolls back on test failure', async () => {
    await prisma.$transaction(async (tx) => {
      // Test operations use tx
      const cert = await tx.certificate.create({ ... })
      expect(cert).toBeDefined()

      // Transaction is rolled back after test
      throw new Error('Deliberate rollback')
    }).catch(() => {})
  })
})
```

### Cleanup Between Tests

```typescript
beforeEach(async () => {
  // Delete in correct order (respect FK constraints)
  await prisma.certificateEvent.deleteMany()
  await prisma.certificate.deleteMany()
  await prisma.user.deleteMany()
})
```

### Snapshot Assertions

```typescript
it('returns correct data shape', async () => {
  const cert = await getCertificate('cert-1')

  // Remove volatile fields
  const { id, createdAt, updatedAt, ...stable } = cert

  expect(stable).toMatchSnapshot()
})
```

---

## E2E Testing Patterns

### Page Object Pattern

```typescript
// tests/e2e/pages/certificate.page.ts
export class CertificatePage {
  constructor(private page: Page) {}

  async fillBasicInfo(data: { customer: string; uuc: string }) {
    await this.page.fill('[name="customerName"]', data.customer)
    await this.page.fill('[name="uucDescription"]', data.uuc)
  }

  async save() {
    await this.page.click('button:has-text("Save")')
    await this.page.waitForResponse('**/api/certificates')
  }

  async getStatus() {
    return this.page.locator('[data-testid="status"]').innerText()
  }
}
```

### Authentication Context

```typescript
// tests/e2e/fixtures/auth.ts
import { test as base } from '@playwright/test'

type AuthFixtures = {
  authenticatedPage: Page
}

export const test = base.extend<AuthFixtures>({
  authenticatedPage: async ({ page }, use) => {
    // Login before test
    await page.goto('/login')
    await page.fill('[name="email"]', 'admin@htaipl.com')
    await page.fill('[name="password"]', 'admin123')
    await page.click('button[type="submit"]')
    await page.waitForURL('/admin')

    // Provide authenticated page
    await use(page)
  },
})

// Usage
test('authenticated test', async ({ authenticatedPage }) => {
  // Already logged in
  await authenticatedPage.goto('/admin/certificates')
})
```

### API Mocking

```typescript
test('handles API error gracefully', async ({ page }) => {
  // Mock API to return error
  await page.route('**/api/certificates', (route) => {
    route.fulfill({
      status: 500,
      body: JSON.stringify({ error: 'Server error' }),
    })
  })

  await page.goto('/dashboard')

  // Should show error state
  await expect(page.locator('[data-testid="error"]')).toBeVisible()
})
```

---

## Coverage Patterns

### Ignore Coverage for Specific Lines

```typescript
// Istanbul-style ignore comments work with v8

/* istanbul ignore next */
function hardToTestCode() {
  // This won't count toward coverage
}

/* istanbul ignore if */
if (process.env.DEBUG) {
  console.log('Debug info')
}
```

### Focus on Critical Paths

```typescript
// Prioritize testing:
// 1. Business logic (TAT calculator, status transitions)
// 2. Data validation (API inputs)
// 3. Error handling (edge cases)

// Don't over-test:
// - Simple getters/setters
// - Framework code
// - Third-party library usage
```

---

## Test Organization

### Group by Feature

```
src/lib/certificates/
├── create.ts
├── create.test.ts
├── submit.ts
├── submit.test.ts
└── utils.ts
    └── utils.test.ts
```

### Group by Type

```
tests/
├── unit/
│   ├── tat-calculator.test.ts
│   └── status-utils.test.ts
├── integration/
│   ├── certificates.test.ts
│   └── auth.test.ts
└── e2e/
    ├── login.spec.ts
    └── workflow.spec.ts
```

---

## Common Anti-Patterns

### Don't Test Implementation Details

```typescript
// Bad: Tests internal state
it('sets isLoading to true', () => {
  const store = useStore()
  store.fetchData()
  expect(store.isLoading).toBe(true)  // Implementation detail
})

// Good: Tests observable behavior
it('shows loading indicator', async () => {
  render(<DataList />)
  expect(screen.getByTestId('loading')).toBeVisible()
})
```

### Don't Share State Between Tests

```typescript
// Bad: Tests affect each other
let testCert: Certificate

beforeAll(async () => {
  testCert = await createCertificate()  // Shared!
})

// Good: Each test creates its own data
beforeEach(async () => {
  testCert = await createCertificate()
})
```

### Don't Use Sleep

```typescript
// Bad: Arbitrary wait
await page.click('button')
await page.waitForTimeout(2000)  // Why 2 seconds?

// Good: Wait for condition
await page.click('button')
await page.waitForSelector('[data-testid="result"]')
```
