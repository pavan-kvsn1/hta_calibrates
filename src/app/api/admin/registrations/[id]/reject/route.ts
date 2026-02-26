import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, canAccessAdmin } from '@/lib/auth'
import { notifyCustomerOnRegistrationRejected } from '@/lib/services/notifications'

// POST /api/admin/registrations/[id]/reject - Reject customer registration
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!canAccessAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { reason } = body

    if (!reason?.trim()) {
      return NextResponse.json(
        { error: 'Rejection reason is required' },
        { status: 400 }
      )
    }

    const registration = await prisma.customerRegistration.findUnique({
      where: { id },
      include: {
        customerAccount: {
          select: { companyName: true },
        },
      },
    })

    if (!registration) {
      return NextResponse.json({ error: 'Registration not found' }, { status: 404 })
    }

    if (registration.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Registration is not pending' },
        { status: 400 }
      )
    }

    await prisma.customerRegistration.update({
      where: { id },
      data: {
        status: 'REJECTED',
        rejectionReason: reason.trim(),
        reviewedById: session!.user.id,
        reviewedAt: new Date(),
      },
    })

    // Log rejection for email notification (customer can't log in to see in-app notification)
    await notifyCustomerOnRegistrationRejected({
      email: registration.email,
      companyName: registration.customerAccount.companyName,
      reason: reason.trim(),
    })

    return NextResponse.json({
      success: true,
      message: 'Registration rejected',
    })
  } catch (error) {
    console.error('Error rejecting registration:', error)
    return NextResponse.json(
      { error: 'Failed to reject registration' },
      { status: 500 }
    )
  }
}
