# VPC Module - Output Values

output "vpc_id" {
  description = "The ID of the VPC"
  value       = google_compute_network.main.id
}

output "vpc_name" {
  description = "The name of the VPC"
  value       = google_compute_network.main.name
}

output "vpc_self_link" {
  description = "The self link of the VPC"
  value       = google_compute_network.main.self_link
}

output "public_subnet_id" {
  description = "The ID of the public subnet"
  value       = google_compute_subnetwork.public.id
}

output "public_subnet_name" {
  description = "The name of the public subnet"
  value       = google_compute_subnetwork.public.name
}

output "gke_subnet_id" {
  description = "The ID of the GKE subnet"
  value       = google_compute_subnetwork.gke.id
}

output "gke_subnet_name" {
  description = "The name of the GKE subnet"
  value       = google_compute_subnetwork.gke.name
}

output "gke_pod_range_name" {
  description = "The name of the secondary IP range for GKE pods"
  value       = google_compute_subnetwork.gke.secondary_ip_range[0].range_name
}

output "gke_service_range_name" {
  description = "The name of the secondary IP range for GKE services"
  value       = google_compute_subnetwork.gke.secondary_ip_range[1].range_name
}

output "db_subnet_id" {
  description = "The ID of the database subnet"
  value       = google_compute_subnetwork.database.id
}

output "db_subnet_name" {
  description = "The name of the database subnet"
  value       = google_compute_subnetwork.database.name
}

output "private_ip_range_name" {
  description = "The name of the private IP range for service networking"
  value       = google_compute_global_address.private_ip_range.name
}

output "router_name" {
  description = "The name of the Cloud Router"
  value       = google_compute_router.main.name
}

output "nat_name" {
  description = "The name of the Cloud NAT"
  value       = google_compute_router_nat.main.name
}
