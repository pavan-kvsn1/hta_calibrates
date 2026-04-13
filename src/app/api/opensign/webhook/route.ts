import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { downloadSignedPdf, type WebhookPayload } from '@/lib/services/opensign'
import { storePDF } from '@/lib/services/pdf/storage'
import { createLogger } from '@/lib/logger'

const logger = createLogger('opensign')

/**
 * POST /api/opensign/webhook
 *
 * Receives webhook events from the self-hosted OpenSign instance.
 * Handles document signing completion, declination, and status updates.
 *
 * Events handled:
 *   - document.completed: Document has been signed by all signers
 *   - document.signed: A signer has signed (intermediate event)
 *   - document.declined: A signer has declined to sign
 */
export async function POST(request: NextRequest) {
  try {
    const payload = (await request.json()) as WebhookPayload

    if (!payload.event || !payload.documentId) {
      return NextResponse.json({ error: 'Invalid webhook payload' }, { status: 400 })
    }

    // Find the matching OpenSign document record
    const openSignDoc = await prisma.openSignDocument.findUnique({
      where: { openSignDocumentId: payload.documentId },
      include: { certificate: true },
    })

    if (!openSignDoc) {
      // Document not tracked by us — could be from a different system or stale
      logger.warn({ documentId: payload.documentId }, 'OpenSign webhook received for unknown document')
      return NextResponse.json({ received: true, ignored: true })
    }

    switch (payload.event) {
      case 'document.completed': {
        // Document fully signed — download the signed PDF and store it
        await handleDocumentCompleted(openSignDoc, payload)
        break
      }

      case 'document.signed': {
        // Intermediate: a signer signed but document may have more signers
        await prisma.openSignDocument.update({
          where: { id: openSignDoc.id },
          data: {
            status: 'SIGNED',
            ...(payload.signedDocumentUrl ? { signedPdfUrl: payload.signedDocumentUrl } : {}),
            ...(payload.auditTrailUrl ? { auditTrailUrl: payload.auditTrailUrl } : {}),
          },
        })
        break
      }

      case 'document.declined': {
        await prisma.openSignDocument.update({
          where: { id: openSignDoc.id },
          data: { status: 'DECLINED' },
        })
        break
      }

      default:
        logger.warn({ event: payload.event }, 'OpenSign webhook received unhandled event type')
    }

    return NextResponse.json({ received: true })
  } catch (error) {
    logger.error({ err: error }, 'OpenSign webhook processing failed')
    return NextResponse.json(
      { error: 'Webhook processing failed' },
      { status: 500 }
    )
  }
}

/**
 * Handle a document.completed event:
 * 1. Download the OpenSign-signed PDF (includes digital certificate + audit trail)
 * 2. Store it, replacing the locally-generated PDF
 * 3. Update the OpenSignDocument and Certificate records
 */
async function handleDocumentCompleted(
  openSignDoc: { id: string; certificateId: string; signerType: string },
  payload: WebhookPayload
) {
  // Download the signed PDF from OpenSign if a URL is provided
  if (payload.signedDocumentUrl) {
    try {
      const signedPdfBuffer = await downloadSignedPdf(payload.signedDocumentUrl)
      const storedPath = await storePDF(openSignDoc.certificateId, signedPdfBuffer)

      // Update certificate's signedPdfPath to point to the OpenSign-signed version
      await prisma.certificate.update({
        where: { id: openSignDoc.certificateId },
        data: { signedPdfPath: storedPath },
      })
    } catch (pdfError) {
      logger.error({ err: pdfError, certificateId: openSignDoc.certificateId }, 'Failed to download/store OpenSign PDF')
      // The locally-generated PDF still exists as fallback
    }
  }

  // Update the OpenSign document record
  await prisma.openSignDocument.update({
    where: { id: openSignDoc.id },
    data: {
      status: 'SIGNED',
      ...(payload.signedDocumentUrl ? { signedPdfUrl: payload.signedDocumentUrl } : {}),
      ...(payload.auditTrailUrl ? { auditTrailUrl: payload.auditTrailUrl } : {}),
    },
  })
}
