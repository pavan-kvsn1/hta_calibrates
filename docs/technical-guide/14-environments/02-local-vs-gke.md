# Local vs GKE Differences

## Overview

This guide documents key differences between local development and GKE deployment to help avoid common issues.

---

## Architecture Comparison

```
┌─────────────────────────────────────────────────────────────────┐
│                    LOCAL DEVELOPMENT                             │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌────────────────┐                                            │
│   │   Browser      │                                            │
│   │ localhost:3000 │                                            │
│   └───────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│   ┌────────────────┐                                            │
│   │   Next.js Dev  │ ◄── npm run dev                            │
│   │   Server       │     (Hot Reload)                           │
│   │   Port 3000    │                                            │
│   └───────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│   ┌────────────────┐                                            │
│   │   PostgreSQL   │ ◄── Docker Compose                         │
│   │   (Docker)     │     localhost:5432                         │
│   └────────────────┘                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘

┌─────────────────────────────────────────────────────────────────┐
│                    GKE DEPLOYMENT                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌────────────────┐                                            │
│   │   Browser      │                                            │
│   │  External IP   │                                            │
│   └───────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│   ┌────────────────┐                                            │
│   │   GCP Load     │ ◄── SSL Termination (future)               │
│   │   Balancer     │     Health Checks                          │
│   └───────┬────────┘                                            │
│           │                                                      │
│           ▼                                                      │
│   ┌────────────────┐     ┌────────────────┐                     │
│   │   Pod 1        │ ... │   Pod N        │ ◄── HPA Scaling     │
│   │   Next.js      │     │   Next.js      │                     │
│   │   Production   │     │   Production   │                     │
│   └───────┬────────┘     └───────┬────────┘                     │
│           │                      │                               │
│           └──────────┬───────────┘                               │
│                      │                                           │
│                      ▼                                           │
│   ┌────────────────────────────────┐                            │
│   │   Cloud SQL (PostgreSQL)       │ ◄── Private IP             │
│   │   High Availability            │     Connection Pooling     │
│   └────────────────────────────────┘                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Differences

### Environment Comparison

| Aspect | Local (Docker) | GKE (Cloud SQL) |
|--------|----------------|------------------|
| Provider | PostgreSQL 16 | PostgreSQL 16 |
| Access | localhost:5432 | Private IP |
| Management | Docker Compose | Google Managed |
| Backups | Manual | Automatic |
| HA | Single instance | Multi-zone |

### Prisma Configuration

```prisma
// prisma/schema.prisma

datasource db {
  provider = "postgresql"
  url      = env("DATABASE_URL")
}
```

```typescript
// src/lib/prisma.ts
// Uses @prisma/adapter-pg for PostgreSQL
import { PrismaPg } from '@prisma/adapter-pg'
const adapter = new PrismaPg({ connectionString })
```

### Connection String Differences

```bash
# Local PostgreSQL (Docker)
DATABASE_URL="postgresql://hta_user:hta_dev_password@localhost:5432/hta_calibration"

# GKE PostgreSQL (Cloud SQL)
DATABASE_URL="postgresql://user:pass@10.x.x.x:5432/hta_calibration"
```

---

## Authentication Differences

### Cookie Handling

| Aspect | Local | GKE |
|--------|-------|-----|
| Cookie name | `authjs.session-token` | Same |
| Secure flag | `false` | `true` (with HTTPS) |
| SameSite | `lax` | `lax` |
| Domain | `localhost` | External IP or domain |

### CSRF Protection

```typescript
// Local: Works automatically
signIn('staff-credentials', { email, password })

// GKE: May need explicit CSRF token
const csrfToken = await getCsrfToken()
signIn('staff-credentials', { email, password, csrfToken })
```

### Trust Host

```typescript
// Required in GKE (behind load balancer)
export const { ... } = NextAuth({
  trustHost: true,
  // ...
})
```

---

## File Storage Differences

### Local Development

```typescript
// Files stored in local filesystem
import { writeFile } from 'fs/promises'

await writeFile('./uploads/file.pdf', buffer)
```

### GKE Production

```typescript
// Files stored in Google Cloud Storage
import { Storage } from '@google-cloud/storage'

const storage = new Storage()
const bucket = storage.bucket(process.env.GCS_CERTIFICATES_BUCKET!)
await bucket.file('file.pdf').save(buffer)
```

### Signed URLs

```typescript
// GKE: Generate signed URLs for downloads
const [signedUrl] = await bucket.file('cert.pdf').getSignedUrl({
  action: 'read',
  expires: Date.now() + 15 * 60 * 1000, // 15 minutes
})
```

---

## Environment Variable Sources

### Local

```bash
# .env.local (file)
DATABASE_URL="postgresql://hta_user:hta_dev_password@localhost:5432/hta_calibration"
NEXTAUTH_SECRET="dev-secret"
```

### GKE

```yaml
# ConfigMap (non-sensitive)
apiVersion: v1
kind: ConfigMap
metadata:
  name: hta-config
data:
  NODE_ENV: "production"
  NEXTAUTH_URL: "http://34.180.4.228"

# Secret (sensitive)
apiVersion: v1
kind: Secret
metadata:
  name: hta-secrets
data:
  database-url: <base64>
  nextauth-secret: <base64>
```

---

## Networking Differences

### API Requests

| Aspect | Local | GKE |
|--------|-------|-----|
| API URL | `http://localhost:3000/api` | `http://EXTERNAL_IP/api` |
| CORS | Not needed | May need configuration |
| HTTPS | No | Yes (with domain) |

### Database Connection

```
Local:
Browser → Next.js → PostgreSQL (Docker localhost:5432)

GKE:
Browser → Load Balancer → Pod → Private IP → Cloud SQL
```

---

## Debugging Differences

### Local Debugging

```typescript
// Console logging visible immediately
console.log('Debug:', data)

// Hot reload on file changes
// Prisma Studio available
// VS Code debugger works
```

### GKE Debugging

```bash
# View logs
kubectl logs -f deployment/hta-web -n hta-calibration

# Shell into pod
kubectl exec -it deployment/hta-web -n hta-calibration -- sh

# No hot reload
# Prisma Studio requires Cloud SQL Proxy
```

---

## Performance Differences

### Local

- Single process
- No load balancing
- Fast file system
- No network latency to DB

### GKE

- Multiple replicas
- Load balanced
- Network latency to Cloud SQL
- Container resource limits

---

## Common Issues by Environment

### Local Only Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "Can't find module" | Missing install | `npm install` |
| "Port in use" | Another process | Kill process or use different port |
| "Connection refused" | PostgreSQL not running | `npm run db:start` |

### GKE Only Issues

| Issue | Cause | Solution |
|-------|-------|----------|
| "UntrustedHost" | Load balancer | Set `trustHost: true` |
| "MissingCSRF" | Cookie not sent | Check NEXTAUTH_URL |
| "Connection timeout" | Cloud SQL network | Check VPC peering |
| "OOMKilled" | Memory limit | Increase limits |
| "ImagePullBackOff" | Registry permission | Check service account |

---

## Development Workflow

### Recommended Approach

1. **Start Local PostgreSQL**
   ```bash
   npm run db:start  # Starts PostgreSQL via Docker Compose
   ```

2. **Develop Locally**
   ```bash
   npm run dev
   # Fast iteration, easy debugging, production parity
   ```

3. **Deploy to Dev GKE** for integration testing
   ```bash
   docker build -t hta-app .
   docker push registry/hta-app:latest
   kubectl rollout restart deployment/hta-web -n hta-calibration
   ```

4. **Test in GKE** for production-like behavior
   - Authentication flow
   - Cloud Storage
   - Performance

---

## Feature Parity Testing

### Before Deploying, Test

- [ ] Authentication (login/logout)
- [ ] Session persistence
- [ ] File uploads
- [ ] PDF generation
- [ ] Email notifications (if any)
- [ ] All API endpoints

### Known Differences to Watch

1. **Network latency** - Cloud SQL has network overhead vs local Docker
2. **Date handling** - Timezone differences between local and server
3. **Connection pooling** - Cloud SQL may limit connections
4. **Resource limits** - GKE pods have memory/CPU constraints

---

## Quick Reference

### Start Local Development

```bash
npm run dev
# Open http://localhost:3000
```

### Deploy to GKE

```bash
# Build and push
docker build -t asia-south1-docker.pkg.dev/PROJECT/hta-calibration/app:latest .
docker push asia-south1-docker.pkg.dev/PROJECT/hta-calibration/app:latest

# Deploy
kubectl rollout restart deployment/hta-web -n hta-calibration

# Verify
kubectl get pods -n hta-calibration
curl http://EXTERNAL_IP/api/health
```

### Switch Between Environments

```bash
# Local
npm run dev

# GKE (view logs)
kubectl logs -f deployment/hta-web -n hta-calibration

# GKE (port forward for local access)
kubectl port-forward deployment/hta-web -n hta-calibration 3000:3000
```

---

## Key Files

| Purpose | Local | GKE |
|---------|-------|-----|
| Environment | `.env.local` | ConfigMap + Secret |
| Database | Docker Compose | Cloud SQL |
| Config | `next.config.ts` | Same + Kustomize |
| Logs | Terminal | `kubectl logs` |
