# Storage Module - Output Values

output "certificates_bucket_name" {
  description = "Name of the certificates bucket"
  value       = google_storage_bucket.certificates.name
}

output "certificates_bucket_url" {
  description = "URL of the certificates bucket"
  value       = google_storage_bucket.certificates.url
}

output "signatures_bucket_name" {
  description = "Name of the signatures bucket"
  value       = google_storage_bucket.signatures.name
}

output "signatures_bucket_url" {
  description = "URL of the signatures bucket"
  value       = google_storage_bucket.signatures.url
}

output "uploads_bucket_name" {
  description = "Name of the uploads bucket"
  value       = google_storage_bucket.uploads.name
}

output "uploads_bucket_url" {
  description = "URL of the uploads bucket"
  value       = google_storage_bucket.uploads.url
}

output "static_bucket_name" {
  description = "Name of the static assets bucket"
  value       = google_storage_bucket.static.name
}

output "static_bucket_url" {
  description = "URL of the static assets bucket"
  value       = google_storage_bucket.static.url
}

output "backups_bucket_name" {
  description = "Name of the backups bucket (prod only)"
  value       = var.environment == "prod" ? google_storage_bucket.backups[0].name : null
}
