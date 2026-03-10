import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, isMasterAdmin } from '@/lib/auth'
import { enqueue } from '@/lib/services/queue'

// POST /api/admin/customers/requests/[id]/approve - Approve a customer request
export async function POST(
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
          select: { id: true, companyName: true, primaryPocId: true },
        },
        requestedBy: {
          select: { id: true, name: true, email: true },
        },
      },
    })

    if (!customerRequest) {
      return NextResponse.json({ error: 'Request not found' }, { status: 404 })
    }

    if (customerRequest.status !== 'PENDING') {
      return NextResponse.json(
        { error: 'Request has already been processed' },
        { status: 400 }
      )
    }

    const data = JSON.parse(customerRequest.data)

    if (customerRequest.type === 'USER_ADDITION') {
      return await handleUserAdditionApproval(customerRequest, data, session?.user?.id)
    } else if (customerRequest.type === 'POC_CHANGE') {
      return await handlePocChangeApproval(customerRequest, data, session?.user?.id)
    }

    return NextResponse.json({ error: 'Unknown request type' }, { status: 400 })
  } catch (error) {
    console.error('Error approving customer request:', error)
    return NextResponse.json(
      { error: 'Failed to approve customer request' },
      { status: 500 }
    )
  }
}

async function handleUserAdditionApproval(
  customerRequest: {
    id: string
    customerAccount: { id: string; companyName: string }
    requestedBy: { id: string; name: string; email: string } | null
  },
  data: { name: string; email: string },
  adminId: string | undefined
) {
  const normalizedEmail = data.email.toLowerCase()

  // Check email not already in use
  const existingUser = await prisma.customerUser.findUnique({
    where: { email: normalizedEmail },
  })

  if (existingUser) {
    return NextResponse.json(
      { error: 'A user with this email already exists' },
      { status: 400 }
    )
  }

  // Generate activation token
  const activationToken = crypto.randomUUID()
  const activationExpiry = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000) // 7 days

  // Create user and update request in transaction
  const result = await prisma.$transaction(async (tx) => {
    // 1. Create the user
    const user = await tx.customerUser.create({
      data: {
        email: normalizedEmail,
        name: data.name,
        customerAccountId: customerRequest.customerAccount.id,
        isPoc: false,
        isActive: false,
        activationToken,
        activationExpiry,
      },
    })

    // 2. Update request status
    await tx.customerRequest.update({
      where: { id: customerRequest.id },
      data: {
        status: 'APPROVED',
        reviewedById: adminId || null,
        reviewedAt: new Date(),
      },
    })

    return user
  })

  // Build activation URL
  const baseUrl = process.env.NEXT_PUBLIC_BASE_URL || 'http://localhost:3000'
  const activationUrl = `${baseUrl}/customer/activate/${activationToken}`

  // Send activation email to new user
  await enqueue('email:send', {
    to: normalizedEmail,
    subject: 'Activate Your HTA Calibration Portal Account',
    template: 'customer-activation',
    templateData: {
      userName: data.name,
      companyName: customerRequest.customerAccount.companyName,
      activationUrl,
    },
  })

  // Send confirmation to POC who requested
  if (customerRequest.requestedBy?.email) {
    await enqueue('email:send', {
      to: customerRequest.requestedBy.email,
      subject: 'Your Request Has Been Approved',
      template: 'request-approved',
      templateData: {
        requestType: 'USER_ADDITION',
        userName: data.name,
        userEmail: normalizedEmail,
        companyName: customerRequest.customerAccount.companyName,
        approvedBy: 'HTA Admin',
        approvedDate: new Date().toLocaleDateString(),
      },
    })
  }

  return NextResponse.json({
    success: true,
    message: 'User addition request approved. Invite email will be sent to the user.',
    user: {
      id: result.id,
      name: result.name,
      email: result.email,
    },
  })
}

async function handlePocChangeApproval(
  customerRequest: {
    id: string
    customerAccount: { id: string; companyName: string; primaryPocId: string | null }
    requestedBy: { id: string; name: string; email: string } | null
  },
  data: { newPocUserId: string; reason: string },
  adminId: string | undefined
) {
  // Validate new POC user exists and is in the same account
  const newPocUser = await prisma.customerUser.findFirst({
    where: {
      id: data.newPocUserId,
      customerAccountId: customerRequest.customerAccount.id,
    },
  })

  if (!newPocUser) {
    return NextResponse.json(
      { error: 'New POC user not found or does not belong to this account' },
      { status: 400 }
    )
  }

  const oldPocId = customerRequest.customerAccount.primaryPocId

  // Transfer POC role in transaction
  await prisma.$transaction(async (tx) => {
    // 1. Remove POC status from old POC
    if (oldPocId) {
      await tx.customerUser.update({
        where: { id: oldPocId },
        data: { isPoc: false },
      })
    }

    // 2. Set POC status on new POC
    await tx.customerUser.update({
      where: { id: data.newPocUserId },
      data: { isPoc: true },
    })

    // 3. Update account's primary POC reference
    await tx.customerAccount.update({
      where: { id: customerRequest.customerAccount.id },
      data: { primaryPocId: data.newPocUserId },
    })

    // 4. Update request status
    await tx.customerRequest.update({
      where: { id: customerRequest.id },
      data: {
        status: 'APPROVED',
        reviewedById: adminId || null,
        reviewedAt: new Date(),
      },
    })
  })

  // Send notification to requester (who is also old POC)
  if (customerRequest.requestedBy?.email) {
    await enqueue('email:send', {
      to: customerRequest.requestedBy.email,
      subject: 'Your Request Has Been Approved',
      template: 'request-approved',
      templateData: {
        requestType: 'POC_CHANGE',
        newPocName: newPocUser.name,
        companyName: customerRequest.customerAccount.companyName,
        approvedBy: 'HTA Admin',
        approvedDate: new Date().toLocaleDateString(),
      },
    })
  }

  // Send notification to new POC
  await enqueue('email:send', {
    to: newPocUser.email,
    subject: 'You Are Now the Primary Point of Contact',
    template: 'request-approved',
    templateData: {
      requestType: 'POC_CHANGE',
      newPocName: newPocUser.name,
      companyName: customerRequest.customerAccount.companyName,
      approvedBy: 'HTA Admin',
      approvedDate: new Date().toLocaleDateString(),
    },
  })

  return NextResponse.json({
    success: true,
    message: 'POC change request approved. Both parties will be notified.',
    newPoc: {
      id: newPocUser.id,
      name: newPocUser.name,
      email: newPocUser.email,
    },
  })
}
