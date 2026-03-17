# Phase 3: Cloud Infrastructure - Implementation Details

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Phase**: 3 - Cloud Infrastructure
- **Status**: 0% Complete (Planning Only)

---

## Overview

Phase 3 focuses on provisioning Google Cloud Platform (GCP) infrastructure using Terraform for production-grade deployment of the HTA Calibration system.

---

## Implementation Status

### Summary

| Component | Status | Completion |
|-----------|--------|------------|
| GCP Project Setup | Not Started | 0% |
| Terraform Module Structure | Not Started | 0% |
| VPC/Networking | Not Started | 0% |
| GKE Cluster | Not Started | 0% |
| Cloud SQL (PostgreSQL) | Not Started | 0% |
| Cloud Storage | Not Started | 0% |
| Secret Manager | Not Started | 0% |
| Cloud DNS | Not Started | 0% |
| IAM Configuration | Not Started | 0% |

**Overall Phase Completion: 0%**

---

## Prerequisites

Before starting Phase 3, the following must be completed:

### From Phase 1 (95% Complete)
- [x] CI/CD pipeline operational
- [x] Comprehensive test coverage

### From Phase 2 (40% Complete)
- [x] Docker containerization
- [x] Health check endpoints
- [ ] Kubernetes manifests (required)
- [ ] Helm charts (required)

### External Requirements
- [ ] GCP Organization access
- [ ] Billing account configured
- [ ] Domain name for the application
- [ ] SSL certificate strategy decided

---

## Planned Implementation

### 1. GCP Project Structure

```
Organization: hta-calibration.com
│
├── Folder: Production
│   └── Project: hta-calibration-prod
│
├── Folder: Staging
│   └── Project: hta-calibration-staging
│
├── Folder: Development
│   └── Project: hta-calibration-dev
│
└── Folder: Shared
    └── Project: hta-calibration-shared
        ├── Artifact Registry
        ├── Cloud DNS
        └── Shared Secrets
```

---

### 2. Terraform Module Structure

**Planned Location**: `terraform/`

```
terraform/
├── modules/
│   ├── vpc/           # VPC, subnets, firewall
│   ├── gke/           # GKE cluster
│   ├── cloudsql/      # Cloud SQL instance
│   ├── storage/       # Cloud Storage buckets
│   ├── loadbalancer/  # Load balancer, CDN
│   ├── dns/           # Cloud DNS
│   ├── iam/           # Service accounts, roles
│   ├── secrets/       # Secret Manager
│   └── monitoring/    # Monitoring, alerting
│
├── environments/
│   ├── dev/
│   ├── staging/
│   └── prod/
│
└── shared/
    └── main.tf
```

---

### 3. Infrastructure Components

#### VPC Network

| Resource | Configuration |
|----------|---------------|
| VPC | `hta-calibration-vpc` |
| Primary Region | `asia-southeast1` (Singapore) |
| DR Region | `asia-east1` (Taiwan) |
| Public Subnet | `10.0.0.0/24` |
| GKE Subnet | `10.0.1.0/24` |
| Database Subnet | `10.0.2.0/24` |
| Pod CIDR | `10.1.0.0/16` |
| Service CIDR | `10.2.0.0/20` |

#### GKE Cluster

| Setting | Value |
|---------|-------|
| Type | Regional (HA) |
| Release Channel | Regular |
| Network Mode | VPC-native |
| Private Cluster | Yes |
| Workload Identity | Enabled |
| Binary Authorization | Enabled |

**Node Pools**:
- `default-pool`: e2-standard-2, 2-5 nodes
- `spot-pool` (optional): e2-standard-2, 0-3 nodes

#### Cloud SQL

| Setting | Value |
|---------|-------|
| Engine | PostgreSQL 16 |
| Tier | `db-custom-2-8192` |
| High Availability | Yes (prod) |
| Backups | Daily, 7-day retention |
| Point-in-time Recovery | Enabled |

#### Cloud Storage

| Bucket | Purpose |
|--------|---------|
| `hta-certificates-{env}` | PDF certificates |
| `hta-signatures-{env}` | Digital signatures |
| `hta-assets-{env}` | Static assets |

---

### 4. Networking & Security

#### Firewall Rules

| Rule | Source | Destination | Ports | Action |
|------|--------|-------------|-------|--------|
| allow-lb-health-check | GCP LB IPs | GKE nodes | 80, 443 | ALLOW |
| allow-iap-ssh | IAP range | Bastion | 22 | ALLOW |
| allow-internal | VPC CIDR | VPC CIDR | all | ALLOW |
| deny-all-ingress | 0.0.0.0/0 | all | all | DENY |

#### IAM Service Accounts

| Account | Purpose | Roles |
|---------|---------|-------|
| `gke-node-sa` | GKE node identity | Logging, Monitoring, Storage |
| `app-workload-sa` | Application workload | SQL Client, Secret Accessor |
| `terraform-sa` | Infrastructure management | Project Editor |
| `ci-cd-sa` | GitHub Actions | Artifact Registry Writer |

---

### 5. State Management

#### Terraform Remote State

```hcl
backend "gcs" {
  bucket = "hta-calibration-terraform-state"
  prefix = "environments/prod"
}
```

| Feature | Configuration |
|---------|---------------|
| Backend | Google Cloud Storage |
| Versioning | Enabled |
| Encryption | Customer-managed key (CMEK) |
| Locking | GCS native |

---

## Implementation Roadmap

### Step 1: Foundation

1. [ ] Create GCP organization structure
2. [ ] Enable required APIs
3. [ ] Create Terraform state bucket
4. [ ] Set up Terraform service account

### Step 2: Networking

1. [ ] Implement VPC module
2. [ ] Configure subnets and firewall rules
3. [ ] Set up Cloud NAT
4. [ ] Configure private service connection

### Step 3: Compute

1. [ ] Deploy GKE cluster
2. [ ] Configure node pools
3. [ ] Set up Workload Identity
4. [ ] Install cluster add-ons

### Step 4: Data Layer

1. [ ] Deploy Cloud SQL instance
2. [ ] Configure backups and HA
3. [ ] Set up Cloud Storage buckets
4. [ ] Configure lifecycle policies

### Step 5: Security

1. [ ] Configure Secret Manager
2. [ ] Set up IAM roles and bindings
3. [ ] Enable audit logging
4. [ ] Configure network policies

### Step 6: DNS & SSL

1. [ ] Configure Cloud DNS zones
2. [ ] Set up managed SSL certificates
3. [ ] Configure Cloud CDN

---

## Estimated Costs

| Resource | Monthly Estimate (USD) |
|----------|----------------------|
| GKE Cluster (3 nodes) | $150-200 |
| Cloud SQL (HA) | $150-200 |
| Cloud Storage | $10-20 |
| Cloud Load Balancer | $20-30 |
| Cloud DNS | $5 |
| Network Egress | $20-50 |
| **Total (Production)** | **$355-505** |

Note: Staging and dev environments can use smaller instances.

---

## Verification Checklist

### Prerequisites
- [ ] GCP organization access confirmed
- [ ] Billing account set up
- [ ] Domain name configured
- [ ] Kubernetes manifests ready (Phase 2)

### Foundation
- [ ] Terraform state bucket created
- [ ] Service accounts configured
- [ ] Required APIs enabled

### Infrastructure
- [ ] VPC and subnets deployed
- [ ] GKE cluster operational
- [ ] Cloud SQL accessible
- [ ] Storage buckets created

### Security
- [ ] Firewall rules applied
- [ ] IAM bindings configured
- [ ] Secrets stored in Secret Manager
- [ ] Audit logging enabled

### Validation
- [ ] Application deploys successfully
- [ ] Database connection works
- [ ] Health checks pass
- [ ] DNS resolves correctly

---

## Files Reference (Planned)

### Terraform Modules
- `terraform/modules/vpc/` - VPC configuration
- `terraform/modules/gke/` - GKE cluster
- `terraform/modules/cloudsql/` - Cloud SQL
- `terraform/modules/storage/` - Cloud Storage
- `terraform/modules/iam/` - IAM configuration
- `terraform/modules/secrets/` - Secret Manager
- `terraform/modules/dns/` - Cloud DNS

### Environment Configurations
- `terraform/environments/dev/` - Development
- `terraform/environments/staging/` - Staging
- `terraform/environments/prod/` - Production

---

## Related Documents

- [GCP Infrastructure Plan](../detailed_plan/05_gcp_infrastructure.md)
- [Terraform IaC Plan](../detailed_plan/06_terraform_iac.md)
- [Scale-Up Overview](../detailed_plan/00_scaleup_overview.md)
