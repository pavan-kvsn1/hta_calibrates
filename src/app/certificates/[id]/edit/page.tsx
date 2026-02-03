'use client'

import { useEffect, useState, useCallback } from 'react'
import { useParams, useRouter } from 'next/navigation'
import Link from 'next/link'
import { ArrowLeft, Eye, Send, Cloud, Clock, Save, Loader2, AlertTriangle, MessageSquare, User, ChevronDown, ChevronUp, History, Calendar, ArrowRight } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import {
  SummarySection,
  UUCSection,
  MasterInstrumentSection,
  EnvironmentalSection,
  ResultsSection,
  RemarksSection,
  ConclusionSection,
  FinalizeSection,
} from '@/components/forms'
import { useCertificateStore, CertificateFormData, Parameter, CalibrationResult } from '@/lib/certificate-store'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'
import { FeedbackSidebar } from '@/components/feedback'

const SECTIONS = [
  { id: 'summary', label: 'Summary' },
  { id: 'uuc-details', label: 'UUC Details' },
  { id: 'master-inst', label: 'Master Inst' },
  { id: 'environment', label: 'Environment' },
  { id: 'results', label: 'Results' },
  { id: 'remarks', label: 'Remarks' },
  { id: 'conclusion', label: 'Conclusion' },
  { id: 'submit', label: 'Submit' },
]

// Status badge configuration
const STATUS_CONFIG: Record<string, { label: string; className: string }> = {
  DRAFT: { label: 'Draft', className: 'bg-amber-50 text-amber-600 border-amber-100' },
  REVISION_REQUIRED: { label: 'Revision Required', className: 'bg-orange-50 text-orange-600 border-orange-100' },
  PENDING_HOD_REVIEW: { label: 'Pending Review', className: 'bg-blue-50 text-blue-600 border-blue-100' },
  PENDING_CUSTOMER_APPROVAL: { label: 'Pending Customer', className: 'bg-purple-50 text-purple-600 border-purple-100' },
  APPROVED: { label: 'Approved', className: 'bg-green-50 text-green-600 border-green-100' },
  REJECTED: { label: 'Rejected', className: 'bg-red-50 text-red-600 border-red-100' },
}

interface ApiMasterInstrument {
  id: string
  masterInstrumentId: string
  sopReference: string
  // Details are now stored directly (not nested under masterInstrument)
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
  parameters: ApiParameter[]
  masterInstruments: ApiMasterInstrument[]
  feedbacks?: ApiFeedback[]
  events?: ApiEvent[]
  currentRevision: number
  updatedAt: string
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
  bins: string | null // JSON string
  sopReference: string | null
  masterInstrumentId: string | null // Assigned master instrument ID
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

// Transform API data to form data format
function transformApiToFormData(apiData: ApiCertificate): Partial<CertificateFormData> {
  const generateId = () => Math.random().toString(36).substring(2, 9)

  // Parse bins from JSON string
  const parseBins = (binsJson: string | null) => {
    if (!binsJson) return []
    try {
      return JSON.parse(binsJson)
    } catch {
      return []
    }
  }

  // Transform parameters
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

  // If no parameters, create a default one
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

  // Parse JSON fields
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

  // Transform master instruments (details are now stored directly, not nested)
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
    parameters,
    masterInstruments,
  }
}

// Format date for display
function formatDateDisplay(dateStr: string | null): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

// Helper to merge date adjustments with feedbacks
function mergeDateAdjustmentsWithFeedbacks(
  feedbacks: ApiFeedback[],
  events: ApiEvent[]
): ApiFeedback[] {
  if (!events || events.length === 0) return feedbacks

  // Create a map of event times to HoD edits
  const dateAdjustmentMap = new Map<number, { edits: HoDEdit[] }>()

  events.forEach((event) => {
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

      dateAdjustmentMap.set(eventTime, { edits })
    } catch (e) {
      console.error('Error parsing date event data:', e)
    }
  })

  // Match feedbacks with date adjustments by time proximity
  return feedbacks.map((feedback) => {
    const feedbackTime = new Date(feedback.createdAt).getTime()

    // Find a date adjustment within 10 seconds of this feedback
    let matchedAdjustment = null
    for (const [eventTime, adjustment] of dateAdjustmentMap.entries()) {
      if (Math.abs(feedbackTime - eventTime) < 10000) { // Within 10 seconds
        matchedAdjustment = adjustment
        dateAdjustmentMap.delete(eventTime)
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
      ...feedback,
      comment: cleanComment,
      hodEdits: matchedAdjustment?.edits || null,
    }
  })
}

export default function EditCertificatePage() {
  const params = useParams()
  const router = useRouter()
  const certificateId = params.id as string

  const { formData, isDirty, isSaving, saveDraft, loadForm, setCertificateId } = useCertificateStore()
  const [activeSection, setActiveSection] = useState('summary')
  const [isScrolled, setIsScrolled] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [loadError, setLoadError] = useState<string | null>(null)
  const [feedbacks, setFeedbacks] = useState<ApiFeedback[]>([])
  const [isTopFeedbackExpanded, setIsTopFeedbackExpanded] = useState(true)
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)
  const [currentRevision, setCurrentRevision] = useState(1)

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

        // Check if certificate can be edited
        if (data.status === 'APPROVED' || data.status === 'REJECTED') {
          setLoadError('This certificate cannot be edited')
          return
        }

        // Transform and load data into store
        const formData = transformApiToFormData(data)
        loadForm(formData)
        setCertificateId(certificateId)

        // Store feedbacks for display (merge with date adjustments)
        if (data.feedbacks) {
          const mergedFeedbacks = mergeDateAdjustmentsWithFeedbacks(
            data.feedbacks,
            data.events || []
          )
          setFeedbacks(mergedFeedbacks)
        }

        // Store current revision for header title
        setCurrentRevision(data.currentRevision ?? 1)
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
      console.error('Auto-save failed:', result.error)
    }
  }, [isDirty, saveDraft])

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      autoSave()
    }, 30000)

    return () => clearInterval(interval)
  }, [autoSave])

  // Track scroll position for sticky header and active section
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      setIsScrolled(scrollTop > 150)

      // Update active section based on scroll position
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

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll to section when nav link clicked
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Format last saved time
  const formatLastSaved = () => {
    if (!formData.lastSaved) return 'Not saved yet'
    const now = new Date()
    const diff = Math.floor((now.getTime() - formData.lastSaved.getTime()) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
    return formData.lastSaved.toLocaleTimeString()
  }

  // Get status badge config
  const statusConfig = STATUS_CONFIG[formData.status] || STATUS_CONFIG.DRAFT

  // Loading state
  if (isLoading) {
    return (
      <div className="min-h-screen bg-background">
        <Header title={currentRevision === 1 ? "Create New Certificate" : `Edit Certificate: ${formData.certificateNumber}`} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4">
            <Loader2 className="size-8 animate-spin text-primary" />
            <p className="text-slate-600">Loading certificate...</p>
          </div>
        </div>
      </div>
    )
  }

  // Error state
  if (loadError) {
    return (
      <div className="min-h-screen bg-background">
        <Header title={currentRevision === 1 ? "Create New Certificate" : `Edit Certificate: ${formData.certificateNumber}`} />
        <div className="flex items-center justify-center min-h-[60vh]">
          <div className="flex flex-col items-center gap-4 text-center">
            <div className="size-16 rounded-full bg-red-100 flex items-center justify-center">
              <span className="text-2xl">!</span>
            </div>
            <h2 className="text-xl font-semibold text-slate-900">{loadError}</h2>
            <Link
              href="/dashboard"
              className="text-primary hover:underline font-medium"
            >
              Return to Dashboard
            </Link>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className={cn('min-h-screen bg-background', isScrolled && 'scrolled')}>
      <Header title={currentRevision === 1 ? "Create New Certificate" : `Edit Certificate: ${formData.certificateNumber}`} />

      {/* Combined Sticky Header - Appears when scrolled */}
      <div
        className={cn(
          'fixed top-[75px] left-0 right-0 bg-white/95 backdrop-blur-md border-b border-slate-200 z-[55] shadow-sm transition-all duration-300',
          isScrolled ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
        )}
      >
        {/* Row 1: Customer Info + Action Buttons */}
        <div className="px-6 py-2 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Customer:</span>
              <span className="font-bold text-slate-900 truncate max-w-[300px]">
                {formData.customerName || 'Not specified'}
              </span>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <Badge
              variant="outline"
              className={cn(
                'px-2 py-0.5 text-[10px] font-bold uppercase tracking-wider',
                statusConfig.className
              )}
            >
              {statusConfig.label}
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={autoSave}
              disabled={isSaving || !isDirty}
              className="bg-slate-100 text-slate-700 text-xs font-bold px-4 py-1.5 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="size-3.5" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={() => scrollToSection('submit')}
              className="bg-primary text-white text-xs font-bold px-4 py-1.5 rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5"
            >
              <Send className="size-3.5" />
              Submit
            </button>
          </div>
        </div>
        {/* Row 2: Navigation Tabs */}
        <div className="px-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 py-1 min-w-max">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                className={cn(
                  'px-3 py-1.5 text-[13px] font-semibold text-slate-600 hover:text-primary hover:bg-slate-50 rounded-md transition-all border-b-2',
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

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="text-slate-500 hover:text-primary transition-colors flex items-center gap-1 text-sm font-semibold mb-4"
            >
              <ArrowLeft className="size-4" />
              Back to Dashboard
            </Link>
            <div className="flex items-baseline gap-4">
              
              <Badge
                variant="outline"
                className={cn(
                  'px-3 py-1 text-[11px] font-bold uppercase tracking-wider',
                  statusConfig.className
                )}
              >
                {statusConfig.label}
              </Badge>
            </div>
            <div className="flex gap-4 mt-2 text-sm text-slate-500">
              <p>Last saved: {formatLastSaved()}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={autoSave}
              disabled={isSaving || !isDirty}
              className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="size-4" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={() => scrollToSection('submit')}
              className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all flex items-center gap-2"
            >
              <Eye className="size-4" />
              Preview PDF
            </button>
            <button
              onClick={() => scrollToSection('submit')}
              className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all shadow-md flex items-center gap-2"
            >
              <Send className="size-4" />
              Submit for Review
            </button>
          </div>
        </div>

        {/* Quick Navigation - Normal position (sticky header takes over when scrolled) */}
        <nav className="bg-white border border-slate-200/60 rounded-2xl shadow-sm mb-8 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 p-2 min-w-max">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                className={cn(
                  'px-4 py-2 text-[13px] font-semibold text-slate-600 hover:text-primary hover:bg-slate-50 rounded-lg transition-all border-b-2',
                  activeSection === section.id
                    ? 'border-primary text-primary font-bold'
                    : 'border-transparent'
                )}
              >
                {section.label}
              </button>
            ))}
          </div>
        </nav>

        {/* HoD Feedback Banner - Shows when revision is required (Collapsible) */}
        {formData.status === 'REVISION_REQUIRED' && feedbacks.filter(f => f.feedbackType === 'REVISION_REQUEST').length > 0 && (
          <div className="mb-8 rounded-2xl border-2 border-orange-300 bg-orange-50 overflow-hidden">
            <button
              onClick={() => setIsTopFeedbackExpanded(!isTopFeedbackExpanded)}
              className="w-full bg-orange-100 px-6 py-4 flex items-center justify-between border-b border-orange-200 hover:bg-orange-150 transition-colors"
            >
              <div className="flex items-center gap-3">
                <div className="p-2 rounded-lg bg-orange-200">
                  <AlertTriangle className="size-5 text-orange-700" />
                </div>
                <div className="text-left">
                  <h3 className="font-bold text-orange-900 text-[14px]">Revision Required from HoD</h3>
                  <p className="text-[12px] text-orange-700">
                    {isTopFeedbackExpanded ? 'Click to hide feedback' : 'Click to view feedback details'}
                  </p>
                </div>
              </div>
              {isTopFeedbackExpanded ? (
                <ChevronUp className="size-5 text-orange-700" />
              ) : (
                <ChevronDown className="size-5 text-orange-700" />
              )}
            </button>
            {isTopFeedbackExpanded && (
              <div className="p-6 space-y-4">
                {feedbacks.filter(f => f.feedbackType === 'REVISION_REQUEST').slice(0, 1).map((feedback) => (
                  <div key={feedback.id} className="bg-white rounded-xl border border-orange-200 p-4">
                    <div className="flex items-start gap-3">
                      <div className="p-2 rounded-full bg-orange-100">
                        <User className="size-4 text-orange-600" />
                      </div>
                      <div className="flex-1">
                        <div className="flex items-center gap-2 mb-2">
                          <span className="font-semibold text-slate-900 text-[13px]">{feedback.user.name}</span>
                          <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                            {feedback.user.role === 'HOD' ? 'Head of Department' : feedback.user.role}
                          </span>
                          <span className="text-xs text-slate-400">
                            {new Date(feedback.createdAt).toLocaleDateString('en-GB', {
                              day: 'numeric',
                              month: 'short',
                              year: 'numeric',
                              hour: '2-digit',
                              minute: '2-digit'
                            })}
                          </span>
                        </div>
                        {feedback.comment && (
                          <div className="flex items-start gap-2">
                            <MessageSquare className="size-4 text-slate-400 mt-0.5 flex-shrink-0" />
                            <p className="text-slate-700 whitespace-pre-wrap text-[13px]">{feedback.comment}</p>
                          </div>
                        )}

                        {/* HoD Edits Applied */}
                        {feedback.hodEdits && feedback.hodEdits.length > 0 && (
                          <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-lg">
                            <div className="flex items-center gap-2 text-amber-700 font-semibold mb-3 text-[13px]">
                              <Calendar className="size-4" />
                              HoD Edits Applied
                            </div>
                            <div className="space-y-3">
                              {feedback.hodEdits.map((edit, idx) => (
                                <div
                                  key={edit.field}
                                  className={cn(
                                    idx > 0 && 'pt-3 border-t border-amber-200/60'
                                  )}
                                >
                                  <p className="font-semibold text-slate-700 text-[12px] mb-1">
                                    {edit.fieldLabel}
                                  </p>
                                  <div className="flex items-center gap-2 text-slate-600 text-[13px]">
                                    <span>{formatDateDisplay(edit.previousValue)}</span>
                                    <ArrowRight className="size-4 text-slate-400" />
                                    <span className={cn(
                                      'font-semibold',
                                      edit.autoCalculated ? 'text-blue-600' : 'text-amber-700'
                                    )}>
                                      {formatDateDisplay(edit.newValue)}
                                    </span>
                                  </div>
                                  <p className={cn(
                                    'text-[11px] mt-1 italic',
                                    edit.autoCalculated ? 'text-blue-500' : 'text-slate-500'
                                  )}>
                                    {edit.autoCalculated ? (
                                      <>⚡ {edit.reason}</>
                                    ) : (
                                      <>Reason: {edit.reason}</>
                                    )}
                                  </p>
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
        )}

        {/* Form Sections */}
        <div className="space-y-10 pb-20">
          <SummarySection isNewCertificate={currentRevision === 1} certificateId={certificateId} />
          <UUCSection />
          <MasterInstrumentSection />
          <EnvironmentalSection />
          <ResultsSection />
          <RemarksSection />
          <ConclusionSection />
          <FinalizeSection feedbacks={feedbacks} />
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-wrap items-center justify-center gap-8 text-slate-400 text-[10px] font-extrabold uppercase tracking-[0.2em]">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-green-500" />
            System Online
          </div>
          <div className="flex items-center gap-2">
            Secure Connection
          </div>
          <div className="flex items-center gap-2">
            Support Hub
          </div>
        </div>
      </footer>

      {/* Feedback History Sidebar */}
      {feedbacks.length > 0 && (
        <FeedbackSidebar
          feedbacks={feedbacks}
          isOpen={isSidebarOpen}
          onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
          currentRevision={1}
        />
      )}
    </div>
  )
}
