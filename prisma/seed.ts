import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import bcrypt from 'bcryptjs'
import * as fs from 'fs'
import * as path from 'path'

// For Prisma 7, use the SQLite adapter with options
// The db is at ./dev.db (relative to where the command runs from)
const adapter = new PrismaBetterSqlite3({
  url: 'file:./dev.db',
})
const prisma = new PrismaClient({ adapter })

// Interface for master instruments JSON
interface MasterInstrumentJson {
  id: number
  type: string
  instrument_desc: string
  make: string | { ind?: string; sen?: string }
  model: string | { ind?: string; sen?: string }
  asset_no: string
  instrument_sl_no: string | { ind?: string; sen?: string }
  usage?: string
  calibrated_at?: string
  report_no?: string
  next_due_on?: string
  range?: Array<{ referencedoc?: string; range?: string }>
  remarks?: string
}

// Helper to serialize composite values (e.g., { ind: "X", sen: "Y" } -> "Ind: X / Sen: Y")
function serializeCompositeValue(value: string | { ind?: string; sen?: string } | undefined): string {
  if (!value) return ''
  if (typeof value === 'string') return value
  const parts: string[] = []
  if (value.ind) parts.push(`Ind: ${value.ind}`)
  if (value.sen) parts.push(`Sen: ${value.sen}`)
  return parts.join(' / ') || ''
}

// Parse date from MM/DD/YYYY format
function parseDate(dateStr: string | undefined): Date | null {
  if (!dateStr) return null
  const parts = dateStr.split('/')
  if (parts.length !== 3) return null
  const [month, day, year] = parts.map(Number)
  return new Date(year, month - 1, day)
}

async function main() {
  console.log('Seeding database...')

  // Create two HoD users
  const hodPassword = await bcrypt.hash('hod123', 12)

  const hod1 = await prisma.user.upsert({
    where: { email: 'kiran@htaipl.com' },
    update: {},
    create: {
      email: 'kiran@htaipl.com',
      name: 'Kiran Kumar',
      passwordHash: hodPassword,
      role: 'HOD',
      authProvider: 'PASSWORD',
      isActive: true,
    },
  })
  console.log('Created HoD 1:', hod1.email)

  const hod2 = await prisma.user.upsert({
    where: { email: 'rajesh@htaipl.com' },
    update: {},
    create: {
      email: 'rajesh@htaipl.com',
      name: 'Rajesh Sharma',
      passwordHash: hodPassword,
      role: 'HOD',
      authProvider: 'PASSWORD',
      isActive: true,
    },
  })
  console.log('Created HoD 2:', hod2.email)

  // Create Engineer users - each assigned to a different HoD
  const engineerPassword = await bcrypt.hash('engineer123', 12)

  const engineer1 = await prisma.user.upsert({
    where: { email: 'thiyagarajan@htaipl.com' },
    update: { assignedHodId: hod1.id },
    create: {
      email: 'thiyagarajan@htaipl.com',
      name: 'Thiyagarajan',
      passwordHash: engineerPassword,
      role: 'ENGINEER',
      authProvider: 'PASSWORD',
      assignedHodId: hod1.id,
      isActive: true,
    },
  })
  console.log('Created Engineer:', engineer1.email, '-> Reports to:', hod1.name)

  const engineer2 = await prisma.user.upsert({
    where: { email: 'chandrashekar@htaipl.com' },
    update: { assignedHodId: hod2.id },
    create: {
      email: 'chandrashekar@htaipl.com',
      name: 'Chandrashekar',
      passwordHash: engineerPassword,
      role: 'ENGINEER',
      authProvider: 'PASSWORD',
      assignedHodId: hod2.id,
      isActive: true,
    },
  })
  console.log('Created Engineer:', engineer2.email, '-> Reports to:', hod2.name)

  // Create Admin user
  const adminPassword = await bcrypt.hash('admin123', 12)
  const admin = await prisma.user.upsert({
    where: { email: 'admin@htaipl.com' },
    update: {},
    create: {
      email: 'admin@htaipl.com',
      name: 'Hemanth Kumar',
      passwordHash: adminPassword,
      role: 'ADMIN',
      authProvider: 'PASSWORD',
      isActive: true,
    },
  })
  console.log('Created Admin:', admin.email)

  // ==================
  // CUSTOMER ACCOUNTS
  // ==================
  console.log('\n--- Creating Customer Accounts ---')

  // Create sample customer accounts
  const customerAccount1 = await prisma.customerAccount.upsert({
    where: { companyName: 'Test Company Pvt Ltd' },
    update: {},
    create: {
      companyName: 'Test Company Pvt Ltd',
      address: '123 Test Street, Bangalore',
      contactEmail: 'contact@testcompany.com',
      contactPhone: '+91-9876543210',
      assignedHodId: hod1.id,
      isActive: true,
    },
  })
  console.log('Created Customer Account:', customerAccount1.companyName, '-> Assigned to:', hod1.name)

  const customerAccount2 = await prisma.customerAccount.upsert({
    where: { companyName: 'Beta Corporation' },
    update: {},
    create: {
      companyName: 'Beta Corporation',
      address: '456 Beta Avenue, Mumbai',
      contactEmail: 'info@betacorp.com',
      contactPhone: '+91-8765432109',
      assignedHodId: hod2.id,
      isActive: true,
    },
  })
  console.log('Created Customer Account:', customerAccount2.companyName, '-> Assigned to:', hod2.name)

  // Create Customer users linked to their accounts
  const customerPassword = await bcrypt.hash('customer123', 12)

  const customer1 = await prisma.customerUser.upsert({
    where: { email: 'customer@example.com' },
    update: { customerAccountId: customerAccount1.id },
    create: {
      email: 'customer@example.com',
      name: 'Test Customer',
      passwordHash: customerPassword,
      companyName: 'Test Company Pvt Ltd', // Kept for backward compatibility
      customerAccountId: customerAccount1.id,
      isActive: true,
    },
  })
  console.log('Created Customer:', customer1.email, '-> Account:', customerAccount1.companyName)

  const customer2 = await prisma.customerUser.upsert({
    where: { email: 'beta@betacorp.com' },
    update: { customerAccountId: customerAccount2.id },
    create: {
      email: 'beta@betacorp.com',
      name: 'Beta Customer User',
      passwordHash: customerPassword,
      companyName: 'Beta Corporation',
      customerAccountId: customerAccount2.id,
      isActive: true,
    },
  })
  console.log('Created Customer:', customer2.email, '-> Account:', customerAccount2.companyName)

  // ==================
  // GOOGLE OAUTH WHITELIST
  // ==================
  console.log('\n--- Creating Google OAuth Whitelist Entries ---')

  // Create sample AllowedGoogleEmail entries
  await prisma.allowedGoogleEmail.upsert({
    where: { email: '@htaipl.com' },
    update: {},
    create: {
      email: '@htaipl.com',
      type: 'DOMAIN',
      role: 'ENGINEER',
      hodId: hod1.id, // Default HoD for domain-based logins
      isActive: true,
      createdBy: admin.id,
    },
  })
  console.log('Created domain whitelist: @htaipl.com -> ENGINEER (default HoD: Kiran)')

  await prisma.allowedGoogleEmail.upsert({
    where: { email: 'admin@htaipl.com' },
    update: {},
    create: {
      email: 'admin@htaipl.com',
      type: 'EMAIL',
      role: 'ADMIN',
      name: 'Hemanth Kumar',
      isActive: true,
      createdBy: admin.id,
    },
  })
  console.log('Created email whitelist: admin@htaipl.com -> ADMIN')

  // ==================
  // MASTER INSTRUMENTS
  // ==================
  console.log('\n--- Migrating Master Instruments from JSON ---')

  // Check if instruments already exist (skip if already migrated)
  const existingInstruments = await prisma.masterInstrument.count()
  if (existingInstruments > 0) {
    console.log(`Skipping instrument migration - ${existingInstruments} instruments already exist`)
  } else {
    // Read master-instruments.json
    const jsonPath = path.join(__dirname, '../src/data/master-instruments.json')
    try {
      const jsonData = fs.readFileSync(jsonPath, 'utf-8')
      const instruments: MasterInstrumentJson[] = JSON.parse(jsonData)

      let successCount = 0
      let errorCount = 0

      for (const instrument of instruments) {
        try {
          const instrumentId = crypto.randomUUID()
          await prisma.masterInstrument.create({
            data: {
              instrumentId,
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
          console.error(`Failed to import instrument ${instrument.id} (${instrument.asset_no}):`, err)
        }
      }

      console.log(`Imported ${successCount} instruments (${errorCount} errors)`)
    } catch (err) {
      console.error('Failed to read master-instruments.json:', err)
    }
  }

  // ==================
  // MIGRATE EXISTING CUSTOMERS
  // ==================
  console.log('\n--- Migrating Existing Customer Users ---')

  // Find CustomerUsers without customerAccountId
  const orphanedCustomers = await prisma.customerUser.findMany({
    where: {
      customerAccountId: null,
      companyName: { not: null },
    },
  })

  if (orphanedCustomers.length > 0) {
    console.log(`Found ${orphanedCustomers.length} customers without account links`)

    for (const customer of orphanedCustomers) {
      if (!customer.companyName) continue

      // Find or create CustomerAccount for this company
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
        console.log(`Created account for: ${customer.companyName}`)
      }

      // Link customer to account
      await prisma.customerUser.update({
        where: { id: customer.id },
        data: { customerAccountId: account.id },
      })
      console.log(`Linked ${customer.email} to ${customer.companyName}`)
    }
  } else {
    console.log('All customers already have account links')
  }

  console.log('\n--- Test Credentials ---')
  console.log('Engineer 1: thiyagarajan@htaipl.com / engineer123 (Reports to Kiran)')
  console.log('Engineer 2: chandrashekar@htaipl.com / engineer123 (Reports to Rajesh)')
  console.log('HoD 1: kiran@htaipl.com / hod123 (Manages Thiyagarajan)')
  console.log('HoD 2: rajesh@htaipl.com / hod123 (Manages Chandrashekar)')
  console.log('Admin: admin@htaipl.com / admin123')
  console.log('Customer 1: customer@example.com / customer123 (Test Company Pvt Ltd)')
  console.log('Customer 2: beta@betacorp.com / customer123 (Beta Corporation)')
  console.log('------------------------\n')

  console.log('Seeding completed!')
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
