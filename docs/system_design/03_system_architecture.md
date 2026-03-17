# System Architecture Overview

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Prerequisite**: [01_beginner_concepts.md](./01_beginner_concepts.md), [02_web_hosting_domains.md](./02_web_hosting_domains.md)

---

## Introduction

This document provides a comprehensive overview of the HTA Calibration system architecture. It shows how all components work together to create a secure, scalable, multi-tenant application.

---

## Part 1: The Complete System Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────────┐
│                        HTA CALIBRATION - COMPLETE SYSTEM ARCHITECTURE                    │
├─────────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                         │
│   USERS                                                                                 │
│   ═════                                                                                 │
│                                                                                         │
│   SYSTEM LEVEL:                                                                         │
│   ┌────────────┐                                                                        │
│   │ Dev-Admin  │  Platform operators (infrastructure, deployments, tenant provisioning)│
│   └─────┬──────┘                                                                        │
│         │                                                                               │
│   ──────┴─────────────────────────────────────────────────────────────────────────────  │
│                                                                                         │
│   TENANT LEVEL (Each Lab):                                                              │
│   ┌───────────┐ ┌───────────┐ ┌───────────┐ ┌───────────┐                              │
│   │ Lab-Admin │ │ Engineer  │ │ Reviewer  │ │ Customer  │                              │
│   │ (Tenant)  │ │ (Tenant)  │ │ (Tenant)  │ │ (Tenant)  │                              │
│   └─────┬─────┘ └─────┬─────┘ └─────┬─────┘ └─────┬─────┘                              │
│         │             │             │             │                                     │
│         └─────────────┴──────┬──────┴─────────────┘                                     │
│                           │                                                             │
│                           ▼                                                             │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│   │                              INTERNET                                            │  │
│   │                         (Public Network)                                         │  │
│   └───────────────────────────────┬─────────────────────────────────────────────────┘  │
│                                   │                                                     │
│   ═══════════════════════════════════════════════════════════════════════════════════  │
│                           GOOGLE CLOUD PLATFORM                                         │
│   ═══════════════════════════════════════════════════════════════════════════════════  │
│                                   │                                                     │
│                                   ▼                                                     │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│   │                         EDGE LAYER                                               │  │
│   │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │  │
│   │  │   Cloud DNS     │  │  Cloud CDN      │  │  Cloud Armor    │                  │  │
│   │  │   (Routing)     │  │  (Caching)      │  │  (WAF/DDoS)     │                  │  │
│   │  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │  │
│   └───────────────────────────────┬─────────────────────────────────────────────────┘  │
│                                   │                                                     │
│                                   ▼                                                     │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│   │                      LOAD BALANCING LAYER                                        │  │
│   │  ┌─────────────────────────────────────────────────────────────────────────┐    │  │
│   │  │              Google Cloud Load Balancer (HTTPS)                          │    │  │
│   │  │              • SSL Termination                                           │    │  │
│   │  │              • Health Checks                                             │    │  │
│   │  │              • Traffic Distribution                                      │    │  │
│   │  └──────────────────────────────┬──────────────────────────────────────────┘    │  │
│   └─────────────────────────────────┼───────────────────────────────────────────────┘  │
│                                     │                                                   │
│                                     ▼                                                   │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│   │                      COMPUTE LAYER (GKE Cluster)                                 │  │
│   │  ┌─────────────────────────────────────────────────────────────────────────┐    │  │
│   │  │                    Kubernetes Cluster                                    │    │  │
│   │  │                                                                          │    │  │
│   │  │   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐ ┌──────────────┐   │    │  │
│   │  │   │   HTA App    │ │   HTA App    │ │   HTA App    │ │   HTA App    │   │    │  │
│   │  │   │   Pod 1      │ │   Pod 2      │ │   Pod 3      │ │   Pod N      │   │    │  │
│   │  │   │   (Next.js)  │ │   (Next.js)  │ │   (Next.js)  │ │   (Next.js)  │   │    │  │
│   │  │   └──────────────┘ └──────────────┘ └──────────────┘ └──────────────┘   │    │  │
│   │  │                                                                          │    │  │
│   │  │   ┌──────────────────────────────────────────────────────────────────┐  │    │  │
│   │  │   │  Background Workers (Jobs, Queues)                                │  │    │  │
│   │  │   │  • PDF Generation                                                 │  │    │  │
│   │  │   │  • Email Notifications                                            │  │    │  │
│   │  │   │  • Event Processing                                               │  │    │  │
│   │  │   └──────────────────────────────────────────────────────────────────┘  │    │  │
│   │  │                                                                          │    │  │
│   │  └──────────────────────────────────────────────────────────────────────────┘    │  │
│   └───────────────────────────────┬─────────────────────────────────────────────────┘  │
│                                   │                                                     │
│           ┌───────────────────────┼───────────────────────┐                            │
│           │                       │                       │                            │
│           ▼                       ▼                       ▼                            │
│   ┌───────────────┐     ┌───────────────┐     ┌───────────────────────────────────┐   │
│   │  DATA LAYER   │     │ STORAGE LAYER │     │      SECRETS LAYER                │   │
│   │               │     │               │     │                                   │   │
│   │ ┌───────────┐ │     │ ┌───────────┐ │     │  ┌─────────────────────────────┐ │   │
│   │ │Cloud SQL  │ │     │ │   Cloud   │ │     │  │   Google Secret Manager     │ │   │
│   │ │PostgreSQL │ │     │ │  Storage  │ │     │  │   ═══════════════════════   │ │   │
│   │ │           │ │     │ │  (GCS)    │ │     │  │                             │ │   │
│   │ │• Users    │ │     │ │           │ │     │  │   • Database credentials    │ │   │
│   │ │• Certs    │ │     │ │• PDFs     │ │     │  │   • API keys                │ │   │
│   │ │• Tenants  │ │     │ │• Images   │ │     │  │   • Tenant-specific secrets │ │   │
│   │ │• Events   │ │     │ │• Backups  │ │     │  │   • Encryption keys         │ │   │
│   │ └───────────┘ │     │ └───────────┘ │     │  │   • OAuth credentials       │ │   │
│   │               │     │               │     │  └─────────────────────────────┘ │   │
│   └───────────────┘     └───────────────┘     └───────────────────────────────────┘   │
│                                                                                         │
│   ┌─────────────────────────────────────────────────────────────────────────────────┐  │
│   │                      OBSERVABILITY LAYER                                         │  │
│   │  ┌─────────────────┐  ┌─────────────────┐  ┌─────────────────┐                  │  │
│   │  │ Cloud Monitoring│  │  Cloud Logging  │  │  Cloud Trace    │                  │  │
│   │  │ (Metrics)       │  │  (Logs)         │  │  (Tracing)      │                  │  │
│   │  └─────────────────┘  └─────────────────┘  └─────────────────┘                  │  │
│   └─────────────────────────────────────────────────────────────────────────────────┘  │
│                                                                                         │
└─────────────────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Component Breakdown

### Layer 1: Edge Layer (Entry Point)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           EDGE LAYER COMPONENTS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CLOUD DNS                                                                  │
│  ═════════                                                                  │
│  Purpose: Translate domain names to IP addresses                            │
│                                                                             │
│  hta-calibration.com  ──▶  35.201.xxx.xxx (Load Balancer IP)               │
│                                                                             │
│  Why use Cloud DNS (not regular DNS)?                                       │
│  • 100% uptime SLA                                                          │
│  • Anycast routing (fastest response globally)                              │
│  • Integrates with GCP services                                             │
│  • Supports DNSSEC (security)                                               │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  CLOUD CDN (Content Delivery Network)                                       │
│  ═════════════════════════════════════                                      │
│  Purpose: Cache static content close to users                               │
│                                                                             │
│  Without CDN:                       With CDN:                               │
│  User in India                      User in India                           │
│      │                                  │                                   │
│      │  500ms                           │  50ms                             │
│      ▼                                  ▼                                   │
│  Server in Singapore              CDN Edge in Mumbai                        │
│                                        │                                    │
│                                        │ (cache miss only)                  │
│                                        ▼                                    │
│                                   Server in Singapore                       │
│                                                                             │
│  What gets cached?                                                          │
│  • JavaScript files                                                         │
│  • CSS files                                                                │
│  • Images                                                                   │
│  • Fonts                                                                    │
│  NOT cached: API responses, dynamic content                                 │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  CLOUD ARMOR (Web Application Firewall)                                     │
│  ══════════════════════════════════════                                     │
│  Purpose: Protect against attacks                                           │
│                                                                             │
│  Protection against:                                                        │
│  • DDoS attacks (millions of fake requests)                                 │
│  • SQL injection attempts                                                   │
│  • Cross-site scripting (XSS)                                               │
│  • Bot traffic                                                              │
│  • Geo-blocking (block certain countries)                                   │
│                                                                             │
│  Example rule:                                                              │
│  "Block any IP that makes more than 1000 requests per minute"              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Layer 2: Load Balancing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           LOAD BALANCING                                     │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  WHAT IS LOAD BALANCING?                                                    │
│  ═══════════════════════                                                    │
│                                                                             │
│  Imagine a restaurant with one waiter vs. four waiters:                     │
│                                                                             │
│  ONE WAITER (No load balancing):                                            │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  Customer 1: "I've been waiting 30 minutes!"                        │    │
│  │  Customer 2: "Me too!"                                              │    │
│  │  Customer 3: "This is terrible!"                                    │    │
│  │  Customer 4: "I'm leaving!"                                         │    │
│  │                                    ┌─────────┐                      │    │
│  │                                    │ Waiter  │ (overwhelmed)        │    │
│  │                                    └─────────┘                      │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  FOUR WAITERS (With load balancing):                                        │
│  ┌────────────────────────────────────────────────────────────────────┐    │
│  │  Customer 1 ──▶ Waiter 1 ──▶ Served in 5 min                       │    │
│  │  Customer 2 ──▶ Waiter 2 ──▶ Served in 5 min                       │    │
│  │  Customer 3 ──▶ Waiter 3 ──▶ Served in 5 min                       │    │
│  │  Customer 4 ──▶ Waiter 4 ──▶ Served in 5 min                       │    │
│  │                                                                     │    │
│  │  HOST (Load Balancer): "Let me seat you with the next available"   │    │
│  └────────────────────────────────────────────────────────────────────┘    │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  OUR LOAD BALANCER FUNCTIONS:                                               │
│  ═══════════════════════════                                                │
│                                                                             │
│  1. SSL TERMINATION                                                         │
│     ┌─────────────┐      ┌─────────────┐      ┌─────────────┐              │
│     │   Browser   │─HTTPS─▶│Load Balancer│──HTTP──▶│  App Server │              │
│     │  (encrypted)│      │(decrypts)   │      │  (internal) │              │
│     └─────────────┘      └─────────────┘      └─────────────┘              │
│                                                                             │
│     Why? App servers don't need to handle encryption (CPU intensive)        │
│                                                                             │
│  2. HEALTH CHECKS                                                           │
│     Load Balancer checks: "Are you alive?"                                  │
│     ┌─────────────┐                                                         │
│     │  Server 1   │ ✅ "Yes, I'm healthy"  → Send traffic                  │
│     │  Server 2   │ ✅ "Yes, I'm healthy"  → Send traffic                  │
│     │  Server 3   │ ❌ No response         → DON'T send traffic            │
│     └─────────────┘                                                         │
│                                                                             │
│  3. SESSION AFFINITY (Optional)                                             │
│     "Send the same user to the same server"                                 │
│     Useful when: Server stores user session in memory                       │
│     We don't need this: We use stateless JWT tokens                         │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Layer 3: Compute (GKE)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           COMPUTE LAYER (GKE)                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  GKE = Google Kubernetes Engine                                             │
│  Kubernetes = System for running containers at scale                        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                    GKE CLUSTER                                       │   │
│  │                                                                      │   │
│  │   NODE 1 (Virtual Machine)     NODE 2 (Virtual Machine)             │   │
│  │   ┌─────────────────────┐     ┌─────────────────────┐               │   │
│  │   │                     │     │                     │               │   │
│  │   │  ┌─────┐ ┌─────┐   │     │  ┌─────┐ ┌─────┐   │               │   │
│  │   │  │Pod 1│ │Pod 2│   │     │  │Pod 3│ │Pod 4│   │               │   │
│  │   │  │     │ │     │   │     │  │     │ │     │   │               │   │
│  │   │  │HTA  │ │HTA  │   │     │  │HTA  │ │HTA  │   │               │   │
│  │   │  │App  │ │App  │   │     │  │App  │ │App  │   │               │   │
│  │   │  └─────┘ └─────┘   │     │  └─────┘ └─────┘   │               │   │
│  │   │                     │     │                     │               │   │
│  │   │  CPU: 2 cores      │     │  CPU: 2 cores      │               │   │
│  │   │  RAM: 8 GB         │     │  RAM: 8 GB         │               │   │
│  │   └─────────────────────┘     └─────────────────────┘               │   │
│  │                                                                      │   │
│  │   If Node 1 crashes, Kubernetes automatically:                      │   │
│  │   1. Detects the failure                                            │   │
│  │   2. Reschedules Pod 1 and Pod 2 to Node 2                         │   │
│  │   3. Or spins up a new Node 3                                       │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  KEY CONCEPTS:                                                              │
│  ══════════════                                                             │
│                                                                             │
│  POD = Smallest deployable unit (usually 1 container)                       │
│  NODE = A virtual machine that runs pods                                    │
│  CLUSTER = Collection of nodes                                              │
│  DEPLOYMENT = Instructions for how to run your app                          │
│  SERVICE = Network endpoint to reach your pods                              │
│                                                                             │
│  WHY KUBERNETES?                                                            │
│  ═══════════════                                                            │
│  • Auto-healing (restart crashed containers)                                │
│  • Auto-scaling (add more pods when busy)                                   │
│  • Rolling updates (zero-downtime deployments)                              │
│  • Service discovery (pods find each other)                                 │
│  • Secret management (secure credential handling)                           │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Layer 4: Data Storage

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           DATA LAYER                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  CLOUD SQL (PostgreSQL)                                                     │
│  ══════════════════════                                                     │
│  Purpose: Store structured data                                             │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   TABLES WE STORE:                                                   │   │
│  │                                                                      │   │
│  │   ┌─────────────┐  ┌─────────────┐  ┌─────────────┐                 │   │
│  │   │   users     │  │certificates │  │  customers  │                 │   │
│  │   ├─────────────┤  ├─────────────┤  ├─────────────┤                 │   │
│  │   │ id          │  │ id          │  │ id          │                 │   │
│  │   │ name        │  │ number      │  │ company     │                 │   │
│  │   │ email       │  │ status      │  │ tenant_id   │ ◄── Multi-tenant│   │
│  │   │ tenant_id   │  │ created_by  │  │ settings    │                 │   │
│  │   │ role        │  │ tenant_id   │  │             │                 │   │
│  │   └─────────────┘  └─────────────┘  └─────────────┘                 │   │
│  │                                                                      │   │
│  │   FEATURES:                                                          │   │
│  │   • High Availability (standby replica)                              │   │
│  │   • Automatic backups (daily)                                        │   │
│  │   • Point-in-time recovery                                           │   │
│  │   • Private IP (not exposed to internet)                             │   │
│  │   • Automatic storage increase                                       │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  CLOUD STORAGE (GCS)                                                        │
│  ═══════════════════                                                        │
│  Purpose: Store files (unstructured data)                                   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   BUCKETS (like folders):                                            │   │
│  │                                                                      │   │
│  │   hta-certificates-prod/                                             │   │
│  │   ├── tenant-acme/                                                   │   │
│  │   │   ├── CERT-2026-001.pdf                                          │   │
│  │   │   └── CERT-2026-002.pdf                                          │   │
│  │   └── tenant-globex/                                                 │   │
│  │       └── CERT-2026-001.pdf                                          │   │
│  │                                                                      │   │
│  │   hta-signatures-prod/                                               │   │
│  │   ├── user-123-signature.png                                         │   │
│  │   └── user-456-signature.png                                         │   │
│  │                                                                      │   │
│  │   FEATURES:                                                          │   │
│  │   • 99.999999999% durability (11 nines!)                             │   │
│  │   • Signed URLs for secure access                                    │   │
│  │   • Lifecycle policies (auto-delete old files)                       │   │
│  │   • Versioning (keep history)                                        │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Layer 5: Secrets Management (Critical!)

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    SECRETS MANAGEMENT (VERY IMPORTANT!)                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  WHAT ARE SECRETS?                                                          │
│  ═════════════════                                                          │
│  Any sensitive information that shouldn't be in your code:                  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │  NEVER PUT THESE IN YOUR CODE:                                       │   │
│  │                                                                      │   │
│  │  ❌ DATABASE_URL=postgresql://user:password123@db.example.com        │   │
│  │  ❌ API_KEY=sk_live_abc123xyz                                        │   │
│  │  ❌ JWT_SECRET=my-super-secret-key                                   │   │
│  │  ❌ SMTP_PASSWORD=email-password                                     │   │
│  │                                                                      │   │
│  │  WHY? Anyone who sees your code can steal your credentials!          │   │
│  │  (GitHub is full of leaked secrets - hackers actively search for them)│  │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  GOOGLE SECRET MANAGER                                                      │
│  ═════════════════════                                                      │
│                                                                             │
│  Instead of hardcoding secrets, we store them securely:                     │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   Secret Manager (Encrypted Vault)                                   │   │
│  │   ┌────────────────────────────────────────────────────────────┐    │   │
│  │   │                                                             │    │   │
│  │   │   SYSTEM SECRETS:                                           │    │   │
│  │   │   ├── database-url                                          │    │   │
│  │   │   ├── nextauth-secret                                       │    │   │
│  │   │   ├── jwt-signing-key                                       │    │   │
│  │   │   └── smtp-credentials                                      │    │   │
│  │   │                                                             │    │   │
│  │   │   TENANT-SPECIFIC SECRETS:                                  │    │   │
│  │   │   ├── tenant-acme/                                          │    │   │
│  │   │   │   ├── opensign-api-key                                  │    │   │
│  │   │   │   ├── custom-smtp-password                              │    │   │
│  │   │   │   └── webhook-signing-secret                            │    │   │
│  │   │   │                                                         │    │   │
│  │   │   └── tenant-globex/                                        │    │   │
│  │   │       ├── opensign-api-key                                  │    │   │
│  │   │       └── sso-client-secret                                 │    │   │
│  │   │                                                             │    │   │
│  │   └────────────────────────────────────────────────────────────┘    │   │
│  │                                                                      │   │
│  │   FEATURES:                                                          │   │
│  │   • Encryption at rest and in transit                                │   │
│  │   • Access logging (who accessed what, when)                         │   │
│  │   • Version control (roll back if needed)                            │   │
│  │   • Automatic rotation                                               │   │
│  │   • IAM integration (fine-grained access)                            │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  HOW SECRETS REACH YOUR APPLICATION:                                        │
│  ════════════════════════════════════                                       │
│                                                                             │
│  ┌───────────────┐     ┌───────────────┐     ┌───────────────┐            │
│  │    Secret     │     │  Kubernetes   │     │  Your App     │            │
│  │    Manager    │────▶│   Secret      │────▶│  (reads from  │            │
│  │               │     │   Object      │     │  environment) │            │
│  └───────────────┘     └───────────────┘     └───────────────┘            │
│                                                                             │
│  1. Secrets stored in GCP Secret Manager                                    │
│  2. External Secrets Operator syncs them to Kubernetes                      │
│  3. Kubernetes injects them as environment variables                        │
│  4. Your app reads: process.env.DATABASE_URL                               │
│                                                                             │
│  YOUR CODE NEVER SEES THE ACTUAL SECRET VALUES AT BUILD TIME!              │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Request Flow Example

Let's trace what happens when an engineer creates a certificate:

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REQUEST FLOW: CREATE CERTIFICATE                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STEP 1: User clicks "Create Certificate"                                  │
│  ═══════════════════════════════════════                                    │
│  Browser: POST https://hta-calibration.com/api/certificates                 │
│  Body: { "instrument": "Pressure Gauge", "customer": "ACME Corp" }         │
│                                                                             │
│         │                                                                   │
│         ▼                                                                   │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STEP 2: DNS Resolution                                               │   │
│  │ Browser asks: "Where is hta-calibration.com?"                        │   │
│  │ DNS responds: "35.201.xxx.xxx"                                       │   │
│  └────────────────────────────────────┬────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STEP 3: Load Balancer                                                │   │
│  │ • Terminates SSL (decrypts HTTPS)                                    │   │
│  │ • Checks which pod is healthy                                        │   │
│  │ • Forwards to Pod 2 (least busy)                                     │   │
│  └────────────────────────────────────┬────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STEP 4: Application Pod                                              │   │
│  │                                                                      │   │
│  │ a) Authentication Middleware                                         │   │
│  │    - Validates JWT token from cookie                                 │   │
│  │    - Extracts user ID and tenant ID                                  │   │
│  │    - Rejects if invalid → 401 Unauthorized                          │   │
│  │                                                                      │   │
│  │ b) Authorization Check                                               │   │
│  │    - Is user an ENGINEER? Yes → continue                            │   │
│  │    - Can they create certificates? Yes → continue                   │   │
│  │                                                                      │   │
│  │ c) Business Logic                                                    │   │
│  │    - Validate input data                                             │   │
│  │    - Generate certificate number: "CERT-2026-0042"                   │   │
│  │    - Create certificate record                                       │   │
│  │                                                                      │   │
│  └────────────────────────────────────┬────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STEP 5: Database Operations                                          │   │
│  │                                                                      │   │
│  │ SQL: INSERT INTO certificates                                        │   │
│  │      (number, status, tenant_id, created_by)                         │   │
│  │      VALUES ('CERT-2026-0042', 'DRAFT', 'tenant-acme', 'user-123')  │   │
│  │                                                                      │   │
│  │ Note: tenant_id ensures data isolation!                              │   │
│  └────────────────────────────────────┬────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STEP 6: Event Publishing (for real-time updates)                     │   │
│  │                                                                      │   │
│  │ Publish to event queue:                                              │   │
│  │ {                                                                    │   │
│  │   "type": "CERTIFICATE_CREATED",                                     │   │
│  │   "certificateId": "cert-uuid-123",                                  │   │
│  │   "tenantId": "tenant-acme",                                         │   │
│  │   "timestamp": "2026-03-17T10:30:00Z"                                │   │
│  │ }                                                                    │   │
│  │                                                                      │   │
│  │ This triggers:                                                       │   │
│  │ • Notification to relevant users                                     │   │
│  │ • Dashboard refresh via WebSocket                                    │   │
│  │ • Audit log entry                                                    │   │
│  └────────────────────────────────────┬────────────────────────────────┘   │
│                                       │                                     │
│                                       ▼                                     │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │ STEP 7: Response                                                     │   │
│  │                                                                      │   │
│  │ HTTP 201 Created                                                     │   │
│  │ {                                                                    │   │
│  │   "id": "cert-uuid-123",                                             │   │
│  │   "number": "CERT-2026-0042",                                        │   │
│  │   "status": "DRAFT",                                                 │   │
│  │   "createdAt": "2026-03-17T10:30:00Z"                                │   │
│  │ }                                                                    │   │
│  │                                                                      │   │
│  │ Total time: ~100-300ms                                               │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 4: Multi-Tenancy Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           MULTI-TENANCY                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  WHAT IS MULTI-TENANCY?                                                     │
│  ══════════════════════                                                     │
│                                                                             │
│  Multiple calibration labs (tenants) share the same application             │
│  BUT their data is completely isolated.                                     │
│                                                                             │
│  TENANT = A Calibration Lab (like HTA)                                      │
│  Each lab has its own:                                                      │
│  • Users (Engineers, Reviewers, Lab-Admin)                                  │
│  • Certificates                                                             │
│  • Customers                                                                │
│  • Settings and configurations                                              │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  USER ROLES EXPLAINED:                                                      │
│  ═════════════════════                                                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   SYSTEM LEVEL (Dev-Admin)                                           │   │
│  │   ════════════════════════                                           │   │
│  │   Platform operators who manage the entire system:                   │   │
│  │   • Deploy and maintain infrastructure                               │   │
│  │   • Provision new tenants (labs)                                     │   │
│  │   • Monitor system health across all tenants                         │   │
│  │   • Handle system-wide configuration                                 │   │
│  │   • Access to all system secrets                                     │   │
│  │                                                                      │   │
│  │   ─────────────────────────────────────────────────────────────────  │   │
│  │                                                                      │   │
│  │   TENANT LEVEL (Per-Lab Roles)                                       │   │
│  │   ═════════════════════════════                                      │   │
│  │                                                                      │   │
│  │   Lab-Admin:  Manages their own lab (users, settings, reports)       │   │
│  │               CANNOT see other labs' data                            │   │
│  │               CANNOT access system infrastructure                    │   │
│  │                                                                      │   │
│  │   Engineer:   Creates calibration certificates                       │   │
│  │   Reviewer:   Reviews and approves certificates                      │   │
│  │   Customer:   Views and approves their certificates                  │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  TENANT ISOLATION:                                                          │
│  ═════════════════                                                          │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   SINGLE APPLICATION                                                 │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │                                                              │   │   │
│  │   │   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐       │   │   │
│  │   │   │  HTA Lab     │ │ Lab B        │ │ Lab C        │       │   │   │
│  │   │   │  (Tenant 1)  │ │ (Tenant 2)   │ │ (Tenant 3)   │       │   │   │
│  │   │   │              │ │              │ │              │       │   │   │
│  │   │   │ • Lab-Admin  │ │ • Lab-Admin  │ │ • Lab-Admin  │       │   │   │
│  │   │   │ • Engineers  │ │ • Engineers  │ │ • Engineers  │       │   │   │
│  │   │   │ • Reviewers  │ │ • Reviewers  │ │ • Reviewers  │       │   │   │
│  │   │   │ • Customers  │ │ • Customers  │ │ • Customers  │       │   │   │
│  │   │   │              │ │              │ │              │       │   │   │
│  │   │   │ CANNOT see   │ │ CANNOT see   │ │ CANNOT see   │       │   │   │
│  │   │   │ other labs!  │ │ other labs!  │ │ other labs!  │       │   │   │
│  │   │   └──────────────┘ └──────────────┘ └──────────────┘       │   │   │
│  │   │                                                              │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  See [04_multi_tenancy.md](./04_multi_tenancy.md) for full details.        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 5: Key Design Decisions

### Decision 1: Stateless Application

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  STATELESS DESIGN                                                            │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  STATEFUL (Bad for scaling):         STATELESS (Good for scaling):         │
│                                                                             │
│  ┌─────────────┐                     ┌─────────────┐                       │
│  │   Server 1  │                     │   Server 1  │                       │
│  │  ┌───────┐  │                     │  No session │                       │
│  │  │Session│  │ User MUST return    │  storage    │ User can go to ANY    │
│  │  │ Data  │  │ to same server      │             │ server!               │
│  │  └───────┘  │                     └─────────────┘                       │
│  └─────────────┘                                                            │
│                                                                             │
│  OUR APPROACH:                                                              │
│  • Authentication: JWT tokens (self-contained)                              │
│  • Session data: Stored in database                                         │
│  • File uploads: Go directly to Cloud Storage                               │
│  • Caching: Use Redis if needed (shared cache)                              │
│                                                                             │
│  BENEFIT: Any pod can handle any request!                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Decision 2: Event-Driven Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│  EVENT-DRIVEN DESIGN                                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Instead of:                                                                │
│  "Certificate created → immediately send email → wait → respond"           │
│                                                                             │
│  We do:                                                                     │
│  "Certificate created → publish event → respond immediately"               │
│  "Event processor → picks up event → sends email (async)"                  │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │  Request          Event Bus           Background Workers             │   │
│  │  Handler          (Pub/Sub)           (Async Processing)             │   │
│  │                                                                      │   │
│  │  ┌───────┐        ┌───────┐          ┌─────────────────┐            │   │
│  │  │Create │──────▶ │ Event │ ──────▶  │ Email Worker    │            │   │
│  │  │Cert   │        │ Queue │          │ (sends email)   │            │   │
│  │  └───┬───┘        │       │ ──────▶  ├─────────────────┤            │   │
│  │      │            │       │          │ PDF Worker      │            │   │
│  │      │            │       │ ──────▶  │ (generates PDF) │            │   │
│  │      ▼            └───────┘          ├─────────────────┤            │   │
│  │  Fast response!                      │ Webhook Worker  │            │   │
│  │  (100ms)                             │ (notifies systems)│           │   │
│  │                                      └─────────────────┘            │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  See [09_event_architecture.md](./09_event_architecture.md) for details.   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary: What You Need to Remember

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KEY TAKEAWAYS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. LAYERS                                                                  │
│     Users → DNS → CDN → Load Balancer → App → Database                     │
│                                                                             │
│  2. SECURITY                                                                │
│     • HTTPS everywhere                                                      │
│     • Secrets in Secret Manager (NEVER in code!)                           │
│     • Per-tenant data isolation                                             │
│     • WAF protection (Cloud Armor)                                          │
│                                                                             │
│  3. SCALABILITY                                                             │
│     • Multiple pods (horizontal scaling)                                    │
│     • Stateless design                                                      │
│     • Auto-scaling based on load                                            │
│                                                                             │
│  4. RELIABILITY                                                             │
│     • Health checks                                                         │
│     • Auto-restart on failure                                               │
│     • Database backups                                                      │
│     • Multi-zone deployment                                                 │
│                                                                             │
│  5. MULTI-TENANCY                                                           │
│     • tenant_id on all data                                                 │
│     • Query filtering at database level                                     │
│     • Per-tenant secrets                                                    │
│     • Isolated file storage                                                 │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

Continue with:
- [04. Multi-Tenancy Design](./04_multi_tenancy.md) - Deep dive into tenant isolation
- [13. Secrets Management](./13_secrets_management.md) - Secure credential handling
