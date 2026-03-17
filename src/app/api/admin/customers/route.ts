import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, isMasterAdmin } from '@/lib/auth'

// GET /api/admin/customers - List customer accounts (Master Admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    // Master Admin only for customer management
    if (!isMasterAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden - Master Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const isActive = searchParams.get('isActive')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}

    if (isActive !== null && isActive !== 'ALL') {
      where.isActive = isActive === 'true'
    }

    if (search) {
      where.OR = [
        { companyName: { contains: search } },
        { contactEmail: { contains: search } },
      ]
    }

    const [accounts, total] = await Promise.all([
      prisma.customerAccount.findMany({
        where,
        include: {
          assignedAdmin: {
            select: { id: true, name: true, email: true },
          },
          primaryPoc: {
            select: { id: true, name: true, email: true, isActive: true },
          },
          _count: {
            select: {
              users: true,
              requests: { where: { status: 'PENDING' } },
            },
          },
        },
        orderBy: { companyName: 'asc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customerAccount.count({ where }),
    ])

    // Get certificate counts by matching customerName
    const certificateCounts = await Promise.all(
      accounts.map(async (acc) => {
        const count = await prisma.certificate.count({
          where: { customerName: acc.companyName },
        })
        return { accountId: acc.id, count }
      })
    )

    const certCountMap = Object.fromEntries(
      certificateCounts.map((c) => [c.accountId, c.count])
    )

    return NextResponse.json({
      accounts: accounts.map((acc) => ({
        id: acc.id,
        companyName: acc.companyName,
        address: acc.address,
        contactEmail: acc.contactEmail,
        contactPhone: acc.contactPhone,
        isActive: acc.isActive,
        assignedAdmin: acc.assignedAdmin,
        primaryPoc: acc.primaryPoc,
        userCount: acc._count.users,
        pendingRequests: acc._count.requests,
        certificateCount: certCountMap[acc.id] || 0,
        createdAt: acc.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching customer accounts:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer accounts' },
      { status: 500 }
    )
  }
}

// POST /api/admin/customers - Create customer account with POC
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    // Master Admin only for customer management
    if (!isMasterAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden - Master Admin access required' }, { status: 403 })
    }

    const body = await request.json()
    const { companyName, address, contactEmail, contactPhone, assignedAdminId, pocName, pocEmail } = body

    // Validation
    if (!companyName?.trim()) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      )
    }

    if (!pocName?.trim()) {
      return NextResponse.json(
        { error: 'POC name is required' },
        { status: 400 }
      )
    }

    if (!pocEmail?.trim()) {
      return NextResponse.json(
        { error: 'POC email is required' },
        { status: 400 }
      )
    }

    // Check unique company name
    const existingAccount = await prisma.customerAccount.findUnique({
      where: { companyName: companyName.trim() },
    })

    if (existingAccount) {
      return NextResponse.json(
        { error: 'A customer account with this name already exists' },
        { status: 400 }
      )
    }

    // Check unique POC email
    const existingUser = await prisma.customerUser.findUnique({
      where: { email: pocEmail.trim().toLowerCase() },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      )
    }

    // Validate Admin if provided
    if (assignedAdminId) {
      const admin = await prisma.user.findFirst({
        where: { id: assignedAdminId, role: 'ADMIN', isActive: true },
      })

      if (!admin) {
        return NextResponse.json(
          { error: 'Invalid Admin selected' },
          { status: 400 }
        )
      }
    }

    // Generate activation token
    const activationToken = crypto.randomUUID()
    const activationExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Create account and POC user in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // 1. Create the customer account (without primaryPocId initially)
      const account = await tx.customerAccount.create({
        data: {
          companyName: companyName.trim(),
          address: address?.trim() || null,
          contactEmail: contactEmail?.trim() || null,
          contactPhone: contactPhone?.trim() || null,
          assignedAdminId: assignedAdminId || null,
          isActive: true,
        },
      })

      // 2. Create the POC user
      const pocUser = await tx.customerUser.create({
        data: {
          email: pocEmail.trim().toLowerCase(),
          name: pocName.trim(),
          customerAccountId: account.id,
          isPoc: true,
          isActive: false, // Pending activation
          activationToken,
          activationExpiry,
        },
      })

      // 3. Update account with primary POC reference
      const updatedAccount = await tx.customerAccount.update({
        where: { id: account.id },
        data: { primaryPocId: pocUser.id },
        include: {
          assignedAdmin: {
            select: { id: true, name: true },
          },
          primaryPoc: {
            select: { id: true, name: true, email: true, isActive: true },
          },
        },
      })

      return { account: updatedAccount, pocUser }
    })

    // TODO: Send activation email to POC (Phase 5)
    // await sendAccountCreatedEmail(pocEmail, pocName, companyName, activationToken)

    return NextResponse.json({
      success: true,
      account: {
        id: result.account.id,
        companyName: result.account.companyName,
        assignedAdmin: result.account.assignedAdmin,
        primaryPoc: result.account.primaryPoc,
      },
      message: 'Customer account created. Activation email will be sent to the POC.',
    })
  } catch (error) {
    console.error('Error creating customer account:', error)
    return NextResponse.json(
      { error: 'Failed to create customer account' },
      { status: 500 }
    )
  }
}
