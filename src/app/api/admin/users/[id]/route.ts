import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, canAccessAdmin } from '@/lib/auth'

// GET /api/admin/users/[id] - Get user details
export async function GET(
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
      include: {
        assignedHod: {
          select: { id: true, name: true, email: true },
        },
        engineers: {
          where: { isActive: true },
          select: { id: true, name: true, email: true },
        },
        _count: {
          select: {
            createdCertificates: true,
          },
        },
      },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Get certificate stats
    const certificateStats = await prisma.certificate.groupBy({
      by: ['status'],
      where: { createdById: id },
      _count: true,
    })

    const stats = {
      total: user._count.createdCertificates,
      byStatus: Object.fromEntries(
        certificateStats.map((s) => [s.status, s._count])
      ),
    }

    return NextResponse.json({
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isAdmin: user.isAdmin,
        isActive: user.isActive,
        authProvider: user.authProvider,
        signatureUrl: user.signatureUrl,
        profileImageUrl: user.profileImageUrl,
        assignedHod: user.assignedHod,
        engineers: user.engineers, // Engineers managed by this HoD
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      },
      stats,
    })
  } catch (error) {
    console.error('Error fetching user:', error)
    return NextResponse.json({ error: 'Failed to fetch user' }, { status: 500 })
  }
}

// PUT /api/admin/users/[id] - Update user
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
    const body = await request.json()
    const { name, role, assignedHodId, signatureUrl, isAdmin } = body

    const existingUser = await prisma.user.findUnique({
      where: { id },
      include: {
        engineers: { select: { id: true } },
      },
    })

    if (!existingUser) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent admin from changing their own role
    if (id === session!.user.id && role && role !== existingUser.role) {
      return NextResponse.json(
        { error: 'You cannot change your own role' },
        { status: 400 }
      )
    }

    // Handle role change validations
    const updateData: Record<string, unknown> = {}

    if (name !== undefined) {
      updateData.name = name
    }

    if (signatureUrl !== undefined) {
      updateData.signatureUrl = signatureUrl
    }

    if (role !== undefined && role !== existingUser.role) {
      if (!['ENGINEER', 'HOD', 'ADMIN'].includes(role)) {
        return NextResponse.json(
          { error: 'Invalid role' },
          { status: 400 }
        )
      }

      // If changing from HOD to ENGINEER, ensure no engineers are assigned
      if (existingUser.role === 'HOD' && role === 'ENGINEER') {
        if (existingUser.engineers.length > 0) {
          return NextResponse.json(
            { error: 'Cannot demote HoD with assigned engineers. Reassign them first.' },
            { status: 400 }
          )
        }
      }

      updateData.role = role

      // Clear HoD assignment if becoming HOD or ADMIN
      if (role !== 'ENGINEER') {
        updateData.assignedHodId = null
      }
    }

    // Handle HoD assignment for engineers
    if (assignedHodId !== undefined) {
      const finalRole = role || existingUser.role

      if (finalRole !== 'ENGINEER') {
        // Silently ignore HoD assignment for non-engineers
      } else {
        if (assignedHodId === null) {
          return NextResponse.json(
            { error: 'Engineers must be assigned to an HoD' },
            { status: 400 }
          )
        }

        const hod = await prisma.user.findFirst({
          where: { id: assignedHodId, role: 'HOD', isActive: true },
        })

        if (!hod) {
          return NextResponse.json(
            { error: 'Invalid HoD selected' },
            { status: 400 }
          )
        }

        updateData.assignedHodId = assignedHodId
      }
    }

    // Handle isAdmin flag - only applies to HOD role
    if (isAdmin !== undefined) {
      const finalRole = role || existingUser.role
      updateData.isAdmin = finalRole === 'HOD' ? Boolean(isAdmin) : false
    }

    const user = await prisma.user.update({
      where: { id },
      data: updateData,
      include: {
        assignedHod: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      user: {
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        assignedHod: user.assignedHod,
      },
    })
  } catch (error) {
    console.error('Error updating user:', error)
    return NextResponse.json({ error: 'Failed to update user' }, { status: 500 })
  }
}

// DELETE /api/admin/users/[id] - Deactivate user (soft delete)
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!canAccessAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Prevent admin from deactivating themselves
    if (id === session!.user.id) {
      return NextResponse.json(
        { error: 'You cannot deactivate your own account' },
        { status: 400 }
      )
    }

    const user = await prisma.user.findUnique({
      where: { id },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Prevent deactivating the last admin
    if (user.role === 'ADMIN') {
      const adminCount = await prisma.user.count({
        where: { role: 'ADMIN', isActive: true },
      })

      if (adminCount <= 1) {
        return NextResponse.json(
          { error: 'Cannot deactivate the last admin user' },
          { status: 400 }
        )
      }
    }

    // Soft delete - set isActive to false
    await prisma.user.update({
      where: { id },
      data: { isActive: false },
    })

    return NextResponse.json({
      success: true,
      message: 'User deactivated successfully',
    })
  } catch (error) {
    console.error('Error deactivating user:', error)
    return NextResponse.json({ error: 'Failed to deactivate user' }, { status: 500 })
  }
}
