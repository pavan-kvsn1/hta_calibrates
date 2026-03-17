# Auto-Scaling & Load Balancing

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Prerequisite**: [07_container_orchestration.md](./07_container_orchestration.md)

---

## Introduction

This document explains how HTA Calibration automatically handles varying traffic loads. We'll cover load balancing, auto-scaling, and high availability patterns.

---

## Part 1: Why Auto-Scaling Matters

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WHY AUTO-SCALING?                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  TRAFFIC PATTERNS:                                                          │
│  ═════════════════                                                          │
│                                                                             │
│    Requests/minute                                                          │
│    │                                                                        │
│    │                    ┌──────┐                                            │
│    │                 ┌──┘      └──┐    Conference demo!                     │
│    │              ┌──┘            └──┐                                      │
│    │  ┌──────────┘                   └──────────┐                           │
│    │──┘                                         └────  Normal traffic       │
│    │                                                                        │
│    └────────────────────────────────────────────────────▶ Time              │
│       6AM        12PM        3PM         6PM        12AM                    │
│                                                                             │
│  WITHOUT AUTO-SCALING:                                                      │
│  ════════════════════                                                       │
│                                                                             │
│  Option A: Provision for peak                                               │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │   Resources ████████████████████████████████████████████████████████│   │
│  │   Traffic   ███░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│   │
│  │                                                                      │   │
│  │   Paying for 100% resources but using only 20%!                      │   │
│  │   WASTED: 80% of costs 💸                                            │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  Option B: Provision for average                                            │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │   Resources ███████████░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░░│   │
│  │   Traffic   ███████████████████████████████░░░░░░░░░░░░░░░░░░░░░░░░│   │
│  │                         ▲                                            │   │
│  │                         │                                            │   │
│  │   When traffic exceeds capacity: CRASH! 😱                           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  WITH AUTO-SCALING:                                                         │
│  ═══════════════════                                                        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │   Resources ███░░░░████████████░░░░░░░░░░███░░░░░░░░░░░░░░░░░░░░░░░│   │
│  │   Traffic   ███░░░░████████████░░░░░░░░░░███░░░░░░░░░░░░░░░░░░░░░░░│   │
│  │                                                                      │   │
│  │   Resources scale UP and DOWN with traffic!                          │   │
│  │   Pay only for what you use ✅                                       │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Load Balancing Deep Dive

### How Load Balancing Works

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LOAD BALANCING                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SINGLE SERVER (No load balancer):                                          │
│  ═════════════════════════════════                                          │
│                                                                             │
│    Users ───────▶ Server                                                    │
│                                                                             │
│    • If server crashes → Site is down                                       │
│    • If overloaded → Everyone is slow                                       │
│    • Can't update without downtime                                          │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  WITH LOAD BALANCER:                                                        │
│  ═══════════════════                                                        │
│                                                                             │
│    ┌─────────────────────────────────────────────────────────────────┐     │
│    │                                                                  │     │
│    │   Users                                                          │     │
│    │   │ │ │ │ │ │                                                    │     │
│    │   └─┴─┴─┴─┴─┘                                                    │     │
│    │        │                                                         │     │
│    │        ▼                                                         │     │
│    │   ┌────────────────────────────────────────────────────────┐    │     │
│    │   │           GOOGLE CLOUD LOAD BALANCER                    │    │     │
│    │   │                                                         │    │     │
│    │   │   • Receives all incoming requests                      │    │     │
│    │   │   • Checks which servers are healthy                    │    │     │
│    │   │   • Distributes requests evenly                         │    │     │
│    │   │   • Handles SSL/TLS encryption                          │    │     │
│    │   │                                                         │    │     │
│    │   └────────────────────┬───────────────────────────────────┘    │     │
│    │                        │                                         │     │
│    │          ┌─────────────┼─────────────┐                          │     │
│    │          │             │             │                           │     │
│    │          ▼             ▼             ▼                           │     │
│    │   ┌───────────┐ ┌───────────┐ ┌───────────┐                     │     │
│    │   │  Pod 1    │ │  Pod 2    │ │  Pod 3    │                     │     │
│    │   │  (HTA)    │ │  (HTA)    │ │  (HTA)    │                     │     │
│    │   │   ✅      │ │   ✅      │ │   ❌      │ ← Failed health check│     │
│    │   └───────────┘ └───────────┘ └───────────┘                     │     │
│    │                                    │                             │     │
│    │                                    └── No traffic sent here!     │     │
│    │                                                                  │     │
│    └─────────────────────────────────────────────────────────────────┘     │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Load Balancing Algorithms

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LOAD BALANCING ALGORITHMS                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ROUND ROBIN:                                                               │
│  ═════════════                                                              │
│  Send requests in order: Pod 1 → Pod 2 → Pod 3 → Pod 1 → ...               │
│                                                                             │
│  Request 1 → Pod 1                                                          │
│  Request 2 → Pod 2                                                          │
│  Request 3 → Pod 3                                                          │
│  Request 4 → Pod 1                                                          │
│  ...                                                                        │
│                                                                             │
│  Pros: Simple, even distribution                                            │
│  Cons: Ignores server load, some requests take longer                       │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  LEAST CONNECTIONS (Our Choice) ✅:                                         │
│  ══════════════════════════════════                                         │
│  Send to the server with fewest active connections.                         │
│                                                                             │
│  Pod 1: 50 connections                                                      │
│  Pod 2: 30 connections  ← Next request goes here!                           │
│  Pod 3: 45 connections                                                      │
│                                                                             │
│  Pros: Adapts to different request durations                                │
│  Cons: Slightly more complex                                                │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  IP HASH (Session Affinity):                                                │
│  ═══════════════════════════                                                │
│  Same user IP always goes to same server.                                   │
│                                                                             │
│  User from 203.0.113.5 → Always Pod 2                                       │
│  User from 198.51.100.8 → Always Pod 1                                      │
│                                                                             │
│  Pros: Useful for session-based apps                                        │
│  Cons: Uneven distribution, we don't need this (stateless app)              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Health Checks

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HEALTH CHECKS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Load balancer constantly checks: "Are you alive and working?"              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   Load Balancer                                                      │   │
│  │        │                                                             │   │
│  │        │ GET /api/health (every 10 seconds)                          │   │
│  │        │                                                             │   │
│  │        ▼                                                             │   │
│  │   ┌───────────┐                                                      │   │
│  │   │   Pod 1   │                                                      │   │
│  │   │           │                                                      │   │
│  │   │   /api/   │ ─────▶ Check:                                       │   │
│  │   │   health  │        • Database connected? ✅                      │   │
│  │   │           │        • Memory OK? ✅                               │   │
│  │   │           │        • Disk space? ✅                              │   │
│  │   │           │                                                      │   │
│  │   │           │ ◀───── Response: 200 OK                             │   │
│  │   │           │        { "status": "healthy" }                       │   │
│  │   └───────────┘                                                      │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  HEALTH CHECK CONFIG:                                                       │
│  ═════════════════════                                                      │
│                                                                             │
│  // Kubernetes liveness probe                                               │
│  livenessProbe:                                                             │
│    httpGet:                                                                 │
│      path: /api/health                                                      │
│      port: 3000                                                             │
│    initialDelaySeconds: 30    # Wait 30s after start                        │
│    periodSeconds: 10          # Check every 10s                             │
│    failureThreshold: 3        # 3 failures = unhealthy                      │
│                                                                             │
│  // Kubernetes readiness probe                                              │
│  readinessProbe:                                                            │
│    httpGet:                                                                 │
│      path: /api/health                                                      │
│      port: 3000                                                             │
│    initialDelaySeconds: 5     # Check soon after start                      │
│    periodSeconds: 5           # Check every 5s                              │
│                                                                             │
│  LIVENESS vs READINESS:                                                     │
│  ══════════════════════                                                     │
│  Liveness: "Should this pod be RESTARTED?" (crashed/hung)                   │
│  Readiness: "Should this pod RECEIVE TRAFFIC?" (still starting)             │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Horizontal Pod Autoscaler (HPA)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HORIZONTAL POD AUTOSCALER                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  HPA automatically adjusts the number of pods based on metrics.             │
│                                                                             │
│  SCALING DECISION:                                                          │
│  ═════════════════                                                          │
│                                                                             │
│  Target: CPU 70%                                                            │
│  Current: 3 pods at 90% CPU each                                            │
│                                                                             │
│  desiredReplicas = currentReplicas × (currentMetric / desiredMetric)        │
│  desiredReplicas = 3 × (90 / 70) = 3.86 ≈ 4 pods                            │
│                                                                             │
│  HPA adds 1 pod!                                                            │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  SCALE UP SCENARIO:                                                         │
│  ═══════════════════                                                        │
│                                                                             │
│    Time 0:00 - Normal traffic                                               │
│    ┌───────┐ ┌───────┐ ┌───────┐                                           │
│    │ Pod 1 │ │ Pod 2 │ │ Pod 3 │  CPU: 40%, 35%, 45%                       │
│    │  40%  │ │  35%  │ │  45%  │  Average: 40%                              │
│    └───────┘ └───────┘ └───────┘  Target: 70%  →  No change                │
│                                                                             │
│    Time 1:00 - Traffic spike!                                               │
│    ┌───────┐ ┌───────┐ ┌───────┐                                           │
│    │ Pod 1 │ │ Pod 2 │ │ Pod 3 │  CPU: 85%, 90%, 88%                       │
│    │  85%  │ │  90%  │ │  88%  │  Average: 88%                              │
│    └───────┘ └───────┘ └───────┘  Target: 70%  →  SCALE UP!                │
│                                                                             │
│    Time 1:05 - HPA adds pods                                                │
│    ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐                       │
│    │ Pod 1 │ │ Pod 2 │ │ Pod 3 │ │ Pod 4 │ │ Pod 5 │  5 pods now           │
│    │  65%  │ │  68%  │ │  70%  │ │  60%  │ │  55%  │  Average: 64%         │
│    └───────┘ └───────┘ └───────┘ └───────┘ └───────┘                       │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  SCALE DOWN SCENARIO:                                                       │
│  ═════════════════════                                                      │
│                                                                             │
│    Time 3:00 - Traffic decreases                                            │
│    ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐ ┌───────┐                       │
│    │  25%  │ │  20%  │ │  30%  │ │  22%  │ │  18%  │  Average: 23%         │
│    └───────┘ └───────┘ └───────┘ └───────┘ └───────┘                       │
│                                                                             │
│    Time 3:05 - HPA removes pods (gradually, with cooldown)                  │
│    ┌───────┐ ┌───────┐ ┌───────┐                                           │
│    │ Pod 1 │ │ Pod 2 │ │ Pod 3 │  Back to 3 pods                           │
│    │  40%  │ │  35%  │ │  38%  │  Average: 38%                              │
│    └───────┘ └───────┘ └───────┘                                           │
│                                                                             │
│  Note: Scale down is slower (stabilization period) to avoid flapping.       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### HPA Configuration

```yaml
┌─────────────────────────────────────────────────────────────────────────────┐
│                    HPA CONFIGURATION                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  # k8s/hpa.yaml                                                             │
│                                                                             │
│  apiVersion: autoscaling/v2                                                 │
│  kind: HorizontalPodAutoscaler                                              │
│  metadata:                                                                  │
│    name: hta-web-hpa                                                        │
│    namespace: production                                                    │
│  spec:                                                                      │
│    scaleTargetRef:                                                          │
│      apiVersion: apps/v1                                                    │
│      kind: Deployment                                                       │
│      name: hta-web                                                          │
│                                                                             │
│    minReplicas: 3            # Never fewer than 3 pods                      │
│    maxReplicas: 20           # Never more than 20 pods                      │
│                                                                             │
│    metrics:                                                                 │
│    # Scale based on CPU                                                     │
│    - type: Resource                                                         │
│      resource:                                                              │
│        name: cpu                                                            │
│        target:                                                              │
│          type: Utilization                                                  │
│          averageUtilization: 70    # Target 70% CPU                         │
│                                                                             │
│    # Also scale based on memory                                             │
│    - type: Resource                                                         │
│      resource:                                                              │
│        name: memory                                                         │
│        target:                                                              │
│          type: Utilization                                                  │
│          averageUtilization: 80    # Target 80% memory                      │
│                                                                             │
│    # Behavior configuration                                                 │
│    behavior:                                                                │
│      scaleUp:                                                               │
│        stabilizationWindowSeconds: 60   # Wait 60s before scaling up        │
│        policies:                                                            │
│        - type: Pods                                                         │
│          value: 4                       # Add max 4 pods at a time          │
│          periodSeconds: 60                                                  │
│      scaleDown:                                                             │
│        stabilizationWindowSeconds: 300  # Wait 5 min before scaling down    │
│        policies:                                                            │
│        - type: Pods                                                         │
│          value: 2                       # Remove max 2 pods at a time       │
│          periodSeconds: 60                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 4: Node Auto-Provisioning

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    NODE AUTO-PROVISIONING                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  HPA scales PODS, but what if nodes are full?                               │
│  GKE Cluster Autoscaler adds/removes NODES (VMs)!                           │
│                                                                             │
│  SCENARIO: HPA wants 10 pods but only 6 fit                                 │
│  ════════════════════════════════════════════                               │
│                                                                             │
│    ┌───────────────────────┐  ┌───────────────────────┐                    │
│    │      NODE 1 (FULL)    │  │      NODE 2 (FULL)    │                    │
│    │  ┌─────┐ ┌─────┐      │  │  ┌─────┐ ┌─────┐      │                    │
│    │  │Pod 1│ │Pod 2│      │  │  │Pod 4│ │Pod 5│      │                    │
│    │  └─────┘ └─────┘      │  │  └─────┘ └─────┘      │                    │
│    │  ┌─────┐              │  │  ┌─────┐              │                    │
│    │  │Pod 3│              │  │  │Pod 6│              │                    │
│    │  └─────┘              │  │  └─────┘              │                    │
│    └───────────────────────┘  └───────────────────────┘                    │
│                                                                             │
│    Pods 7, 8, 9, 10 are PENDING - no room!                                  │
│                                                                             │
│                         │                                                   │
│                         ▼  Cluster Autoscaler adds node                     │
│                                                                             │
│    ┌───────────────────────┐  ┌───────────────────────┐                    │
│    │      NODE 1           │  │      NODE 2           │                    │
│    │  ┌─────┐ ┌─────┐      │  │  ┌─────┐ ┌─────┐      │                    │
│    │  │Pod 1│ │Pod 2│      │  │  │Pod 4│ │Pod 5│      │                    │
│    │  └─────┘ └─────┘      │  │  └─────┘ └─────┘      │                    │
│    │  ┌─────┐              │  │  ┌─────┐              │                    │
│    │  │Pod 3│              │  │  │Pod 6│              │                    │
│    │  └─────┘              │  │  └─────┘              │                    │
│    └───────────────────────┘  └───────────────────────┘                    │
│                                                                             │
│    ┌───────────────────────┐  ← NEW NODE ADDED!                            │
│    │      NODE 3 (NEW)     │                                                │
│    │  ┌─────┐ ┌─────┐      │                                                │
│    │  │Pod 7│ │Pod 8│      │                                                │
│    │  └─────┘ └─────┘      │                                                │
│    │  ┌─────┐ ┌─────┐      │                                                │
│    │  │Pod 9│ │Pod10│      │                                                │
│    │  └─────┘ └─────┘      │                                                │
│    └───────────────────────┘                                                │
│                                                                             │
│  SCALE DOWN:                                                                │
│  ═══════════                                                                │
│  When traffic decreases and node is mostly empty:                           │
│  • Pods are migrated to other nodes                                         │
│  • Empty node is terminated                                                 │
│  • You stop paying for it!                                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 5: High Availability

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HIGH AVAILABILITY                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  MULTI-ZONE DEPLOYMENT:                                                     │
│  ══════════════════════                                                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                       LOAD BALANCER                                  │   │
│  │                      (Global, anycast)                               │   │
│  └──────────────────────────┬──────────────────────────────────────────┘   │
│                             │                                               │
│         ┌───────────────────┼───────────────────┐                          │
│         │                   │                   │                           │
│         ▼                   ▼                   ▼                           │
│  ┌─────────────────┐ ┌─────────────────┐ ┌─────────────────┐               │
│  │ Zone A          │ │ Zone B          │ │ Zone C          │               │
│  │                 │ │                 │ │                 │               │
│  │ ┌───┐ ┌───┐    │ │ ┌───┐ ┌───┐    │ │ ┌───┐ ┌───┐    │               │
│  │ │P1 │ │P2 │    │ │ │P3 │ │P4 │    │ │ │P5 │ │P6 │    │               │
│  │ └───┘ └───┘    │ │ └───┘ └───┘    │ │ └───┘ └───┘    │               │
│  │                 │ │                 │ │                 │               │
│  │ Cloud SQL      │ │ Cloud SQL      │ │                 │               │
│  │ Primary        │ │ Standby        │ │                 │               │
│  └─────────────────┘ └─────────────────┘ └─────────────────┘               │
│                                                                             │
│  WHAT HAPPENS IF ZONE A FAILS?                                              │
│  ══════════════════════════════                                             │
│                                                                             │
│  1. Load balancer detects Zone A pods are unhealthy                         │
│  2. Traffic automatically routes to Zone B and C                            │
│  3. Cloud SQL fails over to standby in Zone B                               │
│  4. GKE scheduler starts new pods in Zone B/C                               │
│  5. Users experience brief increase in latency, but no downtime!            │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  POD DISRUPTION BUDGET:                                                     │
│  ══════════════════════                                                     │
│                                                                             │
│  Ensures minimum availability during updates/maintenance:                   │
│                                                                             │
│  apiVersion: policy/v1                                                      │
│  kind: PodDisruptionBudget                                                  │
│  metadata:                                                                  │
│    name: hta-web-pdb                                                        │
│  spec:                                                                      │
│    minAvailable: 2           # Always keep at least 2 pods running          │
│    selector:                                                                │
│      matchLabels:                                                           │
│        app: hta-web                                                         │
│                                                                             │
│  During updates: Only 1 pod at a time is terminated!                        │
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
│  1. LOAD BALANCER                                                           │
│     Distributes traffic, handles SSL, health checks                         │
│                                                                             │
│  2. HPA (Horizontal Pod Autoscaler)                                         │
│     Scales pods based on CPU/memory metrics                                 │
│     Target 70% utilization for headroom                                     │
│                                                                             │
│  3. NODE AUTO-PROVISIONING                                                  │
│     GKE adds/removes VMs as needed                                          │
│     Pay only for what you use                                               │
│                                                                             │
│  4. MULTI-ZONE DEPLOYMENT                                                   │
│     Survive zone failures                                                   │
│     Automatic failover                                                      │
│                                                                             │
│  5. HEALTH CHECKS                                                           │
│     Liveness: Should pod restart?                                           │
│     Readiness: Should pod receive traffic?                                  │
│                                                                             │
│  6. POD DISRUPTION BUDGET                                                   │
│     Maintain availability during updates                                    │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

- [09. Event-Driven Architecture](./09_event_architecture.md) - Async processing
- [15. Monitoring & Observability](./15_monitoring.md) - Watching your system
