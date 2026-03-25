import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { ReviewerPageClient } from './ReviewerPageClient'

// Status badge configuration
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-amber-50 text-amber-600 border-amber-100' },
  PENDING_REVIEW: { label: 'Pending Review', className: 'bg-blue-50 text-blue-600 border-blue-100' },
  REVISION_REQUIRED: { label: 'Revision Required', className: 'bg-orange-50 text-orange-600 border-orange-100' },
  CUSTOMER_REVISION_REQUIRED: { label: 'Customer Feedback', className: 'bg-purple-50 text-purple-600 border-purple-100' },
  PENDING_CUSTOMER_APPROVAL: { label: 'Pending Customer', className: 'bg-purple-50 text-purple-600 border-purple-100' },
  PENDING_ADMIN_AUTHORIZATION: { label: 'Pending Authorization', className: 'bg-indigo-50 text-indigo-600 border-indigo-100' },
  APPROVED: { label: 'Approved', className: 'bg-green-50 text-green-600 border-green-100' },
  AUTHORIZED: { label: 'Authorized', className: 'bg-green-50 text-green-600 border-green-100' },
  REJECTED: { label: 'Rejected', className: 'bg-red-50 text-red-600 border-red-100' },
}

interface Props {
  params: Promise<{ id: string }>
}

async function getCertificateDetails(id: string, userId: string, userRole: string) {
  const certificate = await prisma.certificate.findUnique({
    where: { id },
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
      chatThreads: {
        where: { threadType: 'ASSIGNEE_REVIEWER' },
        include: {
          messages: {
            orderBy: { createdAt: 'desc' },
            take: 1,
          },
        },
      },
    },
  })

  // Admins can view any certificate, others must be the assigned reviewer
  if (certificate && userRole !== 'ADMIN' && certificate.reviewerId !== userId) {
    return null
  }

  return certificate
}

// Calculate TAT (Turn Around Time) from submission
function calculateTAT(submittedAt: Date | null): { hours: number; status: 'ok' | 'warning' | 'overdue' } {
  if (!submittedAt) {
    return { hours: 0, status: 'ok' }
  }

  const now = new Date()
  const diffMs = now.getTime() - submittedAt.getTime()
  const hours = Math.floor(diffMs / (1000 * 60 * 60))

  // Define thresholds (adjust as needed)
  if (hours > 48) {
    return { hours, status: 'overdue' }
  } else if (hours > 24) {
    return { hours, status: 'warning' }
  }
  return { hours, status: 'ok' }
}

function formatTAT(hours: number): string {
  if (hours < 24) {
    return `${hours}h`
  }
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  if (remainingHours === 0) {
    return `${days}d`
  }
  return `${days}d ${remainingHours}h`
}

export default async function ReviewerReviewPage({ params }: Props) {
  const { id } = await params
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  const certificate = await getCertificateDetails(id, session.user.id, session.user.role || '')

  if (!certificate) {
    notFound()
  }

  // Calculate TAT using createdAt since submittedAt might not be available
  const tat = calculateTAT(certificate.updatedAt)

  // Parse conclusion statements
  const conclusionStatements = certificate.selectedConclusionStatements
    ? JSON.parse(certificate.selectedConclusionStatements)
    : []

  // Parse calibration status
  const calibrationStatus = certificate.calibrationStatus
    ? JSON.parse(certificate.calibrationStatus)
    : []

  // Get chat thread if exists
  const chatThread = certificate.chatThreads[0] || null

  // Get latest customer feedback (show in timeline for its respective revision)
  let customerFeedback: {
    notes: string
    sectionFeedbacks: { section: string; comment: string }[] | null
    generalNotes: string | null
    customerName: string
    customerEmail: string
    requestedAt: string
    revision: number
  } | null = null

  // Fetch the most recent customer feedback event (regardless of revision)
  const latestCustomerEvent = await prisma.certificateEvent.findFirst({
    where: {
      certificateId: certificate.id,
      eventType: 'CUSTOMER_REVISION_REQUESTED',
    },
    orderBy: { createdAt: 'desc' },
  })

  if (latestCustomerEvent?.eventData) {
    try {
      const eventData = JSON.parse(latestCustomerEvent.eventData)
      customerFeedback = {
        notes: eventData.notes || '',
        sectionFeedbacks: eventData.sectionFeedbacks || null,
        generalNotes: eventData.generalNotes || null,
        customerName: eventData.customerName || 'Customer',
        customerEmail: eventData.customerEmail || '',
        requestedAt: eventData.requestedAt || latestCustomerEvent.createdAt.toISOString(),
        revision: latestCustomerEvent.revision,
      }
    } catch {
      // Fallback to statusNotes if event data parsing fails
      customerFeedback = {
        notes: certificate.statusNotes || '',
        sectionFeedbacks: null,
        generalNotes: null,
        customerName: 'Customer',
        customerEmail: '',
        requestedAt: latestCustomerEvent.createdAt.toISOString(),
        revision: latestCustomerEvent.revision,
      }
    }
  }

  // Serialize feedbacks for client
  const serializedFeedbacks = certificate.feedbacks.map((f: typeof certificate.feedbacks[number]) => ({
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

  // Get status config
  const statusConfig = STATUS_CONFIG[certificate.status] || STATUS_CONFIG.PENDING_REVIEW

  // Prepare header data for client component
  const headerData = {
    certificateNumber: certificate.certificateNumber,
    status: certificate.status,
    statusLabel: statusConfig.label,
    statusClassName: statusConfig.className,
    tat,
    assigneeName: certificate.createdBy.name || 'Unknown',
    customerName: certificate.customerName || '-',
    calibratedAt: certificate.calibratedAt,
    currentRevision: certificate.currentRevision,
  }

  return (
    <ReviewerPageClient
      certificate={{
        id: certificate.id,
        certificateNumber: certificate.certificateNumber,
        status: certificate.status,
        customerName: certificate.customerName,
        customerAddress: certificate.customerAddress,
        calibratedAt: certificate.calibratedAt,
        srfNumber: certificate.srfNumber,
        srfDate: certificate.srfDate?.toISOString() || null,
        dateOfCalibration: certificate.dateOfCalibration?.toISOString() || null,
        calibrationDueDate: certificate.calibrationDueDate?.toISOString() || null,
        dueDateNotApplicable: certificate.dueDateNotApplicable,
        uucDescription: certificate.uucDescription,
        uucMake: certificate.uucMake,
        uucModel: certificate.uucModel,
        uucSerialNumber: certificate.uucSerialNumber,
        uucLocationName: certificate.uucLocationName,
        ambientTemperature: certificate.ambientTemperature,
        relativeHumidity: certificate.relativeHumidity,
        calibrationStatus,
        conclusionStatements,
        additionalConclusionStatement: certificate.additionalConclusionStatement,
        currentRevision: certificate.currentRevision,
        parameters: certificate.parameters.map((p) => ({
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
        masterInstruments: certificate.masterInstruments.map((mi) => ({
          id: mi.id,
          description: mi.description,
          make: mi.make,
          model: mi.model,
          serialNumber: mi.serialNumber,
          calibrationDueDate: mi.calibrationDueDate,
        })),
      }}
      assignee={{
        id: certificate.createdBy.id,
        name: certificate.createdBy.name || 'Unknown',
        email: certificate.createdBy.email,
      }}
      feedbacks={serializedFeedbacks}
      chatThreadId={chatThread?.id || null}
      headerData={headerData}
      userRole={session.user.role || ''}
      customerFeedback={customerFeedback}
    />
  )
}
