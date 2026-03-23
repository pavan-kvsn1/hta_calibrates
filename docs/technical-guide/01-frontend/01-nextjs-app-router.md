# Next.js App Router Structure

## Overview

The HTA Calibration application uses Next.js 15+ with the App Router for file-based routing.

---

## Route Organization

```
src/app/
├── (auth)/                    # Public authentication routes (grouped)
│   ├── login/                 # Staff login
│   └── customer/
│       ├── login/             # Customer login
│       ├── register/          # Customer registration
│       └── activate/[token]/  # Account activation
│
├── (dashboard)/               # Protected staff dashboard (grouped)
│   └── dashboard/
│       ├── page.tsx           # Dashboard home
│       ├── certificates/
│       │   ├── new/           # Create certificate
│       │   └── [id]/
│       │       ├── edit/      # Edit certificate
│       │       └── view/      # View certificate
│       ├── reviewer/
│       │   └── [id]/          # Review specific certificate
│       └── notifications/
│
├── customer/                  # Customer portal
│   ├── dashboard/
│   ├── review/
│   │   ├── [token]/           # Token-based review (no login)
│   │   └── cert/[id]/         # Certificate review
│   ├── notifications/
│   ├── settings/
│   ├── team/
│   └── users/
│
├── admin/                     # Admin portal
│   ├── page.tsx               # Admin dashboard
│   ├── authorization/
│   │   └── [id]/              # Authorize certificate
│   ├── certificates/
│   │   └── [id]/              # View/manage certificate
│   ├── customers/
│   │   └── requests/[id]/     # Customer requests
│   ├── instruments/           # Master instruments
│   ├── registrations/         # Registration approvals
│   ├── requests/[id]/         # Unlock requests
│   └── users/
│       └── [id]/edit/         # Edit user
│
└── api/                       # API routes
    ├── auth/[...nextauth]/    # NextAuth handlers
    ├── certificates/          # Certificate CRUD
    ├── admin/                 # Admin APIs
    ├── customer/              # Customer APIs
    ├── chat/                  # Chat system
    ├── notifications/         # Notifications
    ├── health/                # Health checks
    └── queue/                 # Background jobs
```

---

## Route Groups

Route groups `(name)` organize routes without affecting the URL:

```typescript
// These create the same URL structure:
src/app/(auth)/login/page.tsx        → /login
src/app/(dashboard)/dashboard/page.tsx → /dashboard

// But allow different layouts:
src/app/(auth)/layout.tsx            // Minimal layout for login
src/app/(dashboard)/layout.tsx       // Full dashboard layout with sidebar
```

---

## Dynamic Routes

### Single Parameter

```typescript
// src/app/admin/certificates/[id]/page.tsx
export default async function CertificatePage({
  params
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = await params
  const certificate = await getCertificate(id)
  return <CertificateView certificate={certificate} />
}
```

### Multiple Parameters

```typescript
// src/app/api/certificates/[id]/uuc-images/[imageId]/route.ts
export async function DELETE(
  request: NextRequest,
  context: { params: Promise<{ id: string; imageId: string }> }
) {
  const { id, imageId } = await context.params
  // Delete image
}
```

### Catch-All Routes

```typescript
// src/app/api/auth/[...nextauth]/route.ts
// Matches: /api/auth/signin, /api/auth/signout, /api/auth/callback/*, etc.
```

---

## Layout Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                        ROOT LAYOUT                               │
│  src/app/layout.tsx                                             │
│  ┌─────────────────────────────────────────────────────────┐   │
│  │ <html>                                                   │   │
│  │   <body>                                                 │   │
│  │     <SessionProvider>                                    │   │
│  │       {children}                                         │   │
│  │     </SessionProvider>                                   │   │
│  │   </body>                                                │   │
│  │ </html>                                                  │   │
│  └─────────────────────────────────────────────────────────┘   │
│                              │                                   │
│         ┌────────────────────┼────────────────────┐             │
│         │                    │                    │             │
│         ▼                    ▼                    ▼             │
│  ┌─────────────┐    ┌─────────────┐     ┌─────────────┐        │
│  │ (auth)      │    │ (dashboard) │     │ admin       │        │
│  │ layout.tsx  │    │ layout.tsx  │     │ layout.tsx  │        │
│  │             │    │ ┌─────────┐ │     │ ┌─────────┐ │        │
│  │ Minimal     │    │ │Sidebar  │ │     │ │AdminNav │ │        │
│  │ centered    │    │ │Header   │ │     │ │Sidebar  │ │        │
│  │             │    │ │Content  │ │     │ │Content  │ │        │
│  └─────────────┘    │ └─────────┘ │     └─────────────┘        │
│                     └─────────────┘                             │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

### Root Layout

```typescript
// src/app/layout.tsx
import { SessionProvider } from '@/components/providers/session-provider'
import { Geist, Geist_Mono, Caveat } from 'next/font/google'

const geistSans = Geist({ subsets: ['latin'], variable: '--font-geist-sans' })
const caveat = Caveat({ subsets: ['latin'], variable: '--font-caveat' })

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${geistSans.variable} ${caveat.variable}`}>
      <body>
        <SessionProvider>
          {children}
        </SessionProvider>
      </body>
    </html>
  )
}
```

### Dashboard Layout

```typescript
// src/app/(dashboard)/layout.tsx
import { DashboardSidebar } from '@/components/layout/DashboardSidebar'
import { DashboardHeader } from '@/components/layout/DashboardHeader'

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex h-screen">
      <DashboardSidebar />
      <div className="flex-1 flex flex-col">
        <DashboardHeader />
        <main className="flex-1 overflow-auto p-6">
          {children}
        </main>
      </div>
    </div>
  )
}
```

---

## Server vs Client Components

### Server Components (Default)

```typescript
// src/app/admin/certificates/[id]/page.tsx
// No "use client" - this is a Server Component
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'

export default async function CertificatePage({ params }) {
  const { id } = await params
  const session = await auth()

  const certificate = await prisma.certificate.findUnique({
    where: { id },
    include: { createdBy: true, reviewer: true }
  })

  return <CertificateView certificate={certificate} />
}
```

### Client Components

```typescript
// src/app/admin/certificates/[id]/AdminCertificateClient.tsx
'use client'

import { useState } from 'react'
import { useCertificateStore } from '@/lib/stores/certificate-store'

export function AdminCertificateClient({ certificate }) {
  const [isLoading, setIsLoading] = useState(false)
  const { formData, setFormField } = useCertificateStore()

  // Interactive logic here
  return <div>...</div>
}
```

### Pattern: Server Page + Client Content

```typescript
// Server Component page.tsx
export default async function Page({ params }) {
  const data = await fetchData(params.id)
  return <ClientContent initialData={data} />
}

// Client Component
'use client'
export function ClientContent({ initialData }) {
  const [data, setData] = useState(initialData)
  // Handle interactivity
}
```

---

## Loading and Error States

### Loading UI

```typescript
// src/app/admin/certificates/loading.tsx
export default function Loading() {
  return (
    <div className="flex items-center justify-center h-64">
      <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-primary" />
    </div>
  )
}
```

### Error Handling

```typescript
// src/app/admin/certificates/error.tsx
'use client'

export default function Error({
  error,
  reset,
}: {
  error: Error
  reset: () => void
}) {
  return (
    <div className="p-6 text-center">
      <h2 className="text-xl font-bold text-red-600">Something went wrong!</h2>
      <p className="text-gray-600 mt-2">{error.message}</p>
      <button
        onClick={reset}
        className="mt-4 px-4 py-2 bg-primary text-white rounded"
      >
        Try again
      </button>
    </div>
  )
}
```

### Not Found

```typescript
// src/app/admin/certificates/[id]/not-found.tsx
export default function NotFound() {
  return (
    <div className="p-6 text-center">
      <h2 className="text-xl font-bold">Certificate Not Found</h2>
      <p className="text-gray-600 mt-2">
        The certificate you're looking for doesn't exist.
      </p>
    </div>
  )
}
```

---

## Metadata

### Static Metadata

```typescript
// src/app/admin/page.tsx
export const metadata = {
  title: 'Admin Dashboard | HTA Calibration',
  description: 'Administrative dashboard for HTA Calibration system',
}
```

### Dynamic Metadata

```typescript
// src/app/admin/certificates/[id]/page.tsx
export async function generateMetadata({ params }) {
  const { id } = await params
  const certificate = await prisma.certificate.findUnique({ where: { id } })

  return {
    title: `Certificate ${certificate?.certificateNumber} | HTA Calibration`,
  }
}
```

---

## Data Fetching Patterns

### Server Component Fetching

```typescript
// Direct database access in Server Components
export default async function CertificatesPage() {
  const session = await auth()

  const certificates = await prisma.certificate.findMany({
    where: { createdById: session.user.id },
    orderBy: { createdAt: 'desc' },
    include: { reviewer: true }
  })

  return <CertificateList certificates={certificates} />
}
```

### Client-Side Fetching

```typescript
'use client'

export function CertificateList() {
  const [certificates, setCertificates] = useState([])
  const [loading, setLoading] = useState(true)

  useEffect(() => {
    fetch('/api/certificates')
      .then(res => res.json())
      .then(data => {
        setCertificates(data.certificates)
        setLoading(false)
      })
  }, [])

  if (loading) return <Loading />
  return <Table data={certificates} />
}
```

### Revalidation

```typescript
// Revalidate cached data after mutation
import { revalidatePath, revalidateTag } from 'next/cache'

// In Server Action or API route
await prisma.certificate.update({ ... })
revalidatePath('/admin/certificates')  // Revalidate specific path
revalidateTag('certificates')           // Revalidate by tag
```

---

## Route Handlers (API Routes)

### Basic Handler

```typescript
// src/app/api/certificates/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const certificates = await prisma.certificate.findMany({
    where: { createdById: session.user.id }
  })

  return NextResponse.json({ certificates })
}

export async function POST(request: NextRequest) {
  const session = await auth()
  if (!session) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const body = await request.json()
  // Create certificate
}
```

### With Dynamic Parameters

```typescript
// src/app/api/certificates/[id]/route.ts
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const { id } = await params
  // Fetch by id
}
```
