# Terraform Introduction

## Document Version
- **Version**: 2.0.0
- **Updated**: 2026-03-20
- **Prerequisite**: Basic command line knowledge

---

## How This Document Works

This document teaches Terraform in phases. Start at Phase 1 and work your way up.

| Phase | Level | What You'll Learn |
|-------|-------|-------------------|
| Phase 1 | 0 → 1 | What is Terraform? (No code yet) |
| Phase 2 | 1 → 3 | Your first Terraform file |
| Phase 3 | 3 → 5 | Variables and outputs |
| Phase 4 | 5 → 7 | Modules and project structure |
| Phase 5 | 7 → 10 | Real-world patterns and troubleshooting |

---

# Phase 1: What is Terraform? (Level 0 → 1)

## The Problem

Imagine you need to set up a server for your app. You go to Google Cloud, click around, fill in forms, and create:
- A database
- A server
- A storage bucket

**Now imagine doing this again for a test environment.**

You have to remember every setting, every click. Did you use the same database size? The same region? Probably not exactly the same.

**Now imagine your colleague needs to set up the same thing.**

They'll have to ask you for all the settings. You'll forget some. Things won't match.

## The Solution: Write It Down as Code

What if instead of clicking, you wrote down what you want?

```
I want:
- 1 database, PostgreSQL, small size
- 1 server, 2 CPUs, 4GB memory
- 1 storage bucket in Asia
```

And then a tool reads this and creates everything for you?

**That's Terraform.**

## What Terraform Actually Does

```
┌──────────────────┐      ┌──────────────────┐      ┌──────────────────┐
│                  │      │                  │      │                  │
│  Your Code       │ ───► │  Terraform       │ ───► │  Cloud Resources │
│  (text files)    │      │  (the tool)      │      │  (real servers)  │
│                  │      │                  │      │                  │
└──────────────────┘      └──────────────────┘      └──────────────────┘

   You write            Terraform reads           Google Cloud creates
   what you want        your files and            the actual resources
                        talks to Google Cloud
```

## Why This Matters

| Without Terraform | With Terraform |
|-------------------|----------------|
| Click through web console | Write code once |
| Forget settings | Settings saved in files |
| Hard to recreate | Run same code = same result |
| No history of changes | Git tracks all changes |
| "What did we change?" | `git diff` shows exactly |

## Key Concept: Desired State

Terraform doesn't give you step-by-step instructions. Instead, you tell it **what you want to exist**.

**You write:** "I want a database named 'mydb'"

**Terraform figures out:**
- Does 'mydb' exist? No → Create it
- Does 'mydb' exist? Yes → Do nothing
- Does 'mydb' exist but with wrong settings? → Update it

This is called **declarative** - you declare what you want, not how to do it.

## Phase 1 Summary

- Terraform lets you define cloud resources in text files
- You describe what you want, Terraform makes it happen
- Same code = same infrastructure every time
- Changes are tracked in Git like regular code

---

# Phase 2: Your First Terraform File (Level 1 → 3)

## File Extension

Terraform files end in `.tf`

```
main.tf       ← Terraform file
variables.tf  ← Terraform file
notes.txt     ← NOT a Terraform file
```

## Basic Structure

Every Terraform file has **blocks**. A block looks like this:

```hcl
block_type "label1" "label2" {
  setting1 = "value1"
  setting2 = "value2"
}
```

## The Three Essential Block Types

### 1. Provider Block - "Who do I talk to?"

Tells Terraform which cloud to use.

```hcl
provider "google" {
  project = "my-project-id"
  region  = "asia-south1"
}
```

This says: "Talk to Google Cloud, use this project, in this region"

### 2. Resource Block - "What do I want?"

Tells Terraform what to create.

```hcl
resource "google_storage_bucket" "my_bucket" {
  name     = "my-unique-bucket-name"
  location = "ASIA"
}
```

Breaking this down:
```
resource "google_storage_bucket" "my_bucket" {
         ├────────────────────┘   └────────┘
         │                            │
         │                            └── Your nickname for it
         │                                (use this to reference it later)
         │
         └── Resource type (from Google's Terraform provider)
             google = provider
             storage_bucket = what kind of resource
```

### 3. Output Block - "Tell me what was created"

Shows information after Terraform runs.

```hcl
output "bucket_url" {
  value = google_storage_bucket.my_bucket.url
}
```

After running, Terraform will print:
```
bucket_url = "gs://my-unique-bucket-name"
```

## A Complete Example

Create a file called `main.tf`:

```hcl
# Tell Terraform to use Google Cloud
provider "google" {
  project = "my-project-id"
  region  = "asia-south1"
}

# Create a storage bucket
resource "google_storage_bucket" "photos" {
  name     = "my-app-photos-bucket"
  location = "ASIA"
}

# Show me the bucket URL when done
output "bucket_url" {
  value = google_storage_bucket.photos.url
}
```

## Running Terraform

Three commands, always in this order:

### Step 1: Initialize
```bash
terraform init
```
Downloads the Google Cloud plugin. Run once when starting, or when you add new providers.

### Step 2: Plan
```bash
terraform plan
```
Shows what Terraform WILL do. Nothing changes yet. Review this carefully.

```
Terraform will perform the following actions:

  # google_storage_bucket.photos will be created
  + resource "google_storage_bucket" "photos" {
      + name     = "my-app-photos-bucket"
      + location = "ASIA"
    }

Plan: 1 to add, 0 to change, 0 to destroy.
```

### Step 3: Apply
```bash
terraform apply
```
Actually creates the resources. Type `yes` to confirm.

```
google_storage_bucket.photos: Creating...
google_storage_bucket.photos: Creation complete after 2s

Apply complete! Resources: 1 added, 0 changed, 0 destroyed.

Outputs:
bucket_url = "gs://my-app-photos-bucket"
```

## Making Changes

Edit your file:
```hcl
resource "google_storage_bucket" "photos" {
  name     = "my-app-photos-bucket"
  location = "ASIA"

  # Add this line
  storage_class = "NEARLINE"
}
```

Run `terraform plan` again:
```
  # google_storage_bucket.photos will be updated in-place
  ~ resource "google_storage_bucket" "photos" {
      + storage_class = "NEARLINE"
    }

Plan: 0 to add, 1 to change, 0 to destroy.
```

Run `terraform apply` to make the change.

## Deleting Resources

Remove the resource from your file, or run:
```bash
terraform destroy
```

**Warning:** This deletes real resources. Be careful in production!

## Phase 2 Summary

- Terraform files use `.tf` extension
- Three main blocks: `provider`, `resource`, `output`
- Three commands: `init` → `plan` → `apply`
- Always run `plan` before `apply` to see what will change

---

# Phase 3: Variables and Outputs (Level 3 → 5)

## The Problem with Hardcoding

Look at this code:

```hcl
resource "google_storage_bucket" "photos" {
  name     = "my-app-photos-bucket-dev"
  location = "ASIA"
}
```

What if you want the same bucket for production? You'd have to copy-paste and change "dev" to "prod". Messy.

## Variables: Fill-in-the-Blanks

Variables let you leave blanks that get filled in later.

### Defining a Variable

Create `variables.tf`:
```hcl
variable "environment" {
  description = "Environment name (dev, staging, prod)"
  type        = string
  default     = "dev"
}

variable "region" {
  description = "Google Cloud region"
  type        = string
  default     = "asia-south1"
}
```

### Using a Variable

In `main.tf`:
```hcl
resource "google_storage_bucket" "photos" {
  name     = "my-app-photos-bucket-${var.environment}"
  location = var.region
}
```

`${var.environment}` gets replaced with the actual value.

If environment = "dev", the bucket name becomes "my-app-photos-bucket-dev"
If environment = "prod", the bucket name becomes "my-app-photos-bucket-prod"

### Setting Variable Values

**Option 1: Use the default** (do nothing)

**Option 2: Command line**
```bash
terraform apply -var="environment=prod"
```

**Option 3: File (recommended)**

Create `terraform.tfvars`:
```hcl
environment = "prod"
region      = "asia-south1"
```

Terraform automatically reads this file.

## Variable Types

```hcl
# String - text
variable "name" {
  type    = string
  default = "hello"
}

# Number
variable "count" {
  type    = number
  default = 3
}

# Boolean - true/false
variable "enabled" {
  type    = bool
  default = true
}

# List - multiple values
variable "zones" {
  type    = list(string)
  default = ["asia-south1-a", "asia-south1-b"]
}

# Map - key-value pairs
variable "tags" {
  type = map(string)
  default = {
    team    = "engineering"
    project = "hta"
  }
}
```

## Outputs: Getting Information Out

After Terraform creates resources, you often need information about them (like IP addresses, URLs, etc.)

```hcl
output "database_ip" {
  description = "The private IP of the database"
  value       = google_sql_database_instance.main.private_ip_address
}

output "bucket_name" {
  description = "Name of the created bucket"
  value       = google_storage_bucket.photos.name
}
```

After `terraform apply`, these print to the screen.

To see them again later:
```bash
terraform output
terraform output database_ip
```

### Sensitive Outputs

For passwords or secrets:
```hcl
output "database_password" {
  value     = random_password.db_password.result
  sensitive = true
}
```

Terraform won't print this to the screen (but it's still in the state file).

## Practical Example

**variables.tf:**
```hcl
variable "project_id" {
  description = "GCP project ID"
  type        = string
}

variable "environment" {
  description = "Environment (dev, staging, prod)"
  type        = string
  default     = "dev"
}
```

**main.tf:**
```hcl
provider "google" {
  project = var.project_id
  region  = "asia-south1"
}

resource "google_storage_bucket" "uploads" {
  name     = "${var.project_id}-uploads-${var.environment}"
  location = "ASIA"
}
```

**terraform.tfvars:**
```hcl
project_id  = "hta-calibration-prod"
environment = "dev"
```

**outputs.tf:**
```hcl
output "uploads_bucket" {
  value = google_storage_bucket.uploads.name
}
```

## Phase 3 Summary

- Variables make your code reusable
- Define in `variables.tf`, set values in `terraform.tfvars`
- Use with `var.variable_name`
- Outputs show information after resources are created
- Mark sensitive outputs with `sensitive = true`

---

# Phase 4: Modules and Project Structure (Level 5 → 7)

## The Problem with One Big File

As your infrastructure grows, one file becomes impossible to manage:
- 500 lines of code
- Hard to find things
- Can't reuse pieces

## Modules: Reusable Building Blocks

A module is a folder with Terraform files that does one specific thing.

```
modules/
├── database/           ← Module for creating databases
│   ├── main.tf
│   ├── variables.tf
│   └── outputs.tf
│
└── storage/            ← Module for creating storage
    ├── main.tf
    ├── variables.tf
    └── outputs.tf
```

### Creating a Module

**modules/storage/variables.tf:**
```hcl
variable "bucket_name" {
  type = string
}

variable "location" {
  type    = string
  default = "ASIA"
}
```

**modules/storage/main.tf:**
```hcl
resource "google_storage_bucket" "bucket" {
  name     = var.bucket_name
  location = var.location
}
```

**modules/storage/outputs.tf:**
```hcl
output "bucket_url" {
  value = google_storage_bucket.bucket.url
}
```

### Using a Module

In your main project:

```hcl
module "photos_storage" {
  source = "./modules/storage"

  bucket_name = "my-photos-bucket"
  location    = "ASIA"
}

module "documents_storage" {
  source = "./modules/storage"

  bucket_name = "my-documents-bucket"
  location    = "US"
}
```

Same module, used twice with different settings!

### Accessing Module Outputs

```hcl
output "photos_url" {
  value = module.photos_storage.bucket_url
}
```

## Project Structure: Shared vs Environments

Real projects need multiple environments. Here's how to organize:

```
terraform/
│
├── shared/                    ← Things ALL environments use
│   ├── main.tf                  (Docker registry, state bucket)
│   ├── variables.tf
│   ├── outputs.tf
│   └── terraform.tfvars
│
├── modules/                   ← Reusable building blocks
│   ├── vpc/
│   ├── gke/
│   ├── cloudsql/
│   └── storage/
│
└── environments/              ← One folder per environment
    ├── dev/
    │   ├── main.tf
    │   ├── variables.tf
    │   └── terraform.tfvars
    │
    ├── staging/
    │   └── ...
    │
    └── prod/
        └── ...
```

## Shared vs Environment: What Goes Where?

### Shared (One Copy for Everyone)

Things you only need once, used by all environments:

| Resource | Why Shared? |
|----------|-------------|
| Docker Registry | Build image once, deploy everywhere |
| Terraform State Bucket | One bucket with folders per environment |

### Per-Environment (Separate Copies)

Things each environment needs its own copy of:

| Resource | Why Separate? |
|----------|---------------|
| Database | Dev data ≠ Prod data |
| Kubernetes Cluster | Dev can be small, Prod needs to be big |
| Storage Buckets | Keep environments isolated |

### Visual Example

```
SHARED (created once)
┌─────────────────────────────────────────────┐
│  Docker Registry                            │
│  ┌─────────────────────────────────────┐   │
│  │  app:v1   app:v2   app:v3           │   │
│  └─────────────────────────────────────┘   │
└─────────────────────────────────────────────┘
              │
              │ All environments pull from same registry
              ▼
┌─────────────┬─────────────┬─────────────────┐
│ DEV         │ STAGING     │ PROD            │
│             │             │                 │
│ - Cluster   │ - Cluster   │ - Cluster       │
│   (small)   │   (medium)  │   (large)       │
│             │             │                 │
│ - Database  │ - Database  │ - Database      │
│   (tiny)    │   (small)   │   (HA, backups) │
│             │             │                 │
│ - Buckets   │ - Buckets   │ - Buckets       │
└─────────────┴─────────────┴─────────────────┘
```

## Deployment Order

**Always deploy in this order:**

```
Step 1: Shared (creates registry)
        ↓
Step 2: Dev environment
        ↓
Step 3: Staging environment (when ready)
        ↓
Step 4: Prod environment (when ready)
```

You can't deploy Dev before Shared - Dev needs the Docker registry that Shared creates.

## Phase 4 Summary

- Modules are reusable folders of Terraform code
- Use `source = "./modules/name"` to include them
- Shared resources: created once, used by all environments
- Environment resources: separate copy per environment
- Deploy shared first, then environments

---

# Phase 5: Real-World Patterns (Level 7 → 10)

## State: How Terraform Remembers

Terraform keeps track of what it created in a **state file** (`terraform.tfstate`).

```
State File
├── google_storage_bucket.photos
│   ├── name = "my-photos-bucket"
│   ├── location = "ASIA"
│   └── id = "abc123"
│
└── google_sql_database_instance.main
    ├── name = "my-database"
    └── id = "xyz789"
```

### Why State Matters

Without state, Terraform wouldn't know:
- What resources exist
- What settings they have
- Whether to create, update, or delete

### Remote State (Team Collaboration)

By default, state is a local file. For teams, store it in the cloud:

```hcl
terraform {
  backend "gcs" {
    bucket = "my-terraform-state-bucket"
    prefix = "dev"
  }
}
```

Benefits:
- Team members share the same state
- State is backed up
- Terraform locks state during changes (prevents conflicts)

## Dependencies: Order of Creation

Some resources depend on others. Terraform usually figures this out automatically:

```hcl
# VPC must exist before subnet
resource "google_compute_network" "vpc" {
  name = "my-vpc"
}

resource "google_compute_subnetwork" "subnet" {
  name    = "my-subnet"
  network = google_compute_network.vpc.id  # ← Reference creates dependency
}
```

Terraform sees the reference and knows: create VPC first, then subnet.

### Explicit Dependencies

Sometimes Terraform can't see the dependency. Use `depends_on`:

```hcl
resource "google_service_account_iam_member" "binding" {
  # ...

  depends_on = [module.gke]  # Wait for GKE cluster first
}
```

## Common Errors and Fixes

### Error: "Output not found"

```
Error: Output "cluster_name" not found
```

**Cause:** You ran `terraform output` before `terraform apply`

**Fix:**
```bash
terraform apply    # Create resources first
terraform output   # Now it works
```

### Error: "Identity Pool does not exist"

```
Error: Identity Pool does not exist (project.svc.id.goog)
```

**Cause:** Workload Identity needs GKE cluster, but cluster isn't created yet

**Fix:** Add dependency:
```hcl
depends_on = [module.gke]
```

### Error: "Invalid authentication credentials"

```
Error: Request had invalid authentication credentials
```

**Cause:** Your Google Cloud login expired

**Fix:**
```bash
gcloud auth login
gcloud auth application-default login
```

### Error: "Resource already exists"

```
Error: Resource already exists
```

**Cause:** Resource was created outside Terraform

**Fix:** Import it into state:
```bash
terraform import google_storage_bucket.photos my-photos-bucket
```

### Error: "Quota exceeded"

```
Error: Quota 'CPUS' exceeded
```

**Cause:** GCP project doesn't have enough quota

**Fix:** Request increase in GCP Console → IAM & Admin → Quotas

## Best Practices

### 1. Always Plan Before Apply

```bash
terraform plan     # Review changes
terraform apply    # Only if plan looks good
```

### 2. Use Variables for Everything That Changes

```hcl
# Bad
name = "my-app-photos-prod"

# Good
name = "${var.app_name}-photos-${var.environment}"
```

### 3. Never Commit Secrets

Add to `.gitignore`:
```
*.tfvars          # May contain secrets
.terraform/       # Downloaded providers
terraform.tfstate # State file
```

### 4. Lock Provider Versions

```hcl
terraform {
  required_providers {
    google = {
      source  = "hashicorp/google"
      version = "~> 5.0"    # Allow 5.x but not 6.x
    }
  }
}
```

### 5. Use Consistent Naming

```hcl
# Pattern: {project}-{resource}-{environment}
name = "hta-database-dev"
name = "hta-database-prod"
```

## Complete Deployment Checklist

```
□ Prerequisites
  □ Google Cloud account with billing
  □ gcloud CLI installed
  □ Terraform installed (v1.5+)
  □ Project ID ready

□ Step 1: Authenticate
  $ gcloud auth login
  $ gcloud auth application-default login
  $ gcloud config set project YOUR_PROJECT_ID

□ Step 2: Deploy Shared
  $ cd terraform/shared
  $ cp terraform.tfvars.example terraform.tfvars
  $ # Edit terraform.tfvars with your project_id
  $ terraform init
  $ terraform plan
  $ terraform apply

□ Step 3: Deploy Dev Environment
  $ cd terraform/environments/dev
  $ cp terraform.tfvars.example terraform.tfvars
  $ # Edit terraform.tfvars with your project_id
  $ terraform init
  $ terraform plan
  $ terraform apply    # Takes ~15 minutes

□ Step 4: Connect to Cluster
  $ gcloud container clusters get-credentials hta-calibration-dev \
      --region asia-south1 --project YOUR_PROJECT_ID
  $ kubectl get nodes  # Verify connection

□ Step 5: Deploy Application
  $ kubectl apply -k k8s/overlays/development
  $ kubectl get pods -n hta-calibration
```

## Phase 5 Summary

- State tracks what Terraform created - store it remotely for teams
- Dependencies control creation order - Terraform usually auto-detects
- Know the common errors and their fixes
- Always plan before apply, never commit secrets

---

## Quick Reference

### Commands
| Command | What it does |
|---------|--------------|
| `terraform init` | Download providers, set up backend |
| `terraform plan` | Preview changes (dry run) |
| `terraform apply` | Create/update resources |
| `terraform destroy` | Delete all resources |
| `terraform output` | Show output values |
| `terraform import` | Bring existing resource into state |

### File Naming
| File | Purpose |
|------|---------|
| `main.tf` | Main resources |
| `variables.tf` | Input variables |
| `outputs.tf` | Output values |
| `terraform.tfvars` | Variable values |
| `providers.tf` | Provider configuration |

### Variable Syntax
| Usage | Syntax |
|-------|--------|
| Define | `variable "name" { type = string }` |
| Use | `var.name` |
| In string | `"prefix-${var.name}-suffix"` |

---

## Next Steps

- [12. Terraform Implementation](./12_terraform_implementation.md) - Actual code for HTA
- [06. GCP Fundamentals](./06_gcp_fundamentals.md) - Understanding Google Cloud services
