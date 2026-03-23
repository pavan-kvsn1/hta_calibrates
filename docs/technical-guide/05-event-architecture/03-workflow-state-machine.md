# Workflow State Machine

## Certificate Status Values

```typescript
// Defined in prisma/schema.prisma

enum CertificateStatus {
  DRAFT
  IN_REVIEW
  APPROVED
  SENT_TO_CUSTOMER
  CUSTOMER_APPROVED
  ADMIN_AUTHORIZED
  REJECTED
}
```

---

## State Machine Diagram

```
┌─────────────────────────────────────────────────────────────────────────────────────┐
│                           CERTIFICATE STATE MACHINE                                  │
├─────────────────────────────────────────────────────────────────────────────────────┤
│                                                                                      │
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                           INTERNAL WORKFLOW                                  │   │
│   │  ┌─────────┐                                                                │   │
│   │  │  DRAFT  │                                                                │   │
│   │  │         │ ←── Certificate created, engineer editing                      │   │
│   │  └────┬────┘                                                                │   │
│   │       │                                                                      │   │
│   │       │ submit()                                                             │   │
│   │       ▼                                                                      │   │
│   │  ┌─────────┐                                                                │   │
│   │  │IN_REVIEW│◄─────────────────────────────┐                                 │   │
│   │  │         │ ←── Peer reviewer examining   │                                 │   │
│   │  └────┬────┘                              │ resubmit()                      │   │
│   │       │                                    │                                 │   │
│   │       ├────── requestRevision() ──────────┘                                 │   │
│   │       │       (no status change)                                            │   │
│   │       │                                                                      │   │
│   │       │ approve()                                                            │   │
│   │       ▼                                                                      │   │
│   │  ┌─────────┐                                                                │   │
│   │  │APPROVED │                                                                │   │
│   │  │         │ ←── Reviewer approved, ready for customer                      │   │
│   │  └────┬────┘                                                                │   │
│   │       │                                                                      │   │
│   └───────┼─────────────────────────────────────────────────────────────────────┘   │
│           │                                                                          │
│           │ sendToCustomer()                                                         │
│           ▼                                                                          │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                          CUSTOMER WORKFLOW                                   │   │
│   │  ┌─────────────────┐                                                        │   │
│   │  │SENT_TO_CUSTOMER │◄─────────────────────┐                                 │   │
│   │  │                 │ ←── Customer reviewing │                                 │   │
│   │  └────────┬────────┘                       │ adminReply()                    │   │
│   │           │                                 │                                 │   │
│   │           ├─── requestRevision() ──────────┘                                 │   │
│   │           │    (customer wants changes)                                      │   │
│   │           │                                                                  │   │
│   │           │ customerApprove()                                                │   │
│   │           ▼                                                                  │   │
│   │  ┌─────────────────┐                                                        │   │
│   │  │CUSTOMER_APPROVED│                                                        │   │
│   │  │                 │ ←── Customer signed off                                 │   │
│   │  └────────┬────────┘                                                        │   │
│   │           │                                                                  │   │
│   └───────────┼──────────────────────────────────────────────────────────────────┘   │
│               │                                                                      │
│               │ adminAuthorize()                                                     │
│               ▼                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                          FINAL AUTHORIZATION                                 │   │
│   │  ┌─────────────────┐                                                        │   │
│   │  │ADMIN_AUTHORIZED │                                                        │   │
│   │  │                 │ ←── FINAL STATE - Certificate complete                  │   │
│   │  └─────────────────┘                                                        │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
│                                                                                      │
│   ┌─────────────────────────────────────────────────────────────────────────────┐   │
│   │                          REJECTION PATH                                      │   │
│   │                                                                              │   │
│   │  (Any status except ADMIN_AUTHORIZED)                                       │   │
│   │           │                                                                  │   │
│   │           │ reject()                                                         │   │
│   │           ▼                                                                  │   │
│   │  ┌─────────┐                                                                │   │
│   │  │REJECTED │                                                                │   │
│   │  │         │ ←── Terminal state (rare)                                      │   │
│   │  └─────────┘                                                                │   │
│   │                                                                              │   │
│   └─────────────────────────────────────────────────────────────────────────────┘   │
│                                                                                      │
└─────────────────────────────────────────────────────────────────────────────────────┘
```

---

## State Transition Rules

### From DRAFT

| Transition | To Status | Required Role | Validation |
|------------|-----------|---------------|------------|
| `submit()` | IN_REVIEW | ENGINEER | Must have reviewer assigned |

```typescript
// Only engineers who created the certificate can submit
if (certificate.createdById !== session.user.id) {
  throw new Error('Only certificate creator can submit')
}

// Must have reviewer
if (!certificate.reviewerId) {
  throw new Error('Must assign reviewer before submitting')
}
```

---

### From IN_REVIEW

| Transition | To Status | Required Role | Validation |
|------------|-----------|---------------|------------|
| `requestRevision()` | IN_REVIEW | HOD | Must be assigned reviewer |
| `approve()` | APPROVED | HOD | Must be assigned reviewer |
| `approveAndSend()` | SENT_TO_CUSTOMER | HOD | Must have customer assigned |
| `reject()` | REJECTED | HOD/ADMIN | Must provide reason |

```typescript
// Only assigned reviewer can take actions
if (certificate.reviewerId !== session.user.id) {
  throw new Error('Only assigned reviewer can review')
}

// For approve + send, need customer
if (action === 'approveAndSend' && !certificate.customerUserId) {
  throw new Error('Must assign customer before sending')
}
```

---

### From APPROVED

| Transition | To Status | Required Role | Validation |
|------------|-----------|---------------|------------|
| `sendToCustomer()` | SENT_TO_CUSTOMER | HOD/ADMIN | Must have customer assigned |

```typescript
// Need a customer to send to
if (!certificate.customerUserId && !customerEmail) {
  throw new Error('Must specify customer')
}
```

---

### From SENT_TO_CUSTOMER

| Transition | To Status | Required Role | Validation |
|------------|-----------|---------------|------------|
| `customerApprove()` | CUSTOMER_APPROVED | CUSTOMER | Valid approval token |
| `customerRequestRevision()` | SENT_TO_CUSTOMER | CUSTOMER | Valid token, comments required |
| `adminReply()` | SENT_TO_CUSTOMER | ADMIN | Can edit and respond |

```typescript
// Customer actions require valid token
const token = await prisma.approvalToken.findUnique({
  where: { token: tokenValue },
})

if (!token || token.expiresAt < new Date()) {
  throw new Error('Invalid or expired token')
}
```

---

### From CUSTOMER_APPROVED

| Transition | To Status | Required Role | Validation |
|------------|-----------|---------------|------------|
| `adminAuthorize()` | ADMIN_AUTHORIZED | ADMIN | Must be admin |

```typescript
// Only admins can authorize
if (session.user.role !== 'ADMIN') {
  throw new Error('Only admins can authorize')
}
```

---

### From ADMIN_AUTHORIZED

**No transitions** - this is the terminal success state.

The certificate is complete and cannot be changed.

---

## Status Labels for UI

```typescript
// Used for displaying status in UI

const STATUS_LABELS: Record<string, string> = {
  DRAFT: 'Draft',
  IN_REVIEW: 'In Review',
  APPROVED: 'Approved',
  SENT_TO_CUSTOMER: 'Awaiting Customer',
  CUSTOMER_APPROVED: 'Customer Approved',
  ADMIN_AUTHORIZED: 'Authorized',
  REJECTED: 'Rejected',
}

const STATUS_COLORS: Record<string, string> = {
  DRAFT: 'bg-gray-100 text-gray-800',
  IN_REVIEW: 'bg-blue-100 text-blue-800',
  APPROVED: 'bg-green-100 text-green-800',
  SENT_TO_CUSTOMER: 'bg-purple-100 text-purple-800',
  CUSTOMER_APPROVED: 'bg-emerald-100 text-emerald-800',
  ADMIN_AUTHORIZED: 'bg-teal-100 text-teal-800',
  REJECTED: 'bg-red-100 text-red-800',
}
```

---

## Role Permissions by Status

### Engineer

| Status | Can Do |
|--------|--------|
| DRAFT | Edit all fields, Submit |
| IN_REVIEW (revision requested) | Edit unlocked sections, Resubmit |
| Other | View only |

### HOD (Peer Reviewer)

| Status | Can Do |
|--------|--------|
| IN_REVIEW (assigned) | Request revision, Approve, Approve+Send |
| Other | View only |

### Admin

| Status | Can Do |
|--------|--------|
| Any (except AUTHORIZED) | Edit any field, Admin overrides |
| SENT_TO_CUSTOMER | Reply to customer revisions |
| CUSTOMER_APPROVED | Final authorization |
| ADMIN_AUTHORIZED | View only (complete) |

### Customer

| Status | Can Do |
|--------|--------|
| SENT_TO_CUSTOMER | View, Approve, Request revision |
| Other | No access |

---

## Validating Transitions

All API routes validate transitions:

```typescript
// Example: Submit for review

async function validateSubmit(certificate: Certificate, userId: string) {
  // 1. Check current status
  if (certificate.status !== 'DRAFT') {
    throw new APIError(400, 'Can only submit certificates in DRAFT status')
  }

  // 2. Check ownership
  if (certificate.createdById !== userId) {
    throw new APIError(403, 'Only certificate creator can submit')
  }

  // 3. Check prerequisites
  if (!certificate.reviewerId) {
    throw new APIError(400, 'Must assign reviewer before submitting')
  }

  // 4. Check required fields
  const missingFields = validateRequiredFields(certificate)
  if (missingFields.length > 0) {
    throw new APIError(400, `Missing required fields: ${missingFields.join(', ')}`)
  }
}
```

---

## Status Query Patterns

### Get Certificates by Status

```typescript
// Get all certificates in review
const inReview = await prisma.certificate.findMany({
  where: { status: 'IN_REVIEW' },
})

// Get certificates awaiting customer
const awaitingCustomer = await prisma.certificate.findMany({
  where: { status: 'SENT_TO_CUSTOMER' },
})
```

### Get My Pending Work

```typescript
// Engineer: My drafts
const myDrafts = await prisma.certificate.findMany({
  where: {
    createdById: userId,
    status: 'DRAFT',
  },
})

// HOD: Certificates I need to review
const toReview = await prisma.certificate.findMany({
  where: {
    reviewerId: userId,
    status: 'IN_REVIEW',
  },
})

// Admin: Certificates awaiting authorization
const toAuthorize = await prisma.certificate.findMany({
  where: {
    status: 'CUSTOMER_APPROVED',
  },
})
```

### Status Counts for Dashboard

```typescript
const counts = await prisma.certificate.groupBy({
  by: ['status'],
  _count: { id: true },
})

// Result:
// [
//   { status: 'DRAFT', _count: { id: 5 } },
//   { status: 'IN_REVIEW', _count: { id: 12 } },
//   { status: 'APPROVED', _count: { id: 3 } },
//   ...
// ]
```

---

## Common Workflow Scenarios

### Scenario 1: Perfect Certificate (No Revisions)

```
1. Engineer creates certificate (DRAFT)
2. Engineer assigns reviewer
3. Engineer submits (DRAFT → IN_REVIEW)
4. Reviewer approves (IN_REVIEW → APPROVED)
5. Admin sends to customer (APPROVED → SENT_TO_CUSTOMER)
6. Customer approves (SENT_TO_CUSTOMER → CUSTOMER_APPROVED)
7. Admin authorizes (CUSTOMER_APPROVED → ADMIN_AUTHORIZED)
```

### Scenario 2: Reviewer Requests Revision

```
1. Engineer creates and submits (DRAFT → IN_REVIEW)
2. Reviewer requests revision (stays IN_REVIEW)
   └── Specific sections marked for revision
3. Engineer makes changes
4. Engineer resubmits (stays IN_REVIEW, revision++)
5. Reviewer approves (IN_REVIEW → APPROVED)
... continue to customer flow
```

### Scenario 3: Customer Requests Revision

```
1. ... (approved and sent to customer)
2. Customer requests revision (stays SENT_TO_CUSTOMER)
   └── Comments submitted
3. Admin reviews customer request
4. Admin makes edits (stays SENT_TO_CUSTOMER)
5. Admin replies to customer (stays SENT_TO_CUSTOMER)
6. Customer approves (SENT_TO_CUSTOMER → CUSTOMER_APPROVED)
7. Admin authorizes (CUSTOMER_APPROVED → ADMIN_AUTHORIZED)
```

### Scenario 4: Multiple Revision Cycles

```
1. Submit (rev 1)
2. Reviewer revision requested
3. Resubmit (rev 2)
4. Reviewer revision requested again
5. Resubmit (rev 3)
6. Approved
7. Customer revision requested
8. Admin edits
9. Customer revision requested again
10. Admin edits
11. Customer approves
12. Authorized
```

---

## Edge Cases

### Can Status Go Backwards?

**Generally no**, except:
- Revision requests keep status but change workflow state
- Admin has override capabilities

### What if Customer Never Responds?

- Certificate stays in `SENT_TO_CUSTOMER`
- No automatic expiration (token expires but certificate status unchanged)
- Admin can resend with new token

### What if Reviewer is Changed Mid-Review?

- Admin can reassign reviewer
- Creates `REVIEWER_CHANGED` event
- New reviewer continues review

### Can ADMIN_AUTHORIZED Certificates Be Changed?

**No** - this is intentional:
- Authorized certificates are legal documents
- No modifications after authorization
- If change needed, issue amendment/revision certificate
