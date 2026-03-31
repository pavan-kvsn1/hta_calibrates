import { NextRequest, NextResponse } from 'next/server'
import { Prisma } from '@prisma/client'
import { prisma } from '@/lib/prisma'
import { auth, canAccessAdmin } from '@/lib/auth'
import { safeJsonParse } from '@/lib/utils/safe-json'

// GET /api/admin/instruments/[id] - Get single instrument
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

    const instrument = await prisma.masterInstrument.findUnique({
      where: { id },
      include: {
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!instrument) {
      return NextResponse.json({ error: 'Instrument not found' }, { status: 404 })
    }

    // Calculate status
    const today = new Date()
    today.setHours(0, 0, 0, 0)
    let computedStatus = 'VALID'
    let daysUntilExpiry = 999

    if (instrument.calibrationDueDate) {
      const dueDate = new Date(instrument.calibrationDueDate)
      const diffTime = dueDate.getTime() - today.getTime()
      daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (daysUntilExpiry < 0) {
        computedStatus = 'EXPIRED'
      } else if (daysUntilExpiry <= 30) {
        computedStatus = 'EXPIRING_SOON'
      }
    }

    // Use explicit status if set, otherwise use computed status
    const status = instrument.status || computedStatus

    return NextResponse.json({
      ...instrument,
      status,
      computedStatus, // Include computed status for reference
      daysUntilExpiry,
      rangeData: safeJsonParse<unknown[]>(instrument.rangeData, []),
    })
  } catch (error) {
    console.error('Error fetching instrument:', error)
    return NextResponse.json(
      { error: 'Failed to fetch instrument' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/instruments/[id] - Update instrument (creates a new version)
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

    // Check if instrument exists
    const existing = await prisma.masterInstrument.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Instrument not found' }, { status: 404 })
    }

    // Check for duplicate asset number if changing it (only among latest versions)
    if (body.assetNumber && body.assetNumber !== existing.assetNumber) {
      const duplicate = await prisma.masterInstrument.findFirst({
        where: {
          assetNumber: body.assetNumber,
          isLatest: true,
          NOT: { instrumentId: existing.instrumentId },
        },
      })
      if (duplicate) {
        return NextResponse.json(
          { error: 'An instrument with this asset number already exists' },
          { status: 400 }
        )
      }
    }

    // Create new version in a transaction
    const newVersion = await prisma.$transaction(async (tx) => {
      // Mark old version as not latest
      await tx.masterInstrument.update({
        where: { id },
        data: { isLatest: false },
      })

      // Create new version with updated data
      const newInstrument = await tx.masterInstrument.create({
        data: {
          instrumentId: existing.instrumentId,
          version: existing.version + 1,
          isLatest: true,
          category: body.category ?? existing.category,
          description: body.description ?? existing.description,
          make: body.make ?? existing.make,
          model: body.model ?? existing.model,
          assetNumber: body.assetNumber ?? existing.assetNumber,
          serialNumber: body.serialNumber ?? existing.serialNumber,
          usage: body.usage !== undefined ? (body.usage || null) : existing.usage,
          calibratedAtLocation: body.calibratedAtLocation !== undefined ? (body.calibratedAtLocation || null) : existing.calibratedAtLocation,
          reportNo: body.reportNo !== undefined ? (body.reportNo || null) : existing.reportNo,
          calibrationDueDate: body.calibrationDueDate !== undefined
            ? (body.calibrationDueDate ? new Date(body.calibrationDueDate) : null)
            : existing.calibrationDueDate,
          rangeData: body.rangeData !== undefined
            ? (body.rangeData ? body.rangeData : Prisma.DbNull)
            : (existing.rangeData ?? Prisma.DbNull),
          remarks: body.remarks !== undefined ? (body.remarks || null) : existing.remarks,
          status: body.status !== undefined ? (body.status || null) : existing.status,
          isActive: body.isActive !== undefined ? body.isActive : existing.isActive,
          createdById: session!.user.id,
          changeReason: body.changeReason || 'Manual update',
          legacyId: existing.legacyId,
          importedFromJson: existing.importedFromJson,
        },
      })

      return newInstrument
    })

    return NextResponse.json({
      success: true,
      instrument: newVersion,
    })
  } catch (error) {
    console.error('Error updating instrument:', error)
    return NextResponse.json(
      { error: 'Failed to update instrument' },
      { status: 500 }
    )
  }
}

// DELETE /api/admin/instruments/[id] - Soft delete instrument (creates a deactivated version)
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

    const existing = await prisma.masterInstrument.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Instrument not found' }, { status: 404 })
    }

    // Create a deactivated version in a transaction
    await prisma.$transaction(async (tx) => {
      // Mark old version as not latest
      await tx.masterInstrument.update({
        where: { id },
        data: { isLatest: false },
      })

      // Create new deactivated version
      await tx.masterInstrument.create({
        data: {
          instrumentId: existing.instrumentId,
          version: existing.version + 1,
          isLatest: true,
          category: existing.category,
          description: existing.description,
          make: existing.make,
          model: existing.model,
          assetNumber: existing.assetNumber,
          serialNumber: existing.serialNumber,
          usage: existing.usage,
          calibratedAtLocation: existing.calibratedAtLocation,
          reportNo: existing.reportNo,
          calibrationDueDate: existing.calibrationDueDate,
          rangeData: existing.rangeData ?? Prisma.DbNull,
          remarks: existing.remarks,
          isActive: false,
          createdById: session!.user.id,
          changeReason: 'Deactivated',
          legacyId: existing.legacyId,
          importedFromJson: existing.importedFromJson,
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: 'Instrument deactivated successfully',
    })
  } catch (error) {
    console.error('Error deleting instrument:', error)
    return NextResponse.json(
      { error: 'Failed to delete instrument' },
      { status: 500 }
    )
  }
}
