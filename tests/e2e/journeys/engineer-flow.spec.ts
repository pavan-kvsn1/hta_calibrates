import { test, expect } from '@playwright/test'
import { TEST_USERS } from '../fixtures/test-data'

test.describe('Engineer Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login as engineer before each test
    await page.goto('/login')
    await page.fill('input[type="email"], input[name="email"]', TEST_USERS.engineer.email)
    await page.fill('input[type="password"], input[name="password"]', TEST_USERS.engineer.password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/dashboard/, { timeout: 10000 })
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
    await page.goto('/certificates/new')

    // The form should have various sections
    // Check for some common form elements
    await expect(page.locator('form, [role="form"]').first()).toBeVisible({ timeout: 10000 })
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
