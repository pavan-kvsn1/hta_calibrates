import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, canAccessAdmin } from '@/lib/auth'

// GET /api/admin/mappings/hod-customer - Get HoD-Customer account mappings
export async function GET() {
  try {
    const session = await auth()
    if (!canAccessAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    // Get all HoDs with their assigned customer accounts
    const hods = await prisma.user.findMany({
      where: {
        role: 'HOD',
        isActive: true,
      },
      select: {
        id: true,
        name: true,
        email: true,
        managedCustomerAccounts: {
          where: { isActive: true },
          select: {
            id: true,
            companyName: true,
            _count: {
              select: {
                users: true,
              },
            },
          },
          orderBy: { companyName: 'asc' },
        },
      },
      orderBy: { name: 'asc' },
    })

    // Get unassigned customer accounts
    const unassignedAccounts = await prisma.customerAccount.findMany({
      where: {
        isActive: true,
        assignedHodId: null,
      },
      select: {
        id: true,
        companyName: true,
        _count: {
          select: {
            users: true,
          },
        },
      },
      orderBy: { companyName: 'asc' },
    })

    // Get certificate counts by customer name for each account
    const allAccountIds = [
      ...hods.flatMap(h => h.managedCustomerAccounts.map(a => a.id)),
      ...unassignedAccounts.map(a => a.id),
    ]

    const accountsWithNames = await prisma.customerAccount.findMany({
      where: { id: { in: allAccountIds } },
      select: { id: true, companyName: true },
    })

    // Count certificates by company name
    const certCounts: Record<string, number> = {}
    for (const account of accountsWithNames) {
      const count = await prisma.certificate.count({
        where: {
          customerName: account.companyName,
        },
      })
      certCounts[account.id] = count
    }

    // Format response
    const formattedHods = hods.map(hod => ({
      id: hod.id,
      name: hod.name,
      email: hod.email,
      accounts: hod.managedCustomerAccounts.map(account => ({
        id: account.id,
        companyName: account.companyName,
        userCount: account._count.users,
        certificateCount: certCounts[account.id] || 0,
      })),
    }))

    const formattedUnassigned = unassignedAccounts.map(account => ({
      id: account.id,
      companyName: account.companyName,
      userCount: account._count.users,
      certificateCount: certCounts[account.id] || 0,
    }))

    return NextResponse.json({
      hods: formattedHods,
      unassignedAccounts: formattedUnassigned,
    })
  } catch (error) {
    console.error('Error fetching HoD-customer mappings:', error)
    return NextResponse.json(
      { error: 'Failed to fetch mappings' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/mappings/hod-customer - Update HoD-Customer account mapping
export async function PUT(request: NextRequest) {
  try {
    const session = await auth()
    if (!canAccessAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden' }, { status: 403 })
    }

    const body = await request.json()
    const { customerAccountId, hodId } = body

    if (!customerAccountId) {
      return NextResponse.json(
        { error: 'Customer account ID is required' },
        { status: 400 }
      )
    }

    // Verify customer account exists
    const account = await prisma.customerAccount.findUnique({
      where: { id: customerAccountId },
    })

    if (!account) {
      return NextResponse.json(
        { error: 'Customer account not found' },
        { status: 404 }
      )
    }

    // If hodId is provided, verify it's a valid HoD
    if (hodId) {
      const hod = await prisma.user.findFirst({
        where: {
          id: hodId,
          role: 'HOD',
          isActive: true,
        },
      })

      if (!hod) {
        return NextResponse.json(
          { error: 'Invalid HoD selected' },
          { status: 400 }
        )
      }
    }

    // Update the mapping
    await prisma.customerAccount.update({
      where: { id: customerAccountId },
      data: {
        assignedHodId: hodId || null,
      },
    })

    return NextResponse.json({
      success: true,
      message: hodId ? 'HoD assigned successfully' : 'HoD unassigned successfully',
    })
  } catch (error) {
    console.error('Error updating HoD-customer mapping:', error)
    return NextResponse.json(
      { error: 'Failed to update mapping' },
      { status: 500 }
    )
  }
}
