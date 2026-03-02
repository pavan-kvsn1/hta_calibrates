# Testing Strategy - Implementation Details

## Document Version
- **Version**: 1.0.0
- **Completed**: 2026-02-27
- **Phase**: 1 - Testing & CI/CD
- **Status**: Completed

---

## Overview

This document details the implementation of the testing strategy outlined in `01_testing_strategy.md`. The testing infrastructure has been set up with Vitest for unit/component tests and Playwright for E2E tests, integrated with GitHub Actions CI/CD.

---

## Implementation Summary

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        TESTING ARCHITECTURE                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                         CI/CD Pipeline (GitHub Actions)                  │   │
│  │  ─────────────────────────────────────────────────────────────────────  │   │
│  │                                                                          │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐                   │   │
│  │  │ Unit Tests   │  │  E2E Tests   │  │    Build     │                   │   │
│  │  │   (Vitest)   │  │ (Playwright) │  │    Check     │                   │   │
│  │  │   119 tests  │  │   9 tests    │  │   Next.js    │                   │   │
│  │  └──────────────┘  └──────────────┘  └──────────────┘                   │   │
│  │         │                 │                 │                            │   │
│  │         └─────────────────┴─────────────────┘                            │   │
│  │                           │                                              │   │
│  │                           ▼                                              │   │
│  │                  ┌──────────────┐                                        │   │
│  │                  │   Reports    │                                        │   │
│  │                  │  Artifacts   │                                        │   │
│  │                  └──────────────┘                                        │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Test Distribution

### Testing Pyramid Implementation

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           IMPLEMENTED TEST PYRAMID                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│                                    ▲                                            │
│                                   ╱ ╲                                           │
│                                  ╱   ╲                                          │
│                                 ╱ E2E ╲         9 tests (7%)                    │
│                                ╱───────╲        Playwright + Chromium           │
│                               ╱         ╲       User journey validation         │
│                              ╱───────────╲                                      │
│                             ╱  Component  ╲     32 tests (25%)                  │
│                            ╱───────────────╲    React Testing Library           │
│                           ╱   StatusBadge   ╲   Button                          │
│                          ╱───────────────────╲                                  │
│                         ╱     Unit Tests      ╲ 87 tests (68%)                  │
│                        ╱───────────────────────╲Vitest + jsdom                  │
│                       ╱  Status, Store, Logic   ╲                               │
│                      ▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔▔                             │
│                                                                                 │
│  TOTALS:                                                                        │
│  • Unit Tests:        87 tests (68%)                                            │
│  • Component Tests:   32 tests (25%)                                            │
│  • E2E Tests:          9 tests  (7%)                                            │
│  ─────────────────────────────────                                              │
│  • TOTAL:            128 tests                                                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Directory Structure

```
hta-calibration/
├── src/
│   ├── lib/
│   │   ├── stores/
│   │   │   └── certificate-store.ts        # Zustand store (tested)
│   │   └── utils/
│   │       └── certificate-status.ts       # Status state machine (tested)
│   │
│   └── components/
│       ├── dashboard/
│       │   └── __tests__/
│       │       └── StatusBadge.test.tsx    # 13 component tests
│       └── ui/
│           └── __tests__/
│               └── Button.test.tsx          # 19 component tests
│
├── tests/
│   ├── setup.ts                             # Test setup with MSW
│   │
│   ├── unit/
│   │   ├── certificate-status.test.ts       # 30 tests - Status transitions
│   │   ├── certificate-number.test.ts       # 12 tests - Cert number validation
│   │   ├── signing-evidence.test.ts         #  9 tests - Hash chain integrity
│   │   └── certificate-store.test.ts        # 36 tests - Zustand store
│   │
│   └── e2e/
│       ├── fixtures/
│       │   └── test-data.ts                 # Test credentials & data
│       └── journeys/
│           ├── auth.spec.ts                 # 5 tests - Authentication
│           └── engineer-flow.spec.ts        # 4 tests - Engineer workflows
│
├── vitest.config.ts                         # Unit/component test config
├── playwright.config.ts                     # E2E test config
└── .github/workflows/test.yml               # CI/CD pipeline
```

---

## Test Categories

### 1. Unit Tests (Business Logic)

| Test File | Tests | Purpose |
|-----------|-------|---------|
| `certificate-status.test.ts` | 30 | Status state machine transitions |
| `certificate-number.test.ts` | 12 | Certificate number format validation |
| `signing-evidence.test.ts` | 9 | Hash chain integrity verification |

---

#### certificate-status.test.ts (30 tests)

**Source File:** `src/lib/utils/certificate-status.ts`

**Import Pattern (Correct):**
```typescript
import {
  CERTIFICATE_STATUSES,
  canTransition,
  isTerminalStatus,
  requiresCustomerAction,
  requiresStaffAction,
  getStatusLabel,
  getNextStatuses,
} from '@/lib/utils/certificate-status'
// Tests the ACTUAL implementation, not a copy
```

**State Machine Definition:**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                      CERTIFICATE STATUS STATE MACHINE                            │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────┐                                                                    │
│  │  DRAFT  │──────────────────┐                                                 │
│  └─────────┘                  │                                                 │
│       │                       ▼                                                 │
│       │              ┌────────────────┐                                         │
│       └─────────────▶│ PENDING_REVIEW │◀─────────────────┐                      │
│                      └────────────────┘                  │                      │
│                       │      │      │                    │                      │
│            ┌──────────┘      │      └──────────┐         │                      │
│            ▼                 ▼                 ▼         │                      │
│  ┌──────────────────┐ ┌──────────────────────┐ ┌────────┴───┐                   │
│  │REVISION_REQUIRED │ │PENDING_CUSTOMER_APPR │ │  REJECTED  │ (Terminal)        │
│  └──────────────────┘ └──────────────────────┘ └────────────┘                   │
│            │                  │      │                                          │
│            │                  │      └─────────────────────┐                    │
│            │                  ▼                            ▼                    │
│            │         ┌────────────────────────┐   ┌────────────────────────┐    │
│            │         │CUSTOMER_REVISION_REQ'D │   │       APPROVED         │    │
│            │         └────────────────────────┘   └────────────────────────┘    │
│            │                  │                            │                    │
│            │                  │                            ▼                    │
│            │                  │                   ┌────────────────────────┐    │
│            └──────────────────┴──────────────────▶│PENDING_ADMIN_AUTHORIZ'N│    │
│                                                   └────────────────────────┘    │
│                                                            │                    │
│                                                            ▼                    │
│                                                   ┌────────────────────────┐    │
│                                                   │      AUTHORIZED        │    │
│                                                   └────────────────────────┘    │
│                                                        (Terminal)               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Functions Tested:**

| Function | Purpose | Tests |
|----------|---------|-------|
| `canTransition(from, to)` | Validates if status transition is allowed | 10 |
| `isTerminalStatus(status)` | Checks if status is final (AUTHORIZED/REJECTED) | 4 |
| `requiresCustomerAction(status)` | Checks if customer must take action | 4 |
| `requiresStaffAction(status)` | Checks if staff must take action | 5 |
| `getStatusLabel(status)` | Returns human-readable status label | 3 |
| `getNextStatuses(status)` | Returns array of valid next statuses | 3 |
| `CERTIFICATE_STATUSES` | Status constants object | 1 |

**Test Cases:**

```typescript
describe('canTransition', () => {
  // Valid transitions
  ✓ 'allows DRAFT → PENDING_REVIEW'
  ✓ 'allows PENDING_REVIEW → REVISION_REQUIRED'
  ✓ 'allows PENDING_REVIEW → PENDING_CUSTOMER_APPROVAL'
  ✓ 'allows PENDING_CUSTOMER_APPROVAL → APPROVED'
  ✓ 'allows PENDING_CUSTOMER_APPROVAL → CUSTOMER_REVISION_REQUIRED'
  ✓ 'allows APPROVED → PENDING_ADMIN_AUTHORIZATION'
  ✓ 'allows PENDING_ADMIN_AUTHORIZATION → AUTHORIZED'

  // Invalid transitions (skip steps)
  ✓ 'prevents DRAFT → APPROVED'

  // Terminal state protection
  ✓ 'prevents any transition from AUTHORIZED'
  ✓ 'prevents any transition from REJECTED'
})

describe('isTerminalStatus', () => {
  ✓ 'returns true for AUTHORIZED'
  ✓ 'returns true for REJECTED'
  ✓ 'returns false for DRAFT'
  ✓ 'returns false for PENDING_REVIEW'
})

describe('requiresCustomerAction', () => {
  ✓ 'returns true for PENDING_CUSTOMER_APPROVAL'
  ✓ 'returns true for CUSTOMER_REVISION_REQUIRED'
  ✓ 'returns false for PENDING_REVIEW'
  ✓ 'returns false for DRAFT'
})

describe('requiresStaffAction', () => {
  ✓ 'returns true for DRAFT'
  ✓ 'returns true for PENDING_REVIEW'
  ✓ 'returns true for REVISION_REQUIRED'
  ✓ 'returns true for PENDING_ADMIN_AUTHORIZATION'
  ✓ 'returns false for PENDING_CUSTOMER_APPROVAL'
})
```

**Why This Is Critical:**
- Enforces business rules (no skipping approval steps)
- Prevents certificates reaching invalid states
- Guards terminal states (AUTHORIZED/REJECTED cannot be changed)
- Determines UI visibility (which actions to show each user role)

---

#### certificate-number.test.ts (12 tests)

**Format Specification:** `HTA/CXXXXX/MM/YY`

| Component | Description | Example |
|-----------|-------------|---------|
| `HTA/C` | Prefix (company code) | `HTA/C` |
| `XXXXX` | 5-digit sequence number | `50123` |
| `MM` | 2-digit month | `02` |
| `YY` | 2-digit year | `26` |

**Test Cases:**
- Valid format acceptance
- Invalid prefix rejection
- Wrong sequence length rejection
- Invalid month/year format rejection
- Uniqueness validation

---

#### signing-evidence.test.ts (9 tests)

**Hash Chain Structure:**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         SIGNING EVIDENCE CHAIN                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌───────────────┐    ┌───────────────┐    ┌───────────────┐                   │
│  │  Certificate  │    │   Engineer    │    │      HoD      │                   │
│  │     Data      │───▶│   Signature   │───▶│   Signature   │───▶ ...           │
│  │    Hash_0     │    │    Hash_1     │    │    Hash_2     │                   │
│  └───────────────┘    └───────────────┘    └───────────────┘                   │
│                                                                                 │
│  Hash_1 = SHA256(Hash_0 + Engineer_Signature)                                   │
│  Hash_2 = SHA256(Hash_1 + HoD_Signature)                                        │
│                                                                                 │
│  VERIFICATION: Recalculate chain and compare final hash                         │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Test Cases:**
- Valid chain verification passes
- Tampered data detection
- Missing signature detection
- Out-of-order signature detection
- Empty chain handling

---

**Key Coverage Areas:**
- Valid/invalid status transitions
- Certificate number format: `HTA/CXXXXX/MM/YY`
- Cryptographic evidence chain validation

### 2. Component Tests (UI Behavior)

| Test File | Tests | Purpose |
|-----------|-------|---------|
| `StatusBadge.test.tsx` | 13 | Status display and styling |
| `Button.test.tsx` | 19 | Button variants, sizes, states |

**Key Coverage Areas:**
- All 7 certificate statuses render correctly
- Button variants: default, destructive, outline, secondary, ghost, link
- Button sizes: default, sm, lg, icon
- Disabled state and click handling
- Custom className merging

### 3. Zustand Store Tests (State Management)

#### certificate-store.test.ts (36 tests)

**Source File:** `src/lib/stores/certificate-store.ts`

**Import Pattern (Correct):**
```typescript
import { useCertificateStore } from '@/lib/stores/certificate-store'
// Tests the ACTUAL implementation, not a copy
```

**Store Architecture:**

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                         CERTIFICATE STORE (Zustand)                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                              STATE                                       │   │
│  │  ─────────────────────────────────────────────────────────────────────  │   │
│  │  formData: CertificateFormData    │  isDirty: boolean                   │   │
│  │  isSaving: boolean                │  isHydrated: boolean                │   │
│  │  validationErrors: Record         │  certificateId: string | null       │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                             ACTIONS                                      │   │
│  │  ─────────────────────────────────────────────────────────────────────  │   │
│  │                                                                          │   │
│  │  Lifecycle:        Form Fields:         Parameters:                      │   │
│  │  • hydrate()       • setFormField()     • addParameter()                │   │
│  │  • resetForm()     • calculateDueDate() • removeParameter()             │   │
│  │  • loadForm()                           • setParameter()                │   │
│  │                                                                          │   │
│  │  Results:          Master Instruments:  Persistence:                     │   │
│  │  • addResult()     • addMasterInst()    • saveDraft()                   │   │
│  │  • removeResult()  • removeMasterInst() • setIsSaving()                 │   │
│  │  • setResult()     • setMasterInst()    • setLastSaved()                │   │
│  │  • setPointCount()                      • setCertificateId()            │   │
│  │                                                                          │   │
│  │  Calculations:     Status:                                               │   │
│  │  • calculateError()• toggleCalibrationStatus()                          │   │
│  │  • recalculateAllErrors()                                               │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

**Test Categories:**

| Test Category | Tests | Purpose |
|---------------|-------|---------|
| Initial State | 4 | Default form data, flags |
| Hydration | 4 | Certificate number generation, dates |
| Form Fields | 5 | Field updates, due date calculation |
| Parameters | 4 | Add/remove/update parameters |
| Results | 4 | Calibration point management |
| Master Instruments | 2 | Instrument selection |
| Error Calculation | 3 | Formula application, out-of-limit |
| Status Toggle | 2 | Calibration status checkboxes |
| Form Reset/Load | 2 | State reset and data loading |
| Saving State | 5 | Certificate ID, saving flags |

**Key Test Cases:**

```typescript
describe('initial state', () => {
  ✓ 'has correct initial form data'
  ✓ 'starts with isDirty as false'
  ✓ 'starts with isSaving as false'
  ✓ 'starts with isHydrated as false'
})

describe('hydrate', () => {
  ✓ 'sets isHydrated to true'
  ✓ 'generates certificate number (HTA/CXXXXX/MM/YY)'
  ✓ 'sets dateOfCalibration to today'
  ✓ 'only hydrates once (idempotent)'
})

describe('setFormField', () => {
  ✓ 'updates a simple field'
  ✓ 'sets isDirty to true'
  ✓ 'recalculates due date when dateOfCalibration changes'
  ✓ 'recalculates due date when tenure changes'
  ✓ 'applies due date adjustment'
})

describe('parameter management', () => {
  ✓ 'adds a new parameter'
  ✓ 'removes a parameter (keeps at least one)'
  ✓ 'does not remove the last parameter'
  ✓ 'updates a parameter'
})

describe('error calculation', () => {
  ✓ 'calculates error using A-B formula'
  ✓ 'calculates error using B-A formula'
  ✓ 'marks result as out of limit when error exceeds accuracy'
})
```

**Why This Is Critical:**
- Single source of truth for certificate form state
- Auto-save functionality depends on isDirty flag
- Error calculations affect certificate validity
- Hydration ensures consistent client-side rendering

### 4. E2E Tests (User Journeys)

| Test File | Tests | Purpose |
|-----------|-------|---------|
| `auth.spec.ts` | 5 | Login flows, protected routes |
| `engineer-flow.spec.ts` | 4 | Dashboard, certificate creation |

**Key User Journeys:**
- Login page renders with form elements
- Invalid credentials rejected
- Engineer can login and see dashboard
- HoD can login and see dashboard
- Protected routes redirect to login
- Engineer can view certificates list
- Engineer can navigate to new certificate
- Certificate form sections visible
- Dashboard shows status badges

---

## Configuration Files

### vitest.config.ts

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/setup.ts'],
    include: [
      'src/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/unit/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/integration/**/*.{test,spec}.{js,ts,jsx,tsx}',
    ],
    exclude: ['node_modules', 'tests/e2e'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 80,
        branches: 75,
        functions: 85,
        statements: 80,
      },
    },
  },
  resolve: {
    alias: { '@': path.resolve(__dirname, './src') },
  },
})
```

### playwright.config.ts

```typescript
export default defineConfig({
  testDir: './tests/e2e',
  fullyParallel: true,
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  reporter: 'html',
  use: {
    baseURL: 'http://localhost:3000',
    trace: 'on-first-retry',
    screenshot: 'only-on-failure',
  },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
    timeout: 120000,
  },
})
```

---

## CI/CD Integration

### GitHub Actions Workflow

```yaml
# .github/workflows/test.yml

name: Tests

on:
  push:
    branches: [main, stage4-auth-users, refactor_repo]
  pull_request:
    branches: [main]

jobs:
  unit-tests:
    name: Unit & Integration Tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'
      - run: npm ci
      - run: npx prisma generate
      - run: npm run test:run
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

  e2e-tests:
    name: E2E Tests
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx prisma generate
      - run: npx prisma db push && npm run db:seed
        env:
          DATABASE_URL: file:${{ github.workspace }}/prisma/test.db
      - run: npx playwright install chromium --with-deps
      - run: npm run test:e2e
        env:
          DATABASE_URL: file:${{ github.workspace }}/prisma/test.db
          NEXTAUTH_SECRET: test-secret-for-ci
          NEXTAUTH_URL: http://localhost:3000
      - uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/

  build:
    name: Build Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npx prisma generate
      - run: npm run build
```

---

## Test Data Management

### Test Fixtures

```typescript
// tests/e2e/fixtures/test-data.ts

export const TEST_USERS = {
  engineer: {
    email: 'thiyagarajan@htaipl.com',
    password: 'engineer123',
    name: 'Thiyagarajan',
  },
  hod: {
    email: 'kiran@htaipl.com',
    password: 'hod123',
    name: 'Kiran Kumar',
  },
  admin: {
    email: 'admin@htaipl.com',
    password: 'admin123',
    name: 'Hemanth Kumar',
  },
}

export const TEST_CERTIFICATE = {
  customerName: 'Test Company Pvt Ltd',
  customerAddress: '123 Test Street, Bangalore',
  uucDescription: 'Digital Multimeter',
  // ...
}
```

### Database Seeding

The `prisma/seed.ts` file populates test data matching the fixtures:
- Creates HoD users (Kiran, Rajesh)
- Creates Engineer users (Thiyagarajan, Chandrashekar)
- Creates Admin user (Hemanth)
- Creates Customer accounts and users
- Imports master instruments from JSON

---

## Key Implementation Decisions

### 1. Co-located Component Tests
Component tests are placed in `__tests__/` folders alongside components:
```
src/components/dashboard/
├── StatusBadge.tsx
└── __tests__/
    └── StatusBadge.test.tsx
```

**Rationale:** Follows testing strategy recommendation and keeps tests close to source.

### 2. Excluded Tests from Next.js Build
Added `tests` to `tsconfig.json` exclude array to prevent build errors:
```json
{
  "exclude": ["node_modules", "tests"]
}
```

**Rationale:** Vitest globals (`vi`) aren't available during Next.js build.

### 3. Absolute Database Path in CI
Used `${{ github.workspace }}` for database URL in CI:
```yaml
DATABASE_URL: file:${{ github.workspace }}/prisma/test.db
```

**Rationale:** Ensures consistent path between `prisma db push` and `npm run db:seed`.

### 4. Environment Variable for Database in Seed
Updated `prisma/seed.ts` to read `DATABASE_URL`:
```typescript
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
})
```

**Rationale:** Allows same seed script for local dev and CI environments.

### 5. Role-Based Selectors in E2E
Used semantic selectors instead of text matching:
```typescript
// Before (flaky)
await expect(page.locator('text=Summary')).toBeVisible()

// After (reliable)
await expect(page.getByRole('heading', { name: /summary/i })).toBeVisible()
```

**Rationale:** Avoids strict mode violations when multiple elements match.

---

## NPM Scripts

```json
{
  "scripts": {
    "test": "vitest",
    "test:run": "vitest run",
    "test:coverage": "vitest run --coverage",
    "test:e2e": "playwright test",
    "test:e2e:ui": "playwright test --ui"
  }
}
```

---

## Dependencies Installed

```json
{
  "devDependencies": {
    "@playwright/test": "^1.50.1",
    "@testing-library/jest-dom": "^6.6.3",
    "@testing-library/react": "^16.2.0",
    "@vitejs/plugin-react": "^4.3.4",
    "jsdom": "^26.0.0",
    "msw": "^2.7.3",
    "vitest": "^4.0.18"
  }
}
```

---

## Next Steps (Future Enhancements)

1. **Integration Tests**: Add API route tests with test database
2. **Visual Regression**: Add Playwright visual comparisons
3. **Performance Tests**: Add PDF generation benchmarks
4. **Accessibility Tests**: Add axe-core accessibility audits
5. **Coverage Reporting**: Integrate with Codecov or Coveralls

---

## Related Documents

- [Testing Strategy](../01_testing_strategy.md) - Original planning document
- [CI/CD Pipeline](../02_cicd_pipeline.md) - Full CI/CD implementation plan
