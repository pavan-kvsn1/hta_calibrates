# Phase 3E: Multi-Tenancy Implementation

## Document Version
- **Version**: 1.0.0
- **Created**: 2026-03-17
- **Last Updated**: 2026-03-17
- **Phase**: 3 - Cloud Infrastructure
- **Status**: Not Started (0%)

---

## Learning Resources

Before implementing multi-tenancy, make sure you understand the underlying concepts:

| Topic | System Design Document | What You'll Learn |
|-------|------------------------|-------------------|
| **Multi-Tenancy Design** | [04_multi_tenancy.md](../../system_design/04_multi_tenancy.md) | Tenant models, isolation strategies, role hierarchy |
| **Database Architecture** | [05_database_architecture.md](../../system_design/05_database_architecture.md) | Row-Level Security, tenant_id patterns |
| **System Architecture** | [03_system_architecture.md](../../system_design/03_system_architecture.md) | Overall system with multi-tenancy |
| **Security** | [14_security.md](../../system_design/14_security.md) | Tenant isolation security |
| **Secrets Management** | [13_secrets_management.md](../../system_design/13_secrets_management.md) | Per-tenant secrets |

> **Tip**: If terms like "tenant isolation", "RLS", "Lab-Admin vs Dev-Admin" are unfamiliar, read `04_multi_tenancy.md` first!

---

## Overview

This document covers the implementation of multi-tenancy for the HTA Calibration system, including database isolation, application-level tenant context, file storage separation, and tenant provisioning workflows.

---

## Multi-Tenancy Architecture

```
+---------------------------------------------------------------------------+
|                         MULTI-TENANCY ARCHITECTURE                          |
+---------------------------------------------------------------------------+
|                                                                             |
|  ROLE HIERARCHY                                                             |
|  ==============                                                             |
|                                                                             |
|  SYSTEM LEVEL:                                                              |
|  +-----------------------------------------------------------------------+  |
|  |                                                                       |  |
|  |  DEV-ADMIN (Platform Operators)                                       |  |
|  |  - Manages infrastructure                                             |  |
|  |  - Provisions new tenants                                             |  |
|  |  - Access to all tenants (for support)                                |  |
|  |  - Manages system-level secrets                                       |  |
|  |                                                                       |  |
|  +-----------------------------------------------------------------------+  |
|                              |                                              |
|                              | Creates & Manages                            |
|                              v                                              |
|  TENANT LEVEL (Per Calibration Lab):                                        |
|  +-----------------------------------------------------------------------+  |
|  |                                                                       |  |
|  |  TENANT: HTA Calibration Lab                                          |  |
|  |  +----------------------------------------------------------------+  |  |
|  |  |                                                                |  |  |
|  |  |  LAB-ADMIN                                                     |  |  |
|  |  |  - Manages users within tenant                                 |  |  |
|  |  |  - Configures tenant settings                                  |  |  |
|  |  |  - Views all tenant data                                       |  |  |
|  |  |                                                                |  |  |
|  |  |  ENGINEER        REVIEWER        CUSTOMER                      |  |  |
|  |  |  - Creates       - Reviews       - Views own                   |  |  |
|  |  |    certificates    certificates    certificates               |  |  |
|  |  |  - Edits own     - Approves/     - Provides                    |  |  |
|  |  |    work            Rejects         feedback                    |  |  |
|  |  |                                                                |  |  |
|  |  +----------------------------------------------------------------+  |  |
|  |                                                                       |  |
|  |  TENANT: Precision Calibration Inc                                    |  |
|  |  +----------------------------------------------------------------+  |  |
|  |  | (Same structure, completely isolated data)                     |  |  |
|  |  +----------------------------------------------------------------+  |  |
|  |                                                                       |  |
|  +-----------------------------------------------------------------------+  |
|                                                                             |
+---------------------------------------------------------------------------+
```

---

## Database Multi-Tenancy

### Schema Design

```sql
-- Tenant table (system-level)
CREATE TABLE tenants (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    name VARCHAR(255) NOT NULL,
    slug VARCHAR(100) UNIQUE NOT NULL,  -- URL-friendly identifier
    domain VARCHAR(255),                 -- Custom domain (optional)
    settings JSONB DEFAULT '{}',         -- Tenant-specific settings
    subscription_tier VARCHAR(50) DEFAULT 'standard',
    is_active BOOLEAN DEFAULT true,
    created_at TIMESTAMP DEFAULT NOW(),
    updated_at TIMESTAMP DEFAULT NOW()
);

-- All tenant-scoped tables have tenant_id
CREATE TABLE users (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    email VARCHAR(255) NOT NULL,
    role VARCHAR(50) NOT NULL,
    -- ... other fields
    UNIQUE(tenant_id, email)  -- Email unique per tenant
);

CREATE TABLE certificates (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    certificate_number VARCHAR(100) NOT NULL,
    -- ... other fields
    UNIQUE(tenant_id, certificate_number)  -- Cert number unique per tenant
);

CREATE TABLE instruments (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    tenant_id UUID NOT NULL REFERENCES tenants(id),
    -- ... other fields
);

-- Create indexes on tenant_id for performance
CREATE INDEX idx_users_tenant ON users(tenant_id);
CREATE INDEX idx_certificates_tenant ON certificates(tenant_id);
CREATE INDEX idx_instruments_tenant ON instruments(tenant_id);
```

### Prisma Schema Updates

```prisma
// prisma/schema.prisma

model Tenant {
  id               String   @id @default(uuid())
  name             String
  slug             String   @unique
  domain           String?
  settings         Json     @default("{}")
  subscriptionTier String   @default("standard") @map("subscription_tier")
  isActive         Boolean  @default(true) @map("is_active")
  createdAt        DateTime @default(now()) @map("created_at")
  updatedAt        DateTime @updatedAt @map("updated_at")

  // Relations
  users        User[]
  certificates Certificate[]
  instruments  Instrument[]

  @@map("tenants")
}

model User {
  id        String   @id @default(uuid())
  tenantId  String   @map("tenant_id")
  email     String
  role      Role
  // ... other fields

  tenant    Tenant   @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, email])
  @@index([tenantId])
  @@map("users")
}

model Certificate {
  id                String   @id @default(uuid())
  tenantId          String   @map("tenant_id")
  certificateNumber String   @map("certificate_number")
  // ... other fields

  tenant    Tenant   @relation(fields: [tenantId], references: [id])

  @@unique([tenantId, certificateNumber])
  @@index([tenantId])
  @@map("certificates")
}
```

### Row-Level Security (PostgreSQL)

```sql
-- Enable RLS on all tenant-scoped tables
ALTER TABLE users ENABLE ROW LEVEL SECURITY;
ALTER TABLE certificates ENABLE ROW LEVEL SECURITY;
ALTER TABLE instruments ENABLE ROW LEVEL SECURITY;

-- Create policies
CREATE POLICY tenant_isolation ON users
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation ON certificates
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

CREATE POLICY tenant_isolation ON instruments
    USING (tenant_id = current_setting('app.tenant_id')::uuid);

-- Dev-Admin bypass policy (can see all tenants)
CREATE POLICY dev_admin_bypass ON users
    USING (current_setting('app.is_dev_admin', true)::boolean = true);

CREATE POLICY dev_admin_bypass ON certificates
    USING (current_setting('app.is_dev_admin', true)::boolean = true);

-- Function to set tenant context
CREATE OR REPLACE FUNCTION set_tenant_context(
    p_tenant_id uuid,
    p_is_dev_admin boolean DEFAULT false
) RETURNS void AS $$
BEGIN
    PERFORM set_config('app.tenant_id', p_tenant_id::text, true);
    PERFORM set_config('app.is_dev_admin', p_is_dev_admin::text, true);
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;
```

---

## Application-Level Implementation

### Tenant Context Middleware

```typescript
// src/middleware.ts
import { NextRequest, NextResponse } from 'next/server'
import { getToken } from 'next-auth/jwt'

export async function middleware(request: NextRequest) {
  const token = await getToken({ req: request })

  // Extract tenant from subdomain or path
  const hostname = request.headers.get('host') || ''
  const tenantSlug = extractTenantSlug(hostname)

  if (!tenantSlug) {
    return NextResponse.redirect(new URL('/select-tenant', request.url))
  }

  // Add tenant context to headers for downstream use
  const requestHeaders = new Headers(request.headers)
  requestHeaders.set('x-tenant-slug', tenantSlug)

  // Verify user belongs to this tenant
  if (token && token.tenantId) {
    const tenant = await getTenantBySlug(tenantSlug)
    if (tenant?.id !== token.tenantId) {
      return NextResponse.redirect(new URL('/unauthorized', request.url))
    }
  }

  return NextResponse.next({
    request: { headers: requestHeaders }
  })
}

function extractTenantSlug(hostname: string): string | null {
  // Pattern: {tenant}.hta-calibration.com
  const match = hostname.match(/^([^.]+)\.hta-calibration\.com$/)
  if (match) return match[1]

  // Pattern: {tenant}.localhost:3000 (development)
  const devMatch = hostname.match(/^([^.]+)\.localhost/)
  if (devMatch) return devMatch[1]

  return null
}
```

### Tenant-Aware Prisma Client

```typescript
// src/lib/prisma/tenant-client.ts
import { PrismaClient } from '@prisma/client'

const globalForPrisma = global as unknown as { prisma: PrismaClient }

export const prisma = globalForPrisma.prisma || new PrismaClient()

if (process.env.NODE_ENV !== 'production') globalForPrisma.prisma = prisma

// Create tenant-scoped client
export async function getTenantPrisma(tenantId: string, isDevAdmin = false) {
  // Set tenant context at database level
  await prisma.$executeRaw`SELECT set_tenant_context(${tenantId}::uuid, ${isDevAdmin})`

  // Return Prisma client with automatic tenant filtering
  return prisma.$extends({
    query: {
      $allModels: {
        async $allOperations({ model, operation, args, query }) {
          // For models with tenant_id, ensure it's set on create
          if (operation === 'create' && 'tenantId' in (args.data || {})) {
            args.data.tenantId = tenantId
          }

          // For models with tenant_id, add filter on read operations
          if (['findMany', 'findFirst', 'findUnique', 'count'].includes(operation)) {
            if (!isDevAdmin) {
              args.where = { ...args.where, tenantId }
            }
          }

          return query(args)
        }
      }
    }
  })
}
```

### API Route with Tenant Context

```typescript
// src/app/api/certificates/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getTenantPrisma } from '@/lib/prisma/tenant-client'
import { authOptions } from '@/lib/auth'

export async function GET(request: NextRequest) {
  const session = await getServerSession(authOptions)
  if (!session?.user) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const tenantId = session.user.tenantId
  const isDevAdmin = session.user.role === 'DEV_ADMIN'

  const prisma = await getTenantPrisma(tenantId, isDevAdmin)

  // This query is automatically scoped to the tenant
  const certificates = await prisma.certificate.findMany({
    orderBy: { createdAt: 'desc' },
    take: 50
  })

  return NextResponse.json(certificates)
}
```

---

## File Storage Isolation

### GCS Bucket Structure

```
+---------------------------------------------------------------------------+
|                         TENANT FILE STORAGE                                 |
+---------------------------------------------------------------------------+
|                                                                             |
|  BUCKET: hta-calibration-files-prod                                         |
|                                                                             |
|  /tenants/                                                                  |
|    /{tenant-id}/                                                            |
|      /certificates/                                                         |
|        /{cert-id}/                                                          |
|          /certificate.pdf                                                   |
|          /attachments/                                                      |
|      /signatures/                                                           |
|        /{user-id}/                                                          |
|          /signature.png                                                     |
|      /stamps/                                                               |
|        /company-stamp.png                                                   |
|      /logos/                                                                |
|        /company-logo.png                                                    |
|                                                                             |
|  ACCESS CONTROL:                                                            |
|  - All files under /tenants/{tenant-id}/ only accessible by that tenant     |
|  - Enforced via signed URLs generated with tenant context                   |
|  - Application validates tenant before generating signed URL                |
|                                                                             |
+---------------------------------------------------------------------------+
```

### Tenant-Scoped File Upload

```typescript
// src/lib/storage/tenant-storage.ts
import { Storage } from '@google-cloud/storage'

const storage = new Storage()
const bucket = storage.bucket(process.env.GCS_BUCKET_NAME!)

export async function uploadTenantFile(
  tenantId: string,
  path: string,
  file: Buffer,
  contentType: string
) {
  const fullPath = `tenants/${tenantId}/${path}`
  const blob = bucket.file(fullPath)

  await blob.save(file, {
    contentType,
    metadata: {
      tenantId,
      uploadedAt: new Date().toISOString()
    }
  })

  return fullPath
}

export async function getTenantFileSignedUrl(
  tenantId: string,
  path: string,
  expiresInMinutes = 15
) {
  // Validate path belongs to tenant
  const expectedPrefix = `tenants/${tenantId}/`
  if (!path.startsWith(expectedPrefix)) {
    throw new Error('Access denied: File does not belong to tenant')
  }

  const [url] = await bucket.file(path).getSignedUrl({
    version: 'v4',
    action: 'read',
    expires: Date.now() + expiresInMinutes * 60 * 1000
  })

  return url
}

export async function deleteTenantFile(tenantId: string, path: string) {
  const expectedPrefix = `tenants/${tenantId}/`
  if (!path.startsWith(expectedPrefix)) {
    throw new Error('Access denied: File does not belong to tenant')
  }

  await bucket.file(path).delete()
}
```

---

## Tenant Provisioning

### Provisioning Workflow

```
+---------------------------------------------------------------------------+
|                         TENANT PROVISIONING FLOW                            |
+---------------------------------------------------------------------------+
|                                                                             |
|  1. Dev-Admin initiates new tenant creation                                 |
|                    |                                                        |
|                    v                                                        |
|  2. System creates tenant record                                            |
|     - Generates UUID                                                        |
|     - Creates slug from name                                                |
|     - Sets default settings                                                 |
|                    |                                                        |
|                    v                                                        |
|  3. System creates initial Lab-Admin user                                   |
|     - Generates temporary password                                          |
|     - Sends activation email                                                |
|                    |                                                        |
|                    v                                                        |
|  4. System creates GCS folder structure                                     |
|     - /tenants/{tenant-id}/certificates/                                    |
|     - /tenants/{tenant-id}/signatures/                                      |
|     - /tenants/{tenant-id}/stamps/                                          |
|                    |                                                        |
|                    v                                                        |
|  5. DNS record created (if subdomain)                                       |
|     - {slug}.hta-calibration.com                                            |
|                    |                                                        |
|                    v                                                        |
|  6. Lab-Admin activates account and sets password                           |
|                    |                                                        |
|                    v                                                        |
|  7. Lab-Admin configures tenant settings                                    |
|     - Company info, logo, stamp                                             |
|     - Certificate templates                                                 |
|     - User management                                                       |
|                                                                             |
+---------------------------------------------------------------------------+
```

### Provisioning API

```typescript
// src/app/api/admin/tenants/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { prisma } from '@/lib/prisma'
import { createTenantStorage } from '@/lib/storage/tenant-storage'
import { sendActivationEmail } from '@/lib/email'
import { generateSlug, generateTemporaryPassword } from '@/lib/utils'

export async function POST(request: NextRequest) {
  const session = await getServerSession()

  // Only Dev-Admin can create tenants
  if (session?.user?.role !== 'DEV_ADMIN') {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const body = await request.json()
  const { name, adminEmail, adminName } = body

  // Create tenant
  const tenant = await prisma.tenant.create({
    data: {
      name,
      slug: generateSlug(name),
      settings: {
        timezone: 'Asia/Singapore',
        dateFormat: 'DD/MM/YYYY',
        certificatePrefix: generateSlug(name).toUpperCase().slice(0, 3)
      }
    }
  })

  // Create Lab-Admin user
  const tempPassword = generateTemporaryPassword()
  const admin = await prisma.user.create({
    data: {
      tenantId: tenant.id,
      email: adminEmail,
      name: adminName,
      role: 'LAB_ADMIN',
      passwordHash: await hashPassword(tempPassword),
      mustChangePassword: true
    }
  })

  // Create storage folders
  await createTenantStorage(tenant.id)

  // Send activation email
  await sendActivationEmail({
    to: adminEmail,
    tenantName: name,
    tenantSlug: tenant.slug,
    temporaryPassword: tempPassword
  })

  return NextResponse.json({
    tenant: {
      id: tenant.id,
      name: tenant.name,
      slug: tenant.slug
    },
    admin: {
      id: admin.id,
      email: admin.email
    }
  })
}
```

---

## Tenant Settings & Customization

### Tenant Settings Schema

```typescript
// src/types/tenant-settings.ts
interface TenantSettings {
  // Branding
  companyName: string
  logoUrl?: string
  stampUrl?: string
  primaryColor?: string

  // Localization
  timezone: string
  dateFormat: string
  numberFormat: string

  // Certificate Configuration
  certificatePrefix: string
  certificateNumberFormat: string  // e.g., "{PREFIX}-{YEAR}-{SEQ:4}"
  defaultValidityDays: number

  // Workflow Settings
  requireReviewerApproval: boolean
  requireCustomerApproval: boolean
  autoArchiveDays: number

  // Notifications
  emailNotifications: boolean
  webhookUrl?: string
  webhookSecret?: string

  // Limits (based on subscription tier)
  maxUsers: number
  maxCertificatesPerMonth: number
  storageQuotaGB: number
}
```

### Settings API

```typescript
// src/app/api/tenant/settings/route.ts
import { NextRequest, NextResponse } from 'next/server'
import { getServerSession } from 'next-auth'
import { getTenantPrisma } from '@/lib/prisma/tenant-client'

export async function GET(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user || !['LAB_ADMIN', 'DEV_ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const prisma = await getTenantPrisma(session.user.tenantId)
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId },
    select: { settings: true }
  })

  return NextResponse.json(tenant?.settings || {})
}

export async function PATCH(request: NextRequest) {
  const session = await getServerSession()
  if (!session?.user || !['LAB_ADMIN', 'DEV_ADMIN'].includes(session.user.role)) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const updates = await request.json()

  // Validate settings based on subscription tier
  const tenant = await prisma.tenant.findUnique({
    where: { id: session.user.tenantId }
  })

  const validatedSettings = validateSettings(updates, tenant?.subscriptionTier)

  const updated = await prisma.tenant.update({
    where: { id: session.user.tenantId },
    data: {
      settings: {
        ...tenant?.settings,
        ...validatedSettings
      }
    }
  })

  return NextResponse.json(updated.settings)
}
```

---

## Implementation Checklist

### Prerequisites
- [ ] Multi-tenancy design approved
- [ ] Database schema designed
- [ ] Role hierarchy defined

### Phase 1: Database Setup
- [ ] Add tenant table to schema
- [ ] Add tenant_id to all tenant-scoped tables
- [ ] Create Prisma migration
- [ ] Apply migration to all environments
- [ ] Add indexes on tenant_id columns

### Phase 2: Row-Level Security
- [ ] Enable RLS on tenant tables
- [ ] Create tenant isolation policies
- [ ] Create Dev-Admin bypass policy
- [ ] Create set_tenant_context function
- [ ] Test RLS policies

### Phase 3: Application Layer
- [ ] Create tenant context middleware
- [ ] Create tenant-aware Prisma client
- [ ] Update all API routes to use tenant context
- [ ] Update authentication to include tenantId

### Phase 4: File Storage
- [ ] Create tenant folder structure
- [ ] Implement tenant-scoped upload/download
- [ ] Update existing file operations
- [ ] Test file isolation

### Phase 5: Tenant Provisioning
- [ ] Create provisioning API
- [ ] Create provisioning UI for Dev-Admin
- [ ] Implement activation email flow
- [ ] Test full provisioning workflow

### Phase 6: Settings & Customization
- [ ] Define settings schema
- [ ] Create settings API
- [ ] Create settings UI for Lab-Admin
- [ ] Implement per-tenant customization

---

## Related Documents

- [Overview](./00_scaleup_overview.md)
- [Database Setup](./06_database_setup.md)
- [DNS & Domains](./07_dns_ssl_domains.md)
- [Secrets Implementation](./08_secrets_implementation.md)
- [Security Implementation](./09_security_implementation.md)
