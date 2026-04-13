/**
 * Certificate Image File Download Route
 *
 * GET /api/certificates/[id]/images/[imageId]/file - Download the image file
 *
 * Query params:
 * - variant: 'original' | 'optimized' | 'thumbnail' (default: 'optimized')
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getImageStorageProvider } from '@/lib/storage'
import { certificateLogger as logger } from '@/lib/logger'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, imageId } = await params

    // Verify certificate exists and user has access
    const certificate = await prisma.certificate.findUnique({
      where: { id },
      select: { id: true, createdById: true, reviewerId: true },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Check access
    const isCreator = certificate.createdById === session.user.id
    const isReviewer = certificate.reviewerId === session.user.id
    const isAdmin = session.user.role === 'ADMIN'

    if (!isCreator && !isReviewer && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get image record
    const image = await prisma.certificateImage.findFirst({
      where: {
        id: imageId,
        certificateId: id,
      },
    })

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Determine which variant to serve
    const { searchParams } = new URL(request.url)
    const variant = searchParams.get('variant') || 'optimized'

    let storageKey: string
    let mimeType: string = image.mimeType

    switch (variant) {
      case 'thumbnail':
        if (image.thumbnailKey) {
          storageKey = image.thumbnailKey
          mimeType = 'image/jpeg' // Thumbnails are always JPEG
        } else {
          storageKey = image.storageKey // Fall back to original
        }
        break

      case 'optimized':
        if (image.optimizedKey) {
          storageKey = image.optimizedKey
          mimeType = 'image/jpeg' // Optimized are always JPEG
        } else {
          storageKey = image.storageKey // Fall back to original
        }
        break

      case 'original':
      default:
        storageKey = image.storageKey
        break
    }

    // Download from storage
    const storage = getImageStorageProvider()
    let buffer: Buffer

    try {
      buffer = await storage.download(storageKey)
    } catch (error) {
      logger.error({ err: error, storageKey }, 'Image file download error')
      return NextResponse.json({ error: 'File not found in storage' }, { status: 404 })
    }

    // Determine content disposition based on request
    const download = searchParams.get('download') === 'true'
    const contentDisposition = download
      ? `attachment; filename="${image.fileName}"`
      : 'inline'

    // Return file with appropriate headers
    // Convert Buffer to Uint8Array for NextResponse compatibility
    return new NextResponse(new Uint8Array(buffer), {
      headers: {
        'Content-Type': mimeType,
        'Content-Length': buffer.length.toString(),
        'Content-Disposition': contentDisposition,
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Error fetching image file')
    return NextResponse.json(
      { error: 'Failed to fetch image file' },
      { status: 500 }
    )
  }
}
