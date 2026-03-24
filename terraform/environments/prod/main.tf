# Production Environment - Main Configuration
# Provisions all infrastructure for the production environment

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
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
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
  cors_origins = ["https://htacalibration.com", "https://www.htacalibration.com"]

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
  nextauth_url              = "https://htacalibration.com"

  depends_on = [module.iam]
}

# GKE Module - Using Regional Standard cluster (multi-zone, high availability)
module "gke" {
  source = "../../modules/gke"

  project_id             = var.project_id
  region                 = var.region
  environment            = "prod"
  cluster_mode           = "regional"  # Multi-zone cluster for high availability
  vpc_name               = module.vpc.vpc_name
  gke_subnet_name        = module.vpc.gke_subnet_name
  gke_pod_range_name     = module.vpc.gke_pod_range_name
  gke_service_range_name = module.vpc.gke_service_range_name
  master_ipv4_cidr_block = "172.16.2.0/28"

  # Production-specific settings (high availability)
  node_count                = 3
  min_node_count            = 3
  max_node_count            = 10
  machine_type              = "e2-standard-2"  # 2 vCPU, 8GB RAM
  disk_size_gb              = 100
  node_service_account      = module.iam.gke_node_service_account_email
  release_channel           = "STABLE"  # More stable releases for prod
  enable_managed_prometheus = true

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
