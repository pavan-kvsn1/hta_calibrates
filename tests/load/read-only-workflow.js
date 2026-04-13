/**
 * k6 Load Test: Read-Only Certificate Workflow
 *
 * PRODUCTION-SAFE: This test only performs GET operations.
 * - Lists certificates
 * - Views certificate details
 * - Searches/filters certificates
 *
 * NO create, update, delete, or email operations.
 *
 * Usage:
 *   k6 run --env AUTH_TOKEN=<session-token> tests/load/read-only-workflow.js
 *   k6 run --env PROFILE=gentle --env AUTH_TOKEN=<token> tests/load/read-only-workflow.js
 */

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Rate, Trend } from 'k6/metrics'
import { BASE_URL, STANDARD_THRESHOLDS, getProfile, getAuthHeaders, generateSummary } from './config.js'

// =============================================================================
// Custom Metrics
// =============================================================================

const errorRate = new Rate('workflow_errors')
const listDuration = new Trend('cert_list_duration', true)
const detailDuration = new Trend('cert_detail_duration', true)
const searchDuration = new Trend('cert_search_duration', true)

// =============================================================================
// Configuration
// =============================================================================

const AUTH_TOKEN = __ENV.AUTH_TOKEN || ''

export const options = {
  stages: getProfile(),
  thresholds: {
    ...STANDARD_THRESHOLDS,
    workflow_errors: ['rate<0.05'],           // 95% success rate
    cert_list_duration: ['p(95)<500'],        // List under 500ms
    cert_detail_duration: ['p(95)<300'],      // Detail under 300ms
    cert_search_duration: ['p(95)<500'],      // Search under 500ms
  },
}

// =============================================================================
// Test Execution
// =============================================================================

export default function () {
  const headers = getAuthHeaders(AUTH_TOKEN)
  let certificateId = null

  // -------------------------------------------------------------------------
  // Group: List Certificates
  // -------------------------------------------------------------------------
  group('Certificate List', () => {
    const res = http.get(`${BASE_URL}/api/certificates?page=1&limit=20`, {
      headers,
      tags: { name: 'cert-list' },
    })

    const ok = check(res, {
      'list: status 200': (r) => r.status === 200,
      'list: has data': (r) => {
        try {
          const body = JSON.parse(r.body)
          const certs = body.certificates || body.data || []
          // Capture first certificate ID for detail view
          if (certs.length > 0) {
            certificateId = certs[0].id
          }
          return Array.isArray(certs)
        } catch {
          return false
        }
      },
    })

    errorRate.add(!ok)
    listDuration.add(res.timings.duration)
  })

  // -------------------------------------------------------------------------
  // Group: Certificate Detail (if we have an ID)
  // -------------------------------------------------------------------------
  if (certificateId) {
    group('Certificate Detail', () => {
      const res = http.get(`${BASE_URL}/api/certificates/${certificateId}`, {
        headers,
        tags: { name: 'cert-detail' },
      })

      const ok = check(res, {
        'detail: status 200': (r) => r.status === 200,
        'detail: has certificate data': (r) => {
          try {
            const body = JSON.parse(r.body)
            return body.id || body.certificate?.id
          } catch {
            return false
          }
        },
      })

      errorRate.add(!ok)
      detailDuration.add(res.timings.duration)
    })
  }

  // -------------------------------------------------------------------------
  // Group: Search Certificates
  // -------------------------------------------------------------------------
  group('Certificate Search', () => {
    // Search by status
    const statusRes = http.get(`${BASE_URL}/api/certificates?status=COMPLETED&limit=10`, {
      headers,
      tags: { name: 'cert-search-status' },
    })

    check(statusRes, {
      'search-status: status 200': (r) => r.status === 200,
    })
    searchDuration.add(statusRes.timings.duration)

    // Search by text
    const textRes = http.get(`${BASE_URL}/api/certificates?search=calibration&limit=10`, {
      headers,
      tags: { name: 'cert-search-text' },
    })

    const ok = check(textRes, {
      'search-text: status 200': (r) => r.status === 200,
    })

    errorRate.add(!ok)
    searchDuration.add(textRes.timings.duration)
  })

  // -------------------------------------------------------------------------
  // Group: Paginated List
  // -------------------------------------------------------------------------
  group('Pagination', () => {
    // Page 1
    const page1 = http.get(`${BASE_URL}/api/certificates?page=1&limit=10`, {
      headers,
      tags: { name: 'cert-page-1' },
    })

    check(page1, {
      'page1: status 200': (r) => r.status === 200,
    })

    // Page 2 (if available)
    const page2 = http.get(`${BASE_URL}/api/certificates?page=2&limit=10`, {
      headers,
      tags: { name: 'cert-page-2' },
    })

    check(page2, {
      'page2: status 200 or empty': (r) => r.status === 200,
    })
  })

  // Think time - simulates user reading/reviewing
  sleep(Math.random() * 2 + 1) // 1-3 seconds
}

// =============================================================================
// Summary Report
// =============================================================================

export function handleSummary(data) {
  return generateSummary(data, 'read-only-workflow')
}
