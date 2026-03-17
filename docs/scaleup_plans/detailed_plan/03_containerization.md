# Phase 2A: Containerization Strategy

## Document Version
- **Version**: 2.1.0
- **Created**: 2026-02-04
- **Last Updated**: 2026-03-17
- **Phase**: 2 - Containerization & Orchestration
- **Status**: 85% Complete (Implementation Details Added, K8s Pending)

> **Implementation Status**: See [Phase 2 Implementation Details](../implementation_details/phase2_containerization.md) for current implementation status.

---

## 📚 Learning Resources

Before implementing containerization, make sure you understand the underlying concepts:

| Topic | System Design Document | What You'll Learn |
|-------|------------------------|-------------------|
| **Containers & Docker** | [07_container_orchestration.md](../../system_design/07_container_orchestration.md) | What containers are, how Docker works, why we use them |
| **Kubernetes Basics** | [07_container_orchestration.md](../../system_design/07_container_orchestration.md) | Pods, Deployments, Services - the building blocks |
| **Auto-Scaling** | [08_autoscaling_loadbalancing.md](../../system_design/08_autoscaling_loadbalancing.md) | How containers scale horizontally |
| **Security** | [14_security.md](../../system_design/14_security.md) | Container security best practices |

> 💡 **Tip**: If terms like "multi-stage build", "alpine image", or "health probe" are unfamiliar, read the system design docs first!

---

## Overview

This document outlines the Docker containerization strategy for the HTA Calibration system, covering image design, build optimization, and local development workflows.

---

## Containerization Goals

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        CONTAINERIZATION OBJECTIVES                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  1. CONSISTENCY                                                                 │
│     • Same environment from development to production                           │
│     • Eliminate "works on my machine" problems                                  │
│     • Reproducible builds                                                       │
│                                                                                 │
│  2. PORTABILITY                                                                 │
│     • Run anywhere Docker is supported                                          │
│     • Cloud-agnostic deployment                                                 │
│     • Easy local development                                                    │
│                                                                                 │
│  3. SCALABILITY                                                                 │
│     • Horizontal scaling ready                                                  │
│     • Kubernetes-compatible                                                     │
│     • Resource limits configurable                                              │
│                                                                                 │
│  4. SECURITY                                                                    │
│     • Minimal attack surface                                                    │
│     • Non-root execution                                                        │
│     • No secrets baked into images                                              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Container Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        CONTAINER ARCHITECTURE                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  PRODUCTION CONTAINERS                                                          │
│  ═════════════════════                                                          │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                          │   │
│  │  ┌──────────────────┐                                                    │   │
│  │  │   hta-web        │  Main Next.js application                          │   │
│  │  │   ────────────── │  • Server-side rendering                           │   │
│  │  │   Port: 3000     │  • API routes                                      │   │
│  │  │   Base: node:20  │  • Static asset serving                            │   │
│  │  │   alpine         │  • Health check endpoint                           │   │
│  │  └──────────────────┘                                                    │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  SUPPORTING SERVICES (Self-hosted, if needed)                                   │
│  ═════════════════════════════════════════════                                  │
│                                                                                 │
│  ┌──────────────────┐  ┌──────────────────┐  ┌──────────────────┐              │
│  │   opensign       │  │   opensign-api   │  │   mongodb        │              │
│  │   ────────────── │  │   ────────────── │  │   ────────────── │              │
│  │   OpenSign UI    │  │   OpenSign API   │  │   OpenSign DB    │              │
│  │   Port: 3001     │  │   Port: 8080     │  │   Port: 27017    │              │
│  └──────────────────┘  └──────────────────┘  └──────────────────┘              │
│                                                                                 │
│  MANAGED SERVICES (Not containerized - GCP managed)                             │
│  ═════════════════════════════════════════════════                              │
│                                                                                 │
│  • Cloud SQL (PostgreSQL) - Database                                            │
│  • Cloud Storage (GCS) - File storage                                           │
│  • Cloud Memorystore (Redis) - Session caching (if needed)                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Image Design Principles

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        IMAGE DESIGN PRINCIPLES                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  1. MULTI-STAGE BUILDS                                                          │
│  ═══════════════════════                                                        │
│                                                                                 │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐           │
│  │  Stage 1: Deps  │────▶│ Stage 2: Build  │────▶│ Stage 3: Runner │           │
│  │  ───────────────│     │  ───────────────│     │  ───────────────│           │
│  │  Install npm    │     │  Build Next.js  │     │  Production     │           │
│  │  dependencies   │     │  application    │     │  runtime only   │           │
│  │                 │     │                 │     │                 │           │
│  │  ~500MB         │     │  ~1.5GB         │     │  ~150MB         │           │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘           │
│                                                                                 │
│  2. MINIMAL BASE IMAGES                                                         │
│  ═══════════════════════                                                        │
│                                                                                 │
│  • Use Alpine-based images where possible                                       │
│  • node:20-alpine for Node.js applications                                      │
│  • Distroless for maximum security (consideration)                              │
│                                                                                 │
│  3. LAYER OPTIMIZATION                                                          │
│  ═══════════════════════                                                        │
│                                                                                 │
│  • Order commands from least to most frequently changing                        │
│  • Copy package.json before source code                                         │
│  • Combine RUN commands where logical                                           │
│  • Use .dockerignore to exclude unnecessary files                               │
│                                                                                 │
│  4. SECURITY HARDENING                                                          │
│  ═══════════════════════                                                        │
│                                                                                 │
│  • Run as non-root user                                                         │
│  • Read-only root filesystem (where possible)                                   │
│  • No shell in production image (consideration)                                 │
│  • Scan images for vulnerabilities                                              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Build Strategy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        BUILD STAGES DETAIL                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  STAGE 1: DEPENDENCIES                                                          │
│  ═════════════════════                                                          │
│                                                                                 │
│  Purpose: Install and cache npm dependencies                                    │
│                                                                                 │
│  Steps:                                                                         │
│  1. Start from node:20-alpine                                                   │
│  2. Set working directory                                                       │
│  3. Copy package.json and package-lock.json only                                │
│  4. Run npm ci (clean install)                                                  │
│  5. Result: node_modules ready for build                                        │
│                                                                                 │
│  Cache optimization: Only rebuilds when package files change                    │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  STAGE 2: BUILD                                                                 │
│  ══════════════                                                                 │
│                                                                                 │
│  Purpose: Compile Next.js application                                           │
│                                                                                 │
│  Steps:                                                                         │
│  1. Copy node_modules from Stage 1                                              │
│  2. Copy source code                                                            │
│  3. Copy Prisma schema                                                          │
│  4. Generate Prisma client                                                      │
│  5. Run Next.js build                                                           │
│  6. Result: .next directory with compiled application                           │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  STAGE 3: RUNNER (Production)                                                   │
│  ════════════════════════════                                                   │
│                                                                                 │
│  Purpose: Minimal production runtime                                            │
│                                                                                 │
│  Steps:                                                                         │
│  1. Start fresh from node:20-alpine                                             │
│  2. Create non-root user                                                        │
│  3. Copy only necessary artifacts:                                              │
│     • .next/standalone                                                          │
│     • .next/static                                                              │
│     • public directory                                                          │
│     • Prisma client                                                             │
│  4. Set environment to production                                               │
│  5. Expose port 3000                                                            │
│  6. Set entrypoint                                                              │
│                                                                                 │
│  Final image size target: < 200MB                                               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Environment Configuration

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        ENVIRONMENT CONFIGURATION                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  BUILD-TIME VARIABLES (ARG)                                                     │
│  ══════════════════════════                                                     │
│                                                                                 │
│  • NODE_ENV: production                                                         │
│  • NEXT_TELEMETRY_DISABLED: 1                                                   │
│                                                                                 │
│  Note: No secrets at build time. Public configuration only.                     │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  RUNTIME VARIABLES (ENV)                                                        │
│  ═══════════════════════                                                        │
│                                                                                 │
│  Injected at container start (from K8s secrets/configmaps):                     │
│                                                                                 │
│  Database:                                                                      │
│  • DATABASE_URL                                                                 │
│                                                                                 │
│  Authentication:                                                                │
│  • NEXTAUTH_SECRET                                                              │
│  • NEXTAUTH_URL                                                                 │
│                                                                                 │
│  External Services:                                                             │
│  • OPENSIGN_API_URL                                                             │
│  • OPENSIGN_API_KEY                                                             │
│  • SMTP_HOST, SMTP_PORT, SMTP_USER, SMTP_PASS                                   │
│                                                                                 │
│  Storage:                                                                       │
│  • GCS_BUCKET_NAME                                                              │
│  • GCS_PROJECT_ID                                                               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Local Development Environment

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        LOCAL DEVELOPMENT SETUP                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  DOCKER COMPOSE FOR LOCAL DEV                                                   │
│  ════════════════════════════                                                   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        docker-compose.dev.yml                            │   │
│  │  ─────────────────────────────────────────────────────────────────────  │   │
│  │                                                                          │   │
│  │  ┌──────────────┐   ┌──────────────┐   ┌──────────────┐                 │   │
│  │  │   postgres   │   │    app       │   │   opensign   │                 │   │
│  │  │   ────────── │   │   ────────── │   │   ────────── │                 │   │
│  │  │   Port: 5432 │   │   Port: 3000 │   │   Port: 3001 │                 │   │
│  │  │   Volume:    │   │   Volume:    │   │   Port: 8080 │                 │   │
│  │  │   pgdata     │   │   ./src:src  │   │              │                 │   │
│  │  │              │   │   Hot reload │   │              │                 │   │
│  │  └──────────────┘   └──────────────┘   └──────────────┘                 │   │
│  │         │                  │                  │                          │   │
│  │         └──────────────────┴──────────────────┘                          │   │
│  │                            │                                             │   │
│  │                     Docker Network                                       │   │
│  │                     (hta-network)                                        │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  DEVELOPER WORKFLOW:                                                            │
│                                                                                 │
│  1. Clone repository                                                            │
│  2. Copy .env.example to .env.local                                             │
│  3. Run: docker compose -f docker-compose.dev.yml up                            │
│  4. Access app at http://localhost:3000                                         │
│  5. Changes auto-reload via volume mount                                        │
│                                                                                 │
│  DATABASE MANAGEMENT:                                                           │
│                                                                                 │
│  • Migrations: docker compose exec app npx prisma migrate dev                   │
│  • Studio: docker compose exec app npx prisma studio                            │
│  • Seed: docker compose exec app npx prisma db seed                             │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Image Registry Strategy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        CONTAINER REGISTRY                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  REGISTRY: Google Artifact Registry                                             │
│  ═══════════════════════════════════                                            │
│                                                                                 │
│  Location: asia-south1-docker.pkg.dev/hta-calibration/hta-images                │
│                                                                                 │
│  IMAGE NAMING:                                                                  │
│  • hta-web:latest         - Latest build from main                              │
│  • hta-web:v1.2.3         - Semantic version tag                                │
│  • hta-web:sha-abc123     - Git commit SHA                                      │
│  • hta-web:pr-456         - PR preview builds                                   │
│                                                                                 │
│  TAGGING STRATEGY:                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Branch/Event          │  Tags Applied                                  │   │
│  │  ─────────────────────────────────────────────────────────────────────  │   │
│  │  main branch           │  :latest, :sha-<commit>                        │   │
│  │  release tag           │  :v1.2.3, :latest                              │   │
│  │  pull request          │  :pr-<number>                                  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  RETENTION POLICY:                                                              │
│  • Keep all release tags indefinitely                                           │
│  • Keep last 10 :latest images                                                  │
│  • Delete PR images after PR merge                                              │
│  • Delete SHA tags older than 30 days                                           │
│                                                                                 │
│  VULNERABILITY SCANNING:                                                        │
│  • Automatic scan on push                                                       │
│  • Block deployment of high/critical vulnerabilities                            │
│  • Weekly full scan of all images                                               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Health Checks

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        CONTAINER HEALTH CHECKS                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  HEALTH CHECK ENDPOINT: /api/health                                             │
│  ════════════════════════════════════                                           │
│                                                                                 │
│  Response (healthy):                                                            │
│  {                                                                              │
│    "status": "healthy",                                                         │
│    "timestamp": "2026-02-04T10:30:00Z",                                         │
│    "version": "1.2.3",                                                          │
│    "checks": {                                                                  │
│      "database": "connected",                                                   │
│      "memory": "ok",                                                            │
│      "disk": "ok"                                                               │
│    }                                                                            │
│  }                                                                              │
│                                                                                 │
│  DOCKER HEALTHCHECK:                                                            │
│  ═══════════════════                                                            │
│                                                                                 │
│  • Interval: 30 seconds                                                         │
│  • Timeout: 10 seconds                                                          │
│  • Retries: 3                                                                   │
│  • Start period: 40 seconds                                                     │
│                                                                                 │
│  KUBERNETES PROBES:                                                             │
│  ══════════════════                                                             │
│                                                                                 │
│  Liveness Probe:                                                                │
│  • Path: /api/health                                                            │
│  • Initial delay: 30s                                                           │
│  • Period: 10s                                                                  │
│  • Failure threshold: 3                                                         │
│                                                                                 │
│  Readiness Probe:                                                               │
│  • Path: /api/health/ready                                                      │
│  • Initial delay: 5s                                                            │
│  • Period: 5s                                                                   │
│  • Failure threshold: 3                                                         │
│                                                                                 │
│  Startup Probe:                                                                 │
│  • Path: /api/health                                                            │
│  • Initial delay: 0s                                                            │
│  • Period: 5s                                                                   │
│  • Failure threshold: 30 (allows up to 150s startup)                            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Resource Requirements

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        RESOURCE SPECIFICATIONS                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  HTA-WEB CONTAINER                                                              │
│  ═════════════════                                                              │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Environment     │  CPU Request │ CPU Limit │ Memory Req │ Memory Limit │   │
│  │  ─────────────────────────────────────────────────────────────────────  │   │
│  │  Development     │  250m        │ 1000m     │ 256Mi      │ 1Gi          │   │
│  │  Staging         │  250m        │ 500m      │ 256Mi      │ 512Mi        │   │
│  │  Production      │  500m        │ 2000m     │ 512Mi      │ 2Gi          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  SCALING CONSIDERATIONS:                                                        │
│  • PDF generation is CPU and memory intensive                                   │
│  • Burst capacity needed for signature image processing                         │
│  • Memory should account for Node.js garbage collection                         │
│                                                                                 │
│  AUTO-SCALING TRIGGERS:                                                         │
│  • CPU > 70% sustained for 2 minutes: scale up                                  │
│  • CPU < 30% sustained for 5 minutes: scale down                                │
│  • Memory > 80%: alert (may indicate leak)                                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Security Considerations

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        CONTAINER SECURITY                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  1. NON-ROOT USER                                                               │
│     • Create dedicated user (nodejs, uid 1001)                                  │
│     • Application runs as non-root                                              │
│     • File permissions set appropriately                                        │
│                                                                                 │
│  2. READ-ONLY FILESYSTEM                                                        │
│     • Root filesystem mounted read-only                                         │
│     • Temp directories mounted as emptyDir                                      │
│     • Logs written to stdout/stderr                                             │
│                                                                                 │
│  3. NO PRIVILEGED MODE                                                          │
│     • Containers run unprivileged                                               │
│     • No capability additions                                                   │
│     • Seccomp profile applied                                                   │
│                                                                                 │
│  4. IMAGE SCANNING                                                              │
│     • Scan on every build                                                       │
│     • Block images with critical CVEs                                           │
│     • Regular rescanning of deployed images                                     │
│                                                                                 │
│  5. SECRETS HANDLING                                                            │
│     • No secrets in image layers                                                │
│     • Secrets injected at runtime                                               │
│     • Environment variables from K8s secrets                                    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

This section documents the actual implementation of the containerization strategy as of March 2026.

### Implemented Files

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        CONTAINER FILES                                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  hta-calibration/                                                               │
│  ├── Dockerfile              (75 lines)  - Multi-stage production build         │
│  ├── .dockerignore           (51 lines)  - Build context exclusions             │
│  ├── docker-compose.dev.yml  (96 lines)  - Local development environment        │
│  └── docker-compose.test.yml (44 lines)  - PostgreSQL for integration tests     │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Dockerfile Implementation

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        MULTI-STAGE BUILD                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  STAGE 1: deps (node:20-alpine)                                                 │
│  ═══════════════════════════════                                                │
│  • Installs build tools (python3, make, g++)                                    │
│  • Copies package*.json and prisma/                                             │
│  • Runs npm ci                                                                  │
│  • Generates Prisma client                                                      │
│                                                                                 │
│  STAGE 2: builder (node:20-alpine)                                              │
│  ═════════════════════════════════                                              │
│  • Copies node_modules from deps                                                │
│  • Copies source code                                                           │
│  • Sets NEXT_TELEMETRY_DISABLED=1                                               │
│  • Uses placeholder DATABASE_URL for build                                      │
│  • Runs npm run build                                                           │
│                                                                                 │
│  STAGE 3: runner (node:20-alpine)                                               │
│  ═════════════════════════════════                                              │
│  • Creates non-root user (nextjs:nodejs, uid 1001)                              │
│  • Copies only production artifacts:                                            │
│    - public/                                                                    │
│    - .next/standalone                                                           │
│    - .next/static                                                               │
│    - prisma/                                                                    │
│    - node_modules/.prisma                                                       │
│    - node_modules/@prisma                                                       │
│  • Sets NODE_ENV=production                                                     │
│  • Exposes port 3000                                                            │
│  • Runs as non-root user                                                        │
│  • Entrypoint: node server.js                                                   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Health Check Configuration

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        DOCKER HEALTHCHECK                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \        │
│    CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health    │
│                                                                                 │
│  Parameter          │ Value    │ Design Target                                  │
│  ───────────────────┼──────────┼───────────────────────────────────────────────│
│  Interval           │ 30s      │ 30s ✅                                         │
│  Timeout            │ 3s       │ 10s (more conservative)                        │
│  Start Period       │ 5s       │ 40s (faster startup achieved)                  │
│  Retries            │ 3        │ 3 ✅                                           │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Docker Compose Files

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        COMPOSE CONFIGURATIONS                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  docker-compose.dev.yml                                                         │
│  ═════════════════════                                                          │
│                                                                                 │
│  Services:                                                                      │
│  ┌──────────────┬────────────────────────────────────────────────────────────┐ │
│  │ postgres     │ postgres:16-alpine on port 5432                            │ │
│  │              │ Volume: pgdata, Health check configured                    │ │
│  ├──────────────┼────────────────────────────────────────────────────────────┤ │
│  │ app          │ Built from Dockerfile, port 3000                           │ │
│  │              │ Depends on postgres (service_healthy)                      │ │
│  ├──────────────┼────────────────────────────────────────────────────────────┤ │
│  │ opensign-*   │ Commented out (optional)                                   │ │
│  │ mongodb      │ Available if needed for OpenSign                           │ │
│  └──────────────┴────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│  Network: hta-network (bridge)                                                  │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  docker-compose.test.yml                                                        │
│  ═══════════════════════                                                        │
│                                                                                 │
│  Services:                                                                      │
│  ┌──────────────┬────────────────────────────────────────────────────────────┐ │
│  │ postgres-test│ postgres:16-alpine on port 5433 (avoids conflict)          │ │
│  │              │ Optimized for tests: fsync=off, synchronous_commit=off     │ │
│  │              │ Health check: 5s interval, 10 retries                      │ │
│  └──────────────┴────────────────────────────────────────────────────────────┘ │
│                                                                                 │
│  Connection: postgresql://hta_test:hta_test_password@localhost:5433/...         │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### .dockerignore Coverage

| Category | Files Excluded |
|----------|----------------|
| Dependencies | `node_modules` |
| Build Output | `.next` |
| Version Control | `.git`, `.gitignore` |
| Documentation | `*.md`, `docs/` |
| Tests | `tests/`, `playwright-report/`, `test-results/`, `coverage/` |
| Environment | `.env`, `.env.local`, `.env.*.local` |
| IDE | `.vscode/`, `.idea/`, `*.swp`, `*.swo` |
| Database | `*.db`, `*.db-journal` |
| Logs | `*.log`, `npm-debug.log*` |

### Security Features Implemented

| Feature | Status | Implementation |
|---------|--------|----------------|
| Non-root user | ✅ | `nextjs:nodejs` (uid 1001) |
| Minimal base image | ✅ | `node:20-alpine` |
| No secrets in image | ✅ | Placeholder DATABASE_URL at build |
| Production NODE_ENV | ✅ | `ENV NODE_ENV=production` |
| Telemetry disabled | ✅ | `NEXT_TELEMETRY_DISABLED=1` |
| Health check | ✅ | `/api/health` endpoint |

### Design vs Implementation Comparison

| Design Feature | Status | Notes |
|----------------|--------|-------|
| Multi-stage build | ✅ Implemented | 3 stages: deps, builder, runner |
| node:20-alpine base | ✅ Implemented | All stages use alpine |
| Non-root execution | ✅ Implemented | nextjs user (uid 1001) |
| Health check endpoint | ✅ Implemented | /api/health with wget |
| .dockerignore | ✅ Implemented | 51 lines, comprehensive |
| docker-compose.dev.yml | ✅ Implemented | PostgreSQL + app + optional OpenSign |
| docker-compose.test.yml | ✅ Implemented | Optimized PostgreSQL for tests |
| Image size < 200MB | ⏳ To verify | Need to build and check |
| Artifact Registry | ⏳ Pending | Currently using GHCR (deploy.yml) |
| K8s readiness probe | ⏳ Pending | Defined in doc, K8s not deployed yet |

### Commands Reference

```bash
# Local Development
docker compose -f docker-compose.dev.yml up          # Start dev environment
docker compose -f docker-compose.dev.yml down        # Stop dev environment

# Integration Testing
docker compose -f docker-compose.test.yml up -d      # Start test PostgreSQL
docker compose -f docker-compose.test.yml down -v    # Reset test database

# Build Image
docker build -t hta-web:local .                      # Build locally
docker images hta-web:local                          # Check image size

# Run Container
docker run -p 3000:3000 --env-file .env hta-web:local
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Image Size | < 200MB |
| Build Time | < 5 minutes |
| Startup Time | < 30 seconds |
| Vulnerability Scan | 0 critical/high |
| Layer Count | < 15 layers |

---

## Next Steps

1. Create initial Dockerfile following this design
2. Set up local Docker Compose environment
3. Configure Artifact Registry in GCP
4. Integrate image building into CI/CD pipeline

---

## Related Documents

- [CI/CD Pipeline](./02_cicd_pipeline.md) - Build automation
- [Kubernetes Orchestration](./04_kubernetes_orchestration.md) - Deployment targets
- [Scale-Up Overview](./00_scaleup_overview.md) - Master planning document
