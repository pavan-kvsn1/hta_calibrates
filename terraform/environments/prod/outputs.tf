# Production Environment - Outputs

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

# Summary Output
output "environment_summary" {
  description = "Summary of the deployed environment"
  value = <<-EOT

    ===== HTA Calibration - Production Environment =====

    GKE Cluster: ${module.gke.cluster_name}
    Database: ${module.cloudsql.instance_name}

    To connect to the cluster:
    ${module.gke.get_credentials_command}

    Database connection (from within GKE):
    Host: ${module.cloudsql.private_ip_address}
    Database: ${module.cloudsql.database_name}
    User: ${module.cloudsql.database_user}

    Storage Buckets:
    - Certificates: ${module.storage.certificates_bucket_name}
    - Signatures: ${module.storage.signatures_bucket_name}
    - Uploads: ${module.storage.uploads_bucket_name}

    ====================================================
  EOT
}
