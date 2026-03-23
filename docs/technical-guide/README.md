# HTA Calibration System - Technical Guide

> Complete technical documentation for the HTA Calibration System covering architecture, implementation, deployment, and operations.

## Quick Navigation

| Section | Description |
|---------|-------------|
| [00 - Overview](./00-overview/) | Architecture, tech stack, design decisions |
| [01 - Frontend](./01-frontend/) | Next.js 15, React 19, UI components, state |
| [02 - Backend](./02-backend/) | API routes, server actions, business logic |
| [03 - Database](./03-database/) | Prisma 7, PostgreSQL/SQLite, schema design |
| [04 - Authentication](./04-authentication/) | NextAuth v5, roles, permissions, OAuth |
| [05 - Event Architecture](./05-event-architecture/) | Certificate workflow, state machine |
| [06 - Infrastructure](./06-infrastructure/) | Terraform, GCP services, networking |
| [07 - Containerization](./07-containerization/) | Docker, multi-stage builds, optimization |
| [08 - Kubernetes](./08-kubernetes/) | GKE, Kustomize, manifests, scaling |
| [09 - Deployment](./09-deployment/) | CI/CD, GitHub Actions, environments |
| [10 - Testing](./10-testing/) | Strategy, Vitest, Playwright, coverage |
| [11 - Monitoring](./11-monitoring/) | Observability, logging, alerting |
| [12 - Debugging](./12-debugging/) | Troubleshooting, common issues, fixes |
| [13 - Tools](./13-tools/) | DBeaver, Lens, Cloud SQL Proxy, CLI |
| [14 - Environments](./14-environments/) | Dev/Staging/Prod configuration |

---

## System Overview

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                              HTA Calibration System                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │   Browser   │───▶│  Next.js    │───▶│   Prisma    │───▶│ PostgreSQL  │  │
│  │   (React)   │    │  (App Dir)  │    │   (ORM)     │    │  (Cloud SQL)│  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│         │                 │                                      │          │
│         │                 │                                      │          │
│         ▼                 ▼                                      ▼          │
│  ┌─────────────┐    ┌─────────────┐                       ┌─────────────┐  │
│  │   NextAuth  │    │     GCS     │                       │   SQLite    │  │
│  │   (Auth)    │    │  (Storage)  │                       │   (Local)   │  │
│  └─────────────┘    └─────────────┘                       └─────────────┘  │
│                                                                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                            Infrastructure Layer                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │     GKE     │    │  Cloud SQL  │    │     GCS     │    │   Secret    │  │
│  │  (Cluster)  │    │ (PostgreSQL)│    │  (Buckets)  │    │   Manager   │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                                              │
│  ┌─────────────┐    ┌─────────────┐    ┌─────────────┐    ┌─────────────┐  │
│  │  Artifact   │    │   VPC &     │    │  Workload   │    │   Cloud     │  │
│  │  Registry   │    │   Subnets   │    │  Identity   │    │   Logging   │  │
│  └─────────────┘    └─────────────┘    └─────────────┘    └─────────────┘  │
│                                                                              │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Tech Stack Summary

### Frontend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js | 15.x | React framework with App Router |
| React | 19.x | UI library |
| TypeScript | 5.x | Type safety |
| Tailwind CSS | 3.x | Utility-first styling |
| shadcn/ui | - | Component library |
| Lucide | - | Icons |

### Backend
| Technology | Version | Purpose |
|------------|---------|---------|
| Next.js API | 15.x | API routes & server actions |
| Prisma | 7.x | ORM with driver adapters |
| NextAuth | 5.x (beta) | Authentication |
| bcryptjs | - | Password hashing |
| Zod | - | Schema validation |

### Database
| Technology | Purpose |
|------------|---------|
| PostgreSQL 15 | Production database (Cloud SQL) |
| SQLite | Local development database |
| Prisma Migrate | Schema migrations |

### Infrastructure
| Technology | Purpose |
|------------|---------|
| Terraform | Infrastructure as Code |
| GKE | Kubernetes cluster |
| Cloud SQL | Managed PostgreSQL |
| GCS | Object storage (certificates, signatures) |
| Artifact Registry | Container images |
| Secret Manager | Secrets storage |
| Workload Identity | Service account binding |

### DevOps
| Technology | Purpose |
|------------|---------|
| Docker | Containerization |
| Kustomize | K8s manifest management |
| GitHub Actions | CI/CD pipelines |
| Cloud Build | Image building |

---

## Getting Started

### Prerequisites
- Node.js 20+
- Docker Desktop
- Google Cloud SDK
- kubectl
- Terraform 1.5+

### Local Development
```bash
# Clone and install
git clone <repo>
cd hta-calibration
npm install

# Setup local database
npx prisma db push
npx prisma db seed

# Start development server
npm run dev
```

### Quick Links
- **Local App**: http://localhost:3000
- **Production**: http://34.180.4.228
- **GCP Console**: https://console.cloud.google.com/home/dashboard?project=hta-calibration-prod

---

## Documentation Conventions

- **Code blocks** show actual commands you can run
- **File paths** are relative to `hta-calibration/` unless noted
- **Environment variables** are shown in `UPPER_CASE`
- **Failure modes** are marked with warning blocks
- **Pro tips** are marked with info blocks

---

## Contributing to Docs

When updating documentation:
1. Keep examples up to date with actual code
2. Include failure modes and debugging steps
3. Add links to related sections
4. Update the changelog at the bottom of each file
