import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { cache } from '@/lib/cache'
import { createLogger } from '@/lib/logger'

const logger = createLogger('smoke-test')

// Detect if this is a production environment
const isProduction = process.env.NODE_ENV === 'production' &&
  !process.env.NEXTAUTH_URL?.includes('dev.') &&
  !process.env.NEXTAUTH_URL?.includes('staging.')

/**
 * GET /api/smoke-test
 *
 * Comprehensive smoke test endpoint for deployment verification.
 * Performs read-only checks against database, cache, and validates
 * system health.
 *
 * Query params:
 *   ?mode=strict  - Fail if seed data missing (for dev)
 *   ?mode=lenient - Only check infrastructure (for prod first deploy)
 *
 * This endpoint is used by CI/CD pipelines to verify deployments.
 * It should NOT modify any data.
 */
export async function GET(request: NextRequest) {
  const startTime = Date.now()

  // Determine test mode
  const { searchParams } = new URL(request.url)
  const mode = searchParams.get('mode') || (isProduction ? 'lenient' : 'strict')

  const results: {
    status: 'pass' | 'fail' | 'partial'
    duration_ms: number
    timestamp: string
    environment: string
    mode: string
    checks: Record<string, {
      status: 'pass' | 'fail' | 'skip'
      message: string
      duration_ms?: number
    }>
    summary: {
      passed: number
      failed: number
      skipped: number
    }
  } = {
    status: 'pass',
    duration_ms: 0,
    timestamp: new Date().toISOString(),
    environment: process.env.NODE_ENV || 'unknown',
    mode,
    checks: {},
    summary: { passed: 0, failed: 0, skipped: 0 },
  }

  // Helper to run a check
  const runCheck = async (
    name: string,
    fn: () => Promise<{ pass: boolean; message: string }>
  ) => {
    const checkStart = Date.now()
    try {
      const result = await fn()
      results.checks[name] = {
        status: result.pass ? 'pass' : 'fail',
        message: result.message,
        duration_ms: Date.now() - checkStart,
      }
      if (result.pass) {
        results.summary.passed++
      } else {
        results.summary.failed++
        results.status = 'fail'
      }
    } catch (error) {
      results.checks[name] = {
        status: 'fail',
        message: error instanceof Error ? error.message : 'Unknown error',
        duration_ms: Date.now() - checkStart,
      }
      results.summary.failed++
      results.status = 'fail'
      logger.error({ err: error, check: name }, 'Smoke test check failed')
    }
  }

  // 1. Database connectivity
  await runCheck('database_connection', async () => {
    await prisma.$queryRaw`SELECT 1`
    return { pass: true, message: 'Database connection successful' }
  })

  // 2. Cache connectivity
  await runCheck('cache_connection', async () => {
    const testKey = 'smoke-test-' + Date.now()
    await cache.set(testKey, 'ok', 10)
    const value = await cache.get(testKey)
    await cache.delete(testKey)
    return {
      pass: value === 'ok',
      message: value === 'ok' ? 'Cache read/write successful' : 'Cache value mismatch',
    }
  })

  // 3. Database schema validation (check critical tables exist) - ALWAYS RUN
  await runCheck('schema_valid', async () => {
    // Try to query each critical table
    const tables = [
      prisma.user.count(),
      prisma.customerUser.count(),
      prisma.customerAccount.count(),
      prisma.certificate.count(),
      prisma.masterInstrument.count(),
      prisma.auditLog.count(),
    ]
    await Promise.all(tables)
    return { pass: true, message: 'All critical tables accessible' }
  })

  // 4. Users table has data - ALWAYS RUN (at least 1 admin should exist)
  await runCheck('users_exist', async () => {
    const count = await prisma.user.count()
    if (mode === 'lenient') {
      // In lenient mode, just check table is accessible (count >= 0 is always true)
      return {
        pass: true,
        message: `Found ${count} users (lenient mode - count not required)`,
      }
    }
    return {
      pass: count > 0,
      message: `Found ${count} users`,
    }
  })

  // 5. Admin user exists - Required in strict mode, optional in lenient
  await runCheck('admin_exists', async () => {
    const admin = await prisma.user.findFirst({
      where: { role: 'ADMIN', isActive: true },
      select: { id: true, email: true },
    })
    if (mode === 'lenient' && !admin) {
      return {
        pass: true,
        message: 'No admin yet (lenient mode - first deploy)',
      }
    }
    return {
      pass: !!admin,
      message: admin ? `Admin found: ${admin.email}` : 'No active admin found',
    }
  })

  // 6. Engineers exist - Only required in strict mode
  await runCheck('engineers_exist', async () => {
    const count = await prisma.user.count({
      where: { role: 'ENGINEER', isActive: true },
    })
    if (mode === 'lenient' && count === 0) {
      return {
        pass: true,
        message: 'No engineers yet (lenient mode - first deploy)',
      }
    }
    return {
      pass: count > 0,
      message: `Found ${count} active engineers`,
    }
  })

  // 7. Customer accounts - Only required in strict mode
  await runCheck('customer_accounts_exist', async () => {
    const count = await prisma.customerAccount.count({
      where: { isActive: true },
    })
    if (mode === 'lenient' && count === 0) {
      return {
        pass: true,
        message: 'No customer accounts yet (lenient mode)',
      }
    }
    return {
      pass: count > 0,
      message: `Found ${count} active customer accounts`,
    }
  })

  // 8. Customer users - Only required in strict mode
  await runCheck('customer_users_exist', async () => {
    const count = await prisma.customerUser.count({
      where: { isActive: true },
    })
    if (mode === 'lenient' && count === 0) {
      return {
        pass: true,
        message: 'No customer users yet (lenient mode)',
      }
    }
    return {
      pass: count > 0,
      message: `Found ${count} active customer users`,
    }
  })

  // 9. Master instruments - Only required in strict mode
  await runCheck('master_instruments_exist', async () => {
    const count = await prisma.masterInstrument.count({
      where: { isActive: true, isLatest: true },
    })
    if (mode === 'lenient' && count === 0) {
      return {
        pass: true,
        message: 'No master instruments yet (lenient mode)',
      }
    }
    return {
      pass: count > 0,
      message: `Found ${count} active master instruments`,
    }
  })

  // 10. Check specific seeded test user - ONLY in strict mode
  if (mode === 'strict') {
    await runCheck('test_customer_exists', async () => {
      const customer = await prisma.customerUser.findFirst({
        where: { email: 'customer@example.com' },
        select: { id: true, name: true, isActive: true },
      })
      return {
        pass: !!customer && customer.isActive,
        message: customer
          ? `Test customer found: ${customer.name} (active: ${customer.isActive})`
          : 'Test customer not found',
      }
    })
  } else {
    results.checks['test_customer_exists'] = {
      status: 'skip',
      message: 'Skipped in lenient mode (production)',
    }
    results.summary.skipped++
  }

  // Calculate final status
  results.duration_ms = Date.now() - startTime

  if (results.summary.failed === 0 && results.summary.passed > 0) {
    results.status = 'pass'
  } else if (results.summary.failed > 0 && results.summary.passed > 0) {
    results.status = 'partial'
  } else {
    results.status = 'fail'
  }

  const statusCode = results.status === 'pass' ? 200 : results.status === 'partial' ? 207 : 503

  return NextResponse.json(results, { status: statusCode })
}
