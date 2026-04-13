# Memorystore (Redis) Module - Input Variables

variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "region" {
  description = "GCP region for the Redis instance"
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

variable "vpc_id" {
  description = "VPC network ID for private connection"
  type        = string
}

variable "tier" {
  description = "Redis tier (BASIC or STANDARD_HA)"
  type        = string
  default     = "BASIC"
  validation {
    condition     = contains(["BASIC", "STANDARD_HA"], var.tier)
    error_message = "Tier must be BASIC or STANDARD_HA."
  }
}

variable "memory_size_gb" {
  description = "Redis memory size in GB"
  type        = number
  default     = 1
  validation {
    condition     = var.memory_size_gb >= 1 && var.memory_size_gb <= 300
    error_message = "Memory size must be between 1 and 300 GB."
  }
}

variable "redis_version" {
  description = "Redis version"
  type        = string
  default     = "REDIS_7_0"
  validation {
    condition     = contains(["REDIS_6_X", "REDIS_7_0"], var.redis_version)
    error_message = "Redis version must be REDIS_6_X or REDIS_7_0."
  }
}

variable "maxmemory_policy" {
  description = "Redis maxmemory eviction policy"
  type        = string
  default     = "allkeys-lru"
  validation {
    condition = contains([
      "volatile-lru",
      "allkeys-lru",
      "volatile-lfu",
      "allkeys-lfu",
      "volatile-random",
      "allkeys-random",
      "volatile-ttl",
      "noeviction"
    ], var.maxmemory_policy)
    error_message = "Invalid maxmemory policy."
  }
}

variable "auth_enabled" {
  description = "Enable Redis AUTH for security"
  type        = bool
  default     = true
}

variable "transit_encryption_mode" {
  description = "Transit encryption mode (DISABLED or SERVER_AUTHENTICATION)"
  type        = string
  default     = "SERVER_AUTHENTICATION"
  validation {
    condition     = contains(["DISABLED", "SERVER_AUTHENTICATION"], var.transit_encryption_mode)
    error_message = "Transit encryption mode must be DISABLED or SERVER_AUTHENTICATION."
  }
}

variable "app_service_account_email" {
  description = "Email of the application service account (for secret access)"
  type        = string
  default     = ""
}
