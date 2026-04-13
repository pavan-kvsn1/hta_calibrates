import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { enqueue } from '@/lib/services/queue'
import { randomUUID } from 'crypto'
import { z } from 'zod'
import { createLogger } from '@/lib/logger'

const logger = createLogger('customer')

const forgotPasswordSchema = z.object({
  email: z.string().email('Invalid email address'),
})

// Token expires in 1 hour
const TOKEN_EXPIRY_HOURS = 1

export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const validation = forgotPasswordSchema.safeParse(body)

    if (!validation.success) {
      return NextResponse.json(
        { error: validation.error.issues[0].message },
        { status: 400 }
      )
    }

    const { email } = validation.data
    const normalizedEmail = email.trim().toLowerCase()

    // Find customer - always return success message to prevent email enumeration
    const customer = await prisma.customerUser.findUnique({
      where: { email: normalizedEmail },
      select: { id: true, name: true, email: true, isActive: true, passwordHash: true },
    })

    // Only proceed if customer exists, is active, and has a password set
    if (customer && customer.isActive && customer.passwordHash) {
      // Check rate limit - max 3 requests per hour per email
      const oneHourAgo = new Date(Date.now() - 60 * 60 * 1000)
      const recentTokens = await prisma.passwordResetToken.count({
        where: {
          customerId: customer.id,
          createdAt: { gte: oneHourAgo },
        },
      })

      if (recentTokens < 3) {
        // Generate token
        const token = randomUUID()
        const expiresAt = new Date(Date.now() + TOKEN_EXPIRY_HOURS * 60 * 60 * 1000)

        // Create password reset token
        await prisma.passwordResetToken.create({
          data: {
            token,
            customerId: customer.id,
            expiresAt,
          },
        })

        // Build reset URL
        const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
        const resetUrl = `${baseUrl}/customer/reset-password/${token}`

        // Send email
        await enqueue('email:send', {
          to: customer.email,
          subject: 'Reset Your HTA Calibration Portal Password',
          template: 'password-reset',
          templateData: {
            userName: customer.name,
            resetUrl,
          },
        })

        // Log the request
        await prisma.auditLog.create({
          data: {
            entityType: 'CustomerUser',
            entityId: customer.id,
            action: 'PASSWORD_RESET_REQUESTED',
            actorId: customer.id,
            actorType: 'CUSTOMER',
            changes: { event: 'password_reset_requested' },
          },
        })
      }
    }

    // Always return success to prevent email enumeration
    return NextResponse.json({
      success: true,
      message: 'If an account with that email exists, a password reset link has been sent.',
    })
  } catch (error) {
    logger.error({ err: error }, 'Error requesting customer password reset')
    return NextResponse.json(
      { error: 'Failed to process request' },
      { status: 500 }
    )
  }
}
