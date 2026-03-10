import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import bcrypt from 'bcryptjs'

// GET /api/customer/activate?token=xxx - Validate activation token
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const token = searchParams.get('token')

    if (!token) {
      return NextResponse.json({ error: 'Activation token is required' }, { status: 400 })
    }

    const user = await prisma.customerUser.findUnique({
      where: { activationToken: token },
      include: {
        customerAccount: {
          select: { id: true, companyName: true },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid activation token' },
        { status: 400 }
      )
    }

    if (user.isActive) {
      return NextResponse.json(
        { error: 'Account has already been activated' },
        { status: 400 }
      )
    }

    if (user.activationExpiry && user.activationExpiry < new Date()) {
      return NextResponse.json(
        { error: 'Activation token has expired. Please contact your administrator.' },
        { status: 400 }
      )
    }

    return NextResponse.json({
      valid: true,
      user: {
        name: user.name,
        email: user.email,
        companyName: user.customerAccount?.companyName,
      },
    })
  } catch (error) {
    console.error('Error validating activation token:', error)
    return NextResponse.json(
      { error: 'Failed to validate activation token' },
      { status: 500 }
    )
  }
}

// POST /api/customer/activate - Activate account with password
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    const { token, password } = body

    // Validation
    if (!token) {
      return NextResponse.json({ error: 'Activation token is required' }, { status: 400 })
    }

    if (!password) {
      return NextResponse.json({ error: 'Password is required' }, { status: 400 })
    }

    // Validate password strength
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    // Check for uppercase letter
    if (!/[A-Z]/.test(password)) {
      return NextResponse.json(
        { error: 'Password must contain at least one uppercase letter' },
        { status: 400 }
      )
    }

    // Check for number
    if (!/[0-9]/.test(password)) {
      return NextResponse.json(
        { error: 'Password must contain at least one number' },
        { status: 400 }
      )
    }

    const user = await prisma.customerUser.findUnique({
      where: { activationToken: token },
      include: {
        customerAccount: {
          select: { id: true, companyName: true },
        },
      },
    })

    if (!user) {
      return NextResponse.json(
        { error: 'Invalid activation token' },
        { status: 400 }
      )
    }

    if (user.isActive) {
      return NextResponse.json(
        { error: 'Account has already been activated' },
        { status: 400 }
      )
    }

    if (user.activationExpiry && user.activationExpiry < new Date()) {
      return NextResponse.json(
        { error: 'Activation token has expired. Please contact your administrator.' },
        { status: 400 }
      )
    }

    // Hash the password
    const passwordHash = await bcrypt.hash(password, 12)

    // Activate the account
    await prisma.customerUser.update({
      where: { id: user.id },
      data: {
        passwordHash,
        isActive: true,
        activatedAt: new Date(),
        activationToken: null, // Clear the token
        activationExpiry: null,
      },
    })

    return NextResponse.json({
      success: true,
      message: 'Account activated successfully. You can now log in.',
      user: {
        name: user.name,
        email: user.email,
        companyName: user.customerAccount?.companyName,
      },
    })
  } catch (error) {
    console.error('Error activating account:', error)
    return NextResponse.json(
      { error: 'Failed to activate account' },
      { status: 500 }
    )
  }
}
