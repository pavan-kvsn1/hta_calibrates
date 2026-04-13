# Secrets Rotation Runbook

## Overview

This runbook covers the procedures for rotating secrets in the HTA Calibration system.

| Secret | Rotation Frequency | Zero-Downtime | Risk Level |
|--------|-------------------|---------------|------------|
| NEXTAUTH_SECRET | Annually | Yes | Medium |
| Database Password | Quarterly | Yes | High |
| Redis Password | Quarterly | Yes | Medium |
| RESEND_API_KEY | As needed | Yes | Low |

## Rotation Schedule

| Month | Action |
|-------|--------|
| January | Database password |
| April | Database password |
| July | Database password + NEXTAUTH_SECRET |
| October | Database password |

---

## 1. NEXTAUTH_SECRET Rotation

**Impact:** User sessions will be invalidated if done incorrectly.

### Prerequisites
- Access to GCP Secret Manager
- Access to deploy (Cloud Run or GKE)

### Steps

```bash
# Set environment
PROJECT_ID="hta-calibration-dev1"  # or hta-calibration-prod
ENV="dev"  # or prod
REGION="asia-south1"

# 1. Generate new secret
NEW_SECRET=$(openssl rand -base64 64 | tr -d '\n')
echo "New secret generated (DO NOT LOG IN PRODUCTION)"

# 2. Add new version to Secret Manager
echo -n "$NEW_SECRET" | gcloud secrets versions add \
  ${PROJECT_ID}-nextauth-secret-${ENV} \
  --data-file=- \
  --project=$PROJECT_ID

# 3. Note the new version number
gcloud secrets versions list ${PROJECT_ID}-nextauth-secret-${ENV} \
  --project=$PROJECT_ID

# 4. Deploy new revision (picks up latest secret)
# For Cloud Run (dev):
gcloud run services update hta-calibration-${ENV} \
  --region=$REGION \
  --project=$PROJECT_ID

# For GKE (prod):
# kubectl rollout restart deployment/hta-web -n hta-calibration

# 5. Verify deployment
curl -s https://${ENV}.hta-calibration.com/api/health

# 6. Monitor for 24 hours, then disable old version
# List versions to find the old one
gcloud secrets versions list ${PROJECT_ID}-nextauth-secret-${ENV} \
  --project=$PROJECT_ID

# Disable old version (replace OLD_VERSION_NUMBER)
gcloud secrets versions disable OLD_VERSION_NUMBER \
  --secret=${PROJECT_ID}-nextauth-secret-${ENV} \
  --project=$PROJECT_ID
```

### Rollback

If issues occur after rotation:

```bash
# Re-enable old version
gcloud secrets versions enable OLD_VERSION_NUMBER \
  --secret=${PROJECT_ID}-nextauth-secret-${ENV} \
  --project=$PROJECT_ID

# Disable new version
gcloud secrets versions disable NEW_VERSION_NUMBER \
  --secret=${PROJECT_ID}-nextauth-secret-${ENV} \
  --project=$PROJECT_ID

# Redeploy
gcloud run services update hta-calibration-${ENV} --region=$REGION
```

---

## 2. Database Password Rotation

**Impact:** Application will fail to connect if not done correctly.

### Prerequisites
- Access to Cloud SQL Admin
- Access to Secret Manager
- Access to deploy

### Steps

```bash
# Set environment
PROJECT_ID="hta-calibration-dev1"
ENV="dev"
REGION="asia-south1"
INSTANCE_NAME="${PROJECT_ID}-postgres-${ENV}"
DB_USER="hta_app"

# 1. Generate new password
NEW_PASSWORD=$(openssl rand -base64 32 | tr -d '\n')

# 2. Get current DATABASE_URL components
# DB_HOST, DB_NAME should remain the same
DB_HOST=$(gcloud sql instances describe $INSTANCE_NAME \
  --format='value(ipAddresses[0].ipAddress)' \
  --project=$PROJECT_ID)
DB_NAME="hta_calibration"

# 3. Update Cloud SQL user password
gcloud sql users set-password $DB_USER \
  --instance=$INSTANCE_NAME \
  --password="$NEW_PASSWORD" \
  --project=$PROJECT_ID

# 4. Update DATABASE_URL secret
NEW_DATABASE_URL="postgresql://${DB_USER}:${NEW_PASSWORD}@${DB_HOST}:5432/${DB_NAME}"
echo -n "$NEW_DATABASE_URL" | gcloud secrets versions add \
  ${PROJECT_ID}-database-url-${ENV} \
  --data-file=- \
  --project=$PROJECT_ID

# 5. Also update the standalone password secret
echo -n "$NEW_PASSWORD" | gcloud secrets versions add \
  ${PROJECT_ID}-db-password-${ENV} \
  --data-file=- \
  --project=$PROJECT_ID

# 6. Deploy new revision
gcloud run services update hta-calibration-${ENV} \
  --region=$REGION \
  --project=$PROJECT_ID

# 7. Verify
curl -s https://${ENV}.hta-calibration.com/api/health/ready | jq .
```

### Rollback

```bash
# Database password rollback is complex - you need the old password
# Best practice: Keep a secure backup of old password for 24 hours

# If you have the old password:
gcloud sql users set-password $DB_USER \
  --instance=$INSTANCE_NAME \
  --password="$OLD_PASSWORD" \
  --project=$PROJECT_ID

# Re-enable old secret versions and redeploy
```

---

## 3. Redis Password Rotation

**Impact:** Cache will be unavailable briefly; app continues with degraded performance.

### Steps

```bash
PROJECT_ID="hta-calibration-dev1"
ENV="dev"
REGION="asia-south1"
REDIS_INSTANCE="${PROJECT_ID}-redis-${ENV}"

# 1. Generate new auth string
NEW_AUTH=$(openssl rand -base64 32 | tr -d '\n')

# 2. Update Memorystore Redis AUTH
gcloud redis instances update $REDIS_INSTANCE \
  --region=$REGION \
  --auth-string="$NEW_AUTH" \
  --project=$PROJECT_ID

# 3. Get Redis host
REDIS_HOST=$(gcloud redis instances describe $REDIS_INSTANCE \
  --region=$REGION \
  --format='value(host)' \
  --project=$PROJECT_ID)
REDIS_PORT=$(gcloud redis instances describe $REDIS_INSTANCE \
  --region=$REGION \
  --format='value(port)' \
  --project=$PROJECT_ID)

# 4. Update REDIS_URL secret
NEW_REDIS_URL="redis://:${NEW_AUTH}@${REDIS_HOST}:${REDIS_PORT}"
echo -n "$NEW_REDIS_URL" | gcloud secrets versions add \
  ${PROJECT_ID}-redis-url-${ENV} \
  --data-file=- \
  --project=$PROJECT_ID

# 5. Update standalone auth secret
echo -n "$NEW_AUTH" | gcloud secrets versions add \
  ${PROJECT_ID}-redis-auth-${ENV} \
  --data-file=- \
  --project=$PROJECT_ID

# 6. Deploy
gcloud run services update hta-calibration-${ENV} \
  --region=$REGION \
  --project=$PROJECT_ID

# 7. Verify cache is working
curl -s https://${ENV}.hta-calibration.com/api/health/ready | jq '.checks.cache'
```

---

## 4. RESEND_API_KEY Rotation

**Impact:** Emails will fail until new key is deployed.

### Steps

1. **Generate new key in Resend Dashboard:**
   - Go to https://resend.com/api-keys
   - Create new API key
   - Copy the key (shown only once)

2. **Update Secret Manager:**
```bash
PROJECT_ID="hta-calibration-dev1"
ENV="dev"

# Add new version
echo -n "re_NEW_API_KEY_HERE" | gcloud secrets versions add \
  ${PROJECT_ID}-resend-api-key-${ENV} \
  --data-file=- \
  --project=$PROJECT_ID
```

3. **Deploy:**
```bash
gcloud run services update hta-calibration-${ENV} \
  --region=asia-south1 \
  --project=$PROJECT_ID
```

4. **Test email sending** (trigger a password reset or similar)

5. **Revoke old key in Resend Dashboard**

---

## Verification Checklist

After any secret rotation:

- [ ] Health check passes: `/api/health`
- [ ] Readiness check passes: `/api/health/ready`
- [ ] Smoke test passes: `/api/smoke-test`
- [ ] Can log in as admin
- [ ] Can log in as customer
- [ ] Emails send successfully (if RESEND rotated)

---

## Emergency Contacts

| Role | Contact |
|------|---------|
| DevOps Lead | TBD |
| Database Admin | TBD |
| On-call Engineer | TBD |
