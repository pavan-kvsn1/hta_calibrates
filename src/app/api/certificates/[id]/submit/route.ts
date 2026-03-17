import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  notifyReviewerOnSubmit,
  notifyReviewerOnAssigneeResponse,
} from '@/lib/services/notifications'
import { isFeatureEnabled } from '@/lib/feature-flags'
import {
  appendSigningEvidence,
  collectServerEvidence,
  buildSigningEvidencePayload,
  type ClientEvidence,
} from '@/lib/stores/signing-evidence'

interface RouteContext {
  params: Promise<{ id: string }>
}

// POST - Submit certificate for peer review
export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    // Parse request body for engineer notes, signature, reviewer, and section responses
    let engineerNotes: string | null = null
    let signatureData: string | null = null
    let signerName: string | null = null
    let clientEvidence: ClientEvidence | null = null
    let reviewerId: string | null = null
    let sectionResponses: Record<string, string> = {}
    try {
      const body = await request.json()
      engineerNotes = body.engineerNotes || null
      signatureData = body.signatureData || null
      signerName = body.signerName || null
      clientEvidence = body.clientEvidence || null
      reviewerId = body.reviewerId || null
      sectionResponses = body.sectionResponses || {}
    } catch {
      // Body may be empty for initial submissions
    }

    // Check if new workflow is enabled (peer review)
    const useNewWorkflow = isFeatureEnabled('NEW_WORKFLOW')

    // Validate signature data is present
    if (!signatureData || !signerName?.trim()) {
      return NextResponse.json(
        { error: 'Signature and signer name are required' },
        { status: 400 }
      )
    }

    // Validate signer name matches user profile
    if (session.user.name && signerName.trim().toLowerCase() !== session.user.name.toLowerCase()) {
      return NextResponse.json(
        { error: 'Signer name must match your profile name' },
        { status: 400 }
      )
    }

    // Get existing certificate first (needed for reviewer validation)
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

    // Use existing reviewer if already assigned, otherwise use the one from request
    const effectiveReviewerId = certificate.reviewerId || reviewerId

    // Validate reviewer selection for new workflow (only if not already assigned)
    if (useNewWorkflow && !effectiveReviewerId) {
      return NextResponse.json(
        { error: 'Please select a reviewer for the certificate' },
        { status: 400 }
      )
    }

    // Validate and fetch reviewer
    let reviewer = null
    if (useNewWorkflow) {
      if (certificate.reviewerId) {
        // Resubmission - fetch existing reviewer
        reviewer = await prisma.user.findUnique({
          where: { id: certificate.reviewerId },
          select: { id: true, name: true, email: true, role: true, isActive: true },
        })
      } else if (reviewerId) {
        // New submission - validate and fetch selected reviewer
        reviewer = await prisma.user.findUnique({
          where: { id: reviewerId },
          select: { id: true, name: true, email: true, role: true, isActive: true },
        })

        if (!reviewer || !reviewer.isActive) {
          return NextResponse.json(
            { error: 'Selected reviewer is not available' },
            { status: 400 }
          )
        }

        if (reviewerId === session.user.id) {
          return NextResponse.json(
            { error: 'You cannot review your own certificate' },
            { status: 400 }
          )
        }
      }
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
    const result = await prisma.$transaction(async (tx) => {
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

      // Update certificate status and assign reviewer
      const cert = await tx.certificate.update({
        where: { id },
        data: {
          status: 'PENDING_REVIEW',
          currentRevision: newRevision,
          lastModifiedById: session.user.id,
          // Assign reviewer if new workflow
          ...(useNewWorkflow && reviewerId ? { reviewerId } : {}),
        },
      })

      // Create submission event
      const sectionResponseCount = Object.values(sectionResponses).filter(r => r?.trim()).length
      const event = await tx.certificateEvent.create({
        data: {
          certificateId: id,
          sequenceNumber: nextSequence,
          revision: newRevision,
          eventType: isResubmission ? 'RESUBMITTED_FOR_REVIEW' : 'SUBMITTED_FOR_REVIEW',
          eventData: JSON.stringify({
            previousStatus: certificate.status,
            newStatus: 'PENDING_REVIEW',
            submittedAt: new Date().toISOString(),
            isResubmission,
            engineerNotes: engineerNotes || null,
            hasSignature: true,
            sectionResponseCount,
            sectionIds: Object.keys(sectionResponses).filter(k => sectionResponses[k]?.trim()),
            // Include reviewer info for new workflow
            ...(useNewWorkflow && reviewer ? {
              reviewerId: reviewer.id,
              reviewerName: reviewer.name,
            } : {}),
          }),
          userId: session.user.id,
          userRole: session.user.role,
        },
      })

      // If this is a resubmission, create feedback entries for section responses and general notes
      // Use the OLD revision number (before increment) so responses are grouped with the requests they're responding to
      if (isResubmission) {
        // Create feedback entries for section-specific responses
        const sectionResponseEntries = Object.entries(sectionResponses)
        for (const [sectionId, response] of sectionResponseEntries) {
          if (response?.trim()) {
            await tx.reviewFeedback.create({
              data: {
                certificateId: id,
                revisionNumber: certificate.currentRevision, // Use old revision to group with request
                eventId: event.id,
                feedbackType: 'ASSIGNEE_RESPONSE',
                comment: response.trim(),
                targetSection: sectionId,
                userId: session.user.id,
              },
            })
          }
        }

        // Create general notes feedback entry (if provided)
        if (engineerNotes?.trim()) {
          await tx.reviewFeedback.create({
            data: {
              certificateId: id,
              revisionNumber: certificate.currentRevision, // Use old revision to group with request
              eventId: event.id,
              feedbackType: 'ENGINEER_RESPONSE',
              comment: engineerNotes.trim(),
              userId: session.user.id,
            },
          })
        }
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
            newStatus: 'PENDING_REVIEW',
            previousRevision: certificate.currentRevision,
            newRevision,
            hasEngineerNotes: !!engineerNotes?.trim(),
            hasSignature: true,
          }),
        },
      })

      // Delete all existing signatures for this certificate (handles resubmission)
      // When a certificate is revised, previous signatures are invalidated
      await tx.signature.deleteMany({
        where: { certificateId: id },
      })

      // Create ASSIGNEE signature record
      const signature = await tx.signature.create({
        data: {
          certificateId: id,
          signerType: 'ASSIGNEE',
          signerName: signerName!,
          signerEmail: session.user.email,
          signatureData: signatureData!,
          signerId: session.user.id,
        },
      })

      return { cert, signature }
    })

    const { cert: updatedCert, signature } = result

    // Capture signing evidence (Layer 1-4) if client evidence provided
    if (clientEvidence) {
      try {
        const serverEvidence = collectServerEvidence(request, 'direct')
        const evidencePayload = buildSigningEvidencePayload(
          clientEvidence,
          serverEvidence,
          {
            signerType: 'ASSIGNEE',
            signerName: signerName!,
            signerEmail: session.user.email,
            signerId: session.user.id,
          }
        )
        await appendSigningEvidence(id, signature.id, 'ASSIGNEE_SIGNED', evidencePayload, updatedCert.currentRevision)
      } catch (evidenceError) {
        // Log but don't fail the submission if evidence capture fails
        console.error('Failed to capture signing evidence:', evidenceError)
      }
    }

    // Send notifications (fire and forget, don't block response)
    if (useNewWorkflow && reviewer) {
      // New workflow: Notify selected reviewer
      if (isResubmission) {
        notifyReviewerOnAssigneeResponse({
          certificateId: updatedCert.id,
          certificateNumber: updatedCert.certificateNumber,
          assigneeName: session.user.name || 'Engineer',
          reviewerId: reviewer.id,
        }).catch((err) => console.error('Failed to send notification:', err))
      } else {
        notifyReviewerOnSubmit({
          certificateId: updatedCert.id,
          certificateNumber: updatedCert.certificateNumber,
          assigneeName: session.user.name || 'Engineer',
          reviewerId: reviewer.id,
        }).catch((err) => console.error('Failed to send notification:', err))
      }
    }

    const reviewerLabel = 'peer'
    return NextResponse.json({
      success: true,
      message: isResubmission
        ? `Certificate resubmitted for ${reviewerLabel} review`
        : `Certificate submitted for ${reviewerLabel} review`,
      certificate: {
        id: updatedCert.id,
        certificateNumber: updatedCert.certificateNumber,
        status: updatedCert.status,
        revision: updatedCert.currentRevision,
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
