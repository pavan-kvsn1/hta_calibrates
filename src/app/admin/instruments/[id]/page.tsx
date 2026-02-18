'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

interface RangeDataItem {
  parameter?: string
  min?: string
  max?: string
  unit?: string
  uncertainty?: string
  referencedoc?: string
}

interface Instrument {
  id: string
  instrumentId: string
  version: number
  category: string
  description: string
  make: string
  model: string
  assetNumber: string
  serialNumber: string
  usage: string | null
  calibratedAtLocation: string | null
  reportNo: string | null
  calibrationDueDate: string | null
  remarks: string | null
  isActive: boolean
  status: string
  daysUntilExpiry: number
  rangeData: RangeDataItem[]
  createdBy: { id: string; name: string; email: string } | null
  createdAt: string
  changeReason: string | null
}

interface InstrumentFormData {
  category: string
  description: string
  make: string
  model: string
  assetNumber: string
  serialNumber: string
  usage: string
  calibratedAtLocation: string
  reportNo: string
  calibrationDueDate: string
  remarks: string
  status: string
  isActive: boolean
  rangeData: RangeDataItem[]
  changeReason: string
}

const CATEGORIES = [
  'DIMENSIONAL',
  'ELECTRICAL',
  'TEMPERATURE',
  'PRESSURE',
  'MASS',
  'FORCE',
  'FLOW',
  'TIME',
  'OPTICAL',
  'CHEMICAL',
  'OTHER',
]

const STATUS_OPTIONS = [
  { value: '', label: 'Active' },
  { value: 'UNDER_RECAL', label: 'Under Recalibration' },
]

function getStatusBadge(status: string) {
  const styles: Record<string, string> = {
    VALID: 'bg-green-100 text-green-700',
    EXPIRING_SOON: 'bg-yellow-100 text-yellow-700',
    EXPIRED: 'bg-red-100 text-red-700',
    UNDER_RECAL: 'bg-blue-100 text-blue-700',
  }
  const labels: Record<string, string> = {
    VALID: 'Valid',
    EXPIRING_SOON: 'Expiring Soon',
    EXPIRED: 'Expired',
    UNDER_RECAL: 'Under Recal',
  }
  return (
    <span className={`px-2 py-1 text-xs font-medium rounded-full ${styles[status] || 'bg-gray-100 text-gray-700'}`}>
      {labels[status] || status}
    </span>
  )
}

export default function EditInstrumentPage({ params }: { params: Promise<{ id: string }> }) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [deleting, setDeleting] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [instrument, setInstrument] = useState<Instrument | null>(null)
  const [isEditing, setIsEditing] = useState(false)
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false)

  const [formData, setFormData] = useState<InstrumentFormData>({
    category: '',
    description: '',
    make: '',
    model: '',
    assetNumber: '',
    serialNumber: '',
    usage: '',
    calibratedAtLocation: '',
    reportNo: '',
    calibrationDueDate: '',
    remarks: '',
    status: '',
    isActive: true,
    rangeData: [],
    changeReason: '',
  })

  useEffect(() => {
    fetchInstrument()
  }, [id])

  const fetchInstrument = async () => {
    try {
      const response = await fetch(`/api/admin/instruments/${id}`)
      if (!response.ok) {
        if (response.status === 404) {
          throw new Error('Instrument not found')
        }
        throw new Error('Failed to fetch instrument')
      }
      const data = await response.json()
      setInstrument(data)
      // Get the raw status from the instrument (null means auto-compute)
      // The API returns status which is the computed/override value, but we need the raw DB value
      const rawStatus = STATUS_OPTIONS.find(opt => opt.value === data.status && opt.value !== '')
        ? data.status
        : ''

      setFormData({
        category: data.category || '',
        description: data.description || '',
        make: data.make || '',
        model: data.model || '',
        assetNumber: data.assetNumber || '',
        serialNumber: data.serialNumber || '',
        usage: data.usage || '',
        calibratedAtLocation: data.calibratedAtLocation || '',
        reportNo: data.reportNo || '',
        calibrationDueDate: data.calibrationDueDate
          ? new Date(data.calibrationDueDate).toISOString().split('T')[0]
          : '',
        remarks: data.remarks || '',
        status: rawStatus,
        isActive: data.isActive,
        rangeData: data.rangeData || [],
        changeReason: '',
      })
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setLoading(false)
    }
  }

  const handleChange = (
    e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement | HTMLSelectElement>
  ) => {
    const { name, value, type } = e.target
    if (type === 'checkbox') {
      const checked = (e.target as HTMLInputElement).checked
      setFormData(prev => ({ ...prev, [name]: checked }))
    } else {
      setFormData(prev => ({ ...prev, [name]: value }))
    }
  }

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError(null)
    setSaving(true)

    try {
      const response = await fetch(`/api/admin/instruments/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...formData,
          calibrationDueDate: formData.calibrationDueDate || null,
        }),
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to update instrument')
      }

      setIsEditing(false)
      await fetchInstrument()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setSaving(false)
    }
  }

  const handleDelete = async () => {
    setDeleting(true)
    setError(null)

    try {
      const response = await fetch(`/api/admin/instruments/${id}`, {
        method: 'DELETE',
      })

      const data = await response.json()

      if (!response.ok) {
        throw new Error(data.error || 'Failed to delete instrument')
      }

      router.push('/admin/instruments')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
      setShowDeleteConfirm(false)
    } finally {
      setDeleting(false)
    }
  }

  const handleCancel = () => {
    if (instrument) {
      const rawStatus = STATUS_OPTIONS.find(opt => opt.value === instrument.status && opt.value !== '')
        ? instrument.status
        : ''

      setFormData({
        category: instrument.category || '',
        description: instrument.description || '',
        make: instrument.make || '',
        model: instrument.model || '',
        assetNumber: instrument.assetNumber || '',
        serialNumber: instrument.serialNumber || '',
        usage: instrument.usage || '',
        calibratedAtLocation: instrument.calibratedAtLocation || '',
        reportNo: instrument.reportNo || '',
        calibrationDueDate: instrument.calibrationDueDate
          ? new Date(instrument.calibrationDueDate).toISOString().split('T')[0]
          : '',
        remarks: instrument.remarks || '',
        status: rawStatus,
        isActive: instrument.isActive,
        rangeData: instrument.rangeData || [],
        changeReason: '',
      })
    }
    setIsEditing(false)
    setError(null)
  }

  // Range data handlers
  const addRangeItem = () => {
    setFormData(prev => ({
      ...prev,
      rangeData: [...prev.rangeData, { parameter: '', min: '', max: '', unit: '', uncertainty: '', referencedoc: '' }],
    }))
  }

  const updateRangeItem = (index: number, field: keyof RangeDataItem, value: string) => {
    setFormData(prev => ({
      ...prev,
      rangeData: prev.rangeData.map((item, i) =>
        i === index ? { ...item, [field]: value } : item
      ),
    }))
  }

  const removeRangeItem = (index: number) => {
    setFormData(prev => ({
      ...prev,
      rangeData: prev.rangeData.filter((_, i) => i !== index),
    }))
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-600"></div>
      </div>
    )
  }

  if (!instrument) {
    return (
      <div className="space-y-6">
        <div className="flex items-center gap-4">
          <Link
            href="/admin/instruments"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <h1 className="text-2xl font-bold text-gray-900">Instrument Not Found</h1>
        </div>
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error || 'The requested instrument could not be found.'}
        </div>
      </div>
    )
  }

  return (
    <div className="p-8 space-y-8">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/instruments"
            className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15 19l-7-7 7-7" />
            </svg>
          </Link>
          <div>
            <div className="flex items-center gap-3">
              <h1 className="text-2xl font-bold text-gray-900">{instrument.description}</h1>
              {getStatusBadge(instrument.status)}
              {!instrument.isActive && (
                <span className="px-2 py-1 text-xs font-medium rounded-full bg-gray-100 text-gray-600">
                  Inactive
                </span>
              )}
            </div>
            <p className="text-sm text-gray-600 mt-1 ">
              Asset: {instrument.assetNumber} | Category: {instrument.category}
            </p>
          </div>
        </div>

        {!isEditing && (
          <div className="flex items-center gap-2">
            <button
              onClick={() => setIsEditing(true)}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              Edit
            </button>
            <button
              onClick={() => setShowDeleteConfirm(true)}
              className="px-4 py-2 text-red-600 bg-red-50 rounded-lg hover:bg-red-100 transition-colors"
            >
              Deactivate
            </button>
          </div>
        )}
      </div>

      {/* Error Message */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4 text-red-700">
          {error}
        </div>
      )}

      {/* Delete Confirmation Modal */}
      {showDeleteConfirm && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50">
          <div className="bg-white rounded-lg shadow-xl p-6 max-w-md w-full mx-4">
            <h3 className="text-lg font-semibold text-gray-900 mb-2">Deactivate Instrument?</h3>
            <p className="text-gray-600 mb-4">
              This will mark the instrument as inactive. It will no longer appear in the active
              instruments list but can be restored later.
            </p>
            <div className="flex justify-end gap-3">
              <button
                onClick={() => setShowDeleteConfirm(false)}
                className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handleDelete}
                disabled={deleting}
                className="px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 disabled:opacity-50"
              >
                {deleting ? 'Deactivating...' : 'Deactivate'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Form / View */}
      <form onSubmit={handleSubmit} className="bg-white rounded-lg border shadow-sm">
        <div className="p-6 space-y-6">
          {/* Basic Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Basic Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="category" className="block text-sm font-medium text-gray-700 mb-1">
                  Category <span className="text-red-500">*</span>
                </label>
                {isEditing ? (
                  <select
                    id="category"
                    name="category"
                    value={formData.category}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  >
                    <option value="">Select category</option>
                    {CATEGORIES.map(cat => (
                      <option key={cat} value={cat}>{cat}</option>
                    ))}
                  </select>
                ) : (
                  <p className="text-gray-900 py-2">{formData.category}</p>
                )}
              </div>

              <div>
                <label htmlFor="assetNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Asset Number <span className="text-red-500">*</span>
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    id="assetNumber"
                    name="assetNumber"
                    value={formData.assetNumber}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900 py-2">{formData.assetNumber}</p>
                )}
              </div>

              <div className="md:col-span-2">
                <label htmlFor="description" className="block text-sm font-medium text-gray-700 mb-1">
                  Description <span className="text-red-500">*</span>
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    id="description"
                    name="description"
                    value={formData.description}
                    onChange={handleChange}
                    required
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900 py-2">{formData.description}</p>
                )}
              </div>
            </div>
          </div>

          {/* Equipment Details */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Equipment Details</h2>
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <label htmlFor="make" className="block text-sm font-medium text-gray-700 mb-1">
                  Make
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    id="make"
                    name="make"
                    value={formData.make}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900 py-2">{formData.make || '-'}</p>
                )}
              </div>

              <div>
                <label htmlFor="model" className="block text-sm font-medium text-gray-700 mb-1">
                  Model
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    id="model"
                    name="model"
                    value={formData.model}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900 py-2">{formData.model || '-'}</p>
                )}
              </div>

              <div>
                <label htmlFor="serialNumber" className="block text-sm font-medium text-gray-700 mb-1">
                  Serial Number
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    id="serialNumber"
                    name="serialNumber"
                    value={formData.serialNumber}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900 py-2">{formData.serialNumber || '-'}</p>
                )}
              </div>
            </div>
          </div>

          {/* Calibration Information */}
          <div>
            <h2 className="text-lg font-semibold text-gray-900 mb-4">Calibration Information</h2>
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              <div>
                <label htmlFor="usage" className="block text-sm font-medium text-gray-700 mb-1">
                  Usage
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    id="usage"
                    name="usage"
                    value={formData.usage}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900 py-2">{formData.usage || '-'}</p>
                )}
              </div>

              <div>
                <label htmlFor="calibratedAtLocation" className="block text-sm font-medium text-gray-700 mb-1">
                  Calibrated At
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    id="calibratedAtLocation"
                    name="calibratedAtLocation"
                    value={formData.calibratedAtLocation}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900 py-2">{formData.calibratedAtLocation || '-'}</p>
                )}
              </div>

              <div>
                <label htmlFor="reportNo" className="block text-sm font-medium text-gray-700 mb-1">
                  Report Number
                </label>
                {isEditing ? (
                  <input
                    type="text"
                    id="reportNo"
                    name="reportNo"
                    value={formData.reportNo}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900 py-2">{formData.reportNo || '-'}</p>
                )}
              </div>

              <div>
                <label htmlFor="calibrationDueDate" className="block text-sm font-medium text-gray-700 mb-1">
                  Calibration Due Date
                </label>
                {isEditing ? (
                  <input
                    type="date"
                    id="calibrationDueDate"
                    name="calibrationDueDate"
                    value={formData.calibrationDueDate}
                    onChange={handleChange}
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                  />
                ) : (
                  <p className="text-gray-900 py-2">
                    {formData.calibrationDueDate
                      ? new Date(formData.calibrationDueDate).toLocaleDateString()
                      : '-'}
                  </p>
                )}
              </div>
            </div>
          </div>

          {/* Status */}
          {isEditing && (
            <div>
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Status</h2>
              <div>
                <label htmlFor="status" className="block text-sm font-medium text-gray-700 mb-1">
                  Instrument Status
                </label>
                <select
                  id="status"
                  name="status"
                  value={formData.status}
                  onChange={handleChange}
                  className="w-full max-w-xs px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                >
                  {STATUS_OPTIONS.map(opt => (
                    <option key={opt.value} value={opt.value}>{opt.label}</option>
                  ))}
                </select>
                <p className="text-xs text-gray-500 mt-1">
                  &quot;Active&quot; status is computed from calibration due date (Valid, Expiring, Expired)
                </p>
              </div>
            </div>
          )}

          {/* Remarks */}
          <div>
            <label htmlFor="remarks" className="block text-sm font-medium text-gray-700 mb-1">
              Remarks
            </label>
            {isEditing ? (
              <textarea
                id="remarks"
                name="remarks"
                value={formData.remarks}
                onChange={handleChange}
                rows={3}
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
            ) : (
              <p className="text-gray-900 py-2">{formData.remarks || '-'}</p>
            )}
          </div>

          {/* Metadata (view only) */}
          {!isEditing && (
            <div className="pt-4 border-t">
              <h2 className="text-lg font-semibold text-gray-900 mb-4">Record Information</h2>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-4 text-sm">
                <div>
                  <span className="text-gray-500">Version:</span>{' '}
                  <span className="text-gray-900">v{instrument.version}</span>
                </div>
                <div>
                  <span className="text-gray-500">Last Updated:</span>{' '}
                  <span className="text-gray-900">
                    {new Date(instrument.createdAt).toLocaleString()}
                  </span>
                </div>
                {instrument.createdBy && (
                  <div>
                    <span className="text-gray-500">Modified By:</span>{' '}
                    <span className="text-gray-900">{instrument.createdBy.name}</span>
                  </div>
                )}
                {instrument.changeReason && (
                  <div>
                    <span className="text-gray-500">Change Reason:</span>{' '}
                    <span className="text-gray-900">{instrument.changeReason}</span>
                  </div>
                )}
                {instrument.daysUntilExpiry !== 999 && (
                  <div>
                    <span className="text-gray-500">Days Until Expiry:</span>{' '}
                    <span className={`font-medium ${
                      instrument.daysUntilExpiry < 0 ? 'text-red-600' :
                      instrument.daysUntilExpiry <= 30 ? 'text-yellow-600' : 'text-green-600'
                    }`}>
                      {instrument.daysUntilExpiry < 0
                        ? `${Math.abs(instrument.daysUntilExpiry)} days overdue`
                        : `${instrument.daysUntilExpiry} days`}
                    </span>
                  </div>
                )}
              </div>
            </div>
          )}

          {/* Range Data */}
          <div className="pt-4 border-t">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-semibold text-gray-900">Range Data</h2>
              {isEditing && (
                <button
                  type="button"
                  onClick={addRangeItem}
                  className="px-3 py-1 text-sm bg-blue-50 text-blue-600 rounded-lg hover:bg-blue-100 transition-colors"
                >
                  + Add Range
                </button>
              )}
            </div>

            {isEditing ? (
              /* Edit Mode */
              <div className="space-y-4">
                {formData.rangeData.length === 0 ? (
                  <p className="text-gray-500 text-sm">No range data. Click &quot;Add Range&quot; to add parameters.</p>
                ) : (
                  formData.rangeData.map((range, idx) => (
                    <div key={idx} className="p-4 bg-gray-50 rounded-lg border space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm font-medium text-gray-700">Range {idx + 1}</span>
                        <button
                          type="button"
                          onClick={() => removeRangeItem(idx)}
                          className="text-red-500 hover:text-red-700 text-sm"
                        >
                          Remove
                        </button>
                      </div>
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Parameter</label>
                          <input
                            type="text"
                            value={range.parameter || ''}
                            onChange={(e) => updateRangeItem(idx, 'parameter', e.target.value)}
                            placeholder="e.g., Temperature"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Min</label>
                          <input
                            type="text"
                            value={range.min || ''}
                            onChange={(e) => updateRangeItem(idx, 'min', e.target.value)}
                            placeholder="e.g., 0"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Max</label>
                          <input
                            type="text"
                            value={range.max || ''}
                            onChange={(e) => updateRangeItem(idx, 'max', e.target.value)}
                            placeholder="e.g., 100"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Unit</label>
                          <input
                            type="text"
                            value={range.unit || ''}
                            onChange={(e) => updateRangeItem(idx, 'unit', e.target.value)}
                            placeholder="e.g., °C"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Uncertainty</label>
                          <input
                            type="text"
                            value={range.uncertainty || ''}
                            onChange={(e) => updateRangeItem(idx, 'uncertainty', e.target.value)}
                            placeholder="e.g., ±0.5"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-gray-600 mb-1">Reference Doc</label>
                          <input
                            type="text"
                            value={range.referencedoc || ''}
                            onChange={(e) => updateRangeItem(idx, 'referencedoc', e.target.value)}
                            placeholder="e.g., ISO 12345"
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                          />
                        </div>
                      </div>
                    </div>
                  ))
                )}
              </div>
            ) : (
              /* View Mode */
              instrument.rangeData && instrument.rangeData.length > 0 ? (
                <div className="overflow-x-auto">
                  <table className="min-w-full divide-y divide-gray-200">
                    <thead className="bg-gray-50">
                      <tr>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Parameter
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Min
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Max
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Unit
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Uncertainty
                        </th>
                        <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase">
                          Reference
                        </th>
                      </tr>
                    </thead>
                    <tbody className="bg-white divide-y divide-gray-200">
                      {instrument.rangeData.map((range, idx) => (
                        <tr key={idx}>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {range.parameter || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {range.min || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {range.max || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {range.unit || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {range.uncertainty || '-'}
                          </td>
                          <td className="px-4 py-2 text-sm text-gray-900">
                            {range.referencedoc || '-'}
                          </td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              ) : (
                <p className="text-gray-500 text-sm">No range data available.</p>
              )
            )}
          </div>

          {/* Change Reason (only when editing) */}
          {isEditing && (
            <div className="pt-4 border-t">
              <label htmlFor="changeReason" className="block text-sm font-medium text-gray-700 mb-1">
                Reason for Change
              </label>
              <input
                type="text"
                id="changeReason"
                name="changeReason"
                value={formData.changeReason}
                onChange={handleChange}
                placeholder="e.g., Updated calibration data, Corrected range values"
                className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <p className="text-xs text-gray-500 mt-1">This will be recorded in the version history.</p>
            </div>
          )}
        </div>

        {/* Actions */}
        {isEditing && (
          <div className="px-6 py-4 bg-gray-50 border-t flex justify-end gap-3 rounded-b-lg">
            <button
              type="button"
              onClick={handleCancel}
              className="px-4 py-2 text-gray-700 bg-white border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              Cancel
            </button>
            <button
              type="submit"
              disabled={saving}
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
            >
              {saving ? 'Saving...' : 'Save Changes'}
            </button>
          </div>
        )}
      </form>
    </div>
  )
}
