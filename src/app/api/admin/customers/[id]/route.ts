import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth, isMasterAdmin } from '@/lib/auth'
import { safeJsonParse } from '@/lib/utils/safe-json'

// GET /api/admin/customers/[id] - Get customer account details (Master Admin only)
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

    const account = await prisma.customerAccount.findUnique({
      where: { id },
      include: {
        assignedAdmin: {
          select: { id: true, name: true, email: true },
        },
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
            email: true,
            name: true,
            isPoc: true,
            isActive: true,
            activatedAt: true,
            createdAt: true,
          },
          orderBy: [{ isPoc: 'desc' }, { name: 'asc' }], // POC first, then by name
        },
        requests: {
          where: { status: 'PENDING' },
          select: {
            id: true,
            type: true,
            data: true,
            createdAt: true,
            requestedBy: {
              select: { id: true, name: true, email: true },
            },
          },
          orderBy: { createdAt: 'desc' },
        },
      },
    })

    if (!account) {
      return NextResponse.json({ error: 'Customer account not found' }, { status: 404 })
    }

    // Get recent certificates by company name match
    const recentCertificates = await prisma.certificate.findMany({
      where: { customerName: account.companyName },
      select: {
        id: true,
        certificateNumber: true,
        uucDescription: true,
        status: true,
        createdAt: true,
      },
      orderBy: { createdAt: 'desc' },
      take: 10,
    })

    // Get total certificate count
    const certificateCount = await prisma.certificate.count({
      where: { customerName: account.companyName },
    })

    return NextResponse.json({
      account: {
        id: account.id,
        companyName: account.companyName,
        address: account.address,
        contactEmail: account.contactEmail,
        contactPhone: account.contactPhone,
        isActive: account.isActive,
        assignedAdmin: account.assignedAdmin,
        primaryPocId: account.primaryPocId,
        primaryPoc: account.primaryPoc ? {
          ...account.primaryPoc,
          activatedAt: account.primaryPoc.activatedAt?.toISOString() || null,
          createdAt: account.primaryPoc.createdAt.toISOString(),
        } : null,
        createdAt: account.createdAt.toISOString(),
        updatedAt: account.updatedAt.toISOString(),
      },
      users: account.users.map((u) => ({
        ...u,
        activatedAt: u.activatedAt?.toISOString() || null,
        createdAt: u.createdAt.toISOString(),
      })),
      pendingRequests: account.requests.map((r) => ({
        id: r.id,
        type: r.type,
        data: safeJsonParse<Record<string, unknown>>(r.data, {}),
        requestedBy: r.requestedBy,
        createdAt: r.createdAt.toISOString(),
      })),
      recentCertificates: recentCertificates.map((c) => ({
        ...c,
        createdAt: c.createdAt.toISOString(),
      })),
      certificateCount,
    })
  } catch (error) {
    console.error('Error fetching customer account:', error)
    return NextResponse.json(
      { error: 'Failed to fetch customer account' },
      { status: 500 }
    )
  }
}

// PUT /api/admin/customers/[id] - Update customer account (Master Admin only)
export async function PUT(
  request: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  try {
    const session = await auth()
    if (!isMasterAdmin(session?.user)) {
      return NextResponse.json({ error: 'Forbidden - Master Admin access required' }, { status: 403 })
    }

    const { id } = await params
    const body = await request.json()
    const { companyName, address, contactEmail, contactPhone, assignedAdminId, isActive } = body

    const existing = await prisma.customerAccount.findUnique({
      where: { id },
    })

    if (!existing) {
      return NextResponse.json({ error: 'Customer account not found' }, { status: 404 })
    }

    const updateData: Record<string, unknown> = {}

    if (companyName !== undefined) {
      const trimmedName = companyName.trim()
      if (!trimmedName) {
        return NextResponse.json(
          { error: 'Company name cannot be empty' },
          { status: 400 }
        )
      }

      // Check unique name if changed
      if (trimmedName !== existing.companyName) {
        const duplicate = await prisma.customerAccount.findUnique({
          where: { companyName: trimmedName },
        })
        if (duplicate) {
          return NextResponse.json(
            { error: 'A customer account with this name already exists' },
            { status: 400 }
          )
        }
      }
      updateData.companyName = trimmedName
    }

    if (address !== undefined) {
      updateData.address = address?.trim() || null
    }

    if (contactEmail !== undefined) {
      updateData.contactEmail = contactEmail?.trim() || null
    }

    if (contactPhone !== undefined) {
      updateData.contactPhone = contactPhone?.trim() || null
    }

    if (assignedAdminId !== undefined) {
      if (assignedAdminId) {
        const hod = await prisma.user.findFirst({
          where: { id: assignedAdminId, role: 'ADMIN', isActive: true },
        })
        if (!hod) {
          return NextResponse.json(
            { error: 'Invalid Admin selected' },
            { status: 400 }
          )
        }
      }
      updateData.assignedAdminId = assignedAdminId || null
    }

    if (isActive !== undefined) {
      updateData.isActive = isActive
    }

    const account = await prisma.customerAccount.update({
      where: { id },
      data: updateData,
      include: {
        assignedAdmin: {
          select: { id: true, name: true },
        },
      },
    })

    return NextResponse.json({
      success: true,
      account: {
        id: account.id,
        companyName: account.companyName,
        isActive: account.isActive,
        assignedAdmin: account.assignedAdmin,
      },
    })
  } catch (error) {
    console.error('Error updating customer account:', error)
    return NextResponse.json(
      { error: 'Failed to update customer account' },
      { status: 500 }
    )
  }
}
