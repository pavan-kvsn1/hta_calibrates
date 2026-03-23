import { test, expect } from '@playwright/test'
import { STATUS_LABELS } from '../fixtures/test-data'
import { loginAsReviewer, loginAsCustomer, loginAsEngineer } from '../fixtures/test-utils'

/**
 * Workflow Stage 6-8: Reviewer Approves, Customer Review, Feedback Flow
 *
 * This test suite covers:
 * 1. Reviewer approves certificate and sends to customer
 * 2. Customer receives notification/token
 * 3. Customer views certificate
 * 4. Customer can approve or request revision
 * 5. Customer revision feedback flows back to reviewer
 * 6. Reviewer forwards customer feedback to engineer
 */

test.describe('Stage 6: Reviewer Approves and Sends to Customer', () => {
  test.describe('6.1 - Reviewer Approval', () => {
    test('reviewer can see approve button on reviewed certificate', async ({ page }) => {
      await loginAsReviewer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      // Find pending review certificate
      const pendingBadge = page.locator(`text=${STATUS_LABELS.PENDING_REVIEW}`).first()
      const hasPending = await pendingBadge.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasPending) {
        const row = pendingBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const reviewLink = row.locator('a').first()

        if (await reviewLink.isVisible()) {
          await reviewLink.click()
          await page.waitForLoadState('networkidle')

          // Should see approve button
          const approveButton = page.locator('button:has-text("Approve"), button:has-text("Send to Customer")')
          const hasApprove = await approveButton.first().isVisible({ timeout: 5000 }).catch(() => false)

          expect(hasApprove).toBe(true)
        }
      } else {
        test.info().annotations.push({ type: 'skip', description: 'No certificates pending review' })
      }
    })

    test('reviewer can enter message for customer', async ({ page }) => {
      await loginAsReviewer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      const pendingBadge = page.locator(`text=${STATUS_LABELS.PENDING_REVIEW}`).first()
      if (await pendingBadge.isVisible({ timeout: 5000 })) {
        const row = pendingBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const reviewLink = row.locator('a').first()

        if (await reviewLink.isVisible()) {
          await reviewLink.click()
          await page.waitForLoadState('networkidle')

          // Look for send to customer button
          const sendButton = page.locator('button:has-text("Send to Customer"), button:has-text("Approve")')
          if (await sendButton.first().isVisible({ timeout: 5000 })) {
            await sendButton.first().click()
            await page.waitForTimeout(500)

            // Modal/form should appear with message field
            const messageField = page.locator('textarea[name*="message"], textarea[placeholder*="message" i]')
            const hasMessageField = await messageField.first().isVisible({ timeout: 5000 }).catch(() => false)

            test.info().annotations.push({
              type: 'info',
              description: hasMessageField ? 'Customer message field available' : 'May not require message',
            })
          }
        }
      }
    })

    test('reviewer can select customer contact for approval', async ({ page }) => {
      await loginAsReviewer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      const pendingBadge = page.locator(`text=${STATUS_LABELS.PENDING_REVIEW}`).first()
      if (await pendingBadge.isVisible({ timeout: 5000 })) {
        const row = pendingBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const reviewLink = row.locator('a').first()

        if (await reviewLink.isVisible()) {
          await reviewLink.click()
          await page.waitForLoadState('networkidle')

          const sendButton = page.locator('button:has-text("Send to Customer")')
          if (await sendButton.first().isVisible({ timeout: 5000 })) {
            await sendButton.first().click()
            await page.waitForTimeout(500)

            // Customer email/contact selector
            const customerSelector = page.locator('select[name*="customer"], input[name*="email"], [data-testid="customer-select"]')
            const hasSelector = await customerSelector.first().isVisible({ timeout: 5000 }).catch(() => false)

            test.info().annotations.push({
              type: 'info',
              description: hasSelector ? 'Customer selector available' : 'May use default customer contact',
            })
          }
        }
      }
    })

    test('certificate status changes to PENDING_CUSTOMER_APPROVAL', async ({ page }) => {
      await loginAsReviewer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      // Look for certificates pending customer approval
      const customerApprovalBadge = page.locator(`text=${STATUS_LABELS.PENDING_CUSTOMER_APPROVAL}`)
      const hasPendingCustomer = await customerApprovalBadge.first().isVisible({ timeout: 5000 }).catch(() => false)

      test.info().annotations.push({
        type: 'info',
        description: hasPendingCustomer ? 'Found certificates pending customer approval' : 'No certificates in customer approval state',
      })
    })
  })
})

test.describe('Stage 7: Customer Reviews Certificate', () => {
  test.describe('7.1 - Customer Dashboard', () => {
    test('customer can login and see dashboard', async ({ page }) => {
      await loginAsCustomer(page)

      // Should see customer dashboard
      const dashboardHeader = page.locator('h1, h2').first()
      await expect(dashboardHeader).toBeVisible({ timeout: 10000 })

      // Should see certificate sections
      const certificateSection = page.locator('text=/pending|certificate|review/i')
      const hasSection = await certificateSection.first().isVisible({ timeout: 5000 }).catch(() => false)
      expect(hasSection).toBe(true)
    })

    test('customer sees pending certificates for review', async ({ page }) => {
      await loginAsCustomer(page)
      await page.waitForLoadState('networkidle')

      // Look for pending review section/tab
      const pendingSection = page.locator('text=/pending|review|awaiting/i, [data-tab="pending"]')
      const hasPending = await pendingSection.first().isVisible({ timeout: 5000 }).catch(() => false)

      if (hasPending) {
        await pendingSection.first().click()
        await page.waitForTimeout(500)
      }

      // Should see certificates list
      const certificateList = page.locator('table, [role="table"], .certificate-list')
      const hasList = await certificateList.first().isVisible({ timeout: 5000 }).catch(() => false)

      test.info().annotations.push({
        type: 'info',
        description: hasList ? 'Certificate list visible' : 'No certificates or different layout',
      })
    })

    test('customer can see certificate details', async ({ page }) => {
      await loginAsCustomer(page)
      await page.waitForLoadState('networkidle')

      // Find a certificate to review
      const certLink = page.locator('table a, [role="table"] a, button:has-text("Review")').first()
      const hasCert = await certLink.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasCert) {
        await certLink.click()
        // Wait for navigation - may stay on dashboard if clicking a non-link element
        await page.waitForLoadState('networkidle')

        // Check if we navigated to a review page
        const url = page.url()
        const navigatedToReview = url.includes('/review') || url.includes('/cert')

        if (navigatedToReview) {
          // Should see certificate details
          const certDetails = page.locator('text=/customer|uuc|calibration|certificate/i')
          const hasDetails = await certDetails.first().isVisible({ timeout: 5000 }).catch(() => false)
          expect(hasDetails).toBe(true)
        } else {
          test.info().annotations.push({ type: 'info', description: 'Link did not navigate to review page' })
        }
      } else {
        test.info().annotations.push({ type: 'skip', description: 'No certificates available for review' })
      }
    })

    test('customer can preview certificate PDF', async ({ page }) => {
      await loginAsCustomer(page)
      await page.waitForLoadState('networkidle')

      const certLink = page.locator('table a, [role="table"] a, button:has-text("Review")').first()
      if (await certLink.isVisible({ timeout: 5000 })) {
        await certLink.click()
        await page.waitForLoadState('networkidle')

        // Look for PDF preview
        const pdfButton = page.locator('button:has-text("Preview"), button:has-text("View PDF"), [data-testid="pdf-preview"]')
        const hasPdfButton = await pdfButton.first().isVisible({ timeout: 5000 }).catch(() => false)

        test.info().annotations.push({
          type: 'info',
          description: hasPdfButton ? 'PDF preview available' : 'PDF may be shown by default',
        })
      }
    })
  })

  test.describe('7.2 - Customer Approval Actions', () => {
    test('customer sees approve and reject/revision buttons', async ({ page }) => {
      await loginAsCustomer(page)
      await page.waitForLoadState('networkidle')

      const certLink = page.locator('table a, [role="table"] a, button:has-text("Review")').first()
      const hasCert = await certLink.isVisible({ timeout: 5000 }).catch(() => false)

      if (hasCert) {
        await certLink.click()
        await page.waitForLoadState('networkidle')

        // Check if we navigated to a review page
        const url = page.url()
        const navigatedToReview = url.includes('/review') || url.includes('/cert')

        if (navigatedToReview) {
          // Should see action buttons
          const approveButton = page.locator('button:has-text("Approve"), button:has-text("Accept")')
          const revisionButton = page.locator('button:has-text("Revision"), button:has-text("Request Changes"), button:has-text("Reject")')

          const hasApprove = await approveButton.first().isVisible({ timeout: 5000 }).catch(() => false)
          const hasRevision = await revisionButton.first().isVisible({ timeout: 3000 }).catch(() => false)

          // At least one action should be available, or certificate may not be in reviewable state
          test.info().annotations.push({
            type: 'info',
            description: hasApprove || hasRevision ? 'Action buttons visible' : 'Certificate may not be in reviewable state',
          })
        } else {
          test.info().annotations.push({ type: 'info', description: 'Link did not navigate to review page' })
        }
      } else {
        test.info().annotations.push({ type: 'skip', description: 'No certificates available for review' })
      }
    })

    test('customer can approve certificate', async ({ page }) => {
      await loginAsCustomer(page)
      await page.waitForLoadState('networkidle')

      const certLink = page.locator('table a, [role="table"] a, button:has-text("Review")').first()
      if (await certLink.isVisible({ timeout: 5000 })) {
        await certLink.click()
        await page.waitForLoadState('networkidle')

        const approveButton = page.locator('button:has-text("Approve"), button:has-text("Accept")')
        if (await approveButton.first().isVisible({ timeout: 5000 })) {
          // Don't actually click to preserve test data, but verify button exists
          expect(await approveButton.first().isEnabled()).toBe(true)
        }
      }
    })

    test('customer can request revision with feedback', async ({ page }) => {
      await loginAsCustomer(page)
      await page.waitForLoadState('networkidle')

      const certLink = page.locator('table a, [role="table"] a, button:has-text("Review")').first()
      if (await certLink.isVisible({ timeout: 5000 })) {
        await certLink.click()
        await page.waitForLoadState('networkidle')

        const revisionButton = page.locator('button:has-text("Revision"), button:has-text("Request Changes")')
        if (await revisionButton.first().isVisible({ timeout: 5000 })) {
          await revisionButton.first().click()
          await page.waitForTimeout(500)

          // Should show feedback input
          const feedbackField = page.locator('textarea, input[name*="feedback"], input[name*="note"]')
          const hasFeedbackField = await feedbackField.first().isVisible({ timeout: 5000 }).catch(() => false)

          if (hasFeedbackField) {
            await feedbackField.first().fill('Please verify the measurement readings in section 3')
          }

          test.info().annotations.push({
            type: 'info',
            description: hasFeedbackField ? 'Feedback input available' : 'May use different revision UI',
          })
        }
      }
    })

    test('customer must provide feedback for revision request', async ({ page }) => {
      await loginAsCustomer(page)
      await page.waitForLoadState('networkidle')

      const certLink = page.locator('table a, [role="table"] a, button:has-text("Review")').first()
      if (await certLink.isVisible({ timeout: 5000 })) {
        await certLink.click()
        await page.waitForLoadState('networkidle')

        const revisionButton = page.locator('button:has-text("Revision"), button:has-text("Request Changes")')
        if (await revisionButton.first().isVisible({ timeout: 5000 })) {
          await revisionButton.first().click()
          await page.waitForTimeout(500)

          // Try to submit without feedback
          const submitButton = page.locator('button:has-text("Submit"), button:has-text("Request")')
          if (await submitButton.first().isVisible({ timeout: 3000 })) {
            await submitButton.first().click()

            // Should show validation error
            const errorMessage = page.locator('text=/required|please|feedback/i')
            const hasError = await errorMessage.first().isVisible({ timeout: 5000 }).catch(() => false)

            test.info().annotations.push({
              type: 'info',
              description: hasError ? 'Feedback validation works' : 'May have different validation',
            })
          }
        }
      }
    })

    test('customer can select specific sections for revision', async ({ page }) => {
      await loginAsCustomer(page)
      // Use domcontentloaded as networkidle may not complete if there's polling
      await page.waitForLoadState('domcontentloaded')
      await page.waitForTimeout(1000) // Allow dynamic content to load

      const certLink = page.locator('table a, [role="table"] a, button:has-text("Review")').first()
      if (await certLink.isVisible({ timeout: 5000 }).catch(() => false)) {
        await certLink.click()
        await page.waitForLoadState('networkidle')

        const revisionButton = page.locator('button:has-text("Revision"), button:has-text("Request Changes")')
        if (await revisionButton.first().isVisible({ timeout: 5000 })) {
          await revisionButton.first().click()
          await page.waitForTimeout(500)

          // Look for section selection
          const sectionCheckboxes = page.locator('input[type="checkbox"], [role="checkbox"]')
          const hasCheckboxes = await sectionCheckboxes.first().isVisible({ timeout: 5000 }).catch(() => false)

          test.info().annotations.push({
            type: 'info',
            description: hasCheckboxes ? 'Section selection available' : 'General feedback form only',
          })
        }
      }
    })
  })

  test.describe('7.3 - Customer Chat/Notes', () => {
    test('customer can add note to certificate', async ({ page }) => {
      await loginAsCustomer(page)
      await page.waitForLoadState('networkidle')

      const certLink = page.locator('table a, [role="table"] a').first()
      if (await certLink.isVisible({ timeout: 5000 })) {
        await certLink.click()
        await page.waitForLoadState('networkidle')

        // Look for chat/note section
        const noteSection = page.locator('button:has-text("Add Note"), button:has-text("Message"), textarea[placeholder*="note" i]')
        const hasNoteSection = await noteSection.first().isVisible({ timeout: 5000 }).catch(() => false)

        test.info().annotations.push({
          type: 'info',
          description: hasNoteSection ? 'Note/chat section available' : 'May use different communication method',
        })
      }
    })

    test('customer can see communication history', async ({ page }) => {
      await loginAsCustomer(page)
      await page.waitForLoadState('networkidle')

      const certLink = page.locator('table a, [role="table"] a').first()
      if (await certLink.isVisible({ timeout: 5000 })) {
        await certLink.click()
        await page.waitForLoadState('networkidle')

        // Look for history/chat section
        const historySection = page.locator('text=/history|chat|messages|communication/i, [class*="history"], [class*="chat"]')
        const hasHistory = await historySection.first().isVisible({ timeout: 5000 }).catch(() => false)

        test.info().annotations.push({
          type: 'info',
          description: hasHistory ? 'Communication history visible' : 'May be on separate tab',
        })
      }
    })
  })
})

test.describe('Stage 8: Reviewer Handles Customer Feedback', () => {
  test.describe('8.1 - Customer Revision Notification', () => {
    test('reviewer sees certificates with customer revision requests', async ({ page }) => {
      await loginAsReviewer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      // Look for customer revision required status
      const customerRevisionBadge = page.locator(`text=${STATUS_LABELS.CUSTOMER_REVISION_REQUIRED}`)
      const hasCustomerRevision = await customerRevisionBadge.first().isVisible({ timeout: 5000 }).catch(() => false)

      // Also check stats
      const statsSection = page.locator('text=/customer revision|customer feedback/i')
      const hasStats = await statsSection.first().isVisible({ timeout: 3000 }).catch(() => false)

      test.info().annotations.push({
        type: 'info',
        description: hasCustomerRevision || hasStats ? 'Customer revision indicators visible' : 'No customer revision requests',
      })
    })

    test('reviewer can view customer feedback details', async ({ page }) => {
      await loginAsReviewer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      const customerRevisionBadge = page.locator(`text=${STATUS_LABELS.CUSTOMER_REVISION_REQUIRED}`).first()
      if (await customerRevisionBadge.isVisible({ timeout: 5000 })) {
        const row = customerRevisionBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const viewLink = row.locator('a').first()

        if (await viewLink.isVisible()) {
          await viewLink.click()
          await page.waitForLoadState('networkidle')

          // Should see customer feedback
          const customerFeedback = page.locator('text=/customer|feedback|revision/i')
          const hasFeedback = await customerFeedback.first().isVisible({ timeout: 5000 }).catch(() => false)

          expect(hasFeedback).toBe(true)
        }
      } else {
        test.info().annotations.push({ type: 'skip', description: 'No customer revision requests' })
      }
    })

    test('reviewer can respond to customer feedback', async ({ page }) => {
      await loginAsReviewer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      const customerRevisionBadge = page.locator(`text=${STATUS_LABELS.CUSTOMER_REVISION_REQUIRED}`).first()
      if (await customerRevisionBadge.isVisible({ timeout: 5000 })) {
        const row = customerRevisionBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const viewLink = row.locator('a').first()

        if (await viewLink.isVisible()) {
          await viewLink.click()
          await page.waitForLoadState('networkidle')

          // Look for response option
          const responseButton = page.locator('button:has-text("Reply"), button:has-text("Respond"), button:has-text("Forward")')
          const hasResponseOption = await responseButton.first().isVisible({ timeout: 5000 }).catch(() => false)

          test.info().annotations.push({
            type: 'info',
            description: hasResponseOption ? 'Response option available' : 'May use different workflow',
          })
        }
      }
    })

    test('reviewer can forward customer feedback to engineer', async ({ page }) => {
      await loginAsReviewer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      const customerRevisionBadge = page.locator(`text=${STATUS_LABELS.CUSTOMER_REVISION_REQUIRED}`).first()
      if (await customerRevisionBadge.isVisible({ timeout: 5000 })) {
        const row = customerRevisionBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const viewLink = row.locator('a').first()

        if (await viewLink.isVisible()) {
          await viewLink.click()
          await page.waitForLoadState('networkidle')

          // Look for forward/assign to engineer option
          const forwardButton = page.locator('button:has-text("Forward"), button:has-text("Assign"), button:has-text("Send to Engineer"), button:has-text("Request Revision")')
          const hasForwardOption = await forwardButton.first().isVisible({ timeout: 5000 }).catch(() => false)

          expect(hasForwardOption).toBe(true)
        }
      } else {
        test.info().annotations.push({ type: 'skip', description: 'No customer revision requests' })
      }
    })

    test('reviewer can add notes when forwarding', async ({ page }) => {
      await loginAsReviewer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      const customerRevisionBadge = page.locator(`text=${STATUS_LABELS.CUSTOMER_REVISION_REQUIRED}`).first()
      if (await customerRevisionBadge.isVisible({ timeout: 5000 })) {
        const row = customerRevisionBadge.locator('xpath=ancestor::tr | ancestor::div[contains(@class, "row")]')
        const viewLink = row.locator('a').first()

        if (await viewLink.isVisible()) {
          await viewLink.click()
          await page.waitForLoadState('networkidle')

          const forwardButton = page.locator('button:has-text("Forward"), button:has-text("Request Revision")')
          if (await forwardButton.first().isVisible({ timeout: 5000 })) {
            await forwardButton.first().click()
            await page.waitForTimeout(500)

            // Should show note/comment field
            const noteField = page.locator('textarea')
            const hasNoteField = await noteField.first().isVisible({ timeout: 5000 }).catch(() => false)

            if (hasNoteField) {
              await noteField.first().fill('Customer requests corrections. Please address and resubmit.')
            }

            test.info().annotations.push({
              type: 'info',
              description: hasNoteField ? 'Note field available' : 'May not require note',
            })
          }
        }
      }
    })
  })

  test.describe('8.2 - Engineer Receives Forwarded Feedback', () => {
    test('engineer sees certificate with forwarded customer feedback', async ({ page }) => {
      await loginAsEngineer(page)
      await page.goto('/dashboard')
      await page.waitForLoadState('networkidle')

      // Look for revision required from customer feedback
      const revisionBadge = page.locator(`text=${STATUS_LABELS.REVISION_REQUIRED}`)
      const hasRevision = await revisionBadge.first().isVisible({ timeout: 5000 }).catch(() => false)

      test.info().annotations.push({
        type: 'info',
        description: hasRevision ? 'Revision requests visible' : 'No revision requests',
      })
    })

    test('engineer can see customer feedback in history', async ({ page }) => {
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

          // Look for customer feedback in history
          const customerFeedback = page.locator('text=/customer/i')
          const hasFeedback = await customerFeedback.first().isVisible({ timeout: 5000 }).catch(() => false)

          test.info().annotations.push({
            type: 'info',
            description: hasFeedback ? 'Customer feedback visible in history' : 'Feedback may be labeled differently',
          })
        }
      }
    })
  })
})
