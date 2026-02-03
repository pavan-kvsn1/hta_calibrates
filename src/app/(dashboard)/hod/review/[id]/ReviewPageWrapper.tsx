'use client'

import { useState, useCallback } from 'react'
import { ReviewActions, PendingEdit } from './ReviewActions'
import { ReviewContent } from './ReviewContent'

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
  ambientTemperature: string | null
  relativeHumidity: string | null
  calibrationStatus: string | null
  stickerOldRemoved: string | null
  stickerNewAffixed: string | null
  statusNotes: string | null
  selectedConclusionStatements: string | null
  parameters: Array<{
    id: string
    parameterName: string
    parameterUnit: string | null
    accuracyValue: string | null
    accuracyUnit: string | null
    accuracyType: string | null
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
    description: string | null
    make: string | null
    model: string | null
    serialNumber: string | null
    calibrationDueDate: string | null
  }>
  createdBy: {
    name: string
  }
  updatedAt: Date
}

interface ReviewPageWrapperProps {
  certificate: Certificate
  feedbacks: Feedback[]
  conclusionStatements: Record<string, { id: string; text: string }[]>
}

export function ReviewPageWrapper({
  certificate,
  feedbacks,
  conclusionStatements,
}: ReviewPageWrapperProps) {
  const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([])

  const handlePendingEditsChange = useCallback((edits: PendingEdit[]) => {
    setPendingEdits(edits)
  }, [])

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
        />
      </div>

      {/* Edit & Review Actions - Right Column */}
      <div className="w-full xl:flex-1">
        <div className="sticky top-[80px]">
          <ReviewActions
            certificateId={certificate.id}
            currentStatus={certificate.status}
            feedbacks={feedbacks}
            dateOfCalibration={certificate.dateOfCalibration?.toISOString() || null}
            calibrationDueDate={certificate.calibrationDueDate?.toISOString() || null}
            calibrationTenure={certificate.calibrationTenure || 12}
            dueDateAdjustment={certificate.dueDateAdjustment || 0}
            onPendingEditsChange={handlePendingEditsChange}
          />
        </div>
      </div>
    </div>
  )
}
