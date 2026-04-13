import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { safeJsonParse } from '@/lib/utils/safe-json'
import { createLogger } from '@/lib/logger'

const logger = createLogger('customer')

// GET /api/customer/instruments/[id] - Get instrument details with customer's certificates
export async function GET(
  _request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user.customerAccountId) {
      return NextResponse.json({ error: 'No customer account found' }, { status: 400 })
    }

    const { id } = await params

    // Get the customer account to find the company name
    const customerAccount = await prisma.customerAccount.findUnique({
      where: { id: session.user.customerAccountId },
      select: { companyName: true },
    })

    if (!customerAccount) {
      return NextResponse.json({ error: 'Customer account not found' }, { status: 404 })
    }

    // First, get the master instrument from the database
    const masterInstrument = await prisma.masterInstrument.findFirst({
      where: {
        id,
        isLatest: true,
      },
    })

    if (!masterInstrument) {
      return NextResponse.json(
        { error: 'Instrument not found' },
        { status: 404 }
      )
    }

    // Get all certificates that use this master instrument for this customer
    const certificateInstruments = await prisma.certificateMasterInstrument.findMany({
      where: {
        masterInstrumentId: id,
        certificate: {
          status: 'AUTHORIZED',
          customerName: customerAccount.companyName,
        },
      },
      include: {
        certificate: {
          select: {
            id: true,
            certificateNumber: true,
            uucDescription: true,
            uucMake: true,
            uucModel: true,
            uucSerialNumber: true,
            dateOfCalibration: true,
            calibrationDueDate: true,
            createdAt: true,
          },
        },
        parameter: {
          select: {
            id: true,
            parameterName: true,
            parameterUnit: true,
          },
        },
      },
      orderBy: {
        certificate: {
          createdAt: 'desc',
        },
      },
    })

    // Verify the customer has access to this instrument (used in at least one of their certificates)
    if (certificateInstruments.length === 0) {
      return NextResponse.json(
        { error: 'Instrument not found in your certificates' },
        { status: 404 }
      )
    }

    // Compute status based on calibration due date
    let instrumentStatus = 'VALID'
    let daysUntilExpiry = 999
    const today = new Date()
    today.setHours(0, 0, 0, 0)

    if (masterInstrument.status) {
      instrumentStatus = masterInstrument.status
    } else if (masterInstrument.calibrationDueDate) {
      const dueDate = new Date(masterInstrument.calibrationDueDate)
      const diffTime = dueDate.getTime() - today.getTime()
      daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24))

      if (daysUntilExpiry < 0) {
        instrumentStatus = 'EXPIRED'
      } else if (daysUntilExpiry <= 30) {
        instrumentStatus = 'EXPIRING_SOON'
      }
    }

    if (masterInstrument.calibrationDueDate && daysUntilExpiry === 999) {
      const dueDate = new Date(masterInstrument.calibrationDueDate)
      const diffTime = dueDate.getTime() - today.getTime()
      daysUntilExpiry = Math.ceil(diffTime / (1000 * 60 * 60 * 24))
    }

    return NextResponse.json({
      instrument: {
        ...masterInstrument,
        status: instrumentStatus,
        daysUntilExpiry,
        rangeData: safeJsonParse<unknown[]>(masterInstrument.rangeData, []),
      },
      certificates: certificateInstruments.map(ci => ({
        id: ci.certificate.id,
        certificateNumber: ci.certificate.certificateNumber,
        uucDescription: ci.certificate.uucDescription,
        uucMake: ci.certificate.uucMake,
        uucModel: ci.certificate.uucModel,
        uucSerialNumber: ci.certificate.uucSerialNumber,
        dateOfCalibration: ci.certificate.dateOfCalibration,
        calibrationDueDate: ci.certificate.calibrationDueDate,
        createdAt: ci.certificate.createdAt,
        parameter: ci.parameter ? {
          id: ci.parameter.id,
          parameterName: ci.parameter.parameterName,
          parameterUnit: ci.parameter.parameterUnit,
        } : null,
        sopReference: ci.sopReference,
      })),
      totalCertificates: certificateInstruments.length,
    })
  } catch (error) {
    logger.error({ err: error }, 'Error fetching customer instrument')
    return NextResponse.json(
      { error: 'Failed to fetch instrument' },
      { status: 500 }
    )
  }
}
