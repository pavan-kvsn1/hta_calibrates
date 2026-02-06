import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params

    // Check if this is a session-based access (cert:ID format)
    if (token.startsWith('cert:')) {
      const certificateId = token.substring(5)
      return handleSessionBasedAccess(certificateId)
    }

    // Token-based access
    const tokenRecord = await prisma.approvalToken.findUnique({
      where: { token },
      include: {
        customer: true,
      },
    })

    if (!tokenRecord) {
      return NextResponse.json({ error: 'Invalid token' }, { status: 404 })
    }

    if (tokenRecord.usedAt) {
      return NextResponse.json(
        { error: 'This certificate has already been reviewed' },
        { status: 400 }
      )
    }

    if (new Date() > tokenRecord.expiresAt) {
      return NextResponse.json(
        { error: 'This review link has expired' },
        { status: 400 }
      )
    }

    // Fetch full certificate data
    const certificate = await getFullCertificateData(tokenRecord.certificateId)

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    return NextResponse.json(certificate)
  } catch (error) {
    console.error('Error fetching certificate for customer review:', error)
    return NextResponse.json(
      { error: 'Failed to fetch certificate data' },
      { status: 500 }
    )
  }
}

async function handleSessionBasedAccess(certificateId: string) {
  // Verify customer session
  const session = await auth()
  if (!session?.user || session.user.role !== 'CUSTOMER') {
    return NextResponse.json(
      { error: 'Unauthorized - please log in' },
      { status: 401 }
    )
  }

  const customerEmail = session.user.email!

  // Get customer info
  const customer = await prisma.customerUser.findUnique({
    where: { email: customerEmail },
  })

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  // Get certificate
  const certificate = await prisma.certificate.findUnique({
    where: { id: certificateId },
  })

  if (!certificate) {
    return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
  }

  // Verify access: certificate's customerName must match customer's companyName
  if (certificate.customerName?.toLowerCase() !== customer.companyName.toLowerCase()) {
    return NextResponse.json(
      { error: 'You do not have permission to view this certificate' },
      { status: 403 }
    )
  }

  // Allow access for both PENDING_CUSTOMER_APPROVAL and CUSTOMER_REVISION_REQUIRED (for HoD replies)
  if (certificate.status !== 'PENDING_CUSTOMER_APPROVAL' && certificate.status !== 'CUSTOMER_REVISION_REQUIRED') {
    return NextResponse.json(
      { error: 'Certificate is not available for review' },
      { status: 400 }
    )
  }

  // Fetch full certificate data
  const fullCertificate = await getFullCertificateData(certificateId)

  if (!fullCertificate) {
    return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
  }

  return NextResponse.json(fullCertificate)
}

async function getFullCertificateData(certificateId: string) {
  const certificate = await prisma.certificate.findUnique({
    where: { id: certificateId },
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
    return null
  }

  // Fetch signature records for this certificate
  const dbSignatures = await prisma.signature.findMany({
    where: { certificateId },
    orderBy: { signedAt: 'desc' },
  })

  const engineerSig = dbSignatures.find(s => s.signerType === 'ENGINEER')
  const hodSig = dbSignatures.find(s => s.signerType === 'HOD')
  const customerSig = dbSignatures.find(s => s.signerType === 'CUSTOMER')

  const signatures = (engineerSig || hodSig || customerSig) ? {
    ...(engineerSig ? {
      engineer: { name: engineerSig.signerName.toUpperCase(), image: engineerSig.signatureData }
    } : {}),
    ...(hodSig ? {
      hod: { name: hodSig.signerName.toUpperCase(), image: hodSig.signatureData }
    } : {}),
    ...(customerSig ? {
      customer: {
        name: customerSig.signerName.toUpperCase(),
        companyName: certificate.customerName || '',
        email: customerSig.signerEmail,
        image: customerSig.signatureData,
        signedAt: customerSig.signedAt.toISOString(),
        signatureId: customerSig.id,
      }
    } : {}),
  } : undefined

  // Transform to CertificateFormData format for PDF generation
  return {
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
      bins: param.bins ? JSON.parse(param.bins as string) : [],
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
    calibrationStatus: certificate.calibrationStatus
      ? JSON.parse(certificate.calibrationStatus as string)
      : [],
    stickerOldRemoved: certificate.stickerOldRemoved || null,
    stickerNewAffixed: certificate.stickerNewAffixed || null,
    statusNotes: certificate.statusNotes || '',

    // Section 7: Conclusion Statements
    selectedConclusionStatements: certificate.selectedConclusionStatements
      ? JSON.parse(certificate.selectedConclusionStatements as string)
      : [],

    // Engineer notes
    engineerNotes: '',
  }
}
