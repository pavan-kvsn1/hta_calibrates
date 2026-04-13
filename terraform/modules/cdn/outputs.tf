# CDN Module - Output Values

output "cdn_ip_address" {
  description = "Global IP address of the CDN"
  value       = google_compute_global_address.cdn.address
}

output "cdn_url" {
  description = "CDN URL (HTTP)"
  value       = "http://${google_compute_global_address.cdn.address}"
}

output "cdn_https_url" {
  description = "CDN URL (HTTPS) - only available if SSL certificate is configured"
  value       = var.ssl_certificate_id != "" || var.create_ssl_certificate ? "https://${var.cdn_domain != "" ? var.cdn_domain : google_compute_global_address.cdn.address}" : null
}

output "backend_bucket_name" {
  description = "Name of the backend bucket"
  value       = google_compute_backend_bucket.static_cdn.name
}

output "cdn_domain" {
  description = "CDN domain (custom or IP)"
  value       = var.cdn_domain != "" ? var.cdn_domain : google_compute_global_address.cdn.address
}

output "ssl_certificate_id" {
  description = "SSL certificate ID (if created)"
  value       = var.cdn_domain != "" && var.create_ssl_certificate ? google_compute_managed_ssl_certificate.cdn[0].id : null
}
