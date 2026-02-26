'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { useSession } from 'next-auth/react'
import {
  CheckCircle,
  AlertCircle,
  Save,
  Send,
  Eye,
  EyeOff,
  Loader2,
  AlertTriangle,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  User,
  PenLine
} from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormSection } from './FormSection'
import { useCertificateStore } from '@/lib/stores/certificate-store'
import { cn } from '@/lib/utils'
import { PDFPreviewSection } from '@/components/pdf'
import { SignatureModal } from '@/components/signatures'
import type { SignatureData } from '@/types/signatures'

interface ValidationItem {
  id: string
  label: string
  isValid: boolean
  isOptional?: boolean
  isCritical?: boolean // Blocks saving draft entirely
}

interface Feedback {
  id: string
  feedbackType: string
  comment: string | null
  createdAt: string
  user: {
    name: string
    role: string
  }
}

interface FinalizeSectionProps {
  feedbacks?: Feedback[]
}

export function FinalizeSection({ feedbacks = [] }: FinalizeSectionProps) {
  const router = useRouter()
  const { data: session } = useSession()
  const { formData, isSaving, certificateId, saveDraft, setEngineerNotes } = useCertificateStore()
  const [showPDFPreview, setShowPDFPreview] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [isFeedbackRefExpanded, setIsFeedbackRefExpanded] = useState(false)
  const [showSignatureModal, setShowSignatureModal] = useState(false)

  // Get only the latest revision request feedback (feedbacks are ordered by createdAt desc from API)
  const latestRevisionFeedback = feedbacks.find(f => f.feedbackType === 'REVISION_REQUEST')
  const isRevisionRequired = formData.status === 'REVISION_REQUIRED'

  // Check for bin range violations (bins outside operating range)
  const binRangeViolations = formData.parameters.reduce((acc, param) => {
    if (!param.requiresBinning || !param.bins?.length) return acc

    const opMin = parseFloat(param.operatingMin)
    const opMax = parseFloat(param.operatingMax)

    // Skip if operating range not defined
    if (isNaN(opMin) && isNaN(opMax)) return acc

    let violations = 0
    param.bins.forEach(bin => {
      const binMin = parseFloat(bin.binMin)
      const binMax = parseFloat(bin.binMax)

      if (!isNaN(binMin)) {
        if (!isNaN(opMin) && binMin < opMin) violations++
        if (!isNaN(opMax) && binMin > opMax) violations++
      }
      if (!isNaN(binMax)) {
        if (!isNaN(opMin) && binMax < opMin) violations++
        if (!isNaN(opMax) && binMax > opMax) violations++
      }
    })
    return acc + violations
  }, 0)

  // Check for standard reading violations (readings outside operating range)
  const standardReadingViolations = formData.parameters.reduce((acc, param) => {
    const opMin = parseFloat(param.operatingMin)
    const opMax = parseFloat(param.operatingMax)

    // Skip if operating range not defined
    if (isNaN(opMin) && isNaN(opMax)) return acc

    let violations = 0
    param.results.forEach(result => {
      if (!result.standardReading) return

      const reading = parseFloat(result.standardReading)
      if (isNaN(reading)) return

      if (!isNaN(opMin) && reading < opMin) violations++
      if (!isNaN(opMax) && reading > opMax) violations++
    })
    return acc + violations
  }, 0)

  const hasCriticalErrors = binRangeViolations > 0 || standardReadingViolations > 0

  // Validation checks
  const validationItems: ValidationItem[] = [
    {
      id: 'summary',
      label: 'Summary information complete',
      isValid:
        !!formData.dateOfCalibration &&
        !!formData.customerName &&
        !!formData.customerAddress,
    },
    {
      id: 'uuc',
      label: 'UUC details filled',
      isValid:
        !!formData.uucDescription &&
        !!formData.uucMake &&
        !!formData.uucModel &&
        !!formData.uucSerialNumber,
    },
    {
      id: 'masterInstrument',
      label: 'Master instrument selected (calibration valid)',
      isValid: formData.masterInstruments.some(
        (inst) => inst.description && inst.make && inst.model && inst.serialNumber
      ),
    },
    {
      id: 'environmental',
      label: 'Environmental conditions recorded',
      isValid: !!formData.ambientTemperature && !!formData.relativeHumidity,
    },
    {
      id: 'results',
      label: `Calibration results entered (${formData.parameters.reduce(
        (acc, p) => acc + p.results.filter((r) => r.standardReading && r.beforeAdjustment).length,
        0
      )} points)`,
      isValid: formData.parameters.some((p) =>
        p.results.some((r) => r.standardReading && r.beforeAdjustment)
      ),
    },
    {
      id: 'status',
      label: 'Calibration status selected',
      isValid: formData.calibrationStatus.length > 0,
    },
    {
      id: 'conclusion',
      label: `Conclusion statements selected (${formData.selectedConclusionStatements.length})`,
      isValid: formData.selectedConclusionStatements.length > 0,
    },
    // Critical errors - block saving
    {
      id: 'binRanges',
      label: binRangeViolations > 0
        ? `Bin ranges outside operating range (${binRangeViolations} violation${binRangeViolations !== 1 ? 's' : ''})`
        : 'Bin ranges within operating range',
      isValid: binRangeViolations === 0,
      isCritical: true,
    },
    {
      id: 'standardReadings',
      label: standardReadingViolations > 0
        ? `Standard readings outside operating range (${standardReadingViolations} violation${standardReadingViolations !== 1 ? 's' : ''})`
        : 'Standard readings within operating range',
      isValid: standardReadingViolations === 0,
      isCritical: true,
    },
  ]

  const requiredItemsValid = validationItems
    .filter((item) => !item.isOptional)
    .every((item) => item.isValid)

  const handleSaveDraft = async () => {
    // Check for critical errors before saving
    if (hasCriticalErrors) {
      const errors: string[] = []
      if (binRangeViolations > 0) {
        errors.push(`• ${binRangeViolations} bin range value${binRangeViolations !== 1 ? 's are' : ' is'} outside the operating range`)
      }
      if (standardReadingViolations > 0) {
        errors.push(`• ${standardReadingViolations} standard reading${standardReadingViolations !== 1 ? 's are' : ' is'} outside the operating range`)
      }
      alert(`Cannot save draft due to critical errors:\n\n${errors.join('\n')}\n\nPlease fix these issues in Section 02 (UUC Details) and Section 05 (Results).`)
      return
    }

    const result = await saveDraft()
    if (!result.success) {
      alert(`Failed to save draft: ${result.error}`)
    }
  }

  const handleSubmit = () => {
    // Check for critical errors first
    if (hasCriticalErrors) {
      const errors: string[] = []
      if (binRangeViolations > 0) {
        errors.push(`• ${binRangeViolations} bin range value${binRangeViolations !== 1 ? 's are' : ' is'} outside the operating range`)
      }
      if (standardReadingViolations > 0) {
        errors.push(`• ${standardReadingViolations} standard reading${standardReadingViolations !== 1 ? 's are' : ' is'} outside the operating range`)
      }
      alert(`Cannot submit due to critical errors:\n\n${errors.join('\n')}\n\nPlease fix these issues in Section 02 (UUC Details) and Section 05 (Results).`)
      return
    }

    if (!requiredItemsValid) {
      alert('Please complete all required fields before submitting.')
      return
    }

    setSubmitError(null)
    setShowSignatureModal(true)
  }

  const handleSignatureConfirm = async (signatureData: SignatureData) => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // First, save the current draft to ensure all data is persisted
      const saveResult = await saveDraft()
      if (!saveResult.success) {
        throw new Error(saveResult.error || 'Failed to save draft before submitting')
      }

      // Get the certificate ID (either from store or from save result)
      const certId = certificateId
      if (!certId) {
        throw new Error('Certificate ID not found. Please save the certificate first.')
      }

      // Submit for review with signature data and client evidence
      const response = await fetch(`/api/certificates/${certId}/submit`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          engineerNotes: formData.engineerNotes || null,
          signatureData: signatureData.signatureImage,
          signerName: signatureData.signerName,
          clientEvidence: signatureData.clientEvidence,
        })
      })

      const data = await response.json()

      if (!response.ok) {
        if (data.validationErrors) {
          throw new Error(`Validation failed:\n${data.validationErrors.join('\n')}`)
        }
        throw new Error(data.error || 'Failed to submit certificate')
      }

      // Success - close modal and redirect to dashboard
      setShowSignatureModal(false)
      alert('Certificate submitted successfully for HoD review!')
      router.push('/dashboard')
    } catch (error) {
      console.error('Submit error:', error)
      setSubmitError(error instanceof Error ? error.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handlePreviewPDF = () => {
    setShowPDFPreview(!showPDFPreview)
  }

  return (
    <FormSection
      id="submit"
      sectionNumber="Final Step"
      title="Review & Submit"
      isDark={true}
    >
      <div className="space-y-8">
        {/* HoD Feedback Reference - Collapsible (only when revision required, shows latest only) */}
        {isRevisionRequired && latestRevisionFeedback && (
          <div className="rounded-2xl border-2 border-orange-200 bg-orange-50/50 overflow-hidden">
            <button
              onClick={() => setIsFeedbackRefExpanded(!isFeedbackRefExpanded)}
              className="w-full px-6 py-4 flex items-center justify-between hover:bg-orange-100/50 transition-colors"
            >
              <div className="flex items-center gap-3">
                <AlertTriangle className="size-5 text-orange-600" />
                <span className="font-semibold text-orange-900 text-[14px]" >HoD Feedback Reference</span>
                <span className="text-xs px-2 py-0.5 rounded-full bg-orange-200 text-orange-700 font-medium">
                  Latest
                </span>
              </div>
              {isFeedbackRefExpanded ? (
                <ChevronUp className="size-5 text-orange-600" />
              ) : (
                <ChevronDown className="size-5 text-orange-600" />
              )}
            </button>
            {isFeedbackRefExpanded && (
              <div className="px-6 pb-6">
                <div className="bg-white rounded-xl border border-orange-200 p-4">
                  <div className="flex items-start gap-3">
                    <div className="p-2 rounded-full bg-orange-100">
                      <User className="size-4 text-orange-600" />
                    </div>
                    <div className="flex-1">
                      <div className="flex items-center gap-2 mb-2">
                        <span className="font-semibold text-slate-900 text-[13px]">{latestRevisionFeedback.user.name}</span>
                        <span className="text-xs px-2 py-0.5 rounded-full bg-slate-100 text-slate-600 font-medium">
                          {latestRevisionFeedback.user.role === 'HOD' ? 'Head of Department' : latestRevisionFeedback.user.role}
                        </span>
                        <span className="text-xs text-slate-400 text-[12px]">
                          {new Date(latestRevisionFeedback.createdAt).toLocaleDateString('en-GB', {
                            day: 'numeric',
                            month: 'short',
                            year: 'numeric',
                            hour: '2-digit',
                            minute: '2-digit'
                          })}
                        </span>
                      </div>
                      {latestRevisionFeedback.comment && (
                        <div className="flex items-start gap-2">
                          <MessageSquare className="size-4 text-slate-400 mt-0.5 flex-shrink-0" />
                          <p className="text-slate-700 whitespace-pre-wrap text-[13px]">{latestRevisionFeedback.comment}</p>
                        </div>
                      )}
                    </div>
                  </div>
                </div>
                <p className="text-xs text-orange-600 mt-3 text-center font-medium">
                  View full feedback history in the sidebar →
                </p>
              </div>
            )}
          </div>
        )}

        {/* Engineer Response Notes - Only when revision required */}
        {isRevisionRequired && (
          <div className="rounded-2xl border-2 border-blue-200 bg-blue-50/50 p-6">
            <div className="flex items-center gap-3 mb-4">
              <div className="p-2 rounded-lg bg-blue-100">
                <PenLine className="size-5 text-blue-700" />
              </div>
              <div>
                <h3 className="font-bold text-blue-900 text-[14px]">Response Notes for HoD</h3>
                <p className="text-sm text-blue-700 text-[13px]">Summarize the changes you made to address the feedback</p>
              </div>
            </div>
            <textarea
              value={formData.engineerNotes || ''}
              onChange={(e) => setEngineerNotes(e.target.value)}
              placeholder="Example:&#10;- Rechecked temperature readings in points 3-5&#10;- Updated values to match master instrument logs&#10;- Verified calibration records dated 1 Feb 2026"
              className="w-full h-30 px-4 py-2 rounded-xl border border-blue-200 bg-white text-slate-700 text-[13px] placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent resize-none"
            />
            <p className="text-xs text-blue-600 mt-2 font-medium text-[12px]">
              This note will be visible to the HoD when reviewing your resubmission.
            </p>
          </div>
        )}

        {/* Validation Checklist */}
        <div className={cn(
          "rounded-2xl p-6 border",
          hasCriticalErrors ? "bg-red-50 border-red-200" : "bg-slate-50 border-slate-200"
        )}>
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-widest mb-4">
            Validation Checklist
          </h3>

          {/* Critical errors section */}
          {hasCriticalErrors && (
            <div className="mb-4 p-4 bg-red-100 border border-red-300 rounded-xl">
              <div className="flex items-center gap-2 text-red-800 font-bold text-sm mb-2">
                <AlertTriangle className="size-5" />
                Critical Errors - Must Fix Before Saving
              </div>
              <div className="space-y-1 text-sm text-red-700">
                {binRangeViolations > 0 && (
                  <p>• {binRangeViolations} bin range value{binRangeViolations !== 1 ? 's' : ''} outside operating range (Section 02)</p>
                )}
                {standardReadingViolations > 0 && (
                  <p>• {standardReadingViolations} standard reading{standardReadingViolations !== 1 ? 's' : ''} outside operating range (Section 05)</p>
                )}
              </div>
            </div>
          )}

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8">
            {validationItems.filter(item => !item.isCritical).map((item) => (
              <div
                key={item.id}
                className="flex items-center gap-2 text-sm text-slate-600 font-semibold"
              >
                {item.isOptional ? (
                  item.isValid ? (
                    <CheckCircle className="size-4 text-green-500 flex-shrink-0" />
                  ) : (
                    <AlertCircle className="size-4 text-amber-500 flex-shrink-0" />
                  )
                ) : item.isValid ? (
                  <CheckCircle className="size-4 text-green-500 flex-shrink-0" />
                ) : (
                  <AlertCircle className="size-4 text-red-500 flex-shrink-0" />
                )}
                <span className={cn(!item.isValid && !item.isOptional && 'text-red-600')}>
                  {item.isOptional && !item.isValid
                    ? item.label
                    : item.label.replace(' - optional, not filled', '')}
                </span>
              </div>
            ))}
          </div>

          <div className="mt-6 pt-6 border-t border-slate-200 text-center">
            {hasCriticalErrors ? (
              <p className="text-red-600 font-black uppercase text-xs tracking-widest">
                Fix critical errors before saving
              </p>
            ) : requiredItemsValid ? (
              <p className="text-green-600 font-black uppercase text-xs tracking-widest">
                Ready to submit
              </p>
            ) : (
              <p className="text-amber-600 font-black uppercase text-xs tracking-widest">
                Please complete required fields
              </p>
            )}
          </div>
        </div>

        {/* PDF Preview Section */}
        <PDFPreviewSection showPreview={showPDFPreview} />

        {/* Error Display */}
        {submitError && (
          <div className="bg-red-50 border border-red-200 rounded-xl p-4">
            <p className="text-red-700 text-sm font-medium whitespace-pre-line">{submitError}</p>
          </div>
        )}

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={handlePreviewPDF}
            disabled={isSubmitting}
            className={cn(
              "flex-1 py-6 px-6 rounded-2xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2",
              showPDFPreview && "border-primary bg-primary/5 text-primary"
            )}
          >
            {showPDFPreview ? <EyeOff className="size-5" /> : <Eye className="size-5" />}
            {showPDFPreview ? 'Hide Preview' : 'Preview PDF'}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleSaveDraft}
            disabled={isSaving || isSubmitting || hasCriticalErrors}
            className={cn(
              "flex-1 py-6 px-6 rounded-2xl border bg-white font-bold transition-all flex items-center justify-center gap-2",
              hasCriticalErrors
                ? "border-red-300 text-red-400 cursor-not-allowed"
                : "border-slate-200 text-slate-700 hover:bg-slate-50"
            )}
          >
            {isSaving ? <Loader2 className="size-5 animate-spin" /> : <Save className="size-5" />}
            {isSaving ? 'Saving...' : hasCriticalErrors ? 'Fix Errors First' : 'Save Draft'}
          </Button>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!requiredItemsValid || isSaving || isSubmitting || hasCriticalErrors}
            className="flex-[2] py-6 px-6 rounded-2xl bg-primary text-white font-bold shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isSubmitting ? <Loader2 className="size-5 animate-spin" /> : <Send className="size-5" />}
            {isSubmitting ? 'Submitting...' : isRevisionRequired ? 'Resubmit for Review' : 'Submit for Internal Approval'}
          </Button>
        </div>

        <p className="text-center text-[11px] text-slate-400 font-medium">
          By submitting, this certificate will be sent to the Head of Department for internal
          approval.
        </p>

        {/* Signature Modal */}
        <SignatureModal
          isOpen={showSignatureModal}
          onClose={() => setShowSignatureModal(false)}
          onConfirm={handleSignatureConfirm}
          defaultName={session?.user?.name || ''}
          nameReadOnly={true}
          title="Sign & Submit Certificate"
          description="Your signature confirms you have reviewed and are submitting this certificate for HoD approval."
          confirmLabel="Sign & Submit"
          loading={isSubmitting}
          error={submitError}
        />
      </div>
    </FormSection>
  )
}
