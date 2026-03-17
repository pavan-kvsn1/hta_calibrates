# GKE Module - Main Configuration
# Creates the Google Kubernetes Engine cluster

resource "google_container_cluster" "primary" {
  name     = "${var.project_id}-gke-${var.environment}"
  project  = var.project_id
  location = var.region

  # Use regional cluster for high availability
  # Set to a specific zone for dev to reduce costs
  # location = var.environment == "dev" ? "${var.region}-a" : var.region

  description = "GKE cluster for HTA Calibration ${var.environment}"

  # We can't create a cluster with no node pool defined, but we want to only use
  # separately managed node pools. So we create the smallest possible default
  # node pool and immediately delete it.
  remove_default_node_pool = true
  initial_node_count       = 1

  # Network configuration
  network    = var.vpc_name
  subnetwork = var.gke_subnet_name

  # IP allocation policy for VPC-native cluster
  ip_allocation_policy {
    cluster_secondary_range_name  = var.gke_pod_range_name
    services_secondary_range_name = var.gke_service_range_name
  }

  # Private cluster configuration
  private_cluster_config {
    enable_private_nodes    = true
    enable_private_endpoint = false  # Allow public access to master for now
    master_ipv4_cidr_block  = var.master_ipv4_cidr_block
  }

  # Master authorized networks
  master_authorized_networks_config {
    dynamic "cidr_blocks" {
      for_each = var.master_authorized_networks
      content {
        cidr_block   = cidr_blocks.value.cidr_block
        display_name = cidr_blocks.value.display_name
      }
    }
  }

  # Workload Identity for secure pod-to-GCP authentication
  workload_identity_config {
    workload_pool = "${var.project_id}.svc.id.goog"
  }

  # Release channel for automatic upgrades
  release_channel {
    channel = var.release_channel
  }

  # Cluster addons
  addons_config {
    http_load_balancing {
      disabled = false
    }
    horizontal_pod_autoscaling {
      disabled = false
    }
    network_policy_config {
      disabled = false
    }
    gcp_filestore_csi_driver_config {
      enabled = var.environment == "prod"
    }
    gcs_fuse_csi_driver_config {
      enabled = true
    }
  }

  # Network policy
  network_policy {
    enabled  = true
    provider = "CALICO"
  }

  # Logging and monitoring
  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS"]
    managed_prometheus {
      enabled = var.enable_managed_prometheus
    }
  }

  # Maintenance window
  maintenance_policy {
    recurring_window {
      start_time = "2024-01-01T09:00:00Z"  # 2:30 PM IST
      end_time   = "2024-01-01T17:00:00Z"  # 10:30 PM IST
      recurrence = "FREQ=WEEKLY;BYDAY=SA,SU"
    }
  }

  # Binary Authorization
  binary_authorization {
    evaluation_mode = var.environment == "prod" ? "PROJECT_SINGLETON_POLICY_ENFORCE" : "DISABLED"
  }

  # Security settings
  enable_shielded_nodes = true

  # Cost management
  resource_labels = {
    environment = var.environment
    project     = "hta-calibration"
    managed_by  = "terraform"
  }

  lifecycle {
    ignore_changes = [
      # Ignore changes to node_config as we use separate node pools
      node_config,
    ]
  }

  depends_on = [
    var.vpc_dependency
  ]
}

# Primary Node Pool
resource "google_container_node_pool" "primary" {
  name       = "${var.project_id}-primary-pool"
  project    = var.project_id
  cluster    = google_container_cluster.primary.name
  location   = var.region

  # Node count configuration
  initial_node_count = var.node_count

  # Autoscaling configuration
  autoscaling {
    min_node_count  = var.min_node_count
    max_node_count  = var.max_node_count
    location_policy = "BALANCED"
  }

  # Node management
  management {
    auto_repair  = true
    auto_upgrade = true
  }

  # Upgrade settings
  upgrade_settings {
    max_surge       = 1
    max_unavailable = 0
    strategy        = "SURGE"
  }

  node_config {
    machine_type = var.machine_type
    disk_size_gb = var.disk_size_gb
    disk_type    = "pd-standard"

    # Use Container-Optimized OS
    image_type = "COS_CONTAINERD"

    # OAuth scopes
    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    # Service account
    service_account = var.node_service_account

    # Shielded instance config
    shielded_instance_config {
      enable_secure_boot          = true
      enable_integrity_monitoring = true
    }

    # Workload metadata config for Workload Identity
    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    # Labels
    labels = {
      environment = var.environment
      pool        = "primary"
    }

    # Tags for firewall rules
    tags = ["gke-node", "${var.project_id}-gke-${var.environment}"]

    # Taints (optional, for dedicated workloads)
    # taint {
    #   key    = "dedicated"
    #   value  = "app"
    #   effect = "NO_SCHEDULE"
    # }

    metadata = {
      disable-legacy-endpoints = "true"
    }
  }

  lifecycle {
    ignore_changes = [
      initial_node_count
    ]
  }
}
