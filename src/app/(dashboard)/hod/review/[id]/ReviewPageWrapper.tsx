'use client'

import { useState, useCallback } from 'react'
import { ReviewActions, PendingEdit } from './ReviewActions'
import { ReviewContent } from './ReviewContent'
import { CustomerShareSection } from './CustomerShareSection'
import { SentToCustomerStatus } from './SentToCustomerStatus'
import { CustomerRevisionStatus } from './CustomerRevisionStatus'

interface HoDEdit {
  field: string
  fieldLabel: string
  previousValue: string | null
  newValue: string
  reason: string
  autoCalculated: boolean
}

interface Feedback {
  id: string
  feedbackType: string
  comment: string | null
  createdAt: string
  revisionNumber: number
  user: {
    name: string
    role: string
  }
  hodEdits?: HoDEdit[] | null
}

interface CustomerStatus {
  sent: boolean
  sentTo: {
    email: string
    name: string
    sentAt: string
  } | null
  token: {
    token: string
    expiresAt: string
  } | null
  reviewUrl: string | null
  message?: string | null
  approvedAt?: string | null
  approvedBy?: string | null
}

interface CustomerRevisionFeedback {
  notes: string
  customerEmail?: string
  customerName?: string
  customerCompany?: string
  requestedAt?: string
}

// Feedback item for timeline
interface FeedbackItem {
  id: string
  type: 'hod' | 'customer' | 'engineer'
  name: string
  company?: string
  message: string
  createdAt: string
}

interface Certificate {
  id: string
  certificateNumber: string
  status: string
  currentRevision: number
  calibratedAt: string | null
  srfNumber: string | null
  srfDate: Date | null
  dateOfCalibration: Date | null
  calibrationDueDate: Date | null
  calibrationTenure: number
  dueDateAdjustment: number
  dueDateNotApplicable: boolean
  customerName: string | null
  customerAddress: string | null
  uucDescription: string | null
  uucMake: string | null
  uucModel: string | null
  uucSerialNumber: string | null
  uucInstrumentId: string | null
  uucLocationName: string | null
  uucMachineName: string | null
  ambientTemperature: string | null
  relativeHumidity: string | null
  calibrationStatus: string | null
  stickerOldRemoved: string | null
  stickerNewAffixed: string | null
  statusNotes: string | null
  selectedConclusionStatements: string | null
  createdAt: Date
  parameters: Array<{
    id: string
    parameterName: string | null
    parameterUnit: string | null
    rangeMin: string | null
    rangeMax: string | null
    rangeUnit: string | null
    operatingMin: string | null
    operatingMax: string | null
    operatingUnit: string | null
    leastCountValue: string | null
    leastCountUnit: string | null
    accuracyValue: string | null
    accuracyUnit: string | null
    accuracyType: string | null
    errorFormula: string | null
    requiresBinning: boolean
    bins: string | null
    sopReference: string | null
    masterInstrumentId: string | null
    results: Array<{
      id: string
      pointNumber: number
      standardReading: string | null
      beforeAdjustment: string | null
      afterAdjustment: string | null
      errorObserved: number | null
      isOutOfLimit: boolean
    }>
  }>
  masterInstruments: Array<{
    id: string
    masterInstrumentId: string
    category: string | null
    description: string | null
    make: string | null
    model: string | null
    assetNo: string | null
    serialNumber: string | null
    calibratedAt: string | null
    reportNo: string | null
    calibrationDueDate: string | null
  }>
  createdBy: {
    name: string
    email: string
  }
  updatedAt: Date
  feedbacks: Array<{
    id: string
    comment: string
    targetSection: string | null
    createdAt: Date
    user: { name: string } | null
  }>
}

interface CustomerEvent {
  id: string
  eventType: string
  eventData: {
    notes?: string
    message?: string
    customerEmail?: string
    customerName?: string
    customerCompany?: string
    requestedAt?: string
    sentAt?: string
    approvedAt?: string
  }
  createdAt: string
  revision: number
  user?: {
    name: string
    role: string
  }
}

interface ReviewPageWrapperProps {
  certificate: Certificate
  feedbacks: Feedback[]
  conclusionStatements: Record<string, string>
  customerStatus: CustomerStatus | null
  customerRevisionFeedback: CustomerRevisionFeedback | null
  customerEvents?: CustomerEvent[]
}

export function ReviewPageWrapper({
  certificate,
  feedbacks,
  conclusionStatements,
  customerStatus,
  customerRevisionFeedback,
  customerEvents = [],
}: ReviewPageWrapperProps) {
  const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([])

  const handlePendingEditsChange = useCallback((edits: PendingEdit[]) => {
    setPendingEdits(edits)
  }, [])

  // Build version feedbacks for the current revision from feedbacks and customerEvents
  const buildVersionFeedbacks = useCallback((): FeedbackItem[] => {
    const items: FeedbackItem[] = []
    const currentRevision = certificate.currentRevision

    // Add HoD and Engineer feedbacks for current revision
    feedbacks.forEach((feedback) => {
      // Only include feedbacks from the current revision
      if (feedback.revisionNumber === currentRevision) {
        if (feedback.feedbackType === 'REVISION_REQUEST' || feedback.feedbackType === 'APPROVAL_NOTE') {
          items.push({
            id: feedback.id,
            type: 'hod',
            name: feedback.user.name,
            message: feedback.comment || '',
            createdAt: feedback.createdAt,
          })
        } else if (feedback.feedbackType === 'ENGINEER_RESPONSE') {
          items.push({
            id: feedback.id,
            type: 'engineer',
            name: feedback.user.name,
            message: feedback.comment || '',
            createdAt: feedback.createdAt,
          })
        } else if (feedback.feedbackType === 'CUSTOMER_REVISION_FORWARDED') {
          items.push({
            id: feedback.id,
            type: 'hod',
            name: feedback.user.name,
            message: feedback.comment || 'Forwarded customer feedback to engineer',
            createdAt: feedback.createdAt,
          })
        }
      }
    })

    // Add customer events for current revision
    customerEvents.forEach((event) => {
      if (event.revision === currentRevision) {
        if (event.eventType === 'CUSTOMER_REVISION_REQUESTED') {
          items.push({
            id: event.id,
            type: 'customer',
            name: event.eventData.customerName || 'Customer',
            company: event.eventData.customerCompany,
            message: event.eventData.notes || '',
            createdAt: event.createdAt,
          })
        } else if (event.eventType === 'SENT_TO_CUSTOMER' && event.user) {
          items.push({
            id: event.id,
            type: 'hod',
            name: event.user.name,
            message: event.eventData.message || 'Sent certificate for customer review',
            createdAt: event.createdAt,
          })
        }
      }
    })

    return items
  }, [feedbacks, customerEvents, certificate.currentRevision])

  const versionFeedbacks = buildVersionFeedbacks()

  // Render the right panel based on certificate status
  const renderRightPanel = () => {
    // Status: PENDING_HOD_REVIEW - Show Edit & Review Actions
    if (certificate.status === 'PENDING_HOD_REVIEW') {
      return (
        <ReviewActions
          certificateId={certificate.id}
          certificateNumber={certificate.certificateNumber}
          currentStatus={certificate.status}
          feedbacks={feedbacks}
          customerEvents={customerEvents}
          dateOfCalibration={certificate.dateOfCalibration?.toISOString() || null}
          calibrationDueDate={certificate.calibrationDueDate?.toISOString() || null}
          calibrationTenure={certificate.calibrationTenure || 12}
          dueDateAdjustment={certificate.dueDateAdjustment || 0}
          uucDescription={certificate.uucDescription}
          customerName={certificate.customerName}
          customerEmail={null}
          onPendingEditsChange={handlePendingEditsChange}
        />
      )
    }

    // Status: PENDING_CUSTOMER_APPROVAL
    if (certificate.status === 'PENDING_CUSTOMER_APPROVAL') {
      // If sent to customer, show sent status
      if (customerStatus?.sent && customerStatus.sentTo && customerStatus.token && customerStatus.reviewUrl) {
        return (
          <SentToCustomerStatus
            certificateId={certificate.id}
            certificateNumber={certificate.certificateNumber}
            uucDescription={certificate.uucDescription}
            sentTo={customerStatus.sentTo}
            token={customerStatus.token}
            reviewUrl={customerStatus.reviewUrl}
            message={customerStatus.message}
          />
        )
      }

      // Not sent yet, show send form
      return (
        <CustomerShareSection
          certificateId={certificate.id}
          certificateNumber={certificate.certificateNumber}
          uucDescription={certificate.uucDescription}
          customerName={certificate.customerName}
          customerEmail={null}
          approvedAt={customerStatus?.approvedAt}
          approvedBy={customerStatus?.approvedBy}
        />
      )
    }

    // Status: CUSTOMER_REVISION_REQUIRED
    if (certificate.status === 'CUSTOMER_REVISION_REQUIRED') {
      return (
        <CustomerRevisionStatus
          certificateId={certificate.id}
          certificateNumber={certificate.certificateNumber}
          customerFeedback={customerRevisionFeedback}
          statusNotes={certificate.statusNotes}
          dateOfCalibration={certificate.dateOfCalibration?.toISOString() || null}
          calibrationDueDate={certificate.calibrationDueDate?.toISOString() || null}
          calibrationTenure={certificate.calibrationTenure || 12}
          dueDateAdjustment={certificate.dueDateAdjustment || 0}
          feedbacks={feedbacks}
          customerEvents={customerEvents}
        />
      )
    }

    // Other statuses - show a placeholder or nothing
    return (
      <div className="bg-white rounded-lg border p-6">
        <p className="text-gray-500 text-center">
          No actions available for this status.
        </p>
      </div>
    )
  }

  return (
    <div className="flex flex-col xl:flex-row gap-6">
      {/* Certificate Details - Left Column */}
      <div className="w-full xl:w-[67%]">
        <ReviewContent
          certificate={certificate}
          conclusionStatements={conclusionStatements}
          feedbacks={feedbacks}
          currentRevision={certificate.currentRevision}
          pendingEdits={pendingEdits}
          customerRevisionFeedback={customerRevisionFeedback}
        />
      </div>

      {/* Right Column - Status-dependent */}
      <div className="w-full xl:flex-1">
        <div className="sticky top-[80px]">
          {renderRightPanel()}
        </div>
      </div>
    </div>
  )
}
