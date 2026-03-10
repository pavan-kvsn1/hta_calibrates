/**
 * UUC Images API Route
 *
 * GET /api/certificates/[id]/uuc-images - List images for a certificate
 * POST /api/certificates/[id]/uuc-images - Upload new images
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { writeFile, mkdir } from 'fs/promises'
import { join } from 'path'
import { randomUUID } from 'crypto'

// Storage directory for UUC images
const UPLOAD_DIR = join(process.cwd(), 'uploads', 'uuc-images')

// Ensure upload directory exists
async function ensureUploadDir() {
  try {
    await mkdir(UPLOAD_DIR, { recursive: true })
  } catch {
    // Directory already exists
  }
}

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

    // Verify certificate exists and user has access
    const certificate = await prisma.certificate.findUnique({
      where: { id },
      select: { id: true, createdById: true, reviewerId: true },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Check access: creator, reviewer, or admin
    const isCreator = certificate.createdById === session.user.id
    const isReviewer = certificate.reviewerId === session.user.id
    const isAdmin = session.user.role === 'ADMIN'

    if (!isCreator && !isReviewer && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const images = await prisma.uUCImage.findMany({
      where: { certificateId: id },
      orderBy: { sortOrder: 'asc' },
      select: {
        id: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        caption: true,
        sortOrder: true,
        createdAt: true,
      },
    })

    return NextResponse.json({
      images: images.map((img) => ({
        ...img,
        createdAt: img.createdAt.toISOString(),
      })),
    })
  } catch (error) {
    console.error('[UUC Images API] GET error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch images' },
      { status: 500 }
    )
  }
}

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

    // Verify certificate exists and user can upload
    const certificate = await prisma.certificate.findUnique({
      where: { id },
      select: { id: true, createdById: true },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Only creator or admin can upload
    const isCreator = certificate.createdById === session.user.id
    const isAdmin = session.user.role === 'ADMIN'

    if (!isCreator && !isAdmin) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Ensure upload directory exists
    await ensureUploadDir()

    // Parse form data
    const formData = await request.formData()
    const files = formData.getAll('files') as File[]

    if (!files || files.length === 0) {
      return NextResponse.json({ error: 'No files provided' }, { status: 400 })
    }

    // Get current max sort order
    const lastImage = await prisma.uUCImage.findFirst({
      where: { certificateId: id },
      orderBy: { sortOrder: 'desc' },
      select: { sortOrder: true },
    })
    let sortOrder = (lastImage?.sortOrder ?? -1) + 1

    // Process and save files
    const savedImages = []

    for (const file of files) {
      // Validate file type
      if (!['image/jpeg', 'image/png', 'image/heic', 'image/heif'].includes(file.type)) {
        continue // Skip invalid files
      }

      // Generate unique filename
      const ext = file.name.split('.').pop() || 'jpg'
      const uniqueFileName = `${id}-${randomUUID()}.${ext}`
      const filePath = join(UPLOAD_DIR, uniqueFileName)

      // Save file
      const bytes = await file.arrayBuffer()
      const buffer = Buffer.from(bytes)
      await writeFile(filePath, buffer)

      // Create database record
      const image = await prisma.uUCImage.create({
        data: {
          certificateId: id,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          storagePath: uniqueFileName,
          sortOrder: sortOrder++,
          uploadedById: session.user.id,
        },
        select: {
          id: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          caption: true,
          sortOrder: true,
          createdAt: true,
        },
      })

      savedImages.push({
        ...image,
        createdAt: image.createdAt.toISOString(),
      })
    }

    return NextResponse.json({ images: savedImages }, { status: 201 })
  } catch (error) {
    console.error('[UUC Images API] POST error:', error)
    return NextResponse.json(
      { error: 'Failed to upload images' },
      { status: 500 }
    )
  }
}
