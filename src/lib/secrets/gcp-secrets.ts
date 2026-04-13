/**
 * GCP Secret Manager - Runtime Secret Fetching
 *
 * Provides secure, cached access to secrets stored in GCP Secret Manager.
 * Falls back to environment variables for local development.
 *
 * Usage:
 *   import { getSecret, initializeSecrets } from '@/lib/secrets'
 *
 *   // Get a single secret
 *   const apiKey = await getSecret('resend-api-key')
 *
 *   // Pre-fetch all secrets at startup (optional, improves latency)
 *   await initializeSecrets()
 */

import { logger } from '@/lib/logger'

// Lazy-load the Secret Manager client to avoid import errors in environments
// where the SDK isn't needed (local dev, tests)
let secretManagerClient: InstanceType<typeof import('@google-cloud/secret-manager').SecretManagerServiceClient> | null = null

async function getClient() {
  if (!secretManagerClient) {
    const { SecretManagerServiceClient } = await import('@google-cloud/secret-manager')
    secretManagerClient = new SecretManagerServiceClient()
  }
  return secretManagerClient
}

// ============================================================================
// Configuration
// ============================================================================

interface SecretCacheEntry {
  value: string
  expiry: number
  version: string
}

const secretCache = new Map<string, SecretCacheEntry>()

// Default cache TTL: 5 minutes (secrets refresh automatically)
const DEFAULT_CACHE_TTL_MS = 5 * 60 * 1000

// Configurable via environment
const CACHE_TTL_MS = process.env.SECRET_CACHE_TTL_MS
  ? parseInt(process.env.SECRET_CACHE_TTL_MS, 10)
  : DEFAULT_CACHE_TTL_MS

// ============================================================================
// Secret Name Mapping
// ============================================================================

/**
 * Maps friendly secret IDs to their GCP Secret Manager names and env var fallbacks.
 *
 * GCP Secret naming convention: {project-id}-{secret-name}-{environment}
 * e.g., hta-calibration-prod-nextauth-secret-prod
 */
const SECRET_CONFIG: Record<string, { envFallback: string; description: string }> = {
  'nextauth-secret': {
    envFallback: 'NEXTAUTH_SECRET',
    description: 'NextAuth.js session encryption key',
  },
  'auth-secret': {
    envFallback: 'AUTH_SECRET',
    description: 'Auth.js secret (alias for NEXTAUTH_SECRET)',
  },
  'database-url': {
    envFallback: 'DATABASE_URL',
    description: 'PostgreSQL connection string',
  },
  'resend-api-key': {
    envFallback: 'RESEND_API_KEY',
    description: 'Resend email service API key',
  },
  'redis-url': {
    envFallback: 'REDIS_URL',
    description: 'Redis connection URL for caching',
  },
  'email-from': {
    envFallback: 'EMAIL_FROM',
    description: 'Default email sender address',
  },
  'queue-process-secret': {
    envFallback: 'QUEUE_PROCESS_SECRET',
    description: 'Secret for queue processing API authentication',
  },
  'sentry-dsn': {
    envFallback: 'NEXT_PUBLIC_SENTRY_DSN',
    description: 'Sentry error tracking DSN',
  },
}

// ============================================================================
// Core Functions
// ============================================================================

export interface GetSecretOptions {
  /** Specific version to fetch (default: 'latest') */
  version?: string
  /** Force refresh, bypassing cache */
  bypassCache?: boolean
  /** Custom cache TTL for this secret (ms) */
  cacheTtlMs?: number
}

/**
 * Fetches a secret from GCP Secret Manager with caching and fallback.
 *
 * In production: Fetches from Secret Manager, caches result
 * In development: Returns environment variable directly
 *
 * @param secretId - Friendly secret ID (e.g., 'resend-api-key')
 * @param options - Fetch options
 * @returns Secret value
 *
 * @example
 * const apiKey = await getSecret('resend-api-key')
 * const dbUrl = await getSecret('database-url', { version: '2' })
 */
export async function getSecret(
  secretId: string,
  options: GetSecretOptions = {}
): Promise<string> {
  const { version = 'latest', bypassCache = false, cacheTtlMs = CACHE_TTL_MS } = options
  const cacheKey = `${secretId}:${version}`

  // Check cache first (unless bypassing)
  if (!bypassCache) {
    const cached = secretCache.get(cacheKey)
    if (cached && Date.now() < cached.expiry) {
      return cached.value
    }
  }

  // In non-production, use environment variables directly
  if (process.env.NODE_ENV !== 'production' && !process.env.FORCE_SECRET_MANAGER) {
    return getEnvFallback(secretId)
  }

  // Fetch from Secret Manager
  const projectId = process.env.GCP_PROJECT_ID
  const environment = process.env.ENVIRONMENT || process.env.NODE_ENV || 'dev'

  if (!projectId) {
    logger.warn({ secretId }, 'GCP_PROJECT_ID not set, falling back to env var')
    return getEnvFallback(secretId)
  }

  const secretName = `projects/${projectId}/secrets/${projectId}-${secretId}-${environment}/versions/${version}`

  try {
    const client = await getClient()
    const [secretVersion] = await client.accessSecretVersion({ name: secretName })
    const value = secretVersion.payload?.data?.toString() || ''

    if (!value) {
      logger.warn({ secretId, secretName }, 'Secret value is empty')
      return getEnvFallback(secretId)
    }

    // Cache the result
    secretCache.set(cacheKey, {
      value,
      expiry: Date.now() + cacheTtlMs,
      version: secretVersion.name?.split('/').pop() || version,
    })

    logger.debug({ secretId, version }, 'Secret fetched from Secret Manager')
    return value
  } catch (error) {
    logger.error({ secretId, secretName, error }, 'Failed to fetch secret from Secret Manager')
    return getEnvFallback(secretId)
  }
}

/**
 * Gets the environment variable fallback for a secret.
 */
function getEnvFallback(secretId: string): string {
  const config = SECRET_CONFIG[secretId]

  if (config) {
    const value = process.env[config.envFallback]
    if (value) {
      return value
    }
    logger.warn({ secretId, envVar: config.envFallback }, 'Env fallback not found')
    return ''
  }

  // If not in config, try converting secret ID to env var format
  // e.g., 'my-api-key' -> 'MY_API_KEY'
  const envVarName = secretId.toUpperCase().replace(/-/g, '_')
  const value = process.env[envVarName]

  if (value) {
    return value
  }

  logger.warn({ secretId, envVar: envVarName }, 'Unknown secret, env fallback not found')
  return ''
}

/**
 * Pre-fetches commonly used secrets to warm the cache.
 * Call this at application startup for better latency.
 *
 * @example
 * // In instrumentation.ts or app initialization
 * await initializeSecrets()
 */
export async function initializeSecrets(): Promise<void> {
  // Only pre-fetch in production
  if (process.env.NODE_ENV !== 'production' && !process.env.FORCE_SECRET_MANAGER) {
    logger.debug('Skipping secret pre-fetch in non-production environment')
    return
  }

  const criticalSecrets = [
    'nextauth-secret',
    'database-url',
    'resend-api-key',
  ]

  logger.info('Pre-fetching secrets from Secret Manager...')

  const results = await Promise.allSettled(
    criticalSecrets.map(secretId => getSecret(secretId))
  )

  const failures = results.filter(r => r.status === 'rejected')
  if (failures.length > 0) {
    logger.warn({ failureCount: failures.length }, 'Some secrets failed to pre-fetch')
  } else {
    logger.info({ secretCount: criticalSecrets.length }, 'Secrets pre-fetched successfully')
  }
}

/**
 * Clears the secret cache. Useful for testing or forcing a refresh.
 */
export function clearSecretCache(): void {
  secretCache.clear()
  logger.debug('Secret cache cleared')
}

/**
 * Gets cache statistics for monitoring.
 */
export function getSecretCacheStats(): {
  size: number
  entries: Array<{ key: string; expiresIn: number; version: string }>
} {
  const now = Date.now()
  const entries = Array.from(secretCache.entries()).map(([key, entry]) => ({
    key,
    expiresIn: Math.max(0, entry.expiry - now),
    version: entry.version,
  }))

  return {
    size: secretCache.size,
    entries,
  }
}

// ============================================================================
// Typed Secret Getters (for better DX)
// ============================================================================

/**
 * Type-safe secret getters for commonly used secrets.
 * These provide autocomplete and documentation.
 */
export const secrets = {
  /** NextAuth.js session encryption key */
  nextAuthSecret: () => getSecret('nextauth-secret'),

  /** Auth.js secret (alias) */
  authSecret: () => getSecret('auth-secret'),

  /** PostgreSQL connection string */
  databaseUrl: () => getSecret('database-url'),

  /** Resend email API key */
  resendApiKey: () => getSecret('resend-api-key'),

  /** Redis connection URL */
  redisUrl: () => getSecret('redis-url'),

  /** Default email sender */
  emailFrom: () => getSecret('email-from'),

  /** Queue processing authentication secret */
  queueProcessSecret: () => getSecret('queue-process-secret'),

  /** Sentry DSN for error tracking */
  sentryDsn: () => getSecret('sentry-dsn'),
} as const
