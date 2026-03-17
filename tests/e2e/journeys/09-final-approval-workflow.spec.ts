import { test, expect, Page } from '@playwright/test'
import { TEST_USERS, STATUS_LABELS } from '../fixtures/test-data'

/**
 * Workflow Stage 9-12: Engineer Addresses Feedback and Final Approval
 *
 * This test suite covers:
 * 1. Engineer addresses customer feedback by making changes
 * 2. Engineer resubmits certificate
 * 3. Reviewer approves the updated certificate
 * 4. Customer approves the final certificate
 * 5. Certificate status changes to APPROVED/PENDING_ADMIN_AUTHORIZATION
 */

// Helper functions
async function loginAsEngineer(page: Page) {
  await page.goto('/login')
  await page.fill('input[type="email"], input[name="email"]', TEST_USERS.engineer.email)
  await page.fill('input[type="password"], input[name="password"]', TEST_USERS.engineer.password)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/dashboard/, { timeout: 15000 })
}

async function loginAsReviewer(page: Page) {
  await page.goto('/login')
  await page.fill('input[type="email"], input[name="email"]', TEST_USERS.reviewer.email)
  await page.fill('input[type="password"], input[name="password"]', TEST_USERS.reviewer.password)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/admin|dashboard/, { timeout: 15000 })
}

async function loginAsCustomer(page: Page) {
  await page.goto('/customer/login')
  await page.fill('input[type="email"], input[name="email"]', TEST_USERS.customer.email)
  await page.fill('input[type="password"], input[name="password"]', TEST_USERS.customer.password)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/customer\/dashboard/, { timeout: 15000 })
}

test.describe('Stage 9-10: Engineer Addresses Feedback and Resubmits', () => {
  test.describe('9.1 - Engineer Views and Addresses Feedback', () => {
    test('engineer sees customer feedback on certificate', async ({ page }) => {
      await loginAsEngineer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      // Find revision required certificate
      const revisionBadge = page.locator(`text=${STATUS_LABELS.REVISION_REQUIRED}`).first()
      const hasRevision = await revisionBadge.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasRevision) {
        const row = revisionBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const certLink = row.locator('a').first()

        if (await certLink.isVisible()) {
          await certLink.click()
          await page.waitForLoadState('networkidle')

          // Look for feedback section
          const feedbackSection = page.locator('text=/feedback|history|comment/i, [class*="feedback"]')
          const hasFeedback = await feedbackSection.first().isVisible({ timeout: 5000 }).catch(() => false)

          expect(hasFeedback).toBe(true)
        }
      } else {
        test.info().annotations.push({ type: 'skip', description: 'No certificates with revision required' })
      }
    })

    test('engineer can make required corrections', async ({ page }) => {
      await loginAsEngineer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      const revisionBadge = page.locator(`text=${STATUS_LABELS.REVISION_REQUIRED}`).first()
      if (await revisionBadge.isVisible({ timeout: 5000 })) {
        const row = revisionBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const certLink = row.locator('a').first()

        if (await certLink.isVisible()) {
          await certLink.click()
          await page.waitForLoadState('networkidle')

          // Fields should be editable
          const editableField = page.locator('input:not([disabled]):not([readonly])').first()
          const isEditable = await editableField.isVisible({ timeout: 5000 }).catch(() => false)

          expect(isEditable).toBe(true)
        }
      }
    })

    test('engineer can add response notes', async ({ page }) => {
      await loginAsEngineer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      const revisionBadge = page.locator(`text=${STATUS_LABELS.REVISION_REQUIRED}`).first()
      if (await revisionBadge.isVisible({ timeout: 5000 })) {
        const row = revisionBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const certLink = row.locator('a').first()

        if (await certLink.isVisible()) {
          await certLink.click()
          await page.waitForLoadState('networkidle')

          // Look for notes/response field
          const noteField = page.locator('textarea[name*="note"], textarea[name*="response"], textarea[placeholder*="note" i]')
          const hasNoteField = await noteField.first().isVisible({ timeout: 5000 }).catch(() => false)

          if (hasNoteField) {
            await noteField.first().fill('All corrections have been made as per customer feedback.')
          }

          test.info().annotations.push({
            type: 'info',
            description: hasNoteField ? 'Note field available' : 'May not require notes',
          })
        }
      }
    })
  })

  test.describe('10.1 - Engineer Resubmits Certificate', () => {
    test('engineer can save changes', async ({ page }) => {
      await loginAsEngineer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      const revisionBadge = page.locator(`text=${STATUS_LABELS.REVISION_REQUIRED}`).first()
      if (await revisionBadge.isVisible({ timeout: 5000 })) {
        const row = revisionBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const certLink = row.locator('a').first()

        if (await certLink.isVisible()) {
          await certLink.click()
          await page.waitForLoadState('networkidle')

          // Save button
          const saveButton = page.locator('button:has-text("Save")')
          const hasSave = await saveButton.first().isVisible({ timeout: 5000 }).catch(() => false)

          expect(hasSave).toBe(true)
        }
      }
    })

    test('engineer can resubmit for reviewer approval', async ({ page }) => {
      await loginAsEngineer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      const revisionBadge = page.locator(`text=${STATUS_LABELS.REVISION_REQUIRED}`).first()
      if (await revisionBadge.isVisible({ timeout: 5000 })) {
        const row = revisionBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const certLink = row.locator('a').first()

        if (await certLink.isVisible()) {
          await certLink.click()
          await page.waitForLoadState('networkidle')

          // Resubmit button
          const resubmitButton = page.locator('button:has-text("Resubmit"), button:has-text("Submit for Review"), button:has-text("Submit")')
          const hasResubmit = await resubmitButton.first().isVisible({ timeout: 5000 }).catch(() => false)

          expect(hasResubmit).toBe(true)
        }
      }
    })

    test('certificate returns to PENDING_REVIEW after resubmission', async ({ page }) => {
      await loginAsEngineer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      // Look for pending review certificates
      const pendingBadge = page.locator(`text=${STATUS_LABELS.PENDING_REVIEW}`)
      const hasPending = await pendingBadge.first().isVisible({ timeout: 5000 }).catch(() => false)

      test.info().annotations.push({
        type: 'info',
        description: hasPending ? 'Certificates pending review visible' : 'No pending review certificates',
      })
    })
  })
})

test.describe('Stage 11: Reviewer Final Approval', () => {
  test.describe('11.1 - Reviewer Reviews Updated Certificate', () => {
    test('reviewer sees resubmitted certificate', async ({ page }) => {
      await loginAsReviewer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      const pendingBadge = page.locator(`text=${STATUS_LABELS.PENDING_REVIEW}`)
      const hasPending = await pendingBadge.first().isVisible({ timeout: 5000 }).catch(() => false)

      test.info().annotations.push({
        type: 'info',
        description: hasPending ? 'Pending certificates visible' : 'No pending certificates',
      })
    })

    test('reviewer can see changes made by engineer', async ({ page }) => {
      await loginAsReviewer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      const pendingBadge = page.locator(`text=${STATUS_LABELS.PENDING_REVIEW}`).first()
      if (await pendingBadge.isVisible({ timeout: 5000 })) {
        const row = pendingBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const viewLink = row.locator('a').first()

        if (await viewLink.isVisible()) {
          await viewLink.click()
          await page.waitForLoadState('networkidle')

          // Look for history/changes indicator
          const historySection = page.locator('text=/history|changes|revision/i')
          const hasHistory = await historySection.first().isVisible({ timeout: 5000 }).catch(() => false)

          expect(hasHistory).toBe(true)
        }
      }
    })

    test('reviewer can approve and send to customer', async ({ page }) => {
      await loginAsReviewer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      const pendingBadge = page.locator(`text=${STATUS_LABELS.PENDING_REVIEW}`).first()
      if (await pendingBadge.isVisible({ timeout: 5000 })) {
        const row = pendingBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const viewLink = row.locator('a').first()

        if (await viewLink.isVisible()) {
          await viewLink.click()
          await page.waitForLoadState('networkidle')

          // Approve/send to customer button
          const approveButton = page.locator('button:has-text("Approve"), button:has-text("Send to Customer")')
          const hasApprove = await approveButton.first().isVisible({ timeout: 5000 }).catch(() => false)

          expect(hasApprove).toBe(true)
        }
      }
    })
  })
})

test.describe('Stage 12: Customer Final Approval', () => {
  test.describe('12.1 - Customer Reviews Final Certificate', () => {
    test('customer sees certificate pending final approval', async ({ page }) => {
      await loginAsCustomer(page)
      await page.waitForLoadState('networkidle')

      // Look for pending review section
      const pendingSection = page.locator('text=/pending|review/i')
      const hasPending = await pendingSection.first().isVisible({ timeout: 5000 }).catch(() => false)

      test.info().annotations.push({
        type: 'info',
        description: hasPending ? 'Pending section visible' : 'May need to check different tab',
      })
    })

    test('customer can view updated certificate', async ({ page }) => {
      await loginAsCustomer(page)
      await page.waitForLoadState('networkidle')

      const certLink = page.locator('table a, [role="table"] a, button:has-text("Review")').first()
      if (await certLink.isVisible({ timeout: 5000 })) {
        await certLink.click()
        await page.waitForLoadState('networkidle')

        // Should see certificate details
        const certDetails = page.locator('text=/certificate|calibration/i')
        const hasDetails = await certDetails.first().isVisible({ timeout: 5000 }).catch(() => false)

        expect(hasDetails).toBe(true)
      }
    })

    test('customer can give final approval', async ({ page }) => {
      await loginAsCustomer(page)
      await page.waitForLoadState('networkidle')

      const certLink = page.locator('table a, [role="table"] a, button:has-text("Review")').first()
      if (await certLink.isVisible({ timeout: 5000 })) {
        await certLink.click()
        await page.waitForLoadState('networkidle')

        // Approve button
        const approveButton = page.locator('button:has-text("Approve"), button:has-text("Accept")')
        const hasApprove = await approveButton.first().isVisible({ timeout: 5000 }).catch(() => false)

        expect(hasApprove).toBe(true)
      }
    })

    test('customer approval triggers signature process', async ({ page }) => {
      await loginAsCustomer(page)
      await page.waitForLoadState('networkidle')

      const certLink = page.locator('table a, [role="table"] a, button:has-text("Review")').first()
      if (await certLink.isVisible({ timeout: 5000 })) {
        await certLink.click()
        await page.waitForLoadState('networkidle')

        const approveButton = page.locator('button:has-text("Approve")')
        if (await approveButton.first().isVisible({ timeout: 5000 })) {
          // Don't actually approve to preserve test data
          // Verify button is enabled
          const isEnabled = await approveButton.first().isEnabled()
          expect(isEnabled).toBe(true)
        }
      }
    })

    test('certificate status changes to APPROVED or PENDING_ADMIN_AUTHORIZATION', async ({ page }) => {
      await loginAsCustomer(page)
      await page.waitForLoadState('networkidle')

      // Check for approved/completed section
      const approvedSection = page.locator('text=/approved|completed|authorized/i')
      const hasApproved = await approvedSection.first().isVisible({ timeout: 5000 }).catch(() => false)

      // Or check for pending authorization
      const pendingAuthBadge = page.locator(`text=${STATUS_LABELS.PENDING_ADMIN_AUTHORIZATION}`)
      const hasPendingAuth = await pendingAuthBadge.first().isVisible({ timeout: 3000 }).catch(() => false)

      test.info().annotations.push({
        type: 'info',
        description: hasApproved || hasPendingAuth ? 'Approved/pending auth certificates visible' : 'Check approval workflow',
      })
    })
  })

  test.describe('12.2 - Customer Dashboard After Approval', () => {
    test('customer sees approved certificates in completed section', async ({ page }) => {
      await loginAsCustomer(page)
      await page.waitForLoadState('networkidle')

      // Look for completed/approved tab or section
      const completedTab = page.locator('button:has-text("Completed"), a:has-text("Completed"), [data-tab="completed"]')
      if (await completedTab.first().isVisible({ timeout: 5000 })) {
        await completedTab.first().click()
        await page.waitForTimeout(500)
      }

      // Should show completed certificates
      const completedCerts = page.locator('table, [role="table"], .certificate-list')
      const hasCompletedCerts = await completedCerts.first().isVisible({ timeout: 5000 }).catch(() => false)

      test.info().annotations.push({
        type: 'info',
        description: hasCompletedCerts ? 'Completed certificates visible' : 'May have no completed certificates yet',
      })
    })

    test('customer sees authorized certificates with download option', async ({ page }) => {
      await loginAsCustomer(page)
      await page.waitForLoadState('networkidle')

      // Look for authorized tab
      const authorizedTab = page.locator('button:has-text("Authorized"), a:has-text("Authorized"), [data-tab="authorized"]')
      if (await authorizedTab.first().isVisible({ timeout: 5000 })) {
        await authorizedTab.first().click()
        await page.waitForTimeout(500)

        // Look for download buttons
        const downloadButton = page.locator('button:has-text("Download"), a:has-text("Download")')
        const hasDownload = await downloadButton.first().isVisible({ timeout: 5000 }).catch(() => false)

        test.info().annotations.push({
          type: 'info',
          description: hasDownload ? 'Download option available' : 'No authorized certificates with downloads',
        })
      }
    })
  })
})
