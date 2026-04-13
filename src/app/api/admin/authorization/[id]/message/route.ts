import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, canAccessAdmin } from '@/lib/auth'
import { certificateLogger as logger } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !canAccessAdmin(session.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { message } = body

    if (!message || !message.trim()) {
      return NextResponse.json(
        { error: 'Message is required' },
        { status: 400 }
      )
    }

    // Verify certificate exists
    const certificate = await prisma.certificate.findUnique({
      where: { id },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Get next event sequence
    const lastEvent = await prisma.certificateEvent.findFirst({
      where: { certificateId: id },
      orderBy: { sequenceNumber: 'desc' },
    })
    const nextSequence = (lastEvent?.sequenceNumber ?? 0) + 1

    // Create certificate event for admin message
    const event = await prisma.certificateEvent.create({
      data: {
        certificateId: id,
        sequenceNumber: nextSequence,
        revision: certificate.currentRevision,
        eventType: 'ADMIN_MESSAGE',
        eventData: JSON.stringify({
          message: message.trim(),
          senderName: session.user.name,
          senderEmail: session.user.email,
          sentAt: new Date().toISOString(),
        }),
        userId: session.user.id,
        userRole: session.user.role,
      },
    })

    return NextResponse.json({
      success: true,
      event: {
        id: event.id,
        type: 'admin_message',
        message: message.trim(),
        createdAt: event.createdAt.toISOString(),
        userName: session.user.name,
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to send admin message')
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
