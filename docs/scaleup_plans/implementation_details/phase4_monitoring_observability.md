# Phase 4: Monitoring & Observability - Implementation Details

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Phase**: 4 - Monitoring & Observability
- **Status**: 5% Complete

---

## Overview

Phase 4 focuses on implementing comprehensive monitoring, logging, tracing, and alerting to ensure visibility into system health and rapid incident response.

---

## Implementation Status

### Summary

| Component | Status | Completion |
|-----------|--------|------------|
| Health Check Endpoints | Complete | 100% |
| Application Metrics | Not Started | 0% |
| Infrastructure Metrics | Not Started | 0% |
| Structured Logging | Partial | 20% |
| Distributed Tracing | Not Started | 0% |
| Alerting Rules | Not Started | 0% |
| Dashboards | Not Started | 0% |
| Runbooks | Not Started | 0% |

**Overall Phase Completion: 5%**

---

## Implemented Components

### 1. Health Check Endpoints

**Status**: Complete (100%)

| Endpoint | Purpose | Checks |
|----------|---------|--------|
| `/api/health` | Liveness probe | Application running |
| `/api/health/ready` | Readiness probe | Database connection |

#### Implementation Details

**Liveness (`src/app/api/health/route.ts`)**:
- Returns 200 if application is responding
- Used by Kubernetes liveness probe
- Used by Docker HEALTHCHECK

**Readiness (`src/app/api/health/ready/route.ts`)**:
- Checks database connectivity
- Returns 503 if dependencies unavailable
- Used by Kubernetes readiness probe

---

## Not Yet Implemented

### 2. Application Metrics (0%)

#### Planned Metrics

**HTTP Request Metrics**:
- `http_request_duration_seconds` (histogram)
- `http_requests_total` (counter by status, method, path)
- `http_request_size_bytes` (histogram)
- `http_response_size_bytes` (histogram)

**Business Metrics**:
- `certificates_created_total` (counter)
- `certificates_approved_total` (counter)
- `certificates_signed_total` (counter)
- `customer_reviews_total` (counter)
- `pdf_generations_total` (counter)
- `pdf_generation_duration_seconds` (histogram)

**Runtime Metrics**:
- `nodejs_heap_size_bytes` (gauge)
- `nodejs_active_handles` (gauge)
- `nodejs_active_requests` (gauge)
- `process_cpu_seconds_total` (counter)

#### Implementation Plan

1. [ ] Install `prom-client` package
2. [ ] Create metrics middleware
3. [ ] Add `/metrics` endpoint
4. [ ] Instrument key code paths

---

### 3. Infrastructure Metrics (0%)

**Planned Sources**:

| Source | Metrics |
|--------|---------|
| GKE | Node CPU, memory, disk, network |
| Pods | Container resources, restarts |
| Cloud SQL | CPU, memory, connections, queries |
| Load Balancer | Requests, latency, errors |

**Implementation**: Automatic via GCP Cloud Monitoring once infrastructure is deployed (Phase 3 dependency).

---

### 4. Structured Logging (20%)

**Current State**:
- Basic `console.log` statements
- No structured format

**Planned Improvements**:
1. [ ] Install `pino` or `winston` logger
2. [ ] Configure structured JSON output
3. [ ] Add correlation IDs for request tracing
4. [ ] Configure log levels by environment
5. [ ] Remove `console.log` statements

#### Log Format (Planned)

```json
{
  "timestamp": "2026-03-17T10:30:00.000Z",
  "level": "info",
  "message": "Certificate created",
  "correlationId": "abc-123",
  "userId": "user-456",
  "certificateId": "cert-789",
  "duration": 150
}
```

---

### 5. Distributed Tracing (0%)

**Planned Implementation**:

1. [ ] Install OpenTelemetry SDK
2. [ ] Configure trace exporter (Cloud Trace)
3. [ ] Instrument HTTP handlers
4. [ ] Add custom spans for key operations
5. [ ] Propagate trace context

#### Key Traces (Planned)

- Certificate creation flow
- PDF generation
- Digital signature process
- Customer review workflow
- Authorization workflow

---

### 6. Alerting Rules (0%)

**Planned Alert Categories**:

| Category | Metrics | Threshold |
|----------|---------|-----------|
| Availability | Health check failures | 3 consecutive |
| Latency | P95 response time | > 2 seconds |
| Error Rate | 5xx responses | > 5% for 5 min |
| Resources | CPU usage | > 80% for 10 min |
| Resources | Memory usage | > 85% |
| Database | Connection pool | > 90% utilized |
| Business | Certificate processing | Backlog > 100 |

**Notification Channels**:
- Slack (#incidents, #alerts)
- Email (on-call)
- PagerDuty (critical only)

---

### 7. Dashboards (0%)

**Planned Dashboards**:

#### Overview Dashboard
- Application health status
- Request rate and error rate
- Response time distribution
- Active users

#### Business Dashboard
- Certificates created/day
- Approval pipeline status
- Customer review metrics
- TAT performance

#### Infrastructure Dashboard
- GKE node status
- Pod health and restarts
- Database performance
- Network throughput

#### On-Call Dashboard
- Active alerts
- Error logs stream
- Key SLIs status
- Recent deployments

---

### 8. Runbooks (0%)

**Planned Runbooks**:

1. [ ] High CPU Alert Response
2. [ ] Database Connection Issues
3. [ ] Certificate Processing Delays
4. [ ] PDF Generation Failures
5. [ ] Authentication Errors
6. [ ] Deployment Rollback

---

## Prerequisites

### From Phase 3 (Required)
- [ ] GCP project set up
- [ ] Cloud Monitoring enabled
- [ ] Cloud Logging enabled
- [ ] Cloud Trace enabled

### Dependencies
- [ ] OpenTelemetry SDK
- [ ] Prometheus client library
- [ ] Structured logging library

---

## Implementation Roadmap

### Step 1: Structured Logging

1. [ ] Install logging library (pino)
2. [ ] Create logger configuration
3. [ ] Replace console.log statements
4. [ ] Add request correlation IDs
5. [ ] Configure Cloud Logging export

### Step 2: Application Metrics

1. [ ] Install prom-client
2. [ ] Create metrics registry
3. [ ] Add HTTP middleware
4. [ ] Instrument business operations
5. [ ] Expose /metrics endpoint

### Step 3: Tracing

1. [ ] Install OpenTelemetry
2. [ ] Configure Cloud Trace exporter
3. [ ] Add instrumentation
4. [ ] Create custom spans

### Step 4: Alerting

1. [ ] Define SLOs and SLIs
2. [ ] Create alert policies
3. [ ] Configure notification channels
4. [ ] Test alert delivery

### Step 5: Dashboards

1. [ ] Create Cloud Monitoring dashboards
2. [ ] Set up Grafana (optional)
3. [ ] Document dashboard usage

### Step 6: Runbooks

1. [ ] Write incident response procedures
2. [ ] Create troubleshooting guides
3. [ ] Document escalation paths

---

## SLOs and SLIs (Proposed)

| SLI | SLO | Measurement |
|-----|-----|-------------|
| Availability | 99.9% | Successful health checks |
| Latency | 95th percentile < 500ms | Request duration |
| Error Rate | < 1% | 5xx responses |
| Certificate Processing | 99% within TAT | Business metric |

---

## Verification Checklist

### Logging
- [ ] All log output is structured JSON
- [ ] Correlation IDs present in logs
- [ ] Logs searchable in Cloud Logging

### Metrics
- [ ] `/metrics` endpoint returns Prometheus format
- [ ] Key business metrics tracked
- [ ] Metrics visible in Cloud Monitoring

### Tracing
- [ ] Traces visible in Cloud Trace
- [ ] Cross-service correlation works
- [ ] Span timing accurate

### Alerting
- [ ] All critical paths have alerts
- [ ] Alerts fire correctly (tested)
- [ ] Notifications reach on-call

### Dashboards
- [ ] Overview dashboard complete
- [ ] Business metrics visible
- [ ] Infrastructure metrics visible

---

## Files Reference (Planned)

### Logging
- `src/lib/logger.ts` - Logger configuration
- `src/lib/middleware/logging.ts` - Request logging

### Metrics
- `src/lib/metrics.ts` - Metrics registry
- `src/lib/middleware/metrics.ts` - HTTP metrics
- `src/app/api/metrics/route.ts` - Metrics endpoint

### Tracing
- `src/lib/tracing.ts` - OpenTelemetry setup
- `src/instrumentation.ts` - Next.js instrumentation

### Alerting
- `terraform/modules/monitoring/alerts.tf` - Alert policies

### Dashboards
- `terraform/modules/monitoring/dashboards.tf` - Dashboard definitions

---

## Related Documents

- [Monitoring & Observability Plan](../detailed_plan/07_monitoring_observability.md)
- [Scale-Up Overview](../detailed_plan/00_scaleup_overview.md)
