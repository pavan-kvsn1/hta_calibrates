# Phase 4A: Events & Webhooks Implementation

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Last Updated**: 2026-03-17
- **Phase**: 4 - Advanced Features
- **Status**: Not Started (0%)

---

## Learning Resources

Before implementing events and webhooks, make sure you understand the underlying concepts:

| Topic | System Design Document | What You'll Learn |
|-------|------------------------|-------------------|
| **Event Architecture** | [09_event_architecture.md](../../system_design/09_event_architecture.md) | Event-driven design, Pub/Sub, webhooks, real-time updates |
| **Multi-Tenancy** | [04_multi_tenancy.md](../../system_design/04_multi_tenancy.md) | Per-tenant webhook configuration |
| **Secrets Management** | [13_secrets_management.md](../../system_design/13_secrets_management.md) | Webhook signing secrets |
| **Security** | [14_security.md](../../system_design/14_security.md) | Webhook security, signature verification |

> **Tip**: If terms like "event-driven", "Pub/Sub", "HMAC signature", or "WebSocket" are unfamiliar, read `09_event_architecture.md` first!

---

## Overview

This document covers the implementation of event-driven architecture, webhook delivery system, and real-time communication for the HTA Calibration system.

---

## Event Architecture

```
+---------------------------------------------------------------------------+
|                         EVENT-DRIVEN ARCHITECTURE                           |
+---------------------------------------------------------------------------+
|                                                                             |
|  APPLICATION                                                                |
|  +-----------------------------------------------------------------------+  |
|  |                                                                       |  |
|  |  User Action (e.g., Certificate Approved)                             |  |
|  |                    |                                                  |  |
|  |                    v                                                  |  |
|  |  +-------------------+                                                |  |
|  |  | Event Publisher   |                                                |  |
|  |  +--------+----------+                                                |  |
|  |           |                                                           |  |
|  +-----------|-----------------------------------------------------------+  |
|              |                                                              |
|              v                                                              |
|  CLOUD PUB/SUB                                                              |
|  +-----------------------------------------------------------------------+  |
|  |                                                                       |  |
|  |  Topic: hta-events                                                    |  |
|  |  +-----------------+  +-----------------+  +-----------------+        |  |
|  |  | certificate.*   |  | user.*          |  | feedback.*      |        |  |
|  |  +-----------------+  +-----------------+  +-----------------+        |  |
|  |                                                                       |  |
|  +-----------------------------------------------------------------------+  |
|              |                     |                     |                  |
|              v                     v                     v                  |
|  SUBSCRIBERS                                                                |
|  +-------------------+  +-------------------+  +-------------------+        |
|  |                   |  |                   |  |                   |        |
|  | Webhook Delivery  |  | Email Service     |  | Analytics         |        |
|  | Service           |  |                   |  | Service           |        |
|  |                   |  |                   |  |                   |        |
|  +--------+----------+  +--------+----------+  +-------------------+        |
|           |                      |                                          |
|           v                      v                                          |
|  +-------------------+  +-------------------+                               |
|  | Tenant Webhook    |  | SendGrid/SES      |                               |
|  | Endpoints         |  |                   |                               |
|  +-------------------+  +-------------------+                               |
|                                                                             |
+---------------------------------------------------------------------------+
```

---

## Event Types

### Event Catalog

```
+---------------------------------------------------------------------------+
|                         EVENT CATALOG                                       |
+---------------------------------------------------------------------------+
|                                                                             |
|  CERTIFICATE EVENTS                                                         |
|  ==================                                                         |
|                                                                             |
|  Event Type                      Trigger                                    |
|  -------------------------------------------------------------------------- |
|  certificate.created             New certificate created                    |
|  certificate.submitted           Certificate submitted for review           |
|  certificate.approved            Certificate approved by reviewer           |
|  certificate.rejected            Certificate rejected with feedback         |
|  certificate.authorized          Certificate authorized (final)             |
|  certificate.revision_requested  Revision requested by reviewer             |
|  certificate.pdf_generated       PDF certificate generated                  |
|                                                                             |
|  USER EVENTS                                                                |
|  ===========                                                                |
|                                                                             |
|  user.created                    New user created                           |
|  user.activated                  User activated account                     |
|  user.password_changed           User changed password                      |
|  user.role_changed               User role updated                          |
|                                                                             |
|  FEEDBACK EVENTS                                                            |
|  ===============                                                            |
|                                                                             |
|  feedback.customer_submitted     Customer submitted feedback                |
|  feedback.response_sent          Response sent to customer                  |
|                                                                             |
|  TENANT EVENTS                                                              |
|  =============                                                              |
|                                                                             |
|  tenant.created                  New tenant provisioned                     |
|  tenant.settings_updated         Tenant settings changed                    |
|                                                                             |
+---------------------------------------------------------------------------+
```

### Event Schema

```typescript
// src/types/events.ts
interface BaseEvent {
  id: string              // Unique event ID
  type: string            // Event type (e.g., "certificate.approved")
  tenantId: string        // Tenant context
  timestamp: string       // ISO 8601 timestamp
  version: string         // Schema version (e.g., "1.0")
}

interface CertificateEvent extends BaseEvent {
  type: `certificate.${string}`
  data: {
    certificateId: string
    certificateNumber: string
    status: string
    actorId: string
    actorName: string
    metadata?: Record<string, any>
  }
}

interface UserEvent extends BaseEvent {
  type: `user.${string}`
  data: {
    userId: string
    email: string
    role?: string
    metadata?: Record<string, any>
  }
}

type HtaEvent = CertificateEvent | UserEvent | FeedbackEvent | TenantEvent
```

---

## Pub/Sub Implementation

### Terraform Configuration

```hcl
# terraform/modules/pubsub/main.tf

# Main events topic
resource "google_pubsub_topic" "events" {
  name = "hta-events-${var.environment}"

  labels = {
    project     = "hta-calibration"
    environment = var.environment
  }

  message_retention_duration = "604800s"  # 7 days
}

# Dead letter topic
resource "google_pubsub_topic" "events_dlq" {
  name = "hta-events-dlq-${var.environment}"
}

# Webhook delivery subscription
resource "google_pubsub_subscription" "webhook_delivery" {
  name  = "webhook-delivery-${var.environment}"
  topic = google_pubsub_topic.events.name

  ack_deadline_seconds = 60

  retry_policy {
    minimum_backoff = "10s"
    maximum_backoff = "600s"
  }

  dead_letter_policy {
    dead_letter_topic     = google_pubsub_topic.events_dlq.id
    max_delivery_attempts = 5
  }

  # Push to Cloud Run webhook service
  push_config {
    push_endpoint = var.webhook_service_url

    oidc_token {
      service_account_email = var.pubsub_service_account
    }
  }
}

# Email notification subscription
resource "google_pubsub_subscription" "email_notifications" {
  name  = "email-notifications-${var.environment}"
  topic = google_pubsub_topic.events.name

  filter = "attributes.sendEmail = \"true\""

  ack_deadline_seconds = 30

  push_config {
    push_endpoint = var.email_service_url

    oidc_token {
      service_account_email = var.pubsub_service_account
    }
  }
}
```

### Event Publisher

```typescript
// src/lib/events/publisher.ts
import { PubSub } from '@google-cloud/pubsub'
import { v4 as uuidv4 } from 'uuid'

const pubsub = new PubSub()
const topicName = process.env.PUBSUB_TOPIC || 'hta-events'

export async function publishEvent<T extends HtaEvent>(
  eventType: T['type'],
  tenantId: string,
  data: T['data'],
  options?: {
    sendEmail?: boolean
    priority?: 'high' | 'normal' | 'low'
  }
) {
  const event: T = {
    id: uuidv4(),
    type: eventType,
    tenantId,
    timestamp: new Date().toISOString(),
    version: '1.0',
    data
  } as T

  const messageBuffer = Buffer.from(JSON.stringify(event))

  await pubsub.topic(topicName).publishMessage({
    data: messageBuffer,
    attributes: {
      eventType,
      tenantId,
      sendEmail: options?.sendEmail ? 'true' : 'false',
      priority: options?.priority || 'normal'
    }
  })

  // Also store in database for audit trail
  await prisma.event.create({
    data: {
      id: event.id,
      type: eventType,
      tenantId,
      data: event.data,
      timestamp: new Date()
    }
  })

  return event.id
}

// Usage
await publishEvent(
  'certificate.approved',
  session.user.tenantId,
  {
    certificateId: certificate.id,
    certificateNumber: certificate.certificateNumber,
    status: 'APPROVED',
    actorId: session.user.id,
    actorName: session.user.name
  },
  { sendEmail: true }
)
```

---

## Webhook Delivery System

### Webhook Configuration (Per-Tenant)

```typescript
// src/types/webhook-config.ts
interface WebhookConfig {
  id: string
  tenantId: string
  url: string
  events: string[]           // e.g., ["certificate.*", "feedback.customer_submitted"]
  secret: string             // HMAC signing secret
  isActive: boolean
  headers?: Record<string, string>  // Custom headers
  retryPolicy?: {
    maxRetries: number
    backoffMultiplier: number
  }
  createdAt: Date
  updatedAt: Date
}
```

### Webhook Delivery Service

```typescript
// src/lib/webhooks/delivery-service.ts
import crypto from 'crypto'
import { getTenantSecret } from '@/lib/secrets/tenant-secrets'

interface WebhookDelivery {
  webhookId: string
  eventId: string
  tenantId: string
  url: string
  payload: object
  attempt: number
  status: 'pending' | 'success' | 'failed'
  responseCode?: number
  error?: string
}

export async function deliverWebhook(
  event: HtaEvent,
  webhookConfig: WebhookConfig
) {
  const payload = {
    event: event.type,
    timestamp: event.timestamp,
    data: event.data
  }

  // Sign payload
  const signature = await signPayload(
    webhookConfig.tenantId,
    JSON.stringify(payload)
  )

  // Create delivery record
  const delivery = await prisma.webhookDelivery.create({
    data: {
      webhookId: webhookConfig.id,
      eventId: event.id,
      tenantId: event.tenantId,
      payload,
      attempt: 1,
      status: 'pending'
    }
  })

  try {
    const response = await fetch(webhookConfig.url, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'X-HTA-Signature': signature,
        'X-HTA-Event': event.type,
        'X-HTA-Delivery-ID': delivery.id,
        ...webhookConfig.headers
      },
      body: JSON.stringify(payload),
      signal: AbortSignal.timeout(30000)  // 30s timeout
    })

    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: response.ok ? 'success' : 'failed',
        responseCode: response.status,
        completedAt: new Date()
      }
    })

    if (!response.ok) {
      throw new Error(`Webhook returned ${response.status}`)
    }
  } catch (error) {
    await prisma.webhookDelivery.update({
      where: { id: delivery.id },
      data: {
        status: 'failed',
        error: error.message,
        completedAt: new Date()
      }
    })

    // Schedule retry if applicable
    if (delivery.attempt < (webhookConfig.retryPolicy?.maxRetries || 3)) {
      await scheduleRetry(delivery, webhookConfig)
    }
  }
}

async function signPayload(tenantId: string, payload: string): Promise<string> {
  const secret = await getTenantSecret(tenantId, 'webhook')
  if (!secret) {
    throw new Error('Webhook secret not configured')
  }

  const signature = crypto
    .createHmac('sha256', secret)
    .update(payload)
    .digest('hex')

  return `sha256=${signature}`
}

async function scheduleRetry(
  delivery: WebhookDelivery,
  config: WebhookConfig
) {
  const backoff = Math.pow(
    config.retryPolicy?.backoffMultiplier || 2,
    delivery.attempt
  ) * 60 * 1000  // Minutes to ms

  // Use Cloud Tasks for scheduled retry
  const { CloudTasksClient } = require('@google-cloud/tasks')
  const client = new CloudTasksClient()

  await client.createTask({
    parent: `projects/${process.env.GCP_PROJECT}/locations/asia-southeast1/queues/webhook-retry`,
    task: {
      httpRequest: {
        httpMethod: 'POST',
        url: `${process.env.APP_URL}/api/internal/webhook-retry`,
        body: Buffer.from(JSON.stringify({
          deliveryId: delivery.id,
          webhookId: config.id
        })).toString('base64'),
        oidcToken: {
          serviceAccountEmail: process.env.TASKS_SERVICE_ACCOUNT
        }
      },
      scheduleTime: {
        seconds: Math.floor((Date.now() + backoff) / 1000)
      }
    }
  })
}
```

### Webhook Management API

```typescript
// src/app/api/tenant/webhooks/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { createTenantSecret } from '@/lib/secrets/tenant-secrets'
import crypto from 'crypto'

export async function POST(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user || session.user.role !== 'LAB_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json()
  const { url, events } = body

  // Validate URL
  try {
    new URL(url)
  } catch {
    return NextResponse.json({ error: 'Invalid URL' }, { status: 400 })
  }

  // Generate webhook secret
  const secret = crypto.randomBytes(32).toString('hex')

  // Store secret in Secret Manager
  await createTenantSecret(
    session.user.tenantId,
    'webhook',
    secret
  )

  // Create webhook config
  const webhook = await prisma.webhookConfig.create({
    data: {
      tenantId: session.user.tenantId,
      url,
      events,
      isActive: true
    }
  })

  return NextResponse.json({
    id: webhook.id,
    url: webhook.url,
    events: webhook.events,
    secret  // Only returned once on creation
  })
}
```

---

## Real-Time Updates (WebSocket)

### WebSocket Server Setup

```typescript
// src/lib/realtime/socket-server.ts
import { Server as SocketServer } from 'socket.io'
import { verifyToken } from '@/lib/auth/jwt'

export function initializeSocketServer(httpServer: any) {
  const io = new SocketServer(httpServer, {
    cors: {
      origin: process.env.NEXT_PUBLIC_APP_URL,
      credentials: true
    },
    path: '/api/socket'
  })

  // Authentication middleware
  io.use(async (socket, next) => {
    const token = socket.handshake.auth.token
    if (!token) {
      return next(new Error('Authentication required'))
    }

    try {
      const decoded = await verifyToken(token)
      socket.data.userId = decoded.sub
      socket.data.tenantId = decoded.tenantId
      socket.data.role = decoded.role
      next()
    } catch {
      next(new Error('Invalid token'))
    }
  })

  io.on('connection', (socket) => {
    const { tenantId, userId, role } = socket.data

    // Join tenant room
    socket.join(`tenant:${tenantId}`)

    // Join user-specific room
    socket.join(`user:${userId}`)

    // Admin joins all-tenant room
    if (role === 'LAB_ADMIN' || role === 'DEV_ADMIN') {
      socket.join(`tenant:${tenantId}:admin`)
    }

    socket.on('disconnect', () => {
      console.log(`User ${userId} disconnected`)
    })
  })

  return io
}

// Broadcast event to tenant
export function broadcastToTenant(
  io: SocketServer,
  tenantId: string,
  event: string,
  data: any
) {
  io.to(`tenant:${tenantId}`).emit(event, data)
}

// Broadcast to specific user
export function broadcastToUser(
  io: SocketServer,
  userId: string,
  event: string,
  data: any
) {
  io.to(`user:${userId}`).emit(event, data)
}
```

### Client-Side Integration

```typescript
// src/hooks/useRealtimeUpdates.ts
import { useEffect, useState } from 'react'
import { io, Socket } from 'socket.io-client'
import { useSession } from 'next-auth/react'

export function useRealtimeUpdates() {
  const { data: session } = useSession()
  const [socket, setSocket] = useState<Socket | null>(null)
  const [isConnected, setIsConnected] = useState(false)

  useEffect(() => {
    if (!session?.accessToken) return

    const socketInstance = io(process.env.NEXT_PUBLIC_APP_URL!, {
      path: '/api/socket',
      auth: {
        token: session.accessToken
      }
    })

    socketInstance.on('connect', () => {
      setIsConnected(true)
    })

    socketInstance.on('disconnect', () => {
      setIsConnected(false)
    })

    setSocket(socketInstance)

    return () => {
      socketInstance.disconnect()
    }
  }, [session?.accessToken])

  return { socket, isConnected }
}

// Usage in component
function CertificateList() {
  const { socket } = useRealtimeUpdates()
  const [certificates, setCertificates] = useState([])

  useEffect(() => {
    if (!socket) return

    socket.on('certificate.updated', (data) => {
      setCertificates(prev =>
        prev.map(cert =>
          cert.id === data.certificateId
            ? { ...cert, ...data.changes }
            : cert
        )
      )
    })

    socket.on('certificate.created', (data) => {
      setCertificates(prev => [data.certificate, ...prev])
    })

    return () => {
      socket.off('certificate.updated')
      socket.off('certificate.created')
    }
  }, [socket])

  return (/* render certificates */)
}
```

---

## Implementation Checklist

### Phase 1: Event Infrastructure
- [ ] Create Pub/Sub topic and subscriptions
- [ ] Implement event publisher
- [ ] Create event schema
- [ ] Set up dead letter queue

### Phase 2: Webhook System
- [ ] Create webhook configuration table
- [ ] Implement webhook delivery service
- [ ] Add signature generation
- [ ] Set up retry mechanism (Cloud Tasks)
- [ ] Create webhook management API

### Phase 3: Real-Time Updates
- [ ] Set up WebSocket server
- [ ] Implement authentication middleware
- [ ] Create room/channel structure
- [ ] Build client-side hooks
- [ ] Integrate with application events

### Phase 4: Monitoring
- [ ] Monitor Pub/Sub metrics
- [ ] Track webhook delivery rates
- [ ] Alert on delivery failures
- [ ] Create webhook debugging dashboard

---

## Related Documents

- [Overview](./00_scaleup_overview.md)
- [Multi-Tenancy Implementation](./12_multi_tenancy_implementation.md)
- [Secrets Implementation](./08_secrets_implementation.md)
- [Security Implementation](./09_security_implementation.md)
