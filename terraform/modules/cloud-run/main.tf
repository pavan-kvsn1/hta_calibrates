# Cloud Run Module - Main Configuration
# Creates Cloud Run service with VPC Connector for private resource access

locals {
  # Only deploy Cloud Run service if image URL is provided and deploy_service is true
  deploy_service = var.deploy_service && var.image_url != ""
}

# VPC Access Connector for Cloud Run to reach private resources (Cloud SQL, Redis)
resource "google_vpc_access_connector" "connector" {
  name          = "hta-${var.environment}-connector"
  project       = var.project_id
  region        = var.region
  network       = var.vpc_name
  ip_cidr_range = var.connector_cidr_range

  min_instances = var.connector_min_instances
  max_instances = var.connector_max_instances
  machine_type  = var.connector_machine_type
}

# Cloud Run Service
resource "google_cloud_run_v2_service" "app" {
  count = local.deploy_service ? 1 : 0

  name     = "hta-calibration-${var.environment}"
  location = var.region
  project  = var.project_id

  template {
    service_account = var.service_account_email

    # VPC access for private resources
    vpc_access {
      connector = google_vpc_access_connector.connector.id
      egress    = "PRIVATE_RANGES_ONLY"
    }

    # Scaling configuration
    scaling {
      min_instance_count = var.min_instances
      max_instance_count = var.max_instances
    }

    containers {
      image = var.image_url
      name  = "app"

      ports {
        container_port = var.container_port
      }

      resources {
        limits = {
          cpu    = var.cpu
          memory = var.memory
        }
        cpu_idle          = var.cpu_idle
        startup_cpu_boost = var.startup_cpu_boost
      }

      # Environment variables (non-sensitive)
      dynamic "env" {
        for_each = var.env_vars
        content {
          name  = env.key
          value = env.value
        }
      }

      # Secrets from Secret Manager
      dynamic "env" {
        for_each = var.secrets
        content {
          name = env.key
          value_source {
            secret_key_ref {
              secret  = env.value
              version = "latest"
            }
          }
        }
      }

      # Startup probe - give Next.js time to start
      startup_probe {
        initial_delay_seconds = 5
        timeout_seconds       = 3
        period_seconds        = 5
        failure_threshold     = 10
        http_get {
          path = var.health_check_path
          port = var.container_port
        }
      }

      # Liveness probe - ensure app stays healthy
      liveness_probe {
        timeout_seconds   = 3
        period_seconds    = 30
        failure_threshold = 3
        http_get {
          path = var.health_check_path
          port = var.container_port
        }
      }
    }

    # Request timeout
    timeout = "${var.request_timeout_seconds}s"

    # Maximum concurrent requests per instance
    max_instance_request_concurrency = var.max_concurrent_requests

    # Execution environment
    execution_environment = "EXECUTION_ENVIRONMENT_GEN2"
  }

  # Traffic routing - always route 100% to latest
  traffic {
    type    = "TRAFFIC_TARGET_ALLOCATION_TYPE_LATEST"
    percent = 100
  }

  labels = {
    environment = var.environment
    managed_by  = "terraform"
    app         = "hta-calibration"
  }

  lifecycle {
    ignore_changes = [
      # Ignore image changes - managed by CI/CD
      template[0].containers[0].image,
    ]
  }
}

# IAM: Allow unauthenticated access (public) or restrict
resource "google_cloud_run_v2_service_iam_member" "public_invoker" {
  count = local.deploy_service && var.allow_unauthenticated ? 1 : 0

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.app[0].name
  role     = "roles/run.invoker"
  member   = "allUsers"
}

# IAM: Allow specific service accounts to invoke (for internal services)
resource "google_cloud_run_v2_service_iam_member" "service_invokers" {
  for_each = local.deploy_service ? toset(var.invoker_service_accounts) : toset([])

  project  = var.project_id
  location = var.region
  name     = google_cloud_run_v2_service.app[0].name
  role     = "roles/run.invoker"
  member   = "serviceAccount:${each.value}"
}

# Cloud Scheduler job for cron tasks (optional)
resource "google_cloud_scheduler_job" "cron_job" {
  count = local.deploy_service && var.enable_cron_job ? 1 : 0

  name        = "hta-calibration-${var.environment}-cron"
  project     = var.project_id
  region      = var.region
  description = "Triggers scheduled tasks for HTA Calibration"
  schedule    = var.cron_schedule
  time_zone   = var.cron_timezone

  http_target {
    uri         = "${google_cloud_run_v2_service.app[0].uri}${var.cron_endpoint}"
    http_method = "POST"

    oidc_token {
      service_account_email = var.service_account_email
      audience              = google_cloud_run_v2_service.app[0].uri
    }

    headers = {
      "Content-Type" = "application/json"
    }

    body = base64encode(jsonencode({
      trigger = "scheduled"
      job     = var.cron_job_name
    }))
  }

  retry_config {
    retry_count          = 1
    max_retry_duration   = "60s"
    min_backoff_duration = "5s"
    max_backoff_duration = "30s"
  }
}
