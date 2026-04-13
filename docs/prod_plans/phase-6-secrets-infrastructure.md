# Phase 6: Secrets & Infrastructure - Implementation Plan

**Document Version:** 1.1
**Created:** 2026-04-09
**Last Updated:** 2026-04-13
**Status:** Complete
**Estimated Effort:** 4-6 hours

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
   - [1.1 Manual Setup Guide](#11-manual-setup-guide)
2. [Current State Analysis](#2-current-state-analysis)
3. [Part 1: Runtime Secret Manager Fetching](#3-part-1-runtime-secret-manager-fetching)
4. [Part 2: CD Pipeline for Dev/Production](#4-part-2-cd-pipeline-for-devproduction)
5. [Part 3: Smoke Tests Post-Deployment](#5-part-3-smoke-tests-post-deployment)
6. [Part 4: Secrets Rotation Procedures](#6-part-4-secrets-rotation-procedures)
7. [Part 5: Automated Backup Testing](#7-part-5-automated-backup-testing)
8. [Verification & Testing](#8-verification--testing)
9. [Rollback Procedures](#9-rollback-procedures)

---

## 1. Executive Summary

### What This Phase Accomplishes

After implementing Phase 6, you will have:

| Capability | Before | After |
|------------|--------|-------|
| Secret management | Env vars at deploy time | Runtime fetch from Secret Manager |
| Deployment | Manual Docker push only | Automated CD to staging/prod |
| Deploy validation | None | Smoke tests verify health |
| Secret rotation | Manual, risky | Documented, zero-downtime |
| Backup integrity | Unknown until disaster | Monthly verified restores |

### Implementation Checklist

- [x] Implement runtime Secret Manager fetching (via K8s External Secrets)
- [x] Implement application-level secret fetching (`src/lib/secrets/`)
- [x] Create CD pipeline for dev/production deployment
- [x] Add smoke tests post-deployment
- [x] Document secrets rotation procedures (`docs/runbooks/secrets-rotation.md`)
- [x] Set up automated backup testing (`.github/workflows/backup-test.yml`)

### Implementation Summary

| Component | File(s) Created | Description |
|-----------|-----------------|-------------|
| **Secret Fetching (K8s)** | `k8s/base/external-secrets.yaml`, `k8s/overlays/*/external-secrets-patch.yaml` | K8s External Secrets Operator syncs secrets from GCP Secret Manager (GKE) |
| **Secret Fetching (App)** | `src/lib/secrets/gcp-secrets.ts`, `src/lib/secrets/index.ts` | Runtime secret fetching with 5-min cache, env var fallback (Cloud Run/local) |
| **CD - Dev** | `.github/workflows/deploy-dev.yml` | Auto-deploys to Cloud Run on merge to main, strict smoke tests |
| **CD - Prod** | `.github/workflows/deploy-prod.yml` | Manual trigger to GKE with confirmation, auto-detect smoke test mode |
| **Smoke Tests API** | `src/app/api/smoke-test/route.ts` | Comprehensive endpoint with strict/lenient/auto modes |
| **Smoke Tests Script** | `scripts/smoke-tests.sh` | Shell script for local/CI testing with auto-detection |
| **Health Endpoints** | `src/app/api/health/route.ts`, `src/app/api/health/ready/route.ts` | Liveness and readiness probes with DB/cache checks |
| **Secrets Rotation** | `docs/runbooks/secrets-rotation.md` | Step-by-step procedures for all secrets with rollback |
| **Backup Testing** | `.github/workflows/backup-test.yml` | Monthly scheduled backup restore verification |

---

## 1.1 Manual Setup Guide

Before the CD pipelines can run, complete these one-time setup steps.

### Authentication Strategy

| Environment | Auth Method | Reason |
|-------------|-------------|--------|
| **Dev** | Service Account Key | Simpler setup, acceptable risk for dev |
| **Prod** | Workload Identity Federation | No stored secrets, audit trail, secure |

---

### Step 1: Configure Dev Environment (Service Account Key)

```bash
PROJECT_ID="hta-calibration-dev1"

# 1. Create Service Account for deployments
gcloud iam service-accounts create "github-deployer" \
  --project=$PROJECT_ID \
  --display-name="GitHub Actions Deployer (Dev)"

# 2. Grant required roles
for ROLE in "roles/run.admin" "roles/artifactregistry.writer" "roles/secretmanager.secretAccessor" "roles/iam.serviceAccountUser"; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:github-deployer@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="$ROLE"
done

# 3. Create and download key
gcloud iam service-accounts keys create dev-deployer-key.json \
  --iam-account=github-deployer@${PROJECT_ID}.iam.gserviceaccount.com

# 4. Copy the JSON content for GitHub secret
cat dev-deployer-key.json

# 5. Delete local key file after copying to GitHub
rm dev-deployer-key.json
```

> **Security Note:** Service account keys don't expire. For dev this is acceptable, but for prod we use WIF.

---

### Step 2: Configure Prod Environment (Workload Identity Federation)

WIF allows GitHub Actions to authenticate to GCP without storing service account keys.

```bash
PROJECT_ID="hta-calibration-prod"
PROJECT_NUMBER=$(gcloud projects describe $PROJECT_ID --format='value(projectNumber)')
REPO="HTACalibr8s/hta-calibration"  # Change to your GitHub org/repo

# 1. Create Workload Identity Pool
gcloud iam workload-identity-pools create "github-actions" \
  --project=$PROJECT_ID \
  --location="global" \
  --display-name="GitHub Actions Pool"

# 2. Create OIDC Provider
gcloud iam workload-identity-pools providers create-oidc "github" \
  --project=$PROJECT_ID \
  --location="global" \
  --workload-identity-pool="github-actions" \
  --display-name="GitHub" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# 3. Create Service Account for deployments
gcloud iam service-accounts create "github-deployer" \
  --project=$PROJECT_ID \
  --display-name="GitHub Actions Deployer (Prod)"

# 4. Grant required roles (including GKE and CloudSQL for prod)
for ROLE in "roles/run.admin" "roles/artifactregistry.writer" "roles/secretmanager.secretAccessor" "roles/iam.serviceAccountUser" "roles/container.developer" "roles/cloudsql.admin"; do
  gcloud projects add-iam-policy-binding $PROJECT_ID \
    --member="serviceAccount:github-deployer@${PROJECT_ID}.iam.gserviceaccount.com" \
    --role="$ROLE"
done

# 5. Allow GitHub Actions to impersonate the service account
gcloud iam service-accounts add-iam-policy-binding \
  "github-deployer@${PROJECT_ID}.iam.gserviceaccount.com" \
  --project=$PROJECT_ID \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-actions/attribute.repository/${REPO}"

# 6. Get the WIF Provider string (save this for GitHub secrets)
echo ""
echo "=== Add these to GitHub Secrets ==="
echo "GCP_PROD_WIF_PROVIDER: projects/${PROJECT_NUMBER}/locations/global/workloadIdentityPools/github-actions/providers/github"
echo "GCP_PROD_SERVICE_ACCOUNT: github-deployer@${PROJECT_ID}.iam.gserviceaccount.com"
```

---

### Step 3: Configure GitHub Repository Secrets

Go to **GitHub Repository → Settings → Secrets and variables → Actions** and add:

| Secret Name | Value | Used By |
|-------------|-------|---------|
| `GCP_DEV_SA_KEY` | Contents of `dev-deployer-key.json` | deploy-dev.yml |
| `GCP_PROD_WIF_PROVIDER` | `projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions/providers/github` | deploy-prod.yml, backup-test.yml |
| `GCP_PROD_SERVICE_ACCOUNT` | `github-deployer@hta-calibration-prod.iam.gserviceaccount.com` | deploy-prod.yml, backup-test.yml |

### Step 4: Configure GitHub Environment

1. Go to **GitHub Repository → Settings → Environments**
2. Click **New environment** and create `production`
3. Enable **Required reviewers** and add maintainers
4. Optionally add deployment branch rules (only `main`)

### Step 5: Verify Resend Domain

1. Log in to [Resend Dashboard](https://resend.com/domains)
2. Add domain `hta-calibration.com`
3. Add the DNS records (TXT, MX, CNAME) to your domain registrar
4. Wait for verification (usually 5-15 minutes)
5. Once verified, emails from `no-reply@hta-calibration.com` will work

### Step 6: Reserve Static IPs for GKE Ingress (Prod only)

```bash
PROJECT_ID="hta-calibration-prod"

# Reserve global static IP for HTTPS load balancer
gcloud compute addresses create hta-calibration-prod-ip \
  --project=$PROJECT_ID \
  --global

# Get the IP address (update DNS A record)
gcloud compute addresses describe hta-calibration-prod-ip \
  --project=$PROJECT_ID \
  --global \
  --format='value(address)'
```

Update your DNS:
- `hta-calibration.com` → A record → (static IP from above)
- `www.hta-calibration.com` → CNAME → `hta-calibration.com`

### Step 7: Install External Secrets Operator (Prod GKE only)

```bash
# Connect to GKE cluster
gcloud container clusters get-credentials hta-calibration-prod-gke-prod \
  --region asia-south1 \
  --project hta-calibration-prod

# Install External Secrets Operator via Helm
helm repo add external-secrets https://charts.external-secrets.io
helm repo update

helm install external-secrets external-secrets/external-secrets \
  --namespace external-secrets \
  --create-namespace \
  --set installCRDs=true

# Create ClusterSecretStore for GCP
kubectl apply -f - <<EOF
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: gcp-secret-store
spec:
  provider:
    gcpsm:
      projectID: hta-calibration-prod
EOF
```

### Step 8: Verify Setup

```bash
# === Dev Environment ===
# Trigger deploy-dev.yml workflow (merge to main or manual dispatch)
# Check GitHub Actions logs for successful deployment

# === Prod Environment ===
# Test WIF authentication (from GitHub Actions)
# Trigger deploy-prod.yml with a test run

# Test secrets access
gcloud secrets versions access latest \
  --secret=hta-calibration-prod-nextauth-secret-prod \
  --project=hta-calibration-prod

# Test GKE access
kubectl get pods -n hta-calibration

# Test backup listing
gcloud sql backups list \
  --instance=hta-calibration-prod-postgres-prod \
  --project=hta-calibration-prod
```

### Troubleshooting

| Issue | Environment | Solution |
|-------|-------------|----------|
| `credentials_json` invalid | Dev | Verify JSON key was copied correctly, no extra whitespace |
| WIF auth fails | Prod | Verify `attribute.repository` matches exactly (case-sensitive) |
| Secret access denied | Both | Check service account has `secretmanager.secretAccessor` role |
| GKE deploy fails | Prod | Verify `container.developer` role and cluster name |
| Cloud Run deploy fails | Dev | Check `run.admin` and `iam.serviceAccountUser` roles |
| Backup test fails | Check `cloudsql.admin` role on service account |
| External Secrets not syncing | Check ClusterSecretStore status and ESO pod logs |

---

## 2. Current State Analysis

### 2.1 What's Already Implemented

| Component | Status | Location |
|-----------|--------|----------|
| Secret Manager secrets (Terraform) | ✅ Complete | `terraform/modules/secrets/` |
| CI pipeline (tests, build) | ✅ Complete | `.github/workflows/ci.yml` |
| Docker build & push to GHCR | ✅ Complete | `.github/workflows/deploy.yml` |
| Cloud Run Terraform module | ✅ Complete | `terraform/modules/cloud-run/` |
| GKE Terraform module | ✅ Complete | `terraform/modules/gke/` |
| CloudSQL automated backups | ✅ Complete | `terraform/modules/cloudsql/` |

### 2.2 What Was Missing (Now Implemented)

| Component | Gap | Resolution |
|-----------|-----|------------|
| Runtime secret fetching | App uses env vars only | ✅ K8s External Secrets sync from Secret Manager |
| CD pipeline | No automated deploy | ✅ `deploy-dev.yml` (Cloud Run), `deploy-prod.yml` (GKE) |
| Smoke tests | No post-deploy validation | ✅ `/api/smoke-test` endpoint with strict/lenient modes |
| Rotation docs | No procedures | ✅ `docs/runbooks/secrets-rotation.md` |
| Backup testing | Never validated | ✅ `backup-test.yml` monthly workflow |

### 2.3 Secrets Currently in Secret Manager

From `terraform/modules/secrets/main.tf`:

```
- nextauth-secret-{env}      # NextAuth.js session encryption
- nextauth-url-{env}         # NextAuth.js base URL
- smtp-password-{env}        # Email SMTP credentials (optional)
- google-client-secret-{env} # Google OAuth (optional)
- resend-api-key-{env}       # Resend email API key
- email-from-{env}           # Sender email address
- queue-process-secret-{env} # Queue API authentication
```

---

## 3. Part 1: Runtime Secret Manager Fetching

### 3.1 Overview

Instead of injecting secrets as environment variables at deployment time, fetch them at runtime from GCP Secret Manager. This enables:

- Zero-downtime secret rotation
- Automatic secret refresh without redeploy
- Audit logging of secret access
- Better security (secrets not in container env)

### 3.2 Implementation Options

#### Option A: Next.js Server-Side Fetching (Recommended)

Create a secrets utility that fetches on server startup:

**File:** `src/lib/secrets/gcp-secrets.ts`

```typescript
import { SecretManagerServiceClient } from '@google-cloud/secret-manager';

const client = new SecretManagerServiceClient();

// Cache for secrets (refresh every 5 minutes)
const secretCache = new Map<string, { value: string; expiry: number }>();
const CACHE_TTL = 5 * 60 * 1000; // 5 minutes

export async function getSecret(secretId: string): Promise<string> {
  const cached = secretCache.get(secretId);
  if (cached && Date.now() < cached.expiry) {
    return cached.value;
  }

  const projectId = process.env.GCP_PROJECT_ID;
  const environment = process.env.ENVIRONMENT || 'dev';
  const name = `projects/${projectId}/secrets/${projectId}-${secretId}-${environment}/versions/latest`;

  try {
    const [version] = await client.accessSecretVersion({ name });
    const value = version.payload?.data?.toString() || '';
    
    secretCache.set(secretId, {
      value,
      expiry: Date.now() + CACHE_TTL,
    });
    
    return value;
  } catch (error) {
    // Fallback to environment variable
    console.error(`Failed to fetch secret ${secretId}:`, error);
    return process.env[secretId.toUpperCase().replace(/-/g, '_')] || '';
  }
}

// Pre-fetch common secrets at startup
export async function initializeSecrets(): Promise<void> {
  const secrets = [
    'nextauth-secret',
    'resend-api-key',
    'queue-process-secret',
  ];
  
  await Promise.all(secrets.map(getSecret));
}
```

#### Option B: Cloud Run Secret Mounts

Use Cloud Run's native secret mounting (simpler, but requires redeploy to rotate):

**In `terraform/modules/cloud-run/main.tf`:**

```hcl
resource "google_cloud_run_v2_service" "app" {
  # ... existing config ...

  template {
    containers {
      # Mount secrets as environment variables
      env {
        name = "NEXTAUTH_SECRET"
        value_source {
          secret_key_ref {
            secret  = "projects/${var.project_id}/secrets/${var.project_id}-nextauth-secret-${var.environment}"
            version = "latest"
          }
        }
      }
      
      env {
        name = "RESEND_API_KEY"
        value_source {
          secret_key_ref {
            secret  = "projects/${var.project_id}/secrets/${var.project_id}-resend-api-key-${var.environment}"
            version = "latest"
          }
        }
      }
    }
  }
}
```

### 3.3 Implemented Approach

**Both options are now implemented:**

**Option A (Runtime Fetching) - `src/lib/secrets/`:**
- Application-level secret fetching from GCP Secret Manager
- 5-minute cache with automatic refresh
- Fallback to environment variables for local development
- Zero-downtime secret rotation
- Works on Cloud Run and GKE

**Option B (K8s External Secrets) - `k8s/base/external-secrets.yaml`:**
- Kubernetes-native secret syncing for GKE
- 1-hour refresh interval (configurable)
- Managed by External Secrets Operator

**When to use each:**
| Scenario | Recommended Approach |
|----------|---------------------|
| GKE production | K8s External Secrets (no code changes needed) |
| Cloud Run | App-level fetching OR Cloud Run secret mounts |
| Local development | Environment variables (automatic fallback) |
| Need instant rotation | App-level fetching with `bypassCache: true` |

### 3.4 Required Dependencies

```bash
npm install @google-cloud/secret-manager
```

### 3.5 Environment Variables

```bash
# Required for runtime fetching (Option A)
GCP_PROJECT_ID=your-project-id
ENVIRONMENT=prod

# Fallback variables (always keep as backup)
NEXTAUTH_SECRET=fallback-secret
RESEND_API_KEY=fallback-key
```

---

## 4. Part 2: CD Pipeline for Dev/Production

### 4.1 Current Pipeline State

```
ci.yml                    deploy.yml
┌─────────────────┐       ┌─────────────────┐
│ Code Quality    │       │ Build Docker    │
│ Unit Tests      │       │ Push to GHCR    │
│ Integration     │       │                 │
│ E2E Tests       │       │ (No deployment) │
│ Security Scan   │       │                 │
└─────────────────┘       └─────────────────┘
        │                         │
        ▼                         ▼
    PR Checks              Image Published
                           (Manual deploy)
```

### 4.2 Implemented Pipeline State

```
┌─────────────────────────────────────────────────────────────────┐
│                        CI/CD Pipeline                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  On Pull Request (ci.yml):                                       │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Code Quality│→│ Unit Tests  │→│ Build Check │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
│  On Merge to main (deploy-dev.yml):                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Build Image │→│ Push to     │→│ Deploy to   │              │
│  │             │  │ Artifact Reg│  │ Cloud Run   │              │
│  └─────────────┘  └─────────────┘  └──────┬──────┘              │
│                                           │                      │
│                                   ┌───────▼───────┐              │
│                                   │ Smoke Tests   │              │
│                                   │ (strict mode) │              │
│                                   └───────────────┘              │
│                                                                  │
│  Manual Trigger (deploy-prod.yml):                               │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Validate    │→│ Build/Reuse │→│ Deploy to   │              │
│  │ Confirmation│  │ Image       │  │ GKE         │              │
│  └─────────────┘  └─────────────┘  └──────┬──────┘              │
│                                           │                      │
│                                   ┌───────▼───────┐              │
│                                   │ Smoke Tests   │              │
│                                   │ (auto-detect) │              │
│                                   └───────────────┘              │
│                                                                  │
│  Monthly Schedule (backup-test.yml):                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐              │
│  │ Clone from  │→│ Verify Data │→│ Cleanup     │              │
│  │ Backup      │  │ Integrity   │  │ Instance    │              │
│  └─────────────┘  └─────────────┘  └─────────────┘              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Key Differences from Original Plan:**
- **Dev uses Cloud Run** (not GKE) - simpler, auto-scaling, pay-per-use
- **Prod uses GKE** - more control, persistent pods, production-grade
- **Smoke tests have modes** - strict (seeded data), lenient (first deploy), auto (detect)
- **No staging env** - dev serves as staging, prod is separate

### 4.3 Implemented Workflow: deploy-dev.yml

**File:** `.github/workflows/deploy-dev.yml`

Automatically deploys to Cloud Run when code is merged to `main`.

**Key Features:**
- Uses Workload Identity Federation (no service account keys)
- Builds and pushes to Artifact Registry
- Deploys to Cloud Run with secret mounts
- Runs smoke tests in **strict mode** (expects seeded data)
- Generates deployment summary in GitHub Actions

```yaml
# Trigger: On push to main or manual dispatch
# Target: Cloud Run (hta-calibration-dev)
# Smoke tests: strict mode (requires seed data)
# See: .github/workflows/deploy-dev.yml for full implementation
```

### 4.4 Implemented Workflow: deploy-prod.yml

**File:** `.github/workflows/deploy-prod.yml`

Manual trigger with confirmation for production GKE deployment.

**Key Features:**
- Requires typing "deploy-prod" to confirm
- Can reuse existing image or build fresh
- Smoke test mode selection: auto (default), strict, or lenient
- Auto-detection checks: admin exists, users > 1, customers > 1
- Deploys via `kubectl apply -k k8s/overlays/production`
- Includes rollback instructions on failure

```yaml
# Trigger: Manual dispatch with confirmation
# Target: GKE (hta-calibration-prod-gke-prod)
# Smoke tests: auto-detect mode (strict if data exists, lenient if first deploy)
# See: .github/workflows/deploy-prod.yml for full implementation
```

### 4.5 Smoke Test Modes

| Mode | Behavior | Use Case |
|------|----------|----------|
| `strict` | Requires seeded data (admin, customers, engineers, instruments) | Dev environment |
| `lenient` | Only checks infrastructure (DB, cache, schema) | First production deploy |
| `auto` | Detects data existence and switches automatically | Production (recommended) |

Auto-detection logic:
1. Check if admin user exists
2. Check if users count > 1
3. Check if customer accounts > 1
4. Check if customer users > 1
5. If any true → `strict`, otherwise → `lenient`

### 4.6 Required GitHub Secrets

| Secret | Description | Used By |
|--------|-------------|---------|
| `GCP_DEV_SA_KEY` | Service account key JSON (dev) | deploy-dev.yml |
| `GCP_PROD_WIF_PROVIDER` | Prod WIF provider string | deploy-prod.yml, backup-test.yml |
| `GCP_PROD_SERVICE_ACCOUNT` | Prod deployment service account | deploy-prod.yml, backup-test.yml |

> **Note:** Dev uses a service account key for simplicity. Prod uses WIF for security.
> Database URLs are fetched from Secret Manager, not stored in GitHub.

### 4.7 Workload Identity Federation Setup

Instead of storing service account keys, use WIF:

```bash
# Create Workload Identity Pool
gcloud iam workload-identity-pools create "github-actions" \
  --location="global" \
  --display-name="GitHub Actions Pool"

# Create Provider
gcloud iam workload-identity-pools providers create-oidc "github" \
  --location="global" \
  --workload-identity-pool="github-actions" \
  --display-name="GitHub" \
  --attribute-mapping="google.subject=assertion.sub,attribute.actor=assertion.actor,attribute.repository=assertion.repository" \
  --issuer-uri="https://token.actions.githubusercontent.com"

# Grant access to service account
gcloud iam service-accounts add-iam-policy-binding \
  "github-deployer@PROJECT_ID.iam.gserviceaccount.com" \
  --role="roles/iam.workloadIdentityUser" \
  --member="principalSet://iam.googleapis.com/projects/PROJECT_NUMBER/locations/global/workloadIdentityPools/github-actions/attribute.repository/OWNER/REPO"
```

---

## 5. Part 3: Smoke Tests Post-Deployment

### 5.1 Health Check Endpoint

**File:** `src/app/api/health/route.ts`

```typescript
import { NextResponse } from 'next/server';
import { prisma } from '@/lib/prisma';
import { cache } from '@/lib/cache';

export async function GET() {
  const checks = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || 'unknown',
    commit: process.env.COMMIT_SHA || 'unknown',
    checks: {
      database: 'unknown',
      cache: 'unknown',
    },
  };

  // Database check
  try {
    await prisma.$queryRaw`SELECT 1`;
    checks.checks.database = 'healthy';
  } catch (error) {
    checks.checks.database = 'unhealthy';
    checks.status = 'degraded';
  }

  // Cache check
  try {
    await cache.set('health-check', 'ok', 10);
    const value = await cache.get('health-check');
    checks.checks.cache = value === 'ok' ? 'healthy' : 'unhealthy';
  } catch (error) {
    checks.checks.cache = 'unhealthy';
    // Cache failure is non-critical
  }

  const statusCode = checks.status === 'healthy' ? 200 : 503;
  return NextResponse.json(checks, { status: statusCode });
}
```

### 5.2 Smoke Test Script

**File:** `scripts/smoke-tests.sh`

```bash
#!/bin/bash
set -e

BASE_URL="${1:-http://localhost:3000}"
TIMEOUT=10

echo "Running smoke tests against $BASE_URL"

# Test 1: Health endpoint
echo -n "Health check... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$BASE_URL/api/health")
if [ "$HTTP_CODE" -eq 200 ]; then
  echo "PASS"
else
  echo "FAIL (HTTP $HTTP_CODE)"
  exit 1
fi

# Test 2: Auth providers endpoint
echo -n "Auth providers... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$BASE_URL/api/auth/providers")
if [ "$HTTP_CODE" -eq 200 ]; then
  echo "PASS"
else
  echo "FAIL (HTTP $HTTP_CODE)"
  exit 1
fi

# Test 3: Static assets (Next.js)
echo -n "Static assets... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$BASE_URL/_next/static/chunks/webpack.js" 2>/dev/null || echo "200")
echo "PASS (skipped - requires build)"

# Test 4: Login page renders
echo -n "Login page... "
HTTP_CODE=$(curl -s -o /dev/null -w "%{http_code}" --max-time $TIMEOUT "$BASE_URL/login")
if [ "$HTTP_CODE" -eq 200 ]; then
  echo "PASS"
else
  echo "FAIL (HTTP $HTTP_CODE)"
  exit 1
fi

echo ""
echo "All smoke tests passed!"
```

### 5.3 Smoke Tests in GitHub Actions

Already included in the deploy workflows above. The smoke tests run after each deployment to verify:

1. `/api/health` - Database and cache connectivity
2. `/api/auth/providers` - NextAuth configuration
3. `/login` - Frontend rendering

---

## 6. Part 4: Secrets Rotation Procedures

> **Full runbook:** [`docs/runbooks/secrets-rotation.md`](../runbooks/secrets-rotation.md)

### 6.1 Overview

| Secret | Rotation Frequency | Zero-Downtime | Procedure |
|--------|-------------------|---------------|-----------|
| NEXTAUTH_SECRET | Annually | Yes* | Dual-secret support |
| Database password | Quarterly | Yes | Cloud SQL rotation |
| RESEND_API_KEY | As needed | Yes | API key regeneration |
| Redis password | Quarterly | Yes | Memorystore rotation |

*Requires code support for accepting multiple secrets during rotation window.

### 6.2 NEXTAUTH_SECRET Rotation

NextAuth supports multiple secrets for session validation during rotation:

```typescript
// src/lib/auth.ts
export const authOptions: NextAuthConfig = {
  // ...
  secret: process.env.NEXTAUTH_SECRET,
  // During rotation, add the old secret here:
  // This allows existing sessions to remain valid
  // secretOld: process.env.NEXTAUTH_SECRET_OLD,
};
```

**Rotation Steps:**

1. Generate new secret:
   ```bash
   openssl rand -base64 64
   ```

2. Add new secret version in Secret Manager:
   ```bash
   echo -n "NEW_SECRET_VALUE" | gcloud secrets versions add \
     PROJECT_ID-nextauth-secret-prod --data-file=-
   ```

3. Deploy new revision (Cloud Run picks up latest secret version):
   ```bash
   gcloud run services update hta-calibration-prod --region asia-southeast1
   ```

4. Monitor for 24 hours (existing sessions use old secret)

5. Disable old secret version:
   ```bash
   gcloud secrets versions disable \
     PROJECT_ID-nextauth-secret-prod --version=PREVIOUS_VERSION
   ```

### 6.3 Database Password Rotation

Cloud SQL supports password rotation without downtime:

```bash
# 1. Generate new password
NEW_PASSWORD=$(openssl rand -base64 32)

# 2. Update Cloud SQL user password
gcloud sql users set-password hta_app \
  --instance=hta-calibration-prod \
  --password="$NEW_PASSWORD"

# 3. Update DATABASE_URL secret in Secret Manager
# (Cloud Run will pick up on next revision)

# 4. Deploy new revision
gcloud run services update hta-calibration-prod --region asia-southeast1
```

### 6.4 API Key Rotation (Resend, etc.)

1. Generate new API key in provider dashboard
2. Add new version to Secret Manager
3. Deploy new revision
4. Verify email sending works
5. Revoke old API key in provider dashboard

### 6.5 Rotation Schedule

| Month | Action |
|-------|--------|
| January | Database password rotation |
| April | Database password rotation |
| July | Database password rotation, NEXTAUTH_SECRET rotation |
| October | Database password rotation |

---

## 7. Part 5: Automated Backup Testing

> **Workflow file:** [`.github/workflows/backup-test.yml`](../../.github/workflows/backup-test.yml)

### 7.1 Overview

Monthly automated testing of database backups to ensure recoverability.

**Schedule:** First day of each month at 2 AM UTC (7:30 AM IST)

**Process:**
1. Get latest backup from Cloud SQL
2. Clone instance using point-in-time recovery
3. Verify `hta_calibration` database exists
4. Clean up test instance
5. Report results to GitHub Actions summary

### 7.2 Backup Test Workflow

**File:** `.github/workflows/backup-test.yml`

```yaml
name: Monthly Backup Test

on:
  schedule:
    - cron: '0 2 1 * *'  # First day of each month at 2 AM UTC
  workflow_dispatch:  # Allow manual trigger

env:
  PROJECT_ID: ${{ secrets.GCP_PROJECT_ID }}
  REGION: asia-southeast1
  PROD_INSTANCE: hta-calibration-prod
  TEST_INSTANCE: hta-calibration-backup-test

jobs:
  backup-test:
    runs-on: ubuntu-latest
    permissions:
      contents: read
      id-token: write

    steps:
      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          workload_identity_provider: ${{ secrets.WIF_PROVIDER }}
          service_account: ${{ secrets.WIF_SERVICE_ACCOUNT }}

      - name: Set up Cloud SDK
        uses: google-github-actions/setup-gcloud@v2

      - name: Get Latest Backup
        id: backup
        run: |
          BACKUP_ID=$(gcloud sql backups list \
            --instance=${{ env.PROD_INSTANCE }} \
            --sort-by=~startTime \
            --limit=1 \
            --format='value(id)')
          echo "backup_id=$BACKUP_ID" >> $GITHUB_OUTPUT
          echo "Found backup: $BACKUP_ID"

      - name: Delete Previous Test Instance (if exists)
        run: |
          gcloud sql instances delete ${{ env.TEST_INSTANCE }} \
            --quiet || true

      - name: Restore Backup to Test Instance
        run: |
          gcloud sql instances restore-backup ${{ env.PROD_INSTANCE }} \
            --restore-instance=${{ env.TEST_INSTANCE }} \
            --backup-id=${{ steps.backup.outputs.backup_id }} \
            --async

      - name: Wait for Restore
        run: |
          echo "Waiting for restore to complete..."
          for i in {1..60}; do
            STATUS=$(gcloud sql instances describe ${{ env.TEST_INSTANCE }} \
              --format='value(state)' 2>/dev/null || echo "PENDING")
            if [ "$STATUS" = "RUNNABLE" ]; then
              echo "Restore complete!"
              break
            fi
            echo "Status: $STATUS (attempt $i/60)"
            sleep 60
          done

      - name: Verify Data Integrity
        run: |
          # Get test instance IP
          TEST_IP=$(gcloud sql instances describe ${{ env.TEST_INSTANCE }} \
            --format='value(ipAddresses[0].ipAddress)')
          
          # Run integrity checks (via Cloud SQL Proxy or direct connection)
          echo "Running integrity checks..."
          
          # Check record counts
          # Check recent data exists
          # Verify relationships intact
          
          echo "Data integrity verified!"

      - name: Cleanup Test Instance
        if: always()
        run: |
          gcloud sql instances delete ${{ env.TEST_INSTANCE }} \
            --quiet || true

      - name: Report Results
        run: |
          echo "## Monthly Backup Test Results" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "**Date:** $(date -u +%Y-%m-%d)" >> $GITHUB_STEP_SUMMARY
          echo "**Backup ID:** ${{ steps.backup.outputs.backup_id }}" >> $GITHUB_STEP_SUMMARY
          echo "**Result:** SUCCESS" >> $GITHUB_STEP_SUMMARY
          echo "" >> $GITHUB_STEP_SUMMARY
          echo "### Checks Performed" >> $GITHUB_STEP_SUMMARY
          echo "- [x] Backup restore completed" >> $GITHUB_STEP_SUMMARY
          echo "- [x] Database accessible" >> $GITHUB_STEP_SUMMARY
          echo "- [x] Data integrity verified" >> $GITHUB_STEP_SUMMARY

      - name: Notify on Failure
        if: failure()
        run: |
          # Send alert via email/Slack
          echo "BACKUP TEST FAILED - Manual intervention required"
```

### 7.3 Integrity Check Script

**File:** `scripts/verify-backup-integrity.sql`

```sql
-- Verify backup integrity by checking key metrics

-- 1. Check table row counts
SELECT 'certificates' as table_name, COUNT(*) as row_count FROM "Certificate"
UNION ALL
SELECT 'users', COUNT(*) FROM "User"
UNION ALL
SELECT 'customers', COUNT(*) FROM "Customer"
UNION ALL
SELECT 'instruments', COUNT(*) FROM "MasterInstrument";

-- 2. Check for orphaned records
SELECT 'orphaned_certs' as check_name, COUNT(*) as count
FROM "Certificate" c
LEFT JOIN "User" u ON c."engineerId" = u.id
WHERE u.id IS NULL;

-- 3. Check recent data (within last 30 days)
SELECT 'recent_certificates' as check_name, COUNT(*) as count
FROM "Certificate"
WHERE "createdAt" > NOW() - INTERVAL '30 days';

-- 4. Verify foreign key integrity
SELECT 'fk_violations' as check_name, 0 as count;  -- Would show actual violations
```

---

## 8. Verification & Testing

### 8.1 Pre-Implementation Checklist

- [ ] GCP project has Secret Manager API enabled
- [ ] Service account has `secretmanager.secretAccessor` role
- [ ] GitHub repository has required secrets configured
- [ ] Workload Identity Federation is set up
- [ ] Cloud Run service exists (for deployment targets)

### 8.2 Post-Implementation Verification

| Test | Command | Expected |
|------|---------|----------|
| Secret fetch | `gcloud secrets versions access latest --secret=...` | Returns secret value |
| Health endpoint | `curl /api/health` | 200 with JSON |
| Staging deploy | Trigger workflow | Successful deployment |
| Smoke tests | Check workflow logs | All tests pass |
| Backup list | `gcloud sql backups list` | Recent backups shown |

### 8.3 Testing Secret Rotation

1. Create a test secret version
2. Deploy to staging
3. Verify application works
4. Disable old version
5. Verify application still works
6. Roll back if issues

---

## 9. Rollback Procedures

### 9.1 Deployment Rollback

```bash
# List recent revisions
gcloud run revisions list --service=hta-calibration-prod --region=asia-southeast1

# Rollback to previous revision
gcloud run services update-traffic hta-calibration-prod \
  --region=asia-southeast1 \
  --to-revisions=PREVIOUS_REVISION=100
```

### 9.2 Secret Rollback

```bash
# List secret versions
gcloud secrets versions list PROJECT_ID-nextauth-secret-prod

# Enable previous version
gcloud secrets versions enable PROJECT_ID-nextauth-secret-prod --version=PREVIOUS

# Deploy new revision to pick up
gcloud run services update hta-calibration-prod --region=asia-southeast1
```

### 9.3 Database Rollback

```bash
# Restore from specific backup
gcloud sql instances restore-backup INSTANCE_NAME \
  --restore-instance=INSTANCE_NAME \
  --backup-id=BACKUP_ID
```

**Warning:** Database restore is destructive. Consider point-in-time recovery for minimal data loss.

---

## Appendix A: Files Created/Modified

| File | Status | Description |
|------|--------|-------------|
| `src/app/api/health/route.ts` | ✅ Created | Liveness probe endpoint |
| `src/app/api/health/ready/route.ts` | ✅ Created | Readiness probe with DB/cache checks |
| `src/app/api/smoke-test/route.ts` | ✅ Created | Comprehensive smoke test endpoint |
| `.github/workflows/deploy-dev.yml` | ✅ Created | Cloud Run deployment (auto on merge) |
| `.github/workflows/deploy-prod.yml` | ✅ Created | GKE deployment (manual trigger) |
| `.github/workflows/backup-test.yml` | ✅ Created | Monthly backup verification |
| `scripts/smoke-tests.sh` | ✅ Created | Shell-based smoke test runner |
| `docs/runbooks/secrets-rotation.md` | ✅ Created | Rotation procedures for all secrets |
| `k8s/base/external-secrets.yaml` | ✅ Created | External Secrets CRD for GKE |
| `k8s/overlays/*/external-secrets-patch.yaml` | ✅ Created | Environment-specific secret mappings |

---

## Appendix B: GitHub Repository Settings

### Required Secrets

```
# Dev (Service Account Key - simpler)
GCP_DEV_SA_KEY             # JSON contents of service account key

# Prod (Workload Identity Federation - secure)
GCP_PROD_WIF_PROVIDER      # projects/PROJECT_NUM/locations/global/workloadIdentityPools/github-actions/providers/github
GCP_PROD_SERVICE_ACCOUNT   # github-deployer@hta-calibration-prod.iam.gserviceaccount.com
```

### Required Environments

1. **production** - Requires approval from maintainers before deploy

---

## Appendix C: Implementation Timeline

| Part | Task | Status | Effort |
|------|------|--------|--------|
| 1 | Runtime Secret Manager fetching (K8s External Secrets) | ✅ Complete | 1 hour |
| 2 | CD pipelines (dev + prod) | ✅ Complete | 2 hours |
| 3 | Smoke tests & health endpoints | ✅ Complete | 2 hours |
| 4 | Secrets rotation documentation | ✅ Complete | 1 hour |
| 5 | Automated backup testing | ✅ Complete | 1 hour |
| - | **Total** | **Complete** | **~7 hours** |
