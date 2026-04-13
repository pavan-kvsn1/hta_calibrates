import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getStorageProvider, assetNumberToFileName } from '@/lib/storage'
import * as fs from 'fs'
import * as path from 'path'
import { createLogger } from '@/lib/logger'

const logger = createLogger('instruments')

/**
 * GET /api/admin/instruments/[id]/certificates/latest
 * Get the latest certificate for a master instrument
 * Falls back to reference_docs folder if no certificate record exists
 * Access: Engineer, Admin, Customer (view)
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

    const { id } = await params

    // Check query params
    const { searchParams } = new URL(request.url)
    const download = searchParams.get('download') === 'true'
    const forceDownload = searchParams.get('forceDownload') === 'true'
    const metadataOnly = searchParams.get('metadata') === 'true'

    // Fetch latest certificate record
    const certificate = await prisma.masterInstrumentCertificate.findFirst({
      where: {
        masterInstrumentId: id,
        isLatest: true,
        isActive: true,
      },
      include: {
        masterInstrument: {
          select: { assetNumber: true, description: true },
        },
        uploadedBy: {
          select: { id: true, name: true },
        },
      },
    })

    // If certificate record exists, try to serve it
    if (certificate) {
      // Return metadata only
      if (metadataOnly) {
        return NextResponse.json({ certificate })
      }

      if (!download) {
        return NextResponse.json({ certificate })
      }

      // Try to download the file
      const storage = getStorageProvider()
      const storageType = process.env.CERTIFICATE_STORAGE_TYPE || 'local'
      let buffer: Buffer | null = null

      const exists = await storage.exists(certificate.storagePath)
      if (exists) {
        if (storageType === 'gcs') {
          const signedUrl = await storage.getSignedUrl(certificate.storagePath, {
            expiresInMinutes: 15,
          })
          return NextResponse.redirect(signedUrl)
        }
        buffer = await storage.download(certificate.storagePath)
      } else {
        // Fallback to reference_docs/certificate_pdfs
        const fileName = assetNumberToFileName(certificate.masterInstrument.assetNumber)
        const fallbackPath = path.join(process.cwd(), 'reference_docs', 'certificate_pdfs', fileName)

        if (fs.existsSync(fallbackPath)) {
          buffer = fs.readFileSync(fallbackPath)
        }
      }

      if (buffer) {
        const disposition = forceDownload ? 'attachment' : 'inline'
        return new NextResponse(new Uint8Array(buffer), {
          headers: {
            'Content-Type': certificate.mimeType,
            'Content-Disposition': `${disposition}; filename="${certificate.fileName}"`,
            'Content-Length': buffer.length.toString(),
          },
        })
      }
    }

    // No certificate record - try to serve directly from reference_docs
    const instrument = await prisma.masterInstrument.findUnique({
      where: { id },
      select: { assetNumber: true, description: true },
    })

    if (!instrument) {
      return NextResponse.json({ error: 'Instrument not found' }, { status: 404 })
    }

    const fileName = assetNumberToFileName(instrument.assetNumber)
    const filePath = path.join(process.cwd(), 'reference_docs', 'certificate_pdfs', fileName)

    if (!fs.existsSync(filePath)) {
      return NextResponse.json(
        { error: `No certificate found for this instrument (looked for ${fileName})` },
        { status: 404 }
      )
    }

    // Return metadata if requested
    if (metadataOnly) {
      const stats = fs.statSync(filePath)
      return NextResponse.json({
        certificate: {
          id: 'reference-doc',
          fileName,
          fileSize: stats.size,
          mimeType: 'application/pdf',
          isLatest: true,
          source: 'reference_docs',
          masterInstrument: instrument,
        },
      })
    }

    // Serve the file
    const buffer = fs.readFileSync(filePath)
    const disposition = forceDownload ? 'attachment' : 'inline'

    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `${disposition}; filename="${fileName}"`,
        'Content-Length': buffer.length.toString(),
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Error fetching latest certificate')
    return NextResponse.json(
      { error: 'Failed to fetch latest certificate' },
      { status: 500 }
    )
  }
}
