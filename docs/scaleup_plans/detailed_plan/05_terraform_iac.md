# HTA Calibration - Terraform Infrastructure as Code

## Document Version
- **Version**: 2.1.0
- **Created**: 2026-02-04
- **Last Updated**: 2026-03-17
- **Phase**: 3 - Cloud Infrastructure
- **Status**: In Progress (70%)

> **Implementation Status**: See [Phase 3 Implementation Details](../implementation_details/phase3_cloud_infrastructure.md) for current implementation status.

---

## 📚 Learning Resources

Before writing Terraform code, make sure you understand the underlying concepts:

| Topic | System Design Document | What You'll Learn |
|-------|------------------------|-------------------|
| **IaC Concepts** | [11_terraform_intro.md](../../system_design/11_terraform_intro.md) | What is Infrastructure as Code, why use Terraform, HCL basics |
| **Terraform for HTA** | [12_terraform_implementation.md](../../system_design/12_terraform_implementation.md) | Actual Terraform code examples for our system |
| **GCP Fundamentals** | [06_gcp_fundamentals.md](../../system_design/06_gcp_fundamentals.md) | The resources we're provisioning |
| **Secrets Management** | [13_secrets_management.md](../../system_design/13_secrets_management.md) | How to handle sensitive values in Terraform |
| **Security** | [14_security.md](../../system_design/14_security.md) | Security considerations for infrastructure |

> 💡 **Tip**: If you've never used Terraform before, read `11_terraform_intro.md` first - it explains everything from scratch!

---

## Overview

This document outlines the Infrastructure as Code (IaC) strategy using Terraform to manage and provision all GCP infrastructure for the HTA Calibration system.

---

## Implementation Details

> **Last Updated**: 2026-03-17

### Current Implementation Status

| Component | Status | Files Created |
|-----------|--------|---------------|
| Directory Structure | ✅ Complete | `terraform/` |
| VPC Module | ✅ Complete | `modules/vpc/` (5 files) |
| GKE Module | ✅ Complete | `modules/gke/` (3 files) |
| CloudSQL Module | ✅ Complete | `modules/cloudsql/` (3 files) |
| Storage Module | ✅ Complete | `modules/storage/` (3 files) |
| IAM Module | ✅ Complete | `modules/iam/` (3 files) |
| Secrets Module | ✅ Complete | `modules/secrets/` (3 files) |
| Dev Environment | ✅ Complete | `environments/dev/` (4 files) |
| Staging Environment | ⏳ Pending | - |
| Prod Environment | ⏳ Pending | - |
| Shared Resources | ✅ Complete | `shared/` (4 files) |

### File Structure (Implemented)

```
terraform/
├── versions.tf                    # Provider version constraints
├── .gitignore                     # Git ignore rules
├── README.md                      # Usage documentation
│
├── modules/
│   ├── vpc/
│   │   ├── main.tf               # VPC, subnets, private service connection
│   │   ├── nat.tf                # Cloud NAT configuration
│   │   ├── firewall.tf           # Firewall rules
│   │   ├── variables.tf          # Input variables
│   │   └── outputs.tf            # Output values
│   │
│   ├── gke/
│   │   ├── main.tf               # GKE cluster and node pool
│   │   ├── variables.tf          # Input variables
│   │   └── outputs.tf            # Output values
│   │
│   ├── cloudsql/
│   │   ├── main.tf               # PostgreSQL instance, database, user
│   │   ├── variables.tf          # Input variables
│   │   └── outputs.tf            # Output values
│   │
│   ├── storage/
│   │   ├── main.tf               # GCS buckets (certificates, signatures, uploads)
│   │   ├── variables.tf          # Input variables
│   │   └── outputs.tf            # Output values
│   │
│   ├── iam/
│   │   ├── main.tf               # Service accounts, IAM bindings, Workload Identity
│   │   ├── variables.tf          # Input variables
│   │   └── outputs.tf            # Output values
│   │
│   └── secrets/
│       ├── main.tf               # Secret Manager secrets
│       ├── variables.tf          # Input variables
│       └── outputs.tf            # Output values
│
├── environments/
│   └── dev/
│       ├── main.tf               # Dev environment composition
│       ├── variables.tf          # Dev-specific variables
│       ├── outputs.tf            # Dev outputs
│       └── terraform.tfvars.example
│
└── shared/
    ├── main.tf                   # Artifact Registry, state bucket
    ├── variables.tf              # Shared variables
    ├── outputs.tf                # Shared outputs
    └── terraform.tfvars.example
```

### Module Features Summary

| Module | Key Features |
|--------|-------------|
| **VPC** | Private subnets, Cloud NAT, firewall rules, private service connection for Cloud SQL |
| **GKE** | Private cluster, Workload Identity, auto-scaling, network policies (Calico), maintenance windows |
| **CloudSQL** | PostgreSQL 15, private IP only, automatic backups, query insights, read replica support |
| **Storage** | Versioned buckets, lifecycle rules, CORS configuration, CDN-ready static bucket |
| **IAM** | GKE node SA, app SA with Workload Identity, CI/CD SA, GitHub Actions WIF support |
| **Secrets** | NextAuth secret, database credentials, SMTP config, automatic secret generation |

### Remaining Work

- [ ] Create staging environment configuration
- [ ] Create production environment configuration
- [ ] Add DNS module for Cloud DNS
- [ ] Add Load Balancer module
- [ ] Enable remote state backend (after first apply)
- [ ] Set up GitHub Actions Workload Identity
- [ ] Create Terraform validation in CI pipeline

---

## Terraform Architecture

### Module Structure

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           TERRAFORM MODULE STRUCTURE                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  terraform/                                                                     │
│  │                                                                              │
│  ├── modules/                     # Reusable infrastructure modules             │
│  │   ├── vpc/                     # VPC, subnets, firewall rules                │
│  │   ├── gke/                     # GKE cluster configuration                   │
│  │   ├── cloudsql/                # Cloud SQL instance                          │
│  │   ├── storage/                 # Cloud Storage buckets                       │
│  │   ├── loadbalancer/            # Load balancer, CDN, SSL                     │
│  │   ├── dns/                     # Cloud DNS zones and records                 │
│  │   ├── iam/                     # Service accounts, roles                     │
│  │   ├── secrets/                 # Secret Manager configuration                │
│  │   └── monitoring/              # Monitoring, alerting, dashboards            │
│  │                                                                              │
│  ├── environments/                # Environment-specific configurations         │
│  │   ├── dev/                                                                   │
│  │   │   ├── main.tf                                                            │
│  │   │   ├── variables.tf                                                       │
│  │   │   ├── terraform.tfvars                                                   │
│  │   │   └── backend.tf                                                         │
│  │   ├── staging/                                                               │
│  │   │   ├── main.tf                                                            │
│  │   │   ├── variables.tf                                                       │
│  │   │   ├── terraform.tfvars                                                   │
│  │   │   └── backend.tf                                                         │
│  │   └── prod/                                                                  │
│  │       ├── main.tf                                                            │
│  │       ├── variables.tf                                                       │
│  │       ├── terraform.tfvars                                                   │
│  │       └── backend.tf                                                         │
│  │                                                                              │
│  └── shared/                      # Shared resources (Artifact Registry, etc.)  │
│      ├── main.tf                                                                │
│      ├── variables.tf                                                           │
│      └── backend.tf                                                             │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## State Management

### Remote State Configuration

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           TERRAFORM STATE MANAGEMENT                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  STATE STORAGE                                                                  │
│  ─────────────                                                                  │
│                                                                                 │
│  • Backend: Google Cloud Storage (GCS)                                          │
│  • Bucket: hta-calibration-terraform-state                                      │
│  • Location: asia (multi-region)                                                │
│  • Versioning: Enabled                                                          │
│  • Encryption: Customer-managed key (CMEK)                                      │
│                                                                                 │
│  STATE FILES LAYOUT                                                             │
│  ──────────────────                                                             │
│                                                                                 │
│  gs://hta-calibration-terraform-state/                                          │
│  │                                                                              │
│  ├── shared/                                                                    │
│  │   └── terraform.tfstate       # Shared resources state                       │
│  │                                                                              │
│  ├── dev/                                                                       │
│  │   └── terraform.tfstate       # Development environment state                │
│  │                                                                              │
│  ├── staging/                                                                   │
│  │   └── terraform.tfstate       # Staging environment state                    │
│  │                                                                              │
│  └── prod/                                                                      │
│      └── terraform.tfstate       # Production environment state                 │
│                                                                                 │
│  STATE LOCKING                                                                  │
│  ─────────────                                                                  │
│                                                                                 │
│  • Lock Provider: GCS (native)                                                  │
│  • Lock Timeout: 5 minutes                                                      │
│  • Retry on Lock: Enabled                                                       │
│                                                                                 │
│  STATE ISOLATION                                                                │
│  ───────────────                                                                │
│                                                                                 │
│  • Each environment has isolated state                                          │
│  • Cross-environment references via terraform_remote_state                      │
│  • Shared module outputs available to all environments                          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Module Specifications

### VPC Module

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           VPC MODULE                                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  modules/vpc/                                                                   │
│  │                                                                              │
│  ├── main.tf                     # VPC, subnets, routes                         │
│  ├── firewall.tf                 # Firewall rules                               │
│  ├── nat.tf                      # Cloud NAT configuration                      │
│  ├── variables.tf                # Input variables                              │
│  └── outputs.tf                  # Output values                                │
│                                                                                 │
│  RESOURCES CREATED                                                              │
│  ─────────────────                                                              │
│                                                                                 │
│  • google_compute_network                                                       │
│  • google_compute_subnetwork (public, gke, database)                            │
│  • google_compute_router                                                        │
│  • google_compute_router_nat                                                    │
│  • google_compute_firewall (multiple rules)                                     │
│  • google_compute_global_address (private service connection)                   │
│  • google_service_networking_connection                                         │
│                                                                                 │
│  INPUT VARIABLES                                                                │
│  ───────────────                                                                │
│                                                                                 │
│  Variable              Type        Description                                  │
│  ─────────────────────────────────────────────────────────────────────────      │
│  project_id            string      GCP project ID                               │
│  region                string      Primary region                               │
│  environment           string      Environment name (dev/staging/prod)          │
│  vpc_cidr              string      VPC CIDR range                               │
│  public_subnet_cidr    string      Public subnet CIDR                           │
│  gke_subnet_cidr       string      GKE subnet CIDR                              │
│  gke_pod_cidr          string      GKE pod secondary range                      │
│  gke_service_cidr      string      GKE service secondary range                  │
│  db_subnet_cidr        string      Database subnet CIDR                         │
│                                                                                 │
│  OUTPUT VALUES                                                                  │
│  ─────────────                                                                  │
│                                                                                 │
│  Output                           Description                                   │
│  ─────────────────────────────────────────────────────────────────────────      │
│  vpc_id                           VPC self link                                 │
│  vpc_name                         VPC name                                      │
│  gke_subnet_id                    GKE subnet self link                          │
│  gke_subnet_name                  GKE subnet name                               │
│  db_subnet_id                     Database subnet self link                     │
│  private_ip_range                 Private service connection range              │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### GKE Module

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           GKE MODULE                                             │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  modules/gke/                                                                   │
│  │                                                                              │
│  ├── main.tf                     # GKE cluster definition                       │
│  ├── node_pools.tf               # Node pool configurations                     │
│  ├── workload_identity.tf        # Workload Identity setup                      │
│  ├── variables.tf                # Input variables                              │
│  └── outputs.tf                  # Output values                                │
│                                                                                 │
│  RESOURCES CREATED                                                              │
│  ─────────────────                                                              │
│                                                                                 │
│  • google_container_cluster                                                     │
│  • google_container_node_pool (default, spot)                                   │
│  • google_service_account (node service account)                                │
│  • google_project_iam_member (required permissions)                             │
│                                                                                 │
│  KEY CONFIGURATIONS                                                             │
│  ──────────────────                                                             │
│                                                                                 │
│  Cluster Settings:                                                              │
│  • VPC-native networking (alias IPs)                                            │
│  • Private nodes with public control plane                                      │
│  • Release channel: Regular                                                     │
│  • Workload Identity enabled                                                    │
│  • Network policy (Calico) enabled                                              │
│  • Binary Authorization enabled                                                 │
│  • Vertical Pod Autoscaler enabled                                              │
│  • Maintenance window configured                                                │
│                                                                                 │
│  Node Pool Settings:                                                            │
│  • Autoscaling with min/max nodes                                               │
│  • Auto-repair and auto-upgrade                                                 │
│  • Shielded nodes                                                               │
│  • Container-Optimized OS                                                       │
│                                                                                 │
│  INPUT VARIABLES                                                                │
│  ───────────────                                                                │
│                                                                                 │
│  Variable                  Type        Description                              │
│  ─────────────────────────────────────────────────────────────────────────      │
│  project_id                string      GCP project ID                           │
│  region                    string      Cluster region                           │
│  cluster_name              string      GKE cluster name                         │
│  vpc_id                    string      VPC self link                            │
│  subnet_id                 string      Subnet self link                         │
│  pod_range_name            string      Pod secondary range name                 │
│  service_range_name        string      Service secondary range name             │
│  master_ipv4_cidr          string      Control plane CIDR                       │
│  min_node_count            number      Minimum nodes                            │
│  max_node_count            number      Maximum nodes                            │
│  machine_type              string      Node machine type                        │
│  disk_size_gb              number      Node disk size                           │
│  enable_spot_pool          bool        Enable spot VM pool                      │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Cloud SQL Module

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           CLOUD SQL MODULE                                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  modules/cloudsql/                                                              │
│  │                                                                              │
│  ├── main.tf                     # Cloud SQL instance                           │
│  ├── databases.tf                # Database and user creation                   │
│  ├── backup.tf                   # Backup configuration                         │
│  ├── replica.tf                  # Read replica (optional)                      │
│  ├── variables.tf                # Input variables                              │
│  └── outputs.tf                  # Output values                                │
│                                                                                 │
│  RESOURCES CREATED                                                              │
│  ─────────────────                                                              │
│                                                                                 │
│  • google_sql_database_instance (primary)                                       │
│  • google_sql_database_instance (replica, if enabled)                           │
│  • google_sql_database                                                          │
│  • google_sql_user                                                              │
│  • google_sql_ssl_cert                                                          │
│                                                                                 │
│  KEY CONFIGURATIONS                                                             │
│  ──────────────────                                                             │
│                                                                                 │
│  Instance Settings:                                                             │
│  • PostgreSQL 15                                                                │
│  • Private IP only                                                              │
│  • Regional availability (HA)                                                   │
│  • Automated backups with PITR                                                  │
│  • Maintenance window                                                           │
│  • Query insights enabled                                                       │
│                                                                                 │
│  Security Settings:                                                             │
│  • SSL required                                                                 │
│  • IAM database authentication                                                  │
│  • Customer-managed encryption key                                              │
│  • Audit logging enabled                                                        │
│                                                                                 │
│  INPUT VARIABLES                                                                │
│  ───────────────                                                                │
│                                                                                 │
│  Variable                  Type        Description                              │
│  ─────────────────────────────────────────────────────────────────────────      │
│  project_id                string      GCP project ID                           │
│  region                    string      Instance region                          │
│  instance_name             string      SQL instance name                        │
│  database_version          string      PostgreSQL version                       │
│  tier                      string      Machine type (db-custom-X-Y)             │
│  disk_size                 number      Storage size in GB                       │
│  disk_autoresize           bool        Enable auto-resize                       │
│  availability_type         string      REGIONAL or ZONAL                        │
│  private_network           string      VPC self link                            │
│  database_name             string      Default database name                    │
│  enable_replica            bool        Create read replica                      │
│  replica_region            string      Replica region                           │
│  backup_start_time         string      Backup window start                      │
│  maintenance_day           number      Maintenance day (1-7)                    │
│  maintenance_hour          number      Maintenance hour (0-23)                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Storage Module

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           STORAGE MODULE                                         │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  modules/storage/                                                               │
│  │                                                                              │
│  ├── main.tf                     # Bucket definitions                           │
│  ├── lifecycle.tf                # Lifecycle policies                           │
│  ├── iam.tf                      # Bucket IAM bindings                          │
│  ├── variables.tf                # Input variables                              │
│  └── outputs.tf                  # Output values                                │
│                                                                                 │
│  RESOURCES CREATED                                                              │
│  ─────────────────                                                              │
│                                                                                 │
│  • google_storage_bucket (certificates, signatures, backups, static)            │
│  • google_storage_bucket_iam_binding                                            │
│  • google_storage_bucket_object (initial folders)                               │
│                                                                                 │
│  BUCKET CONFIGURATIONS                                                          │
│  ─────────────────────                                                          │
│                                                                                 │
│  Bucket Type        Versioning   Lifecycle          Access                      │
│  ─────────────────────────────────────────────────────────────────────────      │
│  certificates       Yes          Nearline 90d       Private (signed URL)        │
│  signatures         Yes          None               Private                     │
│  backups            Yes          Coldline 90d       Private                     │
│  static             No           None               Public (CDN)                │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Load Balancer Module

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           LOAD BALANCER MODULE                                   │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  modules/loadbalancer/                                                          │
│  │                                                                              │
│  ├── main.tf                     # Load balancer resources                      │
│  ├── ssl.tf                      # SSL certificate configuration                │
│  ├── cdn.tf                      # Cloud CDN settings                           │
│  ├── armor.tf                    # Cloud Armor security policy                  │
│  ├── variables.tf                # Input variables                              │
│  └── outputs.tf                  # Output values                                │
│                                                                                 │
│  RESOURCES CREATED                                                              │
│  ─────────────────                                                              │
│                                                                                 │
│  • google_compute_global_address                                                │
│  • google_compute_managed_ssl_certificate                                       │
│  • google_compute_url_map                                                       │
│  • google_compute_target_https_proxy                                            │
│  • google_compute_global_forwarding_rule                                        │
│  • google_compute_backend_service                                               │
│  • google_compute_security_policy (Cloud Armor)                                 │
│                                                                                 │
│  KEY CONFIGURATIONS                                                             │
│  ──────────────────                                                             │
│                                                                                 │
│  • External HTTPS load balancer                                                 │
│  • Google-managed SSL certificates                                              │
│  • HTTP to HTTPS redirect                                                       │
│  • Cloud CDN enabled for static content                                         │
│  • Cloud Armor WAF policies                                                     │
│  • Health check configuration                                                   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Environment Configurations

### Variable Definitions Per Environment

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           ENVIRONMENT VARIABLES                                  │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  DEVELOPMENT (terraform.tfvars)                                                 │
│  ──────────────────────────────                                                 │
│                                                                                 │
│  Variable                     Value                                             │
│  ─────────────────────────────────────────────────────────────────────────      │
│  project_id                   hta-calibration-dev                               │
│  region                       asia-southeast1                                   │
│  environment                  dev                                               │
│  gke_min_nodes                0                                                 │
│  gke_max_nodes                2                                                 │
│  gke_machine_type             e2-small                                          │
│  sql_tier                     db-f1-micro                                       │
│  sql_availability             ZONAL                                             │
│  enable_cdn                   false                                             │
│  enable_armor                 false                                             │
│                                                                                 │
│  STAGING (terraform.tfvars)                                                     │
│  ──────────────────────────                                                     │
│                                                                                 │
│  Variable                     Value                                             │
│  ─────────────────────────────────────────────────────────────────────────      │
│  project_id                   hta-calibration-staging                           │
│  region                       asia-southeast1                                   │
│  environment                  staging                                           │
│  gke_min_nodes                1                                                 │
│  gke_max_nodes                3                                                 │
│  gke_machine_type             e2-standard-2                                     │
│  sql_tier                     db-custom-1-3840                                  │
│  sql_availability             ZONAL                                             │
│  enable_cdn                   true                                              │
│  enable_armor                 true                                              │
│                                                                                 │
│  PRODUCTION (terraform.tfvars)                                                  │
│  ─────────────────────────────                                                  │
│                                                                                 │
│  Variable                     Value                                             │
│  ─────────────────────────────────────────────────────────────────────────      │
│  project_id                   hta-calibration-prod                              │
│  region                       asia-southeast1                                   │
│  environment                  prod                                              │
│  gke_min_nodes                2                                                 │
│  gke_max_nodes                5                                                 │
│  gke_machine_type             e2-standard-2                                     │
│  sql_tier                     db-custom-2-4096                                  │
│  sql_availability             REGIONAL                                          │
│  enable_cdn                   true                                              │
│  enable_armor                 true                                              │
│  enable_sql_replica           true                                              │
│  replica_region               asia-east1                                        │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## GitOps Workflow

### Terraform CI/CD Pipeline

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           TERRAFORM CI/CD WORKFLOW                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  PULL REQUEST WORKFLOW                                                          │
│  ─────────────────────                                                          │
│                                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   Commit    │───▶│  terraform  │───▶│  terraform  │───▶│  terraform  │      │
│  │   Push      │    │  fmt -check │    │  validate   │    │  plan       │      │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘      │
│                                                                  │              │
│                                                                  ▼              │
│                                                        ┌─────────────────┐      │
│                                                        │  Post plan as   │      │
│                                                        │  PR comment     │      │
│                                                        └─────────────────┘      │
│                                                                                 │
│  MERGE TO MAIN WORKFLOW                                                         │
│  ──────────────────────                                                         │
│                                                                                 │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐      │
│  │   Merge     │───▶│  terraform  │───▶│  terraform  │───▶│   Manual    │      │
│  │   to main   │    │  plan       │    │  apply      │    │   Approval  │      │
│  └─────────────┘    └─────────────┘    └─────────────┘    │   (prod)    │      │
│                                               │           └─────────────┘      │
│                                               ▼                   │             │
│                                        ┌─────────────┐            ▼             │
│                                        │   Notify    │     ┌─────────────┐      │
│                                        │   Slack     │     │  terraform  │      │
│                                        └─────────────┘     │  apply prod │      │
│                                                            └─────────────┘      │
│                                                                                 │
│  ENVIRONMENT PROMOTION                                                          │
│  ─────────────────────                                                          │
│                                                                                 │
│  1. Changes merged to main                                                      │
│  2. Auto-apply to dev                                                           │
│  3. Auto-apply to staging (after dev success)                                   │
│  4. Manual approval for production                                              │
│  5. Apply to production                                                         │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Branch Strategy for Infrastructure

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           BRANCH STRATEGY                                        │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  BRANCH STRUCTURE                                                               │
│  ────────────────                                                               │
│                                                                                 │
│  main                         # Production-ready infrastructure                 │
│  │                            # Auto-deploy to dev, staging                     │
│  │                            # Manual approval for prod                        │
│  │                                                                              │
│  └── feature/*                # Infrastructure changes                          │
│      │                        # Requires PR review                              │
│      │                        # Plan output in PR                               │
│      │                                                                          │
│      └── hotfix/*             # Emergency fixes                                 │
│                               # Fast-track approval                             │
│                                                                                 │
│  PROTECTED RESOURCES                                                            │
│  ───────────────────                                                            │
│                                                                                 │
│  • Production database: Deletion protection enabled                             │
│  • Production GKE cluster: Deletion protection enabled                          │
│  • Terraform state bucket: Object lock enabled                                  │
│  • Critical resources: prevent_destroy = true                                   │
│                                                                                 │
│  PR REQUIREMENTS                                                                │
│  ───────────────                                                                │
│                                                                                 │
│  • At least 1 approval from infrastructure team                                 │
│  • All CI checks passing                                                        │
│  • No resource deletions without explicit approval                              │
│  • Plan output reviewed and understood                                          │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Security Practices

### Sensitive Data Management

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           SECURITY PRACTICES                                     │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  SENSITIVE VALUES                                                               │
│  ────────────────                                                               │
│                                                                                 │
│  DO NOT store in terraform.tfvars:                                              │
│  • Database passwords                                                           │
│  • API keys                                                                     │
│  • Service account keys                                                         │
│  • Any credentials                                                              │
│                                                                                 │
│  INSTEAD use:                                                                   │
│  • Google Secret Manager (reference via data source)                            │
│  • Environment variables (TF_VAR_*)                                             │
│  • Terraform Cloud/Enterprise workspace variables                               │
│                                                                                 │
│  STATE FILE SECURITY                                                            │
│  ───────────────────                                                            │
│                                                                                 │
│  • State bucket: IAM restricted to terraform service account                    │
│  • Encryption: Customer-managed encryption key                                  │
│  • Access logging: Enabled                                                      │
│  • Versioning: Enabled for recovery                                             │
│  • Object lock: Enabled to prevent deletion                                     │
│                                                                                 │
│  SERVICE ACCOUNT SECURITY                                                       │
│  ────────────────────────                                                       │
│                                                                                 │
│  • Dedicated service account for Terraform                                      │
│  • Minimum required permissions only                                            │
│  • No persistent keys (Workload Identity for CI/CD)                             │
│  • Regular access review                                                        │
│                                                                                 │
│  DRIFT DETECTION                                                                │
│  ───────────────                                                                │
│                                                                                 │
│  • Scheduled terraform plan (daily)                                             │
│  • Alert on unexpected changes                                                  │
│  • Document and revert manual changes                                           │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Resource Tagging Strategy

### Labeling Convention

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           RESOURCE LABELING                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  REQUIRED LABELS                                                                │
│  ───────────────                                                                │
│                                                                                 │
│  Label Key           Description                    Example Values              │
│  ─────────────────────────────────────────────────────────────────────────      │
│  project             Project identifier             hta-calibration             │
│  environment         Deployment environment         dev, staging, prod          │
│  managed-by          Management method              terraform                   │
│  team                Owning team                    platform, backend           │
│                                                                                 │
│  OPTIONAL LABELS                                                                │
│  ───────────────                                                                │
│                                                                                 │
│  Label Key           Description                    Example Values              │
│  ─────────────────────────────────────────────────────────────────────────      │
│  cost-center         Billing allocation             engineering                 │
│  component           Application component          api, web, database          │
│  data-classification Data sensitivity level         public, internal, pii       │
│  backup-policy       Backup requirements            daily, weekly, none         │
│                                                                                 │
│  LABEL ENFORCEMENT                                                              │
│  ─────────────────                                                              │
│                                                                                 │
│  • Use Terraform locals for common labels                                       │
│  • Validate labels in CI pipeline                                               │
│  • GCP Organization Policy for required labels                                  │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Terraform Best Practices

### Code Standards

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           TERRAFORM BEST PRACTICES                               │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  CODE ORGANIZATION                                                              │
│  ─────────────────                                                              │
│                                                                                 │
│  • One resource type per file (when complex)                                    │
│  • Consistent file naming (main.tf, variables.tf, outputs.tf)                   │
│  • Group related resources logically                                            │
│  • Use modules for reusable components                                          │
│                                                                                 │
│  NAMING CONVENTIONS                                                             │
│  ──────────────────                                                             │
│                                                                                 │
│  Resource Naming:                                                               │
│  • Pattern: {project}-{component}-{environment}                                 │
│  • Example: hta-calibration-gke-prod                                            │
│  • Lowercase, hyphens for separation                                            │
│                                                                                 │
│  Variable Naming:                                                               │
│  • Descriptive names (project_id, not pid)                                      │
│  • Snake_case for variables                                                     │
│  • Boolean variables: enable_*, use_*                                           │
│                                                                                 │
│  VERSION CONSTRAINTS                                                            │
│  ───────────────────                                                            │
│                                                                                 │
│  • Pin Terraform version: required_version = "~> 1.6"                           │
│  • Pin provider versions: version = "~> 5.0"                                    │
│  • Pin module versions in source                                                │
│  • Use .terraform-version file                                                  │
│                                                                                 │
│  DOCUMENTATION                                                                  │
│  ─────────────                                                                  │
│                                                                                 │
│  • README.md in each module with usage examples                                 │
│  • Variable descriptions are required                                           │
│  • Output descriptions are required                                             │
│  • Architecture diagrams for complex modules                                    │
│                                                                                 │
│  TESTING                                                                        │
│  ───────                                                                        │
│                                                                                 │
│  • terraform validate in CI                                                     │
│  • terraform fmt -check in CI                                                   │
│  • tflint for additional linting                                                │
│  • Checkov/tfsec for security scanning                                          │
│  • Terratest for integration testing (optional)                                 │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Disaster Recovery for Infrastructure

### State Recovery

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                           INFRASTRUCTURE DR                                      │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│  STATE RECOVERY SCENARIOS                                                       │
│  ────────────────────────                                                       │
│                                                                                 │
│  Scenario                     Recovery Procedure                                │
│  ─────────────────────────────────────────────────────────────────────────      │
│  State file corrupted         Restore from GCS version history                  │
│  State file deleted           Restore from GCS Object Lock backup               │
│  State lock stuck             Manually clear lock, investigate cause            │
│  Provider outage              Wait for recovery, state remains in GCS           │
│                                                                                 │
│  INFRASTRUCTURE RECOVERY                                                        │
│  ───────────────────────                                                        │
│                                                                                 │
│  • Full infrastructure can be recreated from Terraform code                     │
│  • State import for resources created outside Terraform                         │
│  • Regular terraform plan to detect drift                                       │
│                                                                                 │
│  BACKUP STRATEGY                                                                │
│  ───────────────                                                                │
│                                                                                 │
│  • State bucket versioning: 30 days retention                                   │
│  • Cross-region replication for state bucket                                    │
│  • Regular exports to separate backup bucket                                    │
│  • Git history as code backup                                                   │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Implementation Checklist

### Phase 3: Terraform Setup
- [ ] Create Terraform state bucket with versioning and CMEK
- [ ] Set up Terraform service account with minimal permissions
- [ ] Initialize shared infrastructure (Artifact Registry, DNS base)
- [ ] Create and test VPC module
- [ ] Create and test GKE module
- [ ] Create and test Cloud SQL module
- [ ] Create and test Storage module
- [ ] Create and test Load Balancer module
- [ ] Set up development environment
- [ ] Set up staging environment
- [ ] Set up production environment
- [ ] Configure CI/CD pipeline for Terraform
- [ ] Document all modules with README files
- [ ] Security scan with tfsec/checkov

---

## Related Documents

- [Overview](./00_scaleup_overview.md)
- [GCP Infrastructure](./05_gcp_infrastructure.md)
- [Kubernetes Orchestration](./04_kubernetes_orchestration.md)
- [Monitoring & Observability](./07_monitoring_observability.md)
