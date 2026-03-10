'use client'

import { useState } from 'react'
import { CustomerCertificateHeader } from './CustomerCertificateHeader'
import { CustomerCertificateContent } from './CustomerCertificateContent'
import { CustomerApprovalActions } from './CustomerApprovalActions'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
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
  parameters: Parameter[]
  masterInstruments: MasterInstrument[]
}

export interface Signature {
  id: string
  signerType: string
  signerName: string
  signedAt: string | null
}

export interface CustomerData {
  id: string
  name: string
  email: string
  companyName: string
}

export interface HeaderData {
  certificateNumber: string
  status: string
  statusLabel: string
  statusClassName: string
  customerName: string
  currentRevision: number
  dateOfCalibration: string | null
}

interface CustomerCertReviewClientProps {
  certificate: CertificateData
  customer: CustomerData
  signatures: Signature[]
  chatThreadId: string | null
  headerData: HeaderData
}

export function CustomerCertReviewClient({
  certificate,
  customer,
  signatures,
  chatThreadId,
  headerData,
}: CustomerCertReviewClientProps) {
  // View mode state: 'details' shows certificate content, 'pdf' shows PDF preview
  const [viewMode, setViewMode] = useState<'details' | 'pdf'>('details')

  // Collapsible panel states
  const [isChatExpanded, setIsChatExpanded] = useState(true)
  const [isActionsExpanded, setIsActionsExpanded] = useState(true)

  // Check if customer can take action
  const canApprove = certificate.status === 'PENDING_CUSTOMER_APPROVAL' || certificate.status === 'CUSTOMER_REVISION_REQUIRED'

  return (
    <div className="flex h-full bg-slate-100 p-3 gap-3">
      {/* Left Side - Header + Content (Scrollable) */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        {/* Certificate Card - Bounding Box */}
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header Section - Fixed at top of content area */}
          <CustomerCertificateHeader
            headerData={headerData}
            viewMode={viewMode}
            onViewModeChange={setViewMode}
          />

          {/* Content Area - Scrollable */}
          <div className="flex-1 overflow-auto bg-slate-50/30">
            {viewMode === 'details' ? (
              <div className="p-6 space-y-6">
                <CustomerCertificateContent
                  certificate={certificate}
                  signatures={signatures}
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

      {/* Right Panel - Collapsible Chat & Actions */}
      <div className="w-[380px] flex-shrink-0 flex flex-col gap-3 overflow-y-auto">
        {/* ===== CHAT SECTION ===== */}
        <div className={cn(
          'flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden',
          isChatExpanded ? 'flex-1 min-h-0' : 'flex-shrink-0'
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
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Discussion</span>
            </div>
          </button>

          {/* Chat Content - Only when expanded */}
          {isChatExpanded && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Reviewer Info Header */}
              <div className="flex-shrink-0 px-4 py-3 border-t border-b border-slate-100 bg-slate-50/50">
                <div className="flex items-center gap-3">
                  {/* Avatar */}
                  <div className="size-10 rounded-full bg-blue-600 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
                    HTA
                  </div>
                  {/* Name & Status */}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-slate-900 truncate">
                      HTA Calibration Team
                    </p>
                    <p className="text-xs text-slate-500">
                      Certificate Review Discussion
                    </p>
                  </div>
                </div>
              </div>

              {/* Chat Messages Area */}
              <div className="flex-1 min-h-0 overflow-hidden text-xs">
                <ChatSidebar
                  isOpen={true}
                  onClose={() => {}}
                  certificateId={certificate.id}
                  threadType="REVIEWER_CUSTOMER"
                  embedded={true}
                />
              </div>
            </div>
          )}
        </div>

        {/* ===== REVIEW ACTIONS SECTION ===== */}
        <div className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-shrink-0">
          {/* Actions Header - Collapsible */}
          <button
            onClick={() => setIsActionsExpanded(!isActionsExpanded)}
            className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors"
          >
            <div className="flex items-center gap-2">
              {isActionsExpanded ? (
                <ChevronDown className="size-4 text-slate-400" />
              ) : (
                <ChevronRight className="size-4 text-slate-400" />
              )}
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Your Actions</span>
            </div>
          </button>

          {/* Actions Content - Only when expanded */}
          {isActionsExpanded && (
            <div className="border-t border-slate-100">
              <CustomerApprovalActions
                certificate={certificate}
                customer={customer}
                signatures={signatures}
                canApprove={canApprove}
              />
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
