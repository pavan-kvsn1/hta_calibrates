# Data Retention Policy

**Document Version:** 1.0
**Effective Date:** April 2026
**Last Updated:** 2026-04-13
**Owner:** HTA Calibr8s

---

## 1. Purpose

This document defines how long HTA Calibr8s retains different categories of data and the procedures for secure deletion when retention periods expire.

---

## 2. Retention Schedule

| Data Type | Retention Period | Legal Basis | Deletion Method |
|-----------|------------------|-------------|-----------------|
| **Active user accounts** | Until deletion requested | Contract performance | On user request |
| **Deleted user accounts** | 30 days post-deletion | Recovery period | Automated purge |
| **Calibration certificates** | 7 years | Regulatory requirement (ISO/IEC 17025) | Manual review + archive |
| **Certificate audit trail** | 7 years | Regulatory requirement | Retained with certificates |
| **Session tokens** | 30 days | Security | Automated cleanup |
| **Audit logs** | 1 year | Legal compliance | Automated archival |
| **Password reset tokens** | 1 hour | Security | Automated cleanup |
| **Failed login attempts** | 15 minutes | Security (rate limiting) | Automated expiry |
| **Email queue records** | 90 days | Troubleshooting | Automated cleanup |
| **Database backups** | 30 days | Disaster recovery | Automated rotation |

---

## 3. Data Categories

### 3.1 Account Data

**What it includes:**
- Email address
- Name
- Company name
- Password hash (bcrypt)
- Account creation date
- Last login timestamp

**Retention:** Until account deletion requested

**On deletion:** 
- Email anonymized to `deleted-{id}@anonymized.local`
- Name changed to "Deleted User"
- Password hash cleared
- Account marked inactive

### 3.2 Calibration Certificates

**What it includes:**
- Certificate number and details
- Equipment information (make, model, serial)
- Calibration measurements and results
- Technician signatures
- Customer signatures

**Retention:** 7 years from date of calibration

**Legal basis:** ISO/IEC 17025 requires calibration laboratories to retain records for a defined period. Industry standard is 7 years minimum.

**On expiry:** Certificates are archived to cold storage, then permanently deleted after review.

### 3.3 Session Data

**What it includes:**
- Session tokens
- Login timestamps
- IP addresses (for security)

**Retention:** 30 days or until logout

**Automated cleanup:** Daily job removes expired sessions

### 3.4 Audit Logs

**What it includes:**
- User actions (login, logout, data changes)
- Timestamps
- Actor information
- Change details

**Retention:** 1 year

**On expiry:** Logs are archived to cold storage for an additional year, then permanently deleted.

---

## 4. Automated Cleanup Procedures

### 4.1 Daily Cleanup Job

The following data is automatically cleaned up daily:

```
1. Expired session tokens (> 30 days)
2. Expired password reset tokens (> 1 hour)
3. Expired email verification tokens (> 24 hours)
4. Rate limit counters (handled by cache TTL)
```

### 4.2 Monthly Review

The following requires monthly manual review:

```
1. Certificates approaching 7-year retention limit
2. Audit logs approaching 1-year limit
3. Soft-deleted accounts past 30-day recovery period
```

### 4.3 Implementation

Cleanup is handled by scheduled Cloud Run jobs:

| Job | Schedule | Action |
|-----|----------|--------|
| `cleanup-sessions` | Daily 02:00 UTC | Delete expired sessions |
| `cleanup-tokens` | Hourly | Delete expired reset tokens |
| `archive-audit-logs` | Monthly 1st | Archive logs > 1 year |
| `retention-review` | Monthly 1st | Generate retention report |

---

## 5. User Rights

### 5.1 Data Export (GDPR Article 20)

Users can export their data at any time via:
- Customer Portal: Settings > Data & Privacy > Export Data
- API: `GET /api/customer/data-export`

Export includes:
- Account information
- All associated certificates
- Signature records

### 5.2 Account Deletion (GDPR Article 17)

Users can delete their account via:
- Customer Portal: Settings > Data & Privacy > Delete Account
- Requires password confirmation

**What is deleted:**
- Personal information (anonymized)
- Session tokens
- Password hash

**What is retained:**
- Calibration certificates (regulatory requirement)
- Audit logs (compliance requirement)

---

## 6. Exception Handling

### 6.1 Legal Hold

If data is subject to legal proceedings:
1. Mark affected records with legal hold flag
2. Suspend automated deletion for those records
3. Document the hold with case reference
4. Remove hold only when authorized by legal counsel

### 6.2 Regulatory Requests

If a regulatory body requests data retention beyond standard periods:
1. Document the request and authority
2. Extend retention for specified records
3. Review extension annually

### 6.3 Customer Contracts

Some customers may have contractual requirements for extended retention:
1. Document in customer agreement
2. Apply custom retention policy to their records
3. Review at contract renewal

---

## 7. Secure Deletion Methods

| Data Location | Deletion Method |
|---------------|-----------------|
| PostgreSQL database | `DELETE` with vacuum |
| Cloud Storage (GCS) | Object deletion + lifecycle policy |
| Redis cache | Key expiration (TTL) |
| Backups | Automatic rotation after 30 days |
| Logs | Cloud Logging retention policy |

---

## 8. Compliance

This policy supports compliance with:
- **GDPR** - Article 5(1)(e) storage limitation
- **ISO/IEC 17025** - Calibration record retention
- **CCPA** - Right to deletion

---

## 9. Policy Review

This policy is reviewed:
- Annually, or
- When regulations change, or
- When business requirements change

**Document History:**

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-13 | Initial version |
