/**
 * Chat Threads API Route
 *
 * GET /api/chat/threads - Get threads for current user
 * POST /api/chat/threads - Create or get a thread
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logger'

const logger = createLogger('chat')
import {
  getThreadsForUser,
  getOrCreateThread,
  getUnreadCountsByThread,
} from '@/lib/services/chat'
import { ThreadType } from '@/lib/services/chat/types'

export async function GET(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const threads = await getThreadsForUser(session.user.id)
    const unreadCounts = await getUnreadCountsByThread(session.user.id)

    // Add unread counts to threads
    const threadsWithUnread = threads.map((thread) => ({
      ...thread,
      unreadCount: unreadCounts[thread.id] || 0,
    }))

    return NextResponse.json({ threads: threadsWithUnread })
  } catch (error) {
    logger.error({ err: error }, 'Failed to get threads')
    return NextResponse.json(
      { error: 'Failed to get threads' },
      { status: 500 }
    )
  }
}

export async function POST(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json()
    const { certificateId, threadType } = body

    if (!certificateId || !threadType) {
      return NextResponse.json(
        { error: 'certificateId and threadType are required' },
        { status: 400 }
      )
    }

    // Validate threadType
    if (!['ASSIGNEE_REVIEWER', 'REVIEWER_CUSTOMER'].includes(threadType)) {
      return NextResponse.json(
        { error: 'Invalid threadType' },
        { status: 400 }
      )
    }

    const thread = await getOrCreateThread({
      certificateId,
      threadType: threadType as ThreadType,
    })

    return NextResponse.json({ thread })
  } catch (error) {
    logger.error({ err: error }, 'Failed to create thread')
    return NextResponse.json(
      { error: 'Failed to create thread' },
      { status: 500 }
    )
  }
}
