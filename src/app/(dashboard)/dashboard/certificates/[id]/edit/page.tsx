'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Send, Save, Loader2, AlertTriangle, MessageSquare, User, ChevronDown, ChevronUp, ChevronRight, Calendar, ArrowRight, MapPin } from 'lucide-react'
import {
  SummarySection,
  UUCSection,
  MasterInstrumentSection,
  EnvironmentalSection,
  ResultsSection,
  RemarksSection,
  ConclusionSection,
  FinalizeSection,
  SectionFeedback,
} from '@/components/forms'
import { FeedbackTimeline } from '@/components/feedback/shared'
import { useCertificateStore, CertificateFormData, Parameter, CalibrationResult } from '@/lib/stores/certificate-store'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { Button } from '@/components/ui/button'
import { ChatSidebar } from '@/components/chat/ChatSidebar'

const SECTIONS: { id: string; label: string; showWhenNotDraft?: boolean }[] = [
  { id: 'summary', label: 'Summary' },
  { id: 'uuc-details', label: 'UUC Details' },
  { id: 'master-inst', label: 'Master Inst' },
  { id: 'environment', label: 'Environment' },
  { id: 'results', label: 'Results' },
  { id: 'remarks', label: 'Remarks' },
  { id: 'conclusion', label: 'Conclusion' },
  { id: 'feedback-history', label: 'History', showWhenNotDraft: true },
  { id: 'submit', label: 'Submit' },
]

const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-slate-50 text-slate-700 border-slate-200' },
  REVISION_REQUIRED: { label: 'Revision Required', className: 'bg-orange-50 text-orange-700 border-orange-200' },
  PENDING_REVIEW: { label: 'Pending Review', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  PENDING_HOD_REVIEW: { label: 'Pending Review', className: 'bg-amber-50 text-amber-700 border-amber-200' },
  PENDING_CUSTOMER_APPROVAL: { label: 'Pending Customer', className: 'bg-blue-50 text-blue-700 border-blue-200' },
  APPROVED: { label: 'Approved', className: 'bg-green-50 text-green-700 border-green-200' },
  REJECTED: { label: 'Rejected', className: 'bg-red-50 text-red-700 border-red-200' },
}

interface ApiMasterInstrument {
  id: string
  masterInstrumentId: string
  sopReference: string
  category: string | null
  description: string | null
  make: string | null
  model: string | null
  assetNo: string | null
  serialNumber: string | null
  calibratedAt: string | null
  reportNo: string | null
  calibrationDueDate: string | null
}

interface ApiCertificate {
  id: string
  certificateNumber: string
  status: string
  calibratedAt: string
  srfNumber: string | null
  srfDate: string | null
  dateOfCalibration: string | null
  calibrationTenure: number
  dueDateAdjustment: number
  calibrationDueDate: string | null
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
  additionalConclusionStatement: string | null
  parameters: ApiParameter[]
  masterInstruments: ApiMasterInstrument[]
  feedbacks?: ApiFeedback[]
  events?: ApiEvent[]
  currentRevision: number
  updatedAt: string
  reviewer?: {
    id: string
    name: string | null
  } | null
}

interface ApiParameter {
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
  accuracyType: string | null
  errorFormula: string | null
  showAfterAdjustment: boolean
  requiresBinning: boolean
  bins: string | null
  sopReference: string | null
  masterInstrumentId: string | null
  results: ApiResult[]
}

interface ApiResult {
  id: string
  pointNumber: number
  standardReading: string | null
  beforeAdjustment: string | null
  afterAdjustment: string | null
  errorObserved: number | null
  isOutOfLimit: boolean
}

interface HoDEdit {
  field: string
  fieldLabel: string
  previousValue: string | null
  newValue: string
  reason: string
  autoCalculated: boolean
}

interface ApiFeedback {
  id: string
  feedbackType: string
  comment: string | null
  createdAt: string
  revisionNumber: number
  targetSection: string | null
  user: {
    name: string
    role: string
  }
  hodEdits?: HoDEdit[] | null
}

interface ApiEvent {
  id: string
  eventType: string
  eventData: string
  createdAt: string
  revision: number
  user: {
    name: string
    role: string
  }
}

function transformApiToFormData(apiData: ApiCertificate): Partial<CertificateFormData> {
  const generateId = () => Math.random().toString(36).substring(2, 9)

  const parseBins = (binsJson: string | null) => {
    if (!binsJson) return []
    try {
      return JSON.parse(binsJson)
    } catch {
      return []
    }
  }

  const parameters: Parameter[] = apiData.parameters.map((param) => ({
    id: generateId(),
    parameterName: param.parameterName || '',
    parameterUnit: param.parameterUnit || '',
    rangeMin: param.rangeMin || '',
    rangeMax: param.rangeMax || '',
    rangeUnit: param.rangeUnit || '',
    operatingMin: param.operatingMin || '',
    operatingMax: param.operatingMax || '',
    operatingUnit: param.operatingUnit || '',
    leastCountValue: param.leastCountValue || '',
    leastCountUnit: param.leastCountUnit || '',
    accuracyValue: param.accuracyValue || '',
    accuracyUnit: param.accuracyUnit || '',
    accuracyType: (param.accuracyType || 'ABSOLUTE') as 'PERCENT_READING' | 'ABSOLUTE' | 'PERCENT_SCALE',
    requiresBinning: param.requiresBinning || false,
    bins: parseBins(param.bins),
    errorFormula: param.errorFormula || 'A-B',
    showAfterAdjustment: param.showAfterAdjustment || false,
    masterInstrumentId: param.masterInstrumentId ? parseInt(param.masterInstrumentId) : null,
    sopReference: param.sopReference || '',
    results: param.results.map((result): CalibrationResult => ({
      id: generateId(),
      pointNumber: result.pointNumber,
      standardReading: result.standardReading || '',
      beforeAdjustment: result.beforeAdjustment || '',
      afterAdjustment: result.afterAdjustment || '',
      errorObserved: result.errorObserved,
      isOutOfLimit: result.isOutOfLimit || false,
    })),
  }))

  if (parameters.length === 0) {
    parameters.push({
      id: generateId(),
      parameterName: '',
      parameterUnit: '',
      rangeMin: '',
      rangeMax: '',
      rangeUnit: '',
      operatingMin: '',
      operatingMax: '',
      operatingUnit: '',
      leastCountValue: '',
      leastCountUnit: '',
      accuracyValue: '',
      accuracyUnit: '',
      accuracyType: 'ABSOLUTE',
      requiresBinning: false,
      bins: [],
      errorFormula: 'A-B',
      showAfterAdjustment: false,
      masterInstrumentId: null,
      sopReference: '',
      results: [{
        id: generateId(),
        pointNumber: 1,
        standardReading: '',
        beforeAdjustment: '',
        afterAdjustment: '',
        errorObserved: null,
        isOutOfLimit: false,
      }],
    })
  }

  let calibrationStatus: string[] = []
  let selectedConclusionStatements: string[] = []

  try {
    calibrationStatus = apiData.calibrationStatus ? JSON.parse(apiData.calibrationStatus) : []
  } catch {
    calibrationStatus = []
  }

  try {
    selectedConclusionStatements = apiData.selectedConclusionStatements ? JSON.parse(apiData.selectedConclusionStatements) : []
  } catch {
    selectedConclusionStatements = []
  }

  const masterInstruments = apiData.masterInstruments && apiData.masterInstruments.length > 0
    ? apiData.masterInstruments.map((mi) => {
        const dueDate = mi.calibrationDueDate ? new Date(mi.calibrationDueDate) : null
        const now = new Date()
        const thirtyDaysFromNow = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000)

        return {
          id: generateId(),
          masterInstrumentId: parseInt(mi.masterInstrumentId) || 0,
          category: mi.category || '',
          description: mi.description || '',
          make: mi.make || '',
          model: mi.model || '',
          assetNo: mi.assetNo || '',
          serialNumber: mi.serialNumber || '',
          calibratedAt: mi.calibratedAt || '',
          reportNo: mi.reportNo || '',
          calibrationDueDate: mi.calibrationDueDate || '',
          isExpired: dueDate ? dueDate < now : false,
          isExpiringSoon: dueDate ? (dueDate >= now && dueDate <= thirtyDaysFromNow) : false,
        }
      })
    : [{
        id: generateId(),
        masterInstrumentId: 0,
        category: '',
        description: '',
        make: '',
        model: '',
        assetNo: '',
        serialNumber: '',
        calibratedAt: '',
        reportNo: '',
        calibrationDueDate: '',
        isExpired: false,
        isExpiringSoon: false,
      }]

  return {
    certificateNumber: apiData.certificateNumber,
    status: apiData.status as CertificateFormData['status'],
    lastSaved: new Date(apiData.updatedAt),
    calibratedAt: (apiData.calibratedAt || 'LAB') as 'LAB' | 'SITE',
    srfNumber: apiData.srfNumber || '',
    srfDate: apiData.srfDate ? apiData.srfDate.split('T')[0] : '',
    dateOfCalibration: apiData.dateOfCalibration ? apiData.dateOfCalibration.split('T')[0] : '',
    calibrationTenure: (apiData.calibrationTenure || 12) as 3 | 6 | 9 | 12,
    dueDateAdjustment: (apiData.dueDateAdjustment || 0) as -3 | -2 | -1 | 0,
    calibrationDueDate: apiData.calibrationDueDate ? apiData.calibrationDueDate.split('T')[0] : '',
    dueDateNotApplicable: apiData.dueDateNotApplicable || false,
    customerName: apiData.customerName || '',
    customerAddress: apiData.customerAddress || '',
    uucDescription: apiData.uucDescription || '',
    uucMake: apiData.uucMake || '',
    uucModel: apiData.uucModel || '',
    uucSerialNumber: apiData.uucSerialNumber || '',
    uucInstrumentId: apiData.uucInstrumentId || '',
    uucLocationName: apiData.uucLocationName || '',
    uucMachineName: apiData.uucMachineName || '',
    ambientTemperature: apiData.ambientTemperature || '',
    relativeHumidity: apiData.relativeHumidity || '',
    calibrationStatus,
    stickerOldRemoved: (apiData.stickerOldRemoved || null) as 'yes' | 'no' | 'na' | null,
    stickerNewAffixed: (apiData.stickerNewAffixed || null) as 'yes' | 'no' | 'na' | null,
    statusNotes: apiData.statusNotes || '',
    selectedConclusionStatements,
    additionalConclusionStatement: apiData.additionalConclusionStatement || '',
    parameters,
    masterInstruments,
  }
}

function formatDateDisplay(dateStr: string | null): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

function mergeDateAdjustmentsWithFeedbacks(
  feedbacks: ApiFeedback[],
  events: ApiEvent[]
): ApiFeedback[] {
  if (!events || events.length === 0) return feedbacks

  const dateAdjustmentMap = new Map<number, { edits: HoDEdit[] }>()

  events.forEach((event) => {
    try {
      const data = JSON.parse(event.eventData)
      const eventTime = new Date(event.createdAt).getTime()

      let edits: HoDEdit[] = []

      if (data.edits && Array.isArray(data.edits)) {
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

      dateAdjustmentMap.set(eventTime, { edits })
    } catch (e) {
      console.error('Error parsing date event data:', e)
    }
  })

  return feedbacks.map((feedback) => {
    const feedbackTime = new Date(feedback.createdAt).getTime()

    let matchedAdjustment = null
    for (const [eventTime, adjustment] of dateAdjustmentMap.entries()) {
      if (Math.abs(feedbackTime - eventTime) < 10000) {
        matchedAdjustment = adjustment
        dateAdjustmentMap.delete(eventTime)
        break
      }
    }

    let cleanComment = feedback.comment
    if (matchedAdjustment && cleanComment) {
      const editsSectionIndex = cleanComment.indexOf('[HoD Edits Applied]')
      if (editsSectionIndex !== -1) {
        cleanComment = cleanComment.substring(0, editsSectionIndex).trim()
      }
    }

    return {
      ...feedback,
      comment: cleanComment,
      hodEdits: matchedAdjustment?.edits || null,
    }
  })
}

export default function EditCertificatePage() {
  const params = useParams()
  const certificateId = params.id as string

  const { formData, isDirty, isSaving, saveDraft, loadForm, setCertificateId } = useCertificateStore()
  const [activeSection, setActiveSection] = useState('summary')
  const [isScrolled, setIsScrolled] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [feedbacks, setFeedbacks] = useState<ApiFeedback[]>([])
  const [isTopFeedbackExpanded, setIsTopFeedbackExpanded] = useState(true)
  const [currentRevision, setCurrentRevision] = useState(1)
  const [reviewerName, setReviewerName] = useState<string | null>(null)
  const [isChatExpanded, setIsChatExpanded] = useState(true)

  // Fetch certificate data on mount
  useEffect(() => {
    async function fetchCertificate() {
      try {
        setIsLoading(true)
        setLoadError(null)

        const response = await fetch(`/api/certificates/${certificateId}`)

        if (!response.ok) {
          if (response.status === 404) {
            setLoadError('Certificate not found')
          } else if (response.status === 403) {
            setLoadError('You do not have permission to edit this certificate')
          } else {
            setLoadError('Failed to load certificate')
          }
          return
        }

        const data: ApiCertificate = await response.json()

        if (data.status === 'APPROVED' || data.status === 'REJECTED') {
          setLoadError('This certificate cannot be edited')
          return
        }

        const formData = transformApiToFormData(data)
        loadForm(formData)
        setCertificateId(certificateId)

        if (data.feedbacks) {
          const mergedFeedbacks = mergeDateAdjustmentsWithFeedbacks(
            data.feedbacks,
            data.events || []
          )
          setFeedbacks(mergedFeedbacks)
        }

        setCurrentRevision(data.currentRevision ?? 1)
        setReviewerName(data.reviewer?.name || null)
      } catch (error) {
        console.error('Error fetching certificate:', error)
        setLoadError('Failed to load certificate')
      } finally {
        setIsLoading(false)
      }
    }

    if (certificateId) {
      fetchCertificate()
    }
  }, [certificateId, loadForm, setCertificateId])

  // Auto-save functionality
  const autoSave = useCallback(async () => {
    if (!isDirty) return

    setSaveError(null)
    const result = await saveDraft()
    if (!result.success) {
      setSaveError(result.error || 'Failed to save')
    }
  }, [isDirty, saveDraft])

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(autoSave, 30000)
    return () => clearInterval(interval)
  }, [autoSave])

  // Track scroll position
  useEffect(() => {
    const container = document.getElementById('form-content')
    if (!container) return

    const handleScroll = () => {
      const scrollTop = container.scrollTop
      setIsScrolled(scrollTop > 100)

      const sections = SECTIONS.map((s) => ({
        id: s.id,
        element: document.getElementById(s.id),
      })).filter((s) => s.element)

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i]
        if (section.element && section.element.offsetTop - 200 <= scrollTop) {
          setActiveSection(section.id)
          break
        }
      }
    }

    container.addEventListener('scroll', handleScroll)
    return () => container.removeEventListener('scroll', handleScroll)
  }, [isLoading])

  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    const container = document.getElementById('form-content')
    if (element && container) {
      container.scrollTo({
        top: element.offsetTop - 20,
        behavior: 'smooth'
      })
    }
  }

  const formatLastSaved = () => {
    if (!formData.lastSaved) return 'Not saved'
    const now = new Date()
    const diff = Math.floor((now.getTime() - formData.lastSaved.getTime()) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)}m ago`
    return formData.lastSaved.toLocaleTimeString()
  }

  const statusConfig = STATUS_CONFIG[formData.status] || STATUS_CONFIG.DRAFT

  if (isLoading) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4">
          <Loader2 className="size-8 animate-spin text-primary" />
          <p className="text-slate-600">Loading certificate...</p>
        </div>
      </div>
    )
  }

  if (loadError) {
    return (
      <div className="flex h-full items-center justify-center">
        <div className="flex flex-col items-center gap-4 text-center">
          <div className="size-16 rounded-full bg-red-100 flex items-center justify-center">
            <AlertTriangle className="size-8 text-red-600" />
          </div>
          <h2 className="text-xl font-semibold text-slate-900">{loadError}</h2>
          <Link href="/dashboard" className="text-primary hover:underline font-medium">
            Return to Dashboard
          </Link>
        </div>
      </div>
    )
  }

  return (
    <div className="flex h-full bg-slate-100 p-3 gap-3">
      {/* Left Side - Certificate Card */}
      <div className="flex-1 flex flex-col min-w-0 overflow-hidden">
        <div className="flex-1 flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden">
          {/* Header Section */}
          <div className="flex-shrink-0 border-b border-slate-200">
            {/* Top Row - Back, Title, Status, Actions */}
            <div className="px-6 py-4">
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
                    {formData.certificateNumber || 'New Certificate'}
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
                  <span className="text-xs text-slate-500">
                    Saved {formatLastSaved()}
                  </span>
                  <Button
                    onClick={autoSave}
                    disabled={isSaving || !isDirty}
                    size="sm"
                    variant="outline"
                    className="h-8"
                  >
                    <Save className="size-3.5 mr-1.5" />
                    {isSaving ? 'Saving...' : 'Save'}
                  </Button>
                  <Button
                    onClick={() => scrollToSection('submit')}
                    size="sm"
                    className="h-8 bg-primary text-white"
                  >
                    <Send className="size-3.5 mr-1.5" />
                    Submit
                  </Button>
                </div>
              </div>

              {/* Meta Info Row */}
              <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm mt-3">
                <div className="flex items-center gap-2 text-slate-600">
                  <div className="p-1 rounded bg-slate-100">
                    <User className="size-3 text-slate-500" />
                  </div>
                  <span className="font-medium text-slate-700">
                    {formData.customerName || 'No customer'}
                  </span>
                </div>
                <div className="flex items-center gap-2 text-slate-600">
                  <div className="p-1 rounded bg-slate-100">
                    <MapPin className="size-3 text-slate-500" />
                  </div>
                  <span>{formData.calibratedAt === 'LAB' ? 'Laboratory' : 'Site'}</span>
                </div>
                <div className="flex items-center gap-2 text-slate-500">
                  <span className="text-slate-300">|</span>
                  <span>Revision {currentRevision}</span>
                </div>
              </div>
            </div>

            {/* Section Tabs */}
            <div className="px-4 overflow-x-auto no-scrollbar border-t border-slate-100">
              <div className="flex items-center gap-1 py-1 min-w-max">
                {SECTIONS
                  .filter(section => !section.showWhenNotDraft || formData.status !== 'DRAFT')
                  .map((section) => (
                    <button
                      key={section.id}
                      type="button"
                      onClick={() => scrollToSection(section.id)}
                      className={cn(
                        'px-3 py-1.5 text-[12px] font-semibold text-slate-600 hover:text-primary hover:bg-slate-50 rounded-md transition-all border-b-2',
                        activeSection === section.id
                          ? 'border-primary text-primary font-bold bg-primary/5'
                          : 'border-transparent'
                      )}
                    >
                      {section.label}
                    </button>
                  ))}
              </div>
            </div>
          </div>

          {/* Content Area - Scrollable */}
          <div id="form-content" className="flex-1 min-h-0 overflow-auto bg-slate-50/30">
            <div className="p-6">
              {/* Feedback Banner */}
              {formData.status === 'REVISION_REQUIRED' && feedbacks.filter(f => f.feedbackType === 'REVISION_REQUEST' || f.feedbackType === 'CUSTOMER_REVISION_FORWARDED').length > 0 && (() => {
                const latestFeedback = feedbacks.filter(f => f.feedbackType === 'REVISION_REQUEST' || f.feedbackType === 'CUSTOMER_REVISION_FORWARDED')[0]
                const isCustomerForwarded = latestFeedback?.feedbackType === 'CUSTOMER_REVISION_FORWARDED'

                return (
                  <div className={cn(
                    "rounded-xl border-2 overflow-hidden mb-6",
                    isCustomerForwarded ? "border-purple-300 bg-purple-50" : "border-orange-300 bg-orange-50"
                  )}>
                    <button
                      onClick={() => setIsTopFeedbackExpanded(!isTopFeedbackExpanded)}
                      className={cn(
                        "w-full px-4 py-3 flex items-center justify-between border-b transition-colors",
                        isCustomerForwarded ? "bg-purple-100 border-purple-200" : "bg-orange-100 border-orange-200"
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <div className={cn("p-1.5 rounded-lg", isCustomerForwarded ? "bg-purple-200" : "bg-orange-200")}>
                          <AlertTriangle className={cn("size-4", isCustomerForwarded ? "text-purple-700" : "text-orange-700")} />
                        </div>
                        <h3 className={cn("font-bold text-sm", isCustomerForwarded ? "text-purple-900" : "text-orange-900")}>
                          {isCustomerForwarded ? 'Customer Revision Forwarded' : 'Revision Required'}
                        </h3>
                      </div>
                      {isTopFeedbackExpanded ? (
                        <ChevronUp className={cn("size-4", isCustomerForwarded ? "text-purple-700" : "text-orange-700")} />
                      ) : (
                        <ChevronDown className={cn("size-4", isCustomerForwarded ? "text-purple-700" : "text-orange-700")} />
                      )}
                    </button>
                    {isTopFeedbackExpanded && (
                      <div className="p-4">
                        {feedbacks.filter(f => f.feedbackType === 'REVISION_REQUEST' || f.feedbackType === 'CUSTOMER_REVISION_FORWARDED').slice(0, 1).map((feedback) => (
                          <div key={feedback.id} className={cn(
                            "bg-white rounded-lg border p-3",
                            feedback.feedbackType === 'CUSTOMER_REVISION_FORWARDED' ? "border-purple-200" : "border-orange-200"
                          )}>
                            <div className="flex items-start gap-3">
                              <div className={cn("p-1.5 rounded-full", feedback.feedbackType === 'CUSTOMER_REVISION_FORWARDED' ? "bg-purple-100" : "bg-orange-100")}>
                                <User className={cn("size-3.5", feedback.feedbackType === 'CUSTOMER_REVISION_FORWARDED' ? "text-purple-600" : "text-orange-600")} />
                              </div>
                              <div className="flex-1 min-w-0">
                                <div className="flex items-center gap-2 mb-1.5">
                                  <span className="font-semibold text-slate-900 text-xs">{feedback.user.name}</span>
                                  <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                                    {feedback.user.role === 'HOD' ? 'HoD' : feedback.user.role}
                                  </span>
                                </div>
                                {feedback.comment && (
                                  <div className="flex items-start gap-2">
                                    <MessageSquare className="size-3.5 text-slate-400 mt-0.5 flex-shrink-0" />
                                    <p className="text-slate-700 whitespace-pre-wrap text-xs">{feedback.comment}</p>
                                  </div>
                                )}
                                {feedback.hodEdits && feedback.hodEdits.length > 0 && (
                                  <div className="mt-3 p-2.5 bg-amber-50 border border-amber-200 rounded-lg">
                                    <div className="flex items-center gap-1.5 text-amber-700 font-semibold mb-2 text-xs">
                                      <Calendar className="size-3.5" />
                                      HoD Edits Applied
                                    </div>
                                    <div className="space-y-2">
                                      {feedback.hodEdits.map((edit, idx) => (
                                        <div key={edit.field} className={cn(idx > 0 && 'pt-2 border-t border-amber-200/60')}>
                                          <p className="font-semibold text-slate-700 text-[11px] mb-0.5">{edit.fieldLabel}</p>
                                          <div className="flex items-center gap-1.5 text-slate-600 text-xs">
                                            <span>{formatDateDisplay(edit.previousValue)}</span>
                                            <ArrowRight className="size-3 text-slate-400" />
                                            <span className={cn('font-semibold', edit.autoCalculated ? 'text-blue-600' : 'text-amber-700')}>
                                              {formatDateDisplay(edit.newValue)}
                                            </span>
                                          </div>
                                        </div>
                                      ))}
                                    </div>
                                  </div>
                                )}
                              </div>
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                )
              })()}

              {/* Form Sections */}
              <div className="space-y-6">
                <SummarySection
                  isNewCertificate={formData.status === 'DRAFT'}
                  certificateId={certificateId}
                  reviewerName={reviewerName}
                  feedbackSlot={<SectionFeedback feedbacks={feedbacks} sectionId="summary" />}
                />
                <UUCSection
                  feedbackSlot={<SectionFeedback feedbacks={feedbacks} sectionId="uuc-details" />}
                />
                <MasterInstrumentSection
                  feedbackSlot={<SectionFeedback feedbacks={feedbacks} sectionId="master-inst" />}
                />
                <EnvironmentalSection
                  feedbackSlot={<SectionFeedback feedbacks={feedbacks} sectionId="environment" />}
                />
                <ResultsSection
                  feedbackSlot={<SectionFeedback feedbacks={feedbacks} sectionId="results" />}
                />
                <RemarksSection
                  feedbackSlot={<SectionFeedback feedbacks={feedbacks} sectionId="remarks" />}
                />
                <ConclusionSection
                  feedbackSlot={<SectionFeedback feedbacks={feedbacks} sectionId="conclusion" />}
                />
                {/* Feedback History Section - Only show if not a draft */}
                {formData.status !== 'DRAFT' && (
                  <FeedbackTimeline
                    feedbacks={feedbacks}
                    currentRevision={currentRevision}
                    title="Feedback History"
                    emptyMessage="No feedback history yet"
                    groupBySection={true}
                    showRevisionTransition={true}
                  />
                )}
                <FinalizeSection feedbacks={feedbacks} reviewerName={reviewerName} />
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Right Panel - Chat */}
      <div className="w-[380px] flex-shrink-0 flex flex-col gap-3">
        {/* Chat Box */}
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
              {reviewerName && (
                <div className="flex-shrink-0 px-4 py-3 border-t border-b border-slate-100 bg-slate-50/50">
                  <div className="flex items-center gap-3">
                    {/* Avatar */}
                    <div className="size-10 rounded-full bg-slate-700 text-white flex items-center justify-center font-semibold text-sm flex-shrink-0">
                      {reviewerName.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2)}
                    </div>
                    {/* Name & Status */}
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-slate-900 truncate">
                        {reviewerName}
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
                {reviewerName ? (
                  <ChatSidebar
                    isOpen={true}
                    onClose={() => {}}
                    certificateId={certificateId}
                    threadType="ASSIGNEE_REVIEWER"
                    embedded={true}
                  />
                ) : (
                  <div className="flex items-center justify-center h-full text-slate-400 text-xs p-4 text-center">
                    <div>
                      <MessageSquare className="size-8 mx-auto mb-2 text-slate-300" />
                      <p className="font-medium text-slate-600">No reviewer assigned yet</p>
                      <p className="text-[10px] mt-1 text-slate-400">Chat will be available once a reviewer is assigned</p>
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
