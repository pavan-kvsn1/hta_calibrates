import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auth, canAccessAdmin } from '@/lib/auth'
import { safeJsonParse } from '@/lib/utils/safe-json'

// GET /api/admin/instruments - List instruments with filters and pagination
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!canAccessAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')
    const status = searchParams.get('status') // valid, expiring, expired
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const where: Record<string, unknown> = {
      isLatest: true, // Always fetch only latest versions
    }

    // Filter by active status
    if (!includeInactive) {
      where.isActive = true
    }

    // Filter by category
    if (category && category !== 'ALL') {
      where.category = category
    }

    // Search
    if (search) {
      where.OR = [
        { description: { contains: search } },
        { assetNumber: { contains: search } },
        { make: { contains: search } },
        { model: { contains: search } },
        { serialNumber: { contains: search } },
      ]
    }

    // Filter by status (requires date calculation)
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    const thirtyDaysFromNow = new Date(today)
    thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

    if (status === 'expired') {
      where.calibrationDueDate = { lt: today }
    } else if (status === 'expiring') {
      where.calibrationDueDate = { gte: today, lte: thirtyDaysFromNow }
    } else if (status === 'valid') {
      where.calibrationDueDate = { gt: thirtyDaysFromNow }
    } else if (status === 'underRecal') {
      where.status = 'UNDER_RECAL'
    }

    const [instruments, total] = await Promise.all([
      prisma.masterInstrument.findMany({
        where,
        include: {
          createdBy: {
            select: { id: true, name: true },
          },
        },
        orderBy: [
          { category: 'asc' },
          { description: 'asc' },
        ],
        skip: (page - 1) * limit,
        take: limit,
      }),
      prisma.masterInstrument.count({ where }),
    ])

    // Calculate status for each instrument
    const instrumentsWithStatus = instruments.map(inst => {
      let instrumentStatus = 'VALID'
      let daysUntilExpiry = 999

      // Use explicit status if set, otherwise compute from dates
      if (inst.status) {
        instrumentStatus = inst.status
      } else if (inst.calibrationDueDate) {
        const dueDate = new Date(inst.calibrationDueDate)
        const diffTime = dueDate.getTime() - today.getTime()
        daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

        if (daysUntilExpiry < 0) {
          instrumentStatus = 'EXPIRED'
        } else if (daysUntilExpiry <= 30) {
          instrumentStatus = 'EXPIRING_SOON'
        }
      }

      // Still calculate days until expiry for display even if status is overridden
      if (inst.calibrationDueDate && daysUntilExpiry === 999) {
        const dueDate = new Date(inst.calibrationDueDate)
        const diffTime = dueDate.getTime() - today.getTime()
        daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
      }

      return {
        ...inst,
        status: instrumentStatus,
        daysUntilExpiry,
        rangeData: safeJsonParse<unknown[]>(inst.rangeData, []),
      }
    })

    // Get stats
    const stats = await getInstrumentStats()

    return NextResponse.json({
      instruments: instrumentsWithStatus,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats,
    })
  } catch (error) {
    console.error('Error fetching instruments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch instruments' },
      { status: 500 }
    )
  }
}

// POST /api/admin/instruments - Create new instrument
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!canAccessAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()

    // Validate required fields
    if (!body.category || !body.description || !body.assetNumber) {
      return NextResponse.json(
        { error: 'Category, description, and asset number are required' },
        { status: 400 }
      )
    }

    // Check for duplicate asset number among latest versions
    const existing = await prisma.masterInstrument.findFirst({
      where: {
        assetNumber: body.assetNumber,
        isLatest: true,
      },
    })

    if (existing) {
      return NextResponse.json(
        { error: 'An instrument with this asset number already exists' },
        { status: 400 }
      )
    }

    // Generate a new instrumentId for this instrument
    const instrumentId = crypto.randomUUID()

    const instrument = await prisma.masterInstrument.create({
      data: {
        instrumentId, // Group ID for all versions
        version: 1,
        isLatest: true,
        category: body.category,
        description: body.description,
        make: body.make || '',
        model: body.model || '',
        assetNumber: body.assetNumber,
        serialNumber: body.serialNumber || '',
        usage: body.usage || null,
        calibratedAtLocation: body.calibratedAtLocation || null,
        reportNo: body.reportNo || null,
        calibrationDueDate: body.calibrationDueDate
          ? new Date(body.calibrationDueDate)
          : null,
        rangeData: body.rangeData ? body.rangeData : Prisma.DbNull,
        remarks: body.remarks || null,
        isActive: true,
        createdById: session!.user.id,
        changeReason: 'Manual creation',
      },
    })

    return NextResponse.json({
      success: true,
      instrument,
    })
  } catch (error) {
    console.error('Error creating instrument:', error)
    return NextResponse.json(
      { error: 'Failed to create instrument' },
      { status: 500 }
    )
  }
}

// Helper to get instrument statistics
async function getInstrumentStats() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)
  const thirtyDaysFromNow = new Date(today)
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const [total, expired, expiring, valid, underRecal] = await Promise.all([
    prisma.masterInstrument.count({ where: { isActive: true, isLatest: true } }),
    prisma.masterInstrument.count({
      where: {
        isActive: true,
        isLatest: true,
        calibrationDueDate: { lt: today },
      },
    }),
    prisma.masterInstrument.count({
      where: {
        isActive: true,
        isLatest: true,
        calibrationDueDate: { gte: today, lte: thirtyDaysFromNow },
      },
    }),
    prisma.masterInstrument.count({
      where: {
        isActive: true,
        isLatest: true,
        calibrationDueDate: { gt: thirtyDaysFromNow },
      },
    }),
    prisma.masterInstrument.count({
      where: {
        isActive: true,
        isLatest: true,
        status: 'UNDER_RECAL',
      },
    }),
  ])

  return {
    total,
    expired,
    expiring,
    valid,
    underRecal,
  }
}
