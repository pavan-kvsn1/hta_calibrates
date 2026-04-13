import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

const logger = createLogger('customer')

/**
 * GET /api/customer/download/[token]
 *
 * Validate a download token and return certificate information.
 * No authentication required - token-based access.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Find the download token
    const downloadToken = await prisma.downloadToken.findUnique({
      where: { token },
      include: {
        certificate: {
          select: {
            id: true,
            certificateNumber: true,
            status: true,
            uucDescription: true,
            uucMake: true,
            uucModel: true,
            uucSerialNumber: true,
            dateOfCalibration: true,
            calibrationDueDate: true,
            customerName: true,
            signedPdfPath: true,
          },
        },
      },
    })

    if (!downloadToken) {
      return NextResponse.json(
        { error: 'Invalid or expired download link' },
        { status: 404 }
      )
    }

    // Check if token is expired
    if (new Date() > downloadToken.expiresAt) {
      return NextResponse.json(
        { error: 'This download link has expired' },
        { status: 410 }
      )
    }

    // Check if downloads exhausted
    if (downloadToken.downloadCount >= downloadToken.maxDownloads) {
      return NextResponse.json(
        { error: 'Maximum download limit reached for this link' },
        { status: 410 }
      )
    }

    // Log access
    const ipAddress = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const userAgent = request.headers.get('user-agent') || undefined

    await prisma.tokenAccessLog.create({
      data: {
        tokenType: 'DOWNLOAD',
        tokenId: downloadToken.id,
        action: 'VIEWED',
        ipAddress,
        userAgent,
      },
    })

    const certificate = downloadToken.certificate

    return NextResponse.json({
      valid: true,
      certificate: {
        certificateNumber: certificate.certificateNumber,
        instrumentDescription: certificate.uucDescription,
        make: certificate.uucMake,
        model: certificate.uucModel,
        serialNumber: certificate.uucSerialNumber,
        calibrationDate: certificate.dateOfCalibration
          ? new Date(certificate.dateOfCalibration).toISOString()
          : null,
        calibrationDueDate: certificate.calibrationDueDate
          ? new Date(certificate.calibrationDueDate).toISOString()
          : null,
        customerName: certificate.customerName,
        hasPdf: !!certificate.signedPdfPath,
      },
      download: {
        customerName: downloadToken.customerName,
        customerEmail: downloadToken.customerEmail,
        downloadCount: downloadToken.downloadCount,
        maxDownloads: downloadToken.maxDownloads,
        remainingDownloads: downloadToken.maxDownloads - downloadToken.downloadCount,
        expiresAt: downloadToken.expiresAt.toISOString(),
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to validate download token')
    return NextResponse.json(
      { error: 'Failed to validate download link' },
      { status: 500 }
    )
  }
}
