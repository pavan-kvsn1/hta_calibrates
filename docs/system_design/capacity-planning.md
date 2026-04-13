# Capacity Planning

**Last Updated:** 2026-04-13

---

## Current Infrastructure

### GKE Production

| Setting | Value |
|---------|-------|
| Min replicas | 2 |
| Max replicas | 10 |
| CPU request | 500m |
| CPU limit | 2000m |
| Memory request | 512Mi |
| Memory limit | 2Gi |
| HPA CPU target | 70% |
| HPA Memory target | 80% |

### Cloud SQL (PostgreSQL)

| Setting | Value |
|---------|-------|
| Instance type | db-custom-2-4096 |
| vCPUs | 2 |
| Memory | 4 GB |
| Storage | 100 GB SSD |
| Max connections | 100 |
| High availability | Yes (regional) |

### Redis (Memorystore)

| Setting | Value |
|---------|-------|
| Tier | Basic |
| Memory | 1 GB |
| Max connections | 65,000 |

---

## Capacity Estimates

### Per-Instance Capacity

| Metric | Estimate |
|--------|----------|
| Concurrent requests | 80 |
| Requests/second | ~50 |
| Memory per request | ~25 MB |
| CPU per request | ~50ms |

### Total System Capacity (Current: 2-10 instances)

| Metric | Min (2 pods) | Max (10 pods) |
|--------|--------------|---------------|
| Concurrent users | 160 | 800 |
| Requests/second | 100 | 500 |
| Daily requests | ~2M | ~10M |

---

## Scaling Triggers

### Horizontal Pod Autoscaler (HPA)

```yaml
spec:
  minReplicas: 2
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Percent
          value: 100
          periodSeconds: 15
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Percent
          value: 50
          periodSeconds: 60
```

### Scale-Up Triggers

| Condition | Action |
|-----------|--------|
| CPU > 70% for 60s | Add 1 pod |
| Memory > 80% for 60s | Add 1 pod |
| Request queue > 100 | Add 2 pods |

### Scale-Down Triggers

| Condition | Action |
|-----------|--------|
| CPU < 30% for 5 min | Remove 1 pod |
| Memory < 40% for 5 min | Remove 1 pod |
| Min pods: 2 | Never go below |

---

## Bottleneck Analysis

| Component | Potential Bottleneck | Mitigation |
|-----------|---------------------|------------|
| Database connections | 100 max connections | PgBouncer, connection pooling |
| PDF generation | CPU intensive | Async queue, dedicated workers |
| Search queries | Complex JOINs | Caching, pagination, indexes |
| File uploads | Memory consumption | Streaming uploads |
| Email sending | External rate limits | Queue with rate limiting |

---

## Growth Projections

| Timeframe | Users | Daily Certs | Recommended Infrastructure |
|-----------|-------|-------------|---------------------------|
| Current | 50 | 100 | 2-3 pods, current DB |
| 6 months | 200 | 500 | 3-5 pods, current DB |
| 1 year | 500 | 1,500 | 5-7 pods, DB upgrade |
| 2 years | 1,000 | 3,000 | 7-10 pods, read replica |

### When to Scale Database

| Trigger | Action |
|---------|--------|
| Connections > 80 avg | Add PgBouncer |
| CPU > 70% sustained | Upgrade instance |
| Storage > 80% | Increase disk |
| Read latency > 100ms | Add read replica |

---

## Cost Estimates

### Current Monthly Cost

| Service | Estimate |
|---------|----------|
| GKE (2-3 pods) | $100-150 |
| Cloud SQL | $100-150 |
| Memorystore | $50 |
| Storage (GCS) | $20 |
| Networking | $30 |
| **Total** | **$300-400** |

### Scaled Monthly Cost (10 pods)

| Service | Estimate |
|---------|----------|
| GKE (10 pods) | $400-500 |
| Cloud SQL (upgraded) | $200-300 |
| Memorystore | $100 |
| Storage | $50 |
| Networking | $100 |
| **Total** | **$850-1,050** |

---

## Capacity Testing

### Safe Production Tests

```bash
# Smoke test - validate system
k6 run --env PROFILE=smoke tests/load/health-check.js

# Gentle test - measure baseline
k6 run --env PROFILE=gentle tests/load/read-only-workflow.js

# Moderate test - max safe load
k6 run --env PROFILE=moderate tests/load/dashboard.js
```

### Capacity Limits (Do NOT Run on Production)

These tests should only be run locally or with a staging environment:

```bash
# Stress test - find breaking point
k6 run --env PROFILE=stress --env BASE_URL=http://localhost:3000 tests/load/health-check.js
```

---

## Alerting Thresholds

| Metric | Warning | Critical |
|--------|---------|----------|
| Pod CPU | 70% | 85% |
| Pod Memory | 75% | 90% |
| DB CPU | 60% | 80% |
| DB Connections | 70 | 90 |
| Error Rate | 1% | 5% |
| P95 Latency | 500ms | 1000ms |

---

## Disaster Recovery Impact

| Scenario | Capacity Impact |
|----------|-----------------|
| Single pod failure | -10% capacity (HPA compensates) |
| Zone failure | -33% capacity (multi-zone) |
| Database failover | 30-60s downtime, full recovery |
| Redis failure | Degraded (cache miss), recoverable |

---

## Recommendations

### Short Term (0-6 months)

1. Maintain 2-pod minimum for redundancy
2. Monitor HPA scaling patterns
3. Establish performance baselines
4. Set up alerting thresholds

### Medium Term (6-12 months)

1. Evaluate PgBouncer if connections > 70
2. Consider read replica if read latency increases
3. Review and optimize slow queries
4. Implement request rate limiting

### Long Term (1-2 years)

1. Evaluate database upgrade path
2. Consider regional expansion
3. Review CDN for static assets
4. Evaluate API gateway for rate limiting
