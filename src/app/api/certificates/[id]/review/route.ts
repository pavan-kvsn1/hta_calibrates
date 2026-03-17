import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { notifyAssigneeOnReview, notifyOnSentToCustomer } from '@/lib/services/notifications'
import { isOpenSignHealthy, selfSignDocument, getSignatureWidgets, withRetry } from '@/lib/services/opensign'
import { generateSignedPDF, getPageCountFromBuffer } from '@/lib/services/pdf/generator'
import {
  appendSigningEvidence,
  collectServerEvidence,
  buildSigningEvidencePayload,
  type ClientEvidence,
} from '@/lib/stores/signing-evidence'

interface RouteContext {
  params: Promise<{ id: string }>
}

// Pending edit type from frontend
interface PendingEdit {
  field: 'dateOfCalibration' | 'calibrationDueDate'
  fieldLabel: string
  originalValue: string
  newValue: string
  reason: string
  autoCalculated?: boolean
}

// Customer data for send-to-customer flow
interface CustomerData {
  email: string
  name: string
  message?: string
}

// POST - Reviews certificate (peer review workflow)
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json()

    // Get existing certificate
    const certificate = await prisma.certificate.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Verify reviewer is assigned
    if (!certificate.reviewerId) {
      return NextResponse.json(
        { error: 'No reviewer assigned to this certificate' },
        { status: 400 }
      )
    }

    // Verify certificate is in a reviewable state
    const reviewableStatuses = ['PENDING_REVIEW', 'CUSTOMER_REVISION_REQUIRED']
    if (!reviewableStatuses.includes(certificate.status)) {
      return NextResponse.json(
        { error: `Certificate is not in a reviewable state. Current status: ${certificate.status}` },
        { status: 400 }
      )
    }

    // Handle peer review
    return handlePeerReview(request, session, certificate, body)
  } catch (error) {
    console.error('Review error:', error)
    return NextResponse.json(
      { error: 'Failed to process review' },
      { status: 500 }
    )
  }
}

/**
 * Handle peer review (new workflow)
 * Reviewer can approve, request revision, or send to customer
 */
async function handlePeerReview(
  request: NextRequest,
  session: { user: { id: string; name?: string | null; email: string; role?: string | null } },
  certificate: {
    id: string
    certificateNumber: string
    status: string
    currentRevision: number
    reviewerId: string | null
    createdById: string
    createdBy: { id: string; name: string | null; email: string }
    customerName: string | null
    dateOfCalibration: Date | null
    calibrationDueDate: Date | null
  },
  body: {
    action: string
    comment?: string
    targetSection?: string
    // New structure for multiple section feedbacks
    sectionFeedbacks?: { section: string; comment: string }[]
    generalNotes?: string
    edits?: PendingEdit[]
    sendToCustomer?: CustomerData
    signatureData?: string
    signerName?: string
    clientEvidence?: ClientEvidence
  }
) {
  const { action, comment, targetSection, sectionFeedbacks, generalNotes, edits, sendToCustomer, signatureData, signerName, clientEvidence } = body

  // Verify the current user is the reviewer
  if (certificate.reviewerId !== session.user.id) {
    return NextResponse.json(
      { error: 'You are not the reviewer for this certificate' },
      { status: 403 }
    )
  }

  // Validate action
  if (!['approve', 'request_revision', 'reject'].includes(action)) {
    return NextResponse.json(
      { error: 'Invalid action. Must be approve, request_revision, or reject' },
      { status: 400 }
    )
  }

  // Require feedback for revision request (either sectionFeedbacks or comment)
  if (action === 'request_revision') {
    const hasValidSectionFeedbacks = sectionFeedbacks && sectionFeedbacks.length > 0 &&
      sectionFeedbacks.some(sf => sf.comment?.trim())
    const hasComment = comment?.trim()

    if (!hasValidSectionFeedbacks && !hasComment) {
      return NextResponse.json(
        { error: 'Please provide at least one section feedback or general notes' },
        { status: 400 }
      )
    }
  }

  // Require comment for reject
  if (action === 'reject' && !comment?.trim()) {
    return NextResponse.json(
      { error: 'Comment is required for rejections' },
      { status: 400 }
    )
  }

  // Validate approval requirements
  if (action === 'approve') {
    if (!signatureData || !signerName?.trim()) {
      return NextResponse.json(
        { error: 'Signature and signer name are required for approval' },
        { status: 400 }
      )
    }

    // Validate signer name matches user profile
    if (session.user.name && signerName.trim().toLowerCase() !== session.user.name.toLowerCase()) {
      return NextResponse.json(
        { error: 'Signer name must match your profile name' },
        { status: 400 }
      )
    }

    // Validate customer data if sendToCustomer is provided
    if (sendToCustomer) {
      if (!sendToCustomer.email?.trim()) {
        return NextResponse.json(
          { error: 'Customer email is required for sending to customer' },
          { status: 400 }
        )
      }
      if (!sendToCustomer.name?.trim()) {
        return NextResponse.json(
          { error: 'Customer name is required for sending to customer' },
          { status: 400 }
        )
      }
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(sendToCustomer.email)) {
        return NextResponse.json(
          { error: 'Please enter a valid customer email address' },
          { status: 400 }
        )
      }
    }

    // Validate edits if provided
    const pendingEdits: PendingEdit[] = edits || []
    for (const edit of pendingEdits) {
      if (!edit.field || !edit.newValue) {
        return NextResponse.json(
          { error: 'Invalid edit: field and newValue are required' },
          { status: 400 }
        )
      }
      if (!edit.autoCalculated && !edit.reason?.trim()) {
        return NextResponse.json(
          { error: `Reason is required for editing ${edit.fieldLabel}` },
          { status: 400 }
        )
      }
    }
  }

  const userId = session.user.id

  if (action === 'approve') {
    const pendingEdits: PendingEdit[] = edits || []
    const customerData = sendToCustomer ? {
      email: sendToCustomer.email.toLowerCase(),
      name: sendToCustomer.name,
      message: sendToCustomer.message,
    } : null

    // Determine status: if sending to customer, use PENDING_CUSTOMER_APPROVAL
    const newStatus = customerData ? 'PENDING_CUSTOMER_APPROVAL' : 'APPROVED'

    const result = await prisma.$transaction(async (tx) => {
      // Get next event sequence
      const lastEvent = await tx.certificateEvent.findFirst({
        where: { certificateId: certificate.id },
        orderBy: { sequenceNumber: 'desc' },
      })
      let nextSequence = (lastEvent?.sequenceNumber ?? 0) + 1

      // Build certificate update data
      const certUpdateData: {
        status: string
        lastModifiedById: string
        dateOfCalibration?: Date
        calibrationDueDate?: Date
      } = {
        status: newStatus,
        lastModifiedById: userId,
      }

      // Process pending edits
      const dateOfCalibrationEdit = pendingEdits.find(e => e.field === 'dateOfCalibration')
      const calibrationDueDateEdit = pendingEdits.find(e => e.field === 'calibrationDueDate')

      if (dateOfCalibrationEdit) {
        certUpdateData.dateOfCalibration = new Date(dateOfCalibrationEdit.newValue)
      }
      if (calibrationDueDateEdit) {
        certUpdateData.calibrationDueDate = new Date(calibrationDueDateEdit.newValue)
      }

      // Update certificate
      const updatedCert = await tx.certificate.update({
        where: { id: certificate.id },
        data: certUpdateData,
      })

      // If there are edits, create REVIEWER_DATE_OVERRIDE event
      if (pendingEdits.length > 0) {
        await tx.certificateEvent.create({
          data: {
            certificateId: certificate.id,
            sequenceNumber: nextSequence,
            revision: certificate.currentRevision,
            eventType: 'REVIEWER_DATE_OVERRIDE',
            eventData: JSON.stringify({
              edits: pendingEdits.map(edit => ({
                field: edit.field,
                fieldLabel: edit.fieldLabel,
                previousValue: edit.field === 'dateOfCalibration'
                  ? certificate.dateOfCalibration?.toISOString() || null
                  : certificate.calibrationDueDate?.toISOString() || null,
                newValue: edit.newValue,
                reason: edit.reason,
                autoCalculated: edit.autoCalculated || false,
              })),
            }),
            userId,
            userRole: 'ENGINEER',
          },
        })
        nextSequence++
      }

      // For approvals, we want to close the most recent revision cycle
      // Query for the most recent revision request to get its revision number
      const mostRecentRevisionRequest = await tx.reviewFeedback.findFirst({
        where: {
          certificateId: certificate.id,
          feedbackType: { in: ['REVISION_REQUEST', 'REVISION_REQUESTED', 'CUSTOMER_REVISION_FORWARDED'] },
        },
        orderBy: { createdAt: 'desc' },
        select: { revisionNumber: true },
      })

      // If there was a revision request, approval closes that cycle
      // Otherwise, this is the first approval (use current revision)
      const approvalRevisionNumber = mostRecentRevisionRequest?.revisionNumber ?? certificate.currentRevision

      // Create feedback record
      await tx.reviewFeedback.create({
        data: {
          certificateId: certificate.id,
          userId,
          feedbackType: customerData ? 'APPROVAL_NOTE' : 'APPROVED',
          comment: comment || 'Certificate approved by reviewer.',
          revisionNumber: approvalRevisionNumber,
        },
      })

      // Create approval event
      await tx.certificateEvent.create({
        data: {
          certificateId: certificate.id,
          sequenceNumber: nextSequence,
          revision: certificate.currentRevision,
          userId,
          userRole: 'ENGINEER',
          eventType: customerData ? 'REVIEWER_APPROVED_SENT_TO_CUSTOMER' : 'APPROVED',
          eventData: JSON.stringify({
            comment: comment || 'Certificate approved by peer reviewer.',
            reviewerId: userId,
            signerName: signerName,
            signerEmail: session.user.email,
            hasEdits: pendingEdits.length > 0,
            sentToCustomer: !!customerData,
          }),
        },
      })
      nextSequence++

      // Store reviewer signature
      await tx.signature.deleteMany({
        where: { certificateId: certificate.id, signerType: 'REVIEWER' },
      })

      const reviewerSignature = await tx.signature.create({
        data: {
          certificateId: certificate.id,
          signerType: 'REVIEWER',
          signerName: signerName!,
          signerEmail: session.user.email,
          signatureData: signatureData!,
          signerId: userId,
        },
      })

      // If sending to customer, create token
      let tokenResult = null
      if (customerData) {
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
        const token = crypto.randomUUID()

        // Find or create CustomerUser
        let customer = await tx.customerUser.findUnique({
          where: { email: customerData.email },
        })

        if (!customer) {
          const tempPasswordHash = crypto.randomBytes(32).toString('hex')
          customer = await tx.customerUser.create({
            data: {
              email: customerData.email,
              name: customerData.name,
              passwordHash: tempPasswordHash,
              companyName: certificate.customerName || 'Unknown Company',
              isActive: true,
            },
          })
        }

        // Create ApprovalToken
        const approvalToken = await tx.approvalToken.create({
          data: {
            token,
            certificateId: certificate.id,
            customerId: customer.id,
            expiresAt,
          },
        })

        // Create SENT_TO_CUSTOMER event
        await tx.certificateEvent.create({
          data: {
            certificateId: certificate.id,
            sequenceNumber: nextSequence,
            revision: certificate.currentRevision,
            eventType: 'SENT_TO_CUSTOMER',
            eventData: JSON.stringify({
              customerEmail: customerData.email,
              customerName: customerData.name,
              message: customerData.message || null,
              tokenId: approvalToken.id,
              expiresAt: expiresAt.toISOString(),
              sentBy: session.user.name,
            }),
            userId,
            userRole: 'ENGINEER',
          },
        })

        tokenResult = {
          token: approvalToken.token,
          customerId: customer.id,
          expiresAt: approvalToken.expiresAt,
        }
      }

      return { certificate: updatedCert, reviewerSignature, tokenResult }
    })

    // Capture reviewer signing evidence if client evidence provided
    if (result.reviewerSignature && clientEvidence) {
      try {
        const serverEvidence = collectServerEvidence(request, 'direct')
        const evidencePayload = buildSigningEvidencePayload(
          clientEvidence,
          serverEvidence,
          {
            signerType: 'REVIEWER',
            signerName: signerName!,
            signerEmail: session.user.email,
            signerId: userId,
          }
        )
        await appendSigningEvidence(certificate.id, result.reviewerSignature.id, 'REVIEWER_SIGNED', evidencePayload, result.certificate.currentRevision)
      } catch (evidenceError) {
        console.error('Failed to capture reviewer signing evidence:', evidenceError)
      }
    }

    // Notify assignee (fire and forget)
    import('@/lib/services/queue').then(({ enqueue }) => {
      enqueue('notification:send', {
        userId: certificate.createdById,
        type: 'CERTIFICATE_APPROVED',
        title: 'Certificate Approved',
        message: `Certificate ${certificate.certificateNumber} has been approved by ${session.user.name || 'Reviewer'}.`,
        certificateId: certificate.id,
      }).catch(console.error)
    })

    // If sent to customer, also notify
    if (result.tokenResult) {
      notifyOnSentToCustomer({
        certificateId: certificate.id,
        certificateNumber: certificate.certificateNumber,
        assigneeId: certificate.createdById,
        customerId: result.tokenResult.customerId,
      }).catch((err) => console.error('Failed to send notification:', err))
    }

    // Build response
    const response: {
      success: boolean
      message: string
      customerToken?: {
        token: string
        reviewUrl: string
        expiresAt: string
      }
    } = {
      success: true,
      message: result.tokenResult
        ? 'Certificate approved and sent to customer for review'
        : 'Certificate approved successfully',
    }

    if (result.tokenResult) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      response.customerToken = {
        token: result.tokenResult.token,
        reviewUrl: `${baseUrl}/customer/review/${result.tokenResult.token}`,
        expiresAt: result.tokenResult.expiresAt.toISOString(),
      }
    }

    return NextResponse.json(response)
  }

  if (action === 'request_revision') {
    // Collect all feedback entries to create
    const feedbackEntries: { section: string | null; comment: string }[] = []

    // Add section-specific feedbacks
    if (sectionFeedbacks && sectionFeedbacks.length > 0) {
      for (const sf of sectionFeedbacks) {
        if (sf.comment?.trim()) {
          feedbackEntries.push({
            section: sf.section,
            comment: sf.comment.trim(),
          })
        }
      }
    }

    // Add general notes (legacy comment field or explicit generalNotes)
    const generalComment = generalNotes?.trim() || comment?.trim()
    if (generalComment) {
      feedbackEntries.push({
        section: null, // null section means general notes
        comment: generalComment,
      })
    }

    // Determine feedback type based on certificate status
    // If status is CUSTOMER_REVISION_REQUIRED, this is forwarding customer feedback
    const isForwardingCustomerFeedback = certificate.status === 'CUSTOMER_REVISION_REQUIRED'
    const feedbackType = isForwardingCustomerFeedback ? 'CUSTOMER_REVISION_FORWARDED' : 'REVISION_REQUESTED'
    const eventType = isForwardingCustomerFeedback ? 'CUSTOMER_REVISION_FORWARDED' : 'REVISION_REQUESTED'

    await prisma.$transaction(async (tx) => {
      // Get next event sequence
      const lastEvent = await tx.certificateEvent.findFirst({
        where: { certificateId: certificate.id },
        orderBy: { sequenceNumber: 'desc' },
      })
      const nextSequence = (lastEvent?.sequenceNumber ?? 0) + 1

      // Update certificate status
      await tx.certificate.update({
        where: { id: certificate.id },
        data: {
          status: 'REVISION_REQUIRED',
          lastModifiedById: userId,
        },
      })

      // Create event first (so we can reference it in feedback)
      const event = await tx.certificateEvent.create({
        data: {
          certificateId: certificate.id,
          sequenceNumber: nextSequence,
          revision: certificate.currentRevision,
          userId,
          userRole: 'ENGINEER',
          eventType,
          eventData: JSON.stringify({
            feedbackCount: feedbackEntries.length,
            sections: feedbackEntries.filter(e => e.section).map(e => e.section),
            hasGeneralNotes: feedbackEntries.some(e => !e.section),
            reviewerId: userId,
            isCustomerFeedback: isForwardingCustomerFeedback,
          }),
        },
      })

      // Create feedback records for each entry
      for (const entry of feedbackEntries) {
        await tx.reviewFeedback.create({
          data: {
            certificateId: certificate.id,
            userId,
            feedbackType,
            comment: entry.comment,
            targetSection: entry.section,
            revisionNumber: certificate.currentRevision,
            eventId: event.id,
          },
        })
      }
    })

    // Build notification message with section info
    const sectionCount = feedbackEntries.filter(e => e.section).length
    const hasGeneral = feedbackEntries.some(e => !e.section)
    const actionVerb = isForwardingCustomerFeedback ? 'forwarded customer feedback' : 'requested revisions'
    let notificationMessage = `${session.user.name || 'Reviewer'} has ${actionVerb} for certificate ${certificate.certificateNumber}`
    if (sectionCount > 0) {
      notificationMessage += ` (${sectionCount} section${sectionCount > 1 ? 's' : ''}${hasGeneral ? ' + notes' : ''})`
    }

    // Notify assignee (fire and forget)
    import('@/lib/services/queue').then(({ enqueue }) => {
      enqueue('notification:send', {
        userId: certificate.createdById,
        type: isForwardingCustomerFeedback ? 'CUSTOMER_REVISION_FORWARDED' : 'REVISION_REQUESTED',
        title: isForwardingCustomerFeedback ? 'Customer Feedback Forwarded' : 'Revision Requested',
        message: notificationMessage,
        certificateId: certificate.id,
        data: {
          feedbackCount: String(feedbackEntries.length),
          sections: feedbackEntries.filter(e => e.section).map(e => e.section).join(','),
          isCustomerFeedback: String(isForwardingCustomerFeedback),
        },
      }).catch(console.error)
    })

    return NextResponse.json({
      success: true,
      message: isForwardingCustomerFeedback
        ? `Customer feedback forwarded with ${feedbackEntries.length} item${feedbackEntries.length > 1 ? 's' : ''}`
        : `Revision requested with ${feedbackEntries.length} feedback item${feedbackEntries.length > 1 ? 's' : ''}`,
    })
  }

  if (action === 'reject') {
    await prisma.$transaction(async (tx) => {
      // Get next event sequence
      const lastEvent = await tx.certificateEvent.findFirst({
        where: { certificateId: certificate.id },
        orderBy: { sequenceNumber: 'desc' },
      })
      const nextSequence = (lastEvent?.sequenceNumber ?? 0) + 1

      // Update certificate status
      await tx.certificate.update({
        where: { id: certificate.id },
        data: {
          status: 'REJECTED',
          lastModifiedById: userId,
        },
      })

      // Create feedback record
      await tx.reviewFeedback.create({
        data: {
          certificateId: certificate.id,
          userId,
          feedbackType: 'REJECTED',
          comment: comment!.trim(),
          targetSection: targetSection || null,
          revisionNumber: certificate.currentRevision,
        },
      })

      // Create event
      await tx.certificateEvent.create({
        data: {
          certificateId: certificate.id,
          sequenceNumber: nextSequence,
          revision: certificate.currentRevision,
          userId,
          userRole: 'ENGINEER',
          eventType: 'REJECTED',
          eventData: JSON.stringify({
            comment: comment!.trim(),
            reviewerId: userId,
          }),
        },
      })
    })

    // Notify assignee (fire and forget)
    import('@/lib/services/queue').then(({ enqueue }) => {
      enqueue('notification:send', {
        userId: certificate.createdById,
        type: 'CERTIFICATE_REJECTED',
        title: 'Certificate Rejected',
        message: `${session.user.name || 'Reviewer'} has rejected certificate ${certificate.certificateNumber}.`,
        certificateId: certificate.id,
        data: { comment: comment!.trim() },
      }).catch(console.error)
    })

    return NextResponse.json({
      success: true,
      message: 'Certificate rejected',
    })
  }

  return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
}
