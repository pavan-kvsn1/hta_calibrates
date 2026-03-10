/**
 * UUC Image File Serving Route
 *
 * GET /api/certificates/[id]/uuc-images/[imageId]/file - Serve the image file
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { readFile } from 'fs/promises'
import { join } from 'path'

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

    // Read file from disk
    const filePath = join(UPLOAD_DIR, image.storagePath)
    const fileBuffer = await readFile(filePath)

    // Return the image with appropriate headers
    return new NextResponse(fileBuffer, {
      headers: {
        'Content-Type': image.mimeType,
        'Content-Disposition': `inline; filename="${image.fileName}"`,
        'Cache-Control': 'private, max-age=3600', // Cache for 1 hour
      },
    })
  } catch (error) {
    console.error('[UUC Image File API] GET error:', error)

    // Check if it's a file not found error
    if ((error as NodeJS.ErrnoException).code === 'ENOENT') {
      return NextResponse.json({ error: 'File not found' }, { status: 404 })
    }

    return NextResponse.json(
      { error: 'Failed to serve image' },
      { status: 500 }
    )
  }
}
