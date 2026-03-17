# Phase 3D: Database Setup & Migration

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Last Updated**: 2026-03-17
- **Phase**: 3 - Cloud Infrastructure
- **Status**: Not Started (0%)

---

## Learning Resources

Before setting up the production database, make sure you understand the underlying concepts:

| Topic | System Design Document | What You'll Learn |
|-------|------------------------|-------------------|
| **Database Architecture** | [05_database_architecture.md](../../system_design/05_database_architecture.md) | PostgreSQL, schema design, indexes, Prisma ORM |
| **Multi-Tenancy** | [04_multi_tenancy.md](../../system_design/04_multi_tenancy.md) | Tenant isolation, Row-Level Security |
| **GCP Fundamentals** | [06_gcp_fundamentals.md](../../system_design/06_gcp_fundamentals.md) | Cloud SQL service overview |
| **Secrets Management** | [13_secrets_management.md](../../system_design/13_secrets_management.md) | Database credential management |
| **Disaster Recovery** | [16_disaster_recovery.md](../../system_design/16_disaster_recovery.md) | Backup strategies, failover |

> **Tip**: If terms like "PITR", "connection pooling", "RLS", or "read replica" are unfamiliar, read `05_database_architecture.md` first!

---

## Overview

This document covers the implementation of Cloud SQL (PostgreSQL) setup, migration from development database, connection configuration, and ongoing database management for the HTA Calibration system.

---

## Cloud SQL Architecture

```
+---------------------------------------------------------------------------+
|                         DATABASE ARCHITECTURE                               |
+---------------------------------------------------------------------------+
|                                                                             |
|                          Google Cloud Platform                              |
|  +-----------------------------------------------------------------------+  |
|  |                                                                       |  |
|  |  PRIMARY REGION (asia-southeast1)                                     |  |
|  |  +----------------------------------------------------------------+  |  |
|  |  |                                                                |  |  |
|  |  |  +------------------------+    +------------------------+      |  |  |
|  |  |  |  Cloud SQL Primary     |    |  Cloud SQL Replica     |      |  |  |
|  |  |  |  (Read/Write)          |    |  (Read Only - HA)      |      |  |  |
|  |  |  |                        |    |                        |      |  |  |
|  |  |  |  - PostgreSQL 15       |    |  - Synchronous         |      |  |  |
|  |  |  |  - db-custom-2-4096    |    |  - Same zone           |      |  |  |
|  |  |  |  - 50GB SSD            |    |  - Auto-failover       |      |  |  |
|  |  |  |  - Private IP          |<-->|                        |      |  |  |
|  |  |  +------------------------+    +------------------------+      |  |  |
|  |  |              ^                                                  |  |  |
|  |  |              |                                                  |  |  |
|  |  |              | Private Service Connection                       |  |  |
|  |  |              |                                                  |  |  |
|  |  |  +-----------+--------------------------------------------+    |  |  |
|  |  |  |                    GKE Cluster                         |    |  |  |
|  |  |  |  +------------------+  +------------------+             |    |  |  |
|  |  |  |  | App Pod 1        |  | App Pod 2        |             |    |  |  |
|  |  |  |  | (Prisma Client)  |  | (Prisma Client)  |             |    |  |  |
|  |  |  |  +------------------+  +------------------+             |    |  |  |
|  |  |  +---------------------------------------------------------+    |  |  |
|  |  |                                                                |  |  |
|  |  +----------------------------------------------------------------+  |  |
|  |                                                                       |  |
|  |  DR REGION (asia-east1) - Optional                                    |  |
|  |  +----------------------------------------------------------------+  |  |
|  |  |  +------------------------+                                    |  |  |
|  |  |  |  Cloud SQL Replica     |  Cross-region async replication    |  |  |
|  |  |  |  (DR Standby)          |  RPO: ~1 minute                    |  |  |
|  |  |  +------------------------+                                    |  |  |
|  |  +----------------------------------------------------------------+  |  |
|  |                                                                       |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
+---------------------------------------------------------------------------+
```

---

## Cloud SQL Instance Configuration

### Terraform Configuration

```hcl
# terraform/modules/cloudsql/main.tf

resource "google_sql_database_instance" "primary" {
  name             = "hta-calibration-${var.environment}"
  database_version = "POSTGRES_15"
  region           = var.region
  project          = var.project_id

  settings {
    tier              = var.tier  # db-custom-2-4096 for prod
    availability_type = var.availability_type  # REGIONAL for HA
    disk_size         = var.disk_size
    disk_type         = "PD_SSD"
    disk_autoresize   = true
    disk_autoresize_limit = var.disk_autoresize_limit

    # Backup configuration
    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"  # UTC
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7

      backup_retention_settings {
        retained_backups = 30
        retention_unit   = "COUNT"
      }
    }

    # Maintenance window
    maintenance_window {
      day          = 7  # Sunday
      hour         = 3  # 3 AM UTC
      update_track = "stable"
    }

    # IP configuration - Private only
    ip_configuration {
      ipv4_enabled    = false
      private_network = var.vpc_id
      require_ssl     = true

      authorized_networks {
        # No public access
      }
    }

    # Database flags
    database_flags {
      name  = "log_checkpoints"
      value = "on"
    }
    database_flags {
      name  = "log_connections"
      value = "on"
    }
    database_flags {
      name  = "log_disconnections"
      value = "on"
    }
    database_flags {
      name  = "log_lock_waits"
      value = "on"
    }
    database_flags {
      name  = "log_temp_files"
      value = "0"
    }
    database_flags {
      name  = "max_connections"
      value = "100"
    }

    # Insights
    insights_config {
      query_insights_enabled  = true
      query_string_length     = 4500
      record_application_tags = true
      record_client_address   = true
    }

    user_labels = {
      project     = "hta-calibration"
      environment = var.environment
      managed-by  = "terraform"
    }
  }

  deletion_protection = var.environment == "prod" ? true : false

  depends_on = [google_service_networking_connection.private_vpc_connection]
}

# Database
resource "google_sql_database" "main" {
  name     = "hta_calibration"
  instance = google_sql_database_instance.primary.name
  project  = var.project_id
}

# Database user
resource "google_sql_user" "app" {
  name     = "hta_app"
  instance = google_sql_database_instance.primary.name
  project  = var.project_id
  password = random_password.db_password.result
}

resource "random_password" "db_password" {
  length  = 32
  special = true
}

# Store password in Secret Manager
resource "google_secret_manager_secret" "db_password" {
  secret_id = "hta-db-password-${var.environment}"
  project   = var.project_id

  replication {
    auto {}
  }
}

resource "google_secret_manager_secret_version" "db_password" {
  secret      = google_secret_manager_secret.db_password.id
  secret_data = random_password.db_password.result
}
```

### Instance Sizing by Environment

```
+---------------------------------------------------------------------------+
|                         INSTANCE SIZING                                     |
+---------------------------------------------------------------------------+
|                                                                             |
|  Environment   Tier               vCPU  RAM    Disk   HA      Est. Cost    |
|  -------------------------------------------------------------------------- |
|  Development   db-f1-micro        1     0.6GB  10GB   No      $10/mo       |
|  Staging       db-custom-1-3840   1     3.75GB 20GB   No      $50/mo       |
|  Production    db-custom-2-4096   2     4GB    50GB   Yes     $200/mo      |
|                                                                             |
|  SCALING TRIGGERS (Production):                                             |
|  - CPU > 80% sustained: Consider upgrading tier                             |
|  - Disk > 80%: Auto-resize kicks in                                         |
|  - Connections > 80: Consider connection pooling                            |
|                                                                             |
+---------------------------------------------------------------------------+
```

---

## Connection Configuration

### Connection String Format

```
+---------------------------------------------------------------------------+
|                         CONNECTION CONFIGURATION                            |
+---------------------------------------------------------------------------+
|                                                                             |
|  DATABASE_URL FORMAT:                                                       |
|  postgresql://USER:PASSWORD@HOST:PORT/DATABASE?schema=public&sslmode=require|
|                                                                             |
|  PRODUCTION EXAMPLE:                                                        |
|  postgresql://hta_app:xxx@10.0.2.5:5432/hta_calibration?schema=public&     |
|  sslmode=require&connection_limit=10                                        |
|                                                                             |
|  CONNECTION PARAMETERS:                                                     |
|  - sslmode=require         Enforce SSL connection                           |
|  - connection_limit=10     Prisma connection pool size per instance         |
|  - pool_timeout=10         Wait time for connection from pool               |
|  - connect_timeout=10      Initial connection timeout                       |
|                                                                             |
+---------------------------------------------------------------------------+
```

### Kubernetes Secret for Database URL

```yaml
# k8s/base/secrets/database-secret.yaml
apiVersion: v1
kind: Secret
metadata:
  name: database-credentials
  namespace: hta-production
type: Opaque
stringData:
  DATABASE_URL: "" # Populated from Secret Manager via External Secrets Operator

---
# Using External Secrets Operator
apiVersion: external-secrets.io/v1beta1
kind: ExternalSecret
metadata:
  name: database-credentials
  namespace: hta-production
spec:
  refreshInterval: 1h
  secretStoreRef:
    kind: ClusterSecretStore
    name: gcp-secret-store
  target:
    name: database-credentials
    creationPolicy: Owner
  data:
    - secretKey: DATABASE_URL
      remoteRef:
        key: hta-database-url-prod
```

### Cloud SQL Auth Proxy (Alternative)

```yaml
# k8s/base/deployments/app-deployment.yaml
# Sidecar pattern for Cloud SQL Auth Proxy
spec:
  containers:
    - name: hta-web
      # ... main container
      env:
        - name: DATABASE_URL
          value: "postgresql://hta_app:xxx@localhost:5432/hta_calibration"

    - name: cloud-sql-proxy
      image: gcr.io/cloud-sql-connectors/cloud-sql-proxy:2.8.0
      args:
        - "--structured-logs"
        - "--port=5432"
        - "PROJECT_ID:REGION:INSTANCE_NAME"
      securityContext:
        runAsNonRoot: true
      resources:
        requests:
          memory: "256Mi"
          cpu: "100m"
        limits:
          memory: "512Mi"
          cpu: "500m"
```

---

## Database Migration Strategy

### Migration from Development to Production

```
+---------------------------------------------------------------------------+
|                         MIGRATION STRATEGY                                  |
+---------------------------------------------------------------------------+
|                                                                             |
|  PHASE 1: SCHEMA MIGRATION                                                  |
|  =========================                                                  |
|                                                                             |
|  1. Ensure Prisma schema is up to date                                      |
|     $ npx prisma migrate status                                             |
|                                                                             |
|  2. Generate migration files if needed                                      |
|     $ npx prisma migrate dev --name descriptive_name                        |
|                                                                             |
|  3. Review generated SQL in prisma/migrations/                              |
|                                                                             |
|  4. Apply migrations to production                                          |
|     $ DATABASE_URL="..." npx prisma migrate deploy                          |
|                                                                             |
|  PHASE 2: DATA MIGRATION (If applicable)                                    |
|  ========================================                                   |
|                                                                             |
|  Option A: Fresh Start (Recommended for new deployments)                    |
|  - Run seed script: npx prisma db seed                                      |
|  - Creates initial admin user, reference data                               |
|                                                                             |
|  Option B: Data Transfer (For existing data)                                |
|  - Export from source: pg_dump -Fc source_db > backup.dump                  |
|  - Import to target: pg_restore -d target_db backup.dump                    |
|  - Verify data integrity                                                    |
|                                                                             |
+---------------------------------------------------------------------------+
```

### CI/CD Migration Workflow

```yaml
# .github/workflows/migrate.yml
name: Database Migration

on:
  workflow_dispatch:
    inputs:
      environment:
        description: 'Target environment'
        required: true
        type: choice
        options:
          - staging
          - production

jobs:
  migrate:
    runs-on: ubuntu-latest
    environment: ${{ inputs.environment }}

    steps:
      - uses: actions/checkout@v4

      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version: '20'
          cache: 'npm'

      - name: Install dependencies
        run: npm ci

      - name: Authenticate to GCP
        uses: google-github-actions/auth@v2
        with:
          credentials_json: ${{ secrets.GCP_SA_KEY }}

      - name: Get database URL from Secret Manager
        id: secrets
        run: |
          DATABASE_URL=$(gcloud secrets versions access latest \
            --secret="hta-database-url-${{ inputs.environment }}")
          echo "::add-mask::$DATABASE_URL"
          echo "DATABASE_URL=$DATABASE_URL" >> $GITHUB_ENV

      - name: Run Prisma migrations
        run: npx prisma migrate deploy

      - name: Verify migration
        run: npx prisma migrate status
```

---

## Backup & Recovery

### Automated Backup Configuration

```
+---------------------------------------------------------------------------+
|                         BACKUP STRATEGY                                     |
+---------------------------------------------------------------------------+
|                                                                             |
|  AUTOMATED BACKUPS (Cloud SQL Built-in)                                     |
|  ======================================                                     |
|                                                                             |
|  Schedule:     Daily at 03:00 UTC                                           |
|  Retention:    30 days                                                      |
|  Type:         Full backup + transaction logs (PITR)                        |
|  Location:     Same region as instance                                      |
|                                                                             |
|  POINT-IN-TIME RECOVERY (PITR)                                              |
|  =============================                                              |
|                                                                             |
|  Window:       Last 7 days                                                  |
|  Granularity:  Any point in time (second-level)                             |
|  Use case:     Recover from accidental data deletion/corruption             |
|                                                                             |
|  CROSS-REGION BACKUP                                                        |
|  ===================                                                        |
|                                                                             |
|  Destination:  asia-east1 (Taiwan)                                          |
|  Frequency:    Daily (after primary backup)                                 |
|  Retention:    30 days                                                      |
|  Use case:     Regional disaster recovery                                   |
|                                                                             |
|  MANUAL EXPORTS (Additional Safety)                                         |
|  ==================================                                         |
|                                                                             |
|  Destination:  GCS bucket (hta-calibration-backups)                         |
|  Frequency:    Weekly                                                       |
|  Format:       SQL dump                                                     |
|  Retention:    90 days                                                      |
|                                                                             |
+---------------------------------------------------------------------------+
```

### Recovery Procedures

```
+---------------------------------------------------------------------------+
|                         RECOVERY PROCEDURES                                 |
+---------------------------------------------------------------------------+
|                                                                             |
|  SCENARIO 1: Accidental Data Deletion                                       |
|  =====================================                                      |
|                                                                             |
|  1. Identify the time just before deletion                                  |
|  2. Create a new instance from PITR                                         |
|     $ gcloud sql instances clone hta-calibration-prod \                     |
|         hta-calibration-recovery \                                          |
|         --point-in-time "2026-03-17T10:30:00Z"                              |
|  3. Extract needed data from recovery instance                              |
|  4. Import data back to production                                          |
|  5. Delete recovery instance                                                |
|                                                                             |
|  SCENARIO 2: Instance Failure (HA Configured)                               |
|  ============================================                               |
|                                                                             |
|  - Automatic failover to standby (~60 seconds)                              |
|  - No manual intervention required                                          |
|  - Monitor via Cloud Monitoring alerts                                      |
|                                                                             |
|  SCENARIO 3: Regional Outage                                                |
|  ===========================                                                |
|                                                                             |
|  1. Promote cross-region replica to primary                                 |
|     $ gcloud sql instances promote-replica hta-calibration-dr               |
|  2. Update DNS/application to point to new instance                         |
|  3. Scale up GKE in DR region                                               |
|  4. Verify application connectivity                                         |
|                                                                             |
|  SCENARIO 4: Complete Data Loss (Worst Case)                                |
|  ===========================================                                |
|                                                                             |
|  1. Create new Cloud SQL instance                                           |
|  2. Restore from GCS backup                                                 |
|     $ gcloud sql import sql hta-calibration-new \                           |
|         gs://hta-calibration-backups/weekly/backup.sql                      |
|  3. Apply any missing migrations                                            |
|  4. Update application configuration                                        |
|                                                                             |
+---------------------------------------------------------------------------+
```

---

## Multi-Tenant Database Configuration

### Row-Level Security Setup

```sql
-- Enable RLS on tenant-scoped tables
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;
ALTER TABLE users ENABLE ROW LEVEL SECURITY;

-- Create policy for tenant isolation
CREATE POLICY tenant_isolation_policy ON certificates
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_policy ON instruments
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

CREATE POLICY tenant_isolation_policy ON users
  USING (tenant_id = current_setting('app.current_tenant_id')::uuid);

-- Function to set tenant context
CREATE OR REPLACE FUNCTION set_tenant_context(tenant_uuid uuid)
RETURNS void AS $$
BEGIN
  PERFORM set_config('app.current_tenant_id', tenant_uuid::text, false);
END;
$$ LANGUAGE plpgsql;
```

### Prisma Middleware for Tenant Context

```typescript
// src/lib/prisma-tenant.ts
import { PrismaClient } from '@prisma/client'

export function createTenantPrismaClient(tenantId: string) {
  const prisma = new PrismaClient()

  prisma.$use(async (params, next) => {
    // Set tenant context before each query
    await prisma.$executeRaw`SELECT set_tenant_context(${tenantId}::uuid)`
    return next(params)
  })

  return prisma
}
```

---

## Performance Optimization

### Connection Pooling with PgBouncer

```
+---------------------------------------------------------------------------+
|                         CONNECTION POOLING                                  |
+---------------------------------------------------------------------------+
|                                                                             |
|  WHY CONNECTION POOLING?                                                    |
|  =======================                                                    |
|                                                                             |
|  - PostgreSQL connections are expensive (fork per connection)               |
|  - Cloud SQL has connection limits (based on instance size)                 |
|  - Serverless/containerized apps open many short-lived connections          |
|                                                                             |
|  SOLUTION: PgBouncer or Prisma Data Proxy                                   |
|                                                                             |
|  +-----------------------------------------------------------------------+  |
|  |                                                                       |  |
|  |  [App Pod 1] --+                                                      |  |
|  |  [App Pod 2] --+---> [PgBouncer] ---> [Cloud SQL]                     |  |
|  |  [App Pod 3] --+     (50 connections   (100 max                       |  |
|  |  [App Pod n] --+      pooled)           connections)                  |  |
|  |                                                                       |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
|  PgBouncer Configuration:                                                   |
|  - Pool mode: transaction                                                   |
|  - Default pool size: 20                                                    |
|  - Max client connections: 200                                              |
|  - Reserve pool size: 5                                                     |
|                                                                             |
+---------------------------------------------------------------------------+
```

### Query Performance Monitoring

```
+---------------------------------------------------------------------------+
|                         QUERY INSIGHTS                                      |
+---------------------------------------------------------------------------+
|                                                                             |
|  CLOUD SQL QUERY INSIGHTS (Built-in)                                        |
|  ===================================                                        |
|                                                                             |
|  - Automatically enabled in Terraform config                                |
|  - Shows top queries by execution time                                      |
|  - Identifies slow queries                                                  |
|  - Shows query execution plans                                              |
|                                                                             |
|  ACCESS:                                                                    |
|  GCP Console -> SQL -> Instance -> Query Insights                           |
|                                                                             |
|  ALERTS TO CONFIGURE:                                                       |
|  - Query latency > 1 second                                                 |
|  - Connection count > 80% of max                                            |
|  - CPU utilization > 80%                                                    |
|  - Disk utilization > 80%                                                   |
|                                                                             |
+---------------------------------------------------------------------------+
```

---

## Implementation Checklist

### Prerequisites
- [ ] VPC with private service connection configured
- [ ] Service account for database access
- [ ] Secret Manager API enabled
- [ ] Terraform state configured

### Phase 1: Instance Creation
- [ ] Create Cloud SQL instance via Terraform
- [ ] Configure backup settings
- [ ] Enable Query Insights
- [ ] Set database flags
- [ ] Create database and user

### Phase 2: Connectivity
- [ ] Verify private IP connectivity
- [ ] Configure SSL certificates
- [ ] Test connection from local machine (via Cloud SQL Proxy)
- [ ] Store DATABASE_URL in Secret Manager

### Phase 3: Migration
- [ ] Review Prisma migrations
- [ ] Deploy schema to production
- [ ] Run seed data (if fresh start)
- [ ] Verify data integrity

### Phase 4: Multi-Tenancy
- [ ] Enable Row-Level Security
- [ ] Create tenant policies
- [ ] Test tenant isolation
- [ ] Verify cross-tenant queries blocked

### Phase 5: Monitoring
- [ ] Configure Cloud Monitoring alerts
- [ ] Set up Query Insights dashboards
- [ ] Test backup/restore procedure
- [ ] Document recovery runbooks

---

## Related Documents

- [Overview](./00_scaleup_overview.md)
- [GCP Infrastructure](./04_gcp_infrastructure.md)
- [Terraform IaC](./05_terraform_iac.md)
- [Secrets Implementation](./08_secrets_implementation.md)
- [Multi-Tenancy Implementation](./12_multi_tenancy_implementation.md)
- [Disaster Recovery](./15_disaster_recovery.md)
