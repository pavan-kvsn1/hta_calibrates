import 'dotenv/config'
import { PrismaClient } from '@prisma/client'
import { PrismaPg } from '@prisma/adapter-pg'
import * as fs from 'fs'
import * as path from 'path'

/**
 * Sync script to update MasterInstrument records with new metadata fields:
 * - parameterGroup
 * - parameterCapabilities
 * - parameterRoles
 * - sopReferences
 *
 * Run with: npx tsx prisma/sync-instrument-metadata.ts
 */

// PostgreSQL adapter
const connectionString = process.env.DATABASE_URL || 'postgresql://hta_user:hta_dev_password@localhost:5432/hta_calibration'
const adapter = new PrismaPg({ connectionString })
const prisma = new PrismaClient({ adapter })

// Interface for the updated JSON format
interface MasterInstrumentJson {
  id: number
  type: string
  parameter_group?: string
  parameter?: {
    role?: string[]
    capabilities?: string[]
  }
  sop_references?: string[]
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

async function main() {
  console.log('=== Syncing Master Instrument Metadata ===\n')

  // Read updated JSON
  const jsonPath = path.join(__dirname, '../src/data/master-instruments.json')

  if (!fs.existsSync(jsonPath)) {
    console.error('Error: master-instruments.json not found at', jsonPath)
    process.exit(1)
  }

  const jsonData = fs.readFileSync(jsonPath, 'utf-8')
  const instruments: MasterInstrumentJson[] = JSON.parse(jsonData)

  console.log(`Loaded ${instruments.length} instruments from JSON\n`)

  // Check for parameter_group in JSON
  const withParamGroup = instruments.filter(i => i.parameter_group)
  console.log(`Instruments with parameter_group: ${withParamGroup.length}`)

  if (withParamGroup.length === 0) {
    console.error('Error: JSON does not contain parameter_group data. Make sure you have the updated JSON.')
    process.exit(1)
  }

  // Get all existing instruments from DB
  const dbInstruments = await prisma.masterInstrument.findMany({
    where: { isLatest: true },
    select: {
      id: true,
      legacyId: true,
      assetNumber: true,
      parameterGroup: true,
    },
  })

  console.log(`Found ${dbInstruments.length} instruments in database\n`)

  // Create lookup maps
  const jsonByLegacyId = new Map<number, MasterInstrumentJson>()
  const jsonByAssetNo = new Map<string, MasterInstrumentJson>()

  for (const inst of instruments) {
    jsonByLegacyId.set(inst.id, inst)
    jsonByAssetNo.set(inst.asset_no, inst)
  }

  let updatedCount = 0
  let skippedCount = 0
  let notFoundCount = 0
  let errorCount = 0

  for (const dbInst of dbInstruments) {
    // Try to match by legacyId first, then by assetNumber
    let jsonInst = dbInst.legacyId ? jsonByLegacyId.get(dbInst.legacyId) : undefined
    if (!jsonInst) {
      jsonInst = jsonByAssetNo.get(dbInst.assetNumber)
    }

    if (!jsonInst) {
      notFoundCount++
      console.log(`  [NOT FOUND] ${dbInst.assetNumber} - no matching JSON entry`)
      continue
    }

    // Check if update is needed
    const needsUpdate =
      dbInst.parameterGroup !== (jsonInst.parameter_group || null)

    if (!needsUpdate) {
      skippedCount++
      continue
    }

    try {
      await prisma.masterInstrument.update({
        where: { id: dbInst.id },
        data: {
          parameterGroup: jsonInst.parameter_group || null,
          parameterRoles: jsonInst.parameter?.role || [],
          parameterCapabilities: jsonInst.parameter?.capabilities || [],
          sopReferences: jsonInst.sop_references || [],
        },
      })
      updatedCount++
      console.log(`  [UPDATED] ${dbInst.assetNumber} -> ${jsonInst.parameter_group}`)
    } catch (err) {
      errorCount++
      console.error(`  [ERROR] ${dbInst.assetNumber}:`, err)
    }
  }

  console.log('\n=== Sync Complete ===')
  console.log(`  Updated: ${updatedCount}`)
  console.log(`  Skipped (already current): ${skippedCount}`)
  console.log(`  Not found in JSON: ${notFoundCount}`)
  console.log(`  Errors: ${errorCount}`)

  // Verify
  const verifyCount = await prisma.masterInstrument.count({
    where: {
      isLatest: true,
      parameterGroup: { not: null },
    },
  })
  console.log(`\nVerification: ${verifyCount} instruments now have parameterGroup set`)
}

main()
  .catch((e) => {
    console.error(e)
    process.exit(1)
  })
  .finally(async () => {
    await prisma.$disconnect()
  })
