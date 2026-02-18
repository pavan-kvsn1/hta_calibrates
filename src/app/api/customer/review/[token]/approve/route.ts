import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { notifyOnCustomerApproval } from '@/lib/notifications'
import { isOpenSignHealthy, selfSignDocument, getSignatureWidgets, withRetry } from '@/lib/opensign'
import { getPageCountFromBuffer } from '@/lib/pdf-generator'
import {
  appendSigningEvidence,
  collectServerEvidence,
  buildSigningEvidencePayload,
  type ClientEvidence,
} from '@/lib/signing-evidence'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ token: string }> }
) {
  try {
    const { token } = await params
    const { signatureData, signerName, signerEmail, clientEvidence } = await request.json() as {
      signatureData: string
      signerName: string
      signerEmail?: string
      clientEvidence?: ClientEvidence
    }

    if (!signatureData || !signerName) {
      return NextResponse.json(
        { error: 'Signature and name are required' },
        { status: 400 }
      )
    }

    // Check if this is a session-based access (cert:ID format)
    if (token.startsWith('cert:')) {
      const certificateId = token.substring(5)
      return handleSessionBasedApproval(request, certificateId, signatureData, signerName, signerEmail, clientEvidence)
    }

    // Validate token
    const tokenRecord = await prisma.approvalToken.findUnique({
      where: { token },
      include: {
        certificate: {
          include: { createdBy: true },
        },
        customer: true,
      },
    })

    if (!tokenRecord) {
      return NextResponse.json(
        { error: 'Invalid token' },
        { status: 404 }
      )
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

    // Allow approval for both PENDING_CUSTOMER_APPROVAL and CUSTOMER_REVISION_REQUIRED (after HoD reply)
    if (tokenRecord.certificate.status !== 'PENDING_CUSTOMER_APPROVAL' && tokenRecord.certificate.status !== 'CUSTOMER_REVISION_REQUIRED') {
      return NextResponse.json(
        { error: 'Certificate is not available for approval' },
        { status: 400 }
      )
    }

    // Validate signer name matches customer's registered name
    if (tokenRecord.customer.name && signerName.trim().toLowerCase() !== tokenRecord.customer.name.toLowerCase()) {
      return NextResponse.json(
        { error: 'Signer name must match your registered name' },
        { status: 400 }
      )
    }

    const now = new Date()

    // Use transaction to ensure all updates happen together
    const { customerSignature } = await prisma.$transaction(async (tx) => {
      // 1. Create customer signature
      const signature = await tx.signature.create({
        data: {
          certificateId: tokenRecord.certificateId,
          signerType: 'CUSTOMER',
          signerName,
          signerEmail: signerEmail || tokenRecord.customer.email,
          signatureData,
          customerId: tokenRecord.customerId,
        },
      })

      // 2. Update certificate status to PENDING_ADMIN_AUTHORIZATION
      await tx.certificate.update({
        where: { id: tokenRecord.certificateId },
        data: {
          status: 'PENDING_ADMIN_AUTHORIZATION',
          updatedAt: now,
        },
      })

      // 3. Mark token as used
      await tx.approvalToken.update({
        where: { id: tokenRecord.id },
        data: { usedAt: now },
      })

      // 4. Log event
      const lastEvent = await tx.certificateEvent.findFirst({
        where: { certificateId: tokenRecord.certificateId },
        orderBy: { sequenceNumber: 'desc' },
      })

      await tx.certificateEvent.create({
        data: {
          certificateId: tokenRecord.certificateId,
          sequenceNumber: (lastEvent?.sequenceNumber || 0) + 1,
          revision: tokenRecord.certificate.currentRevision,
          eventType: 'CUSTOMER_APPROVED',
          eventData: JSON.stringify({
            signerName,
            signerEmail: signerEmail || tokenRecord.customer.email,
            customerCompany: tokenRecord.customer.companyName,
            approvedAt: now.toISOString(),
          }),
          customerId: tokenRecord.customer.id,
          userRole: 'CUSTOMER',
        },
      })

      return { customerSignature: signature }
    })

    // Capture customer signing evidence (Layer 1-4) if client evidence provided
    if (clientEvidence) {
      try {
        const serverEvidence = collectServerEvidence(request, 'token')
        const evidencePayload = buildSigningEvidencePayload(
          clientEvidence,
          serverEvidence,
          {
            signerType: 'CUSTOMER',
            signerName,
            signerEmail: signerEmail || tokenRecord.customer.email,
            customerId: tokenRecord.customerId,
            tokenId: tokenRecord.id,
            tokenEmail: tokenRecord.customer.email,
          }
        )
        await appendSigningEvidence(tokenRecord.certificateId, customerSignature.id, 'CUSTOMER_SIGNED', evidencePayload, tokenRecord.certificate.currentRevision)
      } catch (evidenceError) {
        // Log but don't fail the approval if evidence capture fails
        console.error('Failed to capture customer signing evidence:', evidenceError)
      }
    }

    // Notify HoD and engineer about customer approval (fire and forget)
    notifyOnCustomerApproval({
      certificateId: tokenRecord.certificateId,
      certificateNumber: tokenRecord.certificate.certificateNumber,
      engineerId: tokenRecord.certificate.createdById,
    }).catch((err) => console.error('Failed to send notification:', err))

    // Generate signed PDF (best-effort — don't fail the approval)
    try {
      const { generateSignedPDF } = await import('@/lib/pdf-generator')
      const { storePDF } = await import('@/lib/pdf-storage')

      const pdfBuffer = await generateSignedPDF(tokenRecord.certificateId)
      const pdfPath = await storePDF(tokenRecord.certificateId, pdfBuffer)

      await prisma.certificate.update({
        where: { id: tokenRecord.certificateId },
        data: { signedPdfPath: pdfPath },
      })

      // Send to OpenSign for digital signing (best-effort)
      sendToOpenSign(
        tokenRecord.certificateId,
        tokenRecord.certificate.certificateNumber,
        signerEmail || tokenRecord.customer.email,
        signerName,
        pdfBuffer
      ).catch((err) => console.error('OpenSign customer signing failed (non-blocking):', err))
    } catch (pdfError) {
      console.error('Failed to generate signed PDF:', pdfError)
      // Approval still succeeded — PDF can be regenerated later
    }

    return NextResponse.json({
      success: true,
      message: 'Certificate approved successfully',
    })
  } catch (error) {
    console.error('Error approving certificate:', error)
    return NextResponse.json(
      { error: 'Failed to approve certificate' },
      { status: 500 }
    )
  }
}

// Handle session-based approval (for customers accessing via dashboard without token)
async function handleSessionBasedApproval(
  request: NextRequest,
  certificateId: string,
  signatureData: string,
  signerName: string,
  signerEmail?: string,
  clientEvidence?: ClientEvidence
) {
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
    include: { customerAccount: true },
  })

  if (!customer) {
    return NextResponse.json(
      { error: 'Customer not found' },
      { status: 404 }
    )
  }

  // Get certificate with creator
  const certificate = await prisma.certificate.findUnique({
    where: { id: certificateId },
    include: { createdBy: true },
  })

  if (!certificate) {
    return NextResponse.json(
      { error: 'Certificate not found' },
      { status: 404 }
    )
  }

  // Verify access: certificate's customerName must match customer's companyName
  const customerCompanyName = customer.customerAccount?.companyName || customer.companyName
  if (!customerCompanyName || certificate.customerName?.toLowerCase() !== customerCompanyName.toLowerCase()) {
    return NextResponse.json(
      { error: 'You do not have permission to approve this certificate' },
      { status: 403 }
    )
  }

  // Allow approval for both PENDING_CUSTOMER_APPROVAL and CUSTOMER_REVISION_REQUIRED (after HoD reply)
  if (certificate.status !== 'PENDING_CUSTOMER_APPROVAL' && certificate.status !== 'CUSTOMER_REVISION_REQUIRED') {
    return NextResponse.json(
      { error: 'Certificate is not available for approval' },
      { status: 400 }
    )
  }

  // Validate signer name matches customer's registered name
  if (customer.name && signerName.trim().toLowerCase() !== customer.name.toLowerCase()) {
    return NextResponse.json(
      { error: 'Signer name must match your registered name' },
      { status: 400 }
    )
  }

  const now = new Date()

  // Use transaction to ensure all updates happen together
  const { customerSignature } = await prisma.$transaction(async (tx) => {
    // 1. Create customer signature
    const signature = await tx.signature.create({
      data: {
        certificateId: certificate.id,
        signerType: 'CUSTOMER',
        signerName,
        signerEmail: signerEmail || customerEmail,
        signatureData,
        customerId: customer.id,
      },
    })

    // 2. Update certificate status to PENDING_ADMIN_AUTHORIZATION
    await tx.certificate.update({
      where: { id: certificate.id },
      data: {
        status: 'PENDING_ADMIN_AUTHORIZATION',
        updatedAt: now,
      },
    })

    // 3. Log event
    const lastEvent = await tx.certificateEvent.findFirst({
      where: { certificateId: certificate.id },
      orderBy: { sequenceNumber: 'desc' },
    })

    await tx.certificateEvent.create({
      data: {
        certificateId: certificate.id,
        sequenceNumber: (lastEvent?.sequenceNumber || 0) + 1,
        revision: certificate.currentRevision,
        eventType: 'CUSTOMER_APPROVED',
        eventData: JSON.stringify({
          signerName,
          signerEmail: signerEmail || customerEmail,
          customerCompany: customer.companyName,
          approvedAt: now.toISOString(),
          accessMethod: 'session', // Indicates approval via dashboard, not token
        }),
        customerId: customer.id,
        userRole: 'CUSTOMER',
      },
    })

    return { customerSignature: signature }
  })

  // Capture customer signing evidence (Layer 1-4) if client evidence provided
  if (clientEvidence) {
    try {
      const serverEvidence = collectServerEvidence(request, 'session')
      const evidencePayload = buildSigningEvidencePayload(
        clientEvidence,
        serverEvidence,
        {
          signerType: 'CUSTOMER',
          signerName,
          signerEmail: signerEmail || customerEmail,
          customerId: customer.id,
        }
      )
      await appendSigningEvidence(certificate.id, customerSignature.id, 'CUSTOMER_SIGNED', evidencePayload, certificate.currentRevision)
    } catch (evidenceError) {
      // Log but don't fail the approval if evidence capture fails
      console.error('Failed to capture customer signing evidence:', evidenceError)
    }
  }

  // Notify HoD and engineer about customer approval (fire and forget)
  notifyOnCustomerApproval({
    certificateId: certificate.id,
    certificateNumber: certificate.certificateNumber,
    engineerId: certificate.createdById,
  }).catch((err) => console.error('Failed to send notification:', err))

  // Generate signed PDF (best-effort — don't fail the approval)
  try {
    const { generateSignedPDF } = await import('@/lib/pdf-generator')
    const { storePDF } = await import('@/lib/pdf-storage')

    const pdfBuffer = await generateSignedPDF(certificate.id)
    const pdfPath = await storePDF(certificate.id, pdfBuffer)

    await prisma.certificate.update({
      where: { id: certificate.id },
      data: { signedPdfPath: pdfPath },
    })

    // Send to OpenSign for digital signing (best-effort)
    sendToOpenSign(
      certificate.id,
      certificate.certificateNumber,
      signerEmail || customerEmail,
      signerName,
      pdfBuffer
    ).catch((err) => console.error('OpenSign customer signing failed (non-blocking):', err))
  } catch (pdfError) {
    console.error('Failed to generate signed PDF:', pdfError)
    // Approval still succeeded — PDF can be regenerated later
  }

  return NextResponse.json({
    success: true,
    message: 'Certificate approved successfully',
  })
}

/**
 * Send the customer-signed certificate to OpenSign for digital signing.
 * Best-effort: if OpenSign is unavailable, the local signature still stands.
 */
async function sendToOpenSign(
  certificateId: string,
  certificateNumber: string,
  customerEmail: string,
  customerName: string,
  pdfBuffer: Buffer
) {
  const healthy = await isOpenSignHealthy()
  if (!healthy) {
    console.warn('OpenSign unavailable — skipping digital signing for customer approval')
    return
  }

  const pdfBase64 = pdfBuffer.toString('base64')
  const pageCount = getPageCountFromBuffer(pdfBuffer)
  const widgets = getSignatureWidgets('CUSTOMER', pageCount)

  const result = await withRetry(() =>
    selfSignDocument({
      file: pdfBase64,
      title: `Calibration Certificate ${certificateNumber}`,
      signerName: customerName,
      signerEmail: customerEmail,
      widgets,
    })
  )

  await prisma.openSignDocument.create({
    data: {
      certificateId,
      openSignDocumentId: result.documentId,
      signerType: 'CUSTOMER',
      signerEmail: customerEmail,
      status: 'SIGNED',
      signedPdfUrl: result.signedPdfUrl,
      auditTrailUrl: result.auditTrailUrl,
    },
  })
}
