/**
 * Mark Messages as Read API Route
 *
 * POST /api/chat/threads/[threadId]/read - Mark all messages as read
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, canAccessChatThread } from '@/lib/auth'
import { markMessagesAsRead, getThreadWithCertificate } from '@/lib/services/chat'

export async function POST(
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
    const hasAccess = canAccessChatThread(
      { id: session.user.id, role: session.user.role || 'ENGINEER' },
      { createdById: threadData.certificate.createdById, reviewerId: threadData.certificate.reviewerId },
      threadData.threadType as 'ASSIGNEE_REVIEWER' | 'REVIEWER_CUSTOMER'
    )

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    const count = await markMessagesAsRead(threadId, session.user.id)

    return NextResponse.json({ markedAsRead: count })
  } catch (error) {
    console.error('[Chat API] Mark read error:', error)
    return NextResponse.json(
      { error: 'Failed to mark messages as read' },
      { status: 500 }
    )
  }
}
