# Secrets Module - Output Values

output "nextauth_secret_id" {
  description = "ID of the NextAuth secret"
  value       = google_secret_manager_secret.nextauth_secret.secret_id
}

output "nextauth_secret_name" {
  description = "Full resource name of the NextAuth secret"
  value       = google_secret_manager_secret.nextauth_secret.name
}

output "nextauth_url_secret_id" {
  description = "ID of the NextAuth URL secret"
  value       = google_secret_manager_secret.nextauth_url.secret_id
}

output "smtp_password_secret_id" {
  description = "ID of the SMTP password secret"
  value       = var.smtp_password != "" ? google_secret_manager_secret.smtp_password[0].secret_id : null
}

output "google_client_secret_id" {
  description = "ID of the Google client secret"
  value       = var.google_client_secret != "" ? google_secret_manager_secret.google_client_secret[0].secret_id : null
}

output "secret_references" {
  description = "Map of secret names to their GCP secret references for K8s"
  value = {
    NEXTAUTH_SECRET = "projects/${var.project_id}/secrets/${google_secret_manager_secret.nextauth_secret.secret_id}/versions/latest"
    NEXTAUTH_URL    = "projects/${var.project_id}/secrets/${google_secret_manager_secret.nextauth_url.secret_id}/versions/latest"
  }
}
