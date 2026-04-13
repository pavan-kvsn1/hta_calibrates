import { NextRequest, NextResponse } from 'next/server'
import { auth, hashPassword, verifyPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revokeAllUserTokens } from '@/lib/refresh-token'
import { enqueue } from '@/lib/services/queue'
import { authLogger as logger } from '@/lib/logger'
import { z } from 'zod'

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

    if (!session?.user?.id || session.user.role === 'CUSTOMER') {
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

    // Get user with password hash, email, and name
    const user = await prisma.user.findUnique({
      where: { id: session.user.id },
      select: { id: true, passwordHash: true, email: true, name: true },
    })

    if (!user || !user.passwordHash) {
      return NextResponse.json(
        { error: 'User not found or password not set' },
        { status: 404 }
      )
    }

    // Verify current password
    const isCurrentPasswordValid = await verifyPassword(currentPassword, user.passwordHash)

    if (!isCurrentPasswordValid) {
      logger.warn({ userId: user.id }, 'Password change failed - incorrect current password')
      return NextResponse.json(
        { error: 'Current password is incorrect' },
        { status: 400 }
      )
    }

    // Check if new password is different from current
    const isSamePassword = await verifyPassword(newPassword, user.passwordHash)
    if (isSamePassword) {
      return NextResponse.json(
        { error: 'New password must be different from current password' },
        { status: 400 }
      )
    }

    // Hash and update password
    const newPasswordHash = await hashPassword(newPassword)

    await prisma.user.update({
      where: { id: user.id },
      data: { passwordHash: newPasswordHash },
    })

    // Invalidate all existing sessions (refresh tokens)
    const revokedCount = await revokeAllUserTokens(user.id, 'STAFF', 'PASSWORD_CHANGE')

    // Log the password change in audit log
    await prisma.auditLog.create({
      data: {
        entityType: 'User',
        entityId: user.id,
        action: 'PASSWORD_CHANGED',
        actorId: user.id,
        actorType: 'USER',
        changes: { event: 'password_changed', sessionsRevoked: revokedCount },
      },
    })

    // Send password changed confirmation email
    await enqueue('email:send', {
      to: user.email,
      subject: 'Your Password Has Been Changed',
      template: 'password-changed',
      templateData: {
        userName: user.name || 'User',
        changedAt: new Date().toLocaleString('en-US', {
          dateStyle: 'medium',
          timeStyle: 'short',
        }),
      },
    })

    logger.info({ userId: user.id, sessionsRevoked: revokedCount }, 'Password changed successfully')

    return NextResponse.json({
      success: true,
      message: 'Password changed successfully. You will need to log in again on all devices.',
    })
  } catch (error) {
    logger.error({ err: error }, 'Error changing password')
    return NextResponse.json(
      { error: 'Failed to change password' },
      { status: 500 }
    )
  }
}
