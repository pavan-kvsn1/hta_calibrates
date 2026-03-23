# 14 - Environments

## Documentation Index

| File | Description | When to Read |
|------|-------------|--------------|
| [01-environment-variables.md](./01-environment-variables.md) | Complete env var reference | Configuration |
| [02-local-vs-gke.md](./02-local-vs-gke.md) | Local vs GKE differences | Debugging issues |
| README.md (this file) | Environment overview | Getting started |

---

## Overview

| Environment | Purpose | URL | Database |
|-------------|---------|-----|----------|
| Local | Development | http://localhost:3000 | SQLite |
| Development | Testing in GKE | http://34.180.4.228 | Cloud SQL (dev) |
| Staging | Pre-production | TBD | Cloud SQL (staging) |
| Production | Live system | TBD | Cloud SQL (prod) |

---

## Environment Comparison

| Aspect | Local | Dev | Staging | Prod |
|--------|-------|-----|---------|------|
| **Database** | SQLite | PostgreSQL | PostgreSQL | PostgreSQL |
| **Replicas** | 1 | 1 | 2 | 3+ |
| **CPU Request** | - | 250m | 500m | 1000m |
| **Memory Request** | - | 512Mi | 1Gi | 2Gi |
| **HPA Max** | - | 2 | 3 | 10 |
| **DB Tier** | - | db-f1-micro | db-g1-small | db-custom-2-4096 |
| **SSL** | No | No | Yes | Yes |
| **Domain** | localhost | IP only | staging.domain.com | domain.com |

---

## Local Development

### Setup

```bash
# Install dependencies
npm install

# Setup database
npx prisma db push
npx prisma db seed

# Start dev server
npm run dev
```

### Environment Variables

```bash
# .env.local (create this file)
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="dev-secret-change-in-production"
NEXTAUTH_URL="http://localhost:3000"
```

### Database

- **Type**: SQLite (file-based)
- **Location**: `./dev.db` or `./prisma/dev.db`
- **Access**: Prisma Studio (`npx prisma studio`)

---

## Development (GKE)

### Infrastructure

```bash
# Deploy with Terraform
cd terraform/environments/dev
terraform apply
```

### Kubernetes

```bash
# Apply manifests
kubectl apply -k k8s/overlays/development

# Check status
kubectl get all -n hta-calibration
```

### Configuration

```yaml
# k8s/overlays/development/deployment-patch.yaml
resources:
  requests:
    cpu: 250m
    memory: 512Mi
  limits:
    cpu: 1000m
    memory: 1Gi
```

### Secrets

```bash
# Create secrets (one-time)
kubectl create secret generic hta-secrets \
  -n hta-calibration \
  --from-literal=database-url='postgresql://...' \
  --from-literal=nextauth-secret='...'
```

### Access

- **URL**: http://34.180.4.228
- **Database**: Cloud SQL Proxy + DBeaver/psql
- **Logs**: `kubectl logs -f deployment/hta-web -n hta-calibration`

---

## Staging (Future)

### Differences from Dev

| Aspect | Dev | Staging |
|--------|-----|---------|
| Domain | IP | staging.htacalibration.com |
| SSL | No | Yes (managed cert) |
| Replicas | 1 | 2 |
| Data | Test data | Copy of prod (sanitized) |

### Setup

```bash
# Deploy infrastructure
cd terraform/environments/staging
terraform apply

# Deploy application
kubectl apply -k k8s/overlays/staging
```

---

## Production (Future)

### Requirements

- [ ] SSL certificate (Google Managed Certificate)
- [ ] Custom domain configured
- [ ] Database backups enabled
- [ ] Monitoring/alerting setup
- [ ] WAF/DDoS protection

### Configuration

```yaml
# k8s/overlays/production/deployment-patch.yaml
resources:
  requests:
    cpu: 1000m
    memory: 2Gi
  limits:
    cpu: 2000m
    memory: 4Gi
```

```yaml
# k8s/overlays/production/hpa-patch.yaml
spec:
  minReplicas: 3
  maxReplicas: 10
```

---

## Environment Variables by Environment

### Common (All Environments)

| Variable | Description |
|----------|-------------|
| `NODE_ENV` | `development` or `production` |
| `PORT` | `3000` |
| `DATABASE_URL` | Database connection string |
| `NEXTAUTH_SECRET` | JWT signing secret |
| `NEXTAUTH_URL` | Application URL |

### GKE Specific

| Variable | Description |
|----------|-------------|
| `AUTH_TRUST_HOST` | `true` (behind load balancer) |
| `AUTH_URL` | Same as NEXTAUTH_URL |
| `GCS_CERTIFICATES_BUCKET` | GCS bucket for certificates |
| `GCS_SIGNATURES_BUCKET` | GCS bucket for signatures |

### Per-Environment Values

| Variable | Local | Dev | Prod |
|----------|-------|-----|------|
| `NODE_ENV` | development | production | production |
| `NEXTAUTH_URL` | http://localhost:3000 | http://34.180.4.228 | https://app.htacalibration.com |
| `DATABASE_URL` | file:./dev.db | postgresql://... | postgresql://... |

---

## Promoting Changes

### Code Deployment Flow

```
Local Development
    ↓ git push
Feature Branch
    ↓ PR + Review
Main Branch
    ↓ CI/CD (auto)
Development
    ↓ Manual approval
Staging
    ↓ Manual approval
Production
```

### Database Changes

```bash
# 1. Create migration locally
npx prisma migrate dev --name add_new_field

# 2. Test locally
npm run dev

# 3. Apply to dev
DATABASE_URL="..." npx prisma migrate deploy

# 4. Apply to staging (after testing)
DATABASE_URL="..." npx prisma migrate deploy

# 5. Apply to production (with care)
DATABASE_URL="..." npx prisma migrate deploy
```

---

## Switching Environments

### kubectl Context

```bash
# List contexts
kubectl config get-contexts

# Switch to dev
kubectl config use-context gke_PROJECT_REGION_CLUSTER-dev

# Switch to prod
kubectl config use-context gke_PROJECT_REGION_CLUSTER-prod
```

### Database Connection

```bash
# Dev database
cloud-sql-proxy PROJECT:REGION:hta-db-dev

# Prod database
cloud-sql-proxy PROJECT:REGION:hta-db-prod
```

---

## Environment-Specific Features

### Feature Flags

```typescript
// Use environment to enable/disable features
const isProduction = process.env.NODE_ENV === 'production'
const isDevelopment = process.env.NODE_ENV === 'development'

// Example: Enable debug logging in dev only
if (isDevelopment) {
  console.log('Debug:', data)
}
```

### Debug Mode

- **Local**: Full debug logging, hot reload
- **Dev**: Debug logging enabled
- **Staging**: Limited logging
- **Prod**: Error logging only

---

## Rollback Procedures

### Kubernetes

```bash
# View rollout history
kubectl rollout history deployment/hta-web -n hta-calibration

# Rollback to previous version
kubectl rollout undo deployment/hta-web -n hta-calibration

# Rollback to specific revision
kubectl rollout undo deployment/hta-web -n hta-calibration --to-revision=2
```

### Database

```bash
# Prisma doesn't have built-in rollback
# Options:
# 1. Restore from backup
# 2. Create reverse migration
# 3. Use point-in-time recovery (Cloud SQL)
```

---

## Checklist: Adding New Environment

- [ ] Create Terraform configuration in `terraform/environments/NEW_ENV/`
- [ ] Create Kustomize overlay in `k8s/overlays/NEW_ENV/`
- [ ] Configure environment-specific values (replicas, resources)
- [ ] Setup secrets in Kubernetes
- [ ] Configure DNS (if using custom domain)
- [ ] Setup SSL certificate (if HTTPS)
- [ ] Configure CI/CD deployment

---

## Key Files

| Environment | Config Location |
|-------------|-----------------|
| Local | `.env.local` |
| Dev | `k8s/overlays/development/` |
| Staging | `k8s/overlays/staging/` |
| Prod | `k8s/overlays/production/` |

---

## Next Steps

- [06 - Infrastructure](../06-infrastructure/) - Terraform setup
- [08 - Kubernetes](../08-kubernetes/) - K8s manifests
- [09 - Deployment](../09-deployment/) - CI/CD pipeline
