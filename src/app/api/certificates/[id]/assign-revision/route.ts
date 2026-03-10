import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only HoD and Admin can assign for revision
    if (session.user.role !== 'HOD' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const { customerFeedback, additionalNotes, edits, sectionFeedbacks, generalNotes } = await request.json() as {
      customerFeedback?: string
      additionalNotes?: string
      edits?: Array<{
        field: 'dateOfCalibration' | 'calibrationDueDate'
        fieldLabel: string
        originalValue: string
        newValue: string
        reason: string
        autoCalculated?: boolean
      }>
      // New: section-specific customer feedback
      sectionFeedbacks?: Array<{ section: string; comment: string }>
      generalNotes?: string
    }

    // Pending edit type
    interface PendingEdit {
      field: 'dateOfCalibration' | 'calibrationDueDate'
      fieldLabel: string
      originalValue: string
      newValue: string
      reason: string
      autoCalculated?: boolean
    }

    // Get certificate
    const certificate = await prisma.certificate.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true },
        },
      },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Only allow assignment from CUSTOMER_REVISION_REQUIRED status
    if (certificate.status !== 'CUSTOMER_REVISION_REQUIRED') {
      return NextResponse.json(
        { error: 'Certificate is not in customer revision required status' },
        { status: 400 }
      )
    }

    const now = new Date()

    // Build the feedback comment based on what's provided
    let feedbackComment = ''
    if (customerFeedback && additionalNotes) {
      // Both customer feedback and HoD notes
      feedbackComment = `Customer Revision Request:\n${customerFeedback}\n\nHoD Notes:\n${additionalNotes}`
    } else if (customerFeedback) {
      // Only customer feedback
      feedbackComment = `Customer Revision Request:\n${customerFeedback}`
    } else if (additionalNotes) {
      // Only HoD notes (customer feedback not forwarded)
      feedbackComment = additionalNotes
    } else {
      // Fallback - should rarely happen
      feedbackComment = 'Revision requested by HoD'
    }

    // Build certificate update data
    const certificateUpdateData: Record<string, unknown> = {
      status: 'REVISION_REQUIRED',
      updatedAt: now,
    }

    // Apply edits if provided
    const pendingEdits: PendingEdit[] = edits || []
    if (pendingEdits.length > 0) {
      for (const edit of pendingEdits) {
        if (edit.field === 'dateOfCalibration' && edit.newValue) {
          certificateUpdateData.dateOfCalibration = new Date(edit.newValue)
        }
        if (edit.field === 'calibrationDueDate' && edit.newValue) {
          certificateUpdateData.calibrationDueDate = new Date(edit.newValue)
        }
      }
    }

    // Use transaction to update all records
    await prisma.$transaction(async (tx) => {
      // 1. Update certificate status to REVISION_REQUIRED (and apply edits)
      await tx.certificate.update({
        where: { id },
        data: certificateUpdateData,
      })

      // 2. Create feedback records - separate entry for each section
      // If we have structured section feedbacks, create individual entries
      if (sectionFeedbacks && sectionFeedbacks.length > 0) {
        for (const sf of sectionFeedbacks) {
          if (sf.comment?.trim()) {
            await tx.reviewFeedback.create({
              data: {
                certificateId: id,
                revisionNumber: certificate.currentRevision,
                feedbackType: 'CUSTOMER_REVISION_FORWARDED',
                comment: sf.comment.trim(),
                targetSection: sf.section,
                userId: session.user.id,
              },
            })
          }
        }
      }

      // Create general notes entry (either from generalNotes or legacy customerFeedback)
      const generalComment = generalNotes?.trim() || (
        // Fallback to legacy format if no structured data
        !sectionFeedbacks?.length ? feedbackComment : null
      )
      if (generalComment) {
        await tx.reviewFeedback.create({
          data: {
            certificateId: id,
            revisionNumber: certificate.currentRevision,
            feedbackType: 'CUSTOMER_REVISION_FORWARDED',
            comment: generalComment,
            targetSection: null, // General/no section
            userId: session.user.id,
          },
        })
      }

      // Create HoD additional notes as separate entry if provided
      if (additionalNotes?.trim() && sectionFeedbacks?.length) {
        await tx.reviewFeedback.create({
          data: {
            certificateId: id,
            revisionNumber: certificate.currentRevision,
            feedbackType: 'REVISION_REQUESTED', // HoD's own note, not customer
            comment: additionalNotes.trim(),
            targetSection: null,
            userId: session.user.id,
          },
        })
      }

      // 3. Log event
      const lastEvent = await tx.certificateEvent.findFirst({
        where: { certificateId: id },
        orderBy: { sequenceNumber: 'desc' },
      })

      await tx.certificateEvent.create({
        data: {
          certificateId: id,
          sequenceNumber: (lastEvent?.sequenceNumber || 0) + 1,
          revision: certificate.currentRevision,
          eventType: 'CUSTOMER_REVISION_FORWARDED',
          eventData: JSON.stringify({
            customerFeedback,
            additionalNotes: additionalNotes || null,
            // Include structured section feedbacks
            sectionFeedbacks: sectionFeedbacks || null,
            generalNotes: generalNotes || null,
            edits: pendingEdits.length > 0 ? pendingEdits : null,
            forwardedAt: now.toISOString(),
            forwardedBy: session.user.name,
            engineerId: certificate.createdById,
            engineerName: certificate.createdBy.name,
          }),
          userId: session.user.id,
          userRole: session.user.role,
        },
      })

      // 4. If edits were applied, also log HOD_DATE_OVERRIDE event
      if (pendingEdits.length > 0) {
        await tx.certificateEvent.create({
          data: {
            certificateId: id,
            sequenceNumber: (lastEvent?.sequenceNumber || 0) + 2,
            revision: certificate.currentRevision,
            eventType: 'HOD_DATE_OVERRIDE',
            eventData: JSON.stringify({
              edits: pendingEdits,
              reason: 'Applied during customer revision forwarding',
            }),
            userId: session.user.id,
            userRole: session.user.role,
          },
        })
      }
    })

    return NextResponse.json({
      success: true,
      message: 'Certificate assigned to engineer for revision',
    })
  } catch (error) {
    console.error('Error assigning certificate for revision:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to assign certificate: ${errorMessage}` },
      { status: 500 }
    )
  }
}
