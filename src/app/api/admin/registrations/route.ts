import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, isMasterAdmin } from '@/lib/auth'

// GET /api/admin/registrations - List customer registrations (Master Admin only)
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    // Master Admin only for registration management
    if (!isMasterAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden - Master Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'PENDING'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}
    if (status !== 'ALL') {
      where.status = status
    }

    const [registrations, total] = await Promise.all([
      prisma.customerRegistration.findMany({
        where,
        include: {
          customerAccount: {
            select: { id: true, companyName: true },
          },
          reviewedBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customerRegistration.count({ where }),
    ])

    return NextResponse.json({
      registrations: registrations.map((reg) => ({
        id: reg.id,
        email: reg.email,
        name: reg.name,
        status: reg.status,
        customerAccount: reg.customerAccount,
        reviewedBy: reg.reviewedBy,
        reviewedAt: reg.reviewedAt?.toISOString() || null,
        rejectionReason: reg.rejectionReason,
        createdAt: reg.createdAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching registrations:', error)
    return NextResponse.json(
      { error: 'Failed to fetch registrations' },
      { status: 500 }
    )
  }
}
