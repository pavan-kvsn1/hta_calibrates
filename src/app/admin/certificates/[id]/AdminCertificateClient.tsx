'use client'

import { useState } from 'react'
import { AdminCertificateHeader } from './AdminCertificateHeader'
import { AdminCertificateContent } from './AdminCertificateContent'
import { AdminHistorySection } from './AdminHistorySection'
import { AdminChatPanel } from './AdminChatPanel'
import { AdminEditPanel } from './AdminEditPanel'
import { AdminReviewActions } from './AdminReviewActions'
import { InlinePDFViewer } from '@/app/(dashboard)/dashboard/reviewer/[id]/InlinePDFViewer'
import { cn } from '@/lib/utils'
import { ChevronDown, ChevronRight } from 'lucide-react'

interface Parameter {
  id: string
  parameterName: string
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
  accuracyType: string
  errorFormula: string
  showAfterAdjustment: boolean
  requiresBinning: boolean
  bins: string | null
  sopReference: string | null
  results: {
    id: string
    pointNumber: number
    standardReading: string | null
    beforeAdjustment: string | null
    afterAdjustment: string | null
    errorObserved: number | null
    isOutOfLimit: boolean
  }[]
}

interface MasterInstrument {
  id: string
  description: string | null
  make: string | null
  model: string | null
  serialNumber: string | null
  calibrationDueDate: string | null
}

export interface CertificateData {
  id: string
  certificateNumber: string
  status: string
  customerName: string | null
  customerAddress: string | null
  calibratedAt: string | null
  srfNumber: string | null
  srfDate: string | null
  dateOfCalibration: string | null
  calibrationDueDate: string | null
  dueDateNotApplicable: boolean
  uucDescription: string | null
  uucMake: string | null
  uucModel: string | null
  uucSerialNumber: string | null
  uucLocationName: string | null
  ambientTemperature: string | null
  relativeHumidity: string | null
  calibrationStatus: string[]
  conclusionStatements: string[]
  additionalConclusionStatement: string | null
  currentRevision: number
  createdAt: string
  updatedAt: string
  parameters: Parameter[]
  masterInstruments: MasterInstrument[]
}

export interface Assignee {
  id: string
  name: string
  email: string
}

export interface Reviewer {
  id: string
  name: string
  email: string
}

export interface Feedback {
  id: string
  feedbackType: string
  comment: string | null
  createdAt: string
  revisionNumber: number
  targetSection: string | null
  user: {
    name: string | null
    role: string
  }
}

export interface CertificateEvent {
  id: string
  sequenceNumber: number
  revision: number
  eventType: string
  eventData: string
  userRole: string
  createdAt: string
  user: {
    id: string
    name: string | null
    role: string
  } | null
  customer: {
    id: string
    name: string | null
    email: string
  } | null
}

export interface HeaderData {
  certificateNumber: string
  status: string
  statusLabel: string
  statusClassName: string
  tat: { hours: number; status: 'ok' | 'warning' | 'overdue' }
  assigneeName: string
  customerName: string
  calibratedAt: string | null
  currentRevision: number
}

interface AdminCertificateClientProps {
  certificate: CertificateData
  assignee: Assignee
  reviewer: Reviewer | null
  feedbacks: Feedback[]
  events: CertificateEvent[]
  chatThreadIds: {
    engineer: string | null
    customer: string | null
  }
  headerData: HeaderData
  reviewers: Reviewer[]
}

export function AdminCertificateClient({
  certificate,
  assignee,
  reviewer,
  feedbacks,
  events,
  chatThreadIds,
  headerData,
  reviewers,
}: AdminCertificateClientProps) {
  // View mode state: 'details' shows certificate content, 'pdf' shows PDF preview
  const [viewMode, setViewMode] = useState<'details' | 'pdf'>('details')

  // Collapsible panel states
  const [isChatExpanded, setIsChatExpanded] = useState(true)
  const [isEditExpanded, setIsEditExpanded] = useState(true)
  const [isReviewExpanded, setIsReviewExpanded] = useState(true)

  return (
    <div className="flex h-full bg-slate-100 p-3 gap-3">
      {/* Left Side - Header + Content (Scrollable) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Certificate Card - Bounding Box */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header Section - Fixed at top of content area */}
          <AdminCertificateHeader
            headerData={headerData}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />

          {/* Content Area - Scrollable */}
          <div className="flex-1 overflow-auto bg-slate-50/30">
            {viewMode === 'details' ? (
              <div className="p-6 space-y-6">
                <AdminCertificateContent
                  certificate={certificate}
                  assignee={assignee}
                />
                <AdminHistorySection
                  feedbacks={feedbacks}
                  events={events}
                  currentRevision={certificate.currentRevision}
                />
              </div>
            ) : (
              <InlinePDFViewer
                certificateId={certificate.id}
                certificateNumber={certificate.certificateNumber}
              />
            )}
          </div>
        </div>
      </div>

      {/* Right Panel - Collapsible Chat, Edit & Review */}
      <div className="w-[380px] flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
        {/* Chat Section */}
        <div className={cn(
          'flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden',
          isChatExpanded ? 'min-h-[730px] max-h-[1000px]' : 'flex-shrink-0'
        )}>
          {/* Chat Header - Collapsible */}
          <button
            onClick={() => setIsChatExpanded(!isChatExpanded)}
            className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {isChatExpanded ? (
                <ChevronDown className="size-4 text-slate-400" />
              ) : (
                <ChevronRight className="size-4 text-slate-400" />
              )}
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Chat</span>
            </div>
            {!isChatExpanded && (
              <div className="flex items-center gap-2 text-xs text-slate-500">
                <span>Eng</span>
                <span>|</span>
                <span>Cust</span>
              </div>
            )}
          </button>

          {/* Chat Content - Only when expanded */}
          {isChatExpanded && (
            <div className="flex-1 min-h-0 border-t border-slate-100">
              <AdminChatPanel
                certificateId={certificate.id}
                assignee={assignee}
                customerName={certificate.customerName}
              />
            </div>
          )}
        </div>

        {/* Edit Section */}
        <div className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-shrink-0">
          {/* Edit Header - Collapsible */}
          <button
            onClick={() => setIsEditExpanded(!isEditExpanded)}
            className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {isEditExpanded ? (
                <ChevronDown className="size-4 text-slate-400" />
              ) : (
                <ChevronRight className="size-4 text-slate-400" />
              )}
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Edit Actions</span>
            </div>
          </button>

          {/* Edit Content - Only when expanded */}
          {isEditExpanded && (
            <div className="border-t border-slate-100">
              <AdminEditPanel
                certificate={certificate}
                reviewer={reviewer}
                reviewers={reviewers}
                events={events}
              />
            </div>
          )}
        </div>

        {/* Review Actions Section */}
        <div className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-shrink-0">
          {/* Review Header - Collapsible */}
          <button
            onClick={() => setIsReviewExpanded(!isReviewExpanded)}
            className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {isReviewExpanded ? (
                <ChevronDown className="size-4 text-slate-400" />
              ) : (
                <ChevronRight className="size-4 text-slate-400" />
              )}
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Review Actions</span>
            </div>
          </button>

          {/* Review Content - Only when expanded */}
          {isReviewExpanded && (
            <div className="border-t border-slate-100">
              <AdminReviewActions
                certificate={certificate}
                assignee={assignee}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
