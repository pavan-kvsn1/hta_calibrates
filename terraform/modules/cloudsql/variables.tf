# CloudSQL Module - Input Variables

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for the database"
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

variable "vpc_id" {
  description = "VPC network ID for private IP"
  type        = string
}

variable "private_vpc_connection" {
  description = "Private VPC connection dependency"
  type        = any
  default     = null
}

variable "database_version" {
  description = "PostgreSQL version"
  type        = string
  default     = "POSTGRES_15"
}

variable "tier" {
  description = "Machine tier for the database instance"
  type        = string
  default     = "db-f1-micro"  # Smallest for dev, upgrade for prod
}

variable "disk_size" {
  description = "Initial disk size in GB"
  type        = number
  default     = 10
}

variable "database_name" {
  description = "Name of the application database"
  type        = string
  default     = "hta_calibration"
}

variable "database_user" {
  description = "Database user for the application"
  type        = string
  default     = "hta_app"
}

variable "max_connections" {
  description = "Maximum database connections"
  type        = string
  default     = "100"
}

variable "enable_read_replica" {
  description = "Enable read replica for production"
  type        = bool
  default     = false
}
