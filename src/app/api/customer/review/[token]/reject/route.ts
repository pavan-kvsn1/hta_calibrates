import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { notifyHoDOnCustomerRevision } from '@/lib/notifications'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const { notes } = await request.json()

    if (!notes?.trim()) {
      return NextResponse.json(
        { error: 'Feedback notes are required' },
        { status: 400 }
      )
    }

    // Check if this is a session-based access (cert:ID format)
    if (token.startsWith('cert:')) {
      const certificateId = token.substring(5)
      return handleSessionBasedReject(certificateId, notes)
    }

    // Validate token
    const tokenRecord = await prisma.approvalToken.findUnique({
      where: { token },
      include: {
        certificate: {
          include: { createdBy: true },
        },
        customer: true,
      },
    })

    if (!tokenRecord) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 404 }
      )
    }

    if (tokenRecord.usedAt) {
      return NextResponse.json(
        { error: 'This certificate has already been reviewed' },
        { status: 400 }
      )
    }

    if (new Date() > tokenRecord.expiresAt) {
      return NextResponse.json(
        { error: 'This review link has expired' },
        { status: 400 }
      )
    }

    // Allow rejection for both PENDING_CUSTOMER_APPROVAL and CUSTOMER_REVISION_REQUIRED (customer can respond to HoD reply)
    if (tokenRecord.certificate.status !== 'PENDING_CUSTOMER_APPROVAL' && tokenRecord.certificate.status !== 'CUSTOMER_REVISION_REQUIRED') {
      return NextResponse.json(
        { error: 'Certificate is not available for review' },
        { status: 400 }
      )
    }

    const now = new Date()

    // Use transaction to ensure all updates happen together
    await prisma.$transaction(async (tx) => {
      // 1. Update certificate status to CUSTOMER_REVISION_REQUIRED and store customer feedback
      await tx.certificate.update({
        where: { id: tokenRecord.certificateId },
        data: {
          status: 'CUSTOMER_REVISION_REQUIRED',
          statusNotes: notes, // Store customer feedback in statusNotes
          updatedAt: now,
        },
      })

      // 2. Mark token as used (but keep it for reference)
      await tx.approvalToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: now },
      })

      // 3. Log event (use certificate creator's ID since CertificateEvent requires User FK)
      const lastEvent = await tx.certificateEvent.findFirst({
        where: { certificateId: tokenRecord.certificateId },
        orderBy: { sequenceNumber: 'desc' },
      })

      await tx.certificateEvent.create({
        data: {
          certificateId: tokenRecord.certificateId,
          sequenceNumber: (lastEvent?.sequenceNumber || 0) + 1,
          revision: tokenRecord.certificate.currentRevision,
          eventType: 'CUSTOMER_REVISION_REQUESTED',
          eventData: JSON.stringify({
            notes,
            customerEmail: tokenRecord.customer.email,
            customerName: tokenRecord.customer.name,
            customerCompany: tokenRecord.customer.companyName,
            customerId: tokenRecord.customer.id,
            requestedAt: now.toISOString(),
            accessMethod: 'token',
          }),
          userId: tokenRecord.certificate.createdById, // Use certificate creator for FK constraint
          userRole: 'CUSTOMER', // But mark the role as CUSTOMER
        },
      })
    })

    // Notify HoD about customer revision request (fire and forget)
    notifyHoDOnCustomerRevision({
      certificateId: tokenRecord.certificateId,
      certificateNumber: tokenRecord.certificate.certificateNumber,
    }).catch((err) => console.error('Failed to send notification:', err))

    return NextResponse.json({
      success: true,
      message: 'Revision request submitted successfully',
    })
  } catch (error) {
    console.error('Error rejecting certificate:', error)
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to submit revision request: ${errorMessage}` },
      { status: 500 }
    )
  }
}

// Handle session-based reject (for customers accessing via dashboard without token)
async function handleSessionBasedReject(certificateId: string, notes: string) {
  // Verify customer session
  const session = await auth()
  if (!session?.user || session.user.role !== 'CUSTOMER') {
    return NextResponse.json(
      { error: 'Unauthorized - please log in' },
      { status: 401 }
    )
  }

  const customerEmail = session.user.email!

  // Get customer info
  const customer = await prisma.customerUser.findUnique({
    where: { email: customerEmail },
  })

  if (!customer) {
    return NextResponse.json(
      { error: 'Customer not found' },
      { status: 404 }
    )
  }

  // Get certificate with its creator (we need a valid User ID for events)
  const certificate = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: { createdBy: true },
  })

  if (!certificate) {
    return NextResponse.json(
      { error: 'Certificate not found' },
      { status: 404 }
    )
  }

  // Verify access: certificate's customerName must match customer's companyName
  if (certificate.customerName?.toLowerCase() !== customer.companyName.toLowerCase()) {
    return NextResponse.json(
      { error: 'You do not have permission to reject this certificate' },
      { status: 403 }
    )
  }

  // Allow rejection for both PENDING_CUSTOMER_APPROVAL and CUSTOMER_REVISION_REQUIRED (customer can respond to HoD reply)
  if (certificate.status !== 'PENDING_CUSTOMER_APPROVAL' && certificate.status !== 'CUSTOMER_REVISION_REQUIRED') {
    return NextResponse.json(
      { error: 'Certificate is not available for review' },
      { status: 400 }
    )
  }

  const now = new Date()

  // Use transaction to ensure all updates happen together
  await prisma.$transaction(async (tx) => {
    // 1. Update certificate status to CUSTOMER_REVISION_REQUIRED and store customer feedback
    await tx.certificate.update({
      where: { id: certificate.id },
      data: {
        status: 'CUSTOMER_REVISION_REQUIRED',
        statusNotes: notes, // Store customer feedback in statusNotes
        updatedAt: now,
      },
    })

    // 2. Log event (use certificate creator's ID since ReviewFeedback/CertificateEvent require User FK)
    const lastEvent = await tx.certificateEvent.findFirst({
      where: { certificateId: certificate.id },
      orderBy: { sequenceNumber: 'desc' },
    })

    await tx.certificateEvent.create({
      data: {
        certificateId: certificate.id,
        sequenceNumber: (lastEvent?.sequenceNumber || 0) + 1,
        revision: certificate.currentRevision,
        eventType: 'CUSTOMER_REVISION_REQUESTED',
        eventData: JSON.stringify({
          notes,
          customerEmail: customer.email,
          customerName: customer.name,
          customerCompany: customer.companyName,
          customerId: customer.id,
          requestedAt: now.toISOString(),
          accessMethod: 'session',
        }),
        userId: certificate.createdById, // Use certificate creator as the actor for FK constraint
        userRole: 'CUSTOMER', // But mark the role as CUSTOMER
      },
    })
  })

  // Notify HoD about customer revision request (fire and forget)
  notifyHoDOnCustomerRevision({
    certificateId: certificate.id,
    certificateNumber: certificate.certificateNumber,
  }).catch((err) => console.error('Failed to send notification:', err))

  return NextResponse.json({
    success: true,
    message: 'Revision request submitted successfully',
  })
}
