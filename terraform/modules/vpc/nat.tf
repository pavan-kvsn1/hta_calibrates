# VPC Module - Cloud NAT Configuration
# Provides outbound internet access for private GKE nodes

resource "google_compute_router_nat" "main" {
  name    = "${var.project_id}-nat-${var.environment}"
  project = var.project_id
  router  = google_compute_router.main.name
  region  = var.region

  # Automatically allocate external IPs
  nat_ip_allocate_option             = "AUTO_ONLY"
  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"

  # Only NAT traffic from GKE subnet
  subnetwork {
    name                    = google_compute_subnetwork.gke.id
    source_ip_ranges_to_nat = ["ALL_IP_RANGES"]
  }

  # Logging configuration
  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }

  # Timeouts
  min_ports_per_vm                    = 64
  max_ports_per_vm                    = 65536
  enable_endpoint_independent_mapping = false

  # TCP/UDP timeouts
  tcp_established_idle_timeout_sec = 1200
  tcp_transitory_idle_timeout_sec  = 30
  udp_idle_timeout_sec             = 30
}
