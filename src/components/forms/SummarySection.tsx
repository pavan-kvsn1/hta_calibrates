'use client'

import { FlaskConical, Factory, Calendar } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Textarea } from '@/components/ui/textarea'
import { Label } from '@/components/ui/label'
import { FormSection } from './FormSection'
import { useCertificateStore } from '@/lib/certificate-store'
import { cn } from '@/lib/utils'

const TENURE_OPTIONS = [3, 6, 9, 12] as const

export function SummarySection() {
  const { formData, setFormField } = useCertificateStore()

  // Get today's date in YYYY-MM-DD format for min date validation
  const today = new Date().toISOString().split('T')[0]

  // Format the due date for display
  const formatDate = (dateString: string) => {
    if (!dateString) return ''
    const date = new Date(dateString)
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: 'short',
      year: 'numeric',
    })
  }

  return (
    <FormSection
      id="summary"
      sectionNumber="Section 01"
      title="Summary Information"
    >
      <div className="space-y-8">
        {/* Calibrated At */}
        <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100 shadow-sm">
          <Label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-4">
            Calibrated At <span className="text-red-500">*</span>
          </Label>
          <div className="flex flex-wrap gap-4">
            <label className="relative flex-1 min-w-[200px] cursor-pointer">
              <input
                type="radio"
                name="calibratedAt"
                value="LAB"
                checked={formData.calibratedAt === 'LAB'}
                onChange={() => setFormField('calibratedAt', 'LAB')}
                className="peer sr-only"
              />
              <div className={cn(
                "p-4 rounded-xl border-2 bg-white transition-all text-center",
                formData.calibratedAt === 'LAB'
                  ? "border-primary bg-primary/5"
                  : "border-slate-100"
              )}>
                <FlaskConical className={cn(
                  "size-6 mx-auto mb-2",
                  formData.calibratedAt === 'LAB' ? "text-primary" : "text-slate-400"
                )} />
                <span className={cn(
                  "font-bold",
                  formData.calibratedAt === 'LAB' ? "text-primary" : "text-slate-700"
                )}>
                  In-House Laboratory
                </span>
              </div>
            </label>

            <label className="relative flex-1 min-w-[200px] cursor-pointer">
              <input
                type="radio"
                name="calibratedAt"
                value="SITE"
                checked={formData.calibratedAt === 'SITE'}
                onChange={() => setFormField('calibratedAt', 'SITE')}
                className="peer sr-only"
              />
              <div className={cn(
                "p-4 rounded-xl border-2 bg-white transition-all text-center",
                formData.calibratedAt === 'SITE'
                  ? "border-primary bg-primary/5"
                  : "border-slate-100"
              )}>
                <Factory className={cn(
                  "size-6 mx-auto mb-2",
                  formData.calibratedAt === 'SITE' ? "text-primary" : "text-slate-400"
                )} />
                <span className={cn(
                  "font-bold",
                  formData.calibratedAt === 'SITE' ? "text-primary" : "text-slate-700"
                )}>
                  On-Site Location
                </span>
              </div>
            </label>
          </div>
        </div>

        {/* SRF Details - Only shown for In-House Laboratory */}
        {formData.calibratedAt === 'LAB' && (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
            <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100 shadow-sm">
              <Label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                SRF Number <span className="text-red-500">*</span>
              </Label>
              <Input
                type="text"
                value={formData.srfNumber}
                onChange={(e) => setFormField('srfNumber', e.target.value)}
                placeholder="Enter SRF Number"
                className="w-full rounded-xl border-slate-200 h-12 px-4 focus:ring-primary focus:border-primary font-semibold"
              />
            </div>
            <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100 shadow-sm">
              <Label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
                SRF Date <span className="text-red-500">*</span>
              </Label>
              <Input
                type="date"
                value={formData.srfDate}
                onChange={(e) => setFormField('srfDate', e.target.value)}
                className="w-full rounded-xl border-slate-200 h-12 px-4 focus:ring-primary focus:border-primary"
              />
            </div>
          </div>
        )}

        {/* Date and Tenure Row */}
        <div className="grid grid-cols-1 md:grid-cols-2 gap-8">
          {/* Date of Calibration */}
          <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100 shadow-sm">
            <Label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Date of Calibration <span className="text-red-500">*</span>
            </Label>
            <Input
              type="date"
              value={formData.dateOfCalibration}
              onChange={(e) => setFormField('dateOfCalibration', e.target.value)}
              className="w-full rounded-xl border-slate-200 h-12 px-4 focus:ring-primary focus:border-primary"
            />
          </div>

          {/* Calibration Tenure */}
          <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100 shadow-sm">
            <Label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Calibration Tenure
            </Label>
            <div className="flex gap-2">
              {TENURE_OPTIONS.map((tenure) => (
                <button
                  key={tenure}
                  type="button"
                  onClick={() => setFormField('calibrationTenure', tenure)}
                  className={cn(
                    "flex-1 py-2.5 rounded-lg font-bold text-sm transition-all",
                    formData.calibrationTenure === tenure
                      ? "bg-primary text-white"
                      : "border border-slate-200 hover:bg-slate-50"
                  )}
                >
                  {tenure} Mo
                </button>
              ))}
            </div>
            <p className="mt-2 text-[10px] text-slate-400 font-bold uppercase">
              Default: 12 Mo
            </p>
          </div>
        </div>

        {/* Calculated Due Date */}
        <div className="bg-primary/5 rounded-2xl p-6 border border-primary/10">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-6">
              <div className="size-14 rounded-xl bg-primary/10 flex items-center justify-center text-primary">
                <Calendar className="size-8" />
              </div>
              <div>
                <p className="text-[10px] font-extrabold text-primary uppercase tracking-widest">
                  Calculated Due Date
                </p>
                <p className="text-xl font-extrabold text-slate-900">
                  {formatDate(formData.calibrationDueDate)}
                </p>
                <p className="text-xs text-slate-500">
                  Based on calibration date + tenure
                  {formData.dueDateAdjustment < 0 && (
                    <span className="text-amber-600 font-semibold ml-1">
                      ({formData.dueDateAdjustment} days)
                    </span>
                  )}
                </p>
              </div>
            </div>
            <div className="flex flex-col items-end gap-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wider">
                Adjust Due Date
              </p>
              <div className="flex gap-1">
                {([-3, -2, -1, 0] as const).map((days) => (
                  <button
                    key={days}
                    type="button"
                    onClick={() => setFormField('dueDateAdjustment', days)}
                    className={cn(
                      "w-10 h-8 rounded-lg text-xs font-bold transition-all",
                      formData.dueDateAdjustment === days
                        ? "bg-primary text-white"
                        : "bg-white border border-slate-200 text-slate-600 hover:bg-slate-50"
                    )}
                  >
                    {days === 0 ? '0' : days}
                  </button>
                ))}
              </div>
            </div>
          </div>
        </div>

        {/* Customer Information */}
        <div className="bg-slate-50/50 rounded-2xl p-6 border border-slate-100 shadow-sm space-y-6">
          <div>
            <Label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Customer Name <span className="text-red-500">*</span>
            </Label>
            <Input
              type="text"
              value={formData.customerName}
              onChange={(e) => setFormField('customerName', e.target.value)}
              placeholder="Enter customer name"
              className="w-full rounded-xl border-slate-200 h-12 px-4 focus:ring-primary focus:border-primary font-semibold"
            />
          </div>
          <div>
            <Label className="block text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
              Full Address <span className="text-red-500">*</span>
            </Label>
            <Textarea
              value={formData.customerAddress}
              onChange={(e) => setFormField('customerAddress', e.target.value)}
              placeholder="Enter customer address"
              rows={3}
              className="w-full rounded-xl border-slate-200 px-4 py-3 focus:ring-primary focus:border-primary font-medium"
            />
          </div>
        </div>
      </div>
    </FormSection>
  )
}
