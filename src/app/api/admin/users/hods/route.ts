import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, canAccessAdmin } from '@/lib/auth'

// GET /api/admin/users/hods - Get list of active HoDs for dropdown
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!canAccessAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const hods = await prisma.user.findMany({
      where: {
        role: 'HOD',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        _count: {
          select: { engineers: true },
        },
      },
      orderBy: { name: 'asc' },
    })

    return NextResponse.json({
      hods: hods.map((hod) => ({
        id: hod.id,
        name: hod.name,
        email: hod.email,
        engineerCount: hod._count.engineers,
      })),
    })
  } catch (error) {
    console.error('Error fetching HoDs:', error)
    return NextResponse.json({ error: 'Failed to fetch HoDs' }, { status: 500 })
  }
}
