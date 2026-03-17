# Phase 4B: Disaster Recovery Implementation

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Last Updated**: 2026-03-17
- **Phase**: 4 - Resilience & Operations
- **Status**: Not Started (0%)

---

## Learning Resources

Before implementing disaster recovery, make sure you understand the underlying concepts:

| Topic | System Design Document | What You'll Learn |
|-------|------------------------|-------------------|
| **Disaster Recovery Concepts** | [16_disaster_recovery.md](../../system_design/16_disaster_recovery.md) | RTO/RPO, backup strategies, failover types |
| **GCP Infrastructure** | [06_gcp_fundamentals.md](../../system_design/06_gcp_fundamentals.md) | Multi-region architecture, managed services |
| **Database Architecture** | [05_database_architecture.md](../../system_design/05_database_architecture.md) | Database replication, PITR |
| **Monitoring** | [15_monitoring.md](../../system_design/15_monitoring.md) | Alerting, incident detection |

> **Tip**: If terms like "RTO", "RPO", "failover", or "PITR" are unfamiliar, read `16_disaster_recovery.md` first!

---

## Overview

This document covers the implementation of disaster recovery procedures, backup strategies, failover mechanisms, and business continuity planning for the HTA Calibration system.

---

## DR Architecture

```
+---------------------------------------------------------------------------+
|                         DISASTER RECOVERY ARCHITECTURE                      |
+---------------------------------------------------------------------------+
|                                                                             |
|  PRIMARY REGION (asia-southeast1 - Singapore)                               |
|  +-----------------------------------------------------------------------+  |
|  |                                                                       |  |
|  |  +-----------------+    +-----------------+    +-----------------+    |  |
|  |  |  GKE Cluster    |    |  Cloud SQL      |    |  Cloud Storage  |    |  |
|  |  |  (Active)       |    |  (Primary)      |    |  (Primary)      |    |  |
|  |  |                 |    |                 |    |                 |    |  |
|  |  |  2-5 nodes      |    |  Read/Write     |    |  All buckets    |    |  |
|  |  |  Full workload  |    |  HA enabled     |    |                 |    |  |
|  |  +-----------------+    +--------+--------+    +--------+--------+    |  |
|  |                                  |                      |             |  |
|  +----------------------------------|----------------------|-------------+  |
|                                     |                      |                |
|                                     | Async Replication    | Cross-region  |
|                                     | (< 1 min lag)        | Replication   |
|                                     |                      |                |
|  DR REGION (asia-east1 - Taiwan)    |                      |                |
|  +----------------------------------|----------------------|-------------+  |
|  |                                  v                      v             |  |
|  |  +-----------------+    +-----------------+    +-----------------+    |  |
|  |  |  GKE Cluster    |    |  Cloud SQL      |    |  Cloud Storage  |    |  |
|  |  |  (Standby)      |    |  (Replica)      |    |  (Replica)      |    |  |
|  |  |                 |    |                 |    |                 |    |  |
|  |  |  0-1 nodes      |    |  Read Only      |    |  Mirror of      |    |  |
|  |  |  Minimal cost   |    |  Promotable     |    |  primary        |    |  |
|  |  +-----------------+    +-----------------+    +-----------------+    |  |
|  |                                                                       |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
|  DR OBJECTIVES:                                                             |
|  - Recovery Time Objective (RTO): < 1 hour                                  |
|  - Recovery Point Objective (RPO): < 5 minutes                              |
|  - Failover Type: Semi-automated (manual trigger, automated execution)      |
|                                                                             |
+---------------------------------------------------------------------------+
```

---

## Backup Strategy

### Database Backups

```
+---------------------------------------------------------------------------+
|                         DATABASE BACKUP STRATEGY                            |
+---------------------------------------------------------------------------+
|                                                                             |
|  AUTOMATED BACKUPS (Cloud SQL Built-in)                                     |
|  ======================================                                     |
|                                                                             |
|  Type:            Incremental + Full daily                                  |
|  Schedule:        Daily at 03:00 UTC (11:00 SGT)                            |
|  Retention:       30 days                                                   |
|  Location:        Same region as instance                                   |
|                                                                             |
|  POINT-IN-TIME RECOVERY (PITR)                                              |
|  =============================                                              |
|                                                                             |
|  Enabled:         Yes                                                       |
|  Log Retention:   7 days                                                    |
|  Recovery Window: Any point in last 7 days                                  |
|                                                                             |
|  CROSS-REGION BACKUPS                                                       |
|  ====================                                                       |
|                                                                             |
|  Destination:     asia-east1 (Taiwan)                                       |
|  Frequency:       Daily (after primary backup)                              |
|  Retention:       30 days                                                   |
|                                                                             |
|  MANUAL EXPORTS (Additional Safety)                                         |
|  ==================================                                         |
|                                                                             |
|  Destination:     gs://hta-calibration-backups/database/                    |
|  Frequency:       Weekly (Sunday 00:00 UTC)                                 |
|  Format:          SQL dump (pg_dump)                                        |
|  Retention:       90 days                                                   |
|  Encryption:      CMEK                                                      |
|                                                                             |
+---------------------------------------------------------------------------+
```

### Terraform Backup Configuration

```hcl
# terraform/modules/cloudsql/backup.tf

resource "google_sql_database_instance" "primary" {
  # ... other configuration

  settings {
    backup_configuration {
      enabled                        = true
      start_time                     = "03:00"
      point_in_time_recovery_enabled = true
      transaction_log_retention_days = 7

      backup_retention_settings {
        retained_backups = 30
        retention_unit   = "COUNT"
      }
    }
  }
}

# Cross-region replica for DR
resource "google_sql_database_instance" "replica" {
  name                 = "${var.instance_name}-replica"
  master_instance_name = google_sql_database_instance.primary.name
  region               = var.dr_region
  database_version     = "POSTGRES_15"

  replica_configuration {
    failover_target = true
  }

  settings {
    tier              = var.tier
    availability_type = "ZONAL"  # Replica doesn't need HA

    ip_configuration {
      ipv4_enabled    = false
      private_network = var.dr_vpc_id
    }
  }
}
```

### File Storage Backups

```
+---------------------------------------------------------------------------+
|                         FILE STORAGE BACKUP                                 |
+---------------------------------------------------------------------------+
|                                                                             |
|  CLOUD STORAGE REPLICATION                                                  |
|  =========================                                                  |
|                                                                             |
|  Bucket: hta-calibration-files-prod                                         |
|  - Dual-region: asia (singapore + taiwan)                                   |
|  - Automatic replication                                                    |
|  - RPO: Near-zero (synchronous)                                             |
|                                                                             |
|  VERSIONING                                                                 |
|  ==========                                                                 |
|                                                                             |
|  - Enabled on all buckets                                                   |
|  - Noncurrent versions retained: 30 days                                    |
|  - Protects against accidental deletion                                     |
|                                                                             |
|  OBJECT LIFECYCLE                                                           |
|  ================                                                           |
|                                                                             |
|  Age 0-90 days:   Standard storage                                          |
|  Age 90-365 days: Nearline storage                                          |
|  Age 365+ days:   Coldline storage                                          |
|  Noncurrent:      Delete after 30 days                                      |
|                                                                             |
+---------------------------------------------------------------------------+
```

---

## Failover Procedures

### Database Failover

```
+---------------------------------------------------------------------------+
|                         DATABASE FAILOVER PROCEDURE                         |
+---------------------------------------------------------------------------+
|                                                                             |
|  SCENARIO: Primary database unavailable                                     |
|                                                                             |
|  DETECTION:                                                                 |
|  1. Cloud Monitoring alert triggers                                         |
|  2. On-call engineer receives notification                                  |
|  3. Verify outage (not transient)                                           |
|                                                                             |
|  DECISION:                                                                  |
|  - If primary recovering < 15 min: Wait                                     |
|  - If primary recovery > 15 min or uncertain: Failover                      |
|                                                                             |
|  FAILOVER STEPS:                                                            |
|                                                                             |
|  Step 1: Promote replica to primary                                         |
|  $ gcloud sql instances promote-replica hta-calibration-prod-replica        |
|                                                                             |
|  Step 2: Update application DATABASE_URL                                    |
|  - Update Secret Manager secret                                             |
|  - Restart application pods (or wait for secret refresh)                    |
|                                                                             |
|  Step 3: Verify connectivity                                                |
|  $ kubectl exec -it hta-web-xxx -- npx prisma db pull                       |
|                                                                             |
|  Step 4: Scale up DR region (if needed)                                     |
|  $ kubectl scale deployment hta-web --replicas=5 -n hta-production          |
|                                                                             |
|  Step 5: Update DNS (if DR region has separate LB)                          |
|  - Update Cloud DNS A record                                                |
|  - TTL should be low (300s) to enable fast switching                        |
|                                                                             |
|  ESTIMATED TIME: 15-30 minutes                                              |
|                                                                             |
+---------------------------------------------------------------------------+
```

### Full Region Failover

```
+---------------------------------------------------------------------------+
|                         FULL REGION FAILOVER                                |
+---------------------------------------------------------------------------+
|                                                                             |
|  SCENARIO: Entire primary region unavailable                                |
|                                                                             |
|  PRE-REQUISITES:                                                            |
|  - DR GKE cluster exists (standby mode)                                     |
|  - Database replica in DR region                                            |
|  - Storage replicated to DR region                                          |
|  - Application images available in Artifact Registry (multi-region)         |
|                                                                             |
|  FAILOVER RUNBOOK:                                                          |
|                                                                             |
|  Phase 1: Activate DR Infrastructure (10 min)                               |
|  --------------------------------------------                               |
|  1. Scale up DR GKE cluster                                                 |
|     $ gcloud container clusters resize hta-cluster-dr \                     |
|         --node-pool default-pool --num-nodes 3                              |
|                                                                             |
|  2. Promote database replica                                                |
|     $ gcloud sql instances promote-replica hta-calibration-dr-replica       |
|                                                                             |
|  3. Verify database connectivity                                            |
|                                                                             |
|  Phase 2: Deploy Application (5 min)                                        |
|  -----------------------------------                                        |
|  1. Update ConfigMap with DR database URL                                   |
|     $ kubectl apply -f k8s/dr/configmap-dr.yaml                             |
|                                                                             |
|  2. Deploy application                                                      |
|     $ kubectl apply -f k8s/production/ -n hta-production                    |
|                                                                             |
|  3. Verify pods are running                                                 |
|     $ kubectl get pods -n hta-production                                    |
|                                                                             |
|  Phase 3: Traffic Cutover (5 min)                                           |
|  ---------------------------------                                          |
|  1. Update DNS to DR load balancer                                          |
|     $ gcloud dns record-sets update @ --zone=hta-calibration \              |
|         --type=A --rrdatas=DR_LB_IP                                         |
|                                                                             |
|  2. Verify traffic is reaching DR                                           |
|     $ curl -I https://hta-calibration.com/api/health                        |
|                                                                             |
|  Phase 4: Validation (10 min)                                               |
|  ---------------------------                                                |
|  1. Run smoke tests                                                         |
|  2. Verify core functionality                                               |
|  3. Monitor error rates                                                     |
|  4. Notify stakeholders                                                     |
|                                                                             |
|  TOTAL ESTIMATED TIME: 30-45 minutes                                        |
|                                                                             |
+---------------------------------------------------------------------------+
```

### Automated Failover Script

```bash
#!/bin/bash
# scripts/dr-failover.sh

set -e

# Configuration
PRIMARY_REGION="asia-southeast1"
DR_REGION="asia-east1"
PROJECT_ID="hta-calibration-prod"
DB_INSTANCE="hta-calibration-prod"
DB_REPLICA="hta-calibration-dr-replica"
GKE_CLUSTER="hta-cluster-dr"
DNS_ZONE="hta-calibration"
DOMAIN="hta-calibration.com"

echo "=== HTA Calibration DR Failover ==="
echo "Primary Region: $PRIMARY_REGION"
echo "DR Region: $DR_REGION"
echo ""

# Confirmation
read -p "Are you sure you want to initiate failover? (yes/no): " confirm
if [ "$confirm" != "yes" ]; then
    echo "Failover cancelled"
    exit 1
fi

echo ""
echo "=== Phase 1: Database Failover ==="
echo "Promoting replica to primary..."
gcloud sql instances promote-replica $DB_REPLICA --project=$PROJECT_ID

echo "Waiting for promotion to complete..."
while true; do
    status=$(gcloud sql instances describe $DB_REPLICA --format='value(state)' --project=$PROJECT_ID)
    if [ "$status" == "RUNNABLE" ]; then
        break
    fi
    echo "  Status: $status"
    sleep 10
done
echo "Database promotion complete"

echo ""
echo "=== Phase 2: GKE Cluster Activation ==="
echo "Scaling up DR cluster..."
gcloud container clusters resize $GKE_CLUSTER \
    --node-pool default-pool \
    --num-nodes 3 \
    --region $DR_REGION \
    --project=$PROJECT_ID \
    --quiet

echo "Getting cluster credentials..."
gcloud container clusters get-credentials $GKE_CLUSTER \
    --region $DR_REGION \
    --project=$PROJECT_ID

echo ""
echo "=== Phase 3: Application Deployment ==="
echo "Applying DR configuration..."
kubectl apply -f k8s/dr/

echo "Waiting for pods to be ready..."
kubectl wait --for=condition=ready pod -l app=hta-web -n hta-production --timeout=300s

echo ""
echo "=== Phase 4: DNS Cutover ==="
DR_LB_IP=$(kubectl get svc hta-web-lb -n hta-production -o jsonpath='{.status.loadBalancer.ingress[0].ip}')
echo "DR Load Balancer IP: $DR_LB_IP"

echo "Updating DNS..."
gcloud dns record-sets update @ \
    --zone=$DNS_ZONE \
    --type=A \
    --ttl=60 \
    --rrdatas=$DR_LB_IP \
    --project=$PROJECT_ID

echo ""
echo "=== Failover Complete ==="
echo "Please verify:"
echo "1. https://$DOMAIN/api/health"
echo "2. Core application functionality"
echo "3. Monitor error rates in Cloud Monitoring"
```

---

## Recovery Procedures

### PITR Recovery

```
+---------------------------------------------------------------------------+
|                         POINT-IN-TIME RECOVERY                              |
+---------------------------------------------------------------------------+
|                                                                             |
|  SCENARIO: Recover from accidental data deletion/corruption                 |
|                                                                             |
|  Step 1: Identify the recovery point                                        |
|  - Review audit logs to find when issue occurred                            |
|  - Target time should be just before the incident                           |
|                                                                             |
|  Step 2: Create recovery instance                                           |
|  $ gcloud sql instances clone hta-calibration-prod \                        |
|      hta-calibration-recovery \                                             |
|      --point-in-time "2026-03-17T10:30:00Z"                                 |
|                                                                             |
|  Step 3: Connect to recovery instance                                       |
|  $ gcloud sql connect hta-calibration-recovery --user=postgres              |
|                                                                             |
|  Step 4: Export needed data                                                 |
|  - Export specific tables or rows that need recovery                        |
|  - Use pg_dump for table-level export                                       |
|                                                                             |
|  Step 5: Import to production                                               |
|  - Review data before importing                                             |
|  - Use appropriate merge/upsert strategy                                    |
|                                                                             |
|  Step 6: Cleanup                                                            |
|  $ gcloud sql instances delete hta-calibration-recovery                     |
|                                                                             |
+---------------------------------------------------------------------------+
```

### Failback Procedure

```
+---------------------------------------------------------------------------+
|                         FAILBACK TO PRIMARY REGION                          |
+---------------------------------------------------------------------------+
|                                                                             |
|  PRE-REQUISITES:                                                            |
|  - Primary region is fully operational                                      |
|  - Sufficient time during low-traffic period                                |
|  - Stakeholder approval                                                     |
|                                                                             |
|  Step 1: Re-create database replica in primary region                       |
|  $ gcloud sql instances create hta-calibration-prod \                       |
|      --master-instance-name=hta-calibration-dr-replica \                    |
|      --region=asia-southeast1                                               |
|                                                                             |
|  Step 2: Wait for replica sync                                              |
|  - Monitor replication lag                                                  |
|  - Ensure lag is near-zero before cutover                                   |
|                                                                             |
|  Step 3: Maintenance window                                                 |
|  - Enable maintenance mode in application                                   |
|  - Stop writes to DR database                                               |
|                                                                             |
|  Step 4: Promote primary region replica                                     |
|  $ gcloud sql instances promote-replica hta-calibration-prod                |
|                                                                             |
|  Step 5: Update application configuration                                   |
|  - Point to primary region database                                         |
|  - Restart application pods                                                 |
|                                                                             |
|  Step 6: DNS cutover                                                        |
|  - Update DNS to primary region LB                                          |
|  - Monitor traffic shift                                                    |
|                                                                             |
|  Step 7: Scale down DR region                                               |
|  - Reduce DR GKE cluster nodes                                              |
|  - Keep minimal standby capacity                                            |
|                                                                             |
|  Step 8: Re-establish DR replica                                            |
|  - Create new replica in DR region                                          |
|  - Verify replication is working                                            |
|                                                                             |
+---------------------------------------------------------------------------+
```

---

## DR Testing

### DR Test Plan

```
+---------------------------------------------------------------------------+
|                         DR TEST SCHEDULE                                    |
+---------------------------------------------------------------------------+
|                                                                             |
|  MONTHLY: Backup Verification                                               |
|  ============================                                               |
|  - Restore backup to test instance                                          |
|  - Verify data integrity                                                    |
|  - Document restore time                                                    |
|                                                                             |
|  QUARTERLY: Partial Failover Test                                           |
|  =================================                                          |
|  - Test database failover to replica                                        |
|  - Verify application can connect                                           |
|  - Failback to primary                                                      |
|  - Duration: 2-4 hours                                                      |
|                                                                             |
|  ANNUALLY: Full DR Test                                                     |
|  =======================                                                    |
|  - Complete failover to DR region                                           |
|  - Run production traffic on DR                                             |
|  - Test all critical workflows                                              |
|  - Failback to primary                                                      |
|  - Duration: Full day                                                       |
|                                                                             |
+---------------------------------------------------------------------------+
```

### DR Test Checklist

```markdown
# DR Test Checklist

## Pre-Test
- [ ] Schedule maintenance window
- [ ] Notify stakeholders
- [ ] Verify backups are current
- [ ] Document current state

## Database Failover
- [ ] Promote replica: `gcloud sql instances promote-replica ...`
- [ ] Verify new primary is accessible
- [ ] Update application configuration
- [ ] Verify application connectivity
- [ ] Check replication lag was acceptable

## Application Failover (if applicable)
- [ ] Scale up DR cluster
- [ ] Deploy application
- [ ] Verify pods healthy
- [ ] Run smoke tests

## Traffic Cutover
- [ ] Update DNS
- [ ] Verify traffic reaching DR
- [ ] Monitor error rates
- [ ] Test core functionality

## Validation
- [ ] Create test certificate
- [ ] Complete approval workflow
- [ ] Generate PDF
- [ ] Verify data persistence

## Failback
- [ ] Re-establish replica
- [ ] Wait for sync
- [ ] Promote primary
- [ ] Update configuration
- [ ] Verify normal operation

## Post-Test
- [ ] Document lessons learned
- [ ] Update runbooks if needed
- [ ] Report metrics (RTO actual, RPO actual)
```

---

## Implementation Checklist

### Phase 1: Backup Infrastructure
- [ ] Configure Cloud SQL automated backups
- [ ] Enable PITR
- [ ] Set up cross-region backup
- [ ] Configure GCS versioning and replication
- [ ] Test backup restoration

### Phase 2: DR Infrastructure
- [ ] Create DR GKE cluster (standby)
- [ ] Create database replica in DR region
- [ ] Configure storage replication
- [ ] Set up DR-specific configs

### Phase 3: Automation
- [ ] Create failover scripts
- [ ] Create failback scripts
- [ ] Set up monitoring alerts
- [ ] Configure incident response

### Phase 4: Documentation & Testing
- [ ] Document all procedures
- [ ] Create runbooks
- [ ] Schedule DR tests
- [ ] Train team on procedures

---

## Related Documents

- [Overview](./00_scaleup_overview.md)
- [Database Setup](./06_database_setup.md)
- [GCP Infrastructure](./04_gcp_infrastructure.md)
- [Monitoring & Observability](./14_monitoring_observability.md)
