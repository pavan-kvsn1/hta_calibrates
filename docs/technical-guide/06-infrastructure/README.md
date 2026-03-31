# 06 - Infrastructure (Terraform + GCP)

## Overview

Infrastructure is managed with Terraform, deploying to Google Cloud Platform.

```
terraform/
├── shared/                 # Shared resources (Artifact Registry)
│   ├── main.tf
│   ├── variables.tf
│   └── terraform.tfvars
└── environments/
    ├── dev/               # Development environment
    ├── staging/           # Staging environment
    └── prod/              # Production environment
```

---

## GCP Services Used

| Service | Purpose | Terraform Resource |
|---------|---------|-------------------|
| GKE | Kubernetes cluster | `google_container_cluster` |
| Cloud SQL | PostgreSQL database | `google_sql_database_instance` |
| GCS | Object storage | `google_storage_bucket` |
| Artifact Registry | Container images | `google_artifact_registry_repository` |
| Secret Manager | Secrets storage | `google_secret_manager_secret` |
| VPC | Networking | `google_compute_network` |
| Cloud NAT | Outbound internet | `google_compute_router_nat` |
| Workload Identity | Service account binding | `google_service_account_iam_binding` |

---

## Deployment Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                         GCP Project                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                         VPC                               │   │
│  │  ┌────────────────┐    ┌────────────────┐                │   │
│  │  │ GKE Subnet     │    │ Cloud SQL      │                │   │
│  │  │ 10.0.0.0/24    │◄──►│ Private IP     │                │   │
│  │  │                │    │                │                │   │
│  │  │ ┌────────────┐ │    └────────────────┘                │   │
│  │  │ │  GKE       │ │                                      │   │
│  │  │ │  Nodes     │ │    ┌────────────────┐                │   │
│  │  │ │            │ │    │ GCS Buckets    │                │   │
│  │  │ │ ┌────────┐ │ │    │ - certificates │                │   │
│  │  │ │ │ Pods   │ │◄────►│ - signatures   │                │   │
│  │  │ │ └────────┘ │ │    │ - uploads      │                │   │
│  │  │ └────────────┘ │    └────────────────┘                │   │
│  │  └────────────────┘                                      │   │
│  │          │                                                │   │
│  │          │ Cloud NAT                                      │   │
│  │          ▼                                                │   │
│  │    ┌──────────┐                                          │   │
│  │    │ Internet │                                          │   │
│  │    └──────────┘                                          │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
│  ┌─────────────────┐    ┌─────────────────┐                     │
│  │ Artifact        │    │ Secret          │                     │
│  │ Registry        │    │ Manager         │                     │
│  └─────────────────┘    └─────────────────┘                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Terraform Structure

### Shared Resources (`terraform/shared/`)

```hcl
# main.tf
resource "google_artifact_registry_repository" "app" {
  location      = var.region
  repository_id = "hta-calibration"
  format        = "DOCKER"
}

resource "google_storage_bucket" "terraform_state" {
  name     = "${var.project_id}-terraform-state"
  location = var.region

  versioning {
    enabled = true
  }
}
```

### Environment Resources (`terraform/environments/dev/`)

```hcl
# main.tf
module "network" {
  source     = "../../modules/network"
  project_id = var.project_id
  region     = var.region
}

module "gke" {
  source          = "../../modules/gke"
  project_id      = var.project_id
  region          = var.region
  network         = module.network.network_name
  subnetwork      = module.network.subnetwork_name
  node_count      = var.gke_node_count
  machine_type    = var.gke_machine_type
}

module "cloudsql" {
  source       = "../../modules/cloudsql"
  project_id   = var.project_id
  region       = var.region
  network      = module.network.network_id
  tier         = var.db_tier
  db_name      = "hta_calibration"
}

module "storage" {
  source     = "../../modules/storage"
  project_id = var.project_id
  region     = var.region
  env        = "dev"
}
```

---

## Key Configuration

### GKE Cluster

```hcl
resource "google_container_cluster" "primary" {
  name     = "hta-calibration-${var.env}"
  location = var.region

  # Autopilot or Standard
  enable_autopilot = false

  # Network config
  network    = var.network
  subnetwork = var.subnetwork

  # Private cluster
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  # Workload Identity
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Node pool
  node_pool {
    name       = "default"
    node_count = var.node_count

    node_config {
      machine_type = var.machine_type
      disk_size_gb = 50

      oauth_scopes = [
        "https://www.googleapis.com/auth/cloud-platform"
      ]

      workload_metadata_config {
        mode = "GKE_METADATA"
      }
    }

    autoscaling {
      min_node_count = 1
      max_node_count = var.max_nodes
    }
  }
}
```

### Cloud SQL

```hcl
resource "google_sql_database_instance" "main" {
  name             = "hta-db-${var.env}"
  database_version = "POSTGRES_15"
  region           = var.region

  settings {
    tier = var.tier  # db-f1-micro for dev

    ip_configuration {
      ipv4_enabled    = true  # For Cloud SQL Proxy
      private_network = var.network

      authorized_networks {
        name  = "allow-all"  # Restrict in production
        value = "0.0.0.0/0"
      }
    }

    backup_configuration {
      enabled            = true
      start_time         = "03:00"
      binary_log_enabled = false
    }
  }

  deletion_protection = var.env == "prod"
}
```

### GCS Buckets

```hcl
resource "google_storage_bucket" "certificates" {
  name     = "${var.project_id}-certificates-${var.env}"
  location = var.region

  uniform_bucket_level_access = true

  lifecycle_rule {
    action {
      type = "Delete"
    }
    condition {
      age = 365  # Keep for 1 year
    }
  }
}
```

---

## Workload Identity

Allows Kubernetes pods to authenticate as GCP service accounts without keys:

```hcl
# Service account for the app
resource "google_service_account" "app" {
  account_id   = "hta-app-${var.env}"
  display_name = "HTA App Service Account"
}

# Grant storage access
resource "google_storage_bucket_iam_member" "app_storage" {
  bucket = google_storage_bucket.certificates.name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.app.email}"
}

# Bind to Kubernetes service account
resource "google_service_account_iam_binding" "workload_identity" {
  service_account_id = google_service_account.app.name
  role               = "roles/iam.workloadIdentityUser"

  members = [
    "serviceAccount:${var.project_id}.svc.id.goog[hta-calibration/hta-app]"
  ]
}
```

**Kubernetes ServiceAccount**:
```yaml
# k8s/base/serviceaccount.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: hta-app
  namespace: hta-calibration
  annotations:
    iam.gke.io/gcp-service-account: hta-app-dev@PROJECT_ID.iam.gserviceaccount.com
```

---

## Environment Variables

| Variable | Dev | Staging | Prod |
|----------|-----|---------|------|
| `gke_node_count` | 1 | 2 | 3 |
| `gke_machine_type` | e2-small | e2-medium | e2-standard-2 |
| `db_tier` | db-f1-micro | db-g1-small | db-custom-2-4096 |
| `max_nodes` | 2 | 3 | 10 |

---

## Deployment Commands

### Initial Setup

```bash
# Authenticate
gcloud auth login
gcloud auth application-default login
gcloud config set project hta-calibration-prod

# Deploy shared resources
cd terraform/shared
terraform init
terraform plan
terraform apply

# Deploy dev environment
cd ../environments/dev
terraform init
terraform plan
terraform apply  # Takes ~15 minutes
```

### Get Cluster Credentials

```bash
gcloud container clusters get-credentials hta-calibration-dev \
  --region asia-south1 \
  --project hta-calibration-prod
```

### Destroy Environment

```bash
# WARNING: Destroys all resources
terraform destroy
```

---

## Common Failure Modes

### 1. Insufficient Quotas

**Symptom**: Terraform fails with quota exceeded

**Fix**:
```bash
# Check quotas
gcloud compute regions describe asia-south1 --project hta-calibration-prod

# Request increase in Cloud Console
```

### 2. Service Account Permissions

**Symptom**: Pod can't access GCS or Cloud SQL

**Fix**: Verify Workload Identity binding:
```bash
gcloud iam service-accounts get-iam-policy hta-app-dev@PROJECT.iam.gserviceaccount.com
```

### 3. Private Cluster Access

**Symptom**: Can't connect to cluster from local machine

**Fix**: Use authorized networks or Cloud Shell:
```hcl
master_authorized_networks_config {
  cidr_blocks {
    cidr_block   = "YOUR_IP/32"
    display_name = "My IP"
  }
}
```

### 4. Cloud SQL Connection

**Symptom**: App can't connect to database

**Fix**: Check private IP connectivity:
```bash
# From a pod
kubectl exec -it deployment/hta-web -n hta-calibration -- \
  sh -c "nc -zv CLOUD_SQL_PRIVATE_IP 5432"
```

---

## Cost Optimization

| Resource | Dev | Prod Recommendation |
|----------|-----|---------------------|
| GKE Nodes | e2-small (preemptible) | e2-medium (regular) |
| Cloud SQL | db-f1-micro | db-custom-2-4096 |
| Node Count | 1-2 | 3+ with autoscaling |
| Committed Use | No | Yes (1-3 year) |

---

## Key Files

| File | Purpose |
|------|---------|
| `terraform/shared/main.tf` | Shared resources |
| `terraform/environments/dev/main.tf` | Dev infrastructure |
| `terraform/modules/` | Reusable modules |

---

## Next Steps

- [07 - Containerization](../07-containerization/) - Docker setup
- [08 - Kubernetes](../08-kubernetes/) - K8s manifests
