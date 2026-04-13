# Prisma Accelerate Setup Guide

**Purpose:** Connection pooling, query caching, and edge optimization for Cloud Run

---

## Overview

Prisma Accelerate provides:
- **Connection Pooling**: Reduces Cloud SQL connection overhead
- **Query Caching**: Caches frequently accessed data at the edge
- **Global Edge Network**: Reduces latency for distributed users

## When to Use

| Scenario | Recommendation |
|----------|----------------|
| Local development | Direct connection (default) |
| Cloud Run with < 10 instances | Direct connection |
| Cloud Run with > 10 instances | Prisma Accelerate |
| High read traffic | Prisma Accelerate (caching) |
| Global users | Prisma Accelerate (edge) |

---

## Setup Steps

### 1. Create Prisma Data Platform Account

1. Go to [cloud.prisma.io](https://cloud.prisma.io)
2. Sign up / Log in
3. Create a new project

### 2. Enable Accelerate

1. In your project, go to **Accelerate**
2. Click **Enable Accelerate**
3. Enter your database connection string:
   ```
   postgresql://user:password@host:5432/database
   ```
4. Select the region closest to your Cloud SQL instance
5. Click **Enable**

### 3. Get Connection String

After enabling, you'll get a Prisma Accelerate connection string:
```
prisma://accelerate.prisma-data.net/?api_key=your_api_key_here
```

### 4. Configure Environment Variables

**Cloud Run (Production):**
```bash
# Set Prisma Accelerate URL for runtime queries
gcloud run services update hta-calibration \
  --set-env-vars DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY"

# Set direct URL for migrations (Cloud SQL connection)
gcloud run services update hta-calibration \
  --set-env-vars DIRECT_URL="postgresql://user:pass@/dbname?host=/cloudsql/project:region:instance"
```

**Local Development (.env):**
```bash
# Option 1: Use Accelerate locally too
DATABASE_URL="prisma://accelerate.prisma-data.net/?api_key=YOUR_KEY"
DIRECT_URL="postgresql://hta_user:hta_dev_password@127.0.0.1:5432/hta_calibration"

# Option 2: Direct connection (default, no changes needed)
DATABASE_URL="postgresql://hta_user:hta_dev_password@127.0.0.1:5432/hta_calibration"
```

### 5. Regenerate Prisma Client

```bash
npx prisma generate
```

### 6. Run Migrations

Migrations always use the direct connection (DIRECT_URL):
```bash
npx prisma migrate deploy
```

---

## Configuration Options

### Query Caching

Add caching hints to queries for frequently accessed data:

```typescript
// Cache for 60 seconds
const certificates = await prisma.certificate.findMany({
  where: { status: 'AUTHORIZED' },
  cacheStrategy: {
    ttl: 60,      // Cache for 60 seconds
    swr: 120,     // Serve stale for 120 seconds while revalidating
  },
})

// Cache with tags for invalidation
const customer = await prisma.customerUser.findUnique({
  where: { id: customerId },
  cacheStrategy: {
    ttl: 300,
    tags: [`customer:${customerId}`],
  },
})

// Invalidate cache by tag
await prisma.$accelerate.invalidate({
  tags: [`customer:${customerId}`],
})
```

### Connection Pool Settings

When using direct connection (non-Accelerate), the pool is configured in `src/lib/prisma.ts`:

```typescript
const pool = new Pool({
  connectionString,
  max: 10,                    // Maximum connections
  idleTimeoutMillis: 30000,   // Close idle after 30s
  connectionTimeoutMillis: 10000,
})
```

For Accelerate, pooling is handled automatically.

---

## Monitoring

### Prisma Data Platform Dashboard

- Query performance metrics
- Cache hit rates
- Connection pool utilization
- Error rates

### Cloud Run Metrics

Monitor these to determine if Accelerate is needed:
- Database connection count
- Query latency (p95)
- Cloud SQL CPU usage

---

## Troubleshooting

### "Too many connections" Error

**Without Accelerate:** Reduce `max` in pool settings or enable Accelerate.

**With Accelerate:** Check Prisma dashboard for connection limits.

### Slow Queries

1. Check if query is cached (Prisma dashboard)
2. Add `cacheStrategy` for frequently accessed data
3. Review query with `EXPLAIN ANALYZE`

### Migration Failures

Ensure `DIRECT_URL` is set to the actual PostgreSQL connection string, not the Accelerate URL.

```bash
# Verify DIRECT_URL
echo $DIRECT_URL
# Should be: postgresql://... not prisma://...
```

---

## Cost Considerations

Prisma Accelerate is a paid service:
- Free tier: 100K queries/month
- Pro tier: Pay per query after free tier

For most small-medium applications, the free tier is sufficient.

---

## Rollback to Direct Connection

If needed, revert to direct connection:

1. Set `DATABASE_URL` to PostgreSQL connection string
2. Remove `DIRECT_URL` (optional)
3. Redeploy

```bash
gcloud run services update hta-calibration \
  --set-env-vars DATABASE_URL="postgresql://..."
```

No code changes required - the client detects the connection type automatically.
