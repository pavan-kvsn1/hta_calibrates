import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, isMasterAdmin } from '@/lib/auth'
import { enqueue } from '@/lib/services/queue'
import { createLogger } from '@/lib/logger'

const logger = createLogger('customers')

// POST /api/admin/customers/requests/[id]/reject - Reject a customer request
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
    const { reason } = body

    // Validation
    if (!reason?.trim()) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      )
    }

    const customerRequest = await prisma.customerRequest.findUnique({
      where: { id },
      include: {
        customerAccount: {
          select: { id: true, companyName: true },
        },
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!customerRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (customerRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Request has already been processed' },
        { status: 400 }
      )
    }

    // Update request status
    await prisma.customerRequest.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason.trim(),
        reviewedById: session?.user?.id || null,
        reviewedAt: new Date(),
      },
    })

    // Send rejection notification to POC
    if (customerRequest.requestedBy?.email) {
      await enqueue('email:send', {
        to: customerRequest.requestedBy.email,
        subject: 'Your Request Has Been Rejected',
        template: 'request-rejected',
        templateData: {
          requestType: customerRequest.type,
          companyName: customerRequest.customerAccount.companyName,
          rejectionReason: reason.trim(),
          reviewedBy: 'HTA Admin',
          reviewedDate: new Date().toLocaleDateString(),
        },
      })
    }

    return NextResponse.json({
      success: true,
      message: 'Request rejected. The requester will be notified.',
    })
  } catch (error) {
    logger.error({ err: error }, 'Error rejecting customer request')
    return NextResponse.json(
      { error: 'Failed to reject customer request' },
      { status: 500 }
    )
  }
}
