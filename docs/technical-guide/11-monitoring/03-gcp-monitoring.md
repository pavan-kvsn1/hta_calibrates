# GCP Cloud Monitoring

## Overview

GCP Cloud Operations Suite (formerly Stackdriver) provides integrated monitoring, logging, and alerting.

```
┌─────────────────────────────────────────────────────────────────┐
│                 GCP CLOUD OPERATIONS SUITE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                   Cloud Logging                           │   │
│  │  - Container logs (stdout/stderr)                        │   │
│  │  - GKE system logs                                       │   │
│  │  - Cloud SQL logs                                        │   │
│  │  - Load balancer logs                                    │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                  Cloud Monitoring                         │   │
│  │  - GKE metrics                                           │   │
│  │  - Cloud SQL metrics                                     │   │
│  │  - Custom metrics (via Prometheus)                       │   │
│  │  - Log-based metrics                                     │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │                    Alerting                               │   │
│  │  - Metric thresholds                                     │   │
│  │  - Log-based alerts                                      │   │
│  │  - Uptime checks                                         │   │
│  └────────────────────────┬─────────────────────────────────┘   │
│                           │                                      │
│                           ▼                                      │
│  ┌──────────────────────────────────────────────────────────┐   │
│  │              Notification Channels                        │   │
│  │  Email, Slack, PagerDuty, Webhook                        │   │
│  └──────────────────────────────────────────────────────────┘   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## GKE Logging Configuration

### Terraform Setup

```hcl
# terraform/modules/gke/main.tf

resource "google_container_cluster" "primary" {
  # ...

  # Logging configuration
  logging_config {
    enable_components = ["SYSTEM_COMPONENTS", "WORKLOADS"]
  }

  # Monitoring configuration
  monitoring_config {
    enable_components = ["SYSTEM_COMPONENTS"]
    managed_prometheus {
      enabled = var.enable_managed_prometheus
    }
  }
}
```

### What Gets Logged

| Component | Log Type | Retention |
|-----------|----------|-----------|
| SYSTEM_COMPONENTS | kube-system pods | 30 days |
| WORKLOADS | All pod stdout/stderr | 30 days |

---

## Cloud Logging

### Viewing Logs in Console

1. Go to **Cloud Logging** > **Logs Explorer**
2. Use these filters:

```
# All HTA Calibration logs
resource.type="k8s_container"
resource.labels.namespace_name="hta-calibration"

# Errors only
resource.type="k8s_container"
resource.labels.namespace_name="hta-calibration"
severity>=ERROR

# Specific pod
resource.type="k8s_container"
resource.labels.namespace_name="hta-calibration"
resource.labels.pod_name=~"hta-web-.*"

# By log content
resource.type="k8s_container"
resource.labels.namespace_name="hta-calibration"
jsonPayload.message=~"certificate"
```

### Using gcloud CLI

```bash
# Recent logs (last 10 minutes)
gcloud logging read \
  "resource.type=k8s_container AND resource.labels.namespace_name=hta-calibration AND timestamp>=$(date -u -d '10 minutes ago' +%Y-%m-%dT%H:%M:%SZ)" \
  --limit=50 \
  --format="table(timestamp, jsonPayload.message)"

# Errors only
gcloud logging read \
  "resource.type=k8s_container AND resource.labels.namespace_name=hta-calibration AND severity>=ERROR" \
  --limit=20

# Stream logs (like tail -f)
gcloud logging tail \
  "resource.type=k8s_container AND resource.labels.namespace_name=hta-calibration" \
  --format="table(timestamp, jsonPayload.message)"
```

### Log-Based Metrics

Create metrics from log patterns:

```bash
# Create metric for HTTP 500 errors
gcloud logging metrics create http-500-errors \
  --description="Count of HTTP 500 errors" \
  --log-filter='
    resource.type="k8s_container"
    resource.labels.namespace_name="hta-calibration"
    jsonPayload.status="500"
  '

# Create metric for slow requests (>2s)
gcloud logging metrics create slow-requests \
  --description="Requests taking more than 2 seconds" \
  --log-filter='
    resource.type="k8s_container"
    resource.labels.namespace_name="hta-calibration"
    jsonPayload.duration>2000
  '
```

---

## Cloud Monitoring

### Key Metrics to Monitor

#### GKE Metrics

| Metric | Path | Alert Condition |
|--------|------|-----------------|
| Pod CPU | `kubernetes.io/container/cpu/core_usage_time` | > 80% sustained |
| Pod Memory | `kubernetes.io/container/memory/used_bytes` | > 80% limit |
| Pod Restarts | `kubernetes.io/pod/restart_count` | > 3 in 1 hour |
| Node CPU | `kubernetes.io/node/cpu/total_usage` | > 85% |
| Node Memory | `kubernetes.io/node/memory/used_bytes` | > 85% |

#### Cloud SQL Metrics

| Metric | Path | Alert Condition |
|--------|------|-----------------|
| Connections | `cloudsql.googleapis.com/database/postgresql/num_backends` | > 80% max |
| CPU | `cloudsql.googleapis.com/database/cpu/utilization` | > 80% |
| Memory | `cloudsql.googleapis.com/database/memory/utilization` | > 80% |
| Disk | `cloudsql.googleapis.com/database/disk/bytes_used` | > 80% capacity |
| Replication Lag | `cloudsql.googleapis.com/database/replication/replica_lag` | > 1 second |

### Managed Prometheus

When enabled, GKE collects Prometheus metrics automatically:

```hcl
# terraform/modules/gke/main.tf
monitoring_config {
  managed_prometheus {
    enabled = true
  }
}
```

Query metrics in Cloud Monitoring with PromQL:

```promql
# Pod CPU usage
rate(container_cpu_usage_seconds_total{namespace="hta-calibration"}[5m])

# Pod memory usage
container_memory_working_set_bytes{namespace="hta-calibration"}

# HTTP request rate (if exposed)
rate(http_requests_total{namespace="hta-calibration"}[5m])
```

---

## Alerting Policies

### Create Alert via Console

1. **Cloud Monitoring** > **Alerting** > **Create Policy**
2. Select metric
3. Configure threshold
4. Add notification channel

### Create Alert via gcloud

```bash
# High error rate alert
gcloud alpha monitoring policies create \
  --display-name="HTA High Error Rate" \
  --condition-display-name="Error rate > 1%" \
  --condition-filter='
    resource.type="k8s_container" AND
    metric.type="logging.googleapis.com/user/http-500-errors"
  ' \
  --condition-threshold-value=10 \
  --condition-threshold-comparison=COMPARISON_GT \
  --condition-threshold-duration=300s \
  --notification-channels=projects/YOUR_PROJECT/notificationChannels/YOUR_CHANNEL \
  --combiner=OR
```

### Recommended Alerts

#### Critical (Page On-Call)

```yaml
High Error Rate:
  metric: logging.googleapis.com/user/http-500-errors
  threshold: > 10 errors in 5 minutes
  action: Page on-call, check logs, prepare rollback

Pod Crash Loop:
  metric: kubernetes.io/pod/restart_count
  threshold: > 5 restarts in 1 hour
  action: Investigate logs, check for OOM

Database Down:
  metric: cloudsql.googleapis.com/database/up
  threshold: 0 for 1 minute
  action: Check Cloud SQL status, check network

Site Down:
  type: Uptime check
  url: https://hta-calibration.example.com/api/health
  threshold: Fails 3 consecutive checks
  action: Check all systems, prepare incident response
```

#### High Priority (Within 1 Hour)

```yaml
High CPU Usage:
  metric: kubernetes.io/container/cpu/core_usage_time
  threshold: > 80% for 10 minutes
  action: Scale pods or optimize code

High Memory Usage:
  metric: kubernetes.io/container/memory/used_bytes
  threshold: > 80% limit for 10 minutes
  action: Check for memory leaks, scale pods

Database Connection Pool:
  metric: cloudsql.googleapis.com/database/postgresql/num_backends
  threshold: > 80% max connections
  action: Optimize queries, increase pool
```

#### Medium Priority (Within 4 Hours)

```yaml
Elevated Latency:
  metric: Response time (custom metric)
  threshold: p95 > 2 seconds
  action: Check database, optimize queries

Certificate Backlog:
  metric: Custom (certificates in DRAFT > 24 hours)
  threshold: > 10 certificates
  action: Notify operations team
```

---

## Notification Channels

### Setup Email

```bash
gcloud alpha monitoring channels create \
  --display-name="On-Call Email" \
  --type=email \
  --channel-labels=email_address=oncall@htaipl.com
```

### Setup Slack

1. Create Slack webhook in Slack App settings
2. Add to GCP:

```bash
gcloud alpha monitoring channels create \
  --display-name="Slack Alerts" \
  --type=slack \
  --channel-labels=channel_name=#alerts \
  --user-labels=auth_token=xoxb-YOUR-TOKEN
```

### Setup PagerDuty

```bash
gcloud alpha monitoring channels create \
  --display-name="PagerDuty" \
  --type=pagerduty \
  --channel-labels=service_key=YOUR_PAGERDUTY_KEY
```

---

## Uptime Checks

### Create Uptime Check

```bash
# Check health endpoint
gcloud monitoring uptime create hta-health-check \
  --display-name="HTA Health Check" \
  --http-check-path="/api/health" \
  --http-check-host="hta-calibration.example.com" \
  --protocol=HTTPS \
  --period=60s \
  --timeout=10s \
  --regions=ASIA_PACIFIC,EUROPE,USA
```

### Alert on Uptime Failure

```bash
gcloud alpha monitoring policies create \
  --display-name="Site Down Alert" \
  --condition-display-name="Health check failing" \
  --condition-filter='
    resource.type="uptime_url" AND
    metric.type="monitoring.googleapis.com/uptime_check/check_passed"
  ' \
  --condition-threshold-value=0 \
  --condition-threshold-comparison=COMPARISON_EQ \
  --condition-threshold-duration=180s \
  --notification-channels=YOUR_CHANNEL_ID \
  --combiner=OR
```

---

## Dashboards

### Create Custom Dashboard

```bash
gcloud monitoring dashboards create --config-from-file=dashboard.json
```

### Example Dashboard Config

```json
{
  "displayName": "HTA Calibration Overview",
  "gridLayout": {
    "columns": 2,
    "widgets": [
      {
        "title": "Pod CPU Usage",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\"k8s_container\" AND resource.labels.namespace_name=\"hta-calibration\" AND metric.type=\"kubernetes.io/container/cpu/core_usage_time\"",
                "aggregation": {
                  "perSeriesAligner": "ALIGN_RATE"
                }
              }
            }
          }]
        }
      },
      {
        "title": "Pod Memory Usage",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\"k8s_container\" AND resource.labels.namespace_name=\"hta-calibration\" AND metric.type=\"kubernetes.io/container/memory/used_bytes\""
              }
            }
          }]
        }
      },
      {
        "title": "Error Count",
        "scorecard": {
          "timeSeriesQuery": {
            "timeSeriesFilter": {
              "filter": "metric.type=\"logging.googleapis.com/user/http-500-errors\""
            }
          }
        }
      },
      {
        "title": "Database Connections",
        "xyChart": {
          "dataSets": [{
            "timeSeriesQuery": {
              "timeSeriesFilter": {
                "filter": "resource.type=\"cloudsql_database\" AND metric.type=\"cloudsql.googleapis.com/database/postgresql/num_backends\""
              }
            }
          }]
        }
      }
    ]
  }
}
```

---

## Cost Considerations

### Log Storage Costs

| Tier | Cost | Retention |
|------|------|-----------|
| First 50 GB/month | Free | 30 days |
| Additional ingestion | ~$0.50/GB | 30 days |
| Extended retention | ~$0.01/GB/month | Custom |

### Reduce Log Costs

```bash
# Create exclusion filter for noisy logs
gcloud logging sinks create exclude-debug \
  --log-filter='severity<INFO' \
  --disabled

# Route logs to cheaper storage (GCS)
gcloud logging sinks create archive-to-gcs \
  --log-filter='timestamp<"$YESTERDAY"' \
  --destination=storage.googleapis.com/hta-logs-archive
```

### Monitoring Costs

| Service | Cost |
|---------|------|
| Cloud Monitoring | Free for GCP metrics |
| Custom metrics | ~$0.50/metric/month |
| Uptime checks | Free (up to 100) |
| Alerting | Free |

---

## Incident Response Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│                    INCIDENT RESPONSE FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌────────────┐                                                 │
│  │   Alert    │                                                 │
│  │  Triggers  │                                                 │
│  └─────┬──────┘                                                 │
│        │                                                         │
│        ▼                                                         │
│  ┌────────────────────────────────────────┐                     │
│  │  1. ACKNOWLEDGE                         │                     │
│  │  - Click "Acknowledge" in PagerDuty    │                     │
│  │  - Post in #incidents Slack channel    │                     │
│  └─────────────────┬──────────────────────┘                     │
│                    │                                             │
│                    ▼                                             │
│  ┌────────────────────────────────────────┐                     │
│  │  2. ASSESS                              │                     │
│  │  - Check Cloud Logging for errors      │                     │
│  │  - Check Cloud Monitoring dashboards   │                     │
│  │  - Check kubectl pod status            │                     │
│  └─────────────────┬──────────────────────┘                     │
│                    │                                             │
│                    ▼                                             │
│  ┌────────────────────────────────────────┐                     │
│  │  3. MITIGATE                            │                     │
│  │  - If bad deploy: Rollback             │                     │
│  │  - If capacity: Scale up               │                     │
│  │  - If external: Update status page     │                     │
│  └─────────────────┬──────────────────────┘                     │
│                    │                                             │
│                    ▼                                             │
│  ┌────────────────────────────────────────┐                     │
│  │  4. RESOLVE                             │                     │
│  │  - Verify system stable                │                     │
│  │  - Close alert                         │                     │
│  │  - Schedule postmortem                 │                     │
│  └────────────────────────────────────────┘                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Quick Reference Commands

```bash
# View recent logs
gcloud logging read "resource.type=k8s_container AND resource.labels.namespace_name=hta-calibration" --limit=50

# List alert policies
gcloud alpha monitoring policies list

# Describe specific policy
gcloud alpha monitoring policies describe POLICY_ID

# List notification channels
gcloud alpha monitoring channels list

# Check uptime status
gcloud monitoring uptime list-configs
```
