/**
 * Single UUC Image API Route
 *
 * GET /api/certificates/[id]/uuc-images/[imageId] - Get image metadata
 * PATCH /api/certificates/[id]/uuc-images/[imageId] - Update caption
 * DELETE /api/certificates/[id]/uuc-images/[imageId] - Delete image
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { unlink } from 'fs/promises'
import { join } from 'path'
import { certificateLogger as logger } from '@/lib/logger'

const UPLOAD_DIR = join(process.cwd(), 'uploads', 'uuc-images')

interface RouteParams {
  params: Promise<{ id: string; imageId: string }>
}

export async function GET(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, imageId } = await params

    const image = await prisma.uUCImage.findFirst({
      where: { id: imageId, certificateId: id },
      include: {
        certificate: {
          select: { createdById: true, reviewerId: true },
        },
        uploadedBy: {
          select: { id: true, name: true },
        },
      },
    })

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Check access
    const isCreator = image.certificate.createdById === session.user.id
    const isReviewer = image.certificate.reviewerId === session.user.id
    const isAdmin = session.user.role === 'ADMIN'

    if (!isCreator && !isReviewer && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    return NextResponse.json({
      image: {
        id: image.id,
        fileName: image.fileName,
        fileSize: image.fileSize,
        mimeType: image.mimeType,
        caption: image.caption,
        sortOrder: image.sortOrder,
        uploadedBy: image.uploadedBy,
        createdAt: image.createdAt.toISOString(),
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Error fetching UUC image')
    return NextResponse.json(
      { error: 'Failed to fetch image' },
      { status: 500 }
    )
  }
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, imageId } = await params
    const body = await request.json()
    const { caption, sortOrder } = body

    const image = await prisma.uUCImage.findFirst({
      where: { id: imageId, certificateId: id },
      include: {
        certificate: {
          select: { createdById: true },
        },
      },
    })

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Only creator or admin can update
    const isCreator = image.certificate.createdById === session.user.id
    const isAdmin = session.user.role === 'ADMIN'

    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const updateData: { caption?: string; sortOrder?: number } = {}
    if (caption !== undefined) updateData.caption = caption
    if (sortOrder !== undefined) updateData.sortOrder = sortOrder

    const updated = await prisma.uUCImage.update({
      where: { id: imageId },
      data: updateData,
      select: {
        id: true,
        caption: true,
        sortOrder: true,
      },
    })

    return NextResponse.json({ image: updated })
  } catch (error) {
    logger.error({ err: error }, 'Error updating UUC image')
    return NextResponse.json(
      { error: 'Failed to update image' },
      { status: 500 }
    )
  }
}

export async function DELETE(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id, imageId } = await params

    const image = await prisma.uUCImage.findFirst({
      where: { id: imageId, certificateId: id },
      include: {
        certificate: {
          select: { createdById: true },
        },
      },
    })

    if (!image) {
      return NextResponse.json({ error: 'Image not found' }, { status: 404 })
    }

    // Only creator or admin can delete
    const isCreator = image.certificate.createdById === session.user.id
    const isAdmin = session.user.role === 'ADMIN'

    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Delete file from disk
    try {
      const filePath = join(UPLOAD_DIR, image.storagePath)
      await unlink(filePath)
    } catch (fileErr) {
      logger.warn({ err: fileErr }, 'Failed to delete UUC image file')
      // Continue with database deletion even if file deletion fails
    }

    // Delete database record
    await prisma.uUCImage.delete({
      where: { id: imageId },
    })

    return NextResponse.json({ success: true })
  } catch (error) {
    logger.error({ err: error }, 'Error deleting UUC image')
    return NextResponse.json(
      { error: 'Failed to delete image' },
      { status: 500 }
    )
  }
}
