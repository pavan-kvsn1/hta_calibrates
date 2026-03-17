'use client'

import { useEffect, useState } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import {
  ArrowLeft,
  Download,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  ChevronRight,
  User,
  Building2,
  MapPin,
  AlertCircle,
  CheckCircle,
  MessageSquare,
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChatSidebar } from '@/components/chat/ChatSidebar'
import { cn } from '@/lib/utils'
import { getConclusionText } from '@/components/pdf/pdf-utils'
import { CALIBRATION_STATUS_OPTIONS } from '@/components/forms/RemarksSection'
import { FeedbackTimeline } from '@/components/feedback/shared'

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-slate-50 text-slate-700 border-slate-200' },
  PENDING_REVIEW: { label: 'Pending Review', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  REVISION_REQUIRED: { label: 'Revision Required', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  PENDING_CUSTOMER_APPROVAL: { label: 'Pending Customer', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  CUSTOMER_REVISION_REQUIRED: { label: 'Customer Revision', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  PENDING_ADMIN_AUTHORIZATION: { label: 'Pending Authorization', className: 'bg-indigo-50 text-indigo-700 border-indigo-200' },
  APPROVED: { label: 'Approved', className: 'bg-green-50 text-green-700 border-green-200' },
  AUTHORIZED: { label: 'Authorized', className: 'bg-green-50 text-green-700 border-green-200' },
  REJECTED: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200' },
}

interface Feedback {
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

interface ApiEvent {
  id: string
  eventType: string
  eventData: string
  createdAt: string
  revision: number
}

interface ApiCertificate {
  id: string
  certificateNumber: string
  status: string
  calibratedAt: string
  srfNumber: string | null
  srfDate: string | null
  dateOfCalibration: string | null
  calibrationDueDate: string | null
  dueDateNotApplicable: boolean
  customerName: string | null
  customerAddress: string | null
  uucDescription: string | null
  uucMake: string | null
  uucModel: string | null
  uucSerialNumber: string | null
  uucLocationName: string | null
  ambientTemperature: string | null
  relativeHumidity: string | null
  calibrationStatus: string | null
  selectedConclusionStatements: string | null
  additionalConclusionStatement: string | null
  currentRevision: number
  createdBy?: {
    name: string | null
  }
  reviewer?: {
    id: string
    name: string | null
    email: string
  }
  parameters: {
    id: string
    parameterName: string
    parameterUnit: string | null
    showAfterAdjustment: boolean
    results: {
      id: string
      pointNumber: number
      standardReading: string | null
      beforeAdjustment: string | null
      afterAdjustment: string | null
      errorObserved: number | null
      isOutOfLimit: boolean
    }[]
  }[]
  masterInstruments: {
    id: string
    description: string | null
    make: string | null
    model: string | null
    serialNumber: string | null
    calibrationDueDate: string | null
  }[]
  feedbacks?: Feedback[]
  events?: ApiEvent[]
}

export default function CertificateViewPage() {
  const params = useParams()
  const certificateId = params.id as string

  const [certificate, setCertificate] = useState<ApiCertificate | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [expandedSections, setExpandedSections] = useState<Record<string, boolean>>({
    section1: true,
    section2: true,
    section3: true,
    section4: true,
    section5: true,
    section6: true,
    section7: true,
    feedback: true,
  })

  // Chat panel state
  const [isChatExpanded, setIsChatExpanded] = useState(true)
  const [customerFeedback, setCustomerFeedback] = useState<{
    notes: string
    sectionFeedbacks: { section: string; comment: string }[] | null
    generalNotes: string | null
    customerName: string
    customerEmail: string
    requestedAt: string
    revision?: number
  } | null>(null)

  useEffect(() => {
    async function fetchCertificate() {
      try {
        setIsLoading(true)
        const response = await fetch(`/api/certificates/${certificateId}?include=feedbacks,events`)

        if (!response.ok) {
          if (response.status === 404) {
            setError('Certificate not found')
          } else if (response.status === 403) {
            setError('You do not have permission to view this certificate')
          } else {
            setError('Failed to load certificate')
          }
          return
        }

        const data = await response.json()
        setCertificate(data)

        // Extract customer feedback from events
        if (data.events) {
          const customerEvent = data.events
            .filter((e: ApiEvent) => e.eventType === 'CUSTOMER_REVISION_REQUESTED')
            .sort((a: ApiEvent, b: ApiEvent) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime())[0]

          if (customerEvent) {
            try {
              const eventData = JSON.parse(customerEvent.eventData)
              setCustomerFeedback({
                notes: eventData.notes || '',
                sectionFeedbacks: eventData.sectionFeedbacks || null,
                generalNotes: eventData.generalNotes || null,
                customerName: eventData.customerName || 'Customer',
                customerEmail: eventData.customerEmail || '',
                requestedAt: eventData.requestedAt || customerEvent.createdAt,
                revision: customerEvent.revision,
              })
            } catch {
              // If parsing fails, ignore
            }
          }
        }
      } catch (err) {
        console.error('Error fetching certificate:', err)
        setError('Failed to load certificate')
      } finally {
        setIsLoading(false)
      }
    }

    if (certificateId) {
      fetchCertificate()
    }
  }, [certificateId])

  const toggleSection = (section: string) => {
    setExpandedSections((prev) => ({ ...prev, [section]: !prev[section] }))
  }

  const formatDate = (dateStr: string | null) => {
    if (!dateStr) return '-'
    return new Date(dateStr).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  if (isLoading) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <Loader2 className="h-8 w-8 animate-spin text-blue-600 mx-auto mb-4" />
          <p className="text-slate-600">Loading certificate...</p>
        </div>
      </div>
    )
  }

  if (error || !certificate) {
    return (
      <div className="h-full flex items-center justify-center bg-slate-100">
        <div className="text-center">
          <AlertTriangle className="h-12 w-12 text-amber-500 mx-auto mb-4" />
          <h2 className="text-xl font-semibold text-slate-900 mb-2">
            {error || 'Certificate not found'}
          </h2>
          <Link href="/dashboard">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  const statusConfig = STATUS_CONFIG[certificate.status] || STATUS_CONFIG.DRAFT
  const calibrationStatus = certificate.calibrationStatus
    ? JSON.parse(certificate.calibrationStatus)
    : []
  const conclusionStatements = certificate.selectedConclusionStatements
    ? JSON.parse(certificate.selectedConclusionStatements)
    : []
  const feedbacks = certificate.feedbacks || []

  // Check if any results are out of limit
  const hasOutOfLimitResults = certificate.parameters.some((p) =>
    p.results.some((r) => r.isOutOfLimit)
  )

  // Check if chat should be available (has a reviewer assigned)
  const hasReviewer = !!certificate.reviewer

  return (
    <div className="flex h-full bg-slate-100 p-3 gap-3">
      {/* Left Side - Certificate Card */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header Section */}
          <div className="flex-shrink-0 border-b border-slate-200 px-6 py-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Link
                  href="/dashboard"
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ArrowLeft className="size-5" strokeWidth={2} />
                </Link>
                <span className="text-slate-300 text-xl">|</span>
                <h1 className="text-xl font-bold text-slate-900 tracking-tight">
                  {certificate.certificateNumber}
                </h1>
                <Badge
                  variant="outline"
                  className={cn(
                    'px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                    statusConfig.className
                  )}
                >
                  {statusConfig.label}
                </Badge>
              </div>
              <div className="flex items-center gap-3">
                {(certificate.status === 'APPROVED' || certificate.status === 'AUTHORIZED') && (
                  <a href={`/api/certificates/${certificate.id}/download-signed`} download>
                    <Button size="sm" className="bg-blue-600 hover:bg-blue-700 h-8 text-xs">
                      <Download className="h-3.5 w-3.5 mr-1.5" />
                      Download PDF
                    </Button>
                  </a>
                )}
              </div>
            </div>

            {/* Meta Info Row */}
            <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm mt-3">
              <div className="flex items-center gap-2 text-slate-600">
                <div className="p-1 rounded bg-slate-100">
                  <User className="size-3 text-slate-500" />
                </div>
                <span className="font-medium text-slate-700">
                  {certificate.createdBy?.name || 'Unknown'}
                </span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <div className="p-1 rounded bg-slate-100">
                  <Building2 className="size-3 text-slate-500" />
                </div>
                <span>{certificate.customerName || '-'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-600">
                <div className="p-1 rounded bg-slate-100">
                  <MapPin className="size-3 text-slate-500" />
                </div>
                <span>{certificate.calibratedAt === 'LAB' ? 'Laboratory' : 'Site'}</span>
              </div>
              <div className="flex items-center gap-2 text-slate-500">
                <span className="text-slate-300">|</span>
                <span>Revision {certificate.currentRevision}</span>
              </div>
            </div>
          </div>

          {/* Content Area - Scrollable */}
          <div className="flex-1 overflow-auto bg-slate-50/30">
            <div className="p-6 space-y-3">
              {/* Out of Limit Warning */}
              {hasOutOfLimitResults && (
                <div className="bg-red-50 border border-red-200 rounded-lg p-4 flex items-start gap-3">
                  <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <h4 className="font-medium text-red-800 text-sm">Out of Limit Results</h4>
                    <p className="text-xs text-red-700 mt-1">
                      This certificate contains one or more results that are outside the
                      acceptable limits.
                    </p>
                  </div>
                </div>
              )}

              {/* Section 1: Summary */}
              <CollapsibleSection
                title="Section 1: Summary"
                isExpanded={expandedSections.section1}
                onToggle={() => toggleSection('section1')}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                  <InfoField label="SRF Number" value={certificate.srfNumber} />
                  <InfoField label="SRF Date" value={formatDate(certificate.srfDate)} />
                  <InfoField
                    label="Calibrated At"
                    value={certificate.calibratedAt === 'LAB' ? 'Laboratory' : 'Site'}
                  />
                  <InfoField
                    label="Date of Calibration"
                    value={formatDate(certificate.dateOfCalibration)}
                  />
                  <InfoField
                    label="Calibration Due Date"
                    value={
                      certificate.dueDateNotApplicable
                        ? 'Not Applicable'
                        : formatDate(certificate.calibrationDueDate)
                    }
                  />
                  <div className="md:col-span-2 lg:col-span-3 border-t pt-4 mt-2">
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <InfoField label="Customer Name" value={certificate.customerName} />
                      <InfoField label="Customer Address" value={certificate.customerAddress} />
                    </div>
                  </div>
                </div>
              </CollapsibleSection>

              {/* Section 2: UUC Details */}
              <CollapsibleSection
                title="Section 2: UUC Details"
                isExpanded={expandedSections.section2}
                onToggle={() => toggleSection('section2')}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div className="md:col-span-2">
                    <InfoField label="Description" value={certificate.uucDescription} />
                  </div>
                  <InfoField label="Make" value={certificate.uucMake} />
                  <InfoField label="Model" value={certificate.uucModel} />
                  <InfoField label="Serial Number" value={certificate.uucSerialNumber} />
                  <InfoField label="Location/Tag" value={certificate.uucLocationName} />
                </div>
              </CollapsibleSection>

              {/* Section 3: Master Instruments */}
              <CollapsibleSection
                title="Section 3: Master Instruments"
                isExpanded={expandedSections.section3}
                onToggle={() => toggleSection('section3')}
              >
                {certificate.masterInstruments.length === 0 ? (
                  <p className="text-slate-500 text-xs">No master instruments listed.</p>
                ) : (
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm">
                      <thead className="bg-slate-50">
                        <tr>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">
                            Description
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">
                            Make
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">
                            Model
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">
                            Serial No.
                          </th>
                          <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500 uppercase">
                            Cal. Due Date
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {certificate.masterInstruments.map((mi) => (
                          <tr key={mi.id}>
                            <td className="px-4 py-2 text-slate-900 text-xs">{mi.description || '-'}</td>
                            <td className="px-4 py-2 text-slate-700 text-xs">{mi.make || '-'}</td>
                            <td className="px-4 py-2 text-slate-700 text-xs">{mi.model || '-'}</td>
                            <td className="px-4 py-2 text-slate-700 text-xs">{mi.serialNumber || '-'}</td>
                            <td className="px-4 py-2 text-slate-700 text-xs">{mi.calibrationDueDate || '-'}</td>
                          </tr>
                        ))}
                      </tbody>
                    </table>
                  </div>
                )}
              </CollapsibleSection>

              {/* Section 4: Environmental Conditions */}
              <CollapsibleSection
                title="Section 4: Environmental Conditions"
                isExpanded={expandedSections.section4}
                onToggle={() => toggleSection('section4')}
              >
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <InfoField
                    label="Ambient Temperature"
                    value={certificate.ambientTemperature ? `${certificate.ambientTemperature} °C` : '-'}
                  />
                  <InfoField
                    label="Relative Humidity"
                    value={certificate.relativeHumidity ? `${certificate.relativeHumidity} %RH` : '-'}
                  />
                </div>
              </CollapsibleSection>

              {/* Section 5: Calibration Results */}
              <CollapsibleSection
                title="Section 5: Calibration Results"
                isExpanded={expandedSections.section5}
                onToggle={() => toggleSection('section5')}
                badge={
                  hasOutOfLimitResults ? (
                    <span className="text-xs bg-red-100 text-red-700 px-2 py-0.5 rounded-full">
                      Out of Limit
                    </span>
                  ) : undefined
                }
              >
                {certificate.parameters.length === 0 ? (
                  <p className="text-slate-500 text-xs">No results recorded.</p>
                ) : (
                  <div className="space-y-4">
                    {certificate.parameters.map((param) => (
                      <div key={param.id} className="border border-slate-200 rounded-lg overflow-hidden">
                        <div className="bg-slate-50 px-4 py-2 border-b border-slate-200">
                          <span className="font-medium text-slate-900 text-sm">
                            {param.parameterName}
                            {param.parameterUnit && (
                              <span className="text-slate-500 font-normal ml-1 text-sm">
                                ({param.parameterUnit})
                              </span>
                            )}
                          </span>
                        </div>
                        <div className="overflow-x-auto">
                          <table className="w-full text-sm">
                            <thead className="bg-slate-50">
                              <tr>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">
                                  Point
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">
                                  Standard Reading
                                </th>
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">
                                  UUC Reading
                                </th>
                                {param.showAfterAdjustment && (
                                  <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">
                                    After Adjustment
                                  </th>
                                )}
                                <th className="px-4 py-2 text-left text-xs font-semibold text-slate-500">
                                  Error
                                </th>
                                <th className="px-4 py-2 text-center text-xs font-semibold text-slate-500">
                                  Status
                                </th>
                              </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-100">
                              {param.results.map((result) => (
                                <tr
                                  key={result.id}
                                  className={cn(result.isOutOfLimit && 'bg-red-50')}
                                >
                                  <td className="px-4 py-2 text-slate-900 text-xs">{result.pointNumber}</td>
                                  <td className="px-4 py-2 text-slate-700 text-xs">{result.standardReading || '-'}</td>
                                  <td className="px-4 py-2 text-slate-700 text-xs">{result.beforeAdjustment || '-'}</td>
                                  {param.showAfterAdjustment && (
                                    <td className="px-4 py-2 text-slate-700 text-xs">{result.afterAdjustment || '-'}</td>
                                  )}
                                  <td className="px-4 py-2 text-slate-700 text-xs">{result.errorObserved ?? '-'}</td>
                                  <td className="px-4 py-2 text-center">
                                    {result.isOutOfLimit ? (
                                      <span className="inline-flex items-center gap-1 text-red-600">
                                        <AlertCircle className="h-3 w-3" />
                                        <span className="text-xs">Out of Limit</span>
                                      </span>
                                    ) : (
                                      <span className="inline-flex items-center gap-1 text-green-600">
                                        <CheckCircle className="h-3 w-3" />
                                        <span className="text-xs">OK</span>
                                      </span>
                                    )}
                                  </td>
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </CollapsibleSection>

              {/* Section 6: Remarks */}
              <CollapsibleSection
                title="Section 6: Remarks"
                isExpanded={expandedSections.section6}
                onToggle={() => toggleSection('section6')}
              >
                <div className="space-y-4">
                  {calibrationStatus.length > 0 ? (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-700 mb-2">
                        Calibration Status
                      </h4>
                      <div className="flex flex-wrap gap-2">
                        {calibrationStatus.map((statusId: string, i: number) => {
                          const option = CALIBRATION_STATUS_OPTIONS.find(o => o.id === statusId)
                          return (
                            <span
                              key={i}
                              className="px-3 py-1 bg-blue-100 text-blue-800 rounded-full text-xs font-medium"
                            >
                              {option?.label || statusId}
                            </span>
                          )
                        })}
                      </div>
                    </div>
                  ) : (
                    <p className="text-slate-500 text-xs">No remarks added.</p>
                  )}
                </div>
              </CollapsibleSection>

              {/* Section 7: Conclusion */}
              <CollapsibleSection
                title="Section 7: Conclusion"
                isExpanded={expandedSections.section7}
                onToggle={() => toggleSection('section7')}
              >
                <div className="space-y-4">
                  {conclusionStatements.length > 0 && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-700 mb-2">
                        Conclusion Statements
                      </h4>
                      <ul className="list-disc list-inside space-y-2 text-slate-700">
                        {conclusionStatements.map((statementKey: string, i: number) => (
                          <li key={i} className="text-xs">
                            {getConclusionText(statementKey)}
                          </li>
                        ))}
                      </ul>
                    </div>
                  )}

                  {certificate.additionalConclusionStatement && (
                    <div>
                      <h4 className="text-xs font-semibold text-slate-700 mb-2">
                        Additional Statement
                      </h4>
                      <p className="text-xs text-slate-700 bg-slate-50 p-3 rounded-lg">
                        {certificate.additionalConclusionStatement}
                      </p>
                    </div>
                  )}

                  {conclusionStatements.length === 0 && !certificate.additionalConclusionStatement && (
                    <p className="text-slate-500 text-xs">No conclusion statements added.</p>
                  )}
                </div>
              </CollapsibleSection>

              {/* Feedback History */}
              {(feedbacks.length > 0 || customerFeedback) && (
                <FeedbackTimeline
                  feedbacks={feedbacks}
                  currentRevision={certificate.currentRevision}
                  title="Feedback History"
                  groupBySection={true}
                  showRevisionTransition={true}
                  customerFeedback={customerFeedback}
                />
              )}
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Chat */}
      <div className="w-[380px] flex-shrink-0 flex flex-col gap-3">
        {/* Chat Section */}
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
              <span className="text-xs font-bold text-slate-700 uppercase tracking-wider">Chat with Reviewer</span>
            </div>
          </button>

          {/* Chat Content - Only when expanded */}
          {isChatExpanded && (
            <div className="flex-1 flex flex-col min-h-0">
              {/* Person Header */}
              {hasReviewer && (
                <div className="flex-shrink-0 px-4 py-3 border-t border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="size-10 rounded-full bg-slate-700 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
                      {(certificate.reviewer?.name || 'R').split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    {/* Name & Status */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {certificate.reviewer?.name || 'Reviewer'}
                      </p>
                      <p className="text-xs text-slate-500 flex items-center gap-1.5">
                        <span>Reviewer</span>
                        <span className="size-1.5 rounded-full bg-green-500" />
                        <span className="text-green-600">Online</span>
                      </p>
                    </div>
                  </div>
                </div>
              )}

              {/* Chat Messages Area */}
              <div className="flex-1 min-h-0 overflow-hidden text-xs">
                {hasReviewer ? (
                  <ChatSidebar
                    isOpen={true}
                    onClose={() => {}}
                    certificateId={certificate.id}
                    threadType="ASSIGNEE_REVIEWER"
                    embedded={true}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-xs p-4 text-center">
                    <div>
                      <MessageSquare className="size-8 mx-auto mb-2 text-slate-300" />
                      <p>No reviewer assigned yet</p>
                      <p className="text-[10px] mt-1">Chat will be available once a reviewer is assigned</p>
                    </div>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  )
}

// Helper Components
function CollapsibleSection({
  title,
  isExpanded,
  onToggle,
  children,
  badge,
}: {
  title: string
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
  badge?: React.ReactNode
}) {
  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between bg-slate-50 hover:bg-slate-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-slate-700 text-sm">{title}</span>
          {badge}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-slate-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-slate-400" />
        )}
      </button>
      {isExpanded && <div className="p-4">{children}</div>}
    </div>
  )
}

function InfoField({
  label,
  value,
}: {
  label: string
  value: string | null | undefined
}) {
  return (
    <div>
      <dt className="text-xs font-semibold text-slate-500 tracking-wider">{label}</dt>
      <dd className="mt-1 text-xs text-slate-900">{value || '-'}</dd>
    </div>
  )
}

