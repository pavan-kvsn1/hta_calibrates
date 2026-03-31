# 07 - Containerization (Docker)

## Documentation Index

| File | Description | When to Read |
|------|-------------|--------------|
| [01-docker-compose.md](./01-docker-compose.md) | Docker Compose configurations | Local development, testing |
| README.md (this file) | Dockerfile, multi-stage build | Building images |

---

## Overview

The application uses a multi-stage Docker build for optimized production images.

---

## Dockerfile Structure

```dockerfile
# Stage 1: Dependencies
FROM node:20-alpine AS deps
WORKDIR /app
RUN apk add --no-cache python3 make g++
COPY package*.json ./
COPY prisma ./prisma/
RUN npm ci
RUN npx prisma generate

# Stage 2: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/prisma ./prisma
COPY . .
ENV NEXT_TELEMETRY_DISABLED=1
ENV SKIP_DB_INIT=true
RUN npm run build

# Stage 3: Production
FROM node:20-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Create non-root user
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

# Copy built application
COPY --from=builder /app/public ./public
COPY --from=builder /app/.next/standalone ./
COPY --from=builder /app/.next/static ./.next/static
COPY --from=builder /app/prisma ./prisma

# Copy Prisma client and CLI
COPY --from=builder /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder /app/node_modules/@prisma ./node_modules/@prisma
COPY --from=builder /app/node_modules/prisma ./node_modules/prisma

# Entrypoint script
COPY docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

# Set ownership
RUN mkdir -p /app/.next/cache && chown -R nextjs:nodejs /app

USER nextjs
EXPOSE 3000
ENV HOSTNAME="0.0.0.0"
ENV PORT=3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=60s --retries=3 \
  CMD wget --no-verbose --tries=1 --spider http://localhost:3000/api/health || exit 1

CMD ["./docker-entrypoint.sh"]
```

---

## Multi-Stage Build Benefits

| Stage | Purpose | Size |
|-------|---------|------|
| deps | Install dependencies | ~500MB |
| builder | Build Next.js app | ~1GB |
| runner | Production runtime | ~230MB |

The final image is much smaller because:
- Only production dependencies
- Uses Next.js standalone output
- No build tools or dev dependencies

---

## Entrypoint Script

```bash
#!/bin/sh
# docker-entrypoint.sh

set -e

echo "Starting HTA Calibration..."

# Run database migrations
if [ "$RUN_MIGRATIONS" = "true" ]; then
  echo "Running database migrations..."
  npx prisma db push --accept-data-loss
fi

# Start the application
echo "Starting Next.js server..."
exec node server.js
```

**Why an entrypoint script?**
- Run migrations before app starts
- Graceful startup sequence
- Configurable via environment variables

---

## Key Build Variables

| Variable | Purpose | Set During |
|----------|---------|------------|
| `SKIP_DB_INIT=true` | Skip Prisma DB connection at build | Build |
| `NEXT_TELEMETRY_DISABLED=1` | Disable Next.js telemetry | Build & Run |
| `NODE_ENV=production` | Production mode | Run |
| `RUN_MIGRATIONS=true` | Run migrations on startup | Run |

---

## Build Commands

### Local Build

```bash
# Build image
docker build -t hta-app .

# Build with no cache (for debugging)
docker build --no-cache -t hta-app .

# Build specific stage (for debugging)
docker build --target deps -t hta-deps .
```

### Run Locally

```bash
# Run with local PostgreSQL (Docker Compose network)
docker run -p 3000:3000 \
  -e DATABASE_URL="postgresql://hta_user:hta_dev_password@host.docker.internal:5432/hta_calibration" \
  -e NEXTAUTH_SECRET="your-secret" \
  -e NEXTAUTH_URL="http://localhost:3000" \
  hta-app
```

### Push to Registry

```bash
# Tag for Artifact Registry
docker tag hta-app asia-south1-docker.pkg.dev/PROJECT/hta-calibration/app:latest

# Push
docker push asia-south1-docker.pkg.dev/PROJECT/hta-calibration/app:latest

# Tag with version
docker tag hta-app asia-south1-docker.pkg.dev/PROJECT/hta-calibration/app:v1.0.0
docker push asia-south1-docker.pkg.dev/PROJECT/hta-calibration/app:v1.0.0
```

---

## Next.js Standalone Output

The Dockerfile uses Next.js standalone output mode (configured in `next.config.ts`):

```typescript
// next.config.ts
export default {
  output: 'standalone',
}
```

This creates a minimal production bundle with:
- `server.js` - Node.js server
- `.next/static` - Static assets
- Minimal node_modules (only runtime deps)

---

## Common Build Issues

### 1. Prisma Connection During Build

**Error**: `PrismaClientInitializationError` during `npm run build`

**Cause**: Prisma trying to connect to database during build

**Fix**: Set `SKIP_DB_INIT=true`:
```dockerfile
ENV SKIP_DB_INIT=true
RUN npm run build
```

### 2. Native Module Errors

**Error**: `Error loading shared library` or `GLIBC not found`

**Cause**: Native modules built on different platform

**Fix**: Install build tools in deps stage:
```dockerfile
RUN apk add --no-cache python3 make g++
```

### 3. Permission Denied

**Error**: `EACCES: permission denied` on `/app/.next/cache`

**Cause**: Non-root user can't write to directory

**Fix**: Create and chown directory:
```dockerfile
RUN mkdir -p /app/.next/cache && chown -R nextjs:nodejs /app
```

### 4. Large Image Size

**Cause**: Including dev dependencies or build artifacts

**Fix**:
- Use multi-stage build
- Use Next.js standalone output
- Only copy necessary files to final stage

---

## Security Best Practices

1. **Non-root user**: Run as `nextjs` user (UID 1001)
2. **Minimal base image**: Use `alpine` variant
3. **No secrets in image**: Pass via environment variables
4. **Read-only filesystem**: Where possible
5. **Health checks**: Built-in container health monitoring

---

## Debugging Containers

### Shell into Running Container

```bash
# In Kubernetes
kubectl exec -it POD_NAME -n hta-calibration -- sh

# In Docker
docker exec -it CONTAINER_ID sh
```

### Check Logs

```bash
# Docker
docker logs CONTAINER_ID

# Docker (follow)
docker logs -f CONTAINER_ID
```

### Build Debugging

```bash
# Build with verbose output
docker build --progress=plain -t hta-app .

# Build specific stage
docker build --target builder -t hta-builder .
docker run -it hta-builder sh
```

---

## Image Optimization Tips

1. **Order Dockerfile commands** by change frequency (least→most)
2. **Use .dockerignore** to exclude unnecessary files
3. **Combine RUN commands** to reduce layers
4. **Use cache mounts** for faster rebuilds:
   ```dockerfile
   RUN --mount=type=cache,target=/app/.next/cache npm run build
   ```

---

## .dockerignore

```
node_modules
.next
.git
*.md
.env*
coverage
.vscode
```

---

## Key Files

| File | Purpose |
|------|---------|
| `Dockerfile` | Container build instructions |
| `docker-entrypoint.sh` | Startup script |
| `.dockerignore` | Files to exclude from build |
| `next.config.ts` | Standalone output config |

---

## Next Steps

- [08 - Kubernetes](../08-kubernetes/) - Deploy to GKE
- [09 - Deployment](../09-deployment/) - CI/CD pipeline
