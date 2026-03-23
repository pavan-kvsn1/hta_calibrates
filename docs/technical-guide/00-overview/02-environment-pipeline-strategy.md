# Environment & Pipeline Strategy

## Table of Contents

1. [Overview](#overview)
2. [Environment Comparison Matrix](#environment-comparison-matrix)
3. [Local Development](#1-local-development)
4. [Development Environment (GKE)](#2-development-environment-gke)
5. [Staging Environment](#3-staging-environment)
6. [Production Environment](#4-production-environment)
7. [CI/CD Pipeline Deep Dive](#5-cicd-pipeline-deep-dive)
8. [Database Strategy Across Environments](#6-database-strategy-across-environments)
9. [Testing Strategy Evolution](#7-testing-strategy-evolution)
10. [Deployment Strategies](#8-deployment-strategies)
11. [Monitoring & Observability](#9-monitoring--observability)
12. [Rollback Procedures](#10-rollback-procedures)
13. [Security Considerations](#11-security-considerations)
14. [Checklist for Full Production Readiness](#12-checklist-for-full-production-readiness)

---

## Overview

This document describes how the HTA Calibration application evolves from a developer's laptop to a fully production-ready system. Each environment serves a specific purpose in the software delivery lifecycle.

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ENVIRONMENT PROGRESSION                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   LOCAL DEV        DEV (GKE)         STAGING            PRODUCTION          │
│   ─────────        ─────────         ───────            ──────────          │
│                                                                              │
│   Developer's  →   Shared team   →   Pre-prod       →   Live system         │
│   machine          testing           validation         Real users          │
│                                                                              │
│   SQLite       →   Cloud SQL     →   Cloud SQL      →   Cloud SQL (HA)     │
│   Seeded data      Seeded data       Sanitized prod     Real data          │
│                                                                              │
│   npm run dev  →   Docker/K8s    →   Docker/K8s     →   Docker/K8s         │
│   Hot reload       CI deployed       Same as prod       Canary + Full      │
│                                                                              │
│   Manual       →   Auto on PR    →   Auto on merge  →   Manual approval    │
│   testing          CI tests          Smoke tests        + monitoring        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Environment Comparison Matrix

| Aspect | Local | Dev (GKE) | Staging | Production |
|--------|-------|-----------|---------|------------|
| **Purpose** | Development | Integration testing | Pre-prod validation | Live system |
| **Database** | SQLite | Cloud SQL (shared) | Cloud SQL (isolated) | Cloud SQL (HA) |
| **Data** | Seeded test data | Seeded test data | Sanitized prod copy | Real customer data |
| **Replicas** | 1 (npm process) | 1 pod | 2 pods | 3+ pods (HPA) |
| **URL** | localhost:3000 | http://34.180.4.228 | staging.htacalibration.com | app.htacalibration.com |
| **SSL** | No | No | Yes | Yes |
| **Deploy Trigger** | Manual | Push to branch | Merge to main | Manual approval |
| **Deploy Time** | Instant | ~5 min | ~5 min | ~10 min (canary) |
| **Rollback** | Git checkout | kubectl rollout undo | kubectl rollout undo | kubectl rollout undo |
| **Monitoring** | Console logs | Cloud Logging | Cloud Logging | Full observability |
| **Alerts** | None | Slack (errors) | Slack (errors) | PagerDuty (critical) |
| **Who accesses** | Individual dev | Dev team | QA + Stakeholders | End users |

---

# 1. Local Development

## 1.1 Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                     LOCAL DEVELOPMENT                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌──────────────┐                                              │
│   │   Browser    │                                              │
│   │  localhost   │                                              │
│   └──────┬───────┘                                              │
│          │                                                       │
│          ▼                                                       │
│   ┌──────────────┐     ┌──────────────┐     ┌──────────────┐   │
│   │  Next.js Dev │     │   Prisma     │     │   SQLite     │   │
│   │   Server     │────▶│   Client     │────▶│   dev.db     │   │
│   │  (Port 3000) │     │              │     │   (file)     │   │
│   └──────────────┘     └──────────────┘     └──────────────┘   │
│          │                                                       │
│          │ Hot Module Replacement                                │
│          ▼                                                       │
│   ┌──────────────┐                                              │
│   │  File System │ ← Local uploads stored in ./uploads          │
│   └──────────────┘                                              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

## 1.2 Setup Commands

```bash
# Initial setup (one-time)
git clone https://github.com/your-org/hta-calibration.git
cd hta-calibration
npm install
cp .env.example .env.local

# Configure .env.local
DATABASE_URL="file:./dev.db"
NEXTAUTH_SECRET="local-dev-secret-min-32-characters"
NEXTAUTH_URL="http://localhost:3000"

# Initialize database
npx prisma generate
npx prisma db push
npx prisma db seed

# Start development
npm run dev
```

## 1.3 Daily Development Workflow

```mermaid
sequenceDiagram
    autonumber
    participant Dev as Developer
    participant Git as Git
    participant IDE as VS Code
    participant App as npm run dev
    participant DB as SQLite

    Dev->>Git: git checkout -b feature/new-feature
    Dev->>App: npm run dev
    App->>App: Start Next.js (port 3000)
    App->>DB: Connect to dev.db

    loop Development Cycle
        Dev->>IDE: Edit code
        IDE->>App: Hot reload triggered
        App-->>Dev: See changes instantly

        Dev->>IDE: Edit Prisma schema
        Dev->>DB: npx prisma db push
        DB-->>Dev: Schema synced

        Dev->>App: Test in browser
        App->>DB: Execute queries
        DB-->>App: Return data
    end

    Dev->>Git: git add && git commit
    Dev->>Git: git push origin feature/new-feature
    Note over Git: Triggers CI pipeline
```

## 1.4 Local Testing Commands

```bash
# Unit tests (watch mode for TDD)
npm test

# Unit tests (single run)
npm run test:run

# Integration tests with SQLite
npm run test:integration

# Integration tests with PostgreSQL (requires Docker)
npm run db:postgres:start
npm run test:integration:postgres
npm run db:postgres:stop

# E2E tests
npm run test:e2e

# E2E with visible browser
npm run test:e2e:headed

# All tests (before pushing)
npm run test:all
```

## 1.5 Local Database Operations

```bash
# View data in Prisma Studio
npx prisma studio
# Opens http://localhost:5555

# Reset database completely
rm -f ./dev.db ./prisma/dev.db
npx prisma db push
npx prisma db seed

# Create test data for specific scenario
npx ts-node scripts/seed-scenario.ts --scenario=pending-review

# Query database directly
sqlite3 ./dev.db "SELECT * FROM Certificate LIMIT 5;"
```

## 1.6 Local Environment Variables

```bash
# .env.local (complete example)

# Database
DATABASE_URL="file:./dev.db"

# Authentication
NEXTAUTH_SECRET="local-development-secret-32-chars-min"
NEXTAUTH_URL="http://localhost:3000"
AUTH_SECRET="local-development-secret-32-chars-min"

# Optional: Debug logging
LOG_LEVEL="debug"
DEBUG="prisma:query"

# Optional: Local file storage (instead of GCS)
USE_LOCAL_STORAGE="true"
LOCAL_UPLOAD_PATH="./uploads"

# Feature flags (test new features locally)
FF_NEW_PDF_GENERATOR="true"
FF_ENHANCED_CHAT="true"
```

## 1.7 Common Local Development Tasks

### Switch to PostgreSQL Locally
```bash
# Start PostgreSQL with Docker
docker compose -f docker-compose.dev.yml up -d postgres

# Update .env.local
DATABASE_URL="postgresql://hta_user:hta_dev_password@localhost:5432/hta_calibration"

# Push schema and seed
npx prisma db push
npx prisma db seed

# Now run dev server
npm run dev
```

### Test Docker Build Locally
```bash
# Build the production image
docker build -t hta-app:local .

# Run it locally
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://host.docker.internal:5432/hta_calibration" \
  -e NEXTAUTH_SECRET="test-secret" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  hta-app:local

# Test the endpoints
curl http://localhost:3000/api/health
```

---

# 2. Development Environment (GKE)

## 2.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     DEVELOPMENT ENVIRONMENT (GKE)                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐                                                          │
│   │   Browser    │                                                          │
│   │ 34.180.4.228 │                                                          │
│   └──────┬───────┘                                                          │
│          │                                                                   │
│          ▼                                                                   │
│   ┌──────────────────────────────────────────┐                              │
│   │        GCP Load Balancer                 │                              │
│   │        (No SSL in dev)                   │                              │
│   └──────────────────┬───────────────────────┘                              │
│                      │                                                       │
│                      ▼                                                       │
│   ┌──────────────────────────────────────────┐     ┌───────────────────┐   │
│   │            GKE Cluster                    │     │                   │   │
│   │  ┌─────────────────────────────────────┐ │     │   Cloud SQL       │   │
│   │  │     Namespace: hta-calibration      │ │     │   (PostgreSQL)    │   │
│   │  │  ┌─────────────┐                    │ │     │   db-f1-micro     │   │
│   │  │  │   Pod       │                    │ │     │                   │   │
│   │  │  │  hta-web    │◄───────────────────┼─┼────▶│   Private IP      │   │
│   │  │  │  (1 replica)│                    │ │     │   10.x.x.x        │   │
│   │  │  └─────────────┘                    │ │     │                   │   │
│   │  │                                     │ │     └───────────────────┘   │
│   │  │  ┌─────────────┐  ┌─────────────┐  │ │                              │
│   │  │  │  ConfigMap  │  │   Secret    │  │ │     ┌───────────────────┐   │
│   │  │  │  hta-config │  │ hta-secrets │  │ │     │   GCS Buckets     │   │
│   │  │  └─────────────┘  └─────────────┘  │ │     │   (dev)           │   │
│   │  └─────────────────────────────────────┘ │     │   - certificates  │   │
│   └──────────────────────────────────────────┘     │   - signatures    │   │
│                                                     │   - uploads       │   │
│                                                     └───────────────────┘   │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 2.2 Purpose

- **Integration testing** in a real Kubernetes environment
- **Team collaboration** - shared environment for testing features
- **CI/CD target** - automated deployments on PR/branch push
- **Infrastructure validation** - test Terraform changes before staging

## 2.3 Deployment Flow

```mermaid
sequenceDiagram
    autonumber
    participant Dev as Developer
    participant GH as GitHub
    participant CI as GitHub Actions
    participant REG as Artifact Registry
    participant GKE as GKE Dev Cluster

    Dev->>GH: Push to feature branch
    GH->>CI: Trigger CI workflow

    CI->>CI: Run all tests
    CI->>CI: Build Docker image
    CI->>REG: Push image with tag: sha-xxxxx

    CI->>GKE: kubectl apply -k k8s/overlays/development
    GKE->>REG: Pull image
    GKE->>GKE: Rolling update (1 pod)

    GKE->>GKE: Run migrations (docker-entrypoint.sh)
    GKE->>GKE: Health check passes

    CI-->>GH: Deployment complete
    GH-->>Dev: Check deployed at http://34.180.4.228
```

## 2.4 Dev Environment Configuration

### Kustomize Overlay
```yaml
# k8s/overlays/development/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: hta-calibration

resources:
  - ../../base

patches:
  - path: deployment-patch.yaml
  - path: configmap-patch.yaml
  - path: hpa-patch.yaml

images:
  - name: hta-app
    newName: asia-south1-docker.pkg.dev/hta-calibration-prod/hta-calibration/app
    newTag: latest
```

### Resource Limits (Dev)
```yaml
# k8s/overlays/development/deployment-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hta-web
spec:
  replicas: 1  # Single replica for dev
  template:
    spec:
      containers:
        - name: hta-web
          resources:
            requests:
              cpu: 250m
              memory: 512Mi
            limits:
              cpu: 500m
              memory: 1Gi
```

### ConfigMap (Dev)
```yaml
# k8s/overlays/development/configmap-patch.yaml
apiVersion: v1
kind: ConfigMap
metadata:
  name: hta-config
data:
  NODE_ENV: "production"
  NEXTAUTH_URL: "http://34.180.4.228"
  AUTH_URL: "http://34.180.4.228"
  AUTH_TRUST_HOST: "true"
  LOG_LEVEL: "debug"  # More logging in dev
  GCS_CERTIFICATES_BUCKET: "hta-calibration-certificates-dev"
  GCS_SIGNATURES_BUCKET: "hta-calibration-signatures-dev"
```

## 2.5 Accessing Dev Environment

```bash
# Get GKE credentials
gcloud container clusters get-credentials hta-calibration-gke-dev \
  --region asia-south1 \
  --project hta-calibration-prod

# Check deployment status
kubectl get pods -n hta-calibration
kubectl get svc -n hta-calibration

# View logs
kubectl logs -f deployment/hta-web -n hta-calibration

# Shell into pod
kubectl exec -it deployment/hta-web -n hta-calibration -- sh

# Port forward for local debugging
kubectl port-forward deployment/hta-web -n hta-calibration 3000:3000

# Restart deployment (pull latest image)
kubectl rollout restart deployment/hta-web -n hta-calibration
```

## 2.6 Dev Database Access

```bash
# Start Cloud SQL Proxy
cloud-sql-proxy hta-calibration-prod:asia-south1:hta-db-dev

# In another terminal, connect with psql
psql "postgresql://hta_app:PASSWORD@localhost:5432/hta_calibration"

# Or use Prisma Studio
DATABASE_URL="postgresql://hta_app:PASSWORD@localhost:5432/hta_calibration" \
  npx prisma studio

# Run migrations manually
DATABASE_URL="postgresql://..." npx prisma migrate deploy

# Seed dev database
DATABASE_URL="postgresql://..." npx prisma db seed
```

## 2.7 Dev Environment Lifecycle

```
┌─────────────────────────────────────────────────────────────────┐
│                  DEV ENVIRONMENT LIFECYCLE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  DAILY:                                                          │
│  • Multiple deployments from feature branches                    │
│  • Automatic deployment on every push                            │
│  • Database may be reset/reseeded as needed                     │
│                                                                  │
│  WEEKLY:                                                         │
│  • Review and clean up old test data                            │
│  • Verify infrastructure matches Terraform                       │
│  • Check resource utilization                                    │
│                                                                  │
│  ON DEMAND:                                                      │
│  • Full database reset with fresh seed                          │
│  • Infrastructure updates via Terraform                          │
│  • Debug specific issues from staging/prod                       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

# 3. Staging Environment

## 3.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        STAGING ENVIRONMENT                                   │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐                                                          │
│   │   Browser    │                                                          │
│   │  staging.    │                                                          │
│   │  htacalib... │                                                          │
│   └──────┬───────┘                                                          │
│          │ HTTPS                                                             │
│          ▼                                                                   │
│   ┌──────────────────────────────────────────┐                              │
│   │        GCP Load Balancer                 │                              │
│   │        + Managed SSL Certificate         │                              │
│   └──────────────────┬───────────────────────┘                              │
│                      │                                                       │
│                      ▼                                                       │
│   ┌──────────────────────────────────────────┐     ┌───────────────────┐   │
│   │            GKE Cluster                    │     │                   │   │
│   │  ┌─────────────────────────────────────┐ │     │   Cloud SQL       │   │
│   │  │     Namespace: hta-calibration      │ │     │   (PostgreSQL)    │   │
│   │  │  ┌─────────┐  ┌─────────┐          │ │     │   db-g1-small     │   │
│   │  │  │  Pod 1  │  │  Pod 2  │          │ │     │                   │   │
│   │  │  │ hta-web │  │ hta-web │◄─────────┼─┼────▶│   HA Enabled      │   │
│   │  │  └─────────┘  └─────────┘          │ │     │   (failover)      │   │
│   │  │                                     │ │     │                   │   │
│   │  │  ┌─────────────────────────────┐   │ │     └───────────────────┘   │
│   │  │  │      HPA (2-3 replicas)     │   │ │                              │
│   │  │  └─────────────────────────────┘   │ │     ┌───────────────────┐   │
│   │  └─────────────────────────────────────┘ │     │   GCS Buckets     │   │
│   └──────────────────────────────────────────┘     │   (staging)       │   │
│                                                     └───────────────────┘   │
│                                                                              │
│   ┌──────────────────────────────────────────┐                              │
│   │              Monitoring                   │                              │
│   │   Cloud Logging │ Cloud Monitoring       │                              │
│   │   Error Reporting │ Uptime Checks        │                              │
│   └──────────────────────────────────────────┘                              │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 3.2 Purpose

- **Pre-production validation** - exact replica of production
- **Stakeholder review** - QA team, product managers test here
- **Performance testing** - run load tests without affecting production
- **Data migration testing** - test migrations with realistic data
- **Integration testing** - test with real external services (if any)

## 3.3 Key Differences from Dev

| Aspect | Dev | Staging |
|--------|-----|---------|
| SSL | No | Yes (managed cert) |
| Domain | IP address | staging.htacalibration.com |
| Replicas | 1 | 2 (HPA: 2-3) |
| Data | Seeded test data | Sanitized production copy |
| Database | db-f1-micro | db-g1-small (HA) |
| Deploy trigger | Any branch push | Merge to main only |
| Smoke tests | Basic | Comprehensive |
| Access | Dev team | QA + Stakeholders |

## 3.4 Deployment Flow

```mermaid
sequenceDiagram
    autonumber
    participant Dev as Developer
    participant GH as GitHub
    participant CI as GitHub Actions
    participant REG as Artifact Registry
    participant STG as Staging GKE
    participant Slack as Slack

    Dev->>GH: Merge PR to main
    GH->>CI: Trigger deploy workflow

    Note over CI: Same image as will go to prod
    CI->>CI: Build Docker image
    CI->>CI: Tag: sha-xxxxx, main, latest
    CI->>REG: Push image

    CI->>STG: kubectl apply -k k8s/overlays/staging
    STG->>REG: Pull image
    STG->>STG: Rolling update (2 pods)

    STG->>STG: Run migrations
    STG->>STG: Health checks pass

    CI->>CI: Run smoke tests against staging

    alt Smoke Tests Pass
        CI->>Slack: "✅ Staging deployment successful"
        CI-->>GH: Ready for production
    else Smoke Tests Fail
        CI->>STG: kubectl rollout undo
        CI->>Slack: "❌ Staging deployment failed - rolled back"
        CI-->>GH: Block production deploy
    end
```

## 3.5 Staging Configuration

### Kustomize Overlay
```yaml
# k8s/overlays/staging/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: hta-calibration

resources:
  - ../../base
  - ingress.yaml
  - managed-certificate.yaml

patches:
  - path: deployment-patch.yaml
  - path: configmap-patch.yaml
  - path: hpa-patch.yaml

images:
  - name: hta-app
    newName: asia-south1-docker.pkg.dev/hta-calibration-prod/hta-calibration/app
    # Tag set by CI/CD
```

### Resource Limits (Staging)
```yaml
# k8s/overlays/staging/deployment-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hta-web
spec:
  replicas: 2
  template:
    spec:
      containers:
        - name: hta-web
          resources:
            requests:
              cpu: 500m
              memory: 1Gi
            limits:
              cpu: 1000m
              memory: 2Gi
```

### HPA (Staging)
```yaml
# k8s/overlays/staging/hpa-patch.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: hta-web-hpa
spec:
  minReplicas: 2
  maxReplicas: 3
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 70
```

### Ingress with SSL
```yaml
# k8s/overlays/staging/ingress.yaml
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: hta-web-ingress
  annotations:
    kubernetes.io/ingress.class: "gce"
    kubernetes.io/ingress.global-static-ip-name: "hta-staging-ip"
    networking.gke.io/managed-certificates: "hta-staging-cert"
spec:
  rules:
    - host: staging.htacalibration.com
      http:
        paths:
          - path: /*
            pathType: ImplementationSpecific
            backend:
              service:
                name: hta-web
                port:
                  number: 80
```

## 3.6 Staging Data Strategy

```mermaid
flowchart LR
    subgraph "Production"
        PDB[(Prod DB)]
    end

    subgraph "Data Pipeline"
        Export[Export backup]
        Sanitize[Sanitize PII]
        Transform[Transform data]
    end

    subgraph "Staging"
        SDB[(Staging DB)]
    end

    PDB --> Export
    Export --> Sanitize
    Sanitize --> Transform
    Transform --> SDB
```

### Data Sanitization Script
```typescript
// scripts/sanitize-for-staging.ts
// Run weekly to refresh staging data

interface SanitizationRules {
  table: string;
  columns: { [column: string]: 'hash' | 'fake' | 'mask' | 'keep' };
}

const rules: SanitizationRules[] = [
  {
    table: 'User',
    columns: {
      id: 'keep',
      email: 'fake',           // user123@example.com
      name: 'fake',            // John Doe → Test User 123
      passwordHash: 'hash',    // Reset to known test password
      role: 'keep',
      isActive: 'keep',
    }
  },
  {
    table: 'CustomerAccount',
    columns: {
      id: 'keep',
      companyName: 'fake',     // "Acme Corp" → "Test Company 123"
      address: 'mask',         // "123 Main St" → "*** Main St"
      phone: 'fake',
      email: 'fake',
    }
  },
  {
    table: 'CustomerUser',
    columns: {
      email: 'fake',
      name: 'fake',
      passwordHash: 'hash',    // Reset to known test password
    }
  },
  {
    table: 'Certificate',
    columns: {
      // Keep all technical data
      id: 'keep',
      certificateNumber: 'keep',
      status: 'keep',
      // Sanitize any PII in notes
      notes: 'mask',
    }
  },
];

// Execution: Weekly cron job
// 1. Take backup of prod
// 2. Restore to staging
// 3. Run sanitization
// 4. Verify data integrity
```

## 3.7 Smoke Tests for Staging

```typescript
// tests/smoke/staging.spec.ts
import { test, expect } from '@playwright/test';

const STAGING_URL = process.env.STAGING_URL || 'https://staging.htacalibration.com';

test.describe('Staging Smoke Tests', () => {

  test.describe('Health Checks', () => {
    test('API health endpoint', async ({ request }) => {
      const response = await request.get(`${STAGING_URL}/api/health`);
      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.status).toBe('healthy');
    });

    test('Database connectivity', async ({ request }) => {
      const response = await request.get(`${STAGING_URL}/api/health/ready`);
      expect(response.ok()).toBeTruthy();
      const body = await response.json();
      expect(body.database).toBe('connected');
    });
  });

  test.describe('Authentication', () => {
    test('Staff login page loads', async ({ page }) => {
      await page.goto(`${STAGING_URL}/login`);
      await expect(page.locator('form')).toBeVisible();
      await expect(page.locator('input[name="email"]')).toBeVisible();
    });

    test('Staff can login with test credentials', async ({ page }) => {
      await page.goto(`${STAGING_URL}/login`);
      await page.fill('input[name="email"]', process.env.SMOKE_TEST_EMAIL!);
      await page.fill('input[name="password"]', process.env.SMOKE_TEST_PASSWORD!);
      await page.click('button[type="submit"]');

      await expect(page).toHaveURL(/\/dashboard/);
    });

    test('Customer login page loads', async ({ page }) => {
      await page.goto(`${STAGING_URL}/customer/login`);
      await expect(page.locator('form')).toBeVisible();
    });
  });

  test.describe('Core Features', () => {
    test('Certificate list loads', async ({ page }) => {
      // Login first
      await page.goto(`${STAGING_URL}/login`);
      await page.fill('input[name="email"]', process.env.SMOKE_TEST_EMAIL!);
      await page.fill('input[name="password"]', process.env.SMOKE_TEST_PASSWORD!);
      await page.click('button[type="submit"]');

      // Navigate to certificates
      await page.goto(`${STAGING_URL}/certificates`);
      await expect(page.locator('table, [data-testid="certificate-list"]')).toBeVisible();
    });

    test('Can access new certificate form', async ({ page }) => {
      // Login and navigate
      await page.goto(`${STAGING_URL}/login`);
      await page.fill('input[name="email"]', process.env.SMOKE_TEST_EMAIL!);
      await page.fill('input[name="password"]', process.env.SMOKE_TEST_PASSWORD!);
      await page.click('button[type="submit"]');

      await page.goto(`${STAGING_URL}/certificates/new`);
      await expect(page.locator('form')).toBeVisible();
    });
  });

  test.describe('API Endpoints', () => {
    let authCookie: string;

    test.beforeAll(async ({ request }) => {
      // Get auth token
      const loginResponse = await request.post(`${STAGING_URL}/api/auth/callback/credentials`, {
        form: {
          email: process.env.SMOKE_TEST_EMAIL!,
          password: process.env.SMOKE_TEST_PASSWORD!,
        }
      });
      authCookie = loginResponse.headers()['set-cookie'] || '';
    });

    test('GET /api/certificates returns 200', async ({ request }) => {
      const response = await request.get(`${STAGING_URL}/api/certificates`, {
        headers: { Cookie: authCookie }
      });
      expect(response.ok()).toBeTruthy();
    });

    test('GET /api/notifications returns 200', async ({ request }) => {
      const response = await request.get(`${STAGING_URL}/api/notifications`, {
        headers: { Cookie: authCookie }
      });
      expect(response.ok()).toBeTruthy();
    });
  });
});
```

---

# 4. Production Environment

## 4.1 Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        PRODUCTION ENVIRONMENT                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   ┌──────────────┐     ┌──────────────┐                                     │
│   │   Browser    │     │   CDN        │                                     │
│   │  app.hta...  │────▶│  (optional)  │                                     │
│   └──────────────┘     └──────┬───────┘                                     │
│                               │ HTTPS                                        │
│                               ▼                                              │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │                    GCP Load Balancer                              │      │
│   │            + Cloud Armor (WAF/DDoS protection)                   │      │
│   │            + Managed SSL Certificate                              │      │
│   └───────────────────────────┬──────────────────────────────────────┘      │
│                               │                                              │
│                               ▼                                              │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │                       GKE Cluster                                 │      │
│   │  ┌────────────────────────────────────────────────────────────┐  │      │
│   │  │              Namespace: hta-calibration                     │  │      │
│   │  │                                                             │  │      │
│   │  │  ┌─────────┐ ┌─────────┐ ┌─────────┐ ┌─────────┐          │  │      │
│   │  │  │  Pod 1  │ │  Pod 2  │ │  Pod 3  │ │ Canary  │          │  │      │
│   │  │  │ hta-web │ │ hta-web │ │ hta-web │ │ hta-web │          │  │      │
│   │  │  └─────────┘ └─────────┘ └─────────┘ └─────────┘          │  │      │
│   │  │       │           │           │           │                │  │      │
│   │  │       └───────────┴───────────┴───────────┘                │  │      │
│   │  │                        │                                    │  │      │
│   │  │  ┌─────────────────────┴─────────────────────────────────┐ │  │      │
│   │  │  │              HPA (3-10 replicas)                       │ │  │      │
│   │  │  │              PDB (minAvailable: 2)                     │ │  │      │
│   │  │  └────────────────────────────────────────────────────────┘ │  │      │
│   │  │                                                             │  │      │
│   │  └─────────────────────────────────────────────────────────────┘  │      │
│   └───────────────────────────┬──────────────────────────────────────┘      │
│                               │                                              │
│           ┌───────────────────┼───────────────────┐                         │
│           │                   │                   │                         │
│           ▼                   ▼                   ▼                         │
│   ┌───────────────┐   ┌───────────────┐   ┌───────────────┐                │
│   │   Cloud SQL   │   │  GCS Buckets  │   │ Secret Manager│                │
│   │  PostgreSQL   │   │  (prod)       │   │               │                │
│   │  db-custom    │   │ -certificates │   │ -db-password  │                │
│   │  2 vCPU/4GB   │   │ -signatures   │   │ -nextauth-key │                │
│   │  HA + Backups │   │ -uploads      │   │ -api-keys     │                │
│   └───────────────┘   └───────────────┘   └───────────────┘                │
│                                                                              │
│   ┌──────────────────────────────────────────────────────────────────┐      │
│   │                     Observability Stack                           │      │
│   │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐ ┌────────────┐ │      │
│   │  │   Cloud     │ │   Cloud     │ │   Error     │ │  Uptime    │ │      │
│   │  │  Logging    │ │ Monitoring  │ │ Reporting   │ │  Checks    │ │      │
│   │  └─────────────┘ └─────────────┘ └─────────────┘ └────────────┘ │      │
│   │  ┌─────────────┐ ┌─────────────┐ ┌─────────────┐                │      │
│   │  │   Cloud     │ │  Alerting   │ │  Dashboards │                │      │
│   │  │   Trace     │ │ (PagerDuty) │ │  (Grafana)  │                │      │
│   │  └─────────────┘ └─────────────┘ └─────────────┘                │      │
│   └──────────────────────────────────────────────────────────────────┘      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 4.2 Production Configuration

### Kustomize Overlay
```yaml
# k8s/overlays/production/kustomization.yaml
apiVersion: kustomize.config.k8s.io/v1beta1
kind: Kustomization

namespace: hta-calibration

resources:
  - ../../base
  - ingress.yaml
  - managed-certificate.yaml
  - cloud-armor-policy.yaml
  - pdb.yaml

patches:
  - path: deployment-patch.yaml
  - path: configmap-patch.yaml
  - path: hpa-patch.yaml

images:
  - name: hta-app
    newName: asia-south1-docker.pkg.dev/hta-calibration-prod/hta-calibration/app
    # Specific SHA tag from CI/CD
```

### Resource Limits (Production)
```yaml
# k8s/overlays/production/deployment-patch.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hta-web
spec:
  replicas: 3
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1
      maxUnavailable: 0  # Zero downtime
  template:
    spec:
      containers:
        - name: hta-web
          resources:
            requests:
              cpu: 1000m
              memory: 2Gi
            limits:
              cpu: 2000m
              memory: 4Gi
          livenessProbe:
            httpGet:
              path: /api/health
              port: 3000
            initialDelaySeconds: 30
            periodSeconds: 10
            timeoutSeconds: 5
            failureThreshold: 3
          readinessProbe:
            httpGet:
              path: /api/health/ready
              port: 3000
            initialDelaySeconds: 5
            periodSeconds: 5
            timeoutSeconds: 3
            failureThreshold: 3
```

### HPA (Production)
```yaml
# k8s/overlays/production/hpa-patch.yaml
apiVersion: autoscaling/v2
kind: HorizontalPodAutoscaler
metadata:
  name: hta-web-hpa
spec:
  minReplicas: 3
  maxReplicas: 10
  metrics:
    - type: Resource
      resource:
        name: cpu
        target:
          type: Utilization
          averageUtilization: 60
    - type: Resource
      resource:
        name: memory
        target:
          type: Utilization
          averageUtilization: 70
  behavior:
    scaleUp:
      stabilizationWindowSeconds: 60
      policies:
        - type: Pods
          value: 2
          periodSeconds: 60
    scaleDown:
      stabilizationWindowSeconds: 300
      policies:
        - type: Pods
          value: 1
          periodSeconds: 120
```

### Pod Disruption Budget
```yaml
# k8s/overlays/production/pdb.yaml
apiVersion: policy/v1
kind: PodDisruptionBudget
metadata:
  name: hta-web-pdb
spec:
  minAvailable: 2
  selector:
    matchLabels:
      app: hta-web
```

## 4.3 Production Deployment Flow

```mermaid
sequenceDiagram
    autonumber
    participant Dev as Developer
    participant GH as GitHub
    participant CI as GitHub Actions
    participant STG as Staging
    participant Approver as Release Manager
    participant PROD as Production
    participant Monitor as Monitoring

    Note over STG: Staging already deployed & verified

    Dev->>GH: Request production deploy
    GH->>Approver: Approval required

    Approver->>GH: Approve deployment
    GH->>CI: Trigger production workflow

    Note over CI,PROD: Phase 1: Canary (10% traffic)
    CI->>PROD: Deploy canary pod
    PROD->>PROD: 1 canary + 3 stable pods

    CI->>Monitor: Watch error rates (5 min)

    alt Error rate < 0.1%
        Monitor-->>CI: Canary healthy

        Note over CI,PROD: Phase 2: Rolling update (25% at a time)
        CI->>PROD: kubectl rollout
        PROD->>PROD: Rolling update pods

        loop Until all pods updated
            PROD->>Monitor: Check health
            Monitor-->>PROD: Healthy
            PROD->>PROD: Update next batch
        end

        CI->>PROD: Remove canary deployment
        CI-->>GH: ✅ Production deployment complete

    else Error rate >= 0.1%
        Monitor-->>CI: Canary unhealthy
        CI->>PROD: kubectl rollout undo
        PROD->>PROD: Remove canary
        CI-->>GH: ❌ Canary failed - rolled back
    end
```

## 4.4 Production Database Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                 PRODUCTION DATABASE RULES                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ✓ DO:                                                          │
│    • Run migrations via prisma migrate deploy                   │
│    • Test migrations in staging first                           │
│    • Use backward-compatible migrations                         │
│    • Have rollback plan for each migration                      │
│    • Take backup before major migrations                        │
│    • Schedule migrations during low-traffic periods             │
│                                                                  │
│  ✗ DON'T:                                                       │
│    • Never run prisma db push in production                     │
│    • Never run prisma db seed in production                     │
│    • Never delete columns without deprecation period            │
│    • Never run destructive migrations without backup            │
│    • Never migrate during peak hours                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Safe Migration Process
```bash
# 1. Create migration (local)
npx prisma migrate dev --name add_new_field

# 2. Review generated SQL
cat prisma/migrations/20240115120000_add_new_field/migration.sql

# 3. Test in staging
DATABASE_URL="staging-url" npx prisma migrate deploy

# 4. Verify staging works
npm run test:smoke -- --baseUrl=https://staging.htacalibration.com

# 5. Production (during deploy)
# docker-entrypoint.sh automatically runs:
npx prisma migrate deploy
```

## 4.5 Production Monitoring

### Health Check Endpoints
```typescript
// src/app/api/health/route.ts
export async function GET() {
  return Response.json({
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.APP_VERSION || 'unknown',
  });
}

// src/app/api/health/ready/route.ts
export async function GET() {
  try {
    // Check database
    await prisma.$queryRaw`SELECT 1`;

    // Check GCS (if configured)
    if (process.env.GCS_CERTIFICATES_BUCKET) {
      const storage = new Storage();
      await storage.bucket(process.env.GCS_CERTIFICATES_BUCKET).exists();
    }

    return Response.json({
      status: 'ready',
      database: 'connected',
      storage: 'connected',
    });
  } catch (error) {
    return Response.json(
      { status: 'unhealthy', error: error.message },
      { status: 503 }
    );
  }
}
```

### Synthetic Monitoring
```typescript
// monitoring/uptime-checks.ts
// Configured in GCP Cloud Monitoring

const uptimeChecks = [
  {
    name: 'hta-api-health',
    url: 'https://app.htacalibration.com/api/health',
    interval: '60s',
    timeout: '10s',
    alertThreshold: '2 failures in 5 minutes',
  },
  {
    name: 'hta-login-page',
    url: 'https://app.htacalibration.com/login',
    interval: '300s',
    timeout: '30s',
    alertThreshold: '1 failure in 5 minutes',
  },
  {
    name: 'hta-api-ready',
    url: 'https://app.htacalibration.com/api/health/ready',
    interval: '60s',
    timeout: '10s',
    alertThreshold: '3 failures in 5 minutes',
  },
];
```

### Alert Configuration
```yaml
# monitoring/alerting-policies.yaml

alerts:
  - name: high-error-rate
    condition: |
      error_rate > 1% over 5 minutes
    severity: critical
    notify:
      - pagerduty: on-call
      - slack: #hta-alerts

  - name: high-latency
    condition: |
      p95_latency > 2000ms over 5 minutes
    severity: warning
    notify:
      - slack: #hta-alerts

  - name: pod-crash-loop
    condition: |
      pod_restarts > 3 in 10 minutes
    severity: critical
    notify:
      - pagerduty: on-call
      - slack: #hta-alerts

  - name: database-connection-pool-exhausted
    condition: |
      db_connection_wait_time > 5s
    severity: critical
    notify:
      - pagerduty: on-call

  - name: storage-bucket-error
    condition: |
      gcs_error_count > 10 in 5 minutes
    severity: warning
    notify:
      - slack: #hta-alerts

  - name: certificate-signing-queue-backup
    condition: |
      signing_job_pending_count > 100
    severity: warning
    notify:
      - slack: #hta-alerts
```

---

# 5. CI/CD Pipeline Deep Dive

## 5.1 Complete CI Workflow

```yaml
# .github/workflows/ci.yml
name: CI

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  # ============================================
  # Stage 1: Code Quality
  # ============================================
  code-quality:
    name: Code Quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma Client
        run: npx prisma generate

      - name: Lint
        run: npm run lint

      - name: Type Check
        run: npx tsc --noEmit

      - name: Check formatting
        run: npx prettier --check .

  # ============================================
  # Stage 2: Tests (Parallel)
  # ============================================
  unit-tests:
    name: Unit Tests
    needs: code-quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma Client
        run: npx prisma generate

      - name: Run unit tests
        run: npm run test:run -- --coverage

      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info

  integration-sqlite:
    name: Integration Tests (SQLite)
    needs: code-quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup database
        env:
          DATABASE_URL: "file:./test.db"
        run: |
          npx prisma generate
          npx prisma db push
          npx prisma db seed

      - name: Run integration tests
        env:
          DATABASE_URL: "file:./test.db"
          NEXTAUTH_SECRET: "test-secret"
        run: npm run test:integration

  integration-postgres:
    name: Integration Tests (PostgreSQL)
    needs: code-quality
    runs-on: ubuntu-latest
    services:
      postgres:
        image: postgres:15
        env:
          POSTGRES_USER: test
          POSTGRES_PASSWORD: test
          POSTGRES_DB: hta_test
        ports:
          - 5432:5432
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Setup database
        env:
          DATABASE_URL: "postgresql://test:test@localhost:5432/hta_test"
        run: |
          npx prisma generate
          npx prisma migrate deploy
          npx prisma db seed

      - name: Run integration tests
        env:
          DATABASE_URL: "postgresql://test:test@localhost:5432/hta_test"
          NEXTAUTH_SECRET: "test-secret"
        run: npm run test:integration

  build:
    name: Build Application
    needs: code-quality
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Generate Prisma Client
        run: npx prisma generate

      - name: Build
        env:
          SKIP_DB_INIT: "true"
        run: npm run build

      - name: Upload build artifacts
        uses: actions/upload-artifact@v4
        with:
          name: build
          path: .next/

  # ============================================
  # Stage 3: E2E Tests
  # ============================================
  e2e-tests:
    name: E2E Tests
    needs: [unit-tests, integration-sqlite, build]
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Install Playwright
        run: npx playwright install --with-deps

      - name: Download build
        uses: actions/download-artifact@v4
        with:
          name: build
          path: .next/

      - name: Setup database
        env:
          DATABASE_URL: "file:./e2e-test.db"
        run: |
          npx prisma generate
          npx prisma db push
          npx prisma db seed

      - name: Run E2E tests
        env:
          DATABASE_URL: "file:./e2e-test.db"
          NEXTAUTH_SECRET: "e2e-test-secret"
          NEXTAUTH_URL: "http://localhost:3000"
        run: npm run test:e2e

      - name: Upload test results
        if: always()
        uses: actions/upload-artifact@v4
        with:
          name: playwright-report
          path: playwright-report/

  # ============================================
  # Stage 4: Security
  # ============================================
  security-scan:
    name: Security Scan
    needs: e2e-tests
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Audit dependencies
        run: npm audit --audit-level=high

      - name: Check for secrets
        uses: trufflesecurity/trufflehog@main
        with:
          path: ./
          base: ${{ github.event.repository.default_branch }}

  # ============================================
  # Summary
  # ============================================
  ci-success:
    name: CI Success
    needs: [unit-tests, integration-sqlite, integration-postgres, e2e-tests, security-scan]
    runs-on: ubuntu-latest
    if: success()
    steps:
      - name: All checks passed
        run: echo "All CI checks passed!"
```

## 5.2 Complete Deploy Workflow

```yaml
# .github/workflows/deploy.yml
name: Deploy

on:
  push:
    branches: [main]
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        default: 'staging'
        type: choice
        options:
          - development
          - staging
          - production

env:
  REGISTRY: asia-south1-docker.pkg.dev
  PROJECT_ID: hta-calibration-prod
  REPOSITORY: hta-calibration
  IMAGE_NAME: app

jobs:
  # ============================================
  # Build Docker Image
  # ============================================
  build:
    name: Build & Push Image
    runs-on: ubuntu-latest
    outputs:
      image_tag: ${{ steps.meta.outputs.version }}
      image_digest: ${{ steps.build.outputs.digest }}
    steps:
      - uses: actions/checkout@v4

      - name: Setup Docker Buildx
        uses: docker/setup-buildx-action@v3

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Configure Docker
        run: gcloud auth configure-docker ${{ env.REGISTRY }}

      - name: Docker metadata
        id: meta
        uses: docker/metadata-action@v5
        with:
          images: ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.IMAGE_NAME }}
          tags: |
            type=sha,prefix=
            type=ref,event=branch
            type=raw,value=latest,enable=${{ github.ref == 'refs/heads/main' }}

      - name: Build and push
        id: build
        uses: docker/build-push-action@v5
        with:
          context: .
          push: true
          tags: ${{ steps.meta.outputs.tags }}
          labels: ${{ steps.meta.outputs.labels }}
          cache-from: type=gha
          cache-to: type=gha,mode=max
          build-args: |
            APP_VERSION=${{ github.sha }}

  # ============================================
  # Deploy to Development
  # ============================================
  deploy-dev:
    name: Deploy to Development
    needs: build
    runs-on: ubuntu-latest
    if: github.ref != 'refs/heads/main' || github.event.inputs.environment == 'development'
    environment: development
    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Get GKE credentials
        uses: google-github-actions/get-gke-credentials@v2
        with:
          cluster_name: hta-calibration-gke-dev
          location: asia-south1

      - name: Deploy to development
        run: |
          cd k8s/overlays/development
          kustomize edit set image hta-app=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.IMAGE_NAME }}:${{ needs.build.outputs.image_tag }}
          kubectl apply -k .
          kubectl rollout status deployment/hta-web -n hta-calibration --timeout=300s

      - name: Verify deployment
        run: |
          DEV_URL=$(kubectl get svc hta-web -n hta-calibration -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
          curl -f http://$DEV_URL/api/health || exit 1

  # ============================================
  # Deploy to Staging
  # ============================================
  deploy-staging:
    name: Deploy to Staging
    needs: build
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment: staging
    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Get GKE credentials
        uses: google-github-actions/get-gke-credentials@v2
        with:
          cluster_name: hta-calibration-gke-staging
          location: asia-south1

      - name: Deploy to staging
        run: |
          cd k8s/overlays/staging
          kustomize edit set image hta-app=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.IMAGE_NAME }}:${{ needs.build.outputs.image_tag }}
          kubectl apply -k .
          kubectl rollout status deployment/hta-web -n hta-calibration --timeout=300s

      - name: Run smoke tests
        env:
          STAGING_URL: https://staging.htacalibration.com
          SMOKE_TEST_EMAIL: ${{ secrets.SMOKE_TEST_EMAIL }}
          SMOKE_TEST_PASSWORD: ${{ secrets.SMOKE_TEST_PASSWORD }}
        run: |
          npm ci
          npm run test:smoke

      - name: Notify success
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "✅ Staging deployment successful",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Staging Deployment*\nImage: `${{ needs.build.outputs.image_tag }}`\nCommit: `${{ github.sha }}`"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

  # ============================================
  # Deploy to Production
  # ============================================
  deploy-production:
    name: Deploy to Production
    needs: [build, deploy-staging]
    runs-on: ubuntu-latest
    if: github.ref == 'refs/heads/main'
    environment:
      name: production
      url: https://app.htacalibration.com
    steps:
      - uses: actions/checkout@v4

      - name: Authenticate to Google Cloud
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Get GKE credentials
        uses: google-github-actions/get-gke-credentials@v2
        with:
          cluster_name: hta-calibration-gke-prod
          location: asia-south1

      # Phase 1: Canary deployment
      - name: Deploy canary
        run: |
          cd k8s/overlays/production

          # Create canary deployment
          cat <<EOF | kubectl apply -f -
          apiVersion: apps/v1
          kind: Deployment
          metadata:
            name: hta-web-canary
            namespace: hta-calibration
          spec:
            replicas: 1
            selector:
              matchLabels:
                app: hta-web
                track: canary
            template:
              metadata:
                labels:
                  app: hta-web
                  track: canary
              spec:
                containers:
                  - name: hta-web
                    image: ${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.IMAGE_NAME }}:${{ needs.build.outputs.image_tag }}
                    # ... (same config as main deployment)
          EOF

          kubectl rollout status deployment/hta-web-canary -n hta-calibration --timeout=300s

      - name: Monitor canary (5 minutes)
        run: |
          echo "Monitoring canary deployment..."
          for i in {1..5}; do
            sleep 60

            # Check pod health
            CANARY_READY=$(kubectl get pods -n hta-calibration -l track=canary -o jsonpath='{.items[0].status.conditions[?(@.type=="Ready")].status}')
            if [ "$CANARY_READY" != "True" ]; then
              echo "Canary pod not ready"
              exit 1
            fi

            # Check for errors in logs
            ERRORS=$(kubectl logs -n hta-calibration -l track=canary --tail=100 | grep -c "ERROR" || true)
            if [ "$ERRORS" -gt 5 ]; then
              echo "Too many errors in canary: $ERRORS"
              exit 1
            fi

            echo "Canary check $i/5 passed"
          done

      # Phase 2: Full rollout
      - name: Full production rollout
        run: |
          cd k8s/overlays/production
          kustomize edit set image hta-app=${{ env.REGISTRY }}/${{ env.PROJECT_ID }}/${{ env.REPOSITORY }}/${{ env.IMAGE_NAME }}:${{ needs.build.outputs.image_tag }}
          kubectl apply -k .
          kubectl rollout status deployment/hta-web -n hta-calibration --timeout=600s

      - name: Remove canary
        run: kubectl delete deployment hta-web-canary -n hta-calibration --ignore-not-found

      - name: Post-deploy verification
        run: |
          # Health check
          curl -f https://app.htacalibration.com/api/health || exit 1
          curl -f https://app.htacalibration.com/api/health/ready || exit 1

          # Basic smoke
          curl -f https://app.htacalibration.com/login || exit 1

      - name: Notify success
        uses: slackapi/slack-github-action@v1
        with:
          payload: |
            {
              "text": "🚀 Production deployment successful",
              "blocks": [
                {
                  "type": "section",
                  "text": {
                    "type": "mrkdwn",
                    "text": "*Production Deployment*\nImage: `${{ needs.build.outputs.image_tag }}`\nURL: https://app.htacalibration.com"
                  }
                }
              ]
            }
        env:
          SLACK_WEBHOOK_URL: ${{ secrets.SLACK_WEBHOOK_URL }}

      - name: Rollback on failure
        if: failure()
        run: |
          kubectl rollout undo deployment/hta-web -n hta-calibration
          kubectl delete deployment hta-web-canary -n hta-calibration --ignore-not-found
```

---

# 6. Database Strategy Across Environments

## 6.1 Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    DATABASE STRATEGY BY ENVIRONMENT                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  LOCAL           DEV              STAGING           PRODUCTION              │
│  ─────           ───              ───────           ──────────              │
│                                                                              │
│  SQLite          Cloud SQL        Cloud SQL         Cloud SQL               │
│  (file)          (shared)         (isolated)        (HA)                    │
│                                                                              │
│  db push         migrate deploy   migrate deploy    migrate deploy          │
│  (schema sync)   (versioned)      (versioned)       (versioned)             │
│                                                                              │
│  seed anytime    seed anytime     sanitized copy    NEVER seed              │
│                                                                              │
│  reset freely    reset weekly     refresh weekly    backup only             │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 6.2 Migration Workflow

```mermaid
sequenceDiagram
    autonumber
    participant Dev as Developer (Local)
    participant CI as CI Pipeline
    participant STG as Staging DB
    participant PROD as Production DB

    Note over Dev: Create migration locally
    Dev->>Dev: Edit prisma/schema.prisma
    Dev->>Dev: npx prisma migrate dev --name add_feature
    Dev->>Dev: Review migration SQL
    Dev->>Dev: Test locally

    Dev->>CI: Push to GitHub
    CI->>CI: Run tests with migration

    Note over CI,STG: Deploy to staging
    CI->>STG: npx prisma migrate deploy
    STG->>STG: Apply migration
    CI->>STG: Run smoke tests

    alt Smoke tests pass
        Note over STG,PROD: Deploy to production
        CI->>PROD: npx prisma migrate deploy
        PROD->>PROD: Apply migration
        CI->>PROD: Verify
    else Smoke tests fail
        STG->>STG: Investigate issue
        Note over Dev: Fix and retry
    end
```

## 6.3 Safe Migration Patterns

### Adding a Column
```typescript
// Migration 1: Add nullable column
model Certificate {
  id          String   @id
  // ...existing fields
  newField    String?  // Nullable first
}

// Code: Start writing to new field (but don't require it)

// Migration 2 (after backfill): Make required
model Certificate {
  newField    String   @default("")
}
```

### Renaming a Column
```typescript
// Migration 1: Add new column
model Certificate {
  oldName     String
  newName     String?
}

// Code: Write to both, read from new (fallback to old)

// Migration 2: Backfill
UPDATE "Certificate" SET "newName" = "oldName" WHERE "newName" IS NULL;

// Code: Read only from new

// Migration 3: Drop old
model Certificate {
  newName     String
}
```

### Removing a Column
```typescript
// Step 1: Stop writing to column (code change only)

// Step 2: Migration to make nullable (if not already)
model Certificate {
  toRemove    String?  // Was required, now nullable
}

// Step 3: Wait for old code to be fully deployed out

// Step 4: Migration to drop
// ALTER TABLE "Certificate" DROP COLUMN "toRemove";
```

## 6.4 Backup and Recovery

```bash
# Production backups (automated via GCP)
# - Point-in-time recovery enabled
# - Daily automated backups
# - 7-day retention

# Manual backup before risky migration
gcloud sql backups create \
  --instance=hta-db-prod \
  --description="Pre-migration backup $(date +%Y%m%d)"

# Restore from backup (disaster recovery)
gcloud sql backups restore BACKUP_ID \
  --restore-instance=hta-db-prod \
  --backup-instance=hta-db-prod

# Clone for staging refresh
gcloud sql instances clone hta-db-prod hta-db-staging-refresh \
  --point-in-time='2024-01-15T00:00:00Z'
```

---

# 7. Testing Strategy Evolution

## 7.1 Testing Pyramid

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                         TESTING PYRAMID                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│                          ┌───────────┐                                      │
│   PRODUCTION            │ Synthetic │  Scheduled health checks              │
│                         │ Monitoring│  Real user monitoring                 │
│                         └─────┬─────┘                                       │
│                               │                                              │
│                         ┌─────┴─────┐                                       │
│   STAGING               │   Smoke   │  Critical path verification           │
│                         │   Tests   │  With sanitized prod data             │
│                         └─────┬─────┘                                       │
│                               │                                              │
│                         ┌─────┴─────┐                                       │
│   CI/CD                 │    E2E    │  Full user workflows                  │
│                         │   Tests   │  With seeded test data                │
│                         └─────┬─────┘                                       │
│                               │                                              │
│                         ┌─────┴─────┐                                       │
│   CI/CD                 │Integration│  API + Database tests                 │
│                         │   Tests   │  SQLite + PostgreSQL                  │
│                         └─────┬─────┘                                       │
│                               │                                              │
│                         ┌─────┴─────┐                                       │
│   LOCAL + CI            │   Unit    │  Fast, isolated                       │
│                         │   Tests   │  Mocked dependencies                  │
│                         └───────────┘                                       │
│                                                                              │
│   Speed:    Fast ◄─────────────────────────────────────────────► Slow      │
│   Coverage: Narrow ◄───────────────────────────────────────────► Wide      │
│   Cost:     Low ◄──────────────────────────────────────────────► High      │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 7.2 Test Types by Environment

### Unit Tests (Local + CI)
```typescript
// tests/unit/services/certificate.test.ts
import { describe, it, expect, vi } from 'vitest';
import { calculateCalibrationError } from '@/services/certificate';

describe('calculateCalibrationError', () => {
  it('calculates positive error correctly', () => {
    const result = calculateCalibrationError(10.0, 10.02);
    expect(result).toBeCloseTo(0.02, 4);
  });

  it('calculates negative error correctly', () => {
    const result = calculateCalibrationError(10.0, 9.98);
    expect(result).toBeCloseTo(-0.02, 4);
  });

  it('returns zero for exact match', () => {
    const result = calculateCalibrationError(10.0, 10.0);
    expect(result).toBe(0);
  });
});
```

### Integration Tests (CI)
```typescript
// tests/integration/api/certificates.test.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { createTestClient, seedTestData, cleanupTestData } from '../helpers';

describe('POST /api/certificates', () => {
  let client: TestClient;
  let testUser: User;

  beforeAll(async () => {
    client = await createTestClient();
    testUser = await seedTestData.createUser({ role: 'ENGINEER' });
    await client.loginAs(testUser);
  });

  afterAll(async () => {
    await cleanupTestData();
  });

  it('creates a certificate successfully', async () => {
    const response = await client.post('/api/certificates', {
      certificateNumber: 'TEST-001',
      customerAccountId: testUser.customerAccountId,
      // ... other fields
    });

    expect(response.status).toBe(201);
    expect(response.body.certificateNumber).toBe('TEST-001');
    expect(response.body.status).toBe('DRAFT');
  });

  it('rejects duplicate certificate number', async () => {
    // First creation
    await client.post('/api/certificates', {
      certificateNumber: 'DUPLICATE-001',
      // ...
    });

    // Duplicate
    const response = await client.post('/api/certificates', {
      certificateNumber: 'DUPLICATE-001',
      // ...
    });

    expect(response.status).toBe(400);
    expect(response.body.error).toContain('already exists');
  });
});
```

### E2E Tests (CI)
```typescript
// tests/e2e/certificate-workflow.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Certificate Workflow', () => {
  test('complete certificate lifecycle', async ({ page }) => {
    // Login as engineer
    await page.goto('/login');
    await page.fill('[name="email"]', 'engineer@htaipl.com');
    await page.fill('[name="password"]', 'testpassword');
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);

    // Create certificate
    await page.goto('/certificates/new');
    await page.fill('[name="certificateNumber"]', `E2E-${Date.now()}`);
    // ... fill other fields
    await page.click('button:has-text("Save Draft")');
    await expect(page).toHaveURL(/\/certificates\/[a-z0-9]+/);

    // Submit for review
    await page.click('button:has-text("Submit for Review")');
    await page.selectOption('[name="reviewerId"]', { index: 1 });
    await page.click('button:has-text("Confirm")');
    await expect(page.locator('.status-badge')).toHaveText('Pending Review');
  });
});
```

### Smoke Tests (Staging)
```typescript
// tests/smoke/critical-paths.spec.ts
import { test, expect } from '@playwright/test';

test.describe('Staging Smoke Tests', () => {
  // Use real (but sanitized) credentials
  const email = process.env.SMOKE_TEST_EMAIL!;
  const password = process.env.SMOKE_TEST_PASSWORD!;

  test('health endpoints respond', async ({ request }) => {
    const health = await request.get('/api/health');
    expect(health.ok()).toBeTruthy();
  });

  test('staff can login', async ({ page }) => {
    await page.goto('/login');
    await page.fill('[name="email"]', email);
    await page.fill('[name="password"]', password);
    await page.click('button[type="submit"]');
    await expect(page).toHaveURL(/\/dashboard/);
  });

  test('certificate list loads', async ({ page }) => {
    // After login...
    await page.goto('/certificates');
    await expect(page.locator('table')).toBeVisible();
  });

  // NO data modification in smoke tests!
});
```

### Synthetic Monitoring (Production)
```typescript
// monitoring/synthetic-monitor.ts
// Runs every 5 minutes via Cloud Scheduler

export async function runSyntheticChecks() {
  const baseUrl = 'https://app.htacalibration.com';
  const results: CheckResult[] = [];

  // Health check
  results.push(await checkEndpoint(`${baseUrl}/api/health`, 200, 5000));

  // Ready check
  results.push(await checkEndpoint(`${baseUrl}/api/health/ready`, 200, 10000));

  // Login page
  results.push(await checkEndpoint(`${baseUrl}/login`, 200, 10000));

  // Customer login
  results.push(await checkEndpoint(`${baseUrl}/customer/login`, 200, 10000));

  // Report to Cloud Monitoring
  await reportMetrics(results);

  // Alert on failures
  const failures = results.filter(r => !r.success);
  if (failures.length > 0) {
    await sendAlert(failures);
  }

  return results;
}
```

---

# 8. Deployment Strategies

## 8.1 Rolling Update (Default)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        ROLLING UPDATE                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Time 0:    [v1] [v1] [v1]     ← 3 pods running v1                        │
│                                                                              │
│   Time 1:    [v1] [v1] [v2]     ← 1 pod updated to v2                      │
│                                                                              │
│   Time 2:    [v1] [v2] [v2]     ← 2 pods running v2                        │
│                                                                              │
│   Time 3:    [v2] [v2] [v2]     ← All pods running v2                      │
│                                                                              │
│   Pros:                                                                      │
│   • Zero downtime                                                            │
│   • Simple to implement                                                      │
│   • Automatic rollback on failure                                            │
│                                                                              │
│   Cons:                                                                      │
│   • Both versions run simultaneously                                         │
│   • Database must be backward compatible                                     │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

```yaml
# Deployment strategy config
spec:
  strategy:
    type: RollingUpdate
    rollingUpdate:
      maxSurge: 1        # Can have 1 extra pod during update
      maxUnavailable: 0  # Never have fewer than desired replicas
```

## 8.2 Canary Deployment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CANARY DEPLOYMENT                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Phase 1: Deploy Canary                                                     │
│   ┌─────────────────────────────────────┐                                   │
│   │  Main Deployment (v1)  │  Canary   │                                   │
│   │  [v1] [v1] [v1]       │   [v2]    │  ← 10% traffic to canary          │
│   └─────────────────────────────────────┘                                   │
│                                                                              │
│   Phase 2: Monitor (5 minutes)                                              │
│   • Check error rates                                                        │
│   • Check latency                                                            │
│   • Check pod health                                                         │
│                                                                              │
│   Phase 3a: Success → Full Rollout                                          │
│   ┌─────────────────────────────────────┐                                   │
│   │  Main Deployment (v2)               │                                   │
│   │  [v2] [v2] [v2]                    │  ← All traffic to v2              │
│   └─────────────────────────────────────┘                                   │
│                                                                              │
│   Phase 3b: Failure → Rollback                                              │
│   ┌─────────────────────────────────────┐                                   │
│   │  Main Deployment (v1)               │                                   │
│   │  [v1] [v1] [v1]                    │  ← Remove canary                  │
│   └─────────────────────────────────────┘                                   │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 8.3 Blue-Green Deployment

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                       BLUE-GREEN DEPLOYMENT                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   Initial State:                                                             │
│   ┌─────────────────┐     ┌─────────────────┐                               │
│   │   Blue (LIVE)   │     │   Green (IDLE)  │                               │
│   │   [v1] [v1]     │ ◄── │   [v1] [v1]     │                               │
│   └─────────────────┘  │  └─────────────────┘                               │
│                        │                                                     │
│             Load Balancer (pointing to Blue)                                 │
│                                                                              │
│   Step 1: Deploy v2 to Green                                                │
│   ┌─────────────────┐     ┌─────────────────┐                               │
│   │   Blue (LIVE)   │     │   Green (v2)    │                               │
│   │   [v1] [v1]     │ ◄── │   [v2] [v2]     │ ← Test here                   │
│   └─────────────────┘  │  └─────────────────┘                               │
│                        │                                                     │
│   Step 2: Switch traffic                                                     │
│   ┌─────────────────┐     ┌─────────────────┐                               │
│   │   Blue (IDLE)   │     │   Green (LIVE)  │                               │
│   │   [v1] [v1]     │     │   [v2] [v2]     │ ◄── All traffic              │
│   └─────────────────┘     └─────────────────┘                               │
│                                                                              │
│   Rollback: Switch back to Blue (instant)                                    │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

# 9. Monitoring & Observability

## 9.1 Three Pillars

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                     OBSERVABILITY PILLARS                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│   LOGS                    METRICS                  TRACES                    │
│   ────                    ───────                  ──────                    │
│                                                                              │
│   Cloud Logging           Cloud Monitoring         Cloud Trace               │
│                                                                              │
│   • Application logs      • Request rate           • Request flow            │
│   • Error messages        • Error rate             • Latency breakdown       │
│   • Audit events          • Latency (p50/p95/p99)  • Service dependencies   │
│   • Debug info            • CPU/Memory usage       • Bottleneck ID           │
│                          • Pod count                                         │
│                          • Custom metrics                                    │
│                                                                              │
│   Retention: 30 days     Retention: 90 days       Retention: 30 days        │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

## 9.2 Structured Logging

```typescript
// src/lib/logger.ts
import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ severity: label.toUpperCase() }),
  },
  base: {
    service: 'hta-calibration',
    version: process.env.APP_VERSION,
  },
});

// Usage in API routes
export async function POST(request: Request) {
  const requestId = crypto.randomUUID();
  const log = logger.child({ requestId });

  log.info({ path: '/api/certificates', method: 'POST' }, 'Request received');

  try {
    const certificate = await createCertificate(data);
    log.info({ certificateId: certificate.id }, 'Certificate created');
    return Response.json(certificate);
  } catch (error) {
    log.error({ error: error.message, stack: error.stack }, 'Failed to create certificate');
    return Response.json({ error: 'Internal error' }, { status: 500 });
  }
}
```

## 9.3 Metrics Dashboard

```typescript
// monitoring/custom-metrics.ts
import { MetricServiceClient } from '@google-cloud/monitoring';

const metrics = new MetricServiceClient();
const projectPath = metrics.projectPath('hta-calibration-prod');

// Custom metrics to track
const customMetrics = {
  // Business metrics
  'certificates_created_total': 'counter',
  'certificates_approved_total': 'counter',
  'certificates_rejected_total': 'counter',
  'signing_job_queue_length': 'gauge',
  'signing_job_processing_time': 'histogram',

  // Technical metrics
  'api_request_duration_ms': 'histogram',
  'database_query_duration_ms': 'histogram',
  'gcs_upload_duration_ms': 'histogram',
};

// Example: Record metric
export async function recordMetric(name: string, value: number, labels: Record<string, string>) {
  const dataPoint = {
    interval: { endTime: { seconds: Date.now() / 1000 } },
    value: { doubleValue: value },
  };

  const timeSeries = {
    metric: {
      type: `custom.googleapis.com/hta/${name}`,
      labels,
    },
    resource: {
      type: 'k8s_container',
      labels: {
        project_id: 'hta-calibration-prod',
        cluster_name: 'hta-calibration-gke-prod',
        namespace_name: 'hta-calibration',
        container_name: 'hta-web',
      },
    },
    points: [dataPoint],
  };

  await metrics.createTimeSeries({
    name: projectPath,
    timeSeries: [timeSeries],
  });
}
```

## 9.4 Alerting Rules

```yaml
# monitoring/alert-policies.yaml

# Critical Alerts (PagerDuty)
critical:
  - name: api-down
    condition: uptime_check_passed == false for 2 minutes
    action: page on-call

  - name: high-error-rate
    condition: error_rate > 5% for 5 minutes
    action: page on-call

  - name: database-unreachable
    condition: database_health_check == false for 1 minute
    action: page on-call

  - name: pod-crash-loop
    condition: pod_restart_count > 5 in 10 minutes
    action: page on-call

# Warning Alerts (Slack)
warning:
  - name: elevated-error-rate
    condition: error_rate > 1% for 10 minutes
    action: notify slack #hta-alerts

  - name: high-latency
    condition: p95_latency > 2000ms for 10 minutes
    action: notify slack #hta-alerts

  - name: queue-backlog
    condition: signing_job_pending > 50
    action: notify slack #hta-alerts

  - name: disk-usage-high
    condition: disk_usage > 80%
    action: notify slack #hta-alerts

  - name: memory-pressure
    condition: memory_usage > 85% for 5 minutes
    action: notify slack #hta-alerts
```

---

# 10. Rollback Procedures

## 10.1 Kubernetes Rollback

```bash
# View deployment history
kubectl rollout history deployment/hta-web -n hta-calibration

# Rollback to previous version
kubectl rollout undo deployment/hta-web -n hta-calibration

# Rollback to specific revision
kubectl rollout undo deployment/hta-web -n hta-calibration --to-revision=5

# Check rollback status
kubectl rollout status deployment/hta-web -n hta-calibration

# Verify pods
kubectl get pods -n hta-calibration
```

## 10.2 Database Rollback

```bash
# Option 1: Point-in-time recovery (GCP)
gcloud sql instances clone hta-db-prod hta-db-recovered \
  --point-in-time='2024-01-15T14:30:00Z'

# Option 2: Restore from backup
gcloud sql backups list --instance=hta-db-prod
gcloud sql backups restore BACKUP_ID \
  --restore-instance=hta-db-prod

# Option 3: Manual reverse migration
# Create a new migration that undoes the previous one
npx prisma migrate dev --name revert_previous_migration
```

## 10.3 Rollback Decision Matrix

| Situation | Action | Time to Recover |
|-----------|--------|-----------------|
| Bad code, no data changes | kubectl rollout undo | < 2 minutes |
| Bad code + migration (backward compatible) | kubectl rollout undo | < 2 minutes |
| Bad code + migration (breaking) | Rollback + reverse migration | 15-30 minutes |
| Data corruption (small) | Manual fix in DB | Varies |
| Data corruption (large) | Point-in-time recovery | 30-60 minutes |
| Complete disaster | Full restore from backup | 1-2 hours |

---

# 11. Security Considerations

## 11.1 Secrets Management

```yaml
# Per-environment secrets

LOCAL:
  storage: .env.local (git-ignored)
  rotation: Never (dev secrets)

DEV/STAGING:
  storage: Kubernetes Secrets
  rotation: Monthly
  access: Dev team

PRODUCTION:
  storage: Google Secret Manager → K8s Secrets
  rotation: Monthly (automated)
  access: Restricted (ops team only)
  audit: All access logged
```

## 11.2 Secret Rotation

```bash
# Rotate NEXTAUTH_SECRET in production

# 1. Generate new secret
NEW_SECRET=$(openssl rand -base64 32)

# 2. Update in Secret Manager
echo -n "$NEW_SECRET" | gcloud secrets versions add nextauth-secret --data-file=-

# 3. Update Kubernetes secret
kubectl patch secret hta-secrets -n hta-calibration \
  -p='{"stringData":{"nextauth-secret":"'$NEW_SECRET'"}}'

# 4. Restart pods to pick up new secret
kubectl rollout restart deployment/hta-web -n hta-calibration

# 5. Verify
kubectl logs -f deployment/hta-web -n hta-calibration | grep -i auth
```

## 11.3 Security Checklist

```
□ Secrets never in git
□ Secrets rotated regularly
□ Database password unique per environment
□ HTTPS in staging/production
□ Cloud Armor enabled (production)
□ VPC peering for Cloud SQL
□ Workload Identity for GCS access
□ Pod security policies applied
□ Network policies configured
□ Audit logging enabled
□ Dependency scanning in CI
□ Container image scanning
```

---

# 12. Checklist for Full Production Readiness

## 12.1 Infrastructure

```
□ GCP project with billing
□ VPC network configured
□ GKE cluster (per environment)
□ Cloud SQL instance (per environment)
□ GCS buckets (per environment)
□ Artifact Registry configured
□ IAM roles properly scoped
□ Workload Identity enabled
□ Cloud NAT for egress
□ Reserved static IPs
```

## 12.2 Kubernetes

```
□ Namespaces created
□ Service accounts configured
□ ConfigMaps per environment
□ Secrets created
□ Deployments with proper resources
□ Services (ClusterIP/LoadBalancer)
□ Ingress with SSL (staging/prod)
□ HPA configured
□ PDB configured
□ Network policies (if needed)
```

## 12.3 CI/CD

```
□ GitHub Actions workflows
□ Branch protection rules
□ Environment secrets configured
□ Staging deployment automated
□ Production requires approval
□ Rollback procedure documented
□ Slack notifications configured
```

## 12.4 Monitoring

```
□ Cloud Logging enabled
□ Cloud Monitoring dashboards
□ Uptime checks configured
□ Alert policies created
□ PagerDuty integration (prod)
□ Slack integration (all envs)
□ Error reporting enabled
□ Custom metrics defined
```

## 12.5 Security

```
□ SSL certificates (staging/prod)
□ Cloud Armor policies
□ Secret rotation procedure
□ Audit logging enabled
□ Dependency scanning
□ Container scanning
□ Security review completed
```

## 12.6 Documentation

```
□ Architecture documented
□ Deployment procedures
□ Rollback procedures
□ Incident response playbook
□ On-call rotation defined
□ Runbooks for common issues
```

---

This document provides a complete guide for the HTA Calibration application's journey from local development through production deployment, covering all environments, testing strategies, deployment procedures, and operational considerations.
