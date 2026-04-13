import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { parseUserAgent, type SigningMetadata } from '@/components/pdf/pdf-utils'
import { safeJsonParse } from '@/lib/utils/safe-json'
import type { ParameterBin } from '@/lib/stores/certificate-store'
import { certificateLogger as logger } from '@/lib/logger'

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
        reviewer: {
          select: { id: true },
        },
      },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Check access - allow creator, reviewer, ADMIN, or CUSTOMER with matching company
    const isCreator = certificate.createdBy.id === session.user.id
    const isReviewer = certificate.reviewer?.id === session.user.id
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
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

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
      // First try to match by signatureId
      let evidence = signatureId
        ? signingEvidence.find(e => e.signatureId === signatureId)
        : null

      // Fallback: match by event type
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

    // Only include signatures that have evidence for the current revision
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

    // Transform to CertificateFormData format for PDF generation
    return NextResponse.json({
      signatures,
      // Meta
      certificateNumber: certificate.certificateNumber,
      status: certificate.status,
      lastSaved: certificate.updatedAt,

      // Section 1: Summary
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
      customerContactName: certificate.customerContactName || '',

      // Section 2: UUC Details
      uucDescription: certificate.uucDescription || '',
      uucMake: certificate.uucMake || '',
      uucModel: certificate.uucModel || '',
      uucSerialNumber: certificate.uucSerialNumber || '',
      uucInstrumentId: certificate.uucInstrumentId || '',
      uucLocationName: certificate.uucLocationName || '',
      uucMachineName: certificate.uucMachineName || '',

      // Parameters with results
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

      // Section 3: Master Instruments
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

      // Section 4: Environmental Conditions
      ambientTemperature: certificate.ambientTemperature || '',
      relativeHumidity: certificate.relativeHumidity || '',

      // Section 6: Remarks
      calibrationStatus: safeJsonParse<string[]>(certificate.calibrationStatus, []),
      stickerOldRemoved: certificate.stickerOldRemoved || null,
      stickerNewAffixed: certificate.stickerNewAffixed || null,
      statusNotes: certificate.statusNotes || '',

      // Section 7: Conclusion Statements
      selectedConclusionStatements: safeJsonParse<string[]>(certificate.selectedConclusionStatements, []),
      additionalConclusionStatement: certificate.additionalConclusionStatement || '',

      // Engineer notes
      engineerNotes: '',
    })
  } catch (error) {
    logger.error({ err: error }, 'Error fetching certificate PDF data')
    return NextResponse.json(
      { error: 'Failed to fetch certificate data' },
      { status: 500 }
    )
  }
}
