# Event Types Reference

## Event Type Constants

All event types used in the system:

```typescript
// src/lib/utils/tat-calculator.ts:92-103

const EVENTS = {
  SUBMITTED_FOR_REVIEW: 'SUBMITTED_FOR_REVIEW',
  RESUBMITTED_FOR_REVIEW: 'RESUBMITTED_FOR_REVIEW',
  REVIEWER_APPROVED: 'REVIEWER_APPROVED',
  REVISION_REQUESTED: 'REVISION_REQUESTED',
  SENT_TO_CUSTOMER: 'SENT_TO_CUSTOMER',
  CUSTOMER_APPROVED: 'CUSTOMER_APPROVED',
  CUSTOMER_REVISION_REQUESTED: 'CUSTOMER_REVISION_REQUESTED',
  ADMIN_AUTHORIZED: 'ADMIN_AUTHORIZED',
  ADMIN_REPLIED_TO_CUSTOMER: 'ADMIN_REPLIED_TO_CUSTOMER',
}
```

---

## Complete Event Type Catalog

### Certificate Lifecycle Events

| Event Type | When Created | Actor | Status Change |
|------------|--------------|-------|---------------|
| `CERTIFICATE_CREATED` | New certificate | Engineer | → DRAFT |
| `SUBMITTED_FOR_REVIEW` | First submission | Engineer | DRAFT → IN_REVIEW |
| `RESUBMITTED_FOR_REVIEW` | Resubmission after revision | Engineer | IN_REVIEW → IN_REVIEW |
| `REVISION_REQUESTED` | Reviewer requests changes | HOD | → (no change) |
| `REVIEWER_APPROVED` | Reviewer approves | HOD | IN_REVIEW → APPROVED |
| `REVIEWER_APPROVED_SENT_TO_CUSTOMER` | Approve and send in one step | HOD | IN_REVIEW → SENT_TO_CUSTOMER |
| `SENT_TO_CUSTOMER` | Sent to customer portal | Admin/HOD | APPROVED → SENT_TO_CUSTOMER |
| `CUSTOMER_APPROVED` | Customer approves | Customer | SENT_TO_CUSTOMER → CUSTOMER_APPROVED |
| `CUSTOMER_REVISION_REQUESTED` | Customer requests changes | Customer | → (no change) |
| `ADMIN_AUTHORIZED` | Final authorization | Admin | CUSTOMER_APPROVED → ADMIN_AUTHORIZED |
| `REJECTED` | Certificate rejected | HOD/Admin | → REJECTED |

### Admin Action Events

| Event Type | When Created | Actor |
|------------|--------------|-------|
| `ADMIN_EDIT` | Admin edits any field | Admin |
| `ADMIN_REPLIED_TO_CUSTOMER` | Admin responds to customer revision | Admin |

### Section Unlock Events

| Event Type | When Created | Actor |
|------------|--------------|-------|
| `SECTION_UNLOCK_REQUESTED` | Engineer requests to edit locked section | Engineer |
| `SECTION_UNLOCK_APPROVED` | Admin approves unlock request | Admin |
| `SECTION_UNLOCK_REJECTED` | Admin rejects unlock request | Admin |

---

## Detailed Event Specifications

### CERTIFICATE_CREATED

**Trigger**: Engineer creates a new certificate

**API Route**: `POST /api/certificates`

**Code Location**: `src/app/api/certificates/route.ts:188`

```typescript
await tx.certificateEvent.create({
  data: {
    certificateId: certificate.id,
    sequenceNumber: 1,
    revision: 0,
    eventType: 'CERTIFICATE_CREATED',
    eventData: JSON.stringify({
      certificateNumber: certificate.certificateNumber,
      customerName: data.customerName,
      uucDescription: data.uucDescription,
    }),
    userId: session.user.id,
    userRole: 'ENGINEER',
  },
})
```

**Payload Schema**:
```typescript
interface CertificateCreatedPayload {
  certificateNumber: string
  customerName: string
  uucDescription: string
}
```

---

### SUBMITTED_FOR_REVIEW

**Trigger**: Engineer submits certificate for peer review

**API Route**: `POST /api/certificates/[id]/submit`

**Code Location**: `src/app/api/certificates/[id]/submit/route.ts:215`

```typescript
const event = await tx.certificateEvent.create({
  data: {
    certificateId,
    sequenceNumber,
    revision: newRevision,
    eventType: 'SUBMITTED_FOR_REVIEW',
    eventData: JSON.stringify({
      reviewerId,
      previousStatus: certificate.status,
    }),
    userId: session.user.id,
    userRole: 'ENGINEER',
  },
})
```

**Payload Schema**:
```typescript
interface SubmittedForReviewPayload {
  reviewerId: string
  previousStatus: string
}
```

**Status Change**: `DRAFT` → `IN_REVIEW`

---

### RESUBMITTED_FOR_REVIEW

**Trigger**: Engineer resubmits after making requested revisions

**API Route**: `POST /api/certificates/[id]/submit`

**Payload Schema**:
```typescript
interface ResubmittedPayload {
  reviewerId: string
  revisionNumber: number
  previousStatus: string
}
```

**Status Change**: None (stays `IN_REVIEW`)

---

### REVISION_REQUESTED

**Trigger**: Reviewer (HOD) requests changes to certificate

**API Route**: `POST /api/certificates/[id]/review` (with action: 'revise')

**Code Location**: `src/app/api/certificates/[id]/review/route.ts:271`

```typescript
await tx.certificateEvent.create({
  data: {
    certificateId,
    sequenceNumber,
    revision: certificate.currentRevision,
    eventType: 'REVISION_REQUESTED',
    eventData: JSON.stringify({
      reviewerId: session.user.id,
      reviewerName: session.user.name,
      sectionsRequested: sectionsWithFeedback,
    }),
    userId: session.user.id,
    userRole: 'HOD',
  },
})
```

**Payload Schema**:
```typescript
interface RevisionRequestedPayload {
  reviewerId: string
  reviewerName: string
  sectionsRequested: string[]
}
```

**Status Change**: None (stays `IN_REVIEW`)

---

### REVIEWER_APPROVED

**Trigger**: Reviewer approves certificate (without sending to customer)

**API Route**: `POST /api/certificates/[id]/review` (with action: 'approve')

**Code Location**: `src/app/api/certificates/[id]/review/route.ts:323`

```typescript
await tx.certificateEvent.create({
  data: {
    certificateId,
    sequenceNumber,
    revision: certificate.currentRevision,
    eventType: 'REVIEWER_APPROVED',
    eventData: JSON.stringify({
      signerName: session.user.name,
      signerEmail: session.user.email,
      signatureId: signature?.id,
    }),
    userId: session.user.id,
    userRole: 'HOD',
  },
})
```

**Payload Schema**:
```typescript
interface ReviewerApprovedPayload {
  signerName: string
  signerEmail: string
  signatureId?: string
  comment?: string
}
```

**Status Change**: `IN_REVIEW` → `APPROVED`

---

### REVIEWER_APPROVED_SENT_TO_CUSTOMER

**Trigger**: Reviewer approves AND sends to customer in one action

**API Route**: `POST /api/certificates/[id]/review` (with action: 'approveAndSend')

**Code Location**: `src/app/api/certificates/[id]/review/route.ts:394`

**Payload Schema**:
```typescript
interface ApprovedAndSentPayload {
  signerName: string
  signerEmail: string
  signatureId?: string
  customerId: string
  approvalToken: string
}
```

**Status Change**: `IN_REVIEW` → `SENT_TO_CUSTOMER`

---

### SENT_TO_CUSTOMER

**Trigger**: Admin/HOD sends approved certificate to customer

**API Route**: `POST /api/certificates/[id]/send-to-customer`

**Code Location**: `src/app/api/certificates/[id]/send-to-customer/route.ts:123`

```typescript
await tx.certificateEvent.create({
  data: {
    certificateId,
    sequenceNumber,
    revision: certificate.currentRevision,
    eventType: 'SENT_TO_CUSTOMER',
    eventData: JSON.stringify({
      customerId: customer.id,
      customerEmail: customer.email,
      approvalTokenId: approvalToken.id,
    }),
    userId: session.user.id,
    userRole: session.user.role === 'ADMIN' ? 'ADMIN' : 'HOD',
  },
})
```

**Payload Schema**:
```typescript
interface SentToCustomerPayload {
  customerId: string
  customerEmail: string
  approvalTokenId: string
}
```

**Status Change**: `APPROVED` → `SENT_TO_CUSTOMER`

---

### CUSTOMER_APPROVED

**Trigger**: Customer approves certificate in portal

**API Route**: `POST /api/customer/review/[token]/approve`

**Code Location**: `src/app/api/customer/review/[token]/approve/route.ts:125`

```typescript
await tx.certificateEvent.create({
  data: {
    certificateId,
    sequenceNumber,
    revision: certificate.currentRevision,
    eventType: 'CUSTOMER_APPROVED',
    eventData: JSON.stringify({
      customerId: customerUser.id,
      customerName: customerUser.name,
      customerEmail: customerUser.email,
      signatureId: signature?.id,
    }),
    customerId: customerUser.id,
    userRole: 'CUSTOMER',
  },
})
```

**Payload Schema**:
```typescript
interface CustomerApprovedPayload {
  customerId: string
  customerName: string
  customerEmail: string
  signatureId?: string
}
```

**Status Change**: `SENT_TO_CUSTOMER` → `CUSTOMER_APPROVED`

---

### CUSTOMER_REVISION_REQUESTED

**Trigger**: Customer requests changes in portal

**API Route**: `POST /api/customer/review/[token]/reject`

**Code Location**: `src/app/api/customer/review/[token]/reject/route.ts:140`

```typescript
await tx.certificateEvent.create({
  data: {
    certificateId,
    sequenceNumber,
    revision: certificate.currentRevision,
    eventType: 'CUSTOMER_REVISION_REQUESTED',
    eventData: JSON.stringify({
      customerId: customerUser.id,
      customerName: customerUser.name,
      comments: revisionComments,
    }),
    customerId: customerUser.id,
    userRole: 'CUSTOMER',
  },
})
```

**Payload Schema**:
```typescript
interface CustomerRevisionRequestedPayload {
  customerId: string
  customerName: string
  comments: {
    section: string
    comment: string
  }[]
}
```

**Status Change**: None (stays `SENT_TO_CUSTOMER`)

---

### ADMIN_AUTHORIZED

**Trigger**: Admin gives final authorization

**API Route**: `POST /api/admin/authorization/[id]/authorize`

**Code Location**: `src/app/api/admin/authorization/[id]/authorize/route.ts:83`

```typescript
await tx.certificateEvent.create({
  data: {
    certificateId,
    sequenceNumber,
    revision: certificate.currentRevision,
    eventType: 'ADMIN_AUTHORIZED',
    eventData: JSON.stringify({
      adminId: session.user.id,
      adminName: session.user.name,
      signatureId: signature?.id,
    }),
    userId: session.user.id,
    userRole: 'ADMIN',
  },
})
```

**Payload Schema**:
```typescript
interface AdminAuthorizedPayload {
  adminId: string
  adminName: string
  signatureId?: string
}
```

**Status Change**: `CUSTOMER_APPROVED` → `ADMIN_AUTHORIZED`

---

### ADMIN_EDIT

**Trigger**: Admin edits certificate field (override capability)

**API Route**: `POST /api/admin/certificates/[id]/edit`

**Code Location**: `src/app/api/admin/certificates/[id]/edit/route.ts:126`

```typescript
await tx.certificateEvent.create({
  data: {
    certificateId,
    sequenceNumber,
    revision: certificate.currentRevision,
    eventType: 'ADMIN_EDIT',
    eventData: JSON.stringify({
      field: fieldName,
      from: oldValue,
      to: newValue,
      reason: editReason,
    }),
    userId: session.user.id,
    userRole: 'ADMIN',
  },
})
```

**Payload Schema**:
```typescript
interface AdminEditPayload {
  field: string
  from: unknown
  to: unknown
  reason?: string
}
```

---

### SECTION_UNLOCK_REQUESTED

**Trigger**: Engineer requests to edit a locked section

**API Route**: `POST /api/certificates/[id]/assign-revision`

**Code Location**: `src/app/api/certificates/[id]/assign-revision/route.ts:172`

**Payload Schema**:
```typescript
interface SectionUnlockRequestedPayload {
  sections: string[]
  reason: string
}
```

---

### SECTION_UNLOCK_APPROVED / SECTION_UNLOCK_REJECTED

**Trigger**: Admin approves or rejects unlock request

**API Route**: `POST /api/admin/internal-requests/[id]/review`

**Payload Schema**:
```typescript
interface SectionUnlockResponsePayload {
  sections: string[]
  adminNote?: string
  approved: boolean
}
```

---

## Event Flow Diagrams

### Happy Path Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                      HAPPY PATH                                  │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. CERTIFICATE_CREATED                                         │
│     └─── Engineer creates new certificate                       │
│          status: DRAFT                                           │
│                                                                  │
│  2. SUBMITTED_FOR_REVIEW                                        │
│     └─── Engineer submits for peer review                       │
│          status: IN_REVIEW                                       │
│                                                                  │
│  3. REVIEWER_APPROVED                                           │
│     └─── Reviewer (HOD) approves                                │
│          status: APPROVED                                        │
│                                                                  │
│  4. SENT_TO_CUSTOMER                                            │
│     └─── Sent to customer portal                                │
│          status: SENT_TO_CUSTOMER                                │
│                                                                  │
│  5. CUSTOMER_APPROVED                                           │
│     └─── Customer approves                                      │
│          status: CUSTOMER_APPROVED                               │
│                                                                  │
│  6. ADMIN_AUTHORIZED                                            │
│     └─── Admin gives final authorization                        │
│          status: ADMIN_AUTHORIZED                                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Revision Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                   WITH REVIEWER REVISION                         │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. CERTIFICATE_CREATED                                         │
│  2. SUBMITTED_FOR_REVIEW                                        │
│                                                                  │
│  3. REVISION_REQUESTED ← Reviewer wants changes                 │
│     └─── status stays IN_REVIEW                                 │
│     └─── revision stays same                                    │
│                                                                  │
│  4. RESUBMITTED_FOR_REVIEW ← Engineer fixes                     │
│     └─── status stays IN_REVIEW                                 │
│     └─── revision increments                                    │
│                                                                  │
│  5. REVIEWER_APPROVED                                           │
│  6. SENT_TO_CUSTOMER                                            │
│  7. CUSTOMER_APPROVED                                           │
│  8. ADMIN_AUTHORIZED                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Customer Revision Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                  WITH CUSTOMER REVISION                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ... (after SENT_TO_CUSTOMER)                                   │
│                                                                  │
│  4. CUSTOMER_REVISION_REQUESTED ← Customer wants changes        │
│     └─── status stays SENT_TO_CUSTOMER                          │
│                                                                  │
│  5. ADMIN_REPLIED_TO_CUSTOMER ← Admin responds                  │
│     └─── May include edits                                      │
│                                                                  │
│  6. CUSTOMER_APPROVED ← Customer approves revision              │
│     └─── status: CUSTOMER_APPROVED                              │
│                                                                  │
│  7. ADMIN_AUTHORIZED                                            │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Querying Events

### Get All Events for Certificate

```typescript
const events = await prisma.certificateEvent.findMany({
  where: { certificateId },
  orderBy: { sequenceNumber: 'asc' },
  include: {
    user: { select: { id: true, name: true, role: true } },
    customer: { select: { id: true, name: true, email: true } },
  },
})
```

### Get Events by Type

```typescript
const approvals = await prisma.certificateEvent.findMany({
  where: {
    eventType: {
      in: [
        'REVIEWER_APPROVED',
        'CUSTOMER_APPROVED',
        'ADMIN_AUTHORIZED',
      ],
    },
  },
})
```

### Get Latest Event

```typescript
const latestEvent = await prisma.certificateEvent.findFirst({
  where: { certificateId },
  orderBy: { sequenceNumber: 'desc' },
})
```

### Count Events by Type

```typescript
const counts = await prisma.certificateEvent.groupBy({
  by: ['eventType'],
  _count: { id: true },
  where: { certificateId },
})
```
