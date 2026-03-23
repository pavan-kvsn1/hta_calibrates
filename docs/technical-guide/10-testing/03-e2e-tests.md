# E2E Tests Deep Dive

## Framework: Playwright

Playwright enables reliable end-to-end testing across browsers.

---

## Configuration

```typescript
// playwright.config.ts
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  forbidOnly: !!process.env.CI,      // Fail if .only in CI
  retries: process.env.CI ? 2 : 0,   // Retry flaky tests in CI
  workers: process.env.CI ? 1 : undefined,
  timeout: 60000,                     // 60s per test
  expect: { timeout: 10000 },         // 10s for assertions

  reporter: process.env.CI
    ? [['html'], ['github'], ['json', { outputFile: 'results.json' }]]
    : [['html'], ['list']],

  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
    video: process.env.CI ? 'on-first-retry' : 'off',
  },

  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
  ],

  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
```

---

## Test Structure

```
tests/e2e/
├── workflows/
│   ├── 01-certificate-creation.spec.ts
│   ├── 02-submit-review.spec.ts
│   ├── 03-unlock-request.spec.ts
│   ├── 04-customer-review.spec.ts
│   ├── 05-feedback-address.spec.ts
│   └── 06-admin-authorization.spec.ts
├── fixtures/
│   ├── auth.ts
│   └── test-data.ts
├── pages/
│   ├── login.page.ts
│   ├── dashboard.page.ts
│   └── certificate.page.ts
└── visual/
    └── screenshots.spec.ts
```

---

## E2E Test Examples

### Basic Login Test

```typescript
// tests/e2e/auth/login.spec.ts
import { test, expect } from '@playwright/test'

test.describe('Authentication', () => {
  test('logs in with valid credentials', async ({ page }) => {
    await page.goto('/login')

    // Fill login form
    await page.fill('[name="email"]', 'admin@htaipl.com')
    await page.fill('[name="password"]', 'admin123')
    await page.click('button[type="submit"]')

    // Should redirect to dashboard
    await expect(page).toHaveURL('/admin')
    await expect(page.locator('h1')).toContainText('Dashboard')
  })

  test('shows error for invalid credentials', async ({ page }) => {
    await page.goto('/login')

    await page.fill('[name="email"]', 'wrong@example.com')
    await page.fill('[name="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Should show error
    await expect(page.locator('[role="alert"]')).toBeVisible()
    await expect(page.locator('[role="alert"]')).toContainText('Invalid')
  })
})
```

### Certificate Workflow Test

```typescript
// tests/e2e/workflows/01-certificate-creation.spec.ts
import { test, expect } from '@playwright/test'
import { loginAsEngineer } from '../fixtures/auth'

test.describe('Certificate Creation', () => {
  test.beforeEach(async ({ page }) => {
    await loginAsEngineer(page)
  })

  test('creates new certificate', async ({ page }) => {
    // Navigate to create page
    await page.goto('/dashboard/certificates/new')

    // Fill basic info
    await page.fill('[name="customerName"]', 'Test Company Pvt Ltd')
    await page.fill('[name="uucDescription"]', 'Digital Multimeter')
    await page.fill('[name="uucMake"]', 'Fluke')
    await page.fill('[name="uucModel"]', '87V')
    await page.fill('[name="uucSerialNumber"]', 'DMM-001')

    // Add parameter
    await page.click('button:has-text("Add Parameter")')
    await page.fill('[name="parameterName"]', 'DC Voltage')
    await page.fill('[name="rangeMin"]', '0')
    await page.fill('[name="rangeMax"]', '1000')
    await page.selectOption('[name="rangeUnit"]', 'V')

    // Save
    await page.click('button:has-text("Save Draft")')

    // Verify success
    await expect(page.locator('[role="alert"]')).toContainText('saved')

    // Should have certificate number
    await expect(page.locator('[data-testid="cert-number"]')).toBeVisible()
  })

  test('validates required fields', async ({ page }) => {
    await page.goto('/dashboard/certificates/new')

    // Try to save without required fields
    await page.click('button:has-text("Save Draft")')

    // Should show validation errors
    await expect(page.locator('text=Customer name is required')).toBeVisible()
    await expect(page.locator('text=UUC description is required')).toBeVisible()
  })
})
```

### Full Workflow Test

```typescript
// tests/e2e/workflows/full-workflow.spec.ts
import { test, expect } from '@playwright/test'
import { loginAsEngineer, loginAsReviewer, loginAsAdmin } from '../fixtures/auth'

test.describe('Complete Certificate Workflow', () => {
  let certificateNumber: string

  test('Step 1: Engineer creates certificate', async ({ page }) => {
    await loginAsEngineer(page)
    await page.goto('/dashboard/certificates/new')

    // Fill and save
    await page.fill('[name="customerName"]', 'Workflow Test Company')
    await page.fill('[name="uucDescription"]', 'Test Instrument')
    await page.click('button:has-text("Save Draft")')

    // Get certificate number
    certificateNumber = await page.locator('[data-testid="cert-number"]').innerText()
    expect(certificateNumber).toMatch(/HTA-2024-\d{3}/)
  })

  test('Step 2: Engineer submits for review', async ({ page }) => {
    await loginAsEngineer(page)
    await page.goto(`/dashboard/certificates/${certificateNumber}`)

    // Select reviewer
    await page.selectOption('[name="reviewerId"]', { label: 'Kiran Kumar' })

    // Submit
    await page.click('button:has-text("Submit for Review")')
    await page.click('button:has-text("Confirm")')

    // Verify status change
    await expect(page.locator('[data-testid="status"]')).toContainText('In Review')
  })

  test('Step 3: Reviewer approves', async ({ page }) => {
    await loginAsReviewer(page)
    await page.goto('/dashboard/reviewer')

    // Find certificate in queue
    await page.click(`text=${certificateNumber}`)

    // Approve
    await page.click('button:has-text("Approve")')
    await page.fill('[name="signature"]', 'Kiran Kumar')
    await page.click('button:has-text("Confirm Approval")')

    // Verify approved
    await expect(page.locator('[data-testid="status"]')).toContainText('Approved')
  })

  test('Step 4: Admin authorizes', async ({ page }) => {
    await loginAsAdmin(page)
    await page.goto('/admin/authorization')

    // Find certificate
    await page.click(`text=${certificateNumber}`)

    // Authorize
    await page.click('button:has-text("Authorize")')
    await page.fill('[name="signature"]', 'Hemanth Kumar')
    await page.click('button:has-text("Confirm")')

    // Verify authorized
    await expect(page.locator('[data-testid="status"]')).toContainText('Authorized')
  })
})
```

---

## Fixtures

### Authentication Fixture

```typescript
// tests/e2e/fixtures/auth.ts
import { Page } from '@playwright/test'

export async function loginAsEngineer(page: Page) {
  await page.goto('/login')
  await page.fill('[name="email"]', 'kiran@htaipl.com')
  await page.fill('[name="password"]', 'engineer123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard')
}

export async function loginAsReviewer(page: Page) {
  await page.goto('/login')
  await page.fill('[name="email"]', 'rajesh@htaipl.com')
  await page.fill('[name="password"]', 'engineer123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/dashboard')
}

export async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.fill('[name="email"]', 'admin@htaipl.com')
  await page.fill('[name="password"]', 'admin123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/admin')
}

export async function loginAsCustomer(page: Page) {
  await page.goto('/customer/login')
  await page.fill('[name="email"]', 'customer@example.com')
  await page.fill('[name="password"]', 'customer123')
  await page.click('button[type="submit"]')
  await page.waitForURL('/customer/dashboard')
}
```

### Test Data Fixture

```typescript
// tests/e2e/fixtures/test-data.ts
import { test as base } from '@playwright/test'
import { prisma } from '@/lib/prisma'

export const test = base.extend<{
  testCertificate: { id: string; number: string }
}>({
  testCertificate: async ({}, use) => {
    // Create test certificate
    const cert = await prisma.certificate.create({
      data: {
        certificateNumber: `TEST-${Date.now()}`,
        status: 'DRAFT',
        customerName: 'E2E Test Customer',
        createdById: 'engineer-id',
        lastModifiedById: 'engineer-id',
      },
    })

    // Use in test
    await use({ id: cert.id, number: cert.certificateNumber })

    // Cleanup after test
    await prisma.certificate.delete({ where: { id: cert.id } })
  },
})
```

---

## Page Object Model

```typescript
// tests/e2e/pages/login.page.ts
import { Page, Locator } from '@playwright/test'

export class LoginPage {
  readonly page: Page
  readonly emailInput: Locator
  readonly passwordInput: Locator
  readonly submitButton: Locator
  readonly errorAlert: Locator

  constructor(page: Page) {
    this.page = page
    this.emailInput = page.locator('[name="email"]')
    this.passwordInput = page.locator('[name="password"]')
    this.submitButton = page.locator('button[type="submit"]')
    this.errorAlert = page.locator('[role="alert"]')
  }

  async goto() {
    await this.page.goto('/login')
  }

  async login(email: string, password: string) {
    await this.emailInput.fill(email)
    await this.passwordInput.fill(password)
    await this.submitButton.click()
  }
}

// Usage in test
import { LoginPage } from '../pages/login.page'

test('login test', async ({ page }) => {
  const loginPage = new LoginPage(page)
  await loginPage.goto()
  await loginPage.login('admin@htaipl.com', 'admin123')
})
```

---

## Running E2E Tests

```bash
# Run all E2E tests
npx playwright test

# Run specific browser
npx playwright test --project=chromium

# Run specific file
npx playwright test tests/e2e/workflows/01-certificate-creation.spec.ts

# Run in headed mode (see browser)
npx playwright test --headed

# Run in debug mode
npx playwright test --debug

# Run with UI mode
npx playwright test --ui

# Run and show report
npx playwright test && npx playwright show-report
```

---

## Debugging E2E Tests

### Interactive Debugging

```bash
# Debug mode with inspector
npx playwright test --debug

# Pause at specific line (add in test)
await page.pause()
```

### Trace Viewer

```bash
# Enable traces
npx playwright test --trace on

# View traces
npx playwright show-trace trace.zip
```

### Screenshots and Videos

```typescript
// Take screenshot
await page.screenshot({ path: 'screenshot.png' })

// Record video (configure in playwright.config.ts)
use: {
  video: 'on',
}
```

---

## Best Practices

### 1. Use Data-Testid Attributes

```tsx
// In component
<div data-testid="certificate-status">{status}</div>

// In test
await expect(page.locator('[data-testid="certificate-status"]')).toContainText('Draft')
```

### 2. Wait for Network/State

```typescript
// Wait for API response
await page.waitForResponse('**/api/certificates')

// Wait for element
await page.waitForSelector('[data-testid="loaded"]')

// Wait for navigation
await page.waitForURL('/dashboard')
```

### 3. Isolate Tests

```typescript
test.describe('Feature X', () => {
  test.beforeEach(async ({ page }) => {
    // Clean state before each test
    await resetTestData()
    await loginAsEngineer(page)
  })
})
```

### 4. Use Meaningful Assertions

```typescript
// Good
await expect(page.locator('[data-testid="status"]')).toHaveText('Approved')
await expect(page).toHaveURL(/\/dashboard/)

// Avoid
await expect(page.locator('.some-class')).toBeTruthy()
```
