# Secrets Module - Main Configuration
# Creates Secret Manager secrets for the application

# NextAuth Secret
resource "google_secret_manager_secret" "nextauth_secret" {
  secret_id = "${var.project_id}-nextauth-secret-${var.environment}"
  project   = var.project_id

  labels = {
    environment = var.environment
    managed_by  = "terraform"
    app         = "hta-calibration"
  }

  replication {
    auto {}
  }
}

# Generate a random NextAuth secret if not provided
resource "random_password" "nextauth_secret" {
  length  = 64
  special = false
}

resource "google_secret_manager_secret_version" "nextauth_secret" {
  secret      = google_secret_manager_secret.nextauth_secret.id
  secret_data = var.nextauth_secret != "" ? var.nextauth_secret : random_password.nextauth_secret.result
}

# NextAuth URL
resource "google_secret_manager_secret" "nextauth_url" {
  secret_id = "${var.project_id}-nextauth-url-${var.environment}"
  project   = var.project_id

  labels = {
    environment = var.environment
    managed_by  = "terraform"
    app         = "hta-calibration"
  }

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "nextauth_url" {
  secret      = google_secret_manager_secret.nextauth_url.id
  secret_data = var.nextauth_url
}

# Email Configuration (SMTP)
resource "google_secret_manager_secret" "smtp_password" {
  count = var.smtp_password != "" ? 1 : 0

  secret_id = "${var.project_id}-smtp-password-${var.environment}"
  project   = var.project_id

  labels = {
    environment = var.environment
    managed_by  = "terraform"
    app         = "hta-calibration"
  }

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "smtp_password" {
  count = var.smtp_password != "" ? 1 : 0

  secret      = google_secret_manager_secret.smtp_password[0].id
  secret_data = var.smtp_password
}

# OAuth Google Client Secret (if using Google OAuth)
resource "google_secret_manager_secret" "google_client_secret" {
  count = var.google_client_secret != "" ? 1 : 0

  secret_id = "${var.project_id}-google-client-secret-${var.environment}"
  project   = var.project_id

  labels = {
    environment = var.environment
    managed_by  = "terraform"
    app         = "hta-calibration"
  }

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "google_client_secret" {
  count = var.google_client_secret != "" ? 1 : 0

  secret      = google_secret_manager_secret.google_client_secret[0].id
  secret_data = var.google_client_secret
}

# Application secrets can be added here as needed
# This allows for dynamic secret creation based on application requirements

# Secret for PDF signing key (if using signed PDFs)
resource "google_secret_manager_secret" "pdf_signing_key" {
  count = var.create_pdf_signing_key ? 1 : 0

  secret_id = "${var.project_id}-pdf-signing-key-${var.environment}"
  project   = var.project_id

  labels = {
    environment = var.environment
    managed_by  = "terraform"
    app         = "hta-calibration"
  }

  replication {
    auto {}
  }
}

# Grant access to the app service account
resource "google_secret_manager_secret_iam_member" "nextauth_secret_access" {
  secret_id = google_secret_manager_secret.nextauth_secret.secret_id
  project   = var.project_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.app_service_account_email}"
}

resource "google_secret_manager_secret_iam_member" "nextauth_url_access" {
  secret_id = google_secret_manager_secret.nextauth_url.secret_id
  project   = var.project_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.app_service_account_email}"
}

resource "google_secret_manager_secret_iam_member" "smtp_password_access" {
  count = var.smtp_password != "" ? 1 : 0

  secret_id = google_secret_manager_secret.smtp_password[0].secret_id
  project   = var.project_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.app_service_account_email}"
}

resource "google_secret_manager_secret_iam_member" "google_client_secret_access" {
  count = var.google_client_secret != "" ? 1 : 0

  secret_id = google_secret_manager_secret.google_client_secret[0].secret_id
  project   = var.project_id
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.app_service_account_email}"
}
