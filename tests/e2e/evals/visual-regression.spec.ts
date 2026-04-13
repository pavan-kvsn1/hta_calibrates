import { test, takeSnapshot } from '@chromatic-com/playwright'
import { expect } from '@playwright/test'
import { loginAsEngineer, loginAsAdmin, loginAsCustomer } from '../fixtures/test-utils'

/**
 * Visual Regression Tests
 *
 * These tests capture screenshots of key pages for visual comparison.
 * Uses Chromatic for cloud-based visual testing with automatic baseline management.
 *
 * Usage:
 * - Run tests: npx playwright test tests/e2e/evals/visual-regression.spec.ts
 * - Upload to Chromatic: npm run chromatic
 *
 * Chromatic handles:
 * - Baseline storage in the cloud
 * - Cross-browser consistency
 * - AI-powered diff detection
 * - Visual review dashboard
 */

test.describe('Visual Regression - Public Pages', () => {
  test('login page visual snapshot', async ({ page }, testInfo) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await takeSnapshot(page, 'login-page', testInfo)
  })

  test('customer login page visual snapshot', async ({ page }, testInfo) => {
    await page.goto('/customer/login')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await takeSnapshot(page, 'customer-login-page', testInfo)
  })
})

test.describe.skip('Visual Regression - Engineer Dashboard', () => {
  // Skip: Requires seeded database with test users
  test.beforeEach(async ({ page }) => {
    await loginAsEngineer(page)
  })

  test('engineer dashboard visual snapshot', async ({ page }, testInfo) => {
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Mask dynamic content like timestamps
    await page.evaluate(() => {
      document.querySelectorAll('[data-testid="timestamp"], time').forEach(el => {
        el.textContent = '2026-01-01 00:00'
      })
    })

    await takeSnapshot(page, 'engineer-dashboard', testInfo)
  })

  test('new certificate form visual snapshot', async ({ page }, testInfo) => {
    await page.goto('/dashboard/certificates/new')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Mask dynamic content (certificate number contains timestamp)
    await page.evaluate(() => {
      document.querySelectorAll('h1, h2, h3').forEach(el => {
        if (el.textContent?.includes('DRAFT-')) {
          el.textContent = 'DRAFT-XXXXXXXX'
        }
      })
      document.querySelectorAll('input[name="certificateNumber"], input[id="certificateNumber"]').forEach(el => {
        const input = el as HTMLInputElement
        if (input.value.includes('DRAFT-')) {
          input.value = 'DRAFT-XXXXXXXX'
        }
      })
    })

    await takeSnapshot(page, 'new-certificate-form', testInfo)
  })
})

test.describe.skip('Visual Regression - Admin Dashboard', () => {
  // Skip: Requires seeded database with test users
  test.beforeEach(async ({ page }) => {
    await loginAsAdmin(page)
  })

  test('Admin dashboard visual snapshot', async ({ page }, testInfo) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await page.evaluate(() => {
      document.querySelectorAll('[data-testid="timestamp"], time').forEach(el => {
        el.textContent = '2026-01-01 00:00'
      })
    })

    await takeSnapshot(page, 'admin-dashboard', testInfo)
  })
})

test.describe.skip('Visual Regression - Customer Portal', () => {
  // Skip: Requires seeded database with test users
  test.beforeEach(async ({ page }) => {
    await loginAsCustomer(page)
  })

  test('customer dashboard visual snapshot', async ({ page }, testInfo) => {
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await page.evaluate(() => {
      document.querySelectorAll('[data-testid="timestamp"], time').forEach(el => {
        el.textContent = '2026-01-01 00:00'
      })
    })

    await takeSnapshot(page, 'customer-dashboard', testInfo)
  })
})

test.describe('Visual Regression - Responsive Design', () => {
  test('login page mobile view', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 375, height: 667 })
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await takeSnapshot(page, 'login-page-mobile', testInfo)
  })

  test('login page tablet view', async ({ page }, testInfo) => {
    await page.setViewportSize({ width: 768, height: 1024 })
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await takeSnapshot(page, 'login-page-tablet', testInfo)
  })
})

test.describe('Visual Regression - Component States', () => {
  test('login form with validation error', async ({ page }, testInfo) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    await page.click('button[type="submit"]')
    await page.waitForTimeout(500)

    await takeSnapshot(page, 'login-form-validation-error', testInfo)
  })

  test('login form with invalid credentials error', async ({ page }, testInfo) => {
    await page.goto('/login')
    await page.fill('input[type="email"], input[name="email"]', 'invalid@test.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Wait for error message to appear (or page to settle after auth attempt)
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(1000)

    await takeSnapshot(page, 'login-form-invalid-credentials', testInfo)
  })
})
