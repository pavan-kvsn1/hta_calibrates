import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface RouteContext {
  params: Promise<{ id: string }>
}

// GET - Get a single certificate
export async function GET(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    const certificate = await prisma.certificate.findUnique({
      where: { id },
      include: {
        parameters: {
          include: {
            results: {
              orderBy: { pointNumber: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        masterInstruments: true, // Details are now stored directly, no FK relation needed
        createdBy: {
          select: { id: true, name: true, email: true },
        },
        feedbacks: {
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { name: true, role: true },
            },
          },
        },
        events: {
          where: { eventType: 'HOD_DATE_OVERRIDE' },
          orderBy: { createdAt: 'desc' },
          include: {
            user: {
              select: { name: true, role: true },
            },
          },
        },
      },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Check if user has access
    if (certificate.createdById !== session.user.id &&
        session.user.role !== 'HOD' &&
        session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    return NextResponse.json(certificate)
  } catch (error) {
    console.error('Error fetching certificate:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// PUT - Update a certificate (save draft)
export async function PUT(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params
    const body = await request.json()

    // Get existing certificate
    const existingCert = await prisma.certificate.findUnique({
      where: { id },
      include: {
        parameters: {
          include: { results: true },
        },
      },
    })

    if (!existingCert) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Check ownership
    if (existingCert.createdById !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if certificate can be edited
    if (existingCert.status === 'APPROVED' || existingCert.status === 'REJECTED') {
      return NextResponse.json(
        { error: 'Cannot edit finalized certificate' },
        { status: 400 }
      )
    }

    const {
      calibratedAt,
      srfNumber,
      srfDate,
      dateOfCalibration,
      calibrationTenure,
      dueDateAdjustment,
      calibrationDueDate,
      dueDateNotApplicable,
      customerName,
      customerAddress,
      uucDescription,
      uucMake,
      uucModel,
      uucSerialNumber,
      uucInstrumentId,
      uucLocationName,
      uucMachineName,
      ambientTemperature,
      relativeHumidity,
      calibrationStatus,
      stickerOldRemoved,
      stickerNewAffixed,
      statusNotes,
      selectedConclusionStatements,
      parameters,
      masterInstruments,
    } = body

    // Update certificate with event
    const certificate = await prisma.$transaction(async (tx) => {
      // Get next event sequence
      const lastEvent = await tx.certificateEvent.findFirst({
        where: { certificateId: id },
        orderBy: { sequenceNumber: 'desc' },
      })
      const nextSequence = (lastEvent?.sequenceNumber ?? 0) + 1

      // Update the certificate
      const cert = await tx.certificate.update({
        where: { id },
        data: {
          calibratedAt,
          srfNumber: srfNumber || null,
          srfDate: srfDate ? new Date(srfDate) : null,
          dateOfCalibration: dateOfCalibration ? new Date(dateOfCalibration) : null,
          calibrationTenure: calibrationTenure || 12,
          dueDateAdjustment: dueDateAdjustment || 0,
          calibrationDueDate: calibrationDueDate ? new Date(calibrationDueDate) : null,
          dueDateNotApplicable: dueDateNotApplicable || false,
          customerName,
          customerAddress,
          uucDescription,
          uucMake,
          uucModel,
          uucSerialNumber,
          uucInstrumentId: uucInstrumentId || null,
          uucLocationName: uucLocationName || null,
          uucMachineName: uucMachineName || null,
          ambientTemperature: ambientTemperature || null,
          relativeHumidity: relativeHumidity || null,
          calibrationStatus: JSON.stringify(calibrationStatus || []),
          stickerOldRemoved: stickerOldRemoved || null,
          stickerNewAffixed: stickerNewAffixed || null,
          statusNotes: statusNotes || null,
          selectedConclusionStatements: JSON.stringify(selectedConclusionStatements || []),
          lastModifiedById: session.user.id,
        },
      })

      // Delete existing parameters and results (will recreate)
      await tx.calibrationResult.deleteMany({
        where: {
          parameter: {
            certificateId: id,
          },
        },
      })
      await tx.parameter.deleteMany({
        where: { certificateId: id },
      })

      // Delete existing master instrument links (will recreate)
      await tx.certificateMasterInstrument.deleteMany({
        where: { certificateId: id },
      })

      // Create new parameters and results
      if (parameters && parameters.length > 0) {
        for (let i = 0; i < parameters.length; i++) {
          const param = parameters[i]
          const createdParam = await tx.parameter.create({
            data: {
              certificateId: cert.id,
              parameterName: param.parameterName,
              parameterUnit: param.parameterUnit,
              rangeMin: param.rangeMin || null,
              rangeMax: param.rangeMax || null,
              rangeUnit: param.rangeUnit || null,
              operatingMin: param.operatingMin || null,
              operatingMax: param.operatingMax || null,
              operatingUnit: param.operatingUnit || null,
              leastCountValue: param.leastCountValue || null,
              leastCountUnit: param.leastCountUnit || null,
              accuracyValue: param.accuracyValue || null,
              accuracyUnit: param.accuracyUnit || null,
              accuracyType: param.accuracyType || 'ABSOLUTE',
              errorFormula: param.errorFormula || 'A-B',
              showAfterAdjustment: param.showAfterAdjustment || false,
              requiresBinning: param.requiresBinning || false,
              bins: param.bins && Array.isArray(param.bins) && param.bins.length > 0 ? JSON.stringify(param.bins) : null,
              sopReference: param.sopReference || null,
              masterInstrumentId: param.masterInstrumentId ? String(param.masterInstrumentId) : null,
              sortOrder: i,
            },
          })

          // Create calibration results
          if (param.results && param.results.length > 0) {
            await tx.calibrationResult.createMany({
              data: param.results.map((result: {
                pointNumber: number
                standardReading: string
                beforeAdjustment: string
                afterAdjustment: string
                errorObserved: number | null
                isOutOfLimit: boolean
              }) => ({
                parameterId: createdParam.id,
                pointNumber: result.pointNumber,
                standardReading: result.standardReading || null,
                beforeAdjustment: result.beforeAdjustment || null,
                afterAdjustment: result.afterAdjustment || null,
                errorObserved: result.errorObserved,
                isOutOfLimit: result.isOutOfLimit || false,
              })),
            })
          }
        }
      }

      // Create master instrument links with full details snapshot
      if (masterInstruments && masterInstruments.length > 0) {
        for (const mi of masterInstruments) {
          // Only save if a master instrument was actually selected
          if (mi.masterInstrumentId && mi.masterInstrumentId > 0) {
            await tx.certificateMasterInstrument.create({
              data: {
                certificateId: cert.id,
                masterInstrumentId: String(mi.masterInstrumentId),
                category: mi.category || null,
                description: mi.description || null,
                make: mi.make || null,
                model: mi.model || null,
                assetNo: mi.assetNo || null,
                serialNumber: mi.serialNumber || null,
                calibratedAt: mi.calibratedAt || null,
                reportNo: mi.reportNo || null,
                calibrationDueDate: mi.calibrationDueDate || null,
                sopReference: mi.sopReference || '',
              },
            })
          }
        }
      }

      // Create event for the update
      await tx.certificateEvent.create({
        data: {
          certificateId: id,
          sequenceNumber: nextSequence,
          revision: cert.currentRevision,
          eventType: 'BULK_FIELDS_UPDATED',
          eventData: JSON.stringify({
            note: 'Draft saved',
            fieldsUpdated: Object.keys(body).length,
          }),
          userId: session.user.id,
          userRole: session.user.role,
        },
      })

      return cert
    })

    return NextResponse.json({
      success: true,
      certificate: {
        id: certificate.id,
        certificateNumber: certificate.certificateNumber,
        updatedAt: certificate.updatedAt,
      },
    })
  } catch (error) {
    console.error('Error updating certificate:', error)
    // Return more specific error message for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to update certificate: ${errorMessage}` },
      { status: 500 }
    )
  }
}
