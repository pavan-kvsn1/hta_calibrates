import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { notifyCustomerOnHoDReply } from '@/lib/notifications'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only HoD and Admin can reply to customer
    if (session.user.role !== 'HOD' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: certificateId } = await params
    const { response, resendCertificate } = await request.json()

    if (!response?.trim()) {
      return NextResponse.json(
        { error: 'Response message is required' },
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

    // Verify certificate is in CUSTOMER_REVISION_REQUIRED status
    if (certificate.status !== 'CUSTOMER_REVISION_REQUIRED') {
      return NextResponse.json(
        { error: 'Certificate is not in customer revision required status' },
        { status: 400 }
      )
    }

    // Get the latest customer who requested the revision
    const latestCustomerEvent = await prisma.certificateEvent.findFirst({
      where: {
        certificateId,
        eventType: 'CUSTOMER_REVISION_REQUESTED',
      },
      orderBy: { createdAt: 'desc' },
    })

    let customerEmail: string | null = null
    let customerName: string | null = null

    if (latestCustomerEvent) {
      try {
        const eventData = JSON.parse(latestCustomerEvent.eventData)
        customerEmail = eventData.customerEmail
        customerName = eventData.customerName
      } catch {
        // Ignore parse errors
      }
    }

    // If no customer info from event, try to get from latest token
    if (!customerEmail) {
      const latestToken = await prisma.approvalToken.findFirst({
        where: { certificateId },
        include: { customer: true },
        orderBy: { createdAt: 'desc' },
      })
      if (latestToken?.customer) {
        customerEmail = latestToken.customer.email
        customerName = latestToken.customer.name
      }
    }

    const now = new Date()

    // Use transaction to ensure all updates happen together
    const result = await prisma.$transaction(async (tx) => {
      // Get next sequence number
      const lastEvent = await tx.certificateEvent.findFirst({
        where: { certificateId },
        orderBy: { sequenceNumber: 'desc' },
      })
      const nextSeq = (lastEvent?.sequenceNumber || 0) + 1

      // 1. Create HOD_REPLIED_TO_CUSTOMER event
      const replyEventData: Record<string, unknown> = {
        response: response.trim(),
        hodId: session.user.id,
        hodName: session.user.name,
        timestamp: now.toISOString(),
        resendCertificate: !!resendCertificate,
      }

      await tx.certificateEvent.create({
        data: {
          certificateId,
          sequenceNumber: nextSeq,
          revision: certificate.currentRevision,
          eventType: 'HOD_REPLIED_TO_CUSTOMER',
          eventData: JSON.stringify(replyEventData),
          userId: session.user.id,
          userRole: session.user.role,
        },
      })

      let reviewUrl: string | null = null
      let tokenExpiry: string | null = null

      // 2. If resendCertificate, create new token and change status
      if (resendCertificate && customerEmail) {
        // Find or verify customer exists
        let customer = await tx.customerUser.findUnique({
          where: { email: customerEmail.toLowerCase() },
        })

        if (!customer) {
          // Create customer if doesn't exist
          const tempPasswordHash = crypto.randomBytes(32).toString('hex')
          customer = await tx.customerUser.create({
            data: {
              email: customerEmail.toLowerCase(),
              name: customerName || 'Customer',
              passwordHash: tempPasswordHash,
              companyName: certificate.customerName || 'Unknown Company',
              isActive: true,
            },
          })
        }

        // Revoke any existing tokens
        await tx.approvalToken.updateMany({
          where: {
            certificateId,
            usedAt: null,
          },
          data: {
            usedAt: now,
          },
        })

        // Create new token
        const token = crypto.randomUUID()
        const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days

        const approvalToken = await tx.approvalToken.create({
          data: {
            token,
            certificateId,
            customerId: customer.id,
            expiresAt,
          },
        })

        // Update certificate status
        await tx.certificate.update({
          where: { id: certificateId },
          data: {
            status: 'PENDING_CUSTOMER_APPROVAL',
            updatedAt: now,
          },
        })

        // Create SENT_TO_CUSTOMER event
        await tx.certificateEvent.create({
          data: {
            certificateId,
            sequenceNumber: nextSeq + 1,
            revision: certificate.currentRevision,
            eventType: 'SENT_TO_CUSTOMER',
            eventData: JSON.stringify({
              customerEmail: customerEmail.toLowerCase(),
              customerName: customerName || 'Customer',
              message: null,
              responseToFeedback: response.trim(),
              tokenId: approvalToken.id,
              expiresAt: expiresAt.toISOString(),
              sentBy: session.user.name,
            }),
            userId: session.user.id,
            userRole: session.user.role,
          },
        })

        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        reviewUrl = `${baseUrl}/customer/review/${token}`
        tokenExpiry = expiresAt.toISOString()
      }

      // Get customer ID for notification
      let customerId: string | null = null
      if (customerEmail) {
        const customerRecord = await tx.customerUser.findUnique({
          where: { email: customerEmail.toLowerCase() },
          select: { id: true },
        })
        customerId = customerRecord?.id || null
      }

      return {
        reviewUrl,
        tokenExpiry,
        resent: !!resendCertificate && !!customerEmail,
        customerId,
      }
    })

    // Notify customer about HoD's reply (fire and forget)
    if (result.customerId) {
      notifyCustomerOnHoDReply({
        certificateId: certificate.id,
        certificateNumber: certificate.certificateNumber,
        customerId: result.customerId,
      }).catch((err) => console.error('Failed to send notification:', err))
    }

    return NextResponse.json({
      success: true,
      message: result.resent
        ? 'Response sent and certificate resent to customer'
        : 'Response recorded',
      reviewUrl: result.reviewUrl,
      tokenExpiry: result.tokenExpiry,
      resent: result.resent,
    })
  } catch (error) {
    console.error('Error replying to customer:', error)
    return NextResponse.json(
      { error: 'Failed to reply to customer' },
      { status: 500 }
    )
  }
}
