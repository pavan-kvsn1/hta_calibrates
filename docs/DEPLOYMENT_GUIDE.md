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
10. [Troubleshooting](#10-troubleshooting)

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

### Step 2.3: Configure Dev/Production Environment

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

### Step 2.4: Deploy Environment Infrastructure

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

### Step 2.5: Save Important Outputs

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

### Step 3.1: Configure Docker for GCP

```bash
# Configure Docker to use GCP Artifact Registry
gcloud auth configure-docker asia-south1-docker.pkg.dev
```

### Step 3.2: Build the Application

```bash
# Navigate to app directory
cd hta-calibration

# Install dependencies
npm install

# Build the application
npm run build
```

### Step 3.3: Build Docker Image

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

### Step 3.4: Push to Artifact Registry

```bash
# Push the image
docker push asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/hta-calibration/app:latest
docker push asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/hta-calibration/app:v1.0.0
```

**Checkpoint**: Verify image in GCP Console → Artifact Registry.

---

## 5. Phase 4: Deploy to Kubernetes

### Step 4.1: Connect to GKE Cluster

```bash
# Get credentials (use command from Terraform output)
gcloud container clusters get-credentials YOUR_CLUSTER_NAME \
  --region asia-south1 \
  --project YOUR_PROJECT_ID

# Verify connection
kubectl get nodes
```

### Step 4.2: Create Kubernetes Namespace

```bash
kubectl create namespace hta-calibration
```

### Step 4.3: Create Kubernetes Secrets

```bash
# Get database password from Secret Manager
DB_PASSWORD=$(gcloud secrets versions access latest \
  --secret="YOUR_PROJECT_ID-db-password-dev")

# Create Kubernetes secret for database
kubectl create secret generic db-credentials \
  --namespace=hta-calibration \
  --from-literal=DATABASE_URL="postgresql://hta_app:${DB_PASSWORD}@PRIVATE_IP:5432/hta_calibration"

# Create secret for NextAuth
kubectl create secret generic nextauth-secret \
  --namespace=hta-calibration \
  --from-literal=NEXTAUTH_SECRET=$(openssl rand -base64 32) \
  --from-literal=NEXTAUTH_URL="https://your-domain.com"
```

### Step 4.4: Create Kubernetes Deployment

Create file `k8s/deployment.yaml`:
```yaml
apiVersion: apps/v1
kind: Deployment
metadata:
  name: hta-calibration
  namespace: hta-calibration
spec:
  replicas: 2
  selector:
    matchLabels:
      app: hta-calibration
  template:
    metadata:
      labels:
        app: hta-calibration
    spec:
      serviceAccountName: hta-app
      containers:
      - name: app
        image: asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/hta-calibration/app:latest
        ports:
        - containerPort: 3000
        env:
        - name: DATABASE_URL
          valueFrom:
            secretKeyRef:
              name: db-credentials
              key: DATABASE_URL
        - name: NEXTAUTH_SECRET
          valueFrom:
            secretKeyRef:
              name: nextauth-secret
              key: NEXTAUTH_SECRET
        - name: NEXTAUTH_URL
          valueFrom:
            secretKeyRef:
              name: nextauth-secret
              key: NEXTAUTH_URL
        resources:
          requests:
            memory: "256Mi"
            cpu: "200m"
          limits:
            memory: "512Mi"
            cpu: "500m"
        readinessProbe:
          httpGet:
            path: /api/health/ready
            port: 3000
          initialDelaySeconds: 10
          periodSeconds: 5
        livenessProbe:
          httpGet:
            path: /api/health
            port: 3000
          initialDelaySeconds: 15
          periodSeconds: 10
---
apiVersion: v1
kind: Service
metadata:
  name: hta-calibration
  namespace: hta-calibration
spec:
  type: LoadBalancer
  ports:
  - port: 80
    targetPort: 3000
  selector:
    app: hta-calibration
```

### Step 4.5: Deploy to Kubernetes

```bash
# Apply the deployment
kubectl apply -f k8s/deployment.yaml

# Check deployment status
kubectl get pods -n hta-calibration -w

# Get the external IP (wait for it to be assigned)
kubectl get svc -n hta-calibration
```

**Checkpoint**: Access the app via the external IP: `http://EXTERNAL_IP`

---

## 6. Phase 5: Configure DNS and SSL

### Step 5.1: Get Load Balancer IP

```bash
# Get the external IP
kubectl get svc hta-calibration -n hta-calibration -o jsonpath='{.status.loadBalancer.ingress[0].ip}'
```

### Step 5.2: Configure DNS (at your domain registrar)

Add these DNS records:

| Type | Name | Value | TTL |
|------|------|-------|-----|
| A | @ | YOUR_EXTERNAL_IP | 300 |
| A | www | YOUR_EXTERNAL_IP | 300 |
| CNAME | api | YOUR_EXTERNAL_IP | 300 |

### Step 5.3: Set Up SSL with Google Managed Certificate

Create file `k8s/managed-cert.yaml`:
```yaml
apiVersion: networking.gke.io/v1
kind: ManagedCertificate
metadata:
  name: hta-calibration-cert
  namespace: hta-calibration
spec:
  domains:
    - your-domain.com
    - www.your-domain.com
---
apiVersion: networking.k8s.io/v1
kind: Ingress
metadata:
  name: hta-calibration-ingress
  namespace: hta-calibration
  annotations:
    kubernetes.io/ingress.global-static-ip-name: hta-calibration-ip
    networking.gke.io/managed-certificates: hta-calibration-cert
spec:
  defaultBackend:
    service:
      name: hta-calibration
      port:
        number: 80
```

```bash
# Reserve a static IP
gcloud compute addresses create hta-calibration-ip --global

# Apply the ingress
kubectl apply -f k8s/managed-cert.yaml
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
kubectl logs -f deployment/hta-calibration -n hta-calibration

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
kubectl set image deployment/hta-calibration \
  app=asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/hta-calibration/app:v1.1.0 \
  -n hta-calibration
```

### Database Migrations

```bash
# Connect to a pod
kubectl exec -it deployment/hta-calibration -n hta-calibration -- /bin/sh

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
kubectl scale deployment/hta-calibration --replicas=3 -n hta-calibration

# Or enable autoscaling
kubectl autoscale deployment/hta-calibration \
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

## 10. Troubleshooting

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
kubectl logs -f deployment/hta-calibration -n hta-calibration

# Shell into pod
kubectl exec -it deployment/hta-calibration -n hta-calibration -- /bin/sh

# Restart deployment
kubectl rollout restart deployment/hta-calibration -n hta-calibration

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
