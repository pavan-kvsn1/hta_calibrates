# Phase 1B: CI/CD Pipeline Design

## Document Version
- **Version**: 2.3.0
- **Created**: 2026-02-04
- **Last Updated**: 2026-03-20
- **Phase**: 1 - Testing & CI/CD
- **Status**: Complete (Implementation Details Added)

> **Implementation Status**: See [Phase 1 Implementation Details](../implementation_details/phase1_testing_cicd.md) for current implementation status.

---

## 📚 Learning Resources

CI/CD pipelines interact with many parts of the infrastructure. Understanding these helps build effective pipelines:

| Topic | System Design Document | What You'll Learn |
|-------|------------------------|-------------------|
| **Containers & Docker** | [07_container_orchestration.md](../../system_design/07_container_orchestration.md) | How CI/CD builds and pushes container images |
| **GCP Fundamentals** | [06_gcp_fundamentals.md](../../system_design/06_gcp_fundamentals.md) | Where images are stored (Artifact Registry) and deployed |
| **Secrets Management** | [13_secrets_management.md](../../system_design/13_secrets_management.md) | Managing CI/CD secrets, deployment credentials |
| **Security** | [14_security.md](../../system_design/14_security.md) | Security scanning in pipelines, secure deployment |

> 💡 **Note**: This phase is 100% complete. GitHub Actions workflows are already implemented.

---

## Overview

This document outlines the Continuous Integration and Continuous Deployment (CI/CD) pipeline design using GitHub Actions for the HTA Calibration system.

---

## Pipeline Philosophy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CI/CD PRINCIPLES                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  1. FAIL FAST                                                                   │
│     • Run quickest checks first                                                 │
│     • Cancel pipeline on first failure                                          │
│     • Provide immediate feedback                                                │
│                                                                                 │
│  2. TRUNK-BASED DEVELOPMENT                                                     │
│     • Short-lived feature branches                                              │
│     • Frequent merges to main                                                   │
│     • Feature flags for incomplete features                                     │
│                                                                                 │
│  3. IMMUTABLE ARTIFACTS                                                         │
│     • Build once, deploy many                                                   │
│     • Same artifact through all environments                                    │
│     • Version tagged images                                                     │
│                                                                                 │
│  4. ENVIRONMENT PARITY                                                          │
│     • Dev, staging, production identical                                        │
│     • Only configuration differs                                                │
│     • Infrastructure as Code                                                    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           PIPELINE FLOW                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  DEVELOPER WORKFLOW                                                             │
│  ══════════════════                                                             │
│                                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐                  │
│  │  Local   │───▶│  Commit  │───▶│   Push   │───▶│   PR     │                  │
│  │   Dev    │    │  Hooks   │    │  Branch  │    │ Created  │                  │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘                  │
│       │                                               │                         │
│       │ lint, format,                                 │                         │
│       │ type-check                                    ▼                         │
│       │                                                                         │
│       │         ┌───────────────────────────────────────────────────────────┐  │
│       │         │              CONTINUOUS INTEGRATION (CI)                  │  │
│       │         │  ─────────────────────────────────────────────────────── │  │
│       │         │                                                           │  │
│       │         │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │  │
│       │         │  │  Lint   │─▶│  Type   │─▶│  Unit   │─▶│  Build  │     │  │
│       │         │  │         │  │  Check  │  │  Tests  │  │         │     │  │
│       │         │  └─────────┘  └─────────┘  └─────────┘  └─────────┘     │  │
│       │         │       │            │            │            │           │  │
│       │         │       └────────────┴────────────┴────────────┘           │  │
│       │         │                         │                                 │  │
│       │         │                         ▼                                 │  │
│       │         │  ┌─────────┐  ┌─────────┐  ┌─────────┐                   │  │
│       │         │  │  Integ  │─▶│   E2E   │─▶│Security │                   │  │
│       │         │  │  Tests  │  │  Smoke  │  │  Scan   │                   │  │
│       │         │  └─────────┘  └─────────┘  └─────────┘                   │  │
│       │         │                                                           │  │
│       │         └───────────────────────────────────────────────────────────┘  │
│       │                                          │                              │
│       │                                          ▼                              │
│       │                              ┌─────────────────────┐                   │
│       │                              │   PR Review Ready   │                   │
│       │                              │   • All checks pass │                   │
│       │                              │   • Coverage report │                   │
│       │                              │   • Preview deploy  │                   │
│       │                              └─────────────────────┘                   │
│       │                                          │                              │
│       │                                          │ Merge to main                │
│       │                                          ▼                              │
│       │         ┌───────────────────────────────────────────────────────────┐  │
│       │         │            CONTINUOUS DEPLOYMENT (CD)                     │  │
│       │         │  ─────────────────────────────────────────────────────── │  │
│       │         │                                                           │  │
│       │         │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐     │  │
│       │         │  │  Build  │─▶│  Push   │─▶│ Deploy  │─▶│ Deploy  │     │  │
│       │         │  │  Image  │  │Registry │  │ Staging │  │  Prod   │     │  │
│       │         │  └─────────┘  └─────────┘  └─────────┘  └─────────┘     │  │
│       │         │                                │            │            │  │
│       │         │                                │            │            │  │
│       │         │                          ┌─────┴─────┐ ┌────┴────┐       │  │
│       │         │                          │ E2E Tests │ │ Manual  │       │  │
│       │         │                          │ on Staging│ │ Approval│       │  │
│       │         │                          └───────────┘ └─────────┘       │  │
│       │         │                                                           │  │
│       │         └───────────────────────────────────────────────────────────┘  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Workflow Definitions

### Workflow 1: Pull Request Checks

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        PR CHECK WORKFLOW                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  TRIGGER: Pull request opened, synchronized, or reopened                        │
│  BRANCHES: All branches targeting main                                          │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  JOB 1: Code Quality (runs first, fast fail)                            │   │
│  │  ─────────────────────────────────────────                              │   │
│  │  • Install dependencies (cached)                                        │   │
│  │  • Run ESLint                                                           │   │
│  │  • Run Prettier check                                                   │   │
│  │  • Run TypeScript type check                                            │   │
│  │  • Check for console.log statements                                     │   │
│  │  • Check for TODO/FIXME in critical paths                               │   │
│  │                                                                          │   │
│  │  Duration: ~1-2 minutes                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                      │
│                                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  JOB 2: Unit Tests (parallel with Job 3)                                │   │
│  │  ───────────────────────────────────────                                │   │
│  │  • Install dependencies (cached)                                        │   │
│  │  • Run Vitest unit tests                                                │   │
│  │  • Generate coverage report                                             │   │
│  │  • Upload coverage to Codecov                                           │   │
│  │  • Fail if coverage below threshold                                     │   │
│  │                                                                          │   │
│  │  Duration: ~2-3 minutes                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  JOB 3: Build Check (parallel with Job 2)                               │   │
│  │  ────────────────────────────────────────                               │   │
│  │  • Install dependencies (cached)                                        │   │
│  │  • Run Next.js production build                                         │   │
│  │  • Check for build warnings                                             │   │
│  │  • Verify bundle size limits                                            │   │
│  │                                                                          │   │
│  │  Duration: ~3-4 minutes                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                      │
│                                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  JOB 4: Integration Tests (after build succeeds)                        │   │
│  │  ───────────────────────────────────────────────                        │   │
│  │  • Start test database (SQLite)                                         │   │
│  │  • Run Prisma migrations                                                │   │
│  │  • Run integration test suite                                           │   │
│  │  • Report test results                                                  │   │
│  │                                                                          │   │
│  │  Duration: ~3-4 minutes                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                      │
│                                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  JOB 5: E2E Smoke Tests (after integration passes)                      │   │
│  │  ─────────────────────────────────────────────────                      │   │
│  │  • Build Docker image                                                   │   │
│  │  • Start Docker Compose environment                                     │   │
│  │  • Run Playwright smoke tests                                           │   │
│  │  • Upload test artifacts on failure                                     │   │
│  │                                                                          │   │
│  │  Duration: ~4-5 minutes                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                      │
│                                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  JOB 6: Security Scan (parallel with E2E)                               │   │
│  │  ────────────────────────────────────────                               │   │
│  │  • Run npm audit                                                        │   │
│  │  • Run Snyk vulnerability scan                                          │   │
│  │  • Scan for secrets in code                                             │   │
│  │  • SAST analysis                                                        │   │
│  │                                                                          │   │
│  │  Duration: ~2-3 minutes                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  TOTAL PR CHECK TIME: ~10 minutes                                               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Workflow 2: Main Branch Deployment

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        MAIN BRANCH DEPLOYMENT WORKFLOW                           │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  TRIGGER: Push to main branch                                                   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  JOB 1: Build & Push Docker Image                                       │   │
│  │  ────────────────────────────────────                                   │   │
│  │  • Checkout code                                                        │   │
│  │  • Set up Docker Buildx                                                 │   │
│  │  • Login to Google Artifact Registry                                    │   │
│  │  • Build multi-platform image                                           │   │
│  │  • Tag with commit SHA and 'latest'                                     │   │
│  │  • Push to registry                                                     │   │
│  │                                                                          │   │
│  │  Duration: ~5-7 minutes                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                      │
│                                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  JOB 2: Deploy to Staging                                               │   │
│  │  ────────────────────────────                                           │   │
│  │  • Authenticate to GKE cluster                                          │   │
│  │  • Update Kubernetes deployment                                         │   │
│  │  • Wait for rollout completion                                          │   │
│  │  • Verify health checks pass                                            │   │
│  │                                                                          │   │
│  │  Duration: ~3-5 minutes                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                      │
│                                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  JOB 3: E2E Tests on Staging                                            │   │
│  │  ───────────────────────────────                                        │   │
│  │  • Run full Playwright test suite                                       │   │
│  │  • Against staging environment                                          │   │
│  │  • All critical user journeys                                           │   │
│  │  • Performance benchmarks                                               │   │
│  │                                                                          │   │
│  │  Duration: ~10-15 minutes                                                │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                      │
│                                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  JOB 4: Production Deployment (with approval gate)                      │   │
│  │  ─────────────────────────────────────────────────                      │   │
│  │  • Wait for manual approval (configured reviewers)                      │   │
│  │  • OR auto-approve if all checks pass (configurable)                    │   │
│  │  • Blue-green deployment to production                                  │   │
│  │  • Gradual traffic shift                                                │   │
│  │  • Automatic rollback on error                                          │   │
│  │                                                                          │   │
│  │  Duration: ~5 minutes (excluding approval wait)                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                          │                                      │
│                                          ▼                                      │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  JOB 5: Post-Deployment Verification                                    │   │
│  │  ───────────────────────────────────────                                │   │
│  │  • Run smoke tests against production                                   │   │
│  │  • Verify key metrics (error rate, latency)                             │   │
│  │  • Check database migrations applied                                    │   │
│  │  • Notify team on success/failure                                       │   │
│  │                                                                          │   │
│  │  Duration: ~2-3 minutes                                                  │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Workflow 3: Scheduled/Nightly Jobs

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        SCHEDULED WORKFLOWS                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  NIGHTLY (2:00 AM UTC)                                                          │
│  ═════════════════════                                                          │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Full Test Suite                                                         │   │
│  │  • All unit tests                                                        │   │
│  │  • All integration tests (PostgreSQL)                                    │   │
│  │  • All E2E tests (all browsers)                                          │   │
│  │  • Performance evaluation suite                                          │   │
│  │  • Accessibility audit                                                   │   │
│  │  • Visual regression tests                                               │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Security Scan (Comprehensive)                                           │   │
│  │  • Full dependency audit                                                 │   │
│  │  • Container image scanning                                              │   │
│  │  • OWASP ZAP dynamic scan                                                │   │
│  │  • License compliance check                                              │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Dependency Updates                                                      │   │
│  │  • Check for outdated dependencies                                       │   │
│  │  • Auto-create PR for patch updates                                      │   │
│  │  • Report on breaking changes                                            │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  WEEKLY (Sunday 3:00 AM UTC)                                                    │
│  ══════════════════════════                                                     │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Infrastructure Drift Detection                                          │   │
│  │  • Terraform plan against production                                     │   │
│  │  • Report any configuration drift                                        │   │
│  │  • Check for resource anomalies                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Backup Verification                                                     │   │
│  │  • Verify database backups exist                                         │   │
│  │  • Test backup restoration                                               │   │
│  │  • Report backup metrics                                                 │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Branch Strategy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        BRANCHING STRATEGY                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│                              main (protected)                                   │
│                                    │                                            │
│                    ┌───────────────┼───────────────┐                            │
│                    │               │               │                            │
│                    ▼               ▼               ▼                            │
│              feature/xyz     feature/abc     fix/issue-123                      │
│                    │               │               │                            │
│                    │               │               │                            │
│                    └───────────────┴───────────────┘                            │
│                                    │                                            │
│                              Pull Request                                       │
│                                    │                                            │
│                              CI Checks Pass                                     │
│                                    │                                            │
│                              Code Review                                        │
│                                    │                                            │
│                              Squash Merge                                       │
│                                    │                                            │
│                                    ▼                                            │
│                                  main                                           │
│                                                                                 │
│  BRANCH NAMING CONVENTIONS:                                                     │
│  • feature/short-description    - New features                                  │
│  • fix/issue-number             - Bug fixes                                     │
│  • chore/description            - Maintenance tasks                             │
│  • docs/description             - Documentation updates                         │
│  • refactor/description         - Code refactoring                              │
│                                                                                 │
│  BRANCH PROTECTION RULES (main):                                                │
│  • Require pull request before merging                                          │
│  • Require status checks to pass                                                │
│  • Require conversation resolution                                              │
│  • Require linear history (squash merge)                                        │
│  • Do not allow bypassing settings                                              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Environment Strategy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        ENVIRONMENT STRATEGY                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ENVIRONMENT          PURPOSE                  DEPLOYMENT TRIGGER               │
│  ═══════════          ═══════                  ══════════════════               │
│                                                                                 │
│  ┌─────────────┐                                                                │
│  │ Development │      Local development        Manual (developer machine)       │
│  │             │      Feature testing                                           │
│  └─────────────┘                                                                │
│        │                                                                        │
│        ▼                                                                        │
│  ┌─────────────┐                                                                │
│  │   Preview   │      PR preview deploys       Automatic on PR creation         │
│  │             │      Isolated testing         Destroyed on PR close            │
│  └─────────────┘                                                                │
│        │                                                                        │
│        ▼                                                                        │
│  ┌─────────────┐                                                                │
│  │   Staging   │      Pre-production testing   Automatic on main merge          │
│  │             │      E2E testing              Matches production config        │
│  │             │      Performance testing                                       │
│  └─────────────┘                                                                │
│        │                                                                        │
│        ▼                                                                        │
│  ┌─────────────┐                                                                │
│  │ Production  │      Live user traffic        Manual approval OR               │
│  │             │      Real data                Auto after staging tests pass    │
│  └─────────────┘                                                                │
│                                                                                 │
│  CONFIGURATION MANAGEMENT:                                                      │
│  • Environment variables via GitHub Secrets                                     │
│  • Environment-specific secrets in GCP Secret Manager                           │
│  • No secrets in code or Dockerfiles                                            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Caching Strategy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        CACHING FOR FASTER BUILDS                                 │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  CACHE TYPE               KEY STRATEGY                  TTL                     │
│  ══════════               ════════════                  ═══                     │
│                                                                                 │
│  npm dependencies         hash of package-lock.json     7 days                  │
│  Next.js build cache      hash of src + next.config     7 days                  │
│  Playwright browsers      playwright version            30 days                 │
│  Docker layer cache       Dockerfile hash               7 days                  │
│  Prisma client            schema.prisma hash            7 days                  │
│                                                                                 │
│  CACHE INVALIDATION:                                                            │
│  • Automatic on dependency file changes                                         │
│  • Manual via workflow dispatch                                                 │
│  • Weekly cache refresh (scheduled)                                             │
│                                                                                 │
│  EXPECTED TIME SAVINGS:                                                         │
│  • npm install: 2 min → 10 sec (with cache)                                     │
│  • Next.js build: 3 min → 30 sec (with cache)                                   │
│  • Playwright setup: 1 min → 5 sec (with cache)                                 │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Implemented Caching (as of March 2026)

**Next.js Build Cache** (ci.yml):
```yaml
- name: Cache Next.js build
  uses: actions/cache@v4
  with:
    path: .next/cache
    key: nextjs-${{ runner.os }}-${{ hashFiles('package-lock.json') }}-${{ hashFiles('src/**/*.ts', 'src/**/*.tsx') }}
    restore-keys: |
      nextjs-${{ runner.os }}-${{ hashFiles('package-lock.json') }}-
      nextjs-${{ runner.os }}-
```

**Docker BuildKit Cache** (Dockerfile):
```dockerfile
RUN --mount=type=cache,target=/app/.next/cache npm run build
```

**Playwright Browser Cache** (ci.yml):
```yaml
- name: Cache Playwright browsers
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
```

---

## Notification Strategy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        NOTIFICATION CONFIGURATION                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  EVENT                           CHANNEL              RECIPIENTS                │
│  ═════                           ═══════              ══════════                │
│                                                                                 │
│  PR checks failed                GitHub PR comment    PR author                 │
│  PR ready for review             GitHub notification  Reviewers                 │
│  Main branch build failed        Slack #dev-alerts    Team                      │
│  Staging deploy complete         Slack #deployments   Team                      │
│  Production deploy complete      Slack #deployments   Team + stakeholders       │
│  Production deploy failed        Slack #incidents     On-call + Team            │
│  Security vulnerability found    Slack #security      Security team             │
│  Nightly tests failed            Email                Team leads                │
│                                                                                 │
│  NOTIFICATION FATIGUE PREVENTION:                                               │
│  • Only notify on state changes (not every run)                                 │
│  • Aggregate multiple failures into single notification                         │
│  • Silent success for routine operations                                        │
│  • Escalation paths for persistent failures                                     │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Secrets Management

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        SECRETS MANAGEMENT                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  SECRET TYPE                    STORAGE LOCATION       ACCESS                   │
│  ═══════════                    ════════════════       ══════                   │
│                                                                                 │
│  CI/CD tokens                   GitHub Secrets         Workflows only           │
│  (GCP service accounts)                                                         │
│                                                                                 │
│  Application secrets            GCP Secret Manager     Runtime only             │
│  (API keys, DB passwords)                                                       │
│                                                                                 │
│  Docker registry creds          GitHub Secrets         Build workflows          │
│                                                                                 │
│  Terraform state encryption     GCP KMS                Terraform only           │
│                                                                                 │
│  SECURITY PRACTICES:                                                            │
│  • No secrets in code (pre-commit hooks check)                                  │
│  • Secrets rotated quarterly                                                    │
│  • Audit log for secret access                                                  │
│  • Principle of least privilege                                                 │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Rollback Strategy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        ROLLBACK PROCEDURES                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  AUTOMATIC ROLLBACK TRIGGERS:                                                   │
│  • Health check failures after deployment                                       │
│  • Error rate exceeds threshold (>5% for 5 minutes)                             │
│  • P95 latency exceeds threshold (>2s for 5 minutes)                            │
│                                                                                 │
│  MANUAL ROLLBACK PROCESS:                                                       │
│  1. Trigger rollback workflow (one-click)                                       │
│  2. Select target version (default: previous)                                   │
│  3. Confirm rollback                                                            │
│  4. Monitor metrics                                                             │
│                                                                                 │
│  DATABASE ROLLBACK:                                                             │
│  • Migrations should be backward compatible                                     │
│  • Point-in-time recovery available                                             │
│  • Data migrations separated from schema migrations                             │
│                                                                                 │
│  ROLLBACK TIME TARGETS:                                                         │
│  • Detection to decision: < 5 minutes                                           │
│  • Rollback execution: < 2 minutes                                              │
│  • Full recovery: < 10 minutes                                                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

This section documents the actual implementation of the CI/CD pipeline as of March 2026.

### Implemented Workflow Files

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        GITHUB ACTIONS WORKFLOWS                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  .github/workflows/                                                             │
│  ══════════════════════════════════════                                         │
│                                                                                 │
│  ci.yml (421 lines)                                                             │
│  ─────────────────────────────────────                                          │
│  • Trigger: Push to main/stage4-auth-users/refactor_repo, PR to main            │
│  • Concurrency: Cancels previous runs on same branch                            │
│  • Node.js version: 20                                                          │
│                                                                                 │
│  Jobs:                                                                          │
│  1. code-quality      - ESLint, TypeScript type check                           │
│  2. unit-tests        - Vitest with coverage (needs: code-quality)              │
│  3. integration-sqlite - SQLite integration tests (needs: code-quality)         │
│  4. integration-postgres - PostgreSQL 16 tests (needs: code-quality)            │
│  5. build             - Next.js production build (needs: code-quality)          │
│  6. e2e-tests         - Playwright Chromium (needs: unit-tests, integration, build) │
│  7. security-scan     - npm audit (needs: e2e-tests)                            │
│  8. ci-summary        - Final pipeline summary (needs: all)                     │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  deploy.yml (66 lines)                                                          │
│  ─────────────────────────────────────                                          │
│  • Trigger: Push to main, Manual dispatch                                       │
│  • Registry: ghcr.io (GitHub Container Registry)                                │
│                                                                                 │
│  Jobs:                                                                          │
│  1. build-and-push    - Docker Buildx, multi-tag (SHA, latest, branch)          │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  nightly.yml (317 lines)                                                        │
│  ─────────────────────────────────────                                          │
│  • Trigger: Schedule (2:00 AM UTC), Manual dispatch                             │
│  • Runs all browsers: Chromium, Firefox, WebKit                                 │
│                                                                                 │
│  Jobs:                                                                          │
│  1. full-test-suite    - Unit + Integration + E2E (all browsers)                │
│  2. security-audit     - Comprehensive npm audit with JSON report               │
│  3. dependency-check   - Outdated packages analysis                             │
│  4. build-check        - Build verification + bundle size                       │
│  5. accessibility-audit - WCAG 2.1 AA compliance checks                         │
│  6. visual-regression  - Screenshot comparisons                                 │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### CI Pipeline Job Dependencies

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        CI JOB DEPENDENCY GRAPH                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│                          ┌──────────────┐                                       │
│                          │ code-quality │                                       │
│                          │  (ESLint +   │                                       │
│                          │  TypeScript) │                                       │
│                          └──────┬───────┘                                       │
│                                 │                                               │
│              ┌──────────────────┼──────────────────┬────────────────┐           │
│              │                  │                  │                │           │
│              ▼                  ▼                  ▼                ▼           │
│      ┌────────────┐    ┌────────────┐    ┌────────────┐    ┌────────────┐      │
│      │ unit-tests │    │integration │    │integration │    │   build    │      │
│      │  (Vitest)  │    │  (SQLite)  │    │ (Postgres) │    │ (Next.js)  │      │
│      └─────┬──────┘    └─────┬──────┘    └────────────┘    └─────┬──────┘      │
│            │                 │                                    │             │
│            └─────────────────┼────────────────────────────────────┘             │
│                              │                                                  │
│                              ▼                                                  │
│                      ┌────────────────┐                                         │
│                      │   e2e-tests    │                                         │
│                      │  (Playwright)  │                                         │
│                      └───────┬────────┘                                         │
│                              │                                                  │
│                              ▼                                                  │
│                      ┌────────────────┐                                         │
│                      │ security-scan  │                                         │
│                      │  (npm audit)   │                                         │
│                      └───────┬────────┘                                         │
│                              │                                                  │
│                              ▼                                                  │
│                      ┌────────────────┐                                         │
│                      │  ci-summary    │                                         │
│                      │ (Final report) │                                         │
│                      └────────────────┘                                         │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Key Implementation Features

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTED FEATURES                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  CACHING                                                                        │
│  ═══════                                                                        │
│  • npm dependencies (via setup-node cache: 'npm')                               │
│  • Playwright browsers (custom cache with hash key)                             │
│  • Next.js build cache (actions/cache@v4 with src hash)                         │
│  • Docker layers (type=gha cache in deploy.yml)                                 │
│  • Docker BuildKit cache mount for .next/cache                                  │
│                                                                                 │
│  CONCURRENCY CONTROL                                                            │
│  ═══════════════════                                                            │
│  • Workflow-level concurrency groups                                            │
│  • cancel-in-progress: true (cancels old runs on new push)                      │
│                                                                                 │
│  ARTIFACT UPLOADS                                                               │
│  ════════════════                                                               │
│  • Coverage reports (7 day retention)                                           │
│  • Playwright reports (7 day retention)                                         │
│  • Playwright screenshots on failure                                            │
│  • Nightly reports (14 day retention)                                           │
│  • Security audit JSON (30 day retention)                                       │
│                                                                                 │
│  DATABASE TESTING                                                               │
│  ════════════════                                                               │
│  • SQLite: Uses file:./test.db with prisma db push                              │
│  • PostgreSQL: Service container (postgres:16-alpine)                           │
│    - Port: 5433 (mapped from 5432)                                              │
│    - Health checks configured                                                   │
│    - Separate schema: prisma/schema.postgres.prisma                             │
│                                                                                 │
│  GITHUB STEP SUMMARIES                                                          │
│  ═════════════════════                                                          │
│  • Code quality status (lint errors, type errors)                               │
│  • Test coverage summary                                                        │
│  • E2E workflow stages tested                                                   │
│  • Security vulnerability counts                                                │
│  • Pipeline status dashboard                                                    │
│                                                                                 │
│  DOCKER IMAGE TAGGING                                                           │
│  ═══════════════════                                                            │
│  • SHA prefix (e.g., abc1234)                                                   │
│  • latest (for default branch)                                                  │
│  • Branch name (e.g., main, feature/xyz)                                        │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### NPM Scripts Used by CI

| Script | Used In | Purpose |
|--------|---------|---------|
| `npm run lint` | ci.yml | ESLint code quality |
| `npm run build` | ci.yml, nightly.yml | Next.js production build |
| `npm run test:coverage` | ci.yml, nightly.yml | Vitest with coverage |
| `npm run test:integration` | ci.yml, nightly.yml | SQLite integration tests |
| `npm run test:integration:postgres` | ci.yml | PostgreSQL integration tests |
| `npm run db:seed` | ci.yml, nightly.yml | Seed test database |
| `npm run test:a11y` | nightly.yml | Accessibility tests |
| `npm run test:visual` | nightly.yml | Visual regression tests |

### Environment Variables

| Variable | Scope | Value |
|----------|-------|-------|
| `NODE_VERSION` | All workflows | `20` |
| `CI` | All workflows | `true` |
| `DATABASE_URL` | Test jobs | `file:./test.db` or PostgreSQL URL |
| `NEXTAUTH_SECRET` | E2E jobs | `test-secret-for-ci` |
| `NEXTAUTH_URL` | E2E jobs | `http://localhost:3000` |
| `REGISTRY` | deploy.yml | `ghcr.io` |
| `IMAGE_NAME` | deploy.yml | `${{ github.repository }}` |

### Workflow Comparison to Design

| Design Feature | Status | Implementation Notes |
|----------------|--------|---------------------|
| PR Checks | ✅ Implemented | ci.yml runs on PR to main |
| Main Branch Deploy | ✅ Implemented | deploy.yml pushes to GHCR |
| Staging Deploy | ⏳ Pending | Requires GKE cluster setup |
| Production Deploy | ⏳ Pending | Requires GKE cluster + approval gate |
| Nightly Full Suite | ✅ Implemented | nightly.yml at 2:00 AM UTC |
| Security Scanning | ✅ Implemented | npm audit in ci.yml + nightly.yml |
| Accessibility Audit | ✅ Implemented | nightly.yml WCAG checks |
| Visual Regression | ✅ Implemented | nightly.yml screenshot comparison |
| Slack Notifications | ➖ Optional | GitHub notifications sufficient for small teams |
| Preview Deploys | ⏳ Pending | Requires infrastructure |
| Build Caching | ✅ Implemented | Next.js + npm + Playwright + Docker BuildKit |
| Pre-commit Hooks | ✅ Implemented | Husky with lint-staged |

### Build Caching Implementation

**Next.js Build Cache** (ci.yml):
```yaml
- name: Cache Next.js build
  uses: actions/cache@v4
  with:
    path: .next/cache
    key: nextjs-${{ runner.os }}-${{ hashFiles('package-lock.json') }}-${{ hashFiles('src/**/*.ts', 'src/**/*.tsx') }}
    restore-keys: |
      nextjs-${{ runner.os }}-${{ hashFiles('package-lock.json') }}-
      nextjs-${{ runner.os }}-
```

**Playwright Browser Cache** (ci.yml):
```yaml
- name: Cache Playwright browsers
  uses: actions/cache@v4
  with:
    path: ~/.cache/ms-playwright
    key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}
```

**Docker BuildKit Cache** (Dockerfile):
```dockerfile
RUN --mount=type=cache,target=/app/.next/cache npm run build
```

### Security Updates (March 2026)

| Package | Previous | Current | Reason |
|---------|----------|---------|--------|
| Next.js | 16.1.6 | 16.2.0 | Security patch for undici vulnerability |
| Prisma | 6.x | 7.5.0 | Breaking change: url removed from schema |
| @prisma/client | 6.x | 7.5.0 | Version sync with Prisma CLI |
| flatted | - | Updated | Vulnerability fix |
| undici | - | Updated | Prototype pollution fix |

**npm Overrides** (package.json - fixes transitive vulnerabilities):

| Override | Version | Vulnerabilities Fixed |
|----------|---------|----------------------|
| hono | ^4.12.8 | XSS, cache bypass, IP spoofing, cookie injection |
| @hono/node-server | ^1.19.11 | Authorization bypass for static paths |
| lodash | ^4.17.23 | Prototype pollution in unset/omit |

**Vulnerability Status**: 0 vulnerabilities (all resolved via npm overrides)

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| PR Check Duration | < 10 minutes | GitHub Actions metrics |
| Deployment Frequency | Daily+ | Deployment count |
| Change Failure Rate | < 5% | Rollback count / deploy count |
| Mean Time to Recovery | < 30 minutes | Incident tracking |
| Pipeline Success Rate | > 95% | GitHub Actions metrics |

---

## Next Steps

1. Set up GitHub repository settings (branch protection)
2. Create initial workflow files
3. Configure GitHub Secrets
4. Set up Slack notifications
5. Document runbooks for common scenarios

---

## Related Documents

- [Testing Strategy](./01_testing_strategy.md) - What tests run in the pipeline
- [Containerization](./03_containerization.md) - Docker build process
- [Kubernetes Orchestration](./04_kubernetes_orchestration.md) - Deployment targets
- [Scale-Up Overview](./00_scaleup_overview.md) - Master planning document
