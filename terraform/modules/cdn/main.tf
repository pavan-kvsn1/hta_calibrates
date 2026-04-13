# CDN Module - Cloud CDN Configuration
# Enables edge caching for static assets via GCS backend bucket

# Reserve a global IP address for the CDN
resource "google_compute_global_address" "cdn" {
  name        = "hta-cdn-ip-${var.environment}"
  project     = var.project_id
  description = "Global IP for CDN load balancer"
}

# Backend bucket with CDN enabled
resource "google_compute_backend_bucket" "static_cdn" {
  name        = "hta-static-cdn-${var.environment}"
  project     = var.project_id
  bucket_name = var.static_bucket_name
  enable_cdn  = true

  cdn_policy {
    # Cache all static content
    cache_mode = "CACHE_ALL_STATIC"

    # Default TTL: 1 hour for dynamic content
    default_ttl = 3600

    # Max TTL: 1 day
    max_ttl = 86400

    # Client TTL: 1 hour
    client_ttl = 3600

    # Enable negative caching (cache 404s briefly)
    negative_caching = true
    negative_caching_policy {
      code = 404
      ttl  = 60  # Cache 404s for 1 minute
    }

    # Serve stale content while revalidating
    serve_while_stale = 86400  # 1 day

    # Cache key policy
    cache_key_policy {
      include_host         = true
      include_protocol     = true
      include_query_string = false  # Ignore query strings for caching
    }

    # Request coalescing - reduce origin load
    request_coalescing = true
  }

  description = "CDN backend for static assets"
}

# URL map for routing
resource "google_compute_url_map" "cdn" {
  name            = "hta-cdn-url-map-${var.environment}"
  project         = var.project_id
  default_service = google_compute_backend_bucket.static_cdn.id

  description = "URL map for CDN"

  # Host rules for custom domain (optional)
  dynamic "host_rule" {
    for_each = var.cdn_domain != "" ? [1] : []
    content {
      hosts        = [var.cdn_domain]
      path_matcher = "static"
    }
  }

  dynamic "path_matcher" {
    for_each = var.cdn_domain != "" ? [1] : []
    content {
      name            = "static"
      default_service = google_compute_backend_bucket.static_cdn.id
    }
  }
}

# HTTPS proxy (requires SSL certificate)
resource "google_compute_target_https_proxy" "cdn" {
  count   = var.ssl_certificate_id != "" ? 1 : 0
  name    = "hta-cdn-https-proxy-${var.environment}"
  project = var.project_id
  url_map = google_compute_url_map.cdn.id

  ssl_certificates = [var.ssl_certificate_id]
}

# HTTP proxy (for redirect to HTTPS or direct HTTP)
resource "google_compute_target_http_proxy" "cdn" {
  name    = "hta-cdn-http-proxy-${var.environment}"
  project = var.project_id
  url_map = google_compute_url_map.cdn.id
}

# Global forwarding rule for HTTPS
resource "google_compute_global_forwarding_rule" "cdn_https" {
  count      = var.ssl_certificate_id != "" ? 1 : 0
  name       = "hta-cdn-https-rule-${var.environment}"
  project    = var.project_id
  target     = google_compute_target_https_proxy.cdn[0].id
  port_range = "443"
  ip_address = google_compute_global_address.cdn.address

  load_balancing_scheme = "EXTERNAL"
}

# Global forwarding rule for HTTP (redirect or direct access)
resource "google_compute_global_forwarding_rule" "cdn_http" {
  name       = "hta-cdn-http-rule-${var.environment}"
  project    = var.project_id
  target     = google_compute_target_http_proxy.cdn.id
  port_range = "80"
  ip_address = google_compute_global_address.cdn.address

  load_balancing_scheme = "EXTERNAL"
}

# Optional: Managed SSL certificate for custom domain
resource "google_compute_managed_ssl_certificate" "cdn" {
  count   = var.cdn_domain != "" && var.create_ssl_certificate ? 1 : 0
  name    = "hta-cdn-cert-${var.environment}"
  project = var.project_id

  managed {
    domains = [var.cdn_domain]
  }
}
