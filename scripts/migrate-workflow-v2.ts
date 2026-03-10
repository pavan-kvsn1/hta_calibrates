/**
 * Workflow Redesign Migration Script (v2)
 *
 * This script migrates the database from the old HoD-based review model
 * to the new peer-based engineer review model.
 *
 * Changes:
 * 1. Convert HOD users to ENGINEER role
 * 2. Set reviewerId on certificates based on former assignedHodId
 * 3. Set existing admins to MASTER type
 * 4. Update status values (PENDING_HOD_REVIEW -> PENDING_REVIEW)
 *
 * Usage: npx tsx scripts/migrate-workflow-v2.ts [--dry-run]
 */

import { prisma } from '../src/lib/prisma'

const isDryRun = process.argv.includes('--dry-run')

async function main() {
  console.log('='.repeat(60))
  console.log('Workflow Redesign Migration (v2)')
  console.log('='.repeat(60))

  if (isDryRun) {
    console.log('\n⚠️  DRY RUN MODE - No changes will be made\n')
  }

  // Step 1: Get current state
  console.log('\n📊 Current State:')
  const hodUsers = await prisma.user.findMany({
    where: { role: 'HOD' },
    select: { id: true, email: true, name: true, role: true, isAdmin: true },
  })
  const adminUsers = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { id: true, email: true, name: true, role: true, adminType: true },
  })
  const pendingHodCerts = await prisma.certificate.findMany({
    where: { status: 'PENDING_HOD_REVIEW' },
    select: { id: true, certificateNumber: true, status: true },
  })

  console.log(`  - HOD users: ${hodUsers.length}`)
  hodUsers.forEach((u) => console.log(`    • ${u.email} (isAdmin: ${u.isAdmin})`))
  console.log(`  - ADMIN users: ${adminUsers.length}`)
  adminUsers.forEach((u) => console.log(`    • ${u.email} (adminType: ${u.adminType || 'not set'})`))
  console.log(`  - Certificates with PENDING_HOD_REVIEW: ${pendingHodCerts.length}`)

  // Step 2: Convert HOD users to ENGINEER
  console.log('\n🔄 Step 1: Converting HOD users to ENGINEER...')
  if (hodUsers.length > 0) {
    if (isDryRun) {
      console.log(`  Would update ${hodUsers.length} users from HOD to ENGINEER`)
    } else {
      const result = await prisma.user.updateMany({
        where: { role: 'HOD' },
        data: { role: 'ENGINEER' },
      })
      console.log(`  ✅ Updated ${result.count} users from HOD to ENGINEER`)
    }
  } else {
    console.log('  ℹ️  No HOD users to convert')
  }

  // Step 3: Set reviewerId on certificates based on former assignedHodId
  console.log('\n🔄 Step 2: Setting reviewerId on certificates...')
  const certsNeedingReviewer = await prisma.certificate.findMany({
    where: {
      reviewerId: null,
    },
    include: {
      createdBy: {
        select: { id: true, assignedHodId: true },
      },
    },
  })

  let reviewerSetCount = 0
  for (const cert of certsNeedingReviewer) {
    if (cert.createdBy.assignedHodId) {
      if (isDryRun) {
        console.log(`  Would set reviewerId=${cert.createdBy.assignedHodId} on cert ${cert.certificateNumber}`)
      } else {
        await prisma.certificate.update({
          where: { id: cert.id },
          data: { reviewerId: cert.createdBy.assignedHodId },
        })
      }
      reviewerSetCount++
    }
  }

  if (reviewerSetCount > 0) {
    console.log(`  ✅ ${isDryRun ? 'Would set' : 'Set'} reviewerId on ${reviewerSetCount} certificates`)
  } else {
    console.log('  ℹ️  No certificates needed reviewerId update')
  }

  // Step 4: Set existing admins to MASTER type
  console.log('\n🔄 Step 3: Setting admin types...')
  const adminsWithoutType = await prisma.user.findMany({
    where: {
      role: 'ADMIN',
      adminType: null,
    },
    select: { id: true, email: true },
  })

  if (adminsWithoutType.length > 0) {
    if (isDryRun) {
      console.log(`  Would set adminType=MASTER on ${adminsWithoutType.length} admin users`)
      adminsWithoutType.forEach((u) => console.log(`    • ${u.email}`))
    } else {
      const result = await prisma.user.updateMany({
        where: {
          role: 'ADMIN',
          adminType: null,
        },
        data: { adminType: 'MASTER' },
      })
      console.log(`  ✅ Set adminType=MASTER on ${result.count} admin users`)
    }
  } else {
    console.log('  ℹ️  All admin users already have adminType set')
  }

  // Step 5: Update status values
  console.log('\n🔄 Step 4: Updating certificate statuses...')
  if (pendingHodCerts.length > 0) {
    if (isDryRun) {
      console.log(`  Would update ${pendingHodCerts.length} certificates from PENDING_HOD_REVIEW to PENDING_REVIEW`)
      pendingHodCerts.forEach((c) => console.log(`    • ${c.certificateNumber}`))
    } else {
      const result = await prisma.certificate.updateMany({
        where: { status: 'PENDING_HOD_REVIEW' },
        data: { status: 'PENDING_REVIEW' },
      })
      console.log(`  ✅ Updated ${result.count} certificates from PENDING_HOD_REVIEW to PENDING_REVIEW`)
    }
  } else {
    console.log('  ℹ️  No certificates with PENDING_HOD_REVIEW status')
  }

  // Summary
  console.log('\n' + '='.repeat(60))
  console.log('Migration Summary:')
  console.log('='.repeat(60))

  if (isDryRun) {
    console.log('\n⚠️  DRY RUN - No changes were made')
    console.log('Run without --dry-run to apply changes')
  } else {
    console.log('\n✅ Migration completed successfully!')
  }

  // Verify final state
  console.log('\n📊 Final State:')
  const finalHodUsers = await prisma.user.count({ where: { role: 'HOD' } })
  const finalEngineers = await prisma.user.count({ where: { role: 'ENGINEER' } })
  const finalAdmins = await prisma.user.findMany({
    where: { role: 'ADMIN' },
    select: { email: true, adminType: true },
  })
  const finalPendingHod = await prisma.certificate.count({ where: { status: 'PENDING_HOD_REVIEW' } })
  const finalPendingReview = await prisma.certificate.count({ where: { status: 'PENDING_REVIEW' } })
  const certsWithReviewer = await prisma.certificate.count({ where: { reviewerId: { not: null } } })

  console.log(`  - HOD users: ${finalHodUsers} (should be 0)`)
  console.log(`  - ENGINEER users: ${finalEngineers}`)
  console.log(`  - ADMIN users: ${finalAdmins.length}`)
  finalAdmins.forEach((u) => console.log(`    • ${u.email} (adminType: ${u.adminType})`))
  console.log(`  - PENDING_HOD_REVIEW certificates: ${finalPendingHod} (should be 0)`)
  console.log(`  - PENDING_REVIEW certificates: ${finalPendingReview}`)
  console.log(`  - Certificates with reviewerId: ${certsWithReviewer}`)
}

main()
  .catch((error) => {
    console.error('\n❌ Migration failed:', error)
    process.exit(1)
  })
  .finally(() => prisma.$disconnect())
