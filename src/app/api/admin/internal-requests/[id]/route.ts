import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, isMasterAdmin } from '@/lib/auth'
import { safeJsonParse } from '@/lib/utils/safe-json'
import { createLogger } from '@/lib/logger'

const logger = createLogger('requests')

// GET /api/admin/internal-requests/[id] - Get internal request details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!isMasterAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden - Master Admin access required' }, { status: 403 })
    }

    const { id } = await params

    const internalRequest = await prisma.internalRequest.findUnique({
      where: { id },
      include: {
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
        certificate: {
          select: {
            id: true,
            certificateNumber: true,
            status: true,
            customerName: true,
            customerAddress: true,
            calibratedAt: true,
            srfNumber: true,
            srfDate: true,
            dateOfCalibration: true,
            calibrationDueDate: true,
            uucDescription: true,
            uucMake: true,
            uucModel: true,
            uucSerialNumber: true,
            ambientTemperature: true,
            relativeHumidity: true,
            currentRevision: true,
            createdById: true,
            createdBy: {
              select: { id: true, name: true, email: true },
            },
            reviewer: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        reviewedBy: {
          select: { id: true, name: true },
        },
      },
    })

    if (!internalRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    const data = safeJsonParse<Record<string, unknown>>(internalRequest.data, {})

    // For SECTION_UNLOCK, also fetch the currently unlocked sections from feedback
    let currentlyUnlockedSections: string[] = []
    if (internalRequest.type === 'SECTION_UNLOCK' && internalRequest.certificate) {
      const feedbacks = await prisma.reviewFeedback.findMany({
        where: {
          certificateId: internalRequest.certificate.id,
          feedbackType: { in: ['REVISION_REQUESTED', 'REVISION_REQUEST', 'CUSTOMER_REVISION_FORWARDED'] },
          targetSection: { not: null },
        },
        select: { targetSection: true },
        orderBy: { createdAt: 'desc' },
      })

      currentlyUnlockedSections = [...new Set(feedbacks.map(f => f.targetSection).filter(Boolean))] as string[]

      // Also include any previously approved section unlock requests
      const approvedUnlocks = await prisma.internalRequest.findMany({
        where: {
          certificateId: internalRequest.certificate.id,
          type: 'SECTION_UNLOCK',
          status: 'APPROVED',
        },
        select: { data: true },
      })

      approvedUnlocks.forEach(unlock => {
        const unlockData = safeJsonParse<{ sections?: string[] }>(unlock.data, {})
        if (unlockData.sections) {
          currentlyUnlockedSections = [...new Set([...currentlyUnlockedSections, ...unlockData.sections])]
        }
      })
    }

    return NextResponse.json({
      request: {
        id: internalRequest.id,
        type: internalRequest.type,
        status: internalRequest.status,
        data,
        certificate: internalRequest.certificate,
        requestedBy: internalRequest.requestedBy,
        reviewedBy: internalRequest.reviewedBy,
        reviewedAt: internalRequest.reviewedAt?.toISOString() || null,
        adminNote: internalRequest.adminNote,
        createdAt: internalRequest.createdAt.toISOString(),
      },
      currentlyUnlockedSections,
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch internal request')
    return NextResponse.json(
      { error: 'Failed to fetch internal request' },
      { status: 500 }
    )
  }
}
