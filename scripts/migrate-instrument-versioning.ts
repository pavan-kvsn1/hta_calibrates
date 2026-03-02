import { prisma } from '../src/lib/prisma'

/**
 * This script was used for initial migration to versioned instruments.
 * It has already been run successfully and is no longer needed.
 * Keeping it here for reference.
 *
 * Now that instrumentId is a required field, this script would need
 * to use raw SQL or Prisma's $queryRaw to find records with null
 * instrumentId, but since the migration is complete, this is not needed.
 */
async function main() {
  console.log('Checking instrument versioning status...')

  // Check if all instruments have valid versioning
  const total = await prisma.masterInstrument.count()
  const withVersion = await prisma.masterInstrument.count({
    where: { version: { gte: 1 } }
  })

  console.log(`Total instruments: ${total}`)
  console.log(`With versioning: ${withVersion}`)

  if (total === withVersion) {
    console.log('All instruments are already versioned!')
  } else {
    console.log(`Warning: ${total - withVersion} instruments may need versioning`)
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
