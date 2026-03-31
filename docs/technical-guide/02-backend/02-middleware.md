# Middleware

## Overview

Next.js middleware runs before every request, enabling route protection, redirects, and request modification.

---

## Middleware Configuration

```typescript
// src/middleware.ts
import { NextResponse } from 'next/server'
import type { NextRequest } from 'next/server'

export function middleware(request: NextRequest) {
  const { pathname } = request.nextUrl

  // Public routes - no auth required
  const publicRoutes = [
    '/',
    '/login',
    '/customer/login',
    '/customer/register',
  ]

  // API routes that don't need auth
  const publicApiRoutes = [
    '/api/auth',
    '/api/customer/register',
    '/api/health',
  ]

  // Token-based routes (customer review without login)
  const tokenRoutes = ['/customer/review']

  // Check if public
  const isPublicRoute = publicRoutes.includes(pathname)
  const isPublicApi = publicApiRoutes.some(route => pathname.startsWith(route))
  const isTokenRoute = tokenRoutes.some(route => pathname.startsWith(route))

  if (isPublicRoute || isPublicApi || isTokenRoute) {
    return NextResponse.next()
  }

  // Check for session token
  const sessionToken = request.cookies.get('authjs.session-token')?.value
    || request.cookies.get('__Secure-authjs.session-token')?.value

  if (!sessionToken) {
    // Determine redirect based on route
    const loginUrl = pathname.startsWith('/customer')
      ? '/customer/login'
      : '/login'

    const url = request.nextUrl.clone()
    url.pathname = loginUrl
    url.searchParams.set('callbackUrl', encodeURIComponent(pathname))

    return NextResponse.redirect(url)
  }

  return NextResponse.next()
}

// Configure which routes use middleware
export const config = {
  matcher: [
    '/dashboard/:path*',
    '/review/:path*',
    '/customer/:path*',
    '/admin/:path*',
  ]
}
```

---

## Route Matching

### Matcher Patterns

```typescript
export const config = {
  matcher: [
    // Specific paths
    '/dashboard/:path*',       // /dashboard and all children
    '/admin/:path*',           // /admin and all children

    // Exclude static files
    '/((?!_next/static|_next/image|favicon.ico).*)',

    // API routes (if needed)
    '/api/:path*',
  ]
}
```

### Pattern Examples

| Pattern | Matches |
|---------|---------|
| `/dashboard` | Only `/dashboard` |
| `/dashboard/:path` | `/dashboard/anything` (one segment) |
| `/dashboard/:path*` | `/dashboard`, `/dashboard/a`, `/dashboard/a/b/c` |
| `/(auth)/:path*` | Routes in `(auth)` group |

---

## Common Middleware Tasks

### Adding Headers

```typescript
export function middleware(request: NextRequest) {
  const response = NextResponse.next()

  // Add security headers
  response.headers.set('X-Frame-Options', 'DENY')
  response.headers.set('X-Content-Type-Options', 'nosniff')
  response.headers.set('Referrer-Policy', 'strict-origin-when-cross-origin')

  return response
}
```

### Request Logging

```typescript
export function middleware(request: NextRequest) {
  console.log(`[${new Date().toISOString()}] ${request.method} ${request.nextUrl.pathname}`)

  return NextResponse.next()
}
```

### Geolocation-Based Routing

```typescript
export function middleware(request: NextRequest) {
  const country = request.geo?.country || 'US'

  if (country === 'IN') {
    // Redirect to India-specific page
    const url = request.nextUrl.clone()
    url.pathname = '/in' + url.pathname
    return NextResponse.rewrite(url)
  }

  return NextResponse.next()
}
```

### Rate Limiting (Basic)

```typescript
const rateLimit = new Map<string, { count: number; timestamp: number }>()

export function middleware(request: NextRequest) {
  const ip = request.ip || 'unknown'
  const now = Date.now()
  const windowMs = 60000  // 1 minute
  const maxRequests = 100

  const current = rateLimit.get(ip)

  if (current && now - current.timestamp < windowMs) {
    if (current.count >= maxRequests) {
      return NextResponse.json(
        { error: 'Too many requests' },
        { status: 429 }
      )
    }
    current.count++
  } else {
    rateLimit.set(ip, { count: 1, timestamp: now })
  }

  return NextResponse.next()
}
```

---

## Authentication Flow

```
┌─────────────────────────────────────────────────────────────────┐
│                    MIDDLEWARE AUTH FLOW                          │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  Request                                                         │
│     │                                                            │
│     ▼                                                            │
│  ┌─────────────────────────────────────────┐                    │
│  │ Is public route?                         │                    │
│  │ (/login, /, /api/auth/*, /api/health)   │                    │
│  └───────────────┬─────────────────────────┘                    │
│                  │                                               │
│          ┌──────┴──────┐                                        │
│          │             │                                        │
│          ▼             ▼                                        │
│        YES            NO                                        │
│          │             │                                        │
│          ▼             ▼                                        │
│     NextResponse   ┌─────────────────────────────┐              │
│     .next()        │ Is token-based route?       │              │
│                    │ (/customer/review/*)         │              │
│                    └───────────────┬─────────────┘              │
│                                    │                             │
│                            ┌───────┴───────┐                    │
│                            │               │                    │
│                            ▼               ▼                    │
│                          YES              NO                    │
│                            │               │                    │
│                            ▼               ▼                    │
│                    NextResponse     ┌─────────────────┐         │
│                    .next()          │ Has session     │         │
│                                     │ token cookie?   │         │
│                                     └────────┬────────┘         │
│                                              │                   │
│                                      ┌───────┴───────┐          │
│                                      │               │          │
│                                      ▼               ▼          │
│                                    YES              NO          │
│                                      │               │          │
│                                      ▼               ▼          │
│                               NextResponse    Redirect to       │
│                               .next()         /login or         │
│                                               /customer/login   │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Edge Runtime Limitations

Middleware runs on the Edge Runtime, which has limitations:

### Not Available

- Node.js APIs (fs, path, etc.)
- Database connections (Prisma)
- Heavy computation
- Large dependencies

### Available

- Web APIs (fetch, Request, Response)
- URL manipulation
- Cookie access
- Headers manipulation
- Basic crypto (crypto.subtle)

### Workaround: API Route for Heavy Logic

```typescript
// middleware.ts - keep it light
export function middleware(request: NextRequest) {
  // Just check cookie exists
  const token = request.cookies.get('authjs.session-token')

  if (!token && !isPublicRoute(request.nextUrl.pathname)) {
    return NextResponse.redirect(new URL('/login', request.url))
  }

  return NextResponse.next()
}

// API route - for role checking
// src/app/api/auth/check-role/route.ts
export async function GET(request: NextRequest) {
  const session = await auth()  // Full session validation

  if (!canAccessAdmin(session?.user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  return NextResponse.json({ ok: true })
}
```

---

## Debugging Middleware

### Console Logging

```typescript
export function middleware(request: NextRequest) {
  console.log('Middleware executing for:', request.nextUrl.pathname)
  console.log('Cookies:', request.cookies.getAll())
  console.log('Headers:', Object.fromEntries(request.headers))

  return NextResponse.next()
}
```

### Check Middleware Is Running

Add a custom header:

```typescript
export function middleware(request: NextRequest) {
  const response = NextResponse.next()
  response.headers.set('X-Middleware-Executed', 'true')
  return response
}
```

Check in browser DevTools Network tab for the header.

---

## Common Issues

### Middleware Not Running

**Check matcher pattern:**
```typescript
// Wrong: missing :path*
matcher: ['/dashboard']  // Only matches exactly /dashboard

// Correct: includes all children
matcher: ['/dashboard/:path*']
```

### Redirect Loop

**Issue:** Middleware redirects to login, which is also protected

**Fix:** Ensure public routes include the login page:
```typescript
const publicRoutes = ['/login', '/customer/login']
if (publicRoutes.includes(pathname)) {
  return NextResponse.next()
}
```

### Cookie Not Found

**Issue:** Looking for wrong cookie name

```typescript
// Development
const token = request.cookies.get('authjs.session-token')

// Production (HTTPS)
const token = request.cookies.get('__Secure-authjs.session-token')

// Handle both
const token = request.cookies.get('authjs.session-token')?.value
  || request.cookies.get('__Secure-authjs.session-token')?.value
```
