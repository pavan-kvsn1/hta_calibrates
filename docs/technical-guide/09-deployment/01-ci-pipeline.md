# CI Pipeline Deep Dive

## Workflow Configuration

**File**: `.github/workflows/ci.yml`

---

## Trigger Conditions

```yaml
on:
  push:
    branches: [main, new-workflow, stage4-auth-users, refactor_repo]
  pull_request:
    branches: [main]
```

The CI runs on:
- Push to main and feature branches
- Pull requests targeting main

---

## Concurrency Control

```yaml
concurrency:
  group: ${{ github.workflow }}-${{ github.ref }}
  cancel-in-progress: true
```

**What this does**:
- If you push twice quickly, the first run is cancelled
- Saves CI minutes
- Ensures only latest code is tested

---

## Job 1: Code Quality

```yaml
code-quality:
  name: Code Quality
  runs-on: ubuntu-latest

  steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Generate Prisma client
      run: npx prisma generate

    - name: Run ESLint
      run: npm run lint
      continue-on-error: true  # Non-blocking

    - name: Run TypeScript type check
      run: npx tsc --noEmit
      continue-on-error: true  # Non-blocking
```

### Why Non-Blocking?

```yaml
continue-on-error: true
```

ESLint and TypeScript checks are **non-blocking** to allow incremental fixes:
- Reports all issues in summary
- Doesn't fail the pipeline
- Team can fix issues over time

### Local Equivalent

```bash
npm run lint        # Check ESLint
npx tsc --noEmit    # Check TypeScript
```

---

## Job 2: Unit Tests

```yaml
unit-tests:
  name: Unit Tests
  runs-on: ubuntu-latest
  needs: code-quality  # Runs after code-quality

  steps:
    - name: Checkout code
      uses: actions/checkout@v4

    - name: Setup Node.js
      uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'

    - name: Install dependencies
      run: npm ci

    - name: Generate Prisma client
      run: npx prisma generate

    - name: Run unit tests with coverage
      run: npm run test:coverage

    - name: Upload coverage report
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: coverage-report
        path: coverage/
        retention-days: 7
```

### Test Files Covered

```
src/lib/__tests__/
├── tat-calculator.test.ts
├── feedback-utils.test.ts
├── route-guard.test.ts
└── certificate-status.test.ts

src/stores/__tests__/
└── certificate-store.test.ts
```

### Local Equivalent

```bash
npm run test           # Run tests
npm run test:coverage  # With coverage
npm run test:watch     # Watch mode
```

---

## Job 2a: Integration Tests (PostgreSQL)

```yaml
integration-tests:
  name: Integration Tests
  runs-on: ubuntu-latest
  needs: code-quality

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
        --health-cmd "pg_isready -U hta_test -d hta_calibration_test"
        --health-interval 10s
        --health-timeout 5s
        --health-retries 5

  steps:
    - name: Generate Prisma client
      run: npx prisma generate
      env:
        DATABASE_URL: postgresql://hta_test:hta_test_password@localhost:5432/hta_calibration_test

    - name: Push schema to PostgreSQL
      run: npx prisma db push --accept-data-loss
      env:
        DATABASE_URL: postgresql://hta_test:hta_test_password@localhost:5432/hta_calibration_test

    - name: Run integration tests
      run: npm run test:integration
      env:
        DATABASE_URL: postgresql://hta_test:hta_test_password@localhost:5432/hta_calibration_test
```

### What's Tested

Integration tests against PostgreSQL:
- Authentication endpoints
- Certificate CRUD operations
- Admin user management
- Customer workflows
- Internal request handling
- Instrument management
- Notification system

### Local PostgreSQL Testing

```bash
# Start PostgreSQL with Docker Compose
npm run db:test:start

# Set environment
export DATABASE_URL="postgresql://hta_test:hta_test_password@localhost:5433/hta_calibration_test"

# Generate and push schema
npx prisma generate
npx prisma db push

# Run tests
npm run test:integration
```

---

## Job 3: Build Check

```yaml
build:
  name: Build Check
  runs-on: ubuntu-latest
  needs: code-quality

  steps:
    - name: Cache Next.js build
      uses: actions/cache@v4
      with:
        path: .next/cache
        key: nextjs-${{ runner.os }}-${{ hashFiles('package-lock.json') }}-${{ hashFiles('src/**/*.ts', 'src/**/*.tsx') }}
        restore-keys: |
          nextjs-${{ runner.os }}-${{ hashFiles('package-lock.json') }}-
          nextjs-${{ runner.os }}-

    - name: Build application
      run: npm run build
      env:
        DATABASE_URL: postgresql://placeholder:placeholder@localhost:5432/placeholder
```

### Build Caching

Next.js build cache speeds up subsequent builds:
- Cache key based on `package-lock.json` + source files
- Incremental builds when only some files change

### Why DATABASE_URL for Build?

Next.js needs Prisma client at build time for static generation. The `DATABASE_URL` is a placeholder that satisfies Prisma validation without requiring actual database access.

---

## Job 4: E2E Tests

```yaml
e2e-tests:
  name: E2E Workflow Tests
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

  steps:
    - name: Setup and seed database
      run: npx prisma db push --accept-data-loss && npm run db:seed
      env:
        DATABASE_URL: postgresql://hta_test:hta_test_password@localhost:5432/hta_calibration_test

    - name: Cache Playwright browsers
      uses: actions/cache@v4
      id: playwright-cache
      with:
        path: ~/.cache/ms-playwright
        key: playwright-${{ runner.os }}-${{ hashFiles('package-lock.json') }}

    - name: Install Playwright browsers
      if: steps.playwright-cache.outputs.cache-hit != 'true'
      run: npx playwright install chromium --with-deps

    - name: Run E2E workflow tests
      run: npx playwright test --project=chromium
      env:
        DATABASE_URL: postgresql://hta_test:hta_test_password@localhost:5432/hta_calibration_test
        NEXTAUTH_SECRET: test-secret-for-ci
        NEXTAUTH_URL: http://localhost:3000

    - name: Upload Playwright report
      uses: actions/upload-artifact@v4
      if: always()
      with:
        name: playwright-report
        path: playwright-report/
        retention-days: 7
```

### Workflow Stages Tested

| Stage | Test |
|-------|------|
| 1 | Engineer creates certificate |
| 2-3 | Submit & reviewer feedback |
| 4-5 | Unlock request |
| 6-8 | Customer review |
| 9-12 | Final approval |
| 13-16 | Admin authorization |

### Local E2E Testing

```bash
# Start PostgreSQL and setup database
npm run db:test:start
export DATABASE_URL="postgresql://hta_test:hta_test_password@localhost:5433/hta_calibration_test"
npx prisma db push
npm run db:seed

# Install browsers
npx playwright install chromium

# Run tests
npx playwright test --project=chromium

# Run with UI
npx playwright test --ui
```

---

## Job 5: Security Scan

```yaml
security-scan:
  name: Security Scan
  runs-on: ubuntu-latest
  needs: e2e-tests
  continue-on-error: true  # Non-blocking

  steps:
    - name: Run npm audit
      run: npm audit --audit-level=high
      continue-on-error: true

    - name: Check for known vulnerabilities
      run: |
        npm audit --json > audit-results.json 2>/dev/null || true
        HIGH=$(cat audit-results.json | jq '.metadata.vulnerabilities.high // 0')
        CRITICAL=$(cat audit-results.json | jq '.metadata.vulnerabilities.critical // 0')
        # Report in summary
```

### Vulnerability Levels

| Level | Action |
|-------|--------|
| Critical | **Review immediately** |
| High | **Review before deploy** |
| Moderate | Review when convenient |
| Low | Track for future |

### Local Security Check

```bash
npm audit                  # Basic audit
npm audit --audit-level=high  # Only high+
npm audit fix              # Auto-fix what's possible
```

---

## Job Dependencies (DAG)

```
code-quality
     │
     ├──────────────────┬───────────────────┐
     │                  │                   │
     ▼                  ▼                   ▼
unit-tests      integration-tests         build
     │                  │                   │
     │                  │                   │
     └────────┬─────────┴───────────────────┘
              │
              ▼
          e2e-tests
              │
              ▼
        security-scan
              │
              ▼
         ci-summary
```

---

## Viewing CI Results

### GitHub Actions UI

1. Go to repository → Actions tab
2. Click on the workflow run
3. View job logs and summaries

### Step Summaries

Each job writes to `$GITHUB_STEP_SUMMARY`:

```bash
echo "## Test Results" >> $GITHUB_STEP_SUMMARY
echo "| Test | Status |" >> $GITHUB_STEP_SUMMARY
echo "|------|--------|" >> $GITHUB_STEP_SUMMARY
echo "| Unit | ✅ |" >> $GITHUB_STEP_SUMMARY
```

These appear as formatted markdown in the Actions summary.

### Artifacts

Download from Actions → Run → Artifacts:
- `coverage-report` - Test coverage
- `playwright-report` - E2E test results
- `playwright-screenshots` - Failed test screenshots

---

## Troubleshooting CI Failures

### Unit Tests Failing

```bash
# Run locally with same environment
export CI=true
npm run test
```

### Integration Tests Failing

```bash
# Start test database
npm run db:test:start

# Check database setup
export DATABASE_URL="postgresql://hta_test:hta_test_password@localhost:5433/hta_calibration_test"
npx prisma db push
npm run test:integration

# Check specific test
npx vitest run tests/integration/api/certificates.test.ts
```

### E2E Tests Failing

```bash
# Run with debug
npx playwright test --debug

# Check screenshot artifacts
# Download from GitHub Actions artifacts
```

### Build Failing

```bash
# Check Prisma generation
npx prisma generate

# Build locally
npm run build
```

---

## Customizing CI

### Adding a New Test Job

```yaml
my-new-tests:
  name: My New Tests
  runs-on: ubuntu-latest
  needs: code-quality

  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    - run: npm ci
    - run: npm run my-new-test-command
```

### Making a Check Required

In GitHub repository settings:
1. Settings → Branches → Branch protection rules
2. Add required status check
3. Select the job name
