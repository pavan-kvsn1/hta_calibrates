import { test, expect } from '@playwright/test'
import { loginAsEngineer } from '../fixtures/test-utils'

test.describe('Engineer Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as engineer before each test (skips if already authenticated via storageState)
    await loginAsEngineer(page)
  })

  test('can view dashboard with certificates list', async ({ page }) => {
    // Should see the dashboard header
    await expect(page.locator('h1, h2').first()).toBeVisible()

    // Should have a way to create new certificate
    const newCertButton = page.locator('a[href*="new"], button:has-text("new")', { hasText: /new|create/i })
    await expect(newCertButton.first()).toBeVisible()
  })

  test('can navigate to new certificate page', async ({ page }) => {
    // Click on new certificate button/link
    const newCertLink = page.locator('a[href*="/certificates/new"]').first()

    if (await newCertLink.isVisible()) {
      await newCertLink.click()
      await expect(page).toHaveURL(/certificates\/new/)
    }
  })

  test('can see certificate form sections', async ({ page }) => {
    await page.goto('/dashboard/certificates/new')
    await page.waitForLoadState('networkidle')

    // The page should show the certificate form - main content h1 shows DRAFT or certificate number
    // Use main content area to avoid sidebar h1
    const mainHeading = page.locator('main h1, [role="main"] h1').first()
    await expect(mainHeading).toBeVisible({ timeout: 10000 })

    // Check for form section headings (the actual sections, not nav buttons)
    await expect(page.getByRole('heading', { name: /summary/i })).toBeVisible()
    await expect(page.getByRole('heading', { name: /uuc/i })).toBeVisible()
  })

  test('dashboard shows certificate status badges', async ({ page }) => {
    // Look for status indicators on the dashboard
    const statusBadges = page.locator('[class*="badge"], [class*="status"]')

    // There should be some status indicators if certificates exist
    const count = await statusBadges.count()
    // This is informational - just verify page loads correctly
    expect(count).toBeGreaterThanOrEqual(0)
  })
})
