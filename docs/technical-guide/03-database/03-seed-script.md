# Seed Script Deep Dive

## File Location

```
prisma/seed.ts (390 lines)
```

This script populates the database with test data for development.

---

## How Seeding Works

```
npm run db:seed
       │
       ▼
package.json: "prisma": { "seed": "tsx prisma/seed.ts" }
       │
       ▼
tsx executes prisma/seed.ts
       │
       ▼
Connects to PostgreSQL via @prisma/adapter-pg
       │
       ▼
Creates test data via Prisma Client
```

---

## Full Seed Script Annotated

```typescript
// ═══════════════════════════════════════════════════════════════════════════
// IMPORTS
// ═══════════════════════════════════════════════════════════════════════════
import 'dotenv/config'  // Load .env file
import { PrismaClient } from '@prisma/client'
import bcrypt from 'bcryptjs'
import * as fs from 'fs'
import * as path from 'path'
import * as crypto from 'crypto'

// ═══════════════════════════════════════════════════════════════════════════
// DATABASE CONNECTION (PostgreSQL)
// ═══════════════════════════════════════════════════════════════════════════

import { PrismaPg } from '@prisma/adapter-pg'

const connectionString = process.env.DATABASE_URL ||
  'postgresql://hta_user:hta_dev_password@localhost:5432/hta_calibration'

const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

// ═══════════════════════════════════════════════════════════════════════════
// HELPER FUNCTIONS
// ═══════════════════════════════════════════════════════════════════════════

// For master instruments JSON - handles composite values like:
// { ind: "X", sen: "Y" } → "Ind: X / Sen: Y"
function serializeCompositeValue(
  value: string | { ind?: string; sen?: string } | undefined
): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  const parts: string[] = []
  if (value.ind) parts.push(`Ind: ${value.ind}`)
  if (value.sen) parts.push(`Sen: ${value.sen}`)
  return parts.join(' / ') || ''
}

// Parse MM/DD/YYYY format from JSON
function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null
  const parts = dateStr.split('/')
  if (parts.length !== 3) return null
  const [month, day, year] = parts.map(Number)
  return new Date(year, month - 1, day)
}

// ═══════════════════════════════════════════════════════════════════════════
// MAIN SEED FUNCTION
// ═══════════════════════════════════════════════════════════════════════════

async function main() {
  console.log('Seeding database...')

  // ─────────────────────────────────────────────────────────────────────────
  // 1. CREATE ADMIN USER
  // ─────────────────────────────────────────────────────────────────────────
  const adminPassword = await bcrypt.hash('admin123', 12)
  // Cost factor 12: ~300ms to hash, good security/performance balance

  const masterAdmin = await prisma.user.upsert({
    where: { email: 'admin@htaipl.com' },
    update: {},  // Don't overwrite if exists
    create: {
      email: 'admin@htaipl.com',
      name: 'Hemanth Kumar',
      passwordHash: adminPassword,
      role: 'ADMIN',
      adminType: 'MASTER',
      isAdmin: false,  // Legacy field
      authProvider: 'PASSWORD',
      isActive: true,
    },
  })
  console.log('Created MASTER Admin:', masterAdmin.email)

  // ─────────────────────────────────────────────────────────────────────────
  // 2. CREATE ENGINEER USERS
  // ─────────────────────────────────────────────────────────────────────────
  const engineerPassword = await bcrypt.hash('engineer123', 12)

  // All engineers report to the master admin
  const engineers = [
    { email: 'kiran@htaipl.com', name: 'Kiran Kumar' },
    { email: 'rajesh@htaipl.com', name: 'Rajesh Sharma' },
    { email: 'thiyagarajan@htaipl.com', name: 'Thiyagarajan' },
    { email: 'chandrashekar@htaipl.com', name: 'Chandrashekar' },
  ]

  for (const eng of engineers) {
    const user = await prisma.user.upsert({
      where: { email: eng.email },
      update: { assignedAdminId: masterAdmin.id },
      create: {
        email: eng.email,
        name: eng.name,
        passwordHash: engineerPassword,
        role: 'ENGINEER',
        authProvider: 'PASSWORD',
        assignedAdminId: masterAdmin.id,
        isActive: true,
      },
    })
    console.log('Created Engineer:', user.email)
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 3. CREATE CUSTOMER ACCOUNTS
  // ─────────────────────────────────────────────────────────────────────────
  const customerAccount1 = await prisma.customerAccount.upsert({
    where: { companyName: 'Test Company Pvt Ltd' },
    update: {},
    create: {
      companyName: 'Test Company Pvt Ltd',
      address: '123 Test Street, Bangalore',
      contactEmail: 'contact@testcompany.com',
      contactPhone: '+91-9876543210',
      assignedAdminId: masterAdmin.id,
      isActive: true,
    },
  })

  const customerAccount2 = await prisma.customerAccount.upsert({
    where: { companyName: 'Beta Corporation' },
    update: {},
    create: {
      companyName: 'Beta Corporation',
      address: '456 Beta Avenue, Mumbai',
      contactEmail: 'info@betacorp.com',
      contactPhone: '+91-8765432109',
      assignedAdminId: masterAdmin.id,
      isActive: true,
    },
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 4. CREATE CUSTOMER USERS (POCs)
  // ─────────────────────────────────────────────────────────────────────────
  const customerPassword = await bcrypt.hash('customer123', 12)

  const customer1 = await prisma.customerUser.upsert({
    where: { email: 'customer@example.com' },
    update: { customerAccountId: customerAccount1.id },
    create: {
      email: 'customer@example.com',
      name: 'Test Customer',
      passwordHash: customerPassword,
      companyName: 'Test Company Pvt Ltd',
      customerAccountId: customerAccount1.id,
      isActive: true,
      isPoc: true,
      activatedAt: new Date(),
    },
  })

  // Link as primary POC
  await prisma.customerAccount.update({
    where: { id: customerAccount1.id },
    data: { primaryPocId: customer1.id },
  })

  // Repeat for customer2...

  // ─────────────────────────────────────────────────────────────────────────
  // 5. CREATE GOOGLE OAUTH WHITELIST
  // ─────────────────────────────────────────────────────────────────────────
  await prisma.allowedGoogleEmail.upsert({
    where: { email: '@htaipl.com' },
    update: {},
    create: {
      email: '@htaipl.com',
      type: 'DOMAIN',  // Whole domain allowed
      role: 'ENGINEER',  // Default role for domain logins
      hodId: masterAdmin.id,
      isActive: true,
      createdBy: masterAdmin.id,
    },
  })

  await prisma.allowedGoogleEmail.upsert({
    where: { email: 'admin@htaipl.com' },
    update: {},
    create: {
      email: 'admin@htaipl.com',
      type: 'EMAIL',  // Specific email
      role: 'ADMIN',
      name: 'Hemanth Kumar',
      isActive: true,
      createdBy: masterAdmin.id,
    },
  })

  // ─────────────────────────────────────────────────────────────────────────
  // 6. IMPORT MASTER INSTRUMENTS FROM JSON
  // ─────────────────────────────────────────────────────────────────────────
  const existingInstruments = await prisma.masterInstrument.count()

  if (existingInstruments > 0) {
    console.log(`Skipping - ${existingInstruments} instruments already exist`)
  } else {
    const jsonPath = path.join(__dirname, '../src/data/master-instruments.json')
    try {
      const jsonData = fs.readFileSync(jsonPath, 'utf-8')
      const instruments = JSON.parse(jsonData)

      let successCount = 0
      let errorCount = 0

      for (const instrument of instruments) {
        try {
          await prisma.masterInstrument.create({
            data: {
              instrumentId: crypto.randomUUID(),  // UUID for versioning
              version: 1,
              isLatest: true,
              legacyId: instrument.id,
              category: instrument.type,
              description: instrument.instrument_desc,
              make: serializeCompositeValue(instrument.make),
              model: serializeCompositeValue(instrument.model),
              assetNumber: instrument.asset_no,
              serialNumber: serializeCompositeValue(instrument.instrument_sl_no),
              usage: instrument.usage || null,
              calibratedAtLocation: instrument.calibrated_at || null,
              reportNo: instrument.report_no || null,
              calibrationDueDate: parseDate(instrument.next_due_on),
              rangeData: instrument.range ? JSON.stringify(instrument.range) : null,
              remarks: instrument.remarks || null,
              isActive: true,
              importedFromJson: true,
              changeReason: 'Initial seed import',
            },
          })
          successCount++
        } catch (err) {
          errorCount++
          console.error(`Failed: ${instrument.asset_no}:`, err)
        }
      }

      console.log(`Imported ${successCount} instruments (${errorCount} errors)`)
    } catch (err) {
      console.error('Failed to read master-instruments.json:', err)
    }
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 7. MIGRATE ORPHANED CUSTOMERS (data cleanup)
  // ─────────────────────────────────────────────────────────────────────────
  const orphanedCustomers = await prisma.customerUser.findMany({
    where: {
      customerAccountId: null,
      companyName: { not: null },
    },
  })

  for (const customer of orphanedCustomers) {
    if (!customer.companyName) continue

    let account = await prisma.customerAccount.findUnique({
      where: { companyName: customer.companyName },
    })

    if (!account) {
      account = await prisma.customerAccount.create({
        data: {
          companyName: customer.companyName,
          contactEmail: customer.email,
          isActive: true,
        },
      })
    }

    await prisma.customerUser.update({
      where: { id: customer.id },
      data: { customerAccountId: account.id },
    })
  }

  // ─────────────────────────────────────────────────────────────────────────
  // 8. PRINT TEST CREDENTIALS
  // ─────────────────────────────────────────────────────────────────────────
  console.log('\n--- Test Credentials ---')
  console.log('MASTER Admin: admin@htaipl.com / admin123')
  console.log('Engineer: kiran@htaipl.com / engineer123')
  console.log('Customer: customer@example.com / customer123')
  console.log('------------------------\n')
}

// ═══════════════════════════════════════════════════════════════════════════
// EXECUTE
// ═══════════════════════════════════════════════════════════════════════════

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
```

---

## Running the Seed

### Local Development

```bash
# Start PostgreSQL (if not running)
npm run db:start

# Push schema and seed
npm run db:setup
npx prisma db seed
```

### Cloud SQL (Production/Staging)

```bash
# Start Cloud SQL Proxy
cloud-sql-proxy PROJECT:REGION:INSTANCE

# In another terminal
export DATABASE_URL="postgresql://hta_app:PASSWORD@127.0.0.1:5432/hta_calibration"

# Reset and seed (WARNING: destroys all data)
npx prisma db push --force-reset
npx prisma db seed

# Or just seed (keeps existing data, upserts)
npx prisma db seed
```

---

## Upsert Behavior

The seed uses `upsert` which:
- **If record exists** (by unique key): runs `update`
- **If record doesn't exist**: runs `create`

```typescript
await prisma.user.upsert({
  where: { email: 'admin@htaipl.com' },  // Lookup key
  update: {},                              // What to update (nothing)
  create: { /* full record */ },           // What to create
})
```

This makes the seed **idempotent** - running it multiple times won't create duplicates.

---

## Common Seed Failures

### Error: "Unique constraint failed"

```
Unique constraint failed on the constraint: `User_email_key`
```

**Cause**: Trying to create duplicate with different approach than upsert

**Fix**: Use upsert or delete first:
```typescript
// Option 1: Upsert
await prisma.user.upsert({ where: { email }, update: {}, create: {...} })

// Option 2: Delete first
await prisma.user.deleteMany({ where: { email } })
await prisma.user.create({ data: {...} })
```

---

### Error: "Foreign key constraint failed"

```
Foreign key constraint failed on the field: `assignedAdminId`
```

**Cause**: Trying to reference a user that doesn't exist yet

**Fix**: Create in correct order:
```typescript
// 1. Create admin first
const admin = await prisma.user.create({ data: { ... } })

// 2. Then create engineers with admin reference
await prisma.user.create({
  data: {
    ...
    assignedAdminId: admin.id,  // Now valid
  }
})
```

---

### Error: "Connection refused"

```
Error: connect ECONNREFUSED 127.0.0.1:5432
```

**Cause**: PostgreSQL is not running

**Fix**: Start PostgreSQL:
```bash
# Start local PostgreSQL via Docker Compose
npm run db:start

# Verify it's running
docker ps | grep postgres
```

---

### Error: "Cannot read file master-instruments.json"

```
ENOENT: no such file or directory, open '.../master-instruments.json'
```

**Cause**: JSON file missing or wrong path

**Fix**: Check file exists:
```bash
ls src/data/master-instruments.json
```

---

## Modifying the Seed

### Adding a New User

```typescript
// In main() function, after other users:
const newEngineer = await prisma.user.upsert({
  where: { email: 'newuser@htaipl.com' },
  update: { assignedAdminId: masterAdmin.id },
  create: {
    email: 'newuser@htaipl.com',
    name: 'New User',
    passwordHash: engineerPassword,  // Reuse from earlier
    role: 'ENGINEER',
    authProvider: 'PASSWORD',
    assignedAdminId: masterAdmin.id,
    isActive: true,
  },
})
console.log('Created:', newEngineer.email)
```

### Adding Test Certificates

```typescript
// Create a test certificate
const testCert = await prisma.certificate.upsert({
  where: { certificateNumber: 'TEST-001' },
  update: {},
  create: {
    certificateNumber: 'TEST-001',
    status: 'DRAFT',
    customerName: 'Test Company Pvt Ltd',
    uucDescription: 'Digital Multimeter',
    uucMake: 'Fluke',
    uucModel: '87V',
    createdById: engineer1.id,
    lastModifiedById: engineer1.id,
  },
})
```

---

## Seed Data Summary

After running seed, you have:

| Entity | Count | Details |
|--------|-------|---------|
| Users | 5 | 1 admin + 4 engineers |
| CustomerAccounts | 2 | Test Company, Beta Corp |
| CustomerUsers | 2 | 1 per account (POCs) |
| AllowedGoogleEmail | 2 | Domain + specific email |
| MasterInstruments | ~100+ | From JSON file |

---

## Test Credentials

| Type | Email | Password |
|------|-------|----------|
| Admin | admin@htaipl.com | admin123 |
| Engineer | kiran@htaipl.com | engineer123 |
| Engineer | rajesh@htaipl.com | engineer123 |
| Engineer | thiyagarajan@htaipl.com | engineer123 |
| Engineer | chandrashekar@htaipl.com | engineer123 |
| Customer | customer@example.com | customer123 |
| Customer | beta@betacorp.com | customer123 |
