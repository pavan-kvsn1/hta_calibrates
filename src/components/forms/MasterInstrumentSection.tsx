'use client'

import { useEffect, useState, useMemo } from 'react'
import { Plus, Trash2, CheckCircle, AlertTriangle, XCircle, Clock, Wrench } from 'lucide-react'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { FormSection } from './FormSection'
import { useCertificateStore, SelectedMasterInstrument, Parameter } from '@/lib/stores/certificate-store'
import { useMasterInstrumentStore } from '@/lib/stores/master-instrument-store'
import {
  MasterInstrument,
  InstrumentCategory,
  InstrumentStatus,
  getDisplayValue,
  getSimpleValue,
  STATUS_CONFIG,
  CATEGORY_LABELS,
  canMeasureParameter,
  coversRange,
} from '@/lib/master-instruments'
import { cn } from '@/lib/utils'

interface MasterInstrumentCardProps {
  instrument: SelectedMasterInstrument
  index: number
  onUpdate: (instrument: SelectedMasterInstrument) => void
  onRemove: () => void
  canRemove: boolean
  parameters: Parameter[]
  onParameterUpdate: (paramIndex: number, parameter: Parameter) => void
}

function StatusBadge({ status, daysUntilExpiry }: { status: InstrumentStatus; daysUntilExpiry?: number }) {
  const config = STATUS_CONFIG[status]

  const getIcon = () => {
    switch (status) {
      case 'VALID':
        return <CheckCircle className="size-4" />
      case 'EXPIRING_SOON':
        return <Clock className="size-4" />
      case 'EXPIRED':
        return <XCircle className="size-4" />
      case 'UNDER_RECAL':
        return <Wrench className="size-4" />
      case 'SERVICE_PENDING':
        return <AlertTriangle className="size-4" />
    }
  }

  return (
    <span className={cn(
      'inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-[10px] font-bold uppercase tracking-wider',
      config.color,
      config.bgColor
    )}>
      {getIcon()}
      {config.label}
      {status === 'EXPIRING_SOON' && daysUntilExpiry !== undefined && (
        <span>({daysUntilExpiry}d)</span>
      )}
    </span>
  )
}

function MasterInstrumentCard({
  instrument,
  index,
  onUpdate,
  onRemove,
  canRemove,
  parameters,
  onParameterUpdate,
}: MasterInstrumentCardProps) {
  const { instruments, isLoaded, loadInstruments } = useMasterInstrumentStore()

  // Load instruments if not loaded
  useEffect(() => {
    if (!isLoaded) {
      loadInstruments()
    }
  }, [isLoaded, loadInstruments])

  // Local state for cascading selection
  const [selectedCategory, setSelectedCategory] = useState<InstrumentCategory | ''>('')
  const [selectedDescription, setSelectedDescription] = useState('')
  const [selectedMake, setSelectedMake] = useState('')

  // Initialize local state from instrument prop (for loading saved drafts)
  useEffect(() => {
    if (instrument.masterInstrumentId && instrument.masterInstrumentId > 0 && isLoaded) {
      // Find the original instrument in the master list to get the exact description
      const originalInstrument = instruments.find(inst => inst.id === instrument.masterInstrumentId)

      if (originalInstrument) {
        // Use data from the master list for accurate dropdown matching
        setSelectedCategory(originalInstrument.type)
        setSelectedDescription(originalInstrument.instrument_desc)
        setSelectedMake(getSimpleValue(originalInstrument.make))
      } else if (instrument.category) {
        // Fallback to saved data if instrument not found in master list
        setSelectedCategory(instrument.category as InstrumentCategory)
        setSelectedDescription(instrument.description || '')
        setSelectedMake(instrument.make || '')
      }
    }
  }, [instrument.masterInstrumentId, instrument.category, instrument.description, instrument.make, instruments, isLoaded])

  // Get unique categories
  const categories = useMemo(() => {
    const cats = new Set<InstrumentCategory>()
    instruments.forEach(inst => cats.add(inst.type))
    return Array.from(cats)
  }, [instruments])

  // Get descriptions for selected category
  const descriptions = useMemo(() => {
    if (!selectedCategory) return []
    const descs = new Set<string>()
    instruments
      .filter(inst => inst.type === selectedCategory)
      .forEach(inst => descs.add(inst.instrument_desc))
    return Array.from(descs).sort()
  }, [instruments, selectedCategory])

  // Get makes for selected description
  const makes = useMemo(() => {
    if (!selectedCategory || !selectedDescription) return []
    const makeSet = new Set<string>()
    instruments
      .filter(inst =>
        inst.type === selectedCategory &&
        inst.instrument_desc === selectedDescription
      )
      .forEach(inst => makeSet.add(getSimpleValue(inst.make)))
    return Array.from(makeSet).sort()
  }, [instruments, selectedCategory, selectedDescription])

  // Get available instruments for final selection
  const availableInstruments = useMemo(() => {
    if (!selectedCategory || !selectedDescription) return []
    let filtered = instruments.filter(inst =>
      inst.type === selectedCategory &&
      inst.instrument_desc === selectedDescription
    )
    if (selectedMake) {
      filtered = filtered.filter(inst => getSimpleValue(inst.make) === selectedMake)
    }
    return filtered
  }, [instruments, selectedCategory, selectedDescription, selectedMake])

  // Handle category change - reset downstream selections
  const handleCategoryChange = (value: string) => {
    setSelectedCategory(value as InstrumentCategory)
    setSelectedDescription('')
    setSelectedMake('')
    // Clear selection but keep category
    onUpdate({
      ...instrument,
      masterInstrumentId: 0,
      category: value,
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
    })
  }

  // Handle description change
  const handleDescriptionChange = (value: string) => {
    setSelectedDescription(value)
    setSelectedMake('')
    // If only one make, auto-select it
    const makesForDesc = new Set<string>()
    instruments
      .filter(inst =>
        inst.type === selectedCategory &&
        inst.instrument_desc === value
      )
      .forEach(inst => makesForDesc.add(getSimpleValue(inst.make)))
    const makeList = Array.from(makesForDesc)
    if (makeList.length === 1) {
      setSelectedMake(makeList[0])
    }
  }

  // Handle make change
  const handleMakeChange = (value: string) => {
    setSelectedMake(value)
  }

  // Handle final instrument selection
  const handleInstrumentSelect = (assetNo: string) => {
    const selected = instruments.find(inst => inst.asset_no === assetNo)
    if (!selected) return

    // Check if expired - block selection
    if (selected.status === 'EXPIRED') {
      alert(`This instrument has expired on ${selected.next_due_on}. Please select a valid instrument.`)
      return
    }

    onUpdate({
      ...instrument,
      masterInstrumentId: selected.id,
      category: selected.type,
      description: selected.instrument_desc,
      make: getDisplayValue(selected.make),
      model: getDisplayValue(selected.model),
      assetNo: selected.asset_no,
      serialNumber: getDisplayValue(selected.instrument_sl_no),
      calibratedAt: selected.calibrated_at,
      reportNo: selected.report_no,
      calibrationDueDate: selected.next_due_on,
      isExpired: false, // Expired instruments are blocked from selection above
      isExpiringSoon: selected.status === 'EXPIRING_SOON',
    })
  }

  // Find currently selected instrument data
  const selectedInstrumentData = useMemo(() => {
    if (!instrument.masterInstrumentId) return null
    return instruments.find(inst => inst.id === instrument.masterInstrumentId)
  }, [instruments, instrument.masterInstrumentId])

  return (
    <div className="bg-slate-50 rounded-xl p-6 border border-slate-200/60 shadow-sm">
      <div className="flex items-center justify-between mb-6">
        <span className="text-xs font-extrabold text-slate-900 uppercase tracking-wider">
          Master Instrument {index + 1}
        </span>
        {canRemove && (
          <button
            type="button"
            onClick={onRemove}
            className="text-red-500 hover:text-red-700 transition-colors"
          >
            <Trash2 className="size-5" />
          </button>
        )}
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-x-6 gap-y-4 mb-6">
        {/* Category */}
        <div>
          <Label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Category <span className="text-red-500">*</span>
          </Label>
          <Select value={selectedCategory} onValueChange={handleCategoryChange}>
            <SelectTrigger className="w-full rounded-xl border-slate-200 h-12 px-4 focus:ring-primary focus:border-primary font-medium bg-white">
              <SelectValue placeholder="Select category..." />
            </SelectTrigger>
            <SelectContent>
              {categories.map((cat) => (
                <SelectItem key={cat} value={cat}>
                  {CATEGORY_LABELS[cat] || cat}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Instrument Description */}
        <div>
          <Label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Instrument Description <span className="text-red-500">*</span>
          </Label>
          <Select
            value={selectedDescription}
            onValueChange={handleDescriptionChange}
            disabled={!selectedCategory}
          >
            <SelectTrigger className="w-full rounded-xl border-slate-200 h-12 px-4 focus:ring-primary focus:border-primary font-medium bg-white disabled:opacity-50">
              <SelectValue placeholder={selectedCategory ? "Select description..." : "Select category first"} />
            </SelectTrigger>
            <SelectContent>
              {descriptions.map((desc) => (
                <SelectItem key={desc} value={desc}>
                  {desc}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Make */}
        <div>
          <Label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Make
          </Label>
          <Select
            value={selectedMake || '__all__'}
            onValueChange={(value) => handleMakeChange(value === '__all__' ? '' : value)}
            disabled={!selectedDescription}
          >
            <SelectTrigger className="w-full rounded-xl border-slate-200 h-12 px-4 focus:ring-primary focus:border-primary font-medium bg-white disabled:opacity-50">
              <SelectValue placeholder={selectedDescription ? "All makes" : "Select description first"} />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="__all__">All Makes</SelectItem>
              {makes.map((make) => (
                <SelectItem key={make} value={make}>
                  {make}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        {/* Asset No / Instrument Selection */}
        <div>
          <Label className="block text-[11px] font-bold text-slate-500 uppercase tracking-wider mb-2">
            Select Instrument <span className="text-red-500">*</span>
          </Label>
          <Select
            value={instrument.assetNo}
            onValueChange={handleInstrumentSelect}
            disabled={!selectedDescription}
          >
            <SelectTrigger className="w-full rounded-xl border-slate-200 h-12 px-4 focus:ring-primary focus:border-primary font-medium bg-white disabled:opacity-50">
              <SelectValue placeholder={selectedDescription ? "Select instrument..." : "Select description first"} />
            </SelectTrigger>
            <SelectContent>
              {availableInstruments.map((inst) => (
                <SelectItem
                  key={inst.asset_no}
                  value={inst.asset_no}
                  disabled={inst.status === 'EXPIRED'}
                  className={cn(
                    inst.status === 'EXPIRED' && 'opacity-50 cursor-not-allowed'
                  )}
                >
                  <div className="flex items-center justify-between w-full gap-2">
                    <span>{inst.asset_no} - {getDisplayValue(inst.model)}</span>
                    {inst.status && inst.status !== 'VALID' && (
                      <StatusBadge status={inst.status} daysUntilExpiry={inst.daysUntilExpiry} />
                    )}
                  </div>
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>
      </div>

      {/* Selected Instrument Details */}
      {selectedInstrumentData && (
        <div className={cn(
          'rounded-xl p-5 border flex items-start gap-4',
          selectedInstrumentData.status === 'EXPIRING_SOON'
            ? 'bg-amber-50 border-amber-200'
            : 'bg-green-50 border-green-100'
        )}>
          {selectedInstrumentData.status === 'EXPIRING_SOON' ? (
            <AlertTriangle className="size-5 text-amber-600 mt-0.5 flex-shrink-0" />
          ) : (
            <CheckCircle className="size-5 text-green-600 mt-0.5 flex-shrink-0" />
          )}
          <div className="flex-1">
            <div className="flex items-center gap-2 mb-2">
              <p className={cn(
                'text-xs font-extrabold uppercase tracking-wider',
                selectedInstrumentData.status === 'EXPIRING_SOON' ? 'text-amber-700' : 'text-green-700'
              )}>
                Instrument Selected
              </p>
              {selectedInstrumentData.status && (
                <StatusBadge
                  status={selectedInstrumentData.status}
                  daysUntilExpiry={selectedInstrumentData.daysUntilExpiry}
                />
              )}
            </div>

            {selectedInstrumentData.status === 'EXPIRING_SOON' && (
              <p className="text-sm text-amber-800 font-semibold mb-2">
                Warning: This instrument expires in {selectedInstrumentData.daysUntilExpiry} days.
                Consider using a different instrument if the certificate due date extends beyond.
              </p>
            )}

            <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-sm">
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Asset No</p>
                <p className="font-semibold text-slate-800">{instrument.assetNo}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Serial No</p>
                <p className="font-semibold text-slate-800">{instrument.serialNumber}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Calibration Due</p>
                <p className="font-semibold text-slate-800">{instrument.calibrationDueDate}</p>
              </div>
              <div>
                <p className="text-[10px] font-bold text-slate-500 uppercase">Report No</p>
                <p className="font-semibold text-slate-800">{instrument.reportNo}</p>
              </div>
            </div>

            <div className="mt-3 pt-3 border-t border-slate-200/50">
              <p className="text-xs text-slate-500">
                <span className="font-semibold">Calibrated at:</span> {instrument.calibratedAt}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Parameter & SOP Assignment Subsection */}
      {selectedInstrumentData && parameters.length > 0 && (
        <div className="mt-4 rounded-xl border border-slate-200 bg-white overflow-hidden">
          <div className="bg-slate-100 px-4 py-3 border-b border-slate-200">
            <p className="text-xs font-extrabold text-slate-700 uppercase tracking-wider">
              Parameter & SOP Assignment <span className="text-red-500">*</span>
            </p>
            <p className="text-[11px] text-slate-500 mt-1">
              Select the parameter(s) calibrated using this instrument and specify the SOP reference for each.
            </p>
          </div>

          <div className="divide-y divide-slate-100">
            {parameters.map((param, paramIdx) => {
              const isAssigned = param.masterInstrumentId === instrument.masterInstrumentId
              const isAssignedToOther = param.masterInstrumentId !== null && param.masterInstrumentId !== instrument.masterInstrumentId

              // Check if this instrument supports this parameter type
              const isCompatible = param.parameterName
                ? canMeasureParameter(selectedInstrumentData, param.parameterName)
                : true // If no parameter name set, allow selection

              // Check if parameter range is within instrument's range
              const rangeMin = param.rangeMin ? parseFloat(param.rangeMin) : null
              const rangeMax = param.rangeMax ? parseFloat(param.rangeMax) : null
              const isRangeCovered = (rangeMin === null || rangeMax === null || !param.parameterName)
                ? true
                : coversRange(selectedInstrumentData, param.parameterName, rangeMin, rangeMax)

              const rangeStr = param.rangeMin && param.rangeMax
                ? `${param.rangeMin} to ${param.rangeMax} ${param.parameterUnit}`
                : param.parameterUnit || 'Range not set'

              // Determine disabled state and reason
              const isDisabled = isAssignedToOther || !isCompatible
              let statusMessage = ''
              if (isAssignedToOther) {
                statusMessage = 'Assigned to another instrument'
              } else if (!isCompatible) {
                statusMessage = 'Not supported by this instrument'
              }

              return (
                <div
                  key={param.id}
                  className={cn(
                    'px-4 py-3 flex items-center gap-4',
                    isDisabled && 'opacity-50 bg-slate-50'
                  )}
                >
                  {/* Checkbox */}
                  <input
                    type="checkbox"
                    checked={isAssigned}
                    disabled={isDisabled}
                    onChange={(e) => {
                      onParameterUpdate(paramIdx, {
                        ...param,
                        masterInstrumentId: e.target.checked ? instrument.masterInstrumentId : null,
                        sopReference: e.target.checked ? param.sopReference : '',
                      })
                    }}
                    className="size-4 rounded border-slate-300 text-primary focus:ring-primary disabled:cursor-not-allowed"
                  />

                  {/* Parameter Info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                      <p className="text-sm font-semibold text-slate-800 truncate">
                        {param.parameterName || `Parameter ${paramIdx + 1}`}
                      </p>
                      {!isCompatible && !isAssignedToOther && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-amber-100 text-amber-700">
                          <AlertTriangle className="size-3" />
                          Incompatible
                        </span>
                      )}
                      {isCompatible && !isRangeCovered && !isAssignedToOther && (
                        <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold uppercase bg-orange-100 text-orange-700">
                          <AlertTriangle className="size-3" />
                          Range Exceeds
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-slate-500 truncate">
                      {rangeStr}
                      {statusMessage && ` • ${statusMessage}`}
                      {!isRangeCovered && isCompatible && !isAssignedToOther && ' • Parameter range exceeds instrument capability'}
                    </p>
                  </div>

                  {/* SOP Reference Input */}
                  <div className="flex items-center gap-2 flex-shrink-0">
                    <Label className="text-[10px] font-bold text-slate-500 uppercase whitespace-nowrap hidden sm:block">
                      SOP Ref <span className="text-red-500">*</span>
                    </Label>
                    <Input
                      type="text"
                      value={param.sopReference || ''}
                      onChange={(e) => {
                        onParameterUpdate(paramIdx, {
                          ...param,
                          sopReference: e.target.value,
                        })
                      }}
                      disabled={!isAssigned}
                      placeholder="e.g., NLAB/CAL/T01/R01"
                      className="w-44 h-8 text-xs rounded-lg border-slate-200 focus:ring-primary focus:border-primary disabled:opacity-50 disabled:cursor-not-allowed"
                    />
                  </div>
                </div>
              )
            })}
          </div>

          {/* Warning for parameters needing another instrument */}
          {(() => {
            const incompatibleParams = parameters.filter(p =>
              p.parameterName &&
              !canMeasureParameter(selectedInstrumentData, p.parameterName) &&
              p.masterInstrumentId === null
            )
            if (incompatibleParams.length === 0) return null

            return (
              <div className="px-4 py-3 bg-amber-50 border-t border-amber-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="size-4 text-amber-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-amber-800">
                      Additional instrument required
                    </p>
                    <p className="text-[11px] text-amber-700 mt-0.5">
                      The following parameters are not supported by this instrument and need a different master instrument:{' '}
                      <span className="font-semibold">
                        {incompatibleParams.map(p => p.parameterName).join(', ')}
                      </span>
                    </p>
                  </div>
                </div>
              </div>
            )
          })()}

          {/* Warning for parameters with range exceeding instrument capability */}
          {(() => {
            const rangeExceededParams = parameters.filter(p => {
              if (!p.parameterName || !p.rangeMin || !p.rangeMax) return false
              if (!canMeasureParameter(selectedInstrumentData, p.parameterName)) return false // Already shown in incompatible warning
              const min = parseFloat(p.rangeMin)
              const max = parseFloat(p.rangeMax)
              if (isNaN(min) || isNaN(max)) return false
              return !coversRange(selectedInstrumentData, p.parameterName, min, max)
            })
            if (rangeExceededParams.length === 0) return null

            return (
              <div className="px-4 py-3 bg-orange-50 border-t border-orange-200">
                <div className="flex items-start gap-2">
                  <AlertTriangle className="size-4 text-orange-600 mt-0.5 flex-shrink-0" />
                  <div>
                    <p className="text-xs font-bold text-orange-800">
                      Parameter range exceeds instrument capability
                    </p>
                    <p className="text-[11px] text-orange-700 mt-0.5">
                      The following parameters have a range that exceeds this instrument's calibration range:{' '}
                      <span className="font-semibold">
                        {rangeExceededParams.map(p => p.parameterName).join(', ')}
                      </span>
                      . Consider using a different instrument or adjusting the parameter range.
                    </p>
                  </div>
                </div>
              </div>
            )
          })()}
        </div>
      )}
    </div>
  )
}

export function MasterInstrumentSection() {
  const { formData, addMasterInstrument, removeMasterInstrument, setMasterInstrument, setParameter } =
    useCertificateStore()
  const { isLoaded, loadInstruments, getStats } = useMasterInstrumentStore()

  // Load instruments on mount
  useEffect(() => {
    if (!isLoaded) {
      loadInstruments()
    }
  }, [isLoaded, loadInstruments])

  const stats = getStats()

  return (
    <FormSection
      id="master-inst"
      sectionNumber="Section 03"
      title="Master Instrument Details"
    >
      <div className="space-y-6">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
          <div>
            <p className="text-sm text-slate-500">
              Select the standard instrument(s) used for this calibration.
            </p>
            {isLoaded && (
              <p className="text-xs text-slate-400 mt-1">
                {stats.total} instruments available
                {stats.expired > 0 && (
                  <span className="text-red-500 ml-2">({stats.expired} expired)</span>
                )}
                {stats.expiringSoon > 0 && (
                  <span className="text-amber-500 ml-2">({stats.expiringSoon} expiring soon)</span>
                )}
              </p>
            )}
          </div>
          <button
            type="button"
            onClick={addMasterInstrument}
            className="bg-white border border-primary text-primary text-xs font-bold px-4 py-2 rounded-lg flex items-center gap-1.5 hover:bg-primary/5 transition-all w-fit self-end sm:self-auto shadow-sm"
          >
            <Plus className="size-4" />
            Add Master Instrument
          </button>
        </div>

        <div className="space-y-6">
          {formData.masterInstruments.map((instrument, index) => (
            <MasterInstrumentCard
              key={instrument.id}
              instrument={instrument}
              index={index}
              onUpdate={(inst) => setMasterInstrument(index, inst)}
              onRemove={() => removeMasterInstrument(index)}
              canRemove={formData.masterInstruments.length > 1}
              parameters={formData.parameters}
              onParameterUpdate={setParameter}
            />
          ))}
        </div>
      </div>
    </FormSection>
  )
}
