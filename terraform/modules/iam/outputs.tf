# IAM Module - Output Values

output "gke_node_service_account_email" {
  description = "Email of the GKE node service account"
  value       = google_service_account.gke_node.email
}

output "gke_node_service_account_name" {
  description = "Name of the GKE node service account"
  value       = google_service_account.gke_node.name
}

output "app_service_account_email" {
  description = "Email of the application service account"
  value       = google_service_account.app.email
}

output "app_service_account_name" {
  description = "Name of the application service account"
  value       = google_service_account.app.name
}

output "cicd_service_account_email" {
  description = "Email of the CI/CD service account"
  value       = google_service_account.cicd.email
}

output "cicd_service_account_name" {
  description = "Name of the CI/CD service account"
  value       = google_service_account.cicd.name
}

output "workload_identity_pool_name" {
  description = "Name of the GitHub Workload Identity Pool"
  value       = var.enable_github_workload_identity ? google_iam_workload_identity_pool.github[0].name : null
}

output "workload_identity_provider" {
  description = "Full provider name for GitHub Actions"
  value       = var.enable_github_workload_identity ? google_iam_workload_identity_pool_provider.github[0].name : null
}
