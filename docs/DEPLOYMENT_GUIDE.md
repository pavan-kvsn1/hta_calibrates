# HTA Calibration - Deployment Guide

> **Purpose**: Step-by-step instructions to deploy the HTA Calibration app to production on Google Cloud Platform.

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Phase 1: GCP Project Setup](#2-phase-1-gcp-project-setup)
3. [Phase 2: Deploy Infrastructure with Terraform](#3-phase-2-deploy-infrastructure-with-terraform)
4. [Phase 3: Build and Push Docker Image](#4-phase-3-build-and-push-docker-image)
5. [Phase 4: Deploy to Kubernetes](#5-phase-4-deploy-to-kubernetes)
6. [Phase 5: Configure DNS and SSL](#6-phase-5-configure-dns-and-ssl)
7. [Phase 6: Verify Deployment](#7-phase-6-verify-deployment)
8. [Ongoing Maintenance](#8-ongoing-maintenance)
9. [Estimated Costs](#9-estimated-costs)
10. [Delete Everything & Start Fresh](#10-delete-everything--start-fresh)
11. [Troubleshooting](#11-troubleshooting)

---

## 1. Prerequisites

### Tools You Need Installed

| Tool | Purpose | Installation |
|------|---------|--------------|
| **Google Cloud SDK** | Interact with GCP | [Install Guide](https://cloud.google.com/sdk/docs/install) |
| **Terraform** (v1.5+) | Provision infrastructure | `choco install terraform` (Windows) |
| **Docker Desktop** | Build container images | [Install Guide](https://docs.docker.com/desktop/) |
| **kubectl** | Manage Kubernetes | Included with gcloud SDK |
| **Node.js** (v18+) | Build the application | [Install Guide](https://nodejs.org/) |

### Accounts You Need

- [ ] **Google Cloud Account** with billing enabled
- [ ] **Domain name** (e.g., `htacalibration.com`) - optional but recommended
- [ ] **GitHub account** (for CI/CD integration)

### Estimated Time

| Phase | Duration |
|-------|----------|
| GCP Project Setup | 15-30 minutes |
| Terraform Infrastructure | 20-30 minutes |
| Docker Build & Push | 10-15 minutes |
| Kubernetes Deployment | 15-20 minutes |
| DNS & SSL Setup | 10-30 minutes (+ propagation time) |
| **Total** | **~2 hours** |

---

## 2. Phase 1: GCP Project Setup

### Step 1.1: Create GCP Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click **Select Project** → **New Project**
3. Enter project details:
   - **Project Name**: `HTA Calibration` (or your preferred name)
   - **Project ID**: `hta-calibration-prod` (note this - you'll need it!)
   - **Organization**: Select if applicable
4. Click **Create**

### Step 1.2: Enable Billing

1. Go to **Billing** in the left sidebar
2. Link a billing account to your project
3. Set up **Budget Alerts** (recommended):
   - Go to **Billing** → **Budgets & Alerts**
   - Create budget: $100/month with alerts at 50%, 90%, 100%

### Step 1.3: Authenticate Your Terminal

```bash
# Login to Google Cloud
gcloud auth login

# Set your project
gcloud config set project YOUR_PROJECT_ID

# Enable application default credentials (for Terraform)
gcloud auth application-default login
```

### Step 1.4: Enable Required APIs

```bash
# Run this command to enable all required APIs
gcloud services enable \
  compute.googleapis.com \
  container.googleapis.com \
  sqladmin.googleapis.com \
  servicenetworking.googleapis.com \
  secretmanager.googleapis.com \
  cloudresourcemanager.googleapis.com \
  iam.googleapis.com \
  logging.googleapis.com \
  monitoring.googleapis.com \
  artifactregistry.googleapis.com \
  dns.googleapis.com
```

**Checkpoint**: Run `gcloud services list --enabled` to verify APIs are enabled.

---

## 3. Phase 2: Deploy Infrastructure with Terraform

### Step 2.1: Configure Shared Resources

```bash
# Navigate to shared terraform config
cd terraform/shared

# Create your variables file
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:
```hcl
project_id = "YOUR_PROJECT_ID"  # e.g., "hta-calibration-prod"
region     = "asia-south1"       # Mumbai region (closest to India)
```

### Step 2.2: Deploy Shared Resources

```bash
# Initialize Terraform
terraform init

# Preview what will be created
terraform plan

# Deploy (type 'yes' when prompted)
terraform apply
```

**What gets created**:
- Artifact Registry (Docker image storage)
- Terraform state bucket

### Step 2.3: Configure Docker for GCP (Do This Now!)

**IMPORTANT**: Run this immediately after shared resources are created:

```bash
# Configure Docker to authenticate with GCP Artifact Registry
gcloud auth configure-docker asia-south1-docker.pkg.dev
```

Type `Y` when prompted.

**Why now?** The Artifact Registry was just created. You need to tell Docker how to talk to it before you can push images later.

### Step 2.4: Verify Shared Resources

```bash
# Verify registry exists
gcloud artifacts repositories list --location=asia-south1
```

You should see `hta-calibration` in the output.

### Step 2.5: Configure Dev/Production Environment

```bash
# Navigate to environment config
cd ../environments/dev  # Use 'prod' for production

# Create your variables file
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:
```hcl
project_id = "YOUR_PROJECT_ID"
region     = "asia-south1"
```

### Step 2.6: Deploy Environment Infrastructure

```bash
# Initialize Terraform
terraform init

# Preview what will be created
terraform plan

# Deploy (type 'yes' when prompted)
# This takes 10-15 minutes for GKE cluster creation
terraform apply
```

**What gets created**:
- VPC Network with subnets
- GKE Kubernetes Cluster
- Cloud SQL PostgreSQL database
- Cloud Storage buckets
- Service accounts
- Secret Manager secrets

### Step 2.7: Save Important Outputs

After deployment, save these outputs:
```bash
# Get cluster credentials
terraform output get_credentials_command

# Get database connection info
terraform output database_connection_name
terraform output database_private_ip

# Get bucket names
terraform output certificates_bucket
terraform output signatures_bucket
```

**Checkpoint**: Run the `get_credentials_command` output and verify with `kubectl get nodes`.

---

## 4. Phase 3: Build and Push Docker Image

> **Note**: If you followed Phase 2 correctly, Docker is already configured. If you skipped Step 2.3, run `gcloud auth configure-docker asia-south1-docker.pkg.dev` now.

### Step 3.1: Build the Application

```bash
# Navigate to app directory
cd hta-calibration

# Install dependencies
npm install

# Build the application
npm run build
```

### Step 3.2: Build Docker Image

```bash
# Build the Docker image
docker build -t hta-calibration:latest .

# Tag for Artifact Registry
docker tag hta-calibration:latest \
  asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/hta-calibration/app:latest

# Also tag with version
docker tag hta-calibration:latest \
  asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/hta-calibration/app:v1.0.0
```

### Step 3.3: Push to Artifact Registry

```bash
# Push the image
docker push asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/hta-calibration/app:latest
docker push asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/hta-calibration/app:v1.0.0
```

**Common Error**: `Repository "hta-calibration" not found`
- **Cause 1**: You didn't run `terraform apply` in `terraform/shared/`
- **Cause 2**: You didn't run `gcloud auth configure-docker asia-south1-docker.pkg.dev`
- **Fix**: Run both commands above

**Checkpoint**: Verify image in GCP Console → Artifact Registry.

---

## 5. Phase 4: Deploy to Kubernetes

### Step 4.1: Connect to GKE Cluster

```bash
# Get cluster name
gcloud container clusters list --project YOUR_PROJECT_ID

#If already in the correct project, you can skip the project flag
gcloud container clusters list
```

```bash
# Get credentials (use command from Terraform output)
gcloud container clusters get-credentials YOUR_CLUSTER_NAME \
  --region asia-south1 \
  --project YOUR_PROJECT_ID

# Verify connection
kubectl get nodes
```

**Error: gke-gcloud-auth-plugin not found?** Run:
```bash
gcloud components install gke-gcloud-auth-plugin
```

#### What if `kubectl get nodes` Returns Empty?

This behavior depends on which environment you're deploying to. Each environment uses a different GKE cluster mode:

| Environment | Cluster Mode | Nodes Visible? | Why? |
|-------------|--------------|----------------|------|
| **dev** | Autopilot | No (until pods deployed) | Google manages nodes on-demand |
| **staging** | Zonal | Yes (always) | You manage nodes, single zone |
| **prod** | Regional | Yes (always) | You manage nodes, multi-zone HA |

**Understanding GKE Cluster Modes:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  AUTOPILOT (dev)                                                            │
│  ─────────────────                                                          │
│  • Google fully manages the nodes                                           │
│  • Nodes are created ON-DEMAND when you deploy workloads                    │
│  • `kubectl get nodes` returns empty until you deploy pods                  │
│  • Most cost-effective for development (pay only for running pods)          │
│  • Less control, but zero node maintenance                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  ZONAL (staging)                                                            │
│  ─────────────────                                                          │
│  • You manage the nodes (with autoscaling)                                  │
│  • Nodes exist immediately after cluster creation                           │
│  • Single zone = lower cost, but single point of failure                    │
│  • Good balance of cost and control for staging/testing                     │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  REGIONAL (prod)                                                            │
│  ─────────────────                                                          │
│  • You manage the nodes (with autoscaling)                                  │
│  • Nodes spread across multiple zones (e.g., asia-south1-a, b, c)           │
│  • High availability - survives zone outages                                │
│  • Higher cost, but production-grade reliability                            │
└─────────────────────────────────────────────────────────────────────────────┘
```

**If deploying to DEV (Autopilot) and nodes are empty:**

This is **expected behavior**. Simply continue to Step 4.2. Nodes will appear automatically when you deploy your application:

```bash
# After running this, nodes will be created automatically
kubectl apply -k k8s/overlays/development

# Wait 1-2 minutes, then check again
kubectl get nodes
```

**If deploying to STAGING/PROD and nodes are empty:**

This is **unexpected**. Troubleshoot with:

```bash
# Check cluster status
gcloud container clusters describe YOUR_CLUSTER_NAME --region asia-south1 --format="value(status)"

# Check node pools exist
gcloud container node-pools list --cluster=YOUR_CLUSTER_NAME --region=asia-south1

# If node pool exists but nodes=0, resize it
gcloud container clusters resize YOUR_CLUSTER_NAME \
  --node-pool=YOUR_PROJECT_ID-primary-pool \
  --num-nodes=1 \
  --region=asia-south1
```

**Verify which cluster mode you have:**

```bash
gcloud container clusters describe YOUR_CLUSTER_NAME \
  --region asia-south1 \
  --format="value(autopilot.enabled)"
```
- Returns `True` → Autopilot (empty nodes is normal)
- Returns empty → Standard (empty nodes needs investigation)

### Step 4.2: Update K8s Configuration Files

Before deploying, you need to update the K8s manifests with your project-specific values.

**Edit `k8s/base/deployment.yaml` (line 25)** - Update the image with your project ID:
```yaml
image: asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/hta-calibration/app:latest
```

**Edit `k8s/base/configmap.yaml`** - Update these values:
```yaml
data:
  NEXTAUTH_URL: "http://YOUR_EXTERNAL_IP"  # Update after getting IP in Step 4.5
  GCS_CERTIFICATES_BUCKET: "YOUR_PROJECT_ID-certificates-dev"
  GCS_SIGNATURES_BUCKET: "YOUR_PROJECT_ID-signatures-dev"
  GCS_UPLOADS_BUCKET: "YOUR_PROJECT_ID-uploads-dev"
```

> **Note**: You'll update `NEXTAUTH_URL` again after getting the external IP.

### Step 4.3: Create Kubernetes Secret

The K8s manifests expect a single secret named `hta-secrets` with two keys.

**For Bash (Linux/Mac):**
```bash
# Get database password from Secret Manager
DB_PASSWORD=$(gcloud secrets versions access latest \
  --secret="YOUR_PROJECT_ID-db-password-dev")

# Get database private IP
DB_IP=$(cd terraform/environments/dev && terraform output -raw database_private_ip)

# Generate NextAuth secret
NEXTAUTH_SECRET=$(openssl rand -base64 32)

# Create the Kubernetes secret
kubectl create namespace hta-calibration  # Create namespace first
kubectl create secret generic hta-secrets \
  --namespace=hta-calibration \
  --from-literal=database-url="postgresql://hta_app:${DB_PASSWORD}@${DB_IP}:5432/hta_calibration" \
  --from-literal=nextauth-secret="${NEXTAUTH_SECRET}"
```

**For PowerShell (Windows):**
```powershell
# Get database password from Secret Manager
$DB_PASSWORD = gcloud secrets versions access latest --secret="YOUR_PROJECT_ID-db-password-dev"

# Get database private IP (run from terraform/environments/dev folder)
$DB_IP = terraform output -raw database_private_ip

# Generate NextAuth secret
$NEXTAUTH_SECRET = [Convert]::ToBase64String((1..32 | ForEach-Object { Get-Random -Maximum 256 }) -as [byte[]])

# Create the Kubernetes secret
kubectl create namespace hta-calibration  # Create namespace first
kubectl create secret generic hta-secrets `
  --namespace=hta-calibration `
  --from-literal=database-url="postgresql://hta_app:$DB_PASSWORD@${DB_IP}:5432/hta_calibration" `
  --from-literal=nextauth-secret="$NEXTAUTH_SECRET"
```

### Step 4.4: Deploy to Kubernetes

The K8s manifests use **Kustomize** (built into kubectl). The structure is:

```
k8s/
├── base/                      # Base manifests (shared across all environments)
│   ├── deployment.yaml        # ← You edited this in Step 4.2
│   ├── configmap.yaml         # ← You edited this in Step 4.2
│   ├── service.yaml
│   └── ...
└── overlays/                  # Environment-specific patches (replicas, resources)
    ├── development/           # ← 1 replica, lower resources
    ├── staging/               # ← 2 replicas
    └── production/            # ← 3 replicas, higher resources
```

### Step 4.5: Apply the Deployment

```bash
# Deploy using Kustomize (for development environment)
kubectl apply -k k8s/overlays/development

# Check deployment status
kubectl get pods -n hta-calibration

# Get the external IP (wait for it to be assigned, may take 1-2 minutes)
kubectl get svc -n hta-calibration
```

**For other environments**, use:
```bash
kubectl apply -k k8s/overlays/staging      # Staging
kubectl apply -k k8s/overlays/production   # Production
```

Wait until you see an actual IP address (not `<pending>`):
```
NAME              TYPE           CLUSTER-IP    EXTERNAL-IP     PORT(S)
hta-calibration   LoadBalancer   10.x.x.x      35.200.123.45   80:31234/TCP
```

#### What if External IP Shows `<pending>`?

The LoadBalancer may stay in `<pending>` state for several reasons. Here's how to diagnose:

**Step 1: Check if pods are running**

```bash
kubectl get pods -n hta-calibration
```

| Pod Status | Meaning | Action |
|------------|---------|--------|
| `Running` | Pods are healthy | LoadBalancer should get IP soon, wait 2-3 mins |
| `Pending` | Nodes being provisioned (Autopilot) | Wait 2-3 mins for nodes to spin up |
| `ContainerCreating` | Image being pulled | Wait 1-2 mins |
| `ImagePullBackOff` | Can't pull Docker image | See "Image Pull Errors" below |
| `CrashLoopBackOff` | App is crashing | Check logs: `kubectl logs -n hta-calibration <pod-name>` |

**Step 2: Check events for errors**

```bash
kubectl get events -n hta-calibration --sort-by='.lastTimestamp'
```

**Step 3: Describe the service**

```bash
kubectl describe svc hta-web -n hta-calibration
```

Look for events at the bottom showing errors.

**Common Issues and Fixes:**

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  ISSUE: ImagePullBackOff / ErrImagePull                                     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Cause: Container image not found or no permission to pull                  │
│                                                                             │
│  Fix:                                                                       │
│  1. Verify image exists in Artifact Registry:                               │
│     gcloud artifacts docker images list \                                   │
│       asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/hta-calibration            │
│                                                                             │
│  2. If empty, push the image (Phase 3):                                     │
│     docker push asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/hta-calibration/app:latest │
│                                                                             │
│  3. Verify image path in deployment.yaml matches exactly                    │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  ISSUE: Pods stuck in Pending (Autopilot)                                   │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Cause: Autopilot is provisioning nodes (normal, takes 2-3 minutes)         │
│                                                                             │
│  Fix: Just wait. Check progress with:                                       │
│     kubectl get events -n hta-calibration -w                                │
│                                                                             │
│  You'll see events like "Scaling up node pool" followed by                  │
│  "Successfully assigned pod to node"                                        │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  ISSUE: Quota exceeded for external IPs                                     │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Cause: GCP project hit limit on external IP addresses                      │
│                                                                             │
│  Fix:                                                                       │
│  1. Check quota: GCP Console → IAM & Admin → Quotas                         │
│  2. Search for "In-use IP addresses"                                        │
│  3. Request increase or release unused IPs                                  │
└─────────────────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────────────────┐
│  ISSUE: CrashLoopBackOff                                                    │
│  ─────────────────────────────────────────────────────────────────────────  │
│  Cause: Application is crashing on startup                                  │
│                                                                             │
│  Fix:                                                                       │
│  1. Check logs: kubectl logs -n hta-calibration <pod-name>                  │
│  2. Common causes:                                                          │
│     - Missing environment variables (DATABASE_URL, NEXTAUTH_SECRET)         │
│     - Database connection failed                                            │
│     - Invalid configuration                                                 │
│  3. Verify secrets exist: kubectl get secrets -n hta-calibration            │
└─────────────────────────────────────────────────────────────────────────────┘
```

**Still stuck?** Run this diagnostic summary:

```bash
echo "=== Pods ===" && kubectl get pods -n hta-calibration
echo "=== Services ===" && kubectl get svc -n hta-calibration
echo "=== Recent Events ===" && kubectl get events -n hta-calibration --sort-by='.lastTimestamp' | tail -10
```

### Step 4.6: Seed the Database (Dev Environment)

The database is empty after initial deployment. You need to seed it with initial data (admin users, test data).

**Option A: Run seed from inside a pod (Recommended)**

```bash
# Exec into the running pod
kubectl exec -it deployment/hta-web -n hta-calibration -- /bin/sh

# Inside the pod, run the seed
npx prisma db push --accept-data-loss
npm run db:seed

# Exit the pod
exit
```

**Option B: Run seed from your local machine**

Use this if pods aren't running yet or you prefer running from your machine. Requires Cloud SQL Auth Proxy.

**Step B.1: Get the Cloud SQL instance connection name**

```bash
# Method 1: From Terraform output (if you deployed with Terraform)
cd terraform/environments/dev
terraform output database_connection_name
# Returns: your-project-id:asia-south1:hta-calibration-prod-db-dev

# Method 2: From gcloud CLI
gcloud sql instances list
# Shows:
# NAME                          REGION        STATUS
# hta-calibration-prod-db-dev   asia-south1   RUNNABLE

# Get the full connection name
gcloud sql instances describe hta-calibration-prod-db-dev --format="value(connectionName)"
# Returns: your-project-id:asia-south1:hta-calibration-prod-db-dev
```

You can also find this in GCP Console → Cloud SQL → Click instance → **Connection name**

**Step B.2: Get the database password**

```bash
# From Secret Manager
gcloud secrets versions access latest --secret="YOUR_PROJECT_ID-db-password-dev"
```

**Step B.3: Start Cloud SQL Auth Proxy and run seed**

```bash
# Terminal 1: Start Cloud SQL Auth Proxy
cloud-sql-proxy YOUR_PROJECT_ID:asia-south1:YOUR_INSTANCE_NAME --port=5432

# Terminal 2: Set DATABASE_URL and run seed
# For PowerShell:
$env:DATABASE_URL="postgresql://hta_app:YOUR_DB_PASSWORD@localhost:5432/hta_calibration"

# For Bash:
export DATABASE_URL="postgresql://hta_app:YOUR_DB_PASSWORD@localhost:5432/hta_calibration"

# Run seed
cd hta-calibration
npx prisma db push --accept-data-loss
npm run db:seed
```

> **Note**: If you don't have Cloud SQL Auth Proxy installed, download it from [Google Cloud SQL Proxy](https://cloud.google.com/sql/docs/postgres/sql-proxy#install).

**Seeded Data Includes:**

| Type | Examples |
|------|----------|
| **Admin Users** | admin@htaipl.com (Master Admin) |
| **Engineers** | kiran@htaipl.com, rajesh@htaipl.com, etc. |
| **Customer Accounts** | Test Company Pvt Ltd, Beta Corporation |
| **Customer Users** | customer@example.com, beta@betacorp.com |
| **Master Instruments** | Imported from master-instruments.json |

**Test Credentials (from seed):**

| Email | Password | Role |
|-------|----------|------|
| admin@htaipl.com | admin123 | Master Admin |
| kiran@htaipl.com | engineer123 | Engineer |
| rajesh@htaipl.com | engineer123 | Engineer |
| customer@example.com | customer123 | Customer (Test Company) |
| beta@betacorp.com | customer123 | Customer (Beta Corp) |

> **Note**: For staging/production, you may want to create users manually through the admin interface rather than using seed data.

### Step 4.7: Update NEXTAUTH_URL with External IP

Now that you have the external IP, update the ConfigMap:

**Edit `k8s/base/configmap.yaml`:**
```yaml
data:
  NEXTAUTH_URL: "http://35.200.123.45"  # Replace with YOUR actual external IP
```

Then reapply and restart:
```bash
# Reapply the updated configmap
kubectl apply -k k8s/overlays/development

# Restart the deployment to pick up changes
kubectl rollout restart deployment/hta-web -n hta-calibration

# Watch pods come back up
kubectl get pods -n hta-calibration -w
```

**Checkpoint**: Access the app via the external IP: `http://EXTERNAL_IP`

### Updating NEXTAUTH_URL Later

**When you get a domain**, update the ConfigMap:

**Edit `k8s/base/configmap.yaml`:**
```yaml
data:
  NEXTAUTH_URL: "https://yourdomain.com"
```

Then apply and restart:
```bash
kubectl apply -k k8s/overlays/development
kubectl rollout restart deployment/hta-web -n hta-calibration
```

---

## 6. Phase 5: Configure DNS and SSL

### Step 5.1: Get Load Balancer IP

```bash
# Get the external IP
kubectl get svc hta-web -n hta-calibration -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

### Step 5.2: Configure DNS (at your domain registrar)

Add these DNS records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | YOUR_EXTERNAL_IP | 300 |
| A | www | YOUR_EXTERNAL_IP | 300 |
| CNAME | api | YOUR_EXTERNAL_IP | 300 |

### Step 5.3: Set Up SSL with Google Managed Certificate

Edit `k8s/base/managed-cert.yaml` and replace the domain placeholders with your actual domain:
```yaml
spec:
  domains:
    - yourdomain.com        # Replace with your actual domain
    - www.yourdomain.com    # Replace with your actual domain
```

Then apply:
```bash
# Reserve a static IP
gcloud compute addresses create hta-calibration-ip --global

# Apply the ingress and certificate
kubectl apply -f k8s/base/managed-cert.yaml
```

**Note**: SSL certificate provisioning takes 10-30 minutes.

---

## 7. Phase 6: Verify Deployment

### Checklist

- [ ] **Application loads**: Visit `https://your-domain.com`
- [ ] **SSL certificate**: Check for padlock in browser
- [ ] **Login works**: Test user authentication
- [ ] **Database connected**: Create a test certificate
- [ ] **File uploads work**: Test signature upload
- [ ] **PDF generation**: Generate a certificate PDF

### Health Check Endpoints

```bash
# Basic health
curl https://your-domain.com/api/health

# Ready check (includes DB)
curl https://your-domain.com/api/health/ready
```

### View Logs

```bash
# Application logs
kubectl logs -f deployment/hta-web -n hta-calibration

# All pods
kubectl get pods -n hta-calibration
```

---

## 8. Ongoing Maintenance

### Deploy Updates

```bash
# Build new image
docker build -t asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/hta-calibration/app:v1.1.0 .

# Push image
docker push asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/hta-calibration/app:v1.1.0

# Update deployment
kubectl set image deployment/hta-web \
  app=asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/hta-calibration/app:v1.1.0 \
  -n hta-calibration
```

### Database Migrations

```bash
# Connect to a pod
kubectl exec -it deployment/hta-web -n hta-calibration -- /bin/sh

# Run migrations
npx prisma migrate deploy
```

### Backup Database

```bash
# Cloud SQL automatic backups are enabled
# Manual backup:
gcloud sql backups create --instance=YOUR_INSTANCE_NAME
```

### Scale Application

```bash
# Scale to 3 replicas
kubectl scale deployment/hta-web --replicas=3 -n hta-calibration

# Or enable autoscaling
kubectl autoscale deployment/hta-web \
  --min=2 --max=5 --cpu-percent=70 \
  -n hta-calibration
```

---

## 9. Estimated Costs

### Monthly Cost Breakdown (Production)

| Service | Configuration | Est. Cost/Month |
|---------|---------------|-----------------|
| GKE Cluster | 2 x e2-medium nodes | $50-80 |
| Cloud SQL | db-g1-small, 20GB | $30-50 |
| Cloud Storage | ~10GB | $1-5 |
| Load Balancer | 1 forwarding rule | $18-20 |
| Cloud NAT | Egress traffic | $5-15 |
| Networking | Egress | $5-20 |
| **Total** | | **$110-190** |

### Cost Optimization Tips

1. **Dev environment**: Use `db-f1-micro` for database (~$8/month)
2. **Preemptible nodes**: 60-80% cheaper (for non-critical workloads)
3. **Committed use**: 1-year commit saves 20-57%
4. **Right-size**: Start small, scale as needed

---

## 10. Delete Everything & Start Fresh

If something went wrong and you want to start over, follow these steps to destroy all infrastructure.

### Step 10.1: Destroy Dev Environment

```bash
cd hta-calibration/terraform/environments/dev
terraform destroy
```

Type `yes` when prompted. This deletes:
- GKE Cluster
- Cloud SQL Database
- Storage Buckets
- Service Accounts
- Secrets

**Note**: This takes 10-15 minutes.

### Step 10.2: Destroy Shared Resources

```bash
cd ../../../terraform/shared
terraform destroy
```

Type `yes` when prompted. This deletes:
- Artifact Registry (Docker images)
- Terraform State Bucket

### Step 10.3: Verify Everything is Deleted

```bash
# Check for remaining resources
gcloud artifacts repositories list --location=asia-south1
gcloud container clusters list
gcloud sql instances list
gsutil ls
```

All commands should return empty results.

### Step 10.4: Start Fresh

Now follow the guide from the beginning:

1. [Phase 1: GCP Project Setup](#2-phase-1-gcp-project-setup) - Re-authenticate
2. [Phase 2: Deploy Infrastructure](#3-phase-2-deploy-infrastructure-with-terraform) - Deploy shared, then dev
3. [Phase 3: Build and Push Docker](#4-phase-3-build-and-push-docker-image) - **Don't forget `gcloud auth configure-docker`!**
4. Continue with remaining phases...

---

## 11. Troubleshooting

### Pod Won't Start

```bash
# Check pod status
kubectl describe pod POD_NAME -n hta-calibration

# Check logs
kubectl logs POD_NAME -n hta-calibration
```

### Database Connection Failed

```bash
# Verify Cloud SQL is running
gcloud sql instances describe YOUR_INSTANCE_NAME

# Check if pod can reach database
kubectl exec -it POD_NAME -n hta-calibration -- nc -zv PRIVATE_IP 5432
```

### SSL Certificate Pending

```bash
# Check certificate status
kubectl describe managedcertificate hta-calibration-cert -n hta-calibration
```

Certificates can take up to 30 minutes. Ensure:
- DNS records point to the correct IP
- Domain is accessible from the internet

### Out of Memory

```bash
# Check resource usage
kubectl top pods -n hta-calibration

# Increase limits in deployment.yaml
resources:
  limits:
    memory: "1Gi"
```

---

## Quick Reference Commands

```bash
# View all resources
kubectl get all -n hta-calibration

# View logs
kubectl logs -f deployment/hta-web -n hta-calibration

# Shell into pod
kubectl exec -it deployment/hta-web -n hta-calibration -- /bin/sh

# Restart deployment
kubectl rollout restart deployment/hta-web -n hta-calibration

# Check Terraform state
cd terraform/environments/dev && terraform show

# Destroy everything (CAREFUL!)
terraform destroy
```

---

## Next Steps After Deployment

1. [ ] Set up monitoring dashboards in GCP Console
2. [ ] Configure alerting for downtime
3. [ ] Set up automated backups verification
4. [ ] Create staging environment
5. [ ] Set up CI/CD pipeline for automatic deployments
6. [ ] Document runbooks for common operations

---

**Need Help?**
- Check the detailed documentation in `docs/scaleup_plans/detailed_plan/`
- Review system design concepts in `docs/system_design/`
