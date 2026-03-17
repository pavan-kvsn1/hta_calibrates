import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { calculateUserTATMetrics, calculateRequestHandlingMetrics } from '@/lib/utils/user-tat-calculator'

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN role can access
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const { id } = await params

    // Get period from query params (default 30 days)
    const { searchParams } = new URL(request.url)
    const periodDays = parseInt(searchParams.get('periodDays') || '30', 10)

    // Verify user exists and get adminType
    const user = await prisma.user.findUnique({
      where: { id },
      select: { id: true, role: true, adminType: true },
    })

    if (!user) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    // Calculate date range - get data from the last 2x periodDays for comparison
    const now = new Date()
    const startDate = new Date(now)
    startDate.setDate(startDate.getDate() - (periodDays * 2))
    startDate.setHours(0, 0, 0, 0)

    const periodStart = new Date(now)
    periodStart.setDate(periodStart.getDate() - periodDays)
    periodStart.setHours(0, 0, 0, 0)

    const previousPeriodStart = new Date(periodStart)
    previousPeriodStart.setDate(previousPeriodStart.getDate() - periodDays)

    // Build query conditions based on user role
    // For ADMIN users, also include certificates they authorized
    const whereConditions: { OR: object[] } = {
      OR: [
        { createdById: id },
        { reviewerId: id },
      ],
    }

    // For ADMIN role, also fetch certificates where they may have authorized
    if (user.role === 'ADMIN') {
      whereConditions.OR.push({
        status: 'AUTHORIZED',
        events: {
          some: {
            eventType: 'ADMIN_AUTHORIZED',
            createdAt: { gte: startDate },
          },
        },
      })
    }

    // Fetch certificates where user was creator, reviewer, or authorizer
    const certificates = await prisma.certificate.findMany({
      where: {
        ...whereConditions,
        events: {
          some: {
            createdAt: { gte: startDate },
          },
        },
      },
      select: {
        id: true,
        status: true,
        currentRevision: true,
        createdById: true,
        reviewerId: true,
        events: {
          select: {
            id: true,
            eventType: true,
            createdAt: true,
            certificateId: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    // Calculate certificate TAT metrics
    const certMetrics = calculateUserTATMetrics(certificates, id, periodDays)

    // For ADMIN users, also calculate request handling metrics
    let requestHandling = null
    if (user.role === 'ADMIN') {
      // Fetch internal requests reviewed by this admin
      const internalRequests = await prisma.internalRequest.findMany({
        where: {
          reviewedById: id,
          reviewedAt: { gte: startDate },
        },
        select: {
          id: true,
          status: true,
          createdAt: true,
          reviewedAt: true,
          reviewedById: true,
        },
      })

      // Fetch customer requests reviewed by this admin (for MASTER admins)
      const customerRequests = user.adminType === 'MASTER'
        ? await prisma.customerRequest.findMany({
            where: {
              reviewedById: id,
              reviewedAt: { gte: startDate },
            },
            select: {
              id: true,
              status: true,
              createdAt: true,
              reviewedAt: true,
              reviewedById: true,
            },
          })
        : []

      requestHandling = calculateRequestHandlingMetrics(
        internalRequests,
        customerRequests,
        id,
        user.adminType,
        periodStart,
        previousPeriodStart
      )
    }

    return NextResponse.json({
      ...certMetrics,
      requestHandling,
    })
  } catch (error) {
    console.error('User TAT metrics fetch error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch TAT metrics' },
      { status: 500 }
    )
  }
}
