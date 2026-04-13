import { NextRequest, NextResponse } from 'next/server'
import { auth, verifyPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'
import { enqueue } from '@/lib/services/queue'

const logger = createLogger('customer-delete-account')

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const customerEmail = session.user.email!
    const body = await request.json()
    const { password } = body

    if (!password) {
      return NextResponse.json(
        { error: 'Password is required to confirm account deletion' },
        { status: 400 }
      )
    }

    // Get customer with password hash
    const customer = await prisma.customerUser.findUnique({
      where: { email: customerEmail },
      include: { customerAccount: true },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    // Verify password - passwordHash can be null for unactivated accounts
    if (!customer.passwordHash) {
      return NextResponse.json(
        { error: 'Account not activated. Please contact support.' },
        { status: 400 }
      )
    }

    const isPasswordValid = await verifyPassword(password, customer.passwordHash)
    if (!isPasswordValid) {
      logger.warn({ email: customerEmail }, 'Invalid password during account deletion attempt')
      return NextResponse.json(
        { error: 'Invalid password' },
        { status: 400 }
      )
    }

    // Store original email for confirmation
    const originalEmail = customer.email
    const customerName = customer.name

    // Generate anonymous identifier
    const anonymousId = `deleted-${customer.id.slice(0, 8)}-${Date.now()}`

    // Anonymize user data (but keep certificates for regulatory compliance)
    await prisma.customerUser.update({
      where: { id: customer.id },
      data: {
        email: `${anonymousId}@anonymized.local`,
        name: 'Deleted User',
        passwordHash: null, // Clear password hash
        isActive: false,
      },
    })

    // Log deletion for compliance audit trail
    await prisma.auditLog.create({
      data: {
        action: 'CUSTOMER_ACCOUNT_DELETED',
        entityType: 'CustomerUser',
        entityId: customer.id,
        actorId: customer.id,
        actorType: 'CUSTOMER',
        changes: {
          anonymizedAt: new Date().toISOString(),
          originalEmailDomain: originalEmail.split('@')[1], // Keep domain for analytics
          reason: 'User requested account deletion',
        },
      },
    })

    logger.info(
      { customerId: customer.id },
      'Customer account deleted and anonymized'
    )

    // Send confirmation email via queue
    try {
      await enqueue('email:send', {
        to: originalEmail,
        template: 'account-deleted',
        templateData: {
          userName: customerName,
        },
      })
    } catch (emailError) {
      // Log but don't fail the deletion if email fails
      logger.error({ err: emailError }, 'Failed to queue account deletion confirmation email')
    }

    return NextResponse.json({
      success: true,
      message: 'Your account has been deleted. You will be logged out.',
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to delete customer account')
    return NextResponse.json(
      { error: 'Failed to delete account' },
      { status: 500 }
    )
  }
}
