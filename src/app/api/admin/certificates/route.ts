import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, canAccessAdmin } from '@/lib/auth'
import { cached, CacheKeys, CacheTTL } from '@/lib/cache'
import { certificateLogger as logger } from '@/lib/logger'

// GET /api/admin/certificates - List all certificates with filters
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!canAccessAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Generate cache key based on query params
    const cacheKey = `admin:certs:${status || 'ALL'}:${search || ''}:${page}:${limit}`

    // Cache admin certificate list for 30 seconds - changes with certificate updates
    const result = await cached(
      cacheKey,
      async () => {
        const where: Record<string, unknown> = {}

        // Filter by status
        if (status && status !== 'ALL') {
          where.status = status
        }

        // Search by certificate number, customer name, or UUC description
        if (search) {
          where.OR = [
            { certificateNumber: { contains: search } },
            { customerName: { contains: search } },
            { uucDescription: { contains: search } },
            { uucMake: { contains: search } },
            { uucModel: { contains: search } },
          ]
        }

        const [certificates, total] = await Promise.all([
          prisma.certificate.findMany({
            where,
            include: {
              createdBy: {
                select: {
                  id: true,
                  name: true,
                  email: true,
                  assignedAdmin: {
                    select: { id: true, name: true, email: true },
                  },
                },
              },
              lastModifiedBy: {
                select: { id: true, name: true },
              },
            },
            orderBy: { updatedAt: 'desc' },
            skip: (page - 1) * limit,
            take: limit,
          }),
          prisma.certificate.count({ where }),
        ])

        // Get stats
        const stats = await getCertificateStats()

        return {
          certificates: certificates.map((cert) => ({
            id: cert.id,
            certificateNumber: cert.certificateNumber,
            status: cert.status,
            customerName: cert.customerName || '-',
            uucDescription: cert.uucDescription || '-',
            uucMake: cert.uucMake || '',
            uucModel: cert.uucModel || '',
            dateOfCalibration: cert.dateOfCalibration?.toISOString() || null,
            calibrationDueDate: cert.calibrationDueDate?.toISOString() || null,
            currentRevision: cert.currentRevision,
            createdAt: cert.createdAt.toISOString(),
            updatedAt: cert.updatedAt.toISOString(),
            createdBy: {
              id: cert.createdBy.id,
              name: cert.createdBy.name,
              email: cert.createdBy.email,
            },
            assignedAdmin: cert.createdBy.assignedAdmin || null,
            lastModifiedBy: cert.lastModifiedBy,
          })),
          pagination: {
            page,
            limit,
            total,
            totalPages: Math.ceil(total / limit),
          },
          stats,
        }
      },
      { ttl: CacheTTL.VERY_SHORT }
    )

    logger.info({ userId: session?.user?.id, status, search, page, total: result.pagination.total }, 'Admin certificates fetched')
    return NextResponse.json(result)
  } catch (error) {
    logger.error({ err: error }, 'Error fetching admin certificates')
    return NextResponse.json(
      { error: 'Failed to fetch certificates' },
      { status: 500 }
    )
  }
}

// Helper to get certificate statistics (cached separately)
async function getCertificateStats() {
  return cached(
    CacheKeys.certificateStats(),
    async () => {
      const [
        total,
        draft,
        pendingHodReview,
        revisionRequired,
        pendingCustomerApproval,
        customerRevisionRequired,
        pendingAdminAuthorization,
        authorized,
        rejected,
      ] = await Promise.all([
        prisma.certificate.count(),
        prisma.certificate.count({ where: { status: 'DRAFT' } }),
        prisma.certificate.count({ where: { status: 'PENDING_REVIEW' } }),
        prisma.certificate.count({ where: { status: 'REVISION_REQUIRED' } }),
        prisma.certificate.count({ where: { status: 'PENDING_CUSTOMER_APPROVAL' } }),
        prisma.certificate.count({ where: { status: 'CUSTOMER_REVISION_REQUIRED' } }),
        prisma.certificate.count({ where: { status: 'PENDING_ADMIN_AUTHORIZATION' } }),
        prisma.certificate.count({ where: { status: 'AUTHORIZED' } }),
        prisma.certificate.count({ where: { status: 'REJECTED' } }),
      ])

      return {
        total,
        draft,
        pendingHodReview,
        revisionRequired,
        pendingCustomerApproval,
        customerRevisionRequired,
        pendingAdminAuthorization,
        authorized,
        rejected,
      }
    },
    { ttl: CacheTTL.VERY_SHORT }
  )
}
