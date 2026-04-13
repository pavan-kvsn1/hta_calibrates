import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'
import { notifyAdminsOnRegistration } from '@/lib/services/notifications'
import { checkRateLimitForRequest } from '@/lib/security'
import { createLogger } from '@/lib/logger'

const logger = createLogger('customer')

// POST /api/customer/register - Submit customer registration
export async function POST(request: NextRequest) {
  // Apply rate limiting to registration attempts
  const rateLimitResponse = await checkRateLimitForRequest(request, 'REGISTRATION')
  if (rateLimitResponse) {
    return rateLimitResponse
  }

  try {
    const body = await request.json()
    const { name, email, password, customerAccountId } = body

    // Validate required fields
    if (!name?.trim() || !email?.trim() || !password || !customerAccountId) {
      return NextResponse.json(
        { error: 'Name, email, password, and company are required' },
        { status: 400 }
      )
    }

    // Validate email format
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(email)) {
      return NextResponse.json(
        { error: 'Invalid email format' },
        { status: 400 }
      )
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // Check if customer account exists and is active
    const customerAccount = await prisma.customerAccount.findUnique({
      where: { id: customerAccountId },
    })

    if (!customerAccount || !customerAccount.isActive) {
      return NextResponse.json(
        { error: 'Invalid company selected' },
        { status: 400 }
      )
    }

    // Check if email is already registered as a customer user
    const existingUser = await prisma.customerUser.findUnique({
      where: { email: email.toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'An account with this email already exists' },
        { status: 400 }
      )
    }

    // Check if there's already a pending registration for this email
    const existingRegistration = await prisma.customerRegistration.findFirst({
      where: {
        email: email.toLowerCase(),
        status: 'PENDING',
      },
    })

    if (existingRegistration) {
      return NextResponse.json(
        { error: 'A registration request for this email is already pending' },
        { status: 400 }
      )
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 12)

    // Create the registration request
    const registration = await prisma.customerRegistration.create({
      data: {
        name: name.trim(),
        email: email.toLowerCase().trim(),
        passwordHash,
        customerAccountId,
        status: 'PENDING',
      },
    })

    // Notify admins of new registration
    await notifyAdminsOnRegistration({
      registrationId: registration.id,
      name: name.trim(),
      email: email.toLowerCase().trim(),
      companyName: customerAccount.companyName,
    })

    // TODO: Send confirmation email to the user

    return NextResponse.json({
      success: true,
      message: 'Registration submitted successfully. An administrator will review your request.',
      registrationId: registration.id,
    })
  } catch (error) {
    logger.error({ err: error }, 'Error creating customer registration')
    return NextResponse.json(
      { error: 'Failed to submit registration' },
      { status: 500 }
    )
  }
}
