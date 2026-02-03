import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST - Submit certificate for HoD review
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    // Parse request body for engineer notes
    let engineerNotes: string | null = null
    try {
      const body = await request.json()
      engineerNotes = body.engineerNotes || null
    } catch {
      // Body may be empty for initial submissions
    }

    // Get existing certificate
    const certificate = await prisma.certificate.findUnique({
      where: { id },
      include: {
        parameters: {
          include: { results: true },
        },
        masterInstruments: true,
      },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Check ownership
    if (certificate.createdById !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if certificate can be submitted (only DRAFT or REVISION_REQUIRED)
    if (certificate.status !== 'DRAFT' && certificate.status !== 'REVISION_REQUIRED') {
      return NextResponse.json(
        { error: `Cannot submit certificate with status: ${certificate.status}` },
        { status: 400 }
      )
    }

    // Check if this is a resubmission
    const isResubmission = certificate.status === 'REVISION_REQUIRED'

    // Validate required fields
    const validationErrors: string[] = []

    // Summary validation
    if (!certificate.dateOfCalibration) validationErrors.push('Date of calibration is required')
    if (!certificate.customerName) validationErrors.push('Customer name is required')
    if (!certificate.customerAddress) validationErrors.push('Customer address is required')

    // UUC validation
    if (!certificate.uucDescription) validationErrors.push('UUC description is required')
    if (!certificate.uucMake) validationErrors.push('UUC make is required')
    if (!certificate.uucModel) validationErrors.push('UUC model is required')
    if (!certificate.uucSerialNumber) validationErrors.push('UUC serial number is required')

    // Master instrument validation
    if (certificate.masterInstruments.length === 0) {
      validationErrors.push('At least one master instrument is required')
    }

    // Environmental conditions
    if (!certificate.ambientTemperature) validationErrors.push('Ambient temperature is required')
    if (!certificate.relativeHumidity) validationErrors.push('Relative humidity is required')

    // Calibration results validation
    const hasResults = certificate.parameters.some(p =>
      p.results.some(r => r.standardReading && r.beforeAdjustment)
    )
    if (!hasResults) validationErrors.push('At least one calibration result is required')

    // Calibration status
    const calibrationStatus = certificate.calibrationStatus ? JSON.parse(certificate.calibrationStatus) : []
    if (calibrationStatus.length === 0) validationErrors.push('Calibration status is required')

    // Conclusion statements
    const conclusions = certificate.selectedConclusionStatements ? JSON.parse(certificate.selectedConclusionStatements) : []
    if (conclusions.length === 0) validationErrors.push('At least one conclusion statement is required')

    if (validationErrors.length > 0) {
      return NextResponse.json(
        { error: 'Validation failed', validationErrors },
        { status: 400 }
      )
    }

    // Submit the certificate
    const updatedCertificate = await prisma.$transaction(async (tx) => {
      // Get next event sequence
      const lastEvent = await tx.certificateEvent.findFirst({
        where: { certificateId: id },
        orderBy: { sequenceNumber: 'desc' },
      })
      const nextSequence = (lastEvent?.sequenceNumber ?? 0) + 1

      // Determine new revision number (increment if resubmission)
      const newRevision = isResubmission
        ? certificate.currentRevision + 1
        : certificate.currentRevision

      // Update certificate status
      const cert = await tx.certificate.update({
        where: { id },
        data: {
          status: 'PENDING_HOD_REVIEW',
          currentRevision: newRevision,
          lastModifiedById: session.user.id,
        },
      })

      // Create submission event
      const event = await tx.certificateEvent.create({
        data: {
          certificateId: id,
          sequenceNumber: nextSequence,
          revision: newRevision,
          eventType: isResubmission ? 'RESUBMITTED_FOR_REVIEW' : 'SUBMITTED_FOR_REVIEW',
          eventData: JSON.stringify({
            previousStatus: certificate.status,
            newStatus: 'PENDING_HOD_REVIEW',
            submittedAt: new Date().toISOString(),
            isResubmission,
            engineerNotes: engineerNotes || null,
          }),
          userId: session.user.id,
          userRole: session.user.role,
        },
      })

      // If this is a resubmission with engineer notes, create a feedback entry
      if (isResubmission && engineerNotes?.trim()) {
        await tx.reviewFeedback.create({
          data: {
            certificateId: id,
            revisionNumber: newRevision,
            eventId: event.id,
            feedbackType: 'ENGINEER_RESPONSE',
            comment: engineerNotes.trim(),
            userId: session.user.id,
          },
        })
      }

      // Create audit log
      await tx.auditLog.create({
        data: {
          entityType: 'Certificate',
          entityId: cert.id,
          action: isResubmission ? 'RESUBMIT_FOR_REVIEW' : 'SUBMIT_FOR_REVIEW',
          actorId: session.user.id,
          actorType: 'USER',
          changes: JSON.stringify({
            previousStatus: certificate.status,
            newStatus: 'PENDING_HOD_REVIEW',
            previousRevision: certificate.currentRevision,
            newRevision,
            hasEngineerNotes: !!engineerNotes?.trim(),
          }),
        },
      })

      return cert
    })

    return NextResponse.json({
      success: true,
      message: isResubmission
        ? 'Certificate resubmitted for HoD review'
        : 'Certificate submitted for HoD review',
      certificate: {
        id: updatedCertificate.id,
        certificateNumber: updatedCertificate.certificateNumber,
        status: updatedCertificate.status,
        revision: updatedCertificate.currentRevision,
      },
    })
  } catch (error) {
    console.error('Error submitting certificate:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
