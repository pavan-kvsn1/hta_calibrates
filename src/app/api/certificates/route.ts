import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET - List certificates for the current user
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const certificates = await prisma.certificate.findMany({
      where: {
        createdById: session.user.id,
      },
      orderBy: { updatedAt: 'desc' },
    })

    return NextResponse.json(certificates)
  } catch (error) {
    console.error('Error fetching certificates:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}

// POST - Create a new certificate
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()
    const {
      certificateNumber,
      calibratedAt,
      srfNumber,
      srfDate,
      dateOfCalibration,
      calibrationTenure,
      dueDateAdjustment,
      calibrationDueDate,
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

    // Create certificate with event sourcing
    const certificate = await prisma.$transaction(async (tx) => {
      // Create the certificate (projection)
      const cert = await tx.certificate.create({
        data: {
          certificateNumber,
          status: 'DRAFT',
          currentRevision: 1,
          calibratedAt,
          srfNumber: srfNumber || null,
          srfDate: srfDate ? new Date(srfDate) : null,
          dateOfCalibration: dateOfCalibration ? new Date(dateOfCalibration) : null,
          calibrationTenure: calibrationTenure || 12,
          dueDateAdjustment: dueDateAdjustment || 0,
          calibrationDueDate: calibrationDueDate ? new Date(calibrationDueDate) : null,
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
          createdById: session.user.id,
          lastModifiedById: session.user.id,
        },
      })

      // Create parameters and results
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
              bins: param.bins ? JSON.stringify(param.bins) : null,
              sopReference: param.sopReference || null,
              masterInstrumentId: param.masterInstrumentId ? String(param.masterInstrumentId) : null,
              sortOrder: i,
            },
          })

          // Create calibration results for this parameter
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

      // Create initial event
      await tx.certificateEvent.create({
        data: {
          certificateId: cert.id,
          sequenceNumber: 1,
          revision: 1,
          eventType: 'CERTIFICATE_CREATED',
          eventData: JSON.stringify({
            certificateNumber,
            initialData: {
              customerName,
              uucDescription,
              dateOfCalibration,
            },
          }),
          userId: session.user.id,
          userRole: session.user.role,
        },
      })

      // Create audit log
      await tx.auditLog.create({
        data: {
          entityType: 'Certificate',
          entityId: cert.id,
          action: 'CREATE',
          actorId: session.user.id,
          actorType: 'USER',
          changes: JSON.stringify({ certificateNumber }),
        },
      })

      return cert
    })

    return NextResponse.json({
      success: true,
      certificate: {
        id: certificate.id,
        certificateNumber: certificate.certificateNumber,
      },
    })
  } catch (error) {
    console.error('Error creating certificate:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
