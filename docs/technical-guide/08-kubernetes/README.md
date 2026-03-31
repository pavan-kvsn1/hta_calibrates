# 08 - Kubernetes (GKE + Kustomize)

## Documentation Index

| File | Description | When to Read |
|------|-------------|--------------|
| [01-kustomize-overlays.md](./01-kustomize-overlays.md) | Kustomize patterns, patches | Managing manifests |
| [02-workload-identity.md](./02-workload-identity.md) | GKE Workload Identity | GCP service access |
| README.md (this file) | Overview, commands, troubleshooting | Getting started |

---

## Overview

Kubernetes manifests are managed with **Kustomize**, using a base + overlays pattern.

```
k8s/
├── base/                    # Common manifests
│   ├── kustomization.yaml
│   ├── namespace.yaml
│   ├── deployment.yaml
│   ├── service.yaml
│   ├── configmap.yaml
│   ├── serviceaccount.yaml
│   ├── hpa.yaml
│   └── pdb.yaml
└── overlays/
    ├── development/         # Dev overrides
    ├── staging/             # Staging overrides
    └── production/          # Prod overrides
```

---

## Base Manifests

### Namespace

```yaml
# k8s/base/namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: hta-calibration
  labels:
    app.kubernetes.io/name: hta-calibration
```

### Deployment

```yaml
# k8s/base/deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hta-web
  namespace: hta-calibration
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: hta-web
  template:
    metadata:
      labels:
        app.kubernetes.io/name: hta-web
    spec:
      serviceAccountName: hta-app
      containers:
        - name: hta-web
          image: asia-south1-docker.pkg.dev/PROJECT/hta-calibration/app:latest
          ports:
            - containerPort: 3000
          envFrom:
            - configMapRef:
                name: hta-config
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: hta-secrets
                  key: database-url
            - name: NEXTAUTH_SECRET
              valueFrom:
                secretKeyRef:
                  name: hta-secrets
                  key: nextauth-secret
          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: 1000m
              memory: 2Gi
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

### Service

```yaml
# k8s/base/service.yaml
apiVersion: v1
kind: Service
metadata:
  name: hta-web
  namespace: hta-calibration
spec:
  type: LoadBalancer  # External IP
  ports:
    - port: 80
      targetPort: 3000
  selector:
    app.kubernetes.io/name: hta-web
```

### ConfigMap

```yaml
# k8s/base/configmap.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: hta-config
  namespace: hta-calibration
data:
  NODE_ENV: "production"
  PORT: "3000"
  NEXTAUTH_URL: "http://34.180.4.228"
  AUTH_URL: "http://34.180.4.228"
  AUTH_TRUST_HOST: "true"
  GCS_CERTIFICATES_BUCKET: "hta-calibration-prod-certificates-dev"
```

### HorizontalPodAutoscaler

```yaml
# k8s/base/hpa.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: hta-web
  namespace: hta-calibration
spec:
  scaleTargetRef:
    apiVersion: apps/v1
    kind: Deployment
    name: hta-web
  minReplicas: 1
  maxReplicas: 2
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 80
```

---

## Overlays

### Development Overlay

```yaml
# k8s/overlays/development/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: hta-calibration

resources:
  - ../../base

patches:
  - path: deployment-patch.yaml
  - path: hpa-patch.yaml

labels:
  - pairs:
      env: development
    includeSelectors: false
```

```yaml
# k8s/overlays/development/deployment-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hta-web
spec:
  replicas: 1
  template:
    spec:
      containers:
        - name: hta-web
          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: 1000m
              memory: 1Gi
```

---

## Deployment Commands

### Apply Manifests

```bash
# Development
kubectl apply -k k8s/overlays/development

# Staging
kubectl apply -k k8s/overlays/staging

# Production
kubectl apply -k k8s/overlays/production
```

### Preview Changes

```bash
# See what will be applied
kubectl diff -k k8s/overlays/development

# Build and view manifests
kubectl kustomize k8s/overlays/development
```

### Rollout

```bash
# Check rollout status
kubectl rollout status deployment/hta-web -n hta-calibration

# Rollback
kubectl rollout undo deployment/hta-web -n hta-calibration

# Restart pods
kubectl rollout restart deployment/hta-web -n hta-calibration
```

---

## Secrets Management

Secrets are created manually (not in Git):

```bash
# Create secrets
kubectl create secret generic hta-secrets \
  -n hta-calibration \
  --from-literal=database-url='postgresql://user:pass@host:5432/db' \
  --from-literal=nextauth-secret='your-secret-here'

# View secrets (base64 encoded)
kubectl get secret hta-secrets -n hta-calibration -o yaml

# Decode a secret
kubectl get secret hta-secrets -n hta-calibration \
  -o jsonpath='{.data.database-url}' | base64 -d
```

---

## Common Operations

### View Resources

```bash
# All resources in namespace
kubectl get all -n hta-calibration

# Pods with details
kubectl get pods -n hta-calibration -o wide

# Pod resource usage
kubectl top pods -n hta-calibration

# Node resource usage
kubectl top nodes
```

### Logs

```bash
# Pod logs
kubectl logs -f deployment/hta-web -n hta-calibration

# Previous container logs (after crash)
kubectl logs deployment/hta-web -n hta-calibration --previous

# All pods matching label
kubectl logs -l app.kubernetes.io/name=hta-web -n hta-calibration
```

### Exec into Pod

```bash
# Interactive shell
kubectl exec -it deployment/hta-web -n hta-calibration -- sh

# Run command
kubectl exec deployment/hta-web -n hta-calibration -- printenv
```

### Port Forward

```bash
# Forward local port to pod
kubectl port-forward deployment/hta-web -n hta-calibration 3000:3000

# Access at http://localhost:3000
```

---

## Troubleshooting

### Pod Not Starting

```bash
# Describe pod for events
kubectl describe pod POD_NAME -n hta-calibration

# Common issues:
# - ImagePullBackOff: Image doesn't exist or no permission
# - CrashLoopBackOff: App crashing, check logs
# - Pending: Insufficient resources
```

### Pod Crashing

```bash
# Check logs
kubectl logs POD_NAME -n hta-calibration --previous

# Check exit code
kubectl describe pod POD_NAME -n hta-calibration | grep -A5 "Last State"

# Exit codes:
# - 137: OOMKilled (out of memory)
# - 1: Application error
# - 143: SIGTERM (graceful shutdown)
```

### Service Not Accessible

```bash
# Check service
kubectl get svc hta-web -n hta-calibration

# Check endpoints
kubectl get endpoints hta-web -n hta-calibration

# Test from within cluster
kubectl run test --rm -it --image=busybox -- wget -qO- http://hta-web.hta-calibration:80
```

### Resource Limits

```bash
# Check current usage vs limits
kubectl describe pod POD_NAME -n hta-calibration | grep -A10 "Limits"

# Check HPA status
kubectl get hpa -n hta-calibration

# If memory at 100%+, increase limits in deployment patch
```

---

## Common Failure Modes

### 1. OOMKilled (Exit 137)

**Symptom**: Pod restarts with exit code 137

**Cause**: Memory limit exceeded

**Fix**: Increase memory limits:
```yaml
resources:
  limits:
    memory: 1Gi  # Increase from 512Mi
```

### 2. ImagePullBackOff

**Symptom**: Pod stuck in ImagePullBackOff

**Causes**:
- Image doesn't exist
- No permission to pull from registry
- Wrong image name

**Fix**:
```bash
# Check image exists
gcloud artifacts docker images list asia-south1-docker.pkg.dev/PROJECT/hta-calibration

# Check service account has permission
kubectl describe sa hta-app -n hta-calibration
```

### 3. CrashLoopBackOff

**Symptom**: Pod keeps restarting

**Debug**:
```bash
# Check logs
kubectl logs POD_NAME -n hta-calibration --previous

# Common causes:
# - Database connection failed
# - Missing environment variable
# - Application bug
```

### 4. Insufficient CPU

**Symptom**: Pods stuck in Pending

**Cause**: Not enough CPU on nodes

**Fix**:
- Scale up node pool
- Reduce CPU requests
- Wait for cluster autoscaler

```bash
# Check node capacity
kubectl describe nodes | grep -A5 "Allocated resources"
```

---

## Monitoring

### Basic Health

```bash
# Quick health check
kubectl get pods -n hta-calibration
kubectl get hpa -n hta-calibration

# API health endpoint
curl http://EXTERNAL_IP/api/health
```

### Events

```bash
# Recent events
kubectl get events -n hta-calibration --sort-by='.lastTimestamp'

# Watch events
kubectl get events -n hta-calibration -w
```

---

## Key Files

| File | Purpose |
|------|---------|
| `k8s/base/deployment.yaml` | Main deployment |
| `k8s/base/service.yaml` | LoadBalancer service |
| `k8s/base/configmap.yaml` | Environment config |
| `k8s/overlays/development/` | Dev patches |

---

## Next Steps

- [09 - Deployment](../09-deployment/) - CI/CD pipeline
- [12 - Debugging](../12-debugging/) - Troubleshooting guide
