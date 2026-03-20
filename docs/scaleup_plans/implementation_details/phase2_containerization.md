# Phase 2: Containerization & Orchestration - Implementation Details

## Document Version
- **Version**: 1.1.0
- **Created**: 2026-03-17
- **Last Updated**: 2026-03-20
- **Phase**: 2 - Containerization & Orchestration
- **Status**: 45% Complete

---

## Overview

Phase 2 focuses on containerizing the application for consistent deployments and setting up Kubernetes orchestration for production-grade scalability.

---

## Implementation Status

### Summary

| Component | Status | Completion |
|-----------|--------|------------|
| Dockerfile (Multi-stage) | Complete | 100% |
| Dockerfile (Playwright) | Complete | 100% |
| Docker Compose (Dev) | Complete | 100% |
| Docker Compose (Test) | Complete | 100% |
| Docker Compose (Playwright) | Complete | 100% |
| .dockerignore | Complete | 100% |
| Health Check Endpoints | Complete | 100% |
| Container Registry Setup | Documented | 50% |
| Kubernetes Manifests | Not Started | 0% |
| Helm Charts | Not Started | 0% |
| Local K8s Environment | Not Started | 0% |

**Overall Phase Completion: 45%**

---

## Implemented Components

### 1. Multi-Stage Dockerfile

**Location**: `Dockerfile`

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
# Install dependencies and generate Prisma client

# Stage 2: Build
FROM node:20-alpine AS builder
# Build the Next.js application

# Stage 3: Production Runner
FROM node:20-alpine AS runner
# Minimal production runtime
```

#### Features

| Feature | Implementation |
|---------|----------------|
| Multi-stage build | 3 stages (deps, builder, runner) |
| Base image | `node:20-alpine` (minimal) |
| Non-root user | `nextjs:nodejs` (uid 1001) |
| Health check | Docker HEALTHCHECK directive |
| Build optimization | Standalone output mode |
| Security | No dev dependencies in final image |

#### Image Specifications

- **Final Image Size**: ~150-200MB (target: <200MB)
- **Build Time**: ~3-5 minutes
- **Startup Time**: ~5-10 seconds

---

### 2. Playwright Dockerfile

**Location**: `Dockerfile.playwright`

Purpose: Generates visual regression test baselines in a Linux environment to ensure consistent snapshots across CI and local development.

```dockerfile
FROM mcr.microsoft.com/playwright:v1.58.2-noble

WORKDIR /app

# Install dependencies and build
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate

COPY . .
RUN npx prisma db push && npm run db:seed
RUN npm run build

# Run visual tests with snapshot updates
CMD ["sh", "-c", "PORT=3001 npm start & sleep 20 && npx playwright test tests/e2e/evals/visual-regression.spec.ts --update-snapshots"]
```

#### Features

| Feature | Implementation |
|---------|----------------|
| Base image | `mcr.microsoft.com/playwright:v1.58.2-noble` |
| Browser dependencies | Pre-installed (Chromium, Firefox, WebKit) |
| Database | SQLite (embedded for testing) |
| Output | Snapshot files mounted to host |

#### Usage

```bash
# Generate/update visual regression baselines
npm run test:visual:docker

# Or manually
docker compose -f docker-compose.playwright.yml up --build --abort-on-container-exit
```

---

### 3. Docker Compose (Development)

**Location**: `docker-compose.dev.yml`

```yaml
services:
  postgres:    # PostgreSQL 16 database
  app:         # HTA application
  # opensign:  # Optional digital signature service
```

#### Services

| Service | Image | Port | Purpose |
|---------|-------|------|---------|
| `postgres` | `postgres:16-alpine` | 5432 | Development database |
| `app` | Built from Dockerfile | 3000 | Application |
| `opensign-*` | (Commented) | 3001, 8080 | Digital signatures |

#### Usage

```bash
# Start development environment
docker compose -f docker-compose.dev.yml up

# Run with database
docker compose -f docker-compose.dev.yml up postgres app

# Database migrations
docker compose exec app npx prisma migrate dev
```

---

### 4. Docker Compose (Testing)

**Location**: `docker-compose.test.yml`

Configured for running integration tests with PostgreSQL in CI environments.

---

### 5. Docker Compose (Playwright)

**Location**: `docker-compose.playwright.yml`

Orchestrates the Playwright container for visual regression baseline generation.

```yaml
services:
  playwright:
    build:
      context: .
      dockerfile: Dockerfile.playwright
    volumes:
      # Mount snapshot directory to persist generated baselines
      - ./tests/e2e/evals/visual-regression.spec.ts-snapshots:/app/tests/e2e/evals/visual-regression.spec.ts-snapshots
```

#### Purpose

- Ensures visual regression baselines are generated in Linux (matching CI environment)
- Eliminates cross-platform rendering differences between Windows/macOS and Linux
- Volume mount persists snapshots to host for committing to git

---

### 6. Docker Ignore Configuration

**Location**: `.dockerignore`

Excludes from Docker builds:
- `node_modules/`
- `.next/`
- `*.db` files
- `.env*` files
- Test files and directories
- Documentation
- Git files

---

### 7. Health Check Endpoints

**Locations**:
- `src/app/api/health/route.ts` - Basic liveness check
- `src/app/api/health/ready/route.ts` - Readiness check with dependencies

#### Liveness Endpoint (`/api/health`)

```json
{
  "status": "healthy",
  "timestamp": "2026-03-17T10:30:00.000Z"
}
```

#### Readiness Endpoint (`/api/health/ready`)

```json
{
  "status": "ready",
  "timestamp": "2026-03-17T10:30:00.000Z",
  "checks": {
    "database": "connected"
  }
}
```

#### Docker Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=3s --start-period=5s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1
```

---

## Not Yet Implemented

### Kubernetes Manifests (0%)

**Planned Location**: `k8s/`

Required manifests:
- [ ] `namespace.yaml` - Namespace definition
- [ ] `deployment.yaml` - Application deployment
- [ ] `service.yaml` - ClusterIP service
- [ ] `ingress.yaml` - Ingress rules
- [ ] `configmap.yaml` - Non-sensitive configuration
- [ ] `secret.yaml` - Secret references
- [ ] `hpa.yaml` - Horizontal Pod Autoscaler
- [ ] `pdb.yaml` - Pod Disruption Budget
- [ ] `networkpolicy.yaml` - Network policies

---

### Helm Charts (0%)

**Planned Location**: `charts/hta-calibration/`

Required files:
- [ ] `Chart.yaml` - Chart metadata
- [ ] `values.yaml` - Default values
- [ ] `values-staging.yaml` - Staging overrides
- [ ] `values-production.yaml` - Production overrides
- [ ] `templates/` - Kubernetes templates

---

### Container Registry (50%)

**Current State**: GitHub Container Registry configured in `deploy.yml`

**Remaining Work**:
- [ ] Google Artifact Registry setup (for GCP deployment)
- [ ] Image retention policies
- [ ] Vulnerability scanning integration
- [ ] Multi-region registry replication

---

### Local Kubernetes Environment (0%)

**Options Planned**:
- [ ] Kind (Kubernetes in Docker)
- [ ] Minikube
- [ ] Docker Desktop Kubernetes

**Setup Required**:
- [ ] Local cluster creation scripts
- [ ] Development ingress configuration
- [ ] Local secrets management
- [ ] Database volume persistence

---

## Next Steps

### Priority 1: Kubernetes Manifests

1. Create `k8s/base/` directory with core manifests
2. Implement Kustomize overlays for environments
3. Test with local Kind cluster

### Priority 2: Helm Charts

1. Create chart structure
2. Templatize Kubernetes manifests
3. Configure values per environment
4. Document chart usage

### Priority 3: Local Development

1. Set up Kind cluster scripts
2. Configure local ingress
3. Create development workflow documentation

---

## Verification Checklist

### Completed

- [x] `docker build .` succeeds
- [x] `docker compose -f docker-compose.dev.yml up` starts successfully
- [x] `docker compose -f docker-compose.playwright.yml up` generates snapshots
- [x] Health check endpoint responds correctly
- [x] Non-root user runs the application
- [x] Final image size under 200MB

### Pending

- [ ] Kubernetes manifests apply successfully
- [ ] Helm chart installs without errors
- [ ] Local Kind cluster runs the application
- [ ] HPA scales pods correctly
- [ ] Network policies enforce isolation

---

## Files Reference

### Docker Files
- `Dockerfile` - Multi-stage production build
- `Dockerfile.playwright` - Visual regression baseline generation
- `docker-compose.dev.yml` - Development environment
- `docker-compose.test.yml` - PostgreSQL integration test environment
- `docker-compose.playwright.yml` - Visual regression testing
- `.dockerignore` - Build exclusions

### Health Endpoints
- `src/app/api/health/route.ts` - Liveness check
- `src/app/api/health/ready/route.ts` - Readiness check

### CI/CD Integration
- `.github/workflows/deploy.yml` - Docker build and push

---

## Related Documents

- [Containerization Plan](../detailed_plan/03_containerization.md)
- [Kubernetes Orchestration Plan](../detailed_plan/04_kubernetes_orchestration.md)
- [Scale-Up Overview](../detailed_plan/00_scaleup_overview.md)
