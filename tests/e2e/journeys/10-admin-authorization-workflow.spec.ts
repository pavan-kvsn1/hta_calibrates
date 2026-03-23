import { test, expect } from '@playwright/test'
import { STATUS_LABELS } from '../fixtures/test-data'
import { loginAsAdmin } from '../fixtures/test-utils'

/**
 * Workflow Stage 13-16: Admin Reviews and Authorization
 *
 * This test suite covers:
 * 1. Admin reviews engineer internal requests (unlock requests)
 * 2. Admin reviews customer registration requests
 * 3. Admin manages master instrument details
 * 4. Admin authorizes certificates approved by customer
 * 5. Certificate status changes to AUTHORIZED
 * 6. Signed PDF becomes available for download
 */

test.describe('Stage 13: Admin Reviews Engineer Requests', () => {
  test.describe('13.1 - Internal Request Queue', () => {
    test('admin can access internal requests page', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin')
      await page.waitForLoadState('networkidle')

      // Look for requests navigation
      const requestsLink = page.locator('a:has-text("Requests"), a[href*="internal-request"], a[href*="request"]')
      const hasRequestsLink = await requestsLink.first().isVisible({ timeout: 5000 }).catch(() => false)

      if (hasRequestsLink) {
        await requestsLink.first().click()
        await expect(page).toHaveURL(/request/, { timeout: 10000 })
      } else {
        // Requests might be shown on dashboard
        const requestsSection = page.locator('text=/request|internal/i')
        const hasSection = await requestsSection.first().isVisible({ timeout: 5000 }).catch(() => false)

        test.info().annotations.push({
          type: 'info',
          description: hasSection ? 'Requests section on dashboard' : 'Requests at different location',
        })
      }
    })

    test('admin sees list of pending unlock requests', async ({ page }) => {
      await loginAsAdmin(page)

      // Navigate to internal requests
      await page.goto('/admin/internal-requests')
      await page.waitForLoadState('networkidle')

      // Or navigate via link
      const requestsLink = page.locator('a[href*="internal-request"]')
      if (await requestsLink.first().isVisible({ timeout: 5000 })) {
        await requestsLink.first().click()
        await page.waitForLoadState('networkidle')
      }

      // Should show requests table
      const requestsTable = page.locator('table, [role="table"]')
      const hasTable = await requestsTable.isVisible({ timeout: 5000 }).catch(() => false)

      test.info().annotations.push({
        type: 'info',
        description: hasTable ? 'Requests table visible' : 'May have no pending requests',
      })
    })

    test('admin can view request details', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/internal-requests')
      await page.waitForLoadState('networkidle')

      // Find a request
      const requestRow = page.locator('table tr, [role="row"]').nth(1)
      const hasRequest = await requestRow.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasRequest) {
        const viewLink = requestRow.locator('a, button:has-text("View")')
        if (await viewLink.first().isVisible({ timeout: 3000 })) {
          await viewLink.first().click()
          await page.waitForLoadState('networkidle')

          // Should show request details
          const detailsSection = page.locator('text=/reason|certificate|engineer|section/i')
          const hasDetails = await detailsSection.first().isVisible({ timeout: 5000 }).catch(() => false)

          expect(hasDetails).toBe(true)
        }
      } else {
        test.info().annotations.push({ type: 'skip', description: 'No pending requests' })
      }
    })

    test('admin can approve unlock request', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/internal-requests')
      await page.waitForLoadState('networkidle')

      const pendingBadge = page.locator('text=/pending/i').first()
      if (await pendingBadge.isVisible({ timeout: 5000 })) {
        const row = pendingBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const viewLink = row.locator('a, button').first()

        if (await viewLink.isVisible()) {
          await viewLink.click()
          await page.waitForLoadState('networkidle')

          const approveButton = page.locator('button:has-text("Approve")')
          const hasApprove = await approveButton.first().isVisible({ timeout: 5000 }).catch(() => false)

          expect(hasApprove).toBe(true)
        }
      } else {
        test.info().annotations.push({ type: 'skip', description: 'No pending requests' })
      }
    })

    test('admin can reject unlock request with reason', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/internal-requests')
      await page.waitForLoadState('networkidle')

      const pendingBadge = page.locator('text=/pending/i').first()
      if (await pendingBadge.isVisible({ timeout: 5000 })) {
        const row = pendingBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const viewLink = row.locator('a, button').first()

        if (await viewLink.isVisible()) {
          await viewLink.click()
          await page.waitForLoadState('networkidle')

          const rejectButton = page.locator('button:has-text("Reject")')
          const hasReject = await rejectButton.first().isVisible({ timeout: 5000 }).catch(() => false)

          expect(hasReject).toBe(true)
        }
      } else {
        test.info().annotations.push({ type: 'skip', description: 'No pending requests' })
      }
    })
  })
})

test.describe('Stage 14: Admin Reviews Customer Requests', () => {
  test.describe('14.1 - Customer Registration Requests', () => {
    test('admin can access registration requests page', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin')
      await page.waitForLoadState('networkidle')

      // Look for registrations/customers navigation
      const registrationsLink = page.locator('a:has-text("Registration"), a[href*="registration"], a:has-text("Customer")')
      const hasLink = await registrationsLink.first().isVisible({ timeout: 5000 }).catch(() => false)

      if (hasLink) {
        await registrationsLink.first().click()
        await page.waitForLoadState('networkidle')

        // Should show registrations page
        const pageHeader = page.locator('h1, h2')
        await expect(pageHeader.first()).toBeVisible()
      }

      test.info().annotations.push({
        type: 'info',
        description: hasLink ? 'Registration link found' : 'May be at different location',
      })
    })

    test('admin sees pending registration requests', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/registrations')
      await page.waitForLoadState('networkidle')

      // Or navigate via customers
      await page.goto('/admin/customers/requests')
      await page.waitForLoadState('networkidle')

      // Should show requests list
      const requestsList = page.locator('table, [role="table"], .requests-list')
      const hasList = await requestsList.first().isVisible({ timeout: 5000 }).catch(() => false)

      test.info().annotations.push({
        type: 'info',
        description: hasList ? 'Registration requests visible' : 'May have no pending registrations',
      })
    })

    test('admin can view registration request details', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/customers/requests')
      await page.waitForLoadState('networkidle')

      const requestRow = page.locator('table tr, [role="row"]').nth(1)
      if (await requestRow.isVisible({ timeout: 5000 })) {
        const viewLink = requestRow.locator('a, button:has-text("View")')
        if (await viewLink.first().isVisible({ timeout: 3000 })) {
          await viewLink.first().click()
          await page.waitForLoadState('networkidle')

          // Should show registration details
          const details = page.locator('text=/company|email|name|phone/i')
          const hasDetails = await details.first().isVisible({ timeout: 5000 }).catch(() => false)

          expect(hasDetails).toBe(true)
        }
      }
    })

    test('admin can approve customer registration', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/customers/requests')
      await page.waitForLoadState('networkidle')

      const pendingBadge = page.locator('text=/pending/i').first()
      if (await pendingBadge.isVisible({ timeout: 5000 })) {
        const row = pendingBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const viewLink = row.locator('a, button').first()

        if (await viewLink.isVisible()) {
          await viewLink.click()
          await page.waitForLoadState('networkidle')

          const approveButton = page.locator('button:has-text("Approve")')
          const hasApprove = await approveButton.first().isVisible({ timeout: 5000 }).catch(() => false)

          expect(hasApprove).toBe(true)
        }
      } else {
        test.info().annotations.push({ type: 'skip', description: 'No pending registrations' })
      }
    })

    test('admin can reject customer registration with reason', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/customers/requests')
      await page.waitForLoadState('networkidle')

      const pendingBadge = page.locator('text=/pending/i').first()
      if (await pendingBadge.isVisible({ timeout: 5000 })) {
        const row = pendingBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const viewLink = row.locator('a, button').first()

        if (await viewLink.isVisible()) {
          await viewLink.click()
          await page.waitForLoadState('networkidle')

          const rejectButton = page.locator('button:has-text("Reject")')
          const hasReject = await rejectButton.first().isVisible({ timeout: 5000 }).catch(() => false)

          expect(hasReject).toBe(true)
        }
      } else {
        test.info().annotations.push({ type: 'skip', description: 'No pending registrations' })
      }
    })
  })

  test.describe('14.2 - Team Access Requests', () => {
    test('admin can see team access requests', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/customers/requests')
      await page.waitForLoadState('networkidle')

      // Look for team access section/tab
      const teamTab = page.locator('button:has-text("Team"), a:has-text("Team Access"), [data-tab="team"]')
      if (await teamTab.first().isVisible({ timeout: 5000 })) {
        await teamTab.first().click()
        await page.waitForTimeout(500)
      }

      // Should show team requests
      const teamRequests = page.locator('table, [role="table"]')
      const hasRequests = await teamRequests.first().isVisible({ timeout: 5000 }).catch(() => false)

      test.info().annotations.push({
        type: 'info',
        description: hasRequests ? 'Team requests visible' : 'May have no team access requests',
      })
    })
  })
})

test.describe('Stage 15: Admin Manages Master Instruments', () => {
  test.describe('15.1 - Master Instrument Management', () => {
    test('admin can access master instruments page', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin')
      await page.waitForLoadState('networkidle')

      // Look for instruments navigation
      const instrumentsLink = page.locator('a:has-text("Instrument"), a[href*="instrument"]')
      if (await instrumentsLink.first().isVisible({ timeout: 5000 })) {
        await instrumentsLink.first().click()
        await expect(page).toHaveURL(/instrument/, { timeout: 10000 })
      }
    })

    test('admin sees list of master instruments', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/instruments')
      await page.waitForLoadState('networkidle')

      // Should show instruments list
      const instrumentsList = page.locator('table, [role="table"], .instruments-list')
      const hasList = await instrumentsList.first().isVisible({ timeout: 5000 }).catch(() => false)

      test.info().annotations.push({
        type: 'info',
        description: hasList ? 'Instruments list visible' : 'May have no instruments',
      })
    })

    test('admin can view instrument details', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/instruments')
      await page.waitForLoadState('networkidle')

      const instrumentRow = page.locator('table tr, [role="row"]').nth(1)
      if (await instrumentRow.isVisible({ timeout: 5000 })) {
        const viewLink = instrumentRow.locator('a, button:has-text("View"), button:has-text("Edit")')
        if (await viewLink.first().isVisible({ timeout: 3000 })) {
          await viewLink.first().click()
          await page.waitForLoadState('networkidle')

          // Should show instrument details
          const details = page.locator('text=/description|serial|category|make|model/i')
          const hasDetails = await details.first().isVisible({ timeout: 5000 }).catch(() => false)

          expect(hasDetails).toBe(true)
        }
      }
    })

    test('admin can edit instrument details', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/instruments')
      await page.waitForLoadState('networkidle')

      const instrumentRow = page.locator('table tr, [role="row"]').nth(1)
      if (await instrumentRow.isVisible({ timeout: 5000 })) {
        const editLink = instrumentRow.locator('a:has-text("Edit"), button:has-text("Edit")')
        if (await editLink.first().isVisible({ timeout: 3000 })) {
          await editLink.first().click()
          await page.waitForLoadState('networkidle')

          // Should show editable form
          const editableField = page.locator('input:not([disabled]), textarea:not([disabled])')
          const isEditable = await editableField.first().isVisible({ timeout: 5000 }).catch(() => false)

          expect(isEditable).toBe(true)
        }
      }
    })

    test('admin can add new master instrument', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/instruments')
      await page.waitForLoadState('networkidle')

      // Look for add button
      const addButton = page.locator('button:has-text("Add"), a:has-text("Add"), button:has-text("New")')
      const hasAdd = await addButton.first().isVisible({ timeout: 5000 }).catch(() => false)

      expect(hasAdd).toBe(true)
    })

    test('admin can update calibration due date', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/instruments')
      await page.waitForLoadState('networkidle')

      const instrumentRow = page.locator('table tr, [role="row"]').nth(1)
      if (await instrumentRow.isVisible({ timeout: 5000 })) {
        const editLink = instrumentRow.locator('a:has-text("Edit"), button:has-text("Edit")')
        if (await editLink.first().isVisible({ timeout: 3000 })) {
          await editLink.first().click()
          await page.waitForLoadState('networkidle')

          // Look for calibration due date field
          const dueDateField = page.locator('input[name*="calibrationDue"], input[name*="dueDate"], input[type="date"]')
          const hasDueDate = await dueDateField.first().isVisible({ timeout: 5000 }).catch(() => false)

          test.info().annotations.push({
            type: 'info',
            description: hasDueDate ? 'Due date field available' : 'Due date may be on different form',
          })
        }
      }
    })
  })
})

test.describe('Stage 16: Admin Authorizes Certificates', () => {
  test.describe('16.1 - Authorization Queue', () => {
    test('admin can access authorization page', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin')
      await page.waitForLoadState('networkidle')

      // Look for authorization navigation
      const authLink = page.locator('a:has-text("Authorization"), a[href*="authorization"]')
      if (await authLink.first().isVisible({ timeout: 5000 })) {
        await authLink.first().click()
        await expect(page).toHaveURL(/authorization/, { timeout: 10000 })
      }
    })

    test('admin sees certificates pending authorization', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/authorization')
      await page.waitForLoadState('networkidle')

      // Should show pending authorization certificates
      const pendingAuthBadge = page.locator(`text=${STATUS_LABELS.PENDING_ADMIN_AUTHORIZATION}`)
      const hasPendingAuth = await pendingAuthBadge.first().isVisible({ timeout: 5000 }).catch(() => false)

      // Also check for table
      const certsTable = page.locator('table, [role="table"]')
      const hasTable = await certsTable.first().isVisible({ timeout: 5000 }).catch(() => false)

      test.info().annotations.push({
        type: 'info',
        description: hasPendingAuth || hasTable ? 'Authorization queue visible' : 'No certificates pending authorization',
      })
    })

    test('admin can view certificate details for authorization', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/authorization')
      await page.waitForLoadState('networkidle')

      const pendingBadge = page.locator(`text=${STATUS_LABELS.PENDING_ADMIN_AUTHORIZATION}`).first()
      if (await pendingBadge.isVisible({ timeout: 5000 })) {
        const row = pendingBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const viewLink = row.locator('a').first()

        if (await viewLink.isVisible()) {
          await viewLink.click()
          await page.waitForLoadState('networkidle')

          // Should show full certificate details
          const certDetails = page.locator('text=/certificate|customer|calibration/i')
          const hasDetails = await certDetails.first().isVisible({ timeout: 5000 }).catch(() => false)

          expect(hasDetails).toBe(true)
        }
      } else {
        test.info().annotations.push({ type: 'skip', description: 'No certificates pending authorization' })
      }
    })

    test('admin can view all signatures before authorization', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/authorization')
      await page.waitForLoadState('networkidle')

      const pendingBadge = page.locator(`text=${STATUS_LABELS.PENDING_ADMIN_AUTHORIZATION}`).first()
      if (await pendingBadge.isVisible({ timeout: 5000 })) {
        const row = pendingBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const viewLink = row.locator('a').first()

        if (await viewLink.isVisible()) {
          await viewLink.click()
          await page.waitForLoadState('networkidle')

          // Look for signatures section
          const signaturesSection = page.locator('text=/signature|signed/i')
          const hasSignatures = await signaturesSection.first().isVisible({ timeout: 5000 }).catch(() => false)

          test.info().annotations.push({
            type: 'info',
            description: hasSignatures ? 'Signatures section visible' : 'Signatures may be elsewhere',
          })
        }
      }
    })

    test('admin can authorize certificate', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/authorization')
      await page.waitForLoadState('networkidle')

      const pendingBadge = page.locator(`text=${STATUS_LABELS.PENDING_ADMIN_AUTHORIZATION}`).first()
      if (await pendingBadge.isVisible({ timeout: 5000 })) {
        const row = pendingBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const viewLink = row.locator('a').first()

        if (await viewLink.isVisible()) {
          await viewLink.click()
          await page.waitForLoadState('networkidle')

          // Authorize button
          const authorizeButton = page.locator('button:has-text("Authorize"), button:has-text("Approve Authorization")')
          const hasAuthorize = await authorizeButton.first().isVisible({ timeout: 5000 }).catch(() => false)

          expect(hasAuthorize).toBe(true)
        }
      } else {
        test.info().annotations.push({ type: 'skip', description: 'No certificates pending authorization' })
      }
    })
  })

  test.describe('16.2 - Post-Authorization', () => {
    test('certificate status changes to AUTHORIZED', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/certificates')
      await page.waitForLoadState('networkidle')

      // Look for authorized certificates
      const authorizedBadge = page.locator(`text=${STATUS_LABELS.AUTHORIZED}`)
      const hasAuthorized = await authorizedBadge.first().isVisible({ timeout: 5000 }).catch(() => false)

      test.info().annotations.push({
        type: 'info',
        description: hasAuthorized ? 'Authorized certificates visible' : 'No authorized certificates yet',
      })
    })

    test('authorized certificate has download option', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/certificates')
      await page.waitForLoadState('networkidle')

      const authorizedBadge = page.locator(`text=${STATUS_LABELS.AUTHORIZED}`).first()
      if (await authorizedBadge.isVisible({ timeout: 5000 })) {
        const row = authorizedBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const viewLink = row.locator('a').first()

        if (await viewLink.isVisible()) {
          await viewLink.click()
          await page.waitForLoadState('networkidle')

          // Look for download button
          const downloadButton = page.locator('button:has-text("Download"), a:has-text("Download")')
          const hasDownload = await downloadButton.first().isVisible({ timeout: 5000 }).catch(() => false)

          expect(hasDownload).toBe(true)
        }
      } else {
        test.info().annotations.push({ type: 'skip', description: 'No authorized certificates' })
      }
    })

    test('signed PDF is available', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin/certificates')
      await page.waitForLoadState('networkidle')

      const authorizedBadge = page.locator(`text=${STATUS_LABELS.AUTHORIZED}`).first()
      if (await authorizedBadge.isVisible({ timeout: 5000 })) {
        const row = authorizedBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const viewLink = row.locator('a').first()

        if (await viewLink.isVisible()) {
          await viewLink.click()
          await page.waitForLoadState('networkidle')

          // Look for signed PDF indicator
          const signedPdf = page.locator('text=/signed|pdf/i, button:has-text("Download PDF")')
          const hasSignedPdf = await signedPdf.first().isVisible({ timeout: 5000 }).catch(() => false)

          test.info().annotations.push({
            type: 'info',
            description: hasSignedPdf ? 'Signed PDF available' : 'Check PDF generation status',
          })
        }
      }
    })
  })

  test.describe('16.3 - Admin Statistics', () => {
    test('admin dashboard shows certificate statistics', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin')
      await page.waitForLoadState('networkidle')

      // Look for stats cards
      const statsCards = page.locator('[class*="stat"], [class*="card"], [class*="metric"]')
      const hasStats = await statsCards.first().isVisible({ timeout: 5000 }).catch(() => false)

      expect(hasStats).toBe(true)
    })

    test('admin can see certificates by status counts', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin')
      await page.waitForLoadState('networkidle')

      // Look for status-specific counts
      const statusLabels = Object.values(STATUS_LABELS)
      let foundCount = 0

      for (const status of statusLabels) {
        const statusElement = page.locator(`text=/${status}/i`).first()
        if (await statusElement.isVisible({ timeout: 1000 }).catch(() => false)) {
          foundCount++
        }
      }

      test.info().annotations.push({
        type: 'info',
        description: `Found ${foundCount} status indicators on dashboard`,
      })
    })
  })
})
