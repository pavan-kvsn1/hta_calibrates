/**
 * Migration Script: Import Master Instruments from JSON to Database
 *
 * Run with: npx tsx scripts/migrate-instruments.ts
 */

import { PrismaClient } from '@prisma/client'
import * as fs from 'fs'
import * as path from 'path'

const prisma = new PrismaClient()

interface CompositeValue {
  ind?: string
  sen?: string
}

interface JsonInstrument {
  id: number
  type: string
  instrument_desc: string
  make: string | CompositeValue
  model: string | CompositeValue
  asset_no: string
  instrument_sl_no: string | CompositeValue
  usage: string
  calibrated_at: string
  report_no: string
  next_due_on: string
  range: unknown[]
  remarks: string
}

// Serialize composite value to string
function serializeCompositeValue(value: string | CompositeValue): string {
  if (typeof value === 'string') {
    return value
  }
  const parts: string[] = []
  if (value.ind) parts.push(`Ind: ${value.ind}`)
  if (value.sen) parts.push(`Sen: ${value.sen}`)
  return parts.join(' / ')
}

// Parse date from MM/DD/YYYY format
function parseDueDate(dateStr: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null

  // Handle MM/DD/YYYY format
  const parts = dateStr.split('/')
  if (parts.length === 3) {
    const month = parseInt(parts[0], 10) - 1 // JS months are 0-indexed
    const day = parseInt(parts[1], 10)
    const year = parseInt(parts[2], 10)

    if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
      const date = new Date(year, month, day)
      if (!isNaN(date.getTime())) {
        return date
      }
    }
  }

  console.warn(`Warning: Could not parse date "${dateStr}"`)
  return null
}

async function migrateInstruments() {
  console.log('Starting Master Instruments migration...\n')

  // Read the JSON file
  const jsonPath = path.join(process.cwd(), 'src', 'data', 'master-instruments.json')
  const jsonData = fs.readFileSync(jsonPath, 'utf-8')
  const instruments: JsonInstrument[] = JSON.parse(jsonData)

  console.log(`Found ${instruments.length} instruments in JSON file\n`)

  // Check if there are already instruments in the database
  const existingCount = await prisma.masterInstrument.count()
  if (existingCount > 0) {
    console.log(`Database already has ${existingCount} instruments.`)
    console.log('To re-run migration, first clear the table with:')
    console.log('  npx prisma db execute --stdin <<< "DELETE FROM MasterInstrument;"')
    console.log('\nAborting migration.\n')
    return
  }

  let successCount = 0
  let errorCount = 0
  const errors: { id: number; error: string }[] = []

  // Process each instrument
  for (const inst of instruments) {
    try {
      const instrumentId = crypto.randomUUID()
      await prisma.masterInstrument.create({
        data: {
          instrumentId,
          version: 1,
          isLatest: true,
          legacyId: inst.id,
          category: inst.type,
          description: inst.instrument_desc,
          make: serializeCompositeValue(inst.make),
          model: serializeCompositeValue(inst.model),
          assetNumber: inst.asset_no,
          serialNumber: serializeCompositeValue(inst.instrument_sl_no),
          usage: inst.usage || null,
          calibratedAtLocation: inst.calibrated_at || null,
          reportNo: inst.report_no || null,
          calibrationDueDate: parseDueDate(inst.next_due_on),
          rangeData: JSON.stringify(inst.range),
          remarks: inst.remarks || null,
          isActive: true,
          importedFromJson: true,
          changeReason: 'Initial migration',
        },
      })
      successCount++
      process.stdout.write(`\rProcessed: ${successCount}/${instruments.length}`)
    } catch (error) {
      errorCount++
      const errorMsg = error instanceof Error ? error.message : String(error)
      errors.push({ id: inst.id, error: errorMsg })
      console.error(`\nError migrating instrument ID ${inst.id}: ${errorMsg}`)
    }
  }

  console.log('\n\n=== Migration Summary ===')
  console.log(`Total instruments in JSON: ${instruments.length}`)
  console.log(`Successfully migrated: ${successCount}`)
  console.log(`Errors: ${errorCount}`)

  if (errors.length > 0) {
    console.log('\nErrors:')
    errors.forEach(({ id, error }) => {
      console.log(`  - ID ${id}: ${error}`)
    })
  }

  // Verify the migration
  const dbCount = await prisma.masterInstrument.count()
  console.log(`\nVerification: ${dbCount} instruments now in database`)

  if (dbCount === instruments.length) {
    console.log('\nMigration completed successfully!')
  } else {
    console.log('\nWarning: Database count does not match JSON count')
  }
}

// Run the migration
migrateInstruments()
  .catch(console.error)
  .finally(() => prisma.$disconnect())
