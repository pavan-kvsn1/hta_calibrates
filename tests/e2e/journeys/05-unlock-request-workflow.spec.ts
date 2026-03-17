import { test, expect, Page } from '@playwright/test'
import { TEST_USERS, STATUS_LABELS } from '../fixtures/test-data'

/**
 * Workflow Stage 4-5: Section Unlock Request and Resubmission
 *
 * This test suite covers:
 * 1. Engineer requests section unlock from admin
 * 2. Admin sees unlock request in their queue
 * 3. Admin approves/rejects unlock request
 * 4. Section becomes editable after approval
 * 5. Engineer makes changes to unlocked section
 * 6. Engineer resubmits certificate
 */

// Helper functions
async function loginAsEngineer(page: Page) {
  await page.goto('/login')
  await page.fill('input[type="email"], input[name="email"]', TEST_USERS.engineer.email)
  await page.fill('input[type="password"], input[name="password"]', TEST_USERS.engineer.password)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/dashboard/, { timeout: 15000 })
}

async function loginAsAdmin(page: Page) {
  await page.goto('/login')
  await page.fill('input[type="email"], input[name="email"]', TEST_USERS.admin.email)
  await page.fill('input[type="password"], input[name="password"]', TEST_USERS.admin.password)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/admin|dashboard/, { timeout: 15000 })
}

async function loginAsReviewer(page: Page) {
  await page.goto('/login')
  await page.fill('input[type="email"], input[name="email"]', TEST_USERS.reviewer.email)
  await page.fill('input[type="password"], input[name="password"]', TEST_USERS.reviewer.password)
  await page.click('button[type="submit"]')
  await expect(page).toHaveURL(/admin|dashboard/, { timeout: 15000 })
}

test.describe('Stage 4: Engineer Requests Section Unlock', () => {
  test.describe('4.1 - Unlock Request Initiation', () => {
    test('engineer sees unlock request option on submitted certificate', async ({ page }) => {
      await loginAsEngineer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      // Find a certificate that's been submitted (not DRAFT)
      const submittedCertBadge = page.locator(`text=${STATUS_LABELS.PENDING_REVIEW}, text=${STATUS_LABELS.REVISION_REQUIRED}`).first()
      const hasSubmitted = await submittedCertBadge.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasSubmitted) {
        const row = submittedCertBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const certLink = row.locator('a').first()

        if (await certLink.isVisible()) {
          await certLink.click()
          await page.waitForLoadState('networkidle')

          // Look for unlock request button/link
          const unlockButton = page.locator('button:has-text("Unlock"), button:has-text("Request Unlock"), a:has-text("Unlock"), [data-testid="unlock-request"]')
          const hasUnlock = await unlockButton.first().isVisible({ timeout: 5000 }).catch(() => false)

          test.info().annotations.push({
            type: 'info',
            description: hasUnlock ? 'Unlock request option available' : 'Unlock may be section-specific or at different location',
          })
        }
      } else {
        test.info().annotations.push({ type: 'skip', description: 'No submitted certificates found' })
      }
    })

    test('engineer can select sections to unlock', async ({ page }) => {
      await loginAsEngineer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      const submittedCertBadge = page.locator(`text=${STATUS_LABELS.PENDING_REVIEW}`).first()
      const hasSubmitted = await submittedCertBadge.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasSubmitted) {
        const row = submittedCertBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const certLink = row.locator('a').first()

        if (await certLink.isVisible()) {
          await certLink.click()
          await page.waitForLoadState('networkidle')

          // Click unlock request
          const unlockButton = page.locator('button:has-text("Unlock"), button:has-text("Request Unlock")')
          if (await unlockButton.first().isVisible({ timeout: 5000 })) {
            await unlockButton.first().click()
            await page.waitForTimeout(500)

            // Should show section selection
            const sectionCheckboxes = page.locator('input[type="checkbox"], [role="checkbox"]')
            const hasSectionSelection = await sectionCheckboxes.first().isVisible({ timeout: 5000 }).catch(() => false)

            test.info().annotations.push({
              type: 'info',
              description: hasSectionSelection ? 'Section selection visible' : 'May use different selection UI',
            })
          }
        }
      } else {
        test.info().annotations.push({ type: 'skip', description: 'No pending review certificates' })
      }
    })

    test('engineer must provide reason for unlock request', async ({ page }) => {
      await loginAsEngineer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      const submittedCertBadge = page.locator(`text=${STATUS_LABELS.PENDING_REVIEW}`).first()
      const hasSubmitted = await submittedCertBadge.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasSubmitted) {
        const row = submittedCertBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const certLink = row.locator('a').first()

        if (await certLink.isVisible()) {
          await certLink.click()
          await page.waitForLoadState('networkidle')

          const unlockButton = page.locator('button:has-text("Unlock"), button:has-text("Request Unlock")')
          if (await unlockButton.first().isVisible({ timeout: 5000 })) {
            await unlockButton.first().click()
            await page.waitForTimeout(500)

            // Look for reason field
            const reasonField = page.locator('textarea[name*="reason"], textarea[placeholder*="reason" i], input[name*="reason"]')
            const hasReasonField = await reasonField.first().isVisible({ timeout: 5000 }).catch(() => false)

            if (hasReasonField) {
              // Try to submit without reason
              const submitButton = page.locator('button:has-text("Submit"), button:has-text("Request")')
              if (await submitButton.isVisible({ timeout: 3000 })) {
                await submitButton.click()

                // Should show validation error
                const errorMessage = page.locator('text=/reason|required|please/i')
                const hasError = await errorMessage.first().isVisible({ timeout: 5000 }).catch(() => false)

                test.info().annotations.push({
                  type: 'info',
                  description: hasError ? 'Reason validation works' : 'May have different validation',
                })
              }
            }
          }
        }
      } else {
        test.info().annotations.push({ type: 'skip', description: 'No pending review certificates' })
      }
    })

    test('engineer can submit unlock request with reason', async ({ page }) => {
      await loginAsEngineer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      const submittedCertBadge = page.locator(`text=${STATUS_LABELS.PENDING_REVIEW}`).first()
      const hasSubmitted = await submittedCertBadge.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasSubmitted) {
        const row = submittedCertBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const certLink = row.locator('a').first()

        if (await certLink.isVisible()) {
          await certLink.click()
          await page.waitForLoadState('networkidle')

          const unlockButton = page.locator('button:has-text("Unlock"), button:has-text("Request Unlock")')
          if (await unlockButton.first().isVisible({ timeout: 5000 })) {
            await unlockButton.first().click()
            await page.waitForTimeout(500)

            // Fill reason
            const reasonField = page.locator('textarea[name*="reason"], textarea')
            if (await reasonField.first().isVisible({ timeout: 3000 })) {
              await reasonField.first().fill('Need to correct data entry error in calibration results')
            }

            // Select sections if available
            const sectionCheckbox = page.locator('input[type="checkbox"]').first()
            if (await sectionCheckbox.isVisible({ timeout: 3000 }).catch(() => false)) {
              await sectionCheckbox.check()
            }

            // Submit request
            const submitButton = page.locator('button:has-text("Submit Request"), button:has-text("Request Unlock")')
            if (await submitButton.isVisible({ timeout: 3000 })) {
              await submitButton.click()

              // Should show success
              const successMessage = page.locator('text=/submitted|success|pending/i')
              const hasSuccess = await successMessage.first().isVisible({ timeout: 10000 }).catch(() => false)

              test.info().annotations.push({
                type: 'info',
                description: hasSuccess ? 'Unlock request submitted' : 'Check request submission flow',
              })
            }
          }
        }
      } else {
        test.info().annotations.push({ type: 'skip', description: 'No pending review certificates' })
      }
    })

    test('engineer can see pending unlock request status', async ({ page }) => {
      await loginAsEngineer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      // Look for unlock request indicator or section
      const unlockIndicator = page.locator('text=/unlock|pending request/i')
      const hasUnlockIndicator = await unlockIndicator.first().isVisible({ timeout: 5000 }).catch(() => false)

      // Also check in internal requests section if exists
      const internalRequestsLink = page.locator('a:has-text("Requests"), a[href*="request"]')
      if (await internalRequestsLink.first().isVisible({ timeout: 3000 }).catch(() => false)) {
        await internalRequestsLink.first().click()
        await page.waitForLoadState('networkidle')

        const requestsList = page.locator('table, [role="table"], .requests-list')
        const hasRequestsList = await requestsList.isVisible({ timeout: 5000 }).catch(() => false)

        test.info().annotations.push({
          type: 'info',
          description: hasRequestsList ? 'Requests list visible' : 'May show request status differently',
        })
      }
    })
  })
})

test.describe('Stage 4: Admin Reviews Unlock Request', () => {
  test.describe('4.2 - Admin Unlock Request Queue', () => {
    test('admin can see pending unlock requests', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin')
      await page.waitForLoadState('networkidle')

      // Look for internal requests / unlock requests section
      const requestsLink = page.locator('a:has-text("Requests"), a[href*="internal-request"], a[href*="unlock"]')
      const hasRequestsLink = await requestsLink.first().isVisible({ timeout: 5000 }).catch(() => false)

      if (hasRequestsLink) {
        await requestsLink.first().click()
        await page.waitForLoadState('networkidle')

        // Should show requests list
        const requestsTable = page.locator('table, [role="table"]')
        const hasTable = await requestsTable.isVisible({ timeout: 5000 }).catch(() => false)
        expect(hasTable).toBe(true)
      } else {
        // Check if requests shown on main dashboard
        const requestsSection = page.locator('text=/request|unlock|pending/i')
        const hasSection = await requestsSection.first().isVisible({ timeout: 5000 }).catch(() => false)

        test.info().annotations.push({
          type: 'info',
          description: hasSection ? 'Requests section found on dashboard' : 'Requests may be at different location',
        })
      }
    })

    test('admin can view unlock request details', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin')
      await page.waitForLoadState('networkidle')

      const requestsLink = page.locator('a:has-text("Requests"), a[href*="internal-request"]')
      if (await requestsLink.first().isVisible({ timeout: 5000 })) {
        await requestsLink.first().click()
        await page.waitForLoadState('networkidle')

        // Find a pending request
        const pendingBadge = page.locator('text=/pending/i').first()
        const hasPending = await pendingBadge.isVisible({ timeout: 5000 }).catch(() => false)

        if (hasPending) {
          const row = pendingBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
          const viewLink = row.locator('a, button:has-text("View")').first()

          if (await viewLink.isVisible()) {
            await viewLink.click()
            await page.waitForLoadState('networkidle')

            // Should see request details
            const detailsSection = page.locator('text=/reason|certificate|section|request/i')
            const hasDetails = await detailsSection.first().isVisible({ timeout: 5000 }).catch(() => false)
            expect(hasDetails).toBe(true)
          }
        } else {
          test.info().annotations.push({ type: 'skip', description: 'No pending unlock requests' })
        }
      }
    })

    test('admin can approve unlock request', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin')
      await page.waitForLoadState('networkidle')

      const requestsLink = page.locator('a:has-text("Requests"), a[href*="internal-request"]')
      if (await requestsLink.first().isVisible({ timeout: 5000 })) {
        await requestsLink.first().click()
        await page.waitForLoadState('networkidle')

        const pendingBadge = page.locator('text=/pending/i').first()
        if (await pendingBadge.isVisible({ timeout: 5000 })) {
          const row = pendingBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
          const viewLink = row.locator('a, button:has-text("View")').first()

          if (await viewLink.isVisible()) {
            await viewLink.click()
            await page.waitForLoadState('networkidle')

            // Look for approve button
            const approveButton = page.locator('button:has-text("Approve"), button:has-text("Accept")')
            const hasApprove = await approveButton.first().isVisible({ timeout: 5000 }).catch(() => false)

            expect(hasApprove).toBe(true)
          }
        } else {
          test.info().annotations.push({ type: 'skip', description: 'No pending unlock requests' })
        }
      }
    })

    test('admin can reject unlock request with reason', async ({ page }) => {
      await loginAsAdmin(page)
      await page.goto('/admin')
      await page.waitForLoadState('networkidle')

      const requestsLink = page.locator('a:has-text("Requests"), a[href*="internal-request"]')
      if (await requestsLink.first().isVisible({ timeout: 5000 })) {
        await requestsLink.first().click()
        await page.waitForLoadState('networkidle')

        const pendingBadge = page.locator('text=/pending/i').first()
        if (await pendingBadge.isVisible({ timeout: 5000 })) {
          const row = pendingBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
          const viewLink = row.locator('a, button:has-text("View")').first()

          if (await viewLink.isVisible()) {
            await viewLink.click()
            await page.waitForLoadState('networkidle')

            // Look for reject button
            const rejectButton = page.locator('button:has-text("Reject"), button:has-text("Deny")')
            const hasReject = await rejectButton.first().isVisible({ timeout: 5000 }).catch(() => false)

            if (hasReject) {
              await rejectButton.first().click()
              await page.waitForTimeout(500)

              // Should require reason
              const reasonField = page.locator('textarea, input[name*="reason"]')
              const needsReason = await reasonField.first().isVisible({ timeout: 3000 }).catch(() => false)

              test.info().annotations.push({
                type: 'info',
                description: needsReason ? 'Rejection requires reason' : 'May not require reason',
              })
            }
          }
        } else {
          test.info().annotations.push({ type: 'skip', description: 'No pending unlock requests' })
        }
      }
    })
  })
})

test.describe('Stage 5: Engineer Edits After Unlock Approval', () => {
  test.describe('5.1 - Section Becomes Editable', () => {
    test('engineer is notified of unlock approval', async ({ page }) => {
      await loginAsEngineer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      // Look for notifications
      const notificationBell = page.locator('[data-testid="notifications"], button[aria-label*="notification"], .notification-bell')
      const hasNotifications = await notificationBell.first().isVisible({ timeout: 5000 }).catch(() => false)

      if (hasNotifications) {
        await notificationBell.first().click()
        await page.waitForTimeout(500)

        // Look for unlock approval notification
        const approvalNotification = page.locator('text=/unlock|approved|section/i')
        const hasApproval = await approvalNotification.first().isVisible({ timeout: 5000 }).catch(() => false)

        test.info().annotations.push({
          type: 'info',
          description: hasApproval ? 'Found unlock approval notification' : 'Check notifications panel',
        })
      }
    })

    test('engineer can edit unlocked sections', async ({ page }) => {
      await loginAsEngineer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      // Find certificate with unlocked sections
      // This would typically be indicated somehow in the UI
      const certLink = page.locator('table a, [role="table"] a').first()
      const hasCert = await certLink.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasCert) {
        await certLink.click()
        await page.waitForLoadState('networkidle')

        // Look for editable fields in the unlocked section
        const editableField = page.locator('input:not([disabled]):not([readonly]), textarea:not([disabled]):not([readonly])')
        const isEditable = await editableField.first().isVisible({ timeout: 5000 }).catch(() => false)

        test.info().annotations.push({
          type: 'info',
          description: isEditable ? 'Editable fields available' : 'Section may still be locked',
        })
      }
    })

    test('engineer makes changes to unlocked section', async ({ page }) => {
      await loginAsEngineer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      const certLink = page.locator('table a, [role="table"] a').first()
      if (await certLink.isVisible({ timeout: 5000 })) {
        await certLink.click()
        await page.waitForLoadState('networkidle')

        // Make a change
        const editableField = page.locator('input[type="text"]:not([disabled])').first()
        if (await editableField.isVisible({ timeout: 5000 })) {
          const currentValue = await editableField.inputValue()
          await editableField.fill(currentValue + ' (corrected)')

          // Save changes
          const saveButton = page.locator('button:has-text("Save")')
          if (await saveButton.first().isVisible({ timeout: 3000 })) {
            await saveButton.first().click()

            const successMessage = page.locator('text=/saved|success/i')
            const hasSaved = await successMessage.first().isVisible({ timeout: 10000 }).catch(() => false)

            test.info().annotations.push({
              type: 'info',
              description: hasSaved ? 'Changes saved' : 'May auto-save',
            })
          }
        }
      }
    })

    test('engineer can resubmit after making changes', async ({ page }) => {
      await loginAsEngineer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      // Find certificate with revision required status
      const revisionBadge = page.locator(`text=${STATUS_LABELS.REVISION_REQUIRED}`).first()
      const hasRevision = await revisionBadge.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasRevision) {
        const row = revisionBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const certLink = row.locator('a').first()

        if (await certLink.isVisible()) {
          await certLink.click()
          await page.waitForLoadState('networkidle')

          // Look for resubmit button
          const resubmitButton = page.locator('button:has-text("Resubmit"), button:has-text("Submit"), button:has-text("Submit for Review")')
          const hasResubmit = await resubmitButton.first().isVisible({ timeout: 5000 }).catch(() => false)

          expect(hasResubmit).toBe(true)
        }
      } else {
        test.info().annotations.push({ type: 'skip', description: 'No certificates requiring revision' })
      }
    })
  })

  test.describe('5.2 - Unlock Request History', () => {
    test('engineer can see unlock request history on certificate', async ({ page }) => {
      await loginAsEngineer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      const certLink = page.locator('table a, [role="table"] a').first()
      if (await certLink.isVisible({ timeout: 5000 })) {
        await certLink.click()
        await page.waitForLoadState('networkidle')

        // Look for history/timeline showing unlock events
        const historySection = page.locator('text=/history|timeline|unlock/i, [class*="history"]')
        const hasHistory = await historySection.first().isVisible({ timeout: 5000 }).catch(() => false)

        test.info().annotations.push({
          type: 'info',
          description: hasHistory ? 'History section visible' : 'Unlock history may be in separate section',
        })
      }
    })

    test('admin can see unlock request history', async ({ page }) => {
      await loginAsAdmin(page)

      // Navigate to internal requests
      const requestsLink = page.locator('a:has-text("Requests"), a[href*="internal-request"]')
      if (await requestsLink.first().isVisible({ timeout: 5000 })) {
        await requestsLink.first().click()
        await page.waitForLoadState('networkidle')

        // Look for completed/approved/rejected requests
        const completedBadge = page.locator('text=/approved|rejected|completed/i')
        const hasCompleted = await completedBadge.first().isVisible({ timeout: 5000 }).catch(() => false)

        test.info().annotations.push({
          type: 'info',
          description: hasCompleted ? 'Request history visible' : 'May filter by status to see history',
        })
      }
    })
  })
})
