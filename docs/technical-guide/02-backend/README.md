# 02 - Backend Architecture

## Documentation Index

| File | Description | When to Read |
|------|-------------|--------------|
| [01-api-routes.md](./01-api-routes.md) | API route structure, patterns, examples | Building APIs |
| [02-middleware.md](./02-middleware.md) | Request middleware, auth flow | Route protection |
| [03-error-handling.md](./03-error-handling.md) | Error patterns, logging, validation | Debugging |

---

## Overview

The backend runs entirely within Next.js using:
- **API Routes** (`/api/*`) - RESTful endpoints
- **Server Actions** - Form submissions and mutations
- **Server Components** - Data fetching in components

---

## API Routes

Located in `src/app/api/`, using Next.js Route Handlers:

```
src/app/api/
├── auth/[...nextauth]/    # NextAuth endpoints
├── health/                # Health checks
│   ├── route.ts          # Liveness probe
│   └── ready/route.ts    # Readiness probe
├── certificates/          # Certificate CRUD
├── users/                 # User management
└── ...
```

### Route Handler Pattern

```typescript
// src/app/api/certificates/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/certificates
export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const certificates = await prisma.certificate.findMany({
    where: { createdById: session.user.id },
    orderBy: { createdAt: 'desc' },
  })

  return NextResponse.json(certificates)
}

// POST /api/certificates
export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()

  // Validate with Zod
  const parsed = certificateSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error }, { status: 400 })
  }

  const certificate = await prisma.certificate.create({
    data: {
      ...parsed.data,
      createdById: session.user.id,
      lastModifiedById: session.user.id,
    },
  })

  return NextResponse.json(certificate, { status: 201 })
}
```

### Dynamic Routes

```typescript
// src/app/api/certificates/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const certificate = await prisma.certificate.findUnique({
    where: { id: params.id },
  })

  if (!certificate) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  return NextResponse.json(certificate)
}
```

---

## Server Actions

Server actions are functions that run on the server, called directly from client components:

```typescript
// src/app/actions/certificate-actions.ts
'use server'

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { revalidatePath } from 'next/cache'

export async function createCertificate(formData: FormData) {
  const session = await auth()
  if (!session) throw new Error('Unauthorized')

  const certificate = await prisma.certificate.create({
    data: {
      certificateNumber: formData.get('certificateNumber') as string,
      createdById: session.user.id,
      lastModifiedById: session.user.id,
    },
  })

  // Invalidate cache
  revalidatePath('/certificates')

  return certificate
}

export async function updateCertificateStatus(id: string, status: string) {
  const session = await auth()
  if (!session) throw new Error('Unauthorized')

  await prisma.certificate.update({
    where: { id },
    data: {
      status,
      lastModifiedById: session.user.id,
    },
  })

  revalidatePath(`/certificates/${id}`)
}
```

**Usage in Client Component**:
```typescript
'use client'
import { createCertificate } from '@/app/actions/certificate-actions'

export function NewCertificateForm() {
  return (
    <form action={createCertificate}>
      <input name="certificateNumber" />
      <button type="submit">Create</button>
    </form>
  )
}
```

---

## Services Layer

Business logic is extracted into service files:

```
src/services/
├── certificate-service.ts    # Certificate operations
├── notification-service.ts   # Notifications
├── pdf-service.ts           # PDF generation
└── storage-service.ts       # File storage (GCS/local)
```

### Service Pattern

```typescript
// src/services/certificate-service.ts
import { prisma } from '@/lib/prisma'
import { notificationService } from './notification-service'

export const certificateService = {
  async submitForReview(certificateId: string, userId: string) {
    // 1. Update certificate status
    const certificate = await prisma.certificate.update({
      where: { id: certificateId },
      data: {
        status: 'PENDING_REVIEW',
        lastModifiedById: userId,
      },
    })

    // 2. Create event
    await prisma.certificateEvent.create({
      data: {
        certificateId,
        eventType: 'SUBMITTED_FOR_REVIEW',
        userId,
        userRole: 'ENGINEER',
        eventData: JSON.stringify({ previousStatus: 'DRAFT' }),
        sequenceNumber: await this.getNextSequence(certificateId),
        revision: certificate.currentRevision,
      },
    })

    // 3. Notify reviewer
    await notificationService.notifyReviewer(certificate)

    return certificate
  },

  async getNextSequence(certificateId: string): Promise<number> {
    const last = await prisma.certificateEvent.findFirst({
      where: { certificateId },
      orderBy: { sequenceNumber: 'desc' },
    })
    return (last?.sequenceNumber ?? 0) + 1
  },
}
```

---

## Middleware

Located at `src/middleware.ts`:

```typescript
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export default auth((req) => {
  const isLoggedIn = !!req.auth
  const isAuthPage = req.nextUrl.pathname.startsWith('/login')
  const isApiRoute = req.nextUrl.pathname.startsWith('/api')
  const isPublicRoute = ['/api/health', '/api/auth'].some(p =>
    req.nextUrl.pathname.startsWith(p)
  )

  // Allow public routes
  if (isPublicRoute) return NextResponse.next()

  // Redirect to login if not authenticated
  if (!isLoggedIn && !isAuthPage) {
    return NextResponse.redirect(new URL('/login', req.url))
  }

  // Redirect to dashboard if already logged in
  if (isLoggedIn && isAuthPage) {
    return NextResponse.redirect(new URL('/dashboard', req.url))
  }

  return NextResponse.next()
})

export const config = {
  matcher: ['/((?!_next/static|_next/image|favicon.ico).*)'],
}
```

---

## Error Handling

### API Route Errors

```typescript
export async function POST(request: NextRequest) {
  try {
    const body = await request.json()
    // ... process
    return NextResponse.json(result)
  } catch (error) {
    console.error('API Error:', error)

    if (error instanceof PrismaClientKnownRequestError) {
      if (error.code === 'P2002') {
        return NextResponse.json(
          { error: 'Duplicate entry' },
          { status: 409 }
        )
      }
    }

    return NextResponse.json(
      { error: 'Internal server error' },
      { status: 500 }
    )
  }
}
```

### Server Action Errors

```typescript
'use server'

export async function riskyAction() {
  try {
    // ... do something
    return { success: true, data: result }
  } catch (error) {
    console.error('Action error:', error)
    return { success: false, error: 'Something went wrong' }
  }
}
```

---

## Validation

Using Zod for request validation:

```typescript
// src/lib/validations/certificate.ts
import { z } from 'zod'

export const certificateSchema = z.object({
  certificateNumber: z.string().min(1, 'Required'),
  customerName: z.string().min(1, 'Required'),
  uucDescription: z.string().optional(),
  uucMake: z.string().optional(),
  uucModel: z.string().optional(),
  uucSerialNumber: z.string().optional(),
  dateOfCalibration: z.coerce.date(),
  calibrationTenure: z.number().int().min(1).max(60).default(12),
})

export type CertificateInput = z.infer<typeof certificateSchema>
```

**Usage**:
```typescript
const parsed = certificateSchema.safeParse(body)
if (!parsed.success) {
  return NextResponse.json({
    error: 'Validation failed',
    details: parsed.error.flatten(),
  }, { status: 400 })
}
```

---

## Common Failure Modes

### 1. Database Connection Timeout

**Symptom**: API hangs, then returns 500

**Cause**: Cloud SQL connection pool exhausted or network issue

**Debug**:
```typescript
// Add timeout to Prisma queries
const result = await prisma.$transaction(async (tx) => {
  return tx.certificate.findMany()
}, { timeout: 10000 }) // 10s timeout
```

### 2. Session Not Available

**Symptom**: `session` is null in API route

**Cause**: Missing auth() call or cookie not sent

**Debug**:
```typescript
export async function GET(request: NextRequest) {
  const session = await auth()
  console.log('Session:', JSON.stringify(session, null, 2))
  console.log('Cookies:', request.cookies.getAll())
  // ...
}
```

### 3. CORS Issues

**Symptom**: Browser blocks request

**Cause**: Missing CORS headers for cross-origin requests

**Fix** (if needed):
```typescript
export async function GET(request: NextRequest) {
  const response = NextResponse.json(data)
  response.headers.set('Access-Control-Allow-Origin', '*')
  return response
}
```

### 4. Large Request Body

**Symptom**: 413 Payload Too Large

**Cause**: Next.js default body size limit (1MB)

**Fix** in `next.config.ts`:
```typescript
export default {
  experimental: {
    serverActions: {
      bodySizeLimit: '10mb',
    },
  },
}
```

---

## API Design Guidelines

1. **Use proper HTTP methods**: GET (read), POST (create), PUT/PATCH (update), DELETE (remove)
2. **Return appropriate status codes**: 200, 201, 400, 401, 403, 404, 500
3. **Include error details** in response body
4. **Use pagination** for list endpoints
5. **Validate all inputs** with Zod
6. **Log errors** but don't expose internals to clients

---

## Key Files

| File | Purpose |
|------|---------|
| `src/app/api/auth/[...nextauth]/route.ts` | NextAuth handlers |
| `src/app/api/health/route.ts` | Health check endpoint |
| `src/middleware.ts` | Route protection |
| `src/services/` | Business logic |
| `src/lib/validations/` | Zod schemas |

---

## Next Steps

- [03 - Database](../03-database/) - Prisma and schema design
- [04 - Authentication](../04-authentication/) - NextAuth configuration
