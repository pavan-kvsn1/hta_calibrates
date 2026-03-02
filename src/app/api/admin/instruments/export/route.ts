import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, canAccessAdmin } from '@/lib/auth'

// GET /api/admin/instruments/export - Export instruments as CSV or JSON
export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!canAccessAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const { searchParams } = new URL(request.url)
    const format = searchParams.get('format') || 'csv'
    const includeInactive = searchParams.get('includeInactive') === 'true'

    const where = includeInactive ? {} : { isActive: true }

    const instruments = await prisma.masterInstrument.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { description: 'asc' },
      ],
    })

    if (format === 'json') {
      // Return JSON format
      const jsonData = instruments.map(inst => ({
        id: inst.legacyId || null,
        type: inst.category,
        instrument_desc: inst.description,
        make: inst.make,
        model: inst.model,
        asset_no: inst.assetNumber,
        instrument_sl_no: inst.serialNumber,
        usage: inst.usage || '',
        calibrated_at: inst.calibratedAtLocation || '',
        report_no: inst.reportNo || '',
        next_due_on: inst.calibrationDueDate
          ? formatDateMMDDYYYY(inst.calibrationDueDate)
          : '',
        range: inst.rangeData ? JSON.parse(inst.rangeData) : [],
        remarks: inst.remarks || '',
      }))

      return new NextResponse(JSON.stringify(jsonData, null, 2), {
        headers: {
          'Content-Type': 'application/json',
          'Content-Disposition': `attachment; filename="master-instruments-${getDateStamp()}.json"`,
        },
      })
    }

    // Return CSV format
    const headers = [
      'category',
      'description',
      'make',
      'model',
      'asset_number',
      'serial_number',
      'usage',
      'calibrated_at',
      'report_no',
      'due_date',
      'remarks',
    ]

    const rows = instruments.map(inst => [
      escapeCsv(inst.category),
      escapeCsv(inst.description),
      escapeCsv(inst.make),
      escapeCsv(inst.model),
      escapeCsv(inst.assetNumber),
      escapeCsv(inst.serialNumber),
      escapeCsv(inst.usage || ''),
      escapeCsv(inst.calibratedAtLocation || ''),
      escapeCsv(inst.reportNo || ''),
      inst.calibrationDueDate ? formatDateMMDDYYYY(inst.calibrationDueDate) : '',
      escapeCsv(inst.remarks || ''),
    ])

    const csvContent = [
      headers.join(','),
      ...rows.map(row => row.join(',')),
    ].join('\n')

    return new NextResponse(csvContent, {
      headers: {
        'Content-Type': 'text/csv',
        'Content-Disposition': `attachment; filename="master-instruments-${getDateStamp()}.csv"`,
      },
    })
  } catch (error) {
    console.error('Error exporting instruments:', error)
    return NextResponse.json(
      { error: 'Failed to export instruments' },
      { status: 500 }
    )
  }
}

// Helper functions
function formatDateMMDDYYYY(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${month}/${day}/${year}`
}

function getDateStamp(): string {
  const now = new Date()
  return `${now.getFullYear()}-${(now.getMonth() + 1).toString().padStart(2, '0')}-${now.getDate().toString().padStart(2, '0')}`
}

function escapeCsv(value: string): string {
  if (!value) return ''
  // Escape quotes and wrap in quotes if contains comma, quote, or newline
  if (value.includes(',') || value.includes('"') || value.includes('\n')) {
    return `"${value.replace(/"/g, '""')}"`
  }
  return value
}
