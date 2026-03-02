import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'

// GET /api/instruments - Get all active instruments for certificate forms
export async function GET(request: NextRequest) {
  try {
    const { searchParams } = new URL(request.url)
    const category = searchParams.get('category')

    const where: Record<string, unknown> = { isActive: true }
    if (category) {
      where.category = category
    }

    const instruments = await prisma.masterInstrument.findMany({
      where,
      orderBy: [
        { category: 'asc' },
        { description: 'asc' },
      ],
    })

    // Transform to match the JSON format expected by the store
    const transformedInstruments = instruments.map(inst => ({
      id: inst.legacyId || parseInt(inst.id.substring(0, 8), 16), // Use legacyId or generate from UUID
      dbId: inst.id, // Include the UUID for API calls
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

    // Set cache headers for 5 minutes
    return NextResponse.json(transformedInstruments, {
      headers: {
        'Cache-Control': 'public, max-age=300, stale-while-revalidate=60',
      },
    })
  } catch (error) {
    console.error('Error fetching instruments:', error)
    return NextResponse.json(
      { error: 'Failed to fetch instruments' },
      { status: 500 }
    )
  }
}

// Helper to format date as MM/DD/YYYY
function formatDateMMDDYYYY(date: Date): string {
  const month = (date.getMonth() + 1).toString().padStart(2, '0')
  const day = date.getDate().toString().padStart(2, '0')
  const year = date.getFullYear()
  return `${month}/${day}/${year}`
}
