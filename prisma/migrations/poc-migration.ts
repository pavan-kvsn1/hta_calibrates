/**
 * POC Migration Script
 *
 * This script performs the following data migrations:
 * 1. Sets the first user of each CustomerAccount as the POC (Decision #1)
 * 2. Deletes all pending CustomerRegistrations (Decision #2)
 * 3. Sets existing CustomerUsers to isActive=true (since they existed before POC workflow)
 *
 * Run with: npx tsx prisma/migrations/poc-migration.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'

// Create adapter for Prisma 7 (matching project setup)
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
})

const prisma = new PrismaClient({ adapter })

async function main() {
  console.log('Starting POC migration...\n')

  // Step 1: Set existing CustomerUsers to isActive=true and set first user as POC
  console.log('Step 1: Setting up POCs for existing customer accounts...')

  const accounts = await prisma.customerAccount.findMany({
    include: {
      users: {
        orderBy: { createdAt: 'asc' }
      }
    }
  })

  let pocCount = 0
  let userActivatedCount = 0

  for (const account of accounts) {
    if (account.users.length > 0) {
      const firstUser = account.users[0]

      // Set first user as POC
      await prisma.customerUser.update({
        where: { id: firstUser.id },
        data: {
          isPoc: true,
          isActive: true,  // Activate since they existed before POC workflow
          activatedAt: firstUser.createdAt  // Use creation date as activation date
        }
      })

      // Update account's primaryPocId
      await prisma.customerAccount.update({
        where: { id: account.id },
        data: { primaryPocId: firstUser.id }
      })

      pocCount++
      console.log(`  - ${account.companyName}: POC set to ${firstUser.name} (${firstUser.email})`)

      // Activate other users in the account
      for (let i = 1; i < account.users.length; i++) {
        const user = account.users[i]
        await prisma.customerUser.update({
          where: { id: user.id },
          data: {
            isActive: true,
            activatedAt: user.createdAt
          }
        })
        userActivatedCount++
      }
    } else {
      console.log(`  - ${account.companyName}: No users, skipping POC assignment`)
    }
  }

  console.log(`\n  POCs assigned: ${pocCount}`)
  console.log(`  Other users activated: ${userActivatedCount}`)

  // Step 2: Delete pending registrations
  console.log('\nStep 2: Deleting pending customer registrations...')

  const pendingRegs = await prisma.customerRegistration.findMany({
    where: { status: 'PENDING' }
  })

  if (pendingRegs.length > 0) {
    console.log(`  Found ${pendingRegs.length} pending registrations:`)
    for (const reg of pendingRegs) {
      console.log(`    - ${reg.name} (${reg.email})`)
    }

    const deleteResult = await prisma.customerRegistration.deleteMany({
      where: { status: 'PENDING' }
    })

    console.log(`  Deleted ${deleteResult.count} pending registrations`)
  } else {
    console.log('  No pending registrations found')
  }

  // Summary
  console.log('\n=== Migration Complete ===')
  console.log(`Total accounts processed: ${accounts.length}`)
  console.log(`POCs assigned: ${pocCount}`)
  console.log(`Users activated: ${pocCount + userActivatedCount}`)
  console.log(`Pending registrations deleted: ${pendingRegs.length}`)
}

main()
  .catch((e) => {
    console.error('Migration failed:', e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
