# Phase 3G: Secrets Management Implementation

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Last Updated**: 2026-03-17
- **Phase**: 3 - Cloud Infrastructure
- **Status**: Not Started (0%)

---

## Learning Resources

Before implementing secrets management, make sure you understand the underlying concepts:

| Topic | System Design Document | What You'll Learn |
|-------|------------------------|-------------------|
| **Secrets Concepts** | [13_secrets_management.md](../../system_design/13_secrets_management.md) | Types of secrets, rotation, per-tenant secrets |
| **GCP Fundamentals** | [06_gcp_fundamentals.md](../../system_design/06_gcp_fundamentals.md) | Secret Manager service |
| **Multi-Tenancy** | [04_multi_tenancy.md](../../system_design/04_multi_tenancy.md) | Tenant-specific secrets |
| **Security** | [14_security.md](../../system_design/14_security.md) | Security best practices |
| **Kubernetes** | [07_container_orchestration.md](../../system_design/07_container_orchestration.md) | K8s Secrets, ConfigMaps |

> **Tip**: If terms like "secret rotation", "CMEK", or "workload identity" are unfamiliar, read `13_secrets_management.md` first!

---

## Overview

This document covers the implementation of secrets management using Google Secret Manager, integration with Kubernetes, secret rotation, and per-tenant secret handling for the HTA Calibration system.

---

## Secrets Architecture

```
+---------------------------------------------------------------------------+
|                         SECRETS ARCHITECTURE                                |
+---------------------------------------------------------------------------+
|                                                                             |
|  SECRET MANAGER (Google Cloud)                                              |
|  +-----------------------------------------------------------------------+  |
|  |                                                                       |  |
|  |  SYSTEM SECRETS (Platform-wide)                                       |  |
|  |  +----------------------------------------------------------------+  |  |
|  |  |  hta-nextauth-secret-{env}     NextAuth.js signing key         |  |  |
|  |  |  hta-db-password-{env}         Database password               |  |  |
|  |  |  hta-encryption-key-{env}      Data encryption key             |  |  |
|  |  |  hta-smtp-credentials-{env}    Email service credentials       |  |  |
|  |  +----------------------------------------------------------------+  |  |
|  |                                                                       |  |
|  |  TENANT SECRETS (Per-tenant)                                          |  |
|  |  +----------------------------------------------------------------+  |  |
|  |  |  hta-tenant-{id}-webhook-secret    Webhook signing key         |  |  |
|  |  |  hta-tenant-{id}-api-key           Tenant API key              |  |  |
|  |  |  hta-tenant-{id}-smtp              Custom SMTP (if configured) |  |  |
|  |  +----------------------------------------------------------------+  |  |
|  |                                                                       |  |
|  +-----------------------------------------------------------------------+  |
|                              |                                              |
|                              | Workload Identity                            |
|                              v                                              |
|  KUBERNETES CLUSTER                                                         |
|  +-----------------------------------------------------------------------+  |
|  |                                                                       |  |
|  |  External Secrets Operator                                            |  |
|  |  +----------------------------------------------------------------+  |  |
|  |  |  Syncs secrets from GCP -> K8s Secrets                         |  |  |
|  |  +----------------------------------------------------------------+  |  |
|  |                              |                                        |  |
|  |                              v                                        |  |
|  |  Kubernetes Secrets                                                   |  |
|  |  +----------------------------------------------------------------+  |  |
|  |  |  database-credentials     -> env: DATABASE_URL                 |  |  |
|  |  |  auth-secrets             -> env: NEXTAUTH_SECRET              |  |  |
|  |  |  smtp-credentials         -> env: SMTP_USER, SMTP_PASS         |  |  |
|  |  +----------------------------------------------------------------+  |  |
|  |                              |                                        |  |
|  |                              v                                        |  |
|  |  Application Pods                                                     |  |
|  |  +----------------------------------------------------------------+  |  |
|  |  |  Secrets mounted as environment variables                      |  |  |
|  |  +----------------------------------------------------------------+  |  |
|  |                                                                       |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
+---------------------------------------------------------------------------+
```

---

## Secret Manager Configuration

### Terraform Setup

```hcl
# terraform/modules/secrets/main.tf

# Enable Secret Manager API
resource "google_project_service" "secretmanager" {
  service = "secretmanager.googleapis.com"
}

# System secrets
resource "google_secret_manager_secret" "nextauth_secret" {
  secret_id = "hta-nextauth-secret-${var.environment}"
  project   = var.project_id

  replication {
    user_managed {
      replicas {
        location = "asia-southeast1"
      }
      replicas {
        location = "asia-east1"
      }
    }
  }

  labels = {
    project     = "hta-calibration"
    environment = var.environment
    type        = "system"
  }
}

resource "google_secret_manager_secret_version" "nextauth_secret" {
  secret      = google_secret_manager_secret.nextauth_secret.id
  secret_data = var.nextauth_secret  # Passed from secure source
}

# Database URL secret
resource "google_secret_manager_secret" "database_url" {
  secret_id = "hta-database-url-${var.environment}"
  project   = var.project_id

  replication {
    user_managed {
      replicas {
        location = "asia-southeast1"
      }
    }
  }

  labels = {
    project     = "hta-calibration"
    environment = var.environment
    type        = "database"
  }
}

# IAM binding for application service account
resource "google_secret_manager_secret_iam_binding" "app_access" {
  project   = var.project_id
  secret_id = google_secret_manager_secret.nextauth_secret.secret_id
  role      = "roles/secretmanager.secretAccessor"
  members   = ["serviceAccount:${var.app_service_account}"]
}
```

### Secret Categories

```
+---------------------------------------------------------------------------+
|                         SECRET INVENTORY                                    |
+---------------------------------------------------------------------------+
|                                                                             |
|  SYSTEM SECRETS (All Environments)                                          |
|  =================================                                          |
|                                                                             |
|  Secret Name                    Purpose                      Rotation       |
|  -------------------------------------------------------------------------- |
|  hta-nextauth-secret-{env}      Session signing              90 days       |
|  hta-database-url-{env}         PostgreSQL connection        Manual        |
|  hta-encryption-key-{env}       Data encryption at rest      Annual        |
|  hta-jwt-signing-key-{env}      API token signing            90 days       |
|                                                                             |
|  INTEGRATION SECRETS                                                        |
|  ===================                                                        |
|                                                                             |
|  hta-smtp-credentials-{env}     Email service (SendGrid/SES)  Manual       |
|  hta-storage-hmac-{env}         GCS signed URL signing        Manual       |
|  hta-opensign-api-key-{env}     Digital signature service     Manual       |
|                                                                             |
|  CI/CD SECRETS (GitHub Actions)                                             |
|  ==============================                                             |
|                                                                             |
|  GCP_SA_KEY                     GCP service account key       Annual       |
|  DOCKER_REGISTRY_TOKEN          Artifact Registry access      Annual       |
|                                                                             |
|  TENANT SECRETS                                                             |
|  ==============                                                             |
|                                                                             |
|  hta-tenant-{id}-webhook-secret  Webhook HMAC signing         On request   |
|  hta-tenant-{id}-api-key         External API access          On request   |
|                                                                             |
+---------------------------------------------------------------------------+
```

---

## Kubernetes Integration

### External Secrets Operator Setup

```yaml
# Install External Secrets Operator
# helm repo add external-secrets https://charts.external-secrets.io
# helm install external-secrets external-secrets/external-secrets

# k8s/base/external-secrets/cluster-secret-store.yaml
apiVersion: external-secrets.io/v1beta1
kind: ClusterSecretStore
metadata:
  name: gcp-secret-store
spec:
  provider:
    gcpsm:
      projectID: hta-calibration-prod
      auth:
        workloadIdentity:
          clusterLocation: asia-southeast1
          clusterName: hta-cluster-prod
          clusterProjectID: hta-calibration-prod
          serviceAccountRef:
            name: external-secrets-sa
            namespace: external-secrets
```

### External Secret Definitions

```yaml
# k8s/production/secrets/database-external-secret.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: database-credentials
  namespace: hta-production
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: gcp-secret-store
  target:
    name: database-credentials
    creationPolicy: Owner
  data:
    - secretKey: DATABASE_URL
      remoteRef:
        key: hta-database-url-prod

---
# k8s/production/secrets/auth-external-secret.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: auth-secrets
  namespace: hta-production
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: gcp-secret-store
  target:
    name: auth-secrets
    creationPolicy: Owner
  data:
    - secretKey: NEXTAUTH_SECRET
      remoteRef:
        key: hta-nextauth-secret-prod
    - secretKey: JWT_SIGNING_KEY
      remoteRef:
        key: hta-jwt-signing-key-prod

---
# k8s/production/secrets/smtp-external-secret.yaml
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: smtp-credentials
  namespace: hta-production
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: gcp-secret-store
  target:
    name: smtp-credentials
    creationPolicy: Owner
  dataFrom:
    - extract:
        key: hta-smtp-credentials-prod  # JSON object with multiple fields
```

### Using Secrets in Deployment

```yaml
# k8s/production/deployments/hta-web-deployment.yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hta-web
  namespace: hta-production
spec:
  template:
    spec:
      containers:
        - name: hta-web
          image: gcr.io/hta-calibration-prod/hta-web:latest

          # Environment variables from secrets
          env:
            - name: DATABASE_URL
              valueFrom:
                secretKeyRef:
                  name: database-credentials
                  key: DATABASE_URL

            - name: NEXTAUTH_SECRET
              valueFrom:
                secretKeyRef:
                  name: auth-secrets
                  key: NEXTAUTH_SECRET

            - name: SMTP_USER
              valueFrom:
                secretKeyRef:
                  name: smtp-credentials
                  key: SMTP_USER

            - name: SMTP_PASS
              valueFrom:
                secretKeyRef:
                  name: smtp-credentials
                  key: SMTP_PASS

          # Environment variables from ConfigMap (non-sensitive)
          envFrom:
            - configMapRef:
                name: hta-web-config
```

---

## Per-Tenant Secrets

### Tenant Secret Management

```typescript
// src/lib/secrets/tenant-secrets.ts
import { SecretManagerServiceClient } from '@google-cloud/secret-manager'

const client = new SecretManagerServiceClient()
const projectId = process.env.GCP_PROJECT_ID

export async function createTenantSecret(
  tenantId: string,
  secretType: 'webhook' | 'api-key',
  secretValue: string
) {
  const secretId = `hta-tenant-${tenantId}-${secretType}`

  // Create the secret
  const [secret] = await client.createSecret({
    parent: `projects/${projectId}`,
    secretId,
    secret: {
      replication: {
        automatic: {}
      },
      labels: {
        tenant_id: tenantId,
        type: secretType
      }
    }
  })

  // Add the secret version
  await client.addSecretVersion({
    parent: secret.name,
    payload: {
      data: Buffer.from(secretValue)
    }
  })

  return secretId
}

export async function getTenantSecret(
  tenantId: string,
  secretType: 'webhook' | 'api-key'
): Promise<string | null> {
  const secretId = `hta-tenant-${tenantId}-${secretType}`

  try {
    const [version] = await client.accessSecretVersion({
      name: `projects/${projectId}/secrets/${secretId}/versions/latest`
    })

    return version.payload?.data?.toString() || null
  } catch (error: any) {
    if (error.code === 5) {  // NOT_FOUND
      return null
    }
    throw error
  }
}

export async function rotateTenantSecret(
  tenantId: string,
  secretType: 'webhook' | 'api-key',
  newValue: string
) {
  const secretId = `hta-tenant-${tenantId}-${secretType}`

  // Add new version
  await client.addSecretVersion({
    parent: `projects/${projectId}/secrets/${secretId}`,
    payload: {
      data: Buffer.from(newValue)
    }
  })

  // Optionally disable old versions
  // (keep 1-2 previous versions for grace period)
}

export async function deleteTenantSecrets(tenantId: string) {
  const secretTypes = ['webhook', 'api-key', 'smtp']

  for (const type of secretTypes) {
    const secretId = `hta-tenant-${tenantId}-${type}`
    try {
      await client.deleteSecret({
        name: `projects/${projectId}/secrets/${secretId}`
      })
    } catch (error: any) {
      if (error.code !== 5) {  // Ignore NOT_FOUND
        throw error
      }
    }
  }
}
```

### Webhook Secret Usage

```typescript
// src/lib/webhooks/signing.ts
import crypto from 'crypto'
import { getTenantSecret } from '@/lib/secrets/tenant-secrets'

export async function signWebhookPayload(
  tenantId: string,
  payload: object
): Promise<string> {
  const secret = await getTenantSecret(tenantId, 'webhook')
  if (!secret) {
    throw new Error('Webhook secret not configured for tenant')
  }

  const payloadString = JSON.stringify(payload)
  const signature = crypto
    .createHmac('sha256', secret)
    .update(payloadString)
    .digest('hex')

  return `sha256=${signature}`
}

export async function verifyWebhookSignature(
  tenantId: string,
  payload: string,
  signature: string
): Promise<boolean> {
  const secret = await getTenantSecret(tenantId, 'webhook')
  if (!secret) {
    return false
  }

  const expectedSignature = `sha256=${crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')}`

  return crypto.timingSafeEqual(
    Buffer.from(signature),
    Buffer.from(expectedSignature)
  )
}
```

---

## Secret Rotation

### Automatic Rotation with Cloud Functions

```typescript
// cloud-functions/rotate-secrets/index.ts
import { SecretManagerServiceClient } from '@google-cloud/secret-manager'
import crypto from 'crypto'

const client = new SecretManagerServiceClient()

export async function rotateSecret(
  event: { secretName: string },
  context: any
) {
  const { secretName } = event

  // Generate new secret value
  const newValue = crypto.randomBytes(32).toString('base64')

  // Add new version
  await client.addSecretVersion({
    parent: secretName,
    payload: {
      data: Buffer.from(newValue)
    }
  })

  // Get all versions
  const [versions] = await client.listSecretVersions({
    parent: secretName
  })

  // Disable old versions (keep latest 2)
  const enabledVersions = versions
    .filter(v => v.state === 'ENABLED')
    .sort((a, b) =>
      (b.createTime?.seconds || 0) - (a.createTime?.seconds || 0)
    )

  for (const version of enabledVersions.slice(2)) {
    await client.disableSecretVersion({
      name: version.name
    })
  }

  console.log(`Rotated secret: ${secretName}`)
}
```

### Rotation Schedule

```hcl
# terraform/modules/secrets/rotation.tf

# Cloud Scheduler job for secret rotation
resource "google_cloud_scheduler_job" "rotate_nextauth" {
  name        = "rotate-nextauth-secret"
  description = "Rotates NextAuth secret every 90 days"
  schedule    = "0 0 1 */3 *"  # Every 3 months
  time_zone   = "Asia/Singapore"

  pubsub_target {
    topic_name = google_pubsub_topic.secret_rotation.id
    data       = base64encode(jsonencode({
      secretName = google_secret_manager_secret.nextauth_secret.name
    }))
  }
}

resource "google_pubsub_topic" "secret_rotation" {
  name = "secret-rotation-trigger"
}

# Cloud Function triggered by Pub/Sub
resource "google_cloudfunctions_function" "rotate_secret" {
  name        = "rotate-secret"
  runtime     = "nodejs20"
  entry_point = "rotateSecret"

  event_trigger {
    event_type = "google.pubsub.topic.publish"
    resource   = google_pubsub_topic.secret_rotation.id
  }

  source_archive_bucket = google_storage_bucket.functions.name
  source_archive_object = google_storage_bucket_object.rotate_function.name
}
```

---

## Local Development

### Secret Management for Development

```
+---------------------------------------------------------------------------+
|                         LOCAL DEVELOPMENT SECRETS                           |
+---------------------------------------------------------------------------+
|                                                                             |
|  APPROACH 1: .env.local file (Development only)                             |
|  =============================================                              |
|                                                                             |
|  # .env.local (gitignored)                                                  |
|  DATABASE_URL="postgresql://user:pass@localhost:5432/hta"                   |
|  NEXTAUTH_SECRET="dev-secret-for-local-only"                                |
|  NEXTAUTH_URL="http://localhost:3000"                                       |
|                                                                             |
|  APPROACH 2: gcloud for staging/prod access                                 |
|  =========================================                                  |
|                                                                             |
|  # Fetch secret value                                                       |
|  gcloud secrets versions access latest \                                    |
|    --secret="hta-database-url-staging"                                      |
|                                                                             |
|  # Use in environment                                                       |
|  export DATABASE_URL=$(gcloud secrets versions access latest \              |
|    --secret="hta-database-url-staging")                                     |
|                                                                             |
|  APPROACH 3: Secret Manager SDK (for testing secret access)                 |
|  ==========================================================                 |
|                                                                             |
|  # Requires Application Default Credentials                                 |
|  gcloud auth application-default login                                      |
|                                                                             |
+---------------------------------------------------------------------------+
```

### .env.example Template

```bash
# .env.example
# Copy to .env.local and fill in values

# Database
DATABASE_URL="postgresql://user:password@localhost:5432/hta_calibration"

# Authentication
NEXTAUTH_URL="http://localhost:3000"
NEXTAUTH_SECRET="generate-with-openssl-rand-base64-32"

# Email (optional for local dev)
SMTP_HOST="localhost"
SMTP_PORT="1025"
SMTP_USER=""
SMTP_PASS=""

# Storage (local development uses filesystem)
STORAGE_TYPE="local"
# For GCS testing:
# GCS_BUCKET_NAME="hta-calibration-dev"
# GCS_PROJECT_ID="hta-calibration-dev"

# OpenSign (optional)
OPENSIGN_API_URL="http://localhost:3001"
OPENSIGN_API_KEY=""
```

---

## Access Control

### IAM Configuration

```hcl
# terraform/modules/secrets/iam.tf

# Application service account - can read secrets
resource "google_secret_manager_secret_iam_member" "app_reader" {
  for_each  = toset(local.app_secrets)
  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.app_service_account}"
}

# CI/CD service account - can read secrets for deployment
resource "google_secret_manager_secret_iam_member" "cicd_reader" {
  for_each  = toset(local.cicd_secrets)
  project   = var.project_id
  secret_id = each.value
  role      = "roles/secretmanager.secretAccessor"
  member    = "serviceAccount:${var.cicd_service_account}"
}

# Dev-Admin - can manage all secrets
resource "google_project_iam_member" "dev_admin_secrets" {
  project = var.project_id
  role    = "roles/secretmanager.admin"
  member  = "group:dev-admins@hta-calibration.com"
}

# Lab-Admin - NO direct secret access
# (they manage tenant settings via application, not secrets directly)

locals {
  app_secrets = [
    "hta-database-url-${var.environment}",
    "hta-nextauth-secret-${var.environment}",
    "hta-encryption-key-${var.environment}",
    "hta-smtp-credentials-${var.environment}"
  ]

  cicd_secrets = [
    "hta-database-url-${var.environment}"
  ]
}
```

---

## Implementation Checklist

### Prerequisites
- [ ] Secret Manager API enabled
- [ ] Service accounts created
- [ ] Workload Identity configured

### Phase 1: Secret Manager Setup
- [ ] Create secret resources in Terraform
- [ ] Configure replication
- [ ] Set up IAM bindings
- [ ] Add initial secret versions

### Phase 2: Kubernetes Integration
- [ ] Install External Secrets Operator
- [ ] Create ClusterSecretStore
- [ ] Create ExternalSecret resources
- [ ] Verify secrets sync to K8s

### Phase 3: Application Integration
- [ ] Update deployment to use secrets
- [ ] Remove hardcoded values
- [ ] Test secret access in application
- [ ] Verify secret refresh works

### Phase 4: Tenant Secrets
- [ ] Implement tenant secret creation
- [ ] Implement tenant secret retrieval
- [ ] Integrate with webhook signing
- [ ] Test tenant secret isolation

### Phase 5: Rotation
- [ ] Set up rotation Cloud Function
- [ ] Configure rotation schedule
- [ ] Test rotation process
- [ ] Document rotation procedures

---

## Related Documents

- [Overview](./00_scaleup_overview.md)
- [Security Implementation](./09_security_implementation.md)
- [Multi-Tenancy Implementation](./12_multi_tenancy_implementation.md)
- [Terraform IaC](./05_terraform_iac.md)
