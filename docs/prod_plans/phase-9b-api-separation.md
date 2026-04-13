# Phase 9B: API Separation - Detailed Implementation Plan

**Document Version:** 1.0
**Created:** 2026-04-13
**Last Updated:** 2026-04-13
**Status:** Planning (Defer until traffic/team warrants)
**Estimated Effort:** 3-4 weeks
**Risk Level:** High

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Decision Framework](#2-decision-framework)
3. [Current Architecture](#3-current-architecture)
4. [Target Architecture](#4-target-architecture)
5. [Monorepo Structure](#5-monorepo-structure)
6. [Migration Strategy](#6-migration-strategy)
7. [Phase 1: Monorepo Setup](#7-phase-1-monorepo-setup)
8. [Phase 2: Shared Packages](#8-phase-2-shared-packages)
9. [Phase 3: API Extraction](#9-phase-3-api-extraction)
10. [Phase 4: Worker Service](#10-phase-4-worker-service)
11. [Phase 5: Load Balancer & Routing](#11-phase-5-load-balancer--routing)
12. [Phase 6: Deployment & Cutover](#12-phase-6-deployment--cutover)
13. [Docker Configuration](#13-docker-configuration)
14. [GitHub Actions CI/CD](#14-github-actions-cicd)
15. [Testing Strategy](#15-testing-strategy)
16. [Monitoring Implementation](#16-monitoring-implementation)
17. [Secrets Infrastructure](#17-secrets-infrastructure)
18. [Performance Management](#18-performance-management)
19. [Compliance Management](#19-compliance-management)
20. [Rollback Plan](#20-rollback-plan)
21. [Post-Migration Checklist](#21-post-migration-checklist)

---

## 1. Executive Summary

### Why Separate?

| Benefit | Description |
|---------|-------------|
| **Independent Scaling** | Scale API separately from frontend based on load |
| **Resource Optimization** | Allocate more memory/CPU to API, less to frontend |
| **Deployment Isolation** | Deploy API without redeploying frontend |
| **Team Scalability** | Multiple teams can work independently |
| **Cost Efficiency** | Right-size resources for each service |

### What Changes

| Component | Before | After |
|-----------|--------|-------|
| Repository | Single Next.js app | Turborepo monorepo |
| Frontend | Next.js (pages + API) | Next.js (pages only) |
| API | Next.js API routes | Standalone API service |
| Background Jobs | In-process | Separate worker service |
| Database | Direct connection | Via Prisma Accelerate |
| Deployment | Single Cloud Run | 3 Cloud Run services |

### Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|------------|
| Breaking changes | Medium | High | Feature flags, gradual rollout |
| Increased complexity | High | Medium | Good documentation, monitoring |
| Deployment failures | Medium | High | Blue-green deployment, rollback plan |
| Performance regression | Low | Medium | Load testing before cutover |
| Data inconsistency | Low | High | Transaction handling, idempotency |

---

## 2. Decision Framework

### When to Proceed

Proceed with separation when ANY of these thresholds are met:

| Metric | Current | Threshold | Status |
|--------|---------|-----------|--------|
| API latency p95 | ~150ms | > 300ms consistently | ⏳ Not met |
| Cloud Run instances | 1-2 | > 5 concurrent | ⏳ Not met |
| Monthly API requests | ~100K | > 1M | ⏳ Not met |
| Team size | 1-2 | > 4 developers | ⏳ Not met |
| Deploy frequency | Weekly | > Daily | ⏳ Not met |
| API vs Frontend changes | Mixed | 80%+ API only | ⏳ Not met |

### Prerequisites

Before starting separation:

- [x] CORS configuration ready (`src/lib/security/cors.ts`)
- [x] Rate limiting ready (`src/lib/security/rate-limiter.ts`)
- [x] Prisma Accelerate ready (`src/lib/prisma.ts`)
- [x] Structured logging (`src/lib/logger.ts`)
- [x] Error tracking (Sentry)
- [ ] Load testing baseline established
- [ ] Monitoring dashboards in place
- [ ] Team aligned on timeline

---

## 3. Current Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Cloud Run (Single Service)               │
│  ┌───────────────────────────────────────────────────────┐  │
│  │                  Next.js Application                   │  │
│  │                                                        │  │
│  │  ┌──────────────┐  ┌──────────────┐  ┌─────────────┐  │  │
│  │  │    Pages     │  │  API Routes  │  │   Workers   │  │  │
│  │  │              │  │              │  │             │  │  │
│  │  │ /dashboard   │  │ /api/auth/*  │  │ Email Jobs  │  │  │
│  │  │ /customer/*  │  │ /api/cert/*  │  │ Cleanup     │  │  │
│  │  │ /admin/*     │  │ /api/admin/* │  │ Notifs      │  │  │
│  │  └──────────────┘  └──────────────┘  └─────────────┘  │  │
│  │                          │                             │  │
│  │                          ▼                             │  │
│  │                 ┌──────────────────┐                   │  │
│  │                 │  Prisma Client   │                   │  │
│  │                 └────────┬─────────┘                   │  │
│  └──────────────────────────┼────────────────────────────┘  │
└─────────────────────────────┼───────────────────────────────┘
                              │
                     ┌────────▼────────┐
                     │    Cloud SQL    │
                     │   PostgreSQL    │
                     └─────────────────┘
```

### Current File Structure

```
hta-calibration/
├── src/
│   ├── app/                    # Next.js App Router
│   │   ├── api/               # API routes (to be extracted)
│   │   │   ├── auth/
│   │   │   ├── admin/
│   │   │   ├── customer/
│   │   │   └── certificates/
│   │   ├── (dashboard)/       # Staff pages
│   │   ├── admin/             # Admin pages
│   │   └── customer/          # Customer pages
│   ├── components/            # React components
│   ├── lib/                   # Shared utilities
│   │   ├── auth.ts
│   │   ├── prisma.ts
│   │   ├── logger.ts
│   │   └── services/
│   └── emails/               # Email templates
├── prisma/
│   └── schema.prisma
└── package.json
```

### Pain Points

1. **Resource contention**: API and SSR compete for same CPU/memory
2. **Deployment coupling**: Frontend change requires full redeploy
3. **Scaling inefficiency**: Can't scale API independently
4. **Background job reliability**: Jobs run in request context

---

## 4. Target Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                      Cloud Load Balancer                             │
│                      + Cloud Armor WAF                               │
└───────────────────────────────┬─────────────────────────────────────┘
                                │
               ┌────────────────┼────────────────┐
               │                │                │
               ▼                ▼                ▼
┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐
│    Frontend      │  │    API Server    │  │     Worker       │
│   Cloud Run      │  │   Cloud Run      │  │   Cloud Run      │
│                  │  │                  │  │                  │
│  - Next.js SSR   │  │  - API routes    │  │  - Email jobs    │
│  - Static pages  │  │  - Auth logic    │  │  - Cleanup jobs  │
│  - React SPA     │  │  - Business ops  │  │  - Notifications │
│                  │  │                  │  │  - Scheduled     │
│  Memory: 512MB   │  │  Memory: 1GB     │  │  Memory: 512MB   │
│  CPU: 1          │  │  CPU: 2          │  │  CPU: 1          │
│  Min: 0, Max: 5  │  │  Min: 1, Max: 10 │  │  Min: 0, Max: 3  │
└────────┬─────────┘  └────────┬─────────┘  └────────┬─────────┘
         │                     │                     │
         │              CORS enabled                 │
         │                     │                     │
         └─────────────────────┼─────────────────────┘
                               │
                    ┌──────────▼──────────┐
                    │   Prisma Accelerate │
                    │   (Connection Pool) │
                    └──────────┬──────────┘
                               │
                    ┌──────────▼──────────┐
                    │     Cloud SQL       │
                    │    PostgreSQL       │
                    └─────────────────────┘
```

### Service Responsibilities

| Service | Responsibilities | Scaling Triggers |
|---------|------------------|------------------|
| **Frontend** | SSR, static pages, client routing | Page views, SSR load |
| **API** | Auth, CRUD, business logic, validation | API requests, DB queries |
| **Worker** | Email, notifications, cleanup, reports | Queue depth, scheduled |

---

## 5. Monorepo Structure

### Directory Layout

```
hta-calibration/
├── apps/
│   ├── web/                          # Frontend (Next.js)
│   │   ├── src/
│   │   │   ├── app/                 # Pages only (no /api)
│   │   │   │   ├── (dashboard)/
│   │   │   │   ├── admin/
│   │   │   │   ├── customer/
│   │   │   │   └── (public)/
│   │   │   ├── components/
│   │   │   ├── hooks/
│   │   │   └── styles/
│   │   ├── public/
│   │   ├── next.config.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── api/                          # API Server
│   │   ├── src/
│   │   │   ├── routes/              # API route handlers
│   │   │   │   ├── auth/
│   │   │   │   ├── certificates/
│   │   │   │   ├── admin/
│   │   │   │   └── customer/
│   │   │   ├── middleware/
│   │   │   │   ├── auth.ts
│   │   │   │   ├── cors.ts
│   │   │   │   ├── rate-limit.ts
│   │   │   │   └── error-handler.ts
│   │   │   ├── services/            # Business logic
│   │   │   └── server.ts            # Entry point
│   │   ├── package.json
│   │   ├── tsconfig.json
│   │   └── Dockerfile
│   │
│   └── worker/                       # Background Worker
│       ├── src/
│       │   ├── jobs/
│       │   │   ├── email.ts
│       │   │   ├── cleanup.ts
│       │   │   └── notifications.ts
│       │   ├── scheduler/
│       │   └── index.ts
│       ├── package.json
│       ├── tsconfig.json
│       └── Dockerfile
│
├── packages/
│   ├── database/                     # Prisma client & types
│   │   ├── prisma/
│   │   │   └── schema.prisma
│   │   ├── src/
│   │   │   ├── client.ts
│   │   │   └── index.ts
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── shared/                       # Shared utilities
│   │   ├── src/
│   │   │   ├── auth/
│   │   │   ├── logger/
│   │   │   ├── cache/
│   │   │   ├── security/
│   │   │   ├── types/
│   │   │   └── utils/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   ├── emails/                       # Email templates
│   │   ├── src/
│   │   │   └── templates/
│   │   ├── package.json
│   │   └── tsconfig.json
│   │
│   └── ui/                           # Shared UI components
│       ├── src/
│       │   └── components/
│       ├── package.json
│       └── tsconfig.json
│
├── terraform/                        # Infrastructure
│   └── modules/
│       └── services/                # New: multi-service config
│
├── turbo.json                        # Turborepo config
├── pnpm-workspace.yaml              # Workspace config
├── package.json                      # Root package.json
└── tsconfig.base.json               # Base TypeScript config
```

### Package Dependencies

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   apps/web  │     │   apps/api  │     │ apps/worker │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       ▼                   ▼                   ▼
┌──────────────────────────────────────────────────────┐
│                   packages/shared                     │
│  (auth, logger, cache, security, types, utils)       │
└──────────────────────────┬───────────────────────────┘
                           │
                           ▼
              ┌────────────────────────┐
              │   packages/database    │
              │   (prisma client)      │
              └────────────────────────┘
```

---

## 6. Migration Strategy

### Approach: Strangler Fig Pattern

Gradually extract functionality from monolith to services while maintaining backward compatibility.

```
Phase 1: Setup monorepo structure
    │
    ▼
Phase 2: Extract shared packages
    │
    ▼
Phase 3: Create API service (shadow mode)
    │
    ▼
Phase 4: Create worker service
    │
    ▼
Phase 5: Configure load balancer routing
    │
    ▼
Phase 6: Gradual traffic shift (10% → 50% → 100%)
    │
    ▼
Phase 7: Remove old API routes from frontend
```

### Timeline

| Phase | Duration | Dependencies | Risk |
|-------|----------|--------------|------|
| 1. Monorepo Setup | 2 days | None | Low |
| 2. Shared Packages | 3 days | Phase 1 | Low |
| 3. API Extraction | 5 days | Phase 2 | Medium |
| 4. Worker Service | 3 days | Phase 2 | Low |
| 5. Load Balancer | 2 days | Phase 3 | Medium |
| 6. Cutover | 3 days | All | High |

**Total: ~3 weeks**

---

## 7. Phase 1: Monorepo Setup

### Step 1.1: Initialize Turborepo

```bash
# Install turbo globally
npm install -g turbo

# Create turbo.json
cat > turbo.json << 'EOF'
{
  "$schema": "https://turbo.build/schema.json",
  "globalDependencies": ["**/.env.*local"],
  "pipeline": {
    "build": {
      "dependsOn": ["^build"],
      "outputs": [".next/**", "dist/**"]
    },
    "dev": {
      "cache": false,
      "persistent": true
    },
    "lint": {},
    "test": {
      "dependsOn": ["^build"]
    },
    "db:generate": {
      "cache": false
    },
    "db:push": {
      "cache": false
    }
  }
}
EOF
```

### Step 1.2: Create Workspace Config

```yaml
# pnpm-workspace.yaml
packages:
  - 'apps/*'
  - 'packages/*'
```

### Step 1.3: Update Root package.json

```json
{
  "name": "hta-calibration",
  "private": true,
  "scripts": {
    "build": "turbo run build",
    "dev": "turbo run dev",
    "lint": "turbo run lint",
    "test": "turbo run test",
    "db:generate": "turbo run db:generate",
    "db:push": "turbo run db:push"
  },
  "devDependencies": {
    "turbo": "^2.0.0"
  },
  "packageManager": "pnpm@8.0.0"
}
```

### Step 1.4: Create Directory Structure

```bash
mkdir -p apps/{web,api,worker}/src
mkdir -p packages/{database,shared,emails,ui}/src
```

---

## 8. Phase 2: Shared Packages

### Step 2.1: Create packages/database

```typescript
// packages/database/src/client.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = globalThis as unknown as {
  prisma: PrismaClient | undefined
}

export const prisma = globalForPrisma.prisma ?? new PrismaClient({
  log: process.env.NODE_ENV === 'development' ? ['error', 'warn'] : ['error'],
})

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

export * from '@prisma/client'
```

```json
// packages/database/package.json
{
  "name": "@hta/database",
  "version": "0.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "scripts": {
    "build": "tsc",
    "db:generate": "prisma generate",
    "db:push": "prisma db push"
  },
  "dependencies": {
    "@prisma/client": "^5.0.0"
  },
  "devDependencies": {
    "prisma": "^5.0.0",
    "typescript": "^5.0.0"
  }
}
```

### Step 2.2: Create packages/shared

Move these files from `src/lib/`:
- `auth.ts` → `packages/shared/src/auth/`
- `logger.ts` → `packages/shared/src/logger/`
- `cache/` → `packages/shared/src/cache/`
- `security/` → `packages/shared/src/security/`

```json
// packages/shared/package.json
{
  "name": "@hta/shared",
  "version": "0.0.0",
  "main": "./dist/index.js",
  "types": "./dist/index.d.ts",
  "exports": {
    "./auth": "./dist/auth/index.js",
    "./logger": "./dist/logger/index.js",
    "./cache": "./dist/cache/index.js",
    "./security": "./dist/security/index.js"
  },
  "scripts": {
    "build": "tsc"
  },
  "dependencies": {
    "@hta/database": "workspace:*",
    "next-auth": "^5.0.0",
    "pino": "^8.0.0"
  }
}
```

### Step 2.3: Update Import Paths

```typescript
// Before (in apps/web or apps/api)
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

// After
import { prisma } from '@hta/database'
import { createLogger } from '@hta/shared/logger'
```

---

## 9. Phase 3: API Extraction

### Step 3.1: Choose API Framework

Options:
1. **Next.js Standalone** - Keep Next.js, just API routes
2. **Fastify** - Fast, schema validation, plugins
3. **Hono** - Ultra-light, edge-ready
4. **Express** - Mature, well-known

**Recommendation:** Next.js Standalone for minimal changes, or Fastify for better performance.

### Step 3.2: API Server Structure (Fastify Example)

```typescript
// apps/api/src/server.ts
import Fastify from 'fastify'
import cors from '@fastify/cors'
import { authRoutes } from './routes/auth'
import { certificateRoutes } from './routes/certificates'
import { adminRoutes } from './routes/admin'
import { customerRoutes } from './routes/customer'
import { errorHandler } from './middleware/error-handler'
import { createLogger } from '@hta/shared/logger'

const logger = createLogger('api')

const app = Fastify({
  logger: true,
})

// Middleware
await app.register(cors, {
  origin: process.env.CORS_ALLOWED_ORIGINS?.split(',') || ['http://localhost:3000'],
  credentials: true,
})

// Routes
app.register(authRoutes, { prefix: '/api/auth' })
app.register(certificateRoutes, { prefix: '/api/certificates' })
app.register(adminRoutes, { prefix: '/api/admin' })
app.register(customerRoutes, { prefix: '/api/customer' })

// Error handling
app.setErrorHandler(errorHandler)

// Health check
app.get('/health', async () => ({ status: 'ok' }))

// Start
const start = async () => {
  try {
    const port = parseInt(process.env.PORT || '8080')
    await app.listen({ port, host: '0.0.0.0' })
    logger.info({ port }, 'API server started')
  } catch (err) {
    logger.error(err)
    process.exit(1)
  }
}

start()
```

### Step 3.3: Route Migration Example

```typescript
// Before: src/app/api/certificates/route.ts (Next.js)
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }
  
  const certificates = await prisma.certificate.findMany()
  return NextResponse.json(certificates)
}

// After: apps/api/src/routes/certificates/index.ts (Fastify)
import { FastifyInstance } from 'fastify'
import { prisma } from '@hta/database'
import { verifySession } from '../../middleware/auth'

export async function certificateRoutes(app: FastifyInstance) {
  app.addHook('preHandler', verifySession)

  app.get('/', async (request, reply) => {
    const certificates = await prisma.certificate.findMany()
    return certificates
  })
}
```

### Step 3.4: API Dockerfile

```dockerfile
# apps/api/Dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN npm install -g pnpm && pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --filter=@hta/api

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
EXPOSE 8080
CMD ["node", "dist/server.js"]
```

---

## 10. Phase 4: Worker Service

### Step 4.1: Worker Structure

```typescript
// apps/worker/src/index.ts
import { createLogger } from '@hta/shared/logger'
import { processEmailQueue } from './jobs/email'
import { processCleanup } from './jobs/cleanup'
import { processNotifications } from './jobs/notifications'

const logger = createLogger('worker')

async function main() {
  logger.info('Worker starting...')

  // Run jobs in parallel
  await Promise.all([
    processEmailQueue(),
    processNotifications(),
  ])

  // Run cleanup on schedule
  setInterval(processCleanup, 60 * 60 * 1000) // Every hour

  logger.info('Worker ready')
}

main().catch((err) => {
  logger.error(err, 'Worker failed')
  process.exit(1)
})
```

### Step 4.2: Job Processing

```typescript
// apps/worker/src/jobs/email.ts
import { prisma } from '@hta/database'
import { sendEmail } from '@hta/shared/email'
import { createLogger } from '@hta/shared/logger'

const logger = createLogger('worker:email')

export async function processEmailQueue() {
  while (true) {
    const jobs = await prisma.emailQueue.findMany({
      where: { status: 'PENDING' },
      take: 10,
      orderBy: { createdAt: 'asc' },
    })

    for (const job of jobs) {
      try {
        await sendEmail(job.to, job.template, job.data)
        await prisma.emailQueue.update({
          where: { id: job.id },
          data: { status: 'SENT', sentAt: new Date() },
        })
        logger.info({ jobId: job.id }, 'Email sent')
      } catch (error) {
        await prisma.emailQueue.update({
          where: { id: job.id },
          data: { status: 'FAILED', error: String(error) },
        })
        logger.error({ jobId: job.id, error }, 'Email failed')
      }
    }

    // Wait before checking again
    await new Promise((resolve) => setTimeout(resolve, 5000))
  }
}
```

### Step 4.3: Worker Dockerfile

```dockerfile
# apps/worker/Dockerfile
FROM node:20-alpine AS base

FROM base AS deps
WORKDIR /app
COPY package.json pnpm-lock.yaml ./
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY apps/worker/package.json ./apps/worker/
RUN npm install -g pnpm && pnpm install --frozen-lockfile

FROM base AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build --filter=@hta/worker

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=builder /app/apps/worker/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
```

---

## 11. Phase 5: Load Balancer & Routing

### Step 5.1: Terraform Configuration

```hcl
# terraform/modules/services/main.tf

# Frontend Service
resource "google_cloud_run_v2_service" "frontend" {
  name     = "hta-frontend-${var.environment}"
  location = var.region

  template {
    containers {
      image = var.frontend_image
      
      resources {
        limits = {
          memory = "512Mi"
          cpu    = "1"
        }
      }

      env {
        name  = "API_URL"
        value = "https://api.${var.domain}"
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 5
    }
  }
}

# API Service
resource "google_cloud_run_v2_service" "api" {
  name     = "hta-api-${var.environment}"
  location = var.region

  template {
    containers {
      image = var.api_image
      
      resources {
        limits = {
          memory = "1Gi"
          cpu    = "2"
        }
      }

      env {
        name  = "DATABASE_URL"
        value = var.database_url
      }
    }

    scaling {
      min_instance_count = 1  # Keep warm
      max_instance_count = 10
    }
  }
}

# Worker Service
resource "google_cloud_run_v2_service" "worker" {
  name     = "hta-worker-${var.environment}"
  location = var.region

  template {
    containers {
      image = var.worker_image
      
      resources {
        limits = {
          memory = "512Mi"
          cpu    = "1"
        }
      }
    }

    scaling {
      min_instance_count = 0
      max_instance_count = 3
    }
  }
}
```

### Step 5.2: URL Map Configuration

```hcl
# terraform/modules/load-balancer/url-map.tf

resource "google_compute_url_map" "default" {
  name            = "hta-url-map-${var.environment}"
  default_service = google_compute_backend_service.frontend.id

  host_rule {
    hosts        = [var.domain, "www.${var.domain}"]
    path_matcher = "main"
  }

  path_matcher {
    name            = "main"
    default_service = google_compute_backend_service.frontend.id

    # API routes go to API service
    path_rule {
      paths   = ["/api/*"]
      service = google_compute_backend_service.api.id
    }

    # Static assets go to CDN
    path_rule {
      paths   = ["/_next/static/*", "/images/*", "/fonts/*"]
      service = google_compute_backend_bucket.cdn.id
    }
  }
}

# Backend service for frontend
resource "google_compute_backend_service" "frontend" {
  name        = "hta-frontend-backend-${var.environment}"
  protocol    = "HTTP"
  timeout_sec = 30

  backend {
    group = google_compute_region_network_endpoint_group.frontend.id
  }

  health_checks = [google_compute_health_check.default.id]
}

# Backend service for API
resource "google_compute_backend_service" "api" {
  name        = "hta-api-backend-${var.environment}"
  protocol    = "HTTP"
  timeout_sec = 60

  backend {
    group = google_compute_region_network_endpoint_group.api.id
  }

  health_checks = [google_compute_health_check.api.id]
}
```

---

## 12. Phase 6: Deployment & Cutover

### Step 6.1: Shadow Mode Testing

1. Deploy API service alongside monolith
2. Mirror traffic to both (don't use API response)
3. Compare responses for discrepancies
4. Fix any issues before cutover

### Step 6.2: Gradual Traffic Shift

```hcl
# Use traffic splitting in Cloud Run or Load Balancer

# Option 1: Cloud Run traffic splitting
resource "google_cloud_run_v2_service" "api" {
  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION"
    percent = 10  # Start with 10%
    revision = google_cloud_run_v2_service.api.latest_revision
  }
  
  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_REVISION"
    percent = 90  # 90% to old
    revision = "hta-api-old-revision"
  }
}
```

### Step 6.3: Cutover Checklist

```markdown
## Pre-Cutover
- [ ] All services deployed and healthy
- [ ] Monitoring dashboards configured
- [ ] Alerts configured
- [ ] Runbook prepared
- [ ] Team on standby

## Cutover
- [ ] Shift 10% traffic to new services
- [ ] Monitor for 30 minutes
- [ ] Check error rates, latency, logs
- [ ] If OK, shift to 50%
- [ ] Monitor for 1 hour
- [ ] If OK, shift to 100%

## Post-Cutover
- [ ] Remove old API routes from frontend
- [ ] Update CI/CD pipelines
- [ ] Update documentation
- [ ] Decommission old service
```

---

## 13. Docker Configuration

### 13.1 Root Docker Compose

For local development, all services run together:

```yaml
# docker-compose.yml (root)
version: '3.8'

services:
  # PostgreSQL Database
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: hta_user
      POSTGRES_PASSWORD: hta_dev_password
      POSTGRES_DB: hta_calibration
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
    healthcheck:
      test: ["CMD-SHELL", "pg_isready -U hta_user -d hta_calibration"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Redis Cache
  redis:
    image: redis:7-alpine
    ports:
      - "6379:6379"
    healthcheck:
      test: ["CMD", "redis-cli", "ping"]
      interval: 10s
      timeout: 5s
      retries: 5

  # Frontend (Next.js)
  web:
    build:
      context: .
      dockerfile: apps/web/Dockerfile
      target: development
    ports:
      - "3000:3000"
    environment:
      - NODE_ENV=development
      - API_URL=http://api:8080
      - DATABASE_URL=postgresql://hta_user:hta_dev_password@postgres:5432/hta_calibration
    volumes:
      - ./apps/web:/app/apps/web
      - ./packages:/app/packages
      - /app/node_modules
      - /app/apps/web/node_modules
    depends_on:
      postgres:
        condition: service_healthy

  # API Server
  api:
    build:
      context: .
      dockerfile: apps/api/Dockerfile
      target: development
    ports:
      - "8080:8080"
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://hta_user:hta_dev_password@postgres:5432/hta_calibration
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./apps/api:/app/apps/api
      - ./packages:/app/packages
      - /app/node_modules
      - /app/apps/api/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

  # Background Worker
  worker:
    build:
      context: .
      dockerfile: apps/worker/Dockerfile
      target: development
    environment:
      - NODE_ENV=development
      - DATABASE_URL=postgresql://hta_user:hta_dev_password@postgres:5432/hta_calibration
      - REDIS_URL=redis://redis:6379
    volumes:
      - ./apps/worker:/app/apps/worker
      - ./packages:/app/packages
      - /app/node_modules
      - /app/apps/worker/node_modules
    depends_on:
      postgres:
        condition: service_healthy
      redis:
        condition: service_healthy

volumes:
  postgres_data:
```

### 13.2 Multi-Stage Dockerfiles

Each app has a multi-stage Dockerfile for dev and prod:

```dockerfile
# apps/web/Dockerfile
# ==================== BASE ====================
FROM node:20-alpine AS base
RUN npm install -g pnpm turbo
WORKDIR /app

# ==================== DEPENDENCIES ====================
FROM base AS deps
# Copy root workspace files
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
# Copy package.json files for all packages
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY apps/web/package.json ./apps/web/
# Install all dependencies
RUN pnpm install --frozen-lockfile

# ==================== DEVELOPMENT ====================
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client
RUN pnpm --filter @hta/database db:generate
WORKDIR /app/apps/web
CMD ["pnpm", "dev"]

# ==================== BUILDER ====================
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
# Generate Prisma client
RUN pnpm --filter @hta/database db:generate
# Build all packages and the web app
RUN turbo run build --filter=@hta/web

# ==================== PRODUCTION ====================
FROM base AS production
ENV NODE_ENV=production
WORKDIR /app

# Copy built assets
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000
CMD ["node", "apps/web/server.js"]
```

```dockerfile
# apps/api/Dockerfile
# ==================== BASE ====================
FROM node:20-alpine AS base
RUN npm install -g pnpm turbo
WORKDIR /app

# ==================== DEPENDENCIES ====================
FROM base AS deps
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml turbo.json ./
COPY packages/database/package.json ./packages/database/
COPY packages/shared/package.json ./packages/shared/
COPY apps/api/package.json ./apps/api/
RUN pnpm install --frozen-lockfile

# ==================== DEVELOPMENT ====================
FROM base AS development
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @hta/database db:generate
WORKDIR /app/apps/api
CMD ["pnpm", "dev"]

# ==================== BUILDER ====================
FROM base AS builder
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN pnpm --filter @hta/database db:generate
RUN turbo run build --filter=@hta/api

# ==================== PRODUCTION ====================
FROM node:20-alpine AS production
ENV NODE_ENV=production
WORKDIR /app

# Copy only necessary files
COPY --from=builder /app/apps/api/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
COPY --from=builder /app/packages/database/node_modules/.prisma ./node_modules/.prisma

EXPOSE 8080
CMD ["node", "dist/server.js"]
```

### 13.3 Build Commands

```bash
# Development - all services
docker compose up

# Development - specific service
docker compose up web api

# Production build - specific service
docker build -f apps/web/Dockerfile --target production -t hta-web:latest .
docker build -f apps/api/Dockerfile --target production -t hta-api:latest .
docker build -f apps/worker/Dockerfile --target production -t hta-worker:latest .

# Build with Turbo (faster, uses cache)
turbo run docker:build
```

---

## 14. GitHub Actions CI/CD

### 14.1 Workflow Structure

```
.github/
└── workflows/
    ├── ci.yml                 # Lint, test, build on PRs
    ├── deploy-dev.yml         # Deploy to dev on main push
    ├── deploy-prod.yml        # Deploy to prod on release
    └── nightly.yml            # Nightly E2E tests
```

### 14.2 Main CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main]
  pull_request:
    branches: [main]

concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true

env:
  NODE_VERSION: '20'
  TURBO_TOKEN: ${{ secrets.TURBO_TOKEN }}
  TURBO_TEAM: ${{ vars.TURBO_TEAM }}

jobs:
  # ==================== DETECT CHANGES ====================
  changes:
    name: Detect Changes
    runs-on: ubuntu-latest
    outputs:
      web: ${{ steps.filter.outputs.web }}
      api: ${{ steps.filter.outputs.api }}
      worker: ${{ steps.filter.outputs.worker }}
      packages: ${{ steps.filter.outputs.packages }}
    steps:
      - uses: actions/checkout@v4
      - uses: dorny/paths-filter@v3
        id: filter
        with:
          filters: |
            web:
              - 'apps/web/**'
              - 'packages/ui/**'
              - 'packages/shared/**'
              - 'packages/database/**'
            api:
              - 'apps/api/**'
              - 'packages/shared/**'
              - 'packages/database/**'
            worker:
              - 'apps/worker/**'
              - 'packages/shared/**'
              - 'packages/database/**'
            packages:
              - 'packages/**'

  # ==================== CODE QUALITY ====================
  code-quality:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          
      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 8
          
      - name: Get pnpm store
        shell: bash
        run: echo "STORE_PATH=$(pnpm store path --silent)" >> $GITHUB_ENV

      - name: Cache pnpm
        uses: actions/cache@v4
        with:
          path: ${{ env.STORE_PATH }}
          key: pnpm-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}
          restore-keys: pnpm-${{ runner.os }}-

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Lint
        run: pnpm turbo run lint

      - name: Type check
        run: pnpm turbo run typecheck

  # ==================== UNIT TESTS ====================
  unit-tests:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: code-quality
    strategy:
      matrix:
        package: [database, shared, web, api, worker]
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          
      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Generate Prisma
        run: pnpm turbo run db:generate

      - name: Run unit tests
        run: pnpm turbo run test --filter=@hta/${{ matrix.package }}
        
      - name: Upload coverage
        uses: codecov/codecov-action@v4
        with:
          flags: ${{ matrix.package }}
          
  # ==================== INTEGRATION TESTS ====================
  integration-tests:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: [code-quality, changes]
    if: needs.changes.outputs.api == 'true' || needs.changes.outputs.packages == 'true'
    
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: hta_test
          POSTGRES_PASSWORD: hta_test_password
          POSTGRES_DB: hta_calibration_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U hta_test"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
          
      redis:
        image: redis:7-alpine
        ports:
          - 6379:6379
        options: >-
          --health-cmd "redis-cli ping"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          
      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Setup database
        run: |
          pnpm turbo run db:generate
          pnpm turbo run db:push
        env:
          DATABASE_URL: postgresql://hta_test:hta_test_password@localhost:5432/hta_calibration_test

      - name: Seed database
        run: pnpm turbo run db:seed
        env:
          DATABASE_URL: postgresql://hta_test:hta_test_password@localhost:5432/hta_calibration_test

      - name: Run integration tests
        run: pnpm turbo run test:integration
        env:
          DATABASE_URL: postgresql://hta_test:hta_test_password@localhost:5432/hta_calibration_test
          REDIS_URL: redis://localhost:6379

  # ==================== BUILD ====================
  build:
    name: Build
    runs-on: ubuntu-latest
    needs: [code-quality, changes]
    strategy:
      matrix:
        include:
          - app: web
            condition: ${{ needs.changes.outputs.web == 'true' || needs.changes.outputs.packages == 'true' }}
          - app: api
            condition: ${{ needs.changes.outputs.api == 'true' || needs.changes.outputs.packages == 'true' }}
          - app: worker
            condition: ${{ needs.changes.outputs.worker == 'true' || needs.changes.outputs.packages == 'true' }}
    steps:
      - uses: actions/checkout@v4
        if: matrix.condition

      - name: Setup Node.js
        if: matrix.condition
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          
      - name: Setup pnpm
        if: matrix.condition
        uses: pnpm/action-setup@v3
        with:
          version: 8

      - name: Install dependencies
        if: matrix.condition
        run: pnpm install --frozen-lockfile

      - name: Build
        if: matrix.condition
        run: pnpm turbo run build --filter=@hta/${{ matrix.app }}

  # ==================== E2E TESTS ====================
  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: [unit-tests, integration-tests, build]
    
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_USER: hta_test
          POSTGRES_PASSWORD: hta_test_password
          POSTGRES_DB: hta_calibration_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd "pg_isready -U hta_test"
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5

    steps:
      - uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          
      - name: Setup pnpm
        uses: pnpm/action-setup@v3
        with:
          version: 8

      - name: Install dependencies
        run: pnpm install --frozen-lockfile

      - name: Setup database
        run: |
          pnpm turbo run db:generate
          pnpm turbo run db:push
          pnpm turbo run db:seed
        env:
          DATABASE_URL: postgresql://hta_test:hta_test_password@localhost:5432/hta_calibration_test

      - name: Cache Playwright
        uses: actions/cache@v4
        with:
          path: ~/.cache/ms-playwright
          key: playwright-${{ runner.os }}-${{ hashFiles('**/pnpm-lock.yaml') }}

      - name: Install Playwright
        run: npx playwright install chromium --with-deps

      - name: Build all services
        run: pnpm turbo run build

      - name: Run E2E tests
        run: pnpm turbo run test:e2e
        env:
          DATABASE_URL: postgresql://hta_test:hta_test_password@localhost:5432/hta_calibration_test
          NEXTAUTH_SECRET: test-secret
          NEXTAUTH_URL: http://localhost:3000

      - name: Upload Playwright report
        uses: actions/upload-artifact@v4
        if: always()
        with:
          name: playwright-report
          path: apps/web/playwright-report/
          retention-days: 7
```

### 14.3 Deployment Workflow

```yaml
# .github/workflows/deploy-prod.yml
name: Deploy Production

on:
  release:
    types: [published]

env:
  PROJECT_ID: hta-calibration-prod
  REGION: asia-south1
  GAR_LOCATION: asia-south1-docker.pkg.dev

jobs:
  deploy:
    name: Deploy to Production
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write

    strategy:
      matrix:
        service: [web, api, worker]

    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}

      - name: Configure Docker
        run: gcloud auth configure-docker ${{ env.GAR_LOCATION }}

      - name: Build and push Docker image
        run: |
          IMAGE="${{ env.GAR_LOCATION }}/${{ env.PROJECT_ID }}/hta/${{ matrix.service }}:${{ github.sha }}"
          docker build -f apps/${{ matrix.service }}/Dockerfile \
            --target production \
            -t $IMAGE .
          docker push $IMAGE

      - name: Deploy to Cloud Run
        run: |
          gcloud run deploy hta-${{ matrix.service }} \
            --image ${{ env.GAR_LOCATION }}/${{ env.PROJECT_ID }}/hta/${{ matrix.service }}:${{ github.sha }} \
            --region ${{ env.REGION }} \
            --platform managed \
            --quiet
```

### 14.4 Turbo Remote Caching

Enable Turbo remote caching for faster CI:

```bash
# In GitHub Actions, set these secrets:
# - TURBO_TOKEN: Get from Vercel or self-hosted cache
# - TURBO_TEAM: Your team name

# turbo.json already configured for remote caching
```

---

## 15. Testing Strategy

### 15.1 Test Organization

```
hta-calibration/
├── apps/
│   ├── web/
│   │   └── tests/
│   │       ├── unit/              # Component tests
│   │       ├── integration/       # Page tests with mocked API
│   │       └── e2e/               # Full E2E tests
│   │           ├── journeys/      # User workflow tests
│   │           └── evals/         # Accessibility, visual
│   ├── api/
│   │   └── tests/
│   │       ├── unit/              # Handler tests
│   │       └── integration/       # API endpoint tests
│   └── worker/
│       └── tests/
│           ├── unit/              # Job logic tests
│           └── integration/       # Job execution tests
├── packages/
│   ├── database/
│   │   └── tests/                 # Prisma query tests
│   └── shared/
│       └── tests/                 # Utility tests
└── tests/                         # Cross-service tests
    ├── contracts/                 # API contract tests
    └── load/                      # Load tests
```

### 15.2 Unit Tests

Each package/app has its own unit tests using Vitest:

```typescript
// packages/shared/tests/auth.test.ts
import { describe, it, expect } from 'vitest'
import { verifyPassword, hashPassword } from '../src/auth'

describe('Auth utilities', () => {
  it('should hash and verify password', async () => {
    const password = 'testPassword123'
    const hash = await hashPassword(password)
    expect(await verifyPassword(password, hash)).toBe(true)
    expect(await verifyPassword('wrong', hash)).toBe(false)
  })
})
```

```typescript
// apps/api/tests/unit/certificates.test.ts
import { describe, it, expect, vi } from 'vitest'
import { getCertificates } from '../../src/routes/certificates/handlers'

describe('Certificate handlers', () => {
  it('should return certificates for user', async () => {
    const mockPrisma = {
      certificate: {
        findMany: vi.fn().mockResolvedValue([{ id: '1', status: 'DRAFT' }])
      }
    }
    
    const result = await getCertificates({ userId: 'user1' }, mockPrisma)
    expect(result).toHaveLength(1)
  })
})
```

### 15.3 Integration Tests

Test API endpoints with real database:

```typescript
// apps/api/tests/integration/certificates.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { createTestServer } from '../helpers/server'
import { prisma } from '@hta/database'

describe('Certificates API', () => {
  let server: ReturnType<typeof createTestServer>

  beforeAll(async () => {
    server = await createTestServer()
    await prisma.$connect()
  })

  afterAll(async () => {
    await server.close()
    await prisma.$disconnect()
  })

  it('GET /api/certificates returns certificates', async () => {
    const response = await server.inject({
      method: 'GET',
      url: '/api/certificates',
      headers: {
        authorization: 'Bearer test-token'
      }
    })

    expect(response.statusCode).toBe(200)
    expect(JSON.parse(response.payload)).toBeInstanceOf(Array)
  })
})
```

### 15.4 E2E Tests

E2E tests run against all services:

```typescript
// apps/web/tests/e2e/journeys/certificate-flow.spec.ts
import { test, expect } from '@playwright/test'
import { TEST_USERS } from '../fixtures/test-data'

test.describe('Certificate Creation Flow', () => {
  test.beforeEach(async ({ page }) => {
    // Login
    await page.goto('/login')
    await page.fill('[name="email"]', TEST_USERS.engineer.email)
    await page.fill('[name="password"]', TEST_USERS.engineer.password)
    await page.click('button[type="submit"]')
    await expect(page).toHaveURL(/dashboard/)
  })

  test('engineer can create certificate', async ({ page }) => {
    await page.click('text=New Certificate')
    await page.fill('[name="customerName"]', 'Test Company')
    // ... fill form
    await page.click('text=Save Draft')
    await expect(page.locator('text=Draft saved')).toBeVisible()
  })
})
```

### 15.5 Contract Tests

Ensure API/frontend contracts are maintained:

```typescript
// tests/contracts/api-contract.test.ts
import { describe, it, expect } from 'vitest'
import { z } from 'zod'

// Define expected API response schemas
const CertificateSchema = z.object({
  id: z.string(),
  certificateNumber: z.string(),
  status: z.enum(['DRAFT', 'PENDING_REVIEW', 'APPROVED']),
  customerName: z.string(),
  createdAt: z.string().datetime(),
})

describe('API Contracts', () => {
  it('GET /api/certificates matches schema', async () => {
    const response = await fetch('http://localhost:8080/api/certificates', {
      headers: { authorization: 'Bearer test-token' }
    })
    const data = await response.json()
    
    // Validate each certificate matches schema
    for (const cert of data) {
      expect(() => CertificateSchema.parse(cert)).not.toThrow()
    }
  })
})
```

### 15.6 Load Tests

```typescript
// tests/load/api-load.test.ts
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '1m', target: 10 },   // Ramp up
    { duration: '3m', target: 10 },   // Stay
    { duration: '1m', target: 50 },   // Spike
    { duration: '1m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<200'],  // 95% under 200ms
    http_req_failed: ['rate<0.01'],    // <1% errors
  },
}

export default function () {
  const res = http.get('http://api:8080/api/certificates', {
    headers: { authorization: `Bearer ${__ENV.TEST_TOKEN}` },
  })
  
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 200ms': (r) => r.timings.duration < 200,
  })
  
  sleep(1)
}
```

### 15.7 Test Commands

```json
// Root package.json scripts
{
  "scripts": {
    "test": "turbo run test",
    "test:unit": "turbo run test --filter=./packages/* --filter=./apps/*",
    "test:integration": "turbo run test:integration",
    "test:e2e": "turbo run test:e2e --filter=@hta/web",
    "test:contracts": "vitest run tests/contracts",
    "test:load": "k6 run tests/load/api-load.test.ts",
    "test:coverage": "turbo run test:coverage"
  }
}
```

### 15.8 CI Test Matrix

| Test Type | Trigger | Services Required | Duration |
|-----------|---------|-------------------|----------|
| Unit | All PRs | None | ~30s |
| Integration | API/Package changes | PostgreSQL, Redis | ~2m |
| E2E | All PRs to main | All services | ~5m |
| Load | Nightly/Manual | All services | ~10m |
| Contracts | API changes | API service | ~30s |

---

## 16. Monitoring Implementation

### 16.1 OpenTelemetry Setup

Each service exports traces, metrics, and logs to GCP:

```typescript
// packages/shared/src/telemetry/index.ts
import { NodeSDK } from '@opentelemetry/sdk-node'
import { getNodeAutoInstrumentations } from '@opentelemetry/auto-instrumentations-node'
import { TraceExporter } from '@google-cloud/opentelemetry-cloud-trace-exporter'
import { MetricExporter } from '@google-cloud/opentelemetry-cloud-monitoring-exporter'
import { Resource } from '@opentelemetry/resources'
import { SEMRESATTRS_SERVICE_NAME, SEMRESATTRS_SERVICE_VERSION } from '@opentelemetry/semantic-conventions'

export function initTelemetry(serviceName: string, serviceVersion: string) {
  const sdk = new NodeSDK({
    resource: new Resource({
      [SEMRESATTRS_SERVICE_NAME]: serviceName,
      [SEMRESATTRS_SERVICE_VERSION]: serviceVersion,
      'service.environment': process.env.NODE_ENV,
    }),
    traceExporter: new TraceExporter(),
    metricExporter: new MetricExporter(),
    instrumentations: [
      getNodeAutoInstrumentations({
        '@opentelemetry/instrumentation-http': {
          ignoreIncomingPaths: ['/health', '/ready'],
        },
        '@opentelemetry/instrumentation-fs': { enabled: false },
      }),
    ],
  })

  sdk.start()
  
  process.on('SIGTERM', () => sdk.shutdown())
  
  return sdk
}
```

### 16.2 Service Instrumentation

```typescript
// apps/api/src/index.ts
import { initTelemetry } from '@hta/shared/telemetry'

// Initialize before other imports
initTelemetry('hta-api', process.env.npm_package_version || '0.0.0')

// Continue with app setup
import { createApp } from './app'
const app = createApp()
```

```typescript
// apps/web/src/instrumentation.ts (Next.js instrumentation hook)
export async function register() {
  if (process.env.NEXT_RUNTIME === 'nodejs') {
    const { initTelemetry } = await import('@hta/shared/telemetry')
    initTelemetry('hta-web', process.env.npm_package_version || '0.0.0')
  }
}
```

### 16.3 Distributed Tracing

Trace context propagation between services:

```typescript
// packages/shared/src/http-client.ts
import { context, propagation, trace } from '@opentelemetry/api'

export async function fetchWithTracing(url: string, options: RequestInit = {}) {
  const tracer = trace.getTracer('hta-http-client')
  
  return tracer.startActiveSpan(`HTTP ${options.method || 'GET'}`, async (span) => {
    const headers: Record<string, string> = { ...(options.headers as Record<string, string>) }
    
    // Inject trace context into headers
    propagation.inject(context.active(), headers)
    
    try {
      const response = await fetch(url, { ...options, headers })
      span.setAttribute('http.status_code', response.status)
      return response
    } catch (error) {
      span.recordException(error as Error)
      throw error
    } finally {
      span.end()
    }
  })
}
```

### 16.4 Service-Specific Metrics

```typescript
// packages/shared/src/telemetry/metrics.ts
import { metrics } from '@opentelemetry/api'

const meter = metrics.getMeter('hta-app')

// API Metrics
export const apiMetrics = {
  requestDuration: meter.createHistogram('http.server.duration', {
    description: 'HTTP request duration',
    unit: 'ms',
  }),
  requestCount: meter.createCounter('http.server.requests', {
    description: 'Total HTTP requests',
  }),
  activeRequests: meter.createUpDownCounter('http.server.active_requests', {
    description: 'Active HTTP requests',
  }),
  errorCount: meter.createCounter('http.server.errors', {
    description: 'HTTP error count',
  }),
}

// Database Metrics
export const dbMetrics = {
  queryDuration: meter.createHistogram('db.query.duration', {
    description: 'Database query duration',
    unit: 'ms',
  }),
  connectionPoolSize: meter.createObservableGauge('db.pool.size', {
    description: 'Connection pool size',
  }),
  connectionPoolWaiting: meter.createObservableGauge('db.pool.waiting', {
    description: 'Connections waiting',
  }),
}

// Worker Metrics
export const workerMetrics = {
  jobsProcessed: meter.createCounter('worker.jobs.processed', {
    description: 'Jobs processed',
  }),
  jobDuration: meter.createHistogram('worker.job.duration', {
    description: 'Job processing duration',
    unit: 'ms',
  }),
  queueDepth: meter.createObservableGauge('worker.queue.depth', {
    description: 'Jobs in queue',
  }),
}
```

### 16.5 Structured Logging

```typescript
// packages/shared/src/logger.ts
import pino from 'pino'

const isProduction = process.env.NODE_ENV === 'production'

export function createLogger(name: string) {
  return pino({
    name,
    level: process.env.LOG_LEVEL || 'info',
    ...(isProduction
      ? {
          // GCP Cloud Logging format
          messageKey: 'message',
          formatters: {
            level: (label) => ({ severity: label.toUpperCase() }),
          },
        }
      : {
          transport: { target: 'pino-pretty' },
        }),
    // Include trace context in logs
    mixin() {
      const span = trace.getActiveSpan()
      if (span) {
        const { traceId, spanId } = span.spanContext()
        return {
          'logging.googleapis.com/trace': `projects/${process.env.GCP_PROJECT_ID}/traces/${traceId}`,
          'logging.googleapis.com/spanId': spanId,
        }
      }
      return {}
    },
  })
}
```

### 16.6 Health Check Endpoints

```typescript
// packages/shared/src/health.ts
import { prisma } from '@hta/database'
import { cache } from '@hta/shared/cache'

interface HealthStatus {
  status: 'healthy' | 'degraded' | 'unhealthy'
  version: string
  checks: Record<string, { status: string; latency?: number; error?: string }>
}

export async function checkHealth(serviceName: string): Promise<HealthStatus> {
  const checks: HealthStatus['checks'] = {}
  let overallStatus: HealthStatus['status'] = 'healthy'

  // Database check
  const dbStart = Date.now()
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = { status: 'ok', latency: Date.now() - dbStart }
  } catch (error) {
    checks.database = { status: 'error', error: String(error) }
    overallStatus = 'unhealthy'
  }

  // Cache check (if applicable)
  if (cache) {
    const cacheStart = Date.now()
    try {
      await cache.set('health:check', '1', 10)
      await cache.get('health:check')
      checks.cache = { status: 'ok', latency: Date.now() - cacheStart }
    } catch (error) {
      checks.cache = { status: 'error', error: String(error) }
      overallStatus = overallStatus === 'healthy' ? 'degraded' : overallStatus
    }
  }

  return {
    status: overallStatus,
    version: process.env.npm_package_version || 'unknown',
    checks,
  }
}

// Express/Fastify route handler
export async function healthHandler(req: Request, res: Response) {
  const health = await checkHealth(process.env.SERVICE_NAME || 'unknown')
  const statusCode = health.status === 'unhealthy' ? 503 : 200
  res.status(statusCode).json(health)
}
```

### 16.7 Monitoring Dashboards (Terraform)

```hcl
# terraform/modules/monitoring/dashboards.tf

resource "google_monitoring_dashboard" "services_overview" {
  dashboard_json = jsonencode({
    displayName = "HTA Services Overview"
    gridLayout = {
      columns = 3
      widgets = [
        # Request Rate per Service
        {
          title = "Request Rate by Service"
          xyChart = {
            dataSets = [for service in ["web", "api", "worker"] : {
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_count\" AND resource.labels.service_name=\"hta-${service}\""
                  aggregation = {
                    alignmentPeriod = "60s"
                    perSeriesAligner = "ALIGN_RATE"
                  }
                }
              }
              plotType = "LINE"
            }]
          }
        },
        # Latency by Service
        {
          title = "P95 Latency by Service"
          xyChart = {
            dataSets = [for service in ["web", "api"] : {
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_latencies\" AND resource.labels.service_name=\"hta-${service}\""
                  aggregation = {
                    alignmentPeriod = "60s"
                    perSeriesAligner = "ALIGN_PERCENTILE_95"
                  }
                }
              }
              plotType = "LINE"
            }]
          }
        },
        # Error Rate
        {
          title = "Error Rate (%)"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilterRatio = {
                  numerator = {
                    filter = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.labels.response_code_class!=\"2xx\""
                  }
                  denominator = {
                    filter = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_count\""
                  }
                }
              }
              plotType = "LINE"
            }]
          }
        },
        # Instance Count
        {
          title = "Active Instances"
          xyChart = {
            dataSets = [for service in ["web", "api", "worker"] : {
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/container/instance_count\" AND resource.labels.service_name=\"hta-${service}\""
                }
              }
              plotType = "STACKED_AREA"
            }]
          }
        },
        # Database Connections
        {
          title = "Database Connections"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/postgresql/num_backends\""
                }
              }
              plotType = "LINE"
            }]
          }
        },
        # Worker Queue Depth
        {
          title = "Worker Queue Depth"
          xyChart = {
            dataSets = [{
              timeSeriesQuery = {
                timeSeriesFilter = {
                  filter = "metric.type=\"custom.googleapis.com/worker/queue/depth\""
                }
              }
              plotType = "LINE"
            }]
          }
        }
      ]
    }
  })
}
```

### 16.8 Alerting Policies

```hcl
# terraform/modules/monitoring/alerts.tf

# High Error Rate Alert (per service)
resource "google_monitoring_alert_policy" "high_error_rate" {
  for_each = toset(["web", "api", "worker"])
  
  display_name = "High Error Rate - hta-${each.key}"
  combiner     = "OR"
  
  conditions {
    display_name = "Error rate > 5%"
    condition_threshold {
      filter     = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_count\" AND metric.labels.response_code_class!=\"2xx\" AND resource.labels.service_name=\"hta-${each.key}\""
      comparison = "COMPARISON_GT"
      threshold_value = 0.05
      duration   = "300s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_RATE"
      }
    }
  }

  notification_channels = var.notification_channels
  
  alert_strategy {
    auto_close = "1800s"
  }
}

# High Latency Alert
resource "google_monitoring_alert_policy" "high_latency" {
  display_name = "High API Latency"
  combiner     = "OR"
  
  conditions {
    display_name = "P95 latency > 500ms"
    condition_threshold {
      filter     = "resource.type=\"cloud_run_revision\" AND metric.type=\"run.googleapis.com/request_latencies\" AND resource.labels.service_name=\"hta-api\""
      comparison = "COMPARISON_GT"
      threshold_value = 500
      duration   = "300s"
      aggregations {
        alignment_period   = "60s"
        per_series_aligner = "ALIGN_PERCENTILE_95"
      }
    }
  }

  notification_channels = var.notification_channels
}

# Database Connection Pool Exhaustion
resource "google_monitoring_alert_policy" "db_connection_pool" {
  display_name = "Database Connection Pool Warning"
  combiner     = "OR"
  
  conditions {
    display_name = "Connections > 80% of max"
    condition_threshold {
      filter     = "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/postgresql/num_backends\""
      comparison = "COMPARISON_GT"
      threshold_value = 80  # 80% of 100 max connections
      duration   = "120s"
    }
  }

  notification_channels = var.notification_channels
}

# Worker Queue Backlog
resource "google_monitoring_alert_policy" "worker_backlog" {
  display_name = "Worker Queue Backlog"
  combiner     = "OR"
  
  conditions {
    display_name = "Queue depth > 100"
    condition_threshold {
      filter     = "metric.type=\"custom.googleapis.com/worker/queue/depth\""
      comparison = "COMPARISON_GT"
      threshold_value = 100
      duration   = "600s"
    }
  }

  notification_channels = var.notification_channels
}
```

---

## 17. Secrets Infrastructure

### 17.1 Secret Manager Organization

```
projects/hta-calibration-prod/secrets/
├── common/                    # Shared across services
│   ├── database-url           # Prisma Accelerate URL
│   ├── database-direct-url    # Direct PostgreSQL URL (migrations)
│   ├── redis-url              # Redis connection string
│   └── sentry-dsn             # Error tracking
├── web/                       # Frontend-specific
│   ├── nextauth-secret        # Session signing
│   ├── nextauth-url           # Public URL
│   └── api-internal-url       # Internal API URL
├── api/                       # API-specific
│   ├── jwt-secret             # JWT signing key
│   ├── encryption-key         # Data encryption key
│   └── webhook-signing-key    # Webhook verification
└── worker/                    # Worker-specific
    ├── sendgrid-api-key       # Email service
    └── queue-signing-key      # Job queue verification
```

### 17.2 Terraform Secret Resources

```hcl
# terraform/modules/secrets/main.tf

locals {
  common_secrets = {
    "database-url"        = { description = "Prisma Accelerate connection URL" }
    "database-direct-url" = { description = "Direct PostgreSQL URL for migrations" }
    "redis-url"           = { description = "Redis connection string" }
    "sentry-dsn"          = { description = "Sentry error tracking DSN" }
  }
  
  web_secrets = {
    "nextauth-secret" = { description = "NextAuth.js session signing secret" }
    "api-internal-url" = { description = "Internal API service URL" }
  }
  
  api_secrets = {
    "jwt-secret"          = { description = "JWT signing secret" }
    "encryption-key"      = { description = "Data encryption key (AES-256)" }
    "webhook-signing-key" = { description = "Webhook signature verification" }
  }
  
  worker_secrets = {
    "sendgrid-api-key"   = { description = "SendGrid API key for emails" }
    "queue-signing-key"  = { description = "Job queue message signing" }
  }
}

# Create secrets with automatic replication
resource "google_secret_manager_secret" "common" {
  for_each  = local.common_secrets
  secret_id = "hta-common-${each.key}"
  
  labels = {
    service = "common"
    env     = var.environment
  }
  
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "web" {
  for_each  = local.web_secrets
  secret_id = "hta-web-${each.key}"
  
  labels = {
    service = "web"
    env     = var.environment
  }
  
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "api" {
  for_each  = local.api_secrets
  secret_id = "hta-api-${each.key}"
  
  labels = {
    service = "api"
    env     = var.environment
  }
  
  replication {
    auto {}
  }
}

resource "google_secret_manager_secret" "worker" {
  for_each  = local.worker_secrets
  secret_id = "hta-worker-${each.key}"
  
  labels = {
    service = "worker"
    env     = var.environment
  }
  
  replication {
    auto {}
  }
}
```

### 17.3 Per-Service IAM Bindings

```hcl
# terraform/modules/secrets/iam.tf

# Service accounts for each service
resource "google_service_account" "services" {
  for_each     = toset(["web", "api", "worker"])
  account_id   = "hta-${each.key}-${var.environment}"
  display_name = "HTA ${title(each.key)} Service Account"
}

# Common secrets access - all services
resource "google_secret_manager_secret_iam_member" "common_access" {
  for_each  = google_secret_manager_secret.common
  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.services["web"].email}"
}

resource "google_secret_manager_secret_iam_member" "common_access_api" {
  for_each  = google_secret_manager_secret.common
  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.services["api"].email}"
}

resource "google_secret_manager_secret_iam_member" "common_access_worker" {
  for_each  = google_secret_manager_secret.common
  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.services["worker"].email}"
}

# Service-specific secrets - only that service
resource "google_secret_manager_secret_iam_member" "web_access" {
  for_each  = google_secret_manager_secret.web
  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.services["web"].email}"
}

resource "google_secret_manager_secret_iam_member" "api_access" {
  for_each  = google_secret_manager_secret.api
  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.services["api"].email}"
}

resource "google_secret_manager_secret_iam_member" "worker_access" {
  for_each  = google_secret_manager_secret.worker
  secret_id = each.value.id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${google_service_account.services["worker"].email}"
}
```

### 17.4 Cloud Run Secret Mounting

```hcl
# terraform/modules/services/main.tf

resource "google_cloud_run_v2_service" "api" {
  name     = "hta-api-${var.environment}"
  location = var.region

  template {
    service_account = google_service_account.services["api"].email
    
    containers {
      image = var.api_image
      
      # Common secrets
      env {
        name = "DATABASE_URL"
        value_source {
          secret_key_ref {
            secret  = "hta-common-database-url"
            version = "latest"
          }
        }
      }
      
      env {
        name = "REDIS_URL"
        value_source {
          secret_key_ref {
            secret  = "hta-common-redis-url"
            version = "latest"
          }
        }
      }
      
      # API-specific secrets
      env {
        name = "JWT_SECRET"
        value_source {
          secret_key_ref {
            secret  = "hta-api-jwt-secret"
            version = "latest"
          }
        }
      }
      
      env {
        name = "ENCRYPTION_KEY"
        value_source {
          secret_key_ref {
            secret  = "hta-api-encryption-key"
            version = "latest"
          }
        }
      }
    }
  }
}
```

### 17.5 Secret Rotation

```typescript
// packages/shared/src/secrets/rotation.ts
import { SecretManagerServiceClient } from '@google-cloud/secret-manager'

const client = new SecretManagerServiceClient()

export async function rotateSecret(
  projectId: string,
  secretId: string,
  generateNewValue: () => Promise<string>
): Promise<void> {
  const secretName = `projects/${projectId}/secrets/${secretId}`
  
  // Generate new secret value
  const newValue = await generateNewValue()
  
  // Add new version
  await client.addSecretVersion({
    parent: secretName,
    payload: {
      data: Buffer.from(newValue, 'utf8'),
    },
  })
  
  // Get all versions
  const [versions] = await client.listSecretVersions({ parent: secretName })
  
  // Disable old versions (keep last 2)
  const enabledVersions = versions
    .filter((v) => v.state === 'ENABLED')
    .sort((a, b) => {
      const aTime = Number(a.createTime?.seconds) || 0
      const bTime = Number(b.createTime?.seconds) || 0
      return bTime - aTime
    })
  
  for (const version of enabledVersions.slice(2)) {
    await client.disableSecretVersion({ name: version.name })
  }
}

// Example: Rotate JWT secret monthly
export async function rotateJwtSecret(projectId: string) {
  await rotateSecret(projectId, 'hta-api-jwt-secret', async () => {
    const crypto = await import('crypto')
    return crypto.randomBytes(64).toString('base64')
  })
}
```

### 17.6 Local Development Secrets

```bash
# scripts/setup-local-secrets.sh
#!/bin/bash

# Create .env.local from Secret Manager (for local dev)
gcloud secrets versions access latest --secret="hta-common-database-url" > /dev/null 2>&1
if [ $? -eq 0 ]; then
  echo "# Auto-generated from Secret Manager" > .env.local
  
  echo "DATABASE_URL=$(gcloud secrets versions access latest --secret='hta-common-database-url')" >> .env.local
  echo "REDIS_URL=$(gcloud secrets versions access latest --secret='hta-common-redis-url')" >> .env.local
  echo "NEXTAUTH_SECRET=$(gcloud secrets versions access latest --secret='hta-web-nextauth-secret')" >> .env.local
  
  echo "✅ .env.local created from Secret Manager"
else
  echo "⚠️  Not authenticated to GCP, using default local values"
  cp .env.example .env.local
fi
```

---

## 18. Performance Management

### 18.1 Performance Baselines

Establish baselines before and after separation:

| Metric | Current (Monolith) | Target (Separated) | Critical Threshold |
|--------|-------------------|-------------------|-------------------|
| API p50 latency | 80ms | 70ms | 150ms |
| API p95 latency | 150ms | 120ms | 300ms |
| API p99 latency | 300ms | 200ms | 500ms |
| Frontend TTFB | 200ms | 150ms | 400ms |
| Frontend LCP | 2.0s | 1.8s | 2.5s |
| Frontend FID | 50ms | 40ms | 100ms |
| Database query p95 | 50ms | 40ms | 100ms |
| Worker job p95 | 2s | 1.5s | 5s |
| Error rate | 0.1% | 0.1% | 1% |

### 18.2 Load Testing Configuration

```typescript
// tests/load/scenarios/api-baseline.ts
import http from 'k6/http'
import { check, group, sleep } from 'k6'
import { Trend, Rate } from 'k6/metrics'

// Custom metrics
const certificateListDuration = new Trend('certificate_list_duration')
const certificateCreateDuration = new Trend('certificate_create_duration')
const errorRate = new Rate('errors')

export const options = {
  scenarios: {
    // Normal load
    normal_load: {
      executor: 'constant-arrival-rate',
      rate: 50,           // 50 requests per second
      duration: '5m',
      preAllocatedVUs: 20,
      maxVUs: 50,
    },
    // Spike test
    spike_test: {
      executor: 'ramping-arrival-rate',
      startRate: 50,
      timeUnit: '1s',
      stages: [
        { duration: '2m', target: 50 },   // Normal
        { duration: '30s', target: 200 }, // Spike
        { duration: '2m', target: 200 },  // Sustained spike
        { duration: '30s', target: 50 },  // Recovery
        { duration: '2m', target: 50 },   // Normal
      ],
      preAllocatedVUs: 100,
      maxVUs: 300,
    },
    // Soak test (run separately)
    soak_test: {
      executor: 'constant-arrival-rate',
      rate: 30,
      duration: '1h',
      preAllocatedVUs: 15,
      maxVUs: 30,
    },
  },
  thresholds: {
    http_req_duration: ['p(95)<200', 'p(99)<500'],
    http_req_failed: ['rate<0.01'],
    certificate_list_duration: ['p(95)<150'],
    certificate_create_duration: ['p(95)<300'],
    errors: ['rate<0.01'],
  },
}

export default function () {
  const BASE_URL = __ENV.API_URL || 'http://localhost:8080'
  const TOKEN = __ENV.AUTH_TOKEN
  
  const headers = {
    'Authorization': `Bearer ${TOKEN}`,
    'Content-Type': 'application/json',
  }

  group('Certificate API', () => {
    // List certificates
    group('GET /api/certificates', () => {
      const start = Date.now()
      const res = http.get(`${BASE_URL}/api/certificates`, { headers })
      certificateListDuration.add(Date.now() - start)
      
      const success = check(res, {
        'status is 200': (r) => r.status === 200,
        'response time < 200ms': (r) => r.timings.duration < 200,
        'returns array': (r) => Array.isArray(JSON.parse(r.body)),
      })
      
      if (!success) errorRate.add(1)
    })

    sleep(1)

    // Create certificate (10% of requests)
    if (Math.random() < 0.1) {
      group('POST /api/certificates', () => {
        const payload = JSON.stringify({
          customerName: `Load Test Customer ${Date.now()}`,
          equipmentType: 'PRESSURE_GAUGE',
          serialNumber: `LT-${Date.now()}`,
        })
        
        const start = Date.now()
        const res = http.post(`${BASE_URL}/api/certificates`, payload, { headers })
        certificateCreateDuration.add(Date.now() - start)
        
        const success = check(res, {
          'status is 201': (r) => r.status === 201,
          'response time < 500ms': (r) => r.timings.duration < 500,
        })
        
        if (!success) errorRate.add(1)
      })
    }
  })

  sleep(Math.random() * 2 + 1) // Random 1-3s between iterations
}
```

### 18.3 Performance Testing Workflow

```yaml
# .github/workflows/performance.yml
name: Performance Tests

on:
  schedule:
    - cron: '0 2 * * *'  # Nightly at 2 AM
  workflow_dispatch:
    inputs:
      scenario:
        description: 'Test scenario'
        required: true
        default: 'normal_load'
        type: choice
        options:
          - normal_load
          - spike_test
          - soak_test

env:
  API_URL: https://api-staging.htacalibration.com

jobs:
  load-test:
    name: Load Test - ${{ github.event.inputs.scenario || 'normal_load' }}
    runs-on: ubuntu-latest
    
    steps:
      - uses: actions/checkout@v4
      
      - name: Setup k6
        run: |
          sudo gpg -k
          sudo gpg --no-default-keyring --keyring /usr/share/keyrings/k6-archive-keyring.gpg --keyserver hkp://keyserver.ubuntu.com:80 --recv-keys C5AD17C747E3415A3642D57D77C6C491D6AC1D69
          echo "deb [signed-by=/usr/share/keyrings/k6-archive-keyring.gpg] https://dl.k6.io/deb stable main" | sudo tee /etc/apt/sources.list.d/k6.list
          sudo apt-get update
          sudo apt-get install k6

      - name: Get auth token
        id: auth
        run: |
          TOKEN=$(curl -s -X POST ${{ env.API_URL }}/api/auth/token \
            -H "Content-Type: application/json" \
            -d '{"email":"loadtest@example.com","password":"${{ secrets.LOADTEST_PASSWORD }}"}' \
            | jq -r '.token')
          echo "token=$TOKEN" >> $GITHUB_OUTPUT

      - name: Run load test
        run: |
          k6 run tests/load/scenarios/api-baseline.ts \
            --out json=results.json \
            --scenario ${{ github.event.inputs.scenario || 'normal_load' }}
        env:
          API_URL: ${{ env.API_URL }}
          AUTH_TOKEN: ${{ steps.auth.outputs.token }}

      - name: Process results
        run: |
          # Check if thresholds passed
          PASSED=$(jq '.metrics.http_req_duration.thresholds | all' results.json)
          echo "Thresholds passed: $PASSED"
          
          # Summary
          echo "## Load Test Results" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "| Metric | p50 | p95 | p99 |" >> $GITHUB_STEP_SUMMARY
          echo "|--------|-----|-----|-----|" >> $GITHUB_STEP_SUMMARY
          
          P50=$(jq '.metrics.http_req_duration.values["p(50)"]' results.json)
          P95=$(jq '.metrics.http_req_duration.values["p(95)"]' results.json)
          P99=$(jq '.metrics.http_req_duration.values["p(99)"]' results.json)
          
          echo "| Latency | ${P50}ms | ${P95}ms | ${P99}ms |" >> $GITHUB_STEP_SUMMARY

      - name: Upload results
        uses: actions/upload-artifact@v4
        with:
          name: load-test-results
          path: results.json
          retention-days: 30

      - name: Alert on regression
        if: failure()
        run: |
          curl -X POST "${{ secrets.SLACK_WEBHOOK }}" \
            -H "Content-Type: application/json" \
            -d '{"text":"⚠️ Load test failed - performance regression detected"}'
```

### 18.4 Caching Strategy

```typescript
// packages/shared/src/cache/strategy.ts

export const CacheStrategies = {
  // Frequently accessed, rarely changing data
  STATIC_REFERENCE: {
    ttl: 3600,        // 1 hour
    swr: 86400,       // Serve stale for 24h while revalidating
    tags: ['static'],
  },
  
  // User-specific data that changes moderately
  USER_DATA: {
    ttl: 300,         // 5 minutes
    swr: 600,         // Serve stale for 10m
    // Tags set dynamically: [`user:${userId}`]
  },
  
  // Frequently changing data
  DYNAMIC: {
    ttl: 60,          // 1 minute
    swr: 120,
  },
  
  // Real-time data (no cache)
  NONE: {
    ttl: 0,
    swr: 0,
  },
}

// Prisma Accelerate cache usage
export async function getCertificatesWithCache(userId: string) {
  return prisma.certificate.findMany({
    where: { userId },
    cacheStrategy: {
      ...CacheStrategies.USER_DATA,
      tags: [`user:${userId}`, 'certificates'],
    },
  })
}

// Invalidate on mutation
export async function createCertificate(data: CertificateInput, userId: string) {
  const certificate = await prisma.certificate.create({ data })
  
  // Invalidate user's certificate cache
  await prisma.$accelerate.invalidate({
    tags: [`user:${userId}`, 'certificates'],
  })
  
  return certificate
}
```

### 18.5 Database Query Optimization

```typescript
// packages/database/src/optimizations.ts

// Batch loading to avoid N+1
export async function getCertificatesWithRelations(certificateIds: string[]) {
  // Single query with includes instead of N+1
  return prisma.certificate.findMany({
    where: { id: { in: certificateIds } },
    include: {
      customer: { select: { id: true, name: true, email: true } },
      engineer: { select: { id: true, name: true } },
      readings: {
        orderBy: { createdAt: 'desc' },
        take: 10,
      },
    },
  })
}

// Cursor-based pagination for large datasets
export async function getCertificatesPaginated(
  cursor?: string,
  limit: number = 20
) {
  return prisma.certificate.findMany({
    take: limit + 1, // Fetch one extra to check if there's more
    ...(cursor && {
      cursor: { id: cursor },
      skip: 1,
    }),
    orderBy: { createdAt: 'desc' },
    select: {
      id: true,
      certificateNumber: true,
      status: true,
      customerName: true,
      createdAt: true,
    },
  })
}

// Materialized view for dashboard stats
export async function getDashboardStats() {
  // Uses database-level caching via Prisma Accelerate
  return prisma.$queryRaw`
    SELECT
      COUNT(*) FILTER (WHERE status = 'DRAFT') as draft_count,
      COUNT(*) FILTER (WHERE status = 'PENDING_REVIEW') as pending_count,
      COUNT(*) FILTER (WHERE status = 'APPROVED') as approved_count,
      COUNT(*) FILTER (WHERE created_at > NOW() - INTERVAL '7 days') as weekly_count
    FROM certificates
  `
}
```

### 18.6 Frontend Performance

```typescript
// apps/web/next.config.ts - Performance optimizations

const nextConfig = {
  // Enable SWC minification
  swcMinify: true,
  
  // Optimize images
  images: {
    formats: ['image/avif', 'image/webp'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96],
  },
  
  // Optimize fonts
  optimizeFonts: true,
  
  // Enable React strict mode
  reactStrictMode: true,
  
  // Bundle analyzer (dev only)
  ...(process.env.ANALYZE && {
    webpack: (config) => {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer')
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          reportFilename: '../bundle-report.html',
        })
      )
      return config
    },
  }),
  
  // Modular imports for large libraries
  modularizeImports: {
    'lucide-react': {
      transform: 'lucide-react/dist/esm/icons/{{ kebabCase member }}',
    },
  },
}
```

---

## 19. Compliance Management

### 19.1 GDPR Data Flow Across Services

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│    Web      │     │    API      │     │   Worker    │
│  (Frontend) │────▶│  (Backend)  │────▶│  (Jobs)     │
└─────────────┘     └─────────────┘     └─────────────┘
       │                   │                   │
       │                   ▼                   │
       │            ┌─────────────┐            │
       │            │  Database   │◀───────────┘
       │            │ (PostgreSQL)│
       │            └─────────────┘
       │                   │
       ▼                   ▼
┌─────────────────────────────────────────────────────┐
│                   Audit Log                         │
│  (All PII access logged with user context)          │
└─────────────────────────────────────────────────────┘
```

### 19.2 Data Processing Inventory

```typescript
// packages/shared/src/compliance/data-inventory.ts

export const DataProcessingInventory = {
  'customer-registration': {
    purpose: 'Account creation and service delivery',
    legalBasis: 'Contract performance',
    dataCategories: ['email', 'name', 'company', 'phone'],
    retention: '7 years after last activity',
    thirdParties: ['SendGrid (email delivery)'],
    services: ['web', 'api'],
  },
  'certificate-processing': {
    purpose: 'Calibration certificate management',
    legalBasis: 'Contract performance',
    dataCategories: ['equipment details', 'readings', 'signatures'],
    retention: '10 years (regulatory requirement)',
    thirdParties: [],
    services: ['api', 'worker'],
  },
  'analytics': {
    purpose: 'Service improvement',
    legalBasis: 'Legitimate interest',
    dataCategories: ['usage patterns', 'aggregated statistics'],
    retention: '2 years',
    thirdParties: ['Google Analytics (anonymized)'],
    services: ['web'],
  },
  'email-notifications': {
    purpose: 'Service communications',
    legalBasis: 'Contract performance / Consent',
    dataCategories: ['email', 'name', 'notification preferences'],
    retention: 'Until unsubscribe + 30 days',
    thirdParties: ['SendGrid'],
    services: ['worker'],
  },
}
```

### 19.3 Cross-Service Audit Logging

```typescript
// packages/shared/src/compliance/audit-logger.ts
import { prisma } from '@hta/database'
import { createLogger } from '../logger'

const logger = createLogger('audit')

export interface AuditEvent {
  action: string
  resourceType: string
  resourceId: string
  userId?: string
  userEmail?: string
  userRole?: string
  service: 'web' | 'api' | 'worker'
  ipAddress?: string
  userAgent?: string
  details?: Record<string, unknown>
  piiAccessed?: string[]
  piiModified?: string[]
}

export async function logAuditEvent(event: AuditEvent): Promise<void> {
  // Log to structured logging (Cloud Logging)
  logger.info({
    audit: true,
    ...event,
    timestamp: new Date().toISOString(),
  })

  // Log to database for compliance queries
  await prisma.auditLog.create({
    data: {
      action: event.action,
      resourceType: event.resourceType,
      resourceId: event.resourceId,
      userId: event.userId,
      userEmail: event.userEmail,
      userRole: event.userRole,
      service: event.service,
      ipAddress: event.ipAddress,
      userAgent: event.userAgent,
      details: event.details ? JSON.stringify(event.details) : null,
      piiAccessed: event.piiAccessed || [],
      piiModified: event.piiModified || [],
      createdAt: new Date(),
    },
  })
}

// Middleware for automatic audit logging
export function withAuditLogging(
  handler: (req: Request) => Promise<Response>,
  config: {
    action: string
    resourceType: string
    getResourceId: (req: Request, res: Response) => string
    piiFields?: string[]
  }
) {
  return async (req: Request): Promise<Response> => {
    const startTime = Date.now()
    const response = await handler(req)
    
    await logAuditEvent({
      action: config.action,
      resourceType: config.resourceType,
      resourceId: config.getResourceId(req, response),
      userId: (req as any).user?.id,
      userEmail: (req as any).user?.email,
      userRole: (req as any).user?.role,
      service: 'api',
      ipAddress: req.headers.get('x-forwarded-for') || 'unknown',
      userAgent: req.headers.get('user-agent') || 'unknown',
      details: {
        method: req.method,
        path: new URL(req.url).pathname,
        duration: Date.now() - startTime,
        status: response.status,
      },
      piiAccessed: config.piiFields,
    })
    
    return response
  }
}
```

### 19.4 Data Subject Rights Implementation

```typescript
// packages/shared/src/compliance/dsr.ts
import { prisma } from '@hta/database'
import { logAuditEvent } from './audit-logger'
import { createLogger } from '../logger'

const logger = createLogger('dsr')

export interface DataExportResult {
  user: {
    id: string
    email: string
    name: string
    createdAt: Date
  }
  certificates: any[]
  auditLogs: any[]
  consents: any[]
  exportedAt: Date
  format: 'json'
}

// Right to Access (Data Export)
export async function exportUserData(
  userId: string,
  requestedBy: string
): Promise<DataExportResult> {
  logger.info({ userId, requestedBy }, 'Starting data export')
  
  const [user, certificates, auditLogs, consents] = await Promise.all([
    prisma.customerUser.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        company: true,
        phone: true,
        createdAt: true,
        updatedAt: true,
      },
    }),
    prisma.certificate.findMany({
      where: { customerId: userId },
      include: {
        readings: true,
        events: true,
      },
    }),
    prisma.auditLog.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      take: 1000,
    }),
    prisma.consent.findMany({
      where: { userId },
    }),
  ])

  await logAuditEvent({
    action: 'DATA_EXPORT',
    resourceType: 'USER',
    resourceId: userId,
    userId: requestedBy,
    service: 'api',
    piiAccessed: ['email', 'name', 'company', 'phone', 'certificates', 'audit_logs'],
  })

  return {
    user: user!,
    certificates,
    auditLogs,
    consents,
    exportedAt: new Date(),
    format: 'json',
  }
}

// Right to Erasure (Account Deletion)
export async function deleteUserData(
  userId: string,
  requestedBy: string,
  options: { immediate?: boolean } = {}
): Promise<{ success: boolean; retainedData?: string[] }> {
  logger.info({ userId, requestedBy, options }, 'Starting data deletion')
  
  // Check for regulatory holds
  const hasRegulatoryHold = await prisma.certificate.count({
    where: {
      customerId: userId,
      status: 'APPROVED',
      createdAt: {
        gte: new Date(Date.now() - 10 * 365 * 24 * 60 * 60 * 1000), // 10 years
      },
    },
  })

  if (hasRegulatoryHold > 0 && !options.immediate) {
    // Pseudonymize instead of delete for regulatory compliance
    await prisma.customerUser.update({
      where: { id: userId },
      data: {
        email: `deleted-${userId}@anonymized.local`,
        name: 'Deleted User',
        company: null,
        phone: null,
        passwordHash: '', // Prevent login
        deletedAt: new Date(),
      },
    })

    await logAuditEvent({
      action: 'DATA_PSEUDONYMIZE',
      resourceType: 'USER',
      resourceId: userId,
      userId: requestedBy,
      service: 'api',
      piiModified: ['email', 'name', 'company', 'phone'],
      details: { reason: 'Regulatory retention requirement' },
    })

    return {
      success: true,
      retainedData: ['Certificates (regulatory requirement - 10 years)'],
    }
  }

  // Full deletion
  await prisma.$transaction([
    prisma.consent.deleteMany({ where: { userId } }),
    prisma.session.deleteMany({ where: { userId } }),
    prisma.auditLog.deleteMany({ where: { userId } }),
    prisma.certificate.deleteMany({ where: { customerId: userId } }),
    prisma.customerUser.delete({ where: { id: userId } }),
  ])

  await logAuditEvent({
    action: 'DATA_DELETE',
    resourceType: 'USER',
    resourceId: userId,
    userId: requestedBy,
    service: 'api',
    piiModified: ['ALL'],
  })

  return { success: true }
}

// Right to Rectification
export async function updateUserData(
  userId: string,
  updates: Partial<{ email: string; name: string; company: string; phone: string }>,
  requestedBy: string
): Promise<void> {
  const oldData = await prisma.customerUser.findUnique({
    where: { id: userId },
    select: { email: true, name: true, company: true, phone: true },
  })

  await prisma.customerUser.update({
    where: { id: userId },
    data: updates,
  })

  await logAuditEvent({
    action: 'DATA_RECTIFY',
    resourceType: 'USER',
    resourceId: userId,
    userId: requestedBy,
    service: 'api',
    piiModified: Object.keys(updates),
    details: {
      changes: Object.entries(updates).map(([field]) => ({
        field,
        oldValue: '[REDACTED]',
        newValue: '[REDACTED]',
      })),
    },
  })
}
```

### 19.5 Consent Management

```typescript
// packages/shared/src/compliance/consent.ts
import { prisma } from '@hta/database'

export type ConsentType = 
  | 'marketing_email'
  | 'analytics'
  | 'third_party_sharing'
  | 'data_processing'

export interface ConsentRecord {
  userId: string
  type: ConsentType
  granted: boolean
  grantedAt?: Date
  revokedAt?: Date
  version: string
  ipAddress?: string
}

export async function recordConsent(consent: ConsentRecord): Promise<void> {
  await prisma.consent.upsert({
    where: {
      userId_type: {
        userId: consent.userId,
        type: consent.type,
      },
    },
    update: {
      granted: consent.granted,
      ...(consent.granted
        ? { grantedAt: new Date(), revokedAt: null }
        : { revokedAt: new Date() }),
      version: consent.version,
      ipAddress: consent.ipAddress,
    },
    create: {
      userId: consent.userId,
      type: consent.type,
      granted: consent.granted,
      grantedAt: consent.granted ? new Date() : null,
      version: consent.version,
      ipAddress: consent.ipAddress,
    },
  })
}

export async function checkConsent(
  userId: string,
  type: ConsentType
): Promise<boolean> {
  const consent = await prisma.consent.findUnique({
    where: {
      userId_type: {
        userId,
        type,
      },
    },
  })
  
  return consent?.granted ?? false
}

export async function getUserConsents(userId: string): Promise<ConsentRecord[]> {
  return prisma.consent.findMany({
    where: { userId },
  })
}
```

### 19.6 Compliance Testing

```typescript
// tests/compliance/gdpr.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest'
import { prisma } from '@hta/database'
import { exportUserData, deleteUserData } from '@hta/shared/compliance/dsr'
import { recordConsent, checkConsent } from '@hta/shared/compliance/consent'

describe('GDPR Compliance', () => {
  let testUserId: string

  beforeAll(async () => {
    // Create test user
    const user = await prisma.customerUser.create({
      data: {
        email: 'gdpr-test@example.com',
        name: 'GDPR Test User',
        passwordHash: 'test',
      },
    })
    testUserId = user.id
  })

  afterAll(async () => {
    await prisma.customerUser.deleteMany({
      where: { email: { contains: 'gdpr-test' } },
    })
  })

  describe('Right to Access', () => {
    it('should export all user data', async () => {
      const data = await exportUserData(testUserId, 'admin')
      
      expect(data.user).toBeDefined()
      expect(data.user.email).toBe('gdpr-test@example.com')
      expect(data.certificates).toBeInstanceOf(Array)
      expect(data.auditLogs).toBeInstanceOf(Array)
      expect(data.exportedAt).toBeInstanceOf(Date)
    })

    it('should create audit log for data export', async () => {
      await exportUserData(testUserId, 'admin')
      
      const auditLog = await prisma.auditLog.findFirst({
        where: {
          resourceId: testUserId,
          action: 'DATA_EXPORT',
        },
        orderBy: { createdAt: 'desc' },
      })
      
      expect(auditLog).toBeDefined()
      expect(auditLog?.piiAccessed).toContain('email')
    })
  })

  describe('Right to Erasure', () => {
    it('should pseudonymize user with regulatory hold', async () => {
      // Create approved certificate (regulatory hold)
      await prisma.certificate.create({
        data: {
          customerId: testUserId,
          status: 'APPROVED',
          certificateNumber: 'TEST-001',
        },
      })

      const result = await deleteUserData(testUserId, 'admin')
      
      expect(result.success).toBe(true)
      expect(result.retainedData).toContain('Certificates (regulatory requirement - 10 years)')
      
      const user = await prisma.customerUser.findUnique({
        where: { id: testUserId },
      })
      
      expect(user?.email).toContain('anonymized')
      expect(user?.name).toBe('Deleted User')
    })
  })

  describe('Consent Management', () => {
    it('should record and verify consent', async () => {
      await recordConsent({
        userId: testUserId,
        type: 'marketing_email',
        granted: true,
        version: '1.0',
      })

      const hasConsent = await checkConsent(testUserId, 'marketing_email')
      expect(hasConsent).toBe(true)
    })

    it('should respect revoked consent', async () => {
      await recordConsent({
        userId: testUserId,
        type: 'analytics',
        granted: false,
        version: '1.0',
      })

      const hasConsent = await checkConsent(testUserId, 'analytics')
      expect(hasConsent).toBe(false)
    })
  })
})
```

### 19.7 Compliance Checklist

| Requirement | Implementation | Service | Status |
|-------------|----------------|---------|--------|
| **Lawful Basis** | Consent + Contract documented | All | ✅ |
| **Data Inventory** | `data-inventory.ts` | All | ✅ |
| **Right to Access** | `exportUserData()` | API | ✅ |
| **Right to Erasure** | `deleteUserData()` | API | ✅ |
| **Right to Rectification** | `updateUserData()` | API | ✅ |
| **Data Portability** | JSON export format | API | ✅ |
| **Consent Management** | `consent.ts` module | API/Web | ✅ |
| **Audit Logging** | `audit-logger.ts` | All | ✅ |
| **Data Minimization** | Select clauses in queries | API | ✅ |
| **Encryption at Rest** | Cloud SQL encryption | Database | ✅ |
| **Encryption in Transit** | TLS everywhere | All | ✅ |
| **Breach Notification** | Alert policies | Monitoring | ✅ |
| **DPA with Processors** | SendGrid, GCP | Legal | ✅ |

---

---

## 20. Rollback Plan

### Immediate Rollback (< 5 minutes)

1. Revert load balancer to route all traffic to monolith
2. No code changes needed

```bash
# Revert URL map to monolith
gcloud compute url-maps update hta-url-map \
  --default-service=hta-monolith-backend

# Or revert Cloud Run traffic
gcloud run services update-traffic hta-api \
  --to-revisions=PREVIOUS_REVISION=100
```

### Full Rollback (< 30 minutes)

1. Redeploy monolith with original code
2. Revert database migrations (if any)
3. Update DNS/routing

```bash
# Redeploy monolith
gcloud run deploy hta-calibration \
  --image gcr.io/hta-calibration/monolith:last-known-good

# Revert migrations if needed
pnpm db:migrate:rollback
```

### Data Consistency

- All services share same database
- No data migration needed for separation
- Rollback is safe - no data loss

### Rollback Triggers

Initiate rollback if:
- Error rate > 5% for 5 minutes
- Latency p95 > 500ms for 10 minutes
- Any critical functionality broken
- Data integrity issues detected

---

## 21. Post-Migration Checklist

### Operational

- [ ] All services showing in Cloud Run console
- [ ] Health checks passing for web, api, worker
- [ ] Logs flowing to Cloud Logging with correct labels
- [ ] Metrics appearing in dashboards
- [ ] Alerts configured and tested for each service
- [ ] Service accounts have correct permissions

### Performance

- [ ] API latency within SLO (p95 < 200ms)
- [ ] Frontend load time unchanged (LCP < 2.5s)
- [ ] Database connections stable (< 50% pool utilization)
- [ ] No memory leaks (stable memory over 24h)
- [ ] Worker queue processing within SLO

### CI/CD

- [ ] All workflows updated for monorepo
- [ ] Change detection working correctly
- [ ] Build times acceptable (< 10 min)
- [ ] Deployment pipelines tested
- [ ] Rollback procedures tested

### Testing

- [ ] Unit tests passing for all packages
- [ ] Integration tests passing
- [ ] E2E tests passing
- [ ] Load tests show acceptable performance
- [ ] Contract tests passing

### Documentation

- [ ] Architecture diagrams updated
- [ ] Runbooks updated for multi-service
- [ ] README files added to each app/package
- [ ] Deployment guide updated
- [ ] On-call guide updated

### Cleanup

- [ ] Old API routes removed from frontend
- [ ] Unused dependencies removed
- [ ] Old Docker images cleaned up
- [ ] Old CI workflows removed
- [ ] Monolith service decommissioned (after 2 weeks)

---

## Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-13 | Initial plan |
| 1.1 | 2026-04-13 | Added Docker, GitHub Actions, expanded Testing sections |
| 1.2 | 2026-04-13 | Added Monitoring, Secrets, Performance, Compliance sections |
