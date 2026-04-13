import { NextRequest, NextResponse } from 'next/server'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { certificateLogger as logger } from '@/lib/logger'

// Allowed editable fields
const ALLOWED_FIELDS = [
  'certificateNumber',
  'dateOfCalibration',
  'calibrationDueDate',
  'reviewerId',
] as const

type AllowedField = (typeof ALLOWED_FIELDS)[number]

interface RouteParams {
  params: Promise<{ id: string }>
}

export async function PATCH(request: NextRequest, { params }: RouteParams) {
  try {
    const session = await auth()

    if (!session?.user) {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    // Only ADMIN role can edit
    if (session.user.role !== 'ADMIN') {
      return NextResponse.json(
        { error: 'Forbidden - Admin access required' },
        { status: 403 }
      )
    }

    const { id } = await params
    const body = await request.json()
    const { field, value, reason } = body as {
      field: string
      value: string
      reason: string
    }

    // Validate field
    if (!field || !ALLOWED_FIELDS.includes(field as AllowedField)) {
      return NextResponse.json(
        { error: `Field not editable. Allowed: ${ALLOWED_FIELDS.join(', ')}` },
        { status: 400 }
      )
    }

    // Validate reason
    if (!reason?.trim()) {
      return NextResponse.json(
        { error: 'Reason is required for audit trail' },
        { status: 400 }
      )
    }

    // Get existing certificate
    const certificate = await prisma.certificate.findUnique({
      where: { id },
    })

    if (!certificate) {
      return NextResponse.json({ error: 'Certificate not found' }, { status: 404 })
    }

    // Get the old value for audit
    const oldValue = getFieldValue(certificate, field as AllowedField)

    // Prepare update data
    const updateData = prepareUpdateData(field as AllowedField, value)

    // Validate specific fields
    if (field === 'certificateNumber' && value) {
      // Check for duplicate certificate number
      const existing = await prisma.certificate.findFirst({
        where: {
          certificateNumber: value,
          id: { not: id },
        },
      })
      if (existing) {
        return NextResponse.json(
          { error: 'Certificate number already exists' },
          { status: 400 }
        )
      }
    }

    if (field === 'reviewerId' && value) {
      // Verify reviewer exists and is not the creator
      const reviewer = await prisma.user.findUnique({
        where: { id: value },
      })
      if (!reviewer) {
        return NextResponse.json({ error: 'Reviewer not found' }, { status: 400 })
      }
      if (reviewer.id === certificate.createdById) {
        return NextResponse.json(
          { error: 'Cannot assign certificate creator as reviewer' },
          { status: 400 }
        )
      }
    }

    // Execute update in transaction
    await prisma.$transaction(async (tx) => {
      // Get next event sequence
      const lastEvent = await tx.certificateEvent.findFirst({
        where: { certificateId: id },
        orderBy: { sequenceNumber: 'desc' },
      })
      const nextSequence = (lastEvent?.sequenceNumber ?? 0) + 1

      // Update certificate
      await tx.certificate.update({
        where: { id },
        data: {
          ...updateData,
          lastModifiedById: session.user.id,
        },
      })

      // Create event for audit trail
      await tx.certificateEvent.create({
        data: {
          certificateId: id,
          sequenceNumber: nextSequence,
          revision: certificate.currentRevision,
          userId: session.user.id,
          userRole: 'ADMIN',
          eventType: 'ADMIN_EDIT',
          eventData: JSON.stringify({
            field,
            from: oldValue,
            to: value,
            reason: reason.trim(),
            adminId: session.user.id,
            adminName: session.user.name,
            adminType: session.user.adminType,
          }),
        },
      })

      // Create audit log entry
      await tx.auditLog.create({
        data: {
          entityType: 'Certificate',
          entityId: id,
          action: 'ADMIN_EDIT',
          actorId: session.user.id,
          actorType: 'ADMIN',
          changes: JSON.stringify({
            field,
            from: oldValue,
            to: value,
            reason: reason.trim(),
          }),
        },
      })
    })

    return NextResponse.json({
      success: true,
      message: `${formatFieldLabel(field)} updated successfully`,
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to update certificate via admin edit')
    return NextResponse.json(
      { error: 'Failed to update certificate' },
      { status: 500 }
    )
  }
}

function getFieldValue(
  certificate: Record<string, unknown>,
  field: AllowedField
): string | null {
  const value = certificate[field]
  if (value === null || value === undefined) return null
  if (value instanceof Date) return value.toISOString()
  return String(value)
}

function prepareUpdateData(
  field: AllowedField,
  value: string
): Record<string, unknown> {
  switch (field) {
    case 'dateOfCalibration':
    case 'calibrationDueDate':
      return { [field]: value ? new Date(value) : null }
    case 'reviewerId':
      return { [field]: value || null }
    default:
      return { [field]: value }
  }
}

function formatFieldLabel(field: string): string {
  const labels: Record<string, string> = {
    certificateNumber: 'Certificate Number',
    dateOfCalibration: 'Date of Calibration',
    calibrationDueDate: 'Calibration Due Date',
    reviewerId: 'Reviewer',
  }
  return labels[field] || field
}
