'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { Input } from '@/components/ui/input'
import {
  CheckCircle,
  XCircle,
  MessageSquare,
  ChevronDown,
  ChevronRight,
  AlertTriangle,
  User,
  Wrench,
  Trash2,
  ArrowRight,
  Plus
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { ApproveModal } from './ApproveModal'
import type { ClientEvidence } from '@/types/signatures'

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
  hodEdits?: Array<{
    field: string
    fieldLabel: string
    previousValue: string | null
    newValue: string
    reason: string
    autoCalculated: boolean
  }> | null
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
  }
  createdAt: string
  revision: number
  user?: {
    name: string
    role: string
  }
}

// Pending edit type
export interface PendingEdit {
  field: 'dateOfCalibration' | 'calibrationDueDate'
  fieldLabel: string
  originalValue: string
  newValue: string
  reason: string
  autoCalculated?: boolean // For due date that auto-calculates
}

interface ReviewActionsProps {
  certificateId: string
  certificateNumber: string
  currentStatus: string
  feedbacks?: Feedback[]
  customerEvents?: CustomerEvent[]
  // Certificate data for editing
  dateOfCalibration: string | null
  calibrationDueDate: string | null
  calibrationTenure: number
  dueDateAdjustment: number
  // Certificate info for approval modal
  uucDescription: string | null
  customerName: string | null
  customerEmail: string | null
  // Callback to notify parent of pending edits
  onPendingEditsChange?: (edits: PendingEdit[]) => void
}

// Available fields for editing
const EDITABLE_FIELDS = [
  { value: 'dateOfCalibration', label: 'Date of Calibration' },
  { value: 'calibrationDueDate', label: 'Calibration Due Date' },
] as const

type EditableField = typeof EDITABLE_FIELDS[number]['value']

// Section options for targeted feedback
const SECTION_OPTIONS = [
  { value: '', label: 'General (All Sections)' },
  { value: 'summary', label: 'Summary' },
  { value: 'uuc-details', label: 'UUC Details' },
  { value: 'master-inst', label: 'Master Instruments' },
  { value: 'environment', label: 'Environmental' },
  { value: 'results', label: 'Results' },
  { value: 'remarks', label: 'Remarks' },
  { value: 'conclusion', label: 'Conclusion' },
] as const

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

export function ReviewActions({
  certificateId,
  certificateNumber,
  currentStatus,
  feedbacks = [],
  customerEvents = [],
  dateOfCalibration,
  calibrationDueDate,
  calibrationTenure,
  dueDateAdjustment,
  uucDescription,
  customerName,
  customerEmail,
  onPendingEditsChange,
}: ReviewActionsProps) {
  const router = useRouter()
  const [comment, setComment] = useState('')
  const [targetSection, setTargetSection] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Approve Modal state
  const [showApproveModal, setShowApproveModal] = useState(false)

  // Section expand/collapse state
  const [isEditActionsExpanded, setIsEditActionsExpanded] = useState(false)
  const [isReviewActionsExpanded, setIsReviewActionsExpanded] = useState(true)
  const [isPreviousFeedbackExpanded, setIsPreviousFeedbackExpanded] = useState(false)

  // Edit Actions state
  const [selectedField, setSelectedField] = useState<EditableField | ''>('')
  const [editValue, setEditValue] = useState('')
  const [editReason, setEditReason] = useState('')
  const [pendingEdits, setPendingEdits] = useState<PendingEdit[]>([])
  const [isDropdownOpen, setIsDropdownOpen] = useState(false)

  const canReview = currentStatus === 'PENDING_HOD_REVIEW'

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

  // Get effective value (pending edit or original)
  const getEffectiveValue = (field: EditableField): string => {
    const pendingEdit = pendingEdits.find(e => e.field === field)
    if (pendingEdit) return pendingEdit.newValue
    return getCurrentValue(field)
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
      // Check if there's already a pending edit for this field
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

    // Remove existing edit for this field if any
    const filteredEdits = pendingEdits.filter(e => e.field !== selectedField)

    // Create new edit
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
      // Remove any existing due date edit and add auto-calculated one
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

    // If removing date of calibration, also remove auto-calculated due date
    if (field === 'dateOfCalibration') {
      newEdits = newEdits.filter(e => !e.autoCalculated)
    }

    setPendingEdits(newEdits)
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
      }
    })

    return items
  }

  // Build the latest feedback thread (last cycle only):
  // Customer feedback (optional) → HoD feedback → Engineer response
  const buildLatestThread = (): FeedbackItem[] => {
    const allItems = buildAllFeedbackItems()

    // Sort by date (oldest first)
    const sorted = allItems.sort(
      (a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime()
    )

    // Find the last engineer response
    const lastEngineerIdx = sorted.findLastIndex(f => f.type === 'engineer')
    if (lastEngineerIdx === -1) {
      // No engineer response - find last HoD message
      const lastHodIdx = sorted.findLastIndex(f => f.type === 'hod')
      if (lastHodIdx === -1) {
        // Check for customer feedback only
        const lastCustomerIdx = sorted.findLastIndex(f => f.type === 'customer')
        if (lastCustomerIdx !== -1) {
          return [sorted[lastCustomerIdx]]
        }
        return []
      }
      // Find customer feedback before this HoD message
      const thread: FeedbackItem[] = []
      for (let i = lastHodIdx - 1; i >= 0; i--) {
        if (sorted[i].type === 'customer') {
          thread.unshift(sorted[i])
          break
        }
      }
      thread.push(sorted[lastHodIdx])
      return thread
    }

    // Found engineer response - build thread backwards
    const thread: FeedbackItem[] = [sorted[lastEngineerIdx]]

    // Find HoD message before engineer response
    for (let i = lastEngineerIdx - 1; i >= 0; i--) {
      if (sorted[i].type === 'hod') {
        thread.unshift(sorted[i])
        // Find customer feedback before HoD message
        for (let j = i - 1; j >= 0; j--) {
          if (sorted[j].type === 'customer') {
            thread.unshift(sorted[j])
            break
          }
        }
        break
      }
    }

    return thread
  }

  const latestThread = buildLatestThread()
  const hasPreviousFeedback = latestThread.length > 0

  // Handle approval through the modal
  const handleApprove = async (sendEmail: boolean, customerData?: { email: string; name: string; message?: string }, signatureInfo?: { signatureImage: string; signerName: string; clientEvidence: ClientEvidence }) => {
    setIsSubmitting(true)
    setError(null)

    // Build request body
    const requestBody: {
      action: string
      comment?: string
      edits?: PendingEdit[]
      sendToCustomer?: { email: string; name: string; message?: string }
      signatureData?: string
      signerName?: string
      clientEvidence?: ClientEvidence
    } = {
      action: 'approve',
      comment: comment.trim() || undefined,
    }

    // Include pending edits if any
    if (pendingEdits.length > 0) {
      requestBody.edits = pendingEdits
    }

    // Include customer data if sending email
    if (sendEmail && customerData) {
      requestBody.sendToCustomer = customerData
    }

    // Include signature data and client evidence
    if (signatureInfo) {
      requestBody.signatureData = signatureInfo.signatureImage
      requestBody.signerName = signatureInfo.signerName
      requestBody.clientEvidence = signatureInfo.clientEvidence
    }

    try {
      const response = await fetch(`/api/certificates/${certificateId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to approve certificate')
      }

      router.push('/hod/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      throw err // Re-throw to let modal handle error display
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleAction = async (action: 'reject' | 'revision') => {
    if (!comment.trim()) {
      setError('Please provide a comment for rejection or revision request')
      return
    }

    setIsSubmitting(true)
    setError(null)

    // Build request body
    const requestBody: {
      action: string
      comment?: string
      targetSection?: string
      edits?: PendingEdit[]
    } = {
      action,
      comment: comment.trim() || undefined,
      targetSection: targetSection || undefined,
    }

    // Include pending edits if any
    if (pendingEdits.length > 0) {
      requestBody.edits = pendingEdits
    }

    try {
      const response = await fetch(`/api/certificates/${certificateId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to submit review')
      }

      router.push('/hod/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!canReview) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <p className="text-gray-500 text-center">
          This certificate is not pending review.
        </p>
      </div>
    )
  }

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
              <span className="text-xs text-slate-500">Modify certificate fields before review</span>
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
          <div className="p-6 space-y-6 border-t-2 border-slate-100 bg-slate-50/50 min-h-[400px]">
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

            {/* Edit Form - Shows when field is selected */}
            {selectedField && (
              <div className="p-5 bg-white rounded-xl border-2 border-slate-200 space-y-5 flex-1">
                <h4 className="text-base font-semibold text-slate-800 text-[14px]">
                  Editing: {getFieldLabel(selectedField)}
                </h4>

                {/* Current vs New Value Display */}
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

                {/* New Value Input */}
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

                {/* Auto-calculated Due Date Notice */}
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

                {/* Reason */}
                <div className="flex-1">
                  <Label className="text-[13px] font-medium text-slate-700 mb-2 block">
                    Reason for Change <span className="text-red-500">*</span>
                  </Label>
                  <textarea
                    value={editReason}
                    onChange={(e) => setEditReason(e.target.value)}
                    placeholder="Explain why this change is needed. Provide detailed justification for the edit..."
                    className="w-full h-25 px-4 py-2 border-2 border-slate-200 rounded-lg text-[13px] resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
                  />
                </div>

                {/* Apply Button */}
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
              <div className="space-y-4 mt-auto">
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
              <MessageSquare className="h-5 w-5 text-slate-600" />
            </div>
            <div className="text-left">
              <span className="text-base font-semibold text-slate-800 block">Review Actions</span>
              <span className="text-xs text-slate-500">Submit your review decision</span>
            </div>
          </div>
          {isReviewActionsExpanded ? (
            <ChevronDown className="h-5 w-5 text-slate-500" />
          ) : (
            <ChevronRight className="h-5 w-5 text-slate-500" />
          )}
        </button>

        {isReviewActionsExpanded && (
        <div className="p-5 space-y-5 border-t-2 border-slate-100">
          {error && (
            <div className="p-3 bg-red-50 border-2 border-red-200 rounded-lg">
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Target Section Selector */}
          <div>
            <Label htmlFor="targetSection" className="text-sm font-medium text-slate-700 mb-2 block">
              Target Section <span className="text-slate-400 font-normal">(optional)</span>
            </Label>
            <select
              id="targetSection"
              value={targetSection}
              onChange={(e) => setTargetSection(e.target.value)}
              className="w-full h-10 px-4 border-2 border-slate-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary bg-white"
              disabled={isSubmitting}
            >
              {SECTION_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </select>
            <p className="text-[11px] text-slate-400 mt-1">
              Select a specific section to highlight your feedback for the engineer
            </p>
          </div>

          {/* Comment Field */}
          <div>
            <Label htmlFor="comment" className="text-sm font-medium text-slate-700 mb-2 block">
              Review Comment
            </Label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder={targetSection ? `Add feedback for ${SECTION_OPTIONS.find(s => s.value === targetSection)?.label}...` : "Add comments (required for rejection/revision)..."}
              className="w-full h-28 px-4 py-3 border-2 border-slate-200 rounded-lg text-sm resize-none focus:outline-none focus:ring-2 focus:ring-primary focus:border-primary"
              disabled={isSubmitting}
            />
          </div>

          {/* Pending Edits Warning */}
          {pendingEdits.length > 0 && (
            <div className="p-3 bg-amber-50 border-2 border-amber-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
                <p className="text-[12px] text-amber-700 font-medium">
                  {pendingEdits.length} pending edit{pendingEdits.length > 1 ? 's' : ''} will be applied with your review action.
                </p>
              </div>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-3">
            <Button
              onClick={() => setShowApproveModal(true)}
              disabled={isSubmitting}
              className="w-full h-10 bg-green-600 hover:bg-green-700 text-[13px]"
            >
              <CheckCircle className="h-5 w-5 mr-2" />
              {isSubmitting ? 'Processing...' : 'Approve Certificate'}
            </Button>

            <Button
              onClick={() => handleAction('revision')}
              disabled={isSubmitting}
              variant="outline"
              className="w-full h-10 border-2 border-orange-400 text-orange-600 hover:bg-orange-50 text-[13px]"
            >
              <MessageSquare className="h-4 w-4 mr-2" />
              Request Revision
            </Button>

            <Button
              onClick={() => handleAction('reject')}
              disabled={isSubmitting}
              variant="outline"
              className="w-full h-10 border-2 border-red-400 text-red-600 hover:bg-red-50 text-[13px]"
            >
              <XCircle className="h-4 w-4 mr-2" />
              Reject Certificate
            </Button>
          </div>

          {/* Help Text */}
          <p className="text-xs text-gray-400 text-center">
            Approving sends for customer approval. Revision returns to engineer.
          </p>
        </div>
        )}
      </div>

      {/* Latest Feedback Thread */}
      {hasPreviousFeedback && (
        <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden shadow-sm">
          <button
            onClick={() => setIsPreviousFeedbackExpanded(!isPreviousFeedbackExpanded)}
            className="w-full px-5 py-4 flex items-center justify-between bg-gradient-to-r from-slate-50 to-slate-100 hover:from-slate-100 hover:to-slate-150 transition-colors"
          >
            <div className="flex items-center gap-3">
              <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
                <MessageSquare className="h-5 w-5 text-slate-600" />
              </div>
              <div className="text-left">
                <span className="text-base font-semibold text-slate-800 block">Latest Feedback Thread</span>
                <span className="text-xs text-slate-500">Recent conversation</span>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-slate-200 text-slate-700 font-semibold">
                {latestThread.length}
              </span>
            </div>
            {isPreviousFeedbackExpanded ? (
              <ChevronDown className="h-5 w-5 text-slate-500" />
            ) : (
              <ChevronRight className="h-5 w-5 text-slate-500" />
            )}
          </button>

          {isPreviousFeedbackExpanded && (
            <div className="border-t-2 border-slate-100">
              {/* Chat-style messages */}
              <div className="p-4 bg-gray-50 flex flex-col gap-2 max-h-64 overflow-y-auto">
                {latestThread.map((item) => {
                  const isOwnMessage = item.type === 'hod'
                  const isCustomer = item.type === 'customer'
                  const isEngineer = item.type === 'engineer'

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

      {/* Approve Modal */}
      <ApproveModal
        isOpen={showApproveModal}
        onClose={() => setShowApproveModal(false)}
        certificateId={certificateId}
        certificateNumber={certificateNumber}
        uucDescription={uucDescription}
        customerName={customerName}
        customerEmail={customerEmail}
        pendingEditsCount={pendingEdits.length}
        onApprove={handleApprove}
      />
    </div>
  )
}
