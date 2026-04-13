# Performance Baselines

**Last Updated:** 2026-04-13
**Environment:** Production (GKE/Cloud Run)

---

## API Response Time Targets

| Endpoint Category | p50 | p95 | p99 | Max |
|-------------------|-----|-----|-----|-----|
| Health checks (`/api/health`) | 10ms | 50ms | 100ms | 200ms |
| Readiness (`/api/health/ready`) | 50ms | 200ms | 500ms | 1000ms |
| Certificate list | 100ms | 300ms | 500ms | 1000ms |
| Certificate detail | 50ms | 150ms | 300ms | 500ms |
| Certificate search | 100ms | 300ms | 500ms | 800ms |
| Dashboard stats | 100ms | 300ms | 500ms | 800ms |
| PDF generation | 1000ms | 3000ms | 5000ms | 10000ms |

---

## Throughput Targets

| Scenario | Target RPS | Max Concurrent | Error Rate |
|----------|------------|----------------|------------|
| Normal operation | 50 | 100 | < 0.1% |
| Peak load | 100 | 200 | < 0.5% |
| Safe load test | 20 | 20 | < 1% |

---

## Resource Utilization Targets

| Resource | Normal | Warning | Critical |
|----------|--------|---------|----------|
| CPU | < 50% | 70% | 85% |
| Memory | < 60% | 75% | 90% |
| DB connections | < 50% | 70% | 85% |
| Cache hit rate | > 80% | 70% | 50% |

---

## Database Query Targets

| Query Type | Target | Slow Query Threshold |
|------------|--------|---------------------|
| Simple SELECT | < 50ms | 100ms |
| JOIN queries | < 100ms | 300ms |
| Aggregations | < 200ms | 500ms |
| Writes (INSERT/UPDATE) | < 100ms | 300ms |

---

## How to Measure

### 1. Run Local Load Test

```bash
# Install k6
brew install k6  # macOS
# or
choco install k6  # Windows

# Start local server
npm run dev

# Run smoke test
k6 run --env BASE_URL=http://localhost:3000 tests/load/health-check.js
```

### 2. Run Production Load Test (Safe)

```bash
# Smoke test - minimal load
k6 run \
  --env BASE_URL=https://hta-calibration.com \
  --env PROFILE=smoke \
  tests/load/health-check.js

# Gentle test - baseline measurement
k6 run \
  --env BASE_URL=https://hta-calibration.com \
  --env PROFILE=gentle \
  --env AUTH_TOKEN=<your-session-token> \
  tests/load/read-only-workflow.js
```

### 3. Via GitHub Actions

1. Go to Actions > "Load Tests (Production)"
2. Click "Run workflow"
3. Select profile (smoke/gentle/moderate)
4. Select test suite
5. Type "production" to confirm
6. Click "Run workflow"

---

## Monitoring During Tests

### What to Watch

1. **Sentry Dashboard**
   - Error rate spike
   - New error types
   - Performance degradation

2. **Cloud Run/GKE Metrics**
   - CPU utilization
   - Memory usage
   - Request latency
   - Instance count

3. **Cloud SQL Metrics**
   - Active connections
   - CPU utilization
   - Query latency

### Abort Criteria

Stop the test immediately if:

- Error rate > 5%
- Response time p95 > 2x baseline
- CPU > 90% sustained
- Memory > 95%
- User complaints received

---

## Baseline Update Schedule

| Frequency | Action |
|-----------|--------|
| Weekly | Automated smoke test (Sunday 3 AM UTC) |
| Monthly | Manual gentle load test, update baselines |
| After deployment | Verify no regression with smoke test |
| After scaling | Re-establish baselines with gentle test |

---

## Historical Baselines

| Date | Test | p95 | Notes |
|------|------|-----|-------|
| 2026-04-13 | Initial | TBD | Baseline to be established |

---

## Troubleshooting

### High Response Times

1. Check database query performance
2. Verify cache hit rates
3. Check for N+1 queries
4. Review recent deployments

### High Error Rates

1. Check application logs
2. Review Sentry for error details
3. Verify database connectivity
4. Check external service dependencies

### Memory Issues

1. Check for memory leaks
2. Review recent code changes
3. Verify cache eviction policies
4. Consider scaling up instances
