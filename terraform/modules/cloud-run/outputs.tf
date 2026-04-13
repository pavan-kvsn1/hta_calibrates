# Cloud Run Module - Outputs

output "service_name" {
  description = "Cloud Run service name"
  value       = local.deploy_service ? google_cloud_run_v2_service.app[0].name : null
}

output "service_uri" {
  description = "Cloud Run service URI (auto-generated URL)"
  value       = local.deploy_service ? google_cloud_run_v2_service.app[0].uri : null
}

output "service_id" {
  description = "Cloud Run service ID"
  value       = local.deploy_service ? google_cloud_run_v2_service.app[0].id : null
}

output "latest_revision" {
  description = "Latest revision name"
  value       = local.deploy_service ? google_cloud_run_v2_service.app[0].latest_ready_revision : null
}

output "vpc_connector_id" {
  description = "VPC Access Connector ID"
  value       = google_vpc_access_connector.connector.id
}

output "vpc_connector_name" {
  description = "VPC Access Connector name"
  value       = google_vpc_access_connector.connector.name
}

output "vpc_connector_state" {
  description = "VPC Access Connector state"
  value       = google_vpc_access_connector.connector.state
}

output "service_deployed" {
  description = "Whether the Cloud Run service was deployed"
  value       = local.deploy_service
}
