/**
 * Backfill script to populate customerContactEmail for existing certificates
 *
 * This script:
 * 1. Finds all certificates with customerContactName but no customerContactEmail
 * 2. Looks up the email from CustomerUser based on name and company
 * 3. Updates the certificate with the found email
 *
 * Run with: npx tsx scripts/backfill-customer-contact-email.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import { Pool } from 'pg'

// Create PostgreSQL adapter (same as src/lib/prisma.ts)
const connectionString = process.env.DATABASE_URL || 'postgresql://hta_user:hta_dev_password@localhost:5432/hta_calibration'
const pool = new Pool({ connectionString })
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const adapter = new PrismaPg(pool as any)

const prisma = new PrismaClient({ adapter })

async function backfillCustomerContactEmail() {
  console.log('Starting backfill of customerContactEmail...\n')

  // Find all certificates with customerContactName but no customerContactEmail (null or empty string)
  const certificates = await prisma.certificate.findMany({
    where: {
      customerContactName: { not: null },
      OR: [
        { customerContactEmail: null },
        { customerContactEmail: '' },
      ],
    },
    select: {
      id: true,
      certificateNumber: true,
      customerName: true,
      customerContactName: true,
    },
  })

  console.log(`Found ${certificates.length} certificates to process\n`)

  let updated = 0
  let notFound = 0
  let errors = 0

  for (const cert of certificates) {
    try {
      // Skip if no company name
      if (!cert.customerName) {
        console.log(`[SKIP] ${cert.certificateNumber}: No customer name`)
        notFound++
        continue
      }

      // Look up CustomerUser by name and company
      const customerUser = await prisma.customerUser.findFirst({
        where: {
          name: cert.customerContactName!,
          customerAccount: {
            companyName: cert.customerName,
          },
        },
        select: {
          id: true,
          name: true,
          email: true,
        },
      })

      if (!customerUser) {
        console.log(`[NOT FOUND] ${cert.certificateNumber}: No matching CustomerUser for "${cert.customerContactName}" at "${cert.customerName}"`)
        notFound++
        continue
      }

      if (!customerUser.email) {
        console.log(`[NO EMAIL] ${cert.certificateNumber}: CustomerUser "${customerUser.name}" has no email`)
        notFound++
        continue
      }

      // Update the certificate with the email
      await prisma.certificate.update({
        where: { id: cert.id },
        data: { customerContactEmail: customerUser.email },
      })

      console.log(`[UPDATED] ${cert.certificateNumber}: Set email to "${customerUser.email}"`)
      updated++
    } catch (error) {
      console.error(`[ERROR] ${cert.certificateNumber}: ${error}`)
      errors++
    }
  }

  console.log('\n--- Summary ---')
  console.log(`Total processed: ${certificates.length}`)
  console.log(`Updated: ${updated}`)
  console.log(`Not found/skipped: ${notFound}`)
  console.log(`Errors: ${errors}`)
}

backfillCustomerContactEmail()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
