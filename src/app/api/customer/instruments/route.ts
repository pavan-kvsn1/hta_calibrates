import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logger'

const logger = createLogger('customer')

// GET /api/customer/instruments - List instruments used in customer's authorized certificates
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user.customerAccountId) {
      return NextResponse.json({ error: 'No customer account found' }, { status: 400 })
    }

    const { searchParams } = new URL(request.url)
    const search = searchParams.get('search')
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')

    // Get the customer account to find the company name
    const customerAccount = await prisma.customerAccount.findUnique({
      where: { id: session.user.customerAccountId },
      select: { companyName: true },
    })

    if (!customerAccount) {
      return NextResponse.json({ error: 'Customer account not found' }, { status: 404 })
    }

    // Build where clause for master instruments used in authorized certificates for this customer
    const certificateInstrumentWhere: Record<string, unknown> = {
      certificate: {
        status: 'AUTHORIZED',
        customerName: customerAccount.companyName,
      },
    }

    // Search filter
    if (search) {
      certificateInstrumentWhere.OR = [
        { description: { contains: search, mode: 'insensitive' } },
        { make: { contains: search, mode: 'insensitive' } },
        { model: { contains: search, mode: 'insensitive' } },
        { assetNo: { contains: search, mode: 'insensitive' } },
        { serialNumber: { contains: search, mode: 'insensitive' } },
      ]
    }

    // Get all certificate master instruments for this customer's authorized certificates
    const certificateInstruments = await prisma.certificateMasterInstrument.findMany({
      where: certificateInstrumentWhere,
      include: {
        certificate: {
          select: {
            id: true,
            certificateNumber: true,
            uucDescription: true,
            dateOfCalibration: true,
            status: true,
          },
        },
      },
      orderBy: [
        { description: 'asc' },
        { make: 'asc' },
      ],
    })

    // Group by masterInstrumentId to get unique instruments with their certificate usage
    const instrumentMap = new Map<string, {
      masterInstrumentId: string
      category: string | null
      description: string | null
      make: string | null
      model: string | null
      assetNo: string | null
      serialNumber: string | null
      calibratedAt: string | null
      reportNo: string | null
      calibrationDueDate: string | null
      sopReference: string
      certificates: Array<{
        id: string
        certificateNumber: string
        uucDescription: string | null
        dateOfCalibration: Date | null
      }>
    }>()

    for (const ci of certificateInstruments) {
      const key = ci.masterInstrumentId
      if (!instrumentMap.has(key)) {
        instrumentMap.set(key, {
          masterInstrumentId: ci.masterInstrumentId,
          category: ci.category,
          description: ci.description,
          make: ci.make,
          model: ci.model,
          assetNo: ci.assetNo,
          serialNumber: ci.serialNumber,
          calibratedAt: ci.calibratedAt,
          reportNo: ci.reportNo,
          calibrationDueDate: ci.calibrationDueDate,
          sopReference: ci.sopReference,
          certificates: [],
        })
      }
      const inst = instrumentMap.get(key)!
      // Add certificate if not already in list
      if (!inst.certificates.find(c => c.id === ci.certificate.id)) {
        inst.certificates.push({
          id: ci.certificate.id,
          certificateNumber: ci.certificate.certificateNumber,
          uucDescription: ci.certificate.uucDescription,
          dateOfCalibration: ci.certificate.dateOfCalibration,
        })
      }
    }

    // Convert to array and apply pagination
    const allInstruments = Array.from(instrumentMap.values())
    const total = allInstruments.length
    const paginatedInstruments = allInstruments.slice((page - 1) * limit, page * limit)

    // Get stats
    const totalAuthorizedCertificates = await prisma.certificate.count({
      where: {
        status: 'AUTHORIZED',
        customerName: customerAccount.companyName,
      },
    })

    return NextResponse.json({
      instruments: paginatedInstruments,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit),
      },
      stats: {
        totalInstruments: total,
        totalAuthorizedCertificates,
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Error fetching customer instruments')
    return NextResponse.json(
      { error: 'Failed to fetch instruments' },
      { status: 500 }
    )
  }
}
