import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, canAccessAdmin } from '@/lib/auth'

// GET /api/admin/users/admins - Get list of admins for engineer assignment
export async function GET() {
  try {
    const session = await auth()
    if (!canAccessAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const admins = await prisma.user.findMany({
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

    return NextResponse.json({
      admins: admins.map((admin) => ({
        id: admin.id,
        name: admin.name,
        email: admin.email,
        adminType: admin.adminType,
        engineerCount: admin._count.engineers,
      })),
    })
  } catch (error) {
    console.error('Error fetching admins:', error)
    return NextResponse.json({ error: 'Failed to fetch admins' }, { status: 500 })
  }
}
