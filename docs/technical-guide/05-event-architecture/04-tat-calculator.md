# TAT (Turn Around Time) Calculator

## What is TAT?

Turn Around Time measures how long it takes for a certificate to move through the workflow:
- **Total TAT**: From first submission to final authorization
- **Stage TAT**: Time spent in each workflow stage

---

## Business Value

```
┌─────────────────────────────────────────────────────────────────┐
│                    WHY TAT MATTERS                               │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  1. SLA TRACKING                                                │
│     └── "We promise 48-hour turnaround"                         │
│     └── Track which certificates are overdue                    │
│                                                                  │
│  2. BOTTLENECK IDENTIFICATION                                   │
│     └── "Reviewer stage averages 12 hours"                      │
│     └── "Customer stage averages 72 hours" ← Problem!           │
│                                                                  │
│  3. PERFORMANCE METRICS                                         │
│     └── Dashboard shows avg TAT this week vs last               │
│     └── Identify trends and improvements                        │
│                                                                  │
│  4. RESOURCE PLANNING                                           │
│     └── "We average 3.5 revision cycles"                        │
│     └── High revision = training needed                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## TAT Calculator Location

**File**: `src/lib/utils/tat-calculator.ts`

This file exports:
- `calculateCertificateTAT()` - Single certificate metrics
- `aggregateTATMetrics()` - Aggregate across multiple certificates
- `compareWeeklyMetrics()` - Week-over-week comparison

---

## TAT Stages

```
┌─────────────────────────────────────────────────────────────────┐
│                        TAT STAGES                                │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  TOTAL TAT                                                      │
│  ┌─────────────────────────────────────────────────────────┐    │
│  │ SUBMITTED_FOR_REVIEW ───────────────► ADMIN_AUTHORIZED   │    │
│  └─────────────────────────────────────────────────────────┘    │
│                                                                  │
│  Broken down into stages:                                       │
│                                                                  │
│  1. REVIEWER STAGE                                              │
│     SUBMITTED/RESUBMITTED ───► REVIEWER_APPROVED/REVISION_REQ   │
│                                                                  │
│  2. ENGINEER REVISION (if needed)                               │
│     REVISION_REQUESTED ───────► RESUBMITTED_FOR_REVIEW          │
│                                                                  │
│  3. CUSTOMER STAGE                                              │
│     SENT_TO_CUSTOMER ─────────► CUSTOMER_APPROVED/REVISION_REQ  │
│                                                                  │
│  4. CUSTOMER REVISION (if needed)                               │
│     CUSTOMER_REVISION_REQ ────► SENT_TO_CUSTOMER (resent)       │
│                                                                  │
│  5. ADMIN APPROVAL                                              │
│     CUSTOMER_APPROVED ────────► ADMIN_AUTHORIZED                │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Code Walkthrough

### Main Types

```typescript
// src/lib/utils/tat-calculator.ts:16-42

interface CertificateEvent {
  id: string
  eventType: string
  createdAt: Date
  certificateId: string
}

interface StageTATResult {
  totalHours: number   // Sum of all cycles
  cycleCount: number   // How many times this stage ran
  avgHours: number     // Average per cycle
}

interface CertificateTATMetrics {
  certificateId: string
  totalTAT: {
    hours: number
    isComplete: boolean
    startedAt: Date | null
    completedAt: Date | null
  }
  reviewer: StageTATResult
  engineerRevision: StageTATResult
  customer: StageTATResult
  customerRevision: StageTATResult
  adminApproval: StageTATResult
}
```

### calculateCertificateTAT Function

```typescript
// src/lib/utils/tat-calculator.ts:115-292

export function calculateCertificateTAT(
  events: CertificateEvent[]
): CertificateTATMetrics | null {
  if (events.length === 0) return null

  // Sort events chronologically
  const sortedEvents = [...events].sort(
    (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
  )

  // Initialize result structure
  const result: CertificateTATMetrics = {
    certificateId: sortedEvents[0].certificateId,
    totalTAT: {
      hours: 0,
      isComplete: false,
      startedAt: null,
      completedAt: null,
    },
    reviewer: { totalHours: 0, cycleCount: 0, avgHours: 0 },
    engineerRevision: { totalHours: 0, cycleCount: 0, avgHours: 0 },
    customer: { totalHours: 0, cycleCount: 0, avgHours: 0 },
    customerRevision: { totalHours: 0, cycleCount: 0, avgHours: 0 },
    adminApproval: { totalHours: 0, cycleCount: 0, avgHours: 0 },
  }

  // Find start and end for total TAT
  const firstSubmission = sortedEvents.find(
    e => e.eventType === EVENTS.SUBMITTED_FOR_REVIEW
  )
  const adminSigned = sortedEvents.find(
    e => e.eventType === EVENTS.ADMIN_AUTHORIZED
  )

  if (firstSubmission) {
    result.totalTAT.startedAt = new Date(firstSubmission.createdAt)

    if (adminSigned) {
      result.totalTAT.completedAt = new Date(adminSigned.createdAt)
      result.totalTAT.hours = hoursBetween(
        result.totalTAT.startedAt,
        result.totalTAT.completedAt
      )
      result.totalTAT.isComplete = true
    } else {
      // Still in progress - calculate to now
      result.totalTAT.hours = hoursBetween(result.totalTAT.startedAt, new Date())
    }
  }

  // Process each event to calculate stage TATs
  // ... (state machine tracking each stage)

  return result
}
```

### Stage TAT Calculation Logic

The calculator uses a state machine pattern:

```typescript
// Track pending start events for each stage
let reviewerStartEvent: CertificateEvent | null = null
let engineerRevisionStartEvent: CertificateEvent | null = null
let customerStartEvent: CertificateEvent | null = null
// ...

for (const event of sortedEvents) {
  const eventDate = new Date(event.createdAt)

  switch (event.eventType) {
    // Reviewer stage start
    case EVENTS.SUBMITTED_FOR_REVIEW:
    case EVENTS.RESUBMITTED_FOR_REVIEW:
      reviewerStartEvent = event
      break

    // Reviewer stage end
    case EVENTS.REVIEWER_APPROVED:
    case EVENTS.REVISION_REQUESTED:
      if (reviewerStartEvent) {
        const hours = hoursBetween(
          new Date(reviewerStartEvent.createdAt),
          eventDate
        )
        result.reviewer.totalHours += hours
        result.reviewer.cycleCount++
        reviewerStartEvent = null
      }
      // If revision requested, start engineer revision stage
      if (event.eventType === EVENTS.REVISION_REQUESTED) {
        engineerRevisionStartEvent = event
      }
      break

    // ... similar for other stages
  }
}
```

---

## Example Calculation

### Sample Events

```
Event 1: SUBMITTED_FOR_REVIEW    @ 2024-01-01 09:00
Event 2: REVISION_REQUESTED      @ 2024-01-01 14:00 (5 hours later)
Event 3: RESUBMITTED_FOR_REVIEW  @ 2024-01-01 16:00 (2 hours later)
Event 4: REVIEWER_APPROVED       @ 2024-01-01 18:00 (2 hours later)
Event 5: SENT_TO_CUSTOMER        @ 2024-01-01 18:30 (30 min later)
Event 6: CUSTOMER_APPROVED       @ 2024-01-02 10:00 (15.5 hours later)
Event 7: ADMIN_AUTHORIZED        @ 2024-01-02 11:00 (1 hour later)
```

### Result

```typescript
{
  totalTAT: {
    hours: 26,  // 09:00 Jan 1 → 11:00 Jan 2
    isComplete: true,
    startedAt: '2024-01-01T09:00:00',
    completedAt: '2024-01-02T11:00:00',
  },
  reviewer: {
    totalHours: 7,      // 5h (first cycle) + 2h (second cycle)
    cycleCount: 2,      // Submitted twice
    avgHours: 3.5,      // 7 / 2
  },
  engineerRevision: {
    totalHours: 2,      // Time to fix revisions
    cycleCount: 1,
    avgHours: 2,
  },
  customer: {
    totalHours: 15.5,   // Customer review time
    cycleCount: 1,
    avgHours: 15.5,
  },
  customerRevision: {
    totalHours: 0,      // No customer revisions
    cycleCount: 0,
    avgHours: 0,
  },
  adminApproval: {
    totalHours: 1,      // Admin authorization time
    cycleCount: 1,
    avgHours: 1,
  },
}
```

---

## Aggregating Metrics

For dashboard display, aggregate across certificates:

```typescript
// src/lib/utils/tat-calculator.ts:297-411

export function aggregateTATMetrics(
  certificateMetrics: CertificateTATMetrics[]
): AggregatedTATMetrics {
  const result: AggregatedTATMetrics = {
    totalTAT: { avgHours: 0, completedCount: 0, overdueCount: 0 },
    reviewer: { avgHours: 0, avgCycles: 0, totalCycles: 0 },
    engineerRevision: { avgHours: 0, avgCycles: 0, totalCycles: 0 },
    customer: { avgHours: 0, avgCycles: 0, totalCycles: 0 },
    customerRevision: { avgHours: 0, avgCycles: 0, totalCycles: 0 },
    adminApproval: { avgHours: 0, avgCycles: 0, totalCycles: 0 },
    certificateCount: certificateMetrics.length,
  }

  // Sum up all metrics
  for (const metrics of certificateMetrics) {
    // Total TAT (only count completed)
    if (metrics.totalTAT.isComplete) {
      totalTATSum += metrics.totalTAT.hours
      totalTATCount++
      if (metrics.totalTAT.hours > 48) {
        result.totalTAT.overdueCount++
      }
    }

    // Stage metrics...
  }

  // Calculate averages
  result.totalTAT.avgHours = totalTATCount > 0
    ? totalTATSum / totalTATCount
    : 0

  return result
}
```

### Aggregated Result Example

```typescript
{
  totalTAT: {
    avgHours: 32.5,       // Average across all completed certs
    completedCount: 45,   // 45 certificates completed this period
    overdueCount: 8,      // 8 took more than 48 hours
  },
  reviewer: {
    avgHours: 4.2,        // Average reviewer stage time
    avgCycles: 1.3,       // Average submission attempts
    totalCycles: 58,      // Total reviewer cycles
  },
  engineerRevision: {
    avgHours: 2.1,
    avgCycles: 0.3,       // Only 30% have revisions
    totalCycles: 14,
  },
  customer: {
    avgHours: 18.5,       // Customer is slowest stage
    avgCycles: 1.0,
    totalCycles: 45,
  },
  // ...
  certificateCount: 50,   // Total certificates analyzed
}
```

---

## Weekly Comparison

Compare this week vs last week:

```typescript
// src/lib/utils/tat-calculator.ts:424-472

export function compareWeeklyMetrics(
  thisWeek: AggregatedTATMetrics,
  lastWeek: AggregatedTATMetrics
): WeeklyComparison {
  return {
    thisWeek,
    lastWeek,
    changes: {
      totalTAT: {
        hours: thisWeek.totalTAT.avgHours - lastWeek.totalTAT.avgHours,
        percent: percentChange(thisWeek.totalTAT.avgHours, lastWeek.totalTAT.avgHours),
      },
      overdue: {
        count: thisWeek.totalTAT.overdueCount - lastWeek.totalTAT.overdueCount,
        percent: percentChange(thisWeek.totalTAT.overdueCount, lastWeek.totalTAT.overdueCount),
      },
      // ... for each stage
    },
  }
}
```

### Comparison Result

```typescript
{
  thisWeek: { /* this week's metrics */ },
  lastWeek: { /* last week's metrics */ },
  changes: {
    totalTAT: {
      hours: -3.5,    // 3.5 hours faster this week
      percent: -10,   // 10% improvement
    },
    overdue: {
      count: -2,      // 2 fewer overdue
      percent: -25,   // 25% reduction
    },
    reviewer: {
      hours: -0.5,
      hoursPercent: -11,
      cycles: 0.1,    // Slightly more revision cycles
      cyclesPercent: 8,
    },
    // ...
  },
}
```

---

## Usage in Dashboard

```typescript
// src/app/admin/page.tsx

// 1. Get all events for certificates in date range
const events = await prisma.certificateEvent.findMany({
  where: {
    certificate: {
      createdAt: { gte: startOfWeek },
    },
  },
  orderBy: { createdAt: 'asc' },
})

// 2. Group events by certificate
const eventsByCertificate = groupBy(events, 'certificateId')

// 3. Calculate TAT for each certificate
const certificateMetrics = Object.values(eventsByCertificate)
  .map(certEvents => calculateCertificateTAT(certEvents))
  .filter(Boolean)

// 4. Aggregate
const thisWeekMetrics = aggregateTATMetrics(certificateMetrics)

// 5. Get last week's metrics
const lastWeekMetrics = await getLastWeekMetrics()

// 6. Compare
const comparison = compareWeeklyMetrics(thisWeekMetrics, lastWeekMetrics)

// 7. Display in dashboard
```

---

## User-Specific TAT

For engineer performance tracking:

```typescript
// src/lib/utils/user-tat-calculator.ts

interface UserTATInput {
  userId: string
  events: CertificateEvent[]
}

interface UserTATMetrics {
  userId: string
  certificatesCreated: number
  averageCompletionTime: number
  averageRevisionCycles: number
  // ...
}

export function calculateUserTAT(input: UserTATInput): UserTATMetrics {
  // Filter events where user was the engineer
  // Calculate metrics specific to that user
}
```

---

## Tests

```typescript
// src/lib/__tests__/tat-calculator.test.ts

describe('TAT Calculator', () => {
  it('calculates total TAT for completed certificate', () => {
    const events = createTestEvents([
      { type: 'SUBMITTED_FOR_REVIEW', hoursFromStart: 0 },
      { type: 'REVIEWER_APPROVED', hoursFromStart: 5 },
      { type: 'SENT_TO_CUSTOMER', hoursFromStart: 6 },
      { type: 'CUSTOMER_APPROVED', hoursFromStart: 24 },
      { type: 'ADMIN_AUTHORIZED', hoursFromStart: 25 },
    ])

    const result = calculateCertificateTAT(events)

    expect(result.totalTAT.hours).toBe(25)
    expect(result.totalTAT.isComplete).toBe(true)
  })

  it('tracks multiple revision cycles', () => {
    const events = createTestEvents([
      { type: 'SUBMITTED_FOR_REVIEW', hoursFromStart: 0 },
      { type: 'REVISION_REQUESTED', hoursFromStart: 4 },
      { type: 'RESUBMITTED_FOR_REVIEW', hoursFromStart: 6 },
      { type: 'REVISION_REQUESTED', hoursFromStart: 8 },
      { type: 'RESUBMITTED_FOR_REVIEW', hoursFromStart: 10 },
      { type: 'REVIEWER_APPROVED', hoursFromStart: 12 },
    ])

    const result = calculateCertificateTAT(events)

    expect(result.reviewer.cycleCount).toBe(3)  // 3 submissions
    expect(result.engineerRevision.cycleCount).toBe(2)  // 2 revision responses
  })
})
```

---

## Common Issues

### Events Out of Order

**Problem**: Events have timestamps that don't reflect actual order

**Cause**: Clock skew, batch imports, timezone issues

**Solution**: Use `sequenceNumber` as tiebreaker:

```typescript
const sortedEvents = events.sort((a, b) => {
  const timeDiff = a.createdAt.getTime() - b.createdAt.getTime()
  if (timeDiff !== 0) return timeDiff
  return a.sequenceNumber - b.sequenceNumber  // Tiebreaker
})
```

### Missing Events

**Problem**: Stage TAT shows 0 but certificate went through stage

**Cause**: Events not recorded for some actions

**Debug**:
```typescript
// Query all events for problematic certificate
const events = await prisma.certificateEvent.findMany({
  where: { certificateId: 'xxx' },
  orderBy: { sequenceNumber: 'asc' },
})
console.log(events.map(e => e.eventType))
```

### In-Progress Certificates

**Problem**: TAT shows very high number

**Cause**: Calculating current time for incomplete certificates

**Solution**: Mark these clearly in UI:

```typescript
if (!metrics.totalTAT.isComplete) {
  // Show "In Progress: X hours so far" vs "Complete: X hours"
}
```
