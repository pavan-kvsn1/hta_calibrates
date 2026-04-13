import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

const logger = createLogger('customer-data-export')

interface UserDataExport {
  exportDate: string
  exportVersion: string
  user: {
    email: string
    name: string
    companyName: string | null
    createdAt: string
  }
  certificates: Array<{
    certificateNumber: string
    uucDescription: string | null
    uucMake: string | null
    uucModel: string | null
    uucSerialNumber: string | null
    dateOfCalibration: string | null
    calibrationDueDate: string | null
    status: string
    createdAt: string
  }>
  signatures: Array<{
    certificateNumber: string
    signedAt: string
    signerName: string
  }>
}

export async function GET() {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const customerEmail = session.user.email!

    // Get customer details
    const customer = await prisma.customerUser.findUnique({
      where: { email: customerEmail },
      include: { customerAccount: true },
    })

    if (!customer) {
      return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
    }

    const companyName = customer.customerAccount?.companyName || customer.companyName || ''
    const companyNameLower = companyName.toLowerCase()

    // Get all certificates for this customer's company
    const certificates = await prisma.certificate.findMany({
      where: {
        customerName: {
          equals: companyName,
          mode: 'insensitive',
        },
      },
      select: {
        certificateNumber: true,
        uucDescription: true,
        uucMake: true,
        uucModel: true,
        uucSerialNumber: true,
        dateOfCalibration: true,
        calibrationDueDate: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
    })

    // Get all signatures by this customer
    const signatures = await prisma.signature.findMany({
      where: {
        signerEmail: customerEmail,
        signerType: 'CUSTOMER',
      },
      include: {
        certificate: {
          select: { certificateNumber: true },
        },
      },
      orderBy: { signedAt: 'desc' },
    })

    // Build export data
    const exportData: UserDataExport = {
      exportDate: new Date().toISOString(),
      exportVersion: '1.0',
      user: {
        email: customer.email,
        name: customer.name,
        companyName: companyName || null,
        createdAt: customer.createdAt.toISOString(),
      },
      certificates: certificates.map((cert) => ({
        certificateNumber: cert.certificateNumber,
        uucDescription: cert.uucDescription,
        uucMake: cert.uucMake,
        uucModel: cert.uucModel,
        uucSerialNumber: cert.uucSerialNumber,
        dateOfCalibration: cert.dateOfCalibration?.toISOString() || null,
        calibrationDueDate: cert.calibrationDueDate?.toISOString() || null,
        status: cert.status,
        createdAt: cert.createdAt.toISOString(),
      })),
      signatures: signatures.map((sig) => ({
        certificateNumber: sig.certificate.certificateNumber,
        signedAt: sig.signedAt.toISOString(),
        signerName: sig.signerName,
      })),
    }

    logger.info(
      { email: customerEmail, certificateCount: certificates.length },
      'Customer data export generated'
    )

    // Return as downloadable JSON file
    const filename = `hta-calibr8s-data-export-${Date.now()}.json`

    return new NextResponse(JSON.stringify(exportData, null, 2), {
      status: 200,
      headers: {
        'Content-Type': 'application/json',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Cache-Control': 'no-store',
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to export customer data')
    return NextResponse.json(
      { error: 'Failed to export data' },
      { status: 500 }
    )
  }
}
