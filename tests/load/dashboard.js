/**
 * k6 Load Test: Dashboard Queries
 *
 * PRODUCTION-SAFE: This test only performs GET operations.
 * - Dashboard stats/metrics
 * - Recent certificates
 * - Pending items counts
 *
 * Usage:
 *   k6 run --env AUTH_TOKEN=<session-token> tests/load/dashboard.js
 *   k6 run --env PROFILE=gentle --env AUTH_TOKEN=<token> tests/load/dashboard.js
 */

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Rate, Trend } from 'k6/metrics'
import { BASE_URL, STANDARD_THRESHOLDS, getProfile, getAuthHeaders, generateSummary } from './config.js'

// =============================================================================
// Custom Metrics
// =============================================================================

const errorRate = new Rate('dashboard_errors')
const statsDuration = new Trend('stats_duration', true)
const recentDuration = new Trend('recent_duration', true)
const pendingDuration = new Trend('pending_duration', true)

// =============================================================================
// Configuration
// =============================================================================

const AUTH_TOKEN = __ENV.AUTH_TOKEN || ''

export const options = {
  stages: getProfile(),
  thresholds: {
    ...STANDARD_THRESHOLDS,
    dashboard_errors: ['rate<0.05'],       // 95% success rate
    stats_duration: ['p(95)<500'],         // Stats under 500ms
    recent_duration: ['p(95)<500'],        // Recent list under 500ms
    pending_duration: ['p(95)<500'],       // Pending counts under 500ms
  },
}

// =============================================================================
// Test Execution
// =============================================================================

export default function () {
  const headers = getAuthHeaders(AUTH_TOKEN)

  // -------------------------------------------------------------------------
  // Group: Dashboard Stats
  // -------------------------------------------------------------------------
  group('Dashboard Stats', () => {
    // Try dashboard stats endpoint (may vary by implementation)
    const statsRes = http.get(`${BASE_URL}/api/dashboard/stats`, {
      headers,
      tags: { name: 'dashboard-stats' },
    })

    // If dedicated stats endpoint doesn't exist, this may 404 - that's OK
    const ok = check(statsRes, {
      'stats: status 200 or 404': (r) => r.status === 200 || r.status === 404,
    })

    if (statsRes.status === 200) {
      statsDuration.add(statsRes.timings.duration)
    }
    errorRate.add(statsRes.status >= 500)
  })

  // -------------------------------------------------------------------------
  // Group: Recent Certificates
  // -------------------------------------------------------------------------
  group('Recent Certificates', () => {
    const res = http.get(`${BASE_URL}/api/certificates?limit=10&sort=createdAt:desc`, {
      headers,
      tags: { name: 'recent-certs' },
    })

    const ok = check(res, {
      'recent: status 200': (r) => r.status === 200,
      'recent: has data': (r) => {
        try {
          const body = JSON.parse(r.body)
          return body.certificates || body.data
        } catch {
          return false
        }
      },
    })

    errorRate.add(!ok)
    recentDuration.add(res.timings.duration)
  })

  // -------------------------------------------------------------------------
  // Group: Pending Review
  // -------------------------------------------------------------------------
  group('Pending Review', () => {
    const res = http.get(`${BASE_URL}/api/certificates?status=PENDING_REVIEW&limit=10`, {
      headers,
      tags: { name: 'pending-review' },
    })

    const ok = check(res, {
      'pending: status 200': (r) => r.status === 200,
    })

    errorRate.add(!ok)
    pendingDuration.add(res.timings.duration)
  })

  // -------------------------------------------------------------------------
  // Group: Draft Certificates
  // -------------------------------------------------------------------------
  group('Draft Certificates', () => {
    const res = http.get(`${BASE_URL}/api/certificates?status=DRAFT&limit=10`, {
      headers,
      tags: { name: 'draft-certs' },
    })

    check(res, {
      'drafts: status 200': (r) => r.status === 200,
    })
  })

  // -------------------------------------------------------------------------
  // Group: Completed This Month
  // -------------------------------------------------------------------------
  group('Monthly Stats', () => {
    const now = new Date()
    const startOfMonth = new Date(now.getFullYear(), now.getMonth(), 1).toISOString()

    const res = http.get(
      `${BASE_URL}/api/certificates?status=COMPLETED&createdAfter=${startOfMonth}&limit=50`,
      {
        headers,
        tags: { name: 'monthly-completed' },
      }
    )

    check(res, {
      'monthly: status 200': (r) => r.status === 200,
    })
  })

  // Think time - simulates user viewing dashboard
  sleep(Math.random() * 3 + 2) // 2-5 seconds (longer for dashboard)
}

// =============================================================================
// Summary Report
// =============================================================================

export function handleSummary(data) {
  return generateSummary(data, 'dashboard')
}
