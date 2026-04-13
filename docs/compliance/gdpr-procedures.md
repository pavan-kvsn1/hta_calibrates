# GDPR Compliance Procedures

**Document Version:** 1.0
**Effective Date:** April 2026
**Last Updated:** 2026-04-13
**Owner:** HTA Calibr8s

---

## 1. Overview

This document outlines procedures for handling GDPR-related requests and obligations for HTA Calibr8s.

---

## 2. Data Subject Rights

### 2.1 Rights Summary

| Right | GDPR Article | Self-Service | Response Time |
|-------|--------------|--------------|---------------|
| Right to be informed | Art. 13-14 | Privacy policy | N/A |
| Right of access | Art. 15 | Data export | 30 days |
| Right to rectification | Art. 16 | Profile settings | 30 days |
| Right to erasure | Art. 17 | Account deletion | 30 days |
| Right to restrict processing | Art. 18 | Contact support | 30 days |
| Right to data portability | Art. 20 | JSON export | 30 days |
| Right to object | Art. 21 | Contact support | 30 days |

### 2.2 Self-Service Features

Users can exercise the following rights without contacting support:

**Data Export (Art. 15, 20):**
- Location: Settings > Data & Privacy > Export Data
- Format: JSON (machine-readable)
- Includes: Account info, certificates, signatures

**Account Deletion (Art. 17):**
- Location: Settings > Data & Privacy > Delete Account
- Requires: Password confirmation
- Effect: Personal data anonymized, certificates retained per regulations

**Profile Update (Art. 16):**
- Location: Profile settings
- Can update: Name, contact preferences

---

## 3. Data Subject Access Request (DSAR) Process

### 3.1 Receiving Requests

Requests may arrive via:
- Email: privacy@htacalibr8s.com
- Support ticket
- Written letter

### 3.2 Processing Steps

```
Day 0: Request received
  │
  ├─► Log request in DSAR tracker
  ├─► Send acknowledgment email
  │
Day 1-5: Verify identity
  │
  ├─► Request ID verification if needed
  ├─► Confirm requester is the data subject
  │
Day 6-25: Gather data
  │
  ├─► Export user data from database
  ├─► Check for data in backups/archives
  ├─► Compile response
  │
Day 26-30: Respond
  │
  ├─► Send data to requester securely
  ├─► Document completion in tracker
  │
  ▼
Complete
```

### 3.3 Identity Verification

Before providing data, verify the requester's identity:

1. **Existing users:** Request login to account and use self-service export
2. **Email requests:** 
   - Send verification code to registered email
   - Request government ID if email doesn't match records
3. **Written requests:**
   - Verify signature if available
   - Request additional identification

### 3.4 Response Template

```
Subject: Your Data Access Request - [Reference Number]

Dear [Name],

Thank you for your data access request dated [Date].

Attached is a complete export of your personal data held by HTA Calibr8s.

The export includes:
- Account information
- Calibration certificates associated with your company
- Digital signatures you have provided

If you have questions about this data or wish to exercise other rights,
please contact privacy@htacalibr8s.com.

Best regards,
HTA Calibr8s Privacy Team
```

---

## 4. Data Breach Response

### 4.1 Definition

A personal data breach is:
> A breach of security leading to the accidental or unlawful destruction, loss, alteration, unauthorised disclosure of, or access to, personal data.

### 4.2 Response Timeline

| Time | Action |
|------|--------|
| 0-1 hours | Detect and contain breach |
| 1-4 hours | Assess scope and severity |
| 4-24 hours | Document findings |
| 24-72 hours | Notify supervisory authority (if required) |
| ASAP | Notify affected individuals (if high risk) |

### 4.3 Response Procedure

**Step 1: Contain (0-1 hours)**
```
[ ] Identify affected systems
[ ] Isolate compromised components
[ ] Preserve evidence (logs, screenshots)
[ ] Revoke compromised credentials
```

**Step 2: Assess (1-4 hours)**
```
[ ] Determine type of data affected
[ ] Estimate number of individuals affected
[ ] Assess likelihood of harm
[ ] Identify root cause
```

**Step 3: Document (4-24 hours)**
```
[ ] Complete breach assessment form
[ ] Record timeline of events
[ ] Document containment actions
[ ] Prepare notification drafts
```

**Step 4: Notify (24-72 hours)**

Supervisory authority notification required if:
- Risk to individuals' rights and freedoms
- More than trivial breach

Include in notification:
- Nature of breach
- Categories of data affected
- Approximate number of individuals
- Contact details for DPO
- Likely consequences
- Measures taken/proposed

**Step 5: Notify individuals (if high risk)**

Required when breach likely results in high risk to rights and freedoms.

Include:
- Plain language description
- What data was affected
- What we're doing about it
- What they can do to protect themselves
- Contact information

### 4.4 Breach Log

Maintain a breach log with:
- Date and time of breach
- Date discovered
- Nature of breach
- Data categories affected
- Number of individuals
- Actions taken
- Notifications made
- Lessons learned

---

## 5. Consent Management

### 5.1 Cookie Consent

**Implementation:**
- Cookie consent banner on first visit
- Stores consent in localStorage
- Only essential cookies used currently

**Consent record:**
```json
{
  "essential": true,
  "analytics": false,
  "marketing": false,
  "timestamp": "2026-04-13T10:00:00Z"
}
```

### 5.2 Marketing Consent

Currently not applicable - no marketing communications sent.

If implemented in future:
- Separate opt-in required
- Easy unsubscribe in every email
- Consent recorded with timestamp

### 5.3 Withdrawing Consent

Users can withdraw consent by:
- Clearing cookies (cookie consent)
- Updating preferences in settings
- Contacting privacy@htacalibr8s.com

---

## 6. Third-Party Data Processing

### 6.1 Current Sub-Processors

| Provider | Service | Data Processed | Location |
|----------|---------|----------------|----------|
| Google Cloud Platform | Infrastructure | All data | EU/US |
| Resend | Email delivery | Email addresses, names | US |
| Sentry | Error tracking | Error logs (no PII) | US |

### 6.2 Sub-Processor Due Diligence

Before engaging a new sub-processor:

```
[ ] Review their privacy policy
[ ] Verify GDPR compliance (or adequate safeguards)
[ ] Check security certifications (SOC 2, ISO 27001)
[ ] Execute Data Processing Agreement
[ ] Add to sub-processor list
[ ] Update privacy policy if needed
```

### 6.3 Data Processing Agreement Requirements

DPAs must include:
- Subject matter and duration
- Nature and purpose of processing
- Types of personal data
- Categories of data subjects
- Obligations and rights of controller
- Security measures
- Sub-processor provisions
- Audit rights
- Deletion/return requirements

---

## 7. Privacy by Design

### 7.1 Principles

1. **Data minimization** - Only collect what's necessary
2. **Purpose limitation** - Use data only for stated purposes
3. **Storage limitation** - Delete when no longer needed
4. **Security** - Protect data appropriately
5. **Transparency** - Clear privacy notices

### 7.2 New Feature Checklist

Before launching features that process personal data:

```
[ ] What personal data is collected?
[ ] Why is it necessary?
[ ] What is the legal basis?
[ ] How long will it be retained?
[ ] Who has access?
[ ] Is encryption needed?
[ ] Does privacy policy need updating?
[ ] Is consent required?
```

---

## 8. Training Requirements

| Role | Training | Frequency |
|------|----------|-----------|
| All staff | GDPR awareness | Annual |
| Developers | Privacy by design | At onboarding + annual |
| Support | DSAR handling | At onboarding + annual |
| Management | Breach response | Annual |

---

## 9. Documentation

Maintain the following records:

| Document | Location | Owner |
|----------|----------|-------|
| Privacy policy | `/privacy` | Legal |
| Cookie policy | `/privacy#cookies` | Legal |
| Data retention policy | `docs/compliance/data-retention.md` | Operations |
| DSAR log | Internal spreadsheet | Privacy team |
| Breach log | Internal spreadsheet | Privacy team |
| Sub-processor list | This document | Privacy team |
| DPAs | Legal file storage | Legal |

---

## 10. Contact Information

**Data Protection Contact:**
- Email: privacy@htacalibr8s.com

**For users:**
- Privacy policy: https://htacalibr8s.com/privacy
- Data export: Settings > Data & Privacy > Export Data
- Account deletion: Settings > Data & Privacy > Delete Account

---

## 11. Document History

| Version | Date | Changes |
|---------|------|---------|
| 1.0 | 2026-04-13 | Initial version |
