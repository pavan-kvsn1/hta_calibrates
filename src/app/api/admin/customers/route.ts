import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, canAccessAdmin } from '@/lib/auth'

// GET /api/admin/customers - List customer accounts
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!canAccessAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
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
          assignedHod: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: {
              users: true,
              registrations: { where: { status: 'PENDING' } },
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
        assignedHod: acc.assignedHod,
        userCount: acc._count.users,
        pendingRegistrations: acc._count.registrations,
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

// POST /api/admin/customers - Create customer account
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!canAccessAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { companyName, address, contactEmail, contactPhone, assignedHodId } = body

    // Validation
    if (!companyName?.trim()) {
      return NextResponse.json(
        { error: 'Company name is required' },
        { status: 400 }
      )
    }

    // Check unique company name
    const existing = await prisma.customerAccount.findUnique({
      where: { companyName: companyName.trim() },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'A customer account with this name already exists' },
        { status: 400 }
      )
    }

    // Validate HoD if provided
    if (assignedHodId) {
      const hod = await prisma.user.findFirst({
        where: { id: assignedHodId, role: 'HOD', isActive: true },
      })

      if (!hod) {
        return NextResponse.json(
          { error: 'Invalid HoD selected' },
          { status: 400 }
        )
      }
    }

    const account = await prisma.customerAccount.create({
      data: {
        companyName: companyName.trim(),
        address: address?.trim() || null,
        contactEmail: contactEmail?.trim() || null,
        contactPhone: contactPhone?.trim() || null,
        assignedHodId: assignedHodId || null,
        isActive: true,
      },
      include: {
        assignedHod: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        companyName: account.companyName,
        assignedHod: account.assignedHod,
      },
    })
  } catch (error) {
    console.error('Error creating customer account:', error)
    return NextResponse.json(
      { error: 'Failed to create customer account' },
      { status: 500 }
    )
  }
}
