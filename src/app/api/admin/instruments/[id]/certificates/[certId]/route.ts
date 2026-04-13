import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getStorageProvider, assetNumberToFileName } from '@/lib/storage'
import * as fs from 'fs'
import * as path from 'path'
import { createLogger } from '@/lib/logger'

const logger = createLogger('instruments')

/**
 * GET /api/admin/instruments/[id]/certificates/[certId]
 * Download a specific certificate
 * Access: Engineer, Admin, Customer (view)
 */
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; certId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, certId } = await params

    // Fetch certificate record
    const certificate = await prisma.masterInstrumentCertificate.findFirst({
      where: {
        id: certId,
        masterInstrumentId: id,
        isActive: true,
      },
      include: {
        masterInstrument: {
          select: { assetNumber: true, description: true },
        },
      },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Check query params
    const { searchParams } = new URL(request.url)
    const metadataOnly = searchParams.get('metadata') === 'true'
    const forceDownload = searchParams.get('download') === 'true'

    if (metadataOnly) {
      return NextResponse.json({ certificate })
    }

    // Get download URL or stream file
    const storage = getStorageProvider()
    const storageType = process.env.CERTIFICATE_STORAGE_TYPE || 'local'

    // Check if file exists in storage
    let exists = await storage.exists(certificate.storagePath)
    let buffer: Buffer | null = null

    if (exists) {
      // File found in storage
      if (storageType === 'gcs') {
        // Return signed URL for direct download
        const signedUrl = await storage.getSignedUrl(certificate.storagePath, {
          expiresInMinutes: 15,
        })
        return NextResponse.redirect(signedUrl)
      }
      buffer = await storage.download(certificate.storagePath)
    } else {
      // Fallback: Check reference_docs/certificate_pdfs folder using asset number from instrument
      const fileName = assetNumberToFileName(certificate.masterInstrument.assetNumber)
      const fallbackPath = path.join(process.cwd(), 'reference_docs', 'certificate_pdfs', fileName)

      if (fs.existsSync(fallbackPath)) {
        buffer = fs.readFileSync(fallbackPath)
      }
    }

    if (!buffer) {
      return NextResponse.json(
        { error: 'Certificate file not found in storage' },
        { status: 404 }
      )
    }

    // Use 'inline' for viewing in browser, 'attachment' for download
    const disposition = forceDownload ? 'attachment' : 'inline'

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': certificate.mimeType,
        'Content-Disposition': `${disposition}; filename="${certificate.fileName}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Error downloading certificate')
    return NextResponse.json(
      { error: 'Failed to download certificate' },
      { status: 500 }
    )
  }
}

/**
 * DELETE /api/admin/instruments/[id]/certificates/[certId]
 * Soft delete a certificate (mark as inactive)
 * Access: Admin only
 */
export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; certId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Check if user is admin
    if (!session.user.isAdmin) {
      return NextResponse.json(
        { error: 'Only administrators can delete certificates' },
        { status: 403 }
      )
    }

    const { id, certId } = await params

    // Fetch certificate record
    const certificate = await prisma.masterInstrumentCertificate.findFirst({
      where: {
        id: certId,
        masterInstrumentId: id,
      },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Soft delete (mark as inactive)
    await prisma.masterInstrumentCertificate.update({
      where: { id: certId },
      data: { isActive: false, isLatest: false },
    })

    // If this was the latest, promote the next most recent active certificate
    if (certificate.isLatest) {
      const nextLatest = await prisma.masterInstrumentCertificate.findFirst({
        where: {
          masterInstrumentId: id,
          isActive: true,
          id: { not: certId },
        },
        orderBy: { uploadedAt: 'desc' },
      })

      if (nextLatest) {
        await prisma.masterInstrumentCertificate.update({
          where: { id: nextLatest.id },
          data: { isLatest: true },
        })
      }
    }

    return NextResponse.json({
      success: true,
      message: 'Certificate deleted successfully',
    })
  } catch (error) {
    logger.error({ err: error }, 'Error deleting certificate')
    return NextResponse.json(
      { error: 'Failed to delete certificate' },
      { status: 500 }
    )
  }
}
