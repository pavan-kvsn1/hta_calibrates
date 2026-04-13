/**
 * Certificate Images API Route
 *
 * GET /api/certificates/[id]/images - List images for a certificate
 * POST /api/certificates/[id]/images - Upload new images
 *
 * Supports image types: UUC, MASTER_INSTRUMENT, READING_UUC, READING_MASTER
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { CertificateImageType, StorageProvider } from '@prisma/client'
import {
  getImageStorageProvider,
  getImageStorageConfig,
  generateImageStorageKey,
  getImageVariantKeys,
} from '@/lib/storage'
import { createOptimizedImage, createThumbnail } from '@/lib/services/image-processing'
import { certificateLogger as logger } from '@/lib/logger'

// Max images per type
const MAX_UUC_IMAGES = 10
const MAX_MASTER_IMAGES_PER_INSTRUMENT = 5

// Allowed MIME types
const ALLOWED_MIME_TYPES = [
  'image/jpeg',
  'image/png',
  'image/heic',
  'image/heif',
  'image/webp',
]

interface ImageUploadRequest {
  imageType: CertificateImageType
  masterInstrumentIndex?: number
  parameterIndex?: number
  pointNumber?: number
  caption?: string
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
      select: { id: true, createdById: true, reviewerId: true, customerName: true },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Check access: creator, reviewer, admin, or customer with matching company
    const isCreator = certificate.createdById === session.user.id
    const isReviewer = certificate.reviewerId === session.user.id
    const isAdmin = session.user.role === 'ADMIN'
    const isCustomer = session.user.role === 'CUSTOMER'

    let hasCustomerAccess = false
    if (isCustomer && session.user.email) {
      // Check if customer's company matches certificate's customer name
      const customer = await prisma.customerUser.findUnique({
        where: { email: session.user.email },
        include: { customerAccount: true },
      })
      if (customer) {
        const companyName = customer.customerAccount?.companyName || customer.companyName || ''
        hasCustomerAccess = companyName.toLowerCase() === certificate.customerName?.toLowerCase()
      }
    }

    if (!isCreator && !isReviewer && !isAdmin && !hasCustomerAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Parse query params for filtering
    const { searchParams } = new URL(request.url)
    const imageType = searchParams.get('type') as CertificateImageType | null
    const parameterIndex = searchParams.get('parameterIndex')
    const pointNumber = searchParams.get('pointNumber')
    const masterInstrumentIndex = searchParams.get('masterInstrumentIndex')

    // Build where clause
    const where: {
      certificateId: string
      isLatest: boolean
      imageType?: CertificateImageType
      parameterIndex?: number
      pointNumber?: number
      masterInstrumentIndex?: number
    } = {
      certificateId: id,
      isLatest: true,
    }

    if (imageType) where.imageType = imageType
    if (parameterIndex) where.parameterIndex = parseInt(parameterIndex)
    if (pointNumber) where.pointNumber = parseInt(pointNumber)
    if (masterInstrumentIndex) where.masterInstrumentIndex = parseInt(masterInstrumentIndex)

    const images = await prisma.certificateImage.findMany({
      where,
      orderBy: [
        { imageType: 'asc' },
        { parameterIndex: 'asc' },
        { pointNumber: 'asc' },
        { uploadedAt: 'desc' },
      ],
      select: {
        id: true,
        imageType: true,
        masterInstrumentIndex: true,
        parameterIndex: true,
        pointNumber: true,
        fileName: true,
        fileSize: true,
        mimeType: true,
        storageKey: true,
        thumbnailKey: true,
        optimizedKey: true,
        caption: true,
        version: true,
        uploadedAt: true,
        uploadedBy: {
          select: { id: true, name: true },
        },
      },
    })

    // Generate signed URLs for images
    const storage = getImageStorageProvider()
    const config = getImageStorageConfig()

    const imagesWithUrls = await Promise.all(
      images.map(async (img) => {
        let thumbnailUrl: string | null = null
        let optimizedUrl: string | null = null
        let originalUrl: string | null = null

        try {
          // Thumbnail URL (for lists)
          if (img.thumbnailKey) {
            thumbnailUrl = await storage.getSignedUrl(img.thumbnailKey, { expiresInMinutes: 60 })
          }
          // Optimized URL (for viewing)
          if (img.optimizedKey) {
            optimizedUrl = await storage.getSignedUrl(img.optimizedKey, { expiresInMinutes: 60 })
          }
          // Original URL (for download)
          originalUrl = await storage.getSignedUrl(img.storageKey, { expiresInMinutes: 60 })
        } catch {
          // URL generation failed, URLs will be null
        }

        return {
          ...img,
          uploadedAt: img.uploadedAt.toISOString(),
          thumbnailUrl,
          optimizedUrl,
          originalUrl,
          storageProvider: config.type,
        }
      })
    )

    return NextResponse.json({ images: imagesWithUrls })
  } catch (error) {
    logger.error({ err: error }, 'Error fetching certificate images')
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
      include: {
        parameters: {
          include: { results: true },
          orderBy: { sortOrder: 'asc' },
        },
      },
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

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const metadataStr = formData.get('metadata') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    if (!metadataStr) {
      return NextResponse.json({ error: 'No metadata provided' }, { status: 400 })
    }

    let metadata: ImageUploadRequest
    try {
      metadata = JSON.parse(metadataStr)
    } catch {
      return NextResponse.json({ error: 'Invalid metadata JSON' }, { status: 400 })
    }

    // Validate file type
    if (!ALLOWED_MIME_TYPES.includes(file.type)) {
      return NextResponse.json(
        { error: `Invalid file type: ${file.type}. Allowed: ${ALLOWED_MIME_TYPES.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate image type
    const validImageTypes: CertificateImageType[] = ['UUC', 'MASTER_INSTRUMENT', 'READING_UUC', 'READING_MASTER']
    if (!validImageTypes.includes(metadata.imageType)) {
      return NextResponse.json(
        { error: `Invalid image type: ${metadata.imageType}` },
        { status: 400 }
      )
    }

    // Check limits based on image type
    const existingCount = await getExistingImageCount(id, metadata)
    const maxAllowed = getMaxAllowed(metadata, certificate.parameters)

    if (existingCount >= maxAllowed) {
      return NextResponse.json(
        { error: `Maximum images (${maxAllowed}) reached for this context` },
        { status: 400 }
      )
    }

    // For reading images, validate that parameter and point exist
    if (metadata.imageType === 'READING_UUC' || metadata.imageType === 'READING_MASTER') {
      if (metadata.parameterIndex === undefined || metadata.pointNumber === undefined) {
        return NextResponse.json(
          { error: 'parameterIndex and pointNumber are required for reading images' },
          { status: 400 }
        )
      }

      const param = certificate.parameters[metadata.parameterIndex]
      if (!param) {
        return NextResponse.json(
          { error: `Parameter at index ${metadata.parameterIndex} not found` },
          { status: 400 }
        )
      }

      const pointExists = param.results.some(r => r.pointNumber === metadata.pointNumber)
      if (!pointExists) {
        return NextResponse.json(
          { error: `Point ${metadata.pointNumber} not found in parameter` },
          { status: 400 }
        )
      }
    }

    // Upload to storage
    const storage = getImageStorageProvider()
    const config = getImageStorageConfig()

    logger.debug({ storageType: config.type, localPath: config.localPath, gcsBucket: config.gcsBucket }, 'Storage config')

    const storageKey = generateImageStorageKey(
      {
        certificateId: id,
        imageType: metadata.imageType,
        masterInstrumentIndex: metadata.masterInstrumentIndex,
        parameterIndex: metadata.parameterIndex,
        pointNumber: metadata.pointNumber,
      },
      file.name,
      'original'
    )

    // Get file buffer
    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)

    logger.debug({ storageKey, fileSize: buffer.length, mimeType: file.type }, 'Uploading file')

    // Upload original
    try {
      await storage.upload(storageKey, buffer, {
        contentType: file.type,
        metadata: {
          certificateId: id,
          imageType: metadata.imageType,
          originalFileName: file.name,
          uploadedBy: session.user.id,
        },
      })
      logger.debug({ storageKey }, 'File uploaded successfully')
    } catch (uploadError) {
      logger.error({ err: uploadError }, 'Storage upload failed')
      throw uploadError
    }

    // Determine storage provider for database
    const storageProvider: StorageProvider = config.type === 'gcs' ? 'GCP' : 'LOCAL'

    // For local storage, process images immediately (no Cloud Function)
    // For GCS, the Cloud Function will process asynchronously
    let optimizedKey: string | null = null
    let thumbnailKey: string | null = null

    if (config.type === 'local') {
      logger.debug('Processing images locally')
      try {
        const variantKeys = getImageVariantKeys(storageKey)

        // Create and upload optimized version
        const optimized = await createOptimizedImage(buffer)
        await storage.upload(variantKeys.optimized, optimized.buffer, {
          contentType: 'image/jpeg',
        })
        optimizedKey = variantKeys.optimized
        logger.debug({ optimizedKey }, 'Optimized version created')

        // Create and upload thumbnail
        const thumbnail = await createThumbnail(buffer)
        await storage.upload(variantKeys.thumbnail, thumbnail.buffer, {
          contentType: 'image/jpeg',
        })
        thumbnailKey = variantKeys.thumbnail
        logger.debug({ thumbnailKey }, 'Thumbnail created')
      } catch (processingError) {
        logger.error({ err: processingError }, 'Image processing failed')
        // Continue without optimized/thumbnail - not critical
      }
    }

    // Check if there's an existing image to supersede (for versioning)
    const existingImage = await prisma.certificateImage.findFirst({
      where: {
        certificateId: id,
        imageType: metadata.imageType,
        masterInstrumentIndex: metadata.masterInstrumentIndex ?? null,
        parameterIndex: metadata.parameterIndex ?? null,
        pointNumber: metadata.pointNumber ?? null,
        isLatest: true,
      },
    })

    // Create database record
    const image = await prisma.$transaction(async (tx) => {
      // Mark old image as superseded if exists
      let newVersion = 1
      if (existingImage) {
        newVersion = existingImage.version + 1
        await tx.certificateImage.update({
          where: { id: existingImage.id },
          data: {
            isLatest: false,
            archivedAt: new Date(),
          },
        })
      }

      // Create new image record
      const newImage = await tx.certificateImage.create({
        data: {
          certificateId: id,
          imageType: metadata.imageType,
          masterInstrumentIndex: metadata.masterInstrumentIndex ?? null,
          parameterIndex: metadata.parameterIndex ?? null,
          pointNumber: metadata.pointNumber ?? null,
          fileName: file.name,
          fileSize: file.size,
          mimeType: file.type,
          storageProvider,
          storageBucket: config.gcsBucket ?? null,
          storageKey,
          // For local: processed immediately, for GCS: generated by Cloud Function
          optimizedKey,
          thumbnailKey,
          version: newVersion,
          isLatest: true,
          supersededById: null,
          caption: metadata.caption ?? null,
          uploadedById: session.user.id,
          certificateRevision: certificate.currentRevision,
        },
        select: {
          id: true,
          imageType: true,
          masterInstrumentIndex: true,
          parameterIndex: true,
          pointNumber: true,
          fileName: true,
          fileSize: true,
          mimeType: true,
          storageKey: true,
          caption: true,
          version: true,
          uploadedAt: true,
          uploadedBy: {
            select: { id: true, name: true },
          },
        },
      })

      // Update supersededById on old image
      if (existingImage) {
        await tx.certificateImage.update({
          where: { id: existingImage.id },
          data: { supersededById: newImage.id },
        })
      }

      return newImage
    })

    // Generate signed URLs for the uploaded image and variants
    const originalUrl = await storage.getSignedUrl(storageKey, { expiresInMinutes: 60 })
    const thumbnailUrl = thumbnailKey
      ? await storage.getSignedUrl(thumbnailKey, { expiresInMinutes: 60 })
      : null
    const optimizedUrl = optimizedKey
      ? await storage.getSignedUrl(optimizedKey, { expiresInMinutes: 60 })
      : null

    return NextResponse.json(
      {
        image: {
          ...image,
          uploadedAt: image.uploadedAt.toISOString(),
          originalUrl,
          thumbnailUrl,
          optimizedUrl,
          storageProvider: config.type,
        },
      },
      { status: 201 }
    )
  } catch (error) {
    logger.error({ err: error }, 'Error uploading certificate image')
    // Return detailed error for debugging
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    const errorStack = error instanceof Error ? error.stack : undefined
    return NextResponse.json(
      {
        error: 'Failed to upload image',
        details: errorMessage,
        stack: process.env.NODE_ENV === 'development' ? errorStack : undefined,
      },
      { status: 500 }
    )
  }
}

/**
 * Get the count of existing images for a specific context
 */
async function getExistingImageCount(
  certificateId: string,
  metadata: ImageUploadRequest
): Promise<number> {
  const where: {
    certificateId: string
    imageType: CertificateImageType
    isLatest: boolean
    masterInstrumentIndex?: number | null
    parameterIndex?: number | null
    pointNumber?: number | null
  } = {
    certificateId,
    imageType: metadata.imageType,
    isLatest: true,
  }

  // For reading images, count per point
  if (metadata.imageType === 'READING_UUC' || metadata.imageType === 'READING_MASTER') {
    where.parameterIndex = metadata.parameterIndex ?? null
    where.pointNumber = metadata.pointNumber ?? null
  }

  // For master instrument images, count per instrument
  if (metadata.imageType === 'MASTER_INSTRUMENT') {
    where.masterInstrumentIndex = metadata.masterInstrumentIndex ?? null
  }

  return prisma.certificateImage.count({ where })
}

/**
 * Get the maximum allowed images for a specific context
 */
function getMaxAllowed(
  metadata: ImageUploadRequest,
  parameters: { results: { pointNumber: number }[] }[]
): number {
  switch (metadata.imageType) {
    case 'UUC':
      return MAX_UUC_IMAGES

    case 'MASTER_INSTRUMENT':
      return MAX_MASTER_IMAGES_PER_INSTRUMENT

    case 'READING_UUC':
    case 'READING_MASTER':
      // Strictly limited to 1 per point - enforces the "unbreakable rule"
      return 1

    default:
      return 1
  }
}
