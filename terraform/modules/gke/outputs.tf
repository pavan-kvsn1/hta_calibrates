# GKE Module - Output Values

output "cluster_id" {
  description = "The ID of the GKE cluster"
  value       = google_container_cluster.primary.id
}

output "cluster_name" {
  description = "The name of the GKE cluster"
  value       = google_container_cluster.primary.name
}

output "cluster_endpoint" {
  description = "The endpoint of the GKE cluster"
  value       = google_container_cluster.primary.endpoint
  sensitive   = true
}

output "cluster_ca_certificate" {
  description = "The CA certificate of the GKE cluster"
  value       = google_container_cluster.primary.master_auth[0].cluster_ca_certificate
  sensitive   = true
}

output "cluster_location" {
  description = "The location of the GKE cluster"
  value       = google_container_cluster.primary.location
}

output "cluster_master_version" {
  description = "The master version of the GKE cluster"
  value       = google_container_cluster.primary.master_version
}

output "node_pool_name" {
  description = "The name of the primary node pool"
  value       = google_container_node_pool.primary.name
}

output "workload_identity_pool" {
  description = "The Workload Identity pool for the cluster"
  value       = "${var.project_id}.svc.id.goog"
}

output "get_credentials_command" {
  description = "Command to get kubectl credentials"
  value       = "gcloud container clusters get-credentials ${google_container_cluster.primary.name} --region ${var.region} --project ${var.project_id}"
}
