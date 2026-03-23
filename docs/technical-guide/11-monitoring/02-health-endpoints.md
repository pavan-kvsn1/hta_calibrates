# Health Endpoints

## Overview

The application provides health check endpoints for Kubernetes probes and manual diagnostics.

```
┌─────────────────────────────────────────────────────────────────┐
│                    HEALTH CHECK ARCHITECTURE                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────┐     ┌─────────────────┐                   │
│  │  /api/health    │     │ /api/health/    │                   │
│  │  (Liveness)     │     │     ready       │                   │
│  │                 │     │  (Readiness)    │                   │
│  ├─────────────────┤     ├─────────────────┤                   │
│  │ Checks:         │     │ Checks:         │                   │
│  │ - App running   │     │ - App running   │                   │
│  │                 │     │ - DB connected  │                   │
│  ├─────────────────┤     ├─────────────────┤                   │
│  │ Fast (<10ms)    │     │ Slower (~50ms)  │                   │
│  │ Always succeed  │     │ May fail        │                   │
│  │ if app alive    │     │ if deps down    │                   │
│  └────────┬────────┘     └────────┬────────┘                   │
│           │                       │                             │
│           ▼                       ▼                             │
│  ┌─────────────────┐     ┌─────────────────┐                   │
│  │ K8s Liveness    │     │ K8s Readiness   │                   │
│  │ Probe           │     │ Probe           │                   │
│  │                 │     │                 │                   │
│  │ Restarts pod    │     │ Removes from    │                   │
│  │ if fails 3x     │     │ Service if fails│                   │
│  └─────────────────┘     └─────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Endpoint: `/api/health`

### Purpose

**Liveness Probe** - Indicates if the application process is running and can respond to requests.

### Implementation

```typescript
// src/app/api/health/route.ts
import { NextResponse } from 'next/server'

export async function GET() {
  const healthCheck = {
    status: 'healthy',
    timestamp: new Date().toISOString(),
    version: process.env.npm_package_version || '0.1.0',
    uptime: process.uptime(),
    environment: process.env.NODE_ENV || 'development',
  }

  return NextResponse.json(healthCheck, { status: 200 })
}
```

### Response

```json
{
  "status": "healthy",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "version": "0.1.0",
  "uptime": 3600.123,
  "environment": "production"
}
```

### When It Fails

This endpoint should **rarely fail**. If it does, the application is in a bad state:

- Process crash
- Memory exhaustion (OOM)
- Event loop blocked
- Infinite loop

### Kubernetes Configuration

```yaml
# k8s/base/deployment.yaml
livenessProbe:
  httpGet:
    path: /api/health
    port: http
  initialDelaySeconds: 30   # Wait 30s after startup
  periodSeconds: 10         # Check every 10s
  timeoutSeconds: 5         # Allow 5s for response
  failureThreshold: 3       # Restart after 3 failures
```

**Behavior:**
- Checks every 10 seconds
- If 3 consecutive checks fail, Kubernetes restarts the pod
- `initialDelaySeconds: 30` gives the app time to start

---

## Endpoint: `/api/health/ready`

### Purpose

**Readiness Probe** - Indicates if the application is ready to serve traffic, including all dependencies.

### Implementation

```typescript
// src/app/api/health/ready/route.ts
import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const checks: Record<string, string> = {
    database: 'unknown',
  }

  let isReady = true

  // Check database connection
  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = 'connected'
  } catch (error) {
    checks.database = 'disconnected'
    isReady = false
    console.error('Health check - Database connection failed:', error)
  }

  const healthCheck = {
    status: isReady ? 'ready' : 'not_ready',
    timestamp: new Date().toISOString(),
    checks,
  }

  return NextResponse.json(healthCheck, {
    status: isReady ? 200 : 503
  })
}
```

### Response: Healthy

```json
{
  "status": "ready",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "database": "connected"
  }
}
```

### Response: Unhealthy

```json
{
  "status": "not_ready",
  "timestamp": "2024-01-15T10:30:00.000Z",
  "checks": {
    "database": "disconnected"
  }
}
```

**HTTP Status: 503 Service Unavailable**

### When It Fails

- Database connection lost
- Database at max connections
- Network issues to Cloud SQL
- Cloud SQL instance stopped

### Kubernetes Configuration

```yaml
# k8s/base/deployment.yaml
readinessProbe:
  httpGet:
    path: /api/health/ready
    port: http
  initialDelaySeconds: 5    # Start checking quickly
  periodSeconds: 5          # Check every 5s
  timeoutSeconds: 3         # Allow 3s for response
  failureThreshold: 3       # Remove from service after 3 failures
```

**Behavior:**
- Checks every 5 seconds
- If 3 consecutive checks fail, pod is removed from Service endpoints
- Traffic stops flowing to unhealthy pods
- Pod is NOT restarted (that's the liveness probe's job)

---

## Endpoint: `/api/opensign/health`

### Purpose

Check OpenSign integration status (admin-only endpoint).

### Implementation

```typescript
// src/app/api/opensign/health/route.ts
export async function GET() {
  const session = await auth()
  if (!session?.user || session.user.role !== 'ADMIN') {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  const configured = !!process.env.OPENSIGN_API_KEY && !!process.env.OPENSIGN_SERVER_URL
  const healthy = configured ? await isOpenSignHealthy() : false

  // Get statistics
  const [totalDocs, pendingDocs, signedDocs, failedDocs] = await Promise.all([
    prisma.openSignDocument.count(),
    prisma.openSignDocument.count({ where: { status: 'PENDING' } }),
    prisma.openSignDocument.count({ where: { status: 'SIGNED' } }),
    prisma.openSignDocument.count({ where: { status: { in: ['DECLINED', 'EXPIRED'] } } }),
  ])

  return NextResponse.json({
    configured,
    healthy,
    serverUrl: process.env.OPENSIGN_SERVER_URL || 'not set',
    statistics: {
      total: totalDocs,
      pending: pendingDocs,
      signed: signedDocs,
      failed: failedDocs,
    },
  })
}
```

### Response

```json
{
  "configured": true,
  "healthy": true,
  "serverUrl": "https://opensign.example.com",
  "statistics": {
    "total": 150,
    "pending": 5,
    "signed": 140,
    "failed": 5
  }
}
```

---

## Testing Health Endpoints

### Local Development

```bash
# Liveness
curl http://localhost:3000/api/health | jq

# Readiness
curl http://localhost:3000/api/health/ready | jq
```

### Kubernetes

```bash
# Check if probes are passing
kubectl describe pod hta-web-xxx -n hta-calibration | grep -A 5 "Liveness\|Readiness"

# Manual check from inside cluster
kubectl exec -it hta-web-xxx -n hta-calibration -- \
  curl -s localhost:3000/api/health | jq

kubectl exec -it hta-web-xxx -n hta-calibration -- \
  curl -s localhost:3000/api/health/ready | jq
```

### Unit Tests

```typescript
// src/app/api/__tests__/health.test.ts
describe('GET /api/health', () => {
  it('should return healthy status', async () => {
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('healthy')
    expect(data.timestamp).toBeDefined()
    expect(typeof data.uptime).toBe('number')
  })

  it('should include version information', async () => {
    const response = await GET()
    const data = await response.json()

    expect(data.version).toBeDefined()
    expect(typeof data.version).toBe('string')
  })
})
```

---

## Probe Timing Deep Dive

```
┌─────────────────────────────────────────────────────────────────┐
│                    PROBE TIMING DIAGRAM                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Pod Start                                                       │
│  │                                                               │
│  ├─ t=0s ──────────────────────────────────────────────────────│
│  │   Container starts                                            │
│  │                                                               │
│  ├─ t=5s ──────────────────────────────────────────────────────│
│  │   Readiness probe starts (initialDelaySeconds: 5)            │
│  │   ❌ Fails (app still starting)                              │
│  │                                                               │
│  ├─ t=10s ─────────────────────────────────────────────────────│
│  │   Readiness probe check #2                                   │
│  │   ❌ Fails (DB connection initializing)                      │
│  │                                                               │
│  ├─ t=15s ─────────────────────────────────────────────────────│
│  │   Readiness probe check #3                                   │
│  │   ✅ Passes! Pod added to Service endpoints                  │
│  │   Traffic starts flowing to pod                              │
│  │                                                               │
│  ├─ t=30s ─────────────────────────────────────────────────────│
│  │   Liveness probe starts (initialDelaySeconds: 30)            │
│  │   ✅ Passes                                                  │
│  │                                                               │
│  ├─ t=40s ─────────────────────────────────────────────────────│
│  │   Liveness probe check #2                                    │
│  │   ✅ Passes                                                  │
│  │                                                               │
│  │   ... pod running normally ...                               │
│  │                                                               │
│  ├─ t=1000s ───────────────────────────────────────────────────│
│  │   Database connection lost                                    │
│  │                                                               │
│  ├─ t=1005s ───────────────────────────────────────────────────│
│  │   Readiness probe fails (can't reach DB)                     │
│  │                                                               │
│  ├─ t=1010s ───────────────────────────────────────────────────│
│  │   Readiness probe fails again                                │
│  │                                                               │
│  ├─ t=1015s ───────────────────────────────────────────────────│
│  │   Readiness probe fails 3x                                   │
│  │   ❌ Pod removed from Service endpoints                      │
│  │   No new traffic flows to pod                                │
│  │                                                               │
│  ├─ t=1030s ───────────────────────────────────────────────────│
│  │   Liveness probe passes (app still running)                  │
│  │   ✅ Pod NOT restarted (only readiness failed)              │
│  │                                                               │
│  ├─ t=1060s ───────────────────────────────────────────────────│
│  │   Database connection restored                                │
│  │   Readiness probe passes                                     │
│  │   ✅ Pod re-added to Service endpoints                       │
│  │   Traffic flows again                                        │
│  │                                                               │
└─────────────────────────────────────────────────────────────────┘
```

---

## Common Issues

### Pod Stuck in CrashLoopBackOff

**Symptoms:**
```
NAME          READY   STATUS             RESTARTS   AGE
hta-web-xxx   0/1     CrashLoopBackOff   5          10m
```

**Cause:** Liveness probe failing repeatedly

**Debug:**
```bash
# Check events
kubectl describe pod hta-web-xxx -n hta-calibration

# Check logs before crash
kubectl logs hta-web-xxx -n hta-calibration --previous

# Check if app can even start
kubectl exec -it hta-web-xxx -n hta-calibration -- curl localhost:3000/api/health
```

**Common Fixes:**
- Increase `initialDelaySeconds` if app needs more startup time
- Increase `timeoutSeconds` if health check is slow
- Check for missing environment variables
- Check for OOM kills

### Pod Not Receiving Traffic

**Symptoms:**
```
NAME          READY   STATUS    RESTARTS   AGE
hta-web-xxx   0/1     Running   0          5m
```

**Cause:** Readiness probe failing

**Debug:**
```bash
# Check readiness probe status
kubectl describe pod hta-web-xxx -n hta-calibration | grep -A 10 Readiness

# Check endpoints
kubectl get endpoints hta-web -n hta-calibration

# Test readiness endpoint
kubectl exec -it hta-web-xxx -n hta-calibration -- \
  curl -s localhost:3000/api/health/ready
```

**Common Fixes:**
- Check database connection
- Check network policies
- Verify DATABASE_URL secret is set correctly

### Health Check Timeout

**Symptoms:**
```
Warning  Unhealthy  1m (x3 over 2m)  kubelet  Liveness probe failed: Get "http://10.1.2.3:3000/api/health": context deadline exceeded
```

**Cause:** Health endpoint taking too long

**Debug:**
```bash
# Time the health check
kubectl exec -it hta-web-xxx -n hta-calibration -- \
  time curl -s localhost:3000/api/health/ready
```

**Common Fixes:**
- Increase `timeoutSeconds`
- Optimize health check (cache DB connection)
- Check for resource pressure
- Check database latency

---

## Best Practices

### 1. Keep Liveness Simple

```typescript
// Good: Just check if app can respond
export async function GET() {
  return NextResponse.json({ status: 'healthy' })
}

// Bad: Too many checks in liveness
export async function GET() {
  await prisma.$queryRaw`SELECT 1`      // DB could be temporarily down
  await redis.ping()                      // Redis could be temporary down
  await checkExternalAPI()                // External service issues
  return NextResponse.json({ status: 'healthy' })
}
```

### 2. Make Readiness Comprehensive

```typescript
// Good: Check all dependencies
export async function GET() {
  const checks = {}

  try {
    await prisma.$queryRaw`SELECT 1`
    checks.database = 'connected'
  } catch {
    checks.database = 'disconnected'
  }

  // Add more checks as needed
  // try {
  //   await redis.ping()
  //   checks.redis = 'connected'
  // } catch {
  //   checks.redis = 'disconnected'
  // }

  const isReady = Object.values(checks).every(v => v !== 'disconnected')
  return NextResponse.json(
    { status: isReady ? 'ready' : 'not_ready', checks },
    { status: isReady ? 200 : 503 }
  )
}
```

### 3. Set Appropriate Timeouts

| Environment | initialDelaySeconds | timeoutSeconds |
|-------------|---------------------|----------------|
| Development | 5 | 10 |
| Staging | 15 | 5 |
| Production | 30 | 5 |

### 4. Monitor Probe Metrics

Look for these patterns in GKE monitoring:
- Frequent liveness restarts → App instability
- Frequent readiness failures → Dependency issues
- Timeout failures → Performance problems
