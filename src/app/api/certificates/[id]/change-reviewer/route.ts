/**
 * Change Reviewer API Route
 *
 * POST /api/certificates/[id]/change-reviewer - Change the assigned reviewer
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { notifyReviewerOnSubmit } from '@/lib/services/notifications'
import { certificateLogger as logger } from '@/lib/logger'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const { id } = await context.params

    // Parse request body
    const body = await request.json()
    const { newReviewerId, reason } = body

    if (!newReviewerId) {
      return NextResponse.json(
        { error: 'New reviewer ID is required' },
        { status: 400 }
      )
    }

    if (!reason?.trim()) {
      return NextResponse.json(
        { error: 'Reason for changing reviewer is required' },
        { status: 400 }
      )
    }

    // Get the certificate
    const certificate = await prisma.certificate.findUnique({
      where: { id },
      include: {
        reviewer: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Check ownership - only the certificate creator can change reviewer
    if (certificate.createdById !== session.user.id && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Check if certificate is in a status that allows reviewer change
    const allowedStatuses = ['PENDING_REVIEW']
    if (!allowedStatuses.includes(certificate.status)) {
      return NextResponse.json(
        { error: `Cannot change reviewer for certificate with status: ${certificate.status}` },
        { status: 400 }
      )
    }

    // Check if new reviewer is same as current
    if (certificate.reviewerId === newReviewerId) {
      return NextResponse.json(
        { error: 'New reviewer must be different from current reviewer' },
        { status: 400 }
      )
    }

    // Cannot assign to self
    if (newReviewerId === session.user.id) {
      return NextResponse.json(
        { error: 'You cannot assign yourself as reviewer' },
        { status: 400 }
      )
    }

    // Validate new reviewer exists and is active
    const newReviewer = await prisma.user.findUnique({
      where: { id: newReviewerId },
      select: { id: true, name: true, email: true, role: true, isActive: true },
    })

    if (!newReviewer || !newReviewer.isActive) {
      return NextResponse.json(
        { error: 'Selected reviewer is not available' },
        { status: 400 }
      )
    }

    // Perform the update in a transaction
    const result = await prisma.$transaction(async (tx) => {
      // Get next event sequence
      const lastEvent = await tx.certificateEvent.findFirst({
        where: { certificateId: id },
        orderBy: { sequenceNumber: 'desc' },
      })
      const nextSequence = (lastEvent?.sequenceNumber ?? 0) + 1

      // Update the certificate with new reviewer
      const updatedCertificate = await tx.certificate.update({
        where: { id },
        data: {
          reviewerId: newReviewerId,
          lastModifiedById: session.user.id,
        },
        include: {
          reviewer: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      // Create event for reviewer change
      await tx.certificateEvent.create({
        data: {
          certificateId: id,
          sequenceNumber: nextSequence,
          revision: certificate.currentRevision,
          eventType: 'REVIEWER_CHANGED',
          eventData: JSON.stringify({
            previousReviewerId: certificate.reviewerId,
            previousReviewerName: certificate.reviewer?.name || null,
            newReviewerId: newReviewer.id,
            newReviewerName: newReviewer.name,
            reason: reason.trim(),
            changedAt: new Date().toISOString(),
          }),
          userId: session.user.id,
          userRole: session.user.role,
        },
      })

      // Create audit log
      await tx.auditLog.create({
        data: {
          entityType: 'Certificate',
          entityId: id,
          action: 'REVIEWER_CHANGED',
          actorId: session.user.id,
          actorType: 'USER',
          changes: JSON.stringify({
            previousReviewerId: certificate.reviewerId,
            previousReviewerName: certificate.reviewer?.name,
            newReviewerId: newReviewer.id,
            newReviewerName: newReviewer.name,
            reason: reason.trim(),
          }),
        },
      })

      return updatedCertificate
    })

    // Notify the new reviewer
    notifyReviewerOnSubmit({
      certificateId: result.id,
      certificateNumber: result.certificateNumber,
      assigneeName: session.user.name || 'Engineer',
      reviewerId: newReviewerId,
    }).catch((err) => logger.error({ err }, 'Failed to send reviewer notification'))

    return NextResponse.json({
      success: true,
      message: 'Reviewer changed successfully',
      certificate: {
        id: result.id,
        certificateNumber: result.certificateNumber,
        reviewer: result.reviewer,
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Error changing certificate reviewer')
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
