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
│   │   SQLite       │ ◄── ./dev.db                               │
│   │   Database     │     (Single File)                          │
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

### Schema Provider

| Aspect | Local (SQLite) | GKE (PostgreSQL) |
|--------|----------------|------------------|
| Provider | `sqlite` | `postgresql` |
| JSON Support | Limited | Full (`@db.Json`) |
| Arrays | Not supported | Supported |
| Case Sensitivity | Case-insensitive | Case-sensitive |
| Concurrent Writes | Limited | Full support |

### Prisma Configuration

```prisma
// prisma/schema.prisma

datasource db {
  // Provider is determined by driver adapter at runtime
  provider = "sqlite"  // Base provider
  url      = env("DATABASE_URL")
}
```

```typescript
// src/lib/prisma.ts
// Driver adapter handles PostgreSQL in production
```

### Connection String Differences

```bash
# Local SQLite
DATABASE_URL="file:./dev.db"

# GKE PostgreSQL
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
DATABASE_URL="file:./dev.db"
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
Browser → Next.js → SQLite file

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
| "Database locked" | SQLite limitation | Close other connections |

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

1. **Develop Locally** with SQLite
   - Fast iteration
   - Easy debugging
   - No infrastructure needed

2. **Test Locally with PostgreSQL** (optional)
   ```bash
   docker compose -f docker-compose.dev.yml up postgres
   DATABASE_URL="postgresql://..." npm run dev
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

1. **JSON operations** - SQLite doesn't support PostgreSQL JSON operators
2. **Date handling** - Timezone differences
3. **Case sensitivity** - PostgreSQL is case-sensitive
4. **Concurrent access** - SQLite has limitations

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
| Database | `./dev.db` | Cloud SQL |
| Config | `next.config.ts` | Same + Kustomize |
| Logs | Terminal | `kubectl logs` |
