# Nightly Checks

## Workflow Configuration

**File**: `.github/workflows/nightly.yml`

**Schedule**: Daily at 2:00 AM UTC (7:30 AM IST)

---

## Purpose

```
┌─────────────────────────────────────────────────────────────────┐
│                    NIGHTLY CHECKS PURPOSE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  WHY RUN NIGHTLY?                                               │
│                                                                  │
│  1. COMPREHENSIVE TESTING                                       │
│     ├── Full browser matrix (Chromium, Firefox, WebKit)        │
│     ├── Complete E2E test suite                                │
│     └── Tests that are too slow for every PR                   │
│                                                                  │
│  2. SECURITY MONITORING                                         │
│     ├── Full dependency audit                                  │
│     ├── Vulnerability detection                                │
│     └── Alert on new issues                                    │
│                                                                  │
│  3. DEPENDENCY HEALTH                                           │
│     ├── Check for outdated packages                            │
│     ├── Identify major version updates                         │
│     └── Plan upgrade schedule                                  │
│                                                                  │
│  4. QUALITY ASSURANCE                                           │
│     ├── Accessibility audit (WCAG 2.1 AA)                      │
│     ├── Visual regression detection                            │
│     └── Bundle size monitoring                                 │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Jobs Overview

### 1. Full Test Suite

```yaml
full-test-suite:
  name: Full Test Suite
  runs-on: ubuntu-latest

  steps:
    # Run all unit tests
    - run: npm run test:coverage

    # Run integration tests (PostgreSQL service container)
    - run: npm run test:integration
      env:
        DATABASE_URL: postgresql://test:test@localhost:5432/hta_test

    # Run E2E on ALL browsers
    - run: npx playwright test --project=chromium --project=firefox --project=webkit
```

**What's different from CI**:
- E2E runs on **all 3 browsers** (CI only runs Chromium)
- More time allowed (no PR blocking)
- Complete coverage report

### 2. Security Audit

```yaml
security-audit:
  name: Security Audit
  runs-on: ubuntu-latest

  steps:
    - run: npm audit --json > audit-report.json

    # Parse and summarize vulnerabilities
    - run: |
        CRITICAL=$(jq '.metadata.vulnerabilities.critical // 0' audit-report.json)
        HIGH=$(jq '.metadata.vulnerabilities.high // 0' audit-report.json)

        if [ "$CRITICAL" -gt "0" ] || [ "$HIGH" -gt "0" ]; then
          echo "⚠️ Action Required: High or critical vulnerabilities found!"
        fi
```

**Artifact**: `security-audit-report` (retained 30 days)

### 3. Dependency Check

```yaml
dependency-check:
  name: Dependency Check
  runs-on: ubuntu-latest

  steps:
    - run: npm outdated >> $GITHUB_STEP_SUMMARY 2>&1 || true

    - run: |
        npm outdated --json > outdated.json || true
        MAJORS=$(jq 'to_entries | map(select(.value.current != .value.latest)) | length' outdated.json)
        echo "📦 $MAJORS packages have updates available"
```

**Output**: List of outdated packages with versions

### 4. Build Verification

```yaml
build-check:
  name: Build Verification
  runs-on: ubuntu-latest

  steps:
    - run: npm run build

    - run: |
        echo "### Bundle Analysis" >> $GITHUB_STEP_SUMMARY
        du -sh .next/ >> $GITHUB_STEP_SUMMARY
```

**Purpose**: Catch build regressions that might not show in tests

### 5. Accessibility Audit

```yaml
accessibility-audit:
  name: Accessibility Audit
  runs-on: ubuntu-latest

  steps:
    - run: npm run test:a11y
      continue-on-error: true  # Report but don't fail
```

**WCAG 2.1 AA Checks**:
- Color contrast ratios (4.5:1 minimum)
- Keyboard navigation
- ARIA labels and roles
- Focus indicators
- Form accessibility

### 6. Visual Regression

```yaml
visual-regression:
  name: Visual Regression
  runs-on: ubuntu-latest

  steps:
    - run: npm run test:visual
      continue-on-error: true  # May fail without baselines
```

**Screenshots captured**:
- Login page
- Dashboard
- Certificate form
- PDF preview

**Artifact**: `visual-snapshots` for manual review

---

## Viewing Results

### GitHub Actions Summary

1. Go to repository → Actions
2. Click "Nightly Checks" workflow
3. View job summaries

### Artifacts

Download from completed run:
- `nightly-coverage-report` - Code coverage
- `nightly-playwright-report` - E2E test report
- `security-audit-report` - npm audit results
- `accessibility-report` - A11y issues
- `visual-snapshots` - Screenshot comparisons

### Email Notifications

Configure in repository settings:
- Settings → Notifications
- "Send notifications for failed workflows only"

---

## Common Issues

### Test Failures Only on Certain Browsers

```
Firefox/WebKit specific failures:
├── CSS rendering differences
├── Event timing differences
└── API behavior variations

Action:
├── Review Playwright report
├── Add browser-specific waits if needed
└── Consider if fix is worth complexity
```

### Security Vulnerabilities Reported

```
Review priority:
├── Critical → Fix immediately
├── High → Fix within 1 week
├── Moderate → Fix within 1 month
└── Low → Track, fix opportunistically

Actions:
├── npm audit fix (for minor updates)
├── Manual upgrade for major versions
└── Add to dependabot ignore if false positive
```

### Outdated Dependencies

```
Update strategy:
├── Patch versions: Update immediately
├── Minor versions: Update weekly
├── Major versions: Plan migration

Process:
├── Create branch
├── Update package
├── Run full test suite
├── Review breaking changes
└── Merge when stable
```

---

## Manual Trigger

Run nightly checks manually:

```bash
# Via GitHub CLI
gh workflow run nightly.yml

# Via GitHub UI
# Actions → Nightly Checks → Run workflow
```

---

## Customizing Nightly Checks

### Add New Test Job

```yaml
my-nightly-check:
  name: My Custom Check
  runs-on: ubuntu-latest

  steps:
    - uses: actions/checkout@v4
    - uses: actions/setup-node@v4
      with:
        node-version: '20'
        cache: 'npm'
    - run: npm ci
    - run: npm run my-custom-check
```

### Change Schedule

```yaml
on:
  schedule:
    # Run at midnight UTC
    - cron: '0 0 * * *'

    # Run twice daily (midnight and noon)
    - cron: '0 0,12 * * *'

    # Run only on weekdays
    - cron: '0 2 * * 1-5'
```

### Skip Jobs on Certain Days

```yaml
my-job:
  if: github.event_name != 'schedule' || (github.event_name == 'schedule' && contains('Mon,Wed,Fri', steps.day.outputs.name))
  steps:
    - id: day
      run: echo "name=$(date +%a)" >> $GITHUB_OUTPUT
```

---

## Monitoring Nightly Health

### Track Over Time

- Keep historical reports in artifacts
- Compare week-over-week vulnerability counts
- Monitor test flakiness

### Alert on Degradation

```yaml
- name: Alert on failures
  if: failure()
  run: |
    # Send Slack notification
    curl -X POST $SLACK_WEBHOOK \
      -H 'Content-type: application/json' \
      --data '{"text":"🚨 Nightly checks failed!"}'
```
