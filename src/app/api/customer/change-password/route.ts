import { NextRequest, NextResponse } from 'next/server'
import { auth, hashPassword, verifyPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revokeAllUserTokens } from '@/lib/refresh-token'
import { enqueue } from '@/lib/services/queue'
import { z } from 'zod'
import { createLogger } from '@/lib/logger'

const logger = createLogger('customer')

const changePasswordSchema = z.object({
  currentPassword: z.string().min(1, 'Current password is required'),
  newPassword: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string().min(1, 'Confirm password is required'),
}).refine((data) => data.newPassword === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user?.id || session.user.role !== 'CUSTOMER') {
      return NextResponse.json(
        { error: 'Unauthorized' },
        { status: 401 }
      )
    }

    const body = await request.json()
    const validation = changePasswordSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { currentPassword, newPassword } = validation.data

    // Get customer user with password hash, email, and name
    const customer = await prisma.customerUser.findUnique({
      where: { id: session.user.id },
      select: { id: true, passwordHash: true, email: true, name: true },
    })

    if (!customer || !customer.passwordHash) {
      return NextResponse.json(
        { error: 'User not found or password not set' },
        { status: 404 }
      )
    }

    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(currentPassword, customer.passwordHash)

    if (!isCurrentPasswordValid) {
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    // Check if new password is different from current
    const isSamePassword = await verifyPassword(newPassword, customer.passwordHash)
    if (isSamePassword) {
      return NextResponse.json(
        { error: 'New password must be different from current password' },
        { status: 400 }
      )
    }

    // Hash and update password
    const newPasswordHash = await hashPassword(newPassword)

    await prisma.customerUser.update({
      where: { id: customer.id },
      data: { passwordHash: newPasswordHash },
    })

    // Invalidate all existing sessions (refresh tokens)
    const revokedCount = await revokeAllUserTokens(customer.id, 'CUSTOMER', 'PASSWORD_CHANGE')

    // Log the password change in audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'CustomerUser',
        entityId: customer.id,
        action: 'PASSWORD_CHANGED',
        actorId: customer.id,
        actorType: 'CUSTOMER',
        changes: { event: 'password_changed', sessionsRevoked: revokedCount },
      },
    })

    // Send password changed confirmation email
    await enqueue('email:send', {
      to: customer.email,
      subject: 'Your Password Has Been Changed',
      template: 'password-changed',
      templateData: {
        userName: customer.name || 'Customer',
        changedAt: new Date().toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully. You will need to log in again on all devices.',
    })
  } catch (error) {
    logger.error({ err: error }, 'Error changing customer password')
    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    )
  }
}
