# Storage Module - Input Variables

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "location" {
  description = "GCS bucket location (region or multi-region)"
  type        = string
  default     = "ASIA"  # Multi-region for durability
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "cors_origins" {
  description = "Allowed CORS origins for buckets"
  type        = list(string)
  default     = ["http://localhost:3000"]
}

variable "cloudrun_service_account" {
  description = "Service account email for Cloud Run (for IAM bindings)"
  type        = string
  default     = ""
}
