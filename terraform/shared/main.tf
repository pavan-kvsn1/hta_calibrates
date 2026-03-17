# Shared Resources - Main Configuration
# Resources shared across all environments (Artifact Registry, etc.)

terraform {
  required_version = ">= 1.5.0"

  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"
    }
  }

  # Uncomment after creating the state bucket
  # backend "gcs" {
  #   bucket = "hta-calibration-terraform-state"
  #   prefix = "shared"
  # }
}

provider "google" {
  project = var.project_id
  region  = var.region
}

# Enable required APIs
resource "google_project_service" "required_apis" {
  for_each = toset([
    "artifactregistry.googleapis.com",
    "cloudresourcemanager.googleapis.com",
    "iam.googleapis.com",
  ])

  project = var.project_id
  service = each.value

  disable_on_destroy = false
}

# Artifact Registry for Docker images
resource "google_artifact_registry_repository" "docker" {
  location      = var.region
  repository_id = "hta-calibration"
  description   = "Docker images for HTA Calibration application"
  format        = "DOCKER"
  project       = var.project_id

  cleanup_policies {
    id     = "keep-minimum-versions"
    action = "KEEP"
    most_recent_versions {
      keep_count = 10
    }
  }

  cleanup_policies {
    id     = "delete-old-untagged"
    action = "DELETE"
    condition {
      tag_state    = "UNTAGGED"
      older_than   = "604800s"  # 7 days
    }
  }

  depends_on = [google_project_service.required_apis]
}

# Terraform state bucket
resource "google_storage_bucket" "terraform_state" {
  name          = "${var.project_id}-terraform-state"
  project       = var.project_id
  location      = "ASIA"
  storage_class = "STANDARD"

  # Prevent accidental deletion
  force_destroy = false

  # Enable versioning for state history
  versioning {
    enabled = true
  }

  # Uniform bucket-level access
  uniform_bucket_level_access = true

  # Lifecycle rule to clean up old versions
  lifecycle_rule {
    condition {
      num_newer_versions = 5
    }
    action {
      type = "Delete"
    }
  }

  labels = {
    purpose    = "terraform-state"
    managed_by = "terraform"
  }
}

# IAM for state bucket
resource "google_storage_bucket_iam_member" "terraform_state_admin" {
  bucket = google_storage_bucket.terraform_state.name
  role   = "roles/storage.admin"
  member = "projectEditor:${var.project_id}"
}
