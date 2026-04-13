import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { auth, canAccessAdmin } from '@/lib/auth'
import { enqueue } from '@/lib/services/queue'
import { createLogger } from '@/lib/logger'

const logger = createLogger('users')

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
        activatedAt: user.activatedAt?.toISOString() || null,
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
    logger.error({ err: error }, 'Failed to fetch users')
    return NextResponse.json({ error: 'Failed to fetch users' }, { status: 500 })
  }
}

// POST /api/admin/users - Create staff user (sends activation email)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!canAccessAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { email, name, role, assignedAdminId, adminType } = body

    // Validation
    if (!email || !name || !role) {
      return NextResponse.json(
        { error: 'Email, name, and role are required' },
        { status: 400 }
      )
    }

    if (!['ENGINEER', 'ADMIN'].includes(role)) {
      return NextResponse.json(
        { error: 'Invalid role. Must be ENGINEER or ADMIN' },
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

    // Generate activation token
    const activationToken = crypto.randomUUID()
    const activationExpiry = new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours

    // Create user (inactive, no password)
    const user = await prisma.user.create({
      data: {
        email,
        name,
        role,
        authProvider: 'PASSWORD',
        assignedAdmin: role === 'ENGINEER' && assignedAdminId
          ? { connect: { id: assignedAdminId } }
          : undefined,
        adminType: role === 'ADMIN' ? (adminType || 'WORKER') : null,
        isActive: false,
        activationToken,
        activationExpiry,
      },
      include: {
        assignedAdmin: {
          select: { id: true, name: true },
        },
      },
    })

    // Send activation email
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const activationUrl = `${baseUrl}/activate/${activationToken}`

    await enqueue('email:send', {
      to: email,
      template: 'staff-activation',
      templateData: {
        userName: name,
        activationUrl,
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
        isActive: user.isActive,
      },
      message: `Activation email sent to ${email}`,
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to create user')
    return NextResponse.json({ error: 'Failed to create user' }, { status: 500 })
  }
}
