/**
 * API Route Logger Wrapper
 *
 * Wraps API route handlers to automatically log:
 * - Request start (path, method, user)
 * - Request end (status, duration)
 * - Errors (with stack trace)
 *
 * Usage:
 *   import { withLogging } from '@/lib/api-logger'
 *
 *   export const GET = withLogging(async (request) => {
 *     // your handler code
 *     return NextResponse.json({ data })
 *   }, { module: 'certificates' })
 */

import { NextRequest, NextResponse } from 'next/server'
import { logger, createLogger } from './logger'
import * as Sentry from '@sentry/nextjs'

type RouteHandler = (
  request: NextRequest,
  context?: { params?: Record<string, string> }
) => Promise<NextResponse> | NextResponse

interface LoggingOptions {
  /** Module name for filtering (e.g., 'auth', 'certificates') */
  module?: string
  /** Skip logging for this route (e.g., health checks) */
  skip?: boolean
  /** Log request body (be careful with sensitive data) */
  logBody?: boolean
}

/**
 * Extracts request ID from headers or generates one
 */
function getRequestId(request: NextRequest): string {
  return (
    request.headers.get('x-request-id') ||
    request.headers.get('x-cloud-trace-context')?.split('/')[0] ||
    crypto.randomUUID()
  )
}

/**
 * Safely extracts user ID from session cookie
 * Note: Full session validation happens in the handler
 */
function getUserIdHint(request: NextRequest): string | undefined {
  // This is just a hint - actual auth is done in handlers
  const sessionCookie = request.cookies.get('authjs.session-token')?.value ||
                        request.cookies.get('__Secure-authjs.session-token')?.value
  return sessionCookie ? 'authenticated' : undefined
}

/**
 * Wraps an API route handler with logging
 */
export function withLogging(
  handler: RouteHandler,
  options: LoggingOptions = {}
): RouteHandler {
  const { module = 'api', skip = false, logBody = false } = options

  return async (request: NextRequest, context?: { params?: Record<string, string> }) => {
    // Skip logging if requested
    if (skip) {
      return handler(request, context)
    }

    const startTime = Date.now()
    const requestId = getRequestId(request)
    const log = createLogger(module).child({ requestId })

    const { pathname } = request.nextUrl
    const method = request.method
    const userHint = getUserIdHint(request)

    // Log request start
    log.info(
      {
        event: 'request_start',
        method,
        path: pathname,
        params: context?.params,
        userHint,
        userAgent: request.headers.get('user-agent')?.substring(0, 100),
      },
      `${method} ${pathname}`
    )

    // Optionally log body (be careful with sensitive data)
    if (logBody && ['POST', 'PUT', 'PATCH'].includes(method)) {
      try {
        const body = await request.clone().json()
        // Redact sensitive fields
        const safeBody = redactSensitiveFields(body)
        log.debug({ body: safeBody }, 'Request body')
      } catch {
        // Body not JSON or empty - ignore
      }
    }

    try {
      // Execute the handler
      const response = await handler(request, context)
      const duration = Date.now() - startTime
      const status = response.status

      // Log request completion
      const logLevel = status >= 500 ? 'error' : status >= 400 ? 'warn' : 'info'
      log[logLevel](
        {
          event: 'request_end',
          method,
          path: pathname,
          status,
          duration,
        },
        `${method} ${pathname} ${status} ${duration}ms`
      )

      // Add request ID to response headers for tracing
      response.headers.set('x-request-id', requestId)

      return response
    } catch (error) {
      const duration = Date.now() - startTime

      // Log error
      log.error(
        {
          event: 'request_error',
          method,
          path: pathname,
          duration,
          err: error,
        },
        `${method} ${pathname} ERROR ${duration}ms`
      )

      // Capture in Sentry with context
      Sentry.captureException(error, {
        tags: { module, path: pathname },
        extra: { requestId, method, params: context?.params },
      })

      // Re-throw to let Next.js handle the error response
      throw error
    }
  }
}

/**
 * Redacts sensitive fields from objects before logging
 */
function redactSensitiveFields(obj: Record<string, unknown>): Record<string, unknown> {
  const sensitiveFields = ['password', 'token', 'secret', 'apiKey', 'authorization', 'credit_card']
  const result: Record<string, unknown> = {}

  for (const [key, value] of Object.entries(obj)) {
    if (sensitiveFields.some(f => key.toLowerCase().includes(f))) {
      result[key] = '[REDACTED]'
    } else if (typeof value === 'object' && value !== null) {
      result[key] = redactSensitiveFields(value as Record<string, unknown>)
    } else {
      result[key] = value
    }
  }

  return result
}

/**
 * Quick logger for simple operations (no wrapper needed)
 *
 * Usage:
 *   import { logOperation } from '@/lib/api-logger'
 *
 *   await logOperation('certificate.create', { certificateId }, async () => {
 *     // operation code
 *   })
 */
export async function logOperation<T>(
  operation: string,
  context: Record<string, unknown>,
  fn: () => Promise<T>
): Promise<T> {
  const startTime = Date.now()
  const [module, action] = operation.split('.')
  const log = createLogger(module || 'app')

  log.info({ operation, ...context }, `Starting ${operation}`)

  try {
    const result = await fn()
    const duration = Date.now() - startTime
    log.info({ operation, duration, ...context }, `Completed ${operation} in ${duration}ms`)
    return result
  } catch (error) {
    const duration = Date.now() - startTime
    log.error({ operation, duration, err: error, ...context }, `Failed ${operation} after ${duration}ms`)
    throw error
  }
}
