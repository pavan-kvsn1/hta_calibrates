import { NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

// GET /api/customer/team - Get team members for the logged-in user's company
export async function GET() {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user.customerAccountId) {
      return NextResponse.json({ error: 'No customer account found' }, { status: 400 })
    }

    // Get customer account with team members
    const customerAccount = await prisma.customerAccount.findUnique({
      where: { id: session.user.customerAccountId },
      include: {
        primaryPoc: {
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
            activatedAt: true,
            createdAt: true,
          },
        },
        users: {
          select: {
            id: true,
            name: true,
            email: true,
            isActive: true,
            activatedAt: true,
            createdAt: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    })

    if (!customerAccount) {
      return NextResponse.json({ error: 'Customer account not found' }, { status: 404 })
    }

    // Get pending requests for this account
    const pendingRequests = await prisma.customerRequest.findMany({
      where: {
        customerAccountId: customerAccount.id,
        status: 'PENDING',
      },
      orderBy: { createdAt: 'desc' },
    })

    return NextResponse.json({
      account: {
        id: customerAccount.id,
        companyName: customerAccount.companyName,
        primaryPocId: customerAccount.primaryPocId,
      },
      users: customerAccount.users,
      primaryPoc: customerAccount.primaryPoc,
      pendingRequests: pendingRequests.map((req) => ({
        id: req.id,
        type: req.type,
        data: req.data,
        createdAt: req.createdAt,
      })),
      currentUserId: session.user.id,
      isPrimaryPoc: customerAccount.primaryPocId === session.user.id,
    })
  } catch (error) {
    console.error('Error fetching team:', error)
    return NextResponse.json(
      { error: 'Failed to fetch team' },
      { status: 500 }
    )
  }
}
