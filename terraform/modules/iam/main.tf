# IAM Module - Main Configuration
# Creates service accounts and IAM bindings

# GKE Node Service Account
resource "google_service_account" "gke_node" {
  account_id   = "gke-node-${var.environment}"
  project      = var.project_id
  display_name = "GKE Node Service Account (${var.environment})"
  description  = "Service account for GKE nodes in ${var.environment} environment"
}

# GKE node minimal permissions
resource "google_project_iam_member" "gke_node_roles" {
  for_each = toset([
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
    "roles/monitoring.viewer",
    "roles/stackdriver.resourceMetadata.writer",
    "roles/artifactregistry.reader",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.gke_node.email}"
}

# Application Service Account (for Workload Identity)
resource "google_service_account" "app" {
  account_id   = "hta-app-${var.environment}"
  project      = var.project_id
  display_name = "HTA Calibration App Service Account (${var.environment})"
  description  = "Service account for HTA Calibration application workloads"
}

# Application permissions
resource "google_project_iam_member" "app_roles" {
  for_each = toset([
    "roles/cloudsql.client",
    "roles/secretmanager.secretAccessor",
    "roles/logging.logWriter",
    "roles/monitoring.metricWriter",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.app.email}"
}

# Storage bucket permissions for app service account
resource "google_storage_bucket_iam_member" "app_certificates" {
  bucket = var.certificates_bucket_name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.app.email}"
}

resource "google_storage_bucket_iam_member" "app_signatures" {
  bucket = var.signatures_bucket_name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.app.email}"
}

resource "google_storage_bucket_iam_member" "app_uploads" {
  bucket = var.uploads_bucket_name
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.app.email}"
}

# Workload Identity binding for Kubernetes
# Only create this after GKE cluster exists (the identity pool is created with the cluster)
resource "google_service_account_iam_member" "app_workload_identity" {
  count = var.create_workload_identity_binding ? 1 : 0

  service_account_id = google_service_account.app.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.k8s_namespace}/hta-app]"
}

# CI/CD Service Account (for GitHub Actions)
resource "google_service_account" "cicd" {
  account_id   = "cicd-${var.environment}"
  project      = var.project_id
  display_name = "CI/CD Service Account (${var.environment})"
  description  = "Service account for CI/CD pipelines"
}

# CI/CD permissions
resource "google_project_iam_member" "cicd_roles" {
  for_each = toset([
    "roles/container.developer",
    "roles/artifactregistry.writer",
    "roles/storage.objectViewer",
  ])

  project = var.project_id
  role    = each.value
  member  = "serviceAccount:${google_service_account.cicd.email}"
}

# Workload Identity for GitHub Actions
resource "google_iam_workload_identity_pool" "github" {
  count = var.enable_github_workload_identity ? 1 : 0

  workload_identity_pool_id = "github-actions"
  project                   = var.project_id
  display_name              = "GitHub Actions"
  description               = "Workload Identity Pool for GitHub Actions"
}

resource "google_iam_workload_identity_pool_provider" "github" {
  count = var.enable_github_workload_identity ? 1 : 0

  workload_identity_pool_id          = google_iam_workload_identity_pool.github[0].workload_identity_pool_id
  workload_identity_pool_provider_id = "github-provider"
  project                            = var.project_id
  display_name                       = "GitHub Actions Provider"

  attribute_mapping = {
    "google.subject"       = "assertion.sub"
    "attribute.actor"      = "assertion.actor"
    "attribute.repository" = "assertion.repository"
  }

  oidc {
    issuer_uri = "https://token.actions.githubusercontent.com"
  }

  attribute_condition = "assertion.repository == '${var.github_repo}'"
}

resource "google_service_account_iam_member" "cicd_workload_identity" {
  count = var.enable_github_workload_identity ? 1 : 0

  service_account_id = google_service_account.cicd.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "principalSet://iam.googleapis.com/${google_iam_workload_identity_pool.github[0].name}/attribute.repository/${var.github_repo}"
}
