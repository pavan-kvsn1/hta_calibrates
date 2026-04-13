/**
 * Chat Unread Count API Route
 *
 * GET /api/chat/unread - Get unread message count for current user
 */

import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { getUnreadMessageCount, getUnreadCountsByThread } from '@/lib/services/chat'
import { createLogger } from '@/lib/logger'

const logger = createLogger('chat')

export async function GET(req: NextRequest) {
  const session = await auth()

  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const url = new URL(req.url)
    const detailed = url.searchParams.get('detailed') === 'true'

    if (detailed) {
      const countsByThread = await getUnreadCountsByThread(session.user.id)
      const total = Object.values(countsByThread).reduce((a, b) => a + b, 0)

      return NextResponse.json({
        total,
        byThread: countsByThread,
      })
    }

    const count = await getUnreadMessageCount(session.user.id)

    return NextResponse.json({ count })
  } catch (error) {
    logger.error({ err: error }, 'Failed to get unread count')
    return NextResponse.json(
      { error: 'Failed to get unread count' },
      { status: 500 }
    )
  }
}
