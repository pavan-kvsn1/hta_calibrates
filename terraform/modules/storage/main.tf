# Storage Module - Main Configuration
# Creates Cloud Storage buckets for the application

# Certificates/PDFs Bucket
resource "google_storage_bucket" "certificates" {
  name          = "${var.project_id}-certificates-${var.environment}"
  project       = var.project_id
  location      = var.location
  storage_class = var.environment == "prod" ? "STANDARD" : "NEARLINE"

  # Prevent accidental deletion
  force_destroy = var.environment != "prod"

  # Uniform bucket-level access (recommended)
  uniform_bucket_level_access = true

  # Versioning for recovery
  versioning {
    enabled = true
  }

  # Lifecycle rules
  lifecycle_rule {
    condition {
      age = 365  # 1 year
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

  # CORS configuration for web access
  cors {
    origin          = var.cors_origins
    method          = ["GET", "HEAD"]
    response_header = ["Content-Type", "Content-Disposition"]
    max_age_seconds = 3600
  }

  labels = {
    environment = var.environment
    project     = "hta-calibration"
    managed_by  = "terraform"
    purpose     = "certificates"
  }
}

# Signatures Bucket
resource "google_storage_bucket" "signatures" {
  name          = "${var.project_id}-signatures-${var.environment}"
  project       = var.project_id
  location      = var.location
  storage_class = "STANDARD"

  force_destroy               = var.environment != "prod"
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

  labels = {
    environment = var.environment
    project     = "hta-calibration"
    managed_by  = "terraform"
    purpose     = "signatures"
  }
}

# Uploads/Temp Bucket
resource "google_storage_bucket" "uploads" {
  name          = "${var.project_id}-uploads-${var.environment}"
  project       = var.project_id
  location      = var.location
  storage_class = "STANDARD"

  force_destroy               = true  # Temp files, safe to delete
  uniform_bucket_level_access = true

  # Auto-delete temp files after 7 days
  lifecycle_rule {
    condition {
      age = 7
    }
    action {
      type = "Delete"
    }
  }

  # CORS for direct uploads
  cors {
    origin          = var.cors_origins
    method          = ["GET", "POST", "PUT", "DELETE", "HEAD"]
    response_header = ["*"]
    max_age_seconds = 3600
  }

  labels = {
    environment = var.environment
    project     = "hta-calibration"
    managed_by  = "terraform"
    purpose     = "uploads"
  }
}

# Backups Bucket (prod only)
resource "google_storage_bucket" "backups" {
  count = var.environment == "prod" ? 1 : 0

  name          = "${var.project_id}-backups-${var.environment}"
  project       = var.project_id
  location      = var.location
  storage_class = "NEARLINE"

  force_destroy               = false
  uniform_bucket_level_access = true

  versioning {
    enabled = true
  }

  # Move to coldline after 90 days
  lifecycle_rule {
    condition {
      age = 90
    }
    action {
      type          = "SetStorageClass"
      storage_class = "COLDLINE"
    }
  }

  # Delete after 2 years
  lifecycle_rule {
    condition {
      age = 730
    }
    action {
      type = "Delete"
    }
  }

  labels = {
    environment = var.environment
    project     = "hta-calibration"
    managed_by  = "terraform"
    purpose     = "backups"
  }
}

# Static Assets Bucket (for CDN)
resource "google_storage_bucket" "static" {
  name          = "${var.project_id}-static-${var.environment}"
  project       = var.project_id
  location      = var.location
  storage_class = "STANDARD"

  force_destroy               = var.environment != "prod"
  uniform_bucket_level_access = true

  # Enable website serving
  website {
    main_page_suffix = "index.html"
    not_found_page   = "404.html"
  }

  cors {
    origin          = ["*"]
    method          = ["GET", "HEAD"]
    response_header = ["*"]
    max_age_seconds = 86400  # 1 day
  }

  labels = {
    environment = var.environment
    project     = "hta-calibration"
    managed_by  = "terraform"
    purpose     = "static-assets"
  }
}

# Make static bucket publicly readable
resource "google_storage_bucket_iam_member" "static_public" {
  bucket = google_storage_bucket.static.name
  role   = "roles/storage.objectViewer"
  member = "allUsers"
}
