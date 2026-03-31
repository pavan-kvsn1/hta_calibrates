# Role-Based Access Control

## Overview

HTA Calibration implements role-based access control (RBAC) with multiple user types and permission levels.

---

## User Roles

### Staff Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `ADMIN` (MASTER) | Full system access, customer management | Highest |
| `ADMIN` (WORKER) | Authorization, certificate approval | High |
| `ENGINEER` | Create certificates, submit for review | Standard |

### Customer Roles

| Role | Description | Access Level |
|------|-------------|--------------|
| `CUSTOMER` (Primary POC) | Full company access, manage users | Company admin |
| `CUSTOMER` | View certificates, approve/reject | Standard |

---

## Role Hierarchy

```
┌─────────────────────────────────────────────────────────────────┐
│                      ROLE HIERARCHY                              │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│                    ┌────────────────────┐                       │
│                    │   MASTER ADMIN     │                       │
│                    │   (Super Admin)    │                       │
│                    │                    │                       │
│                    │ • All permissions  │                       │
│                    │ • Manage customers │                       │
│                    │ • Manage workers   │                       │
│                    └─────────┬──────────┘                       │
│                              │                                   │
│              ┌───────────────┴───────────────┐                  │
│              │                               │                  │
│              ▼                               ▼                  │
│    ┌──────────────────┐           ┌──────────────────┐         │
│    │   WORKER ADMIN   │           │   PRIMARY POC    │         │
│    │                  │           │   (Customer)     │         │
│    │ • Authorization  │           │                  │         │
│    │ • Cert approval  │           │ • Company certs  │         │
│    │ • User view      │           │ • Manage users   │         │
│    └────────┬─────────┘           └────────┬─────────┘         │
│             │                               │                   │
│             ▼                               ▼                   │
│    ┌──────────────────┐           ┌──────────────────┐         │
│    │    ENGINEER      │           │ CUSTOMER USER    │         │
│    │                  │           │                  │         │
│    │ • Own certs      │           │ • View certs     │         │
│    │ • Submit review  │           │ • Approve/reject │         │
│    │ • Assigned review│           │                  │         │
│    └──────────────────┘           └──────────────────┘         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Auth Helper Functions

```typescript
// src/lib/auth.ts

import type { User } from 'next-auth'

// Check if user has specific role
export function hasRole(user: User | undefined, allowedRoles: string[]): boolean {
  if (!user) return false
  return allowedRoles.includes(user.role)
}

// Check if user can access admin panel
export function canAccessAdmin(user: User | undefined): boolean {
  return user?.role === 'ADMIN'
}

// Alias for canAccessAdmin
export function isAdmin(user: User | undefined): boolean {
  return canAccessAdmin(user)
}

// Check if user is Master Admin
export function isMasterAdmin(user: User | undefined): boolean {
  return user?.role === 'ADMIN' && user?.adminType === 'MASTER'
}

// Check if user is Worker Admin
export function isWorkerAdmin(user: User | undefined): boolean {
  return user?.role === 'ADMIN' && user?.adminType === 'WORKER'
}

// Check if user can review a certificate
export function canReviewCertificate(
  user: User | undefined,
  certificate: { reviewerId: string | null }
): boolean {
  if (!user) return false
  // Admins can review any certificate
  if (user.role === 'ADMIN') return true
  // Engineers can only review assigned certificates
  return certificate.reviewerId === user.id
}

// Check if user is certificate creator
export function isAssignee(
  user: User | undefined,
  certificate: { createdById: string }
): boolean {
  if (!user) return false
  return certificate.createdById === user.id
}

// Check if user is assigned reviewer
export function isReviewer(
  user: User | undefined,
  certificate: { reviewerId: string | null }
): boolean {
  if (!user) return false
  return certificate.reviewerId === user.id
}

// Check chat thread access
export function canAccessChatThread(
  user: User | undefined,
  certificate: { createdById: string; reviewerId: string | null },
  threadType: 'ASSIGNEE_REVIEWER' | 'REVIEWER_CUSTOMER'
): boolean {
  if (!user) return false

  switch (threadType) {
    case 'ASSIGNEE_REVIEWER':
      return certificate.createdById === user.id ||
             certificate.reviewerId === user.id
    case 'REVIEWER_CUSTOMER':
      return certificate.reviewerId === user.id ||
             user.role === 'CUSTOMER'
    default:
      return false
  }
}
```

---

## Using Permissions in API Routes

### Basic Role Check

```typescript
// src/app/api/admin/users/route.ts
import { auth, canAccessAdmin } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await auth()

  // Must be authenticated
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  // Must be admin
  if (!canAccessAdmin(session.user)) {
    return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
  }

  // Proceed with admin operation
  const users = await prisma.user.findMany()
  return NextResponse.json(users)
}
```

### Master Admin Only

```typescript
// src/app/api/admin/customers/route.ts
import { auth, isMasterAdmin } from '@/lib/auth'

export async function POST(request: NextRequest) {
  const session = await auth()

  if (!isMasterAdmin(session?.user)) {
    return NextResponse.json(
      { error: 'Forbidden - Master Admin required' },
      { status: 403 }
    )
  }

  // Only Master Admin can create customers
  const customer = await prisma.customerAccount.create({ ... })
  return NextResponse.json(customer)
}
```

### Resource-Level Permission

```typescript
// src/app/api/certificates/[id]/route.ts
export async function PUT(request: NextRequest, context: RouteContext) {
  const session = await auth()
  const { id } = await context.params

  const certificate = await prisma.certificate.findUnique({
    where: { id }
  })

  if (!certificate) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  // Only creator or admin can edit
  const isCreator = certificate.createdById === session.user.id
  const isAdmin = session.user.role === 'ADMIN'

  if (!isCreator && !isAdmin) {
    return NextResponse.json(
      { error: 'You cannot edit this certificate' },
      { status: 403 }
    )
  }

  // Proceed with update
}
```

### Multi-Role Access

```typescript
// src/app/api/certificates/[id]/uuc-images/[imageId]/route.ts
export async function DELETE(request: NextRequest, context: RouteContext) {
  const session = await auth()
  const { id, imageId } = await context.params

  const image = await prisma.uucImage.findUnique({
    where: { id: imageId },
    include: { certificate: true }
  })

  // Check multiple access paths
  const isCreator = image.certificate.createdById === session.user.id
  const isReviewer = image.certificate.reviewerId === session.user.id
  const isAdmin = session.user.role === 'ADMIN'

  if (!isCreator && !isReviewer && !isAdmin) {
    return NextResponse.json(
      { error: 'Access denied' },
      { status: 403 }
    )
  }

  // Proceed with delete
}
```

---

## Using Permissions in Components

### Server Component

```typescript
// src/app/admin/page.tsx
import { auth, canAccessAdmin, isMasterAdmin } from '@/lib/auth'
import { redirect } from 'next/navigation'

export default async function AdminPage() {
  const session = await auth()

  if (!canAccessAdmin(session?.user)) {
    redirect('/dashboard')
  }

  const showCustomerManagement = isMasterAdmin(session?.user)

  return (
    <div>
      <h1>Admin Dashboard</h1>

      <nav>
        <Link href="/admin/users">Users</Link>
        <Link href="/admin/certificates">Certificates</Link>

        {showCustomerManagement && (
          <>
            <Link href="/admin/customers">Customers</Link>
            <Link href="/admin/registrations">Registrations</Link>
          </>
        )}
      </nav>
    </div>
  )
}
```

### Client Component

```typescript
'use client'

import { useSession } from 'next-auth/react'

export function AdminMenu() {
  const { data: session } = useSession()

  const isAdmin = session?.user?.role === 'ADMIN'
  const isMaster = session?.user?.adminType === 'MASTER'

  if (!isAdmin) return null

  return (
    <div>
      <MenuItem href="/admin/users">Users</MenuItem>
      <MenuItem href="/admin/certificates">Certificates</MenuItem>

      {isMaster && (
        <MenuItem href="/admin/customers">Customers</MenuItem>
      )}
    </div>
  )
}
```

---

## Permission Matrix

### Staff Permissions

| Action | Engineer | Worker Admin | Master Admin |
|--------|----------|--------------|--------------|
| View own certificates | ✓ | ✓ | ✓ |
| Create certificates | ✓ | ✓ | ✓ |
| Edit own certificates | ✓ | ✓ | ✓ |
| Submit for review | ✓ | ✓ | ✓ |
| Review assigned certs | ✓ | ✓ | ✓ |
| Review any cert | ✗ | ✓ | ✓ |
| Authorize certs | ✗ | ✓ | ✓ |
| View all users | ✗ | ✓ | ✓ |
| Create users | ✗ | ✗ | ✓ |
| Edit users | ✗ | ✗ | ✓ |
| Manage customers | ✗ | ✗ | ✓ |
| Approve registrations | ✗ | ✗ | ✓ |

### Customer Permissions

| Action | Customer | Primary POC |
|--------|----------|-------------|
| View company certs | ✓ | ✓ |
| Approve/reject certs | ✓ | ✓ |
| Request user addition | ✓ | ✓ |
| Manage company users | ✗ | ✓ |
| Change POC | ✗ | ✓ |

---

## Certificate State Permissions

```
┌─────────────────────────────────────────────────────────────────┐
│              WHO CAN DO WHAT IN EACH STATE                       │
├─────────────────────────────────────────────────────────────────┤
│                                                                  │
│  DRAFT                                                           │
│  ├── Edit: Creator, Admin                                       │
│  ├── Delete: Creator, Admin                                     │
│  └── Submit: Creator                                            │
│                                                                  │
│  IN_REVIEW                                                       │
│  ├── View: Creator, Reviewer, Admin                             │
│  ├── Approve: Assigned Reviewer, Admin                          │
│  ├── Request Revision: Assigned Reviewer, Admin                 │
│  └── Reject: Assigned Reviewer, Admin                           │
│                                                                  │
│  APPROVED                                                        │
│  ├── View: Creator, Reviewer, Admin                             │
│  └── Send to Customer: Reviewer, Admin                          │
│                                                                  │
│  SENT_TO_CUSTOMER                                                │
│  ├── View: Creator, Reviewer, Admin, Customer                   │
│  ├── Approve: Customer                                          │
│  └── Reject: Customer                                           │
│                                                                  │
│  CUSTOMER_APPROVED                                               │
│  ├── View: All stakeholders                                     │
│  └── Authorize: Admin only                                      │
│                                                                  │
│  ADMIN_AUTHORIZED                                                │
│  └── View: All stakeholders (read-only)                         │
│                                                                  │
└─────────────────────────────────────────────────────────────────┘
```

---

## Database Schema for Roles

```prisma
// prisma/schema.prisma

model User {
  id            String   @id @default(cuid())
  email         String   @unique
  name          String
  role          String   @default("ENGINEER")  // ADMIN, ENGINEER
  isAdmin       Boolean  @default(false)
  adminType     String?  // MASTER, WORKER (only for ADMIN role)
  isActive      Boolean  @default(true)
  assignedAdminId String?  // For engineers assigned to specific admin

  // Relations
  assignedAdmin User?    @relation("EngineerAdmin", fields: [assignedAdminId], references: [id])
  engineers     User[]   @relation("EngineerAdmin")
}

model CustomerUser {
  id                String   @id @default(cuid())
  email             String   @unique
  name              String
  customerAccountId String
  isPrimaryPoc      Boolean  @default(false)
  isActive          Boolean  @default(true)

  // Relations
  customerAccount CustomerAccount @relation(fields: [customerAccountId], references: [id])
}
```
