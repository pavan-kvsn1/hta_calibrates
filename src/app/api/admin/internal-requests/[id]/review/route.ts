import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, isMasterAdmin } from '@/lib/auth'

// POST /api/admin/internal-requests/[id]/review - Approve or reject an internal request
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!isMasterAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden - Master Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { action, adminNote } = body

    if (!action || !['approve', 'reject'].includes(action)) {
      return NextResponse.json(
        { error: 'Invalid action. Must be "approve" or "reject"' },
        { status: 400 }
      )
    }

    const internalRequest = await prisma.internalRequest.findUnique({
      where: { id },
      include: {
        certificate: {
          select: { id: true, certificateNumber: true, status: true },
        },
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!internalRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (internalRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Request has already been processed' },
        { status: 400 }
      )
    }

    const newStatus = action === 'approve' ? 'APPROVED' : 'REJECTED'

    // Update the request
    const updatedRequest = await prisma.internalRequest.update({
      where: { id },
      data: {
        status: newStatus,
        reviewedById: session?.user?.id || null,
        reviewedAt: new Date(),
        adminNote: adminNote || null,
      },
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
        certificate: {
          select: { id: true, certificateNumber: true },
        },
        reviewedBy: {
          select: { id: true, name: true },
        },
      },
    })

    // Handle SECTION_UNLOCK specific actions
    if (internalRequest.type === 'SECTION_UNLOCK' && internalRequest.certificateId) {
      const data = JSON.parse(internalRequest.data)
      const sectionList = data.sections?.join(', ') || 'requested sections'

      // Get the certificate's current revision and latest event sequence
      const cert = await prisma.certificate.findUnique({
        where: { id: internalRequest.certificateId },
        select: { currentRevision: true },
      })

      const latestEvent = await prisma.certificateEvent.findFirst({
        where: { certificateId: internalRequest.certificateId },
        orderBy: { sequenceNumber: 'desc' },
        select: { sequenceNumber: true },
      })
      const nextSequence = (latestEvent?.sequenceNumber || 0) + 1

      // Create certificate event
      await prisma.certificateEvent.create({
        data: {
          certificateId: internalRequest.certificateId,
          eventType: newStatus === 'APPROVED' ? 'SECTION_UNLOCK_APPROVED' : 'SECTION_UNLOCK_REJECTED',
          eventData: JSON.stringify({
            sections: data.sections,
            reason: data.reason,
            adminNote: adminNote || null,
            requestId: internalRequest.id,
          }),
          userId: session?.user?.id || null,
          userRole: 'ADMIN',
          sequenceNumber: nextSequence,
          revision: cert?.currentRevision || 0,
        },
      })

      // Create notification for the engineer
      if (internalRequest.requestedBy) {
        if (newStatus === 'APPROVED') {
          await prisma.notification.create({
            data: {
              userId: internalRequest.requestedBy.id,
              type: 'SECTION_UNLOCK_APPROVED',
              title: 'Section Unlock Approved',
              message: `Your request to unlock ${sectionList} for certificate ${internalRequest.certificate?.certificateNumber || ''} has been approved.`,
              certificateId: internalRequest.certificateId,
              data: JSON.stringify({
                requestId: internalRequest.id,
                sections: data.sections,
                adminNote,
              }),
            },
          })
        } else {
          await prisma.notification.create({
            data: {
              userId: internalRequest.requestedBy.id,
              type: 'SECTION_UNLOCK_REJECTED',
              title: 'Section Unlock Rejected',
              message: `Your section unlock request for certificate ${internalRequest.certificate?.certificateNumber || ''} has been rejected.${adminNote ? ` Reason: ${adminNote}` : ''}`,
              certificateId: internalRequest.certificateId,
              data: JSON.stringify({
                requestId: internalRequest.id,
                adminNote,
              }),
            },
          })
        }
      }
    }

    return NextResponse.json({
      success: true,
      message: `Request ${newStatus.toLowerCase()}`,
      request: {
        id: updatedRequest.id,
        type: updatedRequest.type,
        status: updatedRequest.status,
        data: JSON.parse(updatedRequest.data),
        certificate: updatedRequest.certificate,
        requestedBy: updatedRequest.requestedBy,
        reviewedBy: updatedRequest.reviewedBy,
        reviewedAt: updatedRequest.reviewedAt?.toISOString() || null,
        adminNote: updatedRequest.adminNote,
      },
    })
  } catch (error) {
    console.error('Error reviewing internal request:', error)
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
