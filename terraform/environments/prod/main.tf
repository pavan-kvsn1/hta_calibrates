# Production Environment - Main Configuration
# Provisions all infrastructure for the production environment using GKE Autopilot

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
    google-beta = {
      source  = "hashicorp/google-beta"
      version = "~> 5.0"
    }
    random = {
      source  = "hashicorp/random"
      version = "~> 3.5"
    }
  }

  # Uncomment after creating the state bucket
  # backend "gcs" {
  #   bucket = "hta-calibration-terraform-state"
  #   prefix = "prod"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

provider "google-beta" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "compute.googleapis.com",
    "container.googleapis.com",
    "sqladmin.googleapis.com",
    "servicenetworking.googleapis.com",
    "secretmanager.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "redis.googleapis.com",
    "artifactregistry.googleapis.com",
  ])

  project = var.project_id
  service = each.value

  disable_on_destroy = false
}

# VPC Module
module "vpc" {
  source = "../../modules/vpc"

  project_id         = var.project_id
  region             = var.region
  environment        = "prod"
  public_subnet_cidr = "10.20.1.0/24"
  gke_subnet_cidr    = "10.20.2.0/24"
  gke_pod_cidr       = "10.21.0.0/16"
  gke_service_cidr   = "10.22.0.0/20"
  db_subnet_cidr     = "10.20.3.0/24"

  depends_on = [google_project_service.required_apis]
}

# Storage Module
module "storage" {
  source = "../../modules/storage"

  project_id   = var.project_id
  location     = "ASIA"
  environment  = "prod"
  cors_origins = ["https://hta-calibration.com", "https://www.hta-calibration.com"]

  depends_on = [google_project_service.required_apis]
}

# IAM Module
module "iam" {
  source = "../../modules/iam"

  project_id               = var.project_id
  environment              = "prod"
  certificates_bucket_name = module.storage.certificates_bucket_name
  signatures_bucket_name   = module.storage.signatures_bucket_name
  uploads_bucket_name      = module.storage.uploads_bucket_name
  k8s_namespace            = "hta-calibration"

  depends_on = [google_project_service.required_apis, module.storage]
}

# CloudSQL Module
module "cloudsql" {
  source = "../../modules/cloudsql"

  project_id             = var.project_id
  region                 = var.region
  environment            = "prod"
  vpc_id                 = module.vpc.vpc_id
  private_vpc_connection = module.vpc.private_ip_range_name
  database_version       = "POSTGRES_15"
  tier                   = "db-custom-2-4096"  # 2 vCPU, 4GB RAM for production
  disk_size              = 50
  database_name          = "hta_calibration"
  database_user          = "hta_app"
  max_connections        = "200"
  enable_read_replica    = true  # Enable read replica for production

  depends_on = [module.vpc]
}

# Secrets Module
module "secrets" {
  source = "../../modules/secrets"

  project_id                = var.project_id
  environment               = "prod"
  app_service_account_email = module.iam.app_service_account_email
  nextauth_url              = "https://hta-calibration.com"

  # Email configuration
  resend_api_key = var.resend_api_key
  email_from     = var.email_from

  # Queue configuration
  create_queue_secret = true

  depends_on = [module.iam]
}

# Memorystore (Redis) Module for caching
module "memorystore" {
  source = "../../modules/memorystore"

  project_id  = var.project_id
  region      = var.region
  environment = "prod"
  vpc_id      = module.vpc.vpc_id

  # Production settings - HA with more memory
  tier           = "STANDARD_HA"
  memory_size_gb = 2
  redis_version  = "REDIS_7_0"

  # Security
  auth_enabled            = true
  transit_encryption_mode = "SERVER_AUTHENTICATION"

  # Grant access to app service account
  app_service_account_email = module.iam.app_service_account_email

  depends_on = [module.vpc, module.iam]
}

# GKE Module - Using Autopilot (Google manages nodes)
module "gke" {
  source = "../../modules/gke"

  project_id             = var.project_id
  region                 = var.region
  environment            = "prod"
  cluster_mode           = "autopilot"  # Google manages nodes - simpler & cost-effective
  vpc_name               = module.vpc.vpc_name
  gke_subnet_name        = module.vpc.gke_subnet_name
  gke_pod_range_name     = module.vpc.gke_pod_range_name
  gke_service_range_name = module.vpc.gke_service_range_name
  master_ipv4_cidr_block = "172.16.2.0/28"

  # Autopilot doesn't need node configuration - Google manages it
  release_channel = "STABLE"  # More stable releases for prod

  # Restrict master access in production
  master_authorized_networks = [
    {
      cidr_block   = var.admin_cidr_block
      display_name = "Admin access"
    }
  ]

  vpc_dependency = module.vpc.vpc_id

  depends_on = [module.vpc, module.iam]
}

# Workload Identity binding
resource "google_service_account_iam_member" "app_workload_identity" {
  service_account_id = module.iam.app_service_account_name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[hta-calibration/hta-app]"

  depends_on = [module.gke]
}

# ============================================
# DATABASE_URL Secret
# Complete connection string for the application
# ============================================

data "google_secret_manager_secret_version" "db_password" {
  secret  = module.cloudsql.database_password_secret_id
  project = var.project_id

  depends_on = [module.cloudsql]
}

resource "google_secret_manager_secret" "database_url" {
  secret_id = "${var.project_id}-database-url-prod"
  project   = var.project_id

  labels = {
    environment = "prod"
    managed_by  = "terraform"
    app         = "hta-calibration"
  }

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "database_url" {
  secret      = google_secret_manager_secret.database_url.id
  secret_data = "postgresql://${module.cloudsql.database_user}:${data.google_secret_manager_secret_version.db_password.secret_data}@${module.cloudsql.private_ip_address}:5432/${module.cloudsql.database_name}"

  depends_on = [module.cloudsql]
}

resource "google_secret_manager_secret_iam_member" "database_url_access" {
  secret_id = google_secret_manager_secret.database_url.secret_id
  project   = var.project_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${module.iam.app_service_account_email}"
}

# ============================================
# REDIS_URL Secret
# ============================================

data "google_secret_manager_secret_version" "redis_auth" {
  count   = module.memorystore.redis_auth_enabled ? 1 : 0
  secret  = module.memorystore.redis_auth_secret_id
  project = var.project_id

  depends_on = [module.memorystore]
}

resource "google_secret_manager_secret" "redis_url" {
  secret_id = "${var.project_id}-redis-url-prod"
  project   = var.project_id

  labels = {
    environment = "prod"
    managed_by  = "terraform"
    app         = "hta-calibration"
  }

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "redis_url" {
  secret      = google_secret_manager_secret.redis_url.id
  secret_data = module.memorystore.redis_auth_enabled ? "redis://:${data.google_secret_manager_secret_version.redis_auth[0].secret_data}@${module.memorystore.redis_host}:${module.memorystore.redis_port}" : "redis://${module.memorystore.redis_host}:${module.memorystore.redis_port}"

  depends_on = [module.memorystore]
}

resource "google_secret_manager_secret_iam_member" "redis_url_access" {
  secret_id = google_secret_manager_secret.redis_url.secret_id
  project   = var.project_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${module.iam.app_service_account_email}"
}

# ============================================
# Artifact Registry (for container images)
# ============================================

resource "google_artifact_registry_repository" "app" {
  location      = var.region
  repository_id = "hta-calibration"
  description   = "Docker repository for HTA Calibration"
  format        = "DOCKER"

  labels = {
    environment = "prod"
    managed_by  = "terraform"
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_artifact_registry_repository_iam_member" "cicd_writer" {
  location   = google_artifact_registry_repository.app.location
  repository = google_artifact_registry_repository.app.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${module.iam.cicd_service_account_email}"
}

resource "google_artifact_registry_repository_iam_member" "app_reader" {
  location   = google_artifact_registry_repository.app.location
  repository = google_artifact_registry_repository.app.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${module.iam.app_service_account_email}"
}

# ============================================
# Monitoring Module - Dashboard and Alerts
# ============================================

module "monitoring" {
  source = "../../modules/monitoring"

  project_id             = var.project_id
  environment            = "prod"
  region                 = var.region
  cloud_run_service_name = "hta-calibration"

  # Alert configuration
  alert_email           = var.alert_email
  error_rate_threshold  = 10      # Alert if > 10 5xx errors in 5 minutes
  latency_threshold_ms  = 2000    # Alert if p95 > 2 seconds
  cpu_threshold_percent = 80      # Alert if CPU > 80% for 10 minutes

  # Disaster Recovery - Backup monitoring
  enable_backup_alerts   = var.enable_monitoring
  cloudsql_instance_name = module.cloudsql.instance_name
  backup_alert_hours     = 25  # Alert if no backup in 25 hours

  enable_dashboard = var.enable_monitoring
  enable_alerts    = var.enable_monitoring

  depends_on = [google_project_service.required_apis, module.cloudsql]
}
