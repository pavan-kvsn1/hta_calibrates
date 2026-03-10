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

// POST - Reviews certificate (peer review or HoD review)
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json()
    const { action, comment, targetSection, edits, dateOverride, sendToCustomer, signatureData, signerName, clientEvidence } = body as {
      action: string
      comment?: string
      targetSection?: string
      edits?: PendingEdit[]
      dateOverride?: { newDateOfCalibration: string; newDueDate?: string; reason: string }
      sendToCustomer?: CustomerData
      signatureData?: string
      signerName?: string
      clientEvidence?: ClientEvidence
    }

    // Get existing certificate first to determine review type
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

    // Determine if this is a peer review - check if reviewer is assigned
    // Include CUSTOMER_REVISION_REQUIRED so peer reviewers can re-review after customer feedback
    const isPeerReview = (certificate.status === 'PENDING_REVIEW' || certificate.status === 'PENDING_HOD_REVIEW' || certificate.status === 'CUSTOMER_REVISION_REQUIRED') && certificate.reviewerId

    // Handle peer review (reviewer assigned)
    if (isPeerReview) {
      return handlePeerReview(request, session, certificate, body)
    }

    // Legacy HoD review (no reviewer assigned): Only HoD and Admin can review
    if (session.user.role !== 'HOD' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Only HoD can review certificates' }, { status: 403 })
    }

    // Parse sendToCustomer data if provided
    const customerData: CustomerData | null = sendToCustomer ? {
      email: sendToCustomer.email?.toLowerCase(),
      name: sendToCustomer.name,
      message: sendToCustomer.message,
    } : null

    // Validate action for HoD review
    if (!['approve', 'reject', 'revision'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be: approve, reject, or revision' },
        { status: 400 }
      )
    }

    // Require comment for reject and revision
    if ((action === 'reject' || action === 'revision') && !comment?.trim()) {
      return NextResponse.json(
        { error: 'Comment is required for rejection or revision request' },
        { status: 400 }
      )
    }

    // Require signature for approve
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
    }

    // Validate customer data if sendToCustomer is provided
    if (customerData) {
      if (!customerData.email?.trim()) {
        return NextResponse.json(
          { error: 'Customer email is required for sending to customer' },
          { status: 400 }
        )
      }
      if (!customerData.name?.trim()) {
        return NextResponse.json(
          { error: 'Customer name is required for sending to customer' },
          { status: 400 }
        )
      }
      // Basic email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(customerData.email)) {
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

    // Legacy support for dateOverride (convert to new format)
    if (dateOverride && pendingEdits.length === 0) {
      pendingEdits.push({
        field: 'dateOfCalibration',
        fieldLabel: 'Date of Calibration',
        originalValue: '',
        newValue: dateOverride.newDateOfCalibration,
        reason: dateOverride.reason,
      })
      if (dateOverride.newDueDate) {
        pendingEdits.push({
          field: 'calibrationDueDate',
          fieldLabel: 'Calibration Due Date',
          originalValue: '',
          newValue: dateOverride.newDueDate,
          reason: 'Auto-adjusted based on Date of Calibration change',
          autoCalculated: true,
        })
      }
    }

    // Check if certificate can be reviewed (HoD workflow)
    if (certificate.status !== 'PENDING_HOD_REVIEW') {
      return NextResponse.json(
        { error: `Cannot review certificate with status: ${certificate.status}` },
        { status: 400 }
      )
    }

    // Determine new status based on action
    let newStatus: string
    let feedbackType: string
    let eventType: string

    switch (action) {
      case 'approve':
        newStatus = 'PENDING_CUSTOMER_APPROVAL'
        feedbackType = 'APPROVAL_NOTE'
        eventType = 'HOD_APPROVED'
        break
      case 'reject':
        newStatus = 'REJECTED'
        feedbackType = 'REJECTION_REASON'
        eventType = 'HOD_REJECTED'
        break
      case 'revision':
        newStatus = 'REVISION_REQUIRED'
        feedbackType = 'REVISION_REQUEST'
        eventType = 'HOD_REVISION_REQUESTED'
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Update certificate and create feedback in transaction
    const result = await prisma.$transaction(async (tx) => {
      // Get next event sequence
      const lastEvent = await tx.certificateEvent.findFirst({
        where: { certificateId: id },
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
        lastModifiedById: session.user.id,
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

      // Update certificate status (and dates if edited)
      const updatedCert = await tx.certificate.update({
        where: { id },
        data: certUpdateData,
      })

      // If there are edits, create HOD_EDIT event
      if (pendingEdits.length > 0) {
        await tx.certificateEvent.create({
          data: {
            certificateId: id,
            sequenceNumber: nextSequence,
            revision: certificate.currentRevision,
            eventType: 'HOD_DATE_OVERRIDE',
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
              // Legacy format for backwards compatibility
              previousDateOfCalibration: certificate.dateOfCalibration?.toISOString() || null,
              newDateOfCalibration: dateOfCalibrationEdit?.newValue || null,
              previousDueDate: certificate.calibrationDueDate?.toISOString() || null,
              newDueDate: calibrationDueDateEdit?.newValue || null,
              reason: dateOfCalibrationEdit?.reason || pendingEdits[0]?.reason || '',
            }),
            userId: session.user.id,
            userRole: session.user.role,
          },
        })
        nextSequence++
      }

      // Create certificate event
      const event = await tx.certificateEvent.create({
        data: {
          certificateId: id,
          sequenceNumber: nextSequence,
          revision: certificate.currentRevision,
          eventType,
          eventData: JSON.stringify({
            previousStatus: certificate.status,
            newStatus,
            action,
            comment: comment?.trim() || null,
            signerName: action === 'approve' ? signerName : null,
            signerEmail: action === 'approve' ? session.user.email : null,
            reviewedAt: new Date().toISOString(),
            hasEdits: pendingEdits.length > 0,
          }),
          userId: session.user.id,
          userRole: session.user.role,
        },
      })

      // Create feedback entry if there's a comment or if there are edits (to record edits in feedback)
      let feedback = null
      const shouldCreateFeedback = comment?.trim() || pendingEdits.length > 0

      if (shouldCreateFeedback) {
        // Build comment with edit information appended
        let fullComment = comment?.trim() || ''

        if (pendingEdits.length > 0) {
          const editSummary = pendingEdits
            .filter(e => !e.autoCalculated)
            .map(e => `• ${e.fieldLabel}: ${e.reason}`)
            .join('\n')

          if (editSummary) {
            if (fullComment) fullComment += '\n\n'
            fullComment += `[HoD Edits Applied]\n${editSummary}`
          }
        }

        if (fullComment) {
          // For approvals, use the revision of the most recent revision request to close that cycle
          let feedbackRevisionNumber = certificate.currentRevision
          if (feedbackType === 'APPROVAL_NOTE') {
            const mostRecentRevisionRequest = await tx.reviewFeedback.findFirst({
              where: {
                certificateId: id,
                feedbackType: { in: ['REVISION_REQUEST', 'REVISION_REQUESTED', 'CUSTOMER_REVISION_FORWARDED'] },
              },
              orderBy: { createdAt: 'desc' },
              select: { revisionNumber: true },
            })
            feedbackRevisionNumber = mostRecentRevisionRequest?.revisionNumber ?? certificate.currentRevision
          }

          feedback = await tx.reviewFeedback.create({
            data: {
              certificateId: id,
              revisionNumber: feedbackRevisionNumber,
              eventId: event.id,
              feedbackType,
              comment: fullComment,
              targetSection: targetSection || null,
              userId: session.user.id,
            },
          })
        }
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          entityType: 'Certificate',
          entityId: id,
          action: eventType,
          actorId: session.user.id,
          actorType: 'USER',
          changes: JSON.stringify({
            previousStatus: certificate.status,
            newStatus,
            action,
            hasComment: !!comment?.trim(),
            hasSignature: action === 'approve',
            edits: pendingEdits.length > 0 ? pendingEdits.map(e => ({
              field: e.field,
              fieldLabel: e.fieldLabel,
              previousValue: e.field === 'dateOfCalibration'
                ? certificate.dateOfCalibration?.toISOString()
                : certificate.calibrationDueDate?.toISOString(),
              newValue: e.newValue,
              reason: e.reason,
              autoCalculated: e.autoCalculated,
            })) : null,
          }),
        },
      })

      // Store HOD signature on approval
      let hodSignature = null
      if (action === 'approve' && signatureData && signerName) {
        // Delete any existing HOD signature (handles re-approval after engineer revision)
        await tx.signature.deleteMany({
          where: { certificateId: id, signerType: 'HOD' },
        })

        hodSignature = await tx.signature.create({
          data: {
            certificateId: id,
            signerType: 'HOD',
            signerName,
            signerEmail: session.user.email,
            signatureData,
            signerId: session.user.id,
          },
        })
      }

      // If approving AND sending to customer, create token
      let tokenResult = null
      if (action === 'approve' && customerData) {
        const now = new Date()
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days
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
            certificateId: id,
            customerId: customer.id,
            expiresAt,
          },
        })

        // Create SENT_TO_CUSTOMER event
        nextSequence++
        await tx.certificateEvent.create({
          data: {
            certificateId: id,
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
            userId: session.user.id,
            userRole: session.user.role,
          },
        })

        tokenResult = {
          token: approvalToken.token,
          customerId: customer.id,
          expiresAt: approvalToken.expiresAt,
        }
      }

      return { certificate: updatedCert, event, feedback, tokenResult, hodSignature }
    })

    // Return appropriate message
    let message: string
    switch (action) {
      case 'approve':
        message = 'Certificate approved and sent for customer approval'
        break
      case 'reject':
        message = 'Certificate has been rejected'
        break
      case 'revision':
        message = 'Revision requested - certificate returned to engineer'
        break
      default:
        message = 'Review completed'
    }

    if (pendingEdits.length > 0) {
      message += ` (${pendingEdits.length} edit${pendingEdits.length > 1 ? 's' : ''} applied)`
    }

    // Build response
    const response: {
      success: boolean
      message: string
      certificate: {
        id: string
        certificateNumber: string
        status: string
      }
      customerToken?: {
        token: string
        reviewUrl: string
        expiresAt: string
      }
    } = {
      success: true,
      message,
      certificate: {
        id: result.certificate.id,
        certificateNumber: result.certificate.certificateNumber,
        status: result.certificate.status,
      },
    }

    // Include token info if created
    if (result.tokenResult) {
      const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
      response.customerToken = {
        token: result.tokenResult.token,
        reviewUrl: `${baseUrl}/customer/review/${result.tokenResult.token}`,
        expiresAt: result.tokenResult.expiresAt.toISOString(),
      }
      message = 'Certificate approved and sent to customer for review'
    }

    // Capture HoD signing evidence (Layer 1-4) if client evidence provided and signature was created
    if (action === 'approve' && result.hodSignature && clientEvidence) {
      try {
        const serverEvidence = collectServerEvidence(request, 'direct')
        const evidencePayload = buildSigningEvidencePayload(
          clientEvidence,
          serverEvidence,
          {
            signerType: 'HOD',
            signerName: signerName!,
            signerEmail: session.user.email,
            signerId: session.user.id,
          }
        )
        await appendSigningEvidence(id, result.hodSignature.id, 'HOD_SIGNED', evidencePayload, result.certificate.currentRevision)
      } catch (evidenceError) {
        // Log but don't fail the review if evidence capture fails
        console.error('Failed to capture HoD signing evidence:', evidenceError)
      }
    }

    // Send HoD signature to OpenSign for digital signing (best-effort)
    if (action === 'approve' && signerName) {
      sendToOpenSign(result.certificate.id, result.certificate.certificateNumber, session.user.email, signerName)
        .catch((err) => console.error('OpenSign HoD signing failed (non-blocking):', err))
    }

    // Send notifications (fire and forget)
    if (action === 'approve' || action === 'revision') {
      // Notify assignee about approval or revision request
      notifyAssigneeOnReview({
        certificateId: result.certificate.id,
        certificateNumber: result.certificate.certificateNumber,
        assigneeId: certificate.createdById,
        approved: action === 'approve',
      }).catch((err) => console.error('Failed to send notification:', err))
    }

    // If sent to customer, also notify assignee and customer
    if (result.tokenResult) {
      notifyOnSentToCustomer({
        certificateId: result.certificate.id,
        certificateNumber: result.certificate.certificateNumber,
        assigneeId: certificate.createdById,
        customerId: result.tokenResult.customerId,
      }).catch((err) => console.error('Failed to send notification:', err))
    }

    return NextResponse.json(response)
  } catch (error) {
    console.error('Error reviewing certificate:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

/**
 * Send the HoD-signed certificate to OpenSign for digital signing.
 * Best-effort: if OpenSign is unavailable, the local signature still stands.
 */
async function sendToOpenSign(
  certificateId: string,
  certificateNumber: string,
  hodEmail: string,
  hodName: string
) {
  const healthy = await isOpenSignHealthy()
  if (!healthy) {
    console.warn('OpenSign unavailable — skipping digital signing for HoD approval')
    return
  }

  const pdfBuffer = await generateSignedPDF(certificateId)
  const pdfBase64 = pdfBuffer.toString('base64')
  const pageCount = getPageCountFromBuffer(pdfBuffer)
  const widgets = getSignatureWidgets('HOD', pageCount)

  const result = await withRetry(() =>
    selfSignDocument({
      file: pdfBase64,
      title: `Calibration Certificate ${certificateNumber}`,
      signerName: hodName,
      signerEmail: hodEmail,
      widgets,
    })
  )

  await prisma.openSignDocument.create({
    data: {
      certificateId,
      openSignDocumentId: result.documentId,
      signerType: 'HOD',
      signerEmail: hodEmail,
      status: 'SIGNED',
      signedPdfUrl: result.signedPdfUrl,
      auditTrailUrl: result.auditTrailUrl,
    },
  })
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
        where: { certificateId: certificate.id, signerType: 'HOD' },
      })

      const reviewerSignature = await tx.signature.create({
        data: {
          certificateId: certificate.id,
          signerType: 'HOD',
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
            signerType: 'HOD',
            signerName: signerName!,
            signerEmail: session.user.email,
            signerId: userId,
          }
        )
        await appendSigningEvidence(certificate.id, result.reviewerSignature.id, 'HOD_SIGNED', evidencePayload, result.certificate.currentRevision)
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
