import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, canAccessAdmin } from '@/lib/auth'
import { createLogger } from '@/lib/logger'

const logger = createLogger('users')

// PUT /api/admin/users/[id]/reactivate - Reactivate a deactivated user
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!canAccessAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    if (user.isActive) {
      return NextResponse.json(
        { error: 'User is already active' },
        { status: 400 }
      )
    }

    await prisma.user.update({
      where: { id },
      data: { isActive: true },
    })

    return NextResponse.json({
      success: true,
      message: 'User reactivated successfully',
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to reactivate user')
    return NextResponse.json({ error: 'Failed to reactivate user' }, { status: 500 })
  }
}
