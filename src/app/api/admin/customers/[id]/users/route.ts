import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, isMasterAdmin } from '@/lib/auth'
import { enqueue } from '@/lib/services/queue'
import { createLogger } from '@/lib/logger'

const logger = createLogger('customers')

// GET /api/admin/customers/[id]/users - List users for a customer account
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!isMasterAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden - Master Admin access required' }, { status: 403 })
    }

    const { id } = await params

    const account = await prisma.customerAccount.findUnique({
      where: { id },
      select: { id: true, companyName: true, primaryPocId: true },
    })

    if (!account) {
      return NextResponse.json({ error: 'Customer account not found' }, { status: 404 })
    }

    const users = await prisma.customerUser.findMany({
      where: { customerAccountId: id },
      select: {
        id: true,
        email: true,
        name: true,
        isPoc: true,
        isActive: true,
        activatedAt: true,
        createdAt: true,
      },
      orderBy: [{ isPoc: 'desc' }, { name: 'asc' }],
    })

    return NextResponse.json({
      users: users.map((u) => ({
        ...u,
        activatedAt: u.activatedAt?.toISOString() || null,
        createdAt: u.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    logger.error({ err: error }, 'Error fetching customer users')
    return NextResponse.json(
      { error: 'Failed to fetch customer users' },
      { status: 500 }
    )
  }
}

// POST /api/admin/customers/[id]/users - Admin directly adds a user
// Per Decision #5: Creates a CustomerRequest record for audit trail
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!isMasterAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden - Master Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { name, email } = body

    // Validation
    if (!name?.trim()) {
      return NextResponse.json({ error: 'User name is required' }, { status: 400 })
    }

    if (!email?.trim()) {
      return NextResponse.json({ error: 'User email is required' }, { status: 400 })
    }

    const normalizedEmail = email.trim().toLowerCase()

    // Check account exists
    const account = await prisma.customerAccount.findUnique({
      where: { id },
      select: { id: true, companyName: true },
    })

    if (!account) {
      return NextResponse.json({ error: 'Customer account not found' }, { status: 404 })
    }

    // Check email not already in use
    const existingUser = await prisma.customerUser.findUnique({
      where: { email: normalizedEmail },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      )
    }

    // Generate activation token
    const activationToken = crypto.randomUUID()
    const activationExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Create user and audit request in transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the user (pending activation)
      const user = await tx.customerUser.create({
        data: {
          email: normalizedEmail,
          name: name.trim(),
          customerAccountId: id,
          isPoc: false,
          isActive: false,
          activationToken,
          activationExpiry,
        },
      })

      // 2. Create audit record (Decision #5: request record for admin-initiated additions)
      await tx.customerRequest.create({
        data: {
          type: 'USER_ADDITION',
          status: 'APPROVED',
          customerAccountId: id,
          requestedById: null, // Admin-initiated, no POC requester
          data: JSON.stringify({ name: name.trim(), email: normalizedEmail }),
          reviewedById: session?.user?.id || null,
          reviewedAt: new Date(),
        },
      })

      return user
    })

    // Build activation URL and send email
    const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
    const activationUrl = `${baseUrl}/customer/activate/${activationToken}`

    await enqueue('email:send', {
      to: normalizedEmail,
      subject: 'Activate Your HTA Calibration Portal Account',
      template: 'customer-activation',
      templateData: {
        userName: name.trim(),
        companyName: account.companyName,
        activationUrl,
      },
    })

    return NextResponse.json({
      success: true,
      user: {
        id: result.id,
        name: result.name,
        email: result.email,
        isActive: result.isActive,
      },
      message: 'User created. Invite email will be sent.',
    })
  } catch (error) {
    logger.error({ err: error }, 'Error adding customer user')
    return NextResponse.json(
      { error: 'Failed to add customer user' },
      { status: 500 }
    )
  }
}
