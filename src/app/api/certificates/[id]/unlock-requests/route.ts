import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { safeJsonParse } from '@/lib/utils/safe-json'

// GET /api/certificates/[id]/unlock-requests - Get section unlock requests for a certificate
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!session?.user?.id) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id: certificateId } = await params

    // Check certificate exists and user has access
    const certificate = await prisma.certificate.findUnique({
      where: { id: certificateId },
      select: {
        id: true,
        createdById: true,
        reviewerId: true,
        status: true,
      },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Only assignee, reviewer, or admin can view unlock requests
    const isAssignee = certificate.createdById === session.user.id
    const isReviewer = certificate.reviewerId === session.user.id
    const isAdmin = session.user.role === 'ADMIN'

    if (!isAssignee && !isReviewer && !isAdmin) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Fetch all section unlock requests for this certificate
    const unlockRequests = await prisma.internalRequest.findMany({
      where: {
        certificateId,
        type: 'SECTION_UNLOCK',
      },
      include: {
        requestedBy: {
          select: { id: true, name: true },
        },
        reviewedBy: {
          select: { id: true, name: true },
        },
      },
      orderBy: { createdAt: 'desc' },
    })

    // Get sections that are unlocked from feedback (reviewer comments)
    const feedbacks = await prisma.reviewFeedback.findMany({
      where: {
        certificateId,
        feedbackType: { in: ['REVISION_REQUEST', 'CUSTOMER_REVISION_FORWARDED'] },
        targetSection: { not: null },
      },
      select: { targetSection: true },
    })

    const feedbackUnlockedSections = [...new Set(feedbacks.map(f => f.targetSection).filter(Boolean))] as string[]

    // Get sections from approved unlock requests
    const approvedUnlockedSections: string[] = []
    unlockRequests
      .filter(r => r.status === 'APPROVED')
      .forEach(r => {
        const data = safeJsonParse<Record<string, unknown>>(r.data, {})
        if (data.sections && Array.isArray(data.sections)) {
          approvedUnlockedSections.push(...(data.sections as string[]))
        }
      })

    // Combine all unlocked sections
    const allUnlockedSections = [...new Set([...feedbackUnlockedSections, ...approvedUnlockedSections])]

    return NextResponse.json({
      requests: unlockRequests.map((r) => ({
        id: r.id,
        type: r.type,
        status: r.status,
        data: safeJsonParse<Record<string, unknown>>(r.data, {}),
        requestedBy: r.requestedBy,
        reviewedBy: r.reviewedBy,
        reviewedAt: r.reviewedAt?.toISOString() || null,
        adminNote: r.adminNote,
        createdAt: r.createdAt.toISOString(),
      })),
      unlockedSections: {
        fromFeedback: feedbackUnlockedSections,
        fromApprovedRequests: [...new Set(approvedUnlockedSections)],
        all: allUnlockedSections,
      },
    })
  } catch (error) {
    console.error('Error fetching unlock requests:', error)
    return NextResponse.json(
      { error: 'Failed to fetch unlock requests' },
      { status: 500 }
    )
  }
}
