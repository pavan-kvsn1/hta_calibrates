# Secrets Module - Input Variables

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

variable "app_service_account_email" {
  description = "Email of the application service account"
  type        = string
}

variable "nextauth_secret" {
  description = "NextAuth secret (leave empty to auto-generate)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "nextauth_url" {
  description = "NextAuth URL for the application"
  type        = string
  default     = "http://localhost:3000"
}

variable "smtp_password" {
  description = "SMTP password for email (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "google_client_secret" {
  description = "Google OAuth client secret (optional)"
  type        = string
  default     = ""
  sensitive   = true
}

variable "create_pdf_signing_key" {
  description = "Create a secret for PDF signing key"
  type        = bool
  default     = false
}
