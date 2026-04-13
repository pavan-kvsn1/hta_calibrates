import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import path from 'path'
import { createLogger } from '@/lib/logger'

const logger = createLogger('customer')

/**
 * GET /api/customer/download/[token]/pdf
 *
 * Download the certificate PDF using a download token.
 * No authentication required - token-based access.
 * Increments download count and logs the download.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Find the download token with certificate
    const downloadToken = await prisma.downloadToken.findUnique({
      where: { token },
      include: {
        certificate: {
          select: {
            id: true,
            certificateNumber: true,
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

    const certificate = downloadToken.certificate

    // Check if PDF exists
    if (!certificate.signedPdfPath) {
      return NextResponse.json(
        { error: 'Certificate PDF not available' },
        { status: 404 }
      )
    }

    // Read the PDF file
    let pdfBuffer: Buffer
    try {
      // Handle both relative and absolute paths
      const pdfPath = certificate.signedPdfPath.startsWith('/')
        ? certificate.signedPdfPath
        : path.join(process.cwd(), certificate.signedPdfPath)

      pdfBuffer = await readFile(pdfPath)
    } catch (fileError) {
      logger.error({ err: fileError }, 'Error reading PDF file')
      return NextResponse.json(
        { error: 'Certificate PDF not found' },
        { status: 404 }
      )
    }

    // Log access and increment download count
    const ipAddress = request.headers.get('x-forwarded-for') ||
      request.headers.get('x-real-ip') ||
      'unknown'
    const userAgent = request.headers.get('user-agent') || undefined

    await prisma.$transaction([
      // Increment download count
      prisma.downloadToken.update({
        where: { id: downloadToken.id },
        data: {
          downloadCount: { increment: 1 },
          downloadedAt: downloadToken.downloadedAt || new Date(),
        },
      }),
      // Log the download
      prisma.tokenAccessLog.create({
        data: {
          tokenType: 'DOWNLOAD',
          tokenId: downloadToken.id,
          action: 'DOWNLOADED',
          ipAddress,
          userAgent,
        },
      }),
    ])

    // Generate filename
    const filename = `Certificate-${certificate.certificateNumber}.pdf`

    // Return the PDF (convert Buffer to Uint8Array for NextResponse)
    return new NextResponse(new Uint8Array(pdfBuffer), {
      status: 200,
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
        'Cache-Control': 'no-store, no-cache, must-revalidate',
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to download certificate PDF')
    return NextResponse.json(
      { error: 'Failed to download certificate' },
      { status: 500 }
    )
  }
}
