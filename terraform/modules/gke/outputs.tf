# GKE Module - Output Values

locals {
  # Select the active cluster based on mode
  cluster = var.cluster_mode == "autopilot" ? google_container_cluster.autopilot[0] : google_container_cluster.standard[0]
}

output "cluster_id" {
  description = "The ID of the GKE cluster"
  value       = local.cluster.id
}

output "cluster_name" {
  description = "The name of the GKE cluster"
  value       = local.cluster.name
}

output "cluster_endpoint" {
  description = "The endpoint of the GKE cluster"
  value       = local.cluster.endpoint
  sensitive   = true
}

output "cluster_ca_certificate" {
  description = "The CA certificate of the GKE cluster"
  value       = local.cluster.master_auth[0].cluster_ca_certificate
  sensitive   = true
}

output "cluster_location" {
  description = "The location of the GKE cluster"
  value       = local.cluster.location
}

output "cluster_master_version" {
  description = "The master version of the GKE cluster"
  value       = local.cluster.master_version
}

output "cluster_mode" {
  description = "The cluster mode (autopilot, zonal, or regional)"
  value       = var.cluster_mode
}

output "node_pool_name" {
  description = "The name of the primary node pool (null for Autopilot)"
  value       = var.cluster_mode == "autopilot" ? null : google_container_node_pool.primary[0].name
}

output "workload_identity_pool" {
  description = "The Workload Identity pool for the cluster"
  value       = "${var.project_id}.svc.id.goog"
}

output "get_credentials_command" {
  description = "Command to get kubectl credentials"
  value       = var.cluster_mode == "zonal" ? "gcloud container clusters get-credentials ${local.cluster.name} --zone ${local.cluster.location} --project ${var.project_id}" : "gcloud container clusters get-credentials ${local.cluster.name} --region ${var.region} --project ${var.project_id}"
}
