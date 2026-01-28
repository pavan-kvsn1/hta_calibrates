import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only HoD and Admin can review
    if (session.user.role !== 'HOD' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await request.json()
    const { action, comment } = body

    if (!action || !['approve', 'reject', 'revision'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Get certificate
    const certificate = await prisma.certificate.findUnique({
      where: { id },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    if (certificate.status !== 'PENDING_HOD_REVIEW') {
      return NextResponse.json(
        { error: 'Certificate is not pending review' },
        { status: 400 }
      )
    }

    // Determine new status based on action
    let newStatus: string
    switch (action) {
      case 'approve':
        newStatus = 'PENDING_CUSTOMER_APPROVAL'
        break
      case 'reject':
        newStatus = 'REJECTED'
        break
      case 'revision':
        newStatus = 'REVISION_REQUIRED'
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Update certificate and add feedback/events
    await prisma.$transaction(async (tx) => {
      // Get next event sequence number
      const lastEvent = await tx.certificateEvent.findFirst({
        where: { certificateId: id },
        orderBy: { sequenceNumber: 'desc' },
      })
      const nextSequence = (lastEvent?.sequenceNumber ?? 0) + 1

      // Determine event type based on action
      let eventType: string
      let feedbackType: string
      switch (action) {
        case 'approve':
          eventType = 'APPROVED'
          feedbackType = 'APPROVAL_NOTE'
          break
        case 'reject':
          eventType = 'REJECTED'
          feedbackType = 'REJECTION_REASON'
          break
        case 'revision':
          eventType = 'REVISION_REQUESTED'
          feedbackType = 'REVISION_REQUEST'
          break
        default:
          throw new Error('Invalid action')
      }

      // Create event
      await tx.certificateEvent.create({
        data: {
          certificateId: id,
          sequenceNumber: nextSequence,
          revision: certificate.currentRevision,
          eventType,
          eventData: JSON.stringify({
            revisionNumber: certificate.currentRevision,
            notes: comment || null,
          }),
          userId: session.user.id,
          userRole: session.user.role,
        },
      })

      // Add review feedback if comment provided
      if (comment) {
        await tx.reviewFeedback.create({
          data: {
            certificateId: id,
            revisionNumber: certificate.currentRevision,
            feedbackType,
            comment,
            userId: session.user.id,
          },
        })
      }

      // Update certificate status (and increment revision if requesting changes)
      const updateData: Record<string, unknown> = {
        status: newStatus,
        lastModifiedById: session.user.id,
      }

      if (action === 'revision') {
        updateData.currentRevision = certificate.currentRevision + 1
      }

      await tx.certificate.update({
        where: { id },
        data: updateData,
      })

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          entityType: 'Certificate',
          entityId: id,
          action: `HOD_${action.toUpperCase()}`,
          actorId: session.user.id,
          actorType: 'USER',
          changes: JSON.stringify({
            previousStatus: certificate.status,
            newStatus,
            comment: comment || null,
          }),
        },
      })
    })

    return NextResponse.json({
      success: true,
      newStatus,
    })
  } catch (error) {
    console.error('Review error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
