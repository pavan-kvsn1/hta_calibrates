# Staging Environment - Outputs

# VPC Outputs
output "vpc_name" {
  description = "Name of the VPC"
  value       = module.vpc.vpc_name
}

output "gke_subnet_name" {
  description = "Name of the GKE subnet"
  value       = module.vpc.gke_subnet_name
}

# GKE Outputs
output "gke_cluster_name" {
  description = "Name of the GKE cluster"
  value       = module.gke.cluster_name
}

output "gke_cluster_endpoint" {
  description = "Endpoint of the GKE cluster"
  value       = module.gke.cluster_endpoint
  sensitive   = true
}

output "gke_cluster_mode" {
  description = "GKE cluster mode (autopilot)"
  value       = module.gke.cluster_mode
}

output "get_credentials_command" {
  description = "Command to configure kubectl"
  value       = module.gke.get_credentials_command
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
output "artifact_registry_repository" {
  description = "Artifact Registry repository name"
  value       = google_artifact_registry_repository.app.name
}

output "artifact_registry_url" {
  description = "Artifact Registry URL for docker push"
  value       = "${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.name}"
}

# Monitoring Outputs
output "monitoring_dashboard_url" {
  description = "URL to the Cloud Monitoring dashboard"
  value       = var.enable_monitoring ? module.monitoring.dashboard_url : null
}

output "alert_notification_channel" {
  description = "Notification channel for alerts"
  value       = var.enable_monitoring ? module.monitoring.notification_channel_name : null
}

# Summary Output
output "environment_summary" {
  description = "Summary of the deployed environment"
  value = <<-EOT

    ===== HTA Calibration - Staging Environment =====

    GKE Cluster: ${module.gke.cluster_name} (Autopilot)
    Database: ${module.cloudsql.instance_name}
    Redis: ${module.memorystore.redis_host}:${module.memorystore.redis_port}

    To connect to the cluster:
    ${module.gke.get_credentials_command}

    Container Registry:
    ${var.region}-docker.pkg.dev/${var.project_id}/${google_artifact_registry_repository.app.name}

    Secrets (for K8s External Secrets):
    - DATABASE_URL: ${google_secret_manager_secret.database_url.secret_id}
    - REDIS_URL: ${google_secret_manager_secret.redis_url.secret_id}
    - NEXTAUTH_SECRET: ${module.secrets.nextauth_secret_id}

    =================================================
  EOT
}
