import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import crypto from 'crypto'
import { enqueue } from '@/lib/services/queue'
import { certificateLogger as logger } from '@/lib/logger'

/**
 * POST /api/admin/certificates/[id]/send-download-link
 *
 * Send a download link to a customer for a finalized certificate.
 * Only admins can send download links.
 * Only certificates in COMPLETED status can have download links sent.
 */
export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only Admin can send download links
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id: certificateId } = await params
    const { customerEmail, customerName, ccAdmin } = await request.json()

    if (!customerEmail?.trim()) {
      return NextResponse.json(
        { error: 'Customer email is required' },
        { status: 400 }
      )
    }

    if (!customerName?.trim()) {
      return NextResponse.json(
        { error: 'Customer name is required' },
        { status: 400 }
      )
    }

    // Get the certificate
    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
    })

    if (!certificate) {
      return NextResponse.json(
        { error: 'Certificate not found' },
        { status: 404 }
      )
    }

    // Verify certificate is completed/authorized
    if (certificate.status !== 'COMPLETED') {
      return NextResponse.json(
        { error: 'Certificate must be completed and authorized before sending download link' },
        { status: 400 }
      )
    }

    // Verify signed PDF exists
    if (!certificate.signedPdfPath) {
      return NextResponse.json(
        { error: 'Signed PDF not available. Please generate the PDF first.' },
        { status: 400 }
      )
    }

    const now = new Date()
    const expiresAt = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000) // 7 days

    // Generate secure token
    const token = crypto.randomUUID()

    // Create download token
    const downloadToken = await prisma.downloadToken.create({
      data: {
        token,
        certificateId,
        customerEmail: customerEmail.toLowerCase().trim(),
        customerName: customerName.trim(),
        expiresAt,
        maxDownloads: 5,
        sentById: session.user.id,
      },
    })

    // Log event
    const lastEvent = await prisma.certificateEvent.findFirst({
      where: { certificateId },
      orderBy: { sequenceNumber: 'desc' },
    })

    await prisma.certificateEvent.create({
      data: {
        certificateId,
        sequenceNumber: (lastEvent?.sequenceNumber || 0) + 1,
        revision: certificate.currentRevision,
        eventType: 'DOWNLOAD_LINK_SENT',
        eventData: JSON.stringify({
          customerEmail: customerEmail.toLowerCase().trim(),
          customerName: customerName.trim(),
          tokenId: downloadToken.id,
          expiresAt: expiresAt.toISOString(),
          sentBy: session.user.name,
        }),
        userId: session.user.id,
        userRole: session.user.role,
      },
    })

    // Build download URL
    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
    const downloadUrl = `${baseUrl}/customer/download/${token}`

    // Send email to customer
    const recipients = [customerEmail.toLowerCase().trim()]
    if (ccAdmin && session.user.email) {
      recipients.push(session.user.email)
    }

    await enqueue('email:send', {
      to: recipients,
      template: 'certificate-download-ready',
      templateData: {
        customerName: customerName.trim(),
        certificateNumber: certificate.certificateNumber,
        instrumentDescription: certificate.uucDescription || 'Calibration Certificate',
        serialNumber: certificate.uucSerialNumber || '',
        calibrationDate: certificate.dateOfCalibration
          ? new Date(certificate.dateOfCalibration).toLocaleDateString('en-US', {
              year: 'numeric',
              month: 'long',
              day: 'numeric',
            })
          : '',
        downloadUrl,
      },
    })

    return NextResponse.json({
      success: true,
      token: downloadToken.token,
      tokenExpiry: downloadToken.expiresAt.toISOString(),
      downloadUrl,
      maxDownloads: downloadToken.maxDownloads,
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to send download link')
    return NextResponse.json(
      { error: 'Failed to send download link' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/admin/certificates/[id]/send-download-link
 *
 * Get download link history for a certificate.
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: certificateId } = await params

    // Get all download tokens for this certificate
    const tokens = await prisma.downloadToken.findMany({
      where: { certificateId },
      orderBy: { createdAt: 'desc' },
      include: {
        sentBy: {
          select: { name: true, email: true },
        },
      },
    })

    const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

    return NextResponse.json({
      tokens: tokens.map((t) => ({
        id: t.id,
        customerEmail: t.customerEmail,
        customerName: t.customerName,
        downloadUrl: `${baseUrl}/customer/download/${t.token}`,
        createdAt: t.createdAt.toISOString(),
        expiresAt: t.expiresAt.toISOString(),
        downloadCount: t.downloadCount,
        maxDownloads: t.maxDownloads,
        downloadedAt: t.downloadedAt?.toISOString() || null,
        isExpired: new Date() > t.expiresAt,
        isExhausted: t.downloadCount >= t.maxDownloads,
        sentBy: t.sentBy?.name || 'Unknown',
      })),
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to get download links')
    return NextResponse.json(
      { error: 'Failed to get download links' },
      { status: 500 }
    )
  }
}
