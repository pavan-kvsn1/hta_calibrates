import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logger'

const logger = createLogger('requests')

// POST /api/internal-requests - Create a new internal request (e.g., section unlock)
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only staff (engineers, admins) can create internal requests
    if (session.user.role === 'CUSTOMER') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { type, certificateId, sections, reason } = body

    // Validate request type
    if (type !== 'SECTION_UNLOCK') {
      return NextResponse.json(
        { error: 'Invalid request type' },
        { status: 400 }
      )
    }

    // Validate required fields for SECTION_UNLOCK
    if (!certificateId || !sections || !Array.isArray(sections) || sections.length === 0 || !reason) {
      return NextResponse.json(
        { error: 'Missing required fields: certificateId, sections (array), and reason are required' },
        { status: 400 }
      )
    }

    // Check certificate exists and is in REVISION_REQUIRED status
    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
      select: {
        id: true,
        status: true,
        certificateNumber: true,
        createdById: true,
        currentRevision: true,
      },
    })

    if (!certificate) {
      return NextResponse.json(
        { error: 'Certificate not found' },
        { status: 404 }
      )
    }

    // Only allow section unlock requests for REVISION_REQUIRED certificates
    if (certificate.status !== 'REVISION_REQUIRED') {
      return NextResponse.json(
        { error: 'Section unlock requests can only be made for certificates in REVISION_REQUIRED status' },
        { status: 400 }
      )
    }

    // Only the certificate creator (assignee) can request section unlocks
    if (certificate.createdById !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Only the certificate assignee can request section unlocks' },
        { status: 403 }
      )
    }

    // Check for existing pending request for the same certificate
    const existingPendingRequest = await prisma.internalRequest.findFirst({
      where: {
        type: 'SECTION_UNLOCK',
        certificateId,
        status: 'PENDING',
      },
    })

    if (existingPendingRequest) {
      return NextResponse.json(
        { error: 'A pending section unlock request already exists for this certificate' },
        { status: 400 }
      )
    }

    // Create the internal request
    const internalRequest = await prisma.internalRequest.create({
      data: {
        type: 'SECTION_UNLOCK',
        status: 'PENDING',
        requestedById: session.user.id,
        certificateId,
        data: JSON.stringify({ sections, reason }),
      },
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
        certificate: {
          select: { id: true, certificateNumber: true },
        },
      },
    })

    // Create certificate event for the unlock request
    const latestEvent = await prisma.certificateEvent.findFirst({
      where: { certificateId },
      orderBy: { sequenceNumber: 'desc' },
      select: { sequenceNumber: true },
    })
    const nextSequence = (latestEvent?.sequenceNumber || 0) + 1

    await prisma.certificateEvent.create({
      data: {
        certificateId,
        eventType: 'SECTION_UNLOCK_REQUESTED',
        eventData: JSON.stringify({
          sections,
          reason,
          requestId: internalRequest.id,
        }),
        userId: session.user.id,
        userRole: session.user.role || 'ENGINEER',
        sequenceNumber: nextSequence,
        revision: certificate.currentRevision,
      },
    })

    return NextResponse.json({
      success: true,
      request: {
        id: internalRequest.id,
        type: internalRequest.type,
        status: internalRequest.status,
        data: { sections, reason },
        certificate: internalRequest.certificate,
        requestedBy: internalRequest.requestedBy,
        createdAt: internalRequest.createdAt.toISOString(),
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to create internal request')
    const errorMessage = error instanceof Error ? error.message : 'Unknown error'
    return NextResponse.json(
      { error: `Failed to create internal request: ${errorMessage}` },
      { status: 500 }
    )
  }
}
