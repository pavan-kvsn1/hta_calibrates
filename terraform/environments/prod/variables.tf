# Production Environment - Variables

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region"
  type        = string
  default     = "asia-south1"
}

variable "admin_cidr_block" {
  description = "CIDR block for admin access to GKE master (e.g., your office IP)"
  type        = string
  default     = "0.0.0.0/0"  # WARNING: Change this to your actual admin IP range
}
