# Cloud Functions Module - Main Configuration
# Creates Cloud Functions for async image processing

# Service account for Cloud Functions
resource "google_service_account" "image_processor" {
  project      = var.project_id
  account_id   = "image-processor-${var.environment}"
  display_name = "Image Processor Cloud Function (${var.environment})"
  description  = "Service account for image processing Cloud Function"
}

# Grant the service account access to read/write images bucket
resource "google_storage_bucket_iam_member" "image_processor_storage" {
  bucket = var.images_bucket_name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.image_processor.email}"
}

# Grant the service account Cloud SQL client access (for updating DB)
resource "google_project_iam_member" "image_processor_cloudsql" {
  count   = var.database_url != "" ? 1 : 0
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.image_processor.email}"
}

# Storage bucket for Cloud Function source code
resource "google_storage_bucket" "function_source" {
  name          = "${var.project_id}-function-source-${var.environment}"
  project       = var.project_id
  location      = var.region
  storage_class = "STANDARD"

  force_destroy               = true
  uniform_bucket_level_access = true

  # Auto-delete old source after 30 days
  lifecycle_rule {
    condition {
      age = 30
    }
    action {
      type = "Delete"
    }
  }

  labels = {
    environment = var.environment
    project     = "hta-calibration"
    managed_by  = "terraform"
    purpose     = "function-source"
  }
}

# Archive the Cloud Function source code
data "archive_file" "image_processor_source" {
  type        = "zip"
  output_path = "${path.module}/image-processor.zip"
  source_dir  = "${path.module}/../../cloud-functions/image-processor"
}

# Upload the source code to the bucket
resource "google_storage_bucket_object" "image_processor_source" {
  name   = "image-processor-${data.archive_file.image_processor_source.output_md5}.zip"
  bucket = google_storage_bucket.function_source.name
  source = data.archive_file.image_processor_source.output_path
}

# Cloud Function Gen2 for image processing
resource "google_cloudfunctions2_function" "image_processor" {
  name        = "image-processor-${var.environment}"
  project     = var.project_id
  location    = var.region
  description = "Processes uploaded certificate images - creates optimized and thumbnail versions"

  build_config {
    runtime     = "nodejs20"
    entry_point = "processImage"
    source {
      storage_source {
        bucket = google_storage_bucket.function_source.name
        object = google_storage_bucket_object.image_processor_source.name
      }
    }
  }

  service_config {
    min_instance_count               = 0
    max_instance_count               = var.environment == "prod" ? 10 : 3
    available_memory                 = "512Mi"
    timeout_seconds                  = 120
    max_instance_request_concurrency = 1  # Process one image at a time per instance
    service_account_email            = google_service_account.image_processor.email

    environment_variables = {
      IMAGES_BUCKET    = var.images_bucket_name
      ENVIRONMENT      = var.environment
      OPTIMIZED_QUALITY = "90"
      THUMBNAIL_SIZE    = "200"
    }

    # VPC connector for Cloud SQL access (if provided)
    dynamic "vpc_connector" {
      for_each = var.vpc_connector != "" ? [1] : []
      content {
        connector = var.vpc_connector
      }
    }
  }

  # Trigger on object creation in images bucket
  event_trigger {
    trigger_region = var.region
    event_type     = "google.cloud.storage.object.v1.finalized"
    event_filters {
      attribute = "bucket"
      value     = var.images_bucket_name
    }
    retry_policy = "RETRY_POLICY_RETRY"
  }

  labels = {
    environment = var.environment
    project     = "hta-calibration"
    managed_by  = "terraform"
    purpose     = "image-processing"
  }
}

# Allow Cloud Storage to invoke the function
resource "google_cloud_run_service_iam_member" "invoker" {
  project  = var.project_id
  location = var.region
  service  = google_cloudfunctions2_function.image_processor.name
  role     = "roles/run.invoker"
  member   = "serviceAccount:service-${data.google_project.current.number}@gs-project-accounts.iam.gserviceaccount.com"
}

# Get current project info
data "google_project" "current" {
  project_id = var.project_id
}
