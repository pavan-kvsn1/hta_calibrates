/**
 * Job Processing API Route
 *
 * POST /api/queue/process - Process pending jobs
 *
 * This endpoint should be called periodically to process background jobs.
 * Options for triggering:
 * 1. Cron job (e.g., every minute via Vercel cron or external service)
 * 2. After user actions (fire-and-forget fetch)
 * 3. setInterval in development
 *
 * Security: Protected by API secret or internal-only access
 */

import { NextRequest, NextResponse } from 'next/server'
import { processJobs, cleanupJobs, resetStuckJobs, getJobCounts } from '@/lib/services/queue'

// Secret for authenticating cron/webhook calls
const QUEUE_SECRET = process.env.QUEUE_PROCESS_SECRET || 'dev-secret'

export async function POST(req: NextRequest) {
  // Verify authorization
  const authHeader = req.headers.get('authorization')
  const providedSecret = authHeader?.replace('Bearer ', '')

  // In production, require secret. In development, allow without secret
  if (process.env.NODE_ENV === 'production' && providedSecret !== QUEUE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const body = await req.json().catch(() => ({}))
    const limit = body.limit || 10

    // Process jobs
    const result = await processJobs(limit)

    return NextResponse.json({
      success: true,
      ...result,
    })
  } catch (error) {
    console.error('[Queue API] Process error:', error)
    return NextResponse.json(
      { error: 'Failed to process jobs' },
      { status: 500 }
    )
  }
}

/**
 * GET /api/queue/process - Get queue status
 */
export async function GET(req: NextRequest) {
  // Verify authorization for status check
  const authHeader = req.headers.get('authorization')
  const providedSecret = authHeader?.replace('Bearer ', '')

  if (process.env.NODE_ENV === 'production' && providedSecret !== QUEUE_SECRET) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  try {
    const counts = await getJobCounts()

    return NextResponse.json({
      success: true,
      counts,
      timestamp: new Date().toISOString(),
    })
  } catch (error) {
    console.error('[Queue API] Status error:', error)
    return NextResponse.json(
      { error: 'Failed to get queue status' },
      { status: 500 }
    )
  }
}
