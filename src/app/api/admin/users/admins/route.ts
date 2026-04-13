import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, canAccessAdmin } from '@/lib/auth'
import { cached, CacheKeys, CacheTTL } from '@/lib/cache'
import { createLogger } from '@/lib/logger'

const logger = createLogger('users')

// GET /api/admin/users/admins - Get list of admins for engineer assignment
export async function GET() {
  try {
    const session = await auth()
    if (!canAccessAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Cache admin list for 10 minutes - changes infrequently
    const admins = await cached(
      CacheKeys.dropdownAdmins(),
      async () => {
        const result = await prisma.user.findMany({
          where: {
            role: 'ADMIN',
            isActive: true,
          },
          select: {
            id: true,
            name: true,
            email: true,
            adminType: true,
            _count: {
              select: {
                engineers: true,
              },
            },
          },
          orderBy: { name: 'asc' },
        })

        return result.map((admin) => ({
          id: admin.id,
          name: admin.name,
          email: admin.email,
          adminType: admin.adminType,
          engineerCount: admin._count.engineers,
        }))
      },
      { ttl: CacheTTL.LONG }
    )

    return NextResponse.json({ admins })
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch admins')
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 })
  }
}
