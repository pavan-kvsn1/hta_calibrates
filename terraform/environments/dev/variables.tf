# Development Environment - Variables

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "asia-south1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

# ============================================
# Container Configuration
# ============================================

variable "container_image_url" {
  description = "Container image URL for Cloud Run (e.g., asia-south1-docker.pkg.dev/PROJECT/hta-calibration/app:latest)"
  type        = string
  default     = ""  # Must be provided for deployment, but can be empty for initial infra setup
}

# ============================================
# Application Configuration
# ============================================

variable "nextauth_url" {
  description = "NextAuth URL for the application"
  type        = string
  default     = "http://localhost:3000"
}

variable "enable_cron_job" {
  description = "Enable Cloud Scheduler for periodic tasks"
  type        = bool
  default     = false  # Disabled by default for dev
}

# ============================================
# Email Configuration (optional for dev)
# ============================================

variable "resend_api_key" {
  description = "Resend API key for sending emails"
  type        = string
  default     = ""
  sensitive   = true
}

variable "email_from" {
  description = "Email sender address"
  type        = string
  default     = "HTA Calibration Dev <noreply-dev@hta-calibration.com>"
}

# ============================================
# Monitoring Configuration (optional for dev)
# ============================================

variable "alert_email" {
  description = "Email address for monitoring alerts"
  type        = string
  default     = ""  # Optional for dev
}

variable "enable_monitoring" {
  description = "Whether to enable monitoring dashboard and alerts"
  type        = bool
  default     = false  # Disabled by default for dev
}
