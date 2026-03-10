/**
 * Script to manually fix certificate status and send to customer
 * Run with: npx tsx scripts/fix-cert-status.ts
 */

import { PrismaClient } from '@prisma/client'
import { PrismaBetterSqlite3 } from '@prisma/adapter-better-sqlite3'
import crypto from 'crypto'

// Create adapter for Prisma 7 (same as src/lib/prisma.ts)
const adapter = new PrismaBetterSqlite3({
  url: process.env.DATABASE_URL || 'file:./dev.db',
})

const prisma = new PrismaClient({
  adapter,
  log: ['error', 'warn'],
})

const CERTIFICATE_ID = '601751cb-e89b-4a7c-aa0a-6aba98fb721f'
const CUSTOMER_EMAIL = 'customer@example.com'
const CUSTOMER_NAME = 'Test Customer'

async function main() {
  console.log('Starting certificate fix...\n')

  // 1. Get the certificate
  const certificate = await prisma.certificate.findUnique({
    where: { id: CERTIFICATE_ID },
    include: {
      reviewer: { select: { id: true, name: true, email: true } },
    },
  })

  if (!certificate) {
    console.error('Certificate not found!')
    return
  }

  console.log('Certificate found:')
  console.log(`  - Number: ${certificate.certificateNumber}`)
  console.log(`  - Current Status: ${certificate.status}`)
  console.log(`  - Customer Name: ${certificate.customerName}`)
  console.log(`  - Reviewer: ${certificate.reviewer?.name || 'None'}\n`)

  // 2. Find or create the customer user
  let customer = await prisma.customerUser.findUnique({
    where: { email: CUSTOMER_EMAIL },
  })

  if (!customer) {
    console.log(`Creating new customer user: ${CUSTOMER_EMAIL}`)
    const tempPasswordHash = crypto.randomBytes(32).toString('hex')
    customer = await prisma.customerUser.create({
      data: {
        email: CUSTOMER_EMAIL,
        name: CUSTOMER_NAME,
        passwordHash: tempPasswordHash,
        companyName: certificate.customerName || 'Test Company',
        isActive: true,
      },
    })
    console.log(`  - Created customer ID: ${customer.id}\n`)
  } else {
    console.log(`Found existing customer: ${customer.name} (${customer.email})\n`)
  }

  // 3. Get next event sequence number
  const lastEvent = await prisma.certificateEvent.findFirst({
    where: { certificateId: CERTIFICATE_ID },
    orderBy: { sequenceNumber: 'desc' },
  })
  const nextSequence = (lastEvent?.sequenceNumber ?? 0) + 1

  // 4. Create approval token
  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days
  const token = crypto.randomUUID()

  console.log('Creating approval token...')
  const approvalToken = await prisma.approvalToken.create({
    data: {
      token,
      certificateId: CERTIFICATE_ID,
      customerId: customer.id,
      expiresAt,
    },
  })
  console.log(`  - Token: ${token}`)
  console.log(`  - Expires: ${expiresAt.toISOString()}\n`)

  // 5. Update certificate status and create event
  console.log('Updating certificate status and creating event...')

  await prisma.$transaction(async (tx) => {
    // Update certificate status
    await tx.certificate.update({
      where: { id: CERTIFICATE_ID },
      data: {
        status: 'PENDING_CUSTOMER_APPROVAL',
      },
    })

    // Create SENT_TO_CUSTOMER event
    await tx.certificateEvent.create({
      data: {
        certificateId: CERTIFICATE_ID,
        sequenceNumber: nextSequence,
        revision: certificate.currentRevision,
        eventType: 'SENT_TO_CUSTOMER',
        eventData: JSON.stringify({
          customerEmail: CUSTOMER_EMAIL,
          customerName: CUSTOMER_NAME,
          message: 'Certificate sent for customer approval (manual fix)',
          tokenId: approvalToken.id,
          expiresAt: expiresAt.toISOString(),
          sentBy: certificate.reviewer?.name || 'System',
          manualFix: true,
        }),
        userId: certificate.reviewerId,
        userRole: 'ENGINEER',
      },
    })
  })

  console.log('  - Status updated to: PENDING_CUSTOMER_APPROVAL')
  console.log('  - SENT_TO_CUSTOMER event created\n')

  // 6. Output the review URL
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'
  const reviewUrl = `${baseUrl}/customer/review/${token}`

  console.log('='.repeat(60))
  console.log('SUCCESS! Certificate is now pending customer approval.')
  console.log('='.repeat(60))
  console.log(`\nCustomer Review URL:\n${reviewUrl}\n`)
  console.log('Share this URL with the customer to review and approve the certificate.')
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
