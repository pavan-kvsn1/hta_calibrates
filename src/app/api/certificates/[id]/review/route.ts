import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

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
    const { action, comment, edits, dateOverride } = body

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

      return { certificate: updatedCert, event, feedback }
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

    return NextResponse.json({
      success: true,
      message,
      certificate: {
        id: result.certificate.id,
        certificateNumber: result.certificate.certificateNumber,
        status: result.certificate.status,
      },
    })
  } catch (error) {
    console.error('Error reviewing certificate:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
