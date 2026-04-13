import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { authLogger as logger } from '@/lib/logger'
import { z } from 'zod'

const resetPasswordSchema = z.object({
  token: z.string().min(1, 'Token is required'),
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
    const body = await request.json()
    const validation = resetPasswordSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { token, newPassword } = validation.data

    // Find the token
    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      include: { user: true },
    })

    // Validate token
    if (!resetToken) {
      return NextResponse.json(
        { error: 'Invalid or expired reset link' },
        { status: 400 }
      )
    }

    if (resetToken.usedAt) {
      return NextResponse.json(
        { error: 'This reset link has already been used' },
        { status: 400 }
      )
    }

    if (new Date() > resetToken.expiresAt) {
      return NextResponse.json(
        { error: 'This reset link has expired' },
        { status: 400 }
      )
    }

    if (!resetToken.userId || !resetToken.user) {
      return NextResponse.json(
        { error: 'Invalid reset link' },
        { status: 400 }
      )
    }

    // Hash new password
    const newPasswordHash = await hashPassword(newPassword)

    // Update password and mark token as used in a transaction
    await prisma.$transaction([
      prisma.user.update({
        where: { id: resetToken.userId },
        data: { passwordHash: newPasswordHash },
      }),
      prisma.passwordResetToken.update({
        where: { id: resetToken.id },
        data: { usedAt: new Date() },
      }),
      prisma.auditLog.create({
        data: {
          entityType: 'User',
          entityId: resetToken.userId,
          action: 'PASSWORD_RESET_COMPLETED',
          actorId: resetToken.userId,
          actorType: 'USER',
          changes: { event: 'password_reset_completed' },
        },
      }),
    ])

    logger.info({ userId: resetToken.userId }, 'Password reset completed')

    return NextResponse.json({
      success: true,
      message: 'Password has been reset successfully. You can now log in with your new password.',
    })
  } catch (error) {
    logger.error({ err: error }, 'Error resetting password')
    return NextResponse.json(
      { error: 'Failed to reset password' },
      { status: 500 }
    )
  }
}

// GET endpoint to validate token before showing reset form
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json(
        { valid: false, error: 'Token is required' },
        { status: 400 }
      )
    }

    const resetToken = await prisma.passwordResetToken.findUnique({
      where: { token },
      select: {
        id: true,
        expiresAt: true,
        usedAt: true,
        userId: true,
        user: { select: { email: true } },
      },
    })

    if (!resetToken) {
      return NextResponse.json({ valid: false, error: 'Invalid reset link' })
    }

    if (resetToken.usedAt) {
      return NextResponse.json({ valid: false, error: 'This reset link has already been used' })
    }

    if (new Date() > resetToken.expiresAt) {
      return NextResponse.json({ valid: false, error: 'This reset link has expired' })
    }

    if (!resetToken.userId) {
      return NextResponse.json({ valid: false, error: 'Invalid reset link' })
    }

    return NextResponse.json({
      valid: true,
      email: resetToken.user?.email,
    })
  } catch (error) {
    logger.error({ err: error }, 'Error validating reset token')
    return NextResponse.json(
      { valid: false, error: 'Failed to validate token' },
      { status: 500 }
    )
  }
}
