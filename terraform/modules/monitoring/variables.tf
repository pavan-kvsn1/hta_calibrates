# Monitoring Module - Variables
# Configuration for GCP Cloud Monitoring Dashboard and Alerts

variable "project_id" {
  description = "GCP Project ID"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "cloud_run_service_name" {
  description = "Name of the Cloud Run service to monitor"
  type        = string
  default     = "hta-calibration"
}

variable "region" {
  description = "GCP region where Cloud Run is deployed"
  type        = string
  default     = "asia-southeast1"
}

# Alert Configuration
variable "alert_email" {
  description = "Email address for alert notifications"
  type        = string
}

variable "error_rate_threshold" {
  description = "Number of 5xx errors in 5 minutes to trigger alert"
  type        = number
  default     = 10
}

variable "latency_threshold_ms" {
  description = "P95 latency in milliseconds to trigger alert"
  type        = number
  default     = 2000
}

variable "cpu_threshold_percent" {
  description = "CPU utilization percentage to trigger alert"
  type        = number
  default     = 80
}

variable "enable_alerts" {
  description = "Whether to create alert policies"
  type        = bool
  default     = true
}

variable "enable_dashboard" {
  description = "Whether to create the monitoring dashboard"
  type        = bool
  default     = true
}

# Backup Monitoring (DR)
variable "enable_backup_alerts" {
  description = "Whether to create Cloud SQL backup alerts (recommended for prod)"
  type        = bool
  default     = false
}

variable "cloudsql_instance_name" {
  description = "Cloud SQL instance name for backup monitoring (required if enable_backup_alerts=true)"
  type        = string
  default     = ""
}

variable "backup_alert_hours" {
  description = "Hours without successful backup before alerting"
  type        = number
  default     = 25  # Just over 24h to account for timing variations
}
