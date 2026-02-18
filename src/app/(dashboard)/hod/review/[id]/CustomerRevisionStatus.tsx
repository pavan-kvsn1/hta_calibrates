'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  MessageSquare,
  User,
  Send,
  AlertTriangle,
  ChevronDown,
  ChevronRight,
  Wrench,
  ArrowRight,
  Plus,
  Trash2,
  CheckCircle,
  Copy,
  Check,
} from 'lucide-react'
import { cn } from '@/lib/utils'

// Pending edit type
interface PendingEdit {
  field: 'dateOfCalibration' | 'calibrationDueDate'
  fieldLabel: string
  originalValue: string
  newValue: string
  reason: string
  autoCalculated?: boolean
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

// Raw feedback from ReviewFeedback table
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
}

// Customer event from CertificateEvent table
interface CustomerEvent {
  id: string
  eventType: string
  eventData: {
    notes?: string
    message?: string
    customerEmail?: string
    customerName?: string
    customerCompany?: string
    response?: string // HoD reply to customer
  }
  createdAt: string
  revision: number
  user?: {
    name: string
    role: string
  }
}

interface CustomerRevisionStatusProps {
  certificateId: string
  certificateNumber: string
  customerFeedback: {
    notes: string
    customerEmail?: string
    customerName?: string
    customerCompany?: string
    requestedAt?: string
  } | null
  statusNotes: string | null
  // Certificate data for editing
  dateOfCalibration: string | null
  calibrationDueDate: string | null
  calibrationTenure: number
  dueDateAdjustment: number
  // Callback to notify parent of pending edits
  onPendingEditsChange?: (edits: PendingEdit[]) => void
  // Raw data for building thread (no revision filtering)
  feedbacks?: Feedback[]
  customerEvents?: CustomerEvent[]
}

// Available fields for editing
const EDITABLE_FIELDS = [
  { value: 'dateOfCalibration', label: 'Date of Calibration' },
  { value: 'calibrationDueDate', label: 'Calibration Due Date' },
] as const

type EditableField = typeof EDITABLE_FIELDS[number]['value']

// Helper to calculate due date
function calculateDueDate(dateOfCalibration: string, tenure: number, adjustment: number): string {
  if (!dateOfCalibration) return ''
  const date = new Date(dateOfCalibration)
  date.setMonth(date.getMonth() + tenure)
  date.setDate(date.getDate() + adjustment)
  return date.toISOString().split('T')[0]
}

// Format date for display
function formatDateDisplay(dateStr: string | null): string {
  if (!dateStr) return '-'
  const date = new Date(dateStr)
  return date.toLocaleDateString('en-GB', { day: '2-digit', month: 'short', year: 'numeric' })
}

export function CustomerRevisionStatus({
  certificateId,
  certificateNumber,
  customerFeedback,
  statusNotes,
  dateOfCalibration,
  calibrationDueDate,
  calibrationTenure,
  dueDateAdjustment,
  onPendingEditsChange,
  feedbacks = [],
  customerEvents = [],
}: CustomerRevisionStatusProps) {
  const router = useRouter()
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [isReplying, setIsReplying] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [additionalNotes, setAdditionalNotes] = useState('')
  const [customerResponse, setCustomerResponse] = useState('')
  const [alsoResendCertificate, setAlsoResendCertificate] = useState(false)

  // Section expand/collapse state
  const [isEditActionsExpanded, setIsEditActionsExpanded] = useState(false)
  const [isReviewActionsExpanded, setIsReviewActionsExpanded] = useState(true)
  const [isFeedbackExpanded, setIsFeedbackExpanded] = useState(true)
  const [includeCustomerFeedback, setIncludeCustomerFeedback] = useState(true)
  const [copiedFeedback, setCopiedFeedback] = useState(false)
  const [activeReviewTab, setActiveReviewTab] = useState<'engineer' | 'customer'>('engineer')

  // Edit Actions state
  const [selectedField, setSelectedField] = useState<EditableField | ''>('')
  const [editValue, setEditValue] = useState('')
  const [editReason, setEditReason] = useState('')
  const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  // Get the customer feedback notes (from event data or statusNotes)
  const feedbackNotes = customerFeedback?.notes || statusNotes || 'No feedback provided'

  // Copy customer feedback to clipboard
  const handleCopyFeedback = async () => {
    try {
      await navigator.clipboard.writeText(feedbackNotes)
      setCopiedFeedback(true)
      setTimeout(() => setCopiedFeedback(false), 2000)
    } catch (err) {
      console.error('Failed to copy:', err)
    }
  }

  // Get current values for the selected field
  const getCurrentValue = (field: EditableField): string => {
    switch (field) {
      case 'dateOfCalibration':
        return dateOfCalibration ? dateOfCalibration.split('T')[0] : ''
      case 'calibrationDueDate':
        return calibrationDueDate ? calibrationDueDate.split('T')[0] : ''
      default:
        return ''
    }
  }

  // Calculate auto-adjusted due date when date of calibration changes
  const calculateAutoAdjustedDueDate = (newCalibrationDate: string): string => {
    return calculateDueDate(newCalibrationDate, calibrationTenure, dueDateAdjustment)
  }

  // Notify parent of pending edits changes
  useEffect(() => {
    onPendingEditsChange?.(pendingEdits)
  }, [pendingEdits, onPendingEditsChange])

  // Reset edit form when field changes
  useEffect(() => {
    if (selectedField) {
      const existingEdit = pendingEdits.find(e => e.field === selectedField)
      if (existingEdit) {
        setEditValue(existingEdit.newValue)
        setEditReason(existingEdit.reason)
      } else {
        setEditValue(getCurrentValue(selectedField))
        setEditReason('')
      }
    } else {
      setEditValue('')
      setEditReason('')
    }
  }, [selectedField])

  // Get field label
  const getFieldLabel = (field: EditableField): string => {
    return EDITABLE_FIELDS.find(f => f.value === field)?.label || field
  }

  // Check if field already has a pending edit
  const hasPendingEdit = (field: EditableField): boolean => {
    return pendingEdits.some(e => e.field === field)
  }

  // Apply a change to pending edits
  const handleApplyChange = () => {
    if (!selectedField || !editValue || !editReason.trim()) {
      setError('Please fill in all fields including the reason')
      return
    }

    const originalValue = getCurrentValue(selectedField)
    if (editValue === originalValue) {
      setError('New value must be different from the current value')
      return
    }

    setError(null)

    const filteredEdits = pendingEdits.filter(e => e.field !== selectedField)

    const newEdit: PendingEdit = {
      field: selectedField,
      fieldLabel: getFieldLabel(selectedField),
      originalValue,
      newValue: editValue,
      reason: editReason.trim(),
    }

    let newEdits = [...filteredEdits, newEdit]

    // If changing date of calibration, auto-add due date adjustment
    if (selectedField === 'dateOfCalibration') {
      newEdits = newEdits.filter(e => e.field !== 'calibrationDueDate')
      const originalDueDate = calibrationDueDate ? calibrationDueDate.split('T')[0] : ''
      const newDueDate = calculateAutoAdjustedDueDate(editValue)

      if (newDueDate !== originalDueDate) {
        newEdits.push({
          field: 'calibrationDueDate',
          fieldLabel: 'Calibration Due Date',
          originalValue: originalDueDate,
          newValue: newDueDate,
          reason: 'Auto-adjusted based on Date of Calibration change',
          autoCalculated: true,
        })
      }
    }

    setPendingEdits(newEdits)
    setSelectedField('')
    setEditValue('')
    setEditReason('')
    setIsDropdownOpen(false)
  }

  // Remove a pending edit
  const handleRemoveEdit = (field: EditableField) => {
    let newEdits = pendingEdits.filter(e => e.field !== field)
    if (field === 'dateOfCalibration') {
      newEdits = newEdits.filter(e => !e.autoCalculated)
    }
    setPendingEdits(newEdits)
  }

  const handleAssignToEngineer = async () => {
    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/certificates/${certificateId}/assign-revision`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerFeedback: includeCustomerFeedback ? feedbackNotes : undefined,
          additionalNotes: additionalNotes.trim() || undefined,
          edits: pendingEdits.length > 0 ? pendingEdits : undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to assign certificate for revision')
      }

      router.push('/hod/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleReplyToCustomer = async () => {
    if (!customerResponse.trim()) {
      setError('Please enter a response message')
      return
    }

    setIsReplying(true)
    setError(null)

    try {
      const response = await fetch(`/api/certificates/${certificateId}/reply-to-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          response: customerResponse.trim(),
          resendCertificate: alsoResendCertificate,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to reply to customer')
      }

      router.push('/hod/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsReplying(false)
    }
  }

  // Get feedback style based on type
  const getFeedbackStyle = (type: 'hod' | 'customer' | 'engineer') => {
    switch (type) {
      case 'hod':
        return {
          bgColor: 'bg-amber-50',
          borderColor: 'border-amber-200',
          textColor: 'text-amber-700',
          badgeBg: 'bg-amber-100',
          badgeText: 'text-amber-700',
          label: 'HoD',
        }
      case 'customer':
        return {
          bgColor: 'bg-purple-50',
          borderColor: 'border-purple-200',
          textColor: 'text-purple-700',
          badgeBg: 'bg-purple-100',
          badgeText: 'text-purple-700',
          label: 'Customer',
        }
      case 'engineer':
        return {
          bgColor: 'bg-blue-50',
          borderColor: 'border-blue-200',
          textColor: 'text-blue-700',
          badgeBg: 'bg-blue-100',
          badgeText: 'text-blue-700',
          label: 'Engineer',
        }
    }
  }

  // Build all feedback items from raw data (no revision filtering)
  const buildAllFeedbackItems = (): FeedbackItem[] => {
    const items: FeedbackItem[] = []

    // Add feedbacks (HoD requests, engineer responses)
    feedbacks.forEach((feedback) => {
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
    })

    // Add customer events
    customerEvents.forEach((event) => {
      if (event.eventType === 'CUSTOMER_REVISION_REQUESTED') {
        items.push({
          id: event.id,
          type: 'customer',
          name: event.eventData.customerName || 'Customer',
          company: event.eventData.customerCompany,
          message: event.eventData.notes || '',
          createdAt: event.createdAt,
        })
      } else if (event.eventType === 'HOD_REPLIED_TO_CUSTOMER') {
        items.push({
          id: event.id,
          type: 'hod',
          name: event.user?.name || 'HoD',
          message: event.eventData.response || '',
          createdAt: event.createdAt,
        })
      }
    })

    return items
  }

  // Build the latest feedback thread for CUSTOMER_REVISION_REQUIRED status:
  // For this status, the customer feedback is what triggered it, so prioritize showing:
  // Customer feedback → HoD response (if any)
  const buildLatestThread = (): FeedbackItem[] => {
    const allItems = buildAllFeedbackItems()

    // Sort by date (oldest first)
    const sorted = allItems.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    // Find the last customer feedback (this is what triggered CUSTOMER_REVISION_REQUIRED)
    const lastCustomerIdx = sorted.findLastIndex(f => f.type === 'customer')
    if (lastCustomerIdx === -1) {
      // No customer feedback - fall back to showing last HoD message if any
      const lastHodIdx = sorted.findLastIndex(f => f.type === 'hod')
      if (lastHodIdx !== -1) {
        return [sorted[lastHodIdx]]
      }
      return []
    }

    // Start thread with customer feedback
    const thread: FeedbackItem[] = [sorted[lastCustomerIdx]]

    // Look for any HoD response AFTER the customer feedback
    for (let i = lastCustomerIdx + 1; i < sorted.length; i++) {
      if (sorted[i].type === 'hod') {
        thread.push(sorted[i])
        break
      }
    }

    return thread
  }

  const latestThread = buildLatestThread()

  return (
    <div className="space-y-4">
      {/* Edit Actions Section */}
      <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setIsEditActionsExpanded(!isEditActionsExpanded)}
          className="w-full px-5 py-4 flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-150 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
              <Wrench className="h-5 w-5 text-slate-600" />
            </div>
            <div className="text-left">
              <span className="text-[14px] font-semibold text-slate-800 block">Edit Actions</span>
              <span className="text-xs text-slate-500">Modify certificate fields before forwarding</span>
            </div>
            {pendingEdits.length > 0 && (
              <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold">
                {pendingEdits.length} pending
              </span>
            )}
          </div>
          {isEditActionsExpanded ? (
            <ChevronDown className="h-5 w-5 text-slate-500" />
          ) : (
            <ChevronRight className="h-5 w-5 text-slate-500" />
          )}
        </button>

        {isEditActionsExpanded && (
          <div className="p-6 space-y-6 border-t-2 border-slate-100 bg-slate-50/50">
            {/* Field Selector Dropdown */}
            <div>
              <Label className="text-[14px] font-medium text-slate-700 mb-3 block">
                Select field to edit:
              </Label>
              <div className="relative">
                <button
                  type="button"
                  onClick={() => setIsDropdownOpen(!isDropdownOpen)}
                  className="w-full px-5 py-2 bg-white border-2 border-slate-200 rounded-lg text-[13px] text-left flex items-center justify-between hover:border-slate-300 hover:bg-slate-50 transition-colors"
                >
                  <span className={selectedField ? 'text-slate-900 font-medium' : 'text-slate-400'}>
                    {selectedField ? getFieldLabel(selectedField) : 'Choose a field...'}
                  </span>
                  <ChevronDown className={cn(
                    "h-6 w-6 text-slate-400 transition-transform",
                    isDropdownOpen && "rotate-180"
                  )} />
                </button>

                {isDropdownOpen && (
                  <div className="absolute z-10 w-full mt-2 bg-white border-2 border-slate-200 rounded-lg shadow-lg overflow-hidden">
                    {EDITABLE_FIELDS.map((field) => (
                      <button
                        key={field.value}
                        type="button"
                        onClick={() => {
                          setSelectedField(field.value)
                          setIsDropdownOpen(false)
                        }}
                        className={cn(
                          "w-full px-5 py-2 text-[13px] text-left hover:bg-slate-50 flex items-center justify-between transition-colors",
                          selectedField === field.value && "bg-primary/5 text-primary"
                        )}
                      >
                        <span className="font-medium">{field.label}</span>
                        {hasPendingEdit(field.value) && (
                          <span className="text-xs px-2 py-1 rounded-full bg-amber-100 text-amber-700 font-semibold">
                            Edited
                          </span>
                        )}
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>

            {/* Edit Form */}
            {selectedField && (
              <div className="p-5 bg-white rounded-xl border-2 border-slate-200 space-y-5">
                <h4 className="text-base font-semibold text-slate-800 text-[14px]">
                  Editing: {getFieldLabel(selectedField)}
                </h4>

                <div className="flex items-center gap-4">
                  <div className="flex-1 p-2 bg-slate-50 rounded-lg border border-slate-200">
                    <p className="text-[12px] uppercase text-slate-400 font-semibold mb-2">Current Value</p>
                    <p className="font-semibold text-slate-800 text-[13px]">
                      {formatDateDisplay(getCurrentValue(selectedField))}
                    </p>
                  </div>
                  <ArrowRight className="h-6 w-6 text-slate-400 flex-shrink-0" />
                  <div className="flex-1 p-2 bg-amber-50 rounded-lg border-2 border-amber-200">
                    <p className="text-[13px] uppercase text-amber-600 font-semibold mb-2">New Value</p>
                    <p className="font-semibold text-amber-700 text-[13px]">
                      {editValue ? formatDateDisplay(editValue) : '-'}
                    </p>
                  </div>
                </div>

                <div>
                  <Label className="text-[13px] font-medium text-slate-700 mb-2 block">
                    New {getFieldLabel(selectedField)}
                  </Label>
                  <Input
                    type="date"
                    value={editValue}
                    onChange={(e) => setEditValue(e.target.value)}
                    className="text-xs h-10"
                  />
                </div>

                {selectedField === 'dateOfCalibration' && editValue && editValue !== getCurrentValue('dateOfCalibration') && (
                  <div className="p-4 bg-blue-50 border-2 border-blue-200 rounded-lg">
                    <p className="text-[13px] text-blue-700">
                      <span className="font-semibold">Due Date will auto-adjust:</span>
                      <br />
                      <span className="text-[13px] font-medium">
                        {formatDateDisplay(calibrationDueDate)} → {formatDateDisplay(calculateAutoAdjustedDueDate(editValue))}
                      </span>
                    </p>
                  </div>
                )}

                <div className="flex-1">
                  <Label className="text-[13px] font-medium text-slate-700 mb-2 block">
                    Reason for Change <span className="text-red-500">*</span>
                  </Label>
                  <textarea
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="Explain why this change is needed..."
                    className="w-full h-20 px-4 py-2 border-2 border-slate-200 rounded-lg text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>

                <Button
                  type="button"
                  onClick={handleApplyChange}
                  className="w-full h-10 text-[12px]"
                >
                  <Plus className="h-5 w-5 mr-2" />
                  Apply Change
                </Button>
              </div>
            )}

            {/* Pending Changes List */}
            {pendingEdits.length > 0 && (
              <div className="space-y-4">
                <p className="text-[13px] font-semibold text-slate-700 flex items-center gap-2">
                  <CheckCircle className="h-5 w-4 text-green-500" />
                  Pending Changes ({pendingEdits.length})
                </p>
                <div className="space-y-3">
                  {pendingEdits.map((edit) => (
                    <div
                      key={edit.field}
                      className={cn(
                        "p-4 rounded-lg border-2 text-[14px]",
                        edit.autoCalculated
                          ? "bg-blue-50 border-blue-200"
                          : "bg-amber-50 border-amber-200"
                      )}
                    >
                      <div className="flex items-start justify-between gap-4">
                        <div className="flex-1 min-w-0">
                          <p className="font-semibold text-slate-800 text-[13px]">{edit.fieldLabel}</p>
                          <p className="text-slate-600 text-base mt-2 text-[13px]">
                            {formatDateDisplay(edit.originalValue)} → <span className="font-semibold">{formatDateDisplay(edit.newValue)}</span>
                          </p>
                          {edit.autoCalculated && (
                            <p className="text-blue-600 text-sm mt-2 font-medium">(Auto-calculated)</p>
                          )}
                          {!edit.autoCalculated && edit.reason && (
                            <p className="text-slate-500 text-sm mt-2 italic text-[13px]">"{edit.reason}"</p>
                          )}
                        </div>
                        {!edit.autoCalculated && (
                          <button
                            type="button"
                            onClick={() => handleRemoveEdit(edit.field)}
                            className="p-2 hover:bg-red-100 rounded-lg text-red-500 transition-colors"
                          >
                            <Trash2 className="h-5 w-5" />
                          </button>
                        )}
                      </div>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Review Actions Section */}
      <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden shadow-sm">
        <button
          type="button"
          onClick={() => setIsReviewActionsExpanded(!isReviewActionsExpanded)}
          className="w-full px-5 py-4 flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-150 transition-colors"
        >
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
              <Send className="h-5 w-5 text-slate-600" />
            </div>
            <div className="text-left">
              <span className="text-[14px] font-semibold text-slate-800 block">Review Actions</span>
              <span className="text-xs text-slate-500">Assign to engineer for revision</span>
            </div>
          </div>
          {isReviewActionsExpanded ? (
            <ChevronDown className="h-5 w-5 text-slate-500" />
          ) : (
            <ChevronRight className="h-5 w-5 text-slate-500" />
          )}
        </button>

        {isReviewActionsExpanded && (
          <div className="p-5 space-y-4 border-t-2 border-slate-100">
            {error && (
              <div className="p-3 bg-red-50 border-2 border-red-200 rounded-lg flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-red-500" />
                <p className="text-sm text-red-600">{error}</p>
              </div>
            )}

            {/* Customer Feedback Preview - Shared across both tabs */}
            <div className="p-4 bg-purple-50 border-2 border-purple-200 rounded-lg">
              <div className="flex items-center justify-between mb-3">
                <span className="text-[13px] font-semibold text-purple-700">Customer Feedback</span>
                <button
                  type="button"
                  onClick={handleCopyFeedback}
                  className={cn(
                    "flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg text-[12px] font-medium transition-colors",
                    copiedFeedback
                      ? "bg-green-100 text-green-700"
                      : "bg-white text-purple-600 hover:bg-purple-100 border border-purple-200"
                  )}
                >
                  {copiedFeedback ? (
                    <>
                      <Check className="h-3.5 w-3.5" />
                      Copied!
                    </>
                  ) : (
                    <>
                      <Copy className="h-3.5 w-3.5" />
                      Copy
                    </>
                  )}
                </button>
              </div>
              <p className="text-[13px] text-slate-700 bg-white p-3 rounded-lg border border-purple-100 whitespace-pre-wrap max-h-24 overflow-y-auto">
                {feedbackNotes}
              </p>
            </div>

            {/* Tab Selector */}
            <div>
              <p className="text-[13px] font-medium text-slate-700 mb-3">How would you like to respond?</p>
              <div className="grid grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setActiveReviewTab('engineer')}
                  className={cn(
                    "flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 text-[13px] font-medium transition-all",
                    activeReviewTab === 'engineer'
                      ? "bg-orange-50 border-orange-400 text-orange-700 shadow-sm"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <Send className="h-4 w-4" />
                  Assign to Engineer
                </button>
                <button
                  type="button"
                  onClick={() => setActiveReviewTab('customer')}
                  className={cn(
                    "flex items-center justify-center gap-2 px-4 py-3 rounded-lg border-2 text-[13px] font-medium transition-all",
                    activeReviewTab === 'customer'
                      ? "bg-green-50 border-green-400 text-green-700 shadow-sm"
                      : "bg-white border-slate-200 text-slate-600 hover:border-slate-300 hover:bg-slate-50"
                  )}
                >
                  <MessageSquare className="h-4 w-4" />
                  Reply to Customer
                </button>
              </div>
            </div>

            {/* Tab Content */}
            {activeReviewTab === 'engineer' ? (
              /* Assign to Engineer Tab */
              <div className="p-4 bg-orange-50/50 border-2 border-orange-200 rounded-lg space-y-4">
                {/* Toggle to include/exclude customer feedback */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={includeCustomerFeedback}
                      onChange={(e) => setIncludeCustomerFeedback(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:bg-orange-500 transition-colors"></div>
                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4"></div>
                  </div>
                  <span className="text-[12px] text-slate-600">
                    {includeCustomerFeedback ? 'Include customer feedback with assignment' : 'Do not include customer feedback'}
                  </span>
                </label>

                <div>
                  <label className="text-[13px] font-medium text-slate-700 mb-2 block">
                    Notes for Engineer (Optional)
                  </label>
                  <textarea
                    value={additionalNotes}
                    onChange={(e) => setAdditionalNotes(e.target.value)}
                    placeholder="Please verify the calibration date against the lab logbook..."
                    className="w-full h-20 px-4 py-3 border-2 border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-orange-500 focus:border-orange-500 bg-white"
                    disabled={isSubmitting}
                  />
                </div>

                {pendingEdits.length > 0 && (
                  <div className="p-3 bg-amber-100 border-2 border-amber-300 rounded-lg">
                    <div className="flex items-center gap-2">
                      <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                      <p className="text-[12px] text-amber-700 font-medium">
                        {pendingEdits.length} pending edit{pendingEdits.length > 1 ? 's' : ''} will be applied.
                      </p>
                    </div>
                  </div>
                )}

                <Button
                  onClick={handleAssignToEngineer}
                  disabled={isSubmitting || isReplying}
                  className="w-full h-10 bg-orange-600 hover:bg-orange-700"
                >
                  <Send className="h-4 w-4 mr-2" />
                  {isSubmitting ? 'Assigning...' : 'Assign to Engineer for Revision'}
                </Button>

                <p className="text-xs text-orange-600/70 text-center">
                  Engineer will be notified • Status → REVISION_REQUIRED
                </p>
              </div>
            ) : (
              /* Reply to Customer Tab */
              <div className="p-4 bg-green-50/50 border-2 border-green-200 rounded-lg space-y-4">
                <p className="text-[12px] text-green-700 bg-green-100/50 p-2 rounded-lg">
                  Use when: clarification needed, certificate is correct, or minor issue you can address directly.
                </p>

                <div>
                  <label className="text-[13px] font-medium text-slate-700 mb-2 block">
                    Your Response <span className="text-red-500">*</span>
                  </label>
                  <textarea
                    value={customerResponse}
                    onChange={(e) => setCustomerResponse(e.target.value)}
                    placeholder="Thank you for bringing this to our attention. We've verified..."
                    className="w-full h-20 px-4 py-3 border-2 border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-green-500 focus:border-green-500 bg-white"
                    disabled={isReplying || isSubmitting}
                  />
                </div>

                {/* Checkbox for also resending certificate */}
                <label className="flex items-center gap-3 cursor-pointer">
                  <div className="relative">
                    <input
                      type="checkbox"
                      checked={alsoResendCertificate}
                      onChange={(e) => setAlsoResendCertificate(e.target.checked)}
                      className="sr-only peer"
                    />
                    <div className="w-9 h-5 bg-slate-300 rounded-full peer peer-checked:bg-green-600 transition-colors"></div>
                    <div className="absolute left-0.5 top-0.5 w-4 h-4 bg-white rounded-full shadow-sm transition-transform peer-checked:translate-x-4"></div>
                  </div>
                  <span className="text-[12px] text-slate-600">
                    {alsoResendCertificate ? 'Also resend certificate for review' : 'Only send response (no certificate resend)'}
                  </span>
                </label>

                <Button
                  onClick={handleReplyToCustomer}
                  disabled={isReplying || isSubmitting || !customerResponse.trim()}
                  className="w-full h-10 bg-green-600 hover:bg-green-700"
                >
                  <MessageSquare className="h-4 w-4 mr-2" />
                  {isReplying ? 'Sending...' : alsoResendCertificate ? 'Reply & Resend Certificate' : 'Send Response'}
                </Button>

                <p className="text-xs text-green-600/70 text-center">
                  {alsoResendCertificate
                    ? 'Customer will receive your response and a new review link'
                    : 'Customer will see your response in their revision history'}
                </p>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Latest Feedback Thread */}
      {latestThread.length > 0 && (
        <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden shadow-sm">
          <button
            type="button"
            onClick={() => setIsFeedbackExpanded(!isFeedbackExpanded)}
            className="w-full px-5 py-4 flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-150 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
                <MessageSquare className="h-5 w-5 text-slate-600" />
              </div>
              <div className="text-left">
                <span className="text-[14px] font-semibold text-slate-800 block">Latest Feedback Thread</span>
                <span className="text-xs text-slate-500">Recent conversation</span>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-slate-200 text-slate-700 font-semibold">
                {latestThread.length}
              </span>
            </div>
            {isFeedbackExpanded ? (
              <ChevronDown className="h-5 w-5 text-slate-500" />
            ) : (
              <ChevronRight className="h-5 w-5 text-slate-500" />
            )}
          </button>

          {isFeedbackExpanded && (
            <div className="border-t-2 border-slate-100">
              {/* Chat-style messages */}
              <div className="p-4 bg-gray-50 flex flex-col gap-2 max-h-64 overflow-y-auto">
                {latestThread.map((item) => {
                  const isOwnMessage = item.type === 'hod'
                  const isCustomer = item.type === 'customer'

                  return (
                    <div
                      key={item.id}
                      className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                    >
                      <div
                        className={`relative max-w-[85%] px-3 py-2 rounded-lg text-[12px] border ${
                          isOwnMessage
                            ? 'bg-amber-50 border-amber-200 rounded-br-none'
                            : isCustomer
                            ? 'bg-purple-50 border-purple-200 rounded-bl-none'
                            : 'bg-blue-50 border-blue-200 rounded-bl-none'
                        }`}
                      >
                        <p className={`text-[10px] font-semibold mb-0.5 ${
                          isOwnMessage
                            ? 'text-amber-600 text-right'
                            : isCustomer
                            ? 'text-purple-600'
                            : 'text-blue-600'
                        }`}>
                          {isOwnMessage
                            ? 'You'
                            : isCustomer
                            ? `Customer • ${item.name}${item.company ? ` (${item.company})` : ''}`
                            : `Engineer • ${item.name}`}
                        </p>
                        <p className="text-slate-700 whitespace-pre-wrap">{item.message}</p>
                        <p className={`text-[9px] mt-1 ${isOwnMessage ? 'text-amber-400 text-right' : 'text-gray-400'}`}>
                          {new Date(item.createdAt).toLocaleString('en-IN', {
                            day: 'numeric',
                            month: 'short',
                            hour: '2-digit',
                            minute: '2-digit',
                          })}
                        </p>
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
