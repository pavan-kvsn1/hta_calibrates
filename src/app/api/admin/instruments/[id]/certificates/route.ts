import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { getStorageProvider, assetNumberToFileName } from '@/lib/storage'
import { createLogger } from '@/lib/logger'

const logger = createLogger('instruments')

/**
 * GET /api/admin/instruments/[id]/certificates
 * List all certificates for a master instrument
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

    // Verify instrument exists
    const instrument = await prisma.masterInstrument.findUnique({
      where: { id },
      select: { id: true, assetNumber: true, description: true },
    })

    if (!instrument) {
      return NextResponse.json({ error: 'Instrument not found' }, { status: 404 })
    }

    // Get query params
    const { searchParams } = new URL(request.url)
    const includeInactive = searchParams.get('includeInactive') === 'true'
    const latestOnly = searchParams.get('latestOnly') === 'true'

    // Build where clause
    const where: Record<string, unknown> = {
      masterInstrumentId: id,
    }

    if (!includeInactive) {
      where.isActive = true
    }

    if (latestOnly) {
      where.isLatest = true
    }

    // Fetch certificates
    const certificates = await prisma.masterInstrumentCertificate.findMany({
      where,
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
      orderBy: { uploadedAt: 'desc' },
    })

    return NextResponse.json({
      instrument: {
        id: instrument.id,
        assetNumber: instrument.assetNumber,
        description: instrument.description,
      },
      certificates,
      total: certificates.length,
    })
  } catch (error) {
    logger.error({ err: error }, 'Error fetching instrument certificates')
    return NextResponse.json(
      { error: 'Failed to fetch certificates' },
      { status: 500 }
    )
  }
}

/**
 * POST /api/admin/instruments/[id]/certificates
 * Upload a new certificate for a master instrument
 * Access: Admin only
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

    // Check if user is admin
    if (!session.user.isAdmin) {
      return NextResponse.json(
        { error: 'Only administrators can upload certificates' },
        { status: 403 }
      )
    }

    const { id } = await params

    // Verify instrument exists
    const instrument = await prisma.masterInstrument.findUnique({
      where: { id },
      select: { id: true, assetNumber: true, reportNo: true, calibrationDueDate: true },
    })

    if (!instrument) {
      return NextResponse.json({ error: 'Instrument not found' }, { status: 404 })
    }

    // Parse form data
    const formData = await request.formData()
    const file = formData.get('file') as File | null
    const reportNo = formData.get('reportNo') as string | null
    const validFromStr = formData.get('validFrom') as string | null
    const validUntilStr = formData.get('validUntil') as string | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    // Validate file type
    if (file.type !== 'application/pdf') {
      return NextResponse.json(
        { error: 'Only PDF files are allowed' },
        { status: 400 }
      )
    }

    // Validate file size (max 10MB)
    const maxSize = 10 * 1024 * 1024
    if (file.size > maxSize) {
      return NextResponse.json(
        { error: 'File size exceeds 10MB limit' },
        { status: 400 }
      )
    }

    // Generate storage path based on asset number
    const fileName = assetNumberToFileName(instrument.assetNumber)
    const storagePath = `master-instruments/${fileName}`

    // Get file buffer
    const buffer = Buffer.from(await file.arrayBuffer())

    // Upload to storage
    const storage = getStorageProvider()
    await storage.upload(storagePath, buffer, {
      contentType: 'application/pdf',
      metadata: {
        instrumentId: id,
        assetNumber: instrument.assetNumber,
        uploadedBy: session.user.id,
      },
    })

    // Mark existing certificates as not latest
    await prisma.masterInstrumentCertificate.updateMany({
      where: {
        masterInstrumentId: id,
        isLatest: true,
      },
      data: { isLatest: false },
    })

    // Create certificate record
    const certificate = await prisma.masterInstrumentCertificate.create({
      data: {
        masterInstrumentId: id,
        fileName: file.name,
        fileSize: file.size,
        mimeType: 'application/pdf',
        storagePath,
        reportNo: reportNo || instrument.reportNo,
        validFrom: validFromStr ? new Date(validFromStr) : null,
        validUntil: validUntilStr
          ? new Date(validUntilStr)
          : instrument.calibrationDueDate,
        uploadedById: session.user.id,
        isLatest: true,
        isActive: true,
      },
      include: {
        uploadedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      certificate,
    })
  } catch (error) {
    logger.error({ err: error }, 'Error uploading instrument certificate')
    return NextResponse.json(
      { error: 'Failed to upload certificate' },
      { status: 500 }
    )
  }
}
