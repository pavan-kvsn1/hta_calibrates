# Error Handling

## Overview

Consistent error handling across API routes ensures predictable responses and easier debugging.

---

## Error Response Format

### Standard Structure

```typescript
// Error response
{
  "error": "Human-readable error message",
  "code": "ERROR_CODE",           // Optional: machine-readable code
  "validationErrors": [...],       // Optional: for validation errors
  "details": {...}                 // Optional: additional context
}

// Examples
{ "error": "Unauthorized" }
{ "error": "Certificate not found" }
{ "error": "Validation failed", "validationErrors": ["Customer name is required"] }
```

---

## HTTP Status Codes

### Success Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 200 | OK | Successful GET, PUT |
| 201 | Created | Successful POST creating resource |
| 204 | No Content | Successful DELETE |

### Client Error Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 400 | Bad Request | Invalid input, validation errors |
| 401 | Unauthorized | Missing or invalid auth |
| 403 | Forbidden | Authenticated but not allowed |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource, state conflict |
| 422 | Unprocessable Entity | Semantic errors |
| 429 | Too Many Requests | Rate limiting |

### Server Error Codes

| Code | Meaning | Usage |
|------|---------|-------|
| 500 | Internal Server Error | Unexpected errors |
| 502 | Bad Gateway | Upstream service error |
| 503 | Service Unavailable | Temporary unavailability |

---

## Error Handling Patterns

### Try-Catch Wrapper

```typescript
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const data = await prisma.certificate.findMany()
    return NextResponse.json(data)

  } catch (error) {
    console.error('Failed to fetch certificates:', error)
    return NextResponse.json(
      { error: 'Failed to fetch certificates' },
      { status: 500 }
    )
  }
}
```

### Validation Errors

```typescript
export async function POST(request: NextRequest) {
  const body = await request.json()
  const validationErrors: string[] = []

  // Collect all validation errors
  if (!body.customerName?.trim()) {
    validationErrors.push('Customer name is required')
  }
  if (!body.dateOfCalibration) {
    validationErrors.push('Calibration date is required')
  }
  if (!body.uucDescription?.trim()) {
    validationErrors.push('UUC description is required')
  }
  if (body.calibrationTenure && (body.calibrationTenure < 1 || body.calibrationTenure > 60)) {
    validationErrors.push('Calibration tenure must be between 1 and 60 months')
  }

  // Return all errors at once
  if (validationErrors.length > 0) {
    return NextResponse.json(
      {
        error: 'Validation failed',
        validationErrors
      },
      { status: 400 }
    )
  }

  // Proceed with creation
}
```

### Database Errors

```typescript
import { PrismaClientKnownRequestError } from '@prisma/client/runtime/library'

try {
  await prisma.certificate.create({
    data: { certificateNumber: 'HTA-2024-001', ... }
  })
} catch (error) {
  if (error instanceof PrismaClientKnownRequestError) {
    switch (error.code) {
      case 'P2002':
        // Unique constraint violation
        return NextResponse.json(
          { error: 'Certificate number already exists' },
          { status: 409 }
        )
      case 'P2003':
        // Foreign key constraint violation
        return NextResponse.json(
          { error: 'Referenced resource does not exist' },
          { status: 400 }
        )
      case 'P2025':
        // Record not found
        return NextResponse.json(
          { error: 'Resource not found' },
          { status: 404 }
        )
      default:
        console.error('Database error:', error.code, error.message)
        throw error
    }
  }
  throw error
}
```

### Authentication Errors

```typescript
// 401 - Not authenticated
const session = await auth()
if (!session?.user) {
  return NextResponse.json(
    { error: 'Unauthorized' },
    { status: 401 }
  )
}

// 403 - Authenticated but not authorized
if (!canAccessAdmin(session?.user)) {
  return NextResponse.json(
    { error: 'Forbidden' },
    { status: 403 }
  )
}

// 403 - Not owner of resource
if (certificate.createdById !== session.user.id) {
  return NextResponse.json(
    { error: 'You do not have access to this certificate' },
    { status: 403 }
  )
}
```

### Not Found Errors

```typescript
const certificate = await prisma.certificate.findUnique({
  where: { id }
})

if (!certificate) {
  return NextResponse.json(
    { error: 'Certificate not found' },
    { status: 404 }
  )
}
```

### State/Business Logic Errors

```typescript
// Cannot submit draft that's already submitted
if (certificate.status !== 'DRAFT') {
  return NextResponse.json(
    {
      error: 'Cannot submit certificate',
      details: {
        currentStatus: certificate.status,
        allowedStatus: 'DRAFT'
      }
    },
    { status: 409 }
  )
}

// Cannot approve own certificate
if (certificate.createdById === session.user.id) {
  return NextResponse.json(
    { error: 'Cannot approve your own certificate' },
    { status: 403 }
  )
}
```

---

## Logging Best Practices

### What to Log

```typescript
// Error with context
console.error('Failed to create certificate:', {
  userId: session.user.id,
  input: sanitizedInput,  // Remove sensitive data
  error: error instanceof Error ? error.message : 'Unknown error',
  stack: error instanceof Error ? error.stack : undefined
})

// Security events
console.warn('Unauthorized access attempt:', {
  userId: session?.user?.id || 'anonymous',
  resource: certificateId,
  action: 'DELETE',
  ip: request.headers.get('x-forwarded-for')
})

// Business events (info level)
console.log('Certificate submitted for review:', {
  certificateId,
  userId: session.user.id,
  reviewerId,
  timestamp: new Date().toISOString()
})
```

### What NOT to Log

```typescript
// NEVER log sensitive data
console.log(password)           // ❌
console.log(apiKey)             // ❌
console.log(sessionToken)       // ❌
console.log(creditCardNumber)   // ❌
console.log(body)               // ❌ May contain sensitive data

// Sanitize before logging
const sanitizedBody = {
  ...body,
  password: '[REDACTED]',
  creditCard: '[REDACTED]'
}
console.log('Request body:', sanitizedBody)  // ✓
```

---

## Error Recovery

### Graceful Degradation

```typescript
// Non-critical operation - continue even if it fails
try {
  await notifyReviewerOnSubmit({ certificateId, reviewerId })
} catch (error) {
  console.error('Failed to send notification:', error)
  // Continue - don't fail the main operation
}

// Or fire-and-forget
notifyReviewerOnSubmit({ certificateId, reviewerId })
  .catch((err) => console.error('Notification failed:', err))
```

### Partial Success

```typescript
// Import operation - report partial success
const results = {
  successful: [],
  failed: []
}

for (const item of items) {
  try {
    const created = await createItem(item)
    results.successful.push(created)
  } catch (error) {
    results.failed.push({
      item,
      error: error.message
    })
  }
}

return NextResponse.json({
  success: results.failed.length === 0,
  successCount: results.successful.length,
  failureCount: results.failed.length,
  failures: results.failed
})
```

### Retry Logic

```typescript
async function fetchWithRetry(url: string, maxRetries = 3) {
  for (let attempt = 1; attempt <= maxRetries; attempt++) {
    try {
      const response = await fetch(url)
      if (response.ok) return response
      throw new Error(`HTTP ${response.status}`)
    } catch (error) {
      if (attempt === maxRetries) throw error
      console.log(`Attempt ${attempt} failed, retrying...`)
      await new Promise(r => setTimeout(r, 1000 * attempt))  // Exponential backoff
    }
  }
}
```

---

## Client-Side Error Handling

### Fetch with Error Handling

```typescript
async function submitCertificate(id: string) {
  try {
    const response = await fetch(`/api/certificates/${id}/submit`, {
      method: 'POST'
    })

    if (!response.ok) {
      const error = await response.json()
      throw new Error(error.error || 'Submission failed')
    }

    return await response.json()
  } catch (error) {
    // Show toast or error message
    toast.error(error.message)
    throw error
  }
}
```

### Validation Error Display

```typescript
const [errors, setErrors] = useState<string[]>([])

async function handleSubmit() {
  const response = await fetch('/api/certificates', {
    method: 'POST',
    body: JSON.stringify(formData)
  })

  if (!response.ok) {
    const error = await response.json()

    if (error.validationErrors) {
      setErrors(error.validationErrors)  // Show all validation errors
    } else {
      toast.error(error.error)
    }
    return
  }

  // Success
}

// In JSX
{errors.length > 0 && (
  <div className="bg-red-50 p-4 rounded">
    <ul className="list-disc pl-4">
      {errors.map((error, i) => (
        <li key={i} className="text-red-600">{error}</li>
      ))}
    </ul>
  </div>
)}
```

---

## Error Boundary (React)

```typescript
// src/app/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error & { digest?: string }
  reset: () => void
}) {
  useEffect(() => {
    // Log to error reporting service
    console.error('Page error:', error)
  }, [error])

  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-center">
        <h2 className="text-2xl font-bold text-red-600 mb-4">
          Something went wrong!
        </h2>
        <p className="text-gray-600 mb-4">
          {error.message || 'An unexpected error occurred'}
        </p>
        <button
          onClick={reset}
          className="px-4 py-2 bg-primary text-white rounded"
        >
          Try again
        </button>
      </div>
    </div>
  )
}
```
