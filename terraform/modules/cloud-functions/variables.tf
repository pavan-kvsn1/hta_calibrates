# Cloud Functions Module - Input Variables

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for Cloud Functions"
  type        = string
  default     = "asia-south1"
}

variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  validation {
    condition     = contains(["dev", "staging", "prod"], var.environment)
    error_message = "Environment must be one of: dev, staging, prod."
  }
}

variable "images_bucket_name" {
  description = "Name of the certificate images bucket (trigger source)"
  type        = string
}

variable "database_url" {
  description = "Database connection URL for updating image records"
  type        = string
  sensitive   = true
  default     = ""
}

variable "vpc_connector" {
  description = "VPC connector for Cloud Function to access Cloud SQL"
  type        = string
  default     = ""
}
