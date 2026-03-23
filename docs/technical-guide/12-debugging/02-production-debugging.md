# Production Debugging

## Overview

This guide covers debugging issues in the production GKE environment.

---

## Access Methods

### GKE Cluster Access

```bash
# Get cluster credentials
gcloud container clusters get-credentials hta-calibration-gke-dev \
  --region asia-south1 \
  --project hta-calibration-prod

# Verify access
kubectl get nodes
kubectl get pods -n hta-calibration
```

### GCP Console

Access via: https://console.cloud.google.com/kubernetes/workload

Quick links:
- **GKE Workloads**: View deployments, pods
- **Cloud Logging**: Application logs
- **Cloud SQL**: Database instances
- **Cloud Storage**: Buckets

---

## Log Analysis

### Kubernetes Logs

```bash
# Current pod logs
kubectl logs deployment/hta-web -n hta-calibration

# Follow logs in real-time
kubectl logs -f deployment/hta-web -n hta-calibration

# Logs from crashed container
kubectl logs POD_NAME -n hta-calibration --previous

# Logs with timestamps
kubectl logs deployment/hta-web -n hta-calibration --timestamps

# Last N lines
kubectl logs deployment/hta-web -n hta-calibration --tail=100

# Logs since time
kubectl logs deployment/hta-web -n hta-calibration --since=1h
```

### Cloud Logging

```bash
# Application logs
gcloud logging read \
  "resource.type=k8s_container AND resource.labels.namespace_name=hta-calibration" \
  --limit=50 \
  --format="table(timestamp,jsonPayload.message)"

# Errors only
gcloud logging read \
  "resource.type=k8s_container AND severity>=ERROR" \
  --limit=50

# Filter by text
gcloud logging read \
  "resource.type=k8s_container AND textPayload:\"database connection\"" \
  --limit=20

# Time range
gcloud logging read \
  "resource.type=k8s_container AND timestamp>=\"2024-01-15T00:00:00Z\"" \
  --limit=50
```

### Log Query Examples

```
# Find authentication errors
resource.type="k8s_container"
resource.labels.namespace_name="hta-calibration"
textPayload=~"auth|login|session"
severity>=WARNING

# Find database errors
resource.type="k8s_container"
textPayload=~"prisma|database|connection"
severity>=ERROR

# Find specific user activity
resource.type="k8s_container"
jsonPayload.userId="user123"
```

---

## Pod Inspection

### Describe Pod

```bash
# Full pod details
kubectl describe pod POD_NAME -n hta-calibration

# Key sections to check:
# - Events (recent actions/errors)
# - Conditions (Ready, Initialized)
# - Containers (state, restart count)
# - Resources (requests/limits)
```

### Container Status

```bash
# Check container state
kubectl get pod POD_NAME -n hta-calibration -o jsonpath='{.status.containerStatuses[0]}'

# Restart count
kubectl get pod POD_NAME -n hta-calibration -o jsonpath='{.status.containerStatuses[0].restartCount}'

# Last termination reason
kubectl get pod POD_NAME -n hta-calibration -o jsonpath='{.status.containerStatuses[0].lastState.terminated}'
```

### Execute Commands in Pod

```bash
# Interactive shell
kubectl exec -it deployment/hta-web -n hta-calibration -- sh

# Run single command
kubectl exec deployment/hta-web -n hta-calibration -- printenv

# Check disk space
kubectl exec deployment/hta-web -n hta-calibration -- df -h

# Check memory usage
kubectl exec deployment/hta-web -n hta-calibration -- cat /proc/meminfo

# Check network connectivity
kubectl exec deployment/hta-web -n hta-calibration -- \
  wget -qO- --timeout=5 http://localhost:3000/api/health
```

---

## Resource Monitoring

### Pod Resources

```bash
# Current resource usage
kubectl top pods -n hta-calibration

# Node resources
kubectl top nodes

# Watch resources
watch kubectl top pods -n hta-calibration
```

### HPA Status

```bash
# Check autoscaler
kubectl get hpa -n hta-calibration

# Detailed HPA info
kubectl describe hpa hta-web -n hta-calibration

# Output example:
# Metrics:
#   "cpu" utilization: 45%/70%
#   "memory" utilization: 62%/80%
# Min replicas: 1
# Max replicas: 2
# Current replicas: 1
```

### Events

```bash
# Recent events (sorted by time)
kubectl get events -n hta-calibration --sort-by='.lastTimestamp'

# Watch events
kubectl get events -n hta-calibration -w

# Filter events by type
kubectl get events -n hta-calibration --field-selector type=Warning
```

---

## Database Debugging

### Cloud SQL Status

```bash
# Instance status
gcloud sql instances describe hta-db-dev \
  --format="table(name,state,ipAddresses[0].ipAddress)"

# Recent operations
gcloud sql operations list --instance=hta-db-dev --limit=5

# Connection metrics
gcloud monitoring metrics list \
  --filter="metric.type:cloudsql.googleapis.com/database"
```

### Connect via Cloud SQL Proxy

```bash
# Start proxy (from local machine)
cloud-sql-proxy hta-calibration-prod:asia-south1:hta-db-dev \
  --port=5432

# Connect with psql
psql "postgresql://hta_app:PASSWORD@127.0.0.1:5432/hta_calibration"

# Or run queries
psql "postgresql://hta_app:PASSWORD@127.0.0.1:5432/hta_calibration" \
  -c "SELECT COUNT(*) FROM \"Certificate\""
```

### Common Database Queries

```sql
-- Check active connections
SELECT count(*) FROM pg_stat_activity;

-- Check for locks
SELECT * FROM pg_locks WHERE NOT granted;

-- Recent certificate activity
SELECT id, "certificateNumber", status, "createdAt"
FROM "Certificate"
ORDER BY "createdAt" DESC
LIMIT 10;

-- User session check
SELECT id, email, "lastLoginAt"
FROM "User"
WHERE "isActive" = true
ORDER BY "lastLoginAt" DESC
LIMIT 10;
```

---

## Network Debugging

### Service Connectivity

```bash
# Check service endpoints
kubectl get endpoints hta-web -n hta-calibration

# Check service
kubectl describe svc hta-web -n hta-calibration

# Test from debug pod
kubectl run debug --rm -it --image=busybox -n hta-calibration -- \
  wget -qO- http://hta-web:80/api/health
```

### External Access

```bash
# Get external IP
kubectl get svc hta-web -n hta-calibration -o jsonpath='{.status.loadBalancer.ingress[0].ip}'

# Test from outside cluster
curl http://EXTERNAL_IP/api/health

# Check with verbose output
curl -v http://EXTERNAL_IP/api/health
```

### DNS Resolution

```bash
# Test DNS from within cluster
kubectl run debug --rm -it --image=busybox -n hta-calibration -- \
  nslookup hta-web.hta-calibration.svc.cluster.local

# Expected output:
# Name: hta-web.hta-calibration.svc.cluster.local
# Address: 10.X.X.X
```

---

## Common Production Issues

### Issue: High Memory Usage

**Symptoms**:
- Pods OOMKilled
- Slow response times
- HPA scaling frequently

**Debug**:
```bash
# Check memory usage
kubectl top pods -n hta-calibration

# Check for memory leaks
kubectl exec deployment/hta-web -n hta-calibration -- \
  cat /proc/meminfo | grep -E "(MemTotal|MemFree|Cached)"

# Check Node.js heap
kubectl exec deployment/hta-web -n hta-calibration -- \
  node -e "console.log(process.memoryUsage())"
```

**Solutions**:
1. Increase memory limits in deployment
2. Check for memory leaks in application
3. Enable Node.js heap dumps

### Issue: Slow Responses

**Symptoms**:
- High latency on API calls
- Timeouts

**Debug**:
```bash
# Check pod CPU
kubectl top pods -n hta-calibration

# Check database latency
kubectl exec deployment/hta-web -n hta-calibration -- \
  time wget -qO- http://localhost:3000/api/health

# Check Cloud SQL metrics in GCP Console
```

**Solutions**:
1. Scale up pods (increase replicas)
2. Increase CPU limits
3. Optimize database queries
4. Add caching

### Issue: Database Connection Failures

**Symptoms**:
- "Connection refused" errors
- "Too many connections" errors
- Intermittent 500 errors

**Debug**:
```bash
# Check Cloud SQL instance
gcloud sql instances describe hta-db-dev

# Check connection count
# Connect via proxy and run:
SELECT count(*) FROM pg_stat_activity;

# Check from pod
kubectl exec deployment/hta-web -n hta-calibration -- \
  nc -zv CLOUD_SQL_IP 5432
```

**Solutions**:
1. Check DATABASE_URL configuration
2. Reduce connection pool size
3. Restart pods to reset connections
4. Scale up Cloud SQL tier

### Issue: Pod Not Starting

**Symptoms**:
- Pod stuck in Pending/ContainerCreating
- ImagePullBackOff
- CrashLoopBackOff

**Debug**:
```bash
# Describe pod for events
kubectl describe pod POD_NAME -n hta-calibration

# Check image availability
gcloud artifacts docker images list \
  asia-south1-docker.pkg.dev/PROJECT/hta-calibration

# Check service account permissions
kubectl describe sa hta-app -n hta-calibration
```

---

## Emergency Procedures

### Rollback Deployment

```bash
# View rollout history
kubectl rollout history deployment/hta-web -n hta-calibration

# Rollback to previous version
kubectl rollout undo deployment/hta-web -n hta-calibration

# Rollback to specific revision
kubectl rollout undo deployment/hta-web -n hta-calibration --to-revision=3

# Check rollback status
kubectl rollout status deployment/hta-web -n hta-calibration
```

### Scale Down/Up

```bash
# Scale to 0 (stop all pods)
kubectl scale deployment/hta-web -n hta-calibration --replicas=0

# Scale back up
kubectl scale deployment/hta-web -n hta-calibration --replicas=2

# Force restart
kubectl rollout restart deployment/hta-web -n hta-calibration
```

### Emergency Maintenance

```bash
# Cordon node (prevent new pods)
kubectl cordon NODE_NAME

# Drain node (move pods away)
kubectl drain NODE_NAME --ignore-daemonsets

# Uncordon when done
kubectl uncordon NODE_NAME
```

---

## Monitoring Alerts

### Check GCP Alerting Policies

```bash
# List alert policies
gcloud alpha monitoring policies list

# Get policy details
gcloud alpha monitoring policies describe POLICY_ID
```

### Common Alerts to Set Up

| Alert | Condition | Action |
|-------|-----------|--------|
| Pod CrashLoopBackOff | Container restarts > 5 in 5 min | Investigate logs |
| High Memory | Memory > 90% | Scale up or investigate leak |
| High CPU | CPU > 80% for 5 min | Scale up pods |
| Error Rate | 5xx errors > 1% | Check logs, rollback |
| Database Connections | > 80% max connections | Reduce pool size |

---

## Creating Incident Reports

When debugging production issues, document:

```markdown
## Incident Report

**Date**: YYYY-MM-DD
**Duration**: Start time - End time
**Severity**: P1/P2/P3

### Summary
Brief description of the issue

### Timeline
- HH:MM - First alert received
- HH:MM - Investigation started
- HH:MM - Root cause identified
- HH:MM - Fix deployed
- HH:MM - Issue resolved

### Root Cause
Detailed explanation of what caused the issue

### Resolution
Steps taken to resolve

### Prevention
Changes to prevent recurrence

### Affected Systems
- List of affected services
- Number of users impacted
- Business impact
```

---

## Quick Reference

### Essential Commands

```bash
# Health check
kubectl get pods -n hta-calibration
curl http://EXTERNAL_IP/api/health

# Logs
kubectl logs -f deployment/hta-web -n hta-calibration

# Resources
kubectl top pods -n hta-calibration

# Events
kubectl get events -n hta-calibration --sort-by='.lastTimestamp' | tail -20

# Restart
kubectl rollout restart deployment/hta-web -n hta-calibration

# Rollback
kubectl rollout undo deployment/hta-web -n hta-calibration
```

---

## Key Files

| Location | Purpose |
|----------|---------|
| GCP Console → Kubernetes → Workloads | Visual pod management |
| GCP Console → Logging | Log analysis |
| GCP Console → Monitoring | Metrics and alerts |
| Cloud SQL → Instances | Database management |
