import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { createLogger } from '@/lib/logger'

const logger = createLogger('customer')

// POST /api/customer/team/request - Submit a user addition or POC change request
export async function POST(request: NextRequest) {
  try {
    const session = await auth()

    if (!session?.user || session.user.role !== 'CUSTOMER') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    if (!session.user.customerAccountId) {
      return NextResponse.json({ error: 'No customer account found' }, { status: 400 })
    }

    // Verify user is the POC
    const customerAccount = await prisma.customerAccount.findUnique({
      where: { id: session.user.customerAccountId },
      select: { id: true, primaryPocId: true },
    })

    if (!customerAccount) {
      return NextResponse.json({ error: 'Customer account not found' }, { status: 404 })
    }

    if (customerAccount.primaryPocId !== session.user.id) {
      return NextResponse.json(
        { error: 'Only the primary POC can submit requests' },
        { status: 403 }
      )
    }

    const body = await request.json()
    const { type, data } = body

    if (!type || !['USER_ADDITION', 'POC_CHANGE'].includes(type)) {
      return NextResponse.json({ error: 'Invalid request type' }, { status: 400 })
    }

    // Validate based on request type
    if (type === 'USER_ADDITION') {
      if (!data?.name || !data?.email) {
        return NextResponse.json(
          { error: 'Name and email are required for user addition' },
          { status: 400 }
        )
      }

      // Validate email format
      const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
      if (!emailRegex.test(data.email)) {
        return NextResponse.json({ error: 'Invalid email format' }, { status: 400 })
      }

      // Check if email already exists in customer users
      const existingUser = await prisma.customerUser.findUnique({
        where: { email: data.email },
      })

      if (existingUser) {
        return NextResponse.json(
          { error: 'A user with this email already exists' },
          { status: 400 }
        )
      }

      // Check for duplicate pending requests
      const existingRequests = await prisma.customerRequest.findMany({
        where: {
          customerAccountId: customerAccount.id,
          type: 'USER_ADDITION',
          status: 'PENDING',
        },
      })

      const duplicateRequest = existingRequests.find((req) => {
        const reqData = JSON.parse(req.data) as { email?: string }
        return reqData.email?.toLowerCase() === data.email.toLowerCase()
      })

      if (duplicateRequest) {
        return NextResponse.json(
          { error: 'A pending request for this email already exists' },
          { status: 400 }
        )
      }
    }

    if (type === 'POC_CHANGE') {
      if (!data?.newPocUserId) {
        return NextResponse.json(
          { error: 'New POC user ID is required' },
          { status: 400 }
        )
      }

      // Verify the new POC is in the same account
      const newPocUser = await prisma.customerUser.findFirst({
        where: {
          id: data.newPocUserId,
          customerAccountId: customerAccount.id,
          isActive: true,
        },
      })

      if (!newPocUser) {
        return NextResponse.json(
          { error: 'Selected user is not a valid active member of this account' },
          { status: 400 }
        )
      }

      // Check for existing pending POC change request
      const existingRequest = await prisma.customerRequest.findFirst({
        where: {
          customerAccountId: customerAccount.id,
          type: 'POC_CHANGE',
          status: 'PENDING',
        },
      })

      if (existingRequest) {
        return NextResponse.json(
          { error: 'A pending POC change request already exists' },
          { status: 400 }
        )
      }
    }

    // Create the request
    const customerRequest = await prisma.customerRequest.create({
      data: {
        type,
        customerAccountId: customerAccount.id,
        requestedById: session.user.id,
        data: JSON.stringify(data || {}),
        status: 'PENDING',
      },
    })

    return NextResponse.json({
      success: true,
      request: {
        id: customerRequest.id,
        type: customerRequest.type,
        status: customerRequest.status,
        createdAt: customerRequest.createdAt,
      },
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to create customer request')
    return NextResponse.json(
      { error: 'Failed to create request' },
      { status: 500 }
    )
  }
}
