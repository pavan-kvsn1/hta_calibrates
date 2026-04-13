# Monitoring Module - Outputs

output "dashboard_id" {
  description = "The ID of the monitoring dashboard"
  value       = var.enable_dashboard ? google_monitoring_dashboard.cloud_run[0].id : null
}

output "dashboard_name" {
  description = "The display name of the monitoring dashboard"
  value       = var.enable_dashboard ? "HTA Calibration - ${title(var.environment)}" : null
}

output "notification_channel_id" {
  description = "The ID of the email notification channel"
  value       = var.enable_alerts ? google_monitoring_notification_channel.email[0].id : null
}

output "notification_channel_name" {
  description = "The name of the notification channel"
  value       = var.enable_alerts ? google_monitoring_notification_channel.email[0].name : null
}

output "alert_policy_error_rate_id" {
  description = "The ID of the error rate alert policy"
  value       = var.enable_alerts ? google_monitoring_alert_policy.error_rate[0].id : null
}

output "alert_policy_latency_id" {
  description = "The ID of the latency alert policy"
  value       = var.enable_alerts ? google_monitoring_alert_policy.high_latency[0].id : null
}

output "alert_policy_cpu_id" {
  description = "The ID of the CPU alert policy"
  value       = var.enable_alerts ? google_monitoring_alert_policy.high_cpu[0].id : null
}

output "alert_policy_backup_id" {
  description = "The ID of the backup alert policy"
  value       = var.enable_backup_alerts && var.enable_alerts && var.cloudsql_instance_name != "" ? google_monitoring_alert_policy.backup_failure[0].id : null
}

output "dashboard_url" {
  description = "URL to view the dashboard in GCP Console"
  value       = var.enable_dashboard ? "https://console.cloud.google.com/monitoring/dashboards/builder/${google_monitoring_dashboard.cloud_run[0].id}?project=${var.project_id}" : null
}
