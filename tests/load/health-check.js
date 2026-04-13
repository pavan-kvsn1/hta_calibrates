/**
 * k6 Load Test: Health Check Endpoints
 *
 * PRODUCTION-SAFE: This test only calls read-only health endpoints.
 * No authentication required, no side effects.
 *
 * Usage:
 *   k6 run tests/load/health-check.js
 *   k6 run --env PROFILE=gentle tests/load/health-check.js
 *   k6 run --env BASE_URL=http://localhost:3000 tests/load/health-check.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'
import { BASE_URL, STRICT_THRESHOLDS, getProfile, generateSummary } from './config.js'

// =============================================================================
// Custom Metrics
// =============================================================================

const healthErrors = new Rate('health_errors')
const readyErrors = new Rate('ready_errors')
const healthDuration = new Trend('health_duration', true)
const readyDuration = new Trend('ready_duration', true)

// =============================================================================
// Test Configuration
// =============================================================================

export const options = {
  stages: getProfile(),
  thresholds: {
    ...STRICT_THRESHOLDS,
    health_errors: ['rate<0.001'],      // 99.9% success for health
    ready_errors: ['rate<0.01'],        // 99% success for ready
    health_duration: ['p(95)<100'],     // Health check under 100ms
    ready_duration: ['p(95)<500'],      // Ready check under 500ms (includes DB)
  },
}

// =============================================================================
// Test Execution
// =============================================================================

export default function () {
  // -------------------------------------------------------------------------
  // Liveness Probe: /api/health
  // -------------------------------------------------------------------------
  const healthRes = http.get(`${BASE_URL}/api/health`, {
    tags: { name: 'health' },
  })

  const healthOk = check(healthRes, {
    'health: status 200': (r) => r.status === 200,
    'health: response < 100ms': (r) => r.timings.duration < 100,
    'health: returns status': (r) => {
      try {
        const body = JSON.parse(r.body)
        return body.status === 'ok' || body.status === 'healthy'
      } catch {
        return false
      }
    },
  })

  healthErrors.add(!healthOk)
  healthDuration.add(healthRes.timings.duration)

  // -------------------------------------------------------------------------
  // Readiness Probe: /api/health/ready
  // -------------------------------------------------------------------------
  const readyRes = http.get(`${BASE_URL}/api/health/ready`, {
    tags: { name: 'ready' },
  })

  const readyOk = check(readyRes, {
    'ready: status 200': (r) => r.status === 200,
    'ready: response < 500ms': (r) => r.timings.duration < 500,
    'ready: database connected': (r) => {
      try {
        const body = JSON.parse(r.body)
        return body.database?.connected === true || body.checks?.database === 'ok'
      } catch {
        return r.status === 200 // Fallback if response format differs
      }
    },
  })

  readyErrors.add(!readyOk)
  readyDuration.add(readyRes.timings.duration)

  // Think time between iterations
  sleep(1)
}

// =============================================================================
// Summary Report
// =============================================================================

export function handleSummary(data) {
  return generateSummary(data, 'health-check')
}
