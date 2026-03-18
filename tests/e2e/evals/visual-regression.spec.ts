import { test, expect } from '@playwright/test'
import { TEST_USERS } from '../fixtures/test-data'

/**
 * Visual Regression Tests
 *
 * These tests capture screenshots of key pages for visual comparison.
 * Run nightly to detect unintended visual changes.
 *
 * Usage:
 * - First run: Creates baseline screenshots
 * - Subsequent runs: Compares against baselines
 *
 * To update baselines:
 *   npx playwright test tests/e2e/visual/ --update-snapshots
 *
 * Note: These tests are skipped in CI until baseline snapshots are generated
 * and committed. Baselines must be generated on Linux to match CI environment.
 * Run locally with: npx playwright test tests/e2e/evals/visual-regression.spec.ts --update-snapshots
 */

// Skip all visual regression tests in CI until baseline snapshots are committed
const isCI = process.env.CI === 'true'
test.skip(() => isCI, 'Visual regression tests skipped in CI - baseline snapshots not yet committed')

// Configure snapshot options
const snapshotOptions = {
  maxDiffPixels: 100, // Allow small pixel differences
  threshold: 0.2, // 20% threshold for pixel comparison
}

test.describe('Visual Regression - Public Pages', () => {
  test('login page visual snapshot', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Wait for any animations to complete
    await page.waitForTimeout(500)

    await expect(page).toHaveScreenshot('login-page.png', snapshotOptions)
  })

  test('customer login page visual snapshot', async ({ page }) => {
    await page.goto('/customer/login')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await expect(page).toHaveScreenshot('customer-login-page.png', snapshotOptions)
  })
})

test.describe('Visual Regression - Engineer Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"], input[name="email"]', TEST_USERS.engineer.email)
    await page.fill('input[type="password"]', TEST_USERS.engineer.password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 })
  })

  test('engineer dashboard visual snapshot', async ({ page }) => {
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Mask dynamic content like timestamps
    await page.evaluate(() => {
      document.querySelectorAll('[data-testid="timestamp"], time').forEach(el => {
        el.textContent = '2026-01-01 00:00'
      })
    })

    await expect(page).toHaveScreenshot('engineer-dashboard.png', snapshotOptions)
  })

  test('new certificate form visual snapshot', async ({ page }) => {
    await page.goto('/certificates/new')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await expect(page).toHaveScreenshot('new-certificate-form.png', snapshotOptions)
  })
})

test.describe('Visual Regression - Admin Dashboard', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"], input[name="email"]', TEST_USERS.admin.email)
    await page.fill('input[type="password"]', TEST_USERS.admin.password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/admin|dashboard/, { timeout: 10000 })
  })

  test('Admin dashboard visual snapshot', async ({ page }) => {
    await page.goto('/admin')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Mask dynamic content
    await page.evaluate(() => {
      document.querySelectorAll('[data-testid="timestamp"], time').forEach(el => {
        el.textContent = '2026-01-01 00:00'
      })
    })

    await expect(page).toHaveScreenshot('admin-dashboard.png', snapshotOptions)
  })
})

test.describe('Visual Regression - Customer Portal', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/customer/login')
    await page.fill('input[type="email"], input[name="email"]', TEST_USERS.customer.email)
    await page.fill('input[type="password"]', TEST_USERS.customer.password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/customer\/dashboard/, { timeout: 10000 })
  })

  test('customer dashboard visual snapshot', async ({ page }) => {
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    // Mask dynamic content
    await page.evaluate(() => {
      document.querySelectorAll('[data-testid="timestamp"], time').forEach(el => {
        el.textContent = '2026-01-01 00:00'
      })
    })

    await expect(page).toHaveScreenshot('customer-dashboard.png', snapshotOptions)
  })
})

test.describe('Visual Regression - Responsive Design', () => {
  test('login page mobile view', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }) // iPhone SE
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await expect(page).toHaveScreenshot('login-page-mobile.png', snapshotOptions)
  })

  test('login page tablet view', async ({ page }) => {
    await page.setViewportSize({ width: 768, height: 1024 }) // iPad
    await page.goto('/login')
    await page.waitForLoadState('networkidle')
    await page.waitForTimeout(500)

    await expect(page).toHaveScreenshot('login-page-tablet.png', snapshotOptions)
  })
})

test.describe('Visual Regression - Component States', () => {
  test('login form with validation error', async ({ page }) => {
    await page.goto('/login')
    await page.waitForLoadState('networkidle')

    // Submit empty form to trigger validation
    await page.click('button[type="submit"]')
    await page.waitForTimeout(500)

    await expect(page).toHaveScreenshot('login-form-validation-error.png', snapshotOptions)
  })

  test('login form with invalid credentials error', async ({ page }) => {
    await page.goto('/login')
    await page.fill('input[type="email"], input[name="email"]', 'invalid@test.com')
    await page.fill('input[type="password"]', 'wrongpassword')
    await page.click('button[type="submit"]')

    // Wait for error message
    await page.waitForTimeout(2000)

    await expect(page).toHaveScreenshot('login-form-invalid-credentials.png', snapshotOptions)
  })
})
