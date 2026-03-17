# Phase 3C: DNS, SSL & Domain Configuration

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Last Updated**: 2026-03-17
- **Phase**: 3 - Cloud Infrastructure
- **Status**: Not Started (0%)

---

## Learning Resources

Before configuring DNS and SSL, make sure you understand the underlying concepts:

| Topic | System Design Document | What You'll Learn |
|-------|------------------------|-------------------|
| **DNS & Domains** | [02_web_hosting_domains.md](../../system_design/02_web_hosting_domains.md) | How DNS works, domain registration, DNS records |
| **SSL/TLS Certificates** | [02_web_hosting_domains.md](../../system_design/02_web_hosting_domains.md) | HTTPS, certificate types, SSL termination |
| **GCP Fundamentals** | [06_gcp_fundamentals.md](../../system_design/06_gcp_fundamentals.md) | Cloud DNS, Certificate Manager |
| **Load Balancing** | [08_autoscaling_loadbalancing.md](../../system_design/08_autoscaling_loadbalancing.md) | Where SSL terminates in the stack |
| **Security** | [14_security.md](../../system_design/14_security.md) | TLS best practices, HSTS |

> **Tip**: If terms like "A record", "CNAME", "TTL", or "SSL termination" are unfamiliar, read `02_web_hosting_domains.md` first!

---

## Overview

This document covers the implementation of DNS configuration, SSL certificate management, and domain setup for the HTA Calibration system on GCP.

---

## Domain Architecture

```
+---------------------------------------------------------------------------+
|                         DOMAIN ARCHITECTURE                                 |
+---------------------------------------------------------------------------+
|                                                                             |
|  PRIMARY DOMAIN: hta-calibration.com (example)                              |
|                                                                             |
|  +-----------------------------------------------------------------------+  |
|  |  PRODUCTION DOMAINS                                                   |  |
|  +-----------------------------------------------------------------------+  |
|  |                                                                       |  |
|  |  hta-calibration.com          -> Main application                     |  |
|  |  www.hta-calibration.com      -> Redirect to apex domain              |  |
|  |  api.hta-calibration.com      -> API endpoints (optional)             |  |
|  |  app.hta-calibration.com      -> Application (if separate)            |  |
|  |                                                                       |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
|  +-----------------------------------------------------------------------+  |
|  |  NON-PRODUCTION DOMAINS                                               |  |
|  +-----------------------------------------------------------------------+  |
|  |                                                                       |  |
|  |  staging.hta-calibration.com  -> Staging environment                  |  |
|  |  dev.hta-calibration.com      -> Development environment              |  |
|  |  preview-*.hta-calibration.com -> PR preview deployments              |  |
|  |                                                                       |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
|  +-----------------------------------------------------------------------+  |
|  |  MULTI-TENANT DOMAINS (Future)                                        |  |
|  +-----------------------------------------------------------------------+  |
|  |                                                                       |  |
|  |  {tenant}.hta-calibration.com -> Per-tenant subdomains                |  |
|  |  OR                                                                   |  |
|  |  Custom domains per tenant    -> CNAME to our infrastructure          |  |
|  |                                                                       |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
+---------------------------------------------------------------------------+
```

---

## Cloud DNS Configuration

### Zone Setup

```
+---------------------------------------------------------------------------+
|                         CLOUD DNS ZONES                                     |
+---------------------------------------------------------------------------+
|                                                                             |
|  PUBLIC ZONE                                                                |
|  ===========                                                                |
|                                                                             |
|  Zone Name: hta-calibration-public                                          |
|  DNS Name:  hta-calibration.com                                             |
|  DNSSEC:    Enabled                                                         |
|  Visibility: Public                                                         |
|                                                                             |
|  +-----------------------------------------------------------------------+  |
|  |  RECORD SETS                                                          |  |
|  +-----------------------------------------------------------------------+  |
|  |                                                                       |  |
|  |  Name           Type   TTL    Value                                   |  |
|  |  -------------------------------------------------------------------  |  |
|  |  @              A      300    [Load Balancer IP]                      |  |
|  |  @              AAAA   300    [Load Balancer IPv6] (if enabled)       |  |
|  |  www            CNAME  300    hta-calibration.com.                    |  |
|  |  staging        A      300    [Staging LB IP]                         |  |
|  |  dev            A      300    [Dev LB IP]                             |  |
|  |  *.preview      A      300    [Preview LB IP]                         |  |
|  |                                                                       |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
|  EMAIL RECORDS                                                              |
|  =============                                                              |
|                                                                             |
|  +-----------------------------------------------------------------------+  |
|  |  Name           Type   TTL    Value                                   |  |
|  |  -------------------------------------------------------------------  |  |
|  |  @              MX     3600   10 mail.provider.com.                   |  |
|  |  @              TXT    3600   "v=spf1 include:_spf.google.com ~all"   |  |
|  |  _dmarc         TXT    3600   "v=DMARC1; p=reject; ..."               |  |
|  |  google._domainkey TXT 3600   [DKIM key]                              |  |
|  |                                                                       |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
+---------------------------------------------------------------------------+
```

### Terraform Configuration

```hcl
# terraform/modules/dns/main.tf

resource "google_dns_managed_zone" "primary" {
  name        = "hta-calibration-public"
  dns_name    = "hta-calibration.com."
  description = "HTA Calibration public DNS zone"

  dnssec_config {
    state = "on"
  }

  labels = {
    project     = "hta-calibration"
    environment = "shared"
    managed-by  = "terraform"
  }
}

# Production A record
resource "google_dns_record_set" "production" {
  name         = google_dns_managed_zone.primary.dns_name
  managed_zone = google_dns_managed_zone.primary.name
  type         = "A"
  ttl          = 300
  rrdatas      = [google_compute_global_address.production_lb.address]
}

# WWW CNAME
resource "google_dns_record_set" "www" {
  name         = "www.${google_dns_managed_zone.primary.dns_name}"
  managed_zone = google_dns_managed_zone.primary.name
  type         = "CNAME"
  ttl          = 300
  rrdatas      = [google_dns_managed_zone.primary.dns_name]
}

# Staging A record
resource "google_dns_record_set" "staging" {
  name         = "staging.${google_dns_managed_zone.primary.dns_name}"
  managed_zone = google_dns_managed_zone.primary.name
  type         = "A"
  ttl          = 300
  rrdatas      = [google_compute_global_address.staging_lb.address]
}

# Wildcard for PR previews
resource "google_dns_record_set" "preview_wildcard" {
  name         = "*.preview.${google_dns_managed_zone.primary.dns_name}"
  managed_zone = google_dns_managed_zone.primary.name
  type         = "A"
  ttl          = 300
  rrdatas      = [google_compute_global_address.preview_lb.address]
}
```

---

## SSL Certificate Management

### Certificate Strategy

```
+---------------------------------------------------------------------------+
|                         SSL CERTIFICATE STRATEGY                            |
+---------------------------------------------------------------------------+
|                                                                             |
|  GOOGLE-MANAGED CERTIFICATES (Recommended)                                  |
|  =========================================                                  |
|                                                                             |
|  Advantages:                                                                |
|  - Automatic provisioning                                                   |
|  - Automatic renewal (no expiry concerns)                                   |
|  - No cost                                                                  |
|  - Managed by Google                                                        |
|                                                                             |
|  Limitations:                                                               |
|  - Only works with GCP Load Balancers                                       |
|  - Domain validation only (no EV/OV)                                        |
|  - Limited to specific domain formats                                       |
|                                                                             |
|  +-----------------------------------------------------------------------+  |
|  |  CERTIFICATE CONFIGURATION                                            |  |
|  +-----------------------------------------------------------------------+  |
|  |                                                                       |  |
|  |  Certificate 1: Production                                            |  |
|  |  - hta-calibration.com                                                |  |
|  |  - www.hta-calibration.com                                            |  |
|  |  - api.hta-calibration.com                                            |  |
|  |                                                                       |  |
|  |  Certificate 2: Staging                                               |  |
|  |  - staging.hta-calibration.com                                        |  |
|  |                                                                       |  |
|  |  Certificate 3: Development                                           |  |
|  |  - dev.hta-calibration.com                                            |  |
|  |                                                                       |  |
|  |  Certificate 4: Wildcard Previews                                     |  |
|  |  - *.preview.hta-calibration.com                                      |  |
|  |                                                                       |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
+---------------------------------------------------------------------------+
```

### Terraform SSL Configuration

```hcl
# terraform/modules/ssl/main.tf

# Production certificate
resource "google_compute_managed_ssl_certificate" "production" {
  name = "hta-calibration-prod-cert"

  managed {
    domains = [
      "hta-calibration.com",
      "www.hta-calibration.com",
      "api.hta-calibration.com"
    ]
  }
}

# Staging certificate
resource "google_compute_managed_ssl_certificate" "staging" {
  name = "hta-calibration-staging-cert"

  managed {
    domains = ["staging.hta-calibration.com"]
  }
}

# Certificate Map (for Certificate Manager)
resource "google_certificate_manager_certificate_map" "production" {
  name        = "hta-calibration-cert-map"
  description = "Certificate map for HTA Calibration"

  labels = {
    project     = "hta-calibration"
    environment = "production"
  }
}

resource "google_certificate_manager_certificate_map_entry" "production" {
  name         = "hta-calibration-cert-entry"
  map          = google_certificate_manager_certificate_map.production.name
  certificates = [google_certificate_manager_certificate.production.id]
  hostname     = "hta-calibration.com"
}
```

---

## Load Balancer SSL Integration

```
+---------------------------------------------------------------------------+
|                         SSL TERMINATION ARCHITECTURE                        |
+---------------------------------------------------------------------------+
|                                                                             |
|                            Internet                                         |
|                                |                                            |
|                                | HTTPS (TLS 1.3)                            |
|                                v                                            |
|                    +---------------------+                                  |
|                    |  Cloud Load Balancer |                                 |
|                    |  (SSL Termination)   |                                 |
|                    |                      |                                 |
|                    |  - Managed SSL Cert  |                                 |
|                    |  - TLS 1.2/1.3 only  |                                 |
|                    |  - Modern ciphers    |                                 |
|                    +----------+-----------+                                 |
|                               |                                             |
|                               | HTTP (internal)                             |
|                               v                                             |
|                    +---------------------+                                  |
|                    |    GKE Cluster      |                                  |
|                    |    (Private)        |                                  |
|                    +---------------------+                                  |
|                                                                             |
|  SSL POLICY CONFIGURATION                                                   |
|  ========================                                                   |
|                                                                             |
|  Profile:        MODERN                                                     |
|  Min TLS:        TLS 1.2                                                    |
|  Ciphers:        Google-managed modern cipher suite                         |
|                                                                             |
+---------------------------------------------------------------------------+
```

### Terraform Load Balancer with SSL

```hcl
# terraform/modules/loadbalancer/ssl.tf

# SSL Policy
resource "google_compute_ssl_policy" "modern" {
  name            = "hta-calibration-ssl-policy"
  profile         = "MODERN"
  min_tls_version = "TLS_1_2"
}

# HTTPS Target Proxy
resource "google_compute_target_https_proxy" "production" {
  name             = "hta-calibration-https-proxy"
  url_map          = google_compute_url_map.production.id
  ssl_certificates = [google_compute_managed_ssl_certificate.production.id]
  ssl_policy       = google_compute_ssl_policy.modern.id
}

# HTTP to HTTPS Redirect
resource "google_compute_url_map" "http_redirect" {
  name = "hta-calibration-http-redirect"

  default_url_redirect {
    https_redirect         = true
    redirect_response_code = "MOVED_PERMANENTLY_DEFAULT"
    strip_query            = false
  }
}

resource "google_compute_target_http_proxy" "redirect" {
  name    = "hta-calibration-http-proxy"
  url_map = google_compute_url_map.http_redirect.id
}

# Forwarding Rules
resource "google_compute_global_forwarding_rule" "https" {
  name                  = "hta-calibration-https-rule"
  ip_protocol           = "TCP"
  load_balancing_scheme = "EXTERNAL"
  port_range            = "443"
  target                = google_compute_target_https_proxy.production.id
  ip_address            = google_compute_global_address.production_lb.id
}

resource "google_compute_global_forwarding_rule" "http_redirect" {
  name                  = "hta-calibration-http-rule"
  ip_protocol           = "TCP"
  load_balancing_scheme = "EXTERNAL"
  port_range            = "80"
  target                = google_compute_target_http_proxy.redirect.id
  ip_address            = google_compute_global_address.production_lb.id
}
```

---

## Domain Registration & Transfer

### Domain Registrar Options

```
+---------------------------------------------------------------------------+
|                         DOMAIN REGISTRAR OPTIONS                            |
+---------------------------------------------------------------------------+
|                                                                             |
|  OPTION 1: Google Domains (via Squarespace)                                 |
|  ==========================================                                 |
|                                                                             |
|  Pros:                                                                      |
|  - Seamless Cloud DNS integration                                           |
|  - Simple management in GCP console                                         |
|  - WHOIS privacy included                                                   |
|                                                                             |
|  Cons:                                                                      |
|  - Transferred to Squarespace (Google Domains sunset)                       |
|  - Limited TLD availability                                                 |
|                                                                             |
|  OPTION 2: External Registrar (Namecheap, GoDaddy, etc.)                    |
|  =======================================================                    |
|                                                                             |
|  Pros:                                                                      |
|  - More TLD options                                                         |
|  - Existing relationship                                                    |
|  - Often cheaper                                                            |
|                                                                             |
|  Cons:                                                                      |
|  - Need to configure NS records to point to Cloud DNS                       |
|  - Separate management interface                                            |
|                                                                             |
|  RECOMMENDED APPROACH:                                                      |
|  - Use any registrar for domain registration                                |
|  - Point nameservers to Cloud DNS                                           |
|  - Manage all DNS records in Terraform                                      |
|                                                                             |
+---------------------------------------------------------------------------+
```

### Nameserver Configuration

```
+---------------------------------------------------------------------------+
|                         NAMESERVER SETUP                                    |
+---------------------------------------------------------------------------+
|                                                                             |
|  When using external registrar with Cloud DNS:                              |
|                                                                             |
|  1. Create Cloud DNS zone first (Terraform creates this)                    |
|                                                                             |
|  2. Note the assigned nameservers:                                          |
|     - ns-cloud-a1.googledomains.com                                         |
|     - ns-cloud-a2.googledomains.com                                         |
|     - ns-cloud-a3.googledomains.com                                         |
|     - ns-cloud-a4.googledomains.com                                         |
|                                                                             |
|  3. Update nameservers at your registrar                                    |
|                                                                             |
|  4. Wait for propagation (up to 48 hours, usually faster)                   |
|                                                                             |
|  VERIFICATION:                                                              |
|  $ dig NS hta-calibration.com                                               |
|  $ dig A hta-calibration.com                                                |
|                                                                             |
+---------------------------------------------------------------------------+
```

---

## Multi-Tenant Domain Support

### Subdomain-Based Tenants

```
+---------------------------------------------------------------------------+
|                         MULTI-TENANT DNS                                    |
+---------------------------------------------------------------------------+
|                                                                             |
|  SUBDOMAIN APPROACH                                                         |
|  ==================                                                         |
|                                                                             |
|  Pattern: {tenant-slug}.hta-calibration.com                                 |
|                                                                             |
|  Examples:                                                                  |
|  - acme-labs.hta-calibration.com                                            |
|  - precision-cal.hta-calibration.com                                        |
|  - metrolog.hta-calibration.com                                             |
|                                                                             |
|  DNS Configuration:                                                         |
|  - Wildcard A record: *.hta-calibration.com -> [LB IP]                      |
|  - Application routes based on Host header                                  |
|  - SSL: Wildcard certificate (*.hta-calibration.com)                        |
|                                                                             |
|  +-----------------------------------------------------------------------+  |
|  |  APPLICATION ROUTING                                                  |  |
|  +-----------------------------------------------------------------------+  |
|  |                                                                       |  |
|  |  Request: acme-labs.hta-calibration.com                               |  |
|  |                          |                                            |  |
|  |                          v                                            |  |
|  |  +-------------------+   +-------------------+                        |  |
|  |  | Load Balancer     |-->| Extract subdomain |                        |  |
|  |  +-------------------+   | from Host header  |                        |  |
|  |                          +--------+----------+                        |  |
|  |                                   |                                   |  |
|  |                                   v                                   |  |
|  |                          +-------------------+                        |  |
|  |                          | Lookup tenant by  |                        |  |
|  |                          | slug in database  |                        |  |
|  |                          +--------+----------+                        |  |
|  |                                   |                                   |  |
|  |                                   v                                   |  |
|  |                          +-------------------+                        |  |
|  |                          | Set tenant context|                        |  |
|  |                          | for request       |                        |  |
|  |                          +-------------------+                        |  |
|  |                                                                       |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
+---------------------------------------------------------------------------+
```

### Custom Domain Support (Future)

```
+---------------------------------------------------------------------------+
|                         CUSTOM TENANT DOMAINS                               |
+---------------------------------------------------------------------------+
|                                                                             |
|  Allow tenants to use their own domain:                                     |
|                                                                             |
|  Example: calibration.acme-labs.com -> our infrastructure                   |
|                                                                             |
|  TENANT SETUP REQUIREMENTS:                                                 |
|  1. Tenant adds CNAME: calibration.acme-labs.com -> custom.hta-cal.com      |
|  2. Tenant verifies domain ownership (TXT record)                           |
|  3. We provision SSL certificate for their domain                           |
|                                                                             |
|  IMPLEMENTATION:                                                            |
|  +-----------------------------------------------------------------------+  |
|  |                                                                       |  |
|  |  Database: tenant_domains table                                       |  |
|  |  +-------------------------------------------------------------+     |  |
|  |  | tenant_id | custom_domain           | verified | ssl_status |     |  |
|  |  |-----------|-------------------------|----------|------------|     |  |
|  |  | tenant_1  | calibration.acme.com    | true     | active     |     |  |
|  |  | tenant_2  | cert.precisionlab.com   | true     | active     |     |  |
|  |  +-------------------------------------------------------------+     |  |
|  |                                                                       |  |
|  |  SSL Certificates:                                                    |  |
|  |  - Use Certificate Manager with DNS authorization                     |  |
|  |  - OR use Cert-Manager in Kubernetes with Let's Encrypt               |  |
|  |                                                                       |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
+---------------------------------------------------------------------------+
```

---

## Security Headers

### Application-Level Security Headers

```
+---------------------------------------------------------------------------+
|                         SECURITY HEADERS                                    |
+---------------------------------------------------------------------------+
|                                                                             |
|  Configure in Next.js next.config.js:                                       |
|                                                                             |
|  headers: async () => [                                                     |
|    {                                                                        |
|      source: '/:path*',                                                     |
|      headers: [                                                             |
|        // HSTS - Force HTTPS                                                |
|        {                                                                    |
|          key: 'Strict-Transport-Security',                                  |
|          value: 'max-age=31536000; includeSubDomains; preload'              |
|        },                                                                   |
|        // Prevent clickjacking                                              |
|        {                                                                    |
|          key: 'X-Frame-Options',                                            |
|          value: 'SAMEORIGIN'                                                |
|        },                                                                   |
|        // Prevent MIME sniffing                                             |
|        {                                                                    |
|          key: 'X-Content-Type-Options',                                     |
|          value: 'nosniff'                                                   |
|        },                                                                   |
|        // XSS Protection                                                    |
|        {                                                                    |
|          key: 'X-XSS-Protection',                                           |
|          value: '1; mode=block'                                             |
|        },                                                                   |
|        // Referrer Policy                                                   |
|        {                                                                    |
|          key: 'Referrer-Policy',                                            |
|          value: 'strict-origin-when-cross-origin'                           |
|        },                                                                   |
|        // Permissions Policy                                                |
|        {                                                                    |
|          key: 'Permissions-Policy',                                         |
|          value: 'camera=(), microphone=(), geolocation=()'                  |
|        }                                                                    |
|      ]                                                                      |
|    }                                                                        |
|  ]                                                                          |
|                                                                             |
+---------------------------------------------------------------------------+
```

---

## Implementation Checklist

### Prerequisites
- [ ] Domain registered with a registrar
- [ ] GCP project with Cloud DNS API enabled
- [ ] Billing account linked
- [ ] Terraform state bucket configured

### Phase 1: Cloud DNS Setup
- [ ] Create Cloud DNS managed zone
- [ ] Note assigned nameservers
- [ ] Update nameservers at registrar
- [ ] Verify DNS propagation
- [ ] Enable DNSSEC

### Phase 2: Basic DNS Records
- [ ] Create A record for production
- [ ] Create CNAME for www redirect
- [ ] Create A records for staging/dev
- [ ] Configure email records (MX, SPF, DKIM, DMARC)

### Phase 3: SSL Certificates
- [ ] Create Google-managed SSL certificate
- [ ] Configure SSL policy (MODERN profile)
- [ ] Attach certificate to load balancer
- [ ] Configure HTTP to HTTPS redirect
- [ ] Test SSL configuration (SSL Labs)

### Phase 4: Multi-Tenant Setup
- [ ] Create wildcard DNS record
- [ ] Create wildcard SSL certificate
- [ ] Implement subdomain routing in application
- [ ] Test tenant subdomain access

### Phase 5: Monitoring
- [ ] Set up DNS query logging
- [ ] Configure uptime checks for domains
- [ ] Set up certificate expiry alerts (for any non-managed certs)
- [ ] Monitor DNS propagation for changes

---

## Verification Commands

```bash
# Check DNS propagation
dig A hta-calibration.com
dig CNAME www.hta-calibration.com
dig NS hta-calibration.com

# Check DNS from specific nameserver
dig @ns-cloud-a1.googledomains.com A hta-calibration.com

# Check DNSSEC
dig +dnssec hta-calibration.com

# Test SSL certificate
openssl s_client -connect hta-calibration.com:443 -servername hta-calibration.com

# Check SSL certificate details
echo | openssl s_client -connect hta-calibration.com:443 2>/dev/null | openssl x509 -text

# Test HTTP to HTTPS redirect
curl -I http://hta-calibration.com

# Check security headers
curl -I https://hta-calibration.com
```

---

## Related Documents

- [Overview](./00_scaleup_overview.md)
- [GCP Infrastructure](./04_gcp_infrastructure.md)
- [Terraform IaC](./05_terraform_iac.md)
- [Security Implementation](./09_security_implementation.md)
- [Multi-Tenancy Implementation](./12_multi_tenancy_implementation.md)
