'use client'

import { useState, useMemo, useEffect } from 'react'
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
  currentStatus: string
  feedbacks?: Feedback[]
  // Certificate data for editing
  dateOfCalibration: string | null
  calibrationDueDate: string | null
  calibrationTenure: number
  dueDateAdjustment: number
  // Callback to notify parent of pending edits
  onPendingEditsChange?: (edits: PendingEdit[]) => void
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

export function ReviewActions({
  certificateId,
  currentStatus,
  feedbacks = [],
  dateOfCalibration,
  calibrationDueDate,
  calibrationTenure,
  dueDateAdjustment,
  onPendingEditsChange,
}: ReviewActionsProps) {
  const router = useRouter()
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

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

  // Get previous feedback context
  const previousRevisionRequest = feedbacks.find(f => f.feedbackType === 'REVISION_REQUEST')
  const engineerResponse = feedbacks.find(f => f.feedbackType === 'ENGINEER_RESPONSE')
  const hasPreviousFeedback = previousRevisionRequest || engineerResponse

  const handleAction = async (action: 'approve' | 'reject' | 'revision') => {
    if (action !== 'approve' && !comment.trim()) {
      setError('Please provide a comment for rejection or revision request')
      return
    }

    setIsSubmitting(true)
    setError(null)

    // Build request body
    const requestBody: {
      action: string
      comment?: string
      edits?: PendingEdit[]
    } = {
      action,
      comment: comment.trim() || undefined,
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

          {/* Comment Field */}
          <div>
            <Label htmlFor="comment" className="text-sm font-medium text-slate-700 mb-2 block">
              Review Comment
            </Label>
            <textarea
              id="comment"
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Add comments (required for rejection/revision)..."
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
              onClick={() => handleAction('approve')}
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

      {/* Previous Feedback Context - Collapsible */}
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
                <span className="text-base font-semibold text-slate-800 block">Previous Feedback</span>
                <span className="text-xs text-slate-500">Review conversation history</span>
              </div>
              <span className="text-xs px-2 py-1 rounded-full bg-slate-200 text-slate-700 font-semibold">
                {[previousRevisionRequest, engineerResponse].filter(Boolean).length}
              </span>
            </div>
            {isPreviousFeedbackExpanded ? (
              <ChevronDown className="h-5 w-5 text-slate-500" />
            ) : (
              <ChevronRight className="h-5 w-5 text-slate-500" />
            )}
          </button>

          {isPreviousFeedbackExpanded && (
            <div className="p-5 space-y-4 bg-slate-50/50 border-t-2 border-slate-100">
              {/* Your Previous Request */}
              {previousRevisionRequest && (
                <div className="rounded-lg border-2 border-orange-200 bg-orange-50 p-4">
                  <div className="flex items-start gap-3">
                    <AlertTriangle className="h-5 w-5 text-orange-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-orange-700">You requested revision:</span>
                        <span className="text-xs text-orange-500">
                          {new Date(previousRevisionRequest.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short'
                          })}
                        </span>
                      </div>
                      {previousRevisionRequest.comment && (
                        <p className="text-sm text-slate-700 line-clamp-4">{previousRevisionRequest.comment}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              {/* Engineer's Response */}
              {engineerResponse && (
                <div className="rounded-lg border-2 border-blue-200 bg-blue-50 p-4">
                  <div className="flex items-start gap-3">
                    <User className="h-5 w-5 text-blue-500 mt-0.5 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="text-sm font-semibold text-blue-700">Engineer responded:</span>
                        <span className="text-xs text-blue-500">
                          {new Date(engineerResponse.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short'
                          })}
                        </span>
                      </div>
                      {engineerResponse.comment && (
                        <p className="text-sm text-slate-700 line-clamp-4">{engineerResponse.comment}</p>
                      )}
                    </div>
                  </div>
                </div>
              )}

              <p className="text-xs text-slate-400 text-center">
                View full history in sidebar →
              </p>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
