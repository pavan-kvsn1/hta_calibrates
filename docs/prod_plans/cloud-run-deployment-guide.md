# HTA Calibration - Cloud Run Deployment Guide

> **Purpose**: Step-by-step instructions to deploy the HTA Calibration app to Google Cloud Run (serverless alternative to GKE).

---

## Table of Contents

1. [Prerequisites](#1-prerequisites)
2. [Phase 1: GCP Project Setup](#2-phase-1-gcp-project-setup)
3. [Phase 2: Deploy Infrastructure with Terraform](#3-phase-2-deploy-infrastructure-with-terraform)
4. [Phase 3: Build and Push Docker Image](#4-phase-3-build-and-push-docker-image)
5. [Phase 4: Run Database Migrations](#5-phase-4-run-database-migrations)
6. [Phase 5: Deploy to Cloud Run](#6-phase-5-deploy-to-cloud-run)
7. [Phase 6: Configure Custom Domain](#7-phase-6-configure-custom-domain)
8. [Phase 7: Verify Deployment](#8-phase-7-verify-deployment)
9. [Ongoing Maintenance](#9-ongoing-maintenance)
10. [Estimated Costs](#10-estimated-costs)
11. [Delete Everything & Start Fresh](#11-delete-everything--start-fresh)
12. [Troubleshooting](#12-troubleshooting)

---

## Why Cloud Run over GKE?

| Factor | GKE | Cloud Run | Winner |
|--------|-----|-----------|--------|
| **Setup Complexity** | High (nodes, networking, Ingress) | Low (managed) | Cloud Run |
| **Operational Overhead** | High (cluster management) | Zero (serverless) | Cloud Run |
| **Cost at Low Scale** | ~$70-100/month minimum | Pay-per-request | Cloud Run |
| **Auto-scaling** | Requires HPA config | Built-in (0 to N) | Cloud Run |
| **Cold Start** | None (always running) | ~2-5 seconds | GKE |

**Recommendation**: Cloud Run for startups/MVPs, GKE when hitting Cloud Run limits.

---

## 1. Prerequisites

### Tools You Need Installed

| Tool | Purpose | Installation |
|------|---------|--------------|
| **Google Cloud SDK** | Interact with GCP | [Install Guide](https://cloud.google.com/sdk/docs/install) |
| **Terraform** (v1.5+) | Provision infrastructure | `choco install terraform` (Windows) |
| **Docker Desktop** | Build container images | [Install Guide](https://docs.docker.com/desktop/) |
| **Cloud SQL Proxy** | Connect to Cloud SQL locally | [Install Guide](https://cloud.google.com/sql/docs/postgres/sql-proxy#install) |
| **Node.js** (v18+) | Build the application | [Install Guide](https://nodejs.org/) |

### Accounts You Need

- [ ] **Google Cloud Account** with billing enabled
- [ ] **Domain name** (e.g., `htacalibration.com`) - optional but recommended

### Estimated Time

| Phase | Duration |
|-------|----------|
| GCP Project Setup | 15-30 minutes |
| Terraform Infrastructure | 15-20 minutes |
| Docker Build & Push | 10-15 minutes |
| Database Migrations | 10-15 minutes |
| Cloud Run Deployment | 5-10 minutes |
| DNS & SSL Setup | 10-30 minutes (+ propagation) |
| **Total** | **~1.5-2 hours** |

---

## 2. Phase 1: GCP Project Setup

### Step 1.1: Create GCP Project

1. Go to [Google Cloud Console](https://console.cloud.google.com)
2. Click **Select Project** → **New Project**
3. Enter project details:
   - **Project Name**: `HTA Calibration` (or your preferred name)
   - **Project ID**: `hta-calibration-dev1` (note this - you'll need it!)
4. Click **Create**

### Step 1.2: Enable Billing

1. Go to **Billing** in the left sidebar
2. Link a billing account to your project
3. Set up **Budget Alerts** (recommended):
   - Go to **Billing** → **Budgets & Alerts**
   - Create budget: $50/month with alerts at 50%, 90%, 100%

### Step 1.3: Authenticate Your Terminal (PowerShell)

```powershell
# Login to Google Cloud
gcloud auth login

# Set your project
gcloud config set project YOUR_PROJECT_ID

# Enable application default credentials (for Terraform)
gcloud auth application-default login
```

### Step 1.4: Enable Required APIs

```powershell
# Run this command to enable all required APIs
gcloud services enable `
  run.googleapis.com `
  vpcaccess.googleapis.com `
  sqladmin.googleapis.com `
  redis.googleapis.com `
  secretmanager.googleapis.com `
  artifactregistry.googleapis.com `
  compute.googleapis.com `
  servicenetworking.googleapis.com `
  cloudresourcemanager.googleapis.com `
  iam.googleapis.com
```

**Checkpoint**: Run `gcloud services list --enabled` to verify APIs are enabled.

---

## 3. Phase 2: Deploy Infrastructure with Terraform

### Step 2.1: Configure Terraform Variables

```powershell
# Navigate to terraform environment config
cd hta-calibration\terraform\environments\dev

# Create your variables file (if not exists)
cp terraform.tfvars.example terraform.tfvars
```

Edit `terraform.tfvars`:
```hcl
project_id = "YOUR_PROJECT_ID"  # e.g., "hta-calibration-dev1"
region     = "asia-south1"       # Mumbai region
```

### Step 2.2: Deploy Infrastructure

```powershell
# Initialize Terraform
terraform init

# Preview what will be created
terraform plan

# Deploy (type 'yes' when prompted)
# This takes 10-15 minutes
terraform apply
```

**What gets created**:
- VPC Network with subnets
- Cloud SQL PostgreSQL database
- Memorystore Redis (optional)
- Cloud Storage buckets
- Service accounts with IAM
- Secret Manager secrets
- VPC Connector (for Cloud Run to access private resources)
- Artifact Registry (Docker image storage)

### Step 2.3: Configure Docker for GCP

**IMPORTANT**: Run this after Terraform creates the Artifact Registry:

```powershell
# Configure Docker to authenticate with GCP Artifact Registry
gcloud auth configure-docker asia-south1-docker.pkg.dev
```

Type `Y` when prompted.

### Step 2.4: Save Important Outputs

```powershell
# Get database connection info
terraform output database_connection_name
terraform output database_private_ip

# Get bucket names
terraform output certificates_bucket
terraform output signatures_bucket
```

**Checkpoint**: Note down the database connection name for later.

---

## 4. Phase 3: Build and Push Docker Image

### Step 3.1: Build the Application

```powershell
# Navigate to app directory
cd C:\Users\kcsva\OneDrive\Documents\HTACalibr8s\hta-calibration

# Install dependencies
npm install

# Build the application
npm run build
```

### Step 3.2: Build Docker Image

```powershell
# Build and tag the Docker image
docker build -t asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/hta-calibration/app:latest .

# Example:
docker build -t asia-south1-docker.pkg.dev/hta-calibration-dev1/hta-calibration/app:latest .
```

### Step 3.3: Push to Artifact Registry

```powershell
# Push the image
docker push asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/hta-calibration/app:latest

# Example:
docker push asia-south1-docker.pkg.dev/hta-calibration-dev1/hta-calibration/app:latest
```

**Common Error**: `denied: Permission denied`
- **Fix**: Run `gcloud auth configure-docker asia-south1-docker.pkg.dev`

**Checkpoint**: Verify image in GCP Console → Artifact Registry.

---

## 5. Phase 4: Run Database Migrations

Database migrations require connecting to Cloud SQL. Since the instance uses **private IP only** (for security), you need Cloud SQL Proxy to connect from your local machine.

### Step 4.1: Get Instance Name

```powershell
# List all SQL instances
gcloud sql instances list

# Example output:
# NAME                                          DATABASE_VERSION  LOCATION
# hta-calibration-dev1-postgres-dev-44c3965f    POSTGRES_15       asia-south1-a
```

Note the full instance name.

### Step 4.2: Enable Public IP Temporarily

```powershell
# Enable public IP (required for Cloud SQL Proxy)
gcloud sql instances patch YOUR_INSTANCE_NAME --assign-ip

# Example:
gcloud sql instances patch hta-calibration-dev1-postgres-dev-44c3965f --assign-ip

# Wait 1-2 minutes for the change to apply
```

### Step 4.3: Start Cloud SQL Proxy (Terminal 1)

Open a PowerShell window:

```powershell
# Start the proxy (keep this running)
cloud-sql-proxy YOUR_PROJECT_ID:asia-south1:YOUR_INSTANCE_NAME --port=5432

# Example:
cloud-sql-proxy hta-calibration-dev1:asia-south1:hta-calibration-dev1-postgres-dev-44c3965f --port=5432
```

You should see:
```
Listening on 127.0.0.1:5432
The proxy has started successfully and is ready for new connections!
```

**Keep this window open** - the proxy must stay running.

### Step 4.4: Get Database Password (Terminal 2)

Open a **new** PowerShell window:

```powershell
# List all secrets to find the password secret
gcloud secrets list

# Get the database password
$DB_PASSWORD = gcloud secrets versions access latest --secret="YOUR_SECRET_NAME"

# Example:
$DB_PASSWORD = gcloud secrets versions access latest --secret="hta-calibration-dev1-db-password-dev"

# Verify password was retrieved
echo $DB_PASSWORD
```

### Step 4.5: Run Migrations

```powershell
# Navigate to project directory
cd C:\Users\kcsva\OneDrive\Documents\HTACalibr8s\hta-calibration

# Set DATABASE_URL (use 127.0.0.1, NOT localhost!)
$env:DATABASE_URL = "postgresql://hta_app:" + $DB_PASSWORD + "@127.0.0.1:5432/hta_calibration"

# Verify the URL is set
echo $env:DATABASE_URL

# Run Prisma migrations
npx prisma migrate deploy

# Seed the database with initial data
npm run db:seed
```

**Important**: Use `127.0.0.1` not `localhost`. See [Troubleshooting](#localhost-vs-127001-windows) for why.

### Step 4.6: Disable Public IP

After migrations complete, disable public IP for security:

```powershell
gcloud sql instances patch YOUR_INSTANCE_NAME --no-assign-ip

# Example:
gcloud sql instances patch hta-calibration-dev1-postgres-dev-44c3965f --no-assign-ip
```

**Checkpoint**: Database is migrated and seeded. Close the Cloud SQL Proxy terminal.

---

## 6. Phase 5: Deploy to Cloud Run

> **Note**: In Phase 2, Terraform created the infrastructure but Cloud Run couldn't fully deploy because the Docker image didn't exist yet. Now that the image is pushed, we deploy Cloud Run.

### Step 5.0: Pre-flight Checks (Important!)

Terraform creates resources with auto-generated names. **You must check the actual names before deploying.**

```powershell
# Get actual VPC connector name
gcloud compute networks vpc-access connectors list --region=asia-south1

# Get actual secret names
gcloud secrets list

# Get actual service account
gcloud iam service-accounts list --filter="displayName~hta"
```

**Example output:**
```
# VPC Connector (might be "hta-dev-connector", not "hta-calibration-dev-connector")
CONNECTOR_ID: hta-dev-connector

# Secrets (prefixed with project ID)
NAME: hta-calibration-dev1-database-url-dev
NAME: hta-calibration-dev1-nextauth-secret-dev
```

### Option A: Deploy via Terraform (Recommended)

Run `terraform apply` again - this time it will deploy Cloud Run with your image:

```powershell
cd terraform\environments\dev
terraform apply
```

### Option B: Deploy via gcloud (Manual)

**Use the actual names from Step 5.0!**

```powershell
$PROJECT_ID = "hta-calibration-dev1"

# Replace these with actual values from Step 5.0:
$VPC_CONNECTOR = "hta-dev-connector"  # From: gcloud compute networks vpc-access connectors list
$DB_SECRET = "hta-calibration-dev1-database-url-dev"  # From: gcloud secrets list
$AUTH_SECRET = "hta-calibration-dev1-nextauth-secret-dev"  # From: gcloud secrets list

gcloud run deploy hta-calibration `
  --image=asia-south1-docker.pkg.dev/$PROJECT_ID/hta-calibration/app:latest `
  --platform=managed `
  --region=asia-south1 `
  --service-account=hta-app-dev@$PROJECT_ID.iam.gserviceaccount.com `
  --vpc-connector=$VPC_CONNECTOR `
  --vpc-egress=private-ranges-only `
  --set-secrets="DATABASE_URL=${DB_SECRET}:latest,NEXTAUTH_SECRET=${AUTH_SECRET}:latest" `
  --min-instances=0 `
  --max-instances=10 `
  --memory=512Mi `
  --cpu=1 `
  --port=3000 `
  --allow-unauthenticated
```

### Step 5.1: Get Service URL

```powershell
# Get the service URL
gcloud run services describe hta-calibration --region=asia-south1 --format="value(status.url)"
```

**Checkpoint**: Visit the URL - you should see the login page.

### Troubleshooting Deployment

| Error | Cause | Solution |
|-------|-------|----------|
| `VPC Connector not found` | Wrong connector name | Run `gcloud compute networks vpc-access connectors list --region=asia-south1` |
| `Secret not found` | Wrong secret name | Run `gcloud secrets list` and use exact name |
| `500 Internal Error` | Transient GCP issue | Wait and retry |
| `Permission denied` | Service account missing roles | Check IAM bindings |

---

## 7. Phase 6: Configure Custom Domain

> **Important**: Cloud Run domain mappings are **NOT supported in asia-south1**. You must use a Global HTTP(S) Load Balancer instead. This adds ~$18-25/month but provides custom domain + SSL.

### Step 6.1: Reserve Static IP

```powershell
# Reserve a global static IP
gcloud compute addresses create hta-calibration-ip --global

# Get the IP address (save this!)
gcloud compute addresses describe hta-calibration-ip --global --format="value(address)"
```

Note the IP address (e.g., `34.107.144.233`) - you'll need it for DNS.

### Step 6.2: Create Serverless NEG

```powershell
# Create Network Endpoint Group pointing to Cloud Run
gcloud compute network-endpoint-groups create hta-neg `
  --region=asia-south1 `
  --network-endpoint-type=serverless `
  --cloud-run-service=hta-calibration
```

### Step 6.3: Create Backend Service

```powershell
# Create backend service
gcloud compute backend-services create hta-backend `
  --global `
  --load-balancing-scheme=EXTERNAL_MANAGED `
  --protocol=HTTPS

# Add NEG to backend
gcloud compute backend-services add-backend hta-backend `
  --global `
  --network-endpoint-group=hta-neg `
  --network-endpoint-group-region=asia-south1
```

### Step 6.4: Create URL Map

```powershell
gcloud compute url-maps create hta-urlmap `
  --default-service=hta-backend
```

### Step 6.5: Create SSL Certificate

```powershell
# For subdomain (recommended for dev)
gcloud compute ssl-certificates create hta-cert `
  --domains=dev.YOUR_DOMAIN.com `
  --global

# Example:
gcloud compute ssl-certificates create hta-cert `
  --domains=dev.hta-calibration.com `
  --global
```

### Step 6.6: Create HTTPS Proxy and Forwarding Rule

```powershell
# Create HTTPS proxy
gcloud compute target-https-proxies create hta-https-proxy `
  --ssl-certificates=hta-cert `
  --url-map=hta-urlmap

# Create HTTPS forwarding rule (port 443)
gcloud compute forwarding-rules create hta-https-rule `
  --global `
  --target-https-proxy=hta-https-proxy `
  --address=hta-calibration-ip `
  --ports=443
```

### Step 6.7: Create HTTP Forwarding Rule (Required for SSL Verification)

```powershell
# Create HTTP proxy
gcloud compute target-http-proxies create hta-http-proxy `
  --url-map=hta-urlmap

# Create HTTP forwarding rule (port 80)
gcloud compute forwarding-rules create hta-http-rule `
  --global `
  --target-http-proxy=hta-http-proxy `
  --address=hta-calibration-ip `
  --ports=80
```

### Step 6.8: Configure DNS

Add an A record in your DNS provider (e.g., GoDaddy):

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | dev | YOUR_STATIC_IP | 600 |

For root domain, use `@` instead of `dev`.

**Verify DNS propagation:**

```powershell
nslookup dev.hta-calibration.com 8.8.8.8
```

Should return your static IP.

### Step 6.9: Wait for SSL Certificate

SSL provisioning takes **10-30 minutes** after DNS is configured.

```powershell
# Check certificate status
gcloud compute ssl-certificates describe hta-cert --global --format="yaml(managed.domainStatus)"
```

Status progression:
- `FAILED_NOT_VISIBLE` → DNS not pointing to load balancer yet
- `PROVISIONING` → Google is issuing the certificate
- `ACTIVE` → SSL is ready, HTTPS works

### Step 6.10: Update NEXTAUTH_URL

**Critical**: Login won't work until NEXTAUTH_URL matches your custom domain.

```powershell
gcloud run services update hta-calibration `
  --region=asia-south1 `
  --update-env-vars="NEXTAUTH_URL=https://dev.hta-calibration.com"
```

### Troubleshooting Custom Domain

| Issue | Solution |
|-------|----------|
| `FAILED_NOT_VISIBLE` | DNS not pointing to IP - check `nslookup` |
| SSL stuck on `PROVISIONING` | Wait up to 30 minutes |
| Empty response from load balancer | Check backend service: `gcloud compute backend-services describe hta-backend --global` |
| Login doesn't work | Update NEXTAUTH_URL to HTTPS custom domain |
| HTTP works, HTTPS doesn't | SSL cert not ready yet - check status |

### Load Balancer Cost

| Component | Monthly Cost |
|-----------|--------------|
| Forwarding rules (2) | ~$18 |
| SSL certificate | Free (Google-managed) |
| Backend service | ~$0-5 |
| **Total** | **~$18-25/month** |

---

## 8. Phase 7: Verify Deployment

### Checklist

- [ ] **Application loads**: Visit your domain or Cloud Run URL
- [ ] **SSL certificate**: Check for padlock in browser (if using custom domain)
- [ ] **Login works**: Test with seeded credentials
- [ ] **Database connected**: Create a test certificate
- [ ] **File uploads work**: Test signature upload

### Test Credentials (from seed)

| Email | Password | Role |
|-------|----------|------|
| admin@htaipl.com | admin123 | Master Admin |
| kiran@htaipl.com | engineer123 | Engineer |
| customer@example.com | customer123 | Customer |

### Health Check

```powershell
# Basic health check
curl YOUR_SERVICE_URL/api/health
```

---

## 9. Ongoing Maintenance

### Deploy Updates

```powershell
# Build new image with version tag
docker build -t asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/hta-calibration/app:v1.1.0 .

# Push image
docker push asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/hta-calibration/app:v1.1.0

# Deploy new revision
gcloud run deploy hta-calibration `
  --image=asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/hta-calibration/app:v1.1.0 `
  --region=asia-south1
```

### Run New Migrations

```powershell
# 1. Enable public IP
gcloud sql instances patch YOUR_INSTANCE_NAME --assign-ip

# 2. Start Cloud SQL Proxy (Terminal 1)
cloud-sql-proxy YOUR_PROJECT_ID:asia-south1:YOUR_INSTANCE_NAME --port=5432

# 3. Run migrations (Terminal 2)
$DB_PASSWORD = gcloud secrets versions access latest --secret="YOUR_SECRET_NAME"
$env:DATABASE_URL = "postgresql://hta_app:" + $DB_PASSWORD + "@127.0.0.1:5432/hta_calibration"
npx prisma migrate deploy

# 4. Disable public IP
gcloud sql instances patch YOUR_INSTANCE_NAME --no-assign-ip
```

### View Logs

```powershell
# Stream logs
gcloud logging tail "resource.type=cloud_run_revision AND resource.labels.service_name=hta-calibration"

# View recent logs
gcloud run services logs read hta-calibration --region=asia-south1 --limit=50
```

### Backup Database

```powershell
# Manual backup
gcloud sql backups create --instance=YOUR_INSTANCE_NAME

# List backups
gcloud sql backups list --instance=YOUR_INSTANCE_NAME
```

---

## 10. Estimated Costs

### Monthly Cost Breakdown (Dev Environment)

| Service | Configuration | Est. Cost/Month |
|---------|---------------|-----------------|
| Cloud Run | 0-10 instances, 512MB | $0-30 (pay per use) |
| Cloud SQL | db-f1-micro, 10GB | $8-15 |
| Cloud Storage | ~5GB | $1-2 |
| VPC Connector | 2 instances, e2-micro | $5-10 |
| Secret Manager | <10 secrets | $0-1 |
| **Load Balancer** | Custom domain (optional) | $18-25 |
| **Total (without custom domain)** | | **$15-60** |
| **Total (with custom domain)** | | **$35-85** |

### Cost vs GKE

| Environment | Cloud Run | GKE |
|-------------|-----------|-----|
| Dev (low traffic) | $15-60/month | $70-100/month |
| Production | $50-150/month | $110-190/month |

### Cost Optimization Tips

1. **Min instances = 0**: Only pay when receiving requests
2. **Right-size memory**: Start with 512MB, increase if needed
3. **Use db-f1-micro**: Smallest Cloud SQL for dev (~$8/month)

---

## 11. Delete Everything & Start Fresh

### Step 11.1: Delete Load Balancer Resources (if created)

If you set up a custom domain with the load balancer, delete these first:

```powershell
# Delete forwarding rules
gcloud compute forwarding-rules delete hta-https-rule --global --quiet
gcloud compute forwarding-rules delete hta-http-rule --global --quiet

# Delete proxies
gcloud compute target-https-proxies delete hta-https-proxy --quiet
gcloud compute target-http-proxies delete hta-http-proxy --quiet

# Delete URL map
gcloud compute url-maps delete hta-urlmap --quiet

# Delete backend service
gcloud compute backend-services delete hta-backend --global --quiet

# Delete NEG
gcloud compute network-endpoint-groups delete hta-neg --region=asia-south1 --quiet

# Delete SSL certificate
gcloud compute ssl-certificates delete hta-cert --global --quiet

# Delete static IP
gcloud compute addresses delete hta-calibration-ip --global --quiet
```

### Step 11.2: Destroy Terraform Infrastructure

```powershell
cd hta-calibration\terraform\environments\dev
terraform destroy
```

Type `yes` when prompted. This deletes:
- Cloud Run service
- VPC Connector
- Cloud SQL Database
- Storage Buckets
- Service Accounts
- Secrets
- Artifact Registry

**Note**: This takes 5-10 minutes.

### Step 11.3: Verify Everything is Deleted

```powershell
gcloud run services list --region=asia-south1
gcloud sql instances list
gcloud artifacts repositories list --location=asia-south1
gcloud compute forwarding-rules list --global
gcloud compute addresses list --global
```

All commands should return empty results.

---

## 12. Troubleshooting

### localhost vs 127.0.0.1 (Windows)

**Problem**: "password authentication failed" even with correct credentials.

**Root Cause**: On Windows, `localhost` may resolve to `::1` (IPv6) instead of `127.0.0.1` (IPv4). Cloud SQL Proxy listens only on IPv4.

**Solution**: Always use `127.0.0.1` in DATABASE_URL:

```powershell
# WRONG - may use IPv6
$env:DATABASE_URL = "postgresql://hta_app:PASSWORD@localhost:5432/hta_calibration"

# CORRECT - explicit IPv4
$env:DATABASE_URL = "postgresql://hta_app:PASSWORD@127.0.0.1:5432/hta_calibration"
```

**If you changed .env but it still fails**: PowerShell caches env vars. Clear it:

```powershell
Remove-Item Env:DATABASE_URL -ErrorAction SilentlyContinue
```

### "instance does not have IP of type PUBLIC"

**Problem**: Cloud SQL Proxy can't connect.

**Solution**: Enable public IP:

```powershell
gcloud sql instances patch YOUR_INSTANCE_NAME --assign-ip
```

### "VPC Connector not found"

**Problem**: Cloud Run deployment fails.

**Solution**: Verify connector exists:

```powershell
gcloud compute networks vpc-access connectors list --region=asia-south1
```

If missing, run `terraform apply` again.

### "Container failed to start"

**Problem**: Cloud Run revision fails.

**Solution**: Check logs:

```powershell
gcloud run services logs read hta-calibration --region=asia-south1 --limit=50
```

Common causes:
- Missing environment variables
- Database connection failed (check VPC Connector)
- Port mismatch (app must listen on PORT env var or 3000)

### "Permission denied accessing secrets"

**Problem**: Cloud Run can't read secrets.

**Solution**: Verify service account has secretAccessor role:

```powershell
gcloud secrets get-iam-policy YOUR_SECRET_NAME
```

### "Domain mappings not allowed in asia-south1"

**Problem**: `gcloud run domain-mappings create` fails with:
```
Creating domain mappings is not allowed in asia-south1.
```

**Root Cause**: Cloud Run domain mappings are only supported in certain regions. Asia-south1 is NOT supported.

**Solution**: Use a Global HTTP(S) Load Balancer instead. See [Phase 6: Configure Custom Domain](#7-phase-6-configure-custom-domain).

### "Secret not found" during deployment

**Problem**: Cloud Run deployment fails with secret not found error.

**Root Cause**: Terraform creates secrets with project ID prefix (e.g., `hta-calibration-dev1-database-url-dev`), but you used a different name.

**Solution**: Check actual secret names:

```powershell
gcloud secrets list
```

Use the exact name shown in the `--set-secrets` flag.

### Login doesn't work on custom domain

**Problem**: Can access the site but login fails or redirects incorrectly.

**Root Cause**: `NEXTAUTH_URL` environment variable doesn't match your custom domain.

**Solution**: Update NEXTAUTH_URL:

```powershell
gcloud run services update hta-calibration `
  --region=asia-south1 `
  --update-env-vars="NEXTAUTH_URL=https://dev.your-domain.com"
```

**Note**: Login requires HTTPS. It won't work over HTTP.

---

## Quick Reference Commands

```powershell
# View Cloud Run service
gcloud run services describe hta-calibration --region=asia-south1

# View revisions
gcloud run revisions list --service=hta-calibration --region=asia-south1

# Stream logs
gcloud logging tail "resource.type=cloud_run_revision"

# Get service URL
gcloud run services describe hta-calibration --region=asia-south1 --format="value(status.url)"

# Check Terraform state
cd terraform\environments\dev
terraform show

# Destroy everything (CAREFUL!)
terraform destroy
```

---

## Architecture Reference

```
┌─────────────────────────────────────────────────────────────────┐
│                      Google Cloud                               │
│  ┌───────────────────────────────────────────────────────────┐ │
│  │                    Cloud Run Service                       │ │
│  │  ┌─────────────────────────────────────────────────────┐  │ │
│  │  │  HTA Calibration (Next.js)                          │  │ │
│  │  │  - Auto-scales 0 to 10                              │  │ │
│  │  │  - 1 vCPU, 512MB RAM                                │  │ │
│  │  └─────────────────────────────────────────────────────┘  │ │
│  └──────────────────────────┬────────────────────────────────┘ │
│                             │                                   │
│            ┌────────────────┼────────────────┐                 │
│            │ VPC Connector  │                │                 │
│            ▼                ▼                ▼                 │
│       ┌────────┐      ┌──────────┐     ┌─────────┐            │
│       │ Cloud  │      │ Memory-  │     │ Secret  │            │
│       │  SQL   │      │  store   │     │ Manager │            │
│       │ (PG15) │      │ (Redis)  │     │         │            │
│       └────────┘      └──────────┘     └─────────┘            │
│                                                                │
│       ┌────────────────────────────────────────────┐          │
│       │           Cloud Storage (GCS)              │          │
│       │  - Certificates  - Signatures  - Uploads   │          │
│       └────────────────────────────────────────────┘          │
└─────────────────────────────────────────────────────────────────┘
```

---

**Need Help?**
- Check the GKE deployment guide: `docs/DEPLOYMENT_GUIDE.md`
- Review Terraform modules: `terraform/modules/`
