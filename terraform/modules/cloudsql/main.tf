# CloudSQL Module - Main Configuration
# Creates the Cloud SQL PostgreSQL instance

resource "random_id" "db_name_suffix" {
  byte_length = 4
}

resource "google_sql_database_instance" "main" {
  name                = "${var.project_id}-postgres-${var.environment}-${random_id.db_name_suffix.hex}"
  project             = var.project_id
  region              = var.region
  database_version    = var.database_version
  deletion_protection = var.environment == "prod"

  settings {
    tier              = var.tier
    availability_type = var.environment == "prod" ? "REGIONAL" : "ZONAL"
    disk_size         = var.disk_size
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    # IP configuration - Private only with SSL required
    ip_configuration {
      ipv4_enabled                                  = false
      private_network                               = var.vpc_id
      enable_private_path_for_google_cloud_services = true
      ssl_mode                                      = "ENCRYPTED_ONLY"  # Require SSL for all connections
    }

    # Backup configuration
    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"  # 8:30 AM IST
      point_in_time_recovery_enabled = var.environment == "prod"
      transaction_log_retention_days = var.environment == "prod" ? 7 : 1

      backup_retention_settings {
        retained_backups = var.environment == "prod" ? 30 : 7
        retention_unit   = "COUNT"
      }
    }

    # Maintenance window
    maintenance_window {
      day          = 7  # Sunday
      hour         = 4  # 9:30 AM IST
      update_track = "stable"
    }

    # Database flags
    database_flags {
      name  = "log_checkpoints"
      value = "on"
    }

    database_flags {
      name  = "log_connections"
      value = "on"
    }

    database_flags {
      name  = "log_disconnections"
      value = "on"
    }

    database_flags {
      name  = "log_lock_waits"
      value = "on"
    }

    database_flags {
      name  = "log_temp_files"
      value = "0"
    }

    database_flags {
      name  = "max_connections"
      value = var.max_connections
    }

    # ============ DATABASE AUDITING (pgAudit) ============
    # Enable pgAudit extension for comprehensive audit logging
    database_flags {
      name  = "cloudsql.enable_pgaudit"
      value = "on"
    }

    # Configure what to audit: ddl, write, read, role, function, misc
    # For security, audit DDL (schema changes) and WRITE (data modifications)
    database_flags {
      name  = "pgaudit.log"
      value = "ddl,write"
    }
    # =====================================================

    # Insights for query analysis
    insights_config {
      query_insights_enabled  = true
      query_plans_per_minute  = 5
      query_string_length     = 1024
      record_application_tags = true
      record_client_address   = true
    }

    # Password validation policy
    password_validation_policy {
      min_length                  = 12
      complexity                  = "COMPLEXITY_DEFAULT"  # Requires uppercase, lowercase, number, symbol
      reuse_interval              = 5                     # Cannot reuse last 5 passwords
      disallow_username_substring = true                  # Password cannot contain username
      enable_password_policy      = true
    }

    user_labels = {
      environment = var.environment
      project     = "hta-calibration"
      managed_by  = "terraform"
    }
  }

  depends_on = [var.private_vpc_connection]

  lifecycle {
    prevent_destroy = false  # Set to true in production
  }
}

# Application Database
resource "google_sql_database" "app" {
  name     = var.database_name
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  charset  = "UTF8"
}

# Database User
resource "random_password" "db_password" {
  length           = 32
  special          = true
  override_special = "!#$%&*()-_=+[]{}<>:?"
}

resource "google_sql_user" "app" {
  name     = var.database_user
  project  = var.project_id
  instance = google_sql_database_instance.main.name
  password = random_password.db_password.result

  deletion_policy = "ABANDON"
}

# Store password in Secret Manager
resource "google_secret_manager_secret" "db_password" {
  secret_id = "${var.project_id}-db-password-${var.environment}"
  project   = var.project_id

  labels = {
    environment = var.environment
    managed_by  = "terraform"
  }

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}

# Read replica for production
resource "google_sql_database_instance" "read_replica" {
  count = var.environment == "prod" && var.enable_read_replica ? 1 : 0

  name                 = "${var.project_id}-postgres-replica-${var.environment}-${random_id.db_name_suffix.hex}"
  project              = var.project_id
  region               = var.region
  database_version     = var.database_version
  master_instance_name = google_sql_database_instance.main.name

  replica_configuration {
    failover_target = false
  }

  settings {
    tier              = var.tier
    availability_type = "ZONAL"
    disk_size         = var.disk_size
    disk_type         = "PD_SSD"
    disk_autoresize   = true

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.vpc_id
      ssl_mode        = "ENCRYPTED_ONLY"  # Require SSL for replica connections too
    }

    user_labels = {
      environment = var.environment
      project     = "hta-calibration"
      managed_by  = "terraform"
      role        = "replica"
    }
  }
}
