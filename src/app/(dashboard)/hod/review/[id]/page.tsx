import { redirect, notFound } from 'next/navigation'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { Header } from '@/components/layout/Header'
import { StatusBadge } from '@/components/dashboard/StatusBadge'
import { ReviewPageWrapper } from './ReviewPageWrapper'
import { ReviewPageClient } from './ReviewPageClient'
import { ArrowLeft, Shield, FileText } from 'lucide-react'
import Link from 'next/link'
import { CONCLUSION_STATEMENTS } from '@/components/pdf/pdf-utils'
import { cn } from '@/lib/utils'

interface Props {
  params: Promise<{ id: string }>
}

async function getCertificateDetails(id: string) {
  const certificate = await prisma.certificate.findUnique({
    where: { id },
    include: {
      createdBy: {
        select: { name: true, email: true },
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
          event: {
            select: { id: true, createdAt: true },
          },
        },
      },
      events: {
        where: { eventType: 'HOD_DATE_OVERRIDE' },
        orderBy: { createdAt: 'desc' },
        include: {
          user: {
            select: { name: true, role: true },
          },
        },
      },
    },
  })

  return certificate
}

// Fetch all customer-related events for the sidebar
async function getCustomerEvents(certificateId: string) {
  const events = await prisma.certificateEvent.findMany({
    where: {
      certificateId,
      eventType: {
        in: [
          'SENT_TO_CUSTOMER',
          'CUSTOMER_REVISION_REQUESTED',
          'CUSTOMER_APPROVED',
          'CUSTOMER_REVISION_FORWARDED',
        ],
      },
    },
    orderBy: { createdAt: 'desc' },
    include: {
      user: {
        select: { name: true, role: true },
      },
    },
  })

  return events.map(event => {
    let eventData = {}
    try {
      eventData = JSON.parse(event.eventData)
    } catch {
      eventData = {}
    }
    return {
      id: event.id,
      eventType: event.eventType,
      eventData,
      createdAt: event.createdAt.toISOString(),
      revision: event.revision,
      user: event.user ? { name: event.user.name, role: event.user.role } : undefined,
    }
  })
}

// Fetch customer revision feedback for CUSTOMER_REVISION_REQUIRED status
async function getCustomerRevisionFeedback(certificateId: string) {
  // Get the CUSTOMER_REVISION_REQUESTED event
  const event = await prisma.certificateEvent.findFirst({
    where: {
      certificateId,
      eventType: 'CUSTOMER_REVISION_REQUESTED',
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  if (!event) {
    return null
  }

  try {
    const eventData = JSON.parse(event.eventData)
    return {
      notes: eventData.notes || '',
      customerEmail: eventData.customerEmail,
      customerName: eventData.customerName,
      customerCompany: eventData.customerCompany,
      requestedAt: eventData.requestedAt || event.createdAt.toISOString(),
    }
  } catch {
    return null
  }
}

// Fetch customer status for the certificate
async function getCustomerStatus(certificateId: string) {
  // Get the latest active token for this certificate
  const activeToken = await prisma.approvalToken.findFirst({
    where: {
      certificateId,
      usedAt: null,
      expiresAt: {
        gt: new Date(),
      },
    },
    include: {
      customer: true,
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  // Get the sent event
  const sentEvent = await prisma.certificateEvent.findFirst({
    where: {
      certificateId,
      eventType: 'SENT_TO_CUSTOMER',
    },
    orderBy: {
      createdAt: 'desc',
    },
  })

  // Get approval event
  const approvalEvent = await prisma.certificateEvent.findFirst({
    where: {
      certificateId,
      eventType: 'HOD_APPROVED',
    },
    orderBy: {
      createdAt: 'desc',
    },
    include: {
      user: {
        select: { name: true },
      },
    },
  })

  if (!activeToken) {
    return {
      sent: false,
      sentTo: null,
      token: null,
      reviewUrl: null,
      message: null,
      approvedAt: approvalEvent?.createdAt.toISOString() || null,
      approvedBy: approvalEvent?.user?.name || null,
    }
  }

  const eventData = sentEvent ? JSON.parse(sentEvent.eventData) : null
  const baseUrl = process.env.NEXT_PUBLIC_APP_URL || 'http://localhost:3000'

  return {
    sent: true,
    sentTo: {
      email: activeToken.customer.email,
      name: activeToken.customer.name,
      sentAt: sentEvent?.createdAt.toISOString() || activeToken.createdAt.toISOString(),
    },
    token: {
      token: activeToken.token,
      expiresAt: activeToken.expiresAt.toISOString(),
    },
    reviewUrl: `${baseUrl}/customer/review/${activeToken.token}`,
    message: eventData?.message || null,
    approvedAt: approvalEvent?.createdAt.toISOString() || null,
    approvedBy: approvalEvent?.user?.name || null,
  }
}

// Individual edit type
interface HoDEdit {
  field: string
  fieldLabel: string
  previousValue: string | null
  newValue: string
  reason: string
  autoCalculated: boolean
}

// Helper to merge date adjustments with feedbacks
function mergeDateAdjustmentsWithFeedbacks(
  feedbacks: Array<{
    id: string
    feedbackType: string
    comment: string | null
    createdAt: Date
    revisionNumber: number
    user: { name: string; role: string }
    event?: { id: string; createdAt: Date } | null
  }>,
  dateEvents: Array<{
    id: string
    eventData: string
    createdAt: Date
    revision: number
    user: { name: string; role: string }
  }>
) {
  // Create a map of event times to date adjustments with individual edits
  const dateAdjustmentMap = new Map<string, {
    edits: HoDEdit[]
  }>()

  dateEvents.forEach((event) => {
    try {
      const data = JSON.parse(event.eventData)
      const eventTime = new Date(event.createdAt).getTime()

      // Extract edits array (new format) or construct from legacy format
      let edits: HoDEdit[] = []

      if (data.edits && Array.isArray(data.edits)) {
        // New format with individual edits
        edits = data.edits.map((edit: {
          field: string
          fieldLabel: string
          previousValue: string | null
          newValue: string
          reason: string
          autoCalculated?: boolean
        }) => ({
          field: edit.field,
          fieldLabel: edit.fieldLabel,
          previousValue: edit.previousValue,
          newValue: edit.newValue,
          reason: edit.reason,
          autoCalculated: edit.autoCalculated || false,
        }))
      } else {
        // Legacy format - construct edits from flat fields
        if (data.newDateOfCalibration) {
          edits.push({
            field: 'dateOfCalibration',
            fieldLabel: 'Date of Calibration',
            previousValue: data.previousDateOfCalibration,
            newValue: data.newDateOfCalibration,
            reason: data.reason || '',
            autoCalculated: false,
          })
        }
        if (data.newDueDate) {
          edits.push({
            field: 'calibrationDueDate',
            fieldLabel: 'Calibration Due Date',
            previousValue: data.previousDueDate,
            newValue: data.newDueDate,
            reason: data.newDateOfCalibration ? 'Auto-adjusted based on Date of Calibration change' : data.reason || '',
            autoCalculated: !!data.newDateOfCalibration,
          })
        }
      }

      dateAdjustmentMap.set(eventTime.toString(), { edits })
    } catch (e) {
      console.error('Error parsing date event data:', e)
    }
  })

  // Match feedbacks with date adjustments by time proximity
  return feedbacks.map((feedback) => {
    const feedbackTime = new Date(feedback.createdAt).getTime()

    // Find a date adjustment within 10 seconds of this feedback
    let matchedAdjustment = null
    for (const [eventTimeStr, adjustment] of dateAdjustmentMap.entries()) {
      const eventTime = parseInt(eventTimeStr)
      if (Math.abs(feedbackTime - eventTime) < 10000) { // Within 10 seconds
        matchedAdjustment = adjustment
        dateAdjustmentMap.delete(eventTimeStr) // Remove to prevent duplicate matching
        break
      }
    }

    // Strip "[HoD Edits Applied]" section from comment if edits are shown separately
    let cleanComment = feedback.comment
    if (matchedAdjustment && cleanComment) {
      const editsSectionIndex = cleanComment.indexOf('[HoD Edits Applied]')
      if (editsSectionIndex !== -1) {
        cleanComment = cleanComment.substring(0, editsSectionIndex).trim()
      }
    }

    return {
      id: feedback.id,
      feedbackType: feedback.feedbackType,
      comment: cleanComment,
      createdAt: feedback.createdAt.toISOString(),
      revisionNumber: feedback.revisionNumber,
      user: {
        name: feedback.user.name,
        role: feedback.user.role,
      },
      hodEdits: matchedAdjustment?.edits || null,
    }
  })
}

// Status color mapping for header
const STATUS_COLORS: Record<string, { bg: string; border: string; text: string }> = {
  DRAFT: { bg: 'bg-gray-50', border: 'border-gray-200', text: 'text-gray-700' },
  PENDING_HOD_REVIEW: { bg: 'bg-amber-50', border: 'border-amber-200', text: 'text-amber-700' },
  REVISION_REQUIRED: { bg: 'bg-orange-50', border: 'border-orange-200', text: 'text-orange-700' },
  PENDING_CUSTOMER_APPROVAL: { bg: 'bg-blue-50', border: 'border-blue-200', text: 'text-blue-700' },
  CUSTOMER_REVISION_REQUIRED: { bg: 'bg-purple-50', border: 'border-purple-200', text: 'text-purple-700' },
  APPROVED: { bg: 'bg-green-50', border: 'border-green-200', text: 'text-green-700' },
  REJECTED: { bg: 'bg-red-50', border: 'border-red-200', text: 'text-red-700' },
}

export default async function HoDReviewPage({ params }: Props) {
  const { id } = await params
  const session = await auth()

  if (!session?.user) {
    redirect('/login')
  }

  if (session.user.role !== 'HOD' && session.user.role !== 'ADMIN') {
    redirect('/dashboard')
  }

  const certificate = await getCertificateDetails(id)

  if (!certificate) {
    notFound()
  }

  // Fetch customer status for certificates in PENDING_CUSTOMER_APPROVAL status
  const customerStatus = certificate.status === 'PENDING_CUSTOMER_APPROVAL'
    ? await getCustomerStatus(id)
    : null

  // Fetch customer revision feedback for certificates in CUSTOMER_REVISION_REQUIRED status
  const customerRevisionFeedback = certificate.status === 'CUSTOMER_REVISION_REQUIRED'
    ? await getCustomerRevisionFeedback(id)
    : null

  // Fetch customer events for the customer history sidebar
  const customerEvents = await getCustomerEvents(id)

  const statusColors = STATUS_COLORS[certificate.status] || STATUS_COLORS.DRAFT

  // Merge date adjustments with feedbacks
  const mergedFeedbacks = mergeDateAdjustmentsWithFeedbacks(
    certificate.feedbacks,
    certificate.events
  )

  return (
    <div className="min-h-screen bg-gray-100">
      <Header title="Review Certificate" showAutoSave={false} />

      <main className="w-full px-4 sm:px-6 lg:px-8 xl:px-12 py-6">
        {/* Back Link */}
        <Link
          href="/hod/dashboard"
          className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-4 font-medium"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Link>

        {/* Certificate Header Card */}
        <div
          className={cn(
            'rounded-2xl border-2 p-6 mb-6 shadow-sm',
            statusColors.bg,
            statusColors.border
          )}
        >
          <div className="flex flex-col md:flex-row md:items-center justify-between gap-4">
            <div className="flex items-start gap-4">
              <div className={cn('p-3 rounded-xl bg-white shadow-sm', statusColors.border)}>
                <FileText className={cn('h-8 w-8', statusColors.text)} />
              </div>
              <div>
                <div className="flex items-center gap-3 mb-1">
                  <h1 className="text-2xl font-bold text-gray-900">
                    {certificate.certificateNumber}
                  </h1>
                  <StatusBadge status={certificate.status} />
                </div>
                <p className="text-gray-500 text-sm">
                  Revision {certificate.currentRevision} • Created by{' '}
                  <span className="font-medium text-gray-700">{certificate.createdBy.name}</span>
                </p>
              </div>
            </div>

            {/* Quick Info Pills */}
            <div className="flex flex-wrap gap-2">
              <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-gray-200 text-gray-700">
                <Shield className="h-3.5 w-3.5" />
                {certificate.calibratedAt === 'LAB' ? 'Lab Calibration' : 'Site Calibration'}
              </span>
              {certificate.srfNumber && (
                <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-gray-200 text-gray-700">
                  SRF: {certificate.srfNumber}
                </span>
              )}
            </div>
          </div>
        </div>

        {/* Main Content Grid - Client Wrapper for state sharing */}
        <ReviewPageWrapper
          certificate={certificate}
          feedbacks={mergedFeedbacks}
          conclusionStatements={CONCLUSION_STATEMENTS}
          customerStatus={customerStatus}
          customerRevisionFeedback={customerRevisionFeedback}
          customerEvents={customerEvents}
        />

        {/* Feedback History Sidebars - Client Component */}
        <ReviewPageClient
          feedbacks={mergedFeedbacks}
          customerEvents={customerEvents}
          currentRevision={certificate.currentRevision}
        />
      </main>
    </div>
  )
}
