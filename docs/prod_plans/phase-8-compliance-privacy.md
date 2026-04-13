# Phase 8: Compliance & Data Privacy - Implementation Plan

**Document Version:** 1.0
**Created:** 2026-04-13
**Last Updated:** 2026-04-13
**Status:** Complete
**Estimated Effort:** 6-8 hours

---

## Table of Contents

1. [Executive Summary](#1-executive-summary)
2. [Current State Analysis](#2-current-state-analysis)
3. [Implementation Plan](#3-implementation-plan)
4. [Privacy Policy Page](#4-privacy-policy-page)
5. [Cookie Consent Banner](#5-cookie-consent-banner)
6. [Data Export Feature](#6-data-export-feature)
7. [Account Deletion Flow](#7-account-deletion-flow)
8. [Data Retention Policies](#8-data-retention-policies)
9. [GDPR Compliance Documentation](#9-gdpr-compliance-documentation)
10. [Testing & Verification](#10-testing--verification)

---

## 1. Executive Summary

### What This Phase Accomplishes

| Capability | Before | After |
|------------|--------|-------|
| Privacy policy | None | `/privacy` page with clear data practices |
| Cookie consent | None | GDPR-compliant consent banner |
| Data portability | Not available | User can export their data (JSON) |
| Right to erasure | Manual process | Self-service account deletion |
| Data retention | Undocumented | Documented policies with automation |
| GDPR compliance | Partial | Documented procedures |

### Implementation Checklist

- [x] Create privacy policy page (`/privacy`) ✅
- [x] Create terms of service page (`/terms`) ✅
- [x] Implement cookie consent banner ✅
- [x] Create user data export feature (GDPR Article 20) ✅
- [x] Implement account deletion flow (GDPR Article 17) ✅
- [x] Document data retention policies ✅
- [x] Create GDPR compliance runbook ✅
- [x] Add data processing agreement template ✅

### Files to Create/Modify

| File | Action | Description | Status |
|------|--------|-------------|--------|
| `src/app/(public)/privacy/page.tsx` | CREATE | Privacy policy page | ✅ Done |
| `src/app/(public)/terms/page.tsx` | CREATE | Terms of service page | ✅ Done |
| `src/components/cookie-consent.tsx` | CREATE | Cookie consent banner component | ✅ Done |
| `src/app/layout.tsx` | MODIFY | Add cookie consent banner | ✅ Done |
| `src/app/api/customer/data-export/route.ts` | CREATE | Data export API endpoint | ✅ Done |
| `src/app/api/customer/delete-account/route.ts` | CREATE | Account deletion API endpoint | ✅ Done |
| `src/components/delete-account-dialog.tsx` | CREATE | Account deletion dialog | ✅ Done |
| `src/emails/AccountDeleted.tsx` | CREATE | Account deleted email template | ✅ Done |
| `src/app/customer/settings/page.tsx` | MODIFY | Add Data & Privacy section | ✅ Done |
| `docs/compliance/data-retention.md` | CREATE | Data retention policies | ✅ Done |
| `docs/compliance/gdpr-procedures.md` | CREATE | GDPR compliance runbook | ✅ Done |
| `docs/compliance/dpa-template.md` | CREATE | Data processing agreement | ✅ Done |
| `tests/e2e/evals/compliance.spec.ts` | CREATE | Automated compliance tests | ✅ Done |

---

## 2. Current State Analysis

### What Data We Collect

| Data Category | Examples | Legal Basis | Retention |
|---------------|----------|-------------|-----------|
| **Account Data** | Email, name, password hash | Contract performance | Until account deletion |
| **Certificate Data** | Certificate records, calibration data | Contract performance | 7 years (regulatory) |
| **Session Data** | Session tokens, login timestamps | Legitimate interest | 30 days |
| **Audit Logs** | User actions, IP addresses | Legal obligation | 1 year |
| **Support Data** | Support tickets, communications | Contract performance | 3 years |

### Current Privacy Controls

| Control | Status | Gap |
|---------|--------|-----|
| Secure password storage (bcrypt) | ✅ Implemented | None |
| HTTPS enforcement | ✅ Implemented | None |
| Session management | ✅ Implemented | None |
| Privacy policy | ✅ Implemented | `/privacy` page |
| Terms of service | ✅ Implemented | `/terms` page |
| Cookie consent | ✅ Implemented | Banner in root layout |
| Data export | ✅ Implemented | `/api/customer/data-export` |
| Account deletion | ✅ Implemented | `/api/customer/delete-account` |
| Retention automation | ❌ Missing | Need to document |

### Applicable Regulations

| Regulation | Applicability | Key Requirements |
|------------|---------------|------------------|
| **GDPR** | EU customers | Consent, data portability, right to erasure |
| **CCPA** | California customers | Right to know, delete, opt-out |
| **Industry** | Calibration certificates | 7-year retention requirement |

---

## 3. Implementation Plan

### Implementation Order

```
1. Privacy & Terms Pages (2 hours)
   └── Static content, no dependencies

2. Cookie Consent Banner (1-2 hours)
   └── Client component, localStorage state

3. Data Export Feature (2 hours)
   └── API endpoint + UI button
   └── Depends on: authentication

4. Account Deletion Flow (2 hours)
   └── API endpoint + confirmation UI
   └── Depends on: authentication, email service

5. Documentation (1-2 hours)
   └── Retention policies, GDPR runbook
   └── Can be done in parallel
```

### Priority Matrix

| Feature | User Impact | Compliance Risk | Effort | Priority |
|---------|-------------|-----------------|--------|----------|
| Privacy policy page | Medium | High | Low | P0 |
| Cookie consent | Low | High | Medium | P0 |
| Data export | Medium | High | Medium | P1 |
| Account deletion | Medium | High | Medium | P1 |
| Retention docs | Low | Medium | Low | P2 |

---

## 4. Privacy Policy Page

### Route Structure

```
src/app/(public)/privacy/page.tsx    # Privacy policy
src/app/(public)/terms/page.tsx      # Terms of service
src/app/(public)/layout.tsx          # Public pages layout (no auth required)
```

### Privacy Policy Content Outline

```markdown
# Privacy Policy

Last updated: [Date]

## 1. Information We Collect
- Account information (email, name)
- Certificate and calibration data
- Usage data (login times, IP addresses)

## 2. How We Use Your Information
- Provide calibration certificate services
- Maintain account security
- Comply with legal obligations

## 3. Data Retention
- Account data: Until deletion requested
- Certificates: 7 years (regulatory requirement)
- Audit logs: 1 year

## 4. Your Rights
- Access your data
- Export your data
- Delete your account
- Withdraw consent

## 5. Cookies
- Essential cookies only (session management)
- No third-party tracking cookies

## 6. Data Security
- Encryption in transit (TLS 1.3)
- Encryption at rest
- Regular security audits

## 7. Contact Us
- Email: privacy@htacalibr8s.com
- Address: [Company Address]
```

### Implementation

```tsx
// src/app/(public)/privacy/page.tsx
import { Metadata } from 'next'

export const metadata: Metadata = {
  title: 'Privacy Policy | HTA Calibr8s',
  description: 'How we collect, use, and protect your data',
}

export default function PrivacyPolicyPage() {
  return (
    <main className="container mx-auto px-4 py-8 max-w-4xl">
      <h1 className="text-3xl font-bold mb-6">Privacy Policy</h1>
      <p className="text-muted-foreground mb-8">
        Last updated: April 13, 2026
      </p>
      
      <section className="space-y-6">
        {/* Content sections */}
      </section>
    </main>
  )
}
```

---

## 5. Cookie Consent Banner

### Cookie Categories

| Category | Purpose | Required | Examples |
|----------|---------|----------|----------|
| **Essential** | Site functionality | Yes | Session cookies, CSRF tokens |
| **Analytics** | Usage statistics | No | None currently |
| **Marketing** | Advertising | No | None currently |

**Note:** Currently only essential cookies are used, simplifying compliance.

### Component Design

```tsx
// src/components/cookie-consent.tsx
'use client'

import { useState, useEffect } from 'react'
import { Button } from '@/components/ui/button'

const CONSENT_KEY = 'cookie-consent'

export function CookieConsent() {
  const [showBanner, setShowBanner] = useState(false)

  useEffect(() => {
    const consent = localStorage.getItem(CONSENT_KEY)
    if (!consent) {
      setShowBanner(true)
    }
  }, [])

  const acceptCookies = () => {
    localStorage.setItem(CONSENT_KEY, JSON.stringify({
      essential: true,
      accepted: new Date().toISOString(),
    }))
    setShowBanner(false)
  }

  if (!showBanner) return null

  return (
    <div className="fixed bottom-0 left-0 right-0 bg-background border-t p-4 shadow-lg z-50">
      <div className="container mx-auto flex flex-col sm:flex-row items-center justify-between gap-4">
        <p className="text-sm text-muted-foreground">
          We use essential cookies to ensure our website functions properly.
          By continuing to use this site, you agree to our{' '}
          <a href="/privacy" className="underline">Privacy Policy</a>.
        </p>
        <div className="flex gap-2">
          <Button variant="outline" size="sm" asChild>
            <a href="/privacy">Learn More</a>
          </Button>
          <Button size="sm" onClick={acceptCookies}>
            Accept
          </Button>
        </div>
      </div>
    </div>
  )
}
```

### Integration

```tsx
// src/app/layout.tsx
import { CookieConsent } from '@/components/cookie-consent'

export default function RootLayout({ children }) {
  return (
    <html>
      <body>
        {children}
        <CookieConsent />
      </body>
    </html>
  )
}
```

---

## 6. Data Export Feature

### GDPR Article 20: Right to Data Portability

Users must be able to receive their personal data in a structured, commonly used, machine-readable format.

### Export Data Structure

```typescript
interface UserDataExport {
  exportDate: string
  user: {
    email: string
    name: string
    createdAt: string
  }
  certificates: Array<{
    certificateNumber: string
    equipmentDescription: string
    calibrationDate: string
    nextDueDate: string
    status: string
  }>
  activityLog: Array<{
    action: string
    timestamp: string
    ipAddress?: string  // Optional, may be redacted
  }>
}
```

### API Endpoint

```typescript
// src/app/api/customer/data-export/route.ts
import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

export async function GET() {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const customer = await prisma.customer.findUnique({
    where: { id: session.user.id },
    include: {
      certificates: {
        select: {
          certificateNumber: true,
          equipmentDescription: true,
          calibrationDate: true,
          nextDueDate: true,
          status: true,
        },
      },
    },
  })

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  const exportData = {
    exportDate: new Date().toISOString(),
    user: {
      email: customer.email,
      name: customer.name,
      createdAt: customer.createdAt.toISOString(),
    },
    certificates: customer.certificates,
  }

  // Return as downloadable JSON
  return new NextResponse(JSON.stringify(exportData, null, 2), {
    headers: {
      'Content-Type': 'application/json',
      'Content-Disposition': `attachment; filename="data-export-${Date.now()}.json"`,
    },
  })
}
```

### UI Integration

Add to customer settings page:

```tsx
// In customer settings
<Button onClick={() => window.location.href = '/api/customer/data-export'}>
  Export My Data
</Button>
```

---

## 7. Account Deletion Flow

### GDPR Article 17: Right to Erasure

Users have the right to request deletion of their personal data, subject to legal retention requirements.

### Deletion Process

```
┌─────────────────────────────────────────────────────────────┐
│                  ACCOUNT DELETION FLOW                       │
├─────────────────────────────────────────────────────────────┤
│                                                              │
│  1. User clicks "Delete Account"                            │
│           │                                                  │
│           ▼                                                  │
│  2. Confirmation dialog with warnings                        │
│     - "This action cannot be undone"                        │
│     - "Certificates will be retained for 7 years"          │
│           │                                                  │
│           ▼                                                  │
│  3. User enters password to confirm                         │
│           │                                                  │
│           ▼                                                  │
│  4. System processes deletion:                              │
│     a. Anonymize user data (keep certificates)              │
│     b. Delete session tokens                                │
│     c. Send confirmation email                              │
│     d. Log deletion for compliance                          │
│           │                                                  │
│           ▼                                                  │
│  5. Redirect to homepage with confirmation                  │
│                                                              │
└─────────────────────────────────────────────────────────────┘
```

### What Gets Deleted vs Retained

| Data | Action | Reason |
|------|--------|--------|
| Email | Anonymized | Privacy |
| Name | Anonymized | Privacy |
| Password hash | Deleted | No longer needed |
| Session tokens | Deleted | Security |
| Certificates | **Retained** | 7-year regulatory requirement |
| Audit logs | **Retained** | Legal compliance |

### API Endpoint

```typescript
// src/app/api/customer/delete-account/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { verifyPassword } from '@/lib/auth/password'
import { sendAccountDeletionEmail } from '@/lib/email'

export async function POST(request: NextRequest) {
  const session = await auth()
  
  if (!session?.user?.id) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const { password } = await request.json()

  // Verify password
  const customer = await prisma.customer.findUnique({
    where: { id: session.user.id },
  })

  if (!customer) {
    return NextResponse.json({ error: 'Customer not found' }, { status: 404 })
  }

  const isValid = await verifyPassword(password, customer.passwordHash)
  if (!isValid) {
    return NextResponse.json({ error: 'Invalid password' }, { status: 400 })
  }

  // Store email before anonymization for confirmation
  const originalEmail = customer.email

  // Anonymize user data (keep certificates for regulatory compliance)
  await prisma.customer.update({
    where: { id: session.user.id },
    data: {
      email: `deleted-${customer.id}@anonymized.local`,
      name: 'Deleted User',
      passwordHash: '',
      deletedAt: new Date(),
    },
  })

  // Delete all sessions
  await prisma.session.deleteMany({
    where: { userId: session.user.id },
  })

  // Log deletion for compliance
  await prisma.auditLog.create({
    data: {
      action: 'ACCOUNT_DELETED',
      userId: session.user.id,
      details: { anonymizedAt: new Date().toISOString() },
    },
  })

  // Send confirmation email
  await sendAccountDeletionEmail(originalEmail)

  return NextResponse.json({ success: true })
}
```

### Confirmation Dialog

```tsx
// src/components/delete-account-dialog.tsx
'use client'

import { useState } from 'react'
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from '@/components/ui/alert-dialog'
import { Input } from '@/components/ui/input'
import { Button } from '@/components/ui/button'

export function DeleteAccountDialog() {
  const [password, setPassword] = useState('')
  const [isDeleting, setIsDeleting] = useState(false)

  const handleDelete = async () => {
    setIsDeleting(true)
    const res = await fetch('/api/customer/delete-account', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ password }),
    })

    if (res.ok) {
      window.location.href = '/?deleted=true'
    } else {
      setIsDeleting(false)
      alert('Failed to delete account. Please check your password.')
    }
  }

  return (
    <AlertDialog>
      <AlertDialogTrigger asChild>
        <Button variant="destructive">Delete Account</Button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle>Delete your account?</AlertDialogTitle>
          <AlertDialogDescription className="space-y-2">
            <p>This action cannot be undone. Your account will be permanently deleted.</p>
            <p className="font-medium">
              Note: Calibration certificates will be retained for 7 years as required by regulations.
            </p>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <div className="py-4">
          <label className="text-sm font-medium">
            Enter your password to confirm:
          </label>
          <Input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            placeholder="Password"
            className="mt-2"
          />
        </div>
        <AlertDialogFooter>
          <AlertDialogCancel>Cancel</AlertDialogCancel>
          <AlertDialogAction
            onClick={handleDelete}
            disabled={!password || isDeleting}
            className="bg-destructive text-destructive-foreground"
          >
            {isDeleting ? 'Deleting...' : 'Delete Account'}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  )
}
```

---

## 8. Data Retention Policies

### Retention Schedule

| Data Type | Retention Period | Justification | Deletion Method |
|-----------|------------------|---------------|-----------------|
| Active user accounts | Until deletion | Contract | On request |
| Deleted user accounts | 30 days | Recovery period | Automated |
| Calibration certificates | 7 years | Regulatory | Manual review |
| Session tokens | 30 days | Security | Automated |
| Audit logs | 1 year | Compliance | Automated |
| Password reset tokens | 1 hour | Security | Automated |
| Support tickets | 3 years | Business need | Manual review |
| Backups | 30 days | Disaster recovery | Automated |

### Automated Cleanup Jobs

```typescript
// src/lib/jobs/data-retention.ts

// Run daily via cron or Cloud Scheduler
export async function cleanupExpiredData() {
  const now = new Date()

  // Delete expired sessions (30 days)
  await prisma.session.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  })

  // Delete expired password reset tokens (1 hour)
  await prisma.passwordResetToken.deleteMany({
    where: {
      expiresAt: { lt: now },
    },
  })

  // Archive old audit logs (1 year)
  const oneYearAgo = new Date(now.setFullYear(now.getFullYear() - 1))
  await prisma.auditLog.deleteMany({
    where: {
      createdAt: { lt: oneYearAgo },
    },
  })

  // Permanently delete soft-deleted accounts (30 days after deletion)
  const thirtyDaysAgo = new Date(now.setDate(now.getDate() - 30))
  await prisma.customer.deleteMany({
    where: {
      deletedAt: { lt: thirtyDaysAgo },
    },
  })
}
```

### Documentation File

Create `docs/compliance/data-retention.md` with:
- Full retention schedule table
- Legal basis for each retention period
- Deletion procedures
- Exception handling process

---

## 9. GDPR Compliance Documentation

### GDPR Rights Checklist

| Right | Article | Implementation | Status |
|-------|---------|----------------|--------|
| Right to be informed | Art. 13-14 | Privacy policy | ✅ Implemented |
| Right of access | Art. 15 | Data export | ✅ Implemented |
| Right to rectification | Art. 16 | Profile edit | ✅ Exists |
| Right to erasure | Art. 17 | Account deletion | ✅ Implemented |
| Right to restrict processing | Art. 18 | Manual process | Documented |
| Right to data portability | Art. 20 | JSON export | ✅ Implemented |
| Right to object | Art. 21 | Contact form | Documented |

### Compliance Runbook

Create `docs/compliance/gdpr-procedures.md` with:

1. **Data Subject Access Request (DSAR) Process**
   - How to handle requests
   - Response timeline (30 days)
   - Verification procedures

2. **Data Breach Response**
   - Detection and assessment
   - Notification requirements (72 hours)
   - Documentation requirements

3. **Consent Management**
   - How consent is obtained
   - How to withdraw consent
   - Record keeping

4. **Third-Party Data Processing**
   - List of sub-processors
   - DPA requirements
   - Due diligence process

---

## 10. Testing & Verification

### Manual Testing Checklist

**Privacy Policy:**
- [ ] Page accessible at `/privacy`
- [ ] All sections render correctly
- [ ] Links work (contact, settings)
- [ ] Mobile responsive

**Cookie Consent:**
- [ ] Banner appears on first visit
- [ ] Banner doesn't appear after accepting
- [ ] Consent stored in localStorage
- [ ] Works after clearing cookies

**Data Export:**
- [ ] Download triggers successfully
- [ ] JSON is valid and formatted
- [ ] All user data included
- [ ] Certificates included
- [ ] No sensitive data (password hashes)

**Account Deletion:**
- [ ] Confirmation dialog appears
- [ ] Password required
- [ ] Wrong password rejected
- [ ] Account anonymized after deletion
- [ ] User logged out
- [ ] Confirmation email sent
- [ ] Cannot log in after deletion

### Automated Tests ✅

**File:** `tests/e2e/evals/compliance.spec.ts`

Tests implemented:
- Privacy policy page accessibility and content
- Terms of service page accessibility
- Cookie consent banner appearance and localStorage persistence
- Data export download and JSON validation
- Account deletion dialog flow and validation
- Data & Privacy section visibility in settings

Run with:
```bash
npx playwright test tests/e2e/evals/compliance.spec.ts
```

---

## Appendix A: Legal Review Checklist

Before launching, have legal review:

- [ ] Privacy policy content
- [ ] Terms of service content
- [ ] Cookie consent wording
- [ ] Data retention periods
- [ ] Account deletion disclaimers
- [ ] Email notification templates

---

## Appendix B: Email Templates

### Account Deletion Confirmation

```
Subject: Your account has been deleted

Hi,

Your HTA Calibr8s account has been successfully deleted.

What happens now:
- Your personal information has been removed
- You will no longer receive emails from us
- Calibration certificates are retained for 7 years per regulations

If you did not request this deletion, please contact us immediately.

Thank you for using HTA Calibr8s.
```

### Data Export Confirmation

```
Subject: Your data export is ready

Hi {name},

Your data export has been generated and downloaded.

The export includes:
- Your account information
- Certificate records
- Activity history

If you have questions about your data, please contact privacy@htacalibr8s.com.

Best regards,
HTA Calibr8s Team
```
