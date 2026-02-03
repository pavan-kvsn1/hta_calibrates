'use client'

import { useState, useEffect, ReactNode } from 'react'
import {
  FileText,
  User,
  Cpu,
  Thermometer,
  Droplets,
  ClipboardCheck,
  CheckCircle,
  AlertCircle,
  ChevronDown,
  ChevronRight,
  MessageSquare,
  Award,
  Wrench,
  Target,
  TrendingUp,
  AlertTriangle,
  Clock,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Calibration status options mapping
const CALIBRATION_STATUS_OPTIONS: Record<string, { label: string; type: 'success' | 'error' | 'warning' | 'info' }> = {
  'satisfied': { label: 'Satisfied - Results within accuracy limits', type: 'success' },
  'dissatisfied': { label: 'Dissatisfied - Results NOT within accuracy limits', type: 'error' },
  'not_working': { label: 'Not Working - Device non-functional', type: 'error' },
  'out_of_accuracy': { label: '(*) Indicated calibration points are out of accuracy', type: 'warning' },
  'physical_damage': { label: 'Not working due to physical damage', type: 'error' },
  // Legacy status values (in case old data uses these)
  'SATISFACTORY': { label: 'Satisfactory', type: 'success' },
  'UNSATISFACTORY': { label: 'Unsatisfactory', type: 'error' },
  'LIMITED': { label: 'Limited Use', type: 'warning' },
}

// Section configuration with colors and icons
const SECTIONS = [
  { id: 'summary', label: 'Summary', icon: FileText, color: 'blue' },
  { id: 'customer', label: 'Customer', icon: User, color: 'blue' },
  { id: 'uuc', label: 'UUC Details', icon: Cpu, color: 'blue' },
  { id: 'environment', label: 'Environment', icon: Thermometer, color: 'blue' },
  { id: 'master-instruments', label: 'Master Instruments', icon: Wrench, color: 'blue' },
  { id: 'results', label: 'Results', icon: ClipboardCheck, color: 'blue' },
  { id: 'status', label: 'Status', icon: Target, color: 'blue' },
  { id: 'conclusion', label: 'Conclusion', icon: Award, color: 'blue' },
] as const

type SectionId = typeof SECTIONS[number]['id']
type SectionColor = typeof SECTIONS[number]['color']

const COLOR_CLASSES: Record<SectionColor, { bg: string; border: string; text: string; light: string; icon: string }> = {
  blue: {
    bg: 'bg-blue-500',
    border: 'border-blue-200',
    text: 'text-blue-700',
    light: 'bg-blue-50',
    icon: 'text-blue-500',
  },
}

interface SummaryStatsProps {
  totalPoints: number
  passCount: number
  failCount: number
  parametersCount: number
  masterInstrumentsCount: number
  status: string
  submittedAt?: Date
}

function SummaryStats({
  totalPoints,
  passCount,
  failCount,
  parametersCount,
  masterInstrumentsCount,
  status,
  submittedAt,
}: SummaryStatsProps) {
  const passRate = totalPoints > 0 ? Math.round((passCount / totalPoints) * 100) : 0
  const daysSinceSubmission = submittedAt
    ? Math.floor((new Date().getTime() - new Date(submittedAt).getTime()) / (1000 * 60 * 60 * 24))
    : null

  return (
    <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
      
      {/* Master Instruments / Days Pending */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            daysSinceSubmission !== null && daysSinceSubmission > 3 ? "bg-amber-100" : "bg-blue-100"
          )}>
            {daysSinceSubmission !== null ? (
              <Clock className={cn(
                "h-5 w-5",
                daysSinceSubmission > 3 ? "text-amber-600" : "text-blue-600"
              )} />
            ) : (
              <Wrench className="h-5 w-5 text-blue-600" />
            )}
          </div>
          <div>
            {daysSinceSubmission !== null ? (
              <>
                <p className="text-2xl font-bold text-gray-900">{daysSinceSubmission}d</p>
                <p className="text-xs text-gray-500 font-medium">Pending Review</p>
              </>
            ) : (
              <>
                <p className="text-2xl font-bold text-gray-900">{masterInstrumentsCount}</p>
                <p className="text-xs text-gray-500 font-medium">Master Instruments</p>
              </>
            )}
          </div>
        </div>
      </div>

      {/* Parameters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Cpu className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{parametersCount}</p>
            <p className="text-xs text-gray-500 font-medium">Parameters</p>
          </div>
        </div>
      </div>

      {/* Calibration Points */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-blue-100 rounded-lg">
            <Target className="h-5 w-5 text-blue-600" />
          </div>
          <div>
            <p className="text-2xl font-bold text-gray-900">{totalPoints}</p>
            <p className="text-xs text-gray-500 font-medium">Calibration Points</p>
          </div>
        </div>
      </div>

      {/* Pass Rate */}
      <div className="bg-white rounded-xl border border-gray-200 p-4 shadow-sm hover:shadow-md transition-shadow">
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            passRate >= 90 ? "bg-green-100" : passRate >= 70 ? "bg-amber-100" : "bg-red-100"
          )}>
            <TrendingUp className={cn(
              "h-5 w-5",
              passRate >= 90 ? "text-green-600" : passRate >= 70 ? "text-amber-600" : "text-red-600"
            )} />
          </div>
          <div>
            <div className="flex items-baseline gap-1">
              <p className="text-2xl font-bold text-gray-900">{passRate}%</p>
              <span className="text-xs text-gray-400">Pass</span>
            </div>
            <p className="text-xs text-gray-500 font-medium">
              <span className="text-green-600">{passCount}</span>
              {' / '}
              <span className="text-red-600">{failCount}</span>
              {' '}(P/F)
            </p>
          </div>
        </div>
      </div>

    </div>
  )
}

interface CollapsibleSectionProps {
  id: SectionId
  title: string
  icon: React.ElementType
  color: SectionColor
  children: ReactNode
  defaultOpen?: boolean
  badge?: ReactNode
}

function CollapsibleSection({
  id,
  title,
  icon: Icon,
  color,
  children,
  defaultOpen = true,
  badge,
}: CollapsibleSectionProps) {
  const [isOpen, setIsOpen] = useState(defaultOpen)
  const colors = COLOR_CLASSES[color]

  return (
    <div
      id={id}
      className={cn(
        "bg-white rounded-xl border shadow-sm overflow-hidden transition-all",
        colors.border,
        "hover:shadow-md"
      )}
    >
      {/* Section Header */}
      <button
        type="button"
        onClick={() => setIsOpen(!isOpen)}
        className={cn(
          "w-full px-5 py-4 flex items-center justify-between",
          colors.light,
          "hover:brightness-95 transition-all"
        )}
      >
        <div className="flex items-center gap-3">
          <div className={cn("p-2 rounded-lg bg-white shadow-sm", colors.border)}>
            <Icon className={cn("h-5 w-5", colors.icon)} />
          </div>
          <h2 className={cn("text-base font-bold", colors.text)}>{title}</h2>
          {badge}
        </div>
        <div className={cn("p-1 rounded-md", isOpen ? colors.light : "bg-white")}>
          {isOpen ? (
            <ChevronDown className={cn("h-5 w-5", colors.icon)} />
          ) : (
            <ChevronRight className={cn("h-5 w-5", colors.icon)} />
          )}
        </div>
      </button>

      {/* Section Content */}
      <div
        className={cn(
          "transition-all duration-200 ease-in-out",
          isOpen ? "max-h-[5000px] opacity-100" : "max-h-0 opacity-0 overflow-hidden"
        )}
      >
        <div className="p-5 border-t border-gray-100">{children}</div>
      </div>
    </div>
  )
}

interface StickyNavProps {
  activeSection: SectionId
  onSectionClick: (id: SectionId) => void
  visibleSections: SectionId[]
}

function StickyNav({ activeSection, onSectionClick, visibleSections }: StickyNavProps) {
  const filteredSections = SECTIONS.filter(s => visibleSections.includes(s.id))

  return (
    <nav className="sticky top-[75px] z-40 bg-white/95 backdrop-blur-md border border-gray-200 rounded-xl shadow-sm mb-6 overflow-x-auto">
      <div className="flex items-center gap-1 p-2 min-w-max">
        {filteredSections.map((section) => {
          const colors = COLOR_CLASSES[section.color]
          const isActive = activeSection === section.id
          const Icon = section.icon

          return (
            <button
              key={section.id}
              type="button"
              onClick={() => onSectionClick(section.id)}
              className={cn(
                "flex items-center gap-2 px-3 py-2 text-sm font-semibold rounded-lg transition-all",
                isActive
                  ? cn(colors.light, colors.text, "shadow-sm")
                  : "text-gray-500 hover:text-gray-700 hover:bg-gray-50"
              )}
            >
              <Icon className={cn("h-4 w-4", isActive ? colors.icon : "text-gray-400")} />
              <span className="hidden sm:inline">{section.label}</span>
            </button>
          )
        })}
      </div>
    </nav>
  )
}

interface ReviewContentProps {
  certificate: {
    id: string
    certificateNumber: string
    status: string
    currentRevision: number
    createdBy: { name: string; email: string }
    calibratedAt: string | null
    dateOfCalibration: Date | null
    calibrationDueDate: Date | null
    srfNumber: string | null
    srfDate: Date | null
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
    statusNotes: string | null
    stickerOldRemoved: string | null
    stickerNewAffixed: string | null
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
    feedbacks: Array<{
      id: string
      comment: string
      targetSection: string | null
      createdAt: Date
      user: { name: string } | null
    }>
  }
  conclusionStatements: Record<string, string>
  children?: ReactNode
  // Enhanced feedbacks with user role for HoD view
  feedbacks?: Array<{
    id: string
    feedbackType: string
    comment: string | null
    createdAt: string
    revisionNumber: number
    user: {
      name: string
      role: string
    }
    hodEdits?: Array<{
      field: string
      fieldLabel: string
      previousValue: string | null
      newValue: string
      reason: string
      autoCalculated: boolean
    }> | null
  }>
  currentRevision?: number
  // Pending edits from HoD Edit Actions
  pendingEdits?: Array<{
    field: 'dateOfCalibration' | 'calibrationDueDate'
    fieldLabel: string
    originalValue: string
    newValue: string
    reason: string
    autoCalculated?: boolean
  }>
}

// Helper to format pending edit date
function formatPendingDate(dateStr: string): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function ReviewContent({ certificate, conclusionStatements, children, feedbacks = [], currentRevision = 1, pendingEdits = [] }: ReviewContentProps) {
  const [activeSection, setActiveSection] = useState<SectionId>('summary')
  const [isPreviousFeedbackExpanded, setIsPreviousFeedbackExpanded] = useState(false)

  // Check if this is a resubmission (revision > 1)
  const isResubmission = currentRevision > 1

  // Get engineer's response and HoD's previous feedback from enhanced feedbacks
  const engineerResponse = feedbacks.find(f => f.feedbackType === 'ENGINEER_RESPONSE')
  const previousHoDFeedback = feedbacks.find(f => f.feedbackType === 'REVISION_REQUEST')

  // Calculate stats
  const totalPoints = certificate.parameters.reduce(
    (acc, p) => acc + p.results.filter(r => r.standardReading && r.beforeAdjustment).length,
    0
  )
  const failCount = certificate.parameters.reduce(
    (acc, p) => acc + p.results.filter(r => r.isOutOfLimit).length,
    0
  )
  const passCount = totalPoints - failCount

  // Parse JSON fields
  const calibrationStatus = certificate.calibrationStatus
    ? JSON.parse(certificate.calibrationStatus)
    : []
  const selectedConclusions = certificate.selectedConclusionStatements
    ? JSON.parse(certificate.selectedConclusionStatements)
    : []

  // Track scroll position for active section
  useEffect(() => {
    const handleScroll = () => {
      const sections = SECTIONS.map((s) => ({
        id: s.id,
        element: document.getElementById(s.id),
      })).filter((s) => s.element)

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i]
        if (section.element && section.element.offsetTop - 200 <= window.scrollY) {
          setActiveSection(section.id as SectionId)
          break
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  const scrollToSection = (sectionId: SectionId) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  const formatDate = (date: Date | null) => {
    if (!date) return '-'
    return new Date(date).toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  // Determine which sections to show
  const visibleSections: SectionId[] = [
    'summary',
    'customer',
    'uuc',
    'environment',
    ...(certificate.masterInstruments.length > 0 ? ['master-instruments' as SectionId] : []),
    ...(certificate.parameters.length > 0 ? ['results' as SectionId] : []),
    'status',
    'conclusion',
  ]

  // Format accuracy type label
  const getAccuracyTypeLabel = (type: string | null) => {
    switch (type) {
      case 'PERCENT_READING': return '% of Reading'
      case 'PERCENT_SCALE': return '% of Scale'
      case 'ABSOLUTE':
      default: return 'Absolute'
    }
  }

  return (
    <>
      {/* Summary Stats */}
      <SummaryStats
        totalPoints={totalPoints}
        passCount={passCount}
        failCount={failCount}
        parametersCount={certificate.parameters.length}
        masterInstrumentsCount={certificate.masterInstruments.length}
        status={certificate.status}
        submittedAt={certificate.status === 'PENDING_HOD_REVIEW' ? certificate.createdAt : undefined}
      />

      {/* Engineer Resubmission Banner - Shows when this is a resubmission */}
      {isResubmission && (engineerResponse || previousHoDFeedback) && (
        <div className="mb-6 rounded-2xl border-2 border-blue-200 bg-blue-50 overflow-hidden">
          {/* Engineer Response */}
          {engineerResponse && (
            <div className="p-6 border-b border-blue-200">
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2 rounded-lg bg-blue-100">
                  <User className="h-5 w-5 text-blue-700" />
                </div>
                <div>
                  <h3 className="font-bold text-blue-900 text-sm">Engineer Resubmission Notes</h3>
                  <p className="text-xs text-blue-700">Response to your revision request</p>
                </div>
              </div>
              <div className="bg-white rounded-xl border border-blue-200 p-4">
                <div className="flex items-start gap-3">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="font-semibold text-slate-900 text-sm">{engineerResponse.user.name}</span>
                      <span className="text-xs px-2 py-0.5 rounded-full bg-blue-100 text-blue-600 font-medium">
                        Engineer
                      </span>
                      <span className="text-xs text-slate-400">
                        {new Date(engineerResponse.createdAt).toLocaleDateString('en-GB', {
                          day: 'numeric',
                          month: 'short',
                          year: 'numeric',
                          hour: '2-digit',
                          minute: '2-digit'
                        })}
                      </span>
                    </div>
                    {engineerResponse.comment && (
                      <p className="text-slate-700 whitespace-pre-wrap text-sm">{engineerResponse.comment}</p>
                    )}
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* Previous HoD Feedback (Collapsible) */}
          {previousHoDFeedback && (
            <div>
              <button
                onClick={() => setIsPreviousFeedbackExpanded(!isPreviousFeedbackExpanded)}
                className="w-full px-6 py-4 flex items-center justify-between hover:bg-blue-100/50 transition-colors"
              >
                <div className="flex items-center gap-3">
                  <MessageSquare className="h-5 w-5 text-blue-600" />
                  <span className="font-semibold text-blue-900 text-sm">Your Previous Feedback</span>
                </div>
                {isPreviousFeedbackExpanded ? (
                  <ChevronDown className="h-5 w-5 text-blue-600" />
                ) : (
                  <ChevronRight className="h-5 w-5 text-blue-600" />
                )}
              </button>
              {isPreviousFeedbackExpanded && (
                <div className="px-6 pb-6">
                  <div className="bg-white rounded-xl border border-orange-200 p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-full bg-orange-100">
                        <AlertTriangle className="h-4 w-4 text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-slate-900 text-sm">{previousHoDFeedback.user.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                            HoD
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(previousHoDFeedback.createdAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        {previousHoDFeedback.comment && (
                          <p className="text-slate-700 whitespace-pre-wrap text-sm">{previousHoDFeedback.comment}</p>
                        )}
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          )}
        </div>
      )}

      {/* Sticky Navigation */}
      <StickyNav
        activeSection={activeSection}
        onSectionClick={scrollToSection}
        visibleSections={visibleSections}
      />

      {/* Sections */}
      <div className="space-y-4">
        {/* Summary Section */}
        <CollapsibleSection
          id="summary"
          title="Certificate Summary"
          icon={FileText}
          color="blue"
        >
          <div className="grid grid-cols-2 md:grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Created By</p>
              <p className="font-medium text-gray-900 text-sm">{certificate.createdBy.name}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Calibrated At</p>
              <p className="font-medium text-gray-900 text-sm">{certificate.calibratedAt === 'LAB' ? 'Laboratory' : 'Site'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1 flex items-center gap-1.5">
                Date of Calibration
                {pendingEdits.some(e => e.field === 'dateOfCalibration') && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-amber-100 text-amber-700 font-bold normal-case">
                    PENDING EDIT
                  </span>
                )}
              </p>
              {pendingEdits.some(e => e.field === 'dateOfCalibration') ? (
                <div className="p-2 bg-amber-50 border border-amber-200 rounded">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 line-through">{formatDate(certificate.dateOfCalibration)}</span>
                    <span className="text-amber-600">→</span>
                    <span className="font-semibold text-amber-700">
                      {formatPendingDate(pendingEdits.find(e => e.field === 'dateOfCalibration')!.newValue)}
                    </span>
                  </div>
                  <p className="text-[10px] text-amber-600 mt-1">Pending HoD Change</p>
                </div>
              ) : (
                <p className="font-medium text-gray-900 text-sm">{formatDate(certificate.dateOfCalibration)}</p>
              )}
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1 flex items-center gap-1.5">
                Calibration Due
                {pendingEdits.some(e => e.field === 'calibrationDueDate') && (
                  <span className="text-[9px] px-1.5 py-0.5 rounded bg-blue-100 text-blue-700 font-bold normal-case">
                    AUTO-ADJUSTED
                  </span>
                )}
              </p>
              {pendingEdits.some(e => e.field === 'calibrationDueDate') ? (
                <div className="p-2 bg-blue-50 border border-blue-200 rounded">
                  <div className="flex items-center gap-2 text-sm">
                    <span className="text-gray-500 line-through">{formatDate(certificate.calibrationDueDate)}</span>
                    <span className="text-blue-600">→</span>
                    <span className="font-semibold text-blue-700">
                      {formatPendingDate(pendingEdits.find(e => e.field === 'calibrationDueDate')!.newValue)}
                    </span>
                  </div>
                  <p className="text-[10px] text-blue-600 mt-1">Auto-calculated</p>
                </div>
              ) : (
                <p className="font-medium text-gray-900 text-sm">{formatDate(certificate.calibrationDueDate)}</p>
              )}
            </div>
            {certificate.srfNumber && (
              <>
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">SRF Number</p>
                  <p className="font-medium text-gray-900 text-sm">{certificate.srfNumber}</p>
                </div>
                <div>
                  <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">SRF Date</p>
                  <p className="font-medium text-gray-900 text-sm">{formatDate(certificate.srfDate)}</p>
                </div>
              </>
            )}
          </div>
        </CollapsibleSection>

        {/* Customer Section */}
        <CollapsibleSection
          id="customer"
          title="Customer Details"
          icon={User}
          color="blue"
        >
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Customer Name</p>
              <p className="font-medium text-gray-900 whitespace-pre-line text-sm">{certificate.customerName || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Customer Address</p>
              <p className="font-medium text-gray-900 whitespace-pre-line text-sm">{certificate.customerAddress || '-'}</p>
            </div>
          </div>
        </CollapsibleSection>

        {/* UUC Section */}
        <CollapsibleSection
          id="uuc"
          title="Unit Under Calibration (UUC)"
          icon={Cpu}
          color="blue"
          badge={
            certificate.parameters.length > 0 && (
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                {certificate.parameters.length} Parameter{certificate.parameters.length > 1 ? 's' : ''}
              </span>
            )
          }
        >
          {/* UUC Basic Info */}
          <div className="grid grid-cols-2 md:grid-cols-2 gap-6 text-sm">
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Description</p>
              <p className="font-medium text-gray-900">{certificate.uucDescription || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Make</p>
              <p className="font-medium text-gray-900">{certificate.uucMake || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Model</p>
              <p className="font-medium text-gray-900">{certificate.uucModel || '-'}</p>
            </div>
            <div>
              <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Serial Number</p>
              <p className="font-medium text-gray-900">{certificate.uucSerialNumber || '-'}</p>
            </div>
            {certificate.uucInstrumentId && (
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Instrument ID</p>
                <p className="font-medium text-gray-900">{certificate.uucInstrumentId}</p>
              </div>
            )}
            {certificate.uucLocationName && (
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Location</p>
                <p className="font-medium text-gray-900">{certificate.uucLocationName}</p>
              </div>
            )}
            {certificate.uucMachineName && (
              <div>
                <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Machine Name</p>
                <p className="font-medium text-gray-900">{certificate.uucMachineName}</p>
              </div>
            )}
          </div>

          {/* Parameter Specifications */}
          {certificate.parameters.length > 0 && (
            <div className="mt-6 pt-6 border-t border-blue-100">
              <h3 className="text-sm font-bold text-blue-700 mb-4 uppercase tracking-wide">
                Parameter Specifications
              </h3>
              <div className="space-y-4">
                {certificate.parameters.map((param, idx) => {
                  const bins = param.bins ? (typeof param.bins === 'string' ? JSON.parse(param.bins) : param.bins) : []
                  const hasBins = param.requiresBinning && bins.length > 0

                  return (
                    <div key={param.id} className="border border-blue-100 rounded-lg p-4 bg-blue-50/50">
                      <div className="flex items-center gap-2 mb-3">
                        <span className="bg-blue-500 text-white text-xs font-bold px-2 py-1 rounded">
                          {idx + 1}
                        </span>
                        <h4 className="font-semibold text-gray-900">
                          {param.parameterName || `Parameter ${idx + 1}`}
                          {param.parameterUnit && (
                            <span className="text-gray-500 font-normal ml-1">({param.parameterUnit})</span>
                          )}
                        </h4>
                        {hasBins && (
                          <span className="text-xs bg-blue-200 text-blue-800 px-2 py-0.5 rounded font-medium">
                            Binned
                          </span>
                        )}
                      </div>

                      {/* Basic Info Grid */}
                      <div className="grid grid-cols-2 md:grid-cols-2 gap-4 text-sm">
                        {(param.rangeMin || param.rangeMax) && (
                          <div>
                            <p className="text-gray-500 text-xs">Range</p>
                            <p className="font-medium">
                              {param.rangeMin} to {param.rangeMax} {param.rangeUnit || param.parameterUnit}
                            </p>
                          </div>
                        )}
                        {(param.operatingMin || param.operatingMax) && (
                          <div>
                            <p className="text-gray-500 text-xs">Operating Range</p>
                            <p className="font-medium">
                              {param.operatingMin} to {param.operatingMax} {param.operatingUnit || param.parameterUnit}
                            </p>
                          </div>
                        )}
                        {param.errorFormula && (
                          <div>
                            <p className="text-gray-500 text-xs">Error Formula</p>
                            <p className="font-medium">{param.errorFormula}</p>
                          </div>
                        )}
                        {param.accuracyType && (
                          <div>
                            <p className="text-gray-500 text-xs">Accuracy Type</p>
                            <p className="font-medium">{getAccuracyTypeLabel(param.accuracyType)}</p>
                          </div>
                        )}
                        {param.sopReference && (
                          <div>
                            <p className="text-gray-500 text-xs">SOP Reference</p>
                            <p className="font-medium">{param.sopReference}</p>
                          </div>
                        )}
                      </div>

                      {/* Non-Binned: Simple Least Count & Accuracy */}
                      {!hasBins && (param.leastCountValue || param.accuracyValue) && (
                        <div className="mt-3 pt-3 border-t border-blue-100">
                          <div className="grid grid-cols-2 gap-4">
                            {param.leastCountValue && (
                              <div className="bg-white rounded-lg p-3 border border-blue-100">
                                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">
                                  Least Count
                                </p>
                                <p className="text-lg font-bold text-gray-900">
                                  {param.leastCountValue}
                                  <span className="text-sm font-normal text-gray-500 ml-1 text-xs">
                                    {param.leastCountUnit || param.parameterUnit}
                                  </span>
                                </p>
                              </div>
                            )}
                            {param.accuracyValue && (
                              <div className="bg-white rounded-lg p-3 border border-blue-100">
                                <p className="text-xs text-gray-500 uppercase tracking-wide font-semibold mb-1">
                                  Accuracy
                                </p>
                                <p className="text-lg font-bold text-gray-900 text-xs">
                                  ± {param.accuracyValue}
                                  <span className="text-sm font-normal text-gray-500 ml-1 text-xs">
                                    {param.accuracyType === 'ABSOLUTE'
                                      ? (param.accuracyUnit || param.parameterUnit)
                                      : param.accuracyType === 'PERCENT_READING'
                                        ? '% of reading'
                                        : '% of scale'}
                                  </span>
                                </p>
                              </div>
                            )}
                          </div>
                        </div>
                      )}

                      {/* Binned: Table of Bins */}
                      {hasBins && (
                        <div className="mt-3 pt-3 border-t border-blue-100">
                          <p className="text-xs font-semibold text-gray-700 uppercase tracking-wide mb-2 gap-6">
                            Calibration Ranges (Bins)
                          </p>
                          <div className="overflow-x-auto">
                            <table className="w-full text-sm border border-blue-100 rounded-lg overflow-hidden">
                              <thead className="bg-blue-100">
                                <tr>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-blue-700 uppercase">
                                    Bin
                                  </th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-blue-700 uppercase">
                                    Range
                                  </th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-blue-700 uppercase">
                                    Least Count
                                  </th>
                                  <th className="px-3 py-2 text-left text-xs font-semibold text-blue-700 uppercase">
                                    Accuracy
                                  </th>
                                </tr>
                              </thead>
                              <tbody className="divide-y divide-blue-100 bg-white">
                                {bins.map((bin: { id?: string; binMin: string; binMax: string; leastCount: string; accuracy: string }, binIdx: number) => (
                                  <tr key={bin.id || binIdx}>
                                    <td className="px-3 py-2 font-medium text-gray-700 text-xs">{binIdx + 1}</td>
                                    <td className="px-3 py-2 text-gray-800 text-xs">
                                      {bin.binMin} to {bin.binMax} {param.parameterUnit}
                                    </td>
                                    <td className="px-3 py-2 text-gray-800 font-medium text-xs">
                                      {bin.leastCount} {param.parameterUnit}
                                    </td>
                                    <td className="px-3 py-2 text-gray-800 font-medium text-xs">
                                      ± {bin.accuracy}{' '}
                                      {param.accuracyType === 'ABSOLUTE'
                                        ? param.parameterUnit
                                        : param.accuracyType === 'PERCENT_READING'
                                          ? '% of reading'
                                          : '% of scale'}
                                    </td>
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          </div>
                        </div>
                      )}
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </CollapsibleSection>

        {/* Environmental Conditions */}
        <CollapsibleSection
          id="environment"
          title="Environmental Conditions"
          icon={Thermometer}
          color="blue"
        >
          <div className="flex flex-wrap gap-6">
            <div className="flex items-center gap-3 bg-slate-50 rounded-lg px-4 py-3 border border-slate-200">
              <Thermometer className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-xs text-slate-600 font-bold uppercase tracking-wide">Ambient Temperature</p>
                <p className="text-sm font-bold text-gray-900">
                  {certificate.ambientTemperature ? `${certificate.ambientTemperature} °C` : '-'}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-3 bg-blue-50 rounded-lg px-4 py-3 border border-blue-100">
              <Droplets className="h-8 w-8 text-blue-500" />
              <div>
                <p className="text-xs text-blue-600 font-bold uppercase tracking-wide">Relative Humidity</p>
                <p className="text-sm font-bold text-gray-900">
                  {certificate.relativeHumidity ? `${certificate.relativeHumidity} %RH` : '-'}
                </p>
              </div>
            </div>
          </div>
        </CollapsibleSection>

        {/* Master Instruments */}
        {certificate.masterInstruments.length > 0 && (
          <CollapsibleSection
            id="master-instruments"
            title="Master Instruments Used"
            icon={Wrench}
            color="blue"
            badge={
              <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded-full font-medium">
                {certificate.masterInstruments.length} Instrument{certificate.masterInstruments.length > 1 ? 's' : ''}
              </span>
            }
          >
            <div className="space-y-4">
              {certificate.masterInstruments.map((mi) => {
                const linkedParams = certificate.parameters.filter(
                  (p) => p.masterInstrumentId === mi.masterInstrumentId
                )

                return (
                  <div key={mi.id} className="border border-blue-100 rounded-lg p-4 bg-blue-50/50">
                    <div className="grid grid-cols-2 md:grid-cols-3 gap-3 text-sm">
                      <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Description</p>
                        <p className="font-medium text-gray-900">{mi.description || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Category</p>
                        <p className="font-medium text-gray-900">{mi.category || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Make / Model</p>
                        <p className="font-medium text-gray-900">
                          {mi.make || '-'} / {mi.model || '-'}
                        </p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Serial Number</p>
                        <p className="font-medium text-gray-900">{mi.serialNumber || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Asset No</p>
                        <p className="font-medium text-gray-900">{mi.assetNo || '-'}</p>
                      </div>
                      <div>
                        <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Calibration Due</p>
                        <p className="font-medium text-gray-900">{mi.calibrationDueDate || '-'}</p>
                      </div>
                      {mi.reportNo && (
                        <div>
                          <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Report No</p>
                          <p className="font-medium text-gray-900">{mi.reportNo}</p>
                        </div>
                      )}
                      {mi.calibratedAt && (
                        <div>
                          <p className="text-gray-500 text-xs uppercase tracking-wide font-semibold mb-1">Calibrated At</p>
                          <p className="font-medium text-gray-900">{mi.calibratedAt}</p>
                        </div>
                      )}
                    </div>

                    {/* Parameters calibrated with this instrument */}
                    {linkedParams.length > 0 && (
                      <div className="mt-4 pt-4 border-t border-blue-100">
                        <p className="text-xs font-semibold text-blue-700 uppercase tracking-wide mb-2">
                          Parameters Calibrated
                        </p>
                        <div className="flex flex-wrap gap-2">
                          {linkedParams.map((param) => (
                            <div
                              key={param.id}
                              className="flex items-center gap-2 bg-white rounded-lg px-3 py-2 text-sm border border-blue-100"
                            >
                              <span className="font-medium text-gray-800">
                                {param.parameterName || 'Unnamed Parameter'}
                                {param.parameterUnit && (
                                  <span className="text-gray-500 ml-1">({param.parameterUnit})</span>
                                )}
                              </span>
                              {param.sopReference && (
                                <span className="text-xs bg-blue-100 text-blue-700 px-2 py-0.5 rounded font-medium">
                                  {param.sopReference}
                                </span>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                )
              })}
            </div>
          </CollapsibleSection>
        )}

        {/* Calibration Results */}
        {certificate.parameters.length > 0 && (
          <CollapsibleSection
            id="results"
            title="Calibration Results"
            icon={ClipboardCheck}
            color="blue"
            badge={
              <span
                className={cn(
                  'text-xs px-2 py-0.5 rounded-full font-medium',
                  failCount === 0 ? 'bg-green-100 text-green-700' : 'bg-red-100 text-red-700'
                )}
              >
                {failCount === 0 ? 'All Pass' : `${failCount} Out of Limit`}
              </span>
            }
          >
            <div className="space-y-6">
              {certificate.parameters.map((param) => (
                <div key={param.id}>
                  <h3 className="font-semibold text-gray-800 mb-3 flex items-center gap-2">
                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded">
                      {param.parameterName || 'Parameter'}
                    </span>
                    {param.parameterUnit && (
                      <span className="text-gray-500 text-sm font-normal">({param.parameterUnit})</span>
                    )}
                  </h3>
                  <div className="overflow-x-auto">
                    <table className="w-full text-sm border border-blue-100 rounded-lg overflow-hidden">
                      <thead className="bg-blue-50">
                        <tr>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-blue-700 uppercase">
                            Sl.No
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-blue-700 uppercase">
                            Standard Reading
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-blue-700 uppercase">
                            UUC Reading
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-blue-700 uppercase">
                            Error
                          </th>
                          <th className="px-3 py-2 text-left text-xs font-semibold text-blue-700 uppercase">
                            Status
                          </th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-blue-100">
                        {param.results.map((result) => (
                          <tr
                            key={result.id}
                            className={cn(
                              'bg-white',
                              result.isOutOfLimit && 'bg-red-50'
                            )}
                          >
                            <td className="px-3 py-2 font-medium text-gray-700 text-xs">{result.pointNumber}</td>
                            <td className="px-3 py-2 text-gray-800 text-xs">{result.standardReading || '-'}</td>
                            <td className="px-3 py-2 text-gray-800 text-xs">{result.beforeAdjustment || '-'}</td>
                            <td className={cn(
                              "px-3 py-2 font-medium text-xs",
                              result.isOutOfLimit ? "text-red-600" : "text-gray-800"
                            )}>
                              {result.errorObserved !== null ? result.errorObserved : '-'}
                            </td>
                            <td className="px-3 py-2">
                              {result.isOutOfLimit ? (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-red-100 text-red-700">
                                  <AlertTriangle className="h-3 w-3" />
                                  Out of Limit
                                </span>
                              ) : (
                                <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs bg-green-100 text-green-700">
                                  <CheckCircle className="h-3 w-3" />
                                  Pass
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
          </CollapsibleSection>
        )}

        {/* Calibration Status */}
        <CollapsibleSection
          id="status"
          title="Calibration Status"
          icon={Target}
          color="blue"
        >
          {calibrationStatus.length > 0 ? (
            <div className="space-y-2 mb-4">
              {calibrationStatus.map((statusId: string, idx: number) => {
                const statusOption = CALIBRATION_STATUS_OPTIONS[statusId]
                const statusType = statusOption?.type || 'info'
                const statusLabel = statusOption?.label || statusId.replace(/_/g, ' ')

                return (
                  <div
                    key={idx}
                    className={cn(
                      'flex items-start gap-3 p-3 rounded-lg border',
                      statusType === 'success' && 'bg-green-50 border-green-200',
                      statusType === 'error' && 'bg-red-50 border-red-200',
                      statusType === 'warning' && 'bg-amber-50 border-amber-200',
                      statusType === 'info' && 'bg-gray-50 border-gray-200'
                    )}
                  >
                    {statusType === 'success' && <CheckCircle className="h-5 w-5 text-green-600 mt-0.5 flex-shrink-0" />}
                    {statusType === 'error' && <AlertCircle className="h-5 w-5 text-red-600 mt-0.5 flex-shrink-0" />}
                    {statusType === 'warning' && <AlertTriangle className="h-5 w-5 text-amber-600 mt-0.5 flex-shrink-0" />}
                    {statusType === 'info' && <CheckCircle className="h-5 w-5 text-gray-600 mt-0.5 flex-shrink-0" />}
                    <span className={cn(
                      'text-sm font-medium',
                      statusType === 'success' && 'text-green-800',
                      statusType === 'error' && 'text-red-800',
                      statusType === 'warning' && 'text-amber-800',
                      statusType === 'info' && 'text-gray-800'
                    )}>
                      {statusLabel}
                    </span>
                  </div>
                )
              })}
            </div>
          ) : (
            <p className="text-gray-500 text-sm mb-4">No status selected</p>
          )}

          {certificate.statusNotes && (
            <div className="mb-4 p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">Notes</p>
              <p className="text-gray-700">{certificate.statusNotes}</p>
            </div>
          )}

          {/* Sticker Status */}
          <div className="grid grid-cols-2 gap-4">
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">
                Old Sticker Removed
              </p>
              <p className="font-medium text-gray-700 capitalize text-sm">{certificate.stickerOldRemoved || '-'}</p>
            </div>
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-500 uppercase tracking-wide font-semibold mb-1">
                New Sticker Affixed
              </p>
              <p className="font-medium text-gray-700 capitalize text-sm">{certificate.stickerNewAffixed || '-'}</p>
            </div>
          </div>
        </CollapsibleSection>

        {/* Conclusion Statements */}
        <CollapsibleSection
          id="conclusion"
          title="Conclusion Statements"
          icon={Award}
          color="blue"
          badge={
            selectedConclusions.length > 0 && (
              <span className="text-xs bg-slate-100 text-slate-700 px-2 py-0.5 rounded-full font-medium">
                {selectedConclusions.length} Statement{selectedConclusions.length > 1 ? 's' : ''}
              </span>
            )
          }
        >
          {selectedConclusions.length > 0 ? (
            <ul className="space-y-2">
              {selectedConclusions.map((key: string, idx: number) => (
                <li
                  key={idx}
                  className="flex items-start gap-3 p-3 bg-slate-50 rounded-lg border border-slate-100"
                >
                  <CheckCircle className="h-5 w-5 text-green-500 mt-0.5 flex-shrink-0" />
                  <span className="text-gray-700 text-sm">{conclusionStatements[key] || key}</span>
                </li>
              ))}
            </ul>
          ) : (
            <p className="text-gray-500 text-sm">No conclusion statements selected</p>
          )}
        </CollapsibleSection>
      </div>
    </>
  )
}
