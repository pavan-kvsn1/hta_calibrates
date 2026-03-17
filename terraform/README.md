# HTA Calibration - Terraform Infrastructure

This directory contains Terraform configurations for provisioning GCP infrastructure for the HTA Calibration system.

## Directory Structure

```
terraform/
├── modules/           # Reusable Terraform modules
│   ├── vpc/          # VPC, subnets, firewall rules
│   ├── gke/          # GKE cluster configuration
│   ├── cloudsql/     # Cloud SQL PostgreSQL instance
│   ├── storage/      # Cloud Storage buckets
│   ├── iam/          # Service accounts and IAM
│   └── secrets/      # Secret Manager configuration
│
├── environments/      # Environment-specific configurations
│   └── dev/          # Development environment
│
├── shared/           # Shared resources (Artifact Registry)
│
├── versions.tf       # Provider version constraints
└── .gitignore        # Git ignore rules
```

## Prerequisites

1. **Google Cloud SDK**: Install and configure the gcloud CLI
   ```bash
   gcloud auth login
   gcloud auth application-default login
   ```

2. **Terraform**: Install Terraform 1.5+
   ```bash
   # Windows (using Chocolatey)
   choco install terraform

   # macOS
   brew install terraform
   ```

3. **GCP Project**: Create a GCP project and note the project ID

## Quick Start

### 1. Deploy Shared Resources First

```bash
cd terraform/shared

# Copy and edit the variables file
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your project_id

# Initialize and apply
terraform init
terraform plan
terraform apply
```

### 2. Deploy Development Environment

```bash
cd terraform/environments/dev

# Copy and edit the variables file
cp terraform.tfvars.example terraform.tfvars
# Edit terraform.tfvars with your project_id

# Initialize and apply
terraform init
terraform plan
terraform apply
```

### 3. Connect to GKE Cluster

After deployment, run the command shown in the outputs:
```bash
gcloud container clusters get-credentials <cluster-name> --region asia-south1 --project <project-id>
```

## Modules Overview

### VPC Module
Creates the network infrastructure:
- VPC with custom subnets
- Cloud NAT for outbound internet access
- Firewall rules for GKE, health checks, and IAP

### GKE Module
Creates a production-ready Kubernetes cluster:
- Private cluster with private nodes
- Workload Identity enabled
- Auto-scaling node pools
- Network policies with Calico

### CloudSQL Module
Creates a PostgreSQL database:
- Private IP only (VPC-native)
- Automatic backups
- Query insights enabled

### Storage Module
Creates Cloud Storage buckets:
- Certificates bucket (versioned)
- Signatures bucket
- Uploads bucket (auto-cleanup)
- Static assets bucket (CDN-ready)

### IAM Module
Creates service accounts:
- GKE node service account
- Application service account (with Workload Identity)
- CI/CD service account
- GitHub Actions Workload Identity (optional)

### Secrets Module
Creates Secret Manager secrets:
- NextAuth secret
- Database credentials
- SMTP configuration

## Cost Estimation (Dev Environment)

| Resource | Monthly Cost (Approx) |
|----------|----------------------|
| GKE Cluster (e2-medium) | $25-50 |
| Cloud SQL (db-f1-micro) | $8-15 |
| Cloud NAT | $5-10 |
| Storage (minimal) | $1-5 |
| **Total** | **$40-80** |

## Security Notes

1. **Sensitive Data**: Never commit `.tfvars` files containing secrets
2. **State Files**: Use remote state (GCS backend) for team collaboration
3. **Workload Identity**: Preferred over service account keys
4. **Private Cluster**: GKE nodes have no public IPs

## Useful Commands

```bash
# Format all Terraform files
terraform fmt -recursive

# Validate configuration
terraform validate

# Show current state
terraform show

# Destroy all resources (CAREFUL!)
terraform destroy
```

## Troubleshooting

### API Not Enabled Error
Run `terraform apply` in the shared folder first to enable APIs.

### Permission Denied
Ensure your user has Owner or Editor role on the GCP project.

### VPC Peering Error
Wait a few minutes for the service networking connection to complete.
