# API Routes

## Overview

The HTA Calibration API uses Next.js App Router API routes located in `src/app/api/`.

---

## Route Structure

```
src/app/api/
├── auth/[...nextauth]/          # NextAuth handlers
├── health/                       # Health checks
│   ├── route.ts                 # Liveness probe
│   └── ready/route.ts           # Readiness probe
│
├── certificates/                 # Certificate management
│   ├── route.ts                 # GET list, POST create
│   ├── check-number/route.ts    # Certificate number validation
│   └── [id]/
│       ├── route.ts             # GET, PUT, DELETE single
│       ├── submit/route.ts      # POST submit for review
│       ├── review/route.ts      # POST peer review actions
│       ├── send-to-customer/route.ts
│       ├── pdf-data/route.ts    # GET PDF generation data
│       ├── download-signed/route.ts
│       ├── assign-revision/route.ts
│       └── uuc-images/
│           ├── route.ts         # GET list, POST upload
│           └── [imageId]/route.ts
│
├── admin/
│   ├── certificates/[id]/route.ts
│   ├── authorization/[id]/route.ts
│   ├── users/
│   │   ├── route.ts             # List, create users
│   │   └── [id]/
│   │       ├── route.ts
│   │       └── tat-metrics/route.ts
│   ├── customers/
│   │   ├── route.ts
│   │   └── requests/[id]/
│   │       ├── approve/route.ts
│   │       └── reject/route.ts
│   └── instruments/
│       ├── route.ts             # List, create
│       ├── import/route.ts      # Bulk import
│       └── [id]/route.ts        # CRUD single
│
├── customer/
│   ├── register/route.ts        # Registration
│   ├── dashboard/route.ts
│   └── review/[token]/
│       ├── route.ts
│       ├── certificate/route.ts
│       ├── approve/route.ts
│       └── reject/route.ts
│
├── chat/
│   ├── threads/
│   │   ├── route.ts             # List threads
│   │   └── [threadId]/
│   │       └── messages/route.ts
│
├── notifications/
│   ├── route.ts
│   └── [id]/read/route.ts
│
├── queue/
│   └── process/route.ts         # Background job processing
│
├── opensign/
│   ├── health/route.ts
│   ├── send-for-signature/route.ts
│   ├── retry/route.ts
│   └── webhook/route.ts
│
└── instruments/route.ts          # Public instrument listing
```

---

## Route Handler Pattern

### Basic Structure

```typescript
// src/app/api/certificates/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/certificates
export async function GET(request: NextRequest) {
  try {
    // 1. Authentication
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // 2. Query parameters
    const { searchParams } = new URL(request.url)
    const page = parseInt(searchParams.get('page') || '1')
    const limit = parseInt(searchParams.get('limit') || '20')
    const status = searchParams.get('status')

    // 3. Build query
    const where = {
      createdById: session.user.id,
      ...(status && { status })
    }

    // 4. Execute query with pagination
    const [certificates, total] = await Promise.all([
      prisma.certificate.findMany({
        where,
        skip: (page - 1) * limit,
        take: limit,
        orderBy: { createdAt: 'desc' },
        include: {
          reviewer: { select: { id: true, name: true } }
        }
      }),
      prisma.certificate.count({ where })
    ])

    // 5. Return response
    return NextResponse.json({
      certificates,
      pagination: {
        page,
        limit,
        total,
        totalPages: Math.ceil(total / limit)
      }
    })
  } catch (error) {
    console.error('Failed to fetch certificates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch certificates' },
      { status: 500 }
    )
  }
}

// POST /api/certificates
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const body = await request.json()

    // Validation
    if (!body.customerName) {
      return NextResponse.json(
        { error: 'Customer name is required' },
        { status: 400 }
      )
    }

    // Create with event sourcing
    const result = await prisma.$transaction(async (tx) => {
      const certificate = await tx.certificate.create({
        data: {
          certificateNumber: body.certificateNumber,
          status: 'DRAFT',
          customerName: body.customerName,
          // ... other fields
          createdById: session.user.id,
          lastModifiedById: session.user.id
        }
      })

      // Create event
      await tx.certificateEvent.create({
        data: {
          certificateId: certificate.id,
          eventType: 'CERTIFICATE_CREATED',
          eventData: JSON.stringify({ initialData: body }),
          userId: session.user.id,
          userRole: session.user.role,
          sequenceNumber: 1,
          revision: 0
        }
      })

      return certificate
    })

    return NextResponse.json(result, { status: 201 })
  } catch (error) {
    console.error('Failed to create certificate:', error)
    return NextResponse.json(
      { error: 'Failed to create certificate' },
      { status: 500 }
    )
  }
}
```

### Dynamic Route Parameters

```typescript
// src/app/api/certificates/[id]/route.ts
interface RouteContext {
  params: Promise<{ id: string }>
}

export async function GET(
  request: NextRequest,
  context: RouteContext
) {
  const { id } = await context.params  // Note: await required in Next.js 15+

  const certificate = await prisma.certificate.findUnique({
    where: { id },
    include: { /* ... */ }
  })

  if (!certificate) {
    return NextResponse.json(
      { error: 'Certificate not found' },
      { status: 404 }
    )
  }

  return NextResponse.json(certificate)
}
```

### Multiple Dynamic Parameters

```typescript
// src/app/api/certificates/[id]/uuc-images/[imageId]/route.ts
interface RouteContext {
  params: Promise<{ id: string; imageId: string }>
}

export async function DELETE(
  request: NextRequest,
  context: RouteContext
) {
  const { id, imageId } = await context.params

  // Delete image
  await prisma.uucImage.delete({
    where: {
      id: imageId,
      certificateId: id  // Ensures image belongs to certificate
    }
  })

  return NextResponse.json({ success: true })
}
```

---

## Authentication Patterns

### Basic Auth Check

```typescript
const session = await auth()
if (!session?.user) {
  return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
}
```

### Role-Based Access

```typescript
import { canAccessAdmin, isMasterAdmin } from '@/lib/auth'

// Admin only
if (!canAccessAdmin(session?.user)) {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// Master admin only
if (!isMasterAdmin(session?.user)) {
  return NextResponse.json(
    { error: 'Forbidden - Master Admin required' },
    { status: 403 }
  )
}
```

### Object-Level Access

```typescript
// Only creator or admin can edit
if (certificate.createdById !== session.user.id && session.user.role !== 'ADMIN') {
  return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
}

// Creator, reviewer, or admin
const isCreator = certificate.createdById === session.user.id
const isReviewer = certificate.reviewerId === session.user.id
const isAdmin = session.user.role === 'ADMIN'

if (!isCreator && !isReviewer && !isAdmin) {
  return NextResponse.json({ error: 'Access denied' }, { status: 403 })
}
```

---

## Request Handling

### JSON Body

```typescript
const body = await request.json()

// With error handling
const body = await request.json().catch(() => ({}))
```

### Query Parameters

```typescript
const { searchParams } = new URL(request.url)
const page = parseInt(searchParams.get('page') || '1')
const search = searchParams.get('search') || ''
const includeInactive = searchParams.get('includeInactive') === 'true'
```

### Form Data (File Upload)

```typescript
export async function POST(request: NextRequest) {
  const formData = await request.formData()
  const file = formData.get('file') as File
  const files = formData.getAll('files') as File[]

  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/png', 'image/heic', 'image/heif']
  if (!allowedTypes.includes(file.type)) {
    return NextResponse.json(
      { error: 'Invalid file type' },
      { status: 400 }
    )
  }

  // Save file
  const buffer = Buffer.from(await file.arrayBuffer())
  const filename = `${certificateId}-${crypto.randomUUID()}.${ext}`
  const filepath = path.join(process.cwd(), 'uploads', 'uuc-images', filename)

  await writeFile(filepath, buffer)

  return NextResponse.json({ filename })
}
```

---

## Response Patterns

### Success Responses

```typescript
// 200 OK (default)
return NextResponse.json({ data: result })

// 201 Created
return NextResponse.json(newResource, { status: 201 })

// 204 No Content
return new NextResponse(null, { status: 204 })
```

### Error Responses

```typescript
// 400 Bad Request
return NextResponse.json(
  { error: 'Validation failed', validationErrors: ['Field X is required'] },
  { status: 400 }
)

// 401 Unauthorized
return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

// 403 Forbidden
return NextResponse.json({ error: 'Forbidden' }, { status: 403 })

// 404 Not Found
return NextResponse.json({ error: 'Resource not found' }, { status: 404 })

// 409 Conflict
return NextResponse.json(
  { error: 'Certificate number already exists' },
  { status: 409 }
)

// 500 Internal Server Error
return NextResponse.json(
  { error: 'Internal server error' },
  { status: 500 }
)
```

### Pagination Response

```typescript
return NextResponse.json({
  data: items,
  pagination: {
    page: currentPage,
    limit: pageSize,
    total: totalCount,
    totalPages: Math.ceil(totalCount / pageSize),
    hasNext: currentPage < Math.ceil(totalCount / pageSize),
    hasPrev: currentPage > 1
  }
})
```

---

## Database Transactions

### Basic Transaction

```typescript
const result = await prisma.$transaction(async (tx) => {
  // All operations use tx instead of prisma
  const certificate = await tx.certificate.create({ ... })
  await tx.certificateEvent.create({ ... })
  return certificate
})
```

### Transaction with Rollback

```typescript
try {
  await prisma.$transaction(async (tx) => {
    await tx.certificate.update({ ... })
    await tx.certificateEvent.create({ ... })

    // If this throws, entire transaction rolls back
    if (someCondition) {
      throw new Error('Validation failed')
    }
  })
} catch (error) {
  // Transaction rolled back
  return NextResponse.json({ error: error.message }, { status: 400 })
}
```

---

## Error Handling

### Standard Try-Catch

```typescript
try {
  // Operation
} catch (error) {
  console.error('Operation failed:', error)
  return NextResponse.json(
    { error: 'Operation failed' },
    { status: 500 }
  )
}
```

### Specific Error Types

```typescript
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'

try {
  await prisma.certificate.create({ ... })
} catch (error) {
  if (error instanceof PrismaClientKnownRequestError) {
    if (error.code === 'P2002') {
      // Unique constraint violation
      return NextResponse.json(
        { error: 'Certificate number already exists' },
        { status: 409 }
      )
    }
  }
  throw error
}
```

### Fire-and-Forget (Non-Critical)

```typescript
// Don't await - let it run in background
notifyReviewerOnSubmit({ certificateId, reviewerId })
  .catch((err) => console.error('Notification failed:', err))

// Continue with response
return NextResponse.json({ success: true })
```

---

## Common Patterns

### Validation Aggregation

```typescript
const validationErrors: string[] = []

if (!body.customerName) validationErrors.push('Customer name is required')
if (!body.dateOfCalibration) validationErrors.push('Calibration date is required')
if (!certificate.reviewerId) validationErrors.push('Reviewer must be assigned')

if (validationErrors.length > 0) {
  return NextResponse.json(
    { error: 'Validation failed', validationErrors },
    { status: 400 }
  )
}
```

### Conditional Includes

```typescript
const include = {
  createdBy: { select: { id: true, name: true, email: true } },
  reviewer: includeReviewer
    ? { select: { id: true, name: true } }
    : false,
  events: includeHistory ? true : false
}
```

### Soft Delete

```typescript
// Mark as inactive instead of deleting
await prisma.user.update({
  where: { id },
  data: { isActive: false, deactivatedAt: new Date() }
})
```
