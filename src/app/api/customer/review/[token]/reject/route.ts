import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { notifyReviewerOnCustomerRevision } from '@/lib/services/notifications'
import { createLogger } from '@/lib/logger'

const logger = createLogger('customer')

// Format section feedbacks into readable notes
function formatFeedbackNotes(
  sectionFeedbacks?: { section: string; comment: string }[],
  generalNotes?: string
): string {
  const parts: string[] = []

  // Section labels for display
  const sectionLabels: Record<string, string> = {
    'summary': 'Section 1: Summary',
    'uuc-details': 'Section 2: UUC Details',
    'master-inst': 'Section 3: Master Instruments',
    'environment': 'Section 4: Environmental Conditions',
    'results': 'Section 5: Calibration Results',
    'remarks': 'Section 6: Remarks',
    'conclusion': 'Section 7: Conclusion',
  }

  if (sectionFeedbacks && sectionFeedbacks.length > 0) {
    for (const feedback of sectionFeedbacks) {
      const label = sectionLabels[feedback.section] || feedback.section
      parts.push(`[${label}]\n${feedback.comment}`)
    }
  }

  if (generalNotes) {
    parts.push(`[General Notes]\n${generalNotes}`)
  }

  return parts.join('\n\n')
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const body = await request.json()

    // Support both old format (notes) and new format (sectionFeedbacks + generalNotes)
    const { notes, sectionFeedbacks, generalNotes } = body

    // Format the feedback
    let formattedNotes: string
    if (sectionFeedbacks || generalNotes) {
      // New section-wise format
      formattedNotes = formatFeedbackNotes(sectionFeedbacks, generalNotes)
    } else if (notes) {
      // Legacy simple notes format
      formattedNotes = notes.trim()
    } else {
      formattedNotes = ''
    }

    if (!formattedNotes) {
      return NextResponse.json(
        { error: 'Feedback notes are required' },
        { status: 400 }
      )
    }

    // Check if this is a session-based access (cert:ID format)
    if (token.startsWith('cert:')) {
      const certificateId = token.substring(5)
      return handleSessionBasedReject(certificateId, formattedNotes, { sectionFeedbacks, generalNotes })
    }

    // Validate token
    const tokenRecord = await prisma.approvalToken.findUnique({
      where: { token },
      include: {
        certificate: {
          include: { createdBy: true, reviewer: true },
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

    // Allow rejection for both PENDING_CUSTOMER_APPROVAL and CUSTOMER_REVISION_REQUIRED (customer can respond to Admin reply)
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
          statusNotes: formattedNotes, // Store customer feedback in statusNotes
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
            notes: formattedNotes,
            sectionFeedbacks: sectionFeedbacks || null,
            generalNotes: generalNotes || null,
            customerEmail: tokenRecord.customer.email,
            customerName: tokenRecord.customer.name,
            customerCompany: tokenRecord.customer.companyName,
            requestedAt: now.toISOString(),
            accessMethod: 'token',
          }),
          customerId: tokenRecord.customer.id,
          userRole: 'CUSTOMER',
        },
      })
    })

    // Notify reviewer about customer revision request (fire and forget)
    if (tokenRecord.certificate.reviewerId) {
      notifyReviewerOnCustomerRevision({
        certificateId: tokenRecord.certificateId,
        certificateNumber: tokenRecord.certificate.certificateNumber,
        reviewerId: tokenRecord.certificate.reviewerId,
      }).catch((err) => logger.error({ err }, 'Failed to send reviewer notification'))
    }

    return NextResponse.json({
      success: true,
      message: 'Revision request submitted successfully',
    })
  } catch (error) {
    logger.error({ err: error }, 'Error rejecting certificate')
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to submit revision request: ${errorMessage}` },
      { status: 500 }
    )
  }
}

// Handle session-based reject (for customers accessing via dashboard without token)
async function handleSessionBasedReject(
  certificateId: string,
  formattedNotes: string,
  structuredData: { sectionFeedbacks?: { section: string; comment: string }[]; generalNotes?: string }
) {
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
    include: { customerAccount: true },
  })

  if (!customer) {
    return NextResponse.json(
      { error: 'Customer not found' },
      { status: 404 }
    )
  }

  // Get certificate with its creator and reviewer (we need a valid User ID for events)
  const certificate = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: { createdBy: true, reviewer: true },
  })

  if (!certificate) {
    return NextResponse.json(
      { error: 'Certificate not found' },
      { status: 404 }
    )
  }

  // Verify access: certificate's customerName must match customer's companyName
  const customerCompanyName = customer.customerAccount?.companyName || customer.companyName
  if (!customerCompanyName || certificate.customerName?.toLowerCase() !== customerCompanyName.toLowerCase()) {
    return NextResponse.json(
      { error: 'You do not have permission to reject this certificate' },
      { status: 403 }
    )
  }

  // Allow rejection for both PENDING_CUSTOMER_APPROVAL and CUSTOMER_REVISION_REQUIRED (customer can respond to Admin reply)
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
        statusNotes: formattedNotes, // Store customer feedback in statusNotes
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
          notes: formattedNotes,
          sectionFeedbacks: structuredData.sectionFeedbacks || null,
          generalNotes: structuredData.generalNotes || null,
          customerEmail: customer.email,
          customerName: customer.name,
          customerCompany: customer.companyName,
          requestedAt: now.toISOString(),
          accessMethod: 'session',
        }),
        customerId: customer.id,
        userRole: 'CUSTOMER',
      },
    })
  })

  // Notify reviewer about customer revision request (fire and forget)
  if (certificate.reviewerId) {
    notifyReviewerOnCustomerRevision({
      certificateId: certificate.id,
      certificateNumber: certificate.certificateNumber,
      reviewerId: certificate.reviewerId,
    }).catch((err) => logger.error({ err }, 'Failed to send reviewer notification'))
  }

  return NextResponse.json({
    success: true,
    message: 'Revision request submitted successfully',
  })
}
