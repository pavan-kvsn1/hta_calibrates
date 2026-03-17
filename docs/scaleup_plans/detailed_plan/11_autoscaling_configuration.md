# Phase 3F: Auto-Scaling & Load Balancing Configuration

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Last Updated**: 2026-03-17
- **Phase**: 3 - Cloud Infrastructure
- **Status**: Not Started (0%)

---

## Learning Resources

Before configuring auto-scaling, make sure you understand the underlying concepts:

| Topic | System Design Document | What You'll Learn |
|-------|------------------------|-------------------|
| **Auto-Scaling Concepts** | [08_autoscaling_loadbalancing.md](../../system_design/08_autoscaling_loadbalancing.md) | HPA, VPA, node auto-provisioning, scaling metrics |
| **Load Balancing** | [08_autoscaling_loadbalancing.md](../../system_design/08_autoscaling_loadbalancing.md) | Load balancer types, algorithms, health checks |
| **Kubernetes** | [07_container_orchestration.md](../../system_design/07_container_orchestration.md) | Pods, Deployments, Services |
| **GKE** | [07_container_orchestration.md](../../system_design/07_container_orchestration.md) | GKE-specific scaling features |

> **Tip**: If terms like "HPA", "target utilization", "scale-down stabilization" are unfamiliar, read `08_autoscaling_loadbalancing.md` first!

---

## Overview

This document covers the implementation of auto-scaling for both application pods (Horizontal Pod Autoscaler) and infrastructure (Cluster Autoscaler, Node Auto-provisioning), along with load balancer configuration for the HTA Calibration system.

---

## Scaling Architecture

```
+---------------------------------------------------------------------------+
|                         SCALING ARCHITECTURE                                |
+---------------------------------------------------------------------------+
|                                                                             |
|                              TRAFFIC                                        |
|                                 |                                           |
|                                 v                                           |
|  +-----------------------------------------------------------------------+  |
|  |  CLOUD LOAD BALANCER                                                  |  |
|  |  - Distributes traffic across healthy pods                            |  |
|  |  - SSL termination                                                    |  |
|  |  - Health checking                                                    |  |
|  +-----------------------------------------------------------------------+  |
|                                 |                                           |
|                                 v                                           |
|  +-----------------------------------------------------------------------+  |
|  |  GKE CLUSTER                                                          |  |
|  |                                                                       |  |
|  |  NODE POOL (Cluster Autoscaler)                                       |  |
|  |  +----------------------------------------------------------------+  |  |
|  |  |  [Node 1]    [Node 2]    [Node 3]    [Node n...]               |  |  |
|  |  |                                                                |  |  |
|  |  |  Scales nodes based on pending pods                            |  |  |
|  |  |  Min: 2, Max: 10                                               |  |  |
|  |  +----------------------------------------------------------------+  |  |
|  |                                                                       |  |
|  |  POD SCALING (HPA)                                                    |  |
|  |  +----------------------------------------------------------------+  |  |
|  |  |                                                                |  |  |
|  |  |  [Pod 1]  [Pod 2]  [Pod 3]  [Pod 4]  [Pod n...]                |  |  |
|  |  |                                                                |  |  |
|  |  |  Scales pods based on CPU/Memory/Custom metrics                |  |  |
|  |  |  Min: 2, Max: 20                                               |  |  |
|  |  |                                                                |  |  |
|  |  +----------------------------------------------------------------+  |  |
|  |                                                                       |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
|  SCALING TRIGGERS:                                                          |
|  - CPU > 70% for 2 min  -> Scale up pods                                    |
|  - CPU < 30% for 5 min  -> Scale down pods                                  |
|  - Pending pods         -> Scale up nodes                                   |
|  - Underutilized nodes  -> Scale down nodes                                 |
|                                                                             |
+---------------------------------------------------------------------------+
```

---

## Horizontal Pod Autoscaler (HPA)

### HPA Configuration

```yaml
# k8s/production/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: hta-web-hpa
  namespace: hta-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: hta-web
  minReplicas: 2
  maxReplicas: 20
  metrics:
    # CPU-based scaling
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70

    # Memory-based scaling
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80

  # Scaling behavior
  behavior:
    scaleDown:
      stabilizationWindowSeconds: 300  # Wait 5 min before scaling down
      policies:
        - type: Percent
          value: 25  # Scale down max 25% at a time
          periodSeconds: 60
        - type: Pods
          value: 2   # Or max 2 pods at a time
          periodSeconds: 60
      selectPolicy: Min  # Use the more conservative policy

    scaleUp:
      stabilizationWindowSeconds: 0  # Scale up immediately
      policies:
        - type: Percent
          value: 100  # Can double pod count
          periodSeconds: 15
        - type: Pods
          value: 4    # Or add up to 4 pods
          periodSeconds: 15
      selectPolicy: Max  # Scale up aggressively
```

### Environment-Specific HPA Settings

```
+---------------------------------------------------------------------------+
|                         HPA SETTINGS BY ENVIRONMENT                         |
+---------------------------------------------------------------------------+
|                                                                             |
|  Environment   Min Pods  Max Pods  CPU Target  Memory Target  Scale-Down   |
|  ---------------------------------------------------------------------------|
|  Development   1         3         80%         85%            60s          |
|  Staging       2         5         75%         80%            120s         |
|  Production    2         20        70%         80%            300s         |
|                                                                             |
|  PRODUCTION RATIONALE:                                                      |
|  - Min 2: Ensures availability during node failures                         |
|  - Max 20: Handles traffic spikes (10x normal)                              |
|  - CPU 70%: Scale before saturation                                         |
|  - 300s stabilization: Prevent thrashing                                    |
|                                                                             |
+---------------------------------------------------------------------------+
```

---

## Vertical Pod Autoscaler (VPA)

### VPA Configuration

```yaml
# k8s/production/vpa.yaml
apiVersion: autoscaling.k8s.io/v1
kind: VerticalPodAutoscaler
metadata:
  name: hta-web-vpa
  namespace: hta-production
spec:
  targetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: hta-web
  updatePolicy:
    updateMode: "Auto"  # Options: Off, Initial, Recreate, Auto
  resourcePolicy:
    containerPolicies:
      - containerName: hta-web
        minAllowed:
          cpu: 100m
          memory: 256Mi
        maxAllowed:
          cpu: 4
          memory: 8Gi
        controlledResources: ["cpu", "memory"]
        controlledValues: RequestsAndLimits
```

### HPA vs VPA Decision Matrix

```
+---------------------------------------------------------------------------+
|                         HPA vs VPA DECISION                                 |
+---------------------------------------------------------------------------+
|                                                                             |
|  USE HPA WHEN:                                                              |
|  - Workload is stateless                                                    |
|  - Application can handle multiple replicas                                 |
|  - Traffic patterns are variable                                            |
|  - You want to handle sudden spikes                                         |
|                                                                             |
|  USE VPA WHEN:                                                              |
|  - Workload is stateful                                                     |
|  - Application doesn't scale horizontally well                              |
|  - You want to optimize resource requests                                   |
|  - Initial resource sizing is uncertain                                     |
|                                                                             |
|  HTA CALIBRATION APPROACH:                                                  |
|  - Use HPA for primary scaling (horizontal)                                 |
|  - Use VPA in "Off" mode for recommendations only                           |
|  - Review VPA recommendations monthly                                       |
|                                                                             |
+---------------------------------------------------------------------------+
```

---

## Cluster Autoscaler

### Node Pool Configuration

```hcl
# terraform/modules/gke/node_pools.tf

resource "google_container_node_pool" "primary" {
  name       = "primary-pool"
  cluster    = google_container_cluster.primary.name
  location   = var.region

  # Auto-scaling configuration
  autoscaling {
    min_node_count = var.min_nodes  # 2 for production
    max_node_count = var.max_nodes  # 10 for production
  }

  # Node management
  management {
    auto_repair  = true
    auto_upgrade = true
  }

  node_config {
    machine_type = var.machine_type  # e2-standard-2
    disk_size_gb = 100
    disk_type    = "pd-ssd"

    # Workload Identity
    workload_metadata_config {
      mode = "GKE_METADATA"
    }

    oauth_scopes = [
      "https://www.googleapis.com/auth/cloud-platform"
    ]

    labels = {
      pool = "primary"
    }

    # Taints (optional)
    # taint {
    #   key    = "dedicated"
    #   value  = "app"
    #   effect = "NO_SCHEDULE"
    # }
  }

  # Upgrade settings
  upgrade_settings {
    max_surge       = 1
    max_unavailable = 0
  }
}

# Spot/Preemptible pool for batch workloads (optional)
resource "google_container_node_pool" "spot" {
  name       = "spot-pool"
  cluster    = google_container_cluster.primary.name
  location   = var.region

  autoscaling {
    min_node_count = 0
    max_node_count = 5
  }

  node_config {
    machine_type = "e2-standard-2"
    spot         = true

    labels = {
      pool = "spot"
    }

    taint {
      key    = "spot"
      value  = "true"
      effect = "NO_SCHEDULE"
    }
  }
}
```

### Cluster Autoscaler Settings

```yaml
# Cluster Autoscaler configuration via GKE
# These are typically set via Terraform or gcloud

# Key settings:
autoscaling_profile: BALANCED  # or OPTIMIZE_UTILIZATION

# Scale-down settings
scale_down_delay_after_add: 10m
scale_down_delay_after_delete: 10s
scale_down_delay_after_failure: 3m
scale_down_unneeded_time: 10m
scale_down_utilization_threshold: 0.5

# Scale-up settings
max_node_provision_time: 15m
```

---

## Load Balancer Configuration

### External Application Load Balancer

```hcl
# terraform/modules/loadbalancer/main.tf

# Reserved global IP
resource "google_compute_global_address" "lb_ip" {
  name = "hta-calibration-lb-ip"
}

# Health check
resource "google_compute_health_check" "http" {
  name               = "hta-calibration-health-check"
  check_interval_sec = 10
  timeout_sec        = 5
  healthy_threshold  = 2
  unhealthy_threshold = 3

  http_health_check {
    port         = 3000
    request_path = "/api/health"
  }
}

# Backend service
resource "google_compute_backend_service" "default" {
  name                  = "hta-calibration-backend"
  protocol              = "HTTP"
  port_name             = "http"
  timeout_sec           = 30
  health_checks         = [google_compute_health_check.http.id]
  load_balancing_scheme = "EXTERNAL"

  # Session affinity (optional)
  session_affinity = "NONE"  # or "CLIENT_IP" if needed

  # Connection draining
  connection_draining_timeout_sec = 300

  # Backend configuration
  backend {
    group           = google_compute_network_endpoint_group.neg.id
    balancing_mode  = "RATE"
    max_rate_per_endpoint = 100
  }

  # CDN configuration
  cdn_policy {
    cache_mode = "USE_ORIGIN_HEADERS"
    default_ttl = 3600
    max_ttl     = 86400

    cache_key_policy {
      include_host         = true
      include_protocol     = true
      include_query_string = true
    }
  }

  # Cloud Armor security policy
  security_policy = google_compute_security_policy.default.id
}

# URL Map
resource "google_compute_url_map" "default" {
  name            = "hta-calibration-url-map"
  default_service = google_compute_backend_service.default.id

  # Path-based routing (if needed)
  host_rule {
    hosts        = ["hta-calibration.com", "www.hta-calibration.com"]
    path_matcher = "main"
  }

  path_matcher {
    name            = "main"
    default_service = google_compute_backend_service.default.id

    # Static files to CDN
    path_rule {
      paths   = ["/_next/static/*", "/images/*", "/fonts/*"]
      service = google_compute_backend_service.static.id
    }

    # API routes
    path_rule {
      paths   = ["/api/*"]
      service = google_compute_backend_service.default.id
    }
  }
}
```

### Health Check Configuration

```
+---------------------------------------------------------------------------+
|                         HEALTH CHECK CONFIGURATION                          |
+---------------------------------------------------------------------------+
|                                                                             |
|  LOAD BALANCER HEALTH CHECK                                                 |
|  ==========================                                                 |
|                                                                             |
|  Endpoint:           /api/health                                            |
|  Protocol:           HTTP                                                   |
|  Port:               3000                                                   |
|  Check Interval:     10 seconds                                             |
|  Timeout:            5 seconds                                              |
|  Healthy Threshold:  2 consecutive successes                                |
|  Unhealthy Threshold: 3 consecutive failures                                |
|                                                                             |
|  KUBERNETES PROBES                                                          |
|  =================                                                          |
|                                                                             |
|  Liveness Probe:                                                            |
|  - Path: /api/health                                                        |
|  - Initial Delay: 30s                                                       |
|  - Period: 10s                                                              |
|  - Failure Threshold: 3                                                     |
|  - Purpose: Restart unhealthy pods                                          |
|                                                                             |
|  Readiness Probe:                                                           |
|  - Path: /api/health/ready                                                  |
|  - Initial Delay: 5s                                                        |
|  - Period: 5s                                                               |
|  - Failure Threshold: 3                                                     |
|  - Purpose: Remove from LB during startup/issues                            |
|                                                                             |
|  Startup Probe:                                                             |
|  - Path: /api/health                                                        |
|  - Period: 5s                                                               |
|  - Failure Threshold: 30 (allows 150s startup)                              |
|  - Purpose: Allow slow startup without killing pod                          |
|                                                                             |
+---------------------------------------------------------------------------+
```

### Kubernetes Probe Configuration

```yaml
# k8s/base/deployments/hta-web-deployment.yaml
spec:
  containers:
    - name: hta-web
      # ... other config

      # Startup probe - allows slow startup
      startupProbe:
        httpGet:
          path: /api/health
          port: 3000
        periodSeconds: 5
        failureThreshold: 30  # 5s * 30 = 150s max startup time

      # Liveness probe - restarts unhealthy pods
      livenessProbe:
        httpGet:
          path: /api/health
          port: 3000
        initialDelaySeconds: 30
        periodSeconds: 10
        timeoutSeconds: 5
        failureThreshold: 3

      # Readiness probe - removes from service during issues
      readinessProbe:
        httpGet:
          path: /api/health/ready
          port: 3000
        initialDelaySeconds: 5
        periodSeconds: 5
        timeoutSeconds: 3
        failureThreshold: 3
```

---

## Scaling Metrics & Monitoring

### Custom Metrics for HPA

```yaml
# Custom metrics using Prometheus Adapter
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: hta-web-hpa-custom
  namespace: hta-production
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: hta-web
  minReplicas: 2
  maxReplicas: 20
  metrics:
    # Standard resource metrics
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70

    # Custom metric: HTTP request rate
    - type: Pods
      pods:
        metric:
          name: http_requests_per_second
        target:
          type: AverageValue
          averageValue: 100  # Scale when > 100 req/s per pod

    # Custom metric: Request latency
    - type: Pods
      pods:
        metric:
          name: http_request_duration_p95
        target:
          type: AverageValue
          averageValue: 500m  # Scale when P95 > 500ms
```

### Scaling Alerts

```yaml
# Cloud Monitoring Alert Policies (via Terraform)

# Alert: Approaching max pods
resource "google_monitoring_alert_policy" "hpa_max_pods" {
  display_name = "HPA approaching max replicas"
  conditions {
    display_name = "Current replicas > 80% of max"
    condition_threshold {
      filter          = "resource.type=\"k8s_pod\" AND metric.type=\"kubernetes.io/autoscaler/hpa/current_replicas\""
      comparison      = "COMPARISON_GT"
      threshold_value = 16  # 80% of 20 max
      duration        = "300s"
    }
  }
  notification_channels = [google_monitoring_notification_channel.email.id]
}

# Alert: Cluster autoscaler unable to scale
resource "google_monitoring_alert_policy" "cluster_autoscaler_error" {
  display_name = "Cluster Autoscaler unable to scale up"
  conditions {
    display_name = "Unschedulable pods"
    condition_threshold {
      filter          = "resource.type=\"k8s_cluster\" AND metric.type=\"kubernetes.io/autoscaler/unschedulable_pods_count\""
      comparison      = "COMPARISON_GT"
      threshold_value = 0
      duration        = "600s"
    }
  }
  notification_channels = [google_monitoring_notification_channel.pagerduty.id]
}
```

---

## Cost Optimization

### Scaling Cost Considerations

```
+---------------------------------------------------------------------------+
|                         COST OPTIMIZATION                                   |
+---------------------------------------------------------------------------+
|                                                                             |
|  STRATEGIES:                                                                |
|                                                                             |
|  1. RIGHT-SIZE MINIMUM PODS                                                 |
|     - Don't over-provision minimum replicas                                 |
|     - 2 pods is usually sufficient for HA                                   |
|                                                                             |
|  2. AGGRESSIVE SCALE-DOWN                                                   |
|     - Use lower thresholds for scale-down                                   |
|     - But with stabilization window to prevent thrashing                    |
|                                                                             |
|  3. SPOT/PREEMPTIBLE NODES                                                  |
|     - Use for non-critical workloads                                        |
|     - Up to 70% cost savings                                                |
|     - Configure tolerations for spot taints                                 |
|                                                                             |
|  4. NODE AUTO-PROVISIONING                                                  |
|     - Let GKE choose optimal machine types                                  |
|     - Can mix machine types based on workload                               |
|                                                                             |
|  5. SCHEDULED SCALING                                                       |
|     - Scale down dev/staging outside business hours                         |
|     - Use CronJobs or KEDA for scheduled scaling                            |
|                                                                             |
|  ESTIMATED MONTHLY COSTS (Production):                                      |
|  - Baseline (2 pods, 2 nodes): ~$150-200                                    |
|  - Peak load (10 pods, 5 nodes): ~$400-500                                  |
|  - Average (accounting for scaling): ~$250-350                              |
|                                                                             |
+---------------------------------------------------------------------------+
```

---

## Implementation Checklist

### Prerequisites
- [ ] GKE cluster deployed
- [ ] Metrics Server enabled
- [ ] Cloud Monitoring configured

### Phase 1: HPA Setup
- [ ] Create HPA manifest
- [ ] Configure CPU-based scaling
- [ ] Configure memory-based scaling
- [ ] Set appropriate min/max replicas
- [ ] Configure scale-down stabilization

### Phase 2: Node Scaling
- [ ] Configure Cluster Autoscaler
- [ ] Set node pool min/max
- [ ] Configure auto-upgrade
- [ ] (Optional) Add spot node pool

### Phase 3: Load Balancer
- [ ] Reserve static IP
- [ ] Configure health checks
- [ ] Set up backend service
- [ ] Configure URL map
- [ ] Enable CDN for static content

### Phase 4: Monitoring
- [ ] Create scaling dashboards
- [ ] Configure scaling alerts
- [ ] Set up cost alerts
- [ ] Document scaling thresholds

### Phase 5: Testing
- [ ] Load test with k6 or Locust
- [ ] Verify scale-up behavior
- [ ] Verify scale-down behavior
- [ ] Test node scaling
- [ ] Document results

---

## Related Documents

- [Overview](./00_scaleup_overview.md)
- [Kubernetes Orchestration](./10_kubernetes_orchestration.md)
- [GCP Infrastructure](./04_gcp_infrastructure.md)
- [Monitoring & Observability](./14_monitoring_observability.md)
