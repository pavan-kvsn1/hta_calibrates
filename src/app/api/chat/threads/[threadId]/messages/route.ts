/**
 * Chat Messages API Route
 *
 * GET /api/chat/threads/[threadId]/messages - Get messages for a thread
 * POST /api/chat/threads/[threadId]/messages - Send a message
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth, canAccessChatThread } from '@/lib/auth'
import { getMessages, sendMessage, getThreadWithCertificate } from '@/lib/services/chat'

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
    const hasAccess = canAccessChatThread(
      { id: session.user.id, role: session.user.role || 'ENGINEER' },
      { createdById: threadData.certificate.createdById, reviewerId: threadData.certificate.reviewerId },
      threadData.threadType as 'ASSIGNEE_REVIEWER' | 'REVIEWER_CUSTOMER'
    )

    if (!hasAccess) {
      return NextResponse.json({ error: 'Access denied' }, { status: 403 })
    }

    // Parse query params
    const url = new URL(req.url)
    const limit = parseInt(url.searchParams.get('limit') || '50', 10)
    const cursor = url.searchParams.get('cursor') || undefined

    const result = await getMessages(threadId, { limit, cursor })

    return NextResponse.json(result)
  } catch (error) {
    console.error('[Chat API] Get messages error:', error)
    return NextResponse.json(
      { error: 'Failed to get messages' },
      { status: 500 }
    )
  }
}

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

    const body = await req.json()
    const { content, attachments } = body

    if (!content || typeof content !== 'string' || content.trim().length === 0) {
      return NextResponse.json(
        { error: 'Message content is required' },
        { status: 400 }
      )
    }

    // Validate attachments if provided
    if (attachments && !Array.isArray(attachments)) {
      return NextResponse.json(
        { error: 'Attachments must be an array' },
        { status: 400 }
      )
    }

    const message = await sendMessage({
      threadId,
      senderId: session.user.id,
      content: content.trim(),
      attachments,
    })

    return NextResponse.json({ message }, { status: 201 })
  } catch (error) {
    console.error('[Chat API] Send message error:', error)
    return NextResponse.json(
      { error: 'Failed to send message' },
      { status: 500 }
    )
  }
}
