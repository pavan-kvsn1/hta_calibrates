# Staging Environment - Variables

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "asia-south1"
}

# ============================================
# Email Configuration
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
  default     = "HTA Calibration Staging <noreply-staging@hta-calibration.com>"
}

# ============================================
# Monitoring Configuration
# ============================================

variable "alert_email" {
  description = "Email address for monitoring alerts"
  type        = string
  default     = ""  # Optional for staging
}

variable "enable_monitoring" {
  description = "Whether to enable monitoring dashboard and alerts"
  type        = bool
  default     = true
}
