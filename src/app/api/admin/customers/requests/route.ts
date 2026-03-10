import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, isMasterAdmin } from '@/lib/auth'

// GET /api/admin/customers/requests - List all customer requests
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!isMasterAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden - Master Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'PENDING'
    const type = searchParams.get('type') // USER_ADDITION or POC_CHANGE
    const customerAccountId = searchParams.get('customerAccountId')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}

    if (status && status !== 'ALL') {
      where.status = status
    }

    if (type) {
      where.type = type
    }

    if (customerAccountId) {
      where.customerAccountId = customerAccountId
    }

    const [requests, total] = await Promise.all([
      prisma.customerRequest.findMany({
        where,
        include: {
          customerAccount: {
            select: { id: true, companyName: true },
          },
          requestedBy: {
            select: { id: true, name: true, email: true },
          },
          reviewedBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.customerRequest.count({ where }),
    ])

    // Get counts by status for tabs
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      prisma.customerRequest.count({ where: { ...where, status: 'PENDING' } }),
      prisma.customerRequest.count({ where: { ...where, status: 'APPROVED' } }),
      prisma.customerRequest.count({ where: { ...where, status: 'REJECTED' } }),
    ])

    return NextResponse.json({
      requests: requests.map((r) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        data: JSON.parse(r.data),
        customerAccount: r.customerAccount,
        requestedBy: r.requestedBy,
        reviewedBy: r.reviewedBy,
        reviewedAt: r.reviewedAt?.toISOString() || null,
        rejectionReason: r.rejectionReason,
        createdAt: r.createdAt.toISOString(),
      })),
      counts: {
        pending: pendingCount,
        approved: approvedCount,
        rejected: rejectedCount,
      },
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching customer requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer requests' },
      { status: 500 }
    )
  }
}
