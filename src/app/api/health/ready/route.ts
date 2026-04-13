import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache'
import { createLogger } from '@/lib/logger'

const logger = createLogger('health')

// GET /api/health/ready - Readiness probe
// Checks if the application is ready to serve traffic (including DB and cache connection)
export async function GET() {
  const checks: Record<string, string> = {
    database: 'unknown',
    cache: 'unknown',
  }

  let isReady = true

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = 'connected'
  } catch (error) {
    checks.database = 'disconnected'
    isReady = false
    logger.error({ err: error }, 'Health check - Database connection failed')
  }

  // Check cache connection
  try {
    const testKey = 'health-check-ready'
    await cache.set(testKey, 'ok', 10)
    const value = await cache.get(testKey)
    checks.cache = value === 'ok' ? 'connected' : 'degraded'
  } catch (error) {
    // Cache failure is non-critical - app can work without it
    checks.cache = 'disconnected'
    logger.warn({ err: error }, 'Health check - Cache connection failed (non-critical)')
  }

  const healthCheck = {
    status: isReady ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks,
  }

  return NextResponse.json(healthCheck, {
    status: isReady ? 200 : 503
  })
}
