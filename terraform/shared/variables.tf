# Shared Resources - Variables

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for Artifact Registry"
  type        = string
  default     = "asia-south1"
}
