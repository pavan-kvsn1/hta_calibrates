# Development Environment - Outputs

# VPC Outputs
output "vpc_name" {
  description = "Name of the VPC"
  value       = module.vpc.vpc_name
}

output "vpc_connector_name" {
  description = "Name of the VPC Access Connector"
  value       = module.cloud_run.vpc_connector_name
}

# Cloud Run Outputs
output "cloud_run_service_deployed" {
  description = "Whether the Cloud Run service was deployed"
  value       = module.cloud_run.service_deployed
}

output "cloud_run_service_name" {
  description = "Name of the Cloud Run service (null if not deployed)"
  value       = module.cloud_run.service_name
}

output "cloud_run_service_url" {
  description = "URL of the Cloud Run service (null if not deployed)"
  value       = module.cloud_run.service_uri
}

output "cloud_run_latest_revision" {
  description = "Latest revision of the Cloud Run service (null if not deployed)"
  value       = module.cloud_run.latest_revision
}

# Database Outputs
output "database_instance_name" {
  description = "Name of the Cloud SQL instance"
  value       = module.cloudsql.instance_name
}

output "database_connection_name" {
  description = "Cloud SQL connection name for proxy"
  value       = module.cloudsql.instance_connection_name
}

output "database_private_ip" {
  description = "Private IP of the database"
  value       = module.cloudsql.private_ip_address
  sensitive   = true
}

output "database_password_secret" {
  description = "Secret Manager ID for database password"
  value       = module.cloudsql.database_password_secret_id
}

output "database_url_secret" {
  description = "Secret Manager ID for complete DATABASE_URL"
  value       = google_secret_manager_secret.database_url.secret_id
}

# Storage Outputs
output "certificates_bucket" {
  description = "Name of the certificates bucket"
  value       = module.storage.certificates_bucket_name
}

output "signatures_bucket" {
  description = "Name of the signatures bucket"
  value       = module.storage.signatures_bucket_name
}

output "uploads_bucket" {
  description = "Name of the uploads bucket"
  value       = module.storage.uploads_bucket_name
}

# IAM Outputs
output "app_service_account" {
  description = "Application service account email"
  value       = module.iam.app_service_account_email
}

output "cicd_service_account" {
  description = "CI/CD service account email"
  value       = module.iam.cicd_service_account_email
}

# Redis/Cache Outputs
output "redis_host" {
  description = "Redis host IP address"
  value       = module.memorystore.redis_host
  sensitive   = true
}

output "redis_port" {
  description = "Redis port"
  value       = module.memorystore.redis_port
}

output "redis_auth_secret_id" {
  description = "Secret Manager ID for Redis AUTH string"
  value       = module.memorystore.redis_auth_secret_id
}

output "redis_url_secret" {
  description = "Secret Manager ID for complete REDIS_URL"
  value       = google_secret_manager_secret.redis_url.secret_id
}

# Artifact Registry Outputs
output "artifact_registry_url" {
  description = "URL for pushing Docker images"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}"
}

# Monitoring Outputs (only if enabled)
output "monitoring_dashboard_url" {
  description = "URL to the Cloud Monitoring dashboard (null if monitoring disabled)"
  value       = var.enable_monitoring ? module.monitoring.dashboard_url : null
}

output "monitoring_enabled" {
  description = "Whether monitoring is enabled"
  value       = var.enable_monitoring
}

# Summary Output
output "environment_summary" {
  description = "Summary of the deployed environment"
  value = <<-EOT

    ===== HTA Calibration - Dev Environment (Cloud Run) =====

    Cloud Run Service: ${module.cloud_run.service_deployed ? module.cloud_run.service_name : "(not yet deployed)"}
    Service URL: ${module.cloud_run.service_deployed ? module.cloud_run.service_uri : "(deploy container image first)"}

    Database: ${module.cloudsql.instance_name}
    - Host: (use DATABASE_URL secret)
    - Database: ${module.cloudsql.database_name}
    - User: ${module.cloudsql.database_user}

    Redis: ${module.memorystore.redis_host}:${module.memorystore.redis_port}

    Storage Buckets:
    - Certificates: ${module.storage.certificates_bucket_name}
    - Signatures: ${module.storage.signatures_bucket_name}
    - Uploads: ${module.storage.uploads_bucket_name}

    Artifact Registry:
    ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}

    To deploy:
    1. Build: docker build -t ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}/app:latest .
    2. Push: docker push ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}/app:latest
    3. Re-run terraform with container_image_url set, or deploy directly with gcloud:
       gcloud run deploy hta-calibration-dev --image=${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.repository_id}/app:latest --region=${var.region}

    ==============================================
  EOT
}
