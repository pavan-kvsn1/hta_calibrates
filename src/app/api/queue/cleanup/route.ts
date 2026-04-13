/**
 * Queue Cleanup API Route
 *
 * POST /api/queue/cleanup - Clean up old jobs and reset stuck jobs
 *
 * This endpoint should be called periodically (e.g., daily) to:
 * 1. Remove old completed/failed jobs
 * 2. Reset jobs that have been processing too long
 */

import { NextRequest, NextResponse } from 'next/server'
import { cleanupJobs, resetStuckJobs } from '@/lib/services/queue'
import { createLogger } from '@/lib/logger'

const logger = createLogger('queue')

const QUEUE_SECRET = process.env.QUEUE_PROCESS_SECRET || 'dev-secret'

export async function POST(req: NextRequest) {
  // Verify authorization
  const authHeader = req.headers.get('authorization')
  const providedSecret = authHeader?.replace('Bearer ', '')

  if (process.env.NODE_ENV === 'production' && providedSecret !== QUEUE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const olderThanDays = body.olderThanDays || 7
    const stuckMinutes = body.stuckMinutes || 30

    // Cleanup old jobs
    const deletedCount = await cleanupJobs(olderThanDays)

    // Reset stuck jobs
    const resetCount = await resetStuckJobs(stuckMinutes)

    return NextResponse.json({
      success: true,
      deletedJobs: deletedCount,
      resetJobs: resetCount,
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to cleanup queue')
    return NextResponse.json(
      { error: 'Failed to cleanup queue' },
      { status: 500 }
    )
  }
}
