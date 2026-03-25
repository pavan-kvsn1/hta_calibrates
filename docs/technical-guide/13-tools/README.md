# 13 - Development & Operations Tools

## Documentation Index

| File | Description | When to Read |
|------|-------------|--------------|
| [01-cli-cheatsheet.md](./01-cli-cheatsheet.md) | Quick CLI command reference | Daily operations |
| [02-ide-setup.md](./02-ide-setup.md) | VS Code configuration | Initial setup |
| README.md (this file) | Tool overview, setup guides | Getting started |

---

## Overview

| Tool | Purpose | When to Use |
|------|---------|-------------|
| **Prisma Studio** | Database GUI | View/edit data locally |
| **DBeaver** | Database client | Complex queries, production access |
| **Lens** | Kubernetes GUI | Cluster management |
| **Cloud SQL Proxy** | DB tunnel | Connect to Cloud SQL from local |
| **Docker Desktop** | Containers | Build and test images |
| **Postman/Insomnia** | API testing | Test endpoints |
| **VS Code** | IDE | Development |

---

## Database Tools

### Prisma Studio

Built-in database GUI for Prisma.

**Start**:
```bash
# Local PostgreSQL (Docker)
npx prisma studio

# Production (via Cloud SQL Proxy)
DATABASE_URL="postgresql://user:pass@127.0.0.1:5432/db" npx prisma studio
```

**Features**:
- View all tables
- Filter and sort records
- Edit data inline
- Add/delete records

**Best for**: Quick data viewing, simple edits

---

### DBeaver

Full-featured database client.

**Download**: https://dbeaver.io/download/

**Setup for Cloud SQL**:

1. Start Cloud SQL Proxy:
   ```bash
   cloud-sql-proxy PROJECT:REGION:INSTANCE
   ```

2. Create connection in DBeaver:
   - Host: `127.0.0.1`
   - Port: `5432`
   - Database: `hta_calibration`
   - User: `hta_app`
   - Password: (from Secret Manager)

**Features**:
- SQL editor with autocomplete
- ER diagrams
- Data export/import
- Multiple database support
- Query history

**Best for**: Complex queries, data analysis, production debugging

---

### Cloud SQL Proxy

Secure tunnel to Cloud SQL without exposing public IP.

**Install**:
```bash
# macOS
brew install cloud-sql-proxy

# Windows (download binary)
# https://cloud.google.com/sql/docs/postgres/sql-proxy#install
```

**Usage**:
```bash
# Basic connection
cloud-sql-proxy PROJECT_ID:REGION:INSTANCE_NAME

# With specific port
cloud-sql-proxy PROJECT_ID:REGION:INSTANCE_NAME --port=5432

# Background
cloud-sql-proxy PROJECT_ID:REGION:INSTANCE_NAME &
```

**Then connect**:
```bash
# psql
psql "postgresql://USER:PASS@127.0.0.1:5432/DATABASE"

# Prisma
DATABASE_URL="postgresql://USER:PASS@127.0.0.1:5432/DATABASE" npx prisma studio

# Application
DATABASE_URL="postgresql://USER:PASS@127.0.0.1:5432/DATABASE" npm run dev
```

---

## Kubernetes Tools

### Lens

GUI for Kubernetes cluster management.

**Download**: https://k8slens.dev/

**Setup**:
1. Install Lens
2. Import kubeconfig (Lens auto-detects)
3. Click on cluster to connect

**Features**:
- Visual cluster overview
- Pod logs streaming
- Terminal into containers
- Resource metrics
- YAML editing
- Port forwarding

**Useful Views**:
- Workloads > Pods (see all pods, logs, shell)
- Network > Services (see LoadBalancer IPs)
- Config > ConfigMaps/Secrets
- Events (recent cluster events)

**Best for**: Daily cluster operations, debugging, visual overview

---

### kubectl

Command-line Kubernetes tool.

**Install**:
```bash
# macOS
brew install kubectl

# Windows
choco install kubernetes-cli
```

**Configure**:
```bash
# Get GKE credentials
gcloud container clusters get-credentials CLUSTER_NAME --region REGION --project PROJECT

# Check connection
kubectl cluster-info
kubectl get nodes
```

**Essential Commands**:
```bash
# View resources
kubectl get pods -n hta-calibration
kubectl get all -n hta-calibration
kubectl describe pod POD_NAME -n hta-calibration

# Logs
kubectl logs -f deployment/hta-web -n hta-calibration
kubectl logs POD_NAME --previous -n hta-calibration

# Shell access
kubectl exec -it POD_NAME -n hta-calibration -- sh

# Port forward
kubectl port-forward deployment/hta-web -n hta-calibration 3000:3000

# Apply changes
kubectl apply -k k8s/overlays/development

# Scale
kubectl scale deployment/hta-web -n hta-calibration --replicas=2

# Restart
kubectl rollout restart deployment/hta-web -n hta-calibration
```

---

### k9s

Terminal UI for Kubernetes.

**Install**:
```bash
# macOS
brew install k9s

# Windows
choco install k9s
```

**Usage**:
```bash
k9s -n hta-calibration
```

**Shortcuts**:
- `:pods` - View pods
- `:deploy` - View deployments
- `:svc` - View services
- `l` - View logs
- `s` - Shell into container
- `d` - Describe resource
- `/` - Filter
- `ctrl+c` - Exit

**Best for**: Quick terminal-based cluster navigation

---

## API Testing Tools

### Postman

GUI for API testing.

**Download**: https://www.postman.com/downloads/

**Setup for HTA**:

1. Create environment:
   - `baseUrl`: `http://34.180.4.228` or `http://localhost:3000`

2. Login first to get session:
   ```
   POST {{baseUrl}}/api/auth/callback/staff-credentials
   Content-Type: application/x-www-form-urlencoded

   email=admin@htaipl.com&password=admin123
   ```

3. Use session cookie for subsequent requests

**Best for**: API development, testing endpoints

---

### curl

Command-line HTTP client.

```bash
# Health check
curl http://localhost:3000/api/health

# POST with JSON
curl -X POST http://localhost:3000/api/certificates \
  -H "Content-Type: application/json" \
  -d '{"certificateNumber": "HTA-001"}'

# With cookies (from browser)
curl http://localhost:3000/api/user \
  -H "Cookie: authjs.session-token=..."
```

---

## Development Tools

### VS Code Extensions

Recommended extensions:

```json
{
  "recommendations": [
    "prisma.prisma",              // Prisma schema highlighting
    "bradlc.vscode-tailwindcss",  // Tailwind CSS IntelliSense
    "esbenp.prettier-vscode",     // Formatting
    "dbaeumer.vscode-eslint",     // Linting
    "ms-azuretools.vscode-docker", // Docker support
    "ms-kubernetes-tools.vscode-kubernetes-tools", // K8s support
    "hashicorp.terraform"         // Terraform support
  ]
}
```

### Docker Desktop

**Download**: https://www.docker.com/products/docker-desktop/

**Usage**:
```bash
# Build image
docker build -t hta-app .

# Run locally
docker run -p 3000:3000 -e DATABASE_URL=... hta-app

# Push to registry
docker tag hta-app asia-south1-docker.pkg.dev/PROJECT/hta-calibration/app:latest
docker push asia-south1-docker.pkg.dev/PROJECT/hta-calibration/app:latest
```

---

## GCP Tools

### gcloud CLI

**Install**: https://cloud.google.com/sdk/docs/install

**Essential Commands**:
```bash
# Auth
gcloud auth login
gcloud auth application-default login
gcloud config set project PROJECT_ID

# GKE
gcloud container clusters list
gcloud container clusters get-credentials CLUSTER --region REGION

# Cloud SQL
gcloud sql instances list
gcloud sql instances describe INSTANCE
gcloud sql connect INSTANCE --user=USER

# Artifact Registry
gcloud artifacts docker images list REGISTRY/REPO

# Logs
gcloud logging read "resource.type=k8s_container" --limit=50
```

### Google Cloud Console

Web UI for GCP: https://console.cloud.google.com

**Useful Pages**:
- Kubernetes Engine > Clusters
- SQL > Instances
- Storage > Buckets
- Artifact Registry > Repositories
- IAM & Admin > Service Accounts
- Logging > Logs Explorer

---

## Local Development Stack

### Quick Start

```bash
# Terminal 1: Start app
npm run dev

# Terminal 2: Open Prisma Studio
npx prisma studio

# Terminal 3: (Optional) Cloud SQL Proxy for prod data
cloud-sql-proxy PROJECT:REGION:INSTANCE
```

### Connecting to Production Database

```bash
# 1. Start Cloud SQL Proxy
cloud-sql-proxy hta-calibration-prod:asia-south1:hta-db-dev

# 2. Set DATABASE_URL
export DATABASE_URL="postgresql://hta_app:PASSWORD@127.0.0.1:5432/hta_calibration"

# 3. Use Prisma Studio, DBeaver, or psql
npx prisma studio
```

---

## Tool Comparison

| Task | Best Tool |
|------|-----------|
| Quick data view | Prisma Studio |
| Complex SQL queries | DBeaver |
| Cluster overview | Lens |
| Quick pod operations | k9s or kubectl |
| API testing | Postman |
| Local containers | Docker Desktop |
| GCP management | gcloud CLI + Console |

---

## Next Steps

- [12 - Debugging](../12-debugging/) - Troubleshooting guide
- [14 - Environments](../14-environments/) - Environment configs
