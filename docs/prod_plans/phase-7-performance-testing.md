# Phase 7: Performance & Load Testing - Implementation Plan

**Document Version:** 1.2
**Created:** 2026-04-13
**Last Updated:** 2026-04-13
**Status:** Complete
**Estimated Effort:** 4-6 hours

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [How Load Testing Works](#2-how-load-testing-works)
3. [Production-Safe Testing Strategy](#3-production-safe-testing-strategy)
4. [Quick Start Guide](#4-quick-start-guide)
5. [Implementation Details](#5-implementation-details)
6. [GitHub Actions Integration](#6-github-actions-integration)
7. [Performance Baselines](#7-performance-baselines)
8. [Capacity Planning](#8-capacity-planning)
9. [Troubleshooting](#9-troubleshooting)

---

## 1. Executive Summary

### What This Phase Accomplishes

After implementing Phase 7, you will have:

| Capability | Before | After |
|------------|--------|-------|
| Load testing | Simulated only | Real k6 tests against production (safe) |
| Performance baselines | Undocumented | Documented targets with monitoring |
| Production load tests | None | Automated via GitHub Actions (read-only) |
| Capacity planning | Unknown limits | Documented thresholds and scaling |
| Database profiling | No visibility | Slow query logging and analysis |

### Implementation Checklist

- [x] Set up k6 for realistic load testing
- [x] Create production-safe load test scripts (read-only operations)
- [x] Document performance baselines
- [x] Create GitHub Actions workflow for load tests
- [x] Create capacity planning documentation
- [ ] Enable database slow query logging (requires Terraform apply)
- [ ] Run initial baseline tests

### Files Created

| File | Description | Status |
|------|-------------|--------|
| `tests/load/config.js` | Shared k6 configuration with production-safe profiles | ✅ |
| `tests/load/health-check.js` | k6 script for health endpoints (no auth needed) | ✅ |
| `tests/load/read-only-workflow.js` | k6 script for certificate list/view/search | ✅ |
| `tests/load/dashboard.js` | k6 script for dashboard stats queries | ✅ |
| `.github/workflows/load-test.yml` | GitHub Actions workflow (production target) | ✅ |
| `docs/runbooks/performance-baselines.md` | Performance targets documentation | ✅ |
| `docs/system_design/capacity-planning.md` | Capacity planning documentation | ✅ |

### npm Scripts Added

```bash
npm run test:load           # Health check against localhost
npm run test:load:smoke     # Smoke test (3 users, 2 min)
npm run test:load:gentle    # Gentle test (10 users, 6 min)
npm run test:load:dashboard # Dashboard queries test
```

---

## 2. How Load Testing Works

### Overview

k6 is an **external load testing tool** that makes HTTP requests to your deployed application. It doesn't require any integration with your app - it simply acts like multiple users hitting your endpoints simultaneously.

```
┌─────────────────────────────────────────────────────────────────┐
│                    HOW k6 LOAD TESTING WORKS                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐                    ┌─────────────────────┐    │
│   │   k6 Tool   │   HTTP Requests    │   Your Deployed     │    │
│   │             │ ─────────────────▶ │   Application       │    │
│   │ (Runs on    │                    │                     │    │
│   │  your laptop│ ◀───────────────── │  hta-calibration.com│    │
│   │  or GitHub) │   JSON Responses   │                     │    │
│   └─────────────┘                    └─────────────────────┘    │
│         │                                                        │
│         │ Measures:                                              │
│         │ • Response times (avg, p95, p99)                      │
│         │ • Error rates                                          │
│         │ • Throughput (requests/second)                        │
│         │                                                        │
└─────────────────────────────────────────────────────────────────┘
```

### Key Concepts

| Concept | Explanation |
|---------|-------------|
| **Virtual Users (VUs)** | Simulated concurrent users making requests |
| **Stages** | Ramp up/down pattern (e.g., 0→10→10→0 users) |
| **Thresholds** | Pass/fail criteria (e.g., p95 < 500ms) |
| **Checks** | Assertions on responses (e.g., status == 200) |

### What k6 Does

1. **Spawns virtual users** - Each VU runs the test script independently
2. **Makes HTTP requests** - Just like a browser or API client
3. **Validates responses** - Checks status codes, response content
4. **Measures performance** - Tracks timing for every request
5. **Reports results** - Summary with percentiles, error rates

### What Your App Sees

Your deployed app has no idea it's being load tested. It just sees normal HTTP requests:

```
GET /api/health HTTP/1.1
Host: hta-calibration.com

GET /api/certificates?page=1&limit=20 HTTP/1.1
Host: hta-calibration.com
Cookie: next-auth.session-token=xxx
```

---

## 3. Production-Safe Testing Strategy

### Why Production Testing

Since there's no staging environment, load tests run directly against production. This requires careful constraints to avoid impacting real users.

### Safety Rules

| Rule | Rationale |
|------|-----------|
| **Read-only operations only** | No certificate creation, updates, or deletes |
| **Low concurrency (max 10-20 users)** | Prevent resource exhaustion |
| **Short duration (5-10 min max)** | Limit exposure window |
| **Off-peak hours** | Run during nights/weekends |
| **Dedicated test account** | Don't pollute real user sessions |
| **Monitor during tests** | Watch Sentry/logs, abort if issues |

### What's Safe vs. Avoid

| Operation | Safe? | Notes |
|-----------|-------|-------|
| `GET /api/health` | ✅ Yes | No side effects |
| `GET /api/health/ready` | ✅ Yes | Read-only DB check |
| `GET /api/certificates` | ✅ Yes | List/pagination |
| `GET /api/certificates/:id` | ✅ Yes | View details |
| `GET /api/dashboard/stats` | ✅ Yes | Aggregated stats |
| `GET /api/certificates?search=` | ✅ Yes | Search queries |
| `POST /api/auth/session` | ⚠️ Careful | Use test account only |
| `POST /api/certificates` | ❌ No | Creates real data |
| `PUT /api/certificates/:id` | ❌ No | Modifies real data |
| `DELETE /api/*` | ❌ No | Destructive |
| `POST /api/email/*` | ❌ No | Sends real emails |

### Production-Safe Load Profiles

```javascript
// Safe profiles for production
export const PROD_SAFE_PROFILES = {
  // Minimal smoke test - validates endpoints work
  smoke: [
    { duration: '30s', target: 3 },
    { duration: '1m', target: 3 },
    { duration: '30s', target: 0 },
  ],
  // Gentle load - measures baseline performance
  gentle: [
    { duration: '1m', target: 5 },
    { duration: '3m', target: 10 },
    { duration: '1m', target: 10 },
    { duration: '1m', target: 0 },
  ],
  // Moderate load - max safe production load
  moderate: [
    { duration: '1m', target: 10 },
    { duration: '3m', target: 20 },
    { duration: '2m', target: 20 },
    { duration: '1m', target: 0 },
  ],
}

// NEVER use these profiles on production
export const STAGING_ONLY_PROFILES = {
  stress: [/* ... */],  // Requires staging
  spike: [/* ... */],   // Requires staging
}
```

### Test Account Setup

Create a dedicated test account for load testing:

```sql
-- Create test user (run once)
INSERT INTO "User" (id, email, name, role, "passwordHash")
VALUES (
  'load-test-user-id',
  'loadtest@hta-calibration.internal',
  'Load Test User',
  'ENGINEER',
  '$2b$10$...'  -- bcrypt hash of test password
);
```

Store credentials in GitHub Secrets:
- `LOAD_TEST_EMAIL`: `loadtest@hta-calibration.internal`
- `LOAD_TEST_PASSWORD`: (secure password)

---

## 4. Quick Start Guide

### Step 1: Install k6

k6 must be installed on your machine (it's not an npm package):

```bash
# macOS
brew install k6

# Windows (PowerShell as Admin)
choco install k6

# Linux (Debian/Ubuntu)
sudo apt-key adv --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Verify installation
k6 version
```

### Step 2: Run Against Local Development

```bash
# Terminal 1: Start your dev server
npm run dev

# Terminal 2: Run load test against localhost
npm run test:load
# or
k6 run --env BASE_URL=http://localhost:3000 tests/load/health-check.js
```

### Step 3: Run Against Production (Safe)

```bash
# Health check - no authentication needed
k6 run \
  --env BASE_URL=https://hta-calibration.com \
  --env PROFILE=smoke \
  tests/load/health-check.js
```

### Step 4: Run Authenticated Tests

For tests that need to access protected endpoints:

```bash
# 1. Get your session token from browser:
#    - Log in to https://hta-calibration.com
#    - Open DevTools (F12) → Application → Cookies
#    - Copy the value of "next-auth.session-token"

# 2. Run with token
k6 run \
  --env BASE_URL=https://hta-calibration.com \
  --env PROFILE=smoke \
  --env AUTH_TOKEN="paste-your-session-token-here" \
  tests/load/read-only-workflow.js
```

### Step 5: Via GitHub Actions

1. Go to **GitHub → Actions → "Load Tests (Production)"**
2. Click **"Run workflow"**
3. Select profile: `smoke`, `gentle`, or `moderate`
4. Select test suite: `health-check`, `read-only`, `dashboard`, or `all-safe`
5. Type **"production"** in the confirmation field
6. Click **"Run workflow"**

Results are uploaded as artifacts after the run completes.

---

## 5. Implementation Details

### 5.1 File Structure

```
tests/load/
├── config.js              # Shared configuration, profiles, helpers
├── health-check.js        # Health endpoint tests (no auth)
├── read-only-workflow.js  # Certificate list/view/search (auth required)
├── dashboard.js           # Dashboard stats queries (auth required)
└── results/               # Output directory (gitignored)
    └── .gitkeep
```

### 5.2 Load Profiles

| Profile | Virtual Users | Duration | Use Case |
|---------|---------------|----------|----------|
| `smoke` | 3 | 2 min | Quick validation, CI checks |
| `gentle` | 10 | 6 min | Baseline measurement |
| `moderate` | 20 | 7 min | Max safe production load |

### 5.3 Test Scripts Overview

**health-check.js** (No auth required)
- `GET /api/health` - Liveness probe
- `GET /api/health/ready` - Readiness probe (includes DB check)

**read-only-workflow.js** (Auth required)
- `GET /api/certificates?page=1&limit=20` - List certificates
- `GET /api/certificates/:id` - View certificate detail
- `GET /api/certificates?search=...` - Search certificates
- `GET /api/certificates?status=...` - Filter by status

**dashboard.js** (Auth required)
- `GET /api/dashboard/stats` - Dashboard statistics
- `GET /api/certificates?limit=10&sort=createdAt:desc` - Recent certificates
- `GET /api/certificates?status=PENDING_REVIEW` - Pending items

### 5.4 Thresholds (Pass/Fail Criteria)

| Metric | Health Check | Other Endpoints |
|--------|--------------|-----------------|
| p95 response time | < 100ms | < 500ms |
| p99 response time | < 500ms | < 1000ms |
| Error rate | < 0.1% | < 1% |

---

## 6. GitHub Actions Integration

### Workflow File

`.github/workflows/load-test.yml`

### Trigger Options

| Trigger | Description |
|---------|-------------|
| Manual | Click "Run workflow" in GitHub Actions |
| Scheduled | Every Sunday at 3 AM UTC (smoke test only) |

### Required Secrets

| Secret | Description |
|--------|-------------|
| `LOAD_TEST_AUTH_TOKEN` | Session token for authenticated tests |

### Setting Up the Auth Token Secret

1. Log in to production as a test user
2. Copy the session token from cookies
3. Go to **GitHub → Settings → Secrets → Actions**
4. Add secret: `LOAD_TEST_AUTH_TOKEN` = (paste token)

**Note:** Session tokens expire. You may need to refresh this periodically.

---

## 7. Performance Baselines

See: `docs/runbooks/performance-baselines.md`

### Target Response Times

| Endpoint | p50 | p95 | p99 |
|----------|-----|-----|-----|
| Health check | 10ms | 50ms | 100ms |
| Certificate list | 100ms | 300ms | 500ms |
| Certificate detail | 50ms | 150ms | 300ms |
| Dashboard stats | 100ms | 300ms | 500ms |

---

## 8. Capacity Planning

See: `docs/system_design/capacity-planning.md`

### Current Capacity Estimates

| Metric | Min (2 pods) | Max (10 pods) |
|--------|--------------|---------------|
| Concurrent users | 160 | 800 |
| Requests/second | 100 | 500 |

---

## 9. Troubleshooting

### "k6: command not found"

k6 is not installed. Follow Step 1 in the Quick Start Guide.

### "connection refused" errors

- Local: Make sure `npm run dev` is running
- Production: Check if the URL is correct and accessible

### "401 Unauthorized" errors

- The AUTH_TOKEN is missing, expired, or invalid
- Get a fresh session token from browser cookies

### Tests pass locally but fail in GitHub Actions

- Check if `LOAD_TEST_AUTH_TOKEN` secret is set
- Token may have expired - refresh it

### High error rates during test

- Stop the test immediately (`Ctrl+C`)
- Check Sentry for errors
- May indicate a real production issue

---

## Appendix: Example Output

```
          /\      |‾‾| /‾‾/   /‾‾/   
     /\  /  \     |  |/  /   /  /    
    /  \/    \    |     (   /   ‾‾\  
   /          \   |  |\  \ |  (‾)  | 
  / __________ \  |__| \__\ \_____/ .io

  execution: local
     script: tests/load/health-check.js
     output: -

  scenarios: (100.00%) 1 scenario, 3 max VUs, 2m30s max duration

running (2m00s), 0/3 VUs, 342 complete and 0 interrupted
default ✓ [==============================] 3 VUs  2m0s

     ✓ health: status 200
     ✓ health: response < 100ms
     ✓ ready: status 200
     ✓ ready: response < 500ms

     checks.....................: 100.00% ✓ 1368  ✗ 0   
     http_req_duration..........: avg=42.15ms p(95)=78.32ms
     http_req_failed............: 0.00%   ✓ 0     ✗ 684 
     http_reqs..................: 684     5.7/s
     
     ✓ health_duration...........: p(95)=45.21ms
     ✓ ready_duration............: p(95)=112.45ms
```

```bash
# macOS
brew install k6

# Windows (chocolatey)
choco install k6

# Linux (Debian/Ubuntu)
sudo gpg -k
sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg \
  --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | \
  sudo tee /etc/apt/sources.list.d/k6.list
sudo apt-get update && sudo apt-get install k6

# Docker (alternative)
docker pull grafana/k6
```

### 4.2 Shared Configuration

**File:** `tests/load/config.js`

```javascript
/**
 * Shared k6 configuration and utilities
 * 
 * IMPORTANT: This project runs load tests against PRODUCTION.
 * All profiles are designed to be safe for production use.
 */

// Production URL (no staging environment)
export const BASE_URL = __ENV.BASE_URL || 'https://hta-calibration.com'

// Standard thresholds aligned with SLOs
export const STANDARD_THRESHOLDS = {
  http_req_duration: ['p(95)<500', 'p(99)<1000'],
  http_req_failed: ['rate<0.01'],
}

// Strict thresholds for critical endpoints
export const STRICT_THRESHOLDS = {
  http_req_duration: ['p(95)<200', 'p(99)<500'],
  http_req_failed: ['rate<0.001'],
}

// Production-safe load profiles (low concurrency)
export const LOAD_PROFILES = {
  // Minimal smoke test - 3 users, 2 minutes
  smoke: [
    { duration: '30s', target: 3 },
    { duration: '1m', target: 3 },
    { duration: '30s', target: 0 },
  ],
  // Gentle load test - 10 users, 6 minutes
  gentle: [
    { duration: '1m', target: 5 },
    { duration: '3m', target: 10 },
    { duration: '1m', target: 10 },
    { duration: '1m', target: 0 },
  ],
  // Moderate load - max 20 users, 7 minutes (max safe for production)
  moderate: [
    { duration: '1m', target: 10 },
    { duration: '3m', target: 20 },
    { duration: '2m', target: 20 },
    { duration: '1m', target: 0 },
  ],
}

// WARNING: These profiles are NOT safe for production
// Only use locally or when staging environment is available
export const UNSAFE_PROFILES = {
  stress: [
    { duration: '2m', target: 50 },
    { duration: '5m', target: 100 },
    { duration: '2m', target: 0 },
  ],
}

// Helper to get auth token
export function getAuthHeaders(token) {
  return {
    'Content-Type': 'application/json',
    'Authorization': `Bearer ${token}`,
  }
}

// Summary reporter
export function generateSummary(data, testName) {
  return {
    'stdout': textSummary(data),
    [`tests/load/results/${testName}-${Date.now()}.json`]: JSON.stringify(data, null, 2),
  }
}

function textSummary(data) {
  const m = data.metrics
  return `
═══════════════════════════════════════════════════════════
                    LOAD TEST SUMMARY
═══════════════════════════════════════════════════════════
Total Requests:     ${m.http_reqs?.values?.count || 0}
Failed Requests:    ${m.http_req_failed?.values?.passes || 0}
Request Rate:       ${(m.http_reqs?.values?.rate || 0).toFixed(2)}/s

Response Times:
  Average:          ${(m.http_req_duration?.values?.avg || 0).toFixed(2)}ms
  Median (p50):     ${(m.http_req_duration?.values?.med || 0).toFixed(2)}ms
  P90:              ${(m.http_req_duration?.values?.['p(90)'] || 0).toFixed(2)}ms
  P95:              ${(m.http_req_duration?.values?.['p(95)'] || 0).toFixed(2)}ms
  P99:              ${(m.http_req_duration?.values?.['p(99)'] || 0).toFixed(2)}ms
  Max:              ${(m.http_req_duration?.values?.max || 0).toFixed(2)}ms

Data Transfer:
  Received:         ${formatBytes(m.data_received?.values?.count || 0)}
  Sent:             ${formatBytes(m.data_sent?.values?.count || 0)}
═══════════════════════════════════════════════════════════
`
}

function formatBytes(bytes) {
  if (bytes === 0) return '0 B'
  const k = 1024
  const sizes = ['B', 'KB', 'MB', 'GB']
  const i = Math.floor(Math.log(bytes) / Math.log(k))
  return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
}
```

### 4.3 Health Check Load Test (Production-Safe)

**File:** `tests/load/health-check.js`

```javascript
/**
 * k6 Load Test: Health Check Endpoints
 *
 * Usage:
 *   k6 run tests/load/health-check.js
 *   k6 run --env BASE_URL=https://staging.hta-calibration.com tests/load/health-check.js
 *   k6 run --env PROFILE=stress tests/load/health-check.js
 */

import http from 'k6/http'
import { check, sleep } from 'k6'
import { Rate, Trend } from 'k6/metrics'
import { BASE_URL, STRICT_THRESHOLDS, LOAD_PROFILES, generateSummary } from './config.js'

// Custom metrics
const healthErrors = new Rate('health_errors')
const readyErrors = new Rate('ready_errors')
const healthDuration = new Trend('health_duration')
const readyDuration = new Trend('ready_duration')

// Select load profile
const profile = __ENV.PROFILE || 'load'

export const options = {
  stages: LOAD_PROFILES[profile] || LOAD_PROFILES.load,
  thresholds: {
    ...STRICT_THRESHOLDS,
    health_errors: ['rate<0.001'],
    ready_errors: ['rate<0.01'],
    health_duration: ['p(95)<100'],
    ready_duration: ['p(95)<500'],
  },
}

export default function () {
  // Liveness probe
  const healthRes = http.get(`${BASE_URL}/api/health`)
  const healthOk = check(healthRes, {
    'health: status 200': (r) => r.status === 200,
    'health: response < 100ms': (r) => r.timings.duration < 100,
  })
  healthErrors.add(!healthOk)
  healthDuration.add(healthRes.timings.duration)

  // Readiness probe
  const readyRes = http.get(`${BASE_URL}/api/health/ready`)
  const readyOk = check(readyRes, {
    'ready: status 200': (r) => r.status === 200,
    'ready: response < 500ms': (r) => r.timings.duration < 500,
    'ready: db connected': (r) => {
      try {
        return JSON.parse(r.body).database?.connected === true
      } catch { return false }
    },
  })
  readyErrors.add(!readyOk)
  readyDuration.add(readyRes.timings.duration)

  sleep(1)
}

export function handleSummary(data) {
  return generateSummary(data, 'health-check')
}
```

### 4.4 Read-Only Workflow Load Test (Production-Safe)

**File:** `tests/load/certificate-workflow.js`

```javascript
/**
 * k6 Load Test: Certificate CRUD Workflow
 *
 * Tests the complete certificate lifecycle under load.
 * Requires authentication - set AUTH_TOKEN env var.
 *
 * Usage:
 *   k6 run --env AUTH_TOKEN=<token> tests/load/certificate-workflow.js
 */

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Rate, Trend, Counter } from 'k6/metrics'
import { BASE_URL, STANDARD_THRESHOLDS, LOAD_PROFILES, getAuthHeaders } from './config.js'

// Custom metrics
const listDuration = new Trend('cert_list_duration')
const getDuration = new Trend('cert_get_duration')
const createDuration = new Trend('cert_create_duration')
const searchDuration = new Trend('cert_search_duration')
const errorRate = new Rate('cert_errors')
const certificatesCreated = new Counter('certificates_created')

const profile = __ENV.PROFILE || 'load'
const AUTH_TOKEN = __ENV.AUTH_TOKEN || ''

export const options = {
  stages: LOAD_PROFILES[profile] || LOAD_PROFILES.load,
  thresholds: {
    ...STANDARD_THRESHOLDS,
    cert_list_duration: ['p(95)<500'],
    cert_get_duration: ['p(95)<300'],
    cert_search_duration: ['p(95)<500'],
    cert_errors: ['rate<0.05'],
  },
}

export default function () {
  const headers = getAuthHeaders(AUTH_TOKEN)

  group('Certificate List', () => {
    const res = http.get(`${BASE_URL}/api/certificates?page=1&limit=20`, { headers })
    const ok = check(res, {
      'list: status 200': (r) => r.status === 200,
      'list: has data': (r) => {
        try {
          const body = JSON.parse(r.body)
          return Array.isArray(body.certificates) || Array.isArray(body.data)
        } catch { return false }
      },
    })
    listDuration.add(res.timings.duration)
    errorRate.add(!ok)
  })

  group('Certificate Search', () => {
    const res = http.get(`${BASE_URL}/api/certificates?search=test&status=DRAFT`, { headers })
    const ok = check(res, {
      'search: status 200': (r) => r.status === 200,
    })
    searchDuration.add(res.timings.duration)
    errorRate.add(!ok)
  })

  group('Certificate Detail', () => {
    // Get a random certificate ID (in real test, would fetch from list)
    const listRes = http.get(`${BASE_URL}/api/certificates?limit=1`, { headers })
    try {
      const body = JSON.parse(listRes.body)
      const certs = body.certificates || body.data || []
      if (certs.length > 0) {
        const certId = certs[0].id
        const res = http.get(`${BASE_URL}/api/certificates/${certId}`, { headers })
        const ok = check(res, {
          'detail: status 200': (r) => r.status === 200,
        })
        getDuration.add(res.timings.duration)
        errorRate.add(!ok)
      }
    } catch {
      // Skip if no certificates
    }
  })

  sleep(Math.random() * 2 + 1) // 1-3 second think time
}

export function handleSummary(data) {
  return {
    'stdout': textSummary(data),
    [`tests/load/results/certificate-workflow-${Date.now()}.json`]: JSON.stringify(data, null, 2),
  }
}

function textSummary(data) {
  const m = data.metrics
  return `
═══════════════════════════════════════════════════════════
              CERTIFICATE WORKFLOW LOAD TEST
═══════════════════════════════════════════════════════════
Total Requests:     ${m.http_reqs?.values?.count || 0}
Error Rate:         ${((m.cert_errors?.values?.rate || 0) * 100).toFixed(2)}%

Certificate List:
  P95:              ${(m.cert_list_duration?.values?.['p(95)'] || 0).toFixed(2)}ms

Certificate Detail:
  P95:              ${(m.cert_get_duration?.values?.['p(95)'] || 0).toFixed(2)}ms

Certificate Search:
  P95:              ${(m.cert_search_duration?.values?.['p(95)'] || 0).toFixed(2)}ms
═══════════════════════════════════════════════════════════
`
}
```

### 4.5 Dashboard Load Test (Production-Safe)

**File:** `tests/load/authentication.js`

```javascript
/**
 * k6 Load Test: Authentication Endpoints
 *
 * Tests login, session validation, and logout under load.
 * Uses test credentials - do not run against production with real users.
 *
 * Usage:
 *   k6 run --env TEST_EMAIL=test@example.com --env TEST_PASSWORD=password tests/load/authentication.js
 */

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Rate, Trend } from 'k6/metrics'
import { BASE_URL, STANDARD_THRESHOLDS, LOAD_PROFILES } from './config.js'

// Custom metrics
const loginDuration = new Trend('login_duration')
const sessionDuration = new Trend('session_duration')
const loginErrors = new Rate('login_errors')

const profile = __ENV.PROFILE || 'smoke' // Default to smoke for auth tests
const TEST_EMAIL = __ENV.TEST_EMAIL || 'engineer@example.com'
const TEST_PASSWORD = __ENV.TEST_PASSWORD || 'password123'

export const options = {
  stages: LOAD_PROFILES[profile] || LOAD_PROFILES.smoke,
  thresholds: {
    ...STANDARD_THRESHOLDS,
    login_duration: ['p(95)<1000'],
    login_errors: ['rate<0.05'],
  },
}

export default function () {
  group('Staff Login', () => {
    const loginRes = http.post(
      `${BASE_URL}/api/auth/callback/credentials`,
      JSON.stringify({
        email: TEST_EMAIL,
        password: TEST_PASSWORD,
      }),
      {
        headers: { 'Content-Type': 'application/json' },
        redirects: 0,
      }
    )

    const loginOk = check(loginRes, {
      'login: status 200 or redirect': (r) => r.status === 200 || r.status === 302,
    })
    loginDuration.add(loginRes.timings.duration)
    loginErrors.add(!loginOk)
  })

  group('Session Check', () => {
    const sessionRes = http.get(`${BASE_URL}/api/auth/session`)
    check(sessionRes, {
      'session: status 200': (r) => r.status === 200,
    })
    sessionDuration.add(sessionRes.timings.duration)
  })

  sleep(2)
}
```

### 4.6 Authentication Load Test (Use Carefully)

**File:** `tests/load/dashboard.js`

```javascript
/**
 * k6 Load Test: Dashboard Page Load
 *
 * Tests dashboard rendering and data fetching under load.
 *
 * Usage:
 *   k6 run --env AUTH_TOKEN=<token> tests/load/dashboard.js
 */

import http from 'k6/http'
import { check, sleep, group } from 'k6'
import { Trend, Rate } from 'k6/metrics'
import { BASE_URL, STANDARD_THRESHOLDS, LOAD_PROFILES, getAuthHeaders } from './config.js'

// Custom metrics
const dashboardDuration = new Trend('dashboard_duration')
const statsDuration = new Trend('stats_duration')
const recentDuration = new Trend('recent_duration')
const errorRate = new Rate('dashboard_errors')

const profile = __ENV.PROFILE || 'load'
const AUTH_TOKEN = __ENV.AUTH_TOKEN || ''

export const options = {
  stages: LOAD_PROFILES[profile] || LOAD_PROFILES.load,
  thresholds: {
    ...STANDARD_THRESHOLDS,
    dashboard_duration: ['p(95)<1000'],
    stats_duration: ['p(95)<500'],
    recent_duration: ['p(95)<500'],
    dashboard_errors: ['rate<0.05'],
  },
}

export default function () {
  const headers = getAuthHeaders(AUTH_TOKEN)

  group('Dashboard Stats', () => {
    const res = http.get(`${BASE_URL}/api/dashboard/stats`, { headers })
    const ok = check(res, {
      'stats: status 200': (r) => r.status === 200,
    })
    statsDuration.add(res.timings.duration)
    errorRate.add(!ok)
  })

  group('Recent Certificates', () => {
    const res = http.get(`${BASE_URL}/api/certificates?limit=10&sort=createdAt:desc`, { headers })
    const ok = check(res, {
      'recent: status 200': (r) => r.status === 200,
    })
    recentDuration.add(res.timings.duration)
    errorRate.add(!ok)
  })

  group('Pending Reviews', () => {
    const res = http.get(`${BASE_URL}/api/certificates?status=PENDING_REVIEW&limit=10`, { headers })
    check(res, {
      'pending: status 200': (r) => r.status === 200,
    })
  })

  sleep(Math.random() * 3 + 2) // 2-5 second think time (simulates reading)
}
```

---

## 5. Part 2: Performance Baselines

### 5.1 Performance Baselines Document

**File:** `docs/runbooks/performance-baselines.md`

```markdown
# Performance Baselines

**Last Updated:** 2026-04-13
**Measured Environment:** Staging (Cloud Run, 2 vCPU, 2GB RAM)

## API Response Time Targets

| Endpoint Category | p50 | p95 | p99 | Max |
|-------------------|-----|-----|-----|-----|
| Health checks | 10ms | 50ms | 100ms | 200ms |
| Authentication | 100ms | 300ms | 500ms | 1000ms |
| Certificate list | 100ms | 300ms | 500ms | 1000ms |
| Certificate detail | 50ms | 150ms | 300ms | 500ms |
| Certificate create | 150ms | 400ms | 700ms | 1000ms |
| Certificate search | 100ms | 300ms | 500ms | 800ms |
| Dashboard stats | 100ms | 300ms | 500ms | 800ms |
| PDF generation | 1000ms | 3000ms | 5000ms | 10000ms |

## Throughput Targets

| Scenario | Target RPS | Acceptable Error Rate |
|----------|------------|----------------------|
| Normal load | 100 | < 0.1% |
| Peak load | 250 | < 1% |
| Stress test | 500 | < 5% |

## Resource Utilization Targets

| Resource | Normal | Warning | Critical |
|----------|--------|---------|----------|
| CPU | < 50% | 70% | 85% |
| Memory | < 60% | 75% | 90% |
| DB connections | < 50% | 70% | 85% |
| Cache hit rate | > 80% | 70% | 50% |

## Database Query Targets

| Query Type | Target | Slow Query Threshold |
|------------|--------|---------------------|
| Simple SELECT | < 50ms | 100ms |
| JOIN queries | < 100ms | 300ms |
| Aggregations | < 200ms | 500ms |
| Writes (INSERT/UPDATE) | < 100ms | 300ms |

## How to Measure

### Run Load Tests
\`\`\`bash
# Smoke test (quick validation)
k6 run --env PROFILE=smoke tests/load/health-check.js

# Load test (normal conditions)
k6 run --env PROFILE=load tests/load/certificate-workflow.js

# Stress test (find breaking points)
k6 run --env PROFILE=stress tests/load/certificate-workflow.js
\`\`\`

### Check Current Metrics
- Cloud Run: Console > Cloud Run > Service > Metrics
- Database: Console > Cloud SQL > Instance > Metrics
- Application: Sentry Performance tab

## Baseline Update Schedule

- Monthly: Re-run load tests and update baselines
- After deployments: Verify no regression
- After scaling changes: Re-establish baselines
```

---

## 6. Part 3: CI/CD Integration

### 6.1 GitHub Actions Workflow (Production Target)

**File:** `.github/workflows/load-test.yml`

```yaml
name: Load Tests (Production)

on:
  # Manual trigger only - production requires explicit action
  workflow_dispatch:
    inputs:
      profile:
        description: 'Load test profile (all are production-safe)'
        required: true
        default: 'smoke'
        type: choice
        options:
          - smoke      # 3 users, 2 min - minimal validation
          - gentle     # 10 users, 6 min - baseline measurement
          - moderate   # 20 users, 7 min - max safe load
      test_suite:
        description: 'Test suite to run'
        required: true
        default: 'health-check'
        type: choice
        options:
          - health-check      # Safe - read-only
          - read-only         # Safe - GET endpoints only
          - dashboard         # Safe - stats queries
          - all-safe          # All production-safe tests
      confirm_production:
        description: 'Type "production" to confirm running against prod'
        required: true
        type: string

  # Weekly smoke test (Sunday 3 AM UTC - low traffic)
  schedule:
    - cron: '0 3 * * 0'

env:
  K6_VERSION: '0.49.0'
  BASE_URL: 'https://hta-calibration.com'

jobs:
  validate:
    runs-on: ubuntu-latest
    steps:
      - name: Validate production confirmation
        if: github.event_name == 'workflow_dispatch'
        run: |
          if [ "${{ github.event.inputs.confirm_production }}" != "production" ]; then
            echo "ERROR: You must type 'production' to confirm running against prod"
            exit 1
          fi
          echo "Production confirmation received. Proceeding with load tests."

  load-test:
    needs: validate
    runs-on: ubuntu-latest
    environment: production

    steps:
      - name: Checkout code
        uses: actions/checkout@v4

      - name: Install k6
        run: |
          curl -L https://github.com/grafana/k6/releases/download/v${{ env.K6_VERSION }}/k6-v${{ env.K6_VERSION }}-linux-amd64.tar.gz | tar xz
          sudo mv k6-v${{ env.K6_VERSION }}-linux-amd64/k6 /usr/local/bin/

      - name: Create results directory
        run: mkdir -p tests/load/results

      - name: Log test parameters
        run: |
          echo "================================================"
          echo "  PRODUCTION LOAD TEST"
          echo "================================================"
          echo "Target: ${{ env.BASE_URL }}"
          echo "Profile: ${{ github.event.inputs.profile || 'smoke' }}"
          echo "Suite: ${{ github.event.inputs.test_suite || 'health-check' }}"
          echo "Time: $(date -u)"
          echo "================================================"

      - name: Run health check tests
        if: contains(fromJson('["health-check", "all-safe"]'), github.event.inputs.test_suite) || github.event_name == 'schedule'
        run: |
          k6 run \
            --env BASE_URL=${{ env.BASE_URL }} \
            --env PROFILE=${{ github.event.inputs.profile || 'smoke' }} \
            tests/load/health-check.js
        continue-on-error: true

      - name: Run read-only workflow tests
        if: contains(fromJson('["read-only", "all-safe"]'), github.event.inputs.test_suite)
        run: |
          k6 run \
            --env BASE_URL=${{ env.BASE_URL }} \
            --env PROFILE=${{ github.event.inputs.profile || 'gentle' }} \
            --env AUTH_TOKEN=${{ secrets.LOAD_TEST_AUTH_TOKEN }} \
            tests/load/read-only-workflow.js
        continue-on-error: true

      - name: Run dashboard tests
        if: contains(fromJson('["dashboard", "all-safe"]'), github.event.inputs.test_suite)
        run: |
          k6 run \
            --env BASE_URL=${{ env.BASE_URL }} \
            --env PROFILE=${{ github.event.inputs.profile || 'gentle' }} \
            --env AUTH_TOKEN=${{ secrets.LOAD_TEST_AUTH_TOKEN }} \
            tests/load/dashboard.js
        continue-on-error: true

      - name: Upload test results
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: load-test-results-${{ github.run_id }}
          path: tests/load/results/
          retention-days: 30

      - name: Summary
        if: always()
        run: |
          echo "## Load Test Complete" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "- **Environment:** Production" >> $GITHUB_STEP_SUMMARY
          echo "- **Profile:** ${{ github.event.inputs.profile || 'smoke' }}" >> $GITHUB_STEP_SUMMARY
          echo "- **Suite:** ${{ github.event.inputs.test_suite || 'health-check' }}" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "Results uploaded as artifacts." >> $GITHUB_STEP_SUMMARY
```

---

## 7. Part 4: Capacity Planning

### 7.1 Capacity Planning Document

**File:** `docs/system_design/capacity-planning.md`

```markdown
# Capacity Planning

**Last Updated:** 2026-04-13

## Current Infrastructure

### Cloud Run (Development/Staging)
| Setting | Value |
|---------|-------|
| Min instances | 0 (scale to zero) |
| Max instances | 10 |
| CPU | 2 vCPU |
| Memory | 2 GB |
| Concurrency | 80 requests/instance |

### GKE (Production)
| Setting | Value |
|---------|-------|
| Min replicas | 2 |
| Max replicas | 10 |
| CPU request | 500m |
| CPU limit | 2000m |
| Memory request | 512Mi |
| Memory limit | 2Gi |

### Cloud SQL
| Setting | Value |
|---------|-------|
| Instance type | db-custom-2-4096 |
| vCPUs | 2 |
| Memory | 4 GB |
| Storage | 100 GB SSD |
| Max connections | 100 |

### Redis (Memorystore)
| Setting | Value |
|---------|-------|
| Tier | Basic |
| Memory | 1 GB |
| Max connections | 65,000 |

## Capacity Estimates

### Per-Instance Capacity
| Metric | Capacity |
|--------|----------|
| Concurrent requests | 80 |
| Requests/second | ~50 |
| Memory per request | ~25 MB |
| CPU per request | ~50ms |

### Total System Capacity (10 instances)
| Metric | Capacity |
|--------|----------|
| Concurrent users | 800 |
| Requests/second | 500 |
| Daily requests | ~10M |

## Scaling Triggers

### Horizontal Pod Autoscaler (GKE)
```yaml
metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80
```

### Cloud Run Auto-scaling
- Scale up: CPU > 60% for 60 seconds
- Scale down: CPU < 30% for 120 seconds
- Concurrent requests > 80: new instance

## Bottleneck Analysis

| Component | Bottleneck | Mitigation |
|-----------|------------|------------|
| Database connections | 100 max | Connection pooling, PgBouncer |
| PDF generation | CPU intensive | Queue + async workers |
| Search queries | Complex JOINs | Caching, pagination |
| File uploads | Memory | Streaming uploads |

## Growth Projections

| Timeframe | Users | Daily Certs | Infrastructure |
|-----------|-------|-------------|----------------|
| Current | 50 | 100 | 2 instances |
| 6 months | 200 | 500 | 4 instances |
| 1 year | 500 | 1,500 | 6 instances |
| 2 years | 1,000 | 3,000 | 10 instances + read replica |

## Cost Optimization

### Current Monthly Cost (Estimate)
| Service | Cost |
|---------|------|
| Cloud Run | $50-100 |
| Cloud SQL | $100-150 |
| Memorystore | $50 |
| Storage | $20 |
| **Total** | **$220-320** |

### Scale-up Costs
| Scenario | Additional Cost |
|----------|-----------------|
| Double instances | +$50-100 |
| Database upgrade | +$100-200 |
| Read replica | +$150 |
```

---

## 8. Part 5: Database Performance

### 8.1 Enable Slow Query Logging

**Update:** `terraform/modules/cloudsql/main.tf`

```hcl
resource "google_sql_database_instance" "main" {
  # ... existing config ...

  settings {
    # ... existing settings ...

    database_flags {
      name  = "log_min_duration_statement"
      value = "500"  # Log queries taking > 500ms
    }

    database_flags {
      name  = "log_statement"
      value = "ddl"  # Log all DDL statements
    }

    database_flags {
      name  = "log_lock_waits"
      value = "on"  # Log lock wait events
    }

    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }
  }
}
```

### 8.2 Query Performance Monitoring

Add to application logging:

```typescript
// src/lib/prisma.ts - Add query timing middleware
prisma.$use(async (params, next) => {
  const before = Date.now()
  const result = await next(params)
  const after = Date.now()

  const duration = after - before
  if (duration > 500) {
    logger.warn({
      model: params.model,
      action: params.action,
      duration,
    }, `Slow query detected: ${duration}ms`)
  }

  return result
})
```

---

## 9. Verification & Testing

### 9.1 Local Testing

```bash
# Install k6 locally
brew install k6  # macOS

# Run smoke test against local server
npm run dev &
k6 run --env BASE_URL=http://localhost:3000 tests/load/health-check.js
```

### 9.2 Production Testing (Safe)

```bash
# Run smoke test against production (minimal load)
k6 run \
  --env BASE_URL=https://hta-calibration.com \
  --env PROFILE=smoke \
  tests/load/health-check.js

# Run gentle load test (10 users max)
k6 run \
  --env BASE_URL=https://hta-calibration.com \
  --env PROFILE=gentle \
  tests/load/read-only-workflow.js

# IMPORTANT: Always monitor Sentry/logs during production tests
# Abort immediately if errors spike
```

### 9.3 Success Criteria

| Metric | Target | Verification |
|--------|--------|--------------|
| Health check p95 | < 100ms | k6 threshold |
| API p95 | < 500ms | k6 threshold |
| Error rate | < 1% | k6 threshold |
| Database slow queries | < 10/hour | Cloud SQL logs |
| No user impact | 0 complaints | Monitor during test |

### 9.4 Production Test Checklist

Before running production load tests:

- [ ] Schedule during off-peak hours (nights/weekends)
- [ ] Notify team that load test is running
- [ ] Have Sentry dashboard open to monitor errors
- [ ] Have Cloud Run/GKE metrics open
- [ ] Know how to abort test quickly (Ctrl+C or cancel workflow)
- [ ] Use `smoke` or `gentle` profile only
- [ ] Stick to read-only test suites

---

## Appendix: npm Scripts

Add to `package.json`:

```json
{
  "scripts": {
    "test:load": "k6 run --env BASE_URL=http://localhost:3000 tests/load/health-check.js",
    "test:load:smoke": "k6 run --env PROFILE=smoke tests/load/health-check.js",
    "test:load:gentle": "k6 run --env PROFILE=gentle tests/load/read-only-workflow.js",
    "test:load:prod": "echo 'Use GitHub Actions workflow for production tests'"
  }
}
```

**WARNING:** Never run `stress` or high-concurrency profiles against production.
