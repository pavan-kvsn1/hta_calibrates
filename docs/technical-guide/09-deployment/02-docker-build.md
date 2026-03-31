# Docker Build & Push Workflow

## Workflow Configuration

**File**: `.github/workflows/deploy.yml`

---

## Trigger Conditions

```yaml
on:
  push:
    branches: [main]
  workflow_dispatch:  # Allow manual trigger
```

**Triggers**:
- Push to `main` branch
- Manual trigger from GitHub Actions UI

---

## Workflow Steps

### 1. Setup Docker Buildx

```yaml
- name: Set up Docker Buildx
  uses: docker/setup-buildx-action@v3
```

**Buildx features**:
- Multi-platform builds (linux/amd64, arm64)
- Build caching
- Concurrent builds

### 2. Login to Container Registry

```yaml
- name: Login to GitHub Container Registry
  uses: docker/login-action@v3
  with:
    registry: ghcr.io
    username: ${{ github.actor }}
    password: ${{ secrets.GITHUB_TOKEN }}
```

**Authentication**:
- Uses GitHub's automatic token
- No manual secrets needed
- Scoped to repository

### 3. Extract Metadata

```yaml
- name: Extract metadata for Docker
  id: meta
  uses: docker/metadata-action@v5
  with:
    images: ghcr.io/${{ github.repository }}
    tags: |
      type=sha,prefix=
      type=raw,value=latest,enable={{is_default_branch}}
      type=ref,event=branch
```

**Tags Generated**:
- `ghcr.io/owner/hta-calibration:abc1234` (commit SHA)
- `ghcr.io/owner/hta-calibration:latest` (on main only)
- `ghcr.io/owner/hta-calibration:main` (branch name)

### 4. Build and Push

```yaml
- name: Build and push Docker image
  uses: docker/build-push-action@v5
  with:
    context: .
    push: true
    tags: ${{ steps.meta.outputs.tags }}
    labels: ${{ steps.meta.outputs.labels }}
    cache-from: type=gha
    cache-to: type=gha,mode=max
    platforms: linux/amd64
```

**Build features**:
- Context: entire repo
- Push: yes (to ghcr.io)
- Cache: GitHub Actions cache
- Platform: linux/amd64 (GKE compatible)

---

## Dockerfile Multi-Stage Build

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
COPY package.json package-lock.json ./
RUN npm ci

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY . .
ENV SKIP_DB_INIT=true
RUN npx prisma generate
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production

RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma

USER nextjs
EXPOSE 3000
CMD ["node", "server.js"]
```

---

## Build Caching Strategy

```
┌─────────────────────────────────────────────────────────────────┐
│                    BUILD CACHE LAYERS                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Layer 1: Base Image (node:20-alpine)                           │
│  └── Cached globally, rarely changes                            │
│                                                                  │
│  Layer 2: Dependencies (npm ci)                                 │
│  └── Cached until package-lock.json changes                     │
│  └── Typically ~300MB                                           │
│                                                                  │
│  Layer 3: Source Code                                           │
│  └── Changes every build                                        │
│                                                                  │
│  Layer 4: Build Output (.next)                                  │
│  └── Cached incrementally by Next.js                            │
│                                                                  │
│  GitHub Actions cache (type=gha):                               │
│  └── Stores layers between CI runs                              │
│  └── Max 10GB per repository                                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Image Registry: ghcr.io

```
┌─────────────────────────────────────────────────────────────────┐
│                 GITHUB CONTAINER REGISTRY                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  URL Format: ghcr.io/OWNER/REPOSITORY:TAG                       │
│                                                                  │
│  Example: ghcr.io/htaipl/hta-calibration:latest                 │
│                                                                  │
│  Features:                                                       │
│  ├── Free for public repos                                      │
│  ├── Integrated with GitHub permissions                         │
│  ├── No additional authentication for GitHub Actions            │
│  └── Can be made public or private                              │
│                                                                  │
│  Access from Kubernetes:                                        │
│  ├── Public: No imagePullSecrets needed                         │
│  └── Private: Create docker-registry secret                     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Using Images in Kubernetes

### Public Repository

```yaml
# k8s/base/deployment.yaml
spec:
  containers:
    - name: hta-web
      image: ghcr.io/owner/hta-calibration:latest
      # No imagePullSecrets needed for public images
```

### Private Repository

```bash
# Create pull secret
kubectl create secret docker-registry ghcr-pull-secret \
  --docker-server=ghcr.io \
  --docker-username=YOUR_GITHUB_USERNAME \
  --docker-password=YOUR_GITHUB_PAT \
  -n hta-calibration
```

```yaml
# k8s/base/deployment.yaml
spec:
  imagePullSecrets:
    - name: ghcr-pull-secret
  containers:
    - name: hta-web
      image: ghcr.io/owner/hta-calibration:latest
```

---

## Manual Build & Push

### Local Build

```bash
# Build image
docker build -t ghcr.io/owner/hta-calibration:dev .

# Test locally
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://..." \
  -e NEXTAUTH_SECRET="..." \
  ghcr.io/owner/hta-calibration:dev
```

### Push to Registry

```bash
# Login (one-time)
echo $GITHUB_PAT | docker login ghcr.io -u USERNAME --password-stdin

# Push
docker push ghcr.io/owner/hta-calibration:dev
```

---

## Debugging Build Issues

### Build Fails at npm ci

```
Error: npm ERR! Invalid package-lock.json
```

**Fix**: Regenerate lock file
```bash
rm package-lock.json
npm install
git add package-lock.json
git commit -m "Regenerate package-lock.json"
```

### Build Fails at Prisma Generate

```
Error: Could not find query-engine binary
```

**Fix**: Ensure Prisma binary targets are set
```prisma
// schema.prisma
generator client {
  provider      = "prisma-client-js"
  binaryTargets = ["native", "linux-musl-openssl-3.0.x"]
}
```

### Build Fails at Next.js Build

```
Error: Cannot find module '@prisma/client'
```

**Fix**: Add `SKIP_DB_INIT=true` to bypass database connection during build
```dockerfile
ENV SKIP_DB_INIT=true
```

### Image Too Large

**Current**: ~500MB
**Target**: <300MB

**Optimizations**:
```dockerfile
# Use standalone output
# next.config.js
module.exports = {
  output: 'standalone',
}

# Only copy needed files in final stage
COPY --from=builder /app/.next/standalone ./
```

---

## Viewing Images

### GitHub Packages

1. Go to repository
2. Click "Packages" in right sidebar
3. View all published images

### List Tags

```bash
# View available tags
docker manifest inspect ghcr.io/owner/hta-calibration:latest

# Or via GitHub API
gh api /users/OWNER/packages/container/hta-calibration/versions
```

---

## Automated Tagging Strategy

| Event | Tag(s) Generated |
|-------|------------------|
| Push to main | `latest`, `main`, `abc1234` |
| Push to feature branch | `feature-name`, `abc1234` |
| Manual workflow | `latest`, `main`, `abc1234` |

### Semantic Versioning (Future)

For releases, add version tags:

```yaml
tags: |
  type=semver,pattern={{version}}
  type=semver,pattern={{major}}.{{minor}}
  type=semver,pattern={{major}}
```

Example: Tag `v1.2.3` → `1.2.3`, `1.2`, `1`
