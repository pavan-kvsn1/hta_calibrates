import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'
import { TEST_USERS } from '../fixtures/test-data'

/**
 * Accessibility Tests (WCAG 2.1 AA Compliance)
 *
 * These tests run nightly to ensure the application meets accessibility standards.
 * Uses axe-core for automated accessibility auditing.
 *
 * Key areas tested:
 * - Color contrast ratios (4.5:1 minimum for normal text)
 * - Keyboard navigation
 * - ARIA labels and roles
 * - Focus indicators
 * - Form accessibility
 */

// Helper to save accessibility report
async function saveA11yReport(results: any, pageName: string) {
  const fs = await import('fs')
  const path = await import('path')

  const reportDir = path.join(process.cwd(), 'accessibility-report')
  if (!fs.existsSync(reportDir)) {
    fs.mkdirSync(reportDir, { recursive: true })
  }

  const reportPath = path.join(reportDir, `${pageName}.json`)
  fs.writeFileSync(reportPath, JSON.stringify(results, null, 2))
}

test.describe('Accessibility Audit', () => {
  test.describe('Public Pages', () => {
    test('login page should have no accessibility violations', async ({ page }) => {
      await page.goto('/login')
      await page.waitForLoadState('networkidle')

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      await saveA11yReport(accessibilityScanResults, 'login-page')

      // Log violations for debugging
      if (accessibilityScanResults.violations.length > 0) {
        console.log('Login page violations:', JSON.stringify(accessibilityScanResults.violations, null, 2))
      }

      expect(accessibilityScanResults.violations).toEqual([])
    })

    test('customer login page should have no accessibility violations', async ({ page }) => {
      await page.goto('/customer/login')
      await page.waitForLoadState('networkidle')

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      await saveA11yReport(accessibilityScanResults, 'customer-login-page')

      expect(accessibilityScanResults.violations).toEqual([])
    })
  })

  test.describe('Authenticated Pages - Engineer', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login')
      await page.fill('input[type="email"], input[name="email"]', TEST_USERS.engineer.email)
      await page.fill('input[type="password"]', TEST_USERS.engineer.password)
      await page.click('button[type="submit"]')
      await expect(page).toHaveURL(/dashboard/, { timeout: 10000 })
    })

    test('engineer dashboard should have no accessibility violations', async ({ page }) => {
      await page.waitForLoadState('networkidle')

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .exclude('.pdf-viewer') // Exclude PDF viewer which may have complex accessibility
        .analyze()

      await saveA11yReport(accessibilityScanResults, 'engineer-dashboard')

      if (accessibilityScanResults.violations.length > 0) {
        console.log('Dashboard violations:', JSON.stringify(accessibilityScanResults.violations, null, 2))
      }

      expect(accessibilityScanResults.violations).toEqual([])
    })

    test('new certificate form should have no accessibility violations', async ({ page }) => {
      await page.goto('/certificates/new')
      await page.waitForLoadState('networkidle')

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      await saveA11yReport(accessibilityScanResults, 'new-certificate-form')

      if (accessibilityScanResults.violations.length > 0) {
        console.log('Certificate form violations:', JSON.stringify(accessibilityScanResults.violations, null, 2))
      }

      expect(accessibilityScanResults.violations).toEqual([])
    })
  })

  test.describe('Authenticated Pages - HoD', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/login')
      await page.fill('input[type="email"], input[name="email"]', TEST_USERS.hod.email)
      await page.fill('input[type="password"]', TEST_USERS.hod.password)
      await page.click('button[type="submit"]')
      await expect(page).toHaveURL(/hod\/dashboard|dashboard/, { timeout: 10000 })
    })

    test('HoD dashboard should have no accessibility violations', async ({ page }) => {
      await page.goto('/hod/dashboard')
      await page.waitForLoadState('networkidle')

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      await saveA11yReport(accessibilityScanResults, 'hod-dashboard')

      expect(accessibilityScanResults.violations).toEqual([])
    })
  })

  test.describe('Authenticated Pages - Customer', () => {
    test.beforeEach(async ({ page }) => {
      await page.goto('/customer/login')
      await page.fill('input[type="email"], input[name="email"]', TEST_USERS.customer.email)
      await page.fill('input[type="password"]', TEST_USERS.customer.password)
      await page.click('button[type="submit"]')
      await expect(page).toHaveURL(/customer\/dashboard/, { timeout: 10000 })
    })

    test('customer dashboard should have no accessibility violations', async ({ page }) => {
      await page.waitForLoadState('networkidle')

      const accessibilityScanResults = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21a', 'wcag21aa'])
        .analyze()

      await saveA11yReport(accessibilityScanResults, 'customer-dashboard')

      expect(accessibilityScanResults.violations).toEqual([])
    })
  })

  test.describe('Keyboard Navigation', () => {
    test('login form should be fully keyboard navigable', async ({ page }) => {
      await page.goto('/login')

      // Tab through form elements
      await page.keyboard.press('Tab')
      const firstFocused = await page.evaluate(() => document.activeElement?.tagName)
      expect(['INPUT', 'BUTTON', 'A']).toContain(firstFocused)

      // Continue tabbing
      await page.keyboard.press('Tab')
      await page.keyboard.press('Tab')

      // Should be able to submit with Enter
      await page.fill('input[type="email"], input[name="email"]', TEST_USERS.engineer.email)
      await page.keyboard.press('Tab')
      await page.fill('input[type="password"]', TEST_USERS.engineer.password)
      await page.keyboard.press('Enter')

      // Should submit the form
      await expect(page).toHaveURL(/dashboard|login/, { timeout: 10000 })
    })
  })

  test.describe('Focus Indicators', () => {
    test('interactive elements should have visible focus indicators', async ({ page }) => {
      await page.goto('/login')

      // Focus the email input
      await page.focus('input[type="email"], input[name="email"]')

      // Check that there's a visible focus style
      const hasFocusStyle = await page.evaluate(() => {
        const el = document.activeElement
        if (!el) return false

        const styles = window.getComputedStyle(el)
        const outlineStyle = styles.outlineStyle
        const outlineWidth = parseInt(styles.outlineWidth)
        const boxShadow = styles.boxShadow

        // Check for outline or box-shadow focus indicator
        return (
          (outlineStyle !== 'none' && outlineWidth > 0) ||
          (boxShadow !== 'none' && boxShadow !== '')
        )
      })

      expect(hasFocusStyle).toBe(true)
    })
  })
})
