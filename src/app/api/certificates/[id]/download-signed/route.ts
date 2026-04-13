import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { readPDF } from '@/lib/services/pdf/storage'
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

    const { id: certificateId } = await params

    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    if (!['APPROVED', 'PENDING_ADMIN_AUTHORIZATION', 'AUTHORIZED'].includes(certificate.status)) {
      return NextResponse.json(
        { error: 'Certificate is not approved — signed PDF is not available' },
        { status: 400 }
      )
    }

    // Access control
    const userRole = session.user.role
    const userId = session.user.id

    if (userRole === 'ENGINEER') {
      if (certificate.createdById !== userId) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (userRole === 'CUSTOMER') {
      const customer = await prisma.customerUser.findUnique({
        where: { id: userId },
        include: { customerAccount: true },
      })
      const customerCompanyName = customer?.customerAccount?.companyName || customer?.companyName
      if (!customer || !customerCompanyName || certificate.customerName?.toLowerCase() !== customerCompanyName.toLowerCase()) {
        return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
      }
    } else if (userRole !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Try to read stored PDF, or generate on-the-fly as fallback
    let pdfBuffer: Buffer

    if (certificate.signedPdfPath) {
      try {
        pdfBuffer = await readPDF(certificate.signedPdfPath)
      } catch {
        // File missing from disk — regenerate
        pdfBuffer = await generateAndStore(certificateId)
      }
    } else {
      // No stored PDF (pre-Phase-5 approval or generation failed) — generate on-the-fly
      pdfBuffer = await generateAndStore(certificateId)
    }

    const filename = `HTA_${certificate.certificateNumber}_SIGNED.pdf`

    return new NextResponse(new Uint8Array(pdfBuffer), {
      headers: {
        'Content-Type': 'application/pdf',
        'Content-Disposition': `attachment; filename="${filename}"`,
        'Content-Length': pdfBuffer.length.toString(),
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Error downloading signed PDF')
    return NextResponse.json(
      { error: 'Failed to download signed PDF' },
      { status: 500 }
    )
  }
}

/**
 * Generate a signed PDF on-the-fly, store it, and return the buffer.
 * Used as fallback when no stored PDF exists or the file is missing.
 */
async function generateAndStore(certificateId: string): Promise<Buffer> {
  const { generateSignedPDF } = await import('@/lib/services/pdf/generator')
  const { storePDF } = await import('@/lib/services/pdf/storage')

  const pdfBuffer = await generateSignedPDF(certificateId)
  const pdfPath = await storePDF(certificateId, pdfBuffer)

  await prisma.certificate.update({
    where: { id: certificateId },
    data: { signedPdfPath: pdfPath },
  })

  return pdfBuffer
}
