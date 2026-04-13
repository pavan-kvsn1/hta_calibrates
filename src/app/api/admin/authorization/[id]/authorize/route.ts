import { NextRequest, NextResponse } from 'next/server'
import crypto from 'crypto'
import { prisma } from '@/lib/prisma'
import { auth, canAccessAdmin } from '@/lib/auth'
import { appendSigningEvidence, collectServerEvidence, CONSENT_TEXT, CONSENT_VERSION } from '@/lib/stores/signing-evidence'
import { enqueue } from '@/lib/services/queue'
import { certificateLogger as logger } from '@/lib/logger'

export async function POST(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user || !canAccessAdmin(session.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const {
      signatureData,
      signerName,
      clientEvidence,
      // Optional: send download link to customer
      sendDownloadLink,
      customerEmail,
      customerName,
    } = body

    if (!signatureData || !signerName) {
      return NextResponse.json(
        { error: 'Signature data and signer name are required' },
        { status: 400 }
      )
    }

    // Validate customer info if sending download link
    if (sendDownloadLink) {
      if (!customerEmail?.trim() || !customerName?.trim()) {
        return NextResponse.json(
          { error: 'Customer email and name are required to send download link' },
          { status: 400 }
        )
      }
    }

    // Get certificate
    const certificate = await prisma.certificate.findUnique({
      where: { id },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    if (certificate.status !== 'PENDING_ADMIN_AUTHORIZATION') {
      return NextResponse.json(
        { error: 'Certificate is not pending admin authorization' },
        { status: 400 }
      )
    }

    // Create admin signature and update certificate status in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Check for existing admin signature and remove it
      await tx.signature.deleteMany({
        where: {
          certificateId: id,
          signerType: 'ADMIN',
        },
      })

      // Create new admin signature
      const signature = await tx.signature.create({
        data: {
          certificateId: id,
          signerType: 'ADMIN',
          signerName: signerName.toUpperCase(),
          signerEmail: session.user.email,
          signatureData,
          signedAt: new Date(),
        },
      })

      // Update certificate status to AUTHORIZED and clear cached PDF so it regenerates with admin signature
      const updatedCertificate = await tx.certificate.update({
        where: { id },
        data: {
          status: 'AUTHORIZED',
          lastModifiedById: session.user.id,
          signedPdfPath: null, // Clear cached PDF to force regeneration with admin signature
        },
      })

      // Get next event sequence
      const lastEvent = await tx.certificateEvent.findFirst({
        where: { certificateId: id },
        orderBy: { sequenceNumber: 'desc' },
      })
      const nextSequence = (lastEvent?.sequenceNumber ?? 0) + 1

      // Create certificate event
      await tx.certificateEvent.create({
        data: {
          certificateId: id,
          sequenceNumber: nextSequence,
          revision: updatedCertificate.currentRevision,
          eventType: 'ADMIN_AUTHORIZED',
          eventData: JSON.stringify({
            signerName: signerName.toUpperCase(),
            signerEmail: session.user.email,
            authorizedAt: new Date().toISOString(),
          }),
          userId: session.user.id,
          userRole: session.user.role,
        },
      })

      return { signature, certificate: updatedCertificate }
    })

    // Append signing evidence (outside transaction to avoid blocking)
    if (clientEvidence) {
      try {
        const serverEvidence = collectServerEvidence(request, 'direct')

        await appendSigningEvidence(
          id,
          result.signature.id,
          'ADMIN_SIGNED',
          {
            consentVersion: clientEvidence.consentVersion || CONSENT_VERSION,
            consentText: CONSENT_TEXT,
            consentAcceptedAt: clientEvidence.consentAcceptedAt
              ? new Date(clientEvidence.consentAcceptedAt).toISOString()
              : new Date().toISOString(),
            ...serverEvidence,
            clientTimestamp: clientEvidence.clientTimestamp
              ? new Date(clientEvidence.clientTimestamp).toISOString()
              : new Date().toISOString(),
            serverTimestamp: new Date().toISOString(),
            timezone: clientEvidence.timezone || 'Unknown',
            screenResolution: clientEvidence.screenResolution || 'Unknown',
            canvasSize: clientEvidence.canvasSize || { width: 400, height: 150 },
            sessionMethod: 'direct',
            signerType: 'ADMIN',
            signerName: signerName.toUpperCase(),
            signerEmail: session.user.email,
            signerId: session.user.id,
          },
          result.certificate.currentRevision
        )
      } catch (evidenceError) {
        logger.error({ err: evidenceError }, 'Failed to append signing evidence')
        // Don't fail the request if evidence capture fails
      }
    }

    // Generate signed PDF and send download link if requested
    let downloadLinkResult = null
    if (sendDownloadLink && customerEmail && customerName) {
      try {
        // Generate the signed PDF first
        const { generateSignedPDF } = await import('@/lib/services/pdf/generator')
        const { storePDF } = await import('@/lib/services/pdf/storage')

        const pdfBuffer = await generateSignedPDF(id)
        const pdfPath = await storePDF(id, pdfBuffer)

        // Update certificate with signed PDF path
        await prisma.certificate.update({
          where: { id },
          data: { signedPdfPath: pdfPath },
        })

        // Create download token
        const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
        const token = crypto.randomUUID()
        const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

        const downloadToken = await prisma.downloadToken.create({
          data: {
            token,
            certificateId: id,
            customerEmail: customerEmail.toLowerCase().trim(),
            customerName: customerName.trim(),
            expiresAt,
            maxDownloads: 5,
            sentById: session.user.id,
          },
        })

        // Log the download link sent event
        const lastEvent = await prisma.certificateEvent.findFirst({
          where: { certificateId: id },
          orderBy: { sequenceNumber: 'desc' },
        })

        await prisma.certificateEvent.create({
          data: {
            certificateId: id,
            sequenceNumber: (lastEvent?.sequenceNumber || 0) + 1,
            revision: result.certificate.currentRevision,
            eventType: 'DOWNLOAD_LINK_SENT',
            eventData: JSON.stringify({
              customerEmail: customerEmail.toLowerCase().trim(),
              customerName: customerName.trim(),
              tokenId: downloadToken.id,
              expiresAt: expiresAt.toISOString(),
              sentBy: session.user.name,
            }),
            userId: session.user.id,
            userRole: session.user.role,
          },
        })

        const downloadUrl = `${baseUrl}/customer/download/${token}`

        // Send email to customer
        await enqueue('email:send', {
          to: customerEmail.toLowerCase().trim(),
          template: 'certificate-download-ready',
          templateData: {
            customerName: customerName.trim(),
            certificateNumber: certificate.certificateNumber,
            instrumentDescription: certificate.uucDescription || 'Calibration Certificate',
            serialNumber: certificate.uucSerialNumber || '',
            calibrationDate: certificate.dateOfCalibration
              ? new Date(certificate.dateOfCalibration).toLocaleDateString('en-US', {
                  year: 'numeric',
                  month: 'long',
                  day: 'numeric',
                })
              : '',
            downloadUrl,
          },
        })

        downloadLinkResult = {
          sent: true,
          downloadUrl,
          customerEmail: customerEmail.toLowerCase().trim(),
        }
      } catch (downloadLinkError) {
        logger.error({ err: downloadLinkError }, 'Failed to send download link')
        // Don't fail the authorization if download link fails
        downloadLinkResult = {
          sent: false,
          error: 'Failed to send download link. You can send it manually later.',
        }
      }
    }

    return NextResponse.json({
      success: true,
      certificate: {
        id: result.certificate.id,
        status: result.certificate.status,
      },
      downloadLink: downloadLinkResult,
    })
  } catch (error) {
    logger.error({ err: error }, 'Error authorizing certificate')
    return NextResponse.json(
      { error: 'Failed to authorize certificate' },
      { status: 500 }
    )
  }
}
