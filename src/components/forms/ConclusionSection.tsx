'use client'

import { X, FileText } from 'lucide-react'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FormSection } from './FormSection'
import { useCertificateStore } from '@/lib/certificate-store'

// Conclusion statements data from the reference document
const CONCLUSION_STATEMENTS: Record<string, string> = {
  'within_accuracy': 'Equipment performance is within specified accuracy limits',
  'out_of_accuracy': '"*" Indicated readings are beyond specified accuracy limits',
  'accuracy_not_given': '"#" Indicates accuracy details not furnished.',
  'all_cal_points_out': 'Cal Due date is not given as all the UUC readings are beyond specified accuracy limits.',
  'customer_no_due_date': 'Cal. Due date is left blank intentionally as per customer request',
  'customer_due_date_beyond_1yr': 'Cal Due date is given as per customer request.',
  'facility_limitation': 'Due to limitation of facility, the instrument is calibrated only up to the above specified range',
  'anemometer_vibration': 'Zero reading is taken after switching ON the instrument.',
  'no_serial_number': 'As there\'s no Sl. No. on the UUC instrument, our label no. is made as it\'s Sl. No.',
  'specific_cal_points': 'Calibration points are given as per customer request.',
  'ph_meter': 'Since pH meters come under the classification "calibration before use" it is suggested to calibrate pH meters before each usage.',
  'tds_conductivity': 'Since TDS / Conductivity meters come under the classification "calibration before use" it is suggested to calibrate Conductivity meters before each usage.',
  'uuc_without_adjust': 'Since no adjustment has been carried out on UUC instrument, both before and after adjustment readings are same',
  'uuc_with_adjust': 'Since adjustment has been carried out on UUC instrument, both before and after adjustment readings are different and after adjustment readings are only considered for error calculations.',
}

// Display labels for the dropdown
const CONCLUSION_LABELS: Record<string, string> = {
  'within_accuracy': 'Within accuracy',
  'out_of_accuracy': 'Out of Accuracy',
  'accuracy_not_given': 'Accuracy not given',
  'all_cal_points_out': 'All Cal points Out of Accuracy',
  'customer_no_due_date': 'When customer requests not to give due date',
  'customer_due_date_beyond_1yr': 'When cal due date requested by customer is beyond 1 year',
  'facility_limitation': 'Facility limitation - for In house',
  'anemometer_vibration': 'For anemometer, vibration meter',
  'no_serial_number': 'When no sl.no /Id no. available on UUC – for In house',
  'specific_cal_points': 'Specific cal. Points are given by customer – for In house',
  'ph_meter': 'For pH meter',
  'tds_conductivity': 'For TDS / Conductivity meters',
  'uuc_without_adjust': 'UUC without adjust',
  'uuc_with_adjust': 'UUC with adjust (very rare) applicable only @ site',
}

export function ConclusionSection() {
  const { formData, setFormField } = useCertificateStore()

  const handleAddStatement = (key: string) => {
    if (key && !formData.selectedConclusionStatements.includes(key)) {
      setFormField('selectedConclusionStatements', [
        ...formData.selectedConclusionStatements,
        key,
      ])
    }
  }

  const handleRemoveStatement = (key: string) => {
    setFormField(
      'selectedConclusionStatements',
      formData.selectedConclusionStatements.filter((k) => k !== key)
    )
  }

  // Get available options (not yet selected)
  const availableOptions = Object.keys(CONCLUSION_STATEMENTS).filter(
    (key) => !formData.selectedConclusionStatements.includes(key)
  )

  return (
    <FormSection
      id="conclusion"
      sectionNumber="Section 07"
      title="Conclusion Statements"
    >
      <div className="space-y-6">
        {/* Dropdown to add statements */}
        <div>
          <Label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-3">
            Add Conclusion Statement
          </Label>
          <Select onValueChange={handleAddStatement} value="">
            <SelectTrigger className="w-full rounded-xl border-slate-200 h-12 px-4 focus:ring-primary focus:border-primary font-medium">
              <SelectValue placeholder="Select a conclusion statement to add..." />
            </SelectTrigger>
            <SelectContent>
              {availableOptions.map((key) => (
                <SelectItem key={key} value={key}>
                  {CONCLUSION_LABELS[key]}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          <p className="mt-2 text-[10px] text-slate-400">
            Select multiple statements as applicable. Each selection will display the corresponding standard statement.
          </p>
        </div>

        {/* Selected Statements Display */}
        {formData.selectedConclusionStatements.length > 0 && (
          <div className="space-y-4">
            <Label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider">
              Selected Statements ({formData.selectedConclusionStatements.length})
            </Label>
            <div className="space-y-3">
              {formData.selectedConclusionStatements.map((key, index) => (
                <div
                  key={key}
                  className="bg-slate-50 rounded-xl p-4 border border-slate-200 relative group"
                >
                  <button
                    type="button"
                    onClick={() => handleRemoveStatement(key)}
                    className="absolute top-3 right-3 p-1 rounded-lg text-slate-400 hover:text-red-500 hover:bg-red-50 transition-colors"
                    title="Remove statement"
                  >
                    <X className="size-4" />
                  </button>
                  <div className="pr-8">
                    <div className="flex items-center gap-2 mb-2">
                      <span className="text-[10px] font-bold text-primary bg-primary/10 px-2 py-0.5 rounded">
                        {index + 1}
                      </span>
                      <span className="text-xs font-bold text-slate-700">
                        {CONCLUSION_LABELS[key]}
                      </span>
                    </div>
                    <p className="text-sm text-slate-600 leading-relaxed">
                      {CONCLUSION_STATEMENTS[key]}
                    </p>
                  </div>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {formData.selectedConclusionStatements.length === 0 && (
          <div className="text-center py-8 bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
            <FileText className="size-10 mx-auto text-slate-300 mb-3" />
            <p className="text-sm text-slate-500 font-medium">
              No conclusion statements selected
            </p>
            <p className="text-xs text-slate-400 mt-1">
              Use the dropdown above to add applicable statements
            </p>
          </div>
        )}
      </div>
    </FormSection>
  )
}
