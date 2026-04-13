# Development Environment - Main Configuration
# Provisions all infrastructure for the dev environment using Cloud Run

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
  #   prefix = "dev"
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
    "sqladmin.googleapis.com",
    "servicenetworking.googleapis.com",
    "secretmanager.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
    "run.googleapis.com",              # Cloud Run
    "vpcaccess.googleapis.com",        # VPC Access Connector
    "artifactregistry.googleapis.com", # Container Registry
    "cloudbuild.googleapis.com",       # Cloud Build (for CI/CD)
    "cloudscheduler.googleapis.com",   # Cloud Scheduler (for cron)
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
  environment        = "dev"
  public_subnet_cidr = "10.0.1.0/24"
  gke_subnet_cidr    = "10.0.2.0/24"  # Kept for compatibility, used by Cloud Run connector
  gke_pod_cidr       = "10.1.0.0/16"
  gke_service_cidr   = "10.2.0.0/20"
  db_subnet_cidr     = "10.0.3.0/24"

  depends_on = [google_project_service.required_apis]
}

# Storage Module
module "storage" {
  source = "../../modules/storage"

  project_id   = var.project_id
  location     = "ASIA"
  environment  = "dev"
  cors_origins = ["http://localhost:3000", "https://dev.hta-calibration.com"]

  depends_on = [google_project_service.required_apis]
}

# IAM Module
module "iam" {
  source = "../../modules/iam"

  project_id               = var.project_id
  environment              = "dev"
  certificates_bucket_name = module.storage.certificates_bucket_name
  signatures_bucket_name   = module.storage.signatures_bucket_name
  uploads_bucket_name      = module.storage.uploads_bucket_name
  k8s_namespace            = "hta-calibration"

  # Disable Workload Identity binding (not needed for Cloud Run)
  create_workload_identity_binding = false

  depends_on = [google_project_service.required_apis, module.storage]
}

# CloudSQL Module
module "cloudsql" {
  source = "../../modules/cloudsql"

  project_id             = var.project_id
  region                 = var.region
  environment            = "dev"
  vpc_id                 = module.vpc.vpc_id
  private_vpc_connection = module.vpc.private_ip_range_name
  database_version       = "POSTGRES_15"
  tier                   = "db-f1-micro"  # Smallest for dev
  disk_size              = 10
  database_name          = "hta_calibration"
  database_user          = "hta_app"
  max_connections        = "50"

  depends_on = [module.vpc]
}

# Secrets Module
module "secrets" {
  source = "../../modules/secrets"

  project_id                = var.project_id
  environment               = "dev"
  app_service_account_email = module.iam.app_service_account_email
  nextauth_url              = var.nextauth_url

  # Email configuration (optional for dev)
  resend_api_key = var.resend_api_key
  email_from     = var.email_from

  # Queue configuration
  create_queue_secret = true

  depends_on = [module.iam]
}

# Memorystore (Redis) Module for caching
# Using BASIC tier for dev (no HA, smaller, cheaper)
module "memorystore" {
  source = "../../modules/memorystore"

  project_id  = var.project_id
  region      = var.region
  environment = "dev"
  vpc_id      = module.vpc.vpc_id

  # Dev settings - basic tier, minimal resources
  tier           = "BASIC"
  memory_size_gb = 1
  redis_version  = "REDIS_7_0"

  # Security (still enabled for dev to match prod behavior)
  auth_enabled            = true
  transit_encryption_mode = "SERVER_AUTHENTICATION"

  # Grant access to app service account
  app_service_account_email = module.iam.app_service_account_email

  depends_on = [module.vpc, module.iam]
}

# ============================================
# DATABASE_URL Secret
# Cloud Run needs the complete connection string as a secret
# ============================================

# First, fetch the database password from the secret created by cloudsql module
data "google_secret_manager_secret_version" "db_password" {
  secret  = module.cloudsql.database_password_secret_id
  project = var.project_id

  depends_on = [module.cloudsql]
}

# Create the complete DATABASE_URL secret
resource "google_secret_manager_secret" "database_url" {
  secret_id = "${var.project_id}-database-url-${var.environment}"
  project   = var.project_id

  labels = {
    environment = "dev"
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

# Fetch Redis auth string
data "google_secret_manager_secret_version" "redis_auth" {
  count   = module.memorystore.redis_auth_enabled ? 1 : 0
  secret  = module.memorystore.redis_auth_secret_id
  project = var.project_id

  depends_on = [module.memorystore]
}

resource "google_secret_manager_secret" "redis_url" {
  secret_id = "${var.project_id}-redis-url-${var.environment}"
  project   = var.project_id

  labels = {
    environment = "dev"
    managed_by  = "terraform"
    app         = "hta-calibration"
  }

  replication {
    auto {}
  }

  depends_on = [google_project_service.required_apis]
}

resource "google_secret_manager_secret_version" "redis_url" {
  secret = google_secret_manager_secret.redis_url.id
  # If auth is enabled, include password; otherwise just host:port
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
# Cloud Run Module
# ============================================

module "cloud_run" {
  source = "../../modules/cloud-run"

  project_id  = var.project_id
  region      = var.region
  environment = "dev"

  # Container configuration
  image_url = var.container_image_url

  # Resources (conservative for dev)
  cpu               = "1"
  memory            = "512Mi"
  min_instances     = 0   # Scale to zero for cost savings
  max_instances     = 5   # Limited for dev
  cpu_idle          = true
  startup_cpu_boost = true

  # Networking
  vpc_name             = module.vpc.vpc_name
  connector_cidr_range = "10.100.0.0/28"  # Must not overlap with other ranges

  # Service account
  service_account_email = module.iam.app_service_account_email

  # Secrets (from Secret Manager)
  secrets = {
    DATABASE_URL    = google_secret_manager_secret.database_url.secret_id
    NEXTAUTH_SECRET = module.secrets.nextauth_secret_id
    REDIS_URL       = google_secret_manager_secret.redis_url.secret_id
  }

  # Environment variables (non-sensitive)
  env_vars = {
    NODE_ENV                = "production"
    NEXTAUTH_URL            = var.nextauth_url
    GCS_BUCKET_CERTIFICATES = module.storage.certificates_bucket_name
    GCS_BUCKET_SIGNATURES   = module.storage.signatures_bucket_name
    GCS_BUCKET_UPLOADS      = module.storage.uploads_bucket_name
    # Note: REDIS_URL is in secrets, not here
  }

  # Public access
  allow_unauthenticated = true

  # Health check
  health_check_path = "/api/health"

  # Cron job for queue processing (optional)
  enable_cron_job = var.enable_cron_job
  cron_schedule   = "*/5 * * * *"  # Every 5 minutes
  cron_endpoint   = "/api/cron/process-queue"
  cron_job_name   = "process-queue"

  depends_on = [
    module.vpc,
    module.iam,
    module.cloudsql,
    module.memorystore,
    module.secrets,
    google_secret_manager_secret_version.database_url,
    google_secret_manager_secret_version.redis_url,
    google_project_service.required_apis,
  ]
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
    environment = "dev"
    managed_by  = "terraform"
  }

  depends_on = [google_project_service.required_apis]
}

# Grant CI/CD service account permission to push images
resource "google_artifact_registry_repository_iam_member" "cicd_writer" {
  location   = google_artifact_registry_repository.app.location
  repository = google_artifact_registry_repository.app.name
  role       = "roles/artifactregistry.writer"
  member     = "serviceAccount:${module.iam.cicd_service_account_email}"
}

# Grant Cloud Run service account permission to pull images
resource "google_artifact_registry_repository_iam_member" "app_reader" {
  location   = google_artifact_registry_repository.app.location
  repository = google_artifact_registry_repository.app.name
  role       = "roles/artifactregistry.reader"
  member     = "serviceAccount:${module.iam.app_service_account_email}"
}

# Monitoring Module - Dashboard and Alerts (optional for dev)
module "monitoring" {
  source = "../../modules/monitoring"

  project_id             = var.project_id
  environment            = "dev"
  region                 = var.region
  cloud_run_service_name = "hta-calibration"

  # Alert configuration (more lenient for dev)
  alert_email           = var.alert_email
  error_rate_threshold  = 50      # Higher threshold for dev
  latency_threshold_ms  = 5000    # 5 seconds for dev
  cpu_threshold_percent = 90      # Higher threshold for dev

  enable_dashboard = var.enable_monitoring
  enable_alerts    = var.enable_monitoring

  depends_on = [google_project_service.required_apis]
}
