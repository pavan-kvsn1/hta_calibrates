# Monitoring Module - Main Configuration
# Creates GCP Cloud Monitoring Dashboard and Alert Policies for Cloud Run

locals {
  service_name = "${var.cloud_run_service_name}-${var.environment}"

  # Common filter for Cloud Run metrics
  cloud_run_filter = "resource.type=\"cloud_run_revision\" AND resource.labels.service_name=\"${local.service_name}\""
}

# =============================================================================
# NOTIFICATION CHANNEL
# =============================================================================

resource "google_monitoring_notification_channel" "email" {
  count = var.enable_alerts ? 1 : 0

  project      = var.project_id
  display_name = "HTA Calibration ${title(var.environment)} Alerts"
  type         = "email"

  labels = {
    email_address = var.alert_email
  }

  user_labels = {
    environment = var.environment
    service     = var.cloud_run_service_name
  }
}

# =============================================================================
# MONITORING DASHBOARD
# =============================================================================

resource "google_monitoring_dashboard" "cloud_run" {
  count = var.enable_dashboard ? 1 : 0

  project        = var.project_id
  dashboard_json = jsonencode({
    displayName = "HTA Calibration - ${title(var.environment)}"

    gridLayout = {
      columns = 2
      widgets = [
        # Row 1: Request Rate and Error Rate
        {
          title = "Request Rate (requests/sec)"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"run.googleapis.com/request_count\" AND ${local.cloud_run_filter}"
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_RATE"
                      crossSeriesReducer = "REDUCE_SUM"
                      groupByFields      = ["metric.labels.response_code_class"]
                    }
                  }
                }
                plotType   = "STACKED_AREA"
                legendTemplate = "$${metric.labels.response_code_class}"
              }
            ]
            yAxis = {
              label = "requests/sec"
              scale = "LINEAR"
            }
            chartOptions = {
              mode = "COLOR"
            }
          }
        },
        {
          title = "Error Rate (5xx errors)"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"run.googleapis.com/request_count\" AND ${local.cloud_run_filter} AND metric.labels.response_code_class=\"5xx\""
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_RATE"
                      crossSeriesReducer = "REDUCE_SUM"
                    }
                  }
                }
                plotType = "LINE"
                legendTemplate = "5xx errors"
              }
            ]
            yAxis = {
              label = "errors/sec"
              scale = "LINEAR"
            }
            thresholds = [
              {
                value     = var.error_rate_threshold / 300  # Convert 5min count to per-second
                color     = "RED"
                direction = "ABOVE"
              }
            ]
          }
        },

        # Row 2: Latency
        {
          title = "Response Latency (p50, p95, p99)"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"run.googleapis.com/request_latencies\" AND ${local.cloud_run_filter}"
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_PERCENTILE_50"
                      crossSeriesReducer = "REDUCE_MEAN"
                    }
                  }
                }
                plotType       = "LINE"
                legendTemplate = "p50"
              },
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"run.googleapis.com/request_latencies\" AND ${local.cloud_run_filter}"
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_PERCENTILE_95"
                      crossSeriesReducer = "REDUCE_MEAN"
                    }
                  }
                }
                plotType       = "LINE"
                legendTemplate = "p95"
              },
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"run.googleapis.com/request_latencies\" AND ${local.cloud_run_filter}"
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_PERCENTILE_99"
                      crossSeriesReducer = "REDUCE_MEAN"
                    }
                  }
                }
                plotType       = "LINE"
                legendTemplate = "p99"
              }
            ]
            yAxis = {
              label = "latency (ms)"
              scale = "LINEAR"
            }
            thresholds = [
              {
                value     = var.latency_threshold_ms
                color     = "YELLOW"
                direction = "ABOVE"
              }
            ]
          }
        },
        {
          title = "Container Instances"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"run.googleapis.com/container/instance_count\" AND ${local.cloud_run_filter}"
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_MEAN"
                      crossSeriesReducer = "REDUCE_SUM"
                      groupByFields      = ["metric.labels.state"]
                    }
                  }
                }
                plotType       = "STACKED_AREA"
                legendTemplate = "$${metric.labels.state}"
              }
            ]
            yAxis = {
              label = "instances"
              scale = "LINEAR"
            }
          }
        },

        # Row 3: Resources
        {
          title = "CPU Utilization"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"run.googleapis.com/container/cpu/utilizations\" AND ${local.cloud_run_filter}"
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_PERCENTILE_95"
                      crossSeriesReducer = "REDUCE_MEAN"
                    }
                  }
                }
                plotType       = "LINE"
                legendTemplate = "CPU p95"
              }
            ]
            yAxis = {
              label = "utilization %"
              scale = "LINEAR"
            }
            thresholds = [
              {
                value     = var.cpu_threshold_percent / 100
                color     = "RED"
                direction = "ABOVE"
              }
            ]
          }
        },
        {
          title = "Memory Utilization"
          xyChart = {
            dataSets = [
              {
                timeSeriesQuery = {
                  timeSeriesFilter = {
                    filter = "metric.type=\"run.googleapis.com/container/memory/utilizations\" AND ${local.cloud_run_filter}"
                    aggregation = {
                      alignmentPeriod    = "60s"
                      perSeriesAligner   = "ALIGN_PERCENTILE_95"
                      crossSeriesReducer = "REDUCE_MEAN"
                    }
                  }
                }
                plotType       = "LINE"
                legendTemplate = "Memory p95"
              }
            ]
            yAxis = {
              label = "utilization %"
              scale = "LINEAR"
            }
            thresholds = [
              {
                value     = 0.8
                color     = "YELLOW"
                direction = "ABOVE"
              }
            ]
          }
        }
      ]
    }

    labels = {
      environment = var.environment
    }
  })
}

# =============================================================================
# ALERT POLICIES
# =============================================================================

# Alert 1: High Error Rate (5xx errors)
resource "google_monitoring_alert_policy" "error_rate" {
  count = var.enable_alerts ? 1 : 0

  project      = var.project_id
  display_name = "[${upper(var.environment)}] High Error Rate - ${var.cloud_run_service_name}"
  combiner     = "OR"

  conditions {
    display_name = "5xx error count > ${var.error_rate_threshold} in 5 minutes"

    condition_threshold {
      filter          = "metric.type=\"run.googleapis.com/request_count\" AND ${local.cloud_run_filter} AND metric.labels.response_code_class=\"5xx\""
      duration        = "0s"
      comparison      = "COMPARISON_GT"
      threshold_value = var.error_rate_threshold

      aggregations {
        alignment_period     = "300s"  # 5 minutes
        per_series_aligner   = "ALIGN_SUM"
        cross_series_reducer = "REDUCE_SUM"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email[0].name]

  alert_strategy {
    auto_close = "1800s"  # Auto-close after 30 minutes of no issues
  }

  documentation {
    content   = <<-EOT
      ## High Error Rate Alert

      **Service:** ${local.service_name}
      **Environment:** ${var.environment}
      **Threshold:** More than ${var.error_rate_threshold} 5xx errors in 5 minutes

      ### Investigation Steps
      1. Check Cloud Run logs: `resource.labels.service_name="${local.service_name}" severity>=ERROR`
      2. Check Sentry for error details
      3. Review recent deployments
      4. Check database connectivity

      ### Runbook
      - If errors are widespread: Consider rolling back recent deployment
      - If errors are isolated: Check for specific endpoint issues
    EOT
    mime_type = "text/markdown"
  }

  user_labels = {
    environment = var.environment
    service     = var.cloud_run_service_name
    severity    = "critical"
  }
}

# Alert 2: High Latency (p95)
resource "google_monitoring_alert_policy" "high_latency" {
  count = var.enable_alerts ? 1 : 0

  project      = var.project_id
  display_name = "[${upper(var.environment)}] High Latency - ${var.cloud_run_service_name}"
  combiner     = "OR"

  conditions {
    display_name = "p95 latency > ${var.latency_threshold_ms}ms for 5 minutes"

    condition_threshold {
      filter          = "metric.type=\"run.googleapis.com/request_latencies\" AND ${local.cloud_run_filter}"
      duration        = "300s"  # Must be sustained for 5 minutes
      comparison      = "COMPARISON_GT"
      threshold_value = var.latency_threshold_ms

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_PERCENTILE_95"
        cross_series_reducer = "REDUCE_MEAN"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email[0].name]

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    content   = <<-EOT
      ## High Latency Alert

      **Service:** ${local.service_name}
      **Environment:** ${var.environment}
      **Threshold:** p95 latency > ${var.latency_threshold_ms}ms for 5 minutes

      ### Investigation Steps
      1. Check container CPU/memory utilization
      2. Check database query performance
      3. Check for cold starts (container scaling)
      4. Review slow API endpoints in logs

      ### Runbook
      - If CPU is high: Consider scaling up or optimizing code
      - If cold starts: Increase minimum instances
      - If database: Check slow queries, connection pool
    EOT
    mime_type = "text/markdown"
  }

  user_labels = {
    environment = var.environment
    service     = var.cloud_run_service_name
    severity    = "warning"
  }
}

# Alert 3: High CPU Utilization
resource "google_monitoring_alert_policy" "high_cpu" {
  count = var.enable_alerts ? 1 : 0

  project      = var.project_id
  display_name = "[${upper(var.environment)}] High CPU - ${var.cloud_run_service_name}"
  combiner     = "OR"

  conditions {
    display_name = "CPU utilization > ${var.cpu_threshold_percent}% for 10 minutes"

    condition_threshold {
      filter          = "metric.type=\"run.googleapis.com/container/cpu/utilizations\" AND ${local.cloud_run_filter}"
      duration        = "600s"  # Must be sustained for 10 minutes
      comparison      = "COMPARISON_GT"
      threshold_value = var.cpu_threshold_percent / 100  # Convert to decimal

      aggregations {
        alignment_period     = "60s"
        per_series_aligner   = "ALIGN_PERCENTILE_95"
        cross_series_reducer = "REDUCE_MEAN"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email[0].name]

  alert_strategy {
    auto_close = "1800s"
  }

  documentation {
    content   = <<-EOT
      ## High CPU Utilization Alert

      **Service:** ${local.service_name}
      **Environment:** ${var.environment}
      **Threshold:** CPU > ${var.cpu_threshold_percent}% for 10 minutes

      ### Investigation Steps
      1. Check for CPU-intensive operations (PDF generation, image processing)
      2. Review recent code changes
      3. Check for infinite loops or inefficient algorithms

      ### Runbook
      - If expected load: Consider increasing CPU allocation
      - If unexpected: Profile and optimize hot paths
    EOT
    mime_type = "text/markdown"
  }

  user_labels = {
    environment = var.environment
    service     = var.cloud_run_service_name
    severity    = "warning"
  }
}

# =============================================================================
# DISASTER RECOVERY ALERTS
# =============================================================================

# Alert 4: Cloud SQL Backup Monitoring
resource "google_monitoring_alert_policy" "backup_failure" {
  count = var.enable_backup_alerts && var.enable_alerts && var.cloudsql_instance_name != "" ? 1 : 0

  project      = var.project_id
  display_name = "[${upper(var.environment)}] Database Backup Issue - ${var.cloudsql_instance_name}"
  combiner     = "OR"

  conditions {
    display_name = "Cloud SQL backup not running for ${var.backup_alert_hours} hours"

    condition_threshold {
      filter          = "metric.type=\"cloudsql.googleapis.com/database/up\" AND resource.type=\"cloudsql_database\" AND resource.labels.database_id=\"${var.project_id}:${var.cloudsql_instance_name}\""
      duration        = "0s"
      comparison      = "COMPARISON_LT"
      threshold_value = 1

      aggregations {
        alignment_period     = "300s"
        per_series_aligner   = "ALIGN_MEAN"
        cross_series_reducer = "REDUCE_MEAN"
      }

      trigger {
        count = 1
      }
    }
  }

  notification_channels = [google_monitoring_notification_channel.email[0].name]

  alert_strategy {
    auto_close = "86400s"  # Auto-close after 24 hours
  }

  documentation {
    content   = <<-EOT
      ## Database Backup/Health Alert

      **Instance:** ${var.cloudsql_instance_name}
      **Environment:** ${var.environment}

      ### Investigation Steps
      1. Go to GCP Console → SQL → Select instance → Backups
      2. Check if automated backups are enabled
      3. Review recent backup status (success/failure)
      4. Check Cloud SQL logs for errors

      ### Runbook
      - If backup failed: Check error message, retry manually if needed
      - If instance down: Check Cloud SQL service health
      - If configuration issue: Verify backup window and retention settings
    EOT
    mime_type = "text/markdown"
  }

  user_labels = {
    environment = var.environment
    component   = "database"
    severity    = "critical"
  }
}
