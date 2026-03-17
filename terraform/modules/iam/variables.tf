# IAM Module - Input Variables

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

variable "certificates_bucket_name" {
  description = "Name of the certificates storage bucket"
  type        = string
}

variable "signatures_bucket_name" {
  description = "Name of the signatures storage bucket"
  type        = string
}

variable "uploads_bucket_name" {
  description = "Name of the uploads storage bucket"
  type        = string
}

variable "k8s_namespace" {
  description = "Kubernetes namespace for the application"
  type        = string
  default     = "hta-calibration"
}

variable "enable_github_workload_identity" {
  description = "Enable GitHub Actions Workload Identity"
  type        = bool
  default     = false
}

variable "github_repo" {
  description = "GitHub repository for Workload Identity (org/repo format)"
  type        = string
  default     = ""
}
