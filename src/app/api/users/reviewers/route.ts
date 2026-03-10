/**
 * Available Reviewers API Route
 *
 * GET /api/users/reviewers - Get list of engineers available as reviewers
 *
 * Returns all active engineers except the current user.
 * Used in the reviewer selection dropdown when submitting certificates.
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    // Get all active engineers except the current user
    const reviewers = await prisma.user.findMany({
      where: {
        role: 'ENGINEER',
        isActive: true,
        id: { not: session.user.id }, // Exclude self
      },
      select: {
        id: true,
        name: true,
        email: true,
        signatureUrl: true,
        // Include count of pending reviews to show workload
        _count: {
          select: {
            reviewedCertificates: {
              where: {
                status: { in: ['PENDING_REVIEW', 'REVISION_REQUIRED'] },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Also include admins as potential reviewers (they can review any certificate)
    const admins = await prisma.user.findMany({
      where: {
        role: 'ADMIN',
        isActive: true,
        id: { not: session.user.id },
      },
      select: {
        id: true,
        name: true,
        email: true,
        adminType: true,
        signatureUrl: true,
        _count: {
          select: {
            reviewedCertificates: {
              where: {
                status: { in: ['PENDING_REVIEW', 'REVISION_REQUIRED'] },
              },
            },
          },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Format response
    const formattedReviewers = [
      ...reviewers.map((r) => ({
        id: r.id,
        name: r.name,
        email: r.email,
        role: 'ENGINEER' as const,
        hasSignature: !!r.signatureUrl,
        pendingReviews: r._count.reviewedCertificates,
      })),
      ...admins.map((a) => ({
        id: a.id,
        name: a.name,
        email: a.email,
        role: 'ADMIN' as const,
        adminType: a.adminType,
        hasSignature: !!a.signatureUrl,
        pendingReviews: a._count.reviewedCertificates,
      })),
    ]

    return NextResponse.json({ reviewers: formattedReviewers })
  } catch (error) {
    console.error('[Reviewers API] Error:', error)
    return NextResponse.json(
      { error: 'Failed to fetch reviewers' },
      { status: 500 }
    )
  }
}
