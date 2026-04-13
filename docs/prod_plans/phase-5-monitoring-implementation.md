# Phase 5: Monitoring & Observability - Implementation Plan

**Document Version:** 1.2
**Created:** April 2026
**Last Updated:** 2026-04-09
**Status:** All Parts Complete (Sentry + Structured Logging + Terraform Monitoring)
**Estimated Effort:** 4-6 hours (5 hours completed)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [What We're Building](#2-what-were-building)
3. [Prerequisites](#3-prerequisites)
4. [Part 1: Sentry Setup](#4-part-1-sentry-setup)
5. [Part 2: Structured Logging with Pino](#5-part-2-structured-logging-with-pino)
6. [Part 3: GCP Cloud Logging Integration](#6-part-3-gcp-cloud-logging-integration)
7. [Part 4: Metrics & Dashboards](#7-part-4-metrics--dashboards)
8. [Part 5: Alerting Configuration](#8-part-5-alerting-configuration)
9. [Future-Proofing for Phase 9](#9-future-proofing-for-phase-9)
10. [Verification & Testing](#10-verification--testing)
11. [Glossary](#11-glossary)

---

## 1. Executive Summary

### What This Phase Accomplishes

After implementing Phase 5, you will have:

| Capability | Before | After |
|------------|--------|-------|
| Error tracking | `console.error()` disappears into void | Every error captured, grouped, alerted |
| Debugging | Search through Cloud Run logs manually | Structured, searchable logs with context |
| Performance visibility | None | Request latency, error rates, trends |
| Incident response | Find out from users | Email alert within minutes |
| Production confidence | "Is it working?" | Dashboard shows health at a glance |

### Components Overview

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    PHASE 5 MONITORING STACK                              │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Your Next.js Application                                               │
│   ┌─────────────────────────────────────────────────────────────────┐   │
│   │                                                                  │   │
│   │  ┌─────────────┐  ┌─────────────┐  ┌─────────────────────────┐  │   │
│   │  │   Sentry    │  │    Pino     │  │   Custom Metrics       │  │   │
│   │  │   SDK       │  │   Logger    │  │   (optional)           │  │   │
│   │  │             │  │             │  │                        │  │   │
│   │  │ • Errors    │  │ • Structured│  │ • Business KPIs        │  │   │
│   │  │ • Traces    │  │   JSON logs │  │ • Request counts       │  │   │
│   │  │ • Context   │  │ • Context   │  │ • Processing times     │  │   │
│   │  └──────┬──────┘  └──────┬──────┘  └───────────┬─────────────┘  │   │
│   │         │                │                     │                │   │
│   └─────────│────────────────│─────────────────────│────────────────┘   │
│             │                │                     │                    │
│             ▼                ▼                     ▼                    │
│   ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐        │
│   │   Sentry.io    │  │  GCP Cloud      │  │  GCP Cloud      │        │
│   │   (Free Tier)   │  │  Logging        │  │  Monitoring     │        │
│   │                 │  │                 │  │                 │        │
│   │ • Error groups  │  │ • Log search    │  │ • Dashboards    │        │
│   │ • Alerts→Email  │  │ • Log-based     │  │ • Metrics       │        │
│   │ • Performance   │  │   metrics       │  │ • Alerts        │        │
│   └─────────────────┘  └─────────────────┘  └─────────────────┘        │
│                                                                          │
│   Total Cost: $0 (free tiers sufficient for your scale)                 │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## 2. What We're Building

### 2.1 Sentry - Error Tracking

**What it is (0-10 explanation):**

```
Level 0: "It tells you when your app breaks"

Level 5: "Sentry catches every JavaScript error and API exception in your
         app, groups similar errors together, and emails you when something
         new breaks. It also shows you what the user did before the error."

Level 10: "Sentry is an application monitoring platform that instruments your
          code to capture unhandled exceptions, rejected promises, and explicit
          error reports. It enriches each event with stack traces, source maps,
          user context, breadcrumbs (recent actions), and environment metadata.
          Events are deduplicated using fingerprinting algorithms, grouped into
          'issues', and can trigger alert rules based on frequency, user impact,
          or regression detection. It also provides distributed tracing for
          performance monitoring across service boundaries."
```

**Why we need it:**
- Currently, if an error happens in production, you might never know
- Users don't always report errors
- `console.error()` logs disappear when the container restarts
- Without grouping, you'd see 1000 identical errors instead of "1 error, 1000 occurrences"

**What it captures:**

| Event Type | Example | Captured Automatically? |
|------------|---------|------------------------|
| Unhandled exceptions | `throw new Error('DB failed')` | Yes |
| Unhandled promise rejections | `fetch().then()` fails | Yes |
| React component errors | Component crashes | Yes |
| API route errors | 500 response | Yes |
| Manual captures | `Sentry.captureException(e)` | You call it |

---

### 2.2 Pino - Structured Logging

**What it is (0-10 explanation):**

```
Level 0: "Better console.log"

Level 5: "Instead of console.log('User logged in'), you write
         logger.info({ userId: 123, action: 'login' }, 'User logged in')
         This outputs JSON that GCP can search and filter."

Level 10: "Pino is a low-overhead JSON logger for Node.js that outputs
          structured log entries with consistent fields (timestamp, level,
          message, context). This enables log aggregation systems like GCP
          Cloud Logging to index fields for fast queries (e.g., 'show all
          logs where userId=123 and level=error'). Pino's async I/O ensures
          logging doesn't block the event loop."
```

**Why we need it:**

| console.log | Pino |
|-------------|------|
| `User 123 logged in` | `{"level":"info","userId":123,"action":"login","msg":"User logged in","time":1712505600}` |
| Can't search by userId | Filter: `jsonPayload.userId = 123` |
| No log level | Filter: `severity = "ERROR"` |
| No timestamp | Automatic timestamps |
| Hard to correlate | Add `requestId` to trace request flow |

---

### 2.3 GCP Cloud Logging

**What it is (0-10 explanation):**

```
Level 0: "Where your logs end up"

Level 5: "Cloud Run automatically sends everything you console.log to
         Cloud Logging. We just need to format it properly so we can
         search it."

Level 10: "GCP Cloud Logging is a managed log aggregation service that
          ingests logs from Cloud Run stdout/stderr. It parses JSON-formatted
          logs into structured LogEntry objects with indexed fields. Logs
          can be queried with the Logging Query Language, exported to BigQuery
          for analysis, or used to create log-based metrics for alerting."
```

**Why we need it:**
- Already included with Cloud Run (no extra cost)
- Logs persist even when containers restart
- Can search across all container instances
- Can create alerts based on log patterns

---

### 2.4 Metrics & Dashboards

**What it is (0-10 explanation):**

```
Level 0: "Graphs showing if your app is healthy"

Level 5: "A dashboard that shows request count, error rate, and response
         time. You can see at a glance if something is wrong."

Level 10: "GCP Cloud Monitoring collects time-series metrics from Cloud Run
          (request count, latency percentiles, container CPU/memory) and
          custom application metrics. These are visualized in dashboards
          and can trigger alerting policies based on threshold conditions
          or anomaly detection."
```

---

## 3. Prerequisites

### 3.1 Before Starting

- [ ] GCP project with Cloud Run deployed
- [ ] Access to create Sentry account (just need email)
- [ ] Local development environment working

### 3.2 Dependencies to Install

```bash
# Sentry SDK for Next.js
npm install @sentry/nextjs

# Pino logger
npm install pino pino-pretty

# Types (if using TypeScript)
npm install -D @types/pino
```

---

## 4. Part 1: Sentry Setup

### 4.1 Create Sentry Account

**Step 1:** Go to [sentry.io/signup](https://sentry.io/signup)

**Step 2:** Sign up with email (no credit card required)

**Step 3:** Create a new project:
- Platform: **Next.js**
- Project name: `hta-calibration`
- Team: Create or select

**Step 4:** Copy your DSN (looks like `https://abc123@o456.ingest.sentry.io/789`)

### 4.2 Environment Variables

Add to your environment files:

```bash
# .env.local (development)
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
SENTRY_AUTH_TOKEN=your-auth-token  # For source maps (optional)

# Production (Cloud Run / Secret Manager)
NEXT_PUBLIC_SENTRY_DSN=https://your-dsn@sentry.io/project-id
```

> **Note:** `NEXT_PUBLIC_` prefix makes it available in browser code. This is safe - the DSN is meant to be public.

### 4.3 Sentry Configuration Files

**Create `sentry.client.config.ts`:**

```typescript
// sentry.client.config.ts
// This configures Sentry for the browser (client-side errors)

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  // Your Sentry DSN - identifies your project
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,

  // Environment helps you filter errors (production vs staging vs development)
  environment: process.env.NODE_ENV,

  // Only enable in production to avoid noise during development
  enabled: process.env.NODE_ENV === 'production',

  // ----- ERROR TRACKING -----

  // Sample rate for error events (1.0 = 100% of errors captured)
  sampleRate: 1.0,

  // ----- PERFORMANCE MONITORING (TRACING) -----

  // Sample rate for performance transactions (0.1 = 10% sampled)
  // Lower = less data but lower cost, higher = more visibility
  tracesSampleRate: 0.1,

  // Which URLs should include trace headers (for distributed tracing)
  // Add your API domain here when you separate services in Phase 9
  tracePropagationTargets: [
    'localhost',
    /^https:\/\/.*\.run\.app/,  // Cloud Run URLs
    // Add: 'api.yourdomain.com' in Phase 9
  ],

  // ----- FILTERING -----

  // Don't send these errors (they're usually noise)
  ignoreErrors: [
    // Browser extensions
    /^chrome-extension:\/\//,
    // Network errors that aren't our fault
    'Network request failed',
    'Load failed',
    // User cancelled
    'AbortError',
  ],

  // ----- CONTEXT -----

  // Add extra context to every event
  initialScope: {
    tags: {
      app: 'hta-calibration',
    },
  },
})
```

**Create `sentry.server.config.ts`:**

```typescript
// sentry.server.config.ts
// This configures Sentry for the server (API routes, SSR)

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',

  // Capture 100% of errors
  sampleRate: 1.0,

  // Sample 10% of transactions for performance
  tracesSampleRate: 0.1,

  // ----- SERVER-SPECIFIC OPTIONS -----

  // Capture unhandled promise rejections
  integrations: [
    Sentry.captureConsoleIntegration({
      levels: ['error'],  // Also capture console.error
    }),
  ],
})
```

**Create `sentry.edge.config.ts`:**

```typescript
// sentry.edge.config.ts
// This configures Sentry for Edge Runtime (middleware)

import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  enabled: process.env.NODE_ENV === 'production',
  tracesSampleRate: 0.1,
})
```

### 4.4 Next.js Configuration

**Update `next.config.ts`:**

```typescript
import type { NextConfig } from 'next'
import { withSentryConfig } from '@sentry/nextjs'

// Your existing config
const nextConfig: NextConfig = {
  output: 'standalone',
  // ... your existing security headers, etc.
}

// Wrap with Sentry
export default withSentryConfig(nextConfig, {
  // Sentry webpack plugin options
  org: 'your-sentry-org',
  project: 'hta-calibration',

  // Upload source maps for better stack traces (optional but recommended)
  silent: true,  // Don't log upload progress

  // Hide source maps from users (security)
  hideSourceMaps: true,
})
```

### 4.5 Usage Examples

**Automatic error capture (no code needed):**

```typescript
// This error is automatically captured
throw new Error('Something went wrong')

// This rejected promise is automatically captured
await fetch('/api/broken').then(r => { throw new Error('API failed') })
```

**Manual error capture:**

```typescript
import * as Sentry from '@sentry/nextjs'

try {
  await riskyOperation()
} catch (error) {
  // Capture with extra context
  Sentry.captureException(error, {
    tags: {
      feature: 'certificate-upload',
    },
    extra: {
      certificateId: cert.id,
      userId: user.id,
    },
  })
}
```

**Add user context (helps debugging):**

```typescript
// In your auth callback or session handler
Sentry.setUser({
  id: user.id,
  email: user.email,
  role: user.role,
})

// Clear on logout
Sentry.setUser(null)
```

**Add breadcrumbs (trail of what happened before error):**

```typescript
// Breadcrumbs are added automatically for:
// - Console logs
// - XHR/fetch requests
// - UI clicks
// - Navigation

// Manual breadcrumb:
Sentry.addBreadcrumb({
  category: 'certificate',
  message: 'User started certificate edit',
  level: 'info',
  data: {
    certificateId: '123',
  },
})
```

---

## 5. Part 2: Structured Logging with Pino

### 5.1 Logger Setup

**Create `src/lib/logger.ts`:**

```typescript
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
      service: 'hta-calibration',
      version: process.env.npm_package_version || '1.0.0',
    }),
  },

  // Use 'msg' field for message (GCP default)
  messageKey: 'message',

  // ISO timestamp
  timestamp: () => `,"timestamp":"${new Date().toISOString()}"`,

  // Pretty print in development
  transport: process.env.NODE_ENV !== 'production'
    ? { target: 'pino-pretty', options: { colorize: true } }
    : undefined,
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
```

### 5.2 Usage Examples

**Basic logging:**

```typescript
import { logger } from '@/lib/logger'

// Simple message
logger.info('Server started')

// With context
logger.info({ port: 3000, env: 'production' }, 'Server started')

// Error logging (include the error object as 'err')
try {
  await something()
} catch (error) {
  logger.error({ err: error, userId: '123' }, 'Operation failed')
}
```

**Module-specific logging:**

```typescript
import { authLogger, certificateLogger } from '@/lib/logger'

// Auth module
authLogger.info({ userId: user.id, method: 'credentials' }, 'User logged in')
authLogger.warn({ email, attempts: 4 }, 'Multiple failed login attempts')

// Certificate module
certificateLogger.info({ certificateId, status: 'SUBMITTED' }, 'Certificate submitted for review')
certificateLogger.error({ err, certificateId }, 'Failed to generate PDF')
```

**Request-scoped logging:**

```typescript
import { createRequestLogger } from '@/lib/logger'
import { randomUUID } from 'crypto'

export async function POST(request: NextRequest) {
  // Create logger with request ID for correlation
  const requestId = request.headers.get('x-request-id') || randomUUID()
  const log = createRequestLogger(requestId, session?.user?.id)

  log.info({ path: '/api/certificates' }, 'Request started')

  try {
    // ... handle request
    log.info({ certificateId: result.id }, 'Certificate created')
    return NextResponse.json(result)
  } catch (error) {
    log.error({ err: error }, 'Request failed')
    throw error
  }
}
```

### 5.3 What the Output Looks Like

**Development (pretty printed):**

```
[2026-04-08 10:30:00] INFO (auth): User logged in
    userId: "user_123"
    method: "credentials"
    requestId: "req_abc"
```

**Production (JSON for GCP):**

```json
{
  "severity": "INFO",
  "level": "info",
  "timestamp": "2026-04-08T10:30:00.000Z",
  "service": "hta-calibration",
  "module": "auth",
  "message": "User logged in",
  "userId": "user_123",
  "method": "credentials",
  "requestId": "req_abc"
}
```

**In GCP Cloud Logging, you can then query:**

```
jsonPayload.userId = "user_123"
jsonPayload.module = "auth"
severity = "ERROR"
```

### 5.4 Implementation Status ✅

**Completed:** April 9, 2026

All API routes have been updated to use structured Pino logging. The `console.log` and `console.error` calls have been replaced with structured logger calls.

#### Logger Modules Used

| Module | Logger | Description |
|--------|--------|-------------|
| `auth` | `authLogger` or `createLogger('auth')` | Authentication routes |
| `certificate` | `certificateLogger` | Certificate CRUD and workflow |
| `customer` | `createLogger('customer')` | Customer portal routes |
| `customers` | `createLogger('customers')` | Admin customer management |
| `instruments` | `createLogger('instruments')` | Master instrument routes |
| `chat` | `createLogger('chat')` | Real-time chat routes |
| `notifications` | `createLogger('notifications')` | Notification system |
| `queue` | `createLogger('queue')` | Background job processing |
| `opensign` | `createLogger('opensign')` | Digital signature integration |
| `users` | `createLogger('users')` | User management |
| `requests` | `createLogger('requests')` | Internal request handling |
| `registrations` | `createLogger('registrations')` | Customer registration |
| `analytics` | `createLogger('analytics')` | Analytics endpoints |
| `storage` | `createLogger('storage')` | File storage operations |
| `health` | `createLogger('health')` | Health check endpoints |

#### API Routes Updated

**Critical Routes (High Priority):**
- `/api/auth/*` - All authentication endpoints
- `/api/certificates/*` - Certificate CRUD, review, images, PDF generation
- `/api/customer/*` - Customer portal (dashboard, team, instruments, review)
- `/api/admin/customers/*` - Customer account management
- `/api/admin/instruments/*` - Master instrument management

**Supporting Routes:**
- `/api/admin/users/*` - Staff user management
- `/api/admin/authorization/*` - Certificate authorization workflow
- `/api/admin/analytics/*` - Dashboard analytics
- `/api/admin/registrations/*` - Customer registration approval
- `/api/admin/requests/*` - Internal request handling
- `/api/chat/*` - Real-time messaging
- `/api/notifications/*` - Notification delivery
- `/api/queue/*` - Background job processing
- `/api/opensign/*` - Digital signature webhooks
- `/api/storage/*` - File upload/download
- `/api/health/*` - Health checks

#### Logging Pattern

All error handling follows this pattern:

```typescript
import { createLogger } from '@/lib/logger'

const logger = createLogger('module-name')

export async function GET(request: NextRequest) {
  try {
    // ... route logic
    logger.info({ data }, 'Operation succeeded')
    return NextResponse.json(result)
  } catch (error) {
    logger.error({ err: error }, 'Operation failed')
    return NextResponse.json({ error: 'Failed' }, { status: 500 })
  }
}
```

---

## 6. Part 3: GCP Cloud Logging Integration

### 6.1 How It Works

Cloud Run **automatically** sends all stdout/stderr to Cloud Logging. No setup needed!

```
Your App                    Cloud Run                  Cloud Logging
────────                    ─────────                  ─────────────
console.log()      ───►     Captures stdout   ───►     Stores & indexes
logger.info()      ───►     Parses JSON       ───►     Searchable fields
console.error()    ───►     Captures stderr   ───►     severity: ERROR
```

### 6.2 Viewing Logs

**GCP Console:**
1. Go to [Cloud Logging](https://console.cloud.google.com/logs)
2. Select your project
3. Resource: Cloud Run Revision
4. Use queries like:
   ```
   resource.type="cloud_run_revision"
   resource.labels.service_name="hta-calibration"
   severity>=ERROR
   ```

**Query examples:**

```
# All errors in the last hour
severity >= ERROR
timestamp >= "2026-04-08T09:00:00Z"

# Logs for a specific user
jsonPayload.userId = "user_123"

# Logs for a specific request
jsonPayload.requestId = "req_abc"

# Auth module errors
jsonPayload.module = "auth"
severity = "ERROR"

# Certificate processing logs
jsonPayload.module = "certificate"
jsonPayload.certificateId = "cert_456"
```

### 6.3 Log-Based Metrics (Optional)

You can create metrics from log patterns:

**GCP Console → Logging → Log-based Metrics → Create Metric**

Example: Count of failed logins
```
Filter: jsonPayload.module = "auth" AND jsonPayload.message =~ "failed"
Metric type: Counter
```

---

## 7. Part 4: Metrics & Dashboards

### 7.1 Built-in Cloud Run Metrics

Cloud Run automatically provides these metrics (no setup needed):

| Metric | Description |
|--------|-------------|
| `request_count` | Total requests |
| `request_latencies` | Response time distribution |
| `container/cpu/utilization` | CPU usage |
| `container/memory/utilization` | Memory usage |
| `container/instance_count` | Number of running containers |
| `container/billable_instance_time` | Cost-related |

### 7.2 Creating a Dashboard

**Step 1:** Go to GCP Console → Monitoring → Dashboards → Create Dashboard

**Step 2:** Add these charts:

**Chart 1: Request Rate**
- Metric: `run.googleapis.com/request_count`
- Aggregation: Sum, grouped by response_code_class
- Shows: Requests per second, split by 2xx/4xx/5xx

**Chart 2: Latency (p50, p95, p99)**
- Metric: `run.googleapis.com/request_latencies`
- Aggregation: 50th, 95th, 99th percentile
- Shows: Response time distribution

**Chart 3: Error Rate**
- Metric: `run.googleapis.com/request_count`
- Filter: response_code_class = "5xx"
- Aggregation: Sum
- Shows: Server errors over time

**Chart 4: Container Instances**
- Metric: `run.googleapis.com/container/instance_count`
- Shows: Auto-scaling activity

### 7.3 Custom Application Metrics (Optional)

If you need custom business metrics:

```typescript
// src/lib/metrics.ts
// Simple custom metrics using Cloud Monitoring API

import { MetricServiceClient } from '@google-cloud/monitoring'

const client = new MetricServiceClient()
const projectId = process.env.GCP_PROJECT_ID

export async function recordMetric(
  metricType: string,
  value: number,
  labels: Record<string, string> = {}
) {
  if (process.env.NODE_ENV !== 'production') {
    console.log(`[Metric] ${metricType}: ${value}`, labels)
    return
  }

  const dataPoint = {
    interval: { endTime: { seconds: Date.now() / 1000 } },
    value: { doubleValue: value },
  }

  const timeSeriesData = {
    metric: {
      type: `custom.googleapis.com/hta/${metricType}`,
      labels,
    },
    resource: {
      type: 'global',
      labels: { project_id: projectId },
    },
    points: [dataPoint],
  }

  await client.createTimeSeries({
    name: `projects/${projectId}`,
    timeSeries: [timeSeriesData],
  })
}

// Usage
await recordMetric('certificate/processing_time', 1500, { status: 'success' })
await recordMetric('certificate/created', 1, { type: 'calibration' })
```

---

## 8. Part 5: Alerting Configuration

### 8.1 Sentry Alerts (Errors)

**In Sentry Dashboard:**

1. Go to **Alerts** → **Create Alert**

2. **Alert 1: New Error Type**
   - When: A new issue is created
   - Action: Email to your address
   - Why: Know immediately when something new breaks

3. **Alert 2: Error Spike**
   - When: Number of events > 10 in 1 hour
   - Action: Email
   - Why: Catch when an error suddenly affects many users

4. **Alert 3: High Error Rate**
   - When: Error rate > 5%
   - Action: Email
   - Why: Overall health indicator

### 8.2 GCP Alerts (Infrastructure)

**In GCP Console → Monitoring → Alerting → Create Policy:**

**Alert 1: High Error Rate**
```
Condition:
  Metric: run.googleapis.com/request_count
  Filter: response_code_class = "5xx"
  Aggregation: Sum over 5 minutes
  Threshold: > 10

Notification: Email
```

**Alert 2: High Latency**
```
Condition:
  Metric: run.googleapis.com/request_latencies
  Aggregation: 95th percentile
  Threshold: > 2000ms for 5 minutes

Notification: Email
```

**Alert 3: High CPU**
```
Condition:
  Metric: run.googleapis.com/container/cpu/utilization
  Threshold: > 80% for 10 minutes

Notification: Email
```

### 8.3 Email Notification Channel Setup

1. GCP Console → Monitoring → Alerting → Notification Channels
2. Add Email Channel
3. Enter your email address
4. Verify email
5. Use this channel in your alert policies

---

## 8.4 Implementation Status - Parts 3, 4, 5 ✅

**Completed:** April 9, 2026

All monitoring infrastructure has been implemented via Terraform in `terraform/modules/monitoring/`.

### Terraform Module Created

| File | Description |
|------|-------------|
| `terraform/modules/monitoring/main.tf` | Dashboard and alert policies |
| `terraform/modules/monitoring/variables.tf` | Configuration variables |
| `terraform/modules/monitoring/outputs.tf` | Output values |

### Dashboard Charts Included

| Chart | Metric | Description |
|-------|--------|-------------|
| Request Rate | `run.googleapis.com/request_count` | Requests/sec by response code (2xx/4xx/5xx) |
| Error Rate | `run.googleapis.com/request_count` (5xx) | Server errors over time |
| Response Latency | `run.googleapis.com/request_latencies` | p50, p95, p99 percentiles |
| Container Instances | `run.googleapis.com/container/instance_count` | Auto-scaling activity |
| CPU Utilization | `run.googleapis.com/container/cpu/utilizations` | CPU usage percentage |
| Memory Utilization | `run.googleapis.com/container/memory/utilizations` | Memory usage percentage |

### Alert Policies Created

| Alert | Condition | Threshold |
|-------|-----------|-----------|
| High Error Rate | 5xx errors in 5 min | > 10 (prod), > 50 (dev) |
| High Latency | p95 latency sustained 5 min | > 2000ms (prod), > 5000ms (dev) |
| High CPU | CPU p95 sustained 10 min | > 80% (prod), > 90% (dev) |
| Backup Failure | Cloud SQL backup missing | > 25 hours (prod only) |

### Deployment

```bash
# Production
cd terraform/environments/prod
terraform init
terraform plan -var="alert_email=your-email@company.com"
terraform apply -var="alert_email=your-email@company.com"

# Development (optional, disabled by default)
cd terraform/environments/dev
terraform init
terraform plan -var="enable_monitoring=true" -var="alert_email=dev@company.com"
terraform apply -var="enable_monitoring=true" -var="alert_email=dev@company.com"
```

### Sentry Alerts

Sentry alerts are configured manually in the Sentry dashboard:
1. Go to **sentry.io** → Your Project → **Alerts**
2. Create alerts for: New issues, Error spikes, High error rate

---

## 9. Future-Proofing for Phase 9

### 9.1 What Changes When Services Separate

When you split into Frontend, API, and Worker services in Phase 9:

| Component | Current (Monolith) | Phase 9 (Separated) |
|-----------|-------------------|---------------------|
| Sentry | One project | One project, 3 services tagged |
| Logging | One log stream | 3 log streams, correlated by requestId |
| Tracing | Optional | Essential for debugging |
| Metrics | One service | Per-service + aggregate |

### 9.2 What We're Doing Now to Prepare

**1. Request ID Propagation (Already in logger setup)**

```typescript
// Request ID travels with the request
const requestId = request.headers.get('x-request-id') || randomUUID()

// Set on outgoing requests
const response = await fetch('https://api.example.com', {
  headers: {
    'x-request-id': requestId,  // Passed to API service
  },
})
```

**2. Service Tag in Logs**

```typescript
// Each service identifies itself
const logger = pino({
  formatters: {
    bindings: () => ({
      service: process.env.SERVICE_NAME || 'hta-calibration',
    }),
  },
})
```

**3. Trace Propagation Targets in Sentry**

```typescript
// sentry.client.config.ts
tracePropagationTargets: [
  'localhost',
  /^https:\/\/.*\.run\.app/,
  // Add in Phase 9:
  // 'api.yourdomain.com',
  // 'worker.yourdomain.com',
],
```

### 9.3 Changes Needed in Phase 9

When you separate services, you'll need to:

1. **Install Sentry SDK on each service**
   - Same DSN, different `service` tag

2. **Enable distributed tracing**
   ```typescript
   // API service
   Sentry.init({
     dsn: SAME_DSN,
     environment: 'production',
     tracesSampleRate: 0.1,
     // Traces will automatically link across services
   })
   ```

3. **Add service names to logger**
   ```bash
   # Frontend service
   SERVICE_NAME=hta-frontend

   # API service
   SERVICE_NAME=hta-api

   # Worker service
   SERVICE_NAME=hta-worker
   ```

4. **Update GCP dashboard**
   - Add per-service charts
   - Add aggregate view

That's it! The foundation we're building now makes Phase 9 a configuration change, not a rewrite.

---

## 10. Verification & Testing

### 10.1 Test Sentry Integration

**Development test:**

```typescript
// Add temporarily to test
// pages/api/test-sentry.ts
export async function GET() {
  throw new Error('Sentry test error - delete me!')
}
```

Visit `/api/test-sentry` → Check Sentry dashboard for the error

**Production test:**

After deploying, the same test should appear in Sentry with:
- Production environment tag
- Cloud Run context
- Source maps (readable stack trace)

### 10.2 Test Logging

**Check logs appear in GCP:**

1. Add a test log: `logger.info({ test: true }, 'Test log entry')`
2. Deploy to Cloud Run
3. View in Cloud Logging:
   ```
   jsonPayload.test = true
   ```

### 10.3 Test Alerts

**Trigger a test alert:**

1. Temporarily lower threshold (e.g., > 1 error in 1 minute)
2. Trigger an error
3. Verify email received
4. Reset threshold to production value

### 10.4 Verification Checklist

- [x] Sentry account created and DSN configured
- [x] Test error appears in Sentry dashboard
- [x] Structured logging implemented in all API routes
- [ ] Logs appear in GCP Cloud Logging with correct structure *(verify after deployment)*
- [ ] Can query logs by userId, requestId, module *(verify after deployment)*
- [x] Dashboard Terraform module created
- [ ] Dashboard shows Cloud Run metrics *(verify after terraform apply)*
- [x] Alert policies Terraform module created
- [ ] Test alert email received *(verify after terraform apply)*

---

## 11. Glossary

| Term | Definition |
|------|------------|
| **DSN** | Data Source Name - Sentry's project identifier URL |
| **Breadcrumb** | Record of an action that happened before an error |
| **Trace** | Record of a request's path through your system |
| **Span** | Single operation within a trace |
| **Sample Rate** | Percentage of events to capture (0.1 = 10%) |
| **Severity** | Log level (DEBUG, INFO, WARNING, ERROR, CRITICAL) |
| **Fingerprint** | How Sentry groups similar errors together |
| **Issue** | Group of similar error events in Sentry |
| **Log-based Metric** | Metric derived from counting/measuring log entries |
| **Alerting Policy** | Rule that triggers notification when condition is met |

---

## Implementation Checklist

### Part 1: Sentry
- [x] Create Sentry account *(completed 2026-04-08)*
- [x] Create project (Next.js) *(completed 2026-04-08)*
- [x] Copy DSN to environment variables *(completed 2026-04-08)*
- [x] Install `@sentry/nextjs` *(completed 2026-04-08)*
- [x] Create `sentry.client.config.ts` *(completed 2026-04-08)*
- [x] Create `sentry.server.config.ts` *(completed 2026-04-08)*
- [x] Create `sentry.edge.config.ts` *(completed 2026-04-08)*
- [x] Create `src/instrumentation.ts` *(completed 2026-04-08)*
- [x] Update `next.config.ts` with Sentry wrapper *(completed 2026-04-08)*
- [x] Test error capture *(completed 2026-04-08 - verified in Sentry dashboard)*
- [ ] Configure email alerts

### Part 2: Logging
- [x] Install `pino` and `pino-pretty` *(completed 2026-04-08)*
- [x] Create `src/lib/logger.ts` *(completed 2026-04-08)*
- [x] Create `src/lib/api-logger.ts` - API route logging wrapper *(completed 2026-04-08)*
- [x] Add logging to critical APIs *(completed 2026-04-08)*:
  - [x] **Auth routes:**
    - [x] `/api/auth/change-password`
    - [x] `/api/auth/forgot-password`
    - [x] `/api/auth/reset-password`
    - [x] `/api/auth/activate`
    - [x] `/api/auth/refresh`
    - [x] `/api/auth/issue-refresh-token`
  - [x] **Certificate routes:**
    - [x] `/api/certificates` (create, list)
    - [x] `/api/certificates/[id]` (get, update)
    - [x] `/api/certificates/check-number`
    - [x] `/api/certificates/[id]/assign-revision`
    - [x] `/api/certificates/[id]/change-reviewer`
    - [x] `/api/certificates/[id]/download-signed`
    - [x] `/api/certificates/[id]/submit`
    - [x] `/api/certificates/[id]/review`
    - [x] `/api/certificates/[id]/send-to-customer`
    - [x] `/api/certificates/[id]/reply-to-customer`
    - [x] `/api/admin/certificates` (admin list)
    - [x] `/api/admin/certificates/[id]` (admin detail)
    - [x] `/api/admin/authorization/[id]/authorize`
  - [x] **Customer routes:**
    - [x] `/api/admin/customers` (list, create)
    - [x] `/api/admin/customers/[id]` (get, update)
    - [x] `/api/admin/customers/requests` (list)
    - [x] `/api/admin/customers/requests/[id]` (get)
    - [x] `/api/admin/customers/requests/[id]/approve`
    - [x] `/api/admin/customers/requests/[id]/reject`
    - [x] `/api/customer/change-password`
    - [x] `/api/customer/forgot-password`
    - [x] `/api/customer/reset-password`
    - [x] `/api/customer/register`
    - [x] `/api/customer/review/[token]/approve`
    - [x] `/api/customer/review/[token]/reject`
    - [x] `/api/customer/review/[token]/certificate`
    - [x] `/api/customer/instruments`
  - [x] **Instrument routes:**
    - [x] `/api/instruments` (list)
    - [x] `/api/admin/instruments` (admin list, create)
    - [x] `/api/admin/instruments/[id]` (get, update, delete)
    - [x] `/api/admin/instruments/import`
    - [x] `/api/admin/instruments/export`
    - [x] `/api/admin/instruments/[id]/certificates`
- [ ] Test logs appear in Cloud Logging (after deployment)

### Part 3: Dashboard
- [x] Create GCP Monitoring dashboard *(Terraform module: 2026-04-09)*
- [x] Add request rate chart *(included in dashboard)*
- [x] Add latency chart *(p50/p95/p99 included)*
- [x] Add error rate chart *(5xx errors included)*
- [x] Add container instances chart *(included)*
- [x] Add CPU utilization chart *(bonus)*
- [x] Add memory utilization chart *(bonus)*

### Part 4: Alerts
- [ ] Set up Sentry email alerts *(manual in Sentry dashboard)*
- [x] Set up GCP error rate alert *(Terraform: 2026-04-09)*
- [x] Set up GCP latency alert *(Terraform: 2026-04-09)*
- [x] Set up GCP CPU alert *(Terraform: bonus)*
- [ ] Test alert delivery *(after terraform apply)*

---

## Files to Create/Modify

| File | Action | Status | Description |
|------|--------|--------|-------------|
| `sentry.client.config.ts` | CREATE | ✅ Done | Browser Sentry config |
| `sentry.server.config.ts` | CREATE | ✅ Done | Server Sentry config |
| `sentry.edge.config.ts` | CREATE | ✅ Done | Edge runtime Sentry config |
| `src/instrumentation.ts` | CREATE | ✅ Done | Next.js instrumentation hook |
| `next.config.ts` | MODIFY | ✅ Done | Add Sentry wrapper |
| `src/lib/logger.ts` | CREATE | ✅ Done | Pino logger setup |
| `src/lib/api-logger.ts` | CREATE | ✅ Done | API route logging wrapper |
| `src/app/api/certificates/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/admin/certificates/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/auth/change-password/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/auth/forgot-password/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/auth/reset-password/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/auth/activate/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/auth/refresh/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/auth/issue-refresh-token/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/certificates/[id]/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/certificates/check-number/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/certificates/[id]/assign-revision/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/certificates/[id]/change-reviewer/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/certificates/[id]/download-signed/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/certificates/[id]/submit/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/certificates/[id]/review/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/certificates/[id]/send-to-customer/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/certificates/[id]/reply-to-customer/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/admin/certificates/[id]/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/admin/authorization/[id]/authorize/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/admin/customers/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/admin/customers/[id]/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/admin/customers/requests/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/admin/customers/requests/[id]/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/admin/customers/requests/[id]/approve/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/admin/customers/requests/[id]/reject/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/customer/change-password/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/customer/forgot-password/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/customer/reset-password/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/customer/register/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/customer/review/[token]/approve/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/customer/review/[token]/reject/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/customer/review/[token]/certificate/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/customer/instruments/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/instruments/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/admin/instruments/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/admin/instruments/[id]/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/admin/instruments/import/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/admin/instruments/export/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `src/app/api/admin/instruments/[id]/certificates/route.ts` | MODIFY | ✅ Done | Added structured logging |
| `.env` | MODIFY | ✅ Done | Add Sentry DSN |
| `.env.production` | MODIFY | ⏳ Pending | Add Sentry DSN for Cloud Run |
| `terraform/modules/monitoring/main.tf` | CREATE | ✅ Done | Dashboard & alert policies |
| `terraform/modules/monitoring/variables.tf` | CREATE | ✅ Done | Module configuration |
| `terraform/modules/monitoring/outputs.tf` | CREATE | ✅ Done | Dashboard URL, alert IDs |
| `terraform/environments/prod/main.tf` | MODIFY | ✅ Done | Added monitoring module |
| `terraform/environments/prod/variables.tf` | MODIFY | ✅ Done | Added alert_email variable |
| `terraform/environments/dev/main.tf` | MODIFY | ✅ Done | Added monitoring module (optional) |
| `terraform/environments/dev/variables.tf` | MODIFY | ✅ Done | Added monitoring variables |

---

**Document End**
