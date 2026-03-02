import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, canAccessAdmin } from '@/lib/auth'

interface ImportRecord {
  category: string
  description: string
  make: string
  model: string
  asset_number: string
  serial_number: string
  usage?: string
  calibrated_at?: string
  report_no?: string
  due_date?: string
  remarks?: string
}

interface ImportResult {
  row: number
  assetNumber: string
  description: string
  action: 'CREATE' | 'UPDATE' | 'SKIP' | 'ERROR'
  notes: string
}

// POST /api/admin/instruments/import - Import instruments from CSV or JSON
export async function POST(request: NextRequest) {
  try {
    const session = await auth()
    if (!canAccessAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const mode = searchParams.get('mode') || 'preview'

    const formData = await request.formData()
    const file = formData.get('file') as File | null

    if (!file) {
      return NextResponse.json({ error: 'No file provided' }, { status: 400 })
    }

    const content = await file.text()
    const fileName = file.name.toLowerCase()

    let records: ImportRecord[] = []

    // Parse file based on type
    if (fileName.endsWith('.json')) {
      try {
        const jsonData = JSON.parse(content)
        records = parseJsonRecords(jsonData)
      } catch {
        return NextResponse.json({ error: 'Invalid JSON file' }, { status: 400 })
      }
    } else if (fileName.endsWith('.csv')) {
      records = parseCsvRecords(content)
    } else {
      return NextResponse.json(
        { error: 'Unsupported file format. Please use .csv or .json' },
        { status: 400 }
      )
    }

    if (records.length === 0) {
      return NextResponse.json({ error: 'No valid records found in file' }, { status: 400 })
    }

    // Get existing instruments by asset number
    const existingInstruments = await prisma.masterInstrument.findMany({
      select: {
        id: true,
        assetNumber: true,
        category: true,
        description: true,
        make: true,
        model: true,
        serialNumber: true,
        calibrationDueDate: true,
      },
    })

    const existingByAssetNo = new Map(
      existingInstruments.map(inst => [inst.assetNumber, inst])
    )

    // Process records
    const results: ImportResult[] = []
    const creates: ImportRecord[] = []
    const updates: { id: string; data: ImportRecord }[] = []
    const errors: ImportResult[] = []

    const seenAssetNumbers = new Set<string>()

    for (let i = 0; i < records.length; i++) {
      const record = records[i]
      const rowNum = i + 2 // Account for header row

      // Validate required fields
      if (!record.category || !record.description || !record.asset_number) {
        errors.push({
          row: rowNum,
          assetNumber: record.asset_number || 'N/A',
          description: record.description || 'N/A',
          action: 'ERROR',
          notes: 'Missing required field (category, description, or asset_number)',
        })
        continue
      }

      // Check for duplicate in import file
      if (seenAssetNumbers.has(record.asset_number)) {
        errors.push({
          row: rowNum,
          assetNumber: record.asset_number,
          description: record.description,
          action: 'ERROR',
          notes: 'Duplicate asset number in import file',
        })
        continue
      }
      seenAssetNumbers.add(record.asset_number)

      // Check if exists in database
      const existing = existingByAssetNo.get(record.asset_number)

      if (existing) {
        // Check if there are changes
        const hasChanges = checkForChanges(existing, record)

        if (hasChanges) {
          updates.push({ id: existing.id, data: record })
          results.push({
            row: rowNum,
            assetNumber: record.asset_number,
            description: record.description,
            action: 'UPDATE',
            notes: 'Existing record will be updated',
          })
        } else {
          results.push({
            row: rowNum,
            assetNumber: record.asset_number,
            description: record.description,
            action: 'SKIP',
            notes: 'No changes detected',
          })
        }
      } else {
        creates.push(record)
        results.push({
          row: rowNum,
          assetNumber: record.asset_number,
          description: record.description,
          action: 'CREATE',
          notes: 'New record will be created',
        })
      }
    }

    // Add errors to results
    results.push(...errors)
    results.sort((a, b) => a.row - b.row)

    // If preview mode, return results
    if (mode === 'preview') {
      return NextResponse.json({
        preview: true,
        summary: {
          total: records.length,
          creates: creates.length,
          updates: updates.length,
          skips: results.filter(r => r.action === 'SKIP').length,
          errors: errors.length,
        },
        results,
      })
    }

    // Execute mode - perform the import
    let createdCount = 0
    let updatedCount = 0

    // Create new records
    for (const record of creates) {
      try {
        const instrumentId = crypto.randomUUID()
        await prisma.masterInstrument.create({
          data: {
            instrumentId,
            version: 1,
            isLatest: true,
            category: record.category,
            description: record.description,
            make: record.make || '',
            model: record.model || '',
            assetNumber: record.asset_number,
            serialNumber: record.serial_number || '',
            usage: record.usage || null,
            calibratedAtLocation: record.calibrated_at || null,
            reportNo: record.report_no || null,
            calibrationDueDate: parseDueDate(record.due_date),
            remarks: record.remarks || null,
            isActive: true,
            createdById: session!.user.id,
            changeReason: 'CSV import',
          },
        })
        createdCount++
      } catch (error) {
        console.error('Error creating instrument:', error)
      }
    }

    // Update existing records (versioned update)
    for (const { id, data } of updates) {
      try {
        // Get existing record
        const existing = await prisma.masterInstrument.findUnique({
          where: { id },
        })

        if (!existing) continue

        // Create new version in a transaction
        await prisma.$transaction(async (tx) => {
          // Mark old version as not latest
          await tx.masterInstrument.update({
            where: { id },
            data: { isLatest: false },
          })

          // Create new version with updated data
          await tx.masterInstrument.create({
            data: {
              instrumentId: existing.instrumentId,
              version: existing.version + 1,
              isLatest: true,
              category: data.category,
              description: data.description,
              make: data.make || '',
              model: data.model || '',
              assetNumber: existing.assetNumber,
              serialNumber: data.serial_number || '',
              usage: data.usage || null,
              calibratedAtLocation: data.calibrated_at || null,
              reportNo: data.report_no || null,
              calibrationDueDate: parseDueDate(data.due_date),
              remarks: data.remarks || null,
              isActive: existing.isActive,
              createdById: session!.user.id,
              changeReason: 'CSV import update',
              legacyId: existing.legacyId,
              importedFromJson: existing.importedFromJson,
            },
          })
        })
        updatedCount++
      } catch (error) {
        console.error('Error updating instrument:', error)
      }
    }

    return NextResponse.json({
      success: true,
      summary: {
        created: createdCount,
        updated: updatedCount,
        errors: errors.length,
      },
    })
  } catch (error) {
    console.error('Error importing instruments:', error)
    return NextResponse.json(
      { error: 'Failed to import instruments' },
      { status: 500 }
    )
  }
}

// Parse JSON records (handles both original format and export format)
function parseJsonRecords(data: unknown): ImportRecord[] {
  if (!Array.isArray(data)) return []

  return data.map((item: Record<string, unknown>) => ({
    category: String(item.type || item.category || ''),
    description: String(item.instrument_desc || item.description || ''),
    make: String(item.make || ''),
    model: String(item.model || ''),
    asset_number: String(item.asset_no || item.asset_number || ''),
    serial_number: String(item.instrument_sl_no || item.serial_number || ''),
    usage: String(item.usage || ''),
    calibrated_at: String(item.calibrated_at || ''),
    report_no: String(item.report_no || ''),
    due_date: String(item.next_due_on || item.due_date || ''),
    remarks: String(item.remarks || ''),
  }))
}

// Parse CSV records
function parseCsvRecords(content: string): ImportRecord[] {
  const lines = content.split('\n').filter(line => line.trim())
  if (lines.length < 2) return []

  const headers = parseCSVLine(lines[0]).map(h => h.toLowerCase().trim())
  const records: ImportRecord[] = []

  for (let i = 1; i < lines.length; i++) {
    const values = parseCSVLine(lines[i])
    const record: Record<string, string> = {}

    headers.forEach((header, index) => {
      record[header] = values[index] || ''
    })

    records.push({
      category: record.category || record.type || '',
      description: record.description || record.instrument_desc || '',
      make: record.make || '',
      model: record.model || '',
      asset_number: record.asset_number || record.asset_no || '',
      serial_number: record.serial_number || record.instrument_sl_no || '',
      usage: record.usage || '',
      calibrated_at: record.calibrated_at || '',
      report_no: record.report_no || '',
      due_date: record.due_date || record.next_due_on || '',
      remarks: record.remarks || '',
    })
  }

  return records
}

// Parse a single CSV line handling quoted values
function parseCSVLine(line: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const char = line[i]

    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"'
        i++
      } else {
        inQuotes = !inQuotes
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += char
    }
  }

  result.push(current.trim())
  return result
}

// Check if there are changes between existing and import record
function checkForChanges(
  existing: {
    category: string
    description: string
    make: string
    model: string
    serialNumber: string
    calibrationDueDate: Date | null
  },
  record: ImportRecord
): boolean {
  if (existing.category !== record.category) return true
  if (existing.description !== record.description) return true
  if (existing.make !== (record.make || '')) return true
  if (existing.model !== (record.model || '')) return true
  if (existing.serialNumber !== (record.serial_number || '')) return true

  const newDate = parseDueDate(record.due_date)
  if (existing.calibrationDueDate?.getTime() !== newDate?.getTime()) return true

  return false
}

// Parse date from MM/DD/YYYY format
function parseDueDate(dateStr?: string): Date | null {
  if (!dateStr || dateStr.trim() === '') return null

  const parts = dateStr.split('/')
  if (parts.length === 3) {
    const month = parseInt(parts[0], 10) - 1
    const day = parseInt(parts[1], 10)
    const year = parseInt(parts[2], 10)

    if (!isNaN(month) && !isNaN(day) && !isNaN(year)) {
      const date = new Date(year, month, day)
      if (!isNaN(date.getTime())) {
        return date
      }
    }
  }

  return null
}
