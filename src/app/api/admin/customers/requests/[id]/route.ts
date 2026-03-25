import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, isMasterAdmin } from '@/lib/auth'
import { safeJsonParse } from '@/lib/utils/safe-json'

// GET /api/admin/customers/requests/[id] - Get request details
export async function GET(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!isMasterAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden - Master Admin access required' }, { status: 403 })
    }

    const { id } = await params

    const customerRequest = await prisma.customerRequest.findUnique({
      where: { id },
      include: {
        customerAccount: {
          select: {
            id: true,
            companyName: true,
            primaryPoc: {
              select: { id: true, name: true, email: true },
            },
          },
        },
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
        reviewedBy: {
          select: { id: true, name: true },
        },
      },
    })

    if (!customerRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    const data = safeJsonParse<Record<string, string>>(customerRequest.data, {})

    // For POC_CHANGE, include the new POC user details
    let newPocUser = null
    if (customerRequest.type === 'POC_CHANGE' && data.newPocUserId) {
      newPocUser = await prisma.customerUser.findUnique({
        where: { id: data.newPocUserId },
        select: { id: true, name: true, email: true, isActive: true },
      })
    }

    return NextResponse.json({
      request: {
        id: customerRequest.id,
        type: customerRequest.type,
        status: customerRequest.status,
        data,
        newPocUser, // Only for POC_CHANGE
        customerAccount: customerRequest.customerAccount,
        requestedBy: customerRequest.requestedBy,
        reviewedBy: customerRequest.reviewedBy,
        reviewedAt: customerRequest.reviewedAt?.toISOString() || null,
        rejectionReason: customerRequest.rejectionReason,
        createdAt: customerRequest.createdAt.toISOString(),
      },
    })
  } catch (error) {
    console.error('Error fetching customer request:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer request' },
      { status: 500 }
    )
  }
}
