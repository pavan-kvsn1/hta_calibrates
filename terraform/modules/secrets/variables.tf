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

# Email (Resend) Configuration
variable "resend_api_key" {
  description = "Resend API key for sending emails"
  type        = string
  default     = ""
  sensitive   = true
}

variable "email_from" {
  description = "Email sender address (e.g., 'HTA Calibration <noreply@hta-calibration.com>')"
  type        = string
  default     = ""
}

# Queue Configuration
variable "queue_process_secret" {
  description = "Secret for authenticating queue process API calls"
  type        = string
  default     = ""
  sensitive   = true
}

variable "create_queue_secret" {
  description = "Auto-generate a queue process secret if not provided"
  type        = bool
  default     = true
}
