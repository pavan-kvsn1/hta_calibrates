# Event Sourcing Deep Dive

## What is Event Sourcing?

Event sourcing is a pattern where:
- **State changes are stored as events** rather than overwriting current state
- **The current state can be reconstructed** by replaying events
- **Complete audit trail** is automatically maintained

```
┌─────────────────────────────────────────────────────────────────┐
│                TRADITIONAL vs EVENT SOURCING                     │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TRADITIONAL (What we DON'T do):                                │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Certificate                                               │    │
│  │ status: "APPROVED"  ← Only current state, history lost   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  EVENT SOURCING (What we DO):                                   │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ Certificate                                               │    │
│  │ status: "APPROVED"  ← Current state (for queries)        │    │
│  └─────────────────────────────────────────────────────────┘    │
│           │                                                      │
│           │ derives from                                         │
│           ▼                                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ CertificateEvent[]                                        │    │
│  │ [CREATED] → [SUBMITTED] → [APPROVED] ← Full history      │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Why Event Sourcing for HTA?

### 1. Compliance Requirements

Calibration certificates are legal documents. Regulators may require:
- Complete audit trail of all changes
- Who did what, when
- Evidence that proper review process was followed

### 2. TAT Metrics

Business needs to measure Turn Around Time:
- How long does peer review take?
- How long do customers take to approve?
- Which stage is the bottleneck?

**Without events, this data doesn't exist.**

### 3. Debugging Workflow Issues

When something goes wrong:
```
"Why is certificate HTA-2024-001 stuck?"
"Who requested the revision?"
"When was it sent to customer?"
```

Events answer all these questions.

### 4. Customer Trust

Customers see the timeline in their portal:
- When was it submitted
- Who reviewed it
- All revision requests and responses

---

## CertificateEvent Model

```prisma
// prisma/schema.prisma:375

model CertificateEvent {
  id             String   @id @default(uuid())
  certificateId  String
  sequenceNumber Int      // Ordered sequence within certificate
  revision       Int      // Which revision this event belongs to

  eventType String // CERTIFICATE_CREATED, SUBMITTED_FOR_REVIEW, etc.
  eventData String // JSON payload stored as string for SQLite

  userId     String?  // For staff events (engineer, HoD, admin)
  customerId String?  // For customer events
  userRole   String   // ENGINEER, HOD, ADMIN, CUSTOMER

  createdAt DateTime @default(now())

  // Relations
  certificate Certificate      @relation(...)
  user        User?            @relation("EventActor", ...)
  customer    CustomerUser?    @relation(...)
  feedbacks   ReviewFeedback[]

  @@unique([certificateId, sequenceNumber])
  @@index([certificateId, createdAt])
  @@index([certificateId, revision])
}
```

### Field Explanations

| Field | Purpose |
|-------|---------|
| `id` | UUID, primary key |
| `certificateId` | Links to certificate |
| `sequenceNumber` | Order within certificate (1, 2, 3...) |
| `revision` | Which revision number (0, 1, 2...) |
| `eventType` | String constant like `SUBMITTED_FOR_REVIEW` |
| `eventData` | JSON string with event-specific payload |
| `userId` | Staff user who triggered event (optional) |
| `customerId` | Customer who triggered event (optional) |
| `userRole` | Role at time of event |
| `createdAt` | Timestamp |

### Why `sequenceNumber`?

Events may have identical `createdAt` timestamps (same second). The `sequenceNumber` ensures correct ordering:

```typescript
// Get next sequence number
const lastEvent = await tx.certificateEvent.findFirst({
  where: { certificateId },
  orderBy: { sequenceNumber: 'desc' },
})
const nextSeq = (lastEvent?.sequenceNumber ?? 0) + 1
```

### Why `eventData` is String (not JSON)?

SQLite doesn't have native JSON type. For compatibility:
- **SQLite**: `eventData` stored as string, manually parsed
- **PostgreSQL**: Could use native JSON, but we use string for consistency

```typescript
// Writing event
eventData: JSON.stringify({
  field: 'status',
  from: 'DRAFT',
  to: 'IN_REVIEW',
})

// Reading event
const data = JSON.parse(event.eventData)
```

---

## Creating Events

### Pattern: Always in Transaction

Events must be created in the same transaction as state changes:

```typescript
// src/app/api/certificates/[id]/submit/route.ts

export async function POST(request: NextRequest, { params }) {
  const { id: certificateId } = await params

  return prisma.$transaction(async (tx) => {
    // 1. Get current state
    const certificate = await tx.certificate.findUnique({
      where: { id: certificateId },
    })

    // 2. Validate transition
    if (certificate.status !== 'DRAFT') {
      throw new Error('Can only submit from DRAFT status')
    }

    // 3. Get next sequence number
    const lastEvent = await tx.certificateEvent.findFirst({
      where: { certificateId },
      orderBy: { sequenceNumber: 'desc' },
    })
    const sequenceNumber = (lastEvent?.sequenceNumber ?? 0) + 1

    // 4. Update certificate state
    const updated = await tx.certificate.update({
      where: { id: certificateId },
      data: {
        status: 'IN_REVIEW',
        submittedAt: new Date(),
      },
    })

    // 5. Create event
    const event = await tx.certificateEvent.create({
      data: {
        certificateId,
        sequenceNumber,
        revision: certificate.currentRevision,
        eventType: 'SUBMITTED_FOR_REVIEW',
        eventData: JSON.stringify({
          reviewerId: reviewerId,
          submittedBy: currentUser.id,
        }),
        userId: currentUser.id,
        userRole: 'ENGINEER',
      },
    })

    return updated
  })
}
```

### Why Transaction is Critical

```
Without Transaction:
1. Update certificate status → SUCCESS
2. Create event → FAILS
Result: Status changed but no event recorded (audit gap!)

With Transaction:
1. Update certificate status → SUCCESS
2. Create event → FAILS
3. ROLLBACK → Both operations undone
Result: Consistent state
```

---

## Reading Events

### Timeline Query

```typescript
// Get all events for a certificate, ordered
const events = await prisma.certificateEvent.findMany({
  where: { certificateId },
  orderBy: { sequenceNumber: 'asc' },
  include: {
    user: { select: { id: true, name: true, role: true } },
    customer: { select: { id: true, name: true, email: true } },
  },
})
```

### Events by Revision

```typescript
// Get events for a specific revision
const revision1Events = await prisma.certificateEvent.findMany({
  where: {
    certificateId,
    revision: 1,
  },
  orderBy: { sequenceNumber: 'asc' },
})
```

### Filter by Event Type

```typescript
// Get all approval events
const approvals = await prisma.certificateEvent.findMany({
  where: {
    certificateId,
    eventType: { in: ['REVIEWER_APPROVED', 'CUSTOMER_APPROVED', 'ADMIN_AUTHORIZED'] },
  },
})
```

---

## Event Data Payloads

Different event types have different payloads:

### CERTIFICATE_CREATED

```json
{
  "customerName": "Test Company",
  "uucDescription": "Digital Multimeter",
  "createdBy": "engineer-id"
}
```

### SUBMITTED_FOR_REVIEW

```json
{
  "reviewerId": "hod-id",
  "submittedBy": "engineer-id"
}
```

### REVISION_REQUESTED

```json
{
  "sections": ["results", "conclusion"],
  "comments": [
    {
      "section": "results",
      "comment": "Check measurement uncertainty"
    }
  ]
}
```

### REVIEWER_APPROVED

```json
{
  "signerName": "Kiran Kumar",
  "signerEmail": "kiran@htaipl.com",
  "signatureId": "sig-uuid"
}
```

### ADMIN_EDIT

```json
{
  "field": "customerName",
  "from": "Old Company",
  "to": "New Company",
  "reason": "Customer requested name correction"
}
```

---

## Hybrid Approach: State + Events

HTA uses a **hybrid approach**:

1. **Current state in Certificate table**: For fast queries
2. **Events in CertificateEvent table**: For audit and metrics

### Why Not Pure Event Sourcing?

Pure event sourcing requires replaying events to get current state:

```typescript
// Pure event sourcing (NOT what we do)
function getCurrentStatus(events: Event[]): string {
  let status = 'DRAFT'
  for (const event of events) {
    if (event.type === 'SUBMITTED') status = 'IN_REVIEW'
    if (event.type === 'APPROVED') status = 'APPROVED'
    // ...
  }
  return status
}
```

Problems:
- **Slow**: Must replay N events for each query
- **Complex**: Logic duplicated between write and read paths
- **Overkill**: We don't need time-travel or event replay

### Hybrid Benefits

```typescript
// FAST: Query current state directly
const cert = await prisma.certificate.findUnique({ where: { id } })
console.log(cert.status) // "APPROVED"

// COMPLETE: Full history available when needed
const events = await prisma.certificateEvent.findMany({
  where: { certificateId: id },
  orderBy: { sequenceNumber: 'asc' },
})
```

---

## Revision Numbers

### What is a Revision?

Each time an engineer submits a certificate, the revision number increments:

```
Revision 0: Initial creation
Revision 1: First submission (DRAFT → IN_REVIEW)
Revision 2: After first revision request
Revision 3: After second revision request
```

### Events Track Revisions

```typescript
// Events know which revision they belong to
{
  eventType: 'SUBMITTED_FOR_REVIEW',
  revision: 1,  // First submission
}

{
  eventType: 'REVISION_REQUESTED',
  revision: 1,  // Revision requested on first submission
}

{
  eventType: 'RESUBMITTED_FOR_REVIEW',
  revision: 2,  // Second submission (revision 2)
}
```

### CertificateRevision Snapshots

At each submission, we also create a `CertificateRevision` snapshot:

```typescript
// Creates full JSON snapshot of certificate state
await tx.certificateRevision.create({
  data: {
    certificateId,
    revisionNumber: newRevision,
    snapshot: JSON.stringify(certificateData),
    triggeredBy: 'SUBMITTED_FOR_REVIEW',
    triggeredByUserId: userId,
  },
})
```

This allows viewing the exact state at any revision:
- "What did revision 1 look like?"
- "What changed between revision 2 and 3?"

---

## Common Issues

### Missing Events

**Problem**: Action happened but no event recorded

**Cause**: Event creation outside transaction

**Fix**: Always create events in same transaction as state change

### Sequence Number Gaps

**Problem**: Sequence numbers are 1, 2, 5, 6 (missing 3, 4)

**Cause**: Concurrent events or failed transactions

**Impact**: Usually harmless, ordering still correct

### eventData Parse Errors

**Problem**: `JSON.parse(event.eventData)` fails

**Cause**: Malformed JSON or encoding issues

**Debug**:
```typescript
console.log(event.eventData) // Check raw value
console.log(typeof event.eventData) // Should be 'string'
```

---

## Best Practices

### 1. Always Include Actor

```typescript
// GOOD
{
  userId: currentUser.id,
  userRole: currentUser.role,
}

// BAD - who did this?
{
  eventType: 'APPROVED',
  // no actor info
}
```

### 2. Include Before/After in Edit Events

```typescript
// GOOD - can understand the change
{
  field: 'customerName',
  from: 'Old Value',
  to: 'New Value',
}

// BAD - what changed?
{
  field: 'customerName',
  value: 'New Value',
}
```

### 3. Keep eventData Schemas Consistent

Define types for each event's payload:

```typescript
interface SubmittedForReviewPayload {
  reviewerId: string
  submittedBy: string
}

interface RevisionRequestedPayload {
  sections: string[]
  comments: { section: string; comment: string }[]
}
```

### 4. Don't Store Sensitive Data

```typescript
// GOOD
{
  signerName: 'John Doe',
  // signature reference
  signatureId: 'sig-uuid',
}

// BAD - signature data in events
{
  signatureData: 'base64-encoded-signature-image...',
}
```
