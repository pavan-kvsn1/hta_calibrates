/**
 * Image Processing Check API
 *
 * POST /api/certificates/[id]/images/process-check
 *
 * Checks if uploaded images have been processed by the Cloud Function
 * and updates the database with optimized/thumbnail keys.
 *
 * This is called periodically by the client after uploading images.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getImageStorageProvider, getImageVariantKeys } from '@/lib/storage'
import { certificateLogger as logger } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await params

    // Verify certificate exists
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

    // Get all images that don't have optimized/thumbnail keys yet
    const pendingImages = await prisma.certificateImage.findMany({
      where: {
        certificateId: id,
        isLatest: true,
        OR: [
          { optimizedKey: null },
          { thumbnailKey: null },
        ],
      },
      select: {
        id: true,
        storageKey: true,
        optimizedKey: true,
        thumbnailKey: true,
      },
    })

    if (pendingImages.length === 0) {
      return NextResponse.json({
        processed: true,
        message: 'All images have been processed',
        pendingCount: 0,
      })
    }

    const storage = getImageStorageProvider()
    const updatedImages: string[] = []
    let stillPending = 0

    for (const image of pendingImages) {
      const variants = getImageVariantKeys(image.storageKey)
      let needsUpdate = false
      let optimizedKey = image.optimizedKey
      let thumbnailKey = image.thumbnailKey

      // Check if optimized version exists
      if (!image.optimizedKey) {
        const optimizedExists = await storage.exists(variants.optimized)
        if (optimizedExists) {
          optimizedKey = variants.optimized
          needsUpdate = true
        }
      }

      // Check if thumbnail version exists
      if (!image.thumbnailKey) {
        const thumbnailExists = await storage.exists(variants.thumbnail)
        if (thumbnailExists) {
          thumbnailKey = variants.thumbnail
          needsUpdate = true
        }
      }

      // Update database if variants were found
      if (needsUpdate) {
        await prisma.certificateImage.update({
          where: { id: image.id },
          data: {
            optimizedKey,
            thumbnailKey,
          },
        })
        updatedImages.push(image.id)
      } else {
        stillPending++
      }
    }

    return NextResponse.json({
      processed: stillPending === 0,
      message: stillPending === 0
        ? 'All images have been processed'
        : `${stillPending} images still processing`,
      updatedCount: updatedImages.length,
      pendingCount: stillPending,
      updatedImageIds: updatedImages,
    })
  } catch (error) {
    logger.error({ err: error }, 'Error checking image processing status')
    return NextResponse.json(
      { error: 'Failed to check processing status' },
      { status: 500 }
    )
  }
}
