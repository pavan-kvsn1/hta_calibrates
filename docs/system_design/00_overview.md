# HTA Calibration - System Design Overview

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Audience**: Developers new to cloud infrastructure
- **Purpose**: Comprehensive guide to hosting HTA Calibration on GCP

---

## What This Guide Covers

This documentation will take you from zero knowledge to understanding how to deploy a production-grade web application on Google Cloud Platform (GCP). Each concept is explained from first principles.

---

## Table of Contents

### Foundational Concepts (Start Here!)

| # | Document | What You'll Learn |
|---|----------|-------------------|
| 1 | [Beginner Concepts](./01_beginner_concepts.md) | What is a server? What is the cloud? Basic terminology |
| 2 | [Web Hosting & Domains](./02_web_hosting_domains.md) | How websites get on the internet, DNS, SSL certificates |

### Core Architecture

| # | Document | What You'll Learn |
|---|----------|-------------------|
| 3 | [System Architecture Overview](./03_system_architecture.md) | The big picture of our entire system |
| 4 | [Multi-Tenancy Design](./04_multi_tenancy.md) | Serving multiple customers from one application |
| 5 | [Database Architecture](./05_database_architecture.md) | How data is stored and organized |

### Cloud Infrastructure

| # | Document | What You'll Learn |
|---|----------|-------------------|
| 6 | [GCP Fundamentals](./06_gcp_fundamentals.md) | Google Cloud Platform basics |
| 7 | [Container Orchestration (GKE)](./07_container_orchestration.md) | Running applications at scale with Kubernetes |
| 8 | [Auto-Scaling & Load Balancing](./08_autoscaling_loadbalancing.md) | Handling traffic spikes automatically |

### Advanced Patterns

| # | Document | What You'll Learn |
|---|----------|-------------------|
| 9 | [Event-Driven Architecture](./09_event_architecture.md) | Decoupled, scalable communication patterns |
| 10 | [Webhooks & Real-Time Communication](./10_webhooks_realtime.md) | Chat systems, notifications, live updates |

### Infrastructure as Code

| # | Document | What You'll Learn |
|---|----------|-------------------|
| 11 | [Terraform Introduction](./11_terraform_intro.md) | Managing infrastructure with code |
| 12 | [Terraform Implementation](./12_terraform_implementation.md) | Actual Terraform code for our system |

### Security & Operations

| # | Document | What You'll Learn |
|---|----------|-------------------|
| 13 | [Secrets & Credentials Management](./13_secrets_management.md) | API keys, passwords, per-tenant secrets |
| 14 | [Security Architecture](./14_security.md) | Protecting your application and data |
| 15 | [Monitoring & Observability](./15_monitoring.md) | Knowing what's happening in your system |
| 16 | [Disaster Recovery](./16_disaster_recovery.md) | Preparing for and recovering from failures |

---

## The Big Picture

Before diving into details, here's what we're building:

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        HTA CALIBRATION SYSTEM - HIGH LEVEL                       │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   USERS                           INTERNET                      YOUR SYSTEM    │
│   ═════                           ════════                      ═══════════    │
│                                                                                 │
│   ┌─────────┐                                                                   │
│   │Engineer │──┐                                                                │
│   └─────────┘  │                                                                │
│                │         ┌──────────────┐        ┌────────────────────────────┐│
│   ┌─────────┐  │         │              │        │  Google Cloud Platform     ││
│   │Reviewer │──┼────────▶│   Internet   │───────▶│  ════════════════════════  ││
│   └─────────┘  │         │              │        │                            ││
│                │         └──────────────┘        │  Your Application          ││
│   ┌─────────┐  │                │                │  running on servers        ││
│   │Customer │──┘                │                │  that auto-scale           ││
│   └─────────┘                   │                │                            ││
│                                 │                │  Database storing          ││
│                                 │                │  all your data             ││
│   ┌─────────┐                   │                │                            ││
│   │  Admin  │───────────────────┘                │  Files (PDFs, images)      ││
│   └─────────┘                                    │  stored securely           ││
│                                                  │                            ││
│                                                  └────────────────────────────┘│
│                                                                                 │
│   What users see:                What happens behind the scenes:               │
│   • Web browser                  • Load balancers distribute traffic           │
│   • Mobile app                   • Multiple servers handle requests            │
│   • Simple URL                   • Databases store information                 │
│                                  • Everything is automated                     │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

---

## Key Concepts We'll Cover

### 1. Why Do We Need All This?

When you run a website on your laptop:
- Only YOU can access it
- If your laptop crashes, the website goes down
- If 1000 people visit at once, it crashes

**The cloud solves these problems:**
- Anyone in the world can access it
- If one server fails, others take over
- Traffic spikes are handled automatically

### 2. The Journey of a Web Request

```
User types: hta-calibration.com
        │
        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│ STEP 1: DNS Lookup                                                            │
│ ─────────────────────────────────────────────────────────────────────────────│
│ Your browser asks: "Where is hta-calibration.com?"                            │
│ DNS responds: "It's at IP address 35.201.xxx.xxx"                             │
└───────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│ STEP 2: Load Balancer                                                         │
│ ─────────────────────────────────────────────────────────────────────────────│
│ Request arrives at Google Cloud Load Balancer                                 │
│ Load Balancer decides: "Server 2 is least busy, send it there"               │
└───────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│ STEP 3: Application Server                                                    │
│ ─────────────────────────────────────────────────────────────────────────────│
│ Your Next.js app receives the request                                         │
│ It might need to:                                                             │
│   • Check if user is logged in (authentication)                               │
│   • Get data from the database                                                │
│   • Generate a PDF certificate                                                │
│   • Return HTML/JSON to the browser                                           │
└───────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│ STEP 4: Database & Storage                                                    │
│ ─────────────────────────────────────────────────────────────────────────────│
│ PostgreSQL: Stores structured data (users, certificates, etc.)                │
│ Cloud Storage: Stores files (PDFs, signature images)                          │
└───────────────────────────────────────────────────────────────────────────────┘
        │
        ▼
┌───────────────────────────────────────────────────────────────────────────────┐
│ STEP 5: Response                                                              │
│ ─────────────────────────────────────────────────────────────────────────────│
│ The response travels back through the same path                               │
│ User sees the webpage in their browser                                        │
│ Total time: Usually 100-500 milliseconds                                      │
└───────────────────────────────────────────────────────────────────────────────┘
```

---

## Technology Choices Explained

### Why Google Cloud Platform (GCP)?

| Consideration | Our Choice | Why |
|---------------|------------|-----|
| Cloud Provider | GCP | Good pricing, strong in Asia-Pacific region, excellent Kubernetes support |
| Region | asia-southeast1 (Singapore) | Closest to target users, low latency |

### Why Kubernetes (GKE)?

```
WITHOUT KUBERNETES                      WITH KUBERNETES
══════════════════                      ═══════════════

  ┌─────────────┐                       ┌─────────────────────────────┐
  │   Server    │                       │   Kubernetes Cluster        │
  │  ┌───────┐  │                       │  ┌───────┐ ┌───────┐       │
  │  │  App  │  │  If this dies,        │  │ App 1 │ │ App 2 │       │
  │  └───────┘  │  EVERYTHING dies      │  └───────┘ └───────┘       │
  │             │                       │  ┌───────┐ ┌───────┐       │
  │             │                       │  │ App 3 │ │ App 4 │       │
  └─────────────┘                       │  └───────┘ └───────┘       │
                                        └─────────────────────────────┘

                                        If App 1 dies, Apps 2-4
                                        keep running. Kubernetes
                                        automatically starts a
                                        replacement!
```

### Why Terraform?

**Without Terraform (Manual Setup):**
1. Log into GCP Console
2. Click through 50+ screens
3. Hope you remember all the settings
4. Repeat for staging environment
5. Repeat again for production
6. Make a mistake? Start over!

**With Terraform (Infrastructure as Code):**
```hcl
# This creates everything automatically!
resource "google_container_cluster" "primary" {
  name     = "hta-cluster"
  location = "asia-southeast1"

  # ... configuration
}
```
- Run once, deploy everywhere
- Version controlled (can undo mistakes)
- Reproducible and documented

---

## Reading Order for Beginners

If you're completely new to this, read in this order:

```
START HERE
    │
    ▼
┌─────────────────────────────────────┐
│ 01. Beginner Concepts               │  ← Understand the basics
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 02. Web Hosting & Domains           │  ← How websites work
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 03. System Architecture Overview    │  ← The big picture
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 06. GCP Fundamentals                │  ← Cloud basics
└─────────────────────────────────────┘
    │
    ▼
┌─────────────────────────────────────┐
│ 07. Container Orchestration         │  ← How we run the app
└─────────────────────────────────────┘
    │
    ▼
(Continue with remaining documents in order)
```

---

## Glossary Quick Reference

| Term | Simple Explanation |
|------|-------------------|
| **Server** | A computer that runs your application 24/7 |
| **Cloud** | Renting servers from Google/Amazon/Microsoft instead of buying your own |
| **Container** | A package containing your app and everything it needs to run |
| **Kubernetes** | Software that manages many containers across many servers |
| **Load Balancer** | Distributes traffic across multiple servers |
| **Database** | Where your data is stored (like a giant Excel spreadsheet) |
| **DNS** | Translates domain names (google.com) to IP addresses |
| **SSL/TLS** | Encryption that makes "https://" secure |
| **API** | How different software components talk to each other |
| **Webhook** | Automatic notification when something happens |
| **Terraform** | Tool to create cloud infrastructure using code |

---

## Related: Implementation Documentation

After understanding the concepts in this documentation, you're ready to implement!

The **Scale-Up Plan** documentation (`docs/scaleup_plans/detailed_plan/`) contains:
- Actionable implementation checklists
- Progress tracking for each phase
- Specific configurations and settings
- Step-by-step deployment guides

```
┌─────────────────────────────────────────────────────────────────────────────────┐
│                        DOCUMENTATION WORKFLOW                                    │
├─────────────────────────────────────────────────────────────────────────────────┤
│                                                                                 │
│   STEP 1: LEARN                        STEP 2: IMPLEMENT                        │
│   ════════════════                     ════════════════════                      │
│                                                                                 │
│   📚 System Design Docs                🔧 Scale-Up Plan Docs                    │
│   (this folder)                        (../scaleup_plans/detailed_plan/)        │
│                                                                                 │
│   Read concepts first ─────────────────▶ Then follow implementation guides     │
│                                                                                 │
└─────────────────────────────────────────────────────────────────────────────────┘
```

### Quick Links to Implementation Docs (Execution Order)

| # | After Learning | Go To Implementation Doc |
|---|----------------|-------------------------|
| 03 | Container Orchestration | [03_containerization.md](../scaleup_plans/detailed_plan/03_containerization.md) |
| 04 | GCP Fundamentals | [04_gcp_infrastructure.md](../scaleup_plans/detailed_plan/04_gcp_infrastructure.md) |
| 05 | Terraform | [05_terraform_iac.md](../scaleup_plans/detailed_plan/05_terraform_iac.md) |
| 06 | Database Architecture | [06_database_setup.md](../scaleup_plans/detailed_plan/06_database_setup.md) |
| 07 | Web Hosting & Domains | [07_dns_ssl_domains.md](../scaleup_plans/detailed_plan/07_dns_ssl_domains.md) |
| 08 | Secrets Management | [08_secrets_implementation.md](../scaleup_plans/detailed_plan/08_secrets_implementation.md) |
| 09 | Security | [09_security_implementation.md](../scaleup_plans/detailed_plan/09_security_implementation.md) |
| 10 | Kubernetes | [10_kubernetes_orchestration.md](../scaleup_plans/detailed_plan/10_kubernetes_orchestration.md) |
| 11 | Auto-Scaling & Load Balancing | [11_autoscaling_configuration.md](../scaleup_plans/detailed_plan/11_autoscaling_configuration.md) |
| 12 | Multi-Tenancy | [12_multi_tenancy_implementation.md](../scaleup_plans/detailed_plan/12_multi_tenancy_implementation.md) |
| 13 | Event Architecture | [13_event_webhooks.md](../scaleup_plans/detailed_plan/13_event_webhooks.md) |
| 14 | Monitoring | [14_monitoring_observability.md](../scaleup_plans/detailed_plan/14_monitoring_observability.md) |
| 15 | Disaster Recovery | [15_disaster_recovery.md](../scaleup_plans/detailed_plan/15_disaster_recovery.md) |

---

## Next Steps

Ready to learn? Start with [01. Beginner Concepts](./01_beginner_concepts.md)!
