import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, canAccessAdmin } from '@/lib/auth'
import { notifyCustomerOnRegistrationApproved } from '@/lib/services/notifications'

// POST /api/admin/registrations/[id]/approve - Approve customer registration
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

    const registration = await prisma.customerRegistration.findUnique({
      where: { id },
      include: {
        customerAccount: true,
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

    // Check if email is already taken
    const existingUser = await prisma.customerUser.findUnique({
      where: { email: registration.email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      )
    }

    // Create the customer user and update registration in a transaction
    const customerUser = await prisma.$transaction(async (tx) => {
      // Create CustomerUser
      const newUser = await tx.customerUser.create({
        data: {
          email: registration.email,
          name: registration.name,
          passwordHash: registration.passwordHash,
          customerAccountId: registration.customerAccountId,
          companyName: registration.customerAccount.companyName, // For backward compatibility
          isActive: true,
        },
      })

      // Update registration status
      await tx.customerRegistration.update({
        where: { id },
        data: {
          status: 'APPROVED',
          reviewedById: session!.user.id,
          reviewedAt: new Date(),
        },
      })

      return newUser
    })

    // Send approval notification to customer
    await notifyCustomerOnRegistrationApproved({
      customerId: customerUser.id,
      companyName: registration.customerAccount.companyName,
    })

    // TODO: Send approval notification email to customer

    return NextResponse.json({
      success: true,
      message: 'Registration approved successfully',
    })
  } catch (error) {
    console.error('Error approving registration:', error)
    return NextResponse.json(
      { error: 'Failed to approve registration' },
      { status: 500 }
    )
  }
}
