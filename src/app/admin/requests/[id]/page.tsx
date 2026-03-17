import { redirect, notFound } from 'next/navigation'
import { auth, isMasterAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { InternalRequestClient } from './InternalRequestClient'
import { CustomerRequestView } from './CustomerRequestView'

interface Props {
  params: Promise<{ id: string }>
  searchParams: Promise<{ type?: string }>
}

export default async function RequestDetailPage({ params, searchParams }: Props) {
  const { id } = await params
  const { type } = await searchParams
  const requestType = type || 'customer'

  const session = await auth()
  if (!session?.user) {
    redirect('/login')
  }

  if (!isMasterAdmin(session.user)) {
    redirect('/admin')
  }

  // Handle customer requests
  if (requestType === 'customer') {
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
      notFound()
    }

    // For POC_CHANGE, fetch the new POC user
    let newPocUser = null
    const data = customerRequest.data as { newPocUserId?: string; name?: string; email?: string; reason?: string }
    if (customerRequest.type === 'POC_CHANGE' && data.newPocUserId) {
      newPocUser = await prisma.user.findUnique({
        where: { id: data.newPocUserId },
        select: { id: true, name: true, email: true, isActive: true },
      })
    }

    return (
      <CustomerRequestView
        request={{
          id: customerRequest.id,
          type: customerRequest.type as 'USER_ADDITION' | 'POC_CHANGE',
          status: customerRequest.status as 'PENDING' | 'APPROVED' | 'REJECTED',
          data,
          newPocUser,
          customerAccount: {
            id: customerRequest.customerAccount.id,
            companyName: customerRequest.customerAccount.companyName,
            primaryPoc: customerRequest.customerAccount.primaryPoc,
          },
          requestedBy: customerRequest.requestedBy,
          reviewedBy: customerRequest.reviewedBy,
          reviewedAt: customerRequest.reviewedAt?.toISOString() || null,
          rejectionReason: customerRequest.rejectionReason,
          createdAt: customerRequest.createdAt.toISOString(),
        }}
      />
    )
  }

  // Handle internal requests
  const internalRequest = await prisma.internalRequest.findUnique({
    where: { id },
    include: {
      requestedBy: {
        select: { id: true, name: true, email: true },
      },
      reviewedBy: {
        select: { id: true, name: true },
      },
      certificate: {
        include: {
          createdBy: {
            select: { id: true, name: true, email: true },
          },
          reviewer: {
            select: { id: true, name: true, email: true },
          },
          parameters: {
            include: {
              results: true,
            },
            orderBy: { sortOrder: 'asc' },
          },
          masterInstruments: true,
          feedbacks: {
            orderBy: { createdAt: 'desc' },
            include: {
              user: {
                select: { name: true, role: true },
              },
            },
          },
          events: {
            orderBy: { sequenceNumber: 'desc' },
            include: {
              user: {
                select: { id: true, name: true, role: true },
              },
              customer: {
                select: { id: true, name: true, email: true },
              },
            },
          },
        },
      },
    },
  })

  if (!internalRequest || !internalRequest.certificate) {
    notFound()
  }

  const cert = internalRequest.certificate
  const requestData = JSON.parse(internalRequest.data)

  // Get currently unlocked sections
  let currentlyUnlockedSections: string[] = []

  // From feedbacks
  const feedbackSections = cert.feedbacks
    .filter(f =>
      (f.feedbackType === 'REVISION_REQUEST' || f.feedbackType === 'CUSTOMER_REVISION_FORWARDED') &&
      f.targetSection
    )
    .map(f => f.targetSection)
    .filter(Boolean) as string[]

  currentlyUnlockedSections = [...new Set(feedbackSections)]

  // From approved unlock requests
  const approvedUnlocks = await prisma.internalRequest.findMany({
    where: {
      certificateId: cert.id,
      type: 'SECTION_UNLOCK',
      status: 'APPROVED',
      id: { not: internalRequest.id }, // Exclude current request
    },
    select: { data: true },
  })

  approvedUnlocks.forEach(unlock => {
    const unlockData = JSON.parse(unlock.data)
    if (unlockData.sections) {
      currentlyUnlockedSections = [...new Set([...currentlyUnlockedSections, ...unlockData.sections])]
    }
  })

  // Parse JSON fields
  const conclusionStatements = cert.selectedConclusionStatements
    ? JSON.parse(cert.selectedConclusionStatements)
    : []

  const calibrationStatus = cert.calibrationStatus
    ? JSON.parse(cert.calibrationStatus)
    : []

  // Serialize feedbacks
  const serializedFeedbacks = cert.feedbacks.map((f) => ({
    id: f.id,
    feedbackType: f.feedbackType,
    comment: f.comment,
    createdAt: f.createdAt.toISOString(),
    revisionNumber: f.revisionNumber,
    targetSection: f.targetSection,
    user: {
      name: f.user.name,
      role: f.user.role,
    },
  }))

  // Serialize events
  const serializedEvents = cert.events.map((e) => ({
    id: e.id,
    sequenceNumber: e.sequenceNumber,
    revision: e.revision,
    eventType: e.eventType,
    eventData: e.eventData,
    userRole: e.userRole,
    createdAt: e.createdAt.toISOString(),
    user: e.user ? {
      id: e.user.id,
      name: e.user.name,
      role: e.user.role,
    } : null,
    customer: e.customer ? {
      id: e.customer.id,
      name: e.customer.name,
      email: e.customer.email,
    } : null,
  }))

  return (
    <InternalRequestClient
      request={{
        id: internalRequest.id,
        type: internalRequest.type as 'SECTION_UNLOCK',
        status: internalRequest.status as 'PENDING' | 'APPROVED' | 'REJECTED',
        data: requestData,
        requestedBy: internalRequest.requestedBy,
        reviewedBy: internalRequest.reviewedBy,
        reviewedAt: internalRequest.reviewedAt?.toISOString() || null,
        adminNote: internalRequest.adminNote,
        createdAt: internalRequest.createdAt.toISOString(),
      }}
      certificate={{
        id: cert.id,
        certificateNumber: cert.certificateNumber,
        status: cert.status,
        customerName: cert.customerName,
        customerAddress: cert.customerAddress,
        calibratedAt: cert.calibratedAt,
        srfNumber: cert.srfNumber,
        srfDate: cert.srfDate?.toISOString() || null,
        dateOfCalibration: cert.dateOfCalibration?.toISOString() || null,
        calibrationDueDate: cert.calibrationDueDate?.toISOString() || null,
        dueDateNotApplicable: cert.dueDateNotApplicable,
        uucDescription: cert.uucDescription,
        uucMake: cert.uucMake,
        uucModel: cert.uucModel,
        uucSerialNumber: cert.uucSerialNumber,
        uucLocationName: cert.uucLocationName,
        ambientTemperature: cert.ambientTemperature,
        relativeHumidity: cert.relativeHumidity,
        calibrationStatus,
        conclusionStatements,
        additionalConclusionStatement: cert.additionalConclusionStatement,
        currentRevision: cert.currentRevision,
        createdAt: cert.createdAt.toISOString(),
        updatedAt: cert.updatedAt.toISOString(),
        parameters: cert.parameters.map((p) => ({
          id: p.id,
          parameterName: p.parameterName,
          parameterUnit: p.parameterUnit,
          rangeMin: p.rangeMin,
          rangeMax: p.rangeMax,
          rangeUnit: p.rangeUnit,
          operatingMin: p.operatingMin,
          operatingMax: p.operatingMax,
          operatingUnit: p.operatingUnit,
          leastCountValue: p.leastCountValue,
          leastCountUnit: p.leastCountUnit,
          accuracyValue: p.accuracyValue,
          accuracyUnit: p.accuracyUnit,
          accuracyType: p.accuracyType,
          errorFormula: p.errorFormula,
          showAfterAdjustment: p.showAfterAdjustment,
          requiresBinning: p.requiresBinning,
          bins: p.bins,
          sopReference: p.sopReference,
          results: p.results.map((r) => ({
            id: r.id,
            pointNumber: r.pointNumber,
            standardReading: r.standardReading,
            beforeAdjustment: r.beforeAdjustment,
            afterAdjustment: r.afterAdjustment,
            errorObserved: r.errorObserved,
            isOutOfLimit: r.isOutOfLimit,
          })),
        })),
        masterInstruments: cert.masterInstruments.map((mi) => ({
          id: mi.id,
          description: mi.description,
          make: mi.make,
          model: mi.model,
          serialNumber: mi.serialNumber,
          calibrationDueDate: mi.calibrationDueDate,
        })),
      }}
      assignee={{
        id: cert.createdBy.id,
        name: cert.createdBy.name || 'Unknown',
        email: cert.createdBy.email,
      }}
      reviewer={cert.reviewer ? {
        id: cert.reviewer.id,
        name: cert.reviewer.name || 'Unknown',
        email: cert.reviewer.email,
      } : null}
      feedbacks={serializedFeedbacks}
      events={serializedEvents}
      currentlyUnlockedSections={currentlyUnlockedSections}
    />
  )
}
