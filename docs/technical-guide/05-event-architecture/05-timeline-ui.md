# Timeline UI Component

## Overview

The timeline component renders certificate events as a visual audit history:

**File**: `src/app/admin/certificates/[id]/AdminHistorySection.tsx`

```
┌─────────────────────────────────────────────────────────────────┐
│ AUDIT HISTORY                                        12 items   │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  ● Admin Authorized                              21 Mar, 2:30p  │
│  │ └─ Hemanth Kumar [Admin]                                     │
│  │   ╭────────────────────────────────────────────────────╮     │
│  │   │ ✓ Signed by: Hemanth Kumar (admin@htaipl.com)     │     │
│  │   ╰────────────────────────────────────────────────────╯     │
│  │                                                               │
│  ● Customer Approved                             20 Mar, 4:15p  │
│  │ └─ John Doe [Customer]                                       │
│  │                                                               │
│  ● Sent to Customer                              19 Mar, 11:00a │
│  │ └─ Kiran Kumar [Peer Reviewer]                               │
│  │                                                               │
│  ● Reviewer Approved                             19 Mar, 10:45a │
│  │ └─ Kiran Kumar [Peer Reviewer]                               │
│  │   ╭────────────────────────────────────────────────────╮     │
│  │   │ ✓ Signed by: Kiran Kumar (kiran@htaipl.com)       │     │
│  │   ╰────────────────────────────────────────────────────╯     │
│  │                                                               │
│  ● Submitted for Review                          18 Mar, 3:00p  │
│    └─ Thiyagarajan [Engineer]                                   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Component Structure

```typescript
// src/app/admin/certificates/[id]/AdminHistorySection.tsx

interface AdminHistorySectionProps {
  feedbacks: Feedback[]      // Revision requests, responses
  events: CertificateEvent[] // Workflow events
  currentRevision: number
  className?: string
}

export function AdminHistorySection({
  feedbacks,
  events,
  currentRevision,
  className,
}: AdminHistorySectionProps) {
  // 1. Build unified timeline from events + feedbacks
  // 2. Render collapsible section
  // 3. Display timeline items with icons and metadata
}
```

---

## Timeline Item Structure

```typescript
// Internal timeline item type
interface TimelineItem {
  id: string           // Unique identifier
  type: 'event' | 'feedback'
  timestamp: Date
  data: {
    eventType?: string        // For events
    feedbackType?: string     // For feedbacks
    actorName: string
    actorRole: string
    comment?: string | null
    section?: string | null
    metadata?: Record<string, unknown>
  }
}
```

---

## Event Configuration

Each event type has styling configuration:

```typescript
// src/app/admin/certificates/[id]/AdminHistorySection.tsx:66-185

const EVENT_CONFIG: Record<string, {
  label: string
  icon: typeof Send
  bgClass: string
  iconClass: string
  borderClass: string
}> = {
  CERTIFICATE_CREATED: {
    label: 'Certificate Created',
    icon: Plus,
    bgClass: 'bg-blue-100',
    iconClass: 'text-blue-600',
    borderClass: 'border-blue-200',
  },
  SUBMITTED_FOR_REVIEW: {
    label: 'Submitted for Review',
    icon: Send,
    bgClass: 'bg-blue-100',
    iconClass: 'text-blue-600',
    borderClass: 'border-blue-200',
  },
  REVISION_REQUESTED: {
    label: 'Revision Requested',
    icon: RotateCcw,
    bgClass: 'bg-orange-100',
    iconClass: 'text-orange-600',
    borderClass: 'border-orange-200',
  },
  REVIEWER_APPROVED: {
    label: 'Reviewer Approved',
    icon: CheckCircle2,
    bgClass: 'bg-green-100',
    iconClass: 'text-green-600',
    borderClass: 'border-green-200',
  },
  CUSTOMER_APPROVED: {
    label: 'Customer Approved',
    icon: CheckCircle2,
    bgClass: 'bg-green-100',
    iconClass: 'text-green-600',
    borderClass: 'border-green-200',
  },
  ADMIN_AUTHORIZED: {
    label: 'Admin Authorized',
    icon: Shield,
    bgClass: 'bg-green-100',
    iconClass: 'text-green-600',
    borderClass: 'border-green-200',
  },
  // ... more event types
}
```

---

## Filtered Events

Not all events are shown - low-level updates are filtered:

```typescript
// Events to include in timeline
const INCLUDED_EVENTS = [
  'CERTIFICATE_CREATED',
  'SUBMITTED_FOR_REVIEW',
  'REVISION_REQUESTED',
  'REVISION_SUBMITTED',
  'APPROVED',
  'REVIEWER_APPROVED_SENT_TO_CUSTOMER',
  'REVIEWER_APPROVED',
  'REJECTED',
  'SENT_TO_CUSTOMER',
  'CUSTOMER_APPROVED',
  'CUSTOMER_REVISION_REQUESTED',
  'ADMIN_EDIT',
  'ADMIN_AUTHORIZED',
  'SECTION_UNLOCK_REQUESTED',
  'SECTION_UNLOCK_APPROVED',
  'SECTION_UNLOCK_REJECTED',
]
```

Events NOT shown (would clutter timeline):
- `FIELD_UPDATED` - Individual field edits
- `BULK_FIELDS_UPDATED` - Multiple field updates
- `PARAMETER_ADDED/REMOVED` - Parameter changes

---

## Building the Timeline

```typescript
// Build unified timeline from events + feedbacks
const timeline = useMemo(() => {
  const items: TimelineItem[] = []

  // Add events
  for (const event of events) {
    if (!INCLUDED_EVENTS.includes(event.eventType)) continue

    // Dedupe: Skip revision events if we have feedback
    if (event.eventType === 'REVISION_REQUESTED') {
      const hasFeedback = feedbacks.some(
        f => f.feedbackType === 'REVISION_REQUEST' &&
             Math.abs(new Date(f.createdAt).getTime() -
                      new Date(event.createdAt).getTime()) < 60000
      )
      if (hasFeedback) continue
    }

    const actorName = event.user?.name ||
                      event.customer?.name ||
                      event.customer?.email ||
                      'System'

    items.push({
      id: `event-${event.id}`,
      type: 'event',
      timestamp: new Date(event.createdAt),
      data: {
        eventType: event.eventType,
        actorName,
        actorRole: event.customer ? 'CUSTOMER' : event.userRole,
        metadata: event.eventData ? JSON.parse(event.eventData) : undefined,
      },
    })
  }

  // Add feedbacks
  for (const feedback of feedbacks) {
    items.push({
      id: `feedback-${feedback.id}`,
      type: 'feedback',
      timestamp: new Date(feedback.createdAt),
      data: {
        feedbackType: feedback.feedbackType,
        actorName: feedback.user.name || 'Unknown',
        actorRole: feedback.user.role,
        comment: feedback.comment,
        section: feedback.targetSection,
      },
    })
  }

  // Sort by timestamp descending (most recent first)
  items.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())

  return items
}, [feedbacks, events])
```

---

## Role Labels and Colors

```typescript
const ROLE_LABELS: Record<string, string> = {
  'ENGINEER': 'Engineer',
  'HOD': 'Peer Reviewer',
  'ADMIN': 'Admin',
  'CUSTOMER': 'Customer',
}

// Role badge colors
const roleBadgeClass = cn(
  'text-[10px] px-1.5 py-0.5 rounded font-medium',
  actorRole === 'CUSTOMER' && 'bg-purple-100 text-purple-700',
  actorRole === 'HOD' && 'bg-blue-100 text-blue-700',
  actorRole === 'ENGINEER' && 'bg-green-100 text-green-700',
  actorRole === 'ADMIN' && 'bg-amber-100 text-amber-700',
)
```

---

## Metadata Display

Different events display different metadata:

### Approval Signature

```typescript
{(item.data.eventType === 'APPROVED' ||
  item.data.eventType === 'REVIEWER_APPROVED') &&
  item.data.metadata?.signerName && (
  <div className="mt-2 p-2.5 bg-green-50/80 rounded border border-green-100">
    <div className="flex items-center gap-2">
      <CheckCircle2 className="size-3.5 text-green-600" />
      <p className="text-xs text-green-800">
        <span className="font-medium">Signed by:</span>{' '}
        {String(item.data.metadata.signerName)}
        {item.data.metadata.signerEmail && (
          <span className="text-green-600 ml-1">
            ({String(item.data.metadata.signerEmail)})
          </span>
        )}
      </p>
    </div>
  </div>
)}
```

### Admin Edit

```typescript
{item.data.eventType === 'ADMIN_EDIT' && item.data.metadata && (
  <div className="mt-2 p-2.5 bg-white/80 rounded border border-slate-100">
    <p className="text-xs text-slate-700">
      <span className="font-medium">Field:</span>{' '}
      {String(item.data.metadata.field || 'Unknown')}
    </p>
    {item.data.metadata.from !== undefined && (
      <p className="text-xs text-slate-600 mt-1">
        <code className="bg-slate-100 px-1 rounded">
          {String(item.data.metadata.from || 'empty')}
        </code>
        {' → '}
        <code className="bg-amber-100 px-1 rounded">
          {String(item.data.metadata.to || 'empty')}
        </code>
      </p>
    )}
    {item.data.metadata.reason && (
      <p className="text-xs text-slate-600 mt-1">
        <span className="font-medium">Reason:</span>{' '}
        {item.data.metadata.reason}
      </p>
    )}
  </div>
)}
```

### Section Unlock

```typescript
{(item.data.eventType === 'SECTION_UNLOCK_REQUESTED' ||
  item.data.eventType === 'SECTION_UNLOCK_APPROVED') &&
  item.data.metadata && (
  <div className="mt-2 p-2.5 rounded border bg-indigo-50/80 border-indigo-100">
    {Array.isArray(item.data.metadata.sections) && (
      <div className="flex flex-wrap gap-1 mb-2">
        {item.data.metadata.sections.map((sectionId: string) => (
          <span key={sectionId}
            className="px-2 py-0.5 rounded text-[10px] font-medium
                       bg-indigo-100 text-indigo-700">
            {SECTION_LABELS[sectionId] || sectionId}
          </span>
        ))}
      </div>
    )}
    {item.data.metadata.reason && (
      <p className="text-xs text-slate-600">
        <span className="font-medium">Reason:</span>{' '}
        {item.data.metadata.reason}
      </p>
    )}
  </div>
)}
```

---

## Section Labels

For displaying section references:

```typescript
const SECTION_LABELS: Record<string, string> = {
  'summary': 'Summary',
  'uuc-details': 'UUC Details',
  'master-inst': 'Master Instruments',
  'environment': 'Environmental Conditions',
  'results': 'Calibration Results',
  'remarks': 'Remarks',
  'conclusion': 'Conclusion',
  'general': 'General',
}
```

---

## Empty State

When no events exist:

```typescript
if (timeline.length === 0) {
  return (
    <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
      <button onClick={() => setIsExpanded(!isExpanded)} /* ... */>
        <span>Audit History</span>
      </button>
      {isExpanded && (
        <div className="px-4 py-8 text-center border-t">
          <Clock className="size-8 mx-auto mb-2 text-slate-300" />
          <p className="text-sm font-medium text-slate-600">
            No history yet
          </p>
        </div>
      )}
    </div>
  )
}
```

---

## Collapsible Behavior

```typescript
const [isExpanded, setIsExpanded] = useState(true)

return (
  <div className="bg-white rounded-xl border shadow-sm overflow-hidden">
    {/* Header - always visible */}
    <button
      onClick={() => setIsExpanded(!isExpanded)}
      className="w-full flex items-center justify-between px-4 py-3"
    >
      <div className="flex items-center gap-2">
        {isExpanded
          ? <ChevronDown className="size-4" />
          : <ChevronRight className="size-4" />
        }
        <span className="text-xs font-bold uppercase tracking-wider">
          Audit History
        </span>
      </div>
      <span className="text-xs text-slate-500">
        {timeline.length} items
      </span>
    </button>

    {/* Timeline content - collapsible */}
    {isExpanded && (
      <div className="border-t">
        {/* Timeline items */}
      </div>
    )}
  </div>
)
```

---

## Timeline Visual Structure

```typescript
<div className="relative px-4 py-4">
  {/* Vertical line */}
  <div className="absolute left-[27px] top-4 bottom-4 w-px bg-slate-200" />

  {/* Timeline items */}
  <div className="space-y-4">
    {timeline.map((item, index) => {
      const config = EVENT_CONFIG[item.data.eventType || '']
      const Icon = config.icon
      const isFirst = index === 0  // Most recent

      return (
        <div key={item.id} className="relative pl-10">
          {/* Timeline dot */}
          <div className={cn(
            'absolute left-0 size-7 rounded-full',
            'flex items-center justify-center ring-2 ring-white',
            config.bgClass
          )}>
            <Icon className={cn('size-3.5', config.iconClass)} />
          </div>

          {/* Content card */}
          <div className={cn(
            'rounded-lg border p-3',
            config.borderClass,
            isFirst && 'ring-1 ring-blue-200'  // Highlight latest
          )}>
            {/* Event details */}
          </div>
        </div>
      )
    })}
  </div>
</div>
```

---

## Usage in Certificate Pages

```typescript
// src/app/admin/certificates/[id]/AdminCertificateClient.tsx

interface AdminCertificateClientProps {
  certificate: CertificateData
  assignee: Assignee
  reviewer: Reviewer | null
  feedbacks: Feedback[]
  events: CertificateEvent[]  // Passed to timeline
}

export function AdminCertificateClient({
  certificate,
  assignee,
  reviewer,
  feedbacks,
  events,
}: AdminCertificateClientProps) {
  return (
    <div className="grid grid-cols-12 gap-6">
      {/* Main content */}
      <div className="col-span-8">
        <CertificateViewer certificate={certificate} />
      </div>

      {/* Sidebar with timeline */}
      <div className="col-span-4">
        <AdminHistorySection
          feedbacks={feedbacks}
          events={events}
          currentRevision={certificate.currentRevision}
        />
      </div>
    </div>
  )
}
```

---

## Adding New Event Types

To add a new event type to the timeline:

### 1. Add to INCLUDED_EVENTS

```typescript
const INCLUDED_EVENTS = [
  // ... existing events
  'NEW_EVENT_TYPE',  // Add here
]
```

### 2. Add EVENT_CONFIG

```typescript
const EVENT_CONFIG = {
  // ... existing configs
  NEW_EVENT_TYPE: {
    label: 'New Event Label',
    icon: SomeIcon,
    bgClass: 'bg-blue-100',
    iconClass: 'text-blue-600',
    borderClass: 'border-blue-200',
  },
}
```

### 3. Add Metadata Renderer (if needed)

```typescript
{/* In the timeline item render */}
{item.data.eventType === 'NEW_EVENT_TYPE' && item.data.metadata && (
  <div className="mt-2 p-2.5 bg-blue-50 rounded border border-blue-100">
    {/* Custom metadata display */}
  </div>
)}
```

---

## Accessibility

The timeline is accessible:
- Collapsible via button (keyboard accessible)
- Role badges have color AND text labels
- Icons paired with text labels
- Sufficient color contrast

```typescript
// Button is focusable and clickable
<button
  onClick={() => setIsExpanded(!isExpanded)}
  className="w-full flex items-center"
  aria-expanded={isExpanded}
>
```
