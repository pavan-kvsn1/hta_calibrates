# Terraform Modules

## Overview

The HTA Calibration infrastructure is built with modular Terraform code in `terraform/modules/`.

---

## Module Structure

```
terraform/
├── modules/
│   ├── vpc/           # VPC, subnets, firewall, NAT
│   ├── gke/           # GKE cluster and node pools
│   ├── cloudsql/      # PostgreSQL database
│   ├── storage/       # GCS buckets
│   ├── iam/           # Service accounts and permissions
│   └── secrets/       # Secret Manager
├── shared/            # Shared resources (Artifact Registry)
└── environments/
    ├── dev/           # Development environment
    ├── staging/       # Staging environment
    └── production/    # Production environment
```

---

## VPC Module

### Resources Created

| Resource | Purpose |
|----------|---------|
| `google_compute_network` | VPC network |
| `google_compute_subnetwork` | 4 subnets |
| `google_compute_router` | Cloud Router |
| `google_compute_router_nat` | NAT Gateway |
| `google_compute_firewall` | Firewall rules |
| `google_compute_global_address` | Private IP range |
| `google_service_networking_connection` | VPC peering |

### Subnets

| Subnet | CIDR | Purpose |
|--------|------|---------|
| Public | 10.0.1.0/24 | Load balancers |
| GKE | 10.0.2.0/24 | Kubernetes nodes |
| Database | 10.0.3.0/24 | Cloud SQL |
| Management | 10.0.4.0/24 | Admin access |

### Secondary IP Ranges

| Range | CIDR | Purpose |
|-------|------|---------|
| GKE Pods | 10.1.0.0/16 | Pod IP addresses |
| GKE Services | 10.2.0.0/20 | Service IP addresses |

### Firewall Rules

```hcl
# Allow internal communication
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.project_id}-allow-internal"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
  }
  allow {
    protocol = "udp"
  }
  allow {
    protocol = "icmp"
  }

  source_ranges = [
    var.public_subnet_cidr,
    var.gke_subnet_cidr,
    var.db_subnet_cidr,
  ]
}

# Allow health checks
resource "google_compute_firewall" "allow_health_checks" {
  name    = "${var.project_id}-allow-health-checks"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["80", "443", "8080"]
  }

  source_ranges = [
    "35.191.0.0/16",   # Google health checkers
    "130.211.0.0/22",
  ]
}

# SSH via IAP
resource "google_compute_firewall" "allow_iap_ssh" {
  name    = "${var.project_id}-allow-iap-ssh"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  source_ranges = ["35.235.240.0/20"]  # IAP IP range
}

# GKE master to nodes
resource "google_compute_firewall" "gke_master_to_nodes" {
  name    = "${var.project_id}-gke-master-to-nodes"
  network = google_compute_network.vpc.name

  allow {
    protocol = "tcp"
    ports    = ["443", "10250", "10255"]
  }

  source_ranges = [var.gke_master_cidr]
  target_tags   = ["gke-node"]
}
```

---

## GKE Module

### Cluster Configuration

```hcl
resource "google_container_cluster" "primary" {
  name     = "${var.project_id}-gke-${var.environment}"
  location = var.region

  # VPC-native cluster
  network    = var.vpc_name
  subnetwork = var.gke_subnet_name

  ip_allocation_policy {
    cluster_secondary_range_name  = var.gke_pod_range_name
    services_secondary_range_name = var.gke_service_range_name
  }

  # Private cluster
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false
    master_ipv4_cidr_block  = var.master_ipv4_cidr_block
  }

  # Workload Identity
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Addons
  addons_config {
    http_load_balancing { disabled = false }
    horizontal_pod_autoscaling { disabled = false }
    network_policy_config { disabled = false }
    gcs_fuse_csi_driver_config { enabled = true }
  }

  # Network policy
  network_policy {
    enabled  = true
    provider = "CALICO"
  }

  # Logging and monitoring
  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS"]
    managed_prometheus {
      enabled = var.enable_managed_prometheus
    }
  }
}
```

### Node Pool

```hcl
resource "google_container_node_pool" "primary" {
  name     = "${var.project_id}-primary-pool"
  cluster  = google_container_cluster.primary.name
  location = var.region

  initial_node_count = var.node_count

  autoscaling {
    min_node_count  = var.min_node_count
    max_node_count  = var.max_node_count
    location_policy = "BALANCED"
  }

  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    machine_type = var.machine_type  # e2-medium
    disk_size_gb = var.disk_size_gb  # 30GB
    disk_type    = "pd-standard"
    image_type   = "COS_CONTAINERD"

    oauth_scopes = ["https://www.googleapis.com/auth/cloud-platform"]

    service_account = var.node_service_account

    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    labels = {
      environment = var.environment
      pool        = "primary"
    }
  }
}
```

---

## Cloud SQL Module

### Instance Configuration

```hcl
resource "google_sql_database_instance" "main" {
  name             = "${var.project_id}-db-${var.environment}"
  database_version = var.database_version  # POSTGRES_15
  region           = var.region

  settings {
    tier              = var.tier  # db-f1-micro
    availability_type = var.environment == "prod" ? "REGIONAL" : "ZONAL"
    disk_size         = var.disk_size
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    # Private IP only
    ip_configuration {
      ipv4_enabled    = false
      private_network = var.vpc_id
    }

    # Backup configuration
    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"  # 8:30 AM IST
      point_in_time_recovery_enabled = var.environment == "prod"
      transaction_log_retention_days = var.environment == "prod" ? 7 : 1
      backup_retention_settings {
        retained_backups = var.environment == "prod" ? 30 : 7
      }
    }

    # Performance insights
    insights_config {
      query_insights_enabled  = true
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }

    # Database flags
    database_flags {
      name  = "max_connections"
      value = var.max_connections
    }
    database_flags {
      name  = "log_checkpoints"
      value = "on"
    }
    database_flags {
      name  = "log_connections"
      value = "on"
    }
  }

  deletion_protection = var.environment == "prod"

  depends_on = [var.private_vpc_connection]
}

# Application database
resource "google_sql_database" "app" {
  name     = var.database_name  # hta_calibration
  instance = google_sql_database_instance.main.name
}

# Application user
resource "google_sql_user" "app" {
  name     = var.database_user  # hta_app
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result
}

# Random password
resource "random_password" "db_password" {
  length  = 32
  special = true
}

# Store password in Secret Manager
resource "google_secret_manager_secret" "db_password" {
  secret_id = "${var.project_id}-db-password-${var.environment}"

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}
```

---

## Storage Module

### Buckets

```hcl
# Certificates bucket (versioned, lifecycle rules)
resource "google_storage_bucket" "certificates" {
  name          = "${var.project_id}-certificates-${var.environment}"
  location      = var.location
  storage_class = var.environment == "prod" ? "STANDARD" : "NEARLINE"

  versioning {
    enabled = true
  }

  lifecycle_rule {
    condition {
      age = 365
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }

  lifecycle_rule {
    condition {
      num_newer_versions = 3
    }
    action {
      type = "Delete"
    }
  }

  cors {
    origin          = var.cors_origins
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type"]
    max_age_seconds = 3600
  }

  uniform_bucket_level_access = true
}

# Signatures bucket
resource "google_storage_bucket" "signatures" {
  name          = "${var.project_id}-signatures-${var.environment}"
  location      = var.location
  storage_class = "STANDARD"

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

  uniform_bucket_level_access = true
}

# Uploads bucket (auto-cleanup)
resource "google_storage_bucket" "uploads" {
  name          = "${var.project_id}-uploads-${var.environment}"
  location      = var.location
  storage_class = "STANDARD"

  lifecycle_rule {
    condition {
      age = 7
    }
    action {
      type = "Delete"
    }
  }

  cors {
    origin          = var.cors_origins
    method          = ["GET", "POST", "PUT", "DELETE"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  uniform_bucket_level_access = true
}
```

---

## IAM Module

### Service Accounts

```hcl
# GKE Node service account
resource "google_service_account" "gke_node" {
  account_id   = "gke-node-${var.environment}"
  display_name = "GKE Node Service Account"
}

resource "google_project_iam_member" "gke_node_roles" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/monitoring.viewer",
    "roles/stackdriver.resourceMetadata.writer",
    "roles/artifactregistry.reader",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.gke_node.email}"
}

# Application service account
resource "google_service_account" "app" {
  account_id   = "hta-app-${var.environment}"
  display_name = "HTA Calibration App Service Account"
}

resource "google_project_iam_member" "app_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.app.email}"
}

# Bucket permissions
resource "google_storage_bucket_iam_member" "app_buckets" {
  for_each = toset([
    var.certificates_bucket_name,
    var.signatures_bucket_name,
    var.uploads_bucket_name,
  ])

  bucket = each.value
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.app.email}"
}

# Workload Identity binding
resource "google_service_account_iam_member" "workload_identity" {
  count = var.create_workload_identity_binding ? 1 : 0

  service_account_id = google_service_account.app.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.k8s_namespace}/hta-app]"
}
```

---

## Deploying Infrastructure

### Prerequisites

```bash
# Authenticate with GCP
gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

### Deploy Shared Resources

```bash
cd terraform/shared
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your project_id

terraform init
terraform plan
terraform apply
```

### Deploy Dev Environment

```bash
cd terraform/environments/dev
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your project_id

terraform init
terraform plan
terraform apply  # Takes ~15 minutes
```

### Get GKE Credentials

```bash
gcloud container clusters get-credentials $(terraform output -raw cluster_name) \
  --region asia-south1 --project YOUR_PROJECT_ID

kubectl get nodes  # Verify connection
```

---

## Outputs

```hcl
# terraform/environments/dev/outputs.tf

output "cluster_name" {
  value = module.gke.cluster_name
}

output "database_connection_name" {
  value = module.cloudsql.instance_connection_name
}

output "database_private_ip" {
  value     = module.cloudsql.private_ip_address
  sensitive = true
}

output "get_credentials_command" {
  value = "gcloud container clusters get-credentials ${module.gke.cluster_name} --region ${var.region} --project ${var.project_id}"
}
```
