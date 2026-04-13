import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import {
  createDocument,
  selfSignDocument,
  getSignatureWidgets,
  isOpenSignHealthy,
  withRetry,
} from '@/lib/services/opensign'
import { generateSignedPDF, getPageCountFromBuffer } from '@/lib/services/pdf/generator'
import { createLogger } from '@/lib/logger'

const logger = createLogger('opensign')

/**
 * POST /api/opensign/send-for-signature
 *
 * Send a certificate PDF to OpenSign for digital signing.
 * Two modes:
 *   1. "create" – Send to external signer via email (OpenSign sends the email)
 *   2. "selfsign" – Portal-centric flow where signature was already captured
 *      in HTA and we just need OpenSign for legal compliance
 *
 * Body:
 *   { certificateId, signerType, signerEmail, signerName, mode?, signatureData? }
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN can trigger OpenSign signing
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const {
      certificateId,
      signerType,
      signerEmail,
      signerName,
      mode = 'selfsign',
    } = body as {
      certificateId: string
      signerType: 'REVIEWER' | 'CUSTOMER'
      signerEmail: string
      signerName: string
      mode?: 'create' | 'selfsign'
    }

    if (!certificateId || !signerType || !signerEmail || !signerName) {
      return NextResponse.json(
        { error: 'Missing required fields: certificateId, signerType, signerEmail, signerName' },
        { status: 400 }
      )
    }

    // Validate certificate exists and is in an appropriate status
    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Check OpenSign availability
    const healthy = await isOpenSignHealthy()
    if (!healthy) {
      return NextResponse.json(
        { error: 'OpenSign service is unavailable. Signature was captured locally — digital signing can be retried later.' },
        { status: 503 }
      )
    }

    // Generate the PDF to send to OpenSign
    const pdfBuffer = await generateSignedPDF(certificateId)
    const pdfBase64 = pdfBuffer.toString('base64')

    // Determine page count for widget positioning
    const pageCount = getPageCountFromBuffer(pdfBuffer)

    // Get widget positions for the signer type
    const widgets = getSignatureWidgets(signerType, pageCount)

    const title = `Calibration Certificate ${certificate.certificateNumber}`

    if (mode === 'create') {
      // Mode 1: Send to external signer via OpenSign email
      const result = await withRetry(() =>
        createDocument({
          file: pdfBase64,
          title,
          signers: [{ name: signerName, email: signerEmail, role: signerType }],
          widgets,
          sendEmail: true,
          emailSubject: `Please sign: ${title}`,
          emailBody: `Dear ${signerName},\n\nPlease review and sign the attached calibration certificate.\n\nRegards,\nHTA Instrumentation`,
        })
      )

      // Store the OpenSign document reference
      await prisma.openSignDocument.create({
        data: {
          certificateId,
          openSignDocumentId: result.documentId,
          signerType,
          signerEmail,
          status: 'PENDING',
          signingUrl: result.signingUrl,
        },
      })

      return NextResponse.json({
        success: true,
        mode: 'create',
        documentId: result.documentId,
        signingUrl: result.signingUrl,
      })
    } else {
      // Mode 2: Self-sign (portal-centric — signature already captured in HTA)
      const result = await withRetry(() =>
        selfSignDocument({
          file: pdfBase64,
          title,
          signerName,
          signerEmail,
          widgets,
        })
      )

      // Store the OpenSign document reference
      await prisma.openSignDocument.create({
        data: {
          certificateId,
          openSignDocumentId: result.documentId,
          signerType,
          signerEmail,
          status: 'SIGNED',
          signedPdfUrl: result.signedPdfUrl,
          auditTrailUrl: result.auditTrailUrl,
        },
      })

      return NextResponse.json({
        success: true,
        mode: 'selfsign',
        documentId: result.documentId,
        signedPdfUrl: result.signedPdfUrl,
        auditTrailUrl: result.auditTrailUrl,
      })
    }
  } catch (error) {
    logger.error({ err: error }, 'Failed to send document for signature')
    return NextResponse.json(
      { error: 'Failed to send document for signature', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
