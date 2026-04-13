# HTA Calibr8s - Production Readiness Plan

**Document Version:** 1.2
**Created:** April 2026
**Last Updated:** 2026-04-13
**Status:** Draft - Phase 6 Complete

---

## Executive Summary

This document outlines the implementation plan for twelve critical production features:

**Core Features (Implemented):**
1. **Password Management** - User password change and reset functionality ✅
2. **Email Notifications** - Transactional email triggers for key workflow events ✅
3. **Customer Email Access** - Token-based certificate review and download ✅
4. **Caching Strategy** - Performance optimization and cost reduction ✅

**Security & Operations (In Progress):**
5. **Secrets Management** - GCP Secret Manager integration and rotation ✅
6. **Security** - Rate limiting, CSP headers, account lockout ✅
7. **Monitoring & Observability** - Error tracking, structured logging, alerting ✅
8. **Disaster Recovery** - Backups, RTO/RPO targets, recovery procedures ✅

**Infrastructure & Compliance (Planned):**
9. **CI/CD Pipeline** - Automated testing and deployment ✅
10. **Environment Management** - Dev/staging/prod separation ✅
11. **Performance Testing** - Load testing against production (no staging) ⚠️
12. **Compliance & Data Privacy** - GDPR, privacy policy, data retention ⚠️

---

## 1. Password Management

### Current State

~~- Users authenticate via password stored as bcrypt hash~~
~~- No self-service password change or reset functionality exists~~
~~- Admin creates users with temporary passwords or activation links~~
~~- Customer users activate accounts via token-based activation flow~~

**Status: ✅ IMPLEMENTED (April 2026)**

### Implementation Details

#### 1.1 Password Change (Authenticated Users) ✅

**Implemented Routes:**
- `/customer/settings` - Customer users ✅
- `/admin/settings` - Admin users ✅
- `/dashboard/settings` - Engineer users ✅

**UI Components:**
```
┌─────────────────────────────────────────────────┐
│  Change Password                                │
├─────────────────────────────────────────────────┤
│  Current Password:    [________________]        │
│  New Password:        [________________]        │
│  Confirm Password:    [________________]        │
│                                                 │
│  Password Requirements:                         │
│  ✓ At least 8 characters                       │
│  ✓ One uppercase letter                        │
│  ✓ One lowercase letter                        │
│  ✓ One number                                  │
│  ○ One special character (recommended)         │
│                                                 │
│  [Cancel]                    [Change Password]  │
└─────────────────────────────────────────────────┘
```

**API Endpoints:** ✅ Implemented

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/api/auth/change-password` | Staff users (Admin/Engineer) | ✅ |
| POST | `/api/customer/change-password` | Customer users | ✅ |

**Request Body:**
```typescript
{
  currentPassword: string
  newPassword: string
  confirmPassword: string
}
```

**Validation Rules:** ✅ Implemented
- ✅ Current password must match stored hash
- ✅ New password minimum 8 characters
- ✅ New password must contain: uppercase, lowercase, number
- ✅ New password cannot be same as current password
- ⏳ New password cannot match last 3 passwords (password history) - *Deferred*
- ⏳ Rate limit: 5 attempts per 15 minutes - *Deferred*

**Security Measures:** ✅ Implemented
- ✅ Invalidate all existing sessions on password change (via `revokeAllUserTokens()`)
- ✅ Log password change event for audit trail (AuditLog entry created)
- ⏳ Send confirmation email after successful change - *See Section 2*

#### 1.2 Password Reset (Forgot Password) ✅

**Flow Diagram:**
```
User clicks "Forgot Password"
         │
         ▼
┌─────────────────────┐
│ Enter Email Address │
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ Generate Reset Token│ ─── Store in DB with 1-hour expiry
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ Send Reset Email    │ ─── "customer-password-reset" template
└─────────────────────┘
         │
         ▼
User clicks link in email
         │
         ▼
┌─────────────────────┐
│ Validate Token      │ ─── Check expiry, not used
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ Set New Password    │ ─── Same validation rules
└─────────────────────┘
         │
         ▼
┌─────────────────────┐
│ Invalidate Token    │ ─── Mark as used
└─────────────────────┘
```

**Pages Implemented:** ✅
- `/forgot-password` - Email entry form (staff) ✅
- `/customer/forgot-password` - Email entry form (customer) ✅
- `/reset-password/[token]` - Password reset form (staff) ✅
- `/customer/reset-password/[token]` - Password reset form (customer) ✅

**API Endpoints:** ✅ Implemented

| Method | Endpoint | Description | Status |
|--------|----------|-------------|--------|
| POST | `/api/auth/forgot-password` | Request reset (staff) | ✅ |
| GET/POST | `/api/auth/reset-password` | Validate/Execute reset (staff) | ✅ |
| POST | `/api/customer/forgot-password` | Request reset (customer) | ✅ |
| GET/POST | `/api/customer/reset-password` | Validate/Execute reset (customer) | ✅ |

**Database Changes:** ✅ Implemented
```prisma
model PasswordResetToken {
  id         String    @id @default(uuid())
  token      String    @unique
  userId     String?
  customerId String?
  expiresAt  DateTime
  usedAt     DateTime?
  createdAt  DateTime  @default(now())

  user       User?         @relation(fields: [userId], references: [id], onDelete: Cascade)
  customer   CustomerUser? @relation(fields: [customerId], references: [id], onDelete: Cascade)

  @@index([token])
  @@index([userId])
  @@index([customerId])
  @@index([expiresAt])
}
```

**Email Template:** ✅ Implemented in `email.worker.ts`
```typescript
'password-reset': {
  subject: 'Reset Your HTA Calibration Portal Password',
  body: (data) => `
    Hello ${data.userName},

    We received a request to reset your password for the HTA Calibration Portal.

    Click the link below to set a new password:
    ${data.resetUrl}

    This link will expire in 1 hour.

    If you did not request this, please ignore this email or contact support.

    Best regards,
    HTA Instrumentation (P) Ltd.
  `,
}
```

**Security Measures:** ✅ Implemented
- ✅ Token expires after 1 hour
- ✅ One-time use (invalidate after use via `usedAt` timestamp)
- ✅ Rate limit: 3 requests per email per hour
- ✅ Generic response ("If email exists, reset link sent") to prevent enumeration
- ✅ Log all reset attempts (AuditLog entries for requests and completions)

### 1.3 Implementation Summary

**Files Created/Modified:**

| File | Type | Description |
|------|------|-------------|
| `prisma/schema.prisma` | Modified | Added PasswordResetToken model |
| `src/components/auth/ChangePasswordForm.tsx` | Created | Reusable password change form |
| `src/components/ui/alert.tsx` | Created | Alert UI component |
| `src/app/(dashboard)/settings/page.tsx` | Created | Engineer settings page |
| `src/app/admin/settings/page.tsx` | Created | Admin settings page |
| `src/app/customer/settings/page.tsx` | Modified | Added password change for all customers |
| `src/app/(auth)/forgot-password/page.tsx` | Created | Staff forgot password page |
| `src/app/(auth)/customer/forgot-password/page.tsx` | Created | Customer forgot password page |
| `src/app/(auth)/reset-password/[token]/page.tsx` | Created | Staff reset password page |
| `src/app/(auth)/customer/reset-password/[token]/page.tsx` | Created | Customer reset password page |
| `src/app/(auth)/login/page.tsx` | Modified | Added forgot password link |
| `src/app/(auth)/customer/login/page.tsx` | Modified | Added forgot password link |
| `src/app/api/auth/change-password/route.ts` | Created | Staff password change API |
| `src/app/api/auth/forgot-password/route.ts` | Created | Staff forgot password API |
| `src/app/api/auth/reset-password/route.ts` | Created | Staff reset password API |
| `src/app/api/customer/change-password/route.ts` | Created | Customer password change API |
| `src/app/api/customer/forgot-password/route.ts` | Created | Customer forgot password API |
| `src/app/api/customer/reset-password/route.ts` | Created | Customer reset password API |
| `src/lib/services/queue/workers/email.worker.ts` | Modified | Added password-reset template |

---

## 2. Email Notifications

### Current State

~~- Queue-based email system exists (`email:send` job type)~~
~~- Email templates defined in `email.worker.ts`~~
~~- In-app notifications exist but don't trigger emails~~

**Status: ✅ IMPLEMENTED (April 2026)**

### Implementation Details

#### 2.0.1 Email Templates (8 Total)

All email templates implemented using React Email components in `/src/emails/`:

| Template Key | File | Purpose | Status |
|--------------|------|---------|--------|
| `password-reset` | `PasswordReset.tsx` | Password reset link | ✅ |
| `password-changed` | `PasswordChanged.tsx` | Password change confirmation | ✅ |
| `staff-activation` | `StaffActivation.tsx` | Staff account activation | ✅ |
| `certificate-for-review` | `CertificateSubmitted.tsx` | Reviewer notification | ✅ |
| `certificate-reviewed` | `CertificateReviewed.tsx` | Approval/revision notification | ✅ |
| `customer-review-request` | `CertificateSentToCustomer.tsx` | Certificate ready for review | ✅ |
| `customer-approval` | `CustomerApproval.tsx` | Customer approval notification | ✅ |
| `certificate-download-ready` | `CertificateDownloadReady.tsx` | Download link for customers | ✅ |

#### 2.0.2 Email Worker Service

**File:** `src/lib/services/queue/workers/email.worker.ts`

Features:
- 13 email templates with subject lines and fallback text
- React Email component rendering with `@react-email/render`
- Resend API integration for production delivery
- Development mode logging (when no RESEND_API_KEY)
- Individual and batch email support

#### 2.0.3 Notification Service

**File:** `src/lib/services/notifications.ts`

Features:
- 26 notification types defined
- Core functions: `createNotification()`, `getNotifications()`, `markNotificationsAsRead()`
- Specialized workflow functions:
  - `notifyReviewerOnSubmit()`
  - `notifyAssigneeOnReview()`
  - `notifyOnSentToCustomer()`
  - `notifyOnCustomerApproval()`

### Event Coverage (Updated)

| Event | In-App | Email | Status |
|-------|--------|-------|--------|
| Customer account created | - | ✅ | Complete |
| User addition approved | - | ✅ | Complete |
| Request rejected | - | ✅ | Complete |
| Password reset requested | - | ✅ | Complete |
| Password changed | - | ✅ | Complete |
| Certificate sent to customer | ✅ | ✅ | Complete |
| Certificate submitted for review | ✅ | ✅ | Complete |
| Revision requested | ✅ | ✅ | Complete |
| Certificate approved by reviewer | ✅ | ✅ | Complete |
| Customer approved certificate | ✅ | ✅ | Complete |
| Staff user created | - | ✅ | Complete |

### Original Implementation Plan (Archived)

#### 2.1 Unified Notification Service

Create a wrapper that triggers both in-app and email notifications:

```typescript
// src/lib/services/notifications/unified.ts

interface NotifyOptions {
  // In-app notification
  inApp: boolean
  // Email notification
  email: boolean
  // Specific email template (optional, auto-derives if not set)
  emailTemplate?: string
}

async function notify(
  params: CreateNotificationParams,
  options: NotifyOptions = { inApp: true, email: true }
) {
  const promises: Promise<unknown>[] = []

  if (options.inApp) {
    promises.push(createNotification(params))
  }

  if (options.email) {
    const recipient = await getRecipientEmail(params)
    if (recipient) {
      promises.push(enqueue('email:send', {
        to: recipient.email,
        template: options.emailTemplate || deriveTemplate(params.type),
        templateData: {
          userName: recipient.name,
          ...params.data,
        },
      }))
    }
  }

  await Promise.all(promises)
}
```

#### 2.2 Email Templates to Add

```typescript
// Add to email.worker.ts emailTemplates

'staff-activation': {
  subject: 'Welcome to HTA Calibration System',
  body: (data) => `
    Hello ${data.userName},

    Your account has been created for the HTA Calibration System.

    To activate your account and set your password:
    ${data.activationUrl}

    This link will expire in 7 days.

    Best regards,
    HTA Instrumentation (P) Ltd.
  `,
},

'certificate-for-review': {
  subject: 'Certificate ${certificateNumber} Ready for Review',
  body: (data) => `
    Hello ${data.reviewerName},

    A certificate has been submitted for your review.

    Certificate: ${data.certificateNumber}
    Submitted by: ${data.assigneeName}
    Customer: ${data.customerName}

    Please log in to review:
    ${data.dashboardUrl}

    Best regards,
    HTA Calibration System
  `,
},

'certificate-revision-requested': {
  subject: 'Revision Requested - ${certificateNumber}',
  body: (data) => `
    Hello ${data.assigneeName},

    Your certificate requires revision.

    Certificate: ${data.certificateNumber}
    Requested by: ${data.reviewerName}

    Please log in to view feedback and make changes:
    ${data.certificateUrl}

    Best regards,
    HTA Calibration System
  `,
},

'certificate-approved-internal': {
  subject: 'Certificate ${certificateNumber} Approved',
  body: (data) => `
    Hello ${data.assigneeName},

    Your certificate has been approved and is ready to send to the customer.

    Certificate: ${data.certificateNumber}
    Approved by: ${data.reviewerName}

    Best regards,
    HTA Calibration System
  `,
},

'certificate-customer-approved': {
  subject: 'Customer Approved Certificate ${certificateNumber}',
  body: (data) => `
    Hello,

    Great news! The customer has approved certificate ${data.certificateNumber}.

    Customer: ${data.customerName}
    Certificate: ${data.certificateNumber}

    The certificate is now finalized.

    Best regards,
    HTA Calibration System
  `,
},

'password-changed': {
  subject: 'Your Password Has Been Changed',
  body: (data) => `
    Hello ${data.userName},

    This is to confirm that your password for the HTA Calibration Portal was successfully changed.

    If you made this change, no further action is needed.

    If you did NOT change your password, please contact support immediately as your account may have been compromised.

    Time of change: ${data.changedAt}

    Best regards,
    HTA Instrumentation (P) Ltd.
  `,
},
```

#### 2.3 Integration Points

**When Certificate Sent to Customer:**
```typescript
// src/app/api/certificates/[id]/send-to-customer/route.ts

// After transaction, add email:
await enqueue('email:send', {
  to: customerEmail,
  template: 'customer-review',
  templateData: {
    certificateNumber: certificate.certificateNumber,
    customerName: customerName,
    reviewUrl: reviewUrl,
  },
})
```

**When Staff User Created:**
```typescript
// src/app/api/admin/users/route.ts (POST)

// After creating user with activation token:
await enqueue('email:send', {
  to: email,
  template: 'staff-activation',
  templateData: {
    userName: name,
    activationUrl: `${baseUrl}/activate/${activationToken}`,
  },
})
```

#### 2.4 Email Preferences (Future)

Allow users to control which emails they receive:

```prisma
model EmailPreference {
  id        String   @id @default(uuid())
  userId    String?  @unique
  customerId String? @unique

  // Notification preferences
  certificateUpdates  Boolean @default(true)
  chatMessages        Boolean @default(true)
  weeklyDigest        Boolean @default(false)

  user      User?         @relation(fields: [userId], references: [id])
  customer  CustomerUser? @relation(fields: [customerId], references: [id])
}
```

#### 2.5 Customer Email Access (Non-Portal Users)

**Status: ✅ IMPLEMENTED (April 2026)**

**Business Context:**
The full customer portal with activity history and team management is a **paid feature**. Many customers will not have portal access and will instead receive certificates via email with one-time access links.

**Two Customer Touchpoints:**

| Stage | Trigger | Customer Action | Link Type | Status |
|-------|---------|-----------------|-----------|--------|
| **Review Stage** | Reviewer approves cert → sends to customer | Review & Approve/Reject | One-time review link | ✅ |
| **Download Stage** | Admin authorizes cert → sends finalized PDF | View & Download | One-time download link | ✅ |

### 2.5 Implementation Summary

#### Database Models Implemented

**DownloadToken Model:**
```prisma
model DownloadToken {
  id            String    @id @default(uuid())
  token         String    @unique
  certificateId String
  customerEmail String
  customerName  String
  expiresAt     DateTime
  downloadedAt  DateTime?
  downloadCount Int       @default(0)
  maxDownloads  Int       @default(5)
  createdAt     DateTime  @default(now())
  sentById      String?

  certificate   Certificate @relation(...)
  sentBy        User?       @relation(...)
  accessLogs    TokenAccessLog[]
}
```

**TokenAccessLog Model:**
```prisma
model TokenAccessLog {
  id            String    @id @default(uuid())
  tokenType     String    // 'REVIEW' | 'DOWNLOAD'
  tokenId       String
  action        String    // 'VIEWED' | 'DOWNLOADED' | 'APPROVED' | 'REJECTED'
  ipAddress     String?
  userAgent     String?
  createdAt     DateTime  @default(now())

  downloadToken DownloadToken? @relation(...)
}
```

#### API Endpoints Implemented

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/api/admin/certificates/[id]/send-download-link` | POST | Create & send download link | ✅ |
| `/api/admin/certificates/[id]/send-download-link` | GET | Get link history for cert | ✅ |
| `/api/customer/download/[token]` | GET | Validate token & get cert info | ✅ |
| `/api/customer/download/[token]/pdf` | GET | Download PDF (increments counter) | ✅ |

#### Pages Implemented

| Route | Description | Status |
|-------|-------------|--------|
| `/customer/download/[token]` | Public download page (no auth required) | ✅ |

**Download Page Features:**
- Token validation with loading state
- Certificate details display (number, instrument, serial, dates)
- Download button with count tracking
- Shows remaining downloads (out of 5)
- Shows days until link expiration
- Error handling for invalid/expired/exhausted tokens
- Upsell section for full customer portal

#### Staff Activation Flow Implemented

**User Model Fields:**
```prisma
model User {
  activationToken      String?   @unique
  activationExpiry     DateTime?
  activatedAt          DateTime?
  isActive             Boolean   @default(false)
}
```

**Endpoints:**
| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/api/auth/activate` | GET | Validate activation token | ✅ |
| `/api/auth/activate` | POST | Activate account & set password | ✅ |

**Page:** `/app/(auth)/activate/[token]/page.tsx`
- Token validation on mount
- Shows user name and email
- Password requirements checker (real-time)
- Confirm password matching
- Success redirect to login

### Original Flow Diagram (Reference)

**Flow Diagram:**
```
┌─────────────────────────────────────────────────────────────────────────────┐
│                        CERTIFICATE WORKFLOW                                  │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Engineer          Reviewer           Admin              Customer           │
│     │                 │                 │                    │              │
│     │  Submit for     │                 │                    │              │
│     │  Review         │                 │                    │              │
│     │────────────────>│                 │                    │              │
│     │                 │                 │                    │              │
│     │                 │  Approve &      │                    │              │
│     │                 │  Send to        │                    │              │
│     │                 │  Customer       │                    │              │
│     │                 │─────────────────│───── EMAIL ───────>│              │
│     │                 │                 │    (Review Link)   │              │
│     │                 │                 │                    │              │
│     │                 │                 │              ┌─────┴─────┐        │
│     │                 │                 │              │  REVIEW   │        │
│     │                 │                 │              │   PAGE    │        │
│     │                 │                 │              │ (no login)│        │
│     │                 │                 │              └─────┬─────┘        │
│     │                 │                 │                    │              │
│     │                 │                 │<───── Approve ─────│              │
│     │                 │                 │                    │              │
│     │                 │                 │  Authorize &       │              │
│     │                 │                 │  Sign Cert         │              │
│     │                 │                 │                    │              │
│     │                 │                 │─────── EMAIL ─────>│              │
│     │                 │                 │   (Download Link)  │              │
│     │                 │                 │                    │              │
│     │                 │                 │              ┌─────┴─────┐        │
│     │                 │                 │              │ DOWNLOAD  │        │
│     │                 │                 │              │   PAGE    │        │
│     │                 │                 │              │ (no login)│        │
│     │                 │                 │              └───────────┘        │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

##### 2.5.1 Review Stage Email (Existing - Needs Email Trigger)

**Current State:**
- Token-based review system exists (`ApprovalToken` model)
- Review page exists at `/customer/review/[token]`
- In-app notification created but **NO EMAIL SENT**

**Required Change:**
Add email trigger when certificate is sent to customer for approval.

**Email Template:**
```typescript
'customer-review-request': {
  subject: 'Calibration Certificate Ready for Your Approval - ${certificateNumber}',
  body: (data) => `
    Dear ${data.customerName},

    A calibration certificate is ready for your review and approval.

    ─────────────────────────────────────────
    Certificate Details
    ─────────────────────────────────────────
    Certificate Number: ${data.certificateNumber}
    Instrument: ${data.instrumentDescription}
    Customer: ${data.companyName}
    ─────────────────────────────────────────

    Please click the link below to review and approve the certificate:

    ${data.reviewUrl}

    ⚠️ This link will expire in 7 days.

    What you can do:
    • View the full certificate details
    • Approve the certificate
    • Request revisions if changes are needed
    • Send messages to our team

    If you have questions, please reply to this email or contact us.

    Best regards,
    HTA Instrumentation (P) Ltd.

    ─────────────────────────────────────────
    This is an automated message. Please do not reply directly.
    For support, contact: support@htainstrumentation.com
  `,
}
```

**Integration Point:**
```typescript
// src/app/api/certificates/[id]/send-to-customer/route.ts

// After creating ApprovalToken:
await enqueue('email:send', {
  to: customerEmail,
  template: 'customer-review-request',
  templateData: {
    customerName: customerName,
    certificateNumber: certificate.certificateNumber,
    instrumentDescription: certificate.uucDescription,
    companyName: certificate.customerName,
    reviewUrl: `${baseUrl}/customer/review/${token}`,
  },
})
```

##### 2.5.2 Download Stage Email (New Feature)

**Current State:**
- After admin authorization, certificate is finalized
- PDF is generated and stored
- **NO mechanism to send finalized cert to customer via email**

**Required Implementation:**

**A. Database Changes:**
```prisma
model DownloadToken {
  id            String    @id @default(uuid())
  token         String    @unique
  certificateId String
  customerEmail String
  customerName  String
  expiresAt     DateTime
  downloadedAt  DateTime?
  downloadCount Int       @default(0)
  maxDownloads  Int       @default(5)  // Limit downloads
  createdAt     DateTime  @default(now())

  certificate   Certificate @relation(fields: [certificateId], references: [id])
}
```

**B. New API Endpoints:**

| Method | Endpoint | Description |
|--------|----------|-------------|
| POST | `/api/admin/certificates/[id]/send-download-link` | Admin sends download link to customer |
| GET | `/api/customer/download/[token]` | Validate token & get cert info |
| GET | `/api/customer/download/[token]/pdf` | Download the PDF |

**C. New Page:**
```
/customer/download/[token]/page.tsx
```

**Page Wireframe:**
```
┌─────────────────────────────────────────────────────────────────┐
│                                                                 │
│     [HTA Logo]                                                  │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│     ✓ Your Calibration Certificate is Ready                    │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│     Certificate Number:    CAL-2026-001234                      │
│     Instrument:            Digital Multimeter DMM-500           │
│     Calibration Date:      April 5, 2026                        │
│     Valid Until:           April 5, 2027                        │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│     ┌─────────────────────────────────────────────────────┐    │
│     │                                                     │    │
│     │              [PDF Preview Thumbnail]                │    │
│     │                                                     │    │
│     └─────────────────────────────────────────────────────┘    │
│                                                                 │
│               [ Download Certificate (PDF) ]                    │
│                                                                 │
│     Downloads remaining: 4 of 5                                 │
│     Link expires: April 12, 2026                                │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│                                                                 │
│     Need full portal access? Contact us to set up your          │
│     customer account with complete certificate history.         │
│                                                                 │
│                        [Contact Us]                             │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

**D. Email Template:**
```typescript
'certificate-download-ready': {
  subject: 'Your Calibration Certificate is Ready - ${certificateNumber}',
  body: (data) => `
    Dear ${data.customerName},

    Great news! Your calibration certificate has been completed and is ready for download.

    ─────────────────────────────────────────
    Certificate Details
    ─────────────────────────────────────────
    Certificate Number: ${data.certificateNumber}
    Instrument: ${data.instrumentDescription}
    Serial Number: ${data.serialNumber}
    Calibration Date: ${data.calibrationDate}
    ─────────────────────────────────────────

    Click the link below to download your certificate:

    ${data.downloadUrl}

    ⚠️ Important:
    • This link will expire in 7 days
    • Maximum 5 downloads allowed
    • Save a copy for your records

    ─────────────────────────────────────────
    Want More?
    ─────────────────────────────────────────
    Upgrade to our Customer Portal for:
    ✓ Complete certificate history
    ✓ Calibration reminders
    ✓ Team access management
    ✓ Instrument tracking

    Contact us at portal@htainstrumentation.com to learn more.

    Best regards,
    HTA Instrumentation (P) Ltd.
  `,
}
```

**E. Admin UI for Sending Download Link:**

Add to certificate detail page (after authorization):

```
┌─────────────────────────────────────────────────────────────────┐
│  Send to Customer                                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  The certificate has been authorized and signed.                │
│  Send the download link to the customer.                        │
│                                                                 │
│  Customer Email: [john.smith@acme.com_________]                 │
│  Customer Name:  [John Smith__________________]                 │
│                                                                 │
│  ☑ Include certificate summary in email                        │
│  ☐ CC: Admin (you)                                              │
│                                                                 │
│  [Cancel]                          [Send Download Link]         │
│                                                                 │
│  ─────────────────────────────────────────────────────────────  │
│  Previously sent:                                               │
│  • john.smith@acme.com - Apr 5, 2026 (Downloaded 2x)           │
│  • jane.doe@acme.com - Apr 5, 2026 (Not yet downloaded)        │
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

##### 2.5.3 Portal vs Non-Portal Customer Comparison

| Feature | Non-Portal (Email Links) | Portal (Paid) |
|---------|-------------------------|---------------|
| Review certificates | ✅ One-time link | ✅ Full access |
| Approve/reject | ✅ Via link | ✅ Via portal |
| Download finalized cert | ✅ One-time link (5 max) | ✅ Unlimited |
| Certificate history | ❌ | ✅ Full history |
| Multiple team members | ❌ | ✅ Team management |
| Activity log | ❌ | ✅ Full audit trail |
| Calibration reminders | ❌ | ✅ Automated |
| Chat with HTA | ✅ Limited (during review) | ✅ Full access |
| Instrument tracking | ❌ | ✅ Full tracking |

##### 2.5.4 Security Considerations

**Token Security:**
- Tokens are UUID v4 (cryptographically random)
- 7-day expiry for review links
- 7-day expiry for download links
- Download links have max download count (default: 5)
- All token access logged with IP address

**Rate Limiting:**
- Token validation: 10 requests per minute per IP
- PDF download: 5 requests per minute per token
- Failed token attempts: 5 per hour per IP (then block)

**Audit Trail:**
```prisma
model TokenAccessLog {
  id          String   @id @default(uuid())
  tokenType   String   // 'REVIEW' | 'DOWNLOAD'
  tokenId     String
  action      String   // 'VIEWED' | 'DOWNLOADED' | 'APPROVED' | 'REJECTED'
  ipAddress   String
  userAgent   String?
  createdAt   DateTime @default(now())
}
```

---

## 3. API Rate Limiting & Server Architecture

### Current State

**Status: ✅ PARTIALLY IMPLEMENTED (April 2026)**

| Feature | Status | Notes |
|---------|--------|-------|
| Monolithic Next.js application | Current | API separation planned for Phase 9 |
| Rate limiting on auth endpoints | ✅ Implemented | Using existing cache infrastructure |
| Account lockout | ✅ Implemented | 5 failed attempts → 15 min lockout |
| CORS configuration | ✅ Implemented | Ready for API separation |
| API server separation | ⏳ Future | Phase 9 |

### Risks (Updated)

| Risk | Original Status | Current Status |
|------|-----------------|----------------|
| DDoS Vulnerability | 🔴 Unprotected | 🟡 Partial - App-level rate limiting; Cloud Armor recommended for full protection |
| Brute Force Attacks | 🔴 Unprotected | 🟢 Mitigated - Login rate limiting + account lockout |
| Resource Exhaustion | 🟡 Possible | 🟡 Possible - API separation would fully address |
| Cost Overruns | 🟡 Possible | 🟡 Partial - Auth endpoints protected; general API limits can be added |

### Implemented Architecture

#### 3.1 Short-term: Rate Limiting ✅ IMPLEMENTED

**What was originally proposed:**

| Option | Description | Status |
|--------|-------------|--------|
| Option A: Upstash Redis | External SaaS rate limiting | ❌ Not used - avoided new dependency |
| Option B: Cloud Armor | WAF at load balancer | ⏳ Future - for DDoS protection |

**What was actually implemented:**

Used **existing cache infrastructure** (Phase 3) for application-level rate limiting:

```
┌─────────────────────────────────────────────────────────────────────────┐
│                    CURRENT ARCHITECTURE                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   ┌─────────────────┐                                                    │
│   │  GCP Load       │                                                    │
│   │  Balancer       │  ← Future: Add Cloud Armor here for DDoS          │
│   └────────┬────────┘                                                    │
│            │                                                             │
│            ▼                                                             │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │  Cloud Run (Next.js Monolith)                                │       │
│   │                                                              │       │
│   │  ┌──────────────┐  ┌──────────────┐  ┌──────────────┐       │       │
│   │  │  Middleware  │  │  API Routes  │  │   Pages      │       │       │
│   │  │  • CORS      │→ │  • Auth      │  │  • Dashboard │       │       │
│   │  │  • Headers   │  │  • Certs     │  │  • Admin     │       │       │
│   │  └──────────────┘  └──────┬───────┘  └──────────────┘       │       │
│   │                           │                                  │       │
│   │                    ┌──────▼───────┐                          │       │
│   │                    │ Rate Limiter │ ✅ NEW                   │       │
│   │                    │ (cache-based)│                          │       │
│   │                    └──────┬───────┘                          │       │
│   │                           │                                  │       │
│   └───────────────────────────│──────────────────────────────────┘       │
│                               │                                          │
│                    ┌──────────▼──────────┐                               │
│                    │  Redis (prod) /     │                               │
│                    │  Memory (dev)       │                               │
│                    └─────────────────────┘                               │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

**Implementation Details:**

| Endpoint | Limit | Window | Location |
|----------|-------|--------|----------|
| Login (POST `/api/auth/[...nextauth]`) | 5 requests | 15 minutes | `src/app/api/auth/[...nextauth]/route.ts` |
| Registration (POST `/api/customer/register`) | 3 requests | 1 hour | `src/app/api/customer/register/route.ts` |
| Account Lockout | 5 failed attempts | 15 min lockout | `src/lib/auth.ts` |

**Files:**
- `src/lib/security/rate-limiter.ts` - Core rate limiting logic
- `src/lib/security/with-rate-limit.ts` - HOF wrapper for routes
- `src/lib/security/index.ts` - Barrel exports

**Why this approach:**
- ✅ No new dependencies (reuses Phase 3 cache)
- ✅ Works in dev (Memory) and prod (Redis)
- ✅ Easy to extend to other endpoints
- ✅ Cloud Armor can be added later as additional layer

#### 3.1.1 Future Enhancement: GCP Cloud Armor

Cloud Armor should be added for production-grade DDoS protection:

```yaml
# cloud-armor-policy.yaml (Future Implementation)
securityPolicy:
  name: hta-api-protection
  rules:
    - action: rate_based_ban
      match:
        versionedExpr: SRC_IPS_V1
        config:
          srcIpRanges: ['*']
      rateLimitOptions:
        rateLimitThreshold:
          count: 1000
          intervalSec: 60
        banThreshold:
          count: 10000
          intervalSec: 600
        banDurationSec: 3600
      priority: 1000

    # Block known bad actors
    - action: deny(403)
      match:
        expr:
          expression: "origin.region_code == 'XX'"
      priority: 900
```

**When to implement:** Phase 9 or when traffic warrants infrastructure-level protection.

#### 3.2 Medium-term: API Server Separation

**Status:** ⏳ Planned for Phase 9

**Architecture Diagram:**
```
                    ┌─────────────────┐
                    │   Cloud Load    │
                    │    Balancer     │  + Cloud Armor (WAF)
                    └────────┬────────┘
                             │
              ┌──────────────┼──────────────┐
              │              │              │
              ▼              ▼              ▼
       ┌─────────────┐ ┌─────────────┐ ┌─────────────┐
       │  Frontend   │ │  API Server │ │   Worker    │
       │   (SSR)     │ │  (REST/tRPC)│ │  (Jobs)     │
       │             │ │             │ │             │
       │ Next.js     │ │ Next.js API │ │ Queue Proc  │
       │ Pages/App   │ │ Routes Only │ │ Email/Notif │
       └─────────────┘ └─────────────┘ └─────────────┘
              │              │              │
              │         CORS enabled        │
              │     (already configured)    │
              └──────────────┼──────────────┘
                             │
                    ┌────────▼────────┐
                    │    Cloud SQL    │
                    │   PostgreSQL    │
                    └─────────────────┘
```

**Prerequisites Already Implemented (Phase 4):**

| Prerequisite | Status | Notes |
|--------------|--------|-------|
| CORS configuration | ✅ Ready | Set `CORS_ALLOWED_ORIGINS` when separating |
| Rate limiting | ✅ Ready | Works with Redis, will carry over to API service |
| Security headers | ✅ Ready | Will need to be applied to both services |
| Service token header | ✅ Ready | `X-Service-Token` already in CORS allowed headers |

**Benefits:**
- Independent scaling of API vs frontend
- API can be deployed to Cloud Run with higher memory/CPU
- Frontend can use edge caching (Cloud CDN)
- Worker isolated for background job processing
- Better resource allocation and cost control

**Implementation Steps:**

1. **Extract API Routes**
   - Create `apps/api` directory (or separate repo)
   - Move `/api/*` routes to standalone Express/Fastify server
   - Keep shared code in `packages/shared`

2. **Configure CORS for Separation**
   ```bash
   # API Server environment
   CORS_ALLOWED_ORIGINS=https://frontend.example.com,https://staging.example.com
   ```

3. **Configure Load Balancer**
   - Route `/api/*` to API service
   - Route `/*` to Frontend service
   - Configure health checks
   - Add Cloud Armor security policy

4. **Deploy Worker Service**
   - Separate Cloud Run service for queue processing
   - Configure Cloud Scheduler to trigger `processJobs()`
   - Auto-scale based on queue depth

#### 3.3 Authentication Between Services

```typescript
// Service-to-service auth using signed tokens

interface ServiceToken {
  service: 'frontend' | 'worker' | 'api'
  timestamp: number
  signature: string
}

// API validates requests from frontend/worker
function validateServiceToken(token: ServiceToken): boolean {
  const expectedSig = sign(`${token.service}:${token.timestamp}`, SERVICE_SECRET)
  return token.signature === expectedSig &&
         Date.now() - token.timestamp < 60000 // 1 min validity
}
```

---

## 4. Caching Strategy

### Current State

~~- No caching layer implemented~~
~~- Every request hits database directly~~
~~- Static assets served without cache headers~~
~~- No query result caching~~

**Status: ✅ IMPLEMENTED (April 2026)**

### Implementation Details

#### 4.0.1 Cache Infrastructure Created

**Files Created:**
| File | Description |
|------|-------------|
| `src/lib/cache/types.ts` | Cache interfaces, CacheKeys, CacheTTL presets |
| `src/lib/cache/providers/memory.ts` | In-memory cache with TTL and auto-cleanup |
| `src/lib/cache/providers/redis.ts` | Redis cache using ioredis with TLS support |
| `src/lib/cache/index.ts` | Main cache service with auto-provider selection |
| `src/lib/cache/invalidation.ts` | Event-based cache invalidation |

**Terraform Infrastructure:**
| File | Description |
|------|-------------|
| `terraform/modules/memorystore/main.tf` | GCP Memorystore Redis instance |
| `terraform/modules/memorystore/variables.tf` | Configurable tier, memory, version |
| `terraform/modules/memorystore/outputs.tf` | Redis host, port, auth outputs |
| `terraform/environments/dev/main.tf` | Dev: BASIC tier, 1GB |
| `terraform/environments/prod/main.tf` | Prod: STANDARD_HA tier, 2GB |

#### 4.0.2 Cache Keys & TTL Presets

```typescript
// src/lib/cache/types.ts
export const CacheKeys = {
  user: (id: string) => `user:${id}`,
  dropdownAdmins: () => `dropdown:admins`,
  dropdownCustomers: () => `dropdown:customers`,
  dropdownReviewers: (userId: string) => `dropdown:reviewers:${userId}`,
  adminDashboard: () => `dashboard:admin`,
  engineerDashboard: (userId: string) => `dashboard:engineer:${userId}`,
  engineerCertificates: (userId: string) => `certs:engineer:${userId}`,
  customerDashboard: (email: string) => `dashboard:customer:${email}`,
  certificateStats: () => `certs:stats`,
  // ... more keys
}

export const CacheTTL = {
  VERY_SHORT: 30,   // 30 seconds
  SHORT: 60,        // 1 minute
  MEDIUM: 300,      // 5 minutes
  LONG: 600,        // 10 minutes
  VERY_LONG: 3600,  // 1 hour
}
```

#### 4.0.3 Caching Applied To

| Endpoint | Cache Key | TTL | Notes |
|----------|-----------|-----|-------|
| `GET /api/admin/users/admins` | `dropdown:admins` | 10 min | Admin dropdown |
| `GET /api/users/reviewers` | `reviewers:{userId}` | 1 min | User-specific |
| `GET /api/customers/search` | `customers:search:{query}:{limit}` | 2 min | Query-specific |
| `GET /api/admin/certificates` | `admin:certs:{params}` | 30 sec | Query-specific |
| Admin Dashboard | `dashboard:admin` | 1 min | Global stats |
| Engineer Dashboard | `dashboard:engineer:{userId}` | 30 sec | User-specific |
| Customer Dashboard | `dashboard:customer:{email}` | 30 sec | User-specific |

#### 4.0.4 Cache Invalidation Added To

| Endpoint | Invalidation Event |
|----------|-------------------|
| `POST /api/certificates` | `certificate:created` |
| `PUT /api/certificates/[id]` | `certificate:updated` |
| `POST /api/certificates/[id]/submit` | `certificate:status_changed` |
| `POST /api/certificates/[id]/review` (approve) | `certificate:status_changed` |
| `POST /api/certificates/[id]/review` (revision) | `certificate:status_changed` |
| `POST /api/certificates/[id]/review` (reject) | `certificate:status_changed` |

#### 4.0.5 Cache Debug Logging Options

Three approaches for cache logging (Option 1 implemented):

**Option 1: Environment-Based (✅ Implemented)**
```typescript
// src/lib/cache/index.ts
const DEBUG_CACHE = process.env.NODE_ENV === 'development'

export function logCache(message: string, data?: Record<string, unknown>): void {
  if (DEBUG_CACHE) {
    console.log(`[Cache] ${message}`, data || '')
  }
}
```
- Logs HIT, MISS, SET, INVALIDATE operations
- Zero overhead in production
- Enabled automatically in development

**Option 2: Log Level Configuration (Alternative)**
```typescript
// Would require env var: CACHE_LOG_LEVEL=debug|info|error
const levels = { debug: 0, info: 1, error: 2 }
const CACHE_LOG_LEVEL = process.env.CACHE_LOG_LEVEL || 'error'

function logCache(level: string, message: string) {
  if (levels[level] >= levels[CACHE_LOG_LEVEL]) {
    console.log(message)
  }
}
```

**Option 3: Metrics Instead of Logs (Future)**
- Use GCP Cloud Monitoring custom metrics
- Track hit/miss ratios via observability dashboards
- Better for production monitoring at scale

#### 4.0.6 Provider Auto-Selection

```typescript
// Automatic provider selection based on environment
if (REDIS_HOST configured && healthy) {
  use Redis provider (production)
} else {
  use Memory provider (development/fallback)
}
```

### Performance Impact Analysis

| Query Type | Frequency | Avg. Time | Cache Benefit |
|------------|-----------|-----------|---------------|
| User session lookup | Every request | ~20ms | High |
| Dashboard stats | Page load | ~150ms | High |
| Certificate list | Page load | ~200ms | Medium |
| Customer list (admin) | Page load | ~100ms | Medium |
| Single certificate | Form load | ~50ms | Low |
| Dropdown options | Form load | ~30ms | High |

### Caching Layers

#### 4.1 Layer 1: Browser/CDN Caching (Static Assets)

**Next.js Configuration:**
```typescript
// next.config.js
module.exports = {
  async headers() {
    return [
      {
        source: '/_next/static/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' }
        ],
      },
      {
        source: '/images/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=86400, stale-while-revalidate=604800' }
        ],
      },
    ]
  },
}
```

**GCP Cloud CDN:**
```yaml
# Enable CDN on load balancer backend
backendBuckets:
  - name: static-assets
    bucketName: hta-static-assets
    enableCdn: true
    cdnPolicy:
      cacheMode: CACHE_ALL_STATIC
      defaultTtl: 86400
      maxTtl: 604800
```

#### 4.2 Layer 2: Application-Level Caching (Redis/Memorystore)

**Cache Keys and TTLs:**

| Key Pattern | Data | TTL | Invalidation |
|-------------|------|-----|--------------|
| `user:{id}` | User profile | 5 min | On user update |
| `session:{token}` | Session data | 30 min | On logout |
| `stats:user:{id}` | Dashboard stats | 1 min | On cert status change |
| `certs:list:{userId}:{page}` | Certificate list | 30 sec | On any cert update |
| `customers:list:{page}` | Customer list | 2 min | On customer change |
| `dropdown:admins` | Admin list | 10 min | On admin change |
| `dropdown:customers` | Customer names | 5 min | On customer change |

**Implementation with Upstash Redis:**

```typescript
// src/lib/cache.ts

import { Redis } from '@upstash/redis'

const redis = Redis.fromEnv()

interface CacheOptions {
  ttl?: number  // seconds
  tags?: string[]  // for invalidation
}

export async function cached<T>(
  key: string,
  fn: () => Promise<T>,
  options: CacheOptions = {}
): Promise<T> {
  const { ttl = 300 } = options

  // Try cache first
  const cached = await redis.get<T>(key)
  if (cached !== null) {
    return cached
  }

  // Execute function and cache result
  const result = await fn()
  await redis.setex(key, ttl, JSON.stringify(result))

  return result
}

export async function invalidate(pattern: string): Promise<void> {
  const keys = await redis.keys(pattern)
  if (keys.length > 0) {
    await redis.del(...keys)
  }
}
```

**Usage Example:**

```typescript
// Before (no cache)
const stats = await getStats(userId)

// After (with cache)
const stats = await cached(
  `stats:user:${userId}`,
  () => getStats(userId),
  { ttl: 60 }
)
```

#### 4.3 Layer 3: Database Query Caching

**Prisma Accelerate (Managed):**

```typescript
// prisma/schema.prisma
generator client {
  provider = "prisma-client-js"
  previewFeatures = ["accelerate"]
}

// Usage with caching
const certificates = await prisma.certificate.findMany({
  where: { createdById: userId },
  cacheStrategy: {
    ttl: 30,
    swr: 60,  // stale-while-revalidate
  },
})
```

**Or Self-Hosted Query Cache:**

```typescript
// Wrap Prisma with caching layer
const cachedPrisma = new Proxy(prisma, {
  get(target, prop) {
    if (prop === 'certificate') {
      return {
        findMany: async (args) => {
          const cacheKey = `query:cert:${JSON.stringify(args)}`
          return cached(cacheKey, () => target.certificate.findMany(args), { ttl: 30 })
        },
        // ... other methods
      }
    }
    return target[prop]
  },
})
```

#### 4.4 Cache Invalidation Strategy

**Event-Based Invalidation:**

```typescript
// src/lib/cache/invalidation.ts

const invalidationRules: Record<string, string[]> = {
  'certificate:created': ['certs:list:*', 'stats:*'],
  'certificate:updated': ['certs:list:*', 'stats:*', 'cert:{id}'],
  'certificate:status_changed': ['certs:list:*', 'stats:*'],
  'customer:created': ['customers:list:*', 'dropdown:customers'],
  'customer:updated': ['customers:list:*', 'dropdown:customers', 'customer:{id}'],
  'user:updated': ['user:{id}', 'dropdown:admins'],
}

export async function onEntityChange(
  event: string,
  entityId?: string
): Promise<void> {
  const patterns = invalidationRules[event] || []

  for (const pattern of patterns) {
    const finalPattern = pattern.replace('{id}', entityId || '*')
    await invalidate(finalPattern)
  }
}
```

#### 4.5 Cost Optimization

**Estimated Monthly Costs (GCP):**

| Service | Without Cache | With Cache | Savings |
|---------|--------------|------------|---------|
| Cloud SQL | $150 | $100 | 33% |
| Cloud Run (CPU) | $80 | $50 | 37% |
| Network Egress | $30 | $15 | 50% |
| Memorystore Redis | $0 | $25 | - |
| **Total** | **$260** | **$190** | **27%** |

**Note:** Actual savings depend on traffic patterns. Higher traffic = greater savings.

---

## 5. Secrets Management

### Current State

**Status: ✅ IMPLEMENTED (April 2026)**

#### 5.0.1 What's Implemented ✅

**Environment Variables:**
- `.env` and `.env.example` files with comprehensive documentation
- Environment variable structure for all services:
  - Database credentials (`DATABASE_URL`)
  - NextAuth secrets (`NEXTAUTH_SECRET`, `NEXTAUTH_URL`)
  - Email service (`RESEND_API_KEY`)
  - Storage configuration (`GCS_BUCKET`, `STORAGE_PROVIDER`)
  - Feature flags
  - Cache configuration

**Terraform Secret Manager Module:**
- `terraform/modules/secrets/` - GCP Secret Manager infrastructure
- Service account for secret access
- IAM bindings for Cloud Run/GKE workloads

**K8s External Secrets Integration (GKE):**
- `k8s/base/external-secrets.yaml` - ExternalSecret CRDs for runtime secret syncing
- `k8s/overlays/dev/external-secrets-patch.yaml` - Dev environment secret mappings
- `k8s/overlays/prod/external-secrets-patch.yaml` - Prod environment secret mappings
- Secrets synced from GCP Secret Manager to K8s Secrets at runtime (1-hour refresh)

**Application-Level Secret Fetching (Cloud Run/Universal):**
- `src/lib/secrets/gcp-secrets.ts` - Runtime secret fetching from GCP Secret Manager
- `src/lib/secrets/index.ts` - Barrel exports with typed accessors
- 5-minute cache with automatic refresh, zero-downtime rotation
- Automatic fallback to environment variables for local development
- Version pinning support for rollback scenarios

**CD Pipelines:**
- `.github/workflows/deploy-dev.yml` - Auto-deploys to Cloud Run on merge to main
- `.github/workflows/deploy-prod.yml` - Manual trigger deployment to GKE with approval gates
- `.github/workflows/backup-test.yml` - Monthly automated backup restore verification

**Smoke Tests & Health Endpoints:**
- `src/app/api/smoke-test/route.ts` - Comprehensive post-deployment validation
- `src/app/api/health/route.ts` - Liveness probe (basic health)
- `src/app/api/health/ready/route.ts` - Readiness probe (DB + cache checks)
- `scripts/smoke-tests.sh` - Shell script for local/CI smoke testing

**Documentation:**
- `docs/runbooks/secrets-rotation.md` - Step-by-step rotation procedures with rollback

**Files:**
| File | Description |
|------|-------------|
| `.env.example` | Comprehensive env var documentation |
| `terraform/modules/secrets/main.tf` | Secret Manager resources |
| `terraform/modules/secrets/variables.tf` | Secret configuration |
| `k8s/base/external-secrets.yaml` | K8s External Secrets CRDs |
| `k8s/overlays/*/external-secrets-patch.yaml` | Environment-specific secret mappings |
| `src/lib/secrets/gcp-secrets.ts` | Runtime secret fetching with caching |
| `src/lib/secrets/index.ts` | Barrel exports with typed accessors |
| `.github/workflows/deploy-dev.yml` | Dev CD pipeline (Cloud Run) |
| `.github/workflows/deploy-prod.yml` | Prod CD pipeline (GKE) |
| `.github/workflows/backup-test.yml` | Monthly backup verification |
| `src/app/api/smoke-test/route.ts` | Post-deployment smoke tests |
| `src/app/api/health/route.ts` | Liveness probe endpoint |
| `src/app/api/health/ready/route.ts` | Readiness probe endpoint |
| `scripts/smoke-tests.sh` | Smoke test runner script |
| `docs/runbooks/secrets-rotation.md` | Secrets rotation runbook |
| `tests/unit/secrets.test.ts` | Unit tests for secrets module |

#### 5.0.2 What's Remaining 📋

| Item | Priority | Description |
|------|----------|-------------|
| Local Development Secrets | LOW | Using plaintext .env (acceptable for local dev) |
| Automated Secret Rotation | LOW | Currently manual with documented procedures |
| Secret Versioning Strategy | LOW | Currently using `latest`, can pin versions for rollback |

### 5.1 Implemented Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                    SECRETS ARCHITECTURE                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Development              Staging/Production                    │
│   ───────────              ──────────────────                   │
│                                                                  │
│   ┌─────────────┐         ┌──────────────────┐                  │
│   │   .env      │         │  GCP Secret      │                  │
│   │  (local)    │         │    Manager       │                  │
│   └──────┬──────┘         └────────┬─────────┘                  │
│          │                         │                             │
│          │                         │ Workload Identity           │
│          ▼                         ▼                             │
│   ┌─────────────────────────────────────────┐                   │
│   │           Application Runtime            │                   │
│   │                                          │                   │
│   │  if (NODE_ENV === 'production') {       │                   │
│   │    fetchFromSecretManager()             │                   │
│   │  } else {                                │                   │
│   │    useEnvFile()                          │                   │
│   │  }                                       │                   │
│   └─────────────────────────────────────────┘                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 5.2 Implementation Details ✅ IMPLEMENTED

**Secret Fetching Utility** (`src/lib/secrets/gcp-secrets.ts`):
```typescript
import { getSecret, secrets, initializeSecrets } from '@/lib/secrets'

// Generic getter with options
const apiKey = await getSecret('resend-api-key')
const dbUrl = await getSecret('database-url', { version: '2' }) // Pin to version
const fresh = await getSecret('nextauth-secret', { bypassCache: true }) // Force refresh

// Type-safe getters
const secret = await secrets.nextAuthSecret()
const resend = await secrets.resendApiKey()

// Pre-fetch at startup (optional, improves latency)
await initializeSecrets()
```

**Features:**
- 5-minute cache with automatic refresh
- Fallback to environment variables in development/test
- Version pinning support (`{ version: '2' }`)
- Cache bypass for instant rotation (`{ bypassCache: true }`)
- Lazy-loaded SDK (no import errors in dev)
- Type-safe accessors via `secrets.*` object

**Step 2: Secrets to Migrate to Secret Manager**

| Secret | Current Location | Priority |
|--------|------------------|----------|
| `DATABASE_URL` | .env | HIGH |
| `NEXTAUTH_SECRET` | .env | HIGH |
| `RESEND_API_KEY` | .env | HIGH |
| `REDIS_PASSWORD` | .env | MEDIUM |
| `GCS_SERVICE_ACCOUNT_KEY` | .env | MEDIUM |

**Step 3: Rotation Policy**

| Secret | Rotation Frequency | Method |
|--------|-------------------|--------|
| `NEXTAUTH_SECRET` | 90 days | Manual (causes session invalidation) |
| `DATABASE_URL` | 90 days | Cloud SQL automated |
| `RESEND_API_KEY` | 180 days | Manual via Resend dashboard |

---

## 6. Security

### Current State

**Status: ✅ IMPLEMENTED (April 2026)**

#### 6.0.1 What's Implemented ✅

**Authentication & Authorization:**
| Feature | Status | Location |
|---------|--------|----------|
| NextAuth.js v5 | ✅ | `src/lib/auth.ts` |
| Bcrypt password hashing (rounds=12) | ✅ | `src/lib/auth.ts` |
| Refresh token rotation | ✅ | `src/lib/refresh-token.ts` |
| JWT session tokens | ✅ | NextAuth config |
| Role-based access (ADMIN, ENGINEER, CUSTOMER) | ✅ | `src/lib/auth.ts` |
| Admin tiers (MASTER, WORKER) | ✅ | Schema + helpers |

**Route Protection:**
| Feature | Status | Location |
|---------|--------|----------|
| Middleware route protection | ✅ | `src/middleware.ts` |
| Public routes whitelist | ✅ | middleware |
| Session validation | ✅ | middleware |
| Login redirect with callback | ✅ | middleware |

**Cookie Security:**
| Setting | Value | Status |
|---------|-------|--------|
| HttpOnly | true | ✅ |
| SameSite | lax | ✅ |
| Secure (production) | true | ✅ |
| `__Host-` prefix (prod) | enabled | ✅ |

**Password Security:**
| Feature | Status |
|---------|--------|
| Minimum 8 characters | ✅ |
| Uppercase required | ✅ |
| Lowercase required | ✅ |
| Number required | ✅ |
| Reset token expiry (1 hour) | ✅ |
| Session revocation on change | ✅ |

**Input Validation:**
| Feature | Status | Location |
|---------|--------|----------|
| Zod schema validation | ✅ | API routes |
| Path sanitization | ✅ | `src/lib/storage/local-storage.ts` |
| Directory traversal prevention | ✅ | Storage provider |

**Audit Logging:**
| Feature | Status | Location |
|---------|--------|----------|
| AuditLog database model | ✅ | Prisma schema |
| Password change events | ✅ | API routes |
| User activation events | ✅ | API routes |
| Certificate events | ✅ | CertificateEvent model |

**Security Headers (Added April 2026):**
| Header | Value | Location |
|--------|-------|----------|
| Strict-Transport-Security | `max-age=31536000; includeSubDomains; preload` | `next.config.ts` |
| X-Frame-Options | `DENY` | `next.config.ts` |
| X-Content-Type-Options | `nosniff` | `next.config.ts` |
| X-XSS-Protection | `1; mode=block` | `next.config.ts` |
| Referrer-Policy | `strict-origin-when-cross-origin` | `next.config.ts` |
| Permissions-Policy | `camera=(), microphone=(), geolocation=()` | `next.config.ts` |
| Content-Security-Policy | `default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; ...` | `next.config.ts` |

**Rate Limiting (Added April 2026):**
| Endpoint | Limit | Window | Location |
|----------|-------|--------|----------|
| Login (staff/customer) | 5 requests | 15 minutes | `src/lib/security/rate-limiter.ts` |
| Registration | 3 requests | 1 hour | `src/lib/security/rate-limiter.ts` |
| Forgot Password | 3 requests | 1 hour | `src/lib/security/rate-limiter.ts` |

**Account Lockout (Added April 2026):**
| Setting | Value | Location |
|---------|-------|----------|
| Max failed attempts | 5 | `src/lib/security/rate-limiter.ts` |
| Lockout duration | 15 minutes | `src/lib/security/rate-limiter.ts` |
| Identifier format | `{type}:{email}` | `src/lib/auth.ts` |

**CORS Configuration (Added April 2026):**
| Feature | Status | Location |
|---------|--------|----------|
| Environment-driven origins | ✅ | `src/middleware.ts` |
| Preflight (OPTIONS) handling | ✅ | `src/middleware.ts` |
| Credentials support | ✅ | `src/middleware.ts` |
| Rate limit headers exposed | ✅ | `src/middleware.ts` |
| Ready for API separation | ✅ | Set `CORS_ALLOWED_ORIGINS` env var |

#### 6.0.2 What's Missing / Deferred 📋

| Item | Priority | Status | Reason / Timeline |
|------|----------|--------|-------------------|
| 2FA for admins | MEDIUM | DEFERRED | Optional enhancement; implement when business requires additional admin security. Consider TOTP-based (Google Authenticator) or WebAuthn. |
| CSP with nonces | LOW | DEFERRED | Current CSP uses `unsafe-inline`/`unsafe-eval` required by Next.js. Nonce-based CSP can be added during API separation (Phase 9) when architecture is restructured. |
| HTTPS redirect | LOW | NOT NEEDED | Cloud Run / GCP Load Balancer handles HTTPS termination. All traffic is already HTTPS in production. |

**Previously Missing (Now Implemented):**
| Item | Status | Implemented |
|------|--------|-------------|
| ~~Rate limiting (auth endpoints)~~ | ✅ DONE | April 2026 |
| ~~CSP headers~~ | ✅ DONE | April 2026 |
| ~~Security headers middleware~~ | ✅ DONE | April 2026 |
| ~~CORS configuration~~ | ✅ DONE | April 2026 |
| ~~Account lockout~~ | ✅ DONE | April 2026 |

### 6.1 Security Headers Implementation ✅ IMPLEMENTED

**Location:** `next.config.ts`

#### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                        REQUEST FLOW WITH HEADERS                         │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Browser Request                                                        │
│        │                                                                 │
│        ▼                                                                 │
│   ┌─────────────────┐                                                    │
│   │  GCP Load       │  ← HTTPS termination                               │
│   │  Balancer       │                                                    │
│   └────────┬────────┘                                                    │
│            │                                                             │
│            ▼                                                             │
│   ┌─────────────────┐                                                    │
│   │  Cloud Run      │                                                    │
│   │  ┌───────────┐  │                                                    │
│   │  │ Next.js   │  │  ← Security headers added here                     │
│   │  │ headers() │  │    via next.config.ts                              │
│   │  └───────────┘  │                                                    │
│   └────────┬────────┘                                                    │
│            │                                                             │
│            ▼                                                             │
│   Response with Headers:                                                 │
│   • Strict-Transport-Security (HSTS)                                     │
│   • X-Frame-Options: DENY                                                │
│   �� Content-Security-Policy                                              │
│   • X-Content-Type-Options: nosniff                                      │
│   • Referrer-Policy                                                      │
│   • Permissions-Policy                                                   │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Header Explanations

| Header | Value | Purpose | Threat Mitigated |
|--------|-------|---------|------------------|
| `Strict-Transport-Security` | `max-age=31536000; includeSubDomains; preload` | Forces HTTPS for 1 year, includes subdomains, eligible for browser preload lists | Man-in-the-middle, SSL stripping |
| `X-Frame-Options` | `DENY` | Prevents page from being embedded in iframes anywhere | Clickjacking attacks |
| `X-Content-Type-Options` | `nosniff` | Prevents browser from MIME-sniffing response away from declared content-type | MIME confusion attacks |
| `X-XSS-Protection` | `1; mode=block` | Enables browser's XSS filter (legacy, but harmless) | Reflected XSS (older browsers) |
| `Referrer-Policy` | `strict-origin-when-cross-origin` | Sends full URL for same-origin, only origin for cross-origin | Information leakage via referrer |
| `Permissions-Policy` | `camera=(), microphone=(), geolocation=()` | Disables access to sensitive browser APIs | Malicious scripts accessing hardware |
| `Content-Security-Policy` | See below | Controls which resources can be loaded | XSS, data injection, clickjacking |

#### Content Security Policy Breakdown

```
default-src 'self'           → Only load resources from same origin by default
script-src 'self'            → Scripts only from same origin
  'unsafe-inline'            → Allow inline <script> tags (Next.js requirement)
  'unsafe-eval'              → Allow eval() (Next.js requirement)
style-src 'self'             → Styles only from same origin
  'unsafe-inline'            → Allow inline styles (Next.js requirement)
img-src 'self'               → Images from same origin
  data:                      → Allow data: URIs (base64 images)
  blob:                      → Allow blob: URIs (dynamic images)
  https:                     → Allow images from any HTTPS source
font-src 'self' data:        → Fonts from same origin or data: URIs
connect-src 'self' https:    → API calls to same origin or any HTTPS
frame-ancestors 'none'       → Cannot be embedded in any iframe (like X-Frame-Options)
```

**Note:** `unsafe-inline` and `unsafe-eval` are required for Next.js. Can be tightened with nonces in Phase 9.

#### Implementation

```typescript
// next.config.ts
const securityHeaders = [
  { key: 'X-DNS-Prefetch-Control', value: 'on' },
  { key: 'Strict-Transport-Security', value: 'max-age=31536000; includeSubDomains; preload' },
  { key: 'X-Frame-Options', value: 'DENY' },
  { key: 'X-Content-Type-Options', value: 'nosniff' },
  { key: 'X-XSS-Protection', value: '1; mode=block' },
  { key: 'Referrer-Policy', value: 'strict-origin-when-cross-origin' },
  { key: 'Permissions-Policy', value: 'camera=(), microphone=(), geolocation=()' },
  { key: 'Content-Security-Policy', value: "..." },
]

const nextConfig: NextConfig = {
  async headers() {
    return [{ source: '/:path*', headers: securityHeaders }]
  },
}
```

#### Testing & Verification

**1. Using cURL:**
```bash
# Check headers on any endpoint
curl -I https://your-domain.com

# Expected output includes:
# strict-transport-security: max-age=31536000; includeSubDomains; preload
# x-frame-options: DENY
# x-content-type-options: nosniff
# content-security-policy: default-src 'self'; ...
```

**2. Using Browser DevTools:**
```
1. Open DevTools (F12)
2. Go to Network tab
3. Refresh the page
4. Click on the main document request
5. Check "Response Headers" section
```

**3. Online Security Scanners:**
- [SecurityHeaders.com](https://securityheaders.com) - Grades your headers A-F
- [Mozilla Observatory](https://observatory.mozilla.org) - Comprehensive security scan

**4. Local Development Test:**
```bash
# Start dev server
npm run dev

# Test headers (note: HSTS won't work on localhost HTTP)
curl -I http://localhost:3000
```

**Expected Security Score:** A or A+ on SecurityHeaders.com after deployment

### 6.2 Rate Limiting Implementation ✅ IMPLEMENTED

**Location:** `src/lib/security/rate-limiter.ts`, `src/lib/security/with-rate-limit.ts`

#### Original Options vs Actual Implementation

| Option | Description | Status |
|--------|-------------|--------|
| **Option A:** Upstash Redis | External SaaS, additional dependency & cost | ❌ Not used |
| **Option B:** GCP Cloud Armor | WAF at load balancer, DDoS protection | ⏳ Future enhancement |
| **Actual:** Existing Cache | Uses Phase 3 cache infrastructure (Redis/Memory) | ✅ Implemented |

**Why we chose the existing cache approach:**
- ✅ No new dependencies or services to manage
- ✅ Uses infrastructure already deployed and tested (Phase 3)
- ✅ Works identically in development (Memory) and production (Redis)
- ✅ Cloud Armor can still be added as an additional layer later

#### Architecture

```
┌─────────────────────────────────────────────────────────────────────────┐
│                      RATE LIMITING FLOW                                  │
├─────────────────────────────────────────────────────────────────────────┤
│                                                                          │
│   Client Request (Login/Register)                                        │
│        │                                                                 │
│        ▼                                                                 │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │  API Route Handler                                           │       │
│   │  ┌─────────────────────────────────────────────────────────┐ │       │
│   │  │  checkRateLimitForRequest(request, 'LOGIN')             │ │       │
│   │  │                                                          │ │       │
│   │  │  1. Extract IP from headers (CF, X-Real-IP, X-Forwarded)│ │       │
│   │  │  2. Build cache key: "ratelimit:login:{IP}"             │ │       │
│   │  │  3. Increment counter via cache.incr()                  │ │       │
│   │  │  4. Set TTL on first request                            │ │       │
│   │  │  5. Check if count > limit                              │ │       │
│   │  └─────────────────────────────────────────────────────────┘ │       │
│   └────────────────────────┬────────────────────────────────────┘       │
│                            │                                             │
│              ┌─────────────┴─────���───────┐                              │
│              │                           │                              │
│              ▼                           ▼                              │
│   ┌─────────────────┐         ┌──────────────────���──┐                   │
│   │  count ≤ limit  │         │   count > limit     │                   │
│   │                 │         │                     │                   │
│   │  Continue to    │         │  Return 429 with:   │                   │
│   │  auth handler   │         │  • Retry-After      │                   │
│   └────────┬────────┘         │  • X-RateLimit-*    │                   │
│            │                  └─────────────────────┘                   │
│            ▼                                                             │
│   ┌─────────────────────────────────────────────────────────────┐       │
│   │  Cache (Redis in prod / Memory in dev)                       │       │
│   │                                                              │       │
│   │  Key: "ratelimit:login:192.168.1.1"                         │       │
│   │  Value: 3                                                    │       │
│   │  TTL: 900 seconds (15 min)                                  │       │
│   └─────────────────────────────────────────────────────────────┘       │
│                                                                          │
└─────────────────────────────────────────────────────────────────────────┘
```

#### Algorithm: Fixed Window Counter

```
Request 1 (00:00:00): key doesn't exist
  ��� INCR creates key with value 1
  → EXPIRE sets TTL to 900 seconds
  → count (1) ≤ limit (5) → ALLOW

Request 2 (00:00:05): key exists, value = 1
  → INCR increments to 2
  → count (2) ≤ limit (5) → ALLOW

...

Request 6 (00:01:00): key exists, value = 5
  → INCR increments to 6
  → count (6) > limit (5) → REJECT (429)

Request 7 (00:15:01): key expired (TTL passed)
  → INCR creates new key with value 1
  → EXPIRE sets new TTL
  → count (1) ≤ limit (5) → ALLOW
```

#### Configuration

```typescript
// src/lib/security/rate-limiter.ts
export const RateLimitConfig = {
  LOGIN: {
    limit: 5,                    // Max 5 attempts
    windowSeconds: 15 * 60,      // Per 15 minutes
    keyPrefix: 'ratelimit:login:',
  },
  REGISTRATION: {
    limit: 3,                    // Max 3 registrations
    windowSeconds: 60 * 60,      // Per hour
    keyPrefix: 'ratelimit:register:',
  },
  FORGOT_PASSWORD: {
    limit: 3,                    // Max 3 reset requests
    windowSeconds: 60 * 60,      // Per hour
    keyPrefix: 'ratelimit:forgot:',
  },
}
```

#### Applied Routes

| Route | Rate Limit | Identifier |
|-------|------------|------------|
| `/api/auth/[...nextauth]` (POST) | 5 per 15 min | Client IP |
| `/api/customer/register` (POST) | 3 per hour | Client IP |

#### Response Headers

All responses include rate limit information:

```
X-RateLimit-Limit: 5          # Maximum requests allowed in window
X-RateLimit-Remaining: 3      # Requests remaining
X-RateLimit-Reset: 1712505600 # Unix timestamp when window resets
```

On rate limit exceeded (HTTP 429):
```
Retry-After: 847              # Seconds until retry allowed
```

#### IP Detection Priority

```typescript
// src/lib/security/rate-limiter.ts - getClientIP()
1. CF-Connecting-IP     // Cloudflare (if used)
2. X-Real-IP            // nginx proxy
3. X-Forwarded-For      // Standard proxy (first IP)
4. X-AppEngine-User-IP  // GCP App Engine
5. "unknown-ip"         // Fallback
```

#### Fail-Open Design

If cache is unavailable, requests are **allowed through**:

```typescript
catch (error) {
  console.error('[RateLimiter] Cache error, failing open:', error)
  return { allowed: true, ... }  // Don't block users due to cache issues
}
```

**Rationale:** Availability > strict security during infrastructure issues. A brief cache outage shouldn't lock out all users.

#### Testing & Verification

**1. Manual Testing (cURL):**
```bash
# Make 6 rapid login attempts (5 should succeed, 6th should fail)
for i in {1..6}; do
  echo "Attempt $i:"
  curl -s -o /dev/null -w "%{http_code}\n" \
    -X POST http://localhost:3000/api/auth/callback/credentials \
    -H "Content-Type: application/json" \
    -d '{"email":"test@example.com","password":"wrong"}'
done

# Expected: 200, 200, 200, 200, 200, 429
```

**2. Check Rate Limit Headers:**
```bash
curl -i -X POST http://localhost:3000/api/auth/callback/credentials \
  -H "Content-Type: application/json" \
  -d '{"email":"test@example.com","password":"test"}'

# Look for:
# X-RateLimit-Limit: 5
# X-RateLimit-Remaining: 4
# X-RateLimit-Reset: 1712505600
```

**3. Verify Cache Keys (if Redis):**
```bash
redis-cli KEYS "ratelimit:*"
# Should show: ratelimit:login:127.0.0.1

redis-cli GET "ratelimit:login:127.0.0.1"
# Should show current count

redis-cli TTL "ratelimit:login:127.0.0.1"
# Should show seconds remaining
```

#### Future Enhancement: GCP Cloud Armor

Cloud Armor can be added as an **additional layer** for:
- DDoS protection at edge
- Geo-blocking (block specific countries)
- WAF rules (SQL injection, XSS patterns)
- IP reputation filtering

This would be configured at the load balancer level, before requests reach the application.

### 6.3 Account Lockout Strategy ✅ IMPLEMENTED

**Location:** `src/lib/security/rate-limiter.ts`, `src/lib/auth.ts`

**Implementation:** Integrated into both `staff-credentials` and `customer-credentials` NextAuth providers.

```typescript
// Configuration
export const AccountLockoutConfig = {
  maxFailedAttempts: 5,
  lockoutDurationSeconds: 15 * 60, // 15 minutes
  keyPrefix: 'lockout:',
  failedAttemptsKeyPrefix: 'failed:',
}

// In auth.ts authorize callback:
// 1. Check if locked before credential validation
const lockStatus = await isAccountLocked(`staff:${email}`)
if (lockStatus.locked) return null

// 2. Record failed attempt on invalid credentials
await recordFailedLoginAttempt(`staff:${email}`)

// 3. Clear attempts on successful login
await clearFailedLoginAttempts(`staff:${email}`)
```

**Security Features:**
- Records failed attempts even for non-existent users (prevents enumeration)
- Separate lockout tracking for staff vs customer accounts
- Automatic unlock after lockout duration expires
- Failed attempts counter resets on successful login

### 6.4 CORS Configuration ✅ IMPLEMENTED

**Location:** `src/middleware.ts`, `src/lib/security/cors.ts`

**Current State:** Same-origin (CORS effectively no-op)
**Future State:** Ready for API separation architecture (Section 3.2)

**Implementation:**
```typescript
// Environment-driven configuration
// Set CORS_ALLOWED_ORIGINS when separating frontend/API
function getCorsAllowedOrigins(): string[] {
  const envOrigins = process.env.CORS_ALLOWED_ORIGINS?.split(',')
  if (envOrigins?.length) return envOrigins
  return [process.env.FRONTEND_URL, process.env.NEXTAUTH_URL].filter(Boolean)
}

// Middleware handles:
// 1. OPTIONS preflight requests for /api/* routes
// 2. CORS headers on all API responses
// 3. Localhost allowed in development
```

**When API Separation Happens:**
```bash
# Set in production environment
CORS_ALLOWED_ORIGINS=https://frontend.example.com,https://staging-frontend.example.com
```

**Headers Applied:**
- `Access-Control-Allow-Origin` - Allowed origin (dynamic)
- `Access-Control-Allow-Credentials` - `true`
- `Access-Control-Allow-Methods` - `GET, POST, PUT, DELETE, PATCH, OPTIONS`
- `Access-Control-Allow-Headers` - `Content-Type, Authorization, X-Service-Token, X-CSRF-Token`
- `Access-Control-Expose-Headers` - `X-RateLimit-*` headers
- `Access-Control-Max-Age` - `86400` (24 hour preflight cache)

---

## 7. Monitoring & Observability

### Current State

**Status: ✅ IMPLEMENTED** *(Completed April 2026)*

#### 7.0.1 What's Implemented ✅

| Feature | Status | Location |
|---------|--------|----------|
| Sentry error tracking | ✅ | `sentry.*.config.ts`, `instrumentation.ts` |
| Structured Pino logging | ✅ | `src/lib/logger.ts` |
| GCP Cloud Logging integration | ✅ | Automatic via Cloud Run + Pino JSON |
| Monitoring dashboard (Terraform) | ✅ | `terraform/modules/monitoring/` |
| Alert policies (Terraform) | ✅ | Error rate, latency, CPU alerts |
| Backup monitoring (Terraform) | ✅ | Cloud SQL backup failure alert (prod) |
| Health check endpoint | ✅ | `/api/health` |
| Audit trail (database) | ✅ | AuditLog model |
| In-app notifications | ✅ | `src/lib/services/notifications.ts` |

**Health Check Endpoint:**
```typescript
// GET /api/health returns:
{
  status: 'healthy',
  timestamp: '2026-04-07T...',
  version: '1.0.0',
  uptime: 12345,
  environment: 'production'
}
```

### 7.1 Recommended Monitoring Stack

```
┌─────────────────────────────────────────────────────────────────┐
│                    MONITORING ARCHITECTURE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Application                                                    │
│   ───────────                                                   │
│   ┌─────────────────────────────────────────────────────┐       │
│   │  Next.js Application                                 │       │
│   │                                                      │       │
│   │  ┌──────────┐  ┌──────────┐  ┌──────────────────┐   │       │
│   │  │  Sentry  │  │  Pino    │  │  Custom Metrics  │   │       │
│   │  │  (Errors)│  │  (Logs)  │  │  (Business KPIs) │   │       │
│   │  └────┬─────┘  └────┬─────┘  └────────┬─────────┘   │       │
│   └───────│─────────────│─────────────────│─────────────┘       │
│           │             │                 │                      │
│           ▼             ▼                 ▼                      │
│   ┌──────────────┐ ┌──────────────┐ ┌──────────────┐            │
│   │   Sentry.io  │ │ GCP Cloud    │ │ GCP Cloud    │            │
│   │              │ │ Logging      │ │ Monitoring   │            │
│   └──────────────┘ └──────────────┘ └──────────────┘            │
│                                                                  │
│   Alerting                                                       │
│   ────────                                                      │
│   ┌─────────────────────────────────────────────────────┐       │
│   │  GCP Alerting Policies                               │       │
│   │  • Error rate > 1% → PagerDuty/Slack                │       │
│   │  • Latency p95 > 500ms → Slack                      │       │
│   │  • CPU > 80% → Auto-scale + Alert                   │       │
│   └─────────────────────────────────────────────────────┘       │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### 7.2 Sentry Implementation

**Install:**
```bash
npm install @sentry/nextjs
```

**Configure:**
```typescript
// sentry.client.config.ts
import * as Sentry from '@sentry/nextjs'

Sentry.init({
  dsn: process.env.NEXT_PUBLIC_SENTRY_DSN,
  environment: process.env.NODE_ENV,
  tracesSampleRate: 0.1, // 10% of transactions
  replaysSessionSampleRate: 0.1,
  replaysOnErrorSampleRate: 1.0,
})
```

### 7.3 Structured Logging with Pino

```typescript
// src/lib/logger.ts
import pino from 'pino'

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  formatters: {
    level: (label) => ({ level: label }),
  },
  base: {
    service: 'hta-calibration',
    version: process.env.npm_package_version,
  },
})

// Usage
logger.info({ certificateId, userId }, 'Certificate submitted for review')
logger.error({ err, endpoint }, 'API request failed')
```

### 7.4 Key Metrics to Track

| Metric | Type | Alert Threshold |
|--------|------|-----------------|
| Request latency (p95) | Histogram | > 500ms |
| Error rate | Counter | > 1% |
| Active users | Gauge | - |
| Certificate processing time | Histogram | > 5s |
| Queue depth | Gauge | > 100 |
| Cache hit rate | Gauge | < 50% |
| Database connections | Gauge | > 80% pool |

---


### 7.5 What's Deferred to Phase 9

| Item | Priority | Reason |
|------|----------|--------|
| APM (detailed traces) | LOW | Not needed until microservices |
| Distributed tracing | LOW | Not needed until API separation |
| Custom business metrics | LOW | Can add incrementally as needed |
| PagerDuty/Slack integration | LOW | Email alerts sufficient for now |

## 8. Disaster Recovery

### Current State

**Status: ✅ IMPLEMENTED** *(Backup monitoring added April 2026)*

#### 8.0.1 What's Implemented ✅

**Database Backups (Cloud SQL):**
| Setting | Value | Status |
|---------|-------|--------|
| Automated backups | Daily at 3 AM UTC | ✅ |
| Backup retention | 30 days (prod) / 7 days (dev) | ✅ |
| Point-in-time recovery | Enabled (7 days) | ✅ |
| Regional redundancy (prod) | Enabled | ✅ |

**File Storage (GCS):**
| Feature | Status |
|---------|--------|
| Object versioning | ✅ Enabled on all buckets |
| Lifecycle policies | ✅ Configured |
| Multi-region (prod) | ✅ Configured |

**Lifecycle Policies:**
| Bucket | Policy |
|--------|--------|
| Certificates | Keep 3 versions, COLDLINE after 1 year |
| Signatures | Keep 5 versions |
| Uploads | Auto-delete after 7 days |
| Backups | COLDLINE after 90 days, delete after 2 years |

**Infrastructure:**
| Feature | Status |
|---------|--------|
| Terraform state in GCS | ✅ With versioning |
| All config in Git | ✅ |
| Container images in Artifact Registry | ✅ |

**Monitoring & Alerting:**
| Feature | Status |
|---------|--------|
| Backup failure alerts | ✅ Terraform (`terraform/modules/monitoring/`) |
| Alert threshold | 25 hours without successful backup |
| Notification channel | Email (configured in monitoring module) |

**Documentation:**
- `docs/system_design/16_disaster_recovery.md` - Comprehensive DR plan ✅

#### 8.0.2 RTO/RPO Targets

| Component | RTO | RPO |
|-----------|-----|-----|
| **Overall System** | 4 hours | 1 hour |
| **Database** | 1 hour | 5 minutes |
| **File Storage** | 1 hour | 0 (versioning) |
| **Application** | 30 minutes | N/A |

#### 8.0.3 What's Remaining

| Item | Priority | Description | Status |
|------|----------|-------------|--------|
| Backup failure alerting | HIGH | Alert when backups fail | ✅ Done (Phase 5) |
| Automated backup testing | MEDIUM | Restore and validate backup integrity monthly | ✅ Done (Phase 6) |
| Cross-region replication | LOW | Single region failure risk | ⏳ Phase 9 |
| DR drills schedule | LOW | Regular recovery testing | ⏳ Phase 9 |
| Runbook automation | LOW | Manual recovery steps | ⏳ Phase 9 |

### 8.1 Recovery Procedures

**Database Recovery:**
```bash
# Point-in-time recovery
gcloud sql instances clone SOURCE_INSTANCE TARGET_INSTANCE \
  --point-in-time="2026-04-07T10:00:00Z"

# Restore from backup
gcloud sql backups restore BACKUP_ID \
  --restore-instance=TARGET_INSTANCE
```

**File Recovery:**
```bash
# List object versions
gsutil ls -a gs://hta-certificates-prod/path/to/file

# Restore specific version
gsutil cp gs://hta-certificates-prod/path/to/file#VERSION gs://hta-certificates-prod/path/to/file
```

### 8.2 Deferred to Phase 9

1. **Monthly Backup Testing:**
   - [ ] Restore database to test instance
   - [ ] Verify data integrity
   - [ ] Document recovery time

2. **Cross-Region Setup:**
   - [ ] Secondary Cloud SQL replica in different region
   - [ ] GCS dual-region or multi-region buckets

---

## 9. CI/CD Pipeline

### Current State

**Status: ✅ MOSTLY IMPLEMENTED**

#### 9.0.1 What's Implemented ✅

**GitHub Actions Workflows:**

| Workflow | File | Trigger | Purpose |
|----------|------|---------|---------|
| CI | `ci.yml` | Push/PR to main | Quality gates |
| Deploy | `deploy.yml` | Main branch push | Docker build & push |
| Nightly | `nightly.yml` | 2 AM UTC daily | Comprehensive testing |

**CI Pipeline (`ci.yml`):**
```
┌─────────────────────────────────────────────────────────────────┐
│                         CI PIPELINE                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   ┌─────────────┐   ┌─────────────┐   ┌─────────────┐          │
│   │   Lint &    │   │    Unit     │   │ Integration │          │
│   │ TypeScript  │   │   Tests     │   │   Tests     │          │
│   └──────┬──────┘   └──────┬──────┘   └──────┬──────┘          │
│          │                 │                 │                   │
│          └─────────────────┼─────────────────┘                   │
│                            ▼                                     │
│                    ┌─────────────┐                               │
│                    │    Build    │                               │
│                    │ Verification│                               │
│                    └──────┬──────┘                               │
│                           │                                      │
│                           ▼                                      │
│                    ┌─────────────┐                               │
│                    │  E2E Tests  │                               │
│                    │ (Playwright)│                               │
│                    └──────┬──────┘                               │
│                           │                                      │
│                           ▼                                      │
│                    ┌─────────────┐                               │
│                    │  Security   │                               │
│                    │   Audit     │                               │
│                    └─────────────┘                               │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

**Nightly Pipeline (`nightly.yml`):**
- Full test suite across browsers (Chrome, Firefox, Safari)
- Security vulnerability scan (`npm audit`)
- Dependency updates check
- Accessibility audit (WCAG 2.1 AA)
- Visual regression testing

**Docker Build (`deploy.yml`):**
- Multi-stage Dockerfile for optimized images
- GitHub Container Registry (GHCR) publishing
- Automated tagging (SHA, latest)
- Layer caching for faster builds

**Dockerfile Features:**
| Feature | Status |
|---------|--------|
| Multi-stage build | ✅ |
| Non-root user | ✅ |
| Health checks | ✅ |
| Cache optimization | ✅ |

#### 9.0.2 What's Missing 🚨

| Item | Priority | Description |
|------|----------|-------------|
| Production CD | **CRITICAL** | No automated deployment to GKE/Cloud Run |
| Staging deployment | HIGH | No automatic staging updates |
| Deployment strategy | HIGH | No blue-green/canary setup |
| Rollback automation | MEDIUM | Manual rollback required |
| Smoke tests post-deploy | MEDIUM | No production verification |

### 9.1 Recommended CD Pipeline

```yaml
# .github/workflows/cd.yml (TO IMPLEMENT)
name: CD Pipeline

on:
  push:
    branches: [main]

jobs:
  deploy-staging:
    runs-on: ubuntu-latest
    steps:
      - name: Deploy to Staging
        run: |
          gcloud run deploy hta-calibration-staging \
            --image gcr.io/$PROJECT_ID/hta-calibration:$SHA \
            --region us-central1

      - name: Run Smoke Tests
        run: npm run test:smoke -- --url=$STAGING_URL

  deploy-production:
    needs: deploy-staging
    runs-on: ubuntu-latest
    environment: production  # Requires approval
    steps:
      - name: Deploy to Production
        run: |
          gcloud run deploy hta-calibration-prod \
            --image gcr.io/$PROJECT_ID/hta-calibration:$SHA \
            --region us-central1

      - name: Verify Deployment
        run: npm run test:smoke -- --url=$PROD_URL
```

---

## 10. Environment Management

### Current State

**Status: ✅ MOSTLY IMPLEMENTED**

#### 10.0.1 What's Implemented ✅

**Terraform Environments:**
| Environment | Location | Status |
|-------------|----------|--------|
| Development | `terraform/environments/dev/` | ✅ |
| Staging | `terraform/environments/staging/` | ✅ |
| Production | `terraform/environments/prod/` | ✅ |

**Environment Differences:**

| Setting | Dev | Staging | Prod |
|---------|-----|---------|------|
| Cloud SQL tier | db-f1-micro | db-g1-small | db-custom-2-4096 |
| High Availability | No | No | Yes |
| Read Replicas | 0 | 0 | 1 |
| Backup Retention | 7 days | 14 days | 30 days |
| GKE Node Type | e2-small | e2-medium | e2-standard-2 |
| Min Nodes | 1 | 1 | 2 |
| Max Nodes | 2 | 3 | 10 |

**Local Development:**
| Feature | Status |
|---------|--------|
| `.env.example` template | ✅ |
| Docker Compose | ✅ |
| Local PostgreSQL | ✅ |
| Hot reload | ✅ |

#### 10.0.2 What's Missing 🚨

| Item | Priority | Description |
|------|----------|-------------|
| `.env.staging` template | MEDIUM | No staging-specific defaults |
| `.env.production` template | MEDIUM | No prod-specific defaults |
| Environment validation | LOW | No startup validation of required vars |

### 10.1 Environment Configuration Summary

```
┌─────────────────────────────────────────────────────────────────┐
│                  ENVIRONMENT ARCHITECTURE                        │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│   Development          Staging              Production           │
│   ───────────          ───────              ──────────           │
│   localhost:3000       staging.hta.com      app.hta.com         │
│                                                                  │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│   │ Local       │     │ Cloud SQL   │     │ Cloud SQL   │       │
│   │ PostgreSQL  │     │ (Small)     │     │ (HA + Read) │       │
│   └─────────────┘     └─────────────┘     └─────────────┘       │
│                                                                  │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│   │ Local       │     │ GCS Bucket  │     │ GCS Bucket  │       │
│   │ File System │     │ (Standard)  │     │ (Multi-Reg) │       │
│   └─────────────┘     └─────────────┘     └─────────────┘       │
│                                                                  │
│   ┌─────────────┐     ┌─────────────┐     ┌─────────────┐       │
│   │ Memory      │     │ Memorystore │     │ Memorystore │       │
│   │ Cache       │     │ (Basic)     │     │ (HA)        │       │
│   └─────────────┘     └─────────────┘     └─────────────┘       │
│                                                                  │
│   Feature Flags       Feature Flags       Feature Flags         │
│   • All enabled       • Selected          • Gradual rollout     │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## 11. Performance Testing

### Current State

**Status: ⚠️ PARTIALLY IMPLEMENTED**

#### 11.0.1 What's Implemented ✅

**Performance Evaluation Tests:**
| Test | Threshold | Location |
|------|-----------|----------|
| API response time | 500ms | `tests/evals/performance.eval.ts` |
| Database queries | 100-500ms | performance.eval.ts |
| PDF generation | 5 seconds | performance.eval.ts |
| Search operations | 300ms | performance.eval.ts |

**Load Test Scenarios:**
| Scenario | Users | Status |
|----------|-------|--------|
| Light load | 10 concurrent | ✅ |
| Medium load | 50 concurrent | ✅ |
| Heavy load | 100 concurrent | ✅ |

**Auto-scaling (HPA):**
| Setting | Value |
|---------|-------|
| Min replicas | 1 |
| Max replicas | 5 |
| CPU target | 70% |
| Memory target | 80% |
| Scale-up | 100% increase / 15s |
| Scale-down | 50% decrease / 60s |

**Nightly Performance Tests:**
- Automated via GitHub Actions
- Runs comprehensive load scenarios

#### 11.0.2 What's Missing 🚨

| Item | Priority | Description |
|------|----------|-------------|
| k6 load tests | HIGH | No realistic load testing tool |
| Performance baselines | HIGH | No documented baseline metrics |
| Production load tests | MEDIUM | Tests only run locally (no staging env) |
| Capacity planning | MEDIUM | No documented limits |
| Database profiling | LOW | No slow query analysis |

#### 11.0.3 Production Testing Strategy

Since there's no staging environment, load tests run directly against production with safety constraints:

| Constraint | Value | Rationale |
|------------|-------|-----------|
| **Read-only operations** | GET endpoints only | No data modification |
| **Max concurrency** | 20 users | Prevent resource exhaustion |
| **Max duration** | 7 minutes | Limit exposure window |
| **Scheduling** | Off-peak hours | Nights/weekends |
| **Monitoring** | Required during tests | Abort if errors spike |

**Safe test suites:**
- `health-check` - Health endpoints (no auth needed)
- `read-only-workflow` - Certificate list/view/search
- `dashboard` - Dashboard stats queries

**Unsafe (avoid on production):**
- Certificate creation/updates
- Email triggers
- Any POST/PUT/DELETE operations

### 11.1 Recommended Load Testing Setup

**k6 Test Script Example:**
```javascript
// tests/load/certificate-workflow.js
import http from 'k6/http'
import { check, sleep } from 'k6'

export const options = {
  stages: [
    { duration: '2m', target: 50 },   // Ramp up
    { duration: '5m', target: 50 },   // Steady state
    { duration: '2m', target: 100 },  // Peak load
    { duration: '2m', target: 0 },    // Ramp down
  ],
  thresholds: {
    http_req_duration: ['p(95)<500'],
    http_req_failed: ['rate<0.01'],
  },
}

export default function () {
  const res = http.get('https://staging.hta.com/api/health')
  check(res, {
    'status is 200': (r) => r.status === 200,
    'response time < 500ms': (r) => r.timings.duration < 500,
  })
  sleep(1)
}
```

### 11.2 Performance Baselines (Target)

| Endpoint | p50 | p95 | p99 |
|----------|-----|-----|-----|
| GET /api/health | 10ms | 50ms | 100ms |
| GET /api/certificates | 100ms | 300ms | 500ms |
| POST /api/certificates | 200ms | 500ms | 1000ms |
| GET /api/certificates/[id]/pdf | 1s | 3s | 5s |
| Dashboard load | 300ms | 800ms | 1500ms |

---

## 12. Compliance & Data Privacy

### Current State

**Status: ⚠️ PARTIALLY IMPLEMENTED**

#### 12.0.1 What's Implemented ✅

**Database Audit Logging:**
| Feature | Status | Location |
|---------|--------|----------|
| pgAudit enabled | ✅ | Cloud SQL config |
| DDL operations logged | ✅ | Terraform |
| WRITE operations logged | ✅ | Terraform |
| Query insights | ✅ | Cloud SQL |

**Application Audit Trail:**
| Event | Logged | Model |
|-------|--------|-------|
| User login | ✅ | Session |
| Password change | ✅ | AuditLog |
| Account activation | ✅ | AuditLog |
| Certificate creation | ✅ | AuditLog + Event |
| Certificate status changes | ✅ | CertificateEvent |
| Certificate signatures | ✅ | SigningEvidence |

**Security Compliance:**
| Feature | Status |
|---------|--------|
| Password complexity | ✅ 8+ chars, mixed case, numbers |
| SSL/TLS enforcement | ✅ Required in production |
| Encrypted at rest | ✅ GCP default encryption |
| Encrypted in transit | ✅ HTTPS only |

#### 12.0.2 What's Missing 🚨

| Item | Priority | Description |
|------|----------|-------------|
| Privacy policy page | HIGH | No user-facing policy |
| Data retention policy | HIGH | No documented retention rules |
| GDPR compliance docs | MEDIUM | No compliance documentation |
| Data export (user request) | MEDIUM | Can't export user's data |
| Right to deletion | MEDIUM | No account deletion flow |
| Cookie consent | MEDIUM | No cookie banner |
| Data classification | LOW | No PII tagging |

### 12.1 Data Retention Policy (Recommended)

| Data Type | Retention Period | Justification |
|-----------|------------------|---------------|
| Certificates (finalized) | Indefinite | Business/legal requirement |
| Certificate drafts | 90 days after last edit | Cleanup |
| Audit logs | 7 years | Compliance |
| User sessions | 30 days | Security |
| Password reset tokens | 1 hour | Security |
| Download tokens | 7 days | Business requirement |
| Notification history | 1 year | User experience |
| Chat messages | 2 years | Support reference |

### 12.2 GDPR Compliance Checklist

| Requirement | Status | Next Step |
|-------------|--------|-----------|
| Privacy policy | ❌ | Create `/privacy` page |
| Data processing agreement | ❌ | Draft DPA template |
| Cookie consent | ❌ | Implement cookie banner |
| Right to access | ❌ | Create data export feature |
| Right to erasure | ❌ | Create account deletion |
| Data portability | ❌ | Create data export API |
| Breach notification | ⚠️ | Document procedure |
| DPO designation | ❌ | Determine if required |

### 12.3 Data Subject Rights Implementation

**Data Export Endpoint (To Implement):**
```typescript
// GET /api/user/data-export
// Returns: JSON file with all user's data

interface UserDataExport {
  profile: { name, email, role, createdAt }
  certificates: Certificate[]
  auditLogs: AuditLog[]
  notifications: Notification[]
  sessions: Session[]
}
```

**Account Deletion Flow (To Implement):**
1. User requests deletion via settings
2. Admin reviews and approves
3. 30-day grace period (can cancel)
4. Hard delete: user profile, sessions, tokens
5. Soft delete: certificates (anonymize, keep for records)
6. Audit log entry for compliance

---

## Implementation Roadmap

### Phase 1: Security Hardening (Week 1-2) ✅ COMPLETE

- [x] Implement password change UI for all user types
- [x] Implement forgot password flow
- [x] Add rate limiting for password reset (3 per hour per email)
- [x] Add audit logging for auth events
- [x] Session invalidation on password change

### Phase 2: Email Notifications (Week 2-3) ✅ COMPLETE

- [x] Add missing email templates (8 total in `/src/emails/`)
- [x] Create unified notification service (26 notification types)
- [x] Integrate email triggers at all workflow points
- [x] Test email delivery end-to-end

### Phase 2.5: Customer Email Access (Week 3-4) ✅ COMPLETE

- [x] Add email trigger for review stage (send-to-customer)
- [x] Create DownloadToken database model
- [x] Implement `/api/admin/certificates/[id]/send-download-link` endpoint
- [x] Create `/customer/download/[token]` page
- [x] Implement download PDF endpoint with token validation
- [x] Add admin UI for sending download links
- [x] Implement download count tracking and limits
- [x] Add TokenAccessLog for audit trail
- [x] Staff activation flow (`/activate/[token]` page + API)
- [x] Test full flow: authorize → send link → customer downloads

### Phase 3: Caching Foundation (Week 4-5) ✅ COMPLETE

- [x] Set up Memorystore (Terraform) + Memory provider (local)
- [x] Implement caching utility functions (`cached()`, `cachedSWR()`)
- [x] Add caching to high-frequency queries (dashboards, dropdowns, lists)
- [x] Set up cache invalidation hooks (certificate CRUD, status changes)
- [x] Add environment-based debug logging (development only)

### Phase 4: Security Hardening II (Week 6-7) ✅ COMPLETE

- [x] Implement security headers in `next.config.ts` (CSP, HSTS, X-Frame-Options)
- [x] Add rate limiting to authentication endpoints (using existing cache infrastructure)
- [x] Implement account lockout after failed attempts
- [x] Configure CORS for API endpoints (ready for future API separation)
- [ ] ~~Add 2FA for admin accounts~~ **DEFERRED** - Optional; implement when business requires

**Implementation Details:**
- Security headers: `next.config.ts` with all recommended headers
- Rate limiting: `src/lib/security/rate-limiter.ts` using Redis/Memory cache
- Account lockout: Integrated into `src/lib/auth.ts` authorize callbacks
- CORS: `src/middleware.ts` with environment-driven configuration

**Deferred Items:**
| Item | Reason | Timeline |
|------|--------|----------|
| 2FA for admins | Optional enhancement, not critical for MVP | Phase 9 or when business requires |
| CSP with nonces | Requires Next.js restructuring | Phase 9 (API separation) |

### Phase 5: Monitoring & Observability (Week 7-8) ✅ COMPLETE

- [x] Set up Sentry for error tracking *(sentry.*.config.ts)*
- [x] Implement structured logging with Pino *(src/lib/logger.ts)*
- [x] Replace console.log/error in all API routes *(~50 files updated)*
- [x] Configure GCP Cloud Logging integration *(automatic via Pino JSON)*
- [x] Set up alerting policies via Terraform *(error rate, latency, CPU)*
- [x] Set up DR/backup monitoring alert *(Cloud SQL backup failure)*
- [x] Create monitoring dashboard via Terraform *(6 charts)*
- [ ] Deploy monitoring infrastructure *(pending: terraform apply)*
- [ ] Configure Sentry email alerts *(manual in Sentry dashboard)*

**Deferred to Phase 9:**
- Distributed tracing (not needed until API separation)
- APM detailed traces (not needed until microservices)
- PagerDuty/Slack integration (email sufficient for now)
- Cross-region DR setup

**Completed in Phase 6:**
- DR backup restore testing (monthly drills) - `.github/workflows/backup-test.yml`
- Recovery time documentation - `docs/runbooks/secrets-rotation.md`

### Phase 6: Secrets & Infrastructure (Week 8-9) ✅ COMPLETE

- [x] Implement runtime Secret Manager fetching (K8s External Secrets)
- [x] Create CD pipeline for staging/production deployment (`deploy-dev.yml`, `deploy-prod.yml`)
- [x] Add smoke tests post-deployment (`/api/smoke-test`, `scripts/smoke-tests.sh`)
- [x] Document secrets rotation procedures (`docs/runbooks/secrets-rotation.md`)
- [x] Set up automated backup testing (`backup-test.yml` monthly workflow)

### Phase 7: Performance & Load Testing (Week 9-10) ✅

- [x] Set up k6 for realistic load testing
- [x] Create production-safe load test scripts (read-only operations)
- [x] Document performance baselines
- [x] Create capacity planning documentation
- [x] Enable database slow query logging (Terraform config)
- [x] Create GitHub Actions workflow for scheduled load tests
- [ ] Run initial baseline tests *(post-deployment)*
- [ ] Apply Terraform for slow query logging *(requires `terraform apply`)*

**Implementation Summary:**

| Component | File | Description |
|-----------|------|-------------|
| Load test config | `tests/load/config.js` | Shared profiles (smoke/gentle/moderate) |
| Health check test | `tests/load/health-check.js` | Unauthenticated endpoint testing |
| Read-only workflow | `tests/load/read-only-workflow.js` | Certificate list/view/search (auth required) |
| Dashboard test | `tests/load/dashboard.js` | Dashboard stats queries (auth required) |
| GitHub Actions | `.github/workflows/load-test.yml` | Manual + weekly scheduled runs |
| Performance targets | `docs/runbooks/performance-baselines.md` | P95 < 500ms, error rate < 1% |
| Capacity planning | `docs/system_design/capacity-planning.md` | Scaling triggers, cost estimates |
| Slow query logging | `terraform/modules/cloudsql/main.tf` | `log_min_duration_statement = 1000ms` |

**Production-Safe Testing Strategy:**
- Read-only operations only (no mutations)
- Low concurrency: max 20 VUs (gentle profile)
- Off-peak scheduling: Sundays 3 AM UTC
- Health checks before load application

**npm Scripts:**
```bash
npm run test:load           # Health check (localhost)
npm run test:load:smoke     # 3 users, 2 min
npm run test:load:gentle    # 10 users, 6 min
npm run test:load:dashboard # Dashboard queries
```

**Note:** No staging environment - all tests target production with safety constraints.
See `docs/prod_plans/phase-7-performance-testing.md` for full implementation details.

### Phase 8: Compliance & Data Privacy (Week 10-11)

- [ ] Create privacy policy page (`/privacy`)
- [ ] Document data retention policies
- [ ] Implement cookie consent banner
- [ ] Create user data export feature
- [ ] Implement account deletion flow
- [ ] Document GDPR compliance procedures

### Phase 9: Architecture Evolution (Future)

**Infrastructure:**
- [ ] Evaluate API separation requirements (see Section 3.2)
- [ ] Set up CDN for static assets
- [ ] Implement Prisma Accelerate or query caching
- [ ] Cross-region disaster recovery setup

**Security Enhancements (Deferred from Phase 4):**
- [ ] Implement CSP with nonces (tighten `unsafe-inline`/`unsafe-eval`)
- [ ] Add 2FA for admin accounts (TOTP or WebAuthn)
- [ ] Configure CORS for separated API service (`CORS_ALLOWED_ORIGINS`)
- [ ] Add GCP Cloud Armor WAF rules for DDoS protection

**Monitoring Enhancements (Deferred from Phase 5):**
- [ ] Distributed tracing across services (after API separation)
- [ ] APM with detailed transaction traces
- [ ] Custom business metrics (certificate processing times, etc.)
- [ ] PagerDuty/Slack integration for on-call alerting
- [ ] SLO/SLA dashboards and error budgets

**Disaster Recovery Testing (Deferred from Phase 8):**
- [ ] Restore database backup to test instance
- [ ] Verify data integrity after restore
- [ ] Document recovery time (actual vs expected)
- [ ] Establish monthly DR drill schedule
- [ ] Cross-region Cloud SQL replica setup
- [ ] GCS multi-region bucket configuration

---

## Success Metrics

| Category | Metric | Current | Target |
|----------|--------|---------|--------|
| **Password Management** | Reset support tickets | N/A | < 5/month |
| **Email** | Delivery rate | N/A | > 98% |
| **Performance** | API p95 latency | ~300ms | < 150ms |
| **Caching** | Cache hit rate | 0% | > 70% |
| **Security** | Rate limit blocks | 0 | Measurable |
| **Security** | Failed login lockouts | 0 | Measurable |
| **Database** | CPU usage | ~40% | < 25% |
| **Customer** | Review link open rate | N/A | > 80% |
| **Customer** | Download completion | N/A | > 95% |
| **Customer** | Avg approval time | N/A | < 48 hours |
| **Monitoring** | Error tracking coverage | 100% ✅ | 100% |
| **Monitoring** | Alert response time | Ready ✅ | < 15 min |
| **DR** | Backup success rate | N/A | 100% |
| **DR** | Recovery test frequency | Never | Monthly |
| **CI/CD** | Deployment frequency | Manual | Daily |
| **CI/CD** | Rollback time | N/A | < 5 min |
| **Compliance** | Audit log retention | N/A | 7 years |
| **Compliance** | Data export requests served | N/A | 100% |

---

## Appendix

### A. Environment Variables Required

```bash
# Rate Limiting
UPSTASH_REDIS_REST_URL=
UPSTASH_REDIS_REST_TOKEN=

# Email
EMAIL_PROVIDER=sendgrid  # or 'postal' for self-hosted
SENDGRID_API_KEY=
EMAIL_FROM=noreply@htacalibration.com

# Cache (✅ Implemented)
CACHE_PROVIDER=memory   # or 'redis' for production
CACHE_TTL_DEFAULT=300   # Default TTL in seconds
CACHE_KEY_PREFIX=hta:   # Key prefix for namespacing
CACHE_MEMORY_MAX_SIZE=10000  # Max entries for memory cache
CACHE_MEMORY_CHECK_PERIOD=60 # Cleanup interval (seconds)

# Redis (when CACHE_PROVIDER=redis)
REDIS_HOST=             # Memorystore private IP
REDIS_PORT=6379
REDIS_PASSWORD=         # From Secret Manager
REDIS_TLS=true          # Enable TLS for Memorystore
REDIS_DB=0

# Security
PASSWORD_RESET_TOKEN_EXPIRY=3600  # 1 hour
SESSION_INVALIDATE_ON_PASSWORD_CHANGE=true
```

### B. Database Migrations Required

1. `add_password_reset_tokens` - PasswordResetToken table ✅
2. `add_password_history` - PasswordHistory table (optional) ⏳
3. `add_email_preferences` - EmailPreference table (future) ⏳
4. `add_download_tokens` - DownloadToken table for certificate downloads ✅
5. `add_token_access_logs` - TokenAccessLog table for audit trail ✅
6. `add_staff_activation_fields` - User activation token fields ✅

### C. New API Endpoints Summary

| Endpoint | Method | Description | Status |
|----------|--------|-------------|--------|
| `/api/auth/change-password` | POST | Staff password change | ✅ |
| `/api/auth/forgot-password` | POST | Staff password reset request | ✅ |
| `/api/auth/reset-password` | GET/POST | Staff password reset validate/execute | ✅ |
| `/api/customer/change-password` | POST | Customer password change | ✅ |
| `/api/customer/forgot-password` | POST | Customer password reset request | ✅ |
| `/api/customer/reset-password` | GET/POST | Customer password reset validate/execute | ✅ |
| `/api/admin/certificates/[id]/send-download-link` | POST/GET | Send/view download links | ✅ |
| `/api/customer/download/[token]` | GET | Validate token & get cert info | ✅ |
| `/api/customer/download/[token]/pdf` | GET | Download the certificate PDF | ✅ |
| `/api/auth/activate` | GET/POST | Staff activation validate/execute | ✅ |

### D. New Pages Required

| Route | Description | Status |
|-------|-------------|--------|
| `/dashboard/settings` | Engineer settings (password change) | ✅ |
| `/admin/settings` | Admin settings (password change) | ✅ |
| `/forgot-password` | Staff password reset request | ✅ |
| `/reset-password/[token]` | Staff password reset form | ✅ |
| `/customer/forgot-password` | Customer password reset request | ✅ |
| `/customer/reset-password/[token]` | Customer password reset form | ✅ |
| `/customer/download/[token]` | Customer certificate download page | ✅ |
| `/activate/[token]` | Staff account activation page | ✅ |

### E. Email Templates Summary

| Template Key | Trigger | Recipient | Status |
|--------------|---------|-----------|--------|
| `password-reset` | Forgot password request | User/Customer | ✅ |
| `password-changed` | Password changed successfully | User/Customer | ✅ |
| `staff-activation` | Staff user created | Staff user | ✅ |
| `customer-review-request` | Cert sent for approval | Customer | ✅ |
| `certificate-download-ready` | Admin sends download link | Customer | ✅ |
| `certificate-for-review` | Cert submitted for review | Reviewer | ✅ |
| `certificate-reviewed` | Revision/Approval notification | Engineer | ✅ |
| `customer-approval` | Customer approves | Engineer/Reviewer | ✅ |

---

**Document Owner:** Engineering Team
**Review Required By:** [Stakeholder Names]
**Approval Status:** Phase 1-3 Complete, Phases 4-9 Pending

---

## Change Log

| Date | Version | Changes |
|------|---------|---------|
| April 2026 | 1.0 | Initial document with Password Management, Email, Caching |
| April 2026 | 2.0 | Added Secrets, Security, Monitoring, DR, CI/CD, Environments, Performance, Compliance sections |
