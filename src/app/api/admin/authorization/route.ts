import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, canAccessAdmin } from '@/lib/auth'

// GET /api/admin/authorization - List certificates pending admin authorization
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!canAccessAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'PENDING_ADMIN_AUTHORIZATION'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}
    if (status === 'ALL') {
      // Show both pending and authorized
      where.status = { in: ['PENDING_ADMIN_AUTHORIZATION', 'AUTHORIZED'] }
    } else {
      where.status = status
    }

    const [certificates, total] = await Promise.all([
      prisma.certificate.findMany({
        where,
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
        },
        orderBy: { updatedAt: 'desc' },
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.certificate.count({ where }),
    ])

    return NextResponse.json({
      certificates: certificates.map((cert) => ({
        id: cert.id,
        certificateNumber: cert.certificateNumber,
        customerName: cert.customerName,
        uucDescription: cert.uucDescription,
        uucMake: cert.uucMake,
        uucModel: cert.uucModel,
        uucSerialNumber: cert.uucSerialNumber,
        dateOfCalibration: cert.dateOfCalibration?.toISOString() || null,
        status: cert.status,
        currentRevision: cert.currentRevision,
        createdBy: cert.createdBy,
        createdAt: cert.createdAt.toISOString(),
        updatedAt: cert.updatedAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching authorization list:', error)
    return NextResponse.json(
      { error: 'Failed to fetch authorization list' },
      { status: 500 }
    )
  }
}
