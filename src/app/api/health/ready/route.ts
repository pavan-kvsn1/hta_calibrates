import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/health/ready - Readiness probe
// Checks if the application is ready to serve traffic (including DB connection)
export async function GET() {
  const checks: Record<string, string> = {
    database: 'unknown',
  }

  let isReady = true

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = 'connected'
  } catch (error) {
    checks.database = 'disconnected'
    isReady = false
    console.error('Health check - Database connection failed:', error)
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
