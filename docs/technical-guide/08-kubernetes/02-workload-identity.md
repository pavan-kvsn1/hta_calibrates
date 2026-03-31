# GKE Workload Identity

## Overview

Workload Identity is the recommended way to access Google Cloud services from applications running in GKE. It binds Kubernetes Service Accounts to Google Cloud Service Accounts.

---

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    WORKLOAD IDENTITY FLOW                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│    GKE Cluster                         Google Cloud             │
│    ───────────                         ────────────             │
│                                                                  │
│    ┌─────────────────┐                ┌─────────────────┐       │
│    │   Pod           │                │  Cloud Storage  │       │
│    │   (hta-web)     │──────────────►│  Cloud SQL      │       │
│    │                 │                │  Secret Manager │       │
│    └────────┬────────┘                └────────▲────────┘       │
│             │                                   │                │
│             │ uses                              │ authenticated  │
│             ▼                                   │ via            │
│    ┌─────────────────┐                         │                │
│    │ K8s Service     │                         │                │
│    │ Account         │                         │                │
│    │ (hta-app)       │                         │                │
│    └────────┬────────┘                         │                │
│             │                                   │                │
│             │ annotated with                   │                │
│             ▼                                   │                │
│    ┌─────────────────┐     bound to     ┌──────┴────────┐       │
│    │ iam.gke.io/     │────────────────►│ GCP Service   │       │
│    │ gcp-service-    │                  │ Account       │       │
│    │ account         │                  │ (hta-app-dev) │       │
│    └─────────────────┘                  └───────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Configuration

### Kubernetes Service Account

```yaml
# k8s/base/serviceaccount.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: hta-app
  namespace: hta-calibration
  labels:
    app.kubernetes.io/name: hta-calibration
    app.kubernetes.io/part-of: hta-calibration
  annotations:
    iam.gke.io/gcp-service-account: hta-app-dev@PROJECT_ID.iam.gserviceaccount.com
```

### Key Annotation

```yaml
annotations:
  iam.gke.io/gcp-service-account: GCP_SERVICE_ACCOUNT@PROJECT.iam.gserviceaccount.com
```

This annotation links the Kubernetes Service Account to a GCP Service Account.

---

## Environment-Specific Service Accounts

### Development

```yaml
# k8s/overlays/development/serviceaccount-patch.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: hta-app
  namespace: hta-calibration
  annotations:
    iam.gke.io/gcp-service-account: hta-app-dev@hta-calibration-prod.iam.gserviceaccount.com
```

### Production

```yaml
# k8s/overlays/production/serviceaccount-patch.yaml
apiVersion: v1
kind: ServiceAccount
metadata:
  name: hta-app
  namespace: hta-calibration
  annotations:
    iam.gke.io/gcp-service-account: hta-app-prod@hta-calibration-prod.iam.gserviceaccount.com
```

---

## GCP IAM Configuration

### Create GCP Service Account

```bash
# Create service account
gcloud iam service-accounts create hta-app-dev \
  --display-name="HTA Calibration App (Dev)" \
  --project=hta-calibration-prod
```

### Grant Workload Identity Binding

```bash
# Allow K8s SA to impersonate GCP SA
gcloud iam service-accounts add-iam-policy-binding \
  hta-app-dev@hta-calibration-prod.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "serviceAccount:hta-calibration-prod.svc.id.goog[hta-calibration/hta-app]" \
  --project=hta-calibration-prod
```

The member format is:
```
serviceAccount:PROJECT_ID.svc.id.goog[NAMESPACE/K8S_SA_NAME]
```

### Grant Required Permissions

```bash
# Cloud SQL access
gcloud projects add-iam-policy-binding hta-calibration-prod \
  --member="serviceAccount:hta-app-dev@hta-calibration-prod.iam.gserviceaccount.com" \
  --role="roles/cloudsql.client"

# Secret Manager access
gcloud projects add-iam-policy-binding hta-calibration-prod \
  --member="serviceAccount:hta-app-dev@hta-calibration-prod.iam.gserviceaccount.com" \
  --role="roles/secretmanager.secretAccessor"

# Cloud Storage access
gcloud projects add-iam-policy-binding hta-calibration-prod \
  --member="serviceAccount:hta-app-dev@hta-calibration-prod.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"

# Logging
gcloud projects add-iam-policy-binding hta-calibration-prod \
  --member="serviceAccount:hta-app-dev@hta-calibration-prod.iam.gserviceaccount.com" \
  --role="roles/logging.logWriter"

# Monitoring
gcloud projects add-iam-policy-binding hta-calibration-prod \
  --member="serviceAccount:hta-app-dev@hta-calibration-prod.iam.gserviceaccount.com" \
  --role="roles/monitoring.metricWriter"
```

---

## Terraform Configuration

### Service Account Resource

```hcl
# terraform/modules/iam/main.tf

# Application service account
resource "google_service_account" "app" {
  account_id   = "hta-app-${var.environment}"
  display_name = "HTA Calibration App Service Account"
  project      = var.project_id
}

# Workload Identity binding
resource "google_service_account_iam_member" "workload_identity" {
  service_account_id = google_service_account.app.name
  role               = "roles/iam.workloadIdentityUser"
  member             = "serviceAccount:${var.project_id}.svc.id.goog[${var.k8s_namespace}/hta-app]"
}

# Cloud SQL Client
resource "google_project_iam_member" "cloudsql_client" {
  project = var.project_id
  role    = "roles/cloudsql.client"
  member  = "serviceAccount:${google_service_account.app.email}"
}

# Secret Manager access
resource "google_project_iam_member" "secret_accessor" {
  project = var.project_id
  role    = "roles/secretmanager.secretAccessor"
  member  = "serviceAccount:${google_service_account.app.email}"
}

# Storage access
resource "google_storage_bucket_iam_member" "app_buckets" {
  for_each = toset([
    var.certificates_bucket_name,
    var.signatures_bucket_name,
    var.uploads_bucket_name,
  ])

  bucket = each.value
  role   = "roles/storage.objectAdmin"
  member = "serviceAccount:${google_service_account.app.email}"
}
```

---

## Using Workload Identity in Application

### Automatic Authentication

With Workload Identity, the application automatically authenticates using the bound GCP service account. No additional configuration needed.

```typescript
// src/lib/storage.ts
import { Storage } from '@google-cloud/storage'

// Automatically uses Workload Identity credentials
const storage = new Storage()

export async function uploadCertificate(buffer: Buffer, filename: string) {
  const bucket = storage.bucket(process.env.GCS_CERTIFICATES_BUCKET!)
  await bucket.file(filename).save(buffer)
}
```

### Secret Manager

```typescript
// src/lib/secrets.ts
import { SecretManagerServiceClient } from '@google-cloud/secret-manager'

const client = new SecretManagerServiceClient()

export async function getSecret(name: string): Promise<string> {
  const [version] = await client.accessSecretVersion({
    name: `projects/${process.env.GCP_PROJECT}/secrets/${name}/versions/latest`,
  })
  return version.payload?.data?.toString() || ''
}
```

---

## Verifying Configuration

### Check Service Account Binding

```bash
# Verify K8s SA has annotation
kubectl get sa hta-app -n hta-calibration -o yaml

# Should see:
# annotations:
#   iam.gke.io/gcp-service-account: hta-app-dev@PROJECT.iam.gserviceaccount.com
```

### Check IAM Binding

```bash
# Verify GCP SA has Workload Identity User role
gcloud iam service-accounts get-iam-policy \
  hta-app-dev@hta-calibration-prod.iam.gserviceaccount.com
```

### Test from Pod

```bash
# Exec into pod
kubectl exec -it deployment/hta-web -n hta-calibration -- sh

# Check metadata server (Workload Identity)
wget -qO- http://metadata.google.internal/computeMetadata/v1/instance/service-accounts/default/email \
  --header="Metadata-Flavor: Google"

# Should output: hta-app-dev@hta-calibration-prod.iam.gserviceaccount.com
```

### Test GCS Access

```bash
# From within pod
gcloud auth list
gsutil ls gs://hta-calibration-certificates-dev/
```

---

## Troubleshooting

### Permission Denied

**Symptom**:
```
googleapi: Error 403: hta-app-dev@PROJECT.iam.gserviceaccount.com does not have
storage.objects.create access
```

**Fix**: Grant required role to GCP service account:
```bash
gcloud projects add-iam-policy-binding PROJECT \
  --member="serviceAccount:hta-app-dev@PROJECT.iam.gserviceaccount.com" \
  --role="roles/storage.objectAdmin"
```

### Workload Identity Not Working

**Symptom**: Pod uses GKE node service account instead of bound SA

**Debug**:
```bash
# Check pod's SA
kubectl get pod POD_NAME -n hta-calibration -o yaml | grep serviceAccount

# Check annotation
kubectl get sa hta-app -n hta-calibration -o yaml | grep -A1 annotations
```

**Fixes**:
1. Verify annotation format is correct
2. Verify IAM binding exists
3. Restart pods after fixing:
```bash
kubectl rollout restart deployment/hta-web -n hta-calibration
```

### Metadata Server Timeout

**Symptom**:
```
Error retrieving credentials from the GKE Metadata Server
```

**Causes**:
- Workload Identity not enabled on cluster
- Network policy blocking metadata server
- Pod not using correct service account

**Fix**: Verify Workload Identity is enabled:
```bash
gcloud container clusters describe CLUSTER_NAME \
  --region asia-south1 \
  --format="value(workloadIdentityConfig)"
```

---

## Security Best Practices

1. **Least privilege** - Grant only required permissions
2. **Separate service accounts** - Per environment (dev, staging, prod)
3. **Audit IAM bindings** - Regular reviews
4. **Use conditions** - Time-limited or context-aware bindings
5. **Monitor access** - Cloud Audit Logs for service account usage

### Example: Conditional Binding

```bash
# Only allow access during business hours
gcloud iam service-accounts add-iam-policy-binding \
  hta-app-dev@PROJECT.iam.gserviceaccount.com \
  --role roles/iam.workloadIdentityUser \
  --member "serviceAccount:PROJECT.svc.id.goog[hta-calibration/hta-app]" \
  --condition="expression=request.time.getHours('America/New_York') >= 9 && request.time.getHours('America/New_York') <= 17,title=Business Hours Only"
```

---

## Comparison: Workload Identity vs Alternatives

| Method | Security | Management | Recommended |
|--------|----------|------------|-------------|
| Workload Identity | High | Automatic | Yes |
| Service Account Key Files | Low | Manual rotation | No |
| Node Service Account | Medium | Cluster-wide | No |
| External Secrets | High | Extra component | Alternative |

---

## Key Files

| File | Purpose |
|------|---------|
| `k8s/base/serviceaccount.yaml` | K8s SA definition |
| `k8s/overlays/*/serviceaccount-patch.yaml` | Environment-specific SA |
| `terraform/modules/iam/main.tf` | GCP SA and IAM bindings |
