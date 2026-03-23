# Local Debugging

## Overview

This guide covers debugging the HTA Calibration application during local development.

---

## VS Code Setup

### Launch Configuration

```json
// .vscode/launch.json
{
  "version": "0.2.0",
  "configurations": [
    {
      "name": "Next.js: Debug Server",
      "type": "node-terminal",
      "request": "launch",
      "command": "npm run dev",
      "cwd": "${workspaceFolder}",
      "serverReadyAction": {
        "pattern": "started server on .+, url: (https?://.+)",
        "uriFormat": "%s",
        "action": "debugWithChrome"
      }
    },
    {
      "name": "Next.js: Debug Full Stack",
      "type": "node-terminal",
      "request": "launch",
      "command": "NODE_OPTIONS='--inspect' npm run dev"
    },
    {
      "name": "Jest: Debug Tests",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": ["run", "test", "--", "--runInBand"],
      "console": "integratedTerminal"
    },
    {
      "name": "Jest: Debug Current File",
      "type": "node",
      "request": "launch",
      "runtimeExecutable": "npm",
      "runtimeArgs": [
        "run", "test", "--",
        "--runInBand",
        "--testPathPattern=${relativeFile}"
      ],
      "console": "integratedTerminal"
    }
  ]
}
```

### Settings

```json
// .vscode/settings.json
{
  "typescript.preferences.importModuleSpecifier": "relative",
  "editor.formatOnSave": true,
  "editor.codeActionsOnSave": {
    "source.fixAll.eslint": "explicit"
  }
}
```

---

## Browser DevTools

### React DevTools

1. Install React DevTools extension
2. Open DevTools → Components tab
3. Inspect component hierarchy and props
4. Edit props/state in real-time

### Network Tab

```
# Debugging API calls
1. Open Network tab
2. Filter by "Fetch/XHR"
3. Click on request to see:
   - Headers (check cookies, auth)
   - Payload (request body)
   - Response (server response)
   - Timing (performance)
```

### Console Debugging

```javascript
// Client-side debugging
console.log('State:', state)
console.table(certificates)
console.trace('Call stack')

// Conditional breakpoints
if (condition) debugger;
```

---

## Server-Side Debugging

### API Route Debugging

```typescript
// src/app/api/certificates/route.ts
export async function GET(request: NextRequest) {
  // Add debug logging
  console.log('[API] GET /api/certificates')
  console.log('[API] Session:', JSON.stringify(session, null, 2))
  console.log('[API] Query:', Object.fromEntries(request.nextUrl.searchParams))

  // Check environment
  console.log('[API] DATABASE_URL:', process.env.DATABASE_URL?.slice(0, 30) + '...')

  // ... rest of handler
}
```

### Server Component Debugging

```typescript
// src/app/dashboard/page.tsx
export default async function DashboardPage() {
  console.log('[Server] Rendering DashboardPage')

  const session = await auth()
  console.log('[Server] Session:', session?.user?.email)

  // Debug data fetching
  const startTime = Date.now()
  const data = await getData()
  console.log(`[Server] Data fetched in ${Date.now() - startTime}ms`)

  return <Dashboard data={data} />
}
```

### Node Inspector

```bash
# Start with Node inspector
NODE_OPTIONS='--inspect' npm run dev

# Open chrome://inspect in Chrome
# Click "inspect" under Remote Target
```

---

## Database Debugging

### Prisma Debug Mode

```bash
# Enable Prisma query logging
DEBUG="prisma:*" npm run dev

# Or just query logs
DEBUG="prisma:query" npm run dev
```

### Prisma Studio

```bash
# Open Prisma Studio
npx prisma studio

# Opens at http://localhost:5555
# Browse and edit database records
```

### Query Logging

```typescript
// src/lib/prisma.ts
import { PrismaClient } from '@prisma/client'

const prisma = new PrismaClient({
  log: [
    { emit: 'event', level: 'query' },
    { emit: 'stdout', level: 'info' },
    { emit: 'stdout', level: 'warn' },
    { emit: 'stdout', level: 'error' },
  ],
})

prisma.$on('query', (e) => {
  console.log('Query: ' + e.query)
  console.log('Params: ' + e.params)
  console.log('Duration: ' + e.duration + 'ms')
})
```

### Direct Database Access

```bash
# SQLite (local dev)
sqlite3 prisma/dev.db

# Common queries
.tables
SELECT * FROM User LIMIT 5;
SELECT * FROM Certificate WHERE status = 'DRAFT';

# PostgreSQL
psql -h localhost -U hta_user -d hta_calibration

# Common queries
\dt                           # List tables
\d+ "Certificate"             # Describe table
SELECT * FROM "User" LIMIT 5;
```

---

## Authentication Debugging

### Session Inspection

```typescript
// Temporary debug route
// src/app/api/debug/session/route.ts
import { auth } from '@/lib/auth'
import { NextResponse } from 'next/server'

export async function GET() {
  const session = await auth()
  return NextResponse.json({
    hasSession: !!session,
    user: session?.user,
    expires: session?.expires,
  })
}
```

### Cookie Inspection

```javascript
// In browser console
document.cookie.split(';').forEach(c => console.log(c.trim()))

// Check for auth cookies:
// - authjs.session-token
// - authjs.csrf-token
// - authjs.callback-url
```

### JWT Token Debugging

```javascript
// Decode JWT in browser console
const token = document.cookie
  .split(';')
  .find(c => c.includes('session-token'))
  ?.split('=')[1]

// JWT is base64 encoded
const [header, payload, signature] = token.split('.')
console.log(JSON.parse(atob(payload)))
```

---

## State Management Debugging

### Zustand DevTools

```typescript
// src/stores/certificate-store.ts
import { devtools } from 'zustand/middleware'

export const useCertificateStore = create<CertificateStore>()(
  devtools(
    (set, get) => ({
      // ... store implementation
    }),
    { name: 'certificate-store' }
  )
)
```

Then in browser:
1. Install Redux DevTools extension
2. Open DevTools → Redux tab
3. See Zustand state changes

### State Logging

```typescript
// Add logging middleware
import { devtools, subscribeWithSelector } from 'zustand/middleware'

const store = create(
  subscribeWithSelector(
    devtools((set) => ({
      // ...
    }))
  )
)

// Log specific state changes
store.subscribe(
  (state) => state.formData,
  (formData) => console.log('FormData changed:', formData)
)
```

---

## Network Debugging

### Request Logging

```typescript
// src/lib/api-client.ts
async function fetchWithLogging(url: string, options?: RequestInit) {
  console.log(`[Fetch] ${options?.method || 'GET'} ${url}`)
  console.log('[Fetch] Options:', options)

  const start = Date.now()
  const response = await fetch(url, options)
  const duration = Date.now() - start

  console.log(`[Fetch] Response: ${response.status} in ${duration}ms`)

  return response
}
```

### CORS Debugging

```
# Common CORS errors in console:
1. "No 'Access-Control-Allow-Origin' header"
   → Server not sending CORS headers

2. "Preflight request doesn't pass"
   → Server not handling OPTIONS request

3. "Credentials mode is 'include'"
   → Server needs Access-Control-Allow-Credentials
```

---

## Error Boundary Debugging

### Client Error Boundary

```typescript
// src/components/error-boundary.tsx
'use client'

import { Component, ErrorInfo, ReactNode } from 'react'

interface Props {
  children: ReactNode
  fallback?: ReactNode
}

interface State {
  hasError: boolean
  error?: Error
}

export class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props)
    this.state = { hasError: false }
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error }
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error('[ErrorBoundary] Caught error:', error)
    console.error('[ErrorBoundary] Component stack:', errorInfo.componentStack)

    // Log to error tracking service
    // logError(error, errorInfo)
  }

  render() {
    if (this.state.hasError) {
      return this.props.fallback || (
        <div>
          <h2>Something went wrong</h2>
          <details>
            <summary>Error details</summary>
            <pre>{this.state.error?.message}</pre>
            <pre>{this.state.error?.stack}</pre>
          </details>
        </div>
      )
    }

    return this.props.children
  }
}
```

---

## Performance Debugging

### React Profiler

```typescript
// Wrap component to profile
import { Profiler } from 'react'

function onRenderCallback(
  id: string,
  phase: 'mount' | 'update',
  actualDuration: number,
  baseDuration: number,
  startTime: number,
  commitTime: number
) {
  console.log(`[Profiler] ${id} ${phase}: ${actualDuration.toFixed(2)}ms`)
}

export function ProfiledComponent() {
  return (
    <Profiler id="CertificateForm" onRender={onRenderCallback}>
      <CertificateForm />
    </Profiler>
  )
}
```

### Bundle Analysis

```bash
# Analyze bundle size
npm run build
npx @next/bundle-analyzer
```

### Why Did You Render

```typescript
// src/lib/wdyr.ts (development only)
import React from 'react'

if (process.env.NODE_ENV === 'development') {
  const whyDidYouRender = require('@welldone-software/why-did-you-render')
  whyDidYouRender(React, {
    trackAllPureComponents: true,
  })
}

// Then in component:
MyComponent.whyDidYouRender = true
```

---

## Common Debug Patterns

### Temporary Debug Code

```typescript
// Always mark debug code for easy removal
// DEBUG: Remove before merge
console.log('DEBUG:', variable)

// Or use conditional
if (process.env.NODE_ENV === 'development') {
  console.log('Development debug:', data)
}
```

### Debug Component

```typescript
// src/components/debug/debug-panel.tsx
'use client'

import { useSession } from 'next-auth/react'
import { useCertificateStore } from '@/stores/certificate-store'

export function DebugPanel() {
  if (process.env.NODE_ENV !== 'development') return null

  const { data: session } = useSession()
  const formData = useCertificateStore((s) => s.formData)

  return (
    <div className="fixed bottom-0 right-0 p-4 bg-gray-900 text-white text-xs max-w-md max-h-96 overflow-auto">
      <h3>Debug Panel</h3>
      <details>
        <summary>Session</summary>
        <pre>{JSON.stringify(session, null, 2)}</pre>
      </details>
      <details>
        <summary>Form Data</summary>
        <pre>{JSON.stringify(formData, null, 2)}</pre>
      </details>
    </div>
  )
}
```

---

## Troubleshooting Checklist

1. **Check the console** - Browser and terminal
2. **Check Network tab** - API responses, status codes
3. **Check cookies** - Auth cookies present?
4. **Check environment** - Correct DATABASE_URL?
5. **Check database** - Data exists? Schema correct?
6. **Add logging** - Narrow down the issue
7. **Simplify** - Remove code until it works
8. **Compare** - What changed recently?

---

## Key Files

| File | Purpose |
|------|---------|
| `.vscode/launch.json` | Debug configurations |
| `src/lib/prisma.ts` | Database client with logging |
| `src/components/debug/` | Debug utilities |
