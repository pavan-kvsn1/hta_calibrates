# 09 - Deployment

## Documentation Index

| File | Description | When to Read |
|------|-------------|--------------|
| [01-ci-pipeline.md](./01-ci-pipeline.md) | CI workflow, test stages, code quality | Understanding CI checks |
| [02-docker-build.md](./02-docker-build.md) | Docker image build and push workflow | Debugging image builds |
| [03-deployment-process.md](./03-deployment-process.md) | Deploying to GKE environments | Deploying updates |
| [04-rollback.md](./04-rollback.md) | Rollback procedures, incident response | When things go wrong |
| [05-nightly-checks.md](./05-nightly-checks.md) | Nightly workflows, security audits | Monitoring health |

---

## Quick Reference

### CI Pipeline Status

Check current status: `.github/workflows/ci.yml`

```
Push to main/PR → Code Quality → Tests (parallel) → Build → E2E → Security
                        │              │               │       │
                        │              ├── Unit Tests  │       │
                        │              └── Integration │       │
                        │                 (PostgreSQL) │       │
                        └──────────────────────────────┴───────┘
```

### Manual Deploy

```bash
# 1. Build and push image
docker build -t ghcr.io/OWNER/hta-calibration:latest .
docker push ghcr.io/OWNER/hta-calibration:latest

# 2. Update Kubernetes
kubectl set image deployment/hta-web \
  hta-web=ghcr.io/OWNER/hta-calibration:latest \
  -n hta-calibration

# 3. Verify
kubectl rollout status deployment/hta-web -n hta-calibration
```

---

## Pipeline Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    CI/CD PIPELINE                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TRIGGER: Push to main or PR                                    │
│     │                                                            │
│     ▼                                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Stage 1: CODE QUALITY                                    │    │
│  │ ├── ESLint (warnings only)                              │    │
│  │ └── TypeScript check (warnings only)                    │    │
│  └─────────────────────────────────────────────────────────┘    │
│     │                                                            │
│     ▼                                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Stage 2: PARALLEL TESTS + BUILD                          │    │
│  │ ┌─────────────┐ ┌─────────────────────────────────────┐ │    │
│  │ │ Unit Tests  │ │ Integration Tests (PostgreSQL)      │ │    │
│  │ │ + Coverage  │ │                                     │ │    │
│  │ └─────────────┘ └─────────────────────────────────────┘ │    │
│  │                                                          │    │
│  │ ┌──────────────────────────────────────────────────────┐│    │
│  │ │ Build Check (Next.js production build)               ││    │
│  │ └──────────────────────────────────────────────────────┘│    │
│  └─────────────────────────────────────────────────────────┘    │
│     │                                                            │
│     ▼                                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Stage 3: E2E TESTS                                       │    │
│  │ └── Playwright workflow tests (Chromium)                │    │
│  └─────────────────────────────────────────────────────────┘    │
│     │                                                            │
│     ▼                                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Stage 4: SECURITY SCAN                                   │    │
│  │ └── npm audit (high/critical)                           │    │
│  └─────────────────────────────────────────────────────────┘    │
│     │                                                            │
│     │ On main branch only                                       │
│     ▼                                                            │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Stage 5: DOCKER BUILD & PUSH                             │    │
│  │ └── Push to ghcr.io                                     │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Workflow Files

| File | Trigger | Purpose |
|------|---------|---------|
| `.github/workflows/ci.yml` | Push/PR to main | Code quality, tests, build |
| `.github/workflows/deploy.yml` | Push to main | Build & push Docker image |
| `.github/workflows/nightly.yml` | Daily @ 2AM UTC | Full test suite, security audit |

---

## Deployment Environments

| Environment | Trigger | Database | Purpose |
|-------------|---------|----------|---------|
| Development | Manual | Cloud SQL dev | Active development |
| Staging | PR merge | Cloud SQL staging | Pre-prod testing |
| Production | Tag/Manual | Cloud SQL prod | Live users |

---

## Key Checks

### Required for Merge

| Check | Blocking? | Description |
|-------|-----------|-------------|
| Code Quality | No | ESLint + TypeScript (warnings) |
| Unit Tests | **Yes** | Must pass |
| Integration Tests | **Yes** | PostgreSQL tests must pass |
| Build | **Yes** | Must compile |
| E2E Tests | **Yes** | Workflow tests |
| Security | No | Reports only |

### Nightly Only

| Check | Description |
|-------|-------------|
| Full Browser E2E | Chromium + Firefox + WebKit |
| Dependency Check | Outdated packages |
| Accessibility Audit | WCAG 2.1 AA |
| Visual Regression | Screenshot comparison |

---

## Common Issues

| Problem | Solution | Doc Reference |
|---------|----------|---------------|
| Tests failing on PR | Check logs, run locally with same env | [01-ci-pipeline.md](./01-ci-pipeline.md) |
| Docker build fails | Check Dockerfile, multi-stage issues | [02-docker-build.md](./02-docker-build.md) |
| Deployment stuck | Check pod logs, rollout status | [03-deployment-process.md](./03-deployment-process.md) |
| Need to rollback | Use kubectl rollout undo | [04-rollback.md](./04-rollback.md) |

---

## Related Documentation

- [07-containerization](../07-containerization/) - Dockerfile details
- [08-kubernetes](../08-kubernetes/) - K8s manifests
- [10-testing](../10-testing/) - Test strategies
- [14-environments](../14-environments/) - Environment configs
