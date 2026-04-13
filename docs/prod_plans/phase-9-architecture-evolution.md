# Phase 9: Architecture Evolution - Implementation Plan

**Document Version:** 1.0
**Created:** 2026-04-13
**Last Updated:** 2026-04-13
**Status:** In Progress (Track A, B-Accelerate Implemented)
**Estimated Effort:** 4-6 weeks (can be implemented incrementally)

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Implementation Tracks](#3-implementation-tracks)
4. [Track A: CDN & Static Assets](#4-track-a-cdn--static-assets)
5. [Track B: API Separation](#5-track-b-api-separation)
6. [Track C: Security Enhancements](#6-track-c-security-enhancements)
7. [Track D: Monitoring & Alerting](#7-track-d-monitoring--alerting)
8. [Track E: Disaster Recovery](#8-track-e-disaster-recovery)
9. [Dependencies & Sequencing](#9-dependencies--sequencing)
10. [Risk Assessment](#10-risk-assessment)

---

## 1. Executive Summary

Phase 9 focuses on evolving the architecture from a monolithic Next.js application to a more scalable, resilient system. This phase consolidates deferred items from Phases 4, 5, and 8.

### What This Phase Accomplishes

| Capability | Before | After |
|------------|--------|-------|
| Static asset delivery | Direct from Cloud Run | CDN with edge caching |
| API architecture | Monolithic | Separated (Frontend/API/Worker) |
| Admin security | Password only | 2FA with TOTP/WebAuthn |
| CSP policy | `unsafe-inline`/`unsafe-eval` | Nonce-based strict CSP |
| DDoS protection | App-level rate limiting | Cloud Armor WAF |
| Alerting | Email only | PagerDuty/Slack integration |
| Tracing | Logs only | Distributed tracing (OpenTelemetry) |
| DR testing | Untested | Monthly DR drills |

### Priority Matrix

| Track | Business Impact | Effort | Recommended Priority |
|-------|-----------------|--------|---------------------|
| A: CDN & Static Assets | Medium (performance) | Low | P1 - Quick win |
| B: API Separation | High (scalability) | High | P2 - Strategic |
| C: Security Enhancements | High (compliance) | Medium | P1 - Important |
| D: Monitoring & Alerting | Medium (operations) | Medium | P2 - Operational |
| E: Disaster Recovery | High (resilience) | Medium | P1 - Critical |

### Implementation Checklist

**Track A: CDN & Static Assets** ✅ IMPLEMENTED
- [x] Configure Cloud CDN for static assets (Terraform module created)
- [x] Set up cache headers for Next.js static files
- [x] Configure asset versioning/cache busting (Next.js handles via content hashing)
- [x] Implement image optimization with next/image + CDN

**Track B: API Separation** (Quick Win Done, Full Separation Deferred)
- [x] Implement Prisma Accelerate for connection pooling ✅
- [ ] Full API separation - See `docs/prod_plans/phase-9b-api-separation.md`
  - [ ] Monorepo setup (Turborepo)
  - [ ] Shared packages extraction
  - [ ] API service creation
  - [ ] Worker service creation
  - [ ] Load balancer routing

**Track C: Security Enhancements**
- [ ] Implement 2FA for admin accounts (TOTP)
- [ ] Add WebAuthn as 2FA option
- [ ] Implement CSP with nonces
- [ ] Configure Cloud Armor WAF rules
- [ ] Set up CORS for separated services

**Track D: Monitoring & Alerting**
- [ ] Implement OpenTelemetry distributed tracing
- [ ] Configure APM with transaction traces
- [ ] Add custom business metrics
- [ ] Set up PagerDuty integration
- [ ] Create SLO/SLA dashboards
- [ ] Configure error budget alerts

**Track E: Disaster Recovery**
- [ ] Document and test backup restore procedure
- [ ] Verify data integrity after restore
- [ ] Establish monthly DR drill schedule
- [ ] Configure cross-region Cloud SQL replica
- [ ] Set up GCS multi-region buckets
- [ ] Document RTO/RPO validation results

---

## 2. Current State Analysis

### Architecture Overview

```
Current: Monolithic Next.js on Cloud Run
┌─────────────────────────────────────────────┐
│              Cloud Run                       │
│  ┌─────────────────────────────────────┐    │
│  │         Next.js Application          │    │
│  │  ┌─────────┐ ┌─────────┐ ┌────────┐ │    │
│  │  │ Pages   │ │   API   │ │ Worker │ │    │
│  │  │ (SSR)   │ │ Routes  │ │ (Jobs) │ │    │
│  │  └─────────┘ └─────────┘ └────────┘ │    │
│  └─────────────────────────────────────┘    │
└─────────────────────────────────────────────┘
                      │
              ┌───────▼───────┐
              │   Cloud SQL   │
              │  PostgreSQL   │
              └───────────────┘
```

### What's Already Implemented

| Component | Status | Location |
|-----------|--------|----------|
| Rate limiting | ✅ | `src/lib/security/rate-limiter.ts` |
| Account lockout | ✅ | `src/lib/auth.ts` |
| CORS configuration | ✅ Ready | `src/lib/security/cors.ts` |
| Security headers | ✅ | `next.config.ts` |
| Structured logging | ✅ | `src/lib/logger.ts` |
| Error tracking | ✅ | Sentry |
| Cache infrastructure | ✅ | Redis/Memory |
| Email queue | ✅ | `src/lib/services/queue.ts` |

### What's Missing

| Gap | Impact | Phase 9 Track |
|-----|--------|---------------|
| CDN for static assets | Performance, cost | Track A |
| API separation | Scalability | Track B |
| 2FA for admins | Security compliance | Track C |
| Strict CSP | XSS protection | Track C |
| Cloud Armor WAF | DDoS protection | Track C |
| Distributed tracing | Debugging | Track D |
| PagerDuty integration | Incident response | Track D |
| DR testing | Business continuity | Track E |

---

## 3. Implementation Tracks

Phase 9 is divided into independent tracks that can be implemented in parallel or sequentially based on priorities.

### Track Dependencies

```
Track A (CDN)          Track C (Security)     Track E (DR)
    │                       │                      │
    │                       │                      │
    ▼                       ▼                      ▼
Track B (API Separation) ◄──┘                      │
    │                                              │
    ▼                                              │
Track D (Monitoring) ◄─────────────────────────────┘
```

### Recommended Sequence

```
Week 1-2: Track A (CDN) + Track E (DR Testing)
   │       Quick wins, independent of each other
   │
Week 3-4: Track C (Security)
   │       2FA, Cloud Armor - security improvements
   │
Week 5-8: Track B (API Separation)
   │       Larger effort, requires planning
   │
Week 9-10: Track D (Monitoring)
           Distributed tracing, PagerDuty
```

---

## 4. Track A: CDN & Static Assets

**Status:** ✅ IMPLEMENTED
**Effort:** 1-2 days
**Risk:** Low
**Dependencies:** None

### 4.1 Implementation Summary

| Component | File | Status |
|-----------|------|--------|
| CDN Terraform module | `terraform/modules/cdn/` | ✅ Created |
| Cache headers | `next.config.ts` | ✅ Configured |
| Image optimization | `next.config.ts` | ✅ Configured |
| Static bucket | `terraform/modules/storage/` | ✅ Exists |

### 4.2 Cloud CDN Setup (Implemented)

**Files created:**
- `terraform/modules/cdn/main.tf` - CDN backend bucket with caching policy
- `terraform/modules/cdn/variables.tf` - Input variables
- `terraform/modules/cdn/outputs.tf` - CDN URL outputs

**Key features:**
- Global IP address reservation
- Backend bucket with CDN enabled
- Cache policy: `CACHE_ALL_STATIC` with 1-hour default TTL
- Negative caching for 404s (60 seconds)
- Serve stale while revalidating (24 hours)
- Request coalescing to reduce origin load
- Optional HTTPS with managed SSL certificate

```hcl
# terraform/modules/cdn/main.tf (excerpt)

resource "google_compute_backend_bucket" "static_cdn" {
  name        = "hta-static-cdn-${var.environment}"
  bucket_name = var.static_bucket_name
  enable_cdn  = true

  cdn_policy {
    cache_mode        = "CACHE_ALL_STATIC"
    default_ttl       = 3600      # 1 hour
    max_ttl           = 86400     # 24 hours
    client_ttl        = 3600
    negative_caching  = true
    serve_while_stale = 86400     # 1 day
    request_coalescing = true
    
    cache_key_policy {
      include_host         = true
      include_protocol     = true
      include_query_string = false
    }
  }
}
```

### 4.3 Next.js Configuration (Implemented)

**File:** `next.config.ts`

Cache headers configured for:
- `/_next/static/*` - Immutable, 1 year (content-hashed files)
- `/images/*` - 1 day with 7-day stale-while-revalidate
- `/fonts/*` - Immutable, 1 year
- `favicon.ico`, `robots.txt` - 1 day

```typescript
// next.config.ts (implemented)

const nextConfig: NextConfig = {
  // CDN asset prefix (set CDN_URL env var in production)
  assetPrefix: process.env.CDN_URL || undefined,

  async headers() {
    return [
      // Security headers applied to all routes
      { source: '/:path*', headers: securityHeaders },
      // Cache Next.js static assets (immutable - hash in filename)
      {
        source: '/_next/static/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
      // Cache images
      {
        source: '/images/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }],
      },
      // Cache fonts
      {
        source: '/fonts/:path*',
        headers: [{ key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }],
      },
    ];
  },

  images: {
    remotePatterns: [
      { protocol: 'https', hostname: 'storage.googleapis.com', pathname: '/**' },
      { protocol: 'https', hostname: '*.storage.googleapis.com', pathname: '/**' },
    ],
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200, 1920],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384],
  },
};
```

### 4.4 Deployment Steps

1. **Deploy Terraform CDN module:**
   ```bash
   cd terraform/environments/prod
   terraform plan -target=module.cdn
   terraform apply -target=module.cdn
   ```

2. **Get CDN URL from Terraform output:**
   ```bash
   terraform output cdn_url
   # Example: https://cdn.htacalibr8s.com or http://34.120.x.x
   ```

3. **Set CDN_URL environment variable in Cloud Run:**
   ```bash
   gcloud run services update hta-calibration \
     --set-env-vars CDN_URL=https://cdn.htacalibr8s.com
   ```

4. **Upload static assets to GCS bucket** (if using separate static hosting):
   ```bash
   # Next.js build already includes static assets in .next/static
   # These are served from Cloud Run by default
   # CDN caches them at the edge after first request
   ```

### 4.5 Verification

```bash
# Check CDN cache status
curl -I https://cdn.htacalibr8s.com/_next/static/chunks/main.js

# Expected headers:
# Cache-Control: public, max-age=31536000, immutable
# Age: <seconds since cached>
# X-Cache: HIT
```

---

## 5. Track B: API Separation

**Status:** ✅ Quick Win Done (Prisma Accelerate) | ⏳ Full Separation Deferred
**Quick Win Effort:** 1 day ✅
**Full Separation Effort:** 3-4 weeks
**Risk:** Low (Accelerate) ✅ | High (Full Separation)

> **Full API Separation Plan:** See [`docs/prod_plans/phase-9b-api-separation.md`](./phase-9b-api-separation.md) for the complete implementation guide including monorepo setup, service extraction, and deployment strategy.

### 5.1 Decision: When to Proceed with Full Separation

| Trigger | Current | Threshold | Action |
|---------|---------|-----------|--------|
| API latency p95 | ~150ms | > 300ms | Consider separation |
| Cloud Run CPU | ~40% | > 70% | Consider separation |
| Monthly requests | ~100K | > 1M | Plan separation |
| Team size | 1-2 | > 4 | Consider separation |
| Independent scaling needs | No | Yes | Separate |

**Current Recommendation:** Defer full separation. Prisma Accelerate provides connection pooling benefits without architectural complexity.

### 5.2 Quick Win: Prisma Accelerate ✅ IMPLEMENTED

**Files modified:**
- `prisma/schema.prisma` - Added directUrl support
- `src/lib/prisma.ts` - Auto-detect Accelerate vs direct connection
- `docs/guides/prisma-accelerate-setup.md` - Setup guide

**Implementation summary:**
- Prisma client auto-detects connection type (Accelerate vs direct)
- Direct connection uses `@prisma/adapter-pg` with connection pooling
- Accelerate mode activates when `DATABASE_URL` starts with `prisma://`
- Connection pool configured: max 10, idle timeout 30s

**To enable Prisma Accelerate:**
1. Create account at [cloud.prisma.io](https://cloud.prisma.io)
2. Enable Accelerate for your project
3. Set environment variables:
   ```bash
   DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY"
   DIRECT_URL="postgresql://user:pass@host:5432/db"
   ```

See `docs/guides/prisma-accelerate-setup.md` for full setup guide.

### 5.3 Full Separation (When Ready)

When thresholds are met, follow the detailed plan in `phase-9b-api-separation.md`:

1. **Phase 1:** Monorepo setup with Turborepo
2. **Phase 2:** Extract shared packages (@hta/database, @hta/shared)
3. **Phase 3:** Create standalone API service
4. **Phase 4:** Create worker service for background jobs
5. **Phase 5:** Configure load balancer routing
6. **Phase 6:** Gradual traffic cutover (10% → 50% → 100%)

### 5.3 Full Separation Architecture (When Needed)

```
Target: Separated Services
┌─────────────────────────────────────────────────────────────┐
│                    Cloud Load Balancer                       │
│                    + Cloud Armor WAF                         │
└─────────────────────────┬───────────────────────────────────┘
                          │
         ┌────────────────┼────────────────┐
         │                │                │
         ▼                ▼                ▼
┌─────────────┐   ┌─────────────┐   ┌─────────────┐
│  Frontend   │   │  API Server │   │   Worker    │
│  Cloud Run  │   │  Cloud Run  │   │  Cloud Run  │
│             │   │             │   │             │
│  Next.js    │   │  Next.js    │   │  Job Proc   │
│  Pages/SSR  │   │  API Only   │   │  Email/Notif│
│  + CDN      │   │  + Cache    │   │  + Scheduler│
└─────────────┘   └─────────────┘   └─────────────┘
         │                │                │
         │         CORS enabled            │
         └────────────────┼────────────────┘
                          │
                 ┌────────▼────────┐
                 │   Cloud SQL     │
                 │   + Prisma      │
                 │   Accelerate    │
                 └─────────────────┘
```

### 5.4 Monorepo Structure

```
hta-calibration/
├── apps/
│   ├── web/                 # Next.js frontend
│   │   ├── src/
│   │   │   ├── app/        # Pages only
│   │   │   └── components/
│   │   └── package.json
│   │
│   ├── api/                 # API server
│   │   ├── src/
│   │   │   ├── routes/     # API routes
│   │   │   └── middleware/
│   │   └── package.json
│   │
│   └── worker/              # Background jobs
│       ├── src/
│       │   ├── jobs/
│       │   └── scheduler/
│       └── package.json
│
├── packages/
│   ├── shared/              # Shared code
│   │   ├── src/
│   │   │   ├── lib/        # Utilities
│   │   │   ├── types/      # TypeScript types
│   │   │   └── prisma/     # Database client
│   │   └── package.json
│   │
│   └── ui/                  # Shared UI components
│       ├── src/
│       └── package.json
│
├── turbo.json              # Turborepo config
└── package.json            # Root package.json
```

### 5.5 Load Balancer Configuration

```hcl
# terraform/modules/load-balancer/main.tf

resource "google_compute_url_map" "default" {
  name            = "hta-url-map"
  default_service = google_compute_backend_service.frontend.id

  host_rule {
    hosts        = ["htacalibr8s.com", "www.htacalibr8s.com"]
    path_matcher = "main"
  }

  path_matcher {
    name            = "main"
    default_service = google_compute_backend_service.frontend.id

    path_rule {
      paths   = ["/api/*"]
      service = google_compute_backend_service.api.id
    }

    path_rule {
      paths   = ["/_next/static/*", "/images/*"]
      service = google_compute_backend_bucket.cdn.id
    }
  }
}
```

---

## 6. Track C: Security Enhancements

**Effort:** 1 week
**Risk:** Medium
**Dependencies:** None

### 6.1 Two-Factor Authentication (2FA)

#### TOTP Implementation

```typescript
// src/lib/auth/totp.ts
import { authenticator } from 'otplib'

export function generateTOTPSecret(email: string): {
  secret: string
  qrCodeUrl: string
} {
  const secret = authenticator.generateSecret()
  const otpauth = authenticator.keyuri(email, 'HTA Calibr8s', secret)
  
  return {
    secret,
    qrCodeUrl: otpauth, // Use qrcode library to generate QR
  }
}

export function verifyTOTP(token: string, secret: string): boolean {
  return authenticator.verify({ token, secret })
}
```

#### Database Schema Addition

```prisma
// prisma/schema.prisma

model StaffUser {
  // ... existing fields
  
  // 2FA fields
  totpSecret        String?
  totpEnabled       Boolean   @default(false)
  totpVerifiedAt    DateTime?
  backupCodes       String[]  // Encrypted backup codes
  
  // WebAuthn
  webauthnCredentials WebAuthnCredential[]
}

model WebAuthnCredential {
  id              String    @id @default(cuid())
  credentialId    String    @unique
  publicKey       Bytes
  counter         Int
  deviceType      String?
  deviceName      String?
  createdAt       DateTime  @default(now())
  lastUsedAt      DateTime?
  
  userId          String
  user            StaffUser @relation(fields: [userId], references: [id])
}
```

#### 2FA Setup Flow

```
┌─────────────────────────────────────────────────────────────┐
│                    2FA SETUP FLOW                            │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. Admin navigates to Settings > Security                  │
│           │                                                  │
│           ▼                                                  │
│  2. Click "Enable 2FA"                                      │
│           │                                                  │
│           ▼                                                  │
│  3. Choose method: TOTP (Google Auth) or WebAuthn (Passkey)│
│           │                                                  │
│           ▼                                                  │
│  4a. TOTP: Scan QR code, enter verification code            │
│  4b. WebAuthn: Register security key or biometric           │
│           │                                                  │
│           ▼                                                  │
│  5. Generate and save backup codes                          │
│           │                                                  │
│           ▼                                                  │
│  6. 2FA enabled - required on next login                    │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### 6.2 CSP with Nonces

```typescript
// src/middleware.ts - Generate nonce per request

import { NextResponse } from 'next/server'
import crypto from 'crypto'

export function middleware(request: NextRequest) {
  const nonce = crypto.randomBytes(16).toString('base64')
  
  const cspHeader = `
    default-src 'self';
    script-src 'self' 'nonce-${nonce}' 'strict-dynamic';
    style-src 'self' 'nonce-${nonce}';
    img-src 'self' data: blob: https:;
    font-src 'self' data:;
    connect-src 'self' https://*.sentry.io;
    frame-ancestors 'none';
    base-uri 'self';
    form-action 'self';
  `.replace(/\s{2,}/g, ' ').trim()

  const response = NextResponse.next()
  response.headers.set('Content-Security-Policy', cspHeader)
  response.headers.set('X-Nonce', nonce) // Pass to components
  
  return response
}
```

```typescript
// src/app/layout.tsx - Use nonce in Script components

import { headers } from 'next/headers'
import Script from 'next/script'

export default function RootLayout({ children }) {
  const nonce = headers().get('X-Nonce') || ''
  
  return (
    <html>
      <body>
        {children}
        <Script nonce={nonce} src="/analytics.js" />
      </body>
    </html>
  )
}
```

### 6.3 Cloud Armor WAF

```hcl
# terraform/modules/cloud-armor/main.tf

resource "google_compute_security_policy" "waf" {
  name = "hta-waf-policy"

  # Default rule - allow all
  rule {
    action   = "allow"
    priority = "2147483647"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    description = "Default allow rule"
  }

  # Block SQL injection
  rule {
    action   = "deny(403)"
    priority = "1000"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('sqli-v33-stable')"
      }
    }
    description = "Block SQL injection"
  }

  # Block XSS
  rule {
    action   = "deny(403)"
    priority = "1001"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('xss-v33-stable')"
      }
    }
    description = "Block XSS attacks"
  }

  # Block remote code execution
  rule {
    action   = "deny(403)"
    priority = "1002"
    match {
      expr {
        expression = "evaluatePreconfiguredExpr('rce-v33-stable')"
      }
    }
    description = "Block RCE attempts"
  }

  # Rate limiting - 1000 requests per minute per IP
  rule {
    action   = "throttle"
    priority = "2000"
    match {
      versioned_expr = "SRC_IPS_V1"
      config {
        src_ip_ranges = ["*"]
      }
    }
    rate_limit_options {
      conform_action = "allow"
      exceed_action  = "deny(429)"
      rate_limit_threshold {
        count        = 1000
        interval_sec = 60
      }
    }
    description = "Rate limit all IPs"
  }

  # Geo-blocking (optional)
  rule {
    action   = "deny(403)"
    priority = "500"
    match {
      expr {
        expression = "origin.region_code == 'XX'" # Replace with blocked regions
      }
    }
    description = "Geo-block specific regions"
  }
}
```

---

## 7. Track D: Monitoring & Alerting

**Effort:** 1 week
**Risk:** Low
**Dependencies:** None (but Track B enables distributed tracing)

### 7.1 OpenTelemetry Setup

```typescript
// src/instrumentation.ts (Next.js instrumentation)

import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { OTLPTraceExporter } from '@opentelemetry/exporter-trace-otlp-http'
import { Resource } from '@opentelemetry/resources'
import { SemanticResourceAttributes } from '@opentelemetry/semantic-conventions'

export function register() {
  const sdk = new NodeSDK({
    resource: new Resource({
      [SemanticResourceAttributes.SERVICE_NAME]: 'hta-calibr8s',
      [SemanticResourceAttributes.SERVICE_VERSION]: process.env.npm_package_version,
      [SemanticResourceAttributes.DEPLOYMENT_ENVIRONMENT]: process.env.NODE_ENV,
    }),
    traceExporter: new OTLPTraceExporter({
      url: process.env.OTEL_EXPORTER_OTLP_ENDPOINT,
    }),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  })

  sdk.start()
}
```

### 7.2 Custom Business Metrics

```typescript
// src/lib/metrics.ts

import { metrics } from '@opentelemetry/api'

const meter = metrics.getMeter('hta-calibr8s')

// Certificate processing time
export const certificateProcessingTime = meter.createHistogram(
  'certificate.processing_time',
  {
    description: 'Time to process a certificate through workflow',
    unit: 'seconds',
  }
)

// Customer approval time
export const customerApprovalTime = meter.createHistogram(
  'customer.approval_time',
  {
    description: 'Time from customer notification to approval',
    unit: 'hours',
  }
)

// Active certificates by status
export const certificatesByStatus = meter.createObservableGauge(
  'certificates.by_status',
  {
    description: 'Number of certificates by status',
  }
)

// Usage example
export function recordCertificateProcessed(startTime: Date, status: string) {
  const duration = (Date.now() - startTime.getTime()) / 1000
  certificateProcessingTime.record(duration, { status })
}
```

### 7.3 PagerDuty Integration

```typescript
// src/lib/alerting/pagerduty.ts

import { createLogger } from '@/lib/logger'

const logger = createLogger('pagerduty')

interface PagerDutyEvent {
  routing_key: string
  event_action: 'trigger' | 'acknowledge' | 'resolve'
  dedup_key?: string
  payload: {
    summary: string
    severity: 'critical' | 'error' | 'warning' | 'info'
    source: string
    custom_details?: Record<string, unknown>
  }
}

export async function triggerPagerDutyAlert(
  summary: string,
  severity: 'critical' | 'error' | 'warning' | 'info',
  details?: Record<string, unknown>
): Promise<void> {
  if (!process.env.PAGERDUTY_ROUTING_KEY) {
    logger.warn('PagerDuty routing key not configured')
    return
  }

  const event: PagerDutyEvent = {
    routing_key: process.env.PAGERDUTY_ROUTING_KEY,
    event_action: 'trigger',
    payload: {
      summary,
      severity,
      source: 'hta-calibr8s',
      custom_details: details,
    },
  }

  try {
    const response = await fetch('https://events.pagerduty.com/v2/enqueue', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(event),
    })

    if (!response.ok) {
      throw new Error(`PagerDuty API error: ${response.status}`)
    }

    logger.info({ summary, severity }, 'PagerDuty alert triggered')
  } catch (error) {
    logger.error({ err: error }, 'Failed to trigger PagerDuty alert')
  }
}
```

### 7.4 SLO Dashboard

```hcl
# terraform/modules/monitoring/slo-dashboard.tf

resource "google_monitoring_dashboard" "slo" {
  dashboard_json = jsonencode({
    displayName = "HTA Calibr8s - SLO Dashboard"
    gridLayout = {
      widgets = [
        {
          title = "API Availability (Target: 99.9%)"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_count\""
                  aggregation = {
                    alignmentPeriod = "3600s"
                    perSeriesAligner = "ALIGN_RATE"
                  }
                }
              }
            }]
          }
        },
        {
          title = "API Latency p95 (Target: <200ms)"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_latencies\""
                  aggregation = {
                    alignmentPeriod = "300s"
                    perSeriesAligner = "ALIGN_PERCENTILE_95"
                  }
                }
              }
            }]
          }
        },
        {
          title = "Error Budget Remaining"
          scorecard = {
            timeSeriesQuery = {
              timeSeriesFilter = {
                filter = "metric.type=\"custom.googleapis.com/error_budget_remaining\""
              }
            }
            thresholds = [
              { value = 50, color = "YELLOW" },
              { value = 20, color = "RED" }
            ]
          }
        }
      ]
    }
  })
}
```

---

## 8. Track E: Disaster Recovery

**Effort:** 3-4 days
**Risk:** Medium
**Dependencies:** None

### 8.1 Backup Restore Procedure

```bash
#!/bin/bash
# scripts/dr-restore.sh

set -e

# Configuration
PROJECT_ID="hta-calibration-prod"
INSTANCE_NAME="hta-main"
BACKUP_ID="$1"
TARGET_INSTANCE="hta-restore-test"

echo "=== HTA Calibr8s Disaster Recovery Restore ==="
echo "Backup ID: $BACKUP_ID"
echo "Target: $TARGET_INSTANCE"

# 1. Create restore instance
echo "Creating restore instance..."
gcloud sql instances clone $INSTANCE_NAME $TARGET_INSTANCE \
  --project=$PROJECT_ID

# 2. Restore from backup
echo "Restoring from backup..."
gcloud sql backups restore $BACKUP_ID \
  --restore-instance=$TARGET_INSTANCE \
  --project=$PROJECT_ID

# 3. Wait for restore to complete
echo "Waiting for restore..."
while true; do
  STATUS=$(gcloud sql operations list --instance=$TARGET_INSTANCE \
    --filter="operationType=RESTORE_VOLUME" --format="value(status)" \
    --limit=1)
  if [ "$STATUS" == "DONE" ]; then
    break
  fi
  echo "Status: $STATUS"
  sleep 30
done

# 4. Verify data integrity
echo "Verifying data integrity..."
CERT_COUNT=$(gcloud sql connect $TARGET_INSTANCE --database=hta_calibration \
  --quiet -- -c "SELECT COUNT(*) FROM certificates;" | tail -1)
echo "Certificate count: $CERT_COUNT"

# 5. Record restore time
END_TIME=$(date +%s)
DURATION=$((END_TIME - START_TIME))
echo "Restore completed in $DURATION seconds"

# 6. Cleanup (optional)
read -p "Delete test instance? (y/n) " -n 1 -r
if [[ $REPLY =~ ^[Yy]$ ]]; then
  gcloud sql instances delete $TARGET_INSTANCE --project=$PROJECT_ID
fi
```

### 8.2 DR Drill Checklist

```markdown
# Monthly DR Drill Checklist

**Date:** _______________
**Conducted by:** _______________

## Pre-Drill
- [ ] Notify team of upcoming drill
- [ ] Identify latest backup to restore
- [ ] Document expected certificate count

## Database Restore
- [ ] Create test Cloud SQL instance
- [ ] Restore backup to test instance
- [ ] Record restore duration: _______ minutes
- [ ] Verify certificate count matches

## Data Integrity Checks
- [ ] Query sample certificates
- [ ] Verify user accounts
- [ ] Check audit logs
- [ ] Validate file attachments (GCS)

## Application Verification
- [ ] Point test app to restored database
- [ ] Login as admin
- [ ] Login as customer
- [ ] View certificates
- [ ] Download PDF

## Results
| Metric | Target | Actual |
|--------|--------|--------|
| RTO (Recovery Time) | < 1 hour | _______ |
| RPO (Data Loss) | < 1 hour | _______ |
| Data Integrity | 100% | _______ |

## Issues Found
1. _______________
2. _______________

## Post-Drill
- [ ] Delete test instance
- [ ] Document findings
- [ ] Update runbook if needed

**Sign-off:** _______________
```

### 8.3 Cross-Region Setup

```hcl
# terraform/modules/cloudsql/replica.tf

resource "google_sql_database_instance" "replica" {
  name                 = "hta-main-replica"
  master_instance_name = google_sql_database_instance.main.name
  region               = "us-west1" # Different region from primary
  database_version     = "POSTGRES_16"

  replica_configuration {
    failover_target = true
  }

  settings {
    tier              = "db-custom-2-4096"
    availability_type = "REGIONAL"
    
    backup_configuration {
      enabled = false # Replica doesn't need separate backups
    }

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.vpc_network_id
    }
  }

  deletion_protection = true
}
```

### 8.4 GCS Multi-Region

```hcl
# terraform/modules/storage/main.tf

resource "google_storage_bucket" "certificates" {
  name     = "hta-calibr8s-certificates"
  location = "US" # Multi-region

  storage_class = "STANDARD"
  
  versioning {
    enabled = true
  }

  lifecycle_rule {
    action {
      type          = "SetStorageClass"
      storage_class = "NEARLINE"
    }
    condition {
      age = 90 # Move to Nearline after 90 days
    }
  }

  lifecycle_rule {
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
    condition {
      age = 365 # Move to Coldline after 1 year
    }
  }
}
```

---

## 9. Dependencies & Sequencing

### Critical Path

```
                    ┌─────────────────┐
                    │ Track A: CDN    │ Week 1
                    │ (Quick Win)     │
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
     ┌──────────────┐ ┌──────────────┐ ┌──────────────┐
     │ Track E: DR  │ │ Track C:     │ │ Track D:     │ Week 2-3
     │ Testing      │ │ Security     │ │ Monitoring   │
     └──────────────┘ └──────────────┘ └──────────────┘
                             │
                             ▼
                    ┌─────────────────┐
                    │ Track B: API    │ Week 4-6
                    │ Separation      │ (If needed)
                    └─────────────────┘
```

### Parallel Work Opportunities

| Track | Can Parallel With | Notes |
|-------|-------------------|-------|
| A: CDN | All others | No dependencies |
| B: API Separation | None | Requires planning |
| C: Security | A, D, E | Independent |
| D: Monitoring | A, C, E | Independent |
| E: DR | A, C, D | Independent |

---

## 10. Risk Assessment

### High-Risk Items

| Item | Risk | Mitigation |
|------|------|------------|
| API Separation | Breaking changes | Extensive testing, feature flags |
| 2FA Rollout | User lockout | Backup codes, admin override |
| CSP Nonces | Broken scripts | Test thoroughly in staging |
| Cross-region replica | Data sync issues | Monitor replication lag |

### Rollback Plans

**CDN Rollback:**
```bash
# Remove assetPrefix from next.config.ts
# Redeploy application
```

**2FA Rollback:**
```sql
-- Disable 2FA for all users (emergency)
UPDATE staff_users SET totp_enabled = false;
```

**CSP Rollback:**
```typescript
// Revert to previous CSP in next.config.ts
// Deploy immediately
```

---

## Files to Create/Modify

| File | Action | Track | Priority | Status |
|------|--------|-------|----------|--------|
| `terraform/modules/cdn/main.tf` | CREATE | A | P1 | ✅ Done |
| `terraform/modules/cdn/variables.tf` | CREATE | A | P1 | ✅ Done |
| `terraform/modules/cdn/outputs.tf` | CREATE | A | P1 | ✅ Done |
| `next.config.ts` | MODIFY | A, C | P1 | ✅ Done (Track A) |
| `prisma/schema.prisma` | MODIFY | B | P1 | ✅ Done |
| `src/lib/prisma.ts` | MODIFY | B | P1 | ✅ Done |
| `docs/guides/prisma-accelerate-setup.md` | CREATE | B | P1 | ✅ Done |
| `docs/prod_plans/phase-9b-api-separation.md` | CREATE | B | P2 | ✅ Done (Planning) |
| `src/lib/auth/totp.ts` | CREATE | C | P1 | Pending |
| `src/lib/auth/webauthn.ts` | CREATE | C | P2 | Pending |
| `src/middleware.ts` | MODIFY | C | P2 | Pending |
| `terraform/modules/cloud-armor/` | CREATE | C | P1 | Pending |
| `src/instrumentation.ts` | CREATE | D | P2 | Pending |
| `src/lib/metrics.ts` | CREATE | D | P2 | Pending |
| `src/lib/alerting/pagerduty.ts` | CREATE | D | P2 | Pending |
| `scripts/dr-restore.sh` | CREATE | E | P1 | Pending |
| `docs/runbooks/dr-drill.md` | CREATE | E | P1 | Pending |
| `terraform/modules/cloudsql/replica.tf` | CREATE | E | P2 | Pending |

---

## Success Criteria

| Track | Metric | Target |
|-------|--------|--------|
| A: CDN | Static asset cache hit rate | > 90% |
| A: CDN | Asset load time | < 100ms |
| B: API | API p95 latency | < 100ms |
| B: API | Independent scaling | Yes |
| C: 2FA | Admin 2FA adoption | 100% |
| C: WAF | Blocked attack attempts | Measurable |
| D: Tracing | Trace coverage | 100% of requests |
| D: Alerting | Alert response time | < 5 min |
| E: DR | RTO (tested) | < 1 hour |
| E: DR | RPO (tested) | < 1 hour |

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-13 | Initial plan |
