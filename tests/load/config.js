/**
 * Shared k6 Configuration
 *
 * IMPORTANT: This project runs load tests against PRODUCTION.
 * All profiles are designed to be safe for production use.
 *
 * Usage:
 *   import { BASE_URL, LOAD_PROFILES, STANDARD_THRESHOLDS } from './config.js'
 */

// =============================================================================
// Environment Configuration
// =============================================================================

// Production URL (no staging environment available)
export const BASE_URL = __ENV.BASE_URL || 'https://hta-calibration.com'

// =============================================================================
// Thresholds
// =============================================================================

// Standard thresholds aligned with SLOs
export const STANDARD_THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  http_req_failed: ['rate<0.01'],
}

// Strict thresholds for critical endpoints (health checks)
export const STRICT_THRESHOLDS = {
  http_req_duration: ['p(95)<200', 'p(99)<500'],
  http_req_failed: ['rate<0.001'],
}

// =============================================================================
// Production-Safe Load Profiles
// =============================================================================

export const LOAD_PROFILES = {
  // Minimal smoke test - 3 users, ~2 minutes
  // Use for: Quick validation, CI checks
  smoke: [
    { duration: '30s', target: 3 },
    { duration: '1m', target: 3 },
    { duration: '30s', target: 0 },
  ],

  // Gentle load test - 10 users, ~6 minutes
  // Use for: Baseline measurement, regular monitoring
  gentle: [
    { duration: '1m', target: 5 },
    { duration: '3m', target: 10 },
    { duration: '1m', target: 10 },
    { duration: '1m', target: 0 },
  ],

  // Moderate load - 20 users, ~7 minutes
  // Use for: Maximum safe production load testing
  moderate: [
    { duration: '1m', target: 10 },
    { duration: '3m', target: 20 },
    { duration: '2m', target: 20 },
    { duration: '1m', target: 0 },
  ],
}

// WARNING: These profiles are NOT safe for production
// Only use locally or when a staging environment is available
export const UNSAFE_PROFILES = {
  stress: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 },
  ],
  spike: [
    { duration: '1m', target: 10 },
    { duration: '30s', target: 100 },
    { duration: '1m', target: 10 },
    { duration: '30s', target: 0 },
  ],
}

// =============================================================================
// Helper Functions
// =============================================================================

/**
 * Get authorization headers for authenticated requests
 */
export function getAuthHeaders(token) {
  if (!token) {
    console.warn('No AUTH_TOKEN provided - authenticated endpoints will fail')
  }
  return {
    'Content-Type': 'application/json',
    'Cookie': `next-auth.session-token=${token}`,
  }
}

/**
 * Get the selected load profile
 */
export function getProfile() {
  const profileName = __ENV.PROFILE || 'smoke'

  if (UNSAFE_PROFILES[profileName]) {
    console.warn(`WARNING: Profile '${profileName}' is not safe for production!`)
    if (BASE_URL.includes('hta-calibration.com')) {
      console.error('Refusing to run unsafe profile against production. Use smoke/gentle/moderate.')
      return LOAD_PROFILES.smoke
    }
    return UNSAFE_PROFILES[profileName]
  }

  return LOAD_PROFILES[profileName] || LOAD_PROFILES.smoke
}

/**
 * Format bytes to human readable string
 */
export function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}

/**
 * Generate summary report
 */
export function generateSummary(data, testName) {
  const m = data.metrics
  const summary = `
================================================================================
                         LOAD TEST SUMMARY: ${testName}
================================================================================
Target:             ${BASE_URL}
Profile:            ${__ENV.PROFILE || 'smoke'}
Time:               ${new Date().toISOString()}

REQUESTS
  Total:            ${m.http_reqs?.values?.count || 0}
  Failed:           ${m.http_req_failed?.values?.passes || 0}
  Rate:             ${(m.http_reqs?.values?.rate || 0).toFixed(2)}/s

RESPONSE TIMES
  Average:          ${(m.http_req_duration?.values?.avg || 0).toFixed(2)}ms
  Median (p50):     ${(m.http_req_duration?.values?.med || 0).toFixed(2)}ms
  P90:              ${(m.http_req_duration?.values?.['p(90)'] || 0).toFixed(2)}ms
  P95:              ${(m.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)}ms
  P99:              ${(m.http_req_duration?.values?.['p(99)'] || 0).toFixed(2)}ms
  Max:              ${(m.http_req_duration?.values?.max || 0).toFixed(2)}ms

DATA TRANSFER
  Received:         ${formatBytes(m.data_received?.values?.count || 0)}
  Sent:             ${formatBytes(m.data_sent?.values?.count || 0)}
================================================================================
`
  return {
    stdout: summary,
    [`tests/load/results/${testName}-${Date.now()}.json`]: JSON.stringify(data, null, 2),
  }
}
