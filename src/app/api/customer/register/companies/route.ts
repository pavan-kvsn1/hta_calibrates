import { NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

const logger = createLogger('customer')

// GET /api/customer/register/companies - Get list of active customer accounts for registration
export async function GET() {
  try {
    const accounts = await prisma.customerAccount.findMany({
      where: { isActive: true },
      select: {
        id: true,
        companyName: true,
      },
      orderBy: { companyName: 'asc' },
    })

    return NextResponse.json({ companies: accounts })
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch companies for registration')
    return NextResponse.json(
      { error: 'Failed to fetch companies' },
      { status: 500 }
    )
  }
}
