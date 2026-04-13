/**
 * Chat Thread Details API Route
 *
 * GET /api/chat/threads/[threadId] - Get thread details
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, canAccessChatThread } from '@/lib/auth'
import { getThread, getThreadWithCertificate } from '@/lib/services/chat'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

const logger = createLogger('chat')

export async function GET(
  req: NextRequest,
  { params }: { params: Promise<{ threadId: string }> }
) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const { threadId } = await params

    // Get thread with certificate for access check
    const threadData = await getThreadWithCertificate(threadId)

    if (!threadData) {
      return NextResponse.json({ error: 'Thread not found' }, { status: 404 })
    }

    // Check access
    let hasAccess = canAccessChatThread(
      { id: session.user.id, role: session.user.role || 'ENGINEER' },
      { createdById: threadData.certificate.createdById, reviewerId: threadData.certificate.reviewerId },
      threadData.threadType as 'ASSIGNEE_REVIEWER' | 'REVIEWER_CUSTOMER'
    )

    // For customers, verify they belong to the certificate's company
    if (hasAccess && session.user.role === 'CUSTOMER' && threadData.threadType === 'REVIEWER_CUSTOMER') {
      const customer = await prisma.customerUser.findUnique({
        where: { email: session.user.email! },
        include: { customerAccount: true },
      })
      if (customer) {
        const companyName = customer.customerAccount?.companyName || customer.companyName || ''
        hasAccess = companyName.toLowerCase() === threadData.certificate.customerName?.toLowerCase()
      } else {
        hasAccess = false
      }
    }

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Get full thread info
    const thread = await getThread(threadId)

    return NextResponse.json({ thread })
  } catch (error) {
    logger.error({ err: error }, 'Failed to get thread')
    return NextResponse.json(
      { error: 'Failed to get thread' },
      { status: 500 }
    )
  }
}
