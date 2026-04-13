import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { isOpenSignHealthy } from '@/lib/services/opensign'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

const logger = createLogger('opensign')

/**
 * GET /api/opensign/health
 *
 * Check the health of the OpenSign integration.
 * Returns:
 *   - OpenSign server reachability
 *   - Configuration status (API key set?)
 *   - Recent document signing statistics
 *
 * Restricted to ADMIN role.
 */
export async function GET() {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const configured = !!process.env.OPENSIGN_API_KEY && !!process.env.OPENSIGN_SERVER_URL
    const healthy = configured ? await isOpenSignHealthy() : false

    // Get recent OpenSign document statistics
    const [totalDocs, pendingDocs, signedDocs, failedDocs] = await Promise.all([
      prisma.openSignDocument.count(),
      prisma.openSignDocument.count({ where: { status: 'PENDING' } }),
      prisma.openSignDocument.count({ where: { status: 'SIGNED' } }),
      prisma.openSignDocument.count({ where: { status: { in: ['DECLINED', 'EXPIRED'] } } }),
    ])

    return NextResponse.json({
      configured,
      healthy,
      serverUrl: process.env.OPENSIGN_SERVER_URL || 'not set',
      statistics: {
        total: totalDocs,
        pending: pendingDocs,
        signed: signedDocs,
        failed: failedDocs,
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'OpenSign health check failed')
    return NextResponse.json(
      { error: 'Health check failed', configured: false, healthy: false },
      { status: 500 }
    )
  }
}
