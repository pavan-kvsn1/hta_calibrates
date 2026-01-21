'use client'

import { useState } from 'react'
import { CheckCircle, AlertCircle, Save, Send, Eye, EyeOff } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { FormSection } from './FormSection'
import { useCertificateStore } from '@/lib/certificate-store'
import { cn } from '@/lib/utils'
import { PDFPreviewSection } from '@/components/pdf'

interface ValidationItem {
  id: string
  label: string
  isValid: boolean
  isOptional?: boolean
}

export function FinalizeSection() {
  const { formData, isSaving } = useCertificateStore()
  const [showPDFPreview, setShowPDFPreview] = useState(false)

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
  ]

  const requiredItemsValid = validationItems
    .filter((item) => !item.isOptional)
    .every((item) => item.isValid)

  const handleSaveDraft = () => {
    // In production, this would save to API
    console.log('Saving draft...', formData)
  }

  const handleSubmit = () => {
    if (!requiredItemsValid) {
      alert('Please complete all required fields before submitting.')
      return
    }
    // In production, this would submit for review
    console.log('Submitting for review...', formData)
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
        {/* Validation Checklist */}
        <div className="bg-slate-50 rounded-2xl p-6 border border-slate-200">
          <h3 className="text-xs font-extrabold text-slate-900 uppercase tracking-widest mb-4">
            Validation Checklist
          </h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-y-3 gap-x-8">
            {validationItems.map((item) => (
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
            {requiredItemsValid ? (
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

        {/* Action Buttons */}
        <div className="flex flex-col sm:flex-row gap-4">
          <Button
            type="button"
            variant="outline"
            onClick={handlePreviewPDF}
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
            disabled={isSaving}
            className="flex-1 py-6 px-6 rounded-2xl border border-slate-200 bg-white text-slate-700 font-bold hover:bg-slate-50 transition-all flex items-center justify-center gap-2"
          >
            <Save className="size-5" />
            {isSaving ? 'Saving...' : 'Save Draft'}
          </Button>

          <Button
            type="button"
            onClick={handleSubmit}
            disabled={!requiredItemsValid || isSaving}
            className="flex-[2] py-6 px-6 rounded-2xl bg-primary text-white font-bold shadow-lg hover:bg-primary/90 transition-all flex items-center justify-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            <Send className="size-5" />
            Submit for Internal Approval
          </Button>
        </div>

        <p className="text-center text-[11px] text-slate-400 font-medium">
          By submitting, this certificate will be sent to the Head of Department for internal
          approval.
        </p>
      </div>
    </FormSection>
  )
}
