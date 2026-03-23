# CLI Cheatsheet

## Overview

Quick reference for common CLI commands used in HTA Calibration development and operations.

---

## npm Commands

### Development

```bash
# Start development server
npm run dev

# Build for production
npm run build

# Start production server (after build)
npm run start

# Type checking
npm run typecheck

# Linting
npm run lint
npm run lint:fix
```

### Testing

```bash
# Run all tests
npm test

# Watch mode
npm run test:watch

# Coverage report
npm run test:coverage

# Run specific test file
npm test -- path/to/test.spec.ts

# Run tests matching pattern
npm test -- --grep "certificate"
```

### Database

```bash
# Generate Prisma client
npx prisma generate

# Push schema to database
npx prisma db push

# Create migration
npx prisma migrate dev --name migration_name

# Apply migrations (production)
npx prisma migrate deploy

# Reset database
npx prisma migrate reset

# Open Prisma Studio
npx prisma studio

# Seed database
npx prisma db seed
```

---

## kubectl Commands

### Cluster Information

```bash
# Cluster info
kubectl cluster-info
kubectl get nodes
kubectl config current-context

# Switch context
kubectl config use-context CONTEXT_NAME

# List all contexts
kubectl config get-contexts
```

### Namespace Operations

```bash
# List namespaces
kubectl get namespaces

# Set default namespace
kubectl config set-context --current --namespace=hta-calibration

# All resources in namespace
kubectl get all -n hta-calibration
```

### Pod Operations

```bash
# List pods
kubectl get pods -n hta-calibration
kubectl get pods -n hta-calibration -o wide
kubectl get pods -n hta-calibration -w  # Watch

# Describe pod
kubectl describe pod POD_NAME -n hta-calibration

# Logs
kubectl logs POD_NAME -n hta-calibration
kubectl logs -f POD_NAME -n hta-calibration  # Follow
kubectl logs POD_NAME -n hta-calibration --previous  # Previous instance
kubectl logs POD_NAME -n hta-calibration --tail=100

# Shell into pod
kubectl exec -it POD_NAME -n hta-calibration -- sh

# Run command
kubectl exec POD_NAME -n hta-calibration -- printenv
```

### Deployment Operations

```bash
# List deployments
kubectl get deployments -n hta-calibration

# Scale
kubectl scale deployment/hta-web -n hta-calibration --replicas=2

# Restart
kubectl rollout restart deployment/hta-web -n hta-calibration

# Rollback
kubectl rollout undo deployment/hta-web -n hta-calibration

# Status
kubectl rollout status deployment/hta-web -n hta-calibration

# History
kubectl rollout history deployment/hta-web -n hta-calibration
```

### Service Operations

```bash
# List services
kubectl get svc -n hta-calibration

# Describe service
kubectl describe svc hta-web -n hta-calibration

# Port forward
kubectl port-forward deployment/hta-web -n hta-calibration 3000:3000
kubectl port-forward svc/hta-web -n hta-calibration 80:80
```

### ConfigMap and Secrets

```bash
# List ConfigMaps
kubectl get configmap -n hta-calibration

# View ConfigMap
kubectl get configmap hta-config -n hta-calibration -o yaml

# Create secret
kubectl create secret generic hta-secrets \
  -n hta-calibration \
  --from-literal=database-url='...' \
  --from-literal=nextauth-secret='...'

# View secret (base64 encoded)
kubectl get secret hta-secrets -n hta-calibration -o yaml

# Decode secret value
kubectl get secret hta-secrets -n hta-calibration \
  -o jsonpath='{.data.database-url}' | base64 -d
```

### Kustomize

```bash
# Preview manifests
kubectl kustomize k8s/overlays/development

# Apply manifests
kubectl apply -k k8s/overlays/development

# Diff before apply
kubectl diff -k k8s/overlays/development

# Delete resources
kubectl delete -k k8s/overlays/development
```

### Resource Usage

```bash
# Pod resource usage
kubectl top pods -n hta-calibration

# Node resource usage
kubectl top nodes

# HPA status
kubectl get hpa -n hta-calibration
```

### Events

```bash
# Recent events
kubectl get events -n hta-calibration --sort-by='.lastTimestamp'

# Watch events
kubectl get events -n hta-calibration -w
```

---

## gcloud Commands

### Authentication

```bash
# Login
gcloud auth login

# Application default credentials
gcloud auth application-default login

# Set project
gcloud config set project PROJECT_ID

# List accounts
gcloud auth list
```

### GKE

```bash
# List clusters
gcloud container clusters list

# Get credentials
gcloud container clusters get-credentials CLUSTER_NAME \
  --region asia-south1 \
  --project PROJECT_ID

# Describe cluster
gcloud container clusters describe CLUSTER_NAME --region asia-south1
```

### Cloud SQL

```bash
# List instances
gcloud sql instances list

# Describe instance
gcloud sql instances describe INSTANCE_NAME

# Connect (interactive)
gcloud sql connect INSTANCE_NAME --user=USERNAME

# List databases
gcloud sql databases list --instance=INSTANCE_NAME

# List backups
gcloud sql backups list --instance=INSTANCE_NAME
```

### Cloud Storage

```bash
# List buckets
gsutil ls

# List bucket contents
gsutil ls gs://BUCKET_NAME/

# Copy file to bucket
gsutil cp file.pdf gs://BUCKET_NAME/

# Download file
gsutil cp gs://BUCKET_NAME/file.pdf ./

# Sync directory
gsutil rsync -r local_dir/ gs://BUCKET_NAME/
```

### Artifact Registry

```bash
# Configure Docker
gcloud auth configure-docker asia-south1-docker.pkg.dev

# List images
gcloud artifacts docker images list \
  asia-south1-docker.pkg.dev/PROJECT/REPO

# Delete image
gcloud artifacts docker images delete \
  asia-south1-docker.pkg.dev/PROJECT/REPO/IMAGE:TAG
```

### Logging

```bash
# Read logs
gcloud logging read \
  "resource.type=k8s_container AND resource.labels.namespace_name=hta-calibration" \
  --limit=50

# Errors only
gcloud logging read "severity>=ERROR" --limit=20

# Tail logs
gcloud logging tail \
  "resource.type=k8s_container"
```

---

## Docker Commands

### Build

```bash
# Build image
docker build -t hta-app .

# Build with no cache
docker build --no-cache -t hta-app .

# Build specific stage
docker build --target builder -t hta-builder .

# Build with build args
docker build --build-arg NODE_ENV=production -t hta-app .
```

### Run

```bash
# Run container
docker run -p 3000:3000 hta-app

# Run with environment variables
docker run -p 3000:3000 \
  -e DATABASE_URL="..." \
  -e NEXTAUTH_SECRET="..." \
  hta-app

# Run detached
docker run -d -p 3000:3000 hta-app

# Run interactively
docker run -it hta-app sh
```

### Management

```bash
# List containers
docker ps
docker ps -a  # Include stopped

# Stop container
docker stop CONTAINER_ID

# Remove container
docker rm CONTAINER_ID

# List images
docker images

# Remove image
docker rmi IMAGE_ID

# Prune unused
docker system prune
```

### Registry

```bash
# Tag image
docker tag hta-app asia-south1-docker.pkg.dev/PROJECT/REPO/app:latest

# Push image
docker push asia-south1-docker.pkg.dev/PROJECT/REPO/app:latest

# Pull image
docker pull asia-south1-docker.pkg.dev/PROJECT/REPO/app:latest
```

---

## Cloud SQL Proxy

```bash
# Basic usage
cloud-sql-proxy PROJECT:REGION:INSTANCE

# With specific port
cloud-sql-proxy PROJECT:REGION:INSTANCE --port=5432

# Background
cloud-sql-proxy PROJECT:REGION:INSTANCE &

# Multiple instances
cloud-sql-proxy \
  PROJECT:REGION:INSTANCE1=tcp:5432 \
  PROJECT:REGION:INSTANCE2=tcp:5433
```

---

## Git Commands

### Basic Operations

```bash
# Status
git status

# Stage changes
git add .
git add path/to/file

# Commit
git commit -m "message"

# Push
git push origin branch-name
```

### Branching

```bash
# List branches
git branch -a

# Create branch
git checkout -b feature/new-feature

# Switch branch
git checkout main

# Delete branch
git branch -d branch-name
```

### History

```bash
# Log
git log --oneline -20

# Diff
git diff
git diff --staged

# Show commit
git show COMMIT_HASH
```

---

## Quick Reference Card

### Daily Development

```bash
npm run dev                    # Start dev server
npx prisma studio              # Open database GUI
kubectl get pods -n hta-calibration  # Check pods
kubectl logs -f deployment/hta-web -n hta-calibration  # View logs
```

### Deployment

```bash
docker build -t hta-app .      # Build image
docker push REGISTRY/app:TAG   # Push image
kubectl apply -k k8s/overlays/development  # Deploy
kubectl rollout status deployment/hta-web -n hta-calibration  # Verify
```

### Debugging

```bash
kubectl describe pod POD -n hta-calibration  # Pod details
kubectl logs POD -n hta-calibration --previous  # Crash logs
kubectl exec -it POD -n hta-calibration -- sh  # Shell access
```

### Database

```bash
cloud-sql-proxy PROJECT:REGION:INSTANCE  # Start proxy
npx prisma studio              # Open GUI
npx prisma db push             # Apply schema
```
