import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, hashPassword, canAccessAdmin } from '@/lib/auth'

// GET /api/admin/users - List staff users
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!canAccessAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const role = searchParams.get('role')
    const isActive = searchParams.get('isActive')
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    const where: Record<string, unknown> = {}

    if (role && role !== 'ALL') {
      where.role = role
    }

    if (isActive !== null && isActive !== 'ALL') {
      where.isActive = isActive === 'true'
    }

    if (search) {
      where.OR = [
        { name: { contains: search } },
        { email: { contains: search } },
      ]
    }

    const [users, total] = await Promise.all([
      prisma.user.findMany({
        where,
        include: {
          assignedAdmin: {
            select: { id: true, name: true, email: true },
          },
          _count: {
            select: { createdCertificates: true },
          },
        },
        orderBy: [
          { role: 'asc' },
          { name: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.user.count({ where }),
    ])

    return NextResponse.json({
      users: users.map((user) => ({
        id: user.id,
        email: user.email,
        name: user.name,
        role: user.role,
        isActive: user.isActive,
        authProvider: user.authProvider,
        assignedAdmin: user.assignedAdmin,
        certificateCount: user._count.createdCertificates,
        createdAt: user.createdAt.toISOString(),
        updatedAt: user.updatedAt.toISOString(),
      })),
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
    })
  } catch (error) {
    console.error('Error fetching users:', error)
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

// POST /api/admin/users - Create staff user
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!canAccessAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { email, name, password, role, assignedAdminId, adminType } = body

    // Validation
    if (!email || !name || !password || !role) {
      return NextResponse.json(
        { error: 'Email, name, password, and role are required' },
        { status: 400 }
      )
    }

    if (!['ENGINEER', 'ADMIN'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be ENGINEER or ADMIN' },
        { status: 400 }
      )
    }

    // Password validation
    if (password.length < 8) {
      return NextResponse.json(
        { error: 'Password must be at least 8 characters' },
        { status: 400 }
      )
    }

    if (!/\d/.test(password)) {
      return NextResponse.json(
        { error: 'Password must contain at least one number' },
        { status: 400 }
      )
    }

    // Check unique email
    const existingUser = await prisma.user.findUnique({
      where: { email },
    })

    if (existingUser) {
      return NextResponse.json(
        { error: 'A user with this email already exists' },
        { status: 400 }
      )
    }

    // Validate Admin assignment for engineers
    if (role === 'ENGINEER') {
      if (!assignedAdminId) {
        return NextResponse.json(
          { error: 'Engineers must be assigned to an Admin' },
          { status: 400 }
        )
      }

      const admin = await prisma.user.findFirst({
        where: { id: assignedAdminId, role: 'ADMIN', isActive: true },
      })

      if (!admin) {
        return NextResponse.json(
          { error: 'Invalid Admin selected' },
          { status: 400 }
        )
      }
    }

    // Validate adminType for ADMIN role
    if (role === 'ADMIN' && adminType && !['MASTER', 'WORKER'].includes(adminType)) {
      return NextResponse.json(
        { error: 'Invalid admin type. Must be MASTER or WORKER' },
        { status: 400 }
      )
    }

    // Create user
    const passwordHash = await hashPassword(password)

    const user = await prisma.user.create({
      data: {
        email,
        name,
        passwordHash,
        role,
        authProvider: 'PASSWORD',
        assignedAdminId: role === 'ENGINEER' ? assignedAdminId : null,
        adminType: role === 'ADMIN' ? (adminType || 'WORKER') : null,
        isActive: true,
      },
      include: {
        assignedAdmin: {
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
        adminType: user.adminType,
        assignedAdmin: user.assignedAdmin,
      },
    })
  } catch (error) {
    console.error('Error creating user:', error)
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
