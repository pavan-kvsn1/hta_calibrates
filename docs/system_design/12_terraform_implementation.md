# Terraform Implementation

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Prerequisite**: [11_terraform_intro.md](./11_terraform_intro.md)

---

## Introduction

This document provides the actual Terraform code for deploying HTA Calibration infrastructure on GCP. Use this as a reference for implementing the infrastructure.

---

## Part 1: Project Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PROJECT STRUCTURE                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  hta-calibration/                                                           │
│  └── terraform/                                                             │
│      ├── modules/                                                           │
│      │   ├── networking/                                                    │
│      │   │   ├── main.tf                                                    │
│      │   │   ├── variables.tf                                               │
│      │   │   └── outputs.tf                                                 │
│      │   ├── gke/                                                           │
│      │   │   ├── main.tf                                                    │
│      │   │   ├── variables.tf                                               │
│      │   │   └── outputs.tf                                                 │
│      │   ├── cloudsql/                                                      │
│      │   │   ├── main.tf                                                    │
│      │   │   ├── variables.tf                                               │
│      │   │   └── outputs.tf                                                 │
│      │   ├── storage/                                                       │
│      │   │   ├── main.tf                                                    │
│      │   │   ├── variables.tf                                               │
│      │   │   └── outputs.tf                                                 │
│      │   └── secrets/                                                       │
│      │       ├── main.tf                                                    │
│      │       ├── variables.tf                                               │
│      │       └── outputs.tf                                                 │
│      │                                                                      │
│      └── environments/                                                      │
│          ├── dev/                                                           │
│          │   ├── main.tf                                                    │
│          │   ├── variables.tf                                               │
│          │   ├── terraform.tfvars                                           │
│          │   └── backend.tf                                                 │
│          ├── staging/                                                       │
│          └── prod/                                                          │
│              ├── main.tf                                                    │
│              ├── variables.tf                                               │
│              ├── terraform.tfvars                                           │
│              └── backend.tf                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Networking Module

```hcl
# terraform/modules/networking/main.tf

# VPC Network
resource "google_compute_network" "main" {
  name                    = "${var.project_name}-vpc"
  auto_create_subnetworks = false
  project                 = var.project_id
}

# Subnet for GKE
resource "google_compute_subnetwork" "gke" {
  name          = "${var.project_name}-gke-subnet"
  ip_cidr_range = var.gke_subnet_cidr
  region        = var.region
  network       = google_compute_network.main.id
  project       = var.project_id

  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = var.pods_cidr
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = var.services_cidr
  }

  private_ip_google_access = true
}

# Cloud NAT for outbound internet access
resource "google_compute_router" "main" {
  name    = "${var.project_name}-router"
  region  = var.region
  network = google_compute_network.main.id
  project = var.project_id
}

resource "google_compute_router_nat" "main" {
  name                               = "${var.project_name}-nat"
  router                             = google_compute_router.main.name
  region                             = var.region
  project                            = var.project_id
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "ALL_SUBNETWORKS_ALL_IP_RANGES"
}

# Firewall rules
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.project_name}-allow-internal"
  network = google_compute_network.main.name
  project = var.project_id

  allow {
    protocol = "icmp"
  }

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  source_ranges = [var.gke_subnet_cidr, var.pods_cidr]
}
```

```hcl
# terraform/modules/networking/variables.tf

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "project_name" {
  description = "Project name for resource naming"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "gke_subnet_cidr" {
  description = "CIDR for GKE nodes"
  type        = string
  default     = "10.0.0.0/20"
}

variable "pods_cidr" {
  description = "CIDR for Kubernetes pods"
  type        = string
  default     = "10.1.0.0/16"
}

variable "services_cidr" {
  description = "CIDR for Kubernetes services"
  type        = string
  default     = "10.2.0.0/20"
}
```

```hcl
# terraform/modules/networking/outputs.tf

output "network_name" {
  value = google_compute_network.main.name
}

output "network_id" {
  value = google_compute_network.main.id
}

output "subnet_name" {
  value = google_compute_subnetwork.gke.name
}

output "subnet_id" {
  value = google_compute_subnetwork.gke.id
}
```

---

## Part 3: GKE Module

```hcl
# terraform/modules/gke/main.tf

resource "google_container_cluster" "primary" {
  name     = "${var.cluster_name}-cluster"
  location = var.region
  project  = var.project_id

  # We can't create a cluster with no node pool
  # So we create smallest possible and delete it
  remove_default_node_pool = true
  initial_node_count       = 1

  network    = var.network_name
  subnetwork = var.subnet_name

  # Private cluster configuration
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false  # Allow kubectl from internet
    master_ipv4_cidr_block  = "172.16.0.0/28"
  }

  # IP allocation for pods and services
  ip_allocation_policy {
    cluster_secondary_range_name  = "pods"
    services_secondary_range_name = "services"
  }

  # Workload Identity for secure GCP access
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Maintenance window
  maintenance_policy {
    recurring_window {
      start_time = "2026-01-01T03:00:00Z"  # 3 AM
      end_time   = "2026-01-01T07:00:00Z"  # 7 AM
      recurrence = "FREQ=WEEKLY;BYDAY=SU"   # Sundays
    }
  }

  # Logging and monitoring
  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS"]
  }
}

# Primary node pool
resource "google_container_node_pool" "primary" {
  name       = "${var.cluster_name}-primary-pool"
  location   = var.region
  cluster    = google_container_cluster.primary.name
  project    = var.project_id

  # Autoscaling configuration
  autoscaling {
    min_node_count = var.min_nodes
    max_node_count = var.max_nodes
  }

  node_config {
    machine_type = var.machine_type
    disk_size_gb = var.disk_size_gb
    disk_type    = "pd-ssd"

    # Use Container-Optimized OS
    image_type = "COS_CONTAINERD"

    # OAuth scopes
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    # Workload Identity
    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    labels = {
      environment = var.environment
      managed_by  = "terraform"
    }

    # Taints for dedicated workloads (optional)
    # taint {
    #   key    = "dedicated"
    #   value  = "app"
    #   effect = "NO_SCHEDULE"
    # }
  }

  # Upgrade settings
  management {
    auto_repair  = true
    auto_upgrade = true
  }

  upgrade_settings {
    max_surge       = 1
    max_unavailable = 0
  }
}

# Service account for GKE workloads
resource "google_service_account" "gke_workload" {
  account_id   = "${var.cluster_name}-workload"
  display_name = "GKE Workload Identity SA"
  project      = var.project_id
}

# IAM bindings for the service account
resource "google_project_iam_member" "gke_workload_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/storage.objectAdmin",
    "roles/secretmanager.secretAccessor",
    "roles/pubsub.publisher",
    "roles/pubsub.subscriber",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.gke_workload.email}"
}
```

```hcl
# terraform/modules/gke/variables.tf

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "cluster_name" {
  description = "Name for the GKE cluster"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "network_name" {
  description = "VPC network name"
  type        = string
}

variable "subnet_name" {
  description = "Subnet name for GKE"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
}

variable "machine_type" {
  description = "GKE node machine type"
  type        = string
  default     = "n2-standard-2"
}

variable "disk_size_gb" {
  description = "Boot disk size in GB"
  type        = number
  default     = 100
}

variable "min_nodes" {
  description = "Minimum number of nodes"
  type        = number
  default     = 1
}

variable "max_nodes" {
  description = "Maximum number of nodes"
  type        = number
  default     = 5
}
```

```hcl
# terraform/modules/gke/outputs.tf

output "cluster_name" {
  value = google_container_cluster.primary.name
}

output "cluster_endpoint" {
  value     = google_container_cluster.primary.endpoint
  sensitive = true
}

output "cluster_ca_certificate" {
  value     = google_container_cluster.primary.master_auth[0].cluster_ca_certificate
  sensitive = true
}

output "workload_identity_sa" {
  value = google_service_account.gke_workload.email
}
```

---

## Part 4: Cloud SQL Module

```hcl
# terraform/modules/cloudsql/main.tf

resource "google_sql_database_instance" "main" {
  name             = "${var.instance_name}-${random_id.db_suffix.hex}"
  database_version = "POSTGRES_15"
  region           = var.region
  project          = var.project_id

  settings {
    tier              = var.tier
    availability_type = var.high_availability ? "REGIONAL" : "ZONAL"
    disk_size         = var.disk_size_gb
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"  # 3 AM
      point_in_time_recovery_enabled = true
      backup_retention_settings {
        retained_backups = 30
      }
    }

    ip_configuration {
      ipv4_enabled    = false  # No public IP
      private_network = var.network_id
    }

    maintenance_window {
      day  = 7  # Sunday
      hour = 3  # 3 AM
    }

    database_flags {
      name  = "log_checkpoints"
      value = "on"
    }

    database_flags {
      name  = "log_connections"
      value = "on"
    }

    database_flags {
      name  = "log_disconnections"
      value = "on"
    }
  }

  deletion_protection = var.environment == "prod" ? true : false
}

# Random suffix for unique instance names
resource "random_id" "db_suffix" {
  byte_length = 4
}

# Database
resource "google_sql_database" "main" {
  name     = var.database_name
  instance = google_sql_database_instance.main.name
  project  = var.project_id
}

# Database user
resource "google_sql_user" "main" {
  name     = var.database_user
  instance = google_sql_database_instance.main.name
  password = var.database_password
  project  = var.project_id
}
```

```hcl
# terraform/modules/cloudsql/variables.tf

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "instance_name" {
  description = "Cloud SQL instance name"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
}

variable "network_id" {
  description = "VPC network ID for private IP"
  type        = string
}

variable "tier" {
  description = "Cloud SQL machine tier"
  type        = string
  default     = "db-custom-2-4096"  # 2 vCPU, 4GB RAM
}

variable "disk_size_gb" {
  description = "Disk size in GB"
  type        = number
  default     = 50
}

variable "high_availability" {
  description = "Enable high availability"
  type        = bool
  default     = false
}

variable "database_name" {
  description = "Database name"
  type        = string
  default     = "hta_calibration"
}

variable "database_user" {
  description = "Database user"
  type        = string
  default     = "hta_app"
}

variable "database_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}

variable "environment" {
  description = "Environment name"
  type        = string
}
```

```hcl
# terraform/modules/cloudsql/outputs.tf

output "instance_name" {
  value = google_sql_database_instance.main.name
}

output "connection_name" {
  value = google_sql_database_instance.main.connection_name
}

output "private_ip" {
  value = google_sql_database_instance.main.private_ip_address
}

output "database_name" {
  value = google_sql_database.main.name
}
```

---

## Part 5: Storage Module

```hcl
# terraform/modules/storage/main.tf

# Certificates bucket
resource "google_storage_bucket" "certificates" {
  name          = "${var.project_name}-certificates-${var.environment}"
  location      = var.location
  project       = var.project_id
  force_destroy = var.environment != "prod"

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 5
    }
    action {
      type = "Delete"
    }
  }

  cors {
    origin          = var.cors_origins
    method          = ["GET", "HEAD", "PUT", "POST"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }
}

# Signatures bucket
resource "google_storage_bucket" "signatures" {
  name          = "${var.project_name}-signatures-${var.environment}"
  location      = var.location
  project       = var.project_id
  force_destroy = var.environment != "prod"

  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }
}

# Backups bucket
resource "google_storage_bucket" "backups" {
  name          = "${var.project_name}-backups-${var.environment}"
  location      = var.location
  project       = var.project_id
  force_destroy = false  # Never auto-delete backups!

  uniform_bucket_level_access = true

  lifecycle_rule {
    condition {
      age = 90  # Delete backups older than 90 days
    }
    action {
      type = "Delete"
    }
  }

  lifecycle_rule {
    condition {
      age = 30  # Move to Coldline after 30 days
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }
}
```

```hcl
# terraform/modules/storage/outputs.tf

output "certificates_bucket" {
  value = google_storage_bucket.certificates.name
}

output "signatures_bucket" {
  value = google_storage_bucket.signatures.name
}

output "backups_bucket" {
  value = google_storage_bucket.backups.name
}
```

---

## Part 6: Production Environment

```hcl
# terraform/environments/prod/main.tf

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.10"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.6"
    }
  }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Networking
module "networking" {
  source = "../../modules/networking"

  project_id   = var.project_id
  project_name = var.project_name
  region       = var.region
}

# GKE Cluster
module "gke" {
  source = "../../modules/gke"

  project_id   = var.project_id
  cluster_name = var.project_name
  region       = var.region
  network_name = module.networking.network_name
  subnet_name  = module.networking.subnet_name
  environment  = "prod"

  machine_type = "n2-standard-4"
  min_nodes    = 3
  max_nodes    = 10
}

# Cloud SQL
module "cloudsql" {
  source = "../../modules/cloudsql"

  project_id        = var.project_id
  instance_name     = "${var.project_name}-db"
  region            = var.region
  network_id        = module.networking.network_id
  tier              = "db-custom-4-16384"  # 4 vCPU, 16GB RAM
  disk_size_gb      = 100
  high_availability = true
  database_password = var.database_password
  environment       = "prod"
}

# Storage
module "storage" {
  source = "../../modules/storage"

  project_id   = var.project_id
  project_name = var.project_name
  location     = "ASIA-SOUTHEAST1"
  environment  = "prod"
  cors_origins = ["https://hta-calibration.com"]
}
```

```hcl
# terraform/environments/prod/backend.tf

terraform {
  backend "gcs" {
    bucket = "hta-terraform-state"
    prefix = "prod"
  }
}
```

```hcl
# terraform/environments/prod/variables.tf

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "project_name" {
  description = "Project name"
  type        = string
  default     = "hta-calibration"
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "asia-southeast1"
}

variable "database_password" {
  description = "Database password"
  type        = string
  sensitive   = true
}
```

---

---

## Part 7: Local Development vs Cloud

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    LOCAL DEVELOPMENT vs CLOUD                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  You DON'T use Terraform or cloud resources for local development!          │
│  Everything runs on your machine instead.                                   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  COMPARISON:                                                                │
│  ═══════════                                                                │
│                                                                             │
│  ┌────────────────────┬─────────────────────┬─────────────────────┐        │
│  │ Component          │ Local Development   │ Cloud (Terraform)   │        │
│  ├────────────────────┼─────────────────────┼─────────────────────┤        │
│  │ Database           │ SQLite file or      │ Cloud SQL           │        │
│  │                    │ Docker Postgres     │ (managed Postgres)  │        │
│  ├────────────────────┼─────────────────────┼─────────────────────┤        │
│  │ Secrets            │ .env file           │ Secret Manager      │        │
│  │                    │ (local only)        │ (encrypted storage) │        │
│  ├────────────────────┼─────────────────────┼─────────────────────┤        │
│  │ File Storage       │ Local folder        │ GCS Buckets         │        │
│  │                    │ (./uploads/)        │ (cloud storage)     │        │
│  ├────────────────────┼─────────────────────┼─────────────────────┤        │
│  │ App Server         │ npm run dev         │ GKE Cluster         │        │
│  │                    │ (localhost:3000)    │ (Kubernetes)        │        │
│  ├────────────────────┼─────────────────────┼─────────────────────┤        │
│  │ Message Queue      │ Works directly or   │ Cloud Pub/Sub or    │        │
│  │ (WebSockets/Chat)  │ local Redis         │ Redis (Memorystore) │        │
│  └────────────────────┴─────────────────────┴─────────────────────┘        │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  LOCAL SETUP:                                                               │
│  ════════════                                                               │
│                                                                             │
│  1. Database (SQLite - simplest):                                           │
│     # .env                                                                  │
│     DATABASE_URL="file:./dev.db"                                            │
│                                                                             │
│  2. Database (Postgres via Docker - more realistic):                        │
│     $ docker run -d --name postgres \                                       │
│         -e POSTGRES_PASSWORD=localpass \                                    │
│         -e POSTGRES_DB=hta_calibration \                                    │
│         -p 5432:5432 \                                                      │
│         postgres:15                                                         │
│                                                                             │
│     # .env                                                                  │
│     DATABASE_URL="postgresql://postgres:localpass@localhost:5432/hta"       │
│                                                                             │
│  3. Secrets (just put in .env):                                             │
│     # .env                                                                  │
│     NEXTAUTH_SECRET="any-random-string-here"                                │
│                                                                             │
│  4. Run the app:                                                            │
│     $ npm run dev                                                           │
│     → Opens at http://localhost:3000                                        │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  WHEN TO USE EACH:                                                          │
│  ═════════════════                                                          │
│                                                                             │
│  LOCAL: Writing code, testing features, debugging                           │
│  CLOUD DEV: Testing with real cloud services, integration testing           │
│  CLOUD PROD: Running the actual application for real users                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 8: Common Errors and Fixes

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    COMMON TERRAFORM ERRORS                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ERROR 1: "Output not found"                                                │
│  ═══════════════════════════                                                │
│                                                                             │
│  Error: Output "get_credentials_command" not found                          │
│                                                                             │
│  CAUSE: You ran "terraform output" but "terraform apply" hasn't run yet,    │
│         or you're in the wrong directory.                                   │
│                                                                             │
│  FIX:                                                                       │
│  $ cd terraform/environments/dev    # Make sure you're in right folder      │
│  $ terraform apply                  # Create the resources first            │
│  $ terraform output                 # Now outputs will work                 │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ERROR 2: "Identity Pool does not exist"                                    │
│  ═══════════════════════════════════════                                    │
│                                                                             │
│  Error: Identity Pool does not exist (project.svc.id.goog)                  │
│                                                                             │
│  CAUSE: Workload Identity binding is trying to run BEFORE the GKE cluster   │
│         is created. The identity pool only exists after GKE is created.     │
│                                                                             │
│  FIX: This is a dependency ordering issue in the Terraform code.            │
│  The Workload Identity binding must have "depends_on = [module.gke]"        │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ERROR 3: "Invalid authentication credentials"                              │
│  ═════════════════════════════════════════════                              │
│                                                                             │
│  Error: Request had invalid authentication credentials                      │
│                                                                             │
│  CAUSE: Your Google Cloud login has expired.                                │
│                                                                             │
│  FIX:                                                                       │
│  $ gcloud auth login                                                        │
│  $ gcloud auth application-default login                                    │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ERROR 4: "API not enabled"                                                 │
│  ══════════════════════════                                                 │
│                                                                             │
│  Error: googleapi: Error 403: API not enabled for project                   │
│                                                                             │
│  CAUSE: Required Google Cloud API isn't turned on.                          │
│                                                                             │
│  FIX: Enable the API (Terraform usually does this automatically):           │
│  $ gcloud services enable compute.googleapis.com                            │
│  $ gcloud services enable container.googleapis.com                          │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ERROR 5: "Resource already exists"                                         │
│  ═══════════════════════════════════                                        │
│                                                                             │
│  Error: Resource already exists                                             │
│                                                                             │
│  CAUSE: Resource was created outside Terraform, or state is out of sync.    │
│                                                                             │
│  FIX: Import existing resource into Terraform state:                        │
│  $ terraform import google_storage_bucket.my_bucket my-bucket-name          │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  ERROR 6: "Quota exceeded"                                                  │
│  ═════════════════════════                                                  │
│                                                                             │
│  Error: Quota 'CPUS' exceeded                                               │
│                                                                             │
│  CAUSE: Your GCP project doesn't have enough quota for the resources.       │
│                                                                             │
│  FIX: Request quota increase in GCP Console → IAM & Admin → Quotas          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 9: Step-by-Step Deployment Guide

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT CHECKLIST                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PREREQUISITES:                                                             │
│  ══════════════                                                             │
│  □ Google Cloud account with billing enabled                                │
│  □ gcloud CLI installed                                                     │
│  □ Terraform installed (v1.5+)                                              │
│  □ Your GCP project ID (e.g., "hta-calibration-prod")                       │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  STEP 1: AUTHENTICATE                                                       │
│  ════════════════════                                                       │
│                                                                             │
│  $ gcloud auth login                                                        │
│  $ gcloud auth application-default login                                    │
│  $ gcloud config set project YOUR_PROJECT_ID                                │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  STEP 2: DEPLOY SHARED RESOURCES                                            │
│  ═══════════════════════════════                                            │
│                                                                             │
│  $ cd terraform/shared                                                      │
│  $ cp terraform.tfvars.example terraform.tfvars                             │
│  $ # Edit terraform.tfvars → add your project_id                            │
│  $ terraform init                                                           │
│  $ terraform plan      # Review what will be created                        │
│  $ terraform apply     # Type "yes" to confirm                              │
│                                                                             │
│  CREATES: Docker registry, Terraform state bucket                           │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  STEP 3: DEPLOY DEV ENVIRONMENT                                             │
│  ══════════════════════════════                                             │
│                                                                             │
│  $ cd terraform/environments/dev                                            │
│  $ cp terraform.tfvars.example terraform.tfvars                             │
│  $ # Edit terraform.tfvars → add your project_id                            │
│  $ terraform init                                                           │
│  $ terraform plan      # Review what will be created                        │
│  $ terraform apply     # Type "yes" to confirm (takes ~15 minutes)          │
│                                                                             │
│  CREATES: VPC, GKE cluster, Cloud SQL, storage buckets, IAM, secrets        │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  STEP 4: CONNECT TO CLUSTER                                                 │
│  ══════════════════════════                                                 │
│                                                                             │
│  $ terraform output get_credentials_command                                 │
│  # Copy and run the output command, OR:                                     │
│  $ gcloud container clusters get-credentials hta-calibration-dev \          │
│      --region asia-south1 --project YOUR_PROJECT_ID                         │
│                                                                             │
│  $ kubectl get nodes   # Verify connection works                            │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  STEP 5: DEPLOY APPLICATION                                                 │
│  ══════════════════════════                                                 │
│                                                                             │
│  $ kubectl apply -k k8s/overlays/development                                │
│  $ kubectl get pods -n hta-calibration   # Check if running                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

This implementation provides:

1. **Shared Resources**: Docker registry, Terraform state bucket
2. **Networking**: VPC, subnets, NAT, firewall rules
3. **GKE**: Managed Kubernetes cluster with autoscaling
4. **Cloud SQL**: PostgreSQL with high availability
5. **Storage**: Buckets for certificates, signatures, backups

**Key Points:**
- Deploy `shared/` FIRST, then `environments/dev`
- Local development doesn't need cloud resources
- Re-authenticate with `gcloud auth login` if you get auth errors

---

## Next Steps

- [14. Security Architecture](./14_security.md) - Securing your infrastructure
- [15. Monitoring & Observability](./15_monitoring.md) - Watching your system
