# Database Environments

## Environment Matrix

| Aspect | Local | Dev (GKE) | Staging (GKE) | Production (GKE) |
|--------|-------|-----------|---------------|------------------|
| **Database** | PostgreSQL 16 | Cloud SQL | Cloud SQL | Cloud SQL |
| **Instance** | Docker container | `hta-db-dev` | `hta-db-staging` | `hta-db-prod` |
| **Tier** | N/A | db-f1-micro | db-g1-small | db-custom-2-4096 |
| **Connections** | Unlimited | 25 | 50 | 100 |
| **Backups** | Manual | Daily | Daily | Continuous |
| **Access** | localhost:5432 | Cloud SQL Proxy | Cloud SQL Proxy | Cloud SQL Proxy |
| **Data** | Seed data | Test data | Prod copy (sanitized) | Real data |

---

## Local Development

### Setup

```bash
# 1. Start PostgreSQL via Docker
npm run db:start

# 2. Generate Prisma client and push schema
npm run db:setup

# 3. Seed with test data
npm run db:seed

# 4. Start app
npm run dev
```

### Database Location

PostgreSQL runs in a Docker container defined in `docker-compose.dev.yml`:

```yaml
services:
  postgres:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: hta_user
      POSTGRES_PASSWORD: hta_dev_password
      POSTGRES_DB: hta_calibration
    ports:
      - "5432:5432"
    volumes:
      - postgres_data:/var/lib/postgresql/data
```

### Environment Variables

```bash
# .env.local (create this file)
DATABASE_URL="postgresql://hta_user:hta_dev_password@localhost:5432/hta_calibration"
```

### Viewing Data

```bash
# Option 1: Prisma Studio (recommended)
npx prisma studio
# Opens browser at http://localhost:5555

# Option 2: psql CLI
psql "postgresql://hta_user:hta_dev_password@localhost:5432/hta_calibration"

# Option 3: DBeaver or other GUI client
```

### Reset Database

```bash
# Stop, delete volume, and recreate
npm run db:reset

# Then setup and seed again
npm run db:setup
npm run db:seed
```

### PostgreSQL Features Used

| Feature | Usage |
|---------|-------|
| Native JSON | Storing event data, bins, complex objects |
| Concurrent writes | Full MVCC support |
| Connection pooling | Managed by Prisma |
| Transactions | Event sourcing, atomic operations |

---

## Development Environment (GKE)

### Architecture

```
┌──────────────────────────────────────────────────────────────┐
│                        GKE Cluster                            │
│  ┌─────────────────┐                                         │
│  │   hta-web pod   │                                         │
│  │                 │──── Private IP ────┐                    │
│  │  DATABASE_URL   │                    │                    │
│  └─────────────────┘                    │                    │
│                                         ▼                    │
│                              ┌─────────────────────┐         │
│                              │   Cloud SQL Proxy   │         │
│                              │   (sidecar or       │         │
│                              │    private IP)      │         │
│                              └──────────┬──────────┘         │
└─────────────────────────────────────────┼────────────────────┘
                                          │
                                          ▼
                              ┌─────────────────────┐
                              │    Cloud SQL        │
                              │    hta-db-dev       │
                              │    PostgreSQL 15    │
                              └─────────────────────┘
```

### Connecting from Local Machine

```bash
# 1. Start Cloud SQL Proxy
cloud-sql-proxy hta-calibration-prod:asia-south1:hta-db-dev

# 2. In another terminal, set DATABASE_URL
export DATABASE_URL="postgresql://hta_app:PASSWORD@127.0.0.1:5432/hta_calibration"

# 3. Now you can use any tool:

# Prisma Studio
npx prisma studio

# psql
psql $DATABASE_URL

# Run app against dev database
npm run dev

# Run migrations
npx prisma migrate deploy

# Run seed
npx prisma db seed
```

### Getting the Password

```bash
# From Secret Manager
gcloud secrets versions access latest --secret="hta-db-password-dev"

# Or from Kubernetes secret
kubectl get secret hta-secrets -n hta-calibration -o jsonpath='{.data.database-url}' | base64 -d
```

### Kubernetes Configuration

```yaml
# k8s/base/deployment.yaml
env:
  - name: DATABASE_URL
    valueFrom:
      secretKeyRef:
        name: hta-secrets
        key: database-url  # postgresql://hta_app:xxx@10.x.x.x:5432/hta_calibration
```

### Checking Connection from Pod

```bash
# Exec into pod
kubectl exec -it deployment/hta-web -n hta-calibration -- sh

# Check environment variable (password will be visible!)
echo $DATABASE_URL

# Test TCP connection
nc -zv 10.x.x.x 5432

# Test with psql (if available)
psql $DATABASE_URL -c "SELECT 1"
```

### Dev Database Operations

```bash
# View current schema
kubectl exec deployment/hta-web -n hta-calibration -- \
  npx prisma db execute --stdin <<< "\dt"

# Run migration
DATABASE_URL="..." npx prisma migrate deploy

# Dangerous: Reset dev database
DATABASE_URL="..." npx prisma db push --force-reset
DATABASE_URL="..." npx prisma db seed
```

---

## Staging Environment

### Purpose

- **Mirror of production** with sanitized data
- Test deployments before production
- Performance testing
- Integration testing

### Data Strategy

```bash
# 1. Export from production (sanitize sensitive data)
pg_dump $PROD_DATABASE_URL \
  --exclude-table-data='Signature' \
  --exclude-table-data='ApprovalToken' \
  > prod_export.sql

# 2. Sanitize passwords and emails
sed -i 's/@.*\.com/@example.com/g' prod_export.sql
# More sophisticated sanitization needed for production

# 3. Import to staging
psql $STAGING_DATABASE_URL < prod_export.sql
```

### Staging-Specific Configuration

```yaml
# k8s/overlays/staging/configmap-patch.yaml
data:
  DATABASE_URL: "postgresql://hta_app:xxx@staging-db-ip:5432/hta_calibration"
```

### Connecting to Staging

```bash
# Same process as dev, different instance
cloud-sql-proxy hta-calibration-prod:asia-south1:hta-db-staging

export DATABASE_URL="postgresql://hta_app:STAGING_PASS@127.0.0.1:5432/hta_calibration"
```

---

## Production Environment

### Access Controls

```
┌─────────────────────────────────────────────────────────────────┐
│                    PRODUCTION DATABASE ACCESS                    │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  WHO CAN ACCESS:                                                │
│  ├── Application pods (via Workload Identity)                  │
│  ├── Cloud SQL Proxy (authenticated developers)                │
│  └── GCP Console (project admins only)                         │
│                                                                  │
│  WHO CANNOT ACCESS:                                             │
│  ├── Public internet (private IP only)                         │
│  ├── Other GCP projects                                        │
│  └── Developers without IAM permissions                        │
│                                                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  OPERATIONS REQUIRING APPROVAL:                                 │
│  ├── Schema migrations (PR review required)                    │
│  ├── Data deletion (audit logged)                              │
│  ├── Direct SQL queries (use read replica)                     │
│  └── Backup restoration (incident response)                    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Connecting to Production

```bash
# 1. Verify you have permission
gcloud projects get-iam-policy hta-calibration-prod \
  --flatten="bindings[].members" \
  --filter="bindings.members:user:YOUR_EMAIL"

# 2. Start Cloud SQL Proxy
cloud-sql-proxy hta-calibration-prod:asia-south1:hta-db-prod

# 3. Connect READ-ONLY by default
export DATABASE_URL="postgresql://hta_app_readonly:PASSWORD@127.0.0.1:5432/hta_calibration"

# 4. Use Prisma Studio in read-only mode
npx prisma studio
# WARNING: Don't modify production data without approval!
```

### Production Safety Rules

```
╔═══════════════════════════════════════════════════════════════════╗
║                    PRODUCTION DATABASE RULES                       ║
╠═══════════════════════════════════════════════════════════════════╣
║                                                                    ║
║  1. NEVER run prisma db push --force-reset                        ║
║     This DELETES ALL DATA                                          ║
║                                                                    ║
║  2. ALWAYS use prisma migrate deploy for schema changes           ║
║     This applies migrations safely                                 ║
║                                                                    ║
║  3. ALWAYS backup before migrations                               ║
║     gcloud sql backups create --instance=hta-db-prod              ║
║                                                                    ║
║  4. NEVER delete data without WHERE clause                        ║
║     DELETE FROM User;  ← DANGEROUS                                ║
║     DELETE FROM User WHERE id = 'xxx';  ← OK                      ║
║                                                                    ║
║  5. TEST migrations on staging first                              ║
║     Never deploy untested migrations to production                ║
║                                                                    ║
║  6. USE transactions for multi-step operations                    ║
║     await prisma.$transaction([...])                              ║
║                                                                    ║
╚═══════════════════════════════════════════════════════════════════╝
```

### Production Migration Workflow

```bash
# 1. Create migration locally
npx prisma migrate dev --name add_new_field

# 2. Test on local PostgreSQL
npm run dev
# Verify application works

# 3. Test on dev Cloud SQL
DATABASE_URL="dev-url" npx prisma migrate deploy
# Verify application works

# 4. Test on staging
DATABASE_URL="staging-url" npx prisma migrate deploy
# Full QA testing

# 5. Deploy to production (during maintenance window)
# Create backup first!
gcloud sql backups create --instance=hta-db-prod --description="Pre-migration backup"

DATABASE_URL="prod-url" npx prisma migrate deploy

# 6. Verify
kubectl logs deployment/hta-web -n hta-calibration | grep -i error
```

### Rollback Procedure

```bash
# If migration fails:

# 1. Check migration status
DATABASE_URL="prod-url" npx prisma migrate status

# 2. If application is broken, rollback deployment
kubectl rollout undo deployment/hta-web -n hta-calibration

# 3. For data issues, restore from backup
gcloud sql backups list --instance=hta-db-prod
gcloud sql backups restore BACKUP_ID --restore-instance=hta-db-prod

# 4. For schema rollback, create reverse migration
# There's no automatic rollback in Prisma
# You must manually create a migration that undoes the changes
```

---

## Environment Comparison Checklist

### Before Deploying to Dev

- [ ] Schema pushed to local PostgreSQL works
- [ ] Seed runs without errors
- [ ] All tests pass locally
- [ ] No hardcoded connection strings

### Before Deploying to Staging

- [ ] Migration tested on dev
- [ ] No breaking schema changes (or migration plan ready)
- [ ] Feature flags for new functionality
- [ ] Load testing if adding indexes

### Before Deploying to Production

- [ ] Tested on staging for 24+ hours
- [ ] Backup created
- [ ] Rollback plan documented
- [ ] Maintenance window scheduled (if needed)
- [ ] Monitoring alerts configured
- [ ] Team notified

---

## Quick Reference Commands

```bash
# ═══════════════════════════════════════════════════════════════
# LOCAL (Docker PostgreSQL)
# ═══════════════════════════════════════════════════════════════
npm run db:start                      # Start PostgreSQL
npm run db:setup                      # Generate + push schema
npm run db:seed                       # Seed data
npm run db:stop                       # Stop PostgreSQL
npm run db:reset                      # Delete and recreate
npx prisma studio                     # GUI

# ═══════════════════════════════════════════════════════════════
# DEV (via Cloud SQL Proxy)
# ═══════════════════════════════════════════════════════════════
cloud-sql-proxy PROJECT:REGION:hta-db-dev &
export DATABASE_URL="postgresql://..."
npx prisma migrate deploy             # Apply migrations
npx prisma db seed                    # Seed (careful!)
npx prisma studio                     # GUI
psql $DATABASE_URL                    # CLI

# ═══════════════════════════════════════════════════════════════
# PRODUCTION (via Cloud SQL Proxy)
# ═══════════════════════════════════════════════════════════════
cloud-sql-proxy PROJECT:REGION:hta-db-prod &
export DATABASE_URL="postgresql://..."
gcloud sql backups create --instance=hta-db-prod  # BACKUP FIRST
npx prisma migrate deploy             # Apply migrations
# NO SEEDING IN PROD
# NO db push IN PROD
psql $DATABASE_URL -c "SELECT 1"      # Verify connection
```
