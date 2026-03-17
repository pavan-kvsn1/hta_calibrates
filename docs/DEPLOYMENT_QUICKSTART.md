# HTA Calibration - Deployment Quickstart

> One-page quick reference for deploying the app. See [DEPLOYMENT_GUIDE.md](./DEPLOYMENT_GUIDE.md) for detailed instructions.

---

## Prerequisites Checklist

```
[ ] Google Cloud SDK installed & authenticated
[ ] Terraform 1.5+ installed
[ ] Docker Desktop installed
[ ] GCP Project created with billing enabled
[ ] Project ID noted: ____________________
```

---

## Deploy in 10 Steps

### 1. Authenticate
```bash
gcloud auth login
gcloud auth application-default login
gcloud config set project YOUR_PROJECT_ID
```

### 2. Enable APIs
```bash
gcloud services enable compute.googleapis.com container.googleapis.com \
  sqladmin.googleapis.com servicenetworking.googleapis.com \
  secretmanager.googleapis.com artifactregistry.googleapis.com
```

### 3. Deploy Shared Resources
```bash
cd terraform/shared
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars → set project_id
terraform init && terraform apply
```

### 4. Deploy Infrastructure
```bash
cd ../environments/dev
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars → set project_id
terraform init && terraform apply  # Takes ~15 min
```

### 5. Configure Docker
```bash
gcloud auth configure-docker asia-south1-docker.pkg.dev
```

### 6. Build & Push Image
```bash
cd hta-calibration
docker build -t asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/hta-calibration/app:latest .
docker push asia-south1-docker.pkg.dev/YOUR_PROJECT_ID/hta-calibration/app:latest
```

### 7. Connect to Kubernetes
```bash
gcloud container clusters get-credentials YOUR_CLUSTER_NAME \
  --region asia-south1 --project YOUR_PROJECT_ID
kubectl create namespace hta-calibration
```

### 8. Create Secrets
```bash
DB_PASSWORD=$(gcloud secrets versions access latest --secret="YOUR_PROJECT_ID-db-password-dev")
kubectl create secret generic db-credentials -n hta-calibration \
  --from-literal=DATABASE_URL="postgresql://hta_app:${DB_PASSWORD}@DB_PRIVATE_IP:5432/hta_calibration"
kubectl create secret generic nextauth-secret -n hta-calibration \
  --from-literal=NEXTAUTH_SECRET=$(openssl rand -base64 32) \
  --from-literal=NEXTAUTH_URL="https://your-domain.com"
```

### 9. Deploy Application
```bash
kubectl apply -f k8s/deployment.yaml
kubectl get svc -n hta-calibration -w  # Wait for EXTERNAL-IP
```

### 10. Verify
```bash
curl http://EXTERNAL_IP/api/health
```

---

## Key Commands Reference

| Action | Command |
|--------|---------|
| View pods | `kubectl get pods -n hta-calibration` |
| View logs | `kubectl logs -f deploy/hta-calibration -n hta-calibration` |
| Shell into pod | `kubectl exec -it deploy/hta-calibration -n hta-calibration -- sh` |
| Restart app | `kubectl rollout restart deploy/hta-calibration -n hta-calibration` |
| Scale app | `kubectl scale deploy/hta-calibration --replicas=3 -n hta-calibration` |
| Update image | `kubectl set image deploy/hta-calibration app=NEW_IMAGE -n hta-calibration` |

---

## Environment Variables Needed

| Variable | Description |
|----------|-------------|
| `DATABASE_URL` | PostgreSQL connection string |
| `NEXTAUTH_SECRET` | Random 32+ char string |
| `NEXTAUTH_URL` | Your app's URL |
| `GCS_BUCKET_CERTIFICATES` | Certificates bucket name |
| `GCS_BUCKET_SIGNATURES` | Signatures bucket name |

---

## Estimated Monthly Cost

| Environment | Cost |
|-------------|------|
| Development | $40-80 |
| Production | $110-190 |
