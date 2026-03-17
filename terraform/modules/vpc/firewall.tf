# VPC Module - Firewall Rules
# Defines network security rules for the VPC

# Allow internal communication within VPC
resource "google_compute_firewall" "allow_internal" {
  name    = "${var.project_id}-allow-internal-${var.environment}"
  project = var.project_id
  network = google_compute_network.main.name

  description = "Allow internal communication within VPC"
  direction   = "INGRESS"
  priority    = 1000

  allow {
    protocol = "tcp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "udp"
    ports    = ["0-65535"]
  }

  allow {
    protocol = "icmp"
  }

  source_ranges = [
    var.gke_subnet_cidr,
    var.gke_pod_cidr,
    var.gke_service_cidr,
    var.db_subnet_cidr
  ]
}

# Allow health checks from Google Cloud
resource "google_compute_firewall" "allow_health_check" {
  name    = "${var.project_id}-allow-health-check-${var.environment}"
  project = var.project_id
  network = google_compute_network.main.name

  description = "Allow health checks from Google Cloud Load Balancer"
  direction   = "INGRESS"
  priority    = 1000

  allow {
    protocol = "tcp"
    ports    = ["80", "443", "8080"]
  }

  # Google Cloud health check IP ranges
  source_ranges = [
    "35.191.0.0/16",
    "130.211.0.0/22"
  ]

  target_tags = ["gke-node", "web"]
}

# Allow SSH from IAP for secure access
resource "google_compute_firewall" "allow_iap_ssh" {
  name    = "${var.project_id}-allow-iap-ssh-${var.environment}"
  project = var.project_id
  network = google_compute_network.main.name

  description = "Allow SSH through Identity-Aware Proxy"
  direction   = "INGRESS"
  priority    = 1000

  allow {
    protocol = "tcp"
    ports    = ["22"]
  }

  # IAP IP range
  source_ranges = ["35.235.240.0/20"]

  target_tags = ["allow-ssh"]
}

# Deny all other ingress by default (implicit, but explicit for clarity)
resource "google_compute_firewall" "deny_all_ingress" {
  name    = "${var.project_id}-deny-all-ingress-${var.environment}"
  project = var.project_id
  network = google_compute_network.main.name

  description = "Deny all ingress traffic by default"
  direction   = "INGRESS"
  priority    = 65534

  deny {
    protocol = "all"
  }

  source_ranges = ["0.0.0.0/0"]
}

# Allow GKE master to node communication
resource "google_compute_firewall" "allow_gke_master" {
  name    = "${var.project_id}-allow-gke-master-${var.environment}"
  project = var.project_id
  network = google_compute_network.main.name

  description = "Allow GKE master to communicate with nodes"
  direction   = "INGRESS"
  priority    = 1000

  allow {
    protocol = "tcp"
    ports    = ["443", "10250", "10255"]
  }

  # Will be set by GKE cluster creation
  source_ranges = var.gke_master_cidr != "" ? [var.gke_master_cidr] : []

  target_tags = ["gke-node"]
}

# Allow outbound traffic (egress) - default allow
resource "google_compute_firewall" "allow_egress" {
  name    = "${var.project_id}-allow-egress-${var.environment}"
  project = var.project_id
  network = google_compute_network.main.name

  description = "Allow all egress traffic"
  direction   = "EGRESS"
  priority    = 1000

  allow {
    protocol = "all"
  }

  destination_ranges = ["0.0.0.0/0"]
}
