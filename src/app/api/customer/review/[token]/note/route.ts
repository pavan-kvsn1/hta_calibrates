import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

const logger = createLogger('customer')

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const { message } = await request.json()

    if (!message?.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Validate token
    const tokenRecord = await prisma.approvalToken.findUnique({
      where: { token },
      include: {
        certificate: true,
        customer: true,
      },
    })

    if (!tokenRecord) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 404 }
      )
    }

    if (tokenRecord.usedAt || new Date() > tokenRecord.expiresAt) {
      return NextResponse.json(
        { error: 'Token expired or already used' },
        { status: 400 }
      )
    }

    // Create a feedback record for the customer note
    // For now, we'll use ReviewFeedback with a special feedbackType
    const feedback = await prisma.reviewFeedback.create({
      data: {
        certificateId: tokenRecord.certificateId,
        revisionNumber: tokenRecord.certificate.currentRevision,
        feedbackType: 'CUSTOMER_NOTE',
        comment: message,
        userId: tokenRecord.customer.id, // Using customer ID
      },
    })

    // Log event
    const lastEvent = await prisma.certificateEvent.findFirst({
      where: { certificateId: tokenRecord.certificateId },
      orderBy: { sequenceNumber: 'desc' },
    })

    await prisma.certificateEvent.create({
      data: {
        certificateId: tokenRecord.certificateId,
        sequenceNumber: (lastEvent?.sequenceNumber || 0) + 1,
        revision: tokenRecord.certificate.currentRevision,
        eventType: 'CUSTOMER_NOTE_ADDED',
        eventData: JSON.stringify({
          message,
          customerEmail: tokenRecord.customer.email,
          customerName: tokenRecord.customer.name,
        }),
        customerId: tokenRecord.customer.id,
        userRole: 'CUSTOMER',
      },
    })

    return NextResponse.json({
      success: true,
      feedbackId: feedback.id,
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to add customer note')
    return NextResponse.json(
      { error: 'Failed to add note' },
      { status: 500 }
    )
  }
}
