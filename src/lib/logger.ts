/**
 * Structured Logger
 *
 * Uses Pino for JSON logging that integrates with GCP Cloud Logging.
 *
 * Why structured logging?
 * - Searchable: Find all logs for a specific user or certificate
 * - Filterable: Show only errors, or only auth-related logs
 * - Correlatable: Link logs from the same request together
 *
 * Usage:
 *   import { logger } from '@/lib/logger'
 *   logger.info({ userId, action: 'login' }, 'User logged in')
 *   logger.error({ err, certificateId }, 'Failed to process certificate')
 */

import pino from 'pino'

// GCP Cloud Logging severity levels
// https://cloud.google.com/logging/docs/reference/v2/rest/v2/LogEntry#LogSeverity
const GCP_SEVERITY = {
  trace: 'DEBUG',
  debug: 'DEBUG',
  info: 'INFO',
  warn: 'WARNING',
  error: 'ERROR',
  fatal: 'CRITICAL',
} as const

// Create the logger instance
export const logger = pino({
  // Log level from environment (default: info in prod, debug in dev)
  level: process.env.LOG_LEVEL || (process.env.NODE_ENV === 'production' ? 'info' : 'debug'),

  // Format for GCP Cloud Logging
  formatters: {
    // Convert Pino levels to GCP severity
    level: (label) => ({
      severity: GCP_SEVERITY[label as keyof typeof GCP_SEVERITY] || 'DEFAULT',
      level: label,
    }),

    // Add service context to every log
    bindings: () => ({
      service: process.env.SERVICE_NAME || 'hta-calibration',
      version: process.env.npm_package_version || '1.0.0',
    }),
  },

  // Use 'message' field for GCP
  messageKey: 'message',

  // ISO timestamp
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,

  // Pretty print in development (requires pino-pretty)
  ...(process.env.NODE_ENV !== 'production' && {
    transport: {
      target: 'pino-pretty',
      options: { colorize: true },
    },
  }),
})

// Create child loggers for specific modules
export const createLogger = (module: string) => {
  return logger.child({ module })
}

// Pre-configured loggers for common modules
export const authLogger = createLogger('auth')
export const apiLogger = createLogger('api')
export const certificateLogger = createLogger('certificate')
export const emailLogger = createLogger('email')

// Request logger with correlation ID
export const createRequestLogger = (requestId: string, userId?: string) => {
  return logger.child({
    requestId,
    userId,
  })
}
