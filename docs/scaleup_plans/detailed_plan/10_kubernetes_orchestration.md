# Phase 2B: Kubernetes Orchestration

## Document Version
- **Version**: 2.0.0
- **Created**: 2026-02-04
- **Last Updated**: 2026-03-17
- **Phase**: 2 - Containerization & Orchestration
- **Status**: Not Started (0%)

> **Implementation Status**: See [Phase 2 Implementation Details](../implementation_details/phase2_containerization.md) for current implementation status.

---

## 📚 Learning Resources

Before creating Kubernetes manifests, make sure you understand the underlying concepts:

| Topic | System Design Document | What You'll Learn |
|-------|------------------------|-------------------|
| **Kubernetes Basics** | [07_container_orchestration.md](../../system_design/07_container_orchestration.md) | Pods, Deployments, Services, Ingress - all the K8s concepts |
| **GKE Specifics** | [07_container_orchestration.md](../../system_design/07_container_orchestration.md) | Google Kubernetes Engine specifics |
| **Auto-Scaling** | [08_autoscaling_loadbalancing.md](../../system_design/08_autoscaling_loadbalancing.md) | Horizontal Pod Autoscaler, Node Autoprovisioning |
| **Load Balancing** | [08_autoscaling_loadbalancing.md](../../system_design/08_autoscaling_loadbalancing.md) | How traffic reaches your pods |
| **Secrets in K8s** | [13_secrets_management.md](../../system_design/13_secrets_management.md) | K8s Secrets, ConfigMaps, integration with Secret Manager |
| **Security** | [14_security.md](../../system_design/14_security.md) | Network policies, RBAC, pod security |

> 💡 **Tip**: If terms like "Deployment", "ReplicaSet", "Ingress", or "HPA" are unfamiliar, read `07_container_orchestration.md` first!

---

## Overview

This document outlines the Kubernetes orchestration strategy for deploying and managing the HTA Calibration system on Google Kubernetes Engine (GKE).

---

## Kubernetes Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        GKE CLUSTER ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│                              Google Cloud Platform                              │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │                                                                          │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐ │   │
│  │  │                    GKE Cluster: hta-cluster                        │ │   │
│  │  │  ──────────────────────────────────────────────────────────────── │ │   │
│  │  │                                                                    │ │   │
│  │  │  NAMESPACE: hta-production                                         │ │   │
│  │  │  ┌─────────────────────────────────────────────────────────────┐  │ │   │
│  │  │  │                                                             │  │ │   │
│  │  │  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐        │  │ │   │
│  │  │  │  │hta-web  │  │hta-web  │  │hta-web  │  │ ... n   │        │  │ │   │
│  │  │  │  │ pod-1   │  │ pod-2   │  │ pod-3   │  │  pods   │        │  │ │   │
│  │  │  │  └────┬────┘  └────┬────┘  └────┬────┘  └────┬────┘        │  │ │   │
│  │  │  │       └─────────────┴──────────┴─────────────┘              │  │ │   │
│  │  │  │                          │                                  │  │ │   │
│  │  │  │                          ▼                                  │  │ │   │
│  │  │  │              ┌─────────────────────┐                        │  │ │   │
│  │  │  │              │   Service (ClusterIP)│                        │  │ │   │
│  │  │  │              │   hta-web-service    │                        │  │ │   │
│  │  │  │              └──────────┬──────────┘                        │  │ │   │
│  │  │  │                         │                                   │  │ │   │
│  │  │  └─────────────────────────┼───────────────────────────────────┘  │ │   │
│  │  │                            │                                      │ │   │
│  │  │  NAMESPACE: hta-staging                                           │ │   │
│  │  │  ┌─────────────────────────────────────────────────────────────┐  │ │   │
│  │  │  │  (Similar structure, smaller scale)                         │  │ │   │
│  │  │  └─────────────────────────────────────────────────────────────┘  │ │   │
│  │  │                                                                    │ │   │
│  │  │  NAMESPACE: hta-system (shared services)                          │ │   │
│  │  │  ┌─────────────────────────────────────────────────────────────┐  │ │   │
│  │  │  │  • Ingress Controller                                       │  │ │   │
│  │  │  │  • Cert Manager                                             │  │ │   │
│  │  │  │  • External Secrets Operator                                │  │ │   │
│  │  │  └─────────────────────────────────────────────────────────────┘  │ │   │
│  │  │                                                                    │ │   │
│  │  └────────────────────────────────────────────────────────────────────┘ │   │
│  │                                     │                                    │   │
│  │                                     ▼                                    │   │
│  │                        ┌─────────────────────┐                           │   │
│  │                        │   Cloud Load        │                           │   │
│  │                        │   Balancer          │                           │   │
│  │                        └─────────────────────┘                           │   │
│  │                                     │                                    │   │
│  └─────────────────────────────────────┼────────────────────────────────────┘   │
│                                        │                                        │
│                                        ▼                                        │
│                                   Internet                                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Namespace Strategy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        NAMESPACE ORGANIZATION                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  NAMESPACE              PURPOSE                    RESOURCE QUOTAS              │
│  ═════════              ═══════                    ═══════════════              │
│                                                                                 │
│  hta-production         Production workloads       CPU: 8 cores                 │
│                         Live customer traffic      Memory: 16Gi                 │
│                                                    Pods: 20                     │
│                                                                                 │
│  hta-staging            Pre-production testing     CPU: 4 cores                 │
│                         E2E testing                Memory: 8Gi                  │
│                                                    Pods: 10                     │
│                                                                                 │
│  hta-preview            PR preview deployments     CPU: 2 cores                 │
│                         Ephemeral environments     Memory: 4Gi                  │
│                                                    Pods: 5                      │
│                                                                                 │
│  hta-system             Shared infrastructure      Managed separately           │
│                         Ingress, cert-manager                                   │
│                                                                                 │
│  ISOLATION:                                                                     │
│  • Network policies restrict cross-namespace traffic                            │
│  • RBAC limits access per namespace                                             │
│  • Resource quotas prevent noisy neighbor issues                                │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Workload Resources

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        KUBERNETES RESOURCES                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  DEPLOYMENT: hta-web                                                            │
│  ═══════════════════                                                            │
│                                                                                 │
│  Specifications:                                                                │
│  • Replicas: 3 (production), 2 (staging), 1 (preview)                           │
│  • Strategy: RollingUpdate                                                      │
│    - maxSurge: 1                                                                │
│    - maxUnavailable: 0                                                          │
│  • Pod Disruption Budget: minAvailable 2 (production)                           │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  SERVICE: hta-web-service                                                       │
│  ════════════════════════                                                       │
│                                                                                 │
│  Type: ClusterIP                                                                │
│  Port: 80 → 3000 (container)                                                    │
│  Session Affinity: None                                                         │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  INGRESS: hta-ingress                                                           │
│  ════════════════════                                                           │
│                                                                                 │
│  Controller: GKE Ingress (or nginx-ingress)                                     │
│  TLS: Managed by cert-manager (Let's Encrypt)                                   │
│                                                                                 │
│  Rules:                                                                         │
│  • hta.company.com → hta-web-service (production)                               │
│  • staging.hta.company.com → hta-web-service (staging)                          │
│  • pr-123.hta.company.com → hta-web-service (preview)                           │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  HORIZONTAL POD AUTOSCALER: hta-web-hpa                                         │
│  ══════════════════════════════════════                                         │
│                                                                                 │
│  Min Replicas: 3                                                                │
│  Max Replicas: 10                                                               │
│  Target CPU: 70%                                                                │
│  Target Memory: 80%                                                             │
│  Scale Down Stabilization: 300 seconds                                          │
│  Scale Up Policy: 100% increase per 60 seconds                                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Configuration Management

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        CONFIGMAPS & SECRETS                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  CONFIGMAP: hta-config                                                          │
│  ═════════════════════                                                          │
│                                                                                 │
│  Non-sensitive configuration:                                                   │
│  • NODE_ENV: production                                                         │
│  • LOG_LEVEL: info                                                              │
│  • NEXT_PUBLIC_APP_URL: https://hta.company.com                                 │
│  • OPENSIGN_API_URL: https://sign.hta.company.com                               │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  SECRET: hta-secrets (via External Secrets Operator)                            │
│  ═════════════════════════════════════════════════                              │
│                                                                                 │
│  Synced from GCP Secret Manager:                                                │
│  • DATABASE_URL                                                                 │
│  • NEXTAUTH_SECRET                                                              │
│  • OPENSIGN_API_KEY                                                             │
│  • SMTP_PASSWORD                                                                │
│                                                                                 │
│  EXTERNAL SECRETS FLOW:                                                         │
│                                                                                 │
│  ┌─────────────────┐     ┌─────────────────┐     ┌─────────────────┐           │
│  │  GCP Secret     │────▶│ External Secrets│────▶│  K8s Secret     │           │
│  │  Manager        │     │   Operator      │     │  (auto-synced)  │           │
│  └─────────────────┘     └─────────────────┘     └─────────────────┘           │
│                                                                                 │
│  Benefits:                                                                      │
│  • Secrets never stored in Git                                                  │
│  • Automatic rotation support                                                   │
│  • Centralized secret management                                                │
│  • Audit logging                                                                │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Deployment Strategy

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        DEPLOYMENT STRATEGIES                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  ROLLING UPDATE (Default)                                                       │
│  ════════════════════════                                                       │
│                                                                                 │
│  ┌─────┐ ┌─────┐ ┌─────┐     ┌─────┐ ┌─────┐ ┌─────┐ ┌─────┐                  │
│  │v1.0 │ │v1.0 │ │v1.0 │ ──▶ │v1.0 │ │v1.0 │ │v1.0 │ │v1.1 │ (surge)          │
│  └─────┘ └─────┘ └─────┘     └─────┘ └─────┘ └─────┘ └─────┘                  │
│                                                                                 │
│                          ──▶ ┌─────┐ ┌─────┐ ┌─────┐ (old pod terminated)      │
│                              │v1.0 │ │v1.1 │ │v1.1 │                           │
│                              └─────┘ └─────┘ └─────┘                           │
│                                                                                 │
│                          ──▶ ┌─────┐ ┌─────┐ ┌─────┐ (complete)                │
│                              │v1.1 │ │v1.1 │ │v1.1 │                           │
│                              └─────┘ └─────┘ └─────┘                           │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  BLUE-GREEN (For Critical Releases)                                             │
│  ══════════════════════════════════                                             │
│                                                                                 │
│  ┌─────────────────────────┐     ┌─────────────────────────┐                   │
│  │  Blue (Current - v1.0)  │     │  Green (New - v1.1)     │                   │
│  │  ┌─────┐┌─────┐┌─────┐  │     │  ┌─────┐┌─────┐┌─────┐  │                   │
│  │  │ pod ││ pod ││ pod │  │     │  │ pod ││ pod ││ pod │  │                   │
│  │  └─────┘└─────┘└─────┘  │     │  └─────┘└─────┘└─────┘  │                   │
│  │           │             │     │           │             │                   │
│  │    100% traffic         │     │     0% traffic         │                   │
│  └───────────┼─────────────┘     └───────────┼─────────────┘                   │
│              │                               │                                  │
│              └───────────────┬───────────────┘                                  │
│                              │                                                  │
│                              ▼                                                  │
│                       ┌─────────────┐                                           │
│                       │  Service    │                                           │
│                       │  (selector) │  ← Switch selector to flip traffic       │
│                       └─────────────┘                                           │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  CANARY (For Gradual Rollout)                                                   │
│  ════════════════════════════                                                   │
│                                                                                 │
│  Traffic Split: 90% stable / 10% canary                                         │
│                                                                                 │
│  ┌─────────────────────────┐     ┌─────────────────────────┐                   │
│  │  Stable (v1.0)          │     │  Canary (v1.1)          │                   │
│  │  3 replicas             │     │  1 replica              │                   │
│  │  90% traffic            │     │  10% traffic            │                   │
│  └─────────────────────────┘     └─────────────────────────┘                   │
│                                                                                 │
│  Promotion criteria:                                                            │
│  • Error rate < 0.1%                                                            │
│  • P95 latency < 500ms                                                          │
│  • No critical alerts                                                           │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Network Policies

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        NETWORK POLICIES                                          │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  DEFAULT DENY                                                                   │
│  ════════════                                                                   │
│                                                                                 │
│  All namespaces start with default deny for ingress traffic.                    │
│  Only explicitly allowed traffic passes.                                        │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  ALLOWED TRAFFIC FLOWS:                                                         │
│                                                                                 │
│  ┌─────────────┐                                                                │
│  │  Internet   │                                                                │
│  └──────┬──────┘                                                                │
│         │ HTTPS (443)                                                           │
│         ▼                                                                       │
│  ┌─────────────┐                                                                │
│  │  Ingress    │  ← Only accepts traffic from load balancer                     │
│  │  Controller │                                                                │
│  └──────┬──────┘                                                                │
│         │ HTTP (80)                                                             │
│         ▼                                                                       │
│  ┌─────────────┐                                                                │
│  │  hta-web    │  ← Only accepts traffic from ingress                           │
│  │  pods       │                                                                │
│  └──────┬──────┘                                                                │
│         │ PostgreSQL (5432)                                                     │
│         ▼                                                                       │
│  ┌─────────────┐                                                                │
│  │  Cloud SQL  │  ← Via Cloud SQL Proxy sidecar                                 │
│  │  (external) │                                                                │
│  └─────────────┘                                                                │
│                                                                                 │
│  CROSS-NAMESPACE:                                                               │
│  • hta-staging cannot access hta-production                                     │
│  • hta-preview cannot access hta-staging or hta-production                      │
│  • hta-system can be accessed from all (ingress, monitoring)                    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Helm Chart Structure

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        HELM CHART ORGANIZATION                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  charts/                                                                        │
│  └── hta-calibration/                                                           │
│      ├── Chart.yaml                  # Chart metadata                           │
│      ├── values.yaml                 # Default values                           │
│      ├── values-staging.yaml         # Staging overrides                        │
│      ├── values-production.yaml      # Production overrides                     │
│      │                                                                          │
│      ├── templates/                                                             │
│      │   ├── _helpers.tpl            # Template helpers                         │
│      │   ├── deployment.yaml         # Main application deployment              │
│      │   ├── service.yaml            # ClusterIP service                        │
│      │   ├── ingress.yaml            # Ingress rules                            │
│      │   ├── hpa.yaml                # Horizontal Pod Autoscaler                │
│      │   ├── pdb.yaml                # Pod Disruption Budget                    │
│      │   ├── configmap.yaml          # Configuration                            │
│      │   ├── external-secret.yaml    # External Secrets definition              │
│      │   ├── networkpolicy.yaml      # Network policies                         │
│      │   └── serviceaccount.yaml     # Service account for workload identity   │
│      │                                                                          │
│      └── tests/                                                                 │
│          └── test-connection.yaml    # Helm test                                │
│                                                                                 │
│  HELM RELEASE NAMING:                                                           │
│  • Production: hta-calibration-prod                                             │
│  • Staging: hta-calibration-staging                                             │
│  • Preview: hta-calibration-pr-<number>                                         │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## GKE Cluster Configuration

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        GKE CLUSTER SPECIFICATIONS                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  CLUSTER SETTINGS                                                               │
│  ════════════════                                                               │
│                                                                                 │
│  Name: hta-cluster                                                              │
│  Location: asia-south1 (Mumbai)                                                 │
│  Type: Regional (3 zones for HA)                                                │
│  Version: Latest stable GKE version                                             │
│  Release Channel: Regular                                                       │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  NODE POOLS                                                                     │
│  ══════════                                                                     │
│                                                                                 │
│  Default Pool (General Workloads):                                              │
│  • Machine type: e2-standard-4 (4 vCPU, 16GB RAM)                               │
│  • Nodes per zone: 1-3 (autoscaling)                                            │
│  • Total: 3-9 nodes                                                             │
│  • Preemptible: No (production stability)                                       │
│                                                                                 │
│  Spot Pool (Non-critical, Cost Savings):                                        │
│  • Machine type: e2-standard-2 (2 vCPU, 8GB RAM)                                │
│  • Nodes per zone: 0-2 (autoscaling)                                            │
│  • Preemptible/Spot: Yes                                                        │
│  • Use for: Preview environments, batch jobs                                    │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  CLUSTER FEATURES                                                               │
│  ════════════════                                                               │
│                                                                                 │
│  • Workload Identity: Enabled (for GCP service access)                          │
│  • Network Policy: Enabled (Calico)                                             │
│  • Binary Authorization: Enabled                                                │
│  • Shielded GKE Nodes: Enabled                                                  │
│  • Private Cluster: Yes (nodes have internal IPs only)                          │
│  • Master Authorized Networks: Restricted                                       │
│  • Vertical Pod Autoscaling: Enabled                                            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Disaster Recovery

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        DISASTER RECOVERY                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  BACKUP STRATEGY                                                                │
│  ═══════════════                                                                │
│                                                                                 │
│  Kubernetes Resources:                                                          │
│  • Velero for cluster state backup                                              │
│  • Daily backups retained for 30 days                                           │
│  • Stored in separate GCS bucket                                                │
│                                                                                 │
│  Database:                                                                      │
│  • Cloud SQL automated backups (daily)                                          │
│  • Point-in-time recovery enabled                                               │
│  • Cross-region backup replication                                              │
│                                                                                 │
│  ─────────────────────────────────────────────────────────────────────────────  │
│                                                                                 │
│  RECOVERY SCENARIOS                                                             │
│  ══════════════════                                                             │
│                                                                                 │
│  Pod Failure:                                                                   │
│  • Auto-restart by kubelet                                                      │
│  • RTO: Seconds                                                                 │
│                                                                                 │
│  Node Failure:                                                                  │
│  • Pods rescheduled to healthy nodes                                            │
│  • RTO: 1-2 minutes                                                             │
│                                                                                 │
│  Zone Failure:                                                                  │
│  • Regional cluster continues operating                                         │
│  • Traffic shifts to healthy zones                                              │
│  • RTO: 2-5 minutes                                                             │
│                                                                                 │
│  Cluster Failure:                                                               │
│  • Restore from Velero backup to new cluster                                    │
│  • Database failover (Cloud SQL HA)                                             │
│  • RTO: 30-60 minutes                                                           │
│                                                                                 │
│  Region Failure:                                                                │
│  • Failover to secondary region (if configured)                                 │
│  • DNS failover                                                                 │
│  • RTO: 60+ minutes                                                             │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Success Metrics

| Metric | Target |
|--------|--------|
| Pod Startup Time | < 30 seconds |
| Rolling Update Duration | < 5 minutes |
| Pod Availability | 99.9% |
| Cluster Upgrade Downtime | 0 (rolling) |
| Recovery Time (pod failure) | < 60 seconds |

---

## Next Steps

1. Set up GKE cluster via Terraform
2. Install cluster add-ons (ingress, cert-manager, external-secrets)
3. Create Helm chart for HTA application
4. Configure CI/CD to deploy to K8s
5. Set up monitoring dashboards

---

## Related Documents

- [Containerization](./03_containerization.md) - Docker images deployed to K8s
- [GCP Infrastructure](./04_gcp_infrastructure.md) - Underlying cloud infrastructure
- [Terraform IaC](./05_terraform_iac.md) - Infrastructure provisioning
- [Scale-Up Overview](./00_scaleup_overview.md) - Master planning document
