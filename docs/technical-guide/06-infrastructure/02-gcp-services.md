# GCP Services

## Services Used

| Service | Purpose | Module |
|---------|---------|--------|
| Compute Engine | GKE nodes | gke |
| GKE | Kubernetes cluster | gke |
| Cloud SQL | PostgreSQL database | cloudsql |
| Cloud Storage | File storage | storage |
| Secret Manager | Secrets | secrets |
| Artifact Registry | Docker images | shared |
| Cloud NAT | Outbound internet | vpc |
| Cloud Logging | Log aggregation | - |
| Cloud Monitoring | Metrics & alerts | - |

---

## GKE (Google Kubernetes Engine)

### Configuration

| Setting | Dev | Staging | Production |
|---------|-----|---------|------------|
| Node Machine | e2-medium | e2-medium | e2-standard-2 |
| Min Nodes | 1 | 1 | 2 |
| Max Nodes | 2 | 3 | 10 |
| Disk Size | 30GB | 50GB | 100GB |
| Release Channel | REGULAR | REGULAR | STABLE |
| Prometheus | Enabled | Enabled | Enabled |

### Features Enabled

- Workload Identity
- Network Policies (Calico)
- HTTP Load Balancing
- Horizontal Pod Autoscaling
- GCS FUSE CSI Driver
- Shielded Nodes
- Private Nodes

### Accessing the Cluster

```bash
# Get credentials
gcloud container clusters get-credentials hta-calibration-gke-dev \
  --region asia-south1 --project YOUR_PROJECT_ID

# Verify
kubectl get nodes
kubectl get namespaces
```

---

## Cloud SQL

### Configuration

| Setting | Dev | Production |
|---------|-----|------------|
| Version | PostgreSQL 15 | PostgreSQL 15 |
| Tier | db-f1-micro | db-n1-standard-1 |
| Disk | 10GB SSD | 100GB SSD |
| High Availability | No | Yes |
| Point-in-time Recovery | No | Yes |
| Backups | 7 days | 30 days |

### Connecting

**From GKE Pod (via Private IP):**
```bash
# Connection string format
postgresql://hta_app:PASSWORD@PRIVATE_IP:5432/hta_calibration

# Get private IP
terraform output -raw database_private_ip
```

**From Local (via Cloud SQL Proxy):**
```bash
# Download proxy
curl -o cloud-sql-proxy https://dl.google.com/cloudsql/cloud_sql_proxy.linux.amd64
chmod +x cloud-sql-proxy

# Start proxy
./cloud-sql-proxy YOUR_PROJECT:asia-south1:hta-calibration-db-dev \
  --port 5433

# Connect
psql -h localhost -p 5433 -U hta_app -d hta_calibration
```

### Backup & Restore

```bash
# List backups
gcloud sql backups list --instance=hta-calibration-db-dev

# Create on-demand backup
gcloud sql backups create --instance=hta-calibration-db-dev

# Restore from backup
gcloud sql backups restore BACKUP_ID \
  --restore-instance=hta-calibration-db-dev
```

---

## Cloud Storage

### Buckets

| Bucket | Purpose | Lifecycle |
|--------|---------|-----------|
| `*-certificates-*` | Signed PDFs | Archive after 1 year |
| `*-signatures-*` | Signature images | Keep 5 versions |
| `*-uploads-*` | Temporary uploads | Delete after 7 days |
| `*-backups-*` | Database backups | Archive after 90 days |

### Access from Application

```typescript
// Using GCS FUSE CSI (mounted as filesystem)
const filepath = '/gcs/certificates/cert-123.pdf'
await writeFile(filepath, pdfBuffer)

// Using GCS client library
import { Storage } from '@google-cloud/storage'

const storage = new Storage()
const bucket = storage.bucket('hta-calibration-certificates-dev')

await bucket.file('cert-123.pdf').save(pdfBuffer)
```

### CORS Configuration

```json
[
  {
    "origin": ["http://localhost:3000", "https://hta-calibration.example.com"],
    "method": ["GET", "HEAD", "PUT", "POST", "DELETE"],
    "responseHeader": ["Content-Type", "Content-Disposition"],
    "maxAgeSeconds": 3600
  }
]
```

---

## Secret Manager

### Secrets Stored

| Secret | Purpose |
|--------|---------|
| `db-password-*` | Database password |
| `nextauth-secret-*` | NextAuth secret |
| `opensign-api-key-*` | OpenSign API key |

### Accessing Secrets

**In Kubernetes:**
```yaml
# Using External Secrets Operator
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: hta-secrets
spec:
  secretStoreRef:
    kind: ClusterSecretStore
    name: gcp-secret-store
  target:
    name: hta-secrets
  data:
    - secretKey: database-url
      remoteRef:
        key: db-password-dev
```

**In Application:**
```typescript
// Secrets are mounted as environment variables
const dbPassword = process.env.DATABASE_URL

// Or read directly
import { SecretManagerServiceClient } from '@google-cloud/secret-manager'

const client = new SecretManagerServiceClient()
const [version] = await client.accessSecretVersion({
  name: 'projects/PROJECT/secrets/SECRET_NAME/versions/latest'
})
const secret = version.payload?.data?.toString()
```

---

## Artifact Registry

### Repository

```
asia-south1-docker.pkg.dev/PROJECT_ID/hta-calibration/
```

### Push Images

```bash
# Configure Docker
gcloud auth configure-docker asia-south1-docker.pkg.dev

# Tag image
docker tag hta-calibration:latest \
  asia-south1-docker.pkg.dev/PROJECT_ID/hta-calibration/app:latest

# Push
docker push asia-south1-docker.pkg.dev/PROJECT_ID/hta-calibration/app:latest
```

### Cleanup Policy

- Keep 10 most recent versions
- Delete untagged images after 7 days

---

## Cloud NAT

### Configuration

```hcl
resource "google_compute_router_nat" "nat" {
  name                   = "${var.project_id}-nat"
  router                 = google_compute_router.router.name
  nat_ip_allocate_option = "AUTO_ONLY"

  source_subnetwork_ip_ranges_to_nat = "LIST_OF_SUBNETWORKS"

  subnetwork {
    name                    = google_compute_subnetwork.gke.id
    source_ip_ranges_to_nat = ["ALL_IP_RANGES"]
  }

  log_config {
    enable = true
    filter = "ERRORS_ONLY"
  }
}
```

### Purpose

- GKE private nodes need NAT for outbound internet
- Required for:
  - Pulling public container images
  - Accessing external APIs
  - Sending emails

---

## Cloud Logging

### Log Types

| Log | Source | Retention |
|-----|--------|-----------|
| Container logs | GKE pods | 30 days |
| System logs | GKE system | 30 days |
| Audit logs | API calls | 400 days |
| Data access | Resource access | 30 days |

### Querying Logs

```bash
# Recent application logs
gcloud logging read \
  "resource.type=k8s_container AND resource.labels.namespace_name=hta-calibration" \
  --limit=50

# Errors only
gcloud logging read \
  "resource.type=k8s_container AND severity>=ERROR" \
  --limit=50

# Database logs
gcloud logging read \
  "resource.type=cloudsql_database" \
  --limit=50
```

---

## Cloud Monitoring

### Metrics

| Metric | Source | Dashboard |
|--------|--------|-----------|
| Pod CPU/Memory | GKE | GKE Dashboard |
| Node CPU/Memory | GKE | GKE Dashboard |
| DB Connections | Cloud SQL | Cloud SQL Dashboard |
| Request latency | Load Balancer | Custom |
| Error rate | Logs | Custom |

### Alerting

```bash
# Create alert policy
gcloud alpha monitoring policies create \
  --display-name="High Error Rate" \
  --condition-filter='metric.type="logging.googleapis.com/user/error_count"' \
  --condition-threshold-value=10 \
  --condition-threshold-comparison=COMPARISON_GT \
  --condition-threshold-duration=300s \
  --notification-channels=CHANNEL_ID
```

---

## Cost Optimization

### Dev Environment

- Single-zone GKE (not regional)
- e2-medium nodes (cost-effective)
- db-f1-micro Cloud SQL
- NEARLINE storage class
- Auto-scaling down to 1 node

### Production Environment

- Regional GKE for HA
- Committed use discounts
- Sustained use discounts
- Appropriate machine sizing
- Archive old data to COLDLINE

### Monitoring Costs

```bash
# View billing
gcloud billing accounts list
gcloud billing projects describe PROJECT_ID

# Export billing to BigQuery for analysis
```
