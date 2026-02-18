import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { notifyEngineerOnReview, notifyOnSentToCustomer } from '@/lib/notifications'
import { isOpenSignHealthy, selfSignDocument, getSignatureWidgets, withRetry } from '@/lib/opensign'
import { generateSignedPDF, getPageCountFromBuffer } from '@/lib/pdf-generator'
import {
  appendSigningEvidence,
  collectServerEvidence,
  buildSigningEvidencePayload,
  type ClientEvidence,
} from '@/lib/signing-evidence'

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

// POST - HoD reviews certificate (approve/reject/revision)
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only HoD and Admin can review
    if (session.user.role !== 'HOD' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden - Only HoD can review certificates' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await request.json()
    const { action, comment, edits, dateOverride, sendToCustomer, signatureData, signerName, clientEvidence } = body as {
      action: string
      comment?: string
      edits?: PendingEdit[]
      dateOverride?: { newDateOfCalibration: string; newDueDate?: string; reason: string }
      sendToCustomer?: CustomerData
      signatureData?: string
      signerName?: string
      clientEvidence?: ClientEvidence
    }

    // Parse sendToCustomer data if provided
    const customerData: CustomerData | null = sendToCustomer ? {
      email: sendToCustomer.email?.toLowerCase(),
      name: sendToCustomer.name,
      message: sendToCustomer.message,
    } : null

    // Validate action
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

    // Get existing certificate
    const certificate = await prisma.certificate.findUnique({
      where: { id },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Check if certificate can be reviewed
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
          feedback = await tx.reviewFeedback.create({
            data: {
              certificateId: id,
              revisionNumber: certificate.currentRevision,
              eventId: event.id,
              feedbackType,
              comment: fullComment,
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
      // Notify engineer about approval or revision request
      notifyEngineerOnReview({
        certificateId: result.certificate.id,
        certificateNumber: result.certificate.certificateNumber,
        engineerId: certificate.createdById,
        approved: action === 'approve',
      }).catch((err) => console.error('Failed to send notification:', err))
    }

    // If sent to customer, also notify engineer and customer
    if (result.tokenResult) {
      notifyOnSentToCustomer({
        certificateId: result.certificate.id,
        certificateNumber: result.certificate.certificateNumber,
        engineerId: certificate.createdById,
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
