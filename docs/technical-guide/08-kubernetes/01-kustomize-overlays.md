# Kustomize Overlays

## Overview

HTA Calibration uses Kustomize for Kubernetes manifest management. The base + overlays pattern enables environment-specific configurations without duplicating manifests.

---

## Directory Structure

```
k8s/
├── base/                           # Common manifests
│   ├── kustomization.yaml         # Base configuration
│   ├── namespace.yaml             # Namespace definition
│   ├── deployment.yaml            # Deployment template
│   ├── service.yaml               # LoadBalancer service
│   ├── configmap.yaml             # Environment variables
│   ├── serviceaccount.yaml        # GKE service account
│   ├── hpa.yaml                   # Horizontal Pod Autoscaler
│   ├── pdb.yaml                   # Pod Disruption Budget
│   └── managed-cert.yaml          # GCP Managed Certificate
└── overlays/
    ├── development/               # Dev environment patches
    │   ├── kustomization.yaml
    │   ├── deployment-patch.yaml
    │   ├── configmap-patch.yaml
    │   ├── hpa-patch.yaml
    │   └── serviceaccount-patch.yaml
    ├── staging/                   # Staging patches
    │   └── ...
    └── production/                # Production patches
        └── ...
```

---

## Base Kustomization

### kustomization.yaml

```yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

metadata:
  name: hta-calibration-base

namespace: hta-calibration

resources:
  - namespace.yaml
  - serviceaccount.yaml
  - configmap.yaml
  - deployment.yaml
  - service.yaml
  - hpa.yaml
  - pdb.yaml

labels:
  - pairs:
      app.kubernetes.io/managed-by: kustomize
    includeSelectors: false
```

### Key Configuration

| Field | Purpose |
|-------|---------|
| `namespace` | Default namespace for all resources |
| `resources` | List of manifests to include |
| `labels` | Common labels applied to all resources |

---

## Base Resources

### Namespace

```yaml
# namespace.yaml
apiVersion: v1
kind: Namespace
metadata:
  name: hta-calibration
  labels:
    app.kubernetes.io/name: hta-calibration
```

### Deployment

```yaml
# deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hta-web
  namespace: hta-calibration
  labels:
    app.kubernetes.io/name: hta-web
    app.kubernetes.io/component: web
    app.kubernetes.io/part-of: hta-calibration
spec:
  replicas: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: hta-web
  template:
    spec:
      serviceAccountName: hta-app
      containers:
        - name: hta-web
          image: asia-south1-docker.pkg.dev/PROJECT/hta-calibration/app:latest
          ports:
            - name: http
              containerPort: 3000
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
              port: http
            initialDelaySeconds: 30
            periodSeconds: 10
          readinessProbe:
            httpGet:
              path: /api/health/ready
              port: http
            initialDelaySeconds: 5
            periodSeconds: 5
          securityContext:
            runAsNonRoot: true
            runAsUser: 1000
            allowPrivilegeEscalation: false
            capabilities:
              drop:
                - ALL
      nodeSelector:
        kubernetes.io/os: linux
      affinity:
        podAntiAffinity:
          preferredDuringSchedulingIgnoredDuringExecution:
            - weight: 100
              podAffinityTerm:
                labelSelector:
                  matchLabels:
                    app.kubernetes.io/name: hta-web
                topologyKey: kubernetes.io/hostname
```

### Pod Disruption Budget

```yaml
# pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: hta-web
  namespace: hta-calibration
spec:
  minAvailable: 1
  selector:
    matchLabels:
      app.kubernetes.io/name: hta-web
```

**Purpose**: Ensures at least 1 pod is available during voluntary disruptions (node drains, upgrades).

---

## Overlay Pattern

### Development Overlay

```yaml
# overlays/development/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

metadata:
  name: hta-calibration-development

namespace: hta-calibration

resources:
  - ../../base

labels:
  - pairs:
      environment: development
    includeSelectors: false

patches:
  - path: deployment-patch.yaml
  - path: configmap-patch.yaml
  - path: hpa-patch.yaml
  - path: serviceaccount-patch.yaml
```

### Deployment Patch (Development)

```yaml
# overlays/development/deployment-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hta-web
  namespace: hta-calibration
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

### Production Overlay

```yaml
# overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

metadata:
  name: hta-calibration-production

namespace: hta-calibration

resources:
  - ../../base

labels:
  - pairs:
      environment: production
    includeSelectors: false

patches:
  - path: deployment-patch.yaml
  - path: configmap-patch.yaml
  - path: hpa-patch.yaml
  - path: serviceaccount-patch.yaml
```

### Deployment Patch (Production)

```yaml
# overlays/production/deployment-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hta-web
  namespace: hta-calibration
spec:
  replicas: 3
  template:
    spec:
      containers:
        - name: hta-web
          resources:
            requests:
              cpu: 500m
              memory: 512Mi
            limits:
              cpu: 1000m
              memory: 1Gi
```

---

## Environment Comparison

| Setting | Development | Staging | Production |
|---------|-------------|---------|------------|
| Replicas | 1 | 2 | 3 |
| CPU Request | 250m | 250m | 500m |
| CPU Limit | 1000m | 1000m | 1000m |
| Memory Request | 512Mi | 512Mi | 512Mi |
| Memory Limit | 1Gi | 1Gi | 1Gi |
| HPA Min | 1 | 1 | 2 |
| HPA Max | 2 | 3 | 10 |

---

## Kustomize Commands

### Preview Changes

```bash
# View rendered manifests
kubectl kustomize k8s/overlays/development

# Compare against current state
kubectl diff -k k8s/overlays/development
```

### Apply Manifests

```bash
# Apply to cluster
kubectl apply -k k8s/overlays/development

# Apply with dry-run
kubectl apply -k k8s/overlays/development --dry-run=client

# Apply with server-side apply
kubectl apply -k k8s/overlays/development --server-side
```

### Build to File

```bash
# Output to file
kubectl kustomize k8s/overlays/production > manifests.yaml

# Apply from file
kubectl apply -f manifests.yaml
```

---

## Patch Types

### Strategic Merge Patch (Default)

Merges with existing resource:

```yaml
# deployment-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hta-web
spec:
  replicas: 3  # Only changes replicas, preserves other fields
```

### JSON Patch

More precise control:

```yaml
patches:
  - target:
      kind: Deployment
      name: hta-web
    patch: |-
      - op: replace
        path: /spec/replicas
        value: 3
```

### Replace Patch

Completely replaces the field:

```yaml
patches:
  - path: deployment-patch.yaml
    options:
      allowNameChange: true
```

---

## ConfigMap Patches

### Development ConfigMap

```yaml
# overlays/development/configmap-patch.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: hta-config
  namespace: hta-calibration
data:
  NODE_ENV: "development"
  NEXTAUTH_URL: "http://localhost:3000"
  LOG_LEVEL: "debug"
```

### Production ConfigMap

```yaml
# overlays/production/configmap-patch.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: hta-config
  namespace: hta-calibration
data:
  NODE_ENV: "production"
  NEXTAUTH_URL: "https://app.hta-calibration.com"
  LOG_LEVEL: "info"
```

---

## Generating Resources

### ConfigMap from File

```yaml
configMapGenerator:
  - name: app-config
    files:
      - config.json
    options:
      disableNameSuffixHash: true
```

### Secret from File

```yaml
secretGenerator:
  - name: app-secrets
    files:
      - credentials.json
    type: Opaque
    options:
      disableNameSuffixHash: true
```

---

## Image Transformation

### Update Image Tag

```yaml
# kustomization.yaml
images:
  - name: asia-south1-docker.pkg.dev/PROJECT/hta-calibration/app
    newTag: v1.2.3
```

### Usage with CI/CD

```bash
# Update image in overlay
cd k8s/overlays/production
kustomize edit set image \
  asia-south1-docker.pkg.dev/PROJECT/hta-calibration/app:v1.2.3
```

---

## Name Prefix/Suffix

### Add Environment Prefix

```yaml
# kustomization.yaml
namePrefix: prod-
nameSuffix: -v1
```

Transforms `hta-web` → `prod-hta-web-v1`

---

## Common Labels and Annotations

### Labels

```yaml
commonLabels:
  app.kubernetes.io/version: "1.0.0"
  app.kubernetes.io/instance: production

# OR with more control
labels:
  - pairs:
      environment: production
      team: calibration
    includeSelectors: false  # Don't add to selectors
```

### Annotations

```yaml
commonAnnotations:
  app.kubernetes.io/owner: "calibration-team"
  prometheus.io/scrape: "true"
```

---

## Validating Manifests

### Build and Validate

```bash
# Build and pipe to kubeval
kubectl kustomize k8s/overlays/production | kubeval --strict

# Build and pipe to kubectl validate
kubectl kustomize k8s/overlays/production | kubectl apply --validate=true --dry-run=client -f -
```

### Check for Errors

```bash
# Validate kustomization structure
kustomize build k8s/overlays/production 2>&1 | head -20
```

---

## Troubleshooting

### Resource Not Found

```
error: unable to find resource "deployment hta-web"
```

**Fix**: Ensure base path is correct in overlay:
```yaml
resources:
  - ../../base  # Verify path
```

### Patch Not Applied

```
strategic merge patch failed
```

**Fix**: Ensure metadata matches exactly:
```yaml
metadata:
  name: hta-web        # Must match base
  namespace: hta-calibration  # Must match base
```

### Hash Suffix Issues

**Problem**: ConfigMap/Secret names change with each apply

**Fix**: Disable suffix hash:
```yaml
configMapGenerator:
  - name: hta-config
    options:
      disableNameSuffixHash: true
```

---

## Best Practices

1. **Keep base minimal** - Only common configurations
2. **Use patches for differences** - Not full resource copies
3. **Label everything** - For filtering and selection
4. **Use generators** - For ConfigMaps and Secrets
5. **Version image tags** - Avoid `latest` in production
6. **Test with diff** - Before applying changes
7. **Use namespaces** - Isolate environments

---

## Key Files

| File | Purpose |
|------|---------|
| `k8s/base/kustomization.yaml` | Base configuration |
| `k8s/overlays/*/kustomization.yaml` | Environment overrides |
| `k8s/overlays/*/deployment-patch.yaml` | Resource adjustments |
| `k8s/overlays/*/configmap-patch.yaml` | Environment variables |
