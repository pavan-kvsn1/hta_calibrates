/**
 * Individual Certificate Image API Route
 *
 * GET /api/certificates/[id]/images/[imageId] - Get image details with signed URL
 * PATCH /api/certificates/[id]/images/[imageId] - Update image caption
 * DELETE /api/certificates/[id]/images/[imageId] - Archive image (soft delete)
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { getImageStorageProvider, getImageStorageConfig } from '@/lib/storage'
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

    const image = await prisma.certificateImage.findFirst({
      where: {
        id: imageId,
        certificateId: id,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
        supersedes: {
          select: {
            id: true,
            version: true,
            uploadedAt: true,
            archivedAt: true,
          },
          orderBy: { version: 'desc' },
        },
      },
    })

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Generate signed URLs
    const storage = getImageStorageProvider()
    const config = getImageStorageConfig()

    let thumbnailUrl: string | null = null
    let optimizedUrl: string | null = null
    let originalUrl: string | null = null

    try {
      if (image.thumbnailKey) {
        thumbnailUrl = await storage.getSignedUrl(image.thumbnailKey, { expiresInMinutes: 60 })
      }
      if (image.optimizedKey) {
        optimizedUrl = await storage.getSignedUrl(image.optimizedKey, { expiresInMinutes: 60 })
      }
      originalUrl = await storage.getSignedUrl(image.storageKey, { expiresInMinutes: 60 })
    } catch {
      // URL generation failed
    }

    return NextResponse.json({
      image: {
        id: image.id,
        imageType: image.imageType,
        masterInstrumentIndex: image.masterInstrumentIndex,
        parameterIndex: image.parameterIndex,
        pointNumber: image.pointNumber,
        fileName: image.fileName,
        fileSize: image.fileSize,
        mimeType: image.mimeType,
        caption: image.caption,
        version: image.version,
        isLatest: image.isLatest,
        archivedAt: image.archivedAt?.toISOString() ?? null,
        uploadedAt: image.uploadedAt.toISOString(),
        uploadedBy: image.uploadedBy,
        certificateRevision: image.certificateRevision,
        thumbnailUrl,
        optimizedUrl,
        originalUrl,
        storageProvider: config.type,
        // Version history
        previousVersions: image.supersedes.map((prev) => ({
          id: prev.id,
          version: prev.version,
          uploadedAt: prev.uploadedAt.toISOString(),
          archivedAt: prev.archivedAt?.toISOString() ?? null,
        })),
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Error fetching certificate image')
    return NextResponse.json(
      { error: 'Failed to fetch image' },
      { status: 500 }
    )
  }
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, imageId } = await params

    // Verify certificate exists and user can edit
    const certificate = await prisma.certificate.findUnique({
      where: { id },
      select: { id: true, createdById: true },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Only creator or admin can update
    const isCreator = certificate.createdById === session.user.id
    const isAdmin = session.user.role === 'ADMIN'

    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const body = await request.json()
    const { caption } = body

    // Verify image exists and belongs to certificate
    const image = await prisma.certificateImage.findFirst({
      where: {
        id: imageId,
        certificateId: id,
      },
    })

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Update caption
    const updated = await prisma.certificateImage.update({
      where: { id: imageId },
      data: { caption: caption ?? null },
      select: {
        id: true,
        caption: true,
      },
    })

    return NextResponse.json({ image: updated })
  } catch (error) {
    logger.error({ err: error }, 'Error updating certificate image')
    return NextResponse.json(
      { error: 'Failed to update image' },
      { status: 500 }
    )
  }
}

export async function DELETE(
  request: NextRequest,
  { params }: { params: Promise<{ id: string; imageId: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, imageId } = await params

    // Verify certificate exists and user can delete
    const certificate = await prisma.certificate.findUnique({
      where: { id },
      select: { id: true, createdById: true },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Only creator or admin can delete
    const isCreator = certificate.createdById === session.user.id
    const isAdmin = session.user.role === 'ADMIN'

    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Verify image exists and belongs to certificate
    const image = await prisma.certificateImage.findFirst({
      where: {
        id: imageId,
        certificateId: id,
        isLatest: true, // Can only delete latest version
      },
    })

    if (!image) {
      return NextResponse.json({ error: 'Image not found or already archived' }, { status: 404 })
    }

    // Soft delete: mark as archived, not latest
    // We never delete files for audit trail purposes
    await prisma.certificateImage.update({
      where: { id: imageId },
      data: {
        isLatest: false,
        archivedAt: new Date(),
      },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error({ err: error }, 'Error deleting certificate image')
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    )
  }
}
