# CloudSQL Module - Output Values

output "instance_name" {
  description = "The name of the database instance"
  value       = google_sql_database_instance.main.name
}

output "instance_connection_name" {
  description = "The connection name for Cloud SQL Proxy"
  value       = google_sql_database_instance.main.connection_name
}

output "private_ip_address" {
  description = "The private IP address of the instance"
  value       = google_sql_database_instance.main.private_ip_address
}

output "database_name" {
  description = "The name of the application database"
  value       = google_sql_database.app.name
}

output "database_user" {
  description = "The database user"
  value       = google_sql_user.app.name
}

output "database_password_secret_id" {
  description = "The Secret Manager secret ID for the database password"
  value       = google_secret_manager_secret.db_password.secret_id
}

output "database_url" {
  description = "PostgreSQL connection URL (without password)"
  value       = "postgresql://${google_sql_user.app.name}@${google_sql_database_instance.main.private_ip_address}:5432/${google_sql_database.app.name}"
  sensitive   = true
}

output "replica_instance_name" {
  description = "The name of the read replica instance"
  value       = var.enable_read_replica ? google_sql_database_instance.read_replica[0].name : null
}

output "replica_private_ip_address" {
  description = "The private IP address of the read replica"
  value       = var.enable_read_replica ? google_sql_database_instance.read_replica[0].private_ip_address : null
}
