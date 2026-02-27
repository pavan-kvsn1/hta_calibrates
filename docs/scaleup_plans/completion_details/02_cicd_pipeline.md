# Phase 1B: CI/CD Pipeline - Implementation Details

## Document Version
- **Version**: 1.0.0
- **Implemented**: 2026-02-27
- **Phase**: 1 - Testing & CI/CD
- **Status**: Completed (Core Pipeline)

---

## Overview

This document describes the implemented CI/CD pipeline for the HTA Calibration system. The pipeline follows the design outlined in `docs/scaleup_plans/detailed_plan/02_cicd_pipeline.md` with adaptations for the current infrastructure state.

---

## Implementation Summary

### What Was Implemented

| Component | Status | Notes |
|-----------|--------|-------|
| Enhanced CI Workflow | ✅ Complete | 5-job pipeline with fail-fast ordering |
| Docker Support | ✅ Complete | Multi-stage Dockerfile, standalone Next.js |
| Deploy Workflow | ✅ Complete | Builds & pushes to GitHub Container Registry |
| Nightly Workflow | ✅ Complete | Scheduled tests, security audit, dependency check |
| Environment Documentation | ✅ Complete | `.env.example` with all variables |

### What's Deferred (Requires Infrastructure)

| Component | Status | Dependency |
|-----------|--------|------------|
| Kubernetes Deployment | Deferred | Phase 4 - K8s cluster setup |
| Staging Environment | Deferred | Phase 4 - Cloud infrastructure |
| Production Deployment | Deferred | Phase 4 - Cloud infrastructure |
| Manual Approval Gates | Deferred | Phase 4 - Environment setup |
| Slack Notifications | Deferred | Slack workspace + webhook setup |

---

## Files Created/Modified

```
hta-calibration/
├── .github/
│   └── workflows/
│       ├── ci.yml           # NEW - Enhanced CI workflow
│       ├── deploy.yml       # NEW - Docker build & push
│       ├── nightly.yml      # NEW - Scheduled checks
│       └── test.yml         # DELETED - Replaced by ci.yml
├── Dockerfile               # NEW - Multi-stage production build
├── .dockerignore            # NEW - Docker build exclusions
├── .env.example             # NEW - Environment documentation
├── next.config.ts           # MODIFIED - Added standalone output
├── tsconfig.json            # MODIFIED - Exclude __tests__ directories
├── tests/setup.ts           # MODIFIED - Added jest-dom type reference
└── .gitignore               # MODIFIED - Allow .env.example
```

---

## CI Workflow Architecture

### Pipeline Flow (ci.yml)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                           CI PIPELINE FLOW                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  TRIGGER: Push to main/stage4-auth-users/refactor_repo                  │
│           Pull request to main                                           │
│                                                                          │
│  ┌─────────────────┐                                                    │
│  │  code-quality   │  ← FIRST (fastest, ~1 min)                         │
│  │  ─────────────  │                                                    │
│  │  • ESLint       │                                                    │
│  │  • tsc --noEmit │                                                    │
│  └────────┬────────┘                                                    │
│           │                                                              │
│     ┌─────┴─────┐                                                       │
│     ▼           ▼                                                       │
│  ┌───────────┐ ┌───────────┐                                           │
│  │unit-tests │ │   build   │  ← PARALLEL (~2-3 min)                    │
│  │───────────│ │───────────│                                           │
│  │• Vitest   │ │• Next.js  │                                           │
│  │• Coverage │ │• Prisma   │                                           │
│  └─────┬─────┘ └─────┬─────┘                                           │
│        │             │                                                   │
│        └──────┬──────┘                                                  │
│               ▼                                                          │
│        ┌───────────┐                                                    │
│        │ e2e-tests │  ← AFTER BOTH PASS (~4 min)                        │
│        │───────────│                                                    │
│        │• Playwright│                                                   │
│        │• Chromium  │                                                   │
│        └─────┬─────┘                                                    │
│              │                                                           │
│              ▼                                                           │
│        ┌─────────────┐                                                  │
│        │security-scan│  ← FINAL (~1 min)                                │
│        │─────────────│                                                  │
│        │• npm audit  │                                                  │
│        │• Summary    │                                                  │
│        └─────────────┘                                                  │
│                                                                          │
│  TOTAL PIPELINE TIME: ~8-10 minutes                                     │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Job Details

#### Job 1: code-quality
```yaml
Purpose: Fast feedback on code standards
Runs: First (no dependencies)
Steps:
  - Checkout code
  - Setup Node.js 20 with npm cache
  - Install dependencies (npm ci)
  - Run ESLint (continue-on-error for existing issues)
  - Run TypeScript type check (tsc --noEmit)
  - Report lint status to GitHub Summary
```

#### Job 2: unit-tests
```yaml
Purpose: Validate business logic
Depends on: code-quality
Steps:
  - Setup Node.js with cache
  - Install dependencies
  - Generate Prisma client
  - Run Vitest with coverage (npm run test:coverage)
  - Upload coverage report artifact (7 days retention)
```

#### Job 3: build
```yaml
Purpose: Verify production build succeeds
Depends on: code-quality
Runs in parallel with: unit-tests
Steps:
  - Setup Node.js with cache
  - Install dependencies
  - Generate Prisma client
  - Build application (npm run build)
  - Uses placeholder DATABASE_URL for build
```

#### Job 4: e2e-tests
```yaml
Purpose: Validate user journeys
Depends on: unit-tests AND build
Steps:
  - Setup Node.js with cache
  - Install dependencies
  - Generate Prisma client
  - Setup SQLite test database
  - Seed test data
  - Install Playwright Chromium
  - Run E2E tests
  - Upload Playwright report artifact (7 days retention)
Environment:
  - DATABASE_URL: file:${{ github.workspace }}/prisma/test.db
  - NEXTAUTH_SECRET: test-secret-for-ci
  - NEXTAUTH_URL: http://localhost:3000
```

#### Job 5: security-scan
```yaml
Purpose: Identify vulnerabilities
Depends on: e2e-tests
Steps:
  - Setup Node.js with cache
  - Install dependencies
  - Run npm audit (continue-on-error)
  - Generate security summary with high/critical counts
  - Write results to GitHub Step Summary
```

---

## Deploy Workflow Architecture

### Docker Build & Push (deploy.yml)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        DEPLOY WORKFLOW                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  TRIGGER: Push to main branch                                           │
│           Manual workflow_dispatch                                       │
│                                                                          │
│  ┌──────────────────────────────────────────────────────────────────┐   │
│  │  build-and-push                                                   │   │
│  │  ──────────────                                                   │   │
│  │                                                                    │   │
│  │  1. Checkout code                                                 │   │
│  │  2. Set up Docker Buildx                                          │   │
│  │  3. Login to GitHub Container Registry (ghcr.io)                  │   │
│  │  4. Extract metadata (tags, labels)                               │   │
│  │  5. Build Docker image                                            │   │
│  │  6. Push to ghcr.io/<owner>/hta-calibration                       │   │
│  │  7. Generate summary with image tags                              │   │
│  │                                                                    │   │
│  └──────────────────────────────────────────────────────────────────┘   │
│                                                                          │
│  OUTPUT TAGS:                                                            │
│  • ghcr.io/pavan-kvsn1/hta_calibrates:<commit-sha>                      │
│  • ghcr.io/pavan-kvsn1/hta_calibrates:latest                            │
│  • ghcr.io/pavan-kvsn1/hta_calibrates:<branch-name>                     │
│                                                                          │
│  PERMISSIONS:                                                            │
│  • contents: read                                                        │
│  • packages: write (for ghcr.io)                                        │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Why GitHub Container Registry (ghcr.io)?

| Benefit | Description |
|---------|-------------|
| Free | No cost for public repos, generous limits for private |
| No Setup | Integrated with GitHub, uses GITHUB_TOKEN |
| Migration Ready | Can switch to GCP Artifact Registry later |
| Visibility | Images visible in repository Packages tab |

---

## Nightly Workflow Architecture

### Scheduled Checks (nightly.yml)

```
┌─────────────────────────────────────────────────────────────────────────┐
│                       NIGHTLY WORKFLOW                                   │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  TRIGGER: Cron schedule (0 2 * * *) - 2:00 AM UTC daily                 │
│           Manual workflow_dispatch                                       │
│                                                                          │
│  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐          │
│  │full-test-suite  │  │ security-audit  │  │dependency-check │          │
│  │─────────────────│  │─────────────────│  │─────────────────│          │
│  │                 │  │                 │  │                 │          │
│  │• All unit tests │  │• npm audit      │  │• npm outdated   │          │
│  │• Coverage report│  │• JSON report    │  │• Major updates  │          │
│  │• All browsers:  │  │• Severity table │  │• Summary        │          │
│  │  - Chromium     │  │• Artifact       │  │                 │          │
│  │  - Firefox      │  │  (30 days)      │  │                 │          │
│  │  - WebKit       │  │                 │  │                 │          │
│  │• Artifacts      │  │                 │  │                 │          │
│  │  (14 days)      │  │                 │  │                 │          │
│  └─────────────────┘  └─────────────────┘  └─────────────────┘          │
│                                                                          │
│  ┌─────────────────┐                                                    │
│  │  build-check    │                                                    │
│  │─────────────────│                                                    │
│  │• Production     │                                                    │
│  │  build          │                                                    │
│  │• Bundle size    │                                                    │
│  │  analysis       │                                                    │
│  └─────────────────┘                                                    │
│                                                                          │
│  All jobs run in PARALLEL for efficiency                                │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

---

## Dockerfile Architecture

### Multi-Stage Build

```dockerfile
┌─────────────────────────────────────────────────────────────────────────┐
│                     MULTI-STAGE DOCKERFILE                               │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│  STAGE 1: deps (node:20-alpine)                                         │
│  ═══════════════════════════════                                        │
│  • Install native build tools (python3, make, g++)                      │
│  • Copy package*.json and prisma/                                       │
│  • Run npm ci (all dependencies)                                        │
│  • Generate Prisma client                                               │
│                                                                          │
│  STAGE 2: builder (node:20-alpine)                                      │
│  ════════════════════════════════                                       │
│  • Copy node_modules from deps                                          │
│  • Copy all source code                                                 │
│  • Run npm run build                                                    │
│  • Outputs .next/standalone                                             │
│                                                                          │
│  STAGE 3: runner (node:20-alpine)                                       │
│  ════════════════════════════════                                       │
│  • Create non-root user (nextjs:nodejs)                                 │
│  • Copy only production files:                                          │
│    - .next/standalone                                                   │
│    - .next/static                                                       │
│    - public/                                                            │
│    - prisma/                                                            │
│    - node_modules/.prisma                                               │
│  • Set ownership to nextjs user                                         │
│  • Expose port 3000                                                     │
│  • Health check endpoint                                                │
│  • Run node server.js                                                   │
│                                                                          │
│  FINAL IMAGE SIZE: ~150-200MB (vs ~1GB+ with full node_modules)         │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

### Key Configuration

**next.config.ts:**
```typescript
const nextConfig: NextConfig = {
  output: 'standalone',  // Creates minimal production server
};
```

**Benefits of standalone output:**
- Self-contained server.js with all dependencies bundled
- No need for full node_modules in production
- Smaller Docker images
- Faster container startup

---

## Environment Variables

### .env.example Structure

```env
# Database
DATABASE_URL=file:./dev.db                    # SQLite (dev)
# DATABASE_URL=postgresql://...               # PostgreSQL (prod)

# Authentication
NEXTAUTH_SECRET=<generate-secure-secret>      # Required
NEXTAUTH_URL=http://localhost:3000            # App URL

# Application
NODE_ENV=development                          # Environment

# Email (Optional - future)
# SMTP_HOST=...
# SMTP_PORT=...

# PDF Generation (Optional)
# COMPANY_NAME=...

# Feature Flags (Optional)
# ENABLE_CUSTOMER_PORTAL=true
```

---

## Concurrency & Caching

### Concurrency Control

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**Behavior:**
- Groups runs by workflow name + branch
- Cancels in-progress runs when new commit pushed
- Saves CI minutes and provides faster feedback

### Caching Strategy

| Cache Type | Key | TTL |
|------------|-----|-----|
| npm dependencies | `package-lock.json` hash | 7 days |
| Docker layers | Dockerfile hash | GitHub Actions default |
| Playwright browsers | Version-based | 30 days |

---

## Artifacts

### Artifact Retention

| Artifact | Workflow | Retention |
|----------|----------|-----------|
| coverage-report | CI | 7 days |
| playwright-report | CI | 7 days |
| nightly-coverage-report | Nightly | 14 days |
| nightly-playwright-report | Nightly | 14 days |
| security-audit-report | Nightly | 30 days |

---

## Security Considerations

### GitHub Token Permissions

```yaml
permissions:
  contents: read      # Checkout code
  packages: write     # Push to ghcr.io
```

### Container Security

- Non-root user (nextjs:nodejs with UID/GID 1001)
- Alpine-based images (minimal attack surface)
- Health check endpoint for orchestration
- No secrets in Dockerfile (use runtime env vars)

### Secret Management

| Secret Type | Location | Access |
|-------------|----------|--------|
| GITHUB_TOKEN | Auto-provided | CI/CD workflows |
| NEXTAUTH_SECRET | GitHub Secrets | Runtime only |
| DATABASE_URL | GitHub Secrets | Runtime only |

---

## Verification Checklist

### CI Workflow
- [ ] Push to feature branch triggers CI
- [ ] All 5 jobs run in correct order
- [ ] Coverage report uploaded as artifact
- [ ] Playwright report uploaded on failure

### Deploy Workflow
- [ ] Push to main triggers deploy
- [ ] Docker image built successfully
- [ ] Image pushed to ghcr.io
- [ ] Tags include SHA and latest

### Nightly Workflow
- [ ] Manual trigger works (workflow_dispatch)
- [ ] All browser tests run
- [ ] Security audit generates report
- [ ] Dependency check identifies outdated packages

### Local Verification
```bash
# Type check
npx tsc --noEmit

# Unit tests
npm run test:run

# Build
npm run build

# Docker build (if Docker available)
docker build -t hta-calibration .
```

---

## Future Enhancements (Phase 4)

When infrastructure is ready:

1. **Kubernetes Deployment**
   - Add `kubectl apply` steps to deploy workflow
   - Implement rolling updates
   - Add health check verification

2. **Staging Environment**
   - Deploy to staging on merge to main
   - Run E2E tests against staging
   - Gate production deployment

3. **Production Deployment**
   - Add manual approval requirement
   - Implement blue-green deployment
   - Configure automatic rollback

4. **Notifications**
   - Slack webhook for deployment status
   - Email alerts for security vulnerabilities
   - Teams integration (if needed)

---

## Related Documents

- [Testing Strategy Implementation](./01_testing_strategy.md) - Test details
- [CI/CD Pipeline Design](../detailed_plan/02_cicd_pipeline.md) - Original design
- [Containerization Plan](../detailed_plan/03_containerization.md) - Docker strategy
- [Scale-Up Overview](../detailed_plan/00_scaleup_overview.md) - Master plan
