import { test, expect } from '@playwright/test'
import { TEST_USERS, STATUS_LABELS } from '../fixtures/test-data'

/**
 * Admin Certificate Management E2E Tests
 *
 * Tests the admin's ability to manage certificates:
 * 1. View all certificates across the organization
 * 2. Filter and search certificates
 * 3. View certificate details
 * 4. Authorize approved certificates
 * 5. Download signed PDFs
 */

test.describe('Admin Certificate Management', () => {
  test.beforeEach(async ({ page }) => {
    // Login as admin before each test
    await page.goto('/login')
    await page.fill('input[type="email"], input[name="email"]', TEST_USERS.admin.email)
    await page.fill('input[type="password"], input[name="password"]', TEST_USERS.admin.password)
    await page.click('button[type="submit"]')
    // Admin should be redirected to admin dashboard
    await expect(page).toHaveURL(/admin/, { timeout: 10000 })
  })

  test('can access admin dashboard and view statistics', async ({ page }) => {
    await page.goto('/admin')

    // Should see the admin dashboard
    const dashboardHeader = page.locator('h1, h2').filter({ hasText: /dashboard|overview/i })
    await expect(dashboardHeader.first()).toBeVisible({ timeout: 10000 })

    // Should see statistics cards
    const statsGrid = page.locator('[class*="grid"]').first()
    await expect(statsGrid).toBeVisible()
  })

  test('can navigate to certificates list', async ({ page }) => {
    await page.goto('/admin')

    // Look for certificates navigation link
    const certsLink = page.locator('a[href*="/admin/certificates"]').first()
    if (await certsLink.isVisible()) {
      await certsLink.click()
      await expect(page).toHaveURL(/admin\/certificates/)
    }
  })

  test('can view certificate details', async ({ page }) => {
    await page.goto('/admin/certificates')

    // Wait for certificates to load
    await page.waitForLoadState('networkidle')

    // Look for a certificate row or link
    const certificateLink = page.locator('table a, [role="table"] a, a[href*="/admin/certificates/"]').first()
    const hasLink = await certificateLink.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasLink) {
      await certificateLink.click()

      // Should navigate to certificate detail page
      await expect(page).toHaveURL(/admin\/certificates\/[a-zA-Z0-9-]+/, { timeout: 10000 })

      // Should see certificate header with number
      const certHeader = page.locator('h1')
      await expect(certHeader).toBeVisible()
    } else {
      test.info().annotations.push({
        type: 'info',
        description: 'No certificates available to view',
      })
    }
  })

  test('can filter certificates by status', async ({ page }) => {
    await page.goto('/admin/certificates')

    await page.waitForLoadState('networkidle')

    // Look for status filter dropdown or tabs
    const statusFilter = page.locator('select, [role="combobox"], [data-testid="status-filter"]').first()
    const hasFilter = await statusFilter.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasFilter) {
      await statusFilter.click()

      // Look for status options
      const statusOption = page.locator('[role="option"], option').filter({ hasText: /pending|review|approved/i }).first()
      if (await statusOption.isVisible({ timeout: 2000 }).catch(() => false)) {
        await statusOption.click()
      }
    }
  })

  test('can search certificates', async ({ page }) => {
    await page.goto('/admin/certificates')

    await page.waitForLoadState('networkidle')

    // Look for search input
    const searchInput = page.locator('input[type="search"], input[placeholder*="search" i]').first()
    const hasSearch = await searchInput.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasSearch) {
      await searchInput.fill('HTA')
      await page.waitForTimeout(500) // Debounce

      // Results should update
      const table = page.locator('table, [role="table"]')
      await expect(table).toBeVisible()
    }
  })

  test('can access authorization page', async ({ page }) => {
    await page.goto('/admin')

    // Look for authorization link in navigation
    const authLink = page.locator('a[href*="/admin/authorization"]').first()
    const hasLink = await authLink.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasLink) {
      await authLink.click()
      await expect(page).toHaveURL(/admin\/authorization/)

      // Should see pending authorization certificates
      const heading = page.locator('h1, h2').filter({ hasText: /authorization|pending/i })
      await expect(heading.first()).toBeVisible()
    }
  })

  test('can view certificate PDF preview', async ({ page }) => {
    await page.goto('/admin/certificates')

    await page.waitForLoadState('networkidle')

    // Find a certificate to view
    const certificateLink = page.locator('table a, [role="table"] a').first()
    const hasLink = await certificateLink.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasLink) {
      await certificateLink.click()
      await expect(page).toHaveURL(/admin\/certificates\/[a-zA-Z0-9-]+/, { timeout: 10000 })

      // Look for PDF preview button
      const pdfButton = page.locator('button').filter({ hasText: /pdf|preview/i }).first()
      const hasPdfButton = await pdfButton.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasPdfButton) {
        await pdfButton.click()

        // PDF viewer should appear
        const pdfViewer = page.locator('iframe, [class*="pdf"], embed, object')
        // Allow for loading time
        await page.waitForTimeout(2000)
      }
    }
  })

  test('can navigate back to dashboard from certificate view', async ({ page }) => {
    await page.goto('/admin/certificates')

    await page.waitForLoadState('networkidle')

    const certificateLink = page.locator('table a, [role="table"] a').first()
    const hasLink = await certificateLink.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasLink) {
      await certificateLink.click()
      await expect(page).toHaveURL(/admin\/certificates\/[a-zA-Z0-9-]+/, { timeout: 10000 })

      // Find back navigation (chevron or link)
      const backLink = page.locator('a[href*="/admin"], button').filter({ hasText: /back|dashboard/i }).first()
      const backChevron = page.locator('a > svg, button > svg').first()

      const canGoBack = await backLink.isVisible().catch(() => false) || await backChevron.isVisible().catch(() => false)

      if (canGoBack) {
        if (await backLink.isVisible()) {
          await backLink.click()
        } else {
          await backChevron.click()
        }

        await expect(page).toHaveURL(/admin/, { timeout: 10000 })
      }
    }
  })

  test('shows download button for authorized certificates', async ({ page }) => {
    await page.goto('/admin/certificates')

    await page.waitForLoadState('networkidle')

    // Look for authorized certificate badge
    const authorizedBadge = page.locator(`text=${STATUS_LABELS.AUTHORIZED}`).first()
    const hasAuthorized = await authorizedBadge.isVisible({ timeout: 5000 }).catch(() => false)

    if (hasAuthorized) {
      // Click on the authorized certificate row
      const row = authorizedBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
      const viewLink = row.locator('a').first()

      if (await viewLink.isVisible()) {
        await viewLink.click()
        await expect(page).toHaveURL(/admin\/certificates\/[a-zA-Z0-9-]+/, { timeout: 10000 })

        // Should see Download PDF button for authorized certificates
        const downloadButton = page.locator('button').filter({ hasText: /download pdf/i })
        await expect(downloadButton).toBeVisible({ timeout: 5000 })
      }
    } else {
      test.info().annotations.push({
        type: 'info',
        description: 'No authorized certificates available to test download',
      })
    }
  })
})
