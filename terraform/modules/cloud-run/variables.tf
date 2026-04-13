# Cloud Run Module - Variables

# ============================================
# Required Variables
# ============================================

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for Cloud Run service"
  type        = string
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
}

variable "image_url" {
  description = "Container image URL from Artifact Registry. If empty, Cloud Run service will not be created."
  type        = string
  default     = ""
}

variable "deploy_service" {
  description = "Whether to deploy the Cloud Run service (set to false for infra-only setup)"
  type        = bool
  default     = true
}

variable "service_account_email" {
  description = "Service account email for Cloud Run service"
  type        = string
}

variable "vpc_name" {
  description = "VPC network name for VPC connector"
  type        = string
}

# ============================================
# VPC Connector Configuration
# ============================================

variable "connector_cidr_range" {
  description = "CIDR range for VPC connector (must not overlap with other ranges)"
  type        = string
  default     = "10.8.0.0/28"
}

variable "connector_min_instances" {
  description = "Minimum instances for VPC connector"
  type        = number
  default     = 2
}

variable "connector_max_instances" {
  description = "Maximum instances for VPC connector"
  type        = number
  default     = 10
}

variable "connector_machine_type" {
  description = "Machine type for VPC connector instances"
  type        = string
  default     = "e2-micro"
}

# ============================================
# Container Configuration
# ============================================

variable "container_port" {
  description = "Port the container listens on"
  type        = number
  default     = 3000
}

variable "cpu" {
  description = "CPU allocation (e.g., '1', '2', '0.5')"
  type        = string
  default     = "1"
}

variable "memory" {
  description = "Memory allocation (e.g., '512Mi', '1Gi')"
  type        = string
  default     = "512Mi"
}

variable "cpu_idle" {
  description = "Whether CPU is allocated only during request processing"
  type        = bool
  default     = true  # Cost savings: CPU deallocated when idle
}

variable "startup_cpu_boost" {
  description = "Whether to boost CPU during startup"
  type        = bool
  default     = true  # Faster cold starts
}

# ============================================
# Scaling Configuration
# ============================================

variable "min_instances" {
  description = "Minimum number of instances (0 allows scale to zero)"
  type        = number
  default     = 0
}

variable "max_instances" {
  description = "Maximum number of instances"
  type        = number
  default     = 10
}

variable "max_concurrent_requests" {
  description = "Maximum concurrent requests per instance"
  type        = number
  default     = 80
}

# ============================================
# Health Check Configuration
# ============================================

variable "health_check_path" {
  description = "Path for health checks"
  type        = string
  default     = "/api/health"
}

# ============================================
# Request Configuration
# ============================================

variable "request_timeout_seconds" {
  description = "Maximum request timeout in seconds"
  type        = number
  default     = 300  # 5 minutes for long-running operations
}

# ============================================
# Environment & Secrets
# ============================================

variable "env_vars" {
  description = "Environment variables (non-sensitive)"
  type        = map(string)
  default     = {}
}

variable "secrets" {
  description = "Secrets from Secret Manager (name -> secret_id)"
  type        = map(string)
  default     = {}
}

# ============================================
# Access Control
# ============================================

variable "allow_unauthenticated" {
  description = "Allow public (unauthenticated) access"
  type        = bool
  default     = true
}

variable "invoker_service_accounts" {
  description = "List of service account emails that can invoke this service"
  type        = list(string)
  default     = []
}

# ============================================
# Cron Job Configuration (Optional)
# ============================================

variable "enable_cron_job" {
  description = "Enable Cloud Scheduler cron job for scheduled tasks"
  type        = bool
  default     = false
}

variable "cron_schedule" {
  description = "Cron schedule expression (e.g., '0 * * * *' for hourly)"
  type        = string
  default     = "0 * * * *"
}

variable "cron_timezone" {
  description = "Timezone for cron schedule"
  type        = string
  default     = "Asia/Kolkata"
}

variable "cron_endpoint" {
  description = "API endpoint to call for cron job"
  type        = string
  default     = "/api/cron/process-queue"
}

variable "cron_job_name" {
  description = "Name identifier for the cron job"
  type        = string
  default     = "process-queue"
}
