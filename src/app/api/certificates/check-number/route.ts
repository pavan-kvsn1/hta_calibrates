import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { certificateLogger as logger } from '@/lib/logger'

// GET - Check if a certificate number already exists
export async function GET(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { searchParams } = new URL(request.url)
    const certificateNumber = searchParams.get('number')
    const excludeId = searchParams.get('excludeId') // Exclude current certificate when editing

    if (!certificateNumber) {
      return NextResponse.json({ error: 'Certificate number is required' }, { status: 400 })
    }

    // Check if certificate number exists
    const existingCertificate = await prisma.certificate.findFirst({
      where: {
        certificateNumber: certificateNumber,
        ...(excludeId ? { NOT: { id: excludeId } } : {}),
      },
      select: {
        id: true,
        certificateNumber: true,
      },
    })

    return NextResponse.json({
      exists: !!existingCertificate,
      certificateNumber,
    })
  } catch (error) {
    logger.error({ err: error }, 'Error checking certificate number')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
