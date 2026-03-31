# Development Environment - Main Configuration
# Provisions all infrastructure for the dev environment

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

# Enable required APIs (shared APIs like iam, artifactregistry are in terraform/shared)
resource "google_project_service" "required_apis" {
  for_each = toset([
    "compute.googleapis.com",
    "container.googleapis.com",
    "sqladmin.googleapis.com",
    "servicenetworking.googleapis.com",
    "secretmanager.googleapis.com",
    "logging.googleapis.com",
    "monitoring.googleapis.com",
  ])

  project = var.project_id
  service = each.value

  disable_on_destroy = false
}

# VPC Module
module "vpc" {
  source = "../../modules/vpc"

  project_id       = var.project_id
  region           = var.region
  environment      = "dev"
  public_subnet_cidr = "10.0.1.0/24"
  gke_subnet_cidr    = "10.0.2.0/24"
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
  cors_origins = ["http://localhost:3000", "https://dev.htacalibration.com"]

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
  nextauth_url              = "http://localhost:3000"

  depends_on = [module.iam]
}

# GKE Module - Using Autopilot for dev (faster, cheaper, Google manages nodes)
module "gke" {
  source = "../../modules/gke"

  project_id             = var.project_id
  region                 = var.region
  environment            = "dev"
  cluster_mode           = "autopilot"  # Google manages nodes automatically
  vpc_name               = module.vpc.vpc_name
  gke_subnet_name        = module.vpc.gke_subnet_name
  gke_pod_range_name     = module.vpc.gke_pod_range_name
  gke_service_range_name = module.vpc.gke_service_range_name
  master_ipv4_cidr_block = "172.16.0.0/28"

  # Autopilot doesn't need node configuration - Google manages it
  # Billing is per-pod resource usage, not per-node
  release_channel           = "RAPID"  # Faster updates for dev
  enable_managed_prometheus = false    # Save costs in dev

  master_authorized_networks = [
    {
      cidr_block   = "0.0.0.0/0"
      display_name = "All (dev only)"
    }
  ]

  vpc_dependency = module.vpc.vpc_id

  depends_on = [module.vpc]
}

# Workload Identity binding - must be created AFTER GKE cluster exists
# The identity pool (project.svc.id.goog) only exists once GKE is created
resource "google_service_account_iam_member" "app_workload_identity" {
  service_account_id = module.iam.app_service_account_name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[hta-calibration/hta-app]"

  depends_on = [module.gke]
}
