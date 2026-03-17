# Disaster Recovery

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Prerequisite**: [03_system_architecture.md](./03_system_architecture.md)

---

## Introduction

Things will go wrong. This document covers how we prepare for, respond to, and recover from failures.

---

## Part 1: Recovery Objectives

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           RECOVERY OBJECTIVES                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TWO KEY METRICS:                                                           │
│  ════════════════                                                           │
│                                                                             │
│  RTO (Recovery Time Objective)                                              │
│  ─────────────────────────────                                              │
│  How long can we be down?                                                   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   Disaster        Recovery         Back Online                       │   │
│  │   Occurs          Starts           Complete                          │   │
│  │     │               │                 │                              │   │
│  │     ▼               ▼                 ▼                              │   │
│  │  ───●───────────────●─────────────────●───────────────────▶ Time    │   │
│  │     │◀─────────────────────────────────│                             │   │
│  │     │           RTO = 4 hours          │                             │   │
│  │     │                                  │                             │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Our RTO: 4 hours (maximum acceptable downtime)                             │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  RPO (Recovery Point Objective)                                             │
│  ─────────────────────────────                                              │
│  How much data can we lose?                                                 │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   Last Backup     Disaster     Data Lost                             │   │
│  │      │             Occurs       (Gone!)                              │   │
│  │      ▼               ▼            │                                  │   │
│  │  ────●───────────────●────────────│──────────────────────▶ Time     │   │
│  │      │◀──────────────│            │                                  │   │
│  │      │   RPO = 1 hr  │            │                                  │   │
│  │      │               │◀───────────│                                  │   │
│  │      │               │  Data loss │                                  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Our RPO: 1 hour (maximum acceptable data loss)                             │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  TARGETS BY COMPONENT:                                                      │
│  ═════════════════════                                                      │
│                                                                             │
│  ┌────────────────────┬─────────────┬─────────────┬────────────────────┐   │
│  │ Component          │     RTO     │     RPO     │ Backup Strategy    │   │
│  ├────────────────────┼─────────────┼─────────────┼────────────────────┤   │
│  │ Database           │   1 hour    │   5 min     │ Point-in-time      │   │
│  │ Application        │   15 min    │   N/A       │ Container images   │   │
│  │ Files (GCS)        │   1 hour    │   0         │ Object versioning  │   │
│  │ Configuration      │   30 min    │   0         │ Git + Terraform    │   │
│  │ Secrets            │   30 min    │   0         │ Secret Manager     │   │
│  └────────────────────┴─────────────┴─────────────┴────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Backup Strategy

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BACKUP STRATEGY                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DATABASE BACKUPS (Cloud SQL):                                              │
│  ═════════════════════════════                                              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   AUTOMATED BACKUPS                                                  │   │
│  │   ─────────────────                                                  │   │
│  │   • Daily full backups at 3 AM                                       │   │
│  │   • Retained for 30 days                                             │   │
│  │   • Stored in different region                                       │   │
│  │                                                                      │   │
│  │   POINT-IN-TIME RECOVERY (PITR)                                      │   │
│  │   ─────────────────────────────                                      │   │
│  │   • Transaction logs retained for 7 days                             │   │
│  │   • Can restore to any second within 7 days                          │   │
│  │   • RPO effectively near-zero                                        │   │
│  │                                                                      │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │  Day 1    Day 2    Day 3    Day 4    Day 5    Day 6    Day 7│   │   │
│  │   │   │        │        │        │        │        │        │   │   │   │
│  │   │   ▼        ▼        ▼        ▼        ▼        ▼        ▼   │   │   │
│  │   │  [FB]     [FB]     [FB]     [FB]     [FB]     [FB]     [FB] │   │   │
│  │   │   │───────────────────────────────────────────────────│     │   │   │
│  │   │   └─────── Transaction Logs (continuous) ─────────────┘     │   │   │
│  │   │                                                             │   │   │
│  │   │   FB = Full Backup                                          │   │   │
│  │   │   Can restore to ANY point on the timeline!                 │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  │   MONTHLY EXPORTS                                                    │   │
│  │   ───────────────                                                    │   │
│  │   • Full database export to GCS                                      │   │
│  │   • Retained for 1 year                                              │   │
│  │   • For compliance and long-term archival                            │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  FILE STORAGE BACKUPS (Cloud Storage):                                      │
│  ═════════════════════════════════════                                      │
│                                                                             │
│  • Object Versioning: Every file change creates a new version               │
│  • Lifecycle Policy: Delete old versions after 90 days                      │
│  • Cross-region Replication: Files copied to another region                 │
│                                                                             │
│  INFRASTRUCTURE BACKUPS:                                                    │
│  ═══════════════════════                                                    │
│                                                                             │
│  • Terraform state stored in GCS with versioning                            │
│  • All config in Git (can recreate from code)                               │
│  • Container images in Artifact Registry                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Failure Scenarios

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           FAILURE SCENARIOS                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SCENARIO 1: Single Pod Failure                                             │
│  ══════════════════════════════                                             │
│  Impact: Minimal - other pods handle traffic                                │
│  Detection: Kubernetes health check                                         │
│  Recovery: Automatic (Kubernetes restarts pod)                              │
│  Time: 30 seconds                                                           │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  SCENARIO 2: Zone Outage                                                    │
│  ════════════════════════                                                   │
│  Impact: Moderate - 1/3 capacity lost                                       │
│  Detection: Load balancer health checks                                     │
│  Recovery: Automatic (traffic routes to healthy zones)                      │
│  Time: 1-2 minutes                                                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   BEFORE:                       AFTER:                               │   │
│  │   Zone A  Zone B  Zone C        Zone A  Zone B  Zone C              │   │
│  │   [P1]    [P3]    [P5]          [❌]    [P3]    [P5]                │   │
│  │   [P2]    [P4]    [P6]          [❌]    [P4]    [P6]                │   │
│  │                                         [P7]    [P8] ← New pods     │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  SCENARIO 3: Database Failure                                               │
│  ════════════════════════════                                               │
│  Impact: High - no data access                                              │
│  Detection: Application errors, monitoring alerts                           │
│  Recovery: Automatic failover to standby (HA enabled)                       │
│  Time: 2-5 minutes                                                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   Primary (Zone A)              Standby (Zone B)                     │   │
│  │   ┌────────────────┐           ┌────────────────┐                   │   │
│  │   │   Cloud SQL    │◀─sync────▶│   Cloud SQL    │                   │   │
│  │   │   (active)     │           │   (standby)    │                   │   │
│  │   └────────────────┘           └────────────────┘                   │   │
│  │          │                                                           │   │
│  │          ▼ FAILURE!                                                  │   │
│  │   ┌────────────────┐           ┌────────────────┐                   │   │
│  │   │   Cloud SQL    │           │   Cloud SQL    │                   │   │
│  │   │   (down) ❌    │           │   (promoted!)  │ ◀── Now primary   │   │
│  │   └────────────────┘           └────────────────┘                   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  SCENARIO 4: Region Outage                                                  │
│  ══════════════════════════                                                 │
│  Impact: Critical - entire region down                                      │
│  Detection: External monitoring                                             │
│  Recovery: Manual failover to secondary region                              │
│  Time: 2-4 hours                                                            │
│                                                                             │
│  This requires:                                                             │
│  • DNS update to secondary region                                           │
│  • Restore database from cross-region backup                                │
│  • Redeploy application to new region                                       │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  SCENARIO 5: Data Corruption / Accidental Deletion                          │
│  ═════════════════════════════════════════════════                          │
│  Impact: Critical - data loss                                               │
│  Detection: User reports, data validation checks                            │
│  Recovery: Point-in-time restore                                            │
│  Time: 30 minutes - 2 hours                                                 │
│                                                                             │
│  Steps:                                                                     │
│  1. Identify the time corruption occurred                                   │
│  2. Create new database instance from PITR                                  │
│  3. Verify data integrity                                                   │
│  4. Switch application to restored database                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 4: Incident Response

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           INCIDENT RESPONSE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  INCIDENT SEVERITY LEVELS:                                                  │
│  ═════════════════════════                                                  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   SEV 1 (Critical)                                                   │   │
│  │   ─────────────────                                                  │   │
│  │   • Complete outage                                                  │   │
│  │   • Data loss occurring                                              │   │
│  │   • Security breach                                                  │   │
│  │   Response: All hands on deck, 15-min updates                        │   │
│  │                                                                      │   │
│  │   SEV 2 (High)                                                       │   │
│  │   ─────────────                                                      │   │
│  │   • Major feature broken                                             │   │
│  │   • Significant performance degradation                              │   │
│  │   • One tenant fully affected                                        │   │
│  │   Response: Immediate response, hourly updates                       │   │
│  │                                                                      │   │
│  │   SEV 3 (Medium)                                                     │   │
│  │   ───────────────                                                    │   │
│  │   • Minor feature broken                                             │   │
│  │   • Workaround available                                             │   │
│  │   Response: Next business day, daily updates                         │   │
│  │                                                                      │   │
│  │   SEV 4 (Low)                                                        │   │
│  │   ────────────                                                       │   │
│  │   • Cosmetic issues                                                  │   │
│  │   • Minor inconvenience                                              │   │
│  │   Response: Normal sprint work                                       │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  INCIDENT RESPONSE PROCESS:                                                 │
│  ══════════════════════════                                                 │
│                                                                             │
│  1. DETECT                                                                  │
│     • Monitoring alerts fire                                                │
│     • User reports issue                                                    │
│     • Error rate spikes                                                     │
│                                                                             │
│  2. TRIAGE                                                                  │
│     • Assess severity                                                       │
│     • Assign incident commander                                             │
│     • Create incident channel (#incident-2026-03-17)                        │
│                                                                             │
│  3. INVESTIGATE                                                             │
│     • Check dashboards                                                      │
│     • Review recent changes                                                 │
│     • Examine logs and traces                                               │
│                                                                             │
│  4. MITIGATE                                                                │
│     • Implement immediate fix (rollback, restart, scale)                    │
│     • Communicate status to stakeholders                                    │
│     • Document actions taken                                                │
│                                                                             │
│  5. RESOLVE                                                                 │
│     • Verify service restored                                               │
│     • Monitor for recurrence                                                │
│     • Notify stakeholders                                                   │
│                                                                             │
│  6. POST-MORTEM                                                             │
│     • Blameless review                                                      │
│     • Root cause analysis                                                   │
│     • Action items to prevent recurrence                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 5: Testing Disaster Recovery

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DR TESTING                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  REGULAR TESTING SCHEDULE:                                                  │
│  ═════════════════════════                                                  │
│                                                                             │
│  MONTHLY:                                                                   │
│  • Verify backup completion                                                 │
│  • Test single database restore (to test instance)                          │
│  • Review and update runbooks                                               │
│                                                                             │
│  QUARTERLY:                                                                 │
│  • Full database restore test                                               │
│  • Failover test (database HA)                                              │
│  • Incident response drill                                                  │
│                                                                             │
│  ANNUALLY:                                                                  │
│  • Full disaster recovery drill                                             │
│  • Region failover test                                                     │
│  • Update DR documentation                                                  │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  CHAOS ENGINEERING (Optional Advanced):                                     │
│  ══════════════════════════════════════                                     │
│                                                                             │
│  Intentionally break things to test resilience:                             │
│                                                                             │
│  • Kill random pods                                                         │
│  • Introduce network latency                                                │
│  • Simulate zone failure                                                    │
│  • Fill up disk space                                                       │
│                                                                             │
│  Tools: Chaos Monkey, Gremlin, LitmusChaos                                  │
│                                                                             │
│  Start in staging, graduate to production during low-traffic periods!       │
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
│  1. DEFINE OBJECTIVES                                                       │
│     RTO (downtime) and RPO (data loss) targets                              │
│                                                                             │
│  2. BACKUP EVERYTHING                                                       │
│     Database, files, config, secrets                                        │
│     Test restores regularly!                                                │
│                                                                             │
│  3. DESIGN FOR FAILURE                                                      │
│     Multi-zone deployment                                                   │
│     Database high availability                                              │
│     Automatic failover                                                      │
│                                                                             │
│  4. HAVE A PLAN                                                             │
│     Documented runbooks                                                     │
│     Clear severity levels                                                   │
│     Defined roles and responsibilities                                      │
│                                                                             │
│  5. PRACTICE                                                                │
│     Regular DR drills                                                       │
│     Test backup restores                                                    │
│     Blameless post-mortems                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

- [15. Monitoring & Observability](./15_monitoring.md) - Detecting issues early
- [14. Security Architecture](./14_security.md) - Security incidents
