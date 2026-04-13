# CDN Module - Input Variables

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "static_bucket_name" {
  description = "Name of the GCS bucket to serve via CDN"
  type        = string
}

variable "cdn_domain" {
  description = "Custom domain for CDN (e.g., cdn.htacalibr8s.com). Leave empty for IP-only access."
  type        = string
  default     = ""
}

variable "ssl_certificate_id" {
  description = "ID of existing SSL certificate. Leave empty to create managed certificate."
  type        = string
  default     = ""
}

variable "create_ssl_certificate" {
  description = "Whether to create a managed SSL certificate (requires cdn_domain)"
  type        = bool
  default     = false
}
