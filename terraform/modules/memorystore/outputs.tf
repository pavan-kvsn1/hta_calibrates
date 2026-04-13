# Memorystore (Redis) Module - Outputs

output "redis_host" {
  description = "The IP address of the Redis instance"
  value       = google_redis_instance.cache.host
}

output "redis_port" {
  description = "The port of the Redis instance"
  value       = google_redis_instance.cache.port
}

output "redis_current_location_id" {
  description = "The current zone where the Redis instance is placed"
  value       = google_redis_instance.cache.current_location_id
}

output "redis_auth_enabled" {
  description = "Whether AUTH is enabled for the Redis instance"
  value       = google_redis_instance.cache.auth_enabled
}

output "redis_auth_secret_id" {
  description = "The Secret Manager secret ID for Redis AUTH string"
  value       = var.auth_enabled ? google_secret_manager_secret.redis_auth[0].secret_id : null
}

output "redis_connection_string" {
  description = "Redis connection string (without auth)"
  value       = "redis://${google_redis_instance.cache.host}:${google_redis_instance.cache.port}"
}

output "redis_instance_name" {
  description = "The name of the Redis instance"
  value       = google_redis_instance.cache.name
}

output "redis_memory_size_gb" {
  description = "The memory size of the Redis instance in GB"
  value       = google_redis_instance.cache.memory_size_gb
}
