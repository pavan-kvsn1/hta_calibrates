# Memorystore (Redis) Module - Main Configuration
# Creates a managed Redis instance for caching

# Enable Memorystore API
resource "google_project_service" "memorystore_api" {
  project = var.project_id
  service = "redis.googleapis.com"

  disable_on_destroy = false
}

# Redis Instance
resource "google_redis_instance" "cache" {
  name           = "hta-cache-${var.environment}"
  project        = var.project_id
  region         = var.region
  tier           = var.tier
  memory_size_gb = var.memory_size_gb

  # Redis version
  redis_version = var.redis_version

  # Network configuration - connect to VPC
  authorized_network = var.vpc_id

  # Connection mode
  connect_mode = "PRIVATE_SERVICE_ACCESS"

  # Redis configuration
  redis_configs = {
    maxmemory-policy = var.maxmemory_policy
    notify-keyspace-events = "Ex"  # Enable keyspace notifications for expiry
  }

  # Maintenance window (Sunday 2-3 AM)
  maintenance_policy {
    weekly_maintenance_window {
      day = "SUNDAY"
      start_time {
        hours   = 2
        minutes = 0
        seconds = 0
        nanos   = 0
      }
    }
  }

  # Labels
  labels = {
    environment = var.environment
    managed_by  = "terraform"
    app         = "hta-calibration"
  }

  # Auth enabled for security
  auth_enabled = var.auth_enabled

  # Transit encryption
  transit_encryption_mode = var.transit_encryption_mode

  depends_on = [google_project_service.memorystore_api]

  lifecycle {
    prevent_destroy = false  # Set to true in production
  }
}

# Store Redis auth string in Secret Manager (if auth is enabled)
resource "google_secret_manager_secret" "redis_auth" {
  count = var.auth_enabled ? 1 : 0

  secret_id = "${var.project_id}-redis-auth-${var.environment}"
  project   = var.project_id

  labels = {
    environment = var.environment
    managed_by  = "terraform"
    app         = "hta-calibration"
  }

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "redis_auth" {
  count = var.auth_enabled ? 1 : 0

  secret      = google_secret_manager_secret.redis_auth[0].id
  secret_data = google_redis_instance.cache.auth_string
}

# Grant access to the app service account
resource "google_secret_manager_secret_iam_member" "redis_auth_access" {
  count = var.auth_enabled && var.app_service_account_email != "" ? 1 : 0

  secret_id = google_secret_manager_secret.redis_auth[0].secret_id
  project   = var.project_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.app_service_account_email}"
}
