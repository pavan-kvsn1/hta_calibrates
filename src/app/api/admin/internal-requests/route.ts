import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, isMasterAdmin } from '@/lib/auth'

// GET /api/admin/internal-requests - List all internal requests
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!isMasterAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden - Master Admin access required' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'PENDING'
    const type = searchParams.get('type') // SECTION_UNLOCK
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}

    if (status && status !== 'ALL') {
      where.status = status
    }

    if (type) {
      where.type = type
    }

    const [requests, total] = await Promise.all([
      prisma.internalRequest.findMany({
        where,
        include: {
          requestedBy: {
            select: { id: true, name: true, email: true },
          },
          certificate: {
            select: { id: true, certificateNumber: true, status: true },
          },
          reviewedBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: { createdAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.internalRequest.count({ where }),
    ])

    // Get counts by status for tabs
    const baseWhere = type ? { type: type as 'SECTION_UNLOCK' } : {}
    const [pendingCount, approvedCount, rejectedCount] = await Promise.all([
      prisma.internalRequest.count({ where: { ...baseWhere, status: 'PENDING' } }),
      prisma.internalRequest.count({ where: { ...baseWhere, status: 'APPROVED' } }),
      prisma.internalRequest.count({ where: { ...baseWhere, status: 'REJECTED' } }),
    ])

    return NextResponse.json({
      requests: requests.map((r) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        data: JSON.parse(r.data),
        certificate: r.certificate,
        requestedBy: r.requestedBy,
        reviewedBy: r.reviewedBy,
        reviewedAt: r.reviewedAt?.toISOString() || null,
        adminNote: r.adminNote,
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
    console.error('Error fetching internal requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch internal requests' },
      { status: 500 }
    )
  }
}
