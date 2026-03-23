# 12 - Debugging & Troubleshooting

## Documentation Index

| File | Description | When to Read |
|------|-------------|--------------|
| [01-local-debugging.md](./01-local-debugging.md) | VS Code, DevTools, local debugging | Development |
| [02-production-debugging.md](./02-production-debugging.md) | GKE, Cloud Logging, production issues | Production issues |
| README.md (this file) | Quick reference, common issues | Quick diagnosis |

---

## Quick Diagnosis Commands

```bash
# Overall health
kubectl get pods -n hta-calibration
kubectl get hpa -n hta-calibration
curl http://EXTERNAL_IP/api/health

# Recent events (errors show here)
kubectl get events -n hta-calibration --sort-by='.lastTimestamp' | tail -20

# Pod logs
kubectl logs -f deployment/hta-web -n hta-calibration

# Resource usage
kubectl top pods -n hta-calibration
```

---

## Common Issues & Solutions

### 1. Login Not Working

#### Symptom: "MissingCSRF" Error

**Cause**: CSRF token not sent with login request

**Debug**:
```bash
# Check cookies in browser dev tools
# Should see: authjs.csrf-token, authjs.callback-url
```

**Fix**: Ensure CSRF token is fetched and sent:
```typescript
const csrfToken = await getCsrfToken()
signIn('credentials', { ...data, csrfToken })
```

#### Symptom: "UntrustedHost" Error

**Cause**: Running behind load balancer without trustHost

**Fix**: In `src/lib/auth.ts`:
```typescript
export const { ... } = NextAuth({
  trustHost: true,
  // ...
})
```

Or set environment variable:
```yaml
# configmap.yaml
AUTH_TRUST_HOST: "true"
```

#### Symptom: Login Succeeds but Redirects Back to Login

**Cause**: Session cookie not being set or read

**Debug**:
```bash
# Check NEXTAUTH_URL matches actual URL
kubectl get configmap hta-config -n hta-calibration -o yaml | grep NEXTAUTH

# Compare with actual service IP
kubectl get svc hta-web -n hta-calibration
```

**Fix**: Ensure NEXTAUTH_URL matches the actual URL users access.

---

### 2. Database Connection Issues

#### Symptom: "Connection refused" or Timeout

**Debug**:
```bash
# Test connectivity from pod
kubectl exec -it deployment/hta-web -n hta-calibration -- \
  sh -c "nc -zv CLOUD_SQL_IP 5432"

# Check DATABASE_URL
kubectl exec deployment/hta-web -n hta-calibration -- printenv DATABASE_URL
```

**Causes**:
- Cloud SQL private IP not accessible from GKE
- Wrong credentials
- Database not running

**Fix**:
```bash
# Check Cloud SQL status
gcloud sql instances describe hta-db-dev

# Check VPC peering
gcloud compute networks peerings list
```

#### Symptom: "too many connections"

**Cause**: Connection pool exhausted

**Fix**: Add connection limit to DATABASE_URL:
```
postgresql://user:pass@host:5432/db?connection_limit=10&pool_timeout=30
```

#### Symptom: Prisma Driver Adapter Mismatch

**Error**: `Driver Adapter is not compatible with provider`

**Cause**: Using SQLite adapter with PostgreSQL schema or vice versa

**Fix**: Check DATABASE_URL format matches schema provider:
- PostgreSQL: `postgresql://...`
- SQLite: `file:./dev.db`

---

### 3. Pod Issues

#### Symptom: Pod Stuck in Pending

**Debug**:
```bash
kubectl describe pod POD_NAME -n hta-calibration | grep -A10 Events
```

**Causes & Fixes**:

| Event Message | Cause | Fix |
|---------------|-------|-----|
| `Insufficient cpu` | Not enough CPU on nodes | Scale up nodes or reduce requests |
| `Insufficient memory` | Not enough memory | Scale up or reduce requests |
| `FailedScheduling` | No suitable node | Check node taints/tolerations |
| `Unschedulable` | Node cordoned | Uncordon node or add more nodes |

#### Symptom: Pod in CrashLoopBackOff

**Debug**:
```bash
# Get crash logs
kubectl logs POD_NAME -n hta-calibration --previous

# Check exit code
kubectl describe pod POD_NAME -n hta-calibration | grep "Exit Code"
```

**Exit Codes**:
| Code | Meaning | Likely Cause |
|------|---------|--------------|
| 1 | Application error | Bug in code, missing env var |
| 137 | OOMKilled | Memory limit too low |
| 143 | SIGTERM | Graceful shutdown |

#### Symptom: Pod OOMKilled (Exit 137)

**Fix**: Increase memory limits:
```yaml
# k8s/overlays/development/deployment-patch.yaml
resources:
  limits:
    memory: 1Gi  # Increase
```

Then apply:
```bash
kubectl apply -k k8s/overlays/development
```

---

### 4. Service/Networking Issues

#### Symptom: External IP Shows `<pending>`

**Debug**:
```bash
kubectl describe svc hta-web -n hta-calibration
```

**Cause**: LoadBalancer provisioning (can take 1-3 minutes)

**Fix**: Wait, or check GCP quotas for external IPs.

#### Symptom: Connection Refused from External IP

**Debug**:
```bash
# Check pods are ready
kubectl get pods -n hta-calibration

# Check endpoints
kubectl get endpoints hta-web -n hta-calibration

# Test from inside cluster
kubectl run test --rm -it --image=busybox -- wget -qO- http://hta-web.hta-calibration:80/api/health
```

---

### 5. Build/Deployment Issues

#### Symptom: Docker Build Fails with Prisma Errors

**Error**: `PrismaClientInitializationError` during build

**Cause**: Prisma trying to connect to DB during build

**Fix**: Set `SKIP_DB_INIT=true` in Dockerfile:
```dockerfile
ENV SKIP_DB_INIT=true
RUN npm run build
```

#### Symptom: ImagePullBackOff

**Debug**:
```bash
kubectl describe pod POD_NAME -n hta-calibration | grep -A5 "Events"
```

**Causes**:
- Image doesn't exist
- Wrong image name
- No pull permission

**Fix**:
```bash
# Check image exists
gcloud artifacts docker images list asia-south1-docker.pkg.dev/PROJECT/hta-calibration

# Check service account
kubectl describe sa hta-app -n hta-calibration
```

---

## Debugging Tools

### View Logs

```bash
# Stream logs
kubectl logs -f deployment/hta-web -n hta-calibration

# Last 100 lines
kubectl logs deployment/hta-web -n hta-calibration --tail=100

# Logs from crashed container
kubectl logs POD_NAME -n hta-calibration --previous

# Logs with timestamps
kubectl logs deployment/hta-web -n hta-calibration --timestamps
```

### Shell into Container

```bash
# Interactive shell
kubectl exec -it deployment/hta-web -n hta-calibration -- sh

# Run single command
kubectl exec deployment/hta-web -n hta-calibration -- printenv

# Check network connectivity
kubectl exec deployment/hta-web -n hta-calibration -- wget -qO- http://localhost:3000/api/health
```

### Port Forwarding

```bash
# Access app locally
kubectl port-forward deployment/hta-web -n hta-calibration 3000:3000

# Access via http://localhost:3000
```

### Debug Pod

```bash
# Create a debug pod in same namespace
kubectl run debug --rm -it --image=busybox -n hta-calibration -- sh

# Test DNS
nslookup hta-web.hta-calibration.svc.cluster.local

# Test HTTP
wget -qO- http://hta-web:80/api/health
```

---

## Cloud SQL Debugging

### Connect via Cloud SQL Proxy

```bash
# Start proxy
cloud-sql-proxy hta-calibration-prod:asia-south1:hta-db-dev

# Connect with psql
psql "postgresql://hta_app:PASSWORD@127.0.0.1:5432/hta_calibration"

# Or use DATABASE_URL
DATABASE_URL="postgresql://hta_app:PASSWORD@127.0.0.1:5432/hta_calibration" \
  npx prisma studio
```

### Check Database Status

```bash
# Instance status
gcloud sql instances describe hta-db-dev

# Connection info
gcloud sql instances describe hta-db-dev --format='value(ipAddresses)'

# Recent operations
gcloud sql operations list --instance=hta-db-dev --limit=5
```

---

## Quick Fixes Checklist

| Issue | Quick Fix |
|-------|-----------|
| Login not working | Check NEXTAUTH_URL matches actual URL |
| Database timeout | Check Cloud SQL is running, VPC peering |
| Pod OOMKilled | Increase memory limits |
| Pod Pending | Scale up nodes or reduce resource requests |
| Image not found | Verify image name and registry permissions |
| CSRF error | Fetch and send CSRF token |
| Session null | Check cookies, NEXTAUTH_URL |

---

## Monitoring Dashboard Commands

```bash
# Quick health overview
echo "=== Pods ===" && kubectl get pods -n hta-calibration
echo "=== HPA ===" && kubectl get hpa -n hta-calibration
echo "=== Resources ===" && kubectl top pods -n hta-calibration
echo "=== Events ===" && kubectl get events -n hta-calibration --sort-by='.lastTimestamp' | tail -10
```

---

## When All Else Fails

1. **Restart the deployment**:
   ```bash
   kubectl rollout restart deployment/hta-web -n hta-calibration
   ```

2. **Delete and recreate pod**:
   ```bash
   kubectl delete pod POD_NAME -n hta-calibration
   # Deployment will create new pod
   ```

3. **Redeploy everything**:
   ```bash
   kubectl delete -k k8s/overlays/development
   kubectl apply -k k8s/overlays/development
   ```

4. **Check GCP Console** for Cloud SQL, GKE, and networking issues

5. **Ask for help** with full context:
   - `kubectl describe pod POD_NAME`
   - `kubectl logs POD_NAME --previous`
   - `kubectl get events -n hta-calibration`

---

## Next Steps

- [13 - Tools](../13-tools/) - Development tools
- [08 - Kubernetes](../08-kubernetes/) - K8s reference
