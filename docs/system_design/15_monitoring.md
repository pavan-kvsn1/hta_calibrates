# Monitoring & Observability

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Prerequisite**: [03_system_architecture.md](./03_system_architecture.md)

---

## Introduction

You can't fix what you can't see. This document covers how we monitor HTA Calibration to detect issues before users do.

---

## Part 1: The Three Pillars of Observability

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    THREE PILLARS OF OBSERVABILITY                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌────────────────────┐ ┌────────────────────┐ ┌────────────────────┐      │
│  │                    │ │                    │ │                    │      │
│  │      METRICS       │ │       LOGS         │ │      TRACES        │      │
│  │                    │ │                    │ │                    │      │
│  │  "What is         │ │  "What happened?"  │ │  "Where did time   │      │
│  │   happening?"     │ │                    │ │   go?"             │      │
│  │                    │ │                    │ │                    │      │
│  │  • CPU: 45%       │ │  • Error at 3:05   │ │  • API: 50ms       │      │
│  │  • Memory: 2.1GB  │ │  • User logged in  │ │  • DB query: 120ms │      │
│  │  • Requests: 150/s│ │  • Cert approved   │ │  • External: 300ms │      │
│  │  • Errors: 0.1%   │ │  • Payment failed  │ │  • Total: 470ms    │      │
│  │                    │ │                    │ │                    │      │
│  │  Numbers over time│ │  Events with       │ │  Request flow      │      │
│  │                    │ │  context           │ │  through system    │      │
│  │                    │ │                    │ │                    │      │
│  └────────────────────┘ └────────────────────┘ └────────────────────┘      │
│                                                                             │
│  WHY ALL THREE?                                                             │
│  ══════════════                                                             │
│                                                                             │
│  Scenario: Users report "the app is slow"                                   │
│                                                                             │
│  METRICS tell you:  "Latency increased at 2 PM"                             │
│  LOGS tell you:     "Database connection errors at 2 PM"                    │
│  TRACES tell you:   "Slow query on certificates table taking 5 seconds"     │
│                                                                             │
│  Together: Root cause = missing index on certificates table!                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Metrics (Cloud Monitoring)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           METRICS                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  KEY METRICS TO MONITOR:                                                    │
│  ═══════════════════════                                                    │
│                                                                             │
│  GOLDEN SIGNALS (Google SRE):                                               │
│  ────────────────────────────                                               │
│                                                                             │
│  1. LATENCY                                                                 │
│     How long requests take                                                  │
│     ┌─────────────────────────────────────────────────┐                    │
│     │  p50: 100ms   p95: 250ms   p99: 500ms          │                    │
│     │  ████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│                    │
│     │         ▲         ▲              ▲              │                    │
│     │        50%       95%            99%             │                    │
│     └─────────────────────────────────────────────────┘                    │
│     Alert if: p99 > 1 second                                                │
│                                                                             │
│  2. TRAFFIC                                                                 │
│     Requests per second                                                     │
│     ┌─────────────────────────────────────────────────┐                    │
│     │  150 ├─────────────────╮      ╭────────────    │                    │
│     │  100 │                 ╰──────╯                 │                    │
│     │   50 │                                          │                    │
│     │    0 └────────────────────────────────────────  │                    │
│     │      12:00    14:00    16:00    18:00           │                    │
│     └─────────────────────────────────────────────────┘                    │
│     Useful for: Capacity planning, anomaly detection                        │
│                                                                             │
│  3. ERRORS                                                                  │
│     Error rate (percentage)                                                 │
│     ┌─────────────────────────────────────────────────┐                    │
│     │   5% │              ╭─╮                         │                    │
│     │   1% │              │ │     Alert!              │                    │
│     │ 0.1% ├──────────────╯ ╰─────────────────────   │                    │
│     │    0 └────────────────────────────────────────  │                    │
│     └─────────────────────────────────────────────────┘                    │
│     Alert if: Error rate > 1% for 5 minutes                                 │
│                                                                             │
│  4. SATURATION                                                              │
│     Resource utilization                                                    │
│     CPU: 45%  │████████░░░░░░░░░│ Alert if > 80%                           │
│     Memory: 70%│██████████████░░│ Alert if > 85%                           │
│     Disk: 35% │███████░░░░░░░░░░│ Alert if > 75%                           │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  CUSTOM METRICS:                                                            │
│  ═══════════════                                                            │
│                                                                             │
│  Business metrics specific to HTA:                                          │
│                                                                             │
│  • certificates_created_total (counter)                                     │
│  • certificates_by_status (gauge per status)                                │
│  • review_turnaround_time_hours (histogram)                                 │
│  • active_users_by_tenant (gauge per tenant)                                │
│  • pdf_generation_duration_seconds (histogram)                              │
│  • email_send_failures_total (counter)                                      │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Logs (Cloud Logging)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LOGGING                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STRUCTURED LOGGING:                                                        │
│  ═══════════════════                                                        │
│                                                                             │
│  // ❌ Bad: Plain text logs                                                 │
│  console.log('User john@hta.com created certificate CERT-001');             │
│                                                                             │
│  // ✅ Good: Structured JSON logs                                           │
│  logger.info('Certificate created', {                                       │
│    event: 'certificate_created',                                            │
│    tenantId: 'hta',                                                         │
│    userId: 'user_123',                                                      │
│    certificateId: 'cert_456',                                               │
│    certificateNumber: 'CERT-001',                                           │
│    duration_ms: 245,                                                        │
│  });                                                                        │
│                                                                             │
│  OUTPUT:                                                                    │
│  {                                                                          │
│    "severity": "INFO",                                                      │
│    "message": "Certificate created",                                        │
│    "timestamp": "2026-03-17T10:30:00Z",                                     │
│    "event": "certificate_created",                                          │
│    "tenantId": "hta",                                                       │
│    "userId": "user_123",                                                    │
│    "certificateId": "cert_456",                                             │
│    "certificateNumber": "CERT-001",                                         │
│    "duration_ms": 245                                                       │
│  }                                                                          │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  LOG LEVELS:                                                                │
│  ═══════════                                                                │
│                                                                             │
│  ERROR   │ Something broke, needs attention                                 │
│          │ "Database connection failed"                                     │
│          │                                                                  │
│  WARN    │ Something unexpected but handled                                 │
│          │ "Retry succeeded on attempt 3"                                   │
│          │                                                                  │
│  INFO    │ Important business events                                        │
│          │ "Certificate approved", "User logged in"                         │
│          │                                                                  │
│  DEBUG   │ Detailed info for troubleshooting                                │
│          │ "Processing request with params..."                              │
│          │ (Only enable in dev or when debugging)                           │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  WHAT TO LOG:                                                               │
│  ═════════════                                                              │
│                                                                             │
│  ✅ DO LOG:                                                                 │
│  • Authentication events (login, logout, failed attempts)                   │
│  • Authorization failures (access denied)                                   │
│  • Important business actions (certificate status changes)                  │
│  • Errors and exceptions (with stack traces)                                │
│  • External API calls (with duration)                                       │
│  • Performance metrics (slow queries)                                       │
│                                                                             │
│  ❌ DON'T LOG:                                                              │
│  • Passwords or credentials                                                 │
│  • Full credit card numbers                                                 │
│  • Personal data (unless necessary)                                         │
│  • Entire request bodies (may contain sensitive data)                       │
│  • Every successful request (too noisy)                                     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 4: Traces (Cloud Trace)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DISTRIBUTED TRACING                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Follow a request through the entire system:                                │
│                                                                             │
│  REQUEST: POST /api/certificates/submit                                     │
│  ═════════════════════════════════════════                                  │
│                                                                             │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │                                                                     │    │
│  │  0ms        100ms       200ms       300ms       400ms       500ms  │    │
│  │  │           │           │           │           │           │     │    │
│  │                                                                     │    │
│  │  ├── API Handler ──────────────────────────────────────────────┤   │    │
│  │  │   Total: 487ms                                               │   │    │
│  │  │                                                              │   │    │
│  │  │  ├── Auth Middleware ──┤                                    │   │    │
│  │  │  │   12ms               │                                    │   │    │
│  │  │  │                      │                                    │   │    │
│  │  │  │  ├── JWT Verify ─┤  │                                    │   │    │
│  │  │  │  │   8ms          │  │                                    │   │    │
│  │  │  │                      │                                    │   │    │
│  │  │  ├── DB: Update Status ────────────────────┤                │   │    │
│  │  │  │   145ms (SLOW!)                          │                │   │    │
│  │  │  │                                          │                │   │    │
│  │  │  ├── DB: Create Event ────────┤            │                │   │    │
│  │  │  │   42ms                      │            │                │   │    │
│  │  │  │                             │            │                │   │    │
│  │  │  ├── Pub/Sub: Publish ──┤     │            │                │   │    │
│  │  │  │   23ms                │     │            │                │   │    │
│  │  │  │                       │     │            │                │   │    │
│  │  │  ├── Email Service ────────────────────────────────────┤    │   │    │
│  │  │  │   265ms (VERY SLOW!)                                 │    │   │    │
│  │  │                                                              │   │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  INSIGHTS FROM THIS TRACE:                                                  │
│  ══════════════════════════                                                 │
│                                                                             │
│  1. DB Update takes 145ms - possibly missing index                          │
│  2. Email Service takes 265ms - should be async!                            │
│  3. Total 487ms - above our 300ms target                                    │
│                                                                             │
│  ACTIONS:                                                                   │
│  1. Add index on certificates.status                                        │
│  2. Move email to background job                                            │
│  3. Expected improvement: 487ms → ~180ms                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 5: Alerting

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           ALERTING                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ALERT POLICIES:                                                            │
│  ═══════════════                                                            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   CRITICAL (Page immediately - wake someone up!)                     │   │
│  │   ─────────────────────────────────────────────                      │   │
│  │   • Site is completely down                                          │   │
│  │   • Error rate > 10%                                                 │   │
│  │   • Database connection failures                                     │   │
│  │   • All pods are unhealthy                                           │   │
│  │                                                                      │   │
│  │   → PagerDuty / Phone call                                           │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   WARNING (Investigate soon - during business hours)                 │   │
│  │   ────────────────────────────────────────────────                   │   │
│  │   • Error rate > 1%                                                  │   │
│  │   • Latency p99 > 1 second                                           │   │
│  │   • CPU > 80% for 15 minutes                                         │   │
│  │   • Disk > 75%                                                       │   │
│  │   • Certificate queue backlog > 100                                  │   │
│  │                                                                      │   │
│  │   → Slack #alerts channel                                            │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   INFO (FYI - check when convenient)                                 │   │
│  │   ──────────────────────────────────                                 │   │
│  │   • New tenant created                                               │   │
│  │   • Deployment completed                                             │   │
│  │   • Backup completed                                                 │   │
│  │   • Certificate milestone (1000th certificate!)                      │   │
│  │                                                                      │   │
│  │   → Email / Slack #general                                           │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ALERT FATIGUE PREVENTION:                                                  │
│  ═════════════════════════                                                  │
│                                                                             │
│  • Only alert on actionable items                                           │
│  • Use appropriate thresholds (not too sensitive)                           │
│  • Group related alerts                                                     │
│  • Auto-resolve when issue clears                                           │
│  • Regularly review and tune alerts                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 6: Dashboards

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DASHBOARDS                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  OPERATIONS DASHBOARD:                                                      │
│  ═════════════════════                                                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  HTA CALIBRATION - OPERATIONS                     Last 24 hours     │   │
│  │─────────────────────────────────────────────────────────────────────│   │
│  │                                                                      │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐  │   │
│  │  │ REQUESTS/S   │ │ ERROR RATE   │ │ LATENCY P95  │ │ PODS READY │  │   │
│  │  │    147       │ │    0.2%      │ │    245ms     │ │    5/5     │  │   │
│  │  │     ✅       │ │     ✅       │ │     ✅       │ │     ✅     │  │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘  │   │
│  │                                                                      │   │
│  │  REQUEST LATENCY                    ERROR RATE                       │   │
│  │  ┌──────────────────────────┐      ┌──────────────────────────┐    │   │
│  │  │     ╭─╮                  │      │                          │    │   │
│  │  │ ────╯ ╰──────────────   │      │ ─────────────────────── │    │   │
│  │  │                          │      │                          │    │   │
│  │  └──────────────────────────┘      └──────────────────────────┘    │   │
│  │  p50: 98ms  p95: 245ms  p99: 412ms  Current: 0.2%  Target: <1%    │   │
│  │                                                                      │   │
│  │  RESOURCE UTILIZATION                                                │   │
│  │  ┌──────────────────────────────────────────────────────────────┐  │   │
│  │  │  CPU    │████████░░░░░░░░░░│ 45%                              │  │   │
│  │  │  Memory │██████████████░░░░│ 72%                              │  │   │
│  │  │  Disk   │███████░░░░░░░░░░░│ 35%                              │  │   │
│  │  └──────────────────────────────────────────────────────────────┘  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  BUSINESS DASHBOARD:                                                        │
│  ═══════════════════                                                        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  HTA CALIBRATION - BUSINESS METRICS                  Last 7 days   │   │
│  │─────────────────────────────────────────────────────────────────────│   │
│  │                                                                      │   │
│  │  ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌────────────┐  │   │
│  │  │ CERTIFICATES │ │ AVG REVIEW   │ │ ACTIVE       │ │ TENANTS    │  │   │
│  │  │ THIS WEEK    │ │ TIME         │ │ USERS        │ │            │  │   │
│  │  │    156       │ │   4.2 hrs    │ │    47        │ │    3       │  │   │
│  │  │   ↑ 12%      │ │   ↓ 15%     │ │   ↑ 5%      │ │   ─        │  │   │
│  │  └──────────────┘ └──────────────┘ └──────────────┘ └────────────┘  │   │
│  │                                                                      │   │
│  │  CERTIFICATES BY STATUS            CERTIFICATES BY TENANT           │   │
│  │  ┌──────────────────────────┐      ┌──────────────────────────┐    │   │
│  │  │  Draft:      ████ 12    │      │  HTA:     ████████ 89    │    │   │
│  │  │  Pending:    ██████ 23  │      │  ABC:     ████ 45        │    │   │
│  │  │  Approved:   ███████ 34 │      │  XYZ:     ██ 22          │    │   │
│  │  │  Authorized: ████████ 87│      │                          │    │   │
│  │  └──────────────────────────┘      └──────────────────────────┘    │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KEY TAKEAWAYS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. THREE PILLARS                                                           │
│     Metrics + Logs + Traces = Full visibility                               │
│                                                                             │
│  2. GOLDEN SIGNALS                                                          │
│     Latency, Traffic, Errors, Saturation                                    │
│                                                                             │
│  3. STRUCTURED LOGGING                                                      │
│     JSON logs with context for easy searching                               │
│                                                                             │
│  4. ALERT WISELY                                                            │
│     Critical → Page, Warning → Slack, Info → Email                          │
│     Don't alert on non-actionable items                                     │
│                                                                             │
│  5. DASHBOARDS                                                              │
│     Operations (system health) + Business (metrics)                         │
│                                                                             │
│  6. GCP SERVICES                                                            │
│     Cloud Monitoring, Cloud Logging, Cloud Trace                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

- [14. Security Architecture](./14_security.md) - Security monitoring
- [16. Disaster Recovery](./16_disaster_recovery.md) - Incident response
