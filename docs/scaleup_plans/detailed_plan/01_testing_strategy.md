# Phase 1A: Testing Strategy

## Document Version
- **Version**: 2.2.0
- **Created**: 2026-02-04
- **Last Updated**: 2026-03-19
- **Phase**: 1 - Testing & CI/CD
- **Status**: Complete (Implementation Details Added)

> **Implementation Status**: See [Phase 1 Implementation Details](../implementation_details/phase1_testing_cicd.md) for current implementation status.

---

## 📚 Learning Resources

Testing strategy is primarily an application-level concern, but understanding the infrastructure helps you write better tests:

| Topic | System Design Document | What You'll Learn |
|-------|------------------------|-------------------|
| **System Architecture** | [03_system_architecture.md](../../system_design/03_system_architecture.md) | Understanding the overall system for better test coverage |
| **Database Architecture** | [05_database_architecture.md](../../system_design/05_database_architecture.md) | Database patterns relevant to integration testing |
| **Multi-Tenancy** | [04_multi_tenancy.md](../../system_design/04_multi_tenancy.md) | Testing tenant isolation scenarios |

> 💡 **Note**: This phase is 95% complete. Testing strategy was developed alongside the codebase itself.

---

## Overview

This document outlines the comprehensive testing strategy for the HTA Calibration system, covering unit tests, integration tests, end-to-end tests, and evaluation frameworks.

---

## Testing Pyramid

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           TESTING PYRAMID                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│                                    ▲                                            │
│                                   ╱ ╲                                           │
│                                  ╱   ╲                                          │
│                                 ╱ E2E ╲         Few, Slow, Expensive            │
│                                ╱───────╲        Browser-based tests             │
│                               ╱         ╲       Critical user journeys          │
│                              ╱───────────╲                                      │
│                             ╱ Integration ╲     Moderate amount                 │
│                            ╱───────────────╲    API & DB tests                  │
│                           ╱                 ╲   Service boundaries              │
│                          ╱───────────────────╲                                  │
│                         ╱     Unit Tests      ╲  Many, Fast, Cheap              │
│                        ╱───────────────────────╲ Isolated functions             │
│                       ╱                         ╲Component logic                │
│                      ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔                             │
│                                                                                 │
│  TARGET DISTRIBUTION:                                                           │
│  • Unit Tests:        70% of test suite                                         │
│  • Integration Tests: 20% of test suite                                         │
│  • E2E Tests:         10% of test suite                                         │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Unit Testing Strategy

### Scope

Unit tests focus on isolated pieces of functionality without external dependencies.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           UNIT TEST COVERAGE AREAS                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  FRONTEND (React Components)          BACKEND (API & Business Logic)            │
│  ════════════════════════════         ══════════════════════════════            │
│                                                                                 │
│  ┌─────────────────────────┐          ┌─────────────────────────┐              │
│  │ UI Components           │          │ Utility Functions       │              │
│  │ ───────────────────────│          │ ───────────────────────│              │
│  │ • Button states         │          │ • Certificate number    │              │
│  │ • Form validation       │          │   generation            │              │
│  │ • Input formatting      │          │ • Date formatting       │              │
│  │ • Conditional rendering │          │ • Validation helpers    │              │
│  │ • Error states          │          │ • Data transformations  │              │
│  └─────────────────────────┘          └─────────────────────────┘              │
│                                                                                 │
│  ┌─────────────────────────┐          ┌─────────────────────────┐              │
│  │ Custom Hooks            │          │ Business Logic          │              │
│  │ ───────────────────────│          │ ───────────────────────│              │
│  │ • useCertificateStore   │          │ • Status transitions    │              │
│  │ • useAutoSave           │          │ • Permission checks     │              │
│  │ • useNotifications      │          │ • Workflow rules        │              │
│  │ • Form state hooks      │          │ • Signature validation  │              │
│  └─────────────────────────┘          └─────────────────────────┘              │
│                                                                                 │
│  ┌─────────────────────────┐          ┌─────────────────────────┐              │
│  │ State Management        │          │ PDF Generation          │              │
│  │ ───────────────────────│          │ ───────────────────────│              │
│  │ • Zustand store actions │          │ • Layout calculations   │              │
│  │ • Reducer logic         │          │ • Data mapping          │              │
│  │ • Selector functions    │          │ • Spacing algorithms    │              │
│  └─────────────────────────┘          └─────────────────────────┘              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Testing Framework Selection

| Framework | Purpose | Why |
|-----------|---------|-----|
| **Vitest** | Unit test runner | Fast, ESM native, Vite compatible |
| **React Testing Library** | Component testing | Tests user behavior, not implementation |
| **MSW (Mock Service Worker)** | API mocking | Intercepts network requests |

### Unit Test Principles

1. **Isolation**: Each test runs independently
2. **Fast Execution**: All unit tests complete in under 60 seconds
3. **Deterministic**: Same input always produces same output
4. **No External Dependencies**: Mock all APIs, databases, file systems

---

## Integration Testing Strategy

### Scope

Integration tests verify that multiple units work together correctly.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        INTEGRATION TEST BOUNDARIES                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  TEST CATEGORY 1: API Route Testing                                             │
│  ═════════════════════════════════════                                          │
│                                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                         │
│  │   HTTP      │───▶│   API       │───▶│   Database  │                         │
│  │   Request   │    │   Handler   │    │   (Test DB) │                         │
│  └─────────────┘    └─────────────┘    └─────────────┘                         │
│                                                                                 │
│  Tests:                                                                         │
│  • Certificate CRUD operations                                                  │
│  • Authentication flows                                                         │
│  • Authorization checks                                                         │
│  • Workflow transitions                                                         │
│  • Notification creation                                                        │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  TEST CATEGORY 2: Database Operations                                           │
│  ═════════════════════════════════════                                          │
│                                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                         │
│  │   Prisma    │───▶│   Query     │───▶│   Test      │                         │
│  │   Client    │    │   Execution │    │   Database  │                         │
│  └─────────────┘    └─────────────┘    └─────────────┘                         │
│                                                                                 │
│  Tests:                                                                         │
│  • Complex queries with relations                                               │
│  • Transaction rollbacks                                                        │
│  • Cascade deletes                                                              │
│  • Unique constraint violations                                                 │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  TEST CATEGORY 3: External Service Integration                                  │
│  ═════════════════════════════════════════════════                              │
│                                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐                         │
│  │   HTA       │───▶│   OpenSign  │───▶│   Mock      │                         │
│  │   Backend   │    │   Client    │    │   OpenSign  │                         │
│  └─────────────┘    └─────────────┘    └─────────────┘                         │
│                                                                                 │
│  Tests:                                                                         │
│  • OpenSign API integration (with mocks)                                        │
│  • Email service integration (with mocks)                                       │
│  • File storage operations                                                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Test Database Strategy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        TEST DATABASE APPROACH                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  OPTION A: In-Memory SQLite (Recommended for Speed)                             │
│  ══════════════════════════════════════════════════                             │
│                                                                                 │
│  • Each test file gets fresh database                                           │
│  • Migrations run before each test suite                                        │
│  • No cleanup needed - database destroyed after tests                           │
│  • Fastest execution time                                                       │
│                                                                                 │
│  OPTION B: Docker PostgreSQL (Recommended for Parity)                           │
│  ═════════════════════════════════════════════════════                          │
│                                                                                 │
│  • Matches production database exactly                                          │
│  • Run via Docker Compose in CI                                                 │
│  • Slower but catches Postgres-specific issues                                  │
│  • Use for critical workflow tests                                              │
│                                                                                 │
│  RECOMMENDED HYBRID APPROACH:                                                   │
│  ────────────────────────────                                                   │
│  • Unit tests & fast integration: SQLite                                        │
│  • Critical path integration: PostgreSQL in Docker                              │
│  • CI pipeline runs both                                                        │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## End-to-End (E2E) Testing Strategy

### Scope

E2E tests simulate real user interactions through the browser.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        E2E TEST SCENARIOS                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  CRITICAL USER JOURNEYS TO TEST:                                                │
│                                                                                 │
│  Journey 1: Engineer Certificate Creation                                       │
│  ═════════════════════════════════════════                                      │
│  1. Engineer logs in                                                            │
│  2. Creates new certificate                                                     │
│  3. Fills calibration data                                                      │
│  4. Previews PDF                                                                │
│  5. Submits for reviewer                                                        │
│  6. Verifies status change                                                      │
│                                                                                 │
│  Journey 2: Reviewer Approval                                                   │
│  ═════════════════════════════                                                  │
│  1. Reviewer logs in                                                                 │
│  2. Views pending certificates                                                  │
│  3. Opens certificate for review                                                │
│  4. Approves and signs                                                          │
│  5. Sends to customer                                                           │
│  6. Verifies notifications sent                                                 │
│                                                                                 │
│  Journey 3: Customer Review & Sign                                              │
│  ═════════════════════════════════                                              │
│  1. Customer accesses review link                                               │
│  2. Views certificate PDF                                                       │
│  3. Reviews revision history                                                    │
│  4. Draws signature                                                             │
│  5. Confirms approval                                                           │
│  6. Downloads signed certificate                                                │
│                                                                                 │
│  Journey 4: Revision Workflow                                                   │
│  ═════════════════════════════                                                  │
│  1. Customer requests revision                                                  │
│  2. Reviewer receives notification                                              │
│  3. Reviewer responds/fixes                                                          │
│  4. Customer receives updated certificate                                       │
│  5. Customer approves                                                           │
│                                                                                 │
│  Journey 5: Authentication & Authorization                                      │
│  ═════════════════════════════════════════                                      │
│  1. Invalid login attempts                                                      │
│  2. Role-based access restrictions                                              │
│  3. Session timeout handling                                                    │
│  4. Protected route access                                                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### E2E Framework Selection

| Framework | Purpose | Why |
|-----------|---------|-----|
| **Playwright** | Browser automation | Cross-browser, fast, reliable, built-in assertions |

### E2E Test Environment

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        E2E TEST ENVIRONMENT                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        Docker Compose Environment                        │   │
│  │  ─────────────────────────────────────────────────────────────────────  │   │
│  │                                                                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │   │
│  │  │   Next.js    │  │  PostgreSQL  │  │   OpenSign   │                   │   │
│  │  │   App        │  │   Test DB    │  │   Mock       │                   │   │
│  │  │   :3000      │  │   :5432      │  │   :8080      │                   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                   │   │
│  │         │                 │                 │                            │   │
│  │         └─────────────────┴─────────────────┘                            │   │
│  │                           │                                              │   │
│  │                           ▼                                              │   │
│  │                  ┌──────────────┐                                        │   │
│  │                  │  Playwright  │                                        │   │
│  │                  │  Test Runner │                                        │   │
│  │                  └──────────────┘                                        │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  TEST DATA SEEDING:                                                             │
│  • Pre-populated test users (Engineer, Admin, Customer)                         │
│  • Sample certificates in various states                                        │
│  • Deterministic data for assertions                                            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Test Evaluation (Evals) Strategy

### What Are Evals?

Evaluations go beyond traditional tests to assess quality, performance, and business metrics.

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        EVALUATION CATEGORIES                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  CATEGORY 1: PDF Quality Evaluation                                             │
│  ═══════════════════════════════════                                            │
│                                                                                 │
│  Automated checks for generated PDFs:                                           │
│  • Page count matches expected                                                  │
│  • All required sections present                                                │
│  • Signature placeholders positioned correctly                                  │
│  • No text overflow or truncation                                               │
│  • Correct fonts and styling                                                    │
│  • File size within acceptable range                                            │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  CATEGORY 2: Performance Evaluation                                             │
│  ═══════════════════════════════════                                            │
│                                                                                 │
│  Benchmarks run on every PR:                                                    │
│  • PDF generation time (target: < 3 seconds)                                    │
│  • API response times (target: P95 < 200ms)                                     │
│  • Database query performance                                                   │
│  • Memory usage during PDF generation                                           │
│  • Bundle size tracking                                                         │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  CATEGORY 3: Accessibility Evaluation                                           │
│  ═════════════════════════════════════                                          │
│                                                                                 │
│  Automated accessibility checks:                                                │
│  • WCAG 2.1 AA compliance                                                       │
│  • Keyboard navigation                                                          │
│  • Screen reader compatibility                                                  │
│  • Color contrast ratios                                                        │
│  • Focus indicators                                                             │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  CATEGORY 4: Security Evaluation                                                │
│  ═══════════════════════════════                                                │
│                                                                                 │
│  Automated security checks:                                                     │
│  • Dependency vulnerability scanning                                            │
│  • OWASP ZAP baseline scan                                                      │
│  • Secret detection in code                                                     │
│  • SQL injection patterns                                                       │
│  • XSS vulnerability patterns                                                   │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  CATEGORY 5: Business Logic Evaluation                                          │
│  ══════════════════════════════════════                                         │
│                                                                                 │
│  Scenario-based validation:                                                     │
│  • Workflow state machine correctness                                           │
│  • Permission matrix validation                                                 │
│  • Notification trigger accuracy                                                │
│  • Certificate numbering sequence                                               │
│  • Revision history integrity                                                   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Test Organization

### Directory Structure

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        TEST DIRECTORY STRUCTURE                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  hta-calibration/                                                               │
│  ├── src/                                                                       │
│  │   ├── components/                                                            │
│  │   │   └── __tests__/              # Component unit tests (co-located)        │
│  │   ├── lib/                                                                   │
│  │   │   └── __tests__/              # Utility unit tests                       │
│  │   └── app/                                                                   │
│  │       └── api/                                                               │
│  │           └── __tests__/          # API route tests                          │
│  │                                                                              │
│  ├── tests/                                                                     │
│  │   ├── unit/                       # Additional unit tests                    │
│  │   │   ├── pdf-generation.test.ts                                            │
│  │   │   ├── certificate-logic.test.ts                                         │
│  │   │   └── ...                                                                │
│  │   │                                                                          │
│  │   ├── integration/                # Integration tests                        │
│  │   │   ├── api/                                                               │
│  │   │   │   ├── certificates.test.ts                                          │
│  │   │   │   ├── auth.test.ts                                                   │
│  │   │   │   └── ...                                                            │
│  │   │   ├── database/                                                          │
│  │   │   │   ├── queries.test.ts                                                │
│  │   │   │   └── transactions.test.ts                                           │
│  │   │   └── setup/                                                             │
│  │   │       ├── test-db.ts                                                     │
│  │   │       └── fixtures.ts                                                    │
│  │   │                                                                          │
│  │   ├── e2e/                        # End-to-end tests                         │
│  │   │   ├── journeys/                                                          │
│  │   │   │   ├── engineer-flow.spec.ts                                          │
│  │   │   │   ├── reviewer-flow.spec.ts                                          │
│  │   │   │   ├── customer-flow.spec.ts                                          │
│  │   │   │   └── revision-flow.spec.ts                                          │
│  │   │   ├── pages/                                                             │
│  │   │   │   ├── login.spec.ts                                                  │
│  │   │   │   ├── dashboard.spec.ts                                              │
│  │   │   │   └── ...                                                            │
│  │   │   └── fixtures/                                                          │
│  │   │       └── test-data.ts                                                   │
│  │   │                                                                          │
│  │   └── evals/                      # Evaluation tests                         │
│  │       ├── pdf-quality.eval.ts                                                │
│  │       ├── performance.eval.ts                                                │
│  │       ├── accessibility.eval.ts                                              │
│  │       └── security.eval.ts                                                   │
│  │                                                                              │
│  ├── vitest.config.ts                # Unit/integration test config             │
│  └── playwright.config.ts            # E2E test config                          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Details

This section documents the actual implementation of the testing strategy as of March 2026.

### Current Test File Inventory

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        IMPLEMENTED TEST FILES (59 total)                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  UNIT TESTS                                                                     │
│  ══════════                                                                     │
│                                                                                 │
│  tests/unit/ (1 file)                                                           │
│  • certificate-store.test.ts - Zustand store state management                   │
│                                                                                 │
│  src/components/__tests__/ (8 files)                                            │
│  • Button.test.tsx           - UI button component states                       │
│  • StatusBadge.test.tsx      - Certificate status badge rendering               │
│  • TATBadge.test.tsx         - Turnaround time badge display                    │
│  • ViewToggleButton.test.tsx - View mode toggle functionality                   │
│  • TypedSignature.test.tsx   - Digital signature component                      │
│  • FeedbackItem.test.tsx     - Feedback item rendering                          │
│  • FeedbackTimeline.test.tsx - Timeline component                               │
│  • feedback-utils.test.ts    - Feedback utility functions                       │
│                                                                                 │
│  src/lib/__tests__/ (5 files)                                                   │
│  • certificate-number.test.ts - Certificate number generation/parsing           │
│  • certificate-status.test.ts - Status transition validation                    │
│  • route-guards.test.ts       - Permission and route guard logic                │
│  • signing-evidence.test.ts   - Digital signature evidence handling             │
│  • tat-calculator.test.ts     - Turnaround time calculations                    │
│                                                                                 │
│  src/lib/stores/__tests__/ (1 file)                                             │
│  • certificate-store.test.ts - Zustand store behavior                           │
│                                                                                 │
│  src/lib/services/queue/__tests__/ (2 files)                                    │
│  • queue.test.ts             - Job queue processing                             │
│  • database.test.ts          - Database-backed queue provider                   │
│                                                                                 │
│  src/app/api/__tests__/ (14 files)                                              │
│  • health.test.ts             - Health check endpoint                           │
│  • certificates.test.ts       - Certificate CRUD operations                     │
│  • admin-certificates.test.ts - Admin certificate actions                       │
│  • admin-users.test.ts        - Admin user management endpoints                 │
│  • customer.test.ts           - Customer account management                     │
│  • customer-approve.test.ts   - Customer approval workflow                      │
│  • customer-dashboard.test.ts - Customer dashboard data                         │
│  • chat.test.ts               - Chat/AI interaction                             │
│  • instruments.test.ts        - Instrument management                           │
│  • internal-requests.test.ts  - Internal request workflow                       │
│  • notifications.test.ts      - Notification system                             │
│  • signing.test.ts            - Document signing                                │
│  • submit.test.ts             - Certificate submission                          │
│  • workflows.test.ts          - Workflow state management                       │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  INTEGRATION TESTS                                                              │
│  ═════════════════                                                              │
│                                                                                 │
│  tests/integration/api/ (12 files)                                              │
│  • auth.test.ts               - User authentication, password verification      │
│  • certificates.test.ts       - Certificate CRUD with real database             │
│  • admin-authorization.test.ts - Admin authorization workflow                   │
│  • admin-certificates.test.ts - Admin certificate management                    │
│  • admin-customers.test.ts    - Admin customer account management               │
│  • admin-users.test.ts        - Admin user management                           │
│  • customer.test.ts           - Customer workflow operations                    │
│  • chat.test.ts               - Chat/AI integration                             │
│  • instruments.test.ts        - Instrument management                           │
│  • internal-requests.test.ts  - Internal request workflow                       │
│  • notifications.test.ts      - Notification system                             │
│  • workflows.test.ts          - Workflow state machine                          │
│                                                                                 │
│  tests/integration/database/ (2 files)                                          │
│  • queries.test.ts       - Complex Prisma queries, joins, relations             │
│  • transactions.test.ts  - Transaction atomicity and rollback                   │
│                                                                                 │
│  tests/integration/setup/ (3 files)                                             │
│  • test-db.ts            - Test database initialization/cleanup                 │
│  • fixtures.ts           - Test data factories                                  │
│  • postgres-setup.ts     - PostgreSQL-specific initialization                   │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  E2E TESTS                                                                      │
│  ═════════                                                                      │
│                                                                                 │
│  tests/e2e/journeys/ (10 files - numbered sequentially)                         │
│  • 01-engineer-flow.spec.ts              - Engineer login and dashboard         │
│  • 02-engineer-creates-certificate.spec.ts - Certificate creation flow          │
│  • 03-engineer-submits-reviewer-feedback.spec.ts - Submission workflow          │
│  • 04-hod-flow.spec.ts                   - Reviewer approval workflow           │
│  • 05-unlock-request-workflow.spec.ts    - Section unlock requests              │
│  • 06-revision-flow.spec.ts              - Revision request handling            │
│  • 07-customer-flow.spec.ts              - Customer access flow                 │
│  • 08-customer-review-workflow.spec.ts   - Customer review process              │
│  • 09-final-approval-workflow.spec.ts    - Final approval steps                 │
│  • 10-admin-authorization-workflow.spec.ts - Admin authorization flow           │
│                                                                                 │
│  tests/e2e/pages/ (2 files)                                                     │
│  • login.spec.ts         - Login page functionality                             │
│  • dashboard.spec.ts     - Dashboard page interactions                          │
│                                                                                 │
│  tests/e2e/evals/ (2 files)                                                     │
│  • accessibility.spec.ts     - WCAG 2.1 AA accessibility checks                 │
│  • visual-regression.spec.ts - Visual snapshot comparisons                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Integration Test Database Configuration

**SQLite Testing** (Default - Fast):
- Config: `vitest.integration.config.ts`
- Database: `file:./test-{uuid}.db` (isolated per test run)
- Command: `npm run test:integration`
- Execution: Sequential to prevent conflicts
- Timeout: 30 seconds

**PostgreSQL Testing** (Production Parity):
- Config: `vitest.integration.postgres.config.ts`
- Schema: `prisma/schema.postgres.prisma`
- Command: `npm run test:integration:postgres`
- CI Service Container: `postgres:16-alpine` on port 5433
- Health checks: `pg_isready` with 5 retries

### Visual Regression Test Configuration

Visual regression tests compare screenshots against baselines to detect unintended UI changes.

**Location**: `tests/e2e/evals/visual-regression.spec.ts`

**Threshold Configuration** (maxDiffPixels):

| Test | maxDiffPixels | Rationale |
|------|---------------|-----------|
| login-page.png | 100 | Static page, no dynamic content |
| customer-login-page.png | 100 | Static page, no dynamic content |
| engineer-dashboard.png | 100 | Timestamps masked via JS |
| admin-dashboard.png | 100 | Timestamps masked via JS |
| customer-dashboard.png | 100 | Timestamps masked via JS |
| login-page-mobile.png | 100 | Responsive view, static content |
| login-page-tablet.png | 100 | Responsive view, static content |
| login-form-invalid-credentials.png | 100 | Server error message, consistent |
| **new-certificate-form.png** | **500** | Dynamic content: certificate number (DRAFT-timestamp), "Saved Xs ago" text |
| **login-form-validation-error.png** | **2000** | Browser native validation tooltip positioning varies by browser/OS |

**Masking Dynamic Content**:
```typescript
// Mask timestamps to avoid false positives
await page.evaluate(() => {
  document.querySelectorAll('[data-testid="timestamp"], time').forEach(el => {
    el.textContent = '2026-01-01 00:00'
  })
})

// Mask certificate numbers (DRAFT-timestamp format)
document.querySelectorAll('h1, h2, h3').forEach(el => {
  if (el.textContent?.includes('DRAFT-')) {
    el.textContent = 'DRAFT-XXXXXXXX'
  }
})
```

**Baseline Management**:
- Baselines generated on Linux (Docker) to match CI environment
- Update command: `npm run test:visual:docker`
- Baselines stored in: `tests/e2e/evals/visual-regression.spec.ts-snapshots/`

### Unit Tests vs Integration Tests

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        TESTING APPROACHES                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  UNIT TESTS (src/**/__tests__/*.test.ts)                                        │
│  ═══════════════════════════════════════                                        │
│                                                                                 │
│  Purpose:                                                                       │
│  • Test isolated business logic                                                 │
│  • Fast execution (no database)                                                 │
│  • Exhaustive edge case coverage                                                │
│                                                                                 │
│  Mocking Strategy:                                                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  vi.mock('@/lib/auth', () => ({                                          │   │
│  │    auth: vi.fn(),                                                        │   │
│  │    canAccessAdmin: vi.fn(),                                              │   │
│  │  }))                                                                     │   │
│  │                                                                          │   │
│  │  vi.mock('@/lib/prisma', () => ({                                        │   │
│  │    prisma: {                                                             │   │
│  │      certificate: {                                                      │   │
│  │        findMany: vi.fn(),                                                │   │
│  │        findUnique: vi.fn(),                                              │   │
│  │        create: vi.fn(),                                                  │   │
│  │        update: vi.fn(),                                                  │   │
│  │      },                                                                  │   │
│  │    },                                                                    │   │
│  │  }))                                                                     │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  What Unit Tests Cover:                                                         │
│  • Authentication/authorization checks                                          │
│  • Input validation                                                             │
│  • Error handling paths                                                         │
│  • Response formatting                                                          │
│  • Role-based access control                                                    │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  INTEGRATION TESTS (tests/integration/**/*.test.ts)                             │
│  ════════════════════════════════════════════════════                           │
│                                                                                 │
│  Purpose:                                                                       │
│  • Test actual database operations                                              │
│  • Verify Prisma queries work correctly                                         │
│  • Test transaction behavior                                                    │
│  • Validate cascade deletes and relations                                       │
│                                                                                 │
│  Database Setup:                                                                │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  // tests/integration/setup/test-db.ts                                   │   │
│  │  import { PrismaClient } from '@prisma/client'                           │   │
│  │                                                                          │   │
│  │  export async function setupTestDatabase() {                             │   │
│  │    // Creates isolated test database                                     │   │
│  │    // Runs migrations                                                    │   │
│  │    // Returns configured Prisma client                                   │   │
│  │  }                                                                       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  What Integration Tests Cover:                                                  │
│  • Complex Prisma queries with relations                                        │
│  • Transaction commit/rollback behavior                                         │
│  • Cascade delete behavior                                                      │
│  • Unique constraint violations                                                 │
│  • Database-level validation                                                    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Test Configuration

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        VITEST CONFIGURATION                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  // vitest.config.ts                                                            │
│                                                                                 │
│  export default defineConfig({                                                  │
│    test: {                                                                      │
│      include: [                                                                 │
│        'src/**/*.{test,spec}.{js,ts,jsx,tsx}',    // Co-located tests          │
│        'tests/unit/**/*.{test,spec}.{js,ts,jsx,tsx}', // Additional unit       │
│        'tests/evals/**/*.eval.{js,ts}',           // Evaluation tests          │
│      ],                                                                         │
│      exclude: [                                                                 │
│        'node_modules',                                                          │
│        'tests/e2e',                               // Playwright tests          │
│        'tests/integration',                       // Separate config           │
│      ],                                                                         │
│      environment: 'jsdom',                        // For React components       │
│      globals: true,                                                             │
│      setupFiles: ['./tests/setup.ts'],                                          │
│      coverage: {                                                                │
│        provider: 'v8',                                                          │
│        reporter: ['text', 'json', 'html'],                                      │
│        exclude: ['node_modules/', 'tests/'],                                    │
│      },                                                                         │
│    },                                                                           │
│  })                                                                             │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  PLAYWRIGHT CONFIGURATION                                                       │
│                                                                                 │
│  // playwright.config.ts                                                        │
│                                                                                 │
│  export default defineConfig({                                                  │
│    testDir: './tests/e2e',                                                      │
│    testMatch: '**/*.spec.ts',                                                   │
│    fullyParallel: true,                                                         │
│    retries: process.env.CI ? 2 : 0,                                             │
│    workers: process.env.CI ? 1 : undefined,                                     │
│    use: {                                                                       │
│      baseURL: 'http://localhost:3000',                                          │
│      trace: 'on-first-retry',                                                   │
│    },                                                                           │
│  })                                                                             │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### NPM Scripts for Testing

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        TEST EXECUTION COMMANDS                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  # Run all unit tests                                                           │
│  npm run test                                                                   │
│                                                                                 │
│  # Run unit tests in watch mode                                                 │
│  npm run test:watch                                                             │
│                                                                                 │
│  # Run unit tests with coverage                                                 │
│  npm run test:coverage                                                          │
│                                                                                 │
│  # Run integration tests                                                        │
│  npm run test:integration                                                       │
│                                                                                 │
│  # Run E2E tests                                                                │
│  npm run test:e2e                                                               │
│                                                                                 │
│  # Run E2E tests in headed mode (visible browser)                               │
│  npm run test:e2e:headed                                                        │
│                                                                                 │
│  # Run specific E2E journey                                                     │
│  npx playwright test tests/e2e/journeys/01-engineer-flow.spec.ts                │
│                                                                                 │
│  # Run evaluation tests                                                         │
│  npm run test:evals                                                             │
│                                                                                 │
│  # Run all tests (unit + integration + e2e)                                     │
│  npm run test:all                                                               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### File Naming Conventions

| Pattern | Framework | Location | Purpose |
|---------|-----------|----------|---------|
| `*.test.ts` | Vitest | `src/**/__tests__/`, `tests/unit/`, `tests/integration/` | Unit and integration tests |
| `*.spec.ts` | Playwright | `tests/e2e/` | End-to-end browser tests |
| `*.eval.ts` | Vitest | `tests/evals/` | Quality evaluation tests |

### Test Counts Summary

| Category | Count | Location |
|----------|-------|----------|
| Component Unit Tests | 8 | `src/components/__tests__/` |
| Utility Unit Tests | 5 | `src/lib/__tests__/` |
| API Unit Tests | 14 | `src/app/api/__tests__/` |
| Store Unit Tests | 1 | `src/lib/stores/__tests__/` |
| Service Unit Tests | 2 | `src/lib/services/queue/__tests__/` |
| Dedicated Unit Tests | 1 | `tests/unit/` |
| API Integration Tests | 12 | `tests/integration/api/` |
| Database Integration Tests | 2 | `tests/integration/database/` |
| E2E Journey Tests | 10 | `tests/e2e/journeys/` |
| E2E Page Tests | 2 | `tests/e2e/pages/` |
| E2E Eval Tests | 2 | `tests/e2e/evals/` |
| **Total** | **59** | - |

---

## Coverage Requirements

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        COVERAGE TARGETS                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  MINIMUM COVERAGE THRESHOLDS:                                                   │
│                                                                                 │
│  ┌────────────────────────┬─────────────┬───────────────────────────────────┐  │
│  │ Category               │ Target      │ Rationale                         │  │
│  ├────────────────────────┼─────────────┼───────────────────────────────────┤  │
│  │ Overall Line Coverage  │ 80%         │ Industry standard minimum         │  │
│  │ Branch Coverage        │ 75%         │ Ensures conditional logic tested  │  │
│  │ Function Coverage      │ 85%         │ All public functions tested       │  │
│  │ Critical Path Coverage │ 100%        │ Core workflows fully covered      │  │
│  └────────────────────────┴─────────────┴───────────────────────────────────┘  │
│                                                                                 │
│  CRITICAL PATHS (Must be 100%):                                                 │
│  • Authentication/authorization logic                                           │
│  • Certificate status transitions                                               │
│  • Signature capture and validation                                             │
│  • PDF generation core logic                                                    │
│  • Notification triggers                                                        │
│                                                                                 │
│  COVERAGE REPORTING:                                                            │
│  • Coverage report generated on every PR                                        │
│  • Coverage diff shown in PR comments                                           │
│  • Block merge if coverage drops below threshold                                │
│  • Weekly coverage trend reports                                                │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Test Execution Matrix

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        WHEN TESTS RUN                                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│                          │ Pre-commit │ PR Check │ Main Branch │ Nightly │     │
│  ────────────────────────┼────────────┼──────────┼─────────────┼─────────│     │
│  Unit Tests (fast)       │     ✓      │    ✓     │      ✓      │    ✓    │     │
│  Unit Tests (full)       │            │    ✓     │      ✓      │    ✓    │     │
│  Integration (SQLite)    │            │    ✓     │      ✓      │    ✓    │     │
│  Integration (Postgres)  │            │          │      ✓      │    ✓    │     │
│  E2E (smoke)             │            │    ✓     │      ✓      │    ✓    │     │
│  E2E (full)              │            │          │      ✓      │    ✓    │     │
│  Performance evals       │            │          │      ✓      │    ✓    │     │
│  Security scans          │            │    ✓     │      ✓      │    ✓    │     │
│  Accessibility audit     │            │          │             │    ✓    │     │
│  Visual regression       │            │          │             │    ✓    │     │
│                                                                                 │
│  EXPECTED EXECUTION TIMES:                                                      │
│  • Pre-commit hooks: < 30 seconds                                               │
│  • PR checks: < 10 minutes                                                      │
│  • Main branch: < 20 minutes                                                    │
│  • Nightly full suite: < 45 minutes                                             │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Test Data Management

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        TEST DATA STRATEGY                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  FIXTURE APPROACH:                                                              │
│                                                                                 │
│  1. FACTORY PATTERN                                                             │
│     • Generate test data programmatically                                       │
│     • Override specific fields as needed                                        │
│     • Ensures unique data per test                                              │
│                                                                                 │
│  2. SNAPSHOT DATA                                                               │
│     • Pre-defined data sets for E2E                                             │
│     • Covers edge cases and scenarios                                           │
│     • Version controlled with code                                              │
│                                                                                 │
│  3. DATA ISOLATION                                                              │
│     • Each test gets isolated data                                              │
│     • No test depends on another's data                                         │
│     • Parallel test execution safe                                              │
│                                                                                 │
│  SENSITIVE DATA HANDLING:                                                       │
│                                                                                 │
│  • No real customer data in tests                                               │
│  • Fake but realistic-looking data                                              │
│  • Signature data uses test certificates                                        │
│  • All test data clearly marked as test                                         │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Success Metrics

| Metric | Target | Measurement |
|--------|--------|-------------|
| Test Coverage | > 80% | Vitest coverage report |
| Test Pass Rate | 100% | CI pipeline |
| Flaky Test Rate | < 1% | Flaky test detection |
| Test Execution Time | < 10 min (PR) | CI metrics |
| E2E Stability | > 99% | Playwright reports |
| Security Vulnerabilities | 0 critical/high | Snyk/Dependabot |

---

## Next Steps

1. Set up Vitest configuration
2. Create initial unit tests for critical paths
3. Configure Playwright for E2E
4. Integrate with GitHub Actions (see [02_cicd_pipeline.md](./02_cicd_pipeline.md))

---

## Related Documents

- [CI/CD Pipeline](./02_cicd_pipeline.md) - How tests are executed in automation
- [Scale-Up Overview](./00_scaleup_overview.md) - Master planning document
