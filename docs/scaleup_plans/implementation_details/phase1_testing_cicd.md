# Phase 1: Testing & CI/CD - Implementation Details

## Document Version
- **Version**: 1.1.0
- **Created**: 2026-03-17
- **Last Updated**: 2026-03-19
- **Phase**: 1 - Testing & CI/CD
- **Status**: 98% Complete

---

## Overview

Phase 1 focuses on establishing a comprehensive testing strategy and CI/CD pipeline to ensure code quality, prevent regressions, and enable confident deployments.

---

## Implementation Status

### Summary

| Component | Status | Completion |
|-----------|--------|------------|
| Unit Tests | Complete | 100% |
| Integration Tests | Complete | 100% |
| E2E Workflow Tests | Complete | 100% |
| CI Pipeline (GitHub Actions) | Complete | 100% |
| Nightly Tests | Complete | 100% |
| Deploy Pipeline | Complete | 100% |
| Pre-commit Hooks | Complete | 100% |
| Coverage Enforcement | Complete | 100% |
| Build Caching | Complete | 100% |
| Security Updates | Complete | 100% |

**Overall Phase Completion: 98%**

---

## Implemented Components

### 1. Unit Tests

**Location**: `tests/unit/` and `src/**/__tests__/`

#### Dedicated Unit Tests (`tests/unit/`)

| Test File | Purpose | Tests |
|-----------|---------|-------|
| `certificate-store.test.ts` | Zustand state management | Form fields, parameters, results, master instruments, error calculations |

#### Co-located Utility Tests (`src/lib/__tests__/`)

| Test File | Purpose | Tests |
|-----------|---------|-------|
| `tat-calculator.test.ts` | TAT calculation logic | Time calculations, per-role TAT, cycle times |
| `certificate-number.test.ts` | Certificate numbering | Format validation (HTA/CXXXXX/MM/YY), parsing |
| `certificate-status.test.ts` | Status utilities | State transitions, terminal statuses, labels |
| `route-guards.test.ts` | Route protection | requireAuth, requireEngineer, requireAdmin, requireMasterAdmin |
| `signing-evidence.test.ts` | Cryptographic evidence | Hash computation, evidence chain validation, tamper detection |

#### Co-located Component Tests (`src/components/__tests__/`)

| Test File | Purpose | Tests |
|-----------|---------|-------|
| `Button.test.tsx` | Button component | Variants, sizes, disabled state, onClick |
| `StatusBadge.test.tsx` | Status badge | Display variants for all certificate statuses |
| `TATBadge.test.tsx` | TAT metric badge | Rendering for different TAT values |
| `TypedSignature.test.tsx` | Digital signature | Signature capture and validation |
| `ViewToggleButton.test.tsx` | View toggle | Interaction and state changes |
| `FeedbackItem.test.tsx` | Feedback display | Item rendering and interaction |
| `FeedbackTimeline.test.tsx` | Timeline component | Empty state, header/footer, feedback display |
| `feedback-utils.test.ts` | Feedback utilities | Type detection, formatting |

#### Co-located API Handler Tests (`src/app/api/__tests__/`)

| Test File | Purpose |
|-----------|---------|
| `health.test.ts` | Health check endpoint (status, timestamp, version) |
| `certificates.test.ts` | Certificate CRUD endpoints |
| `admin-certificates.test.ts` | Admin certificate operations |
| `admin-users.test.ts` | Admin user management |
| `customer.test.ts` | Customer account management |
| `customer-approve.test.ts` | Customer approval workflow |
| `customer-dashboard.test.ts` | Customer dashboard data |
| `chat.test.ts` | Chat/AI interaction |
| `instruments.test.ts` | Instrument management |
| `internal-requests.test.ts` | Internal request workflow |
| `notifications.test.ts` | Notification system |
| `signing.test.ts` | Document signing |
| `submit.test.ts` | Certificate submission |
| `workflows.test.ts` | Workflow state management |

#### Store Tests (`src/lib/stores/__tests__/`)

| Test File | Purpose |
|-----------|---------|
| `certificate-store.test.ts` | Zustand store behavior |

#### Service Tests (`src/lib/services/queue/__tests__/`)

| Test File | Purpose |
|-----------|---------|
| `queue.test.ts` | Job queue processing |
| `database.test.ts` | Database-backed queue provider |

**Configuration**: `vitest.config.ts`
- Framework: Vitest
- Environment: jsdom
- Coverage: V8 provider (60% lines, 50% branches, 80% functions)
- Reporters: Default + JSON + HTML
- Execution: Parallel

---

### 2. Integration Tests

**Location**: `tests/integration/`

#### API Integration Tests (`tests/integration/api/`)

| Test File | Endpoints Covered | Description |
|-----------|------------------|-------------|
| `auth.test.ts` | `/api/auth/*` | User authentication, password verification, user creation |
| `certificates.test.ts` | `/api/certificates/*` | Certificate CRUD operations and queries |
| `admin-users.test.ts` | `/api/admin/users/*` | Admin user management with database validation |
| `admin-certificates.test.ts` | `/api/admin/certificates/*` | Admin certificate management operations |
| `admin-authorization.test.ts` | `/api/admin/authorization/*` | Admin authorization workflow testing |
| `admin-customers.test.ts` | `/api/admin/customers/*` | Admin customer account management |
| `customer.test.ts` | `/api/customer/*` | Customer workflow operations |
| `instruments.test.ts` | `/api/instruments/*` | Instrument management operations |
| `internal-requests.test.ts` | `/api/internal-requests/*` | Internal request workflow operations |
| `notifications.test.ts` | `/api/notifications/*` | Notification system testing |
| `chat.test.ts` | `/api/chat/*` | Chat/AI integration with database |
| `workflows.test.ts` | Various workflow APIs | Workflow state machine operations |

#### Database Integration Tests (`tests/integration/database/`)

| Test File | Purpose | Tests |
|-----------|---------|-------|
| `queries.test.ts` | Complex Prisma queries | Join queries, relations, certificate retrieval with nested data |
| `transactions.test.ts` | Transaction behavior | Atomicity, rollback behavior, multi-step consistency |

#### Test Infrastructure (`tests/integration/setup/`)

| File | Purpose |
|------|---------|
| `test-db.ts` | Test database initialization and cleanup functions |
| `fixtures.ts` | Reusable test data factories for creating test entities |
| `postgres-setup.ts` | PostgreSQL-specific initialization |

#### SQLite Testing (Default)

**Configuration**: `vitest.integration.config.ts`
- Environment: Node
- Database: SQLite (file-based or in-memory)
- Execution: Sequential (prevent database conflicts)
- Timeout: 30 seconds for database operations
- Command: `npm run test:integration`

**Features**:
- Fast execution for development
- Automatic test data cleanup between tests
- Transaction isolation for test safety

#### PostgreSQL Testing (Production Parity)

**Configuration**: `vitest.integration.postgres.config.ts`
- Environment: Node
- Database: PostgreSQL 16 (via Docker in CI)
- Schema: `prisma/schema.postgres.prisma`
- Execution: Sequential
- Command: `npm run test:integration:postgres`

**CI Configuration** (`.github/workflows/ci.yml`):
```yaml
services:
  postgres:
    image: postgres:16-alpine
    env:
      POSTGRES_USER: postgres
      POSTGRES_PASSWORD: postgres
      POSTGRES_DB: hta_test
    ports:
      - 5433:5432
    options: >-
      --health-cmd pg_isready
      --health-interval 10s
      --health-timeout 5s
      --health-retries 5
```

**Features**:
- Matches production database exactly
- Catches PostgreSQL-specific issues
- Health checks configured for reliability
- Separate port (5433) to avoid conflicts

---

### 3. E2E Workflow Tests

**Location**: `tests/e2e/workflows/`

| Spec File | Stages Covered | Description |
|-----------|----------------|-------------|
| `01-engineer-creates-certificate.spec.ts` | Stage 1 | Certificate creation, form filling, parameters |
| `02-engineer-submits-reviewer-feedback.spec.ts` | Stages 2-3 | Submission, reviewer queue, feedback |
| `03-unlock-request-workflow.spec.ts` | Stages 4-5 | Section unlock, admin review |
| `04-customer-review-workflow.spec.ts` | Stages 6-8 | Customer portal, approval, chat |
| `05-final-approval-workflow.spec.ts` | Stages 9-12 | Feedback addressing, resubmission |
| `06-admin-authorization-workflow.spec.ts` | Stages 13-16 | Admin operations, authorization |

#### Test Fixtures (`tests/e2e/fixtures/`)

- `test-data.ts` - Test user credentials, certificate data, status labels

#### Additional E2E Tests

- `tests/e2e/accessibility/` - WCAG 2.1 AA compliance
- `tests/e2e/journeys/` - User journey tests
- `tests/e2e/evals/` - Visual regression and accessibility tests

#### Visual Regression Tests

**Location**: `tests/e2e/evals/visual-regression.spec.ts`

| Test | Purpose | maxDiffPixels |
|------|---------|---------------|
| login-page.png | Public login page baseline | 100 |
| customer-login-page.png | Customer portal login baseline | 100 |
| engineer-dashboard.png | Dashboard after engineer login | 100 |
| admin-dashboard.png | Admin panel baseline | 100 |
| customer-dashboard.png | Customer portal dashboard | 100 |
| login-page-mobile.png | Responsive design (375x667) | 100 |
| login-page-tablet.png | Responsive design (768x1024) | 100 |
| login-form-invalid-credentials.png | Server-side error message | 100 |
| **new-certificate-form.png** | Certificate creation form | **500** |
| **login-form-validation-error.png** | Native browser validation state | **2000** |

**Threshold Notes**:
- Default (100 pixels): Static pages or pages with masked dynamic content
- new-certificate-form (500 pixels): Dynamic content includes certificate number (DRAFT-timestamp) and "Saved Xs ago" text
- login-form-validation-error (2000 pixels): Browser native validation tooltip positioning varies by browser/OS

**Configuration**: `playwright.config.ts`
- Browsers: Chromium (CI), Firefox + WebKit (nightly)
- Reporters: HTML, GitHub (CI), JSON
- Video: On first retry (CI)

---

### 4. GitHub Actions CI Pipeline

**Location**: `.github/workflows/ci.yml`

#### Pipeline Jobs

```
code-quality ──┬──> unit-tests ──────────┬──> e2e-tests ──> security-scan ──> ci-summary
               │                         │
               ├──> integration-sqlite ──┤
               │                         │
               ├──> integration-postgres─┤
               │                         │
               └──> build ───────────────┘
```

| Job | Purpose | Duration |
|-----|---------|----------|
| `code-quality` | ESLint, TypeScript checks | ~2 min |
| `unit-tests` | Unit tests with coverage | ~3 min |
| `integration-sqlite` | API tests (SQLite) | ~4 min |
| `integration-postgres` | API tests (PostgreSQL 16) | ~5 min |
| `build` | Next.js production build | ~4 min |
| `e2e-tests` | Playwright workflow tests | ~10 min |
| `security-scan` | npm audit | ~2 min |
| `ci-summary` | Final status report | ~1 min |

#### Features

- Concurrency control (cancels previous runs)
- Dependency caching (npm, Playwright browsers)
- Parallel job execution
- Job summaries with test counts
- Artifact uploads (coverage, Playwright reports, screenshots)

---

### 5. Nightly Pipeline

**Location**: `.github/workflows/nightly.yml`

| Job | Purpose |
|-----|---------|
| `full-test-suite` | All tests across all browsers |
| `security-audit` | Comprehensive vulnerability scan |
| `dependency-check` | Outdated dependency detection |
| `build-check` | Build verification with bundle analysis |
| `accessibility-audit` | WCAG compliance check |
| `visual-regression` | Visual change detection |

**Schedule**: 2:00 AM UTC daily

---

### 6. Deploy Pipeline

**Location**: `.github/workflows/deploy.yml`

- Docker image build
- Push to GitHub Container Registry (GHCR)
- Tagged with commit SHA and `latest`

---

### 7. Build Caching

**Location**: `.github/workflows/ci.yml`, `Dockerfile`

#### CI Pipeline Caching

| Cache Type | Key Strategy | Purpose |
|------------|--------------|---------|
| npm dependencies | `setup-node` with `cache: 'npm'` | Faster dependency installation |
| Playwright browsers | `actions/cache@v4` with version hash | Skip browser downloads |
| Next.js build cache | `actions/cache@v4` with src file hash | Incremental build support |

**Next.js Build Cache Configuration**:
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

#### Docker Build Caching

**Location**: `Dockerfile`

Uses BuildKit cache mounts for faster Docker image builds:
```dockerfile
RUN --mount=type=cache,target=/app/.next/cache npm run build
```

**Expected Time Savings**:
- npm install: ~2 min → ~10 sec (with cache)
- Next.js build: ~3 min → ~30 sec (with cache)
- Playwright browsers: ~1 min → ~5 sec (with cache)

---

### 8. Pre-commit Hooks

**Status**: Complete

**Framework**: Husky

**Configured Hooks**:
- Pre-commit: Lint-staged (ESLint, Prettier on staged files)
- Pre-commit: TypeScript type checking

**Configuration Files**:
- `.husky/pre-commit` - Hook script
- `package.json` lint-staged configuration

---

### 9. Security Updates

**Last Updated**: 2026-03-19

**Package Versions**:
| Package | Previous | Current | Notes |
|---------|----------|---------|-------|
| Next.js | 16.1.6 | 16.2.0 | Security patch for undici |
| Prisma | 6.x | 7.5.0 | Breaking change: url no longer in schema |
| @prisma/client | 6.x | 7.5.0 | Matches Prisma CLI version |
| flatted | - | Updated | Vulnerability fix |
| undici | - | Updated | Prototype pollution fix |

**Remaining Low-Severity Vulnerabilities**: 9 (all in Prisma's internal dependencies)
- These are transitive dependencies that cannot be fixed without Prisma team updates
- All are low severity with no direct exposure in our application

---

## Test Scripts

```json
{
  "test": "vitest",
  "test:coverage": "vitest --coverage",
  "test:integration": "vitest --config vitest.integration.config.ts",
  "test:integration:postgres": "vitest --config vitest.integration.config.ts",
  "test:e2e": "playwright test",
  "test:e2e:headed": "playwright test --headed",
  "test:e2e:debug": "playwright test --debug",
  "test:e2e:workflows": "playwright test tests/e2e/workflows/",
  "test:e2e:journeys": "playwright test tests/e2e/journeys/",
  "test:a11y": "playwright test tests/e2e/accessibility/",
  "test:visual": "playwright test tests/e2e/visual/"
}
```

---

## Remaining Work

### Nice-to-Have Enhancements

- [ ] Codecov integration for coverage visualization
- [ ] Test flakiness detection
- [ ] Performance benchmarking in CI
- [ ] Secret scanning in pre-push hook
- [ ] Staging/Production GKE deployment pipelines

---

## Verification Checklist

- [x] `npm run test` - All unit tests pass
- [x] `npm run test:coverage` - Coverage report generated
- [x] `npm run test:integration` - Integration tests pass
- [x] `npm run test:e2e` - E2E tests pass
- [x] CI pipeline runs on PR creation
- [x] Nightly tests scheduled and running
- [x] Deploy pipeline builds and pushes images

---

## Test Summary

### Test File Counts

| Category | Count | Location |
|----------|-------|----------|
| Dedicated Unit Tests | 1 | `tests/unit/` |
| Co-located Utility Tests | 5 | `src/lib/__tests__/` |
| Co-located Component Tests | 8 | `src/components/__tests__/` |
| Co-located API Handler Tests | 14 | `src/app/api/__tests__/` |
| Store Tests | 1 | `src/lib/stores/__tests__/` |
| Service Tests | 2 | `src/lib/services/queue/__tests__/` |
| API Integration Tests | 12 | `tests/integration/api/` |
| Database Integration Tests | 2 | `tests/integration/database/` |
| E2E Journey Tests | 10 | `tests/e2e/journeys/` |
| E2E Page Tests | 2 | `tests/e2e/pages/` |
| E2E Eval Tests | 2 | `tests/e2e/evals/` |
| **Total** | **59** | - |

---

## Files Reference

### Test Configuration
- `vitest.config.ts` - Unit test config (jsdom environment, parallel execution)
- `vitest.integration.config.ts` - SQLite integration test config (node environment, sequential)
- `vitest.integration.postgres.config.ts` - PostgreSQL integration test config
- `playwright.config.ts` - E2E test config (Chromium, Firefox, WebKit)
- `tests/setup.ts` - Test setup utilities (MSW server, Next.js router mocks, next-auth mocks)

### CI/CD Workflows
- `.github/workflows/ci.yml` - Main CI pipeline (code-quality → tests → build → e2e → security)
- `.github/workflows/nightly.yml` - Nightly comprehensive tests (all browsers, accessibility, visual)
- `.github/workflows/deploy.yml` - Docker deployment to GHCR

### Test Directories
- `tests/unit/` - Dedicated unit tests
- `tests/integration/` - Integration tests (API and database)
- `tests/integration/setup/` - Test infrastructure (fixtures, database setup)
- `tests/e2e/` - End-to-end tests (journeys, pages, evals)
- `src/**/__tests__/` - Co-located unit tests (components, utilities, API handlers)

---

## Related Documents

- [Testing Strategy Plan](../detailed_plan/01_testing_strategy.md)
- [CI/CD Pipeline Plan](../detailed_plan/02_cicd_pipeline.md)
- [Scale-Up Overview](../detailed_plan/00_scaleup_overview.md)
