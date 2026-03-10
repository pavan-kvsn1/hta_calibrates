/**
 * Data Migration Script: Fix Feedback Revision Numbers and Types
 *
 * This script fixes three issues in existing feedback data:
 * 1. Engineer responses (ASSIGNEE_RESPONSE) stored with wrong revisionNumber
 * 2. Customer feedback stored as REVISION_REQUESTED instead of CUSTOMER_REVISION_FORWARDED
 * 3. Approvals stored with wrong revisionNumber (should match the cycle being closed)
 *
 * Run with: npx tsx scripts/migrate-feedback-data.ts
 * Add --dry-run flag to preview changes without applying them
 */

import { prisma } from '../src/lib/prisma'

const isDryRun = process.argv.includes('--dry-run')

interface FeedbackUpdate {
  id: string
  certificateNumber: string
  field: string
  oldValue: string | number
  newValue: string | number
  reason: string
}

async function main() {
  console.log('=== Feedback Data Migration ===')
  console.log(`Mode: ${isDryRun ? 'DRY RUN (no changes will be made)' : 'LIVE (changes will be applied)'}\n`)

  const updates: FeedbackUpdate[] = []

  // Get all certificates with feedbacks
  const certificates = await prisma.certificate.findMany({
    include: {
      feedbacks: {
        orderBy: { createdAt: 'asc' },
        include: {
          user: { select: { name: true, role: true } }
        }
      },
      events: {
        orderBy: { createdAt: 'asc' },
      }
    }
  })

  console.log(`Processing ${certificates.length} certificates...\n`)

  for (const cert of certificates) {
    if (cert.feedbacks.length === 0) continue

    const feedbacks = cert.feedbacks
    const events = cert.events

    // === FIX 1: Engineer responses with wrong revisionNumber ===
    const responses = feedbacks.filter(f =>
      f.feedbackType === 'ASSIGNEE_RESPONSE' || f.feedbackType === 'ENGINEER_RESPONSE'
    )

    for (const response of responses) {
      // Find the most recent revision request BEFORE this response
      const priorRequests = feedbacks.filter(f =>
        (f.feedbackType === 'REVISION_REQUESTED' ||
         f.feedbackType === 'REVISION_REQUEST' ||
         f.feedbackType === 'CUSTOMER_REVISION_FORWARDED') &&
        new Date(f.createdAt) < new Date(response.createdAt)
      )

      if (priorRequests.length > 0) {
        const lastRequest = priorRequests[priorRequests.length - 1]
        if (lastRequest.revisionNumber !== response.revisionNumber) {
          updates.push({
            id: response.id,
            certificateNumber: cert.certificateNumber,
            field: 'revisionNumber',
            oldValue: response.revisionNumber,
            newValue: lastRequest.revisionNumber,
            reason: `Engineer response should match request revision (responding to: "${lastRequest.comment?.substring(0, 40)}...")`
          })
        }
      }
    }

    // === FIX 2: Customer feedback with wrong feedbackType ===
    // Find feedbacks that were created right after a CUSTOMER_REVISION_REQUESTED event
    const customerRevisionEvents = events.filter(e =>
      e.eventType === 'CUSTOMER_REVISION_REQUESTED' ||
      e.eventType === 'CUSTOMER_REVISION'
    )

    for (const customerEvent of customerRevisionEvents) {
      // Find feedbacks created within 2 hours after customer revision event
      // that are marked as REVISION_REQUESTED but should be CUSTOMER_REVISION_FORWARDED
      const customerEventTime = new Date(customerEvent.createdAt).getTime()
      const twoHoursLater = customerEventTime + (2 * 60 * 60 * 1000)

      const suspectFeedbacks = feedbacks.filter(f =>
        f.feedbackType === 'REVISION_REQUESTED' &&
        new Date(f.createdAt).getTime() > customerEventTime &&
        new Date(f.createdAt).getTime() < twoHoursLater
      )

      // Also find feedbacks that are already marked as CUSTOMER_REVISION_FORWARDED
      // to check if other feedbacks were created at the same time
      const confirmedCustomerFeedbacks = feedbacks.filter(f =>
        f.feedbackType === 'CUSTOMER_REVISION_FORWARDED' &&
        new Date(f.createdAt).getTime() > customerEventTime &&
        new Date(f.createdAt).getTime() < twoHoursLater
      )

      for (const feedback of suspectFeedbacks) {
        // Check if comment contains customer-related keywords
        const comment = (feedback.comment || '').toLowerCase()
        const feedbackTime = new Date(feedback.createdAt).getTime()

        const isLikelyCustomerFeedback =
          comment.includes('customer') ||
          comment.includes('follow the') ||
          comment.includes('as per') ||
          comment.includes('requested by') ||
          // Or if there's a corresponding CUSTOMER_REVISION_FORWARDED event nearby
          events.some(e =>
            e.eventType === 'CUSTOMER_REVISION_FORWARDED' &&
            Math.abs(new Date(e.createdAt).getTime() - feedbackTime) < 60000
          ) ||
          // Or if created at the same time as other confirmed customer feedbacks
          // (within 1 second - same form submission)
          confirmedCustomerFeedbacks.some(cf =>
            Math.abs(new Date(cf.createdAt).getTime() - feedbackTime) < 1000
          )

        if (isLikelyCustomerFeedback) {
          updates.push({
            id: feedback.id,
            certificateNumber: cert.certificateNumber,
            field: 'feedbackType',
            oldValue: feedback.feedbackType,
            newValue: 'CUSTOMER_REVISION_FORWARDED',
            reason: `Feedback created after customer revision event should be CUSTOMER_REVISION_FORWARDED`
          })
        }
      }
    }

    // === FIX 3: Approvals with wrong revisionNumber ===
    const approvals = feedbacks.filter(f =>
      f.feedbackType === 'APPROVED' || f.feedbackType === 'APPROVAL_NOTE'
    )

    for (const approval of approvals) {
      // Find the most recent revision request BEFORE this approval
      const priorRequests = feedbacks.filter(f =>
        (f.feedbackType === 'REVISION_REQUESTED' ||
         f.feedbackType === 'REVISION_REQUEST' ||
         f.feedbackType === 'CUSTOMER_REVISION_FORWARDED') &&
        new Date(f.createdAt) < new Date(approval.createdAt)
      )

      if (priorRequests.length > 0) {
        const lastRequest = priorRequests[priorRequests.length - 1]
        // Approval should close the cycle that started with the last request
        if (lastRequest.revisionNumber !== approval.revisionNumber) {
          updates.push({
            id: approval.id,
            certificateNumber: cert.certificateNumber,
            field: 'revisionNumber',
            oldValue: approval.revisionNumber,
            newValue: lastRequest.revisionNumber,
            reason: `Approval should close the revision cycle (Rev ${lastRequest.revisionNumber})`
          })
        }
      }
    }
  }

  // Print summary
  console.log('\n=== Migration Summary ===\n')

  if (updates.length === 0) {
    console.log('No updates needed. All feedback data appears correct.')
    return
  }

  // Group by certificate
  const byCert = updates.reduce((acc, u) => {
    if (!acc[u.certificateNumber]) acc[u.certificateNumber] = []
    acc[u.certificateNumber].push(u)
    return acc
  }, {} as Record<string, FeedbackUpdate[]>)

  for (const [certNum, certUpdates] of Object.entries(byCert)) {
    console.log(`\nCertificate: ${certNum}`)
    console.log('-'.repeat(50))

    for (const update of certUpdates) {
      console.log(`  ${update.field}: ${update.oldValue} → ${update.newValue}`)
      console.log(`    Reason: ${update.reason}`)
    }
  }

  console.log(`\nTotal updates: ${updates.length}`)

  // Apply updates if not dry run
  if (!isDryRun) {
    console.log('\nApplying updates...')

    for (const update of updates) {
      if (update.field === 'revisionNumber') {
        await prisma.reviewFeedback.update({
          where: { id: update.id },
          data: { revisionNumber: update.newValue as number }
        })
      } else if (update.field === 'feedbackType') {
        await prisma.reviewFeedback.update({
          where: { id: update.id },
          data: { feedbackType: update.newValue as string }
        })
      }
    }

    console.log('Updates applied successfully!')
  } else {
    console.log('\nDry run complete. Run without --dry-run to apply changes.')
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
