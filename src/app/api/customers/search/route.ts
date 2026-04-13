import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { cached, CacheTTL } from '@/lib/cache'
import { createLogger } from '@/lib/logger'

const logger = createLogger('customers')

/**
 * GET /api/customers/search
 * Search customer accounts for autocomplete
 * Access: Admin, Engineer (for certificate creation)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins and engineers can search customers
    if (session.user.role !== 'ADMIN' && session.user.role !== 'ENGINEER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const query = searchParams.get('q') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '10'), 20)

    if (query.length < 2) {
      return NextResponse.json({ customers: [] })
    }

    // Cache search results for 2 minutes - customer list doesn't change often
    const cacheKey = `customers:search:${query.toLowerCase()}:${limit}`
    const customers = await cached(
      cacheKey,
      async () => {
        return prisma.customerAccount.findMany({
          where: {
            isActive: true,
            companyName: {
              contains: query,
              mode: 'insensitive',
            },
          },
          select: {
            id: true,
            companyName: true,
            address: true,
            contactEmail: true,
            contactPhone: true,
          },
          orderBy: { companyName: 'asc' },
          take: limit,
        })
      },
      { ttl: CacheTTL.SHORT }
    )

    return NextResponse.json({ customers })
  } catch (error) {
    logger.error({ err: error }, 'Failed to search customers')
    return NextResponse.json(
      { error: 'Failed to search customers' },
      { status: 500 }
    )
  }
}
