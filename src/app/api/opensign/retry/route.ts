import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import {
  isOpenSignHealthy,
  selfSignDocument,
  getSignatureWidgets,
  withRetry,
} from '@/lib/opensign'
import { generateSignedPDF, getPageCountFromBuffer } from '@/lib/pdf-generator'

/**
 * POST /api/opensign/retry
 *
 * Manually re-trigger OpenSign digital signing for a certificate
 * that was approved locally but failed to sign via OpenSign.
 *
 * Body: { certificateId }
 *
 * Restricted to HOD and ADMIN roles.
 */
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'HOD' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { certificateId } = await request.json()

    if (!certificateId) {
      return NextResponse.json({ error: 'certificateId is required' }, { status: 400 })
    }

    // Validate certificate
    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
      include: {
        signatures: {
          orderBy: { signedAt: 'desc' },
        },
      },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    if (certificate.status !== 'APPROVED' && certificate.status !== 'PENDING_CUSTOMER_APPROVAL') {
      return NextResponse.json(
        { error: 'Certificate must be APPROVED or PENDING_CUSTOMER_APPROVAL to retry OpenSign signing' },
        { status: 400 }
      )
    }

    // Check OpenSign health
    const healthy = await isOpenSignHealthy()
    if (!healthy) {
      return NextResponse.json(
        { error: 'OpenSign service is currently unavailable' },
        { status: 503 }
      )
    }

    // Generate fresh PDF
    const pdfBuffer = await generateSignedPDF(certificateId)
    const pdfBase64 = pdfBuffer.toString('base64')
    const pageCount = getPageCountFromBuffer(pdfBuffer)
    const title = `Calibration Certificate ${certificate.certificateNumber}`

    const results: Array<{ signerType: string; documentId: string }> = []

    // Find signatures that need OpenSign processing
    const hodSig = certificate.signatures.find(s => s.signerType === 'HOD')
    const customerSig = certificate.signatures.find(s => s.signerType === 'CUSTOMER')

    // Check which signer types already have an OpenSign document
    const existingDocs = await prisma.openSignDocument.findMany({
      where: { certificateId, status: 'SIGNED' },
    })
    const signedTypes = new Set(existingDocs.map(d => d.signerType))

    // Re-sign for HoD if not already processed
    if (hodSig && !signedTypes.has('HOD')) {
      const widgets = getSignatureWidgets('HOD', pageCount)
      const result = await withRetry(() =>
        selfSignDocument({
          file: pdfBase64,
          title,
          signerName: hodSig.signerName,
          signerEmail: hodSig.signerEmail,
          widgets,
        })
      )

      await prisma.openSignDocument.create({
        data: {
          certificateId,
          openSignDocumentId: result.documentId,
          signerType: 'HOD',
          signerEmail: hodSig.signerEmail,
          status: 'SIGNED',
          signedPdfUrl: result.signedPdfUrl,
          auditTrailUrl: result.auditTrailUrl,
        },
      })

      results.push({ signerType: 'HOD', documentId: result.documentId })
    }

    // Re-sign for customer if not already processed
    if (customerSig && !signedTypes.has('CUSTOMER')) {
      const widgets = getSignatureWidgets('CUSTOMER', pageCount)
      const result = await withRetry(() =>
        selfSignDocument({
          file: pdfBase64,
          title,
          signerName: customerSig.signerName,
          signerEmail: customerSig.signerEmail,
          widgets,
        })
      )

      await prisma.openSignDocument.create({
        data: {
          certificateId,
          openSignDocumentId: result.documentId,
          signerType: 'CUSTOMER',
          signerEmail: customerSig.signerEmail,
          status: 'SIGNED',
          signedPdfUrl: result.signedPdfUrl,
          auditTrailUrl: result.auditTrailUrl,
        },
      })

      results.push({ signerType: 'CUSTOMER', documentId: result.documentId })
    }

    if (results.length === 0) {
      return NextResponse.json({
        success: true,
        message: 'All signatures already have OpenSign documents — nothing to retry',
        results: [],
      })
    }

    return NextResponse.json({
      success: true,
      message: `Successfully submitted ${results.length} signature(s) to OpenSign`,
      results,
    })
  } catch (error) {
    console.error('OpenSign retry error:', error)
    return NextResponse.json(
      { error: 'Failed to retry OpenSign signing', details: error instanceof Error ? error.message : 'Unknown error' },
      { status: 500 }
    )
  }
}
