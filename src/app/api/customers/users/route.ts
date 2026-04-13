import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logger'

const logger = createLogger('customers')

/**
 * GET /api/customers/users
 * Search customer users (contacts) for a given company
 * Access: Admin, Engineer (for certificate creation)
 *
 * Query params:
 * - company: Company name to search users for (required)
 * - q: Optional search query to filter user names
 * - limit: Max results (default 5, max 10)
 */
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only admins and engineers can search customer users
    if (session.user.role !== 'ADMIN' && session.user.role !== 'ENGINEER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const company = searchParams.get('company') || ''
    const query = searchParams.get('q') || ''
    const limit = Math.min(parseInt(searchParams.get('limit') || '5'), 10)

    if (company.length < 2) {
      return NextResponse.json({ users: [] })
    }

    // Find customer accounts matching the company name (use contains for flexibility)
    const customerAccounts = await prisma.customerAccount.findMany({
      where: {
        isActive: true,
        companyName: {
          contains: company,
          mode: 'insensitive',
        },
      },
      select: { id: true },
      take: 5, // Limit to prevent too many matches
    })

    if (customerAccounts.length === 0) {
      return NextResponse.json({ users: [] })
    }

    const accountIds = customerAccounts.map(a => a.id)

    // Find users for these customer accounts
    const users = await prisma.customerUser.findMany({
      where: {
        customerAccountId: { in: accountIds },
        isActive: true,
        ...(query.length > 0 && {
          name: {
            contains: query,
            mode: 'insensitive',
          },
        }),
      },
      select: {
        id: true,
        name: true,
        email: true,
        isPoc: true,
      },
      orderBy: [
        { isPoc: 'desc' }, // POC users first
        { name: 'asc' },
      ],
      take: limit,
    })

    return NextResponse.json({ users })
  } catch (error) {
    logger.error({ err: error }, 'Failed to search customer users')
    return NextResponse.json(
      { error: 'Failed to search customer users' },
      { status: 500 }
    )
  }
}
