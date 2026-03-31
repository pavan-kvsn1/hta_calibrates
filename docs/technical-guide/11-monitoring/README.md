# 11 - Monitoring & Observability

## Documentation Index

| File | Description | When to Read |
|------|-------------|--------------|
| [01-observability.md](./01-observability.md) | Observability pillars: logs, metrics, traces | Understanding monitoring architecture |
| [02-health-endpoints.md](./02-health-endpoints.md) | Application health checks (/api/health) | Implementing probes, debugging |
| [03-gcp-monitoring.md](./03-gcp-monitoring.md) | GCP Cloud Monitoring & alerting | Setting up production monitoring |
| [04-kubernetes-monitoring.md](./04-kubernetes-monitoring.md) | kubectl commands, pod diagnostics | Debugging K8s deployments |

---

## Quick Reference

### Check Application Health

```bash
# Liveness probe (is app alive?)
curl http://localhost:3000/api/health

# Readiness probe (is app ready for traffic?)
curl http://localhost:3000/api/health/ready

# OpenSign integration health (admin only)
curl -H "Authorization: Bearer $TOKEN" http://localhost:3000/api/opensign/health
```

### Check Kubernetes Pod Health

```bash
# Pod status
kubectl get pods -n hta-calibration

# Pod events
kubectl describe pod hta-web-xxx -n hta-calibration

# Container logs
kubectl logs -f deployment/hta-web -n hta-calibration

# Resource usage
kubectl top pods -n hta-calibration
```

### GCP Monitoring

```bash
# View logs in Cloud Logging
gcloud logging read "resource.type=k8s_container AND resource.labels.namespace_name=hta-calibration" \
  --limit=50 --format="table(timestamp, jsonPayload.message)"

# List alerting policies
gcloud alpha monitoring policies list --project=hta-calibration-prod
```

---

## Monitoring Stack

```
┌─────────────────────────────────────────────────────────────────────┐
│                     MONITORING ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────────┤
│                                                                      │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                        APPLICATION                            │   │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────────────┐   │   │
│  │  │ /api/health│  │/api/health │  │  console.log/error   │   │   │
│  │  │ (liveness) │  │   /ready   │  │   (stdout/stderr)    │   │   │
│  │  └──────┬─────┘  └─────┬──────┘  └──────────┬───────────┘   │   │
│  └─────────┼──────────────┼────────────────────┼────────────────┘   │
│            │              │                    │                     │
│            ▼              ▼                    ▼                     │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                       KUBERNETES                              │   │
│  │  ┌────────────┐  ┌────────────┐  ┌──────────────────────┐   │   │
│  │  │ Liveness   │  │ Readiness  │  │    Container Logs    │   │   │
│  │  │  Probe     │  │   Probe    │  │    (stdout/stderr)   │   │   │
│  │  └──────┬─────┘  └─────┬──────┘  └──────────┬───────────┘   │   │
│  │         │              │                    │                │   │
│  │  ┌──────┴──────────────┴────────────────────┴───────────┐   │   │
│  │  │              GKE Logging & Monitoring                 │   │   │
│  │  │           (Fluentd, Metrics Server)                   │   │   │
│  │  └────────────────────────┬──────────────────────────────┘   │   │
│  └───────────────────────────┼──────────────────────────────────┘   │
│                              │                                       │
│                              ▼                                       │
│  ┌──────────────────────────────────────────────────────────────┐   │
│  │                    GCP CLOUD OPERATIONS                       │   │
│  │  ┌──────────────┐  ┌──────────────┐  ┌──────────────────┐   │   │
│  │  │ Cloud        │  │ Cloud        │  │ Cloud            │   │   │
│  │  │ Logging      │  │ Monitoring   │  │ Trace            │   │   │
│  │  │              │  │ (Prometheus) │  │ (future)         │   │   │
│  │  └──────┬───────┘  └──────┬───────┘  └──────────────────┘   │   │
│  │         │                 │                                  │   │
│  │         ▼                 ▼                                  │   │
│  │  ┌──────────────────────────────────────────────────────┐   │   │
│  │  │                  ALERTING                             │   │   │
│  │  │  Email, PagerDuty, Slack, Webhook                    │   │   │
│  │  └──────────────────────────────────────────────────────┘   │   │
│  └──────────────────────────────────────────────────────────────┘   │
│                                                                      │
└─────────────────────────────────────────────────────────────────────┘
```

---

## Observability Pillars

| Pillar | Tool | Purpose |
|--------|------|---------|
| **Logs** | GCP Cloud Logging | Debug, audit, troubleshoot |
| **Metrics** | GCP Cloud Monitoring | Performance, resource usage |
| **Traces** | (Planned) Cloud Trace | Request flow, latency |
| **Alerts** | GCP Alerting | Incident notification |

---

## Health Endpoint Summary

| Endpoint | Purpose | K8s Probe | Response |
|----------|---------|-----------|----------|
| `/api/health` | Liveness | livenessProbe | `{"status": "healthy"}` |
| `/api/health/ready` | Readiness | readinessProbe | `{"status": "ready", "checks": {...}}` |
| `/api/opensign/health` | Integration | - | OpenSign status + stats |

---

## Key Metrics

### Application Metrics

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| HTTP response time | Cloud Monitoring | p95 > 2s |
| Error rate (5xx) | Cloud Logging | > 1% |
| Active connections | HPA | - |
| Memory usage | Metrics Server | > 80% |
| CPU usage | Metrics Server | > 70% |

### Infrastructure Metrics

| Metric | Source | Alert Threshold |
|--------|--------|-----------------|
| Pod restarts | Kubernetes | > 3/hour |
| Node CPU | GKE | > 85% |
| Node memory | GKE | > 85% |
| PVC usage | GKE | > 80% |
| DB connections | Cloud SQL | > 80% max |

---

## Common Commands

### View Logs

```bash
# Local development
npm run dev 2>&1 | tee app.log

# Kubernetes
kubectl logs -f deployment/hta-web -n hta-calibration

# GCP Cloud Logging
gcloud logging read "resource.type=k8s_container" --limit=100
```

### Check Metrics

```bash
# Kubernetes resource usage
kubectl top pods -n hta-calibration
kubectl top nodes

# HPA status
kubectl get hpa -n hta-calibration
```

### Debug Issues

```bash
# Pod not starting
kubectl describe pod hta-web-xxx -n hta-calibration

# Container crash loop
kubectl logs hta-web-xxx -n hta-calibration --previous

# Network issues
kubectl exec -it hta-web-xxx -n hta-calibration -- curl localhost:3000/api/health
```

---

## Alerting Quick Reference

| Alert | Condition | Action |
|-------|-----------|--------|
| High error rate | > 1% 5xx responses | Check logs, rollback if needed |
| High latency | p95 > 3s | Check DB, scale pods |
| Pod restart loop | > 3 restarts/hr | Check logs, fix issue |
| Memory pressure | > 85% | Scale or optimize |
| DB connection pool | > 80% | Increase pool or optimize |

---

## Related Documentation

- [09-deployment/04-rollback.md](../09-deployment/04-rollback.md) - Incident response
- [12-debugging/README.md](../12-debugging/README.md) - Troubleshooting guide
- [08-kubernetes/README.md](../08-kubernetes/README.md) - K8s configuration
