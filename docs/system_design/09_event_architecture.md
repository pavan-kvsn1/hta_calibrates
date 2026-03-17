# Event-Driven Architecture

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Prerequisite**: [03_system_architecture.md](./03_system_architecture.md)

---

## Introduction

This document explains how HTA Calibration uses event-driven architecture to build a scalable, responsive system. We'll cover why events matter, how they flow through the system, and how to implement webhooks and real-time updates.

---

## Part 1: What is Event-Driven Architecture?

### The Problem with Synchronous Processing

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    THE PROBLEM: SYNCHRONOUS PROCESSING                       │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  SCENARIO: Engineer submits certificate for review                          │
│                                                                             │
│  SYNCHRONOUS APPROACH (Everything in one request):                          │
│  ══════════════════════════════════════════════════                         │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   User clicks "Submit"                                               │   │
│  │         │                                                            │   │
│  │         ▼                                                            │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │  API Handler (must complete ALL before responding)           │   │   │
│  │   │                                                              │   │   │
│  │   │  1. Validate certificate data .................... 50ms     │   │   │
│  │   │  2. Update database status ....................... 100ms    │   │   │
│  │   │  3. Generate PDF preview ......................... 2000ms   │   │   │
│  │   │  4. Send email to reviewer ....................... 500ms    │   │   │
│  │   │  5. Send email to customer notification .......... 500ms    │   │   │
│  │   │  6. Update audit log ............................. 100ms    │   │   │
│  │   │  7. Notify external system via webhook ........... 300ms    │   │   │
│  │   │  8. Update analytics ............................. 200ms    │   │   │
│  │   │                                                              │   │   │
│  │   │  TOTAL: ~3750ms (3.75 seconds!) 😱                          │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │         │                                                            │   │
│  │         ▼                                                            │   │
│  │   User finally sees "Success" message                                │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  PROBLEMS:                                                                  │
│  • User waits 4 seconds (feels slow)                                        │
│  • If email fails, whole request fails                                      │
│  • Can't retry failed steps independently                                   │
│  • One slow service blocks everything                                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### The Solution: Event-Driven Architecture

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    THE SOLUTION: EVENT-DRIVEN                                │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ASYNCHRONOUS APPROACH (Publish event, respond immediately):                │
│  ═══════════════════════════════════════════════════════════                │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   User clicks "Submit"                                               │   │
│  │         │                                                            │   │
│  │         ▼                                                            │   │
│  │   ┌─────────────────────────────────────────────────────────────┐   │   │
│  │   │  API Handler (minimal work)                                  │   │   │
│  │   │                                                              │   │   │
│  │   │  1. Validate certificate data .................... 50ms     │   │   │
│  │   │  2. Update database status ....................... 100ms    │   │   │
│  │   │  3. Publish "CERTIFICATE_SUBMITTED" event ........ 10ms     │   │   │
│  │   │                                                              │   │   │
│  │   │  TOTAL: ~160ms ✅                                           │   │   │
│  │   └─────────────────────────────────────────────────────────────┘   │   │
│  │         │                                                            │   │
│  │         ▼                                                            │   │
│  │   User sees "Success" immediately! 🎉                               │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│                              Meanwhile, in the background:                   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   EVENT: CERTIFICATE_SUBMITTED                                       │   │
│  │         │                                                            │   │
│  │         ├──▶ PDF Worker ──▶ Generates PDF (async)                   │   │
│  │         │                                                            │   │
│  │         ├──▶ Email Worker ──▶ Sends notifications (async)           │   │
│  │         │                                                            │   │
│  │         ├──▶ Audit Worker ──▶ Logs activity (async)                 │   │
│  │         │                                                            │   │
│  │         ├──▶ Webhook Worker ──▶ Notifies external systems (async)   │   │
│  │         │                                                            │   │
│  │         └──▶ Analytics Worker ──▶ Updates metrics (async)           │   │
│  │                                                                      │   │
│  │   All happening in PARALLEL! If one fails, others continue.          │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  BENEFITS:                                                                  │
│  • User gets instant response                                               │
│  • Failed tasks can be retried independently                                │
│  • System is more resilient                                                 │
│  • Easy to add new features (just add new event handlers)                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 2: Event Types in HTA Calibration

### Certificate Lifecycle Events

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CERTIFICATE LIFECYCLE EVENTS                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   DRAFT ──────────▶ PENDING_REVIEW ──────────▶ APPROVED             │   │
│  │     │                     │                        │                 │   │
│  │     │                     │                        │                 │   │
│  │     ▼                     ▼                        ▼                 │   │
│  │  CERTIFICATE_         CERTIFICATE_            CERTIFICATE_          │   │
│  │  CREATED              SUBMITTED               APPROVED              │   │
│  │                           │                        │                 │   │
│  │                           │                        ▼                 │   │
│  │                           ▼                   AUTHORIZED             │   │
│  │                      REVISION_                    │                  │   │
│  │                      REQUESTED                    ▼                  │   │
│  │                           │                  CERTIFICATE_            │   │
│  │                           ▼                  AUTHORIZED              │   │
│  │                      CERTIFICATE_                                    │   │
│  │                      REVISION_REQUESTED                              │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  EVENT CATALOG:                                                             │
│  ══════════════                                                             │
│                                                                             │
│  ┌────────────────────────────┬────────────────────────────────────────┐   │
│  │ Event Type                 │ Triggered When                          │   │
│  ├────────────────────────────┼────────────────────────────────────────┤   │
│  │ CERTIFICATE_CREATED        │ Engineer creates new certificate       │   │
│  │ CERTIFICATE_UPDATED        │ Any certificate data changed           │   │
│  │ CERTIFICATE_SUBMITTED      │ Submitted for review                   │   │
│  │ CERTIFICATE_APPROVED       │ Reviewer approves                      │   │
│  │ CERTIFICATE_REJECTED       │ Reviewer rejects                       │   │
│  │ REVISION_REQUESTED         │ Reviewer requests changes              │   │
│  │ REVISION_SUBMITTED         │ Engineer submits revision              │   │
│  │ CERTIFICATE_AUTHORIZED     │ Admin authorizes final version         │   │
│  │ CERTIFICATE_SIGNED         │ Digital signature applied              │   │
│  │ CERTIFICATE_DOWNLOADED     │ Customer downloads PDF                 │   │
│  ├────────────────────────────┼────────────────────────────────────────┤   │
│  │ FEEDBACK_SUBMITTED         │ Customer or reviewer adds feedback     │   │
│  │ FEEDBACK_RESOLVED          │ Feedback marked as resolved            │   │
│  ├────────────────────────────┼────────────────────────────────────────┤   │
│  │ USER_CREATED               │ New user added to tenant               │   │
│  │ USER_ACTIVATED             │ User completes activation              │   │
│  │ USER_LOGIN                 │ User logs in                           │   │
│  └────────────────────────────┴────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Event Structure

```typescript
┌─────────────────────────────────────────────────────────────────────────────┐
│                    EVENT STRUCTURE                                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  // src/lib/events/types.ts                                                 │
│                                                                             │
│  interface BaseEvent {                                                      │
│    id: string;              // Unique event ID (UUID)                       │
│    type: string;            // Event type (e.g., "CERTIFICATE_SUBMITTED")   │
│    timestamp: string;       // ISO 8601 timestamp                           │
│    tenantId: string;        // Which lab this event belongs to              │
│    userId: string;          // Who triggered this event                     │
│    correlationId: string;   // Links related events together                │
│    version: string;         // Event schema version                         │
│  }                                                                          │
│                                                                             │
│  interface CertificateSubmittedEvent extends BaseEvent {                    │
│    type: "CERTIFICATE_SUBMITTED";                                           │
│    payload: {                                                               │
│      certificateId: string;                                                 │
│      certificateNumber: string;                                             │
│      submittedBy: {                                                         │
│        id: string;                                                          │
│        name: string;                                                        │
│        email: string;                                                       │
│      };                                                                     │
│      assignedReviewer: {                                                    │
│        id: string;                                                          │
│        name: string;                                                        │
│        email: string;                                                       │
│      };                                                                     │
│      customerId: string;                                                    │
│      customerName: string;                                                  │
│    };                                                                       │
│  }                                                                          │
│                                                                             │
│  // Example event:                                                          │
│  {                                                                          │
│    "id": "evt_abc123",                                                      │
│    "type": "CERTIFICATE_SUBMITTED",                                         │
│    "timestamp": "2026-03-17T10:30:00Z",                                     │
│    "tenantId": "hta",                                                       │
│    "userId": "user_123",                                                    │
│    "correlationId": "req_xyz789",                                           │
│    "version": "1.0",                                                        │
│    "payload": {                                                             │
│      "certificateId": "cert_456",                                           │
│      "certificateNumber": "HTA-2026-0042",                                  │
│      "submittedBy": {                                                       │
│        "id": "user_123",                                                    │
│        "name": "John Engineer",                                             │
│        "email": "john@hta.com"                                              │
│      },                                                                     │
│      "assignedReviewer": {                                                  │
│        "id": "user_456",                                                    │
│        "name": "Jane Reviewer",                                             │
│        "email": "jane@hta.com"                                              │
│      },                                                                     │
│      "customerId": "cust_789",                                              │
│      "customerName": "ACME Corp"                                            │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 3: Event Infrastructure

### Google Cloud Pub/Sub

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    GOOGLE CLOUD PUB/SUB                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Pub/Sub = Publish/Subscribe messaging service                              │
│                                                                             │
│  CONCEPTS:                                                                  │
│  ═════════                                                                  │
│                                                                             │
│  TOPIC = A named channel for messages                                       │
│  SUBSCRIPTION = A listener for a topic                                      │
│  MESSAGE = The event data being sent                                        │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   PUBLISHER                           SUBSCRIBERS                    │   │
│  │   (Your App)                          (Workers)                      │   │
│  │                                                                      │   │
│  │   ┌─────────┐                        ┌─────────────────────────┐    │   │
│  │   │  API    │                        │  Email Subscription      │    │   │
│  │   │ Handler │                        │  ──────────────────────  │    │   │
│  │   └────┬────┘                        │  ┌─────────┐             │    │   │
│  │        │                             │  │ Email   │             │    │   │
│  │        │ publish                     │  │ Worker  │             │    │   │
│  │        ▼                        ┌───▶│  └─────────┘             │    │   │
│  │   ┌─────────────────────────┐  │    └─────────────────────────┘    │   │
│  │   │                         │  │                                    │   │
│  │   │   TOPIC:                │  │    ┌─────────────────────────┐    │   │
│  │   │   certificate-events    │──┼───▶│  PDF Subscription        │    │   │
│  │   │                         │  │    │  ──────────────────────  │    │   │
│  │   │   Messages queue up     │  │    │  ┌─────────┐             │    │   │
│  │   │   until delivered       │  │    │  │  PDF    │             │    │   │
│  │   │                         │  │    │  │ Worker  │             │    │   │
│  │   └─────────────────────────┘  │    └─────────────────────────┘    │   │
│  │                                │                                    │   │
│  │                                │    ┌─────────────────────────┐    │   │
│  │                                └───▶│  Webhook Subscription    │    │   │
│  │                                     │  ──────────────────────  │    │   │
│  │                                     │  ┌─────────┐             │    │   │
│  │                                     │  │ Webhook │             │    │   │
│  │                                     │  │ Worker  │             │    │   │
│  │                                     └─────────────────────────┘    │   │
│  │                                                                      │   │
│  │   Each subscription gets a COPY of every message!                    │   │
│  │   Messages are retained until acknowledged.                          │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  BENEFITS OF PUB/SUB:                                                       │
│  • Decoupled: Publishers don't know about subscribers                       │
│  • Reliable: Messages stored until delivered                                │
│  • Scalable: Handles millions of messages                                   │
│  • Durable: Messages survive system restarts                                │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Publishing Events

```typescript
┌─────────────────────────────────────────────────────────────────────────────┐
│                    PUBLISHING EVENTS                                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  // src/lib/events/publisher.ts                                             │
│                                                                             │
│  import { PubSub } from '@google-cloud/pubsub';                             │
│                                                                             │
│  const pubsub = new PubSub({ projectId: process.env.GCP_PROJECT_ID });      │
│                                                                             │
│  export async function publishEvent<T extends BaseEvent>(                   │
│    topicName: string,                                                       │
│    event: T                                                                 │
│  ): Promise<string> {                                                       │
│    const topic = pubsub.topic(topicName);                                   │
│                                                                             │
│    // Add metadata                                                          │
│    const enrichedEvent = {                                                  │
│      ...event,                                                              │
│      id: event.id || crypto.randomUUID(),                                   │
│      timestamp: event.timestamp || new Date().toISOString(),                │
│      version: event.version || '1.0',                                       │
│    };                                                                       │
│                                                                             │
│    const messageId = await topic.publishMessage({                           │
│      json: enrichedEvent,                                                   │
│      attributes: {                                                          │
│        eventType: event.type,                                               │
│        tenantId: event.tenantId,                                            │
│      },                                                                     │
│    });                                                                      │
│                                                                             │
│    console.log(`Published event ${event.type}: ${messageId}`);              │
│    return messageId;                                                        │
│  }                                                                          │
│                                                                             │
│  // Usage in API route:                                                     │
│  // src/app/api/certificates/[id]/submit/route.ts                           │
│                                                                             │
│  export async function POST(req: Request, { params }) {                     │
│    const session = await getSession(req);                                   │
│    const certificate = await updateCertificateStatus(params.id, 'PENDING'); │
│                                                                             │
│    // Publish event (non-blocking)                                          │
│    await publishEvent('certificate-events', {                               │
│      type: 'CERTIFICATE_SUBMITTED',                                         │
│      tenantId: session.user.tenantId,                                       │
│      userId: session.user.id,                                               │
│      correlationId: req.headers.get('x-request-id'),                        │
│      payload: {                                                             │
│        certificateId: certificate.id,                                       │
│        certificateNumber: certificate.number,                               │
│        // ... other data                                                    │
│      },                                                                     │
│    });                                                                      │
│                                                                             │
│    return Response.json({ success: true });                                 │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Consuming Events (Workers)

```typescript
┌─────────────────────────────────────────────────────────────────────────────┐
│                    CONSUMING EVENTS                                          │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  // src/workers/email-worker.ts                                             │
│                                                                             │
│  import { PubSub, Message } from '@google-cloud/pubsub';                    │
│                                                                             │
│  const pubsub = new PubSub();                                               │
│  const subscription = pubsub.subscription('email-notifications');           │
│                                                                             │
│  // Event handlers for different event types                                │
│  const handlers = {                                                         │
│    CERTIFICATE_SUBMITTED: async (event) => {                                │
│      await sendEmail({                                                      │
│        to: event.payload.assignedReviewer.email,                            │
│        subject: `Review requested: ${event.payload.certificateNumber}`,     │
│        template: 'review-requested',                                        │
│        data: event.payload,                                                 │
│      });                                                                    │
│    },                                                                       │
│                                                                             │
│    CERTIFICATE_APPROVED: async (event) => {                                 │
│      await sendEmail({                                                      │
│        to: event.payload.submittedBy.email,                                 │
│        subject: `Approved: ${event.payload.certificateNumber}`,             │
│        template: 'certificate-approved',                                    │
│        data: event.payload,                                                 │
│      });                                                                    │
│    },                                                                       │
│                                                                             │
│    // ... more handlers                                                     │
│  };                                                                         │
│                                                                             │
│  // Main listener                                                           │
│  subscription.on('message', async (message: Message) => {                   │
│    try {                                                                    │
│      const event = JSON.parse(message.data.toString());                     │
│      const handler = handlers[event.type];                                  │
│                                                                             │
│      if (handler) {                                                         │
│        await handler(event);                                                │
│        message.ack();  // Mark as processed                                 │
│        console.log(`Processed ${event.type}: ${event.id}`);                 │
│      } else {                                                               │
│        // No handler for this event type (that's OK)                        │
│        message.ack();                                                       │
│      }                                                                      │
│    } catch (error) {                                                        │
│      console.error('Failed to process message:', error);                    │
│      message.nack();  // Retry later                                        │
│    }                                                                        │
│  });                                                                        │
│                                                                             │
│  subscription.on('error', (error) => {                                      │
│    console.error('Subscription error:', error);                             │
│  });                                                                        │
│                                                                             │
│  console.log('Email worker listening for events...');                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 4: Webhooks

### What are Webhooks?

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WHAT ARE WEBHOOKS?                                        │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  POLLING (The old way):                                                     │
│  ══════════════════════                                                     │
│                                                                             │
│  ┌─────────────┐                              ┌─────────────┐               │
│  │  External   │                              │    HTA      │               │
│  │   System    │                              │  Calibration│               │
│  └──────┬──────┘                              └──────┬──────┘               │
│         │                                            │                       │
│         │──── "Any new certificates?" ─────────────▶│                       │
│         │◀─── "No" ─────────────────────────────────│                       │
│         │                                            │                       │
│    5 min later...                                    │                       │
│         │                                            │                       │
│         │──── "Any new certificates?" ─────────────▶│                       │
│         │◀─── "No" ─────────────────────────────────│                       │
│         │                                            │                       │
│    5 min later... (repeat forever!)                  │                       │
│         │                                            │                       │
│         │──── "Any new certificates?" ─────────────▶│                       │
│         │◀─── "Yes, here's one!" ───────────────────│                       │
│                                                                             │
│  Problem: Wastes resources, delayed notifications                           │
│                                                                             │
│  ─────────────────────────────────────────────────────────────────────────  │
│                                                                             │
│  WEBHOOKS (The better way):                                                 │
│  ══════════════════════════                                                 │
│                                                                             │
│  ┌─────────────┐                              ┌─────────────┐               │
│  │  External   │                              │    HTA      │               │
│  │   System    │                              │  Calibration│               │
│  └──────┬──────┘                              └──────┬──────┘               │
│         │                                            │                       │
│         │◀───── "Here's my callback URL" ───────────│ (one-time setup)     │
│         │                                            │                       │
│    ... silence ...                                   │                       │
│                                                      │                       │
│    Certificate approved!                             │                       │
│         │                                            │                       │
│         │◀──── POST to callback URL ────────────────│ (immediate!)         │
│         │      { "event": "CERTIFICATE_APPROVED" }  │                       │
│         │                                            │                       │
│         │───── HTTP 200 OK ────────────────────────▶│                       │
│                                                                             │
│  Benefits: Instant notifications, efficient, scalable                       │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Webhook Configuration Per Tenant

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    TENANT WEBHOOK CONFIGURATION                              │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  Each tenant can configure webhooks for their systems:                      │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   TENANT: HTA                                                        │   │
│  │   ─────────────────                                                  │   │
│  │                                                                      │   │
│  │   Webhook 1: ERP Integration                                         │   │
│  │   ├── URL: https://erp.hta.com/api/webhooks/calibration             │   │
│  │   ├── Events: CERTIFICATE_AUTHORIZED, CERTIFICATE_SIGNED            │   │
│  │   ├── Secret: wh_secret_abc123 (for signature verification)         │   │
│  │   └── Status: Active                                                 │   │
│  │                                                                      │   │
│  │   Webhook 2: Slack Notifications                                     │   │
│  │   ├── URL: https://hooks.slack.com/services/T.../B.../xxx           │   │
│  │   ├── Events: CERTIFICATE_SUBMITTED, CERTIFICATE_APPROVED           │   │
│  │   ├── Secret: (none - Slack handles auth differently)               │   │
│  │   └── Status: Active                                                 │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   TENANT: ABC Metrology                                              │   │
│  │   ─────────────────────────                                          │   │
│  │                                                                      │   │
│  │   Webhook 1: Custom Dashboard                                        │   │
│  │   ├── URL: https://dashboard.abc.com/hooks/certificates             │   │
│  │   ├── Events: ALL                                                    │   │
│  │   ├── Secret: wh_secret_xyz789                                       │   │
│  │   └── Status: Active                                                 │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

### Webhook Delivery

```typescript
┌─────────────────────────────────────────────────────────────────────────────┐
│                    WEBHOOK DELIVERY IMPLEMENTATION                           │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  // src/workers/webhook-worker.ts                                           │
│                                                                             │
│  import crypto from 'crypto';                                               │
│                                                                             │
│  interface WebhookConfig {                                                  │
│    id: string;                                                              │
│    url: string;                                                             │
│    secret: string;                                                          │
│    events: string[];                                                        │
│    tenantId: string;                                                        │
│  }                                                                          │
│                                                                             │
│  async function deliverWebhook(                                             │
│    webhook: WebhookConfig,                                                  │
│    event: BaseEvent                                                         │
│  ): Promise<void> {                                                         │
│    const payload = JSON.stringify(event);                                   │
│    const timestamp = Date.now();                                            │
│                                                                             │
│    // Create signature for verification                                     │
│    const signature = crypto                                                 │
│      .createHmac('sha256', webhook.secret)                                  │
│      .update(`${timestamp}.${payload}`)                                     │
│      .digest('hex');                                                        │
│                                                                             │
│    const response = await fetch(webhook.url, {                              │
│      method: 'POST',                                                        │
│      headers: {                                                             │
│        'Content-Type': 'application/json',                                  │
│        'X-Webhook-Signature': `t=${timestamp},v1=${signature}`,             │
│        'X-Webhook-ID': webhook.id,                                          │
│        'X-Event-Type': event.type,                                          │
│      },                                                                     │
│      body: payload,                                                         │
│      signal: AbortSignal.timeout(30000), // 30 second timeout              │
│    });                                                                      │
│                                                                             │
│    if (!response.ok) {                                                      │
│      throw new Error(`Webhook failed: ${response.status}`);                 │
│    }                                                                        │
│                                                                             │
│    // Log successful delivery                                               │
│    await logWebhookDelivery({                                               │
│      webhookId: webhook.id,                                                 │
│      eventId: event.id,                                                     │
│      status: 'delivered',                                                   │
│      responseCode: response.status,                                         │
│    });                                                                      │
│  }                                                                          │
│                                                                             │
│  // With retry logic                                                        │
│  async function deliverWithRetry(                                           │
│    webhook: WebhookConfig,                                                  │
│    event: BaseEvent,                                                        │
│    maxRetries = 3                                                           │
│  ): Promise<void> {                                                         │
│    for (let attempt = 1; attempt <= maxRetries; attempt++) {                │
│      try {                                                                  │
│        await deliverWebhook(webhook, event);                                │
│        return;                                                              │
│      } catch (error) {                                                      │
│        if (attempt === maxRetries) {                                        │
│          await logWebhookDelivery({                                         │
│            webhookId: webhook.id,                                           │
│            eventId: event.id,                                               │
│            status: 'failed',                                                │
│            error: error.message,                                            │
│          });                                                                │
│          throw error;                                                       │
│        }                                                                    │
│        // Exponential backoff: 1s, 2s, 4s, ...                              │
│        await sleep(1000 * Math.pow(2, attempt - 1));                        │
│      }                                                                      │
│    }                                                                        │
│  }                                                                          │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Part 5: Real-Time Updates

### WebSocket Connections

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                    REAL-TIME UPDATES WITH WEBSOCKETS                         │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  For in-app real-time updates (live dashboard, chat):                       │
│                                                                             │
│  ┌─────────────────────────────────────────────────────────────────────┐   │
│  │                                                                      │   │
│  │   BROWSER                            SERVER                          │   │
│  │   ───────                            ──────                          │   │
│  │                                                                      │   │
│  │   ┌───────────┐    WebSocket      ┌───────────┐                     │   │
│  │   │           │◀═══Connection════▶│           │                     │   │
│  │   │  User A   │    (persistent)   │    API    │                     │   │
│  │   │  Browser  │                   │  Server   │                     │   │
│  │   │           │◀──push updates────│           │                     │   │
│  │   └───────────┘                   └─────┬─────┘                     │   │
│  │                                         │                            │   │
│  │   ┌───────────┐                         │ subscribes to              │   │
│  │   │           │◀═══Connection════▶      │ events                     │   │
│  │   │  User B   │                         │                            │   │
│  │   │  Browser  │◀──push updates────      ▼                            │   │
│  │   └───────────┘                   ┌───────────┐                     │   │
│  │                                   │  Pub/Sub  │                     │   │
│  │                                   │   Topic   │                     │   │
│  │                                   └───────────┘                     │   │
│  │                                                                      │   │
│  │   When certificate status changes:                                   │   │
│  │   1. Event published to Pub/Sub                                      │   │
│  │   2. Server receives event                                           │   │
│  │   3. Server pushes to relevant connected users                       │   │
│  │   4. Browser updates UI instantly!                                   │   │
│  │                                                                      │   │
│  └─────────────────────────────────────────────────────────────────────┘   │
│                                                                             │
│  USE CASES:                                                                 │
│  • Certificate status changes → Dashboard updates                           │
│  • New feedback → Notification badge appears                                │
│  • Chat messages → Instant delivery                                         │
│  • Reviewer actions → Engineer sees in real-time                            │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Summary

```
┌─────────────────────────────────────────────────────────────────────────────┐
│                           KEY TAKEAWAYS                                      │
├─────────────────────────────────────────────────────────────────────────────┤
│                                                                             │
│  1. EVENT-DRIVEN = RESPONSIVE                                               │
│     Publish event → Respond immediately → Process async                     │
│                                                                             │
│  2. PUB/SUB FOR INTERNAL                                                    │
│     Decouple services with message queues                                   │
│     Reliable delivery with retries                                          │
│                                                                             │
│  3. WEBHOOKS FOR EXTERNAL                                                   │
│     Push notifications to tenant systems                                    │
│     Signature verification for security                                     │
│     Retry with exponential backoff                                          │
│                                                                             │
│  4. WEBSOCKETS FOR REAL-TIME                                                │
│     Live updates in the browser                                             │
│     Dashboard, chat, notifications                                          │
│                                                                             │
│  5. BENEFITS                                                                │
│     • Fast user responses                                                   │
│     • Fault tolerance (retry failed tasks)                                  │
│     • Easy to add new features                                              │
│     • Scalable processing                                                   │
│                                                                             │
└─────────────────────────────────────────────────────────────────────────────┘
```

---

## Next Steps

- [10. Webhooks & Real-Time Communication](./10_webhooks_realtime.md) - Deep dive into chat systems
- [11. Terraform Introduction](./11_terraform_intro.md) - Infrastructure as Code
