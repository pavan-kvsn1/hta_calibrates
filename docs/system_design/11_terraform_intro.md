# Terraform Introduction

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Prerequisite**: [06_gcp_fundamentals.md](./06_gcp_fundamentals.md)

---

## Introduction

This document introduces Terraform, the tool we use to manage our cloud infrastructure as code. You'll learn why Infrastructure as Code (IaC) matters and how Terraform works.

---

## Part 1: Why Infrastructure as Code?

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WHY INFRASTRUCTURE AS CODE?                               │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  MANUAL SETUP (The Old Way):                                                │
│  ═══════════════════════════                                                │
│                                                                             │
│  Day 1: Set up production                                                   │
│  ────────────────────────────                                               │
│  1. Log into GCP Console                                                    │
│  2. Click "Create Cluster" → fill 20 fields                                 │
│  3. Click "Create Database" → fill 15 fields                                │
│  4. Click "Create Storage Bucket" → fill 10 fields                          │
│  5. Set up networking, firewall rules...                                    │
│  6. Configure IAM permissions...                                            │
│  7. Three hours later: Done! (hopefully no mistakes)                        │
│                                                                             │
│  Day 2: Set up staging                                                      │
│  ────────────────────────────                                               │
│  1. Repeat all 50+ steps                                                    │
│  2. Try to remember all the settings                                        │
│  3. Accidentally use different config than production 😬                    │
│                                                                             │
│  Day 30: Something broke                                                    │
│  ────────────────────────────                                               │
│  "What did we change? Who changed it? When?"                                │
│  "I don't know, I clicked a bunch of things..."                             │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  INFRASTRUCTURE AS CODE (The Better Way):                                   │
│  ════════════════════════════════════════                                   │
│                                                                             │
│  # main.tf                                                                  │
│  resource "google_container_cluster" "primary" {                            │
│    name     = "hta-cluster"                                                 │
│    location = "asia-southeast1"                                             │
│    ...                                                                      │
│  }                                                                          │
│                                                                             │
│  $ terraform apply                                                          │
│  Creating cluster... Done!                                                  │
│  Creating database... Done!                                                 │
│  Creating storage... Done!                                                  │
│  ✅ Infrastructure ready in 15 minutes!                                     │
│                                                                             │
│  BENEFITS:                                                                  │
│  ═════════                                                                  │
│  ✅ Reproducible: Same code = same infrastructure                           │
│  ✅ Version controlled: Git tracks all changes                              │
│  ✅ Reviewable: Team can review infrastructure changes                      │
│  ✅ Self-documenting: Code IS the documentation                             │
│  ✅ Fast: Deploy entire environment in minutes                              │
│  ✅ Consistent: Dev, staging, prod are identical                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 2: What is Terraform?

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WHAT IS TERRAFORM?                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Terraform is an open-source tool by HashiCorp that lets you:               │
│  • Define infrastructure in code files (.tf)                                │
│  • Create/update/delete cloud resources automatically                       │
│  • Track state of your infrastructure                                       │
│  • Work with any cloud provider (GCP, AWS, Azure, etc.)                     │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  HOW IT WORKS:                                                              │
│  ══════════════                                                             │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   1. WRITE                                                           │   │
│  │   ════════                                                           │   │
│  │   You write .tf files describing desired infrastructure              │   │
│  │                                                                      │   │
│  │   # main.tf                                                          │   │
│  │   resource "google_sql_database_instance" "main" {                   │   │
│  │     name             = "hta-database"                                │   │
│  │     database_version = "POSTGRES_15"                                 │   │
│  │     region           = "asia-southeast1"                             │   │
│  │   }                                                                  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                          │                                                  │
│                          ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   2. PLAN                                                            │   │
│  │   ═══════                                                            │   │
│  │   Terraform compares desired state to current state                  │   │
│  │                                                                      │   │
│  │   $ terraform plan                                                   │   │
│  │                                                                      │   │
│  │   Terraform will perform the following actions:                      │   │
│  │     + google_sql_database_instance.main will be created              │   │
│  │                                                                      │   │
│  │   Plan: 1 to add, 0 to change, 0 to destroy.                         │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                          │                                                  │
│                          ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   3. APPLY                                                           │   │
│  │   ═══════                                                            │   │
│  │   Terraform makes the changes in the cloud                           │   │
│  │                                                                      │   │
│  │   $ terraform apply                                                  │   │
│  │                                                                      │   │
│  │   google_sql_database_instance.main: Creating...                     │   │
│  │   google_sql_database_instance.main: Creation complete [5m30s]       │   │
│  │                                                                      │   │
│  │   Apply complete! Resources: 1 added, 0 changed, 0 destroyed.        │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Terraform Basics

### HCL Syntax

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           HCL SYNTAX                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  HCL = HashiCorp Configuration Language                                     │
│  (The language Terraform uses)                                              │
│                                                                             │
│  BASIC STRUCTURE:                                                           │
│  ═════════════════                                                          │
│                                                                             │
│  resource "PROVIDER_TYPE" "LOCAL_NAME" {                                    │
│    argument1 = "value1"                                                     │
│    argument2 = "value2"                                                     │
│                                                                             │
│    nested_block {                                                           │
│      nested_arg = "nested_value"                                            │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  EXAMPLE:                                                                   │
│  ════════                                                                   │
│                                                                             │
│  resource "google_compute_instance" "web_server" {                          │
│  ─────────┬───────────────────────── ─────┬─────                            │
│           │                               │                                 │
│           │                               └── Local name (you choose)       │
│           └── Resource type (from provider)                                 │
│                                                                             │
│    name         = "hta-web-server"      # Required argument                 │
│    machine_type = "n2-standard-2"       # Required argument                 │
│    zone         = "asia-southeast1-a"   # Required argument                 │
│                                                                             │
│    boot_disk {                          # Nested block                      │
│      initialize_params {                                                    │
│        image = "debian-cloud/debian-11"                                     │
│      }                                                                      │
│    }                                                                        │
│                                                                             │
│    network_interface {                  # Another nested block              │
│      network = "default"                                                    │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  DATA TYPES:                                                                │
│  ═══════════                                                                │
│                                                                             │
│  string   = "hello"                                                         │
│  number   = 42                                                              │
│  bool     = true                                                            │
│  list     = ["a", "b", "c"]                                                 │
│  map      = { key1 = "value1", key2 = "value2" }                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Key Terraform Concepts

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KEY CONCEPTS                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  PROVIDERS                                                                  │
│  ═════════                                                                  │
│  Plugins that talk to specific cloud platforms:                             │
│                                                                             │
│  # Configure the Google Cloud provider                                      │
│  provider "google" {                                                        │
│    project = "hta-calibration-prod"                                         │
│    region  = "asia-southeast1"                                              │
│  }                                                                          │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  RESOURCES                                                                  │
│  ═════════                                                                  │
│  Actual infrastructure components:                                          │
│                                                                             │
│  resource "google_storage_bucket" "certificates" {                          │
│    name     = "hta-certificates-prod"                                       │
│    location = "ASIA-SOUTHEAST1"                                             │
│  }                                                                          │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  VARIABLES                                                                  │
│  ═════════                                                                  │
│  Input parameters for your configuration:                                   │
│                                                                             │
│  # variables.tf                                                             │
│  variable "environment" {                                                   │
│    description = "Environment name (dev, staging, prod)"                    │
│    type        = string                                                     │
│    default     = "dev"                                                      │
│  }                                                                          │
│                                                                             │
│  variable "db_instance_type" {                                              │
│    description = "Database instance type"                                   │
│    type        = string                                                     │
│    default     = "db-custom-2-4096"                                         │
│  }                                                                          │
│                                                                             │
│  # Usage in resources                                                       │
│  resource "google_sql_database_instance" "main" {                           │
│    name             = "hta-db-${var.environment}"                           │
│    settings {                                                               │
│      tier = var.db_instance_type                                            │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  OUTPUTS                                                                    │
│  ═══════                                                                    │
│  Values to display or use elsewhere:                                        │
│                                                                             │
│  output "database_connection_name" {                                        │
│    description = "Cloud SQL connection name"                                │
│    value       = google_sql_database_instance.main.connection_name          │
│  }                                                                          │
│                                                                             │
│  output "cluster_endpoint" {                                                │
│    description = "GKE cluster endpoint"                                     │
│    value       = google_container_cluster.primary.endpoint                  │
│    sensitive   = true   # Don't show in logs                                │
│  }                                                                          │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  STATE                                                                      │
│  ═════                                                                      │
│  Terraform tracks what it has created in a "state file":                    │
│                                                                             │
│  terraform.tfstate (or stored in GCS bucket)                                │
│  │                                                                          │
│  ├── google_sql_database_instance.main                                      │
│  │   ├── id = "hta-db-prod"                                                 │
│  │   ├── connection_name = "project:region:hta-db-prod"                     │
│  │   └── ...                                                                │
│  │                                                                          │
│  └── google_container_cluster.primary                                       │
│      ├── id = "hta-cluster"                                                 │
│      └── ...                                                                │
│                                                                             │
│  State is how Terraform knows what exists and what needs to change.         │
│  IMPORTANT: State should be stored remotely (GCS) for team collaboration!   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 4: Terraform Workflow

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           TERRAFORM WORKFLOW                                 │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  DAILY WORKFLOW:                                                            │
│  ═══════════════                                                            │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   1. INIT (First time or after adding providers)                     │   │
│  │   ─────────────────────────────────────────────                      │   │
│  │   $ terraform init                                                   │   │
│  │                                                                      │   │
│  │   Initializing provider plugins...                                   │   │
│  │   - Finding hashicorp/google versions...                             │   │
│  │   - Installing hashicorp/google v5.10.0...                           │   │
│  │                                                                      │   │
│  │   Terraform has been successfully initialized!                       │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                          │                                                  │
│                          ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   2. PLAN (Preview changes)                                          │   │
│  │   ─────────────────────────                                          │   │
│  │   $ terraform plan                                                   │   │
│  │                                                                      │   │
│  │   Terraform will perform the following actions:                      │   │
│  │                                                                      │   │
│  │     # google_storage_bucket.logs will be created                     │   │
│  │     + resource "google_storage_bucket" "logs" {                      │   │
│  │         + name     = "hta-logs-prod"                                 │   │
│  │         + location = "ASIA-SOUTHEAST1"                               │   │
│  │       }                                                              │   │
│  │                                                                      │   │
│  │   Plan: 1 to add, 0 to change, 0 to destroy.                         │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                          │                                                  │
│                          ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   3. APPLY (Make changes)                                            │   │
│  │   ───────────────────────                                            │   │
│  │   $ terraform apply                                                  │   │
│  │                                                                      │   │
│  │   Do you want to perform these actions?                              │   │
│  │     Terraform will perform the actions described above.              │   │
│  │     Only 'yes' will be accepted to approve.                          │   │
│  │                                                                      │   │
│  │     Enter a value: yes                                               │   │
│  │                                                                      │   │
│  │   google_storage_bucket.logs: Creating...                            │   │
│  │   google_storage_bucket.logs: Creation complete after 2s             │   │
│  │                                                                      │   │
│  │   Apply complete! Resources: 1 added, 0 changed, 0 destroyed.        │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                          │                                                  │
│                          ▼                                                  │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   4. DESTROY (When needed - careful!)                                │   │
│  │   ───────────────────────────────────                                │   │
│  │   $ terraform destroy                                                │   │
│  │                                                                      │   │
│  │   Do you really want to destroy all resources?                       │   │
│  │                                                                      │   │
│  │   ⚠️  DANGEROUS: Only use in dev/test environments!                  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 5: Project Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           PROJECT STRUCTURE                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  RECOMMENDED STRUCTURE:                                                     │
│  ══════════════════════                                                     │
│                                                                             │
│  terraform/                                                                 │
│  │                                                                          │
│  ├── modules/                    # Reusable components                      │
│  │   ├── gke/                                                               │
│  │   │   ├── main.tf             # GKE cluster resource                     │
│  │   │   ├── variables.tf        # Input variables                          │
│  │   │   └── outputs.tf          # Output values                            │
│  │   │                                                                      │
│  │   ├── cloudsql/                                                          │
│  │   │   ├── main.tf                                                        │
│  │   │   ├── variables.tf                                                   │
│  │   │   └── outputs.tf                                                     │
│  │   │                                                                      │
│  │   └── networking/                                                        │
│  │       ├── main.tf                                                        │
│  │       ├── variables.tf                                                   │
│  │       └── outputs.tf                                                     │
│  │                                                                          │
│  ├── environments/               # Environment-specific configs             │
│  │   ├── dev/                                                               │
│  │   │   ├── main.tf             # Uses modules with dev settings           │
│  │   │   ├── variables.tf                                                   │
│  │   │   ├── terraform.tfvars    # Dev-specific values                      │
│  │   │   └── backend.tf          # State storage config                     │
│  │   │                                                                      │
│  │   ├── staging/                                                           │
│  │   │   ├── main.tf                                                        │
│  │   │   ├── variables.tf                                                   │
│  │   │   ├── terraform.tfvars                                               │
│  │   │   └── backend.tf                                                     │
│  │   │                                                                      │
│  │   └── prod/                                                              │
│  │       ├── main.tf                                                        │
│  │       ├── variables.tf                                                   │
│  │       ├── terraform.tfvars                                               │
│  │       └── backend.tf                                                     │
│  │                                                                          │
│  └── README.md                   # Documentation                            │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  FILE NAMING CONVENTIONS:                                                   │
│  ═══════════════════════                                                    │
│                                                                             │
│  main.tf         → Primary resource definitions                             │
│  variables.tf    → Input variable declarations                              │
│  outputs.tf      → Output value declarations                                │
│  providers.tf    → Provider configuration                                   │
│  backend.tf      → State backend configuration                              │
│  terraform.tfvars → Variable values (don't commit secrets!)                 │
│  *.auto.tfvars   → Auto-loaded variable values                              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 6: Best Practices

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BEST PRACTICES                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. USE REMOTE STATE                                                        │
│  ═══════════════════                                                        │
│                                                                             │
│  # backend.tf                                                               │
│  terraform {                                                                │
│    backend "gcs" {                                                          │
│      bucket = "hta-terraform-state"                                         │
│      prefix = "prod"                                                        │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  Why? Team can collaborate, state is backed up, locked during apply.        │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  2. USE MODULES                                                             │
│  ═══════════════                                                            │
│                                                                             │
│  # Instead of repeating GKE config everywhere...                            │
│  module "gke_cluster" {                                                     │
│    source = "../modules/gke"                                                │
│                                                                             │
│    cluster_name = "hta-${var.environment}"                                  │
│    region       = var.region                                                │
│    node_count   = var.environment == "prod" ? 3 : 1                         │
│  }                                                                          │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  3. VERSION LOCK PROVIDERS                                                  │
│  ═════════════════════════                                                  │
│                                                                             │
│  # versions.tf                                                              │
│  terraform {                                                                │
│    required_version = ">= 1.5.0"                                            │
│                                                                             │
│    required_providers {                                                     │
│      google = {                                                             │
│        source  = "hashicorp/google"                                         │
│        version = "~> 5.10"   # Allow 5.10.x but not 5.11+                   │
│      }                                                                      │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  4. NEVER COMMIT SECRETS                                                    │
│  ═══════════════════════                                                    │
│                                                                             │
│  # .gitignore                                                               │
│  *.tfvars          # May contain secrets                                    │
│  .terraform/       # Provider binaries                                      │
│  terraform.tfstate # State files (use remote!)                              │
│  *.tfstate.backup                                                           │
│                                                                             │
│  Use environment variables or secret manager for sensitive values.          │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  5. PLAN BEFORE APPLY                                                       │
│  ═════════════════════                                                      │
│                                                                             │
│  ALWAYS run `terraform plan` and review changes before `terraform apply`!   │
│                                                                             │
│  In CI/CD:                                                                  │
│  • PR triggers: terraform plan (review output)                              │
│  • Merge triggers: terraform apply (after approval)                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KEY TAKEAWAYS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. INFRASTRUCTURE AS CODE                                                  │
│     Reproducible, version-controlled, reviewable                            │
│                                                                             │
│  2. TERRAFORM WORKFLOW                                                      │
│     Write → Init → Plan → Apply                                             │
│                                                                             │
│  3. KEY COMPONENTS                                                          │
│     Providers, Resources, Variables, Outputs, State                         │
│                                                                             │
│  4. ORGANIZE WITH MODULES                                                   │
│     Reusable components for consistency                                     │
│                                                                             │
│  5. REMOTE STATE                                                            │
│     Store state in GCS for team collaboration                               │
│                                                                             │
│  6. ALWAYS PLAN FIRST                                                       │
│     Review changes before applying!                                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

- [12. Terraform Implementation](./12_terraform_implementation.md) - Actual code for HTA
- [06. GCP Fundamentals](./06_gcp_fundamentals.md) - Understanding the services we'll create
