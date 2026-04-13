/**
 * Secrets Module
 *
 * Runtime secret fetching from GCP Secret Manager with:
 * - Automatic caching (5-minute TTL)
 * - Fallback to environment variables
 * - Version pinning support
 * - Type-safe accessors
 *
 * @example
 * import { getSecret, secrets, initializeSecrets } from '@/lib/secrets'
 *
 * // Generic getter
 * const apiKey = await getSecret('resend-api-key')
 *
 * // Type-safe getter
 * const dbUrl = await secrets.databaseUrl()
 *
 * // Pre-fetch at startup (optional)
 * await initializeSecrets()
 */

export {
  getSecret,
  initializeSecrets,
  clearSecretCache,
  getSecretCacheStats,
  secrets,
  type GetSecretOptions,
} from './gcp-secrets'
