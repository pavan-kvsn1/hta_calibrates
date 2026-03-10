import { prisma } from '../src/lib/prisma'

async function main() {
  // Get specific certificate with feedbacks AND events
  const cert = await prisma.certificate.findFirst({
    where: { certificateNumber: 'HTA/C50791/03/26' },
    select: {
      id: true,
      certificateNumber: true,
      status: true,
      currentRevision: true,
      feedbacks: {
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: { name: true, role: true }
          }
        }
      },
      events: {
        orderBy: { createdAt: 'asc' },
        include: {
          user: {
            select: { name: true, role: true }
          }
        }
      }
    }
  })

  if (!cert) {
    console.log('Certificate not found')
    return
  }

  console.log('=== DIAGNOSTIC REPORT ===\n')
  console.log(`Certificate: ${cert.certificateNumber}`)
  console.log(`Status: ${cert.status} | Current Revision: ${cert.currentRevision}`)

  console.log('\n\n=== EVENTS (Chronological) ===')
  console.log('This shows the actual workflow sequence:\n')

  for (const ev of cert.events) {
    const data = ev.eventData ? JSON.parse(ev.eventData) : {}
    console.log(`  [Seq ${ev.sequenceNumber}] Rev ${ev.revision} | ${ev.eventType}`)
    console.log(`    Time: ${ev.createdAt}`)
    console.log(`    By: ${ev.user?.name || 'System'} (${ev.user?.role || 'N/A'})`)
    if (data.comment) console.log(`    Comment: ${data.comment.substring(0, 80)}...`)
    console.log('')
  }

  console.log('\n\n=== FEEDBACKS (Database Records) ===')
  console.log('Checking for data inconsistencies:\n')

  for (const fb of cert.feedbacks) {
    console.log(`  ID: ${fb.id.substring(0, 8)}...`)
    console.log(`  [Rev ${fb.revisionNumber}] ${fb.feedbackType}`)
    console.log(`  Section: ${fb.targetSection || 'General (null)'}`)
    console.log(`  By: ${fb.user?.name || 'Unknown'} (${fb.user?.role || 'N/A'})`)
    console.log(`  Comment: ${fb.comment?.substring(0, 80)}${(fb.comment?.length || 0) > 80 ? '...' : ''}`)
    console.log(`  Created: ${fb.createdAt}`)
    console.log('')
  }

  // Analyze issues
  console.log('\n\n=== ISSUE ANALYSIS ===\n')

  // Check for engineer responses that should be at different revision
  const responses = cert.feedbacks.filter(f =>
    f.feedbackType === 'ASSIGNEE_RESPONSE' || f.feedbackType === 'ENGINEER_RESPONSE'
  )

  for (const resp of responses) {
    // Find the most recent revision request BEFORE this response
    const priorRequests = cert.feedbacks.filter(f =>
      (f.feedbackType === 'REVISION_REQUESTED' || f.feedbackType === 'CUSTOMER_REVISION_FORWARDED') &&
      new Date(f.createdAt) < new Date(resp.createdAt)
    )

    if (priorRequests.length > 0) {
      const lastRequest = priorRequests[priorRequests.length - 1]
      if (lastRequest.revisionNumber !== resp.revisionNumber) {
        console.log(`  ISSUE: Response at Rev ${resp.revisionNumber} should be at Rev ${lastRequest.revisionNumber}`)
        console.log(`    Response: "${resp.comment?.substring(0, 50)}..."`)
        console.log(`    Should match request: "${lastRequest.comment?.substring(0, 50)}..."`)
        console.log('')
      }
    }
  }

  // Check for customer feedback not marked correctly
  const customerKeywords = ['customer', 'follow the customer', 'customer instruction']
  for (const fb of cert.feedbacks) {
    const commentLower = (fb.comment || '').toLowerCase()
    const hasCustomerKeyword = customerKeywords.some(kw => commentLower.includes(kw))

    if (hasCustomerKeyword && fb.feedbackType !== 'CUSTOMER_REVISION_FORWARDED') {
      console.log(`  ISSUE: Feedback appears to be customer-related but is marked as ${fb.feedbackType}`)
      console.log(`    Comment: "${fb.comment?.substring(0, 80)}..."`)
      console.log('')
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
