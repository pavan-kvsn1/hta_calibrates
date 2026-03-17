# HTA Calibration - GCP Infrastructure Design

## Document Version
- **Version**: 2.0.0
- **Created**: 2026-02-04
- **Last Updated**: 2026-03-17
- **Phase**: 3 - Cloud Infrastructure
- **Status**: Not Started (0%)

> **Implementation Status**: See [Phase 3 Implementation Details](../implementation_details/phase3_cloud_infrastructure.md) for current implementation status.

---

## 📚 Learning Resources

Before setting up GCP infrastructure, make sure you understand the underlying concepts:

| Topic | System Design Document | What You'll Learn |
|-------|------------------------|-------------------|
| **Cloud Basics** | [01_beginner_concepts.md](../../system_design/01_beginner_concepts.md) | What is the cloud, servers, regions |
| **GCP Fundamentals** | [06_gcp_fundamentals.md](../../system_design/06_gcp_fundamentals.md) | GCP services, IAM, billing, organization structure |
| **Container Orchestration** | [07_container_orchestration.md](../../system_design/07_container_orchestration.md) | GKE, Kubernetes concepts |
| **Database Architecture** | [05_database_architecture.md](../../system_design/05_database_architecture.md) | Cloud SQL, PostgreSQL, connection strategies |
| **Load Balancing** | [08_autoscaling_loadbalancing.md](../../system_design/08_autoscaling_loadbalancing.md) | Load balancers, health checks, CDN |
| **Networking & DNS** | [02_web_hosting_domains.md](../../system_design/02_web_hosting_domains.md) | DNS, SSL, how traffic flows |
| **Security** | [14_security.md](../../system_design/14_security.md) | Network security, firewalls, IAM |
| **Multi-Tenancy** | [04_multi_tenancy.md](../../system_design/04_multi_tenancy.md) | Tenant isolation, data separation |
| **Disaster Recovery** | [16_disaster_recovery.md](../../system_design/16_disaster_recovery.md) | RTO/RPO, backup strategies, failover |

> 💡 **Tip**: If VPC, CIDR ranges, or service accounts are new concepts, start with the GCP Fundamentals doc!

---

## Overview

This document outlines the Google Cloud Platform (GCP) infrastructure architecture for hosting the HTA Calibration system in a production environment.

---

## GCP Project Structure

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           GCP ORGANIZATION STRUCTURE                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  Organization: hta-calibration.com                                              │
│  │                                                                              │
│  ├── Folder: Production                                                         │
│  │   └── Project: hta-calibration-prod                                          │
│  │       ├── GKE Cluster (production workloads)                                 │
│  │       ├── Cloud SQL (production database)                                    │
│  │       ├── Cloud Storage (production assets)                                  │
│  │       └── Cloud Monitoring (production metrics)                              │
│  │                                                                              │
│  ├── Folder: Staging                                                            │
│  │   └── Project: hta-calibration-staging                                       │
│  │       ├── GKE Cluster (staging workloads)                                    │
│  │       ├── Cloud SQL (staging database)                                       │
│  │       └── Cloud Storage (staging assets)                                     │
│  │                                                                              │
│  ├── Folder: Development                                                        │
│  │   └── Project: hta-calibration-dev                                           │
│  │       ├── GKE Cluster (dev workloads)                                        │
│  │       └── Cloud SQL (dev database)                                           │
│  │                                                                              │
│  └── Folder: Shared                                                             │
│      └── Project: hta-calibration-shared                                        │
│          ├── Artifact Registry (container images)                               │
│          ├── Cloud DNS (domain management)                                      │
│          └── Secret Manager (shared secrets)                                    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Network Architecture

### VPC Design

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           VPC NETWORK ARCHITECTURE                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  VPC: hta-calibration-vpc                                                       │
│  Region: asia-southeast1 (Singapore) - Primary                                  │
│  Region: asia-east1 (Taiwan) - DR                                               │
│                                                                                 │
│  ┌─────────────────────────────────────────────────────────────────────────┐   │
│  │  SUBNET LAYOUT (asia-southeast1)                                         │   │
│  ├─────────────────────────────────────────────────────────────────────────┤   │
│  │                                                                          │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐ │   │
│  │  │  Public Subnet: 10.0.0.0/24                                        │ │   │
│  │  │  ────────────────────────────────────────────────────────────────  │ │   │
│  │  │  • Cloud Load Balancer                                             │ │   │
│  │  │  • Cloud NAT Gateway                                               │ │   │
│  │  │  • Bastion Host (if needed)                                        │ │   │
│  │  └────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                          │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐ │   │
│  │  │  GKE Subnet: 10.0.1.0/24                                           │ │   │
│  │  │  ────────────────────────────────────────────────────────────────  │ │   │
│  │  │  • GKE Node Pool                                                   │ │   │
│  │  │  • Pod CIDR: 10.1.0.0/16 (secondary range)                         │ │   │
│  │  │  • Service CIDR: 10.2.0.0/20 (secondary range)                     │ │   │
│  │  └────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                          │   │
│  │  ┌────────────────────────────────────────────────────────────────────┐ │   │
│  │  │  Database Subnet: 10.0.2.0/24                                      │ │   │
│  │  │  ────────────────────────────────────────────────────────────────  │ │   │
│  │  │  • Cloud SQL (Private IP)                                          │ │   │
│  │  │  • Private Service Connection                                      │ │   │
│  │  └────────────────────────────────────────────────────────────────────┘ │   │
│  │                                                                          │   │
│  └─────────────────────────────────────────────────────────────────────────┘   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Firewall Rules

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           FIREWALL RULES                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  INGRESS RULES                                                                  │
│  ─────────────                                                                  │
│                                                                                 │
│  Rule                      Source          Destination      Ports     Action    │
│  ────────────────────────────────────────────────────────────────────────────   │
│  allow-lb-health-check     GCP LB IPs      GKE nodes        80,443    ALLOW     │
│  allow-iap-ssh             IAP range       Bastion          22        ALLOW     │
│  allow-internal            VPC CIDR        VPC CIDR         all       ALLOW     │
│  deny-all-ingress          0.0.0.0/0       all              all       DENY      │
│                                                                                 │
│  EGRESS RULES                                                                   │
│  ────────────                                                                   │
│                                                                                 │
│  Rule                      Source          Destination      Ports     Action    │
│  ────────────────────────────────────────────────────────────────────────────   │
│  allow-egress-google       VPC CIDR        Google APIs      443       ALLOW     │
│  allow-egress-internal     VPC CIDR        VPC CIDR         all       ALLOW     │
│  deny-all-egress           VPC CIDR        0.0.0.0/0        all       DENY      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Compute Resources

### Google Kubernetes Engine (GKE)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           GKE CLUSTER CONFIGURATION                              │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  CLUSTER SETTINGS                                                               │
│  ────────────────                                                               │
│                                                                                 │
│  • Cluster Type: Regional (High Availability)                                   │
│  • Release Channel: Regular                                                     │
│  • Control Plane: Managed by Google                                             │
│  • Network Mode: VPC-native (alias IPs)                                         │
│  • Private Cluster: Yes (private nodes, public endpoint)                        │
│  • Master Authorized Networks: Enabled                                          │
│  • Workload Identity: Enabled                                                   │
│  • Binary Authorization: Enabled                                                │
│                                                                                 │
│  NODE POOLS                                                                     │
│  ──────────                                                                     │
│                                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐    │
│  │  Pool: default-pool                                                    │    │
│  │  ──────────────────────────────────────────────────────────────────    │    │
│  │  • Purpose: General workloads                                          │    │
│  │  • Machine Type: e2-standard-2 (2 vCPU, 8 GB RAM)                      │    │
│  │  • Nodes: 2-5 (autoscaling)                                            │    │
│  │  • Disk: 100 GB SSD                                                    │    │
│  │  • Preemptible: No (production stability)                              │    │
│  └────────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
│  ┌────────────────────────────────────────────────────────────────────────┐    │
│  │  Pool: spot-pool (Optional - Cost Optimization)                        │    │
│  │  ──────────────────────────────────────────────────────────────────    │    │
│  │  • Purpose: Non-critical batch jobs                                    │    │
│  │  • Machine Type: e2-standard-2                                         │    │
│  │  • Nodes: 0-3 (autoscaling)                                            │    │
│  │  • Spot VMs: Yes (70% cost savings)                                    │    │
│  │  • Taints: spot=true:NoSchedule                                        │    │
│  └────────────────────────────────────────────────────────────────────────┘    │
│                                                                                 │
│  CLUSTER ADD-ONS                                                                │
│  ──────────────                                                                 │
│                                                                                 │
│  • Horizontal Pod Autoscaler: Enabled                                           │
│  • Vertical Pod Autoscaler: Enabled                                             │
│  • Network Policy (Calico): Enabled                                             │
│  • GKE Backup for workloads: Enabled                                            │
│  • Config Connector: Enabled                                                    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Database Layer

### Cloud SQL (PostgreSQL)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CLOUD SQL CONFIGURATION                                │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  INSTANCE SETTINGS                                                              │
│  ─────────────────                                                              │
│                                                                                 │
│  • Database Engine: PostgreSQL 15                                               │
│  • Instance Type: db-custom-2-4096 (2 vCPU, 4 GB RAM)                          │
│  • Storage: 50 GB SSD (auto-increase enabled)                                   │
│  • Availability: Regional (High Availability)                                   │
│  • Location: asia-southeast1                                                    │
│                                                                                 │
│  CONNECTIVITY                                                                   │
│  ────────────                                                                   │
│                                                                                 │
│  • Private IP: Enabled (VPC peering)                                            │
│  • Public IP: Disabled                                                          │
│  • SSL Mode: Required                                                           │
│  • Authorized Networks: None (private only)                                     │
│                                                                                 │
│  BACKUP & RECOVERY                                                              │
│  ─────────────────                                                              │
│                                                                                 │
│  • Automated Backups: Daily (4:00 AM UTC+8)                                     │
│  • Backup Retention: 30 days                                                    │
│  • Point-in-Time Recovery: Enabled                                              │
│  • Binary Logging: Enabled                                                      │
│  • Cross-Region Backup: asia-east1                                              │
│                                                                                 │
│  MAINTENANCE                                                                    │
│  ───────────                                                                    │
│                                                                                 │
│  • Maintenance Window: Sunday 3:00-4:00 AM UTC+8                                │
│  • Maintenance Timing: Any (for non-disruptive updates)                         │
│                                                                                 │
│  SECURITY                                                                       │
│  ────────                                                                       │
│                                                                                 │
│  • Encryption at Rest: Customer-managed key (CMEK)                              │
│  • Encryption in Transit: TLS 1.3                                               │
│  • IAM Database Authentication: Enabled                                         │
│  • Audit Logging: Enabled                                                       │
│                                                                                 │
│  READ REPLICA (Future)                                                          │
│  ─────────────────────                                                          │
│                                                                                 │
│  • Cross-region replica in asia-east1 for DR                                    │
│  • Automatic failover promotion capability                                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Storage Services

### Cloud Storage

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CLOUD STORAGE BUCKETS                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  BUCKET: hta-calibration-certificates-prod                                      │
│  ──────────────────────────────────────────                                     │
│  • Purpose: PDF certificates, signed documents                                  │
│  • Location: asia-southeast1                                                    │
│  • Storage Class: Standard                                                      │
│  • Versioning: Enabled                                                          │
│  • Lifecycle Rules:                                                             │
│    - Move to Nearline after 90 days                                             │
│    - Move to Coldline after 365 days                                            │
│    - Delete non-current versions after 30 days                                  │
│  • Access: Private (signed URLs for customer access)                            │
│  • Encryption: CMEK                                                             │
│                                                                                 │
│  BUCKET: hta-calibration-signatures-prod                                        │
│  ───────────────────────────────────────                                        │
│  • Purpose: Digital signatures, stamp images                                    │
│  • Location: asia-southeast1                                                    │
│  • Storage Class: Standard                                                      │
│  • Versioning: Enabled                                                          │
│  • Access: Private                                                              │
│  • Encryption: CMEK                                                             │
│                                                                                 │
│  BUCKET: hta-calibration-backups-prod                                           │
│  ──────────────────────────────────────                                         │
│  • Purpose: Database exports, application backups                               │
│  • Location: asia (multi-region)                                                │
│  • Storage Class: Nearline                                                      │
│  • Lifecycle Rules:                                                             │
│    - Move to Coldline after 90 days                                             │
│    - Delete after 2 years                                                       │
│  • Object Lock: Enabled (compliance)                                            │
│                                                                                 │
│  BUCKET: hta-calibration-static-prod                                            │
│  ─────────────────────────────────────                                          │
│  • Purpose: Static assets (if CDN origin needed)                                │
│  • Location: asia-southeast1                                                    │
│  • Storage Class: Standard                                                      │
│  • Access: Public read (via CDN)                                                │
│  • Cache-Control headers: Configured                                            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Load Balancing & CDN

### External Application Load Balancer

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           LOAD BALANCER ARCHITECTURE                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│                              Internet                                            │
│                                  │                                               │
│                                  ▼                                               │
│                        ┌─────────────────┐                                      │
│                        │   Cloud DNS     │                                      │
│                        │ hta-cal.com     │                                      │
│                        └────────┬────────┘                                      │
│                                 │                                               │
│                                 ▼                                               │
│                        ┌─────────────────┐                                      │
│                        │   Cloud Armor   │                                      │
│                        │   (WAF/DDoS)    │                                      │
│                        └────────┬────────┘                                      │
│                                 │                                               │
│                                 ▼                                               │
│                        ┌─────────────────┐                                      │
│                        │   Cloud CDN     │                                      │
│                        │ (Static Cache)  │                                      │
│                        └────────┬────────┘                                      │
│                                 │                                               │
│                                 ▼                                               │
│                   ┌─────────────────────────┐                                   │
│                   │  External HTTP(S) LB    │                                   │
│                   │  ────────────────────   │                                   │
│                   │  • SSL Termination      │                                   │
│                   │  • Managed Certificates │                                   │
│                   │  • URL Map routing      │                                   │
│                   └────────────┬────────────┘                                   │
│                                │                                                │
│              ┌─────────────────┼─────────────────┐                              │
│              │                 │                 │                              │
│              ▼                 ▼                 ▼                              │
│     ┌────────────┐    ┌────────────┐    ┌────────────┐                         │
│     │  Backend   │    │  Backend   │    │  Backend   │                         │
│     │  Service   │    │  Service   │    │  Service   │                         │
│     │  (NEG)     │    │  (NEG)     │    │  (NEG)     │                         │
│     │            │    │            │    │            │                         │
│     │ /api/*     │    │ /static/*  │    │ /*         │                         │
│     └────────────┘    └────────────┘    └────────────┘                         │
│           │                  │                  │                               │
│           ▼                  ▼                  ▼                               │
│     ┌─────────────────────────────────────────────────┐                        │
│     │              GKE Ingress Controller             │                        │
│     │              (Network Endpoint Groups)          │                        │
│     └─────────────────────────────────────────────────┘                        │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Cloud Armor (WAF) Policies

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CLOUD ARMOR RULES                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  PRECONFIGURED RULES                                                            │
│  ───────────────────                                                            │
│                                                                                 │
│  • SQL Injection Protection (OWASP CRS)                                         │
│  • Cross-Site Scripting (XSS) Protection                                        │
│  • Local File Inclusion (LFI) Protection                                        │
│  • Remote File Inclusion (RFI) Protection                                       │
│  • Remote Code Execution (RCE) Protection                                       │
│                                                                                 │
│  CUSTOM RULES                                                                   │
│  ────────────                                                                   │
│                                                                                 │
│  Priority  Rule                              Action                             │
│  ────────────────────────────────────────────────────────────────               │
│  1000      Rate limit: 1000 req/min/IP       Throttle                           │
│  2000      Block known bad IPs               Deny                               │
│  3000      Geo-restrict (if needed)          Allow specific regions             │
│  4000      Bot management                    reCAPTCHA challenge                │
│  9999      Default rule                      Allow                              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Identity & Security

### Identity-Aware Proxy (IAP)

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           IDENTITY & ACCESS                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  IAP CONFIGURATION                                                              │
│  ─────────────────                                                              │
│                                                                                 │
│  • SSH Access: IAP tunneling only (no direct SSH)                               │
│  • Admin Endpoints: IAP-protected                                               │
│  • Developer Access: Via IAP with MFA                                           │
│                                                                                 │
│  SERVICE ACCOUNTS                                                               │
│  ────────────────                                                               │
│                                                                                 │
│  Account                              Purpose                   Permissions     │
│  ─────────────────────────────────────────────────────────────────────────      │
│  hta-app@project.iam                  Application runtime       Custom role     │
│  hta-ci@project.iam                   CI/CD deployments         Deploy access   │
│  hta-backup@project.iam               Backup operations         Storage admin   │
│  hta-monitoring@project.iam           Monitoring agent          Metrics writer  │
│                                                                                 │
│  WORKLOAD IDENTITY                                                              │
│  ─────────────────                                                              │
│                                                                                 │
│  K8s Service Account          ──▶     GCP Service Account                       │
│  ──────────────────────────────────────────────────────                         │
│  hta-app (K8s)                ──▶     hta-app@project.iam                       │
│  hta-backup (K8s)             ──▶     hta-backup@project.iam                    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Secret Manager

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SECRET MANAGER                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  SECRETS INVENTORY                                                              │
│  ─────────────────                                                              │
│                                                                                 │
│  Secret Name                          Purpose                                   │
│  ─────────────────────────────────────────────────────────────────────────      │
│  hta-db-password                      PostgreSQL password                       │
│  hta-nextauth-secret                  NextAuth.js secret                        │
│  hta-jwt-secret                       JWT signing key                           │
│  hta-opensign-api-key                 OpenSign API key                          │
│  hta-smtp-password                    Email service password                    │
│  hta-encryption-key                   Data encryption key                       │
│                                                                                 │
│  SECRET ROTATION                                                                │
│  ───────────────                                                                │
│                                                                                 │
│  • Automatic rotation: Enabled for database passwords                           │
│  • Rotation period: 90 days                                                     │
│  • Notification: Cloud Functions trigger on rotation                            │
│  • Versioning: All versions retained for 30 days                                │
│                                                                                 │
│  ACCESS CONTROL                                                                 │
│                                                                                 │
│  • Least privilege: Each service only accesses needed secrets                   │
│  • Audit logging: All access logged to Cloud Audit Logs                         │
│  • Regional replication: asia-southeast1, asia-east1                            │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## DNS & Domain Management

### Cloud DNS Configuration

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DNS CONFIGURATION                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  MANAGED ZONES                                                                  │
│  ─────────────                                                                  │
│                                                                                 │
│  Zone: hta-calibration-com                                                      │
│  Domain: hta-calibration.com                                                    │
│  DNSSEC: Enabled                                                                │
│                                                                                 │
│  RECORD SETS                                                                    │
│  ───────────                                                                    │
│                                                                                 │
│  Name                      Type    TTL    Value                                 │
│  ─────────────────────────────────────────────────────────────────────────      │
│  @                         A       300    [Load Balancer IP]                    │
│  www                       CNAME   300    hta-calibration.com.                  │
│  api                       CNAME   300    hta-calibration.com.                  │
│  staging                   A       300    [Staging LB IP]                       │
│  dev                       A       300    [Dev LB IP]                           │
│  _dmarc                    TXT     3600   [DMARC policy]                        │
│  _domainkey                TXT     3600   [DKIM key]                            │
│                                                                                 │
│  SSL/TLS CERTIFICATES                                                           │
│  ────────────────────                                                           │
│                                                                                 │
│  • Provider: Google-managed certificates                                        │
│  • Auto-renewal: Yes                                                            │
│  • Domains:                                                                     │
│    - hta-calibration.com                                                        │
│    - www.hta-calibration.com                                                    │
│    - api.hta-calibration.com                                                    │
│    - staging.hta-calibration.com                                                │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Cost Optimization

### Resource Sizing by Environment

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           RESOURCE SIZING                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  PRODUCTION                                                                     │
│  ──────────                                                                     │
│                                                                                 │
│  Resource              Specification            Est. Monthly Cost               │
│  ─────────────────────────────────────────────────────────────────────────      │
│  GKE Cluster           Regional, 2-5 nodes      $150-300                        │
│  Cloud SQL             db-custom-2-4096, HA     $150-200                        │
│  Cloud Storage         ~100 GB                  $5-10                           │
│  Load Balancer         External HTTPS           $20-30                          │
│  Cloud Armor           Standard tier            $5                              │
│  Cloud DNS             Per zone + queries       $1-5                            │
│  Secret Manager        ~10 secrets              $1-2                            │
│  Cloud Monitoring      Included                 $0                              │
│  ─────────────────────────────────────────────────────────────────────────      │
│  TOTAL (Est.)                                   $350-550/month                  │
│                                                                                 │
│  STAGING                                                                        │
│  ───────                                                                        │
│                                                                                 │
│  Resource              Specification            Est. Monthly Cost               │
│  ─────────────────────────────────────────────────────────────────────────      │
│  GKE Cluster           Zonal, 1-2 nodes         $50-100                         │
│  Cloud SQL             db-f1-micro, no HA       $10-20                          │
│  Cloud Storage         ~20 GB                   $1-2                            │
│  ─────────────────────────────────────────────────────────────────────────      │
│  TOTAL (Est.)                                   $70-130/month                   │
│                                                                                 │
│  DEVELOPMENT                                                                    │
│  ───────────                                                                    │
│                                                                                 │
│  Resource              Specification            Est. Monthly Cost               │
│  ─────────────────────────────────────────────────────────────────────────      │
│  GKE Cluster           Autopilot (scale to 0)   $20-50                          │
│  Cloud SQL             Shared core              $10-15                          │
│  ─────────────────────────────────────────────────────────────────────────      │
│  TOTAL (Est.)                                   $30-65/month                    │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Cost Optimization Strategies

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           COST OPTIMIZATION                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  COMMITTED USE DISCOUNTS                                                        │
│  ───────────────────────                                                        │
│                                                                                 │
│  • 1-year commitment: 37% savings on compute                                    │
│  • 3-year commitment: 55% savings on compute                                    │
│  • Recommendation: Start with 1-year after baseline established                 │
│                                                                                 │
│  AUTO-SCALING POLICIES                                                          │
│  ─────────────────────                                                          │
│                                                                                 │
│  • Min nodes: 2 (production), 1 (staging), 0 (dev)                              │
│  • Scale-down delay: 10 minutes (prevent flapping)                              │
│  • Target CPU utilization: 70%                                                  │
│                                                                                 │
│  RESOURCE RIGHT-SIZING                                                          │
│  ─────────────────────                                                          │
│                                                                                 │
│  • Monthly review of resource utilization                                       │
│  • Recommendations from Cloud Recommender                                       │
│  • VPA for automatic pod resource adjustment                                    │
│                                                                                 │
│  STORAGE LIFECYCLE                                                              │
│  ─────────────────                                                              │
│                                                                                 │
│  • Standard → Nearline: 90 days                                                 │
│  • Nearline → Coldline: 365 days                                                │
│  • Auto-delete temp files: 7 days                                               │
│                                                                                 │
│  DEV/STAGING OPTIMIZATION                                                       │
│  ────────────────────────                                                       │
│                                                                                 │
│  • Schedule: Shutdown overnight and weekends                                    │
│  • Use Spot VMs where possible                                                  │
│  • Smaller instance types                                                       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Disaster Recovery

### DR Architecture

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           DISASTER RECOVERY                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  PRIMARY REGION: asia-southeast1 (Singapore)                                    │
│  DR REGION: asia-east1 (Taiwan)                                                 │
│                                                                                 │
│  ┌───────────────────────────────┐    ┌───────────────────────────────┐        │
│  │     asia-southeast1           │    │     asia-east1                │        │
│  │     (Primary)                 │    │     (DR)                      │        │
│  │                               │    │                               │        │
│  │  ┌─────────────────────────┐  │    │  ┌─────────────────────────┐  │        │
│  │  │  GKE Cluster (Active)   │  │    │  │  GKE Cluster (Standby)  │  │        │
│  │  │  • Full workload        │  │    │  │  • Minimal nodes        │  │        │
│  │  └─────────────────────────┘  │    │  └─────────────────────────┘  │        │
│  │                               │    │                               │        │
│  │  ┌─────────────────────────┐  │    │  ┌─────────────────────────┐  │        │
│  │  │  Cloud SQL (Primary)    │──────────│  Cloud SQL (Replica)    │  │        │
│  │  │  • Read/Write           │  │    │  │  • Read-only            │  │        │
│  │  └─────────────────────────┘  │    │  └─────────────────────────┘  │        │
│  │                               │    │                               │        │
│  │  ┌─────────────────────────┐  │    │  ┌─────────────────────────┐  │        │
│  │  │  Cloud Storage          │──────────│  Cloud Storage          │  │        │
│  │  │  (Multi-region backup)  │  │    │  │  (Replicated)           │  │        │
│  │  └─────────────────────────┘  │    │  └─────────────────────────┘  │        │
│  │                               │    │                               │        │
│  └───────────────────────────────┘    └───────────────────────────────┘        │
│                                                                                 │
│  DR METRICS                                                                     │
│  ──────────                                                                     │
│                                                                                 │
│  • Recovery Time Objective (RTO): < 1 hour                                      │
│  • Recovery Point Objective (RPO): < 5 minutes                                  │
│  • Failover Type: Manual (with automation scripts)                              │
│  • Failback: Manual after primary recovery                                      │
│                                                                                 │
│  FAILOVER PROCEDURE                                                             │
│  ──────────────────                                                             │
│                                                                                 │
│  1. Detect: Cloud Monitoring alerts on primary region failure                   │
│  2. Decide: Operations team validates and authorizes failover                   │
│  3. Promote: Cloud SQL replica promotion to primary                             │
│  4. Scale: DR GKE cluster scales up to full capacity                            │
│  5. Switch: DNS update to DR load balancer IP                                   │
│  6. Verify: Health checks and smoke tests                                       │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Checklist

### Prerequisites
- [ ] GCP Organization created
- [ ] Billing account linked
- [ ] Domain registered and verified
- [ ] Initial project quota increases requested

### Phase 3A: Foundation
- [ ] Create GCP projects (prod, staging, dev, shared)
- [ ] Enable required APIs
- [ ] Set up VPC networks and subnets
- [ ] Configure firewall rules
- [ ] Set up Cloud NAT

### Phase 3B: Compute
- [ ] Create GKE clusters
- [ ] Configure node pools
- [ ] Set up Workload Identity
- [ ] Configure cluster autoscaling

### Phase 3C: Data
- [ ] Create Cloud SQL instances
- [ ] Configure private connectivity
- [ ] Set up automated backups
- [ ] Create Cloud Storage buckets
- [ ] Configure lifecycle policies

### Phase 3D: Networking
- [ ] Set up Cloud DNS
- [ ] Create SSL certificates
- [ ] Configure load balancer
- [ ] Enable Cloud CDN
- [ ] Configure Cloud Armor

### Phase 3E: Security
- [ ] Create service accounts
- [ ] Configure IAM roles
- [ ] Set up Secret Manager
- [ ] Enable audit logging
- [ ] Configure VPC Service Controls

---

## Related Documents

- [Overview](./00_scaleup_overview.md)
- [Containerization](./03_containerization.md)
- [Kubernetes Orchestration](./04_kubernetes_orchestration.md)
- [Terraform IaC](./06_terraform_iac.md)
- [Monitoring & Observability](./07_monitoring_observability.md)
