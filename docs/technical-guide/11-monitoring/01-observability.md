# Observability Overview

## Three Pillars of Observability

```
┌─────────────────────────────────────────────────────────────────┐
│                   THREE PILLARS                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐         │
│  │    LOGS     │    │   METRICS   │    │   TRACES    │         │
│  ├─────────────┤    ├─────────────┤    ├─────────────┤         │
│  │ What        │    │ How much    │    │ How long    │         │
│  │ happened?   │    │ & how many? │    │ & where?    │         │
│  ├─────────────┤    ├─────────────┤    ├─────────────┤         │
│  │ Debugging   │    │ Alerting    │    │ Performance │         │
│  │ Auditing    │    │ Dashboards  │    │ Bottlenecks │         │
│  └─────────────┘    └─────────────┘    └─────────────┘         │
│        │                  │                  │                  │
│        └──────────────────┼──────────────────┘                  │
│                           ▼                                      │
│                  ┌─────────────────┐                            │
│                  │  OBSERVABILITY  │                            │
│                  │  Understanding  │                            │
│                  │  system state   │                            │
│                  └─────────────────┘                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Logs

### What We Log

| Category | Examples | Log Level |
|----------|----------|-----------|
| Errors | API failures, DB errors | `console.error` |
| Security | Auth failures, permission denied | `console.warn` |
| Business events | Certificate created, status changed | `console.log` |
| Debug | Request details, function entry/exit | `console.log` (dev only) |

### Logging Patterns in Code

```typescript
// Error logging with context
catch (error) {
  console.error('Failed to create certificate:', {
    userId: session.user.id,
    input: sanitizedInput,
    error: error instanceof Error ? error.message : 'Unknown error'
  })
  throw error
}

// Security event logging
console.warn('Unauthorized access attempt:', {
  userId: session?.user?.id || 'anonymous',
  resource: certificateId,
  action: 'DELETE',
  ip: request.headers.get('x-forwarded-for')
})

// Business event logging
console.log('Certificate submitted for review:', {
  certificateId,
  userId: session.user.id,
  reviewerId,
  timestamp: new Date().toISOString()
})
```

### Log Output in Different Environments

| Environment | Log Destination | Format |
|-------------|-----------------|--------|
| Development | Terminal (stdout) | Readable text |
| Docker | Container stdout | JSON (structured) |
| Kubernetes | Cloud Logging | JSON (automatic) |

### Viewing Logs

```bash
# Local development
npm run dev
# Logs appear in terminal

# Docker
docker logs hta-calibration-web -f

# Kubernetes
kubectl logs -f deployment/hta-web -n hta-calibration

# GCP Cloud Logging
gcloud logging read \
  "resource.type=k8s_container AND resource.labels.namespace_name=hta-calibration" \
  --limit=50 \
  --format="table(timestamp, jsonPayload.message)"
```

---

## Metrics

### Types of Metrics

| Type | Description | Example |
|------|-------------|---------|
| **Counter** | Cumulative value that only increases | Total requests, errors |
| **Gauge** | Value that can go up or down | Active connections, memory |
| **Histogram** | Distribution of values | Request latency, response size |
| **Summary** | Statistical distribution | p50, p95, p99 latencies |

### Current Metrics Sources

```
┌─────────────────────────────────────────────────────────────────┐
│                     METRICS SOURCES                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌───────────────────┐                                          │
│  │   GKE METRICS     │                                          │
│  │   SERVER          │                                          │
│  │   ┌─────────────┐ │                                          │
│  │   │ CPU usage   │ │──────────────────┐                       │
│  │   │ Memory      │ │                  │                       │
│  │   │ Network     │ │                  │                       │
│  │   └─────────────┘ │                  ▼                       │
│  └───────────────────┘         ┌─────────────────┐              │
│                                │     CLOUD       │              │
│  ┌───────────────────┐         │   MONITORING    │              │
│  │   GKE MANAGED     │         │                 │              │
│  │   PROMETHEUS      │────────▶│  Dashboards     │              │
│  │   (if enabled)    │         │  Alerting       │              │
│  └───────────────────┘         │  Queries        │              │
│                                └─────────────────┘              │
│  ┌───────────────────┐                  ▲                       │
│  │   CLOUD SQL       │                  │                       │
│  │   INSIGHTS        │──────────────────┘                       │
│  │   ┌─────────────┐ │                                          │
│  │   │ Connections │ │                                          │
│  │   │ Query stats │ │                                          │
│  │   │ CPU/Memory  │ │                                          │
│  │   └─────────────┘ │                                          │
│  └───────────────────┘                                          │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Key Metrics to Monitor

**Application Health**
| Metric | Source | Threshold |
|--------|--------|-----------|
| HTTP 5xx rate | Cloud Logging | < 1% |
| Request latency (p95) | Cloud Monitoring | < 2s |
| Active requests | HPA | Varies |

**Resource Usage**
| Metric | Source | Threshold |
|--------|--------|-----------|
| Pod CPU | Metrics Server | < 70% avg |
| Pod Memory | Metrics Server | < 80% |
| Node CPU | GKE | < 85% |
| Node Memory | GKE | < 85% |

**Database**
| Metric | Source | Threshold |
|--------|--------|-----------|
| Connections | Cloud SQL | < 80% max |
| CPU | Cloud SQL | < 80% |
| Storage | Cloud SQL | < 80% |
| Replication lag | Cloud SQL | < 1s |

### HPA Metrics

The Horizontal Pod Autoscaler uses these metrics:

```yaml
# From k8s/base/hpa.yaml
metrics:
  - type: Resource
    resource:
      name: cpu
      target:
        type: Utilization
        averageUtilization: 70    # Scale up when > 70%
  - type: Resource
    resource:
      name: memory
      target:
        type: Utilization
        averageUtilization: 80    # Scale up when > 80%
```

---

## Traces (Planned)

Distributed tracing is not yet implemented but is planned.

### Future Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                   DISTRIBUTED TRACING (FUTURE)                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Request Flow with Trace ID:                                    │
│                                                                  │
│  ┌─────────┐    ┌─────────┐    ┌─────────┐    ┌─────────┐      │
│  │ Browser │───▶│ Next.js │───▶│  API    │───▶│ Database│      │
│  │         │    │         │    │ Route   │    │         │      │
│  └─────────┘    └─────────┘    └─────────┘    └─────────┘      │
│       │              │              │              │            │
│       │              │              │              │            │
│       └──────────────┴──────────────┴──────────────┘            │
│                         │                                        │
│                         ▼                                        │
│              trace-id: abc-123-xyz                              │
│              ├── span: browser (0-100ms)                        │
│              ├── span: next-server (100-150ms)                  │
│              ├── span: api-route (150-200ms)                    │
│              └── span: db-query (200-250ms)                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Potential Implementation

```typescript
// Future: Using OpenTelemetry
import { trace } from '@opentelemetry/api'

const tracer = trace.getTracer('hta-calibration')

export async function createCertificate(input: CertificateInput) {
  return tracer.startActiveSpan('createCertificate', async (span) => {
    span.setAttribute('customerName', input.customerName)

    try {
      const result = await prisma.certificate.create({ ... })
      span.setStatus({ code: SpanStatusCode.OK })
      return result
    } catch (error) {
      span.setStatus({ code: SpanStatusCode.ERROR, message: error.message })
      throw error
    } finally {
      span.end()
    }
  })
}
```

---

## Log Aggregation Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   LOG AGGREGATION FLOW                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Application Container                                          │
│  ┌─────────────────────────────────────────┐                   │
│  │  console.log('message')                  │                   │
│  │  console.error('error')                  │                   │
│  │           │                              │                   │
│  │           ▼                              │                   │
│  │  stdout/stderr                           │                   │
│  └───────────┼──────────────────────────────┘                   │
│              │                                                   │
│              ▼                                                   │
│  ┌─────────────────────────────────────────┐                   │
│  │  Container Runtime (containerd)          │                   │
│  │  Captures stdout/stderr                  │                   │
│  └───────────┼──────────────────────────────┘                   │
│              │                                                   │
│              ▼                                                   │
│  ┌─────────────────────────────────────────┐                   │
│  │  GKE Logging Agent (Fluentd)            │                   │
│  │  ┌─────────────────────────────────┐    │                   │
│  │  │ - Parses JSON if structured     │    │                   │
│  │  │ - Adds K8s metadata             │    │                   │
│  │  │ - Buffers and batches           │    │                   │
│  │  └─────────────────────────────────┘    │                   │
│  └───────────┼──────────────────────────────┘                   │
│              │                                                   │
│              ▼                                                   │
│  ┌─────────────────────────────────────────┐                   │
│  │  GCP Cloud Logging                       │                   │
│  │  ┌─────────────────────────────────┐    │                   │
│  │  │ - Indexed for fast search       │    │                   │
│  │  │ - 30-day retention (default)    │    │                   │
│  │  │ - Log-based metrics             │    │                   │
│  │  │ - Export to BigQuery/GCS        │    │                   │
│  │  └─────────────────────────────────┘    │                   │
│  └──────────────────────────────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Structured Logging Best Practices

### Good Logging

```typescript
// Structured with context
console.log(JSON.stringify({
  event: 'certificate_created',
  certificateId: cert.id,
  certificateNumber: cert.certificateNumber,
  userId: session.user.id,
  timestamp: new Date().toISOString()
}))

// Error with stack trace
console.error(JSON.stringify({
  event: 'certificate_creation_failed',
  error: error.message,
  stack: error.stack,
  userId: session.user.id,
  input: sanitizedInput  // Remove sensitive data
}))
```

### Bad Logging

```typescript
// Unstructured, hard to search
console.log('Created certificate ' + cert.id)

// Sensitive data exposure
console.log('User logged in:', { password: input.password })  // NEVER!

// Too verbose
console.log('Entering function...')
console.log('Step 1 complete')
console.log('Step 2 complete')  // Noise in production
```

### What to Log

| Do Log | Don't Log |
|--------|-----------|
| User IDs | Passwords |
| Action taken | Credit card numbers |
| Resource IDs | Session tokens |
| Error messages | Personal data (PII) |
| Timestamps | API keys |

---

## Alert Fatigue Prevention

### Alert Classification

| Severity | Response | Example |
|----------|----------|---------|
| **Critical** | Immediate (wake up) | Site down, data loss |
| **High** | Within 1 hour | Error rate > 5%, DB down |
| **Medium** | Within 4 hours | Elevated latency |
| **Low** | Next business day | Disk at 70% |

### Good Alerting Practices

```yaml
# Good: Actionable, specific
- name: High Error Rate
  condition: error_rate > 5% for 5 minutes
  action: Page on-call, check logs, consider rollback

# Bad: Not actionable
- name: Any Error
  condition: any_error_logged
  action: ???  # Too noisy, will be ignored
```

---

## Monitoring Checklist

### Development

- [ ] Console logs appear in terminal
- [ ] Error boundaries catch and log errors
- [ ] Health endpoints return correct status

### Staging

- [ ] Logs flow to Cloud Logging
- [ ] Basic metrics visible in Cloud Monitoring
- [ ] Alert policies tested (manually trigger)

### Production

- [ ] All logs aggregated in Cloud Logging
- [ ] Dashboard shows key metrics
- [ ] Alert policies configured
- [ ] On-call rotation set up
- [ ] Runbooks documented
