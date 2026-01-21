import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

interface RouteContext {
  params: Promise<{ id: string }>
}

export async function POST(request: NextRequest, context: RouteContext) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only HoD and Admin can review
    if (session.user.role !== 'HOD' && session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { id } = await context.params
    const body = await request.json()
    const { action, comment, versionId } = body

    if (!action || !['approve', 'reject', 'revision'].includes(action)) {
      return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Get certificate
    const certificate = await prisma.certificate.findUnique({
      where: { id },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    if (certificate.status !== 'PENDING_HOD_REVIEW') {
      return NextResponse.json(
        { error: 'Certificate is not pending review' },
        { status: 400 }
      )
    }

    // Determine new status based on action
    let newStatus: string
    switch (action) {
      case 'approve':
        newStatus = 'PENDING_CUSTOMER_APPROVAL'
        break
      case 'reject':
        newStatus = 'REJECTED'
        break
      case 'revision':
        newStatus = 'REVISION_REQUIRED'
        break
      default:
        return NextResponse.json({ error: 'Invalid action' }, { status: 400 })
    }

    // Update certificate and add comment if provided
    await prisma.$transaction(async (tx) => {
      // Update certificate status
      await tx.certificate.update({
        where: { id },
        data: { status: newStatus },
      })

      // Add review comment if provided
      if (comment && versionId) {
        await tx.reviewComment.create({
          data: {
            versionId,
            authorUserId: session.user.id,
            sectionReference: 'HoD Review',
            commentText: comment,
            status: 'OPEN',
          },
        })
      }

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          entityType: 'Certificate',
          entityId: id,
          action: `HOD_${action.toUpperCase()}`,
          actorId: session.user.id,
          actorType: 'USER',
          changes: JSON.stringify({
            previousStatus: certificate.status,
            newStatus,
            comment: comment || null,
          }),
        },
      })
    })

    return NextResponse.json({
      success: true,
      newStatus,
    })
  } catch (error) {
    console.error('Review error:', error)
    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
