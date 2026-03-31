# Deployment Process

## Deployment Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    DEPLOYMENT PIPELINE                           │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. Code Merge to Main                                          │
│     │                                                            │
│     ▼                                                            │
│  2. CI Pipeline Runs                                            │
│     ├── Tests pass                                              │
│     └── Build succeeds                                          │
│     │                                                            │
│     ▼                                                            │
│  3. Docker Image Built & Pushed                                 │
│     └── ghcr.io/owner/hta-calibration:latest                    │
│     │                                                            │
│     ▼                                                            │
│  4. Update Kubernetes Deployment (manual or GitOps)             │
│     └── kubectl set image / kubectl apply                       │
│     │                                                            │
│     ▼                                                            │
│  5. Rolling Update                                              │
│     ├── New pods created                                        │
│     ├── Health checks pass                                      │
│     └── Old pods terminated                                     │
│     │                                                            │
│     ▼                                                            │
│  6. Verification                                                │
│     ├── Check logs                                              │
│     ├── Smoke tests                                             │
│     └── Monitor metrics                                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Pre-Deployment Checklist

### Before Deploying

- [ ] All tests passing in CI
- [ ] Code reviewed and approved
- [ ] Database migrations reviewed (if any)
- [ ] Secrets updated (if needed)
- [ ] Team notified

### For Production

- [ ] Tested on staging first
- [ ] Backup database
- [ ] Schedule deployment window
- [ ] Have rollback plan ready
- [ ] Monitor dashboards ready

---

## Deployment Methods

### Method 1: Image Update (Recommended)

Update the deployment to use a new image tag:

```bash
# Get cluster credentials
gcloud container clusters get-credentials hta-cluster \
  --region asia-south1 \
  --project hta-calibration-prod

# Update image
kubectl set image deployment/hta-web \
  hta-web=ghcr.io/owner/hta-calibration:abc1234 \
  -n hta-calibration

# Watch rollout
kubectl rollout status deployment/hta-web -n hta-calibration
```

### Method 2: Kustomize Apply

Apply the full configuration:

```bash
# Development
kubectl apply -k k8s/overlays/development

# Staging
kubectl apply -k k8s/overlays/staging

# Production
kubectl apply -k k8s/overlays/production
```

### Method 3: Patch

Update specific fields:

```bash
# Patch deployment
kubectl patch deployment hta-web -n hta-calibration \
  -p '{"spec":{"template":{"spec":{"containers":[{"name":"hta-web","image":"ghcr.io/owner/hta-calibration:new-tag"}]}}}}'
```

---

## Rolling Update Process

```
┌─────────────────────────────────────────────────────────────────┐
│                    ROLLING UPDATE                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Initial State: 2 pods running v1                               │
│  ┌─────────┐  ┌─────────┐                                       │
│  │ Pod A   │  │ Pod B   │                                       │
│  │   v1    │  │   v1    │                                       │
│  └─────────┘  └─────────┘                                       │
│                                                                  │
│  Step 1: Create new pod with v2                                 │
│  ┌─────────┐  ┌─────────┐  ┌─────────┐                          │
│  │ Pod A   │  │ Pod B   │  │ Pod C   │                          │
│  │   v1    │  │   v1    │  │   v2    │ ← Starting               │
│  └─────────┘  └─────────┘  └─────────┘                          │
│                                                                  │
│  Step 2: Pod C becomes ready, terminate Pod A                   │
│  ┌─────────┐  ┌─────────┐                                       │
│  │ Pod B   │  │ Pod C   │                                       │
│  │   v1    │  │   v2    │ ← Ready                               │
│  └─────────┘  └─────────┘                                       │
│                                                                  │
│  Step 3: Create Pod D, terminate Pod B                          │
│  ┌─────────┐  ┌─────────┐                                       │
│  │ Pod C   │  │ Pod D   │                                       │
│  │   v2    │  │   v2    │                                       │
│  └─────────┘  └─────────┘                                       │
│                                                                  │
│  Final: All pods running v2                                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Deployment Strategy Configuration

```yaml
# k8s/base/deployment.yaml
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxUnavailable: 0      # Never have 0 pods available
      maxSurge: 1            # Create 1 extra pod during update
```

---

## Database Migrations

### Migration Workflow

```
┌─────────────────────────────────────────────────────────────────┐
│              DATABASE MIGRATION WORKFLOW                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. BEFORE DEPLOYMENT                                           │
│     ├── Review migration files                                  │
│     ├── Test on staging database                               │
│     └── Backup production database                             │
│                                                                  │
│  2. APPLY MIGRATION (before new code deploys)                   │
│     cloud-sql-proxy PROJECT:REGION:INSTANCE &                   │
│     DATABASE_URL="postgresql://..." npx prisma migrate deploy   │
│                                                                  │
│  3. DEPLOY NEW CODE                                             │
│     kubectl set image deployment/hta-web ...                    │
│                                                                  │
│  4. VERIFY                                                       │
│     ├── Check application logs                                 │
│     ├── Test affected features                                 │
│     └── Monitor error rates                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Running Migrations

```bash
# 1. Start Cloud SQL Proxy
cloud-sql-proxy hta-calibration-prod:asia-south1:hta-db-prod &

# 2. Set database URL
export DATABASE_URL="postgresql://hta_app:PASSWORD@127.0.0.1:5432/hta_calibration"

# 3. View pending migrations
npx prisma migrate status

# 4. Apply migrations
npx prisma migrate deploy

# 5. Verify
npx prisma migrate status
```

### Migration Best Practices

```
DO:
├── Make migrations backwards compatible
├── Add columns as nullable first
├── Create indexes concurrently (if large table)
└── Test migration rollback

DON'T:
├── Drop columns in same deploy as code change
├── Rename columns without migration plan
├── Run migrations during peak hours
└── Skip testing on staging
```

---

## Post-Deployment Verification

### 1. Check Pod Status

```bash
kubectl get pods -n hta-calibration

# Expected output:
# NAME                       READY   STATUS    RESTARTS   AGE
# hta-web-5f7b9c6d4f-abc12   1/1     Running   0          2m
# hta-web-5f7b9c6d4f-def34   1/1     Running   0          2m
```

### 2. Check Logs

```bash
# All pods
kubectl logs -l app=hta-web -n hta-calibration --tail=100

# Specific pod
kubectl logs hta-web-5f7b9c6d4f-abc12 -n hta-calibration

# Follow logs
kubectl logs -f deployment/hta-web -n hta-calibration
```

### 3. Health Check

```bash
# Get service IP
kubectl get service hta-web -n hta-calibration

# Check health endpoint
curl http://EXTERNAL_IP/api/health

# Expected response:
# {"status":"ok","timestamp":"2024-01-01T12:00:00Z"}
```

### 4. Smoke Tests

```bash
# Login page loads
curl -I https://app.htacalibration.com/login

# API responds
curl https://app.htacalibration.com/api/health

# Database connected (check logs)
kubectl logs -l app=hta-web -n hta-calibration | grep "Database"
```

---

## Environment-Specific Deployments

### Development

```bash
# Build and push
docker build -t ghcr.io/owner/hta-calibration:dev .
docker push ghcr.io/owner/hta-calibration:dev

# Deploy
kubectl apply -k k8s/overlays/development

# Or update image
kubectl set image deployment/hta-web \
  hta-web=ghcr.io/owner/hta-calibration:dev \
  -n hta-calibration
```

### Staging

```bash
# Deploy after testing on dev
kubectl apply -k k8s/overlays/staging

# Verify staging-specific config
kubectl get configmap hta-config -n hta-calibration -o yaml
```

### Production

```bash
# Pre-deployment
gcloud sql backups create --instance=hta-db-prod \
  --description="Pre-deploy backup $(date +%Y%m%d)"

# Deploy
kubectl apply -k k8s/overlays/production

# Or safer: update image only
kubectl set image deployment/hta-web \
  hta-web=ghcr.io/owner/hta-calibration:v1.2.3 \
  -n hta-calibration

# Monitor
kubectl rollout status deployment/hta-web -n hta-calibration
```

---

## Deployment Scripts

### deploy.sh

```bash
#!/bin/bash
set -e

ENVIRONMENT=$1
IMAGE_TAG=$2

if [ -z "$ENVIRONMENT" ] || [ -z "$IMAGE_TAG" ]; then
  echo "Usage: ./deploy.sh <environment> <image-tag>"
  echo "Example: ./deploy.sh production v1.2.3"
  exit 1
fi

echo "Deploying $IMAGE_TAG to $ENVIRONMENT..."

# Get credentials
gcloud container clusters get-credentials hta-cluster \
  --region asia-south1 \
  --project hta-calibration-prod

# Update image
kubectl set image deployment/hta-web \
  hta-web=ghcr.io/owner/hta-calibration:$IMAGE_TAG \
  -n hta-calibration

# Wait for rollout
kubectl rollout status deployment/hta-web -n hta-calibration

# Verify
kubectl get pods -n hta-calibration

echo "Deployment complete!"
```

---

## Secrets Management

### Updating Secrets

```bash
# Update single secret
kubectl create secret generic hta-secrets \
  --from-literal=nextauth-secret="NEW_SECRET" \
  --dry-run=client -o yaml | kubectl apply -f -

# Or patch
kubectl patch secret hta-secrets -n hta-calibration \
  -p '{"data":{"api-key":"'$(echo -n "new-value" | base64)'"}}'

# Restart pods to pick up new secrets
kubectl rollout restart deployment/hta-web -n hta-calibration
```

### Viewing Secrets (Careful!)

```bash
# List secrets
kubectl get secrets -n hta-calibration

# View secret (base64 encoded)
kubectl get secret hta-secrets -n hta-calibration -o yaml

# Decode specific value
kubectl get secret hta-secrets -n hta-calibration \
  -o jsonpath='{.data.nextauth-secret}' | base64 -d
```
