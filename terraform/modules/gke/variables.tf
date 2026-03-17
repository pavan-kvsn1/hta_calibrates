# GKE Module - Input Variables

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for the cluster"
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

variable "vpc_name" {
  description = "Name of the VPC network"
  type        = string
}

variable "gke_subnet_name" {
  description = "Name of the GKE subnet"
  type        = string
}

variable "gke_pod_range_name" {
  description = "Name of the secondary IP range for pods"
  type        = string
}

variable "gke_service_range_name" {
  description = "Name of the secondary IP range for services"
  type        = string
}

variable "master_ipv4_cidr_block" {
  description = "CIDR block for the GKE master"
  type        = string
  default     = "172.16.0.0/28"
}

variable "master_authorized_networks" {
  description = "List of authorized networks for master access"
  type = list(object({
    cidr_block   = string
    display_name = string
  }))
  default = [
    {
      cidr_block   = "0.0.0.0/0"
      display_name = "All (temporary for setup)"
    }
  ]
}

variable "release_channel" {
  description = "GKE release channel (RAPID, REGULAR, STABLE)"
  type        = string
  default     = "REGULAR"
  validation {
    condition     = contains(["RAPID", "REGULAR", "STABLE"], var.release_channel)
    error_message = "Release channel must be one of: RAPID, REGULAR, STABLE."
  }
}

variable "node_count" {
  description = "Initial number of nodes per zone"
  type        = number
  default     = 1
}

variable "min_node_count" {
  description = "Minimum number of nodes for autoscaling"
  type        = number
  default     = 1
}

variable "max_node_count" {
  description = "Maximum number of nodes for autoscaling"
  type        = number
  default     = 3
}

variable "machine_type" {
  description = "Machine type for nodes"
  type        = string
  default     = "e2-medium"
}

variable "disk_size_gb" {
  description = "Disk size in GB for nodes"
  type        = number
  default     = 50
}

variable "node_service_account" {
  description = "Service account for GKE nodes"
  type        = string
}

variable "enable_managed_prometheus" {
  description = "Enable Google Managed Prometheus"
  type        = bool
  default     = true
}

variable "vpc_dependency" {
  description = "Dependency on VPC module completion"
  type        = any
  default     = null
}
