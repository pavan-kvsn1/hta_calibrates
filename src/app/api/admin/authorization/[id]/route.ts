import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, canAccessAdmin } from '@/lib/auth'
import { parseUserAgent, type SigningMetadata } from '@/components/pdf/pdf-utils'
import { safeJsonParse } from '@/lib/utils/safe-json'
import type { ParameterBin } from '@/lib/stores/certificate-store'
import { certificateLogger as logger } from '@/lib/logger'

interface RevisionHistoryItem {
  id: string
  type: 'customer_request' | 'admin_response' | 'sent_to_customer' | 'admin_message'
  message: string
  createdAt: string
  userName?: string
  companyName?: string
}

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!canAccessAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params

    // Get certificate with full data
    const certificate = await prisma.certificate.findUnique({
      where: { id },
      include: {
        parameters: {
          include: {
            results: {
              orderBy: { pointNumber: 'asc' },
            },
          },
          orderBy: { sortOrder: 'asc' },
        },
        masterInstruments: true,
        createdBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Get revision history
    const events = await prisma.certificateEvent.findMany({
      where: {
        certificateId: id,
        eventType: {
          in: [
            'SENT_TO_CUSTOMER',
            'CUSTOMER_REVISION_REQUESTED',
            'ADMIN_REPLIED_TO_CUSTOMER',
            'ADMIN_MESSAGE',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      include: {
        user: {
          select: { name: true },
        },
      },
    })

    const revisionHistory: RevisionHistoryItem[] = events.map(event => {
      const eventData = safeJsonParse<Record<string, string>>(event.eventData, {})

      let type: RevisionHistoryItem['type'] = 'sent_to_customer'
      let message = ''

      if (event.eventType === 'CUSTOMER_REVISION_REQUESTED') {
        type = 'customer_request'
        message = eventData.notes || 'Revision requested'
      } else if (event.eventType === 'ADMIN_REPLIED_TO_CUSTOMER') {
        type = 'admin_response'
        message = eventData.response || 'Admin responded to customer feedback'
      } else if (event.eventType === 'SENT_TO_CUSTOMER') {
        type = 'sent_to_customer'
        message = eventData.responseToFeedback || eventData.message || 'Certificate sent for review'
      } else if (event.eventType === 'ADMIN_MESSAGE') {
        type = 'admin_message'
        message = eventData.message || ''
      }

      return {
        id: event.id,
        type,
        message,
        createdAt: event.createdAt.toISOString(),
        userName: event.eventType === 'CUSTOMER_REVISION_REQUESTED'
          ? eventData.customerName
          : event.user?.name,
        companyName: eventData.customerCompany,
      }
    })

    // Fetch signature records for this certificate
    const dbSignatures = await prisma.signature.findMany({
      where: { certificateId: id },
      orderBy: { signedAt: 'desc' },
    })

    // Fetch signing evidence for metadata - filter by current revision
    const signingEvidence = await prisma.signingEvidence.findMany({
      where: {
        certificateId: id,
        revision: certificate.currentRevision,
      },
      orderBy: { sequenceNumber: 'asc' },
    })

    // Helper to extract metadata from signing evidence
    const getMetadataForSignature = (signatureId: string | null, signerType: string): SigningMetadata | undefined => {
      let evidence = signatureId
        ? signingEvidence.find(e => e.signatureId === signatureId)
        : null

      if (!evidence) {
        const eventTypeMap: Record<string, string> = {
          'ASSIGNEE': 'ASSIGNEE_SIGNED',
          'REVIEWER': 'REVIEWER_SIGNED',
          'ADMIN': 'ADMIN_SIGNED',
          'CUSTOMER': 'CUSTOMER_SIGNED',
        }
        evidence = signingEvidence.find(e => e.eventType === eventTypeMap[signerType])
      }

      if (!evidence) return undefined

      const parsed = safeJsonParse<Record<string, string>>(evidence.evidence, {})
      if (Object.keys(parsed).length === 0) {
        return { signedAt: evidence.createdAt.toISOString() }
      }
      return {
        signedAt: parsed.serverTimestamp || evidence.createdAt.toISOString(),
        ipAddress: parsed.ipAddress,
        timezone: parsed.timezone,
        deviceInfo: parseUserAgent(parsed.userAgent || ''),
      }
    }

    // Helper to check if signature has evidence for current revision
    const hasEvidenceForCurrentRevision = (signatureId: string, signerType: string): boolean => {
      const eventTypeMap: Record<string, string> = {
        'ASSIGNEE': 'ASSIGNEE_SIGNED',
        'REVIEWER': 'REVIEWER_SIGNED',
        'ADMIN': 'ADMIN_SIGNED',
        'CUSTOMER': 'CUSTOMER_SIGNED',
      }
      return signingEvidence.some(e =>
        e.signatureId === signatureId || e.eventType === eventTypeMap[signerType]
      )
    }

    const assigneeSig = dbSignatures.find(s => s.signerType === 'ASSIGNEE')
    const reviewerSig = dbSignatures.find(s => s.signerType === 'REVIEWER')
    const adminSig = dbSignatures.find(s => s.signerType === 'ADMIN')
    const customerSig = dbSignatures.find(s => s.signerType === 'CUSTOMER')

    const validAssigneeSig = assigneeSig && hasEvidenceForCurrentRevision(assigneeSig.id, 'ASSIGNEE') ? assigneeSig : null
    const validReviewerSig = reviewerSig && hasEvidenceForCurrentRevision(reviewerSig.id, 'REVIEWER') ? reviewerSig : null
    const validAdminSig = adminSig && hasEvidenceForCurrentRevision(adminSig.id, 'ADMIN') ? adminSig : null
    const validCustomerSig = customerSig && hasEvidenceForCurrentRevision(customerSig.id, 'CUSTOMER') ? customerSig : null

    const signatures = (validAssigneeSig || validReviewerSig || validAdminSig || validCustomerSig) ? {
      ...(validAssigneeSig ? {
        engineer: {
          name: validAssigneeSig.signerName.toUpperCase(),
          image: validAssigneeSig.signatureData,
          signatureId: validAssigneeSig.id,
          metadata: getMetadataForSignature(validAssigneeSig.id, 'ASSIGNEE'),
        }
      } : {}),
      ...(validReviewerSig ? {
        hod: {
          name: validReviewerSig.signerName.toUpperCase(),
          image: validReviewerSig.signatureData,
          signatureId: validReviewerSig.id,
          metadata: getMetadataForSignature(validReviewerSig.id, 'REVIEWER'),
        }
      } : {}),
      ...(validAdminSig ? {
        admin: {
          name: validAdminSig.signerName.toUpperCase(),
          image: validAdminSig.signatureData,
          signatureId: validAdminSig.id,
          metadata: getMetadataForSignature(validAdminSig.id, 'ADMIN'),
        }
      } : {}),
      ...(validCustomerSig ? {
        customer: {
          name: validCustomerSig.signerName.toUpperCase(),
          companyName: certificate.customerName || '',
          email: validCustomerSig.signerEmail,
          image: validCustomerSig.signatureData,
          signedAt: validCustomerSig.signedAt.toISOString(),
          signatureId: validCustomerSig.id,
          metadata: getMetadataForSignature(validCustomerSig.id, 'CUSTOMER'),
        }
      } : {}),
    } : undefined

    // Transform to response format
    const certificateData = {
      id: certificate.id,
      certificateNumber: certificate.certificateNumber,
      status: certificate.status,
      currentRevision: certificate.currentRevision,
      customerName: certificate.customerName,
      customerAddress: certificate.customerAddress,
      uucDescription: certificate.uucDescription,
      uucMake: certificate.uucMake,
      uucModel: certificate.uucModel,
      uucSerialNumber: certificate.uucSerialNumber,
      uucInstrumentId: certificate.uucInstrumentId,
      uucLocationName: certificate.uucLocationName,
      uucMachineName: certificate.uucMachineName,
      dateOfCalibration: certificate.dateOfCalibration?.toISOString() || null,
      calibrationDueDate: certificate.calibrationDueDate?.toISOString() || null,
      createdBy: certificate.createdBy,
      createdAt: certificate.createdAt.toISOString(),
      updatedAt: certificate.updatedAt.toISOString(),
    }

    // Full form data for PDF generation
    const formData = {
      signatures,
      certificateNumber: certificate.certificateNumber,
      status: certificate.status,
      lastSaved: certificate.updatedAt,
      calibratedAt: certificate.calibratedAt || 'LAB',
      srfNumber: certificate.srfNumber || '',
      srfDate: certificate.srfDate?.toISOString().split('T')[0] || '',
      dateOfCalibration: certificate.dateOfCalibration?.toISOString().split('T')[0] || '',
      calibrationTenure: certificate.calibrationTenure || 12,
      dueDateAdjustment: certificate.dueDateAdjustment || 0,
      calibrationDueDate: certificate.calibrationDueDate?.toISOString().split('T')[0] || '',
      dueDateNotApplicable: certificate.dueDateNotApplicable || false,
      customerName: certificate.customerName || '',
      customerAddress: certificate.customerAddress || '',
      uucDescription: certificate.uucDescription || '',
      uucMake: certificate.uucMake || '',
      uucModel: certificate.uucModel || '',
      uucSerialNumber: certificate.uucSerialNumber || '',
      uucInstrumentId: certificate.uucInstrumentId || '',
      uucLocationName: certificate.uucLocationName || '',
      uucMachineName: certificate.uucMachineName || '',
      parameters: certificate.parameters.map((param) => ({
        id: param.id,
        parameterName: param.parameterName || '',
        parameterUnit: param.parameterUnit || '',
        rangeMin: param.rangeMin || '',
        rangeMax: param.rangeMax || '',
        rangeUnit: param.rangeUnit || '',
        operatingMin: param.operatingMin || '',
        operatingMax: param.operatingMax || '',
        operatingUnit: param.operatingUnit || '',
        leastCountValue: param.leastCountValue || '',
        leastCountUnit: param.leastCountUnit || '',
        accuracyValue: param.accuracyValue || '',
        accuracyUnit: param.accuracyUnit || '',
        accuracyType: param.accuracyType || 'ABSOLUTE',
        requiresBinning: param.requiresBinning || false,
        bins: safeJsonParse<ParameterBin[]>(param.bins, []),
        errorFormula: param.errorFormula || 'A-B',
        showAfterAdjustment: param.showAfterAdjustment || false,
        masterInstrumentId: param.masterInstrumentId ? parseInt(param.masterInstrumentId) : null,
        sopReference: param.sopReference || '',
        results: param.results.map((result) => ({
          id: result.id,
          pointNumber: result.pointNumber,
          standardReading: result.standardReading || '',
          beforeAdjustment: result.beforeAdjustment || '',
          afterAdjustment: result.afterAdjustment || '',
          errorObserved: result.errorObserved,
          isOutOfLimit: result.isOutOfLimit || false,
        })),
      })),
      masterInstruments: certificate.masterInstruments.map((mi) => ({
        id: mi.id,
        masterInstrumentId: parseInt(mi.masterInstrumentId) || 0,
        category: mi.category || '',
        description: mi.description || '',
        make: mi.make || '',
        model: mi.model || '',
        assetNo: mi.assetNo || '',
        serialNumber: mi.serialNumber || '',
        calibratedAt: mi.calibratedAt || '',
        reportNo: mi.reportNo || '',
        calibrationDueDate: mi.calibrationDueDate || '',
        isExpired: false,
        isExpiringSoon: false,
      })),
      ambientTemperature: certificate.ambientTemperature || '',
      relativeHumidity: certificate.relativeHumidity || '',
      calibrationStatus: safeJsonParse<string[]>(certificate.calibrationStatus, []),
      stickerOldRemoved: certificate.stickerOldRemoved || null,
      stickerNewAffixed: certificate.stickerNewAffixed || null,
      statusNotes: certificate.statusNotes || '',
      selectedConclusionStatements: safeJsonParse<string[]>(certificate.selectedConclusionStatements, []),
      additionalConclusionStatement: certificate.additionalConclusionStatement || '',
      engineerNotes: '',
    }

    return NextResponse.json({
      certificate: certificateData,
      formData,
      revisionHistory,
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch certificate for authorization')
    return NextResponse.json(
      { error: 'Failed to fetch certificate' },
      { status: 500 }
    )
  }
}
