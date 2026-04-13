import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { hashPassword } from '@/lib/auth'
import { authLogger as logger } from '@/lib/logger'
import { z } from 'zod'

const activateSchema = z.object({
  token: z.string().min(1, 'Token is required'),
  password: z
    .string()
    .min(8, 'Password must be at least 8 characters')
    .regex(/[A-Z]/, 'Password must contain at least one uppercase letter')
    .regex(/[a-z]/, 'Password must contain at least one lowercase letter')
    .regex(/[0-9]/, 'Password must contain at least one number'),
  confirmPassword: z.string().min(1, 'Confirm password is required'),
}).refine((data) => data.password === data.confirmPassword, {
  message: 'Passwords do not match',
  path: ['confirmPassword'],
})

/**
 * POST /api/auth/activate
 *
 * Activate a staff account by setting password.
 * Called when a new staff member clicks the activation link in their email.
 */
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = activateSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { token, password } = validation.data

    // Find user with this activation token
    const user = await prisma.user.findUnique({
      where: { activationToken: token },
    })

    // Validate token
    if (!user) {
      return NextResponse.json(
        { error: 'Invalid or expired activation link' },
        { status: 400 }
      )
    }

    if (user.isActive) {
      return NextResponse.json(
        { error: 'This account has already been activated' },
        { status: 400 }
      )
    }

    if (!user.activationExpiry || new Date() > user.activationExpiry) {
      return NextResponse.json(
        { error: 'This activation link has expired. Please contact your administrator for a new link.' },
        { status: 400 }
      )
    }

    // Hash password
    const passwordHash = await hashPassword(password)

    // Activate user and set password
    await prisma.$transaction([
      prisma.user.update({
        where: { id: user.id },
        data: {
          passwordHash,
          isActive: true,
          activatedAt: new Date(),
          activationToken: null, // Clear token after use
          activationExpiry: null,
        },
      }),
      prisma.auditLog.create({
        data: {
          entityType: 'User',
          entityId: user.id,
          action: 'ACCOUNT_ACTIVATED',
          actorId: user.id,
          actorType: 'USER',
          changes: { event: 'account_activated_via_email' },
        },
      }),
    ])

    logger.info({ userId: user.id, email: user.email }, 'Account activated')

    return NextResponse.json({
      success: true,
      message: 'Your account has been activated. You can now log in.',
    })
  } catch (error) {
    logger.error({ err: error }, 'Error activating account')
    return NextResponse.json(
      { error: 'Failed to activate account' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/auth/activate?token=xxx
 *
 * Validate activation token before showing the form.
 */
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

    const user = await prisma.user.findUnique({
      where: { activationToken: token },
      select: {
        id: true,
        email: true,
        name: true,
        isActive: true,
        activationExpiry: true,
      },
    })

    if (!user) {
      return NextResponse.json({ valid: false, error: 'Invalid activation link' })
    }

    if (user.isActive) {
      return NextResponse.json({ valid: false, error: 'This account has already been activated' })
    }

    if (!user.activationExpiry || new Date() > user.activationExpiry) {
      return NextResponse.json({ valid: false, error: 'This activation link has expired' })
    }

    return NextResponse.json({
      valid: true,
      email: user.email,
      name: user.name,
    })
  } catch (error) {
    logger.error({ err: error }, 'Error validating activation token')
    return NextResponse.json(
      { valid: false, error: 'Failed to validate token' },
      { status: 500 }
    )
  }
}
