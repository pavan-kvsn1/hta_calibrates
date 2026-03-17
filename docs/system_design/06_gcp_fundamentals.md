# GCP Fundamentals

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Prerequisite**: [01_beginner_concepts.md](./01_beginner_concepts.md)

---

## Introduction

This document introduces Google Cloud Platform (GCP) fundamentals for developers new to cloud computing. We'll cover the key services used in HTA Calibration.

---

## Part 1: What is GCP?

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           WHAT IS GCP?                                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Google Cloud Platform = Rent computers and services from Google            │
│                                                                             │
│  Instead of:                          You can:                              │
│  ════════════                         ════════                              │
│  • Buy servers ($10,000+)             • Rent servers ($50/month)            │
│  • Set up a data center               • Use Google's data centers           │
│  • Hire IT staff                      • Google manages hardware             │
│  • Handle hardware failures           • Automatic redundancy                │
│  • Scale by buying more hardware      • Scale with a button click           │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  CLOUD PROVIDERS COMPARISON:                                                │
│  ═══════════════════════════                                                │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  Provider       │  Strengths                                        │   │
│  │─────────────────│─────────────────────────────────────────────────  │   │
│  │  AWS (Amazon)   │  Largest, most services, complex                  │   │
│  │  Azure          │  Microsoft ecosystem, enterprise                  │   │
│  │  GCP (Google) ✅│  Best Kubernetes, good pricing, simpler           │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  WHY WE CHOSE GCP:                                                          │
│  • Best Kubernetes support (Google invented Kubernetes!)                    │
│  • Competitive pricing                                                      │
│  • Good asia-southeast1 region (Singapore) for our users                   │
│  • Simpler than AWS for our needs                                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 2: GCP Organization Structure

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GCP ORGANIZATION STRUCTURE                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   ORGANIZATION (your-company.com)                                    │   │
│  │   │                                                                  │   │
│  │   ├── FOLDER: Production                                             │   │
│  │   │   │                                                              │   │
│  │   │   └── PROJECT: hta-calibration-prod                              │   │
│  │   │       │                                                          │   │
│  │   │       ├── GKE Cluster                                            │   │
│  │   │       ├── Cloud SQL (production database)                        │   │
│  │   │       ├── Cloud Storage (production files)                       │   │
│  │   │       └── Secret Manager (production secrets)                    │   │
│  │   │                                                                  │   │
│  │   ├── FOLDER: Staging                                                │   │
│  │   │   │                                                              │   │
│  │   │   └── PROJECT: hta-calibration-staging                           │   │
│  │   │       └── (similar resources, smaller scale)                     │   │
│  │   │                                                                  │   │
│  │   └── FOLDER: Development                                            │   │
│  │       │                                                              │   │
│  │       └── PROJECT: hta-calibration-dev                               │   │
│  │           └── (development resources)                                │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  KEY CONCEPTS:                                                              │
│  ═════════════                                                              │
│                                                                             │
│  ORGANIZATION = Your company's GCP account                                  │
│  FOLDER = Grouping for projects (by environment, team, etc.)                │
│  PROJECT = Container for resources, billing boundary                        │
│  RESOURCE = Actual services (VMs, databases, storage)                       │
│                                                                             │
│  WHY SEPARATE PROJECTS?                                                     │
│  • Isolated billing (track costs per environment)                           │
│  • Separate permissions (dev team can't touch prod)                         │
│  • Resource limits don't affect each other                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Key GCP Services We Use

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GCP SERVICES OVERVIEW                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   COMPUTE                                                            │   │
│  │   ═══════                                                            │   │
│  │                                                                      │   │
│  │   Google Kubernetes Engine (GKE)                                     │   │
│  │   └── Runs our containerized application                             │   │
│  │   └── Auto-scaling, load balancing, self-healing                     │   │
│  │                                                                      │   │
│  │   Cloud Run (alternative)                                            │   │
│  │   └── Serverless containers (simpler, less control)                  │   │
│  │                                                                      │   │
│  │   Compute Engine                                                     │   │
│  │   └── Raw virtual machines (we don't use directly)                   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   DATA STORAGE                                                       │   │
│  │   ════════════                                                       │   │
│  │                                                                      │   │
│  │   Cloud SQL                                                          │   │
│  │   └── Managed PostgreSQL database                                    │   │
│  │   └── Automatic backups, high availability                           │   │
│  │                                                                      │   │
│  │   Cloud Storage (GCS)                                                │   │
│  │   └── File storage (PDFs, images, backups)                           │   │
│  │   └── Like a cloud-based hard drive                                  │   │
│  │                                                                      │   │
│  │   Memorystore (Redis)                                                │   │
│  │   └── In-memory cache for fast data access                           │   │
│  │   └── Session storage, caching                                       │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   NETWORKING                                                         │   │
│  │   ══════════                                                         │   │
│  │                                                                      │   │
│  │   Cloud Load Balancing                                               │   │
│  │   └── Distributes traffic across servers                             │   │
│  │   └── SSL termination, health checks                                 │   │
│  │                                                                      │   │
│  │   Cloud DNS                                                          │   │
│  │   └── Domain name resolution                                         │   │
│  │   └── hta-calibration.com → IP address                               │   │
│  │                                                                      │   │
│  │   Cloud CDN                                                          │   │
│  │   └── Caches static content close to users                           │   │
│  │   └── Faster load times globally                                     │   │
│  │                                                                      │   │
│  │   Cloud Armor                                                        │   │
│  │   └── Web Application Firewall (WAF)                                 │   │
│  │   └── DDoS protection                                                │   │
│  │                                                                      │   │
│  │   VPC (Virtual Private Cloud)                                        │   │
│  │   └── Private network for your resources                             │   │
│  │   └── Firewall rules, subnets                                        │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   SECURITY & IDENTITY                                                │   │
│  │   ═══════════════════                                                │   │
│  │                                                                      │   │
│  │   IAM (Identity and Access Management)                               │   │
│  │   └── Who can do what to which resources                             │   │
│  │   └── Roles, permissions, service accounts                           │   │
│  │                                                                      │   │
│  │   Secret Manager                                                     │   │
│  │   └── Stores API keys, passwords securely                            │   │
│  │   └── Version control, access logging                                │   │
│  │                                                                      │   │
│  │   Cloud KMS (Key Management Service)                                 │   │
│  │   └── Encryption key management                                      │   │
│  │   └── Encrypt data at rest                                           │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   MESSAGING & EVENTS                                                 │   │
│  │   ══════════════════                                                 │   │
│  │                                                                      │   │
│  │   Cloud Pub/Sub                                                      │   │
│  │   └── Message queue for async processing                             │   │
│  │   └── Decouple services, event-driven architecture                   │   │
│  │                                                                      │   │
│  │   Cloud Tasks                                                        │   │
│  │   └── Scheduled and delayed task execution                           │   │
│  │   └── Retry failed tasks                                             │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   OBSERVABILITY                                                      │   │
│  │   ═════════════                                                      │   │
│  │                                                                      │   │
│  │   Cloud Monitoring                                                   │   │
│  │   └── Metrics, dashboards, alerts                                    │   │
│  │   └── "Is my system healthy?"                                        │   │
│  │                                                                      │   │
│  │   Cloud Logging                                                      │   │
│  │   └── Centralized log storage and search                             │   │
│  │   └── "What happened at 3 AM?"                                       │   │
│  │                                                                      │   │
│  │   Cloud Trace                                                        │   │
│  │   └── Request tracing across services                                │   │
│  │   └── "Why is this request slow?"                                    │   │
│  │                                                                      │   │
│  │   Error Reporting                                                    │   │
│  │   └── Automatic error detection and grouping                         │   │
│  │   └── "What errors are happening?"                                   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   CI/CD & CONTAINERS                                                 │   │
│  │   ══════════════════                                                 │   │
│  │                                                                      │   │
│  │   Artifact Registry                                                  │   │
│  │   └── Store Docker images                                            │   │
│  │   └── Like Docker Hub but private                                    │   │
│  │                                                                      │   │
│  │   Cloud Build                                                        │   │
│  │   └── Build and test code automatically                              │   │
│  │   └── CI/CD pipelines                                                │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 4: Regions and Zones

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           REGIONS AND ZONES                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GCP has data centers around the world:                                     │
│                                                                             │
│  REGION = Geographic area (e.g., Singapore)                                 │
│  ZONE = Specific data center within a region                                │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   asia-southeast1 (Singapore) ← Our primary region                   │   │
│  │   │                                                                  │   │
│  │   ├── asia-southeast1-a (Data Center A)                              │   │
│  │   ├── asia-southeast1-b (Data Center B)                              │   │
│  │   └── asia-southeast1-c (Data Center C)                              │   │
│  │                                                                      │   │
│  │   Each zone is an independent data center with:                      │   │
│  │   • Own power supply                                                 │   │
│  │   • Own cooling                                                      │   │
│  │   • Own network connections                                          │   │
│  │                                                                      │   │
│  │   If zone A fails, zones B and C keep running!                       │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  WHY SINGAPORE?                                                             │
│  ═══════════════                                                            │
│  • Closest to our primary users (Southeast Asia)                            │
│  • Lower latency = faster response times                                    │
│  • Data residency requirements                                              │
│                                                                             │
│  MULTI-ZONE DEPLOYMENT:                                                     │
│  ══════════════════════                                                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   asia-southeast1-a          asia-southeast1-b                       │   │
│  │   ┌───────────────────┐     ┌───────────────────┐                   │   │
│  │   │  GKE Node 1       │     │  GKE Node 2       │                   │   │
│  │   │  ┌─────┐ ┌─────┐  │     │  ┌─────┐ ┌─────┐  │                   │   │
│  │   │  │Pod 1│ │Pod 2│  │     │  │Pod 3│ │Pod 4│  │                   │   │
│  │   │  └─────┘ └─────┘  │     │  └─────┘ └─────┘  │                   │   │
│  │   └───────────────────┘     └───────────────────┘                   │   │
│  │                                                                      │   │
│  │   Cloud SQL Primary  ←────────▶  Cloud SQL Standby                  │   │
│  │   (zone a)                       (zone b, automatic failover)       │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  If zone A has an outage, traffic automatically routes to zone B!          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 5: IAM (Identity and Access Management)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           IAM BASICS                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  IAM answers: "Who can do what to which resource?"                          │
│                                                                             │
│  PRINCIPALS (Who):                                                          │
│  ═════════════════                                                          │
│  • User accounts (developer@company.com)                                    │
│  • Service accounts (app@project.iam.gserviceaccount.com)                   │
│  • Google groups (dev-team@company.com)                                     │
│                                                                             │
│  ROLES (What):                                                              │
│  ═════════════                                                              │
│  • roles/viewer - Read-only access                                          │
│  • roles/editor - Read + Write access                                       │
│  • roles/owner - Full access including IAM                                  │
│  • roles/cloudsql.client - Connect to Cloud SQL                             │
│  • roles/storage.objectViewer - View files in GCS                           │
│                                                                             │
│  RESOURCES (Which):                                                         │
│  ══════════════════                                                         │
│  • Organization                                                             │
│  • Folder                                                                   │
│  • Project                                                                  │
│  • Individual resources (specific bucket, database, etc.)                   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  SERVICE ACCOUNTS:                                                          │
│  ═════════════════                                                          │
│                                                                             │
│  Service accounts are for applications (not humans):                        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   hta-app@hta-prod.iam.gserviceaccount.com                          │   │
│  │   │                                                                  │   │
│  │   ├── roles/cloudsql.client (connect to database)                   │   │
│  │   ├── roles/storage.objectAdmin (read/write files)                  │   │
│  │   ├── roles/secretmanager.secretAccessor (read secrets)             │   │
│  │   └── roles/pubsub.publisher (publish events)                       │   │
│  │                                                                      │   │
│  │   This service account is used by the HTA application pods.          │   │
│  │   It has ONLY the permissions it needs (least privilege).           │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   hta-cicd@hta-prod.iam.gserviceaccount.com                         │   │
│  │   │                                                                  │   │
│  │   ├── roles/container.developer (deploy to GKE)                     │   │
│  │   └── roles/artifactregistry.writer (push images)                   │   │
│  │                                                                      │   │
│  │   This service account is used by CI/CD pipelines.                   │   │
│  │   It can deploy but NOT access production secrets!                  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 6: Billing and Cost Management

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           BILLING BASICS                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GCP PRICING MODEL:                                                         │
│  ═══════════════════                                                        │
│                                                                             │
│  Most services charge by:                                                   │
│  • Time (per hour/minute the resource runs)                                 │
│  • Usage (per GB stored, per request, per GB transferred)                   │
│                                                                             │
│  EXAMPLE COSTS (approximate, varies by region):                             │
│  ═════════════════════════════════════════════                              │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   GKE Cluster (3 nodes, n2-standard-4)                               │   │
│  │   └── ~$300/month                                                    │   │
│  │                                                                      │   │
│  │   Cloud SQL (db-custom-4-16384, HA)                                  │   │
│  │   └── ~$250/month                                                    │   │
│  │                                                                      │   │
│  │   Cloud Storage (100 GB)                                             │   │
│  │   └── ~$2/month                                                      │   │
│  │                                                                      │   │
│  │   Load Balancer                                                      │   │
│  │   └── ~$20/month + traffic                                           │   │
│  │                                                                      │   │
│  │   Pub/Sub (1 million messages)                                       │   │
│  │   └── ~$0.40/month                                                   │   │
│  │                                                                      │   │
│  │   Secret Manager (10 secrets, 10K accesses)                          │   │
│  │   └── ~$0.10/month                                                   │   │
│  │                                                                      │   │
│  │   ─────────────────────────────────────────────────────────────────  │   │
│  │   TOTAL: ~$600/month for production                                  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  COST OPTIMIZATION:                                                         │
│  ══════════════════                                                         │
│                                                                             │
│  1. Use preemptible/spot VMs for non-critical workloads (70% cheaper)      │
│  2. Right-size instances (don't over-provision)                             │
│  3. Set up budget alerts                                                    │
│  4. Use committed use discounts for predictable workloads                   │
│  5. Delete unused resources                                                 │
│  6. Use Cloud Storage lifecycle policies                                    │
│                                                                             │
│  BUDGET ALERTS:                                                             │
│  ══════════════                                                             │
│                                                                             │
│  Set up alerts at 50%, 80%, 100% of budget:                                 │
│                                                                             │
│  Budget: $800/month                                                         │
│  ├── Alert at $400 (50%) → "Heads up"                                       │
│  ├── Alert at $640 (80%) → "Watch spending"                                 │
│  └── Alert at $800 (100%) → "Over budget!"                                  │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 7: Getting Started with GCP

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           GETTING STARTED                                    │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: Create a GCP Account                                               │
│  ═════════════════════════════                                              │
│  • Go to console.cloud.google.com                                           │
│  • Sign in with Google account                                              │
│  • New accounts get $300 free credit!                                       │
│                                                                             │
│  STEP 2: Install gcloud CLI                                                 │
│  ═════════════════════════════                                              │
│  # macOS                                                                    │
│  brew install google-cloud-sdk                                              │
│                                                                             │
│  # Windows                                                                  │
│  # Download installer from cloud.google.com/sdk                             │
│                                                                             │
│  # Initialize                                                               │
│  gcloud init                                                                │
│  gcloud auth login                                                          │
│                                                                             │
│  STEP 3: Create a Project                                                   │
│  ═════════════════════════                                                  │
│  gcloud projects create hta-calibration-dev                                 │
│  gcloud config set project hta-calibration-dev                              │
│                                                                             │
│  STEP 4: Enable APIs                                                        │
│  ═════════════════════                                                      │
│  gcloud services enable \                                                   │
│    container.googleapis.com \                                               │
│    sqladmin.googleapis.com \                                                │
│    secretmanager.googleapis.com \                                           │
│    cloudbuild.googleapis.com                                                │
│                                                                             │
│  STEP 5: Set up billing                                                     │
│  ═════════════════════════                                                  │
│  • Link a billing account to your project                                   │
│  • Set up budget alerts                                                     │
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
│  1. GCP = Rent infrastructure from Google                                   │
│     Pay only for what you use                                               │
│                                                                             │
│  2. ORGANIZE BY PROJECT                                                     │
│     Separate dev/staging/prod for isolation                                 │
│                                                                             │
│  3. KEY SERVICES FOR US                                                     │
│     GKE (compute), Cloud SQL (database), GCS (files)                        │
│     Secret Manager (secrets), Pub/Sub (events)                              │
│                                                                             │
│  4. REGIONS AND ZONES                                                       │
│     Deploy across zones for high availability                               │
│                                                                             │
│  5. IAM FOR SECURITY                                                        │
│     Least privilege: only grant necessary permissions                       │
│                                                                             │
│  6. MONITOR COSTS                                                           │
│     Set budget alerts, right-size resources                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

- [07. Container Orchestration (GKE)](./07_container_orchestration.md) - Running your app
- [11. Terraform Introduction](./11_terraform_intro.md) - Infrastructure as Code
