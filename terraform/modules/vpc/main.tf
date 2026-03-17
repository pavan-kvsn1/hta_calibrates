# VPC Module - Main Configuration
# Creates the Virtual Private Cloud network and subnets

# VPC Network
resource "google_compute_network" "main" {
  name                            = "${var.project_id}-vpc-${var.environment}"
  project                         = var.project_id
  auto_create_subnetworks         = false
  routing_mode                    = "REGIONAL"
  delete_default_routes_on_create = false

  description = "Main VPC for HTA Calibration ${var.environment} environment"
}

# Public Subnet - For load balancers and bastion hosts
resource "google_compute_subnetwork" "public" {
  name                     = "${var.project_id}-public-${var.environment}"
  project                  = var.project_id
  network                  = google_compute_network.main.id
  region                   = var.region
  ip_cidr_range            = var.public_subnet_cidr
  private_ip_google_access = true

  description = "Public subnet for load balancers and ingress"

  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# GKE Subnet - For Kubernetes nodes
resource "google_compute_subnetwork" "gke" {
  name                     = "${var.project_id}-gke-${var.environment}"
  project                  = var.project_id
  network                  = google_compute_network.main.id
  region                   = var.region
  ip_cidr_range            = var.gke_subnet_cidr
  private_ip_google_access = true

  description = "GKE subnet for Kubernetes nodes"

  # Secondary ranges for GKE pods and services
  secondary_ip_range {
    range_name    = "pods"
    ip_cidr_range = var.gke_pod_cidr
  }

  secondary_ip_range {
    range_name    = "services"
    ip_cidr_range = var.gke_service_cidr
  }

  log_config {
    aggregation_interval = "INTERVAL_5_SEC"
    flow_sampling        = 0.5
    metadata             = "INCLUDE_ALL_METADATA"
  }
}

# Database Subnet - For Cloud SQL private IP
resource "google_compute_subnetwork" "database" {
  name                     = "${var.project_id}-db-${var.environment}"
  project                  = var.project_id
  network                  = google_compute_network.main.id
  region                   = var.region
  ip_cidr_range            = var.db_subnet_cidr
  private_ip_google_access = true

  description = "Database subnet for Cloud SQL"
}

# Private Service Connection - Required for Cloud SQL private IP
resource "google_compute_global_address" "private_ip_range" {
  name          = "${var.project_id}-private-ip-${var.environment}"
  project       = var.project_id
  purpose       = "VPC_PEERING"
  address_type  = "INTERNAL"
  prefix_length = 16
  network       = google_compute_network.main.id

  description = "Private IP range for service networking (Cloud SQL)"
}

resource "google_service_networking_connection" "private_vpc_connection" {
  network                 = google_compute_network.main.id
  service                 = "servicenetworking.googleapis.com"
  reserved_peering_ranges = [google_compute_global_address.private_ip_range.name]
}

# Cloud Router - Required for Cloud NAT
resource "google_compute_router" "main" {
  name    = "${var.project_id}-router-${var.environment}"
  project = var.project_id
  network = google_compute_network.main.id
  region  = var.region

  description = "Cloud Router for NAT gateway"
}
