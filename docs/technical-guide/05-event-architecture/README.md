# 05 - Event Architecture

## Documentation Index

| File | Description | When to Read |
|------|-------------|--------------|
| [01-event-sourcing.md](./01-event-sourcing.md) | Event sourcing concepts, CertificateEvent model | Understanding audit trail design |
| [02-event-types.md](./02-event-types.md) | All event types, their triggers, and payloads | Adding new events, debugging workflow |
| [03-workflow-state-machine.md](./03-workflow-state-machine.md) | Certificate status transitions, state machine | Understanding certificate lifecycle |
| [04-tat-calculator.md](./04-tat-calculator.md) | Turn Around Time calculation from events | Performance metrics, SLA tracking |
| [05-timeline-ui.md](./05-timeline-ui.md) | How events render in the UI, history section | Modifying audit history display |

---

## Quick Reference

### Event Recording Pattern

```typescript
// Always record events within a transaction
await prisma.$transaction(async (tx) => {
  // 1. Update the certificate
  await tx.certificate.update({ ... })

  // 2. Record the event
  await tx.certificateEvent.create({
    data: {
      certificateId,
      sequenceNumber: await getNextSequenceNumber(tx, certificateId),
      revision: certificate.currentRevision,
      eventType: 'SUBMITTED_FOR_REVIEW',
      eventData: JSON.stringify({ ... }),
      userId: currentUser.id,
      userRole: 'ENGINEER',
    },
  })
})
```

### Certificate Status Flow

```
DRAFT → IN_REVIEW → APPROVED → SENT_TO_CUSTOMER → CUSTOMER_APPROVED → ADMIN_AUTHORIZED
                  ↓                             ↓
           REVISION_REQUESTED          CUSTOMER_REVISION_REQUESTED
                  ↓                             ↓
               (back to IN_REVIEW)      (back to APPROVED)
```

---

## Architecture Overview

```
┌─────────────────────────────────────────────────────────────────┐
│                    EVENT SOURCING ARCHITECTURE                   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │                     Certificate                          │    │
│  │  ┌─────────┐  ┌─────────┐  ┌─────────┐  ┌─────────┐    │    │
│  │  │ DRAFT   │→ │IN_REVIEW│→ │APPROVED │→ │AUTHORIZED│   │    │
│  │  └─────────┘  └─────────┘  └─────────┘  └─────────┘    │    │
│  │       ↓                                                  │    │
│  │       ↓  Every state change = new CertificateEvent       │    │
│  │       ↓                                                  │    │
│  └───────┼──────────────────────────────────────────────────┘    │
│          │                                                        │
│          ▼                                                        │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │              CertificateEvent (Immutable Log)            │    │
│  │  ┌─────────────────────────────────────────────────────┐│    │
│  │  │ seq=1  │ CERTIFICATE_CREATED     │ Engineer         ││    │
│  │  ├────────┼─────────────────────────┼──────────────────┤│    │
│  │  │ seq=2  │ SUBMITTED_FOR_REVIEW    │ Engineer         ││    │
│  │  ├────────┼─────────────────────────┼──────────────────┤│    │
│  │  │ seq=3  │ REVISION_REQUESTED      │ HOD              ││    │
│  │  ├────────┼─────────────────────────┼──────────────────┤│    │
│  │  │ seq=4  │ RESUBMITTED_FOR_REVIEW  │ Engineer         ││    │
│  │  ├────────┼─────────────────────────┼──────────────────┤│    │
│  │  │ seq=5  │ REVIEWER_APPROVED       │ HOD              ││    │
│  │  └────────┴─────────────────────────┴──────────────────┘│    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Benefits:                                                       │
│  ├── Complete audit trail (compliance requirement)              │
│  ├── TAT metrics calculation from events                       │
│  ├── Timeline reconstruction for any certificate               │
│  ├── Never lose data - events are append-only                  │
│  └── Debug any workflow issue by replaying events              │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Core Concepts

### 1. Certificate State (Mutable)

The `Certificate.status` field holds the current state. It changes as the certificate moves through the workflow.

### 2. Certificate Events (Immutable)

Every status change, edit, or action creates a new `CertificateEvent`. Events are:
- **Append-only**: Never updated or deleted
- **Ordered**: Via `sequenceNumber` per certificate
- **Timestamped**: Via `createdAt`
- **Actor-tracked**: Via `userId` or `customerId`

### 3. TAT Metrics

Turn Around Time is calculated by analyzing event timestamps:
- First `SUBMITTED_FOR_REVIEW` → Final `ADMIN_AUTHORIZED` = Total TAT
- Individual stage TATs calculated from event pairs

---

## Key Files

| File | Purpose |
|------|---------|
| `prisma/schema.prisma:375` | CertificateEvent model definition |
| `src/types/certificate.ts:180` | CertificateEvent TypeScript type |
| `src/lib/utils/tat-calculator.ts` | TAT calculation logic |
| `src/app/admin/certificates/[id]/AdminHistorySection.tsx` | Timeline UI |
| `src/app/api/certificates/[id]/submit/route.ts` | Event creation example |

---

## Common Event Types

| Event | Trigger | Actor |
|-------|---------|-------|
| `CERTIFICATE_CREATED` | New certificate created | Engineer |
| `SUBMITTED_FOR_REVIEW` | Engineer submits for peer review | Engineer |
| `REVISION_REQUESTED` | Reviewer requests changes | HOD |
| `RESUBMITTED_FOR_REVIEW` | Engineer resubmits after revision | Engineer |
| `REVIEWER_APPROVED` | Reviewer approves certificate | HOD |
| `SENT_TO_CUSTOMER` | Certificate sent for customer review | Admin/HOD |
| `CUSTOMER_APPROVED` | Customer approves certificate | Customer |
| `CUSTOMER_REVISION_REQUESTED` | Customer requests changes | Customer |
| `ADMIN_AUTHORIZED` | Admin gives final authorization | Admin |

---

## Related Documentation

- [03-database](../03-database/) - Database schema including events
- [04-authentication](../04-authentication/) - User roles and permissions
- [02-backend](../02-backend/) - API routes that create events
