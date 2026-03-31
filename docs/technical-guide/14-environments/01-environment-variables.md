# Environment Variables

## Overview

Complete reference for all environment variables used in HTA Calibration.

---

## Categories

| Category | Purpose |
|----------|---------|
| Core | Essential application settings |
| Database | Database connection |
| Authentication | NextAuth configuration |
| Storage | Cloud Storage settings |
| Feature Flags | Enable/disable features |

---

## Core Variables

### NODE_ENV

**Purpose**: Sets the application environment mode

| Value | Behavior |
|-------|----------|
| `development` | Debug logging, hot reload, dev tools |
| `production` | Optimized, minimal logging |
| `test` | Test mode |

**Where Set**:
- Local: `.env.local`
- GKE: ConfigMap

```yaml
# k8s/base/configmap.yaml
data:
  NODE_ENV: "production"
```

---

### PORT

**Purpose**: HTTP server port

**Default**: `3000`

**Usage**:
```typescript
const port = process.env.PORT || 3000
```

---

### HOSTNAME

**Purpose**: Server hostname binding

**Default**: `0.0.0.0`

**Docker Usage**:
```dockerfile
ENV HOSTNAME="0.0.0.0"
```

---

## Database Variables

### DATABASE_URL

**Purpose**: Database connection string

**Format**:
```bash
# PostgreSQL (local development via Docker)
DATABASE_URL="postgresql://hta_user:hta_dev_password@localhost:5432/hta_calibration"

# PostgreSQL (GKE/Cloud SQL)
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public"

# PostgreSQL with SSL
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public&sslmode=require"

# PostgreSQL with connection pool
DATABASE_URL="postgresql://USER:PASSWORD@HOST:PORT/DATABASE?connection_limit=10&pool_timeout=30"
```

**Security**:
- Stored in Kubernetes Secret
- Never commit to Git
- Use Secret Manager for rotation

**GKE Configuration**:
```yaml
# k8s/base/deployment.yaml
env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: hta-secrets
        key: database-url
```

---

### SKIP_DB_INIT

**Purpose**: Skip database initialization during build

**Usage**: Set to `true` during Docker build to prevent Prisma from connecting to database

```dockerfile
ENV SKIP_DB_INIT=true
RUN npm run build
```

---

## Authentication Variables

### NEXTAUTH_SECRET

**Purpose**: JWT signing secret for NextAuth

**Generation**:
```bash
# Generate secure secret
openssl rand -base64 32
```

**Requirements**:
- Minimum 32 characters
- Cryptographically random
- Different per environment

**GKE Configuration**:
```yaml
env:
  - name: NEXTAUTH_SECRET
    valueFrom:
      secretKeyRef:
        name: hta-secrets
        key: nextauth-secret
```

---

### NEXTAUTH_URL

**Purpose**: Base URL for NextAuth callbacks

**Format**: Full URL including protocol

| Environment | Value |
|-------------|-------|
| Local | `http://localhost:3000` |
| Development | `http://34.180.4.228` |
| Production | `https://app.htacalibration.com` |

**Common Issues**:
- Must match actual access URL
- Include port if non-standard
- No trailing slash

---

### AUTH_URL

**Purpose**: Alias for NEXTAUTH_URL (NextAuth v5)

**Usage**: Set to same value as NEXTAUTH_URL

```yaml
data:
  NEXTAUTH_URL: "http://34.180.4.228"
  AUTH_URL: "http://34.180.4.228"
```

---

### AUTH_TRUST_HOST

**Purpose**: Trust X-Forwarded-* headers from load balancer

**When Required**: Running behind load balancer or reverse proxy

```yaml
data:
  AUTH_TRUST_HOST: "true"
```

**Also Set in Code**:
```typescript
// src/lib/auth.ts
export const { ... } = NextAuth({
  trustHost: true,
  // ...
})
```

---

## Storage Variables

### GCS_CERTIFICATES_BUCKET

**Purpose**: Google Cloud Storage bucket for certificate PDFs

**Format**: Bucket name without `gs://` prefix

```yaml
data:
  GCS_CERTIFICATES_BUCKET: "hta-calibration-prod-certificates-dev"
```

**Usage**:
```typescript
const bucket = storage.bucket(process.env.GCS_CERTIFICATES_BUCKET!)
```

---

### GCS_SIGNATURES_BUCKET

**Purpose**: Bucket for signature images

```yaml
data:
  GCS_SIGNATURES_BUCKET: "hta-calibration-prod-signatures-dev"
```

---

### GCS_UPLOADS_BUCKET

**Purpose**: Temporary upload bucket

```yaml
data:
  GCS_UPLOADS_BUCKET: "hta-calibration-prod-uploads-dev"
```

---

## Logging Variables

### LOG_LEVEL

**Purpose**: Application log verbosity

| Value | Logs |
|-------|------|
| `debug` | All logs including debug |
| `info` | Info, warnings, errors |
| `warn` | Warnings and errors |
| `error` | Errors only |

**Per Environment**:
- Local: `debug`
- Development: `debug`
- Staging: `info`
- Production: `warn`

---

### DEBUG

**Purpose**: Enable Prisma debug logging

```bash
# Enable all Prisma logs
DEBUG="prisma:*" npm run dev

# Query logs only
DEBUG="prisma:query" npm run dev
```

---

## Telemetry Variables

### NEXT_TELEMETRY_DISABLED

**Purpose**: Disable Next.js telemetry

```dockerfile
ENV NEXT_TELEMETRY_DISABLED=1
```

---

## Environment File Templates

### Local Development (.env.local)

```bash
# Database (PostgreSQL via Docker Compose)
DATABASE_URL="postgresql://hta_user:hta_dev_password@localhost:5432/hta_calibration"

# Authentication
NEXTAUTH_SECRET="development-secret-32-chars-min"
NEXTAUTH_URL="http://localhost:3000"

# Optional: Debug
LOG_LEVEL="debug"
```

### Production (.env.production - NOT committed)

```bash
# Database (from Secret Manager)
DATABASE_URL="postgresql://hta_app:SECURE_PASSWORD@CLOUD_SQL_IP:5432/hta_calibration?sslmode=require"

# Authentication
NEXTAUTH_SECRET="SECURE_RANDOM_SECRET_FROM_SECRET_MANAGER"
NEXTAUTH_URL="https://app.htacalibration.com"
AUTH_URL="https://app.htacalibration.com"
AUTH_TRUST_HOST="true"

# Storage
GCS_CERTIFICATES_BUCKET="hta-calibration-prod-certificates-prod"
GCS_SIGNATURES_BUCKET="hta-calibration-prod-signatures-prod"
GCS_UPLOADS_BUCKET="hta-calibration-prod-uploads-prod"

# Logging
LOG_LEVEL="warn"
NODE_ENV="production"
```

---

## Kubernetes ConfigMap

### Base ConfigMap

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
  GCS_SIGNATURES_BUCKET: "hta-calibration-prod-signatures-dev"
  GCS_UPLOADS_BUCKET: "hta-calibration-prod-uploads-dev"
  LOG_LEVEL: "info"
```

### Environment Overlay

```yaml
# k8s/overlays/production/configmap-patch.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: hta-config
  namespace: hta-calibration
data:
  NEXTAUTH_URL: "https://app.htacalibration.com"
  AUTH_URL: "https://app.htacalibration.com"
  GCS_CERTIFICATES_BUCKET: "hta-calibration-prod-certificates-prod"
  LOG_LEVEL: "warn"
```

---

## Kubernetes Secrets

### Create Secrets

```bash
# Create secret from literals
kubectl create secret generic hta-secrets \
  -n hta-calibration \
  --from-literal=database-url='postgresql://...' \
  --from-literal=nextauth-secret='...'

# Create from file
kubectl create secret generic hta-secrets \
  -n hta-calibration \
  --from-file=database-url=./secrets/database-url.txt \
  --from-file=nextauth-secret=./secrets/nextauth-secret.txt
```

### Update Secrets

```bash
# Delete and recreate
kubectl delete secret hta-secrets -n hta-calibration
kubectl create secret generic hta-secrets ...

# Or patch specific key
kubectl patch secret hta-secrets -n hta-calibration \
  -p='{"stringData":{"database-url":"NEW_VALUE"}}'
```

---

## Validation

### Check Environment

```typescript
// src/lib/env.ts
const requiredEnvVars = [
  'DATABASE_URL',
  'NEXTAUTH_SECRET',
  'NEXTAUTH_URL',
]

export function validateEnv() {
  const missing = requiredEnvVars.filter(v => !process.env[v])
  if (missing.length > 0) {
    throw new Error(`Missing required environment variables: ${missing.join(', ')}`)
  }
}
```

### Debug Environment

```bash
# In pod
kubectl exec deployment/hta-web -n hta-calibration -- printenv | sort

# Specific variable
kubectl exec deployment/hta-web -n hta-calibration -- printenv DATABASE_URL
```

---

## Security Best Practices

1. **Never commit secrets** to Git
2. **Use Kubernetes Secrets** for sensitive values
3. **Rotate secrets** regularly
4. **Different secrets** per environment
5. **Audit access** to secrets
6. **Use Secret Manager** for additional security

---

## Key Files

| File | Purpose |
|------|---------|
| `.env.local` | Local development |
| `.env.example` | Template (committed) |
| `k8s/base/configmap.yaml` | Non-sensitive config |
| Kubernetes Secret | Sensitive values |
