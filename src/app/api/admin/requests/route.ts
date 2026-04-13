import { NextRequest, NextResponse } from 'next/server'
import { auth, isMasterAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

const logger = createLogger('requests')

export const dynamic = 'force-dynamic'

interface UnifiedRequest {
  id: string
  category: 'internal' | 'customer'
  type: string
  status: string
  title: string
  subtitle: string
  details: string
  requestedBy: string
  requestedByEmail: string
  createdAt: string
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || !isMasterAdmin(session.user)) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const status = searchParams.get('status') || 'PENDING'
    const type = searchParams.get('type') || 'ALL'
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '15')

    // Build where clauses
    const internalWhere: Record<string, unknown> = {}
    const customerWhere: Record<string, unknown> = {}

    if (status !== 'ALL') {
      internalWhere.status = status
      customerWhere.status = status
    }

    // Type filtering
    const fetchInternal = type === 'ALL' || type === 'SECTION_UNLOCK'
    const fetchCustomer = type === 'ALL' || type === 'USER_ADDITION' || type === 'POC_CHANGE'

    if (type === 'USER_ADDITION' || type === 'POC_CHANGE') {
      customerWhere.type = type
    }

    // Fetch counts for summary cards
    const [
      internalPendingCount,
      userAddPendingCount,
      pocChangePendingCount,
      internalApprovedCount,
      internalRejectedCount,
      customerApprovedCount,
      customerRejectedCount,
    ] = await Promise.all([
      prisma.internalRequest.count({ where: { status: 'PENDING' } }),
      prisma.customerRequest.count({ where: { status: 'PENDING', type: 'USER_ADDITION' } }),
      prisma.customerRequest.count({ where: { status: 'PENDING', type: 'POC_CHANGE' } }),
      prisma.internalRequest.count({ where: { status: 'APPROVED' } }),
      prisma.internalRequest.count({ where: { status: 'REJECTED' } }),
      prisma.customerRequest.count({ where: { status: 'APPROVED' } }),
      prisma.customerRequest.count({ where: { status: 'REJECTED' } }),
    ])

    // Fetch requests from both tables
    const [internalRequests, customerRequests] = await Promise.all([
      fetchInternal
        ? prisma.internalRequest.findMany({
            where: internalWhere,
            include: {
              certificate: {
                select: { id: true, certificateNumber: true, status: true },
              },
              requestedBy: {
                select: { id: true, name: true, email: true },
              },
              reviewedBy: {
                select: { id: true, name: true },
              },
            },
            orderBy: { createdAt: 'desc' },
          })
        : [],
      fetchCustomer
        ? prisma.customerRequest.findMany({
            where: customerWhere,
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
          })
        : [],
    ])

    // Section labels for internal requests
    const SECTION_LABELS: Record<string, string> = {
      'summary': 'Summary',
      'uuc-details': 'UUC Details',
      'master-inst': 'Master Instruments',
      'environment': 'Environmental',
      'results': 'Results',
      'remarks': 'Remarks',
      'conclusion': 'Conclusion',
    }

    // Normalize internal requests
    const normalizedInternal: UnifiedRequest[] = internalRequests.map((r) => {
      const data = typeof r.data === 'string' ? JSON.parse(r.data) : r.data
      const sections = (data.sections || []) as string[]
      const sectionLabels = sections.map((s: string) => SECTION_LABELS[s] || s).join(', ')

      return {
        id: r.id,
        category: 'internal' as const,
        type: r.type,
        status: r.status,
        title: r.certificate?.certificateNumber || 'Unknown Certificate',
        subtitle: `by ${r.requestedBy.name || 'Unknown'}`,
        details: sectionLabels || 'No sections specified',
        requestedBy: r.requestedBy.name || 'Unknown',
        requestedByEmail: r.requestedBy.email,
        createdAt: r.createdAt.toISOString(),
      }
    })

    // Normalize customer requests
    const normalizedCustomer: UnifiedRequest[] = customerRequests.map((r) => {
      const data = typeof r.data === 'string' ? JSON.parse(r.data) : r.data

      let details = ''
      if (r.type === 'USER_ADDITION') {
        details = `Add: ${data.name || 'Unknown'} (${data.email || 'No email'})`
      } else if (r.type === 'POC_CHANGE') {
        details = 'POC change requested'
      }

      return {
        id: r.id,
        category: 'customer' as const,
        type: r.type,
        status: r.status,
        title: r.customerAccount.companyName,
        subtitle: r.requestedBy ? `by ${r.requestedBy.name} (POC)` : 'System',
        details,
        requestedBy: r.requestedBy?.name || 'System',
        requestedByEmail: r.requestedBy?.email || '',
        createdAt: r.createdAt.toISOString(),
      }
    })

    // Merge and sort by createdAt
    const allRequests = [...normalizedInternal, ...normalizedCustomer].sort(
      (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()
    )

    // Pagination
    const total = allRequests.length
    const totalPages = Math.ceil(total / limit)
    const paginatedRequests = allRequests.slice((page - 1) * limit, page * limit)

    return NextResponse.json({
      requests: paginatedRequests,
      pagination: {
        page,
        limit,
        total,
        totalPages,
      },
      counts: {
        pending: {
          sectionUnlock: internalPendingCount,
          userAddition: userAddPendingCount,
          pocChange: pocChangePendingCount,
          total: internalPendingCount + userAddPendingCount + pocChangePendingCount,
        },
        approved: internalApprovedCount + customerApprovedCount,
        rejected: internalRejectedCount + customerRejectedCount,
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch unified requests')
    return NextResponse.json({ error: 'Failed to fetch requests' }, { status: 500 })
  }
}
