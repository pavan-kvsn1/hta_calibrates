import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, canAccessAdmin } from '@/lib/auth'
import { appendSigningEvidence, collectServerEvidence, CONSENT_TEXT, CONSENT_VERSION } from '@/lib/signing-evidence'

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
    const { signatureData, signerName, clientEvidence } = body

    if (!signatureData || !signerName) {
      return NextResponse.json(
        { error: 'Signature data and signer name are required' },
        { status: 400 }
      )
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
        console.error('Failed to append signing evidence:', evidenceError)
        // Don't fail the request if evidence capture fails
      }
    }

    return NextResponse.json({
      success: true,
      certificate: {
        id: result.certificate.id,
        status: result.certificate.status,
      },
    })
  } catch (error) {
    console.error('Error authorizing certificate:', error)
    return NextResponse.json(
      { error: 'Failed to authorize certificate' },
      { status: 500 }
    )
  }
}
