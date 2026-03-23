# 10 - Testing Strategy

## Documentation Index

| File | Description | When to Read |
|------|-------------|--------------|
| [01-unit-tests.md](./01-unit-tests.md) | Unit testing with Vitest, mocking strategies | Writing unit tests |
| [02-integration-tests.md](./02-integration-tests.md) | API integration tests (SQLite + PostgreSQL) | Testing API endpoints |
| [03-e2e-tests.md](./03-e2e-tests.md) | Playwright E2E workflow tests | Testing user journeys |
| [04-test-patterns.md](./04-test-patterns.md) | Common patterns, fixtures, helpers | Writing effective tests |

---

## Quick Reference

### Run Tests

```bash
# Unit tests
npm run test              # Run once
npm run test:watch        # Watch mode
npm run test:coverage     # With coverage

# Integration tests (SQLite)
npm run test:integration

# Integration tests (PostgreSQL)
npm run test:integration:postgres

# E2E tests
npx playwright test                      # All browsers
npx playwright test --project=chromium   # Chromium only
npx playwright test --ui                 # Interactive mode
```

---

## Testing Stack

| Type | Framework | Environment | Files |
|------|-----------|-------------|-------|
| Unit | Vitest | jsdom | `src/**/*.test.ts` |
| Integration | Vitest | Node + DB | `tests/integration/**/*.test.ts` |
| E2E | Playwright | Browser | `tests/e2e/**/*.spec.ts` |

---

## Test Pyramid

```
┌─────────────────────────────────────────────────────────────────┐
│                      TEST PYRAMID                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                         /\                                       │
│                        /  \                                      │
│                       / E2E\     ← 6 workflow specs              │
│                      /------\       Browser tests                │
│                     /        \      Slowest (~60s)               │
│                    /Integration\  ← 12 test files                │
│                   /-------------\    SQLite + PostgreSQL         │
│                  /               \   Medium (~30s)               │
│                 /   Unit Tests    \← 7+ test files               │
│                /-------------------\ Fast (<5s)                  │
│               /                     \ Pure functions             │
│                                                                  │
│  More unit tests, fewer E2E tests                               │
│  Faster feedback, cheaper to run                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Test File Locations

```
hta-calibration/
├── src/
│   ├── lib/
│   │   └── __tests__/
│   │       ├── tat-calculator.test.ts
│   │       ├── certificate-status.test.ts
│   │       ├── route-guards.test.ts
│   │       └── signing-evidence.test.ts
│   ├── components/
│   │   └── __tests__/
│   │       └── feedback-utils.test.ts
│   ├── stores/
│   │   └── __tests__/
│   │       └── certificate-store.test.ts
│   └── app/api/
│       └── __tests__/
│           ├── certificates.test.ts
│           ├── admin-users.test.ts
│           ├── customer.test.ts
│           └── ...
├── tests/
│   ├── unit/
│   │   └── certificate-store.test.ts
│   ├── integration/
│   │   ├── api/
│   │   │   ├── certificates.test.ts
│   │   │   ├── auth.test.ts
│   │   │   └── ...
│   │   ├── database/
│   │   │   ├── queries.test.ts
│   │   │   └── transactions.test.ts
│   │   └── setup/
│   │       ├── test-db.ts
│   │       └── postgres-setup.ts
│   ├── e2e/
│   │   ├── workflows/
│   │   │   ├── certificate-creation.spec.ts
│   │   │   ├── review-flow.spec.ts
│   │   │   └── customer-approval.spec.ts
│   │   └── fixtures/
│   │       └── auth.ts
│   ├── evals/
│   │   ├── accessibility.eval.ts
│   │   ├── performance.eval.ts
│   │   └── security.eval.ts
│   └── setup.ts
└── playwright.config.ts
```

---

## Configuration Files

### vitest.config.ts (Unit Tests)

```typescript
export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',          // Browser-like environment
    globals: true,                  // No need to import describe/it
    setupFiles: ['./tests/setup.ts'],
    include: [
      'src/**/*.{test,spec}.{js,ts,jsx,tsx}',
      'tests/unit/**/*.{test,spec}.{js,ts,jsx,tsx}',
    ],
    exclude: ['node_modules', 'tests/e2e', 'tests/integration'],
    coverage: {
      provider: 'v8',
      thresholds: {
        lines: 60,
        branches: 50,
        functions: 80,
        statements: 60,
      },
    },
  },
})
```

### vitest.integration.config.ts

```typescript
export default defineConfig({
  test: {
    environment: 'node',           // Node environment for DB
    globals: true,
    include: ['tests/integration/**/*.{test,spec}.{js,ts,jsx,tsx}'],
    testTimeout: 30000,            // 30s for DB operations
    sequence: { concurrent: false }, // Sequential to avoid conflicts
    fileParallelism: false,
  },
})
```

### playwright.config.ts

```typescript
export default defineConfig({
  testDir: './tests/e2e',
  timeout: 60000,                  // 60s per test
  retries: process.env.CI ? 2 : 0,
  workers: process.env.CI ? 1 : undefined,
  projects: [
    { name: 'chromium', use: devices['Desktop Chrome'] },
    { name: 'firefox', use: devices['Desktop Firefox'] },
    { name: 'webkit', use: devices['Desktop Safari'] },
  ],
  webServer: {
    command: 'npm run dev',
    url: 'http://localhost:3000',
    reuseExistingServer: !process.env.CI,
  },
})
```

---

## Coverage Thresholds

| Metric | Threshold | Current |
|--------|-----------|---------|
| Lines | 60% | Track via CI |
| Branches | 50% | Track via CI |
| Functions | 80% | Track via CI |
| Statements | 60% | Track via CI |

View coverage report:
```bash
npm run test:coverage
open coverage/index.html
```

---

## Common Commands

```bash
# Unit tests
npm run test                    # Run all unit tests
npm run test -- --watch         # Watch mode
npm run test -- path/to/file    # Specific file
npm run test:coverage           # Generate coverage

# Integration tests
npm run test:integration        # SQLite
npm run test:integration:postgres  # PostgreSQL

# E2E tests
npx playwright test             # Run all
npx playwright test --ui        # Interactive UI
npx playwright test --debug     # Debug mode
npx playwright test --headed    # Show browser

# Specific tests
npx playwright test login.spec.ts
npx vitest run src/lib/__tests__/tat-calculator.test.ts
```

---

## CI/CD Integration

Tests run automatically in GitHub Actions:

| Test Type | CI Job | Blocking |
|-----------|--------|----------|
| Unit | `unit-tests` | Yes |
| Integration (SQLite) | `integration-sqlite` | Yes |
| Integration (PostgreSQL) | `integration-postgres` | Yes |
| E2E | `e2e-tests` | Yes |
| Accessibility | `accessibility-audit` (nightly) | No |
| Visual | `visual-regression` (nightly) | No |

---

## Related Documentation

- [03-database/05-testing.md](../03-database/05-testing.md) - Database testing details
- [09-deployment/01-ci-pipeline.md](../09-deployment/01-ci-pipeline.md) - CI configuration
