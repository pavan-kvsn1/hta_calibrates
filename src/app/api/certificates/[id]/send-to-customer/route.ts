import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { notifyOnSentToCustomer } from '@/lib/services/notifications'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only Admin can send to customer
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: certificateId } = await params
    const { customerEmail, customerName, message } = await request.json()

    if (!customerEmail?.trim()) {
      return NextResponse.json(
        { error: 'Customer email is required' },
        { status: 400 }
      )
    }

    if (!customerName?.trim()) {
      return NextResponse.json(
        { error: 'Customer name is required' },
        { status: 400 }
      )
    }

    // Get the certificate
    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
    })

    if (!certificate) {
      return NextResponse.json(
        { error: 'Certificate not found' },
        { status: 404 }
      )
    }

    // Verify certificate is in correct status
    if (certificate.status !== 'PENDING_CUSTOMER_APPROVAL') {
      return NextResponse.json(
        { error: 'Certificate must be approved by Reviewer before sending to customer' },
        { status: 400 }
      )
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Generate secure token
    const token = crypto.randomUUID()

    // Use transaction to ensure all updates happen together
    const result = await prisma.$transaction(async (tx) => {
      // 1. Find or create CustomerUser
      let customer = await tx.customerUser.findUnique({
        where: { email: customerEmail.toLowerCase() },
      })

      if (!customer) {
        // Create new customer with a temporary password (they'll need to reset)
        const tempPasswordHash = crypto.randomBytes(32).toString('hex')
        customer = await tx.customerUser.create({
          data: {
            email: customerEmail.toLowerCase(),
            name: customerName,
            passwordHash: tempPasswordHash, // Temporary - customer will need to set password
            companyName: certificate.customerName || 'Unknown Company',
            isActive: true,
          },
        })
      }

      // 2. Revoke any existing tokens for this certificate
      await tx.approvalToken.updateMany({
        where: {
          certificateId,
          usedAt: null,
        },
        data: {
          usedAt: now, // Mark as used to invalidate
        },
      })

      // 3. Create new ApprovalToken
      const approvalToken = await tx.approvalToken.create({
        data: {
          token,
          certificateId,
          customerId: customer.id,
          expiresAt,
        },
      })

      // 4. Update certificate with customer info
      await tx.certificate.update({
        where: { id: certificateId },
        data: {
          customerName: certificate.customerName || customerName, // Keep existing or use new
          updatedAt: now,
        },
      })

      // 5. Log event
      const lastEvent = await tx.certificateEvent.findFirst({
        where: { certificateId },
        orderBy: { sequenceNumber: 'desc' },
      })

      await tx.certificateEvent.create({
        data: {
          certificateId,
          sequenceNumber: (lastEvent?.sequenceNumber || 0) + 1,
          revision: certificate.currentRevision,
          eventType: 'SENT_TO_CUSTOMER',
          eventData: JSON.stringify({
            customerEmail: customerEmail.toLowerCase(),
            customerName,
            message: message || null,
            tokenId: approvalToken.id,
            expiresAt: expiresAt.toISOString(),
            sentBy: session.user.name,
          }),
          userId: session.user.id,
          userRole: session.user.role,
        },
      })

      return {
        token: approvalToken.token,
        customerId: customer.id,
        expiresAt: approvalToken.expiresAt,
      }
    })

    // Build review URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const reviewUrl = `${baseUrl}/customer/review/${result.token}`

    // Send notifications (fire and forget)
    notifyOnSentToCustomer({
      certificateId: certificate.id,
      certificateNumber: certificate.certificateNumber,
      assigneeId: certificate.createdById,
      customerId: result.customerId,
    }).catch((err) => console.error('Failed to send notification:', err))

    return NextResponse.json({
      success: true,
      token: result.token,
      tokenExpiry: result.expiresAt.toISOString(),
      reviewUrl,
      customerId: result.customerId,
    })
  } catch (error) {
    console.error('Error sending to customer:', error)
    return NextResponse.json(
      { error: 'Failed to send to customer' },
      { status: 500 }
    )
  }
}

// GET endpoint to check customer status
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: certificateId } = await params

    // Get the latest active token for this certificate
    const activeToken = await prisma.approvalToken.findFirst({
      where: {
        certificateId,
        usedAt: null,
        expiresAt: {
          gt: new Date(),
        },
      },
      include: {
        customer: true,
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    // Get the sent event
    const sentEvent = await prisma.certificateEvent.findFirst({
      where: {
        certificateId,
        eventType: 'SENT_TO_CUSTOMER',
      },
      orderBy: {
        createdAt: 'desc',
      },
    })

    if (!activeToken) {
      return NextResponse.json({
        sent: false,
        sentTo: null,
        token: null,
        canResend: true,
      })
    }

    const eventData = sentEvent ? JSON.parse(sentEvent.eventData) : null
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    return NextResponse.json({
      sent: true,
      sentTo: {
        email: activeToken.customer.email,
        name: activeToken.customer.name,
        sentAt: sentEvent?.createdAt.toISOString() || activeToken.createdAt.toISOString(),
      },
      token: {
        token: activeToken.token,
        expiresAt: activeToken.expiresAt.toISOString(),
      },
      reviewUrl: `${baseUrl}/customer/review/${activeToken.token}`,
      message: eventData?.message || null,
      canResend: true,
    })
  } catch (error) {
    console.error('Error getting customer status:', error)
    return NextResponse.json(
      { error: 'Failed to get customer status' },
      { status: 500 }
    )
  }
}
