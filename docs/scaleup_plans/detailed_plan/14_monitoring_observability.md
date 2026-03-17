# HTA Calibration - Monitoring & Observability Strategy

## Document Version
- **Version**: 2.0.0
- **Created**: 2026-02-04
- **Last Updated**: 2026-03-17
- **Phase**: 4 - Monitoring & Observability
- **Status**: 5% Complete (Health Endpoints Only)

> **Implementation Status**: See [Phase 4 Implementation Details](../implementation_details/phase4_monitoring_observability.md) for current implementation status.

---

## 📚 Learning Resources

Before setting up monitoring, make sure you understand the underlying concepts:

| Topic | System Design Document | What You'll Learn |
|-------|------------------------|-------------------|
| **Observability Concepts** | [15_monitoring.md](../../system_design/15_monitoring.md) | The three pillars (Metrics, Logs, Traces), SLIs/SLOs, alerting |
| **GCP Monitoring Services** | [15_monitoring.md](../../system_design/15_monitoring.md) | Cloud Monitoring, Cloud Logging, Cloud Trace |
| **GCP Fundamentals** | [06_gcp_fundamentals.md](../../system_design/06_gcp_fundamentals.md) | GCP service integration for observability |
| **Disaster Recovery** | [16_disaster_recovery.md](../../system_design/16_disaster_recovery.md) | Monitoring in context of incident response |

> 💡 **Tip**: If terms like "SLI", "SLO", "P95 latency", or "structured logging" are unfamiliar, read `15_monitoring.md` first!

---

## Overview

This document outlines the comprehensive monitoring, logging, tracing, and alerting strategy for the HTA Calibration system to ensure visibility, reliability, and rapid incident response.

---

## Observability Pillars

### Three Pillars Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           OBSERVABILITY ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│                              ┌─────────────────┐                                │
│                              │   DASHBOARDS    │                                │
│                              │   & ALERTING    │                                │
│                              └────────┬────────┘                                │
│                                       │                                         │
│              ┌────────────────────────┼────────────────────────┐                │
│              │                        │                        │                │
│              ▼                        ▼                        ▼                │
│     ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐        │
│     │     METRICS     │     │      LOGS       │     │     TRACES      │        │
│     │                 │     │                 │     │                 │        │
│     │  "What's        │     │  "What          │     │  "How did the   │        │
│     │   happening?"   │     │   happened?"    │     │   request flow?"│        │
│     │                 │     │                 │     │                 │        │
│     │  Cloud          │     │  Cloud          │     │  Cloud          │        │
│     │  Monitoring     │     │  Logging        │     │  Trace          │        │
│     │  + Prometheus   │     │  + Loki         │     │  + Jaeger       │        │
│     └────────┬────────┘     └────────┬────────┘     └────────┬────────┘        │
│              │                       │                       │                  │
│              └───────────────────────┼───────────────────────┘                  │
│                                      │                                          │
│                                      ▼                                          │
│                           ┌──────────────────┐                                  │
│                           │   APPLICATION    │                                  │
│                           │   + INFRA        │                                  │
│                           └──────────────────┘                                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Metrics Strategy

### Metrics Collection Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           METRICS COLLECTION                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                        APPLICATION METRICS                               │   │
│  │  ─────────────────────────────────────────────────────────────────────  │   │
│  │                                                                          │   │
│  │  Next.js Application                                                     │   │
│  │  │                                                                       │   │
│  │  ├── HTTP Request Metrics                                                │   │
│  │  │   • http_request_duration_seconds (histogram)                         │   │
│  │  │   • http_requests_total (counter)                                     │   │
│  │  │   • http_request_size_bytes (histogram)                               │   │
│  │  │   • http_response_size_bytes (histogram)                              │   │
│  │  │                                                                       │   │
│  │  ├── API Endpoint Metrics                                                │   │
│  │  │   • api_endpoint_latency_seconds (histogram)                          │   │
│  │  │   • api_endpoint_errors_total (counter)                               │   │
│  │  │   • api_rate_limit_exceeded_total (counter)                           │   │
│  │  │                                                                       │   │
│  │  ├── Business Metrics                                                    │   │
│  │  │   • certificates_created_total (counter)                              │   │
│  │  │   • certificates_approved_total (counter)                             │   │
│  │  │   • certificates_signed_total (counter)                               │   │
│  │  │   • customer_reviews_total (counter)                                  │   │
│  │  │   • pdf_generations_total (counter)                                   │   │
│  │  │   • pdf_generation_duration_seconds (histogram)                       │   │
│  │  │                                                                       │   │
│  │  └── Runtime Metrics                                                     │   │
│  │      • nodejs_heap_size_bytes (gauge)                                    │   │
│  │      • nodejs_active_handles (gauge)                                     │   │
│  │      • nodejs_active_requests (gauge)                                    │   │
│  │      • process_cpu_seconds_total (counter)                               │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                     INFRASTRUCTURE METRICS                               │   │
│  │  ─────────────────────────────────────────────────────────────────────  │   │
│  │                                                                          │   │
│  │  Kubernetes (via GKE metrics)                                            │   │
│  │  │                                                                       │   │
│  │  ├── Node Metrics                                                        │   │
│  │  │   • CPU utilization                                                   │   │
│  │  │   • Memory utilization                                                │   │
│  │  │   • Disk I/O                                                          │   │
│  │  │   • Network throughput                                                │   │
│  │  │                                                                       │   │
│  │  ├── Pod Metrics                                                         │   │
│  │  │   • Container CPU/memory usage                                        │   │
│  │  │   • Pod restart count                                                 │   │
│  │  │   • Pod phase transitions                                             │   │
│  │  │                                                                       │   │
│  │  └── Cluster Metrics                                                     │   │
│  │      • Node availability                                                 │   │
│  │      • Autoscaler events                                                 │   │
│  │      • Control plane availability                                        │   │
│  │                                                                          │   │
│  │  Cloud SQL                                                               │   │
│  │  │                                                                       │   │
│  │  ├── database/cpu/utilization                                            │   │
│  │  ├── database/memory/utilization                                         │   │
│  │  ├── database/disk/utilization                                           │   │
│  │  ├── database/connections                                                │   │
│  │  ├── database/queries/count                                              │   │
│  │  └── database/replication/lag                                            │   │
│  │                                                                          │   │
│  │  Load Balancer                                                           │   │
│  │  │                                                                       │   │
│  │  ├── Request count                                                       │   │
│  │  ├── Backend latency                                                     │   │
│  │  ├── Error rate (4xx, 5xx)                                               │   │
│  │  └── SSL certificate expiry                                              │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Metrics Stack

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           METRICS STACK                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  PRIMARY: Google Cloud Monitoring                                               │
│  ────────────────────────────────                                               │
│                                                                                 │
│  • Native GCP service integration                                               │
│  • GKE metrics automatically collected                                          │
│  • Cloud SQL metrics automatically collected                                    │
│  • Load balancer metrics automatically collected                                │
│  • Custom metrics via OpenTelemetry                                             │
│  • Retention: 6 weeks (free tier)                                               │
│                                                                                 │
│  SUPPLEMENTARY: Prometheus + Grafana (In-cluster)                               │
│  ────────────────────────────────────────────────                               │
│                                                                                 │
│  • Application-specific metrics                                                 │
│  • Custom dashboards                                                            │
│  • Longer retention if needed                                                   │
│  • PromQL for advanced queries                                                  │
│                                                                                 │
│  METRICS EXPORT FLOW                                                            │
│  ───────────────────                                                            │
│                                                                                 │
│  Application ──▶ OpenTelemetry ──▶ Cloud Monitoring                             │
│       │              Collector            │                                     │
│       │                                   ▼                                     │
│       └──────────────────────────▶ Prometheus ──▶ Grafana                       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Logging Strategy

### Log Collection Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           LOGGING ARCHITECTURE                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│                           ┌─────────────────────┐                               │
│                           │  Cloud Logging      │                               │
│                           │  (Log Explorer)     │                               │
│                           └──────────┬──────────┘                               │
│                                      │                                          │
│               ┌──────────────────────┼──────────────────────┐                   │
│               │                      │                      │                   │
│               ▼                      ▼                      ▼                   │
│     ┌─────────────────┐    ┌─────────────────┐    ┌─────────────────┐          │
│     │  Application    │    │  GKE System     │    │  GCP Service    │          │
│     │  Logs           │    │  Logs           │    │  Logs           │          │
│     │                 │    │                 │    │                 │          │
│     │  • App errors   │    │  • kubelet      │    │  • Cloud SQL    │          │
│     │  • API access   │    │  • containerd   │    │  • Load Balancer│          │
│     │  • Business     │    │  • kube-proxy   │    │  • IAM          │          │
│     │    events       │    │  • GKE events   │    │  • Audit logs   │          │
│     └─────────────────┘    └─────────────────┘    └─────────────────┘          │
│                                                                                 │
│  LOG ROUTING                                                                    │
│  ───────────                                                                    │
│                                                                                 │
│  ┌──────────────────────────────────────────────────────────────────────────┐  │
│  │                                                                          │  │
│  │   Log Entry ──▶ Log Router ──┬──▶ Cloud Logging (default)               │  │
│  │                              │                                           │  │
│  │                              ├──▶ BigQuery (analytics, long-term)        │  │
│  │                              │                                           │  │
│  │                              ├──▶ Cloud Storage (archival)               │  │
│  │                              │                                           │  │
│  │                              └──▶ Pub/Sub (real-time processing)         │  │
│  │                                                                          │  │
│  └──────────────────────────────────────────────────────────────────────────┘  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Structured Logging Format

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           LOG FORMAT STANDARDS                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  JSON LOG FORMAT                                                                │
│  ───────────────                                                                │
│                                                                                 │
│  {                                                                              │
│    "timestamp": "2026-02-04T10:30:00.000Z",                                     │
│    "severity": "INFO|WARN|ERROR|DEBUG",                                         │
│    "message": "Human readable message",                                         │
│    "service": "hta-calibration",                                                │
│    "version": "1.2.3",                                                          │
│    "environment": "prod|staging|dev",                                           │
│    "traceId": "abc123...",                                                      │
│    "spanId": "def456...",                                                       │
│    "userId": "user-123",                                                        │
│    "requestId": "req-789",                                                      │
│    "httpRequest": {                                                             │
│      "method": "POST",                                                          │
│      "path": "/api/certificates",                                               │
│      "status": 200,                                                             │
│      "latencyMs": 150,                                                          │
│      "userAgent": "...",                                                        │
│      "remoteIp": "..."                                                          │
│    },                                                                           │
│    "labels": {                                                                  │
│      "certificateId": "cert-456",                                               │
│      "action": "create"                                                         │
│    },                                                                           │
│    "error": {                                                                   │
│      "name": "ValidationError",                                                 │
│      "message": "...",                                                          │
│      "stack": "..."                                                             │
│    }                                                                            │
│  }                                                                              │
│                                                                                 │
│  LOG LEVELS                                                                     │
│  ──────────                                                                     │
│                                                                                 │
│  Level     Usage                                                                │
│  ─────────────────────────────────────────────────────────────────────────      │
│  DEBUG     Detailed debugging (disabled in prod)                                │
│  INFO      Normal operations, business events                                   │
│  WARN      Unusual but handled conditions                                       │
│  ERROR     Failures requiring attention                                         │
│  CRITICAL  System-level failures, immediate action needed                       │
│                                                                                 │
│  SENSITIVE DATA HANDLING                                                        │
│  ───────────────────────                                                        │
│                                                                                 │
│  • Never log passwords or tokens                                                │
│  • Mask email addresses (show first 3 chars)                                    │
│  • Redact customer signatures                                                   │
│  • Hash or omit PII where possible                                              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Log Retention Policy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           LOG RETENTION                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Log Type                  Cloud Logging    BigQuery       Cold Storage         │
│  ─────────────────────────────────────────────────────────────────────────      │
│  Application logs          30 days          1 year         7 years              │
│  Access logs               30 days          1 year         7 years              │
│  Audit logs                400 days         Unlimited      Unlimited            │
│  Debug logs                7 days           -              -                    │
│  System logs               30 days          90 days        1 year               │
│                                                                                 │
│  COST OPTIMIZATION                                                              │
│  ─────────────────                                                              │
│                                                                                 │
│  • Exclude verbose debug logs from Cloud Logging in prod                        │
│  • Use log sampling for high-volume, low-value logs                             │
│  • Archive to Cloud Storage after BigQuery retention                            │
│  • Set up log exclusion filters for noise                                       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Distributed Tracing

### Tracing Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DISTRIBUTED TRACING                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  TRACE FLOW                                                                     │
│  ──────────                                                                     │
│                                                                                 │
│  User Request                                                                   │
│       │                                                                         │
│       ▼                                                                         │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Load Balancer (Trace ID generated)                                     │   │
│  │  Span: lb-request                                                       │   │
│  └──────────────────────────────┬──────────────────────────────────────────┘   │
│                                 │                                               │
│                                 ▼                                               │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  Next.js API Route                                                      │   │
│  │  Span: api-handler                                                      │   │
│  │  │                                                                      │   │
│  │  ├── Span: validate-request                                             │   │
│  │  ├── Span: check-auth                                                   │   │
│  │  ├── Span: business-logic                                               │   │
│  │  │   │                                                                  │   │
│  │  │   ├── Span: db-query                                                 │   │
│  │  │   ├── Span: generate-pdf                                             │   │
│  │  │   └── Span: upload-storage                                           │   │
│  │  │                                                                      │   │
│  │  └── Span: format-response                                              │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
│  TRACE CONTEXT PROPAGATION                                                      │
│  ─────────────────────────                                                      │
│                                                                                 │
│  • W3C Trace Context standard (traceparent header)                              │
│  • OpenTelemetry SDK for automatic instrumentation                              │
│  • Context propagated across all service calls                                  │
│                                                                                 │
│  TRACING STACK                                                                  │
│  ─────────────                                                                  │
│                                                                                 │
│  • Primary: Cloud Trace (native GCP integration)                                │
│  • Alternative: Jaeger (self-hosted, more features)                             │
│  • Instrumentation: OpenTelemetry                                               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Key Traces to Capture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CRITICAL TRACES                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  CERTIFICATE LIFECYCLE                                                          │
│  ─────────────────────                                                          │
│                                                                                 │
│  • Certificate creation flow                                                    │
│  • HoD approval workflow                                                        │
│  • Customer review and signature                                                │
│  • PDF generation and storage                                                   │
│  • Email notification delivery                                                  │
│                                                                                 │
│  AUTHENTICATION FLOWS                                                           │
│  ────────────────────                                                           │
│                                                                                 │
│  • Login attempts (success/failure)                                             │
│  • Token validation                                                             │
│  • Session management                                                           │
│                                                                                 │
│  EXTERNAL INTEGRATIONS                                                          │
│  ─────────────────────                                                          │
│                                                                                 │
│  • OpenSign API calls                                                           │
│  • Email service calls                                                          │
│  • File storage operations                                                      │
│                                                                                 │
│  SAMPLING STRATEGY                                                              │
│  ─────────────────                                                              │
│                                                                                 │
│  Environment       Sampling Rate                                                │
│  ─────────────────────────────────────────────────────────────────────────      │
│  Development       100% (all traces)                                            │
│  Staging           50%                                                          │
│  Production        10% normal, 100% errors                                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Alerting Strategy

### Alert Categories and Priorities

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ALERTING FRAMEWORK                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ALERT SEVERITY LEVELS                                                          │
│  ─────────────────────                                                          │
│                                                                                 │
│  P1 - CRITICAL (Immediate Response)                                             │
│  ──────────────────────────────────                                             │
│  • Service completely unavailable                                               │
│  • Data loss or corruption risk                                                 │
│  • Security breach detected                                                     │
│  • Response: Immediate, 24/7 on-call                                            │
│  • Notification: PagerDuty + Phone                                              │
│                                                                                 │
│  P2 - HIGH (Urgent Response)                                                    │
│  ───────────────────────────                                                    │
│  • Service significantly degraded                                               │
│  • Error rate > 5%                                                              │
│  • Database connection issues                                                   │
│  • Response: Within 30 minutes                                                  │
│  • Notification: PagerDuty + Slack                                              │
│                                                                                 │
│  P3 - MEDIUM (Business Hours)                                                   │
│  ────────────────────────────                                                   │
│  • Performance degradation                                                      │
│  • Non-critical feature failures                                                │
│  • Resource usage warnings                                                      │
│  • Response: Within 4 hours                                                     │
│  • Notification: Slack                                                          │
│                                                                                 │
│  P4 - LOW (Informational)                                                       │
│  ─────────────────────────                                                      │
│  • Cost anomalies                                                               │
│  • Non-urgent maintenance needed                                                │
│  • Performance optimization opportunities                                       │
│  • Response: Next business day                                                  │
│  • Notification: Email digest                                                   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Alert Definitions

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ALERT DEFINITIONS                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  AVAILABILITY ALERTS                                                            │
│  ───────────────────                                                            │
│                                                                                 │
│  Alert                      Condition                    Severity               │
│  ─────────────────────────────────────────────────────────────────────────      │
│  Service Down               Uptime < 95% (5 min)         P1                     │
│  High Error Rate            5xx > 5% (5 min)             P2                     │
│  Elevated Error Rate        5xx > 1% (15 min)            P3                     │
│  Health Check Failing       3 consecutive failures       P2                     │
│                                                                                 │
│  LATENCY ALERTS                                                                 │
│  ──────────────                                                                 │
│                                                                                 │
│  Alert                      Condition                    Severity               │
│  ─────────────────────────────────────────────────────────────────────────      │
│  High Latency               P95 > 2s (5 min)             P2                     │
│  Elevated Latency           P95 > 500ms (15 min)         P3                     │
│  Database Slow              Query P95 > 1s (5 min)       P2                     │
│  PDF Generation Slow        P95 > 10s (5 min)            P3                     │
│                                                                                 │
│  RESOURCE ALERTS                                                                │
│  ───────────────                                                                │
│                                                                                 │
│  Alert                      Condition                    Severity               │
│  ─────────────────────────────────────────────────────────────────────────      │
│  Pod Memory Critical        > 95% limit (5 min)          P2                     │
│  Pod Memory Warning         > 80% limit (15 min)         P3                     │
│  Node CPU High              > 90% (15 min)               P3                     │
│  Database Disk Critical     > 90% capacity               P2                     │
│  Database Disk Warning      > 75% capacity               P3                     │
│  Database Connections       > 80% max                    P3                     │
│                                                                                 │
│  BUSINESS ALERTS                                                                │
│  ───────────────                                                                │
│                                                                                 │
│  Alert                      Condition                    Severity               │
│  ─────────────────────────────────────────────────────────────────────────      │
│  No Certificates (Anomaly)  0 created in 24h             P4                     │
│  Signature Failures         > 5 in 1 hour                P3                     │
│  Email Delivery Failures    > 10% bounce rate            P3                     │
│                                                                                 │
│  SECURITY ALERTS                                                                │
│  ───────────────                                                                │
│                                                                                 │
│  Alert                      Condition                    Severity               │
│  ─────────────────────────────────────────────────────────────────────────      │
│  Auth Failures Spike        > 50 in 5 minutes            P2                     │
│  Suspicious IP Activity     Pattern detection            P2                     │
│  SSL Certificate Expiry     < 14 days remaining          P3                     │
│  Secret Access Anomaly      Unusual access pattern       P2                     │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Dashboards

### Dashboard Hierarchy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DASHBOARD STRUCTURE                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  EXECUTIVE DASHBOARD                                                            │
│  ───────────────────                                                            │
│  • Overall system health (traffic light)                                        │
│  • SLO compliance percentage                                                    │
│  • Key business metrics                                                         │
│  • Cost trends                                                                  │
│                                                                                 │
│  SERVICE HEALTH DASHBOARD                                                       │
│  ────────────────────────                                                       │
│  • Request rate / Error rate / Latency (RED metrics)                            │
│  • Active users                                                                 │
│  • Endpoint breakdown                                                           │
│  • Recent deployments                                                           │
│                                                                                 │
│  INFRASTRUCTURE DASHBOARD                                                       │
│  ────────────────────────                                                       │
│  • GKE cluster health                                                           │
│  • Node utilization                                                             │
│  • Pod status                                                                   │
│  • Autoscaler activity                                                          │
│                                                                                 │
│  DATABASE DASHBOARD                                                             │
│  ──────────────────                                                             │
│  • Connection pool status                                                       │
│  • Query performance                                                            │
│  • Replication lag                                                              │
│  • Storage utilization                                                          │
│                                                                                 │
│  BUSINESS METRICS DASHBOARD                                                     │
│  ──────────────────────────                                                     │
│  • Certificates created/approved/signed                                         │
│  • Customer engagement metrics                                                  │
│  • Processing time trends                                                       │
│  • User activity patterns                                                       │
│                                                                                 │
│  SECURITY DASHBOARD                                                             │
│  ──────────────────                                                             │
│  • Authentication metrics                                                       │
│  • Failed login attempts                                                        │
│  • Suspicious activity                                                          │
│  • Certificate/secret expiry                                                    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## SLOs and SLIs

### Service Level Objectives

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SLOs AND SLIs                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  AVAILABILITY SLO                                                               │
│  ────────────────                                                               │
│                                                                                 │
│  • Objective: 99.9% uptime (monthly)                                            │
│  • Error Budget: 43.8 minutes/month                                             │
│  • SLI: Successful requests / Total requests                                    │
│  • Measurement: 5-minute rolling windows                                        │
│                                                                                 │
│  LATENCY SLO                                                                    │
│  ───────────                                                                    │
│                                                                                 │
│  • Objective: P95 latency < 500ms                                               │
│  • SLI: Request duration at 95th percentile                                     │
│  • Exclusions: PDF generation (separate SLO)                                    │
│  • Measurement: 15-minute rolling windows                                       │
│                                                                                 │
│  PDF GENERATION SLO                                                             │
│  ──────────────────                                                             │
│                                                                                 │
│  • Objective: P95 < 5 seconds                                                   │
│  • SLI: PDF generation duration at 95th percentile                              │
│  • Measurement: Daily aggregation                                               │
│                                                                                 │
│  ERROR RATE SLO                                                                 │
│  ─────────────                                                                  │
│                                                                                 │
│  • Objective: < 0.1% error rate                                                 │
│  • SLI: 5xx responses / Total responses                                         │
│  • Exclusions: Client errors (4xx)                                              │
│                                                                                 │
│  ERROR BUDGET POLICY                                                            │
│  ───────────────────                                                            │
│                                                                                 │
│  Budget Remaining    Actions                                                    │
│  ─────────────────────────────────────────────────────────────────────────      │
│  > 50%               Normal development velocity                                │
│  25-50%              Review recent changes, extra caution                       │
│  10-25%              Feature freeze, focus on reliability                       │
│  < 10%               Incident mode, stability only                              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Incident Management

### Incident Response Process

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           INCIDENT RESPONSE                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  INCIDENT LIFECYCLE                                                             │
│  ──────────────────                                                             │
│                                                                                 │
│  ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐    ┌──────────┐ │
│  │ Detection│───▶│ Triage   │───▶│ Response │───▶│ Recovery │───▶│ Review   │ │
│  │          │    │          │    │          │    │          │    │          │ │
│  │ • Alert  │    │ • Assess │    │ • Debug  │    │ • Fix    │    │ • RCA    │ │
│  │ • User   │    │ • Assign │    │ • Comms  │    │ • Verify │    │ • Action │ │
│  │   report │    │ • Escalate    │ • Update │    │ • Monitor│    │   items  │ │
│  └──────────┘    └──────────┘    └──────────┘    └──────────┘    └──────────┘ │
│                                                                                 │
│  ON-CALL ROTATION                                                               │
│  ────────────────                                                               │
│                                                                                 │
│  • Primary on-call: Rotating weekly                                             │
│  • Secondary on-call: Backup responder                                          │
│  • Escalation path: Primary → Secondary → Engineering Lead                      │
│  • Handoff: End of business, documented in runbook                              │
│                                                                                 │
│  COMMUNICATION CHANNELS                                                         │
│  ──────────────────────                                                         │
│                                                                                 │
│  • Incident Slack channel: #incidents                                           │
│  • War room: Google Meet (auto-created)                                         │
│  • Status page: External customer communication                                 │
│  • Stakeholder updates: Email distribution list                                 │
│                                                                                 │
│  POST-INCIDENT REVIEW                                                           │
│  ────────────────────                                                           │
│                                                                                 │
│  • Blameless postmortem within 48 hours                                         │
│  • Timeline reconstruction                                                      │
│  • Root cause analysis (5 Whys)                                                 │
│  • Action items with owners and deadlines                                       │
│  • Publish to team knowledge base                                               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Runbooks

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           RUNBOOK INDEX                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  RUNBOOK CATEGORIES                                                             │
│  ──────────────────                                                             │
│                                                                                 │
│  Category                   Runbooks                                            │
│  ─────────────────────────────────────────────────────────────────────────      │
│  Application                                                                    │
│  • High error rate response                                                     │
│  • High latency investigation                                                   │
│  • Memory leak diagnosis                                                        │
│  • Application restart procedure                                                │
│                                                                                 │
│  Database                                                                       │
│  • Connection pool exhaustion                                                   │
│  • Slow query investigation                                                     │
│  • Database failover procedure                                                  │
│  • Data recovery from backup                                                    │
│                                                                                 │
│  Infrastructure                                                                 │
│  • GKE node failure                                                             │
│  • Pod crash loop investigation                                                 │
│  • Scaling issues                                                               │
│  • Network connectivity issues                                                  │
│                                                                                 │
│  Security                                                                       │
│  • Credential rotation                                                          │
│  • Suspicious activity response                                                 │
│  • SSL certificate renewal                                                      │
│  • Access revocation                                                            │
│                                                                                 │
│  Deployment                                                                     │
│  • Rollback procedure                                                           │
│  • Blue-green switch                                                            │
│  • Database migration rollback                                                  │
│  • Feature flag emergency disable                                               │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Cost Monitoring

### Observability Cost Management

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           COST MANAGEMENT                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ESTIMATED MONTHLY COSTS                                                        │
│  ───────────────────────                                                        │
│                                                                                 │
│  Service                    Estimated Cost                                      │
│  ─────────────────────────────────────────────────────────────────────────      │
│  Cloud Monitoring           Free tier (first 150 MB/month)                      │
│  Cloud Logging              $0.50/GB ingested (after free tier)                 │
│  Cloud Trace                $0.20/million spans                                 │
│  BigQuery (log analytics)   $5/TB queried                                       │
│  Alert policies             Free                                                │
│  ─────────────────────────────────────────────────────────────────────────      │
│  ESTIMATED TOTAL            $50-150/month (production)                          │
│                                                                                 │
│  COST OPTIMIZATION STRATEGIES                                                   │
│  ────────────────────────────                                                   │
│                                                                                 │
│  • Log exclusion filters for verbose/debug logs                                 │
│  • Trace sampling (10% in production)                                           │
│  • Metric aggregation (reduce cardinality)                                      │
│  • Archive old logs to Cloud Storage                                            │
│  • Set log retention policies                                                   │
│  • Use log sinks efficiently                                                    │
│                                                                                 │
│  COST ALERTS                                                                    │
│  ───────────                                                                    │
│                                                                                 │
│  • Alert at 80% of budget                                                       │
│  • Daily cost anomaly detection                                                 │
│  • Monthly cost reports                                                         │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Checklist

### Phase 4: Monitoring Setup
- [ ] Enable Cloud Monitoring API
- [ ] Enable Cloud Logging API
- [ ] Enable Cloud Trace API
- [ ] Configure GKE workload metrics
- [ ] Set up custom metrics collection
- [ ] Configure log routing and sinks
- [ ] Set up BigQuery dataset for log analytics
- [ ] Configure trace sampling
- [ ] Create alerting policies
- [ ] Set up notification channels (Slack, PagerDuty)
- [ ] Build executive dashboard
- [ ] Build service health dashboard
- [ ] Build infrastructure dashboard
- [ ] Build database dashboard
- [ ] Build business metrics dashboard
- [ ] Define and configure SLOs
- [ ] Create error budget policies
- [ ] Document runbooks
- [ ] Set up on-call rotation
- [ ] Test alert notifications
- [ ] Conduct incident response drill

---

## Related Documents

- [Overview](./00_scaleup_overview.md)
- [GCP Infrastructure](./04_gcp_infrastructure.md)
- [Terraform IaC](./05_terraform_iac.md)
- [Kubernetes Orchestration](./10_kubernetes_orchestration.md)
