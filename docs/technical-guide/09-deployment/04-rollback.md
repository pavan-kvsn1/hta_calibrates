# Rollback Procedures

## When to Rollback

```
┌─────────────────────────────────────────────────────────────────┐
│                    ROLLBACK DECISION TREE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  After deployment, ask:                                         │
│                                                                  │
│  1. Are pods crashing?                                          │
│     │                                                            │
│     ├── YES → Check logs, likely code issue → ROLLBACK          │
│     │                                                            │
│     └── NO → Continue...                                        │
│                                                                  │
│  2. Are error rates elevated?                                   │
│     │                                                            │
│     ├── HIGH (>5%) → ROLLBACK immediately                       │
│     │                                                            │
│     ├── MEDIUM (1-5%) → Investigate, consider rollback          │
│     │                                                            │
│     └── LOW (<1%) → Monitor, may be transient                   │
│                                                                  │
│  3. Are critical features broken?                               │
│     │                                                            │
│     ├── YES → ROLLBACK                                          │
│     │                                                            │
│     └── NO → Fix forward if minor                               │
│                                                                  │
│  4. Is database corrupted?                                      │
│     │                                                            │
│     ├── YES → ROLLBACK + restore backup                         │
│     │                                                            │
│     └── NO → Code rollback may be sufficient                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Rollback Methods

### Method 1: Kubernetes Rollout Undo (Fastest)

```bash
# Undo last deployment
kubectl rollout undo deployment/hta-web -n hta-calibration

# Check status
kubectl rollout status deployment/hta-web -n hta-calibration

# Verify pods running previous version
kubectl get pods -n hta-calibration -o wide
```

**When to use**: Code issue, no database changes

**Recovery time**: ~2 minutes

### Method 2: Rollback to Specific Revision

```bash
# View deployment history
kubectl rollout history deployment/hta-web -n hta-calibration

# Output:
# REVISION  CHANGE-CAUSE
# 1         Initial deployment
# 2         Update to v1.1.0
# 3         Update to v1.2.0 (current)

# Rollback to specific revision
kubectl rollout undo deployment/hta-web -n hta-calibration --to-revision=2

# Verify
kubectl rollout status deployment/hta-web -n hta-calibration
```

### Method 3: Set Previous Image

```bash
# Find previous image
kubectl get deployment hta-web -n hta-calibration -o yaml | grep image

# Set specific image
kubectl set image deployment/hta-web \
  hta-web=ghcr.io/owner/hta-calibration:previous-tag \
  -n hta-calibration

# Verify
kubectl rollout status deployment/hta-web -n hta-calibration
```

### Method 4: Apply Previous Kustomize

```bash
# If you have previous manifests in git
git checkout HEAD~1 -- k8s/
kubectl apply -k k8s/overlays/production
```

---

## Database Rollback

### Restore from Backup

```bash
# List available backups
gcloud sql backups list --instance=hta-db-prod

# Output:
# ID         LOCATION      STATUS     START_TIME
# 123456     asia-south1   SUCCESSFUL 2024-01-15T02:00:00
# 123455     asia-south1   SUCCESSFUL 2024-01-14T02:00:00

# Restore to point-in-time (requires backup)
gcloud sql backups restore 123456 \
  --restore-instance=hta-db-prod \
  --backup-instance=hta-db-prod

# WARNING: This will replace ALL data with backup contents!
```

### Create Manual Backup Before Risky Operations

```bash
# Always backup before:
# - Schema migrations
# - Data migrations
# - Bulk updates

gcloud sql backups create \
  --instance=hta-db-prod \
  --description="Pre-migration backup $(date +%Y%m%d-%H%M)"
```

### Migration Rollback

Prisma doesn't have automatic rollback. You must:

1. Create a **reverse migration** manually
2. Apply the reverse migration

```bash
# Example: If migration added a column
npx prisma migrate dev --name rollback_add_column

# In the migration file, write:
# ALTER TABLE "Certificate" DROP COLUMN "newColumn";
```

---

## Incident Response Procedure

### Step 1: Detect

```bash
# Check pod status
kubectl get pods -n hta-calibration

# Look for:
# - CrashLoopBackOff
# - Error
# - Pending (stuck)
# - 0/1 Ready

# Check recent events
kubectl get events -n hta-calibration --sort-by='.lastTimestamp' | tail -20
```

### Step 2: Assess Severity

```
SEVERITY LEVELS:

P1 (Critical):
├── Application completely down
├── Data loss occurring
└── Security breach
→ Immediate rollback, all hands on deck

P2 (High):
├── Major feature broken
├── Significant user impact
└── Error rate > 5%
→ Rollback within 15 minutes

P3 (Medium):
├── Minor feature broken
├── Limited user impact
└── Error rate 1-5%
→ Investigate, rollback if needed

P4 (Low):
├── Cosmetic issues
├── Minimal impact
└── Error rate < 1%
→ Fix forward in next deploy
```

### Step 3: Execute Rollback

```bash
# 1. Notify team
echo "Starting rollback - Production issue detected"

# 2. Execute rollback
kubectl rollout undo deployment/hta-web -n hta-calibration

# 3. Wait for completion
kubectl rollout status deployment/hta-web -n hta-calibration

# 4. Verify
kubectl get pods -n hta-calibration
curl -I https://app.htacalibration.com/api/health
```

### Step 4: Verify Recovery

```bash
# Check logs for errors
kubectl logs -l app=hta-web -n hta-calibration --tail=100 | grep -i error

# Check health endpoint
curl https://app.htacalibration.com/api/health

# Check critical flows (manual)
# - Login works
# - Certificate list loads
# - Customer portal accessible
```

### Step 5: Post-Incident

1. **Document** what happened
2. **Root cause analysis** within 24 hours
3. **Fix** the underlying issue
4. **Test** thoroughly before next deploy
5. **Update** runbooks if needed

---

## Rollback Scenarios

### Scenario 1: Pods Crashing

```
Symptom: Pods in CrashLoopBackOff

kubectl get pods -n hta-calibration
# NAME                       READY   STATUS             RESTARTS
# hta-web-abc123            0/1     CrashLoopBackOff   5

# Check logs
kubectl logs hta-web-abc123 -n hta-calibration --previous

# Likely causes:
# - Missing environment variable
# - Database connection failed
# - Runtime error in code

# Action: Rollback
kubectl rollout undo deployment/hta-web -n hta-calibration
```

### Scenario 2: Stuck Rollout

```
Symptom: New pods not becoming ready

kubectl get pods -n hta-calibration
# NAME                       READY   STATUS    AGE
# hta-web-abc123 (new)      0/1     Running   10m  ← Stuck
# hta-web-def456 (old)      1/1     Running   2h

# Check why not ready
kubectl describe pod hta-web-abc123 -n hta-calibration

# Likely causes:
# - Readiness probe failing
# - Resource limits too low
# - Missing secrets

# Action: Rollback
kubectl rollout undo deployment/hta-web -n hta-calibration
```

### Scenario 3: Database Migration Failed

```
Symptom: Application errors related to database

# Check pod logs
kubectl logs -l app=hta-web -n hta-calibration | grep -i "prisma\|database"

# If migration partially applied:
# 1. Rollback application
kubectl rollout undo deployment/hta-web -n hta-calibration

# 2. Assess database state
cloud-sql-proxy PROJECT:REGION:INSTANCE &
DATABASE_URL="postgresql://..." npx prisma migrate status

# 3. If needed, restore database backup
gcloud sql backups restore BACKUP_ID --restore-instance=hta-db-prod

# 4. Verify application works with restored database
```

### Scenario 4: Performance Degradation

```
Symptom: Slow response times, high CPU/memory

# Check resource usage
kubectl top pods -n hta-calibration

# Check HPA status
kubectl get hpa -n hta-calibration

# If new version is resource-hungry:
kubectl rollout undo deployment/hta-web -n hta-calibration

# Then investigate locally before next deploy
```

---

## Prevention Measures

### 1. Canary Deployments

Deploy to small subset first:

```yaml
# Deploy 1 pod first
spec:
  replicas: 1

# Verify, then scale up
kubectl scale deployment/hta-web --replicas=3 -n hta-calibration
```

### 2. Feature Flags

Wrap new features in flags:

```typescript
if (featureFlags.newCertificateFlow) {
  // New code path
} else {
  // Old code path
}
```

### 3. Health Checks

Robust health checks catch issues early:

```yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: 3000
  initialDelaySeconds: 30
  periodSeconds: 10

readinessProbe:
  httpGet:
    path: /api/health/ready
    port: 3000
  initialDelaySeconds: 5
  periodSeconds: 5
```

### 4. Automated Rollback

Configure HPA to handle failures:

```yaml
spec:
  minReplicas: 2  # Always have healthy pods
```

---

## Rollback Checklist

```
PRE-ROLLBACK:
□ Identify the issue
□ Assess severity
□ Notify team
□ Document current state

DURING ROLLBACK:
□ Execute rollback command
□ Wait for completion
□ Verify pods healthy
□ Check health endpoints

POST-ROLLBACK:
□ Confirm user impact resolved
□ Document timeline
□ Root cause analysis
□ Plan fix for next deploy
```
