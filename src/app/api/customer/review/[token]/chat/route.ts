/**
 * Customer Chat API Route
 *
 * GET /api/customer/review/[token]/chat - Get messages for the customer thread
 * POST /api/customer/review/[token]/chat - Send a message
 */

import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logger'

const logger = createLogger('customer')

interface CustomerContext {
  customerId: string
  customerName: string
  customerEmail: string
  customerCompany: string
  certificateId: string
}

async function validateCustomerAccess(
  token: string
): Promise<{ valid: false; error: string; status: number } | { valid: true; context: CustomerContext }> {
  // Check if this is a session-based access (cert:ID format)
  if (token.startsWith('cert:')) {
    const certificateId = token.substring(5)
    return validateSessionAccess(certificateId)
  }

  // Token-based access
  const tokenRecord = await prisma.approvalToken.findUnique({
    where: { token },
    include: {
      certificate: true,
      customer: {
        include: { customerAccount: true },
      },
    },
  })

  if (!tokenRecord) {
    return { valid: false, error: 'Invalid token', status: 404 }
  }

  if (tokenRecord.usedAt && tokenRecord.certificate.status !== 'CUSTOMER_REVISION_REQUIRED') {
    return { valid: false, error: 'Token already used', status: 400 }
  }

  if (new Date() > tokenRecord.expiresAt) {
    return { valid: false, error: 'Token expired', status: 400 }
  }

  return {
    valid: true,
    context: {
      customerId: tokenRecord.customer.id,
      customerName: tokenRecord.customer.name,
      customerEmail: tokenRecord.customer.email,
      customerCompany: tokenRecord.customer.customerAccount?.companyName || tokenRecord.customer.companyName || '',
      certificateId: tokenRecord.certificateId,
    },
  }
}

async function validateSessionAccess(
  certificateId: string
): Promise<{ valid: false; error: string; status: number } | { valid: true; context: CustomerContext }> {
  const session = await auth()

  if (!session?.user || session.user.role !== 'CUSTOMER') {
    return { valid: false, error: 'Unauthorized', status: 401 }
  }

  const customer = await prisma.customerUser.findUnique({
    where: { email: session.user.email! },
    include: { customerAccount: true },
  })

  if (!customer) {
    return { valid: false, error: 'Customer not found', status: 404 }
  }

  const certificate = await prisma.certificate.findUnique({
    where: { id: certificateId },
  })

  if (!certificate) {
    return { valid: false, error: 'Certificate not found', status: 404 }
  }

  // Verify access: certificate's customerName must match customer's companyName
  const customerCompanyName = customer.customerAccount?.companyName || customer.companyName
  if (!customerCompanyName || certificate.customerName?.toLowerCase() !== customerCompanyName.toLowerCase()) {
    return { valid: false, error: 'Access denied', status: 403 }
  }

  return {
    valid: true,
    context: {
      customerId: customer.id,
      customerName: customer.name,
      customerEmail: customer.email,
      customerCompany: customerCompanyName,
      certificateId: certificate.id,
    },
  }
}

async function getOrCreateThread(certificateId: string): Promise<string> {
  const existing = await prisma.chatThread.findUnique({
    where: {
      certificateId_threadType: {
        certificateId,
        threadType: 'REVIEWER_CUSTOMER',
      },
    },
  })

  if (existing) {
    return existing.id
  }

  const thread = await prisma.chatThread.create({
    data: {
      certificateId,
      threadType: 'REVIEWER_CUSTOMER',
    },
  })

  return thread.id
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const decodedToken = decodeURIComponent(token)

    const result = await validateCustomerAccess(decodedToken)
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const { context } = result
    const threadId = await getOrCreateThread(context.certificateId)

    // Get messages
    const messages = await prisma.chatMessage.findMany({
      where: { threadId },
      orderBy: { createdAt: 'asc' },
      include: {
        sender: {
          select: { id: true, name: true, email: true },
        },
        customer: {
          select: { id: true, name: true, email: true },
        },
        attachments: true,
      },
    })

    // Format messages
    const formattedMessages = messages.map((msg) => ({
      id: msg.id,
      content: msg.content,
      senderType: msg.senderType,
      senderName: msg.senderType === 'CUSTOMER' ? msg.customer?.name : msg.sender?.name,
      isOwnMessage: msg.customerId === context.customerId,
      createdAt: msg.createdAt.toISOString(),
      attachments: msg.attachments.map((att) => ({
        id: att.id,
        fileName: att.fileName,
        fileSize: att.fileSize,
        mimeType: att.mimeType,
      })),
    }))

    // Mark messages as read
    await prisma.chatMessage.updateMany({
      where: {
        threadId,
        customerId: { not: context.customerId },
        senderType: { not: 'CUSTOMER' },
        readAt: null,
      },
      data: { readAt: new Date() },
    })

    return NextResponse.json({
      threadId,
      messages: formattedMessages,
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to get customer chat messages')
    return NextResponse.json(
      { error: 'Failed to get messages' },
      { status: 500 }
    )
  }
}

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const decodedToken = decodeURIComponent(token)
    const body = await request.json()
    const { content } = body

    if (!content || typeof content !== 'string' || !content.trim()) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      )
    }

    const result = await validateCustomerAccess(decodedToken)
    if (!result.valid) {
      return NextResponse.json({ error: result.error }, { status: result.status })
    }

    const { context } = result
    const threadId = await getOrCreateThread(context.certificateId)

    // Create the message
    const message = await prisma.chatMessage.create({
      data: {
        threadId,
        customerId: context.customerId,
        senderType: 'CUSTOMER',
        content: content.trim(),
      },
      include: {
        customer: {
          select: { id: true, name: true, email: true },
        },
      },
    })


    // Get certificate and reviewer for notification
    const certificate = await prisma.certificate.findUnique({
      where: { id: context.certificateId },
      select: { reviewerId: true, certificateNumber: true },
    })

    // Queue notification for reviewer
    if (certificate?.reviewerId) {
      // Import notification service
      const { enqueue } = await import('@/lib/services/queue')
      await enqueue('notification:send', {
        type: 'CUSTOMER_MESSAGE',
        userId: certificate.reviewerId,
        title: 'New message from customer',
        message: `${context.customerName} sent a message on certificate ${certificate.certificateNumber}`,
        certificateId: context.certificateId,
        data: {
          certificateNumber: certificate.certificateNumber,
          customerName: context.customerName,
          preview: content.trim().substring(0, 100),
        },
      }).catch((err) => logger.error({ err }, 'Failed to send customer message notification'))
    }

    return NextResponse.json({
      message: {
        id: message.id,
        content: message.content,
        senderType: message.senderType,
        senderName: message.customer?.name,
        isOwnMessage: true,
        createdAt: message.createdAt.toISOString(),
        attachments: [],
      },
    }, { status: 201 })
  } catch (error) {
    logger.error({ err: error }, 'Failed to send customer chat message')
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
