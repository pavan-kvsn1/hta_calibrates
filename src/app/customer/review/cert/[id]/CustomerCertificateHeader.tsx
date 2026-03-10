'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import { ChevronLeft, Building2, Calendar, Eye, FileText } from 'lucide-react'
import { cn } from '@/lib/utils'

interface HeaderData {
  certificateNumber: string
  status: string
  statusLabel: string
  statusClassName: string
  customerName: string
  currentRevision: number
  dateOfCalibration: string | null
}

interface CustomerCertificateHeaderProps {
  headerData: HeaderData
  viewMode: 'details' | 'pdf'
  onViewModeChange: (mode: 'details' | 'pdf') => void
}

function formatDate(dateString: string | null): string {
  if (!dateString) return '-'
  const date = new Date(dateString)
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: 'short',
    year: 'numeric',
  })
}

export function CustomerCertificateHeader({
  headerData,
  viewMode,
  onViewModeChange,
}: CustomerCertificateHeaderProps) {
  return (
    <div className="flex-shrink-0 border-b border-slate-200 px-6 py-4">
      {/* Header Content */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/customer/dashboard"
            className="text-slate-400 hover:text-slate-600 transition-colors"
          >
            <ChevronLeft className="size-6" strokeWidth={2} />
          </Link>
          <span className="text-slate-300 text-xl">|</span>
          <h1 className="text-xl font-bold text-slate-900 tracking-tight">
            {headerData.certificateNumber}
          </h1>
          <Badge
            variant="outline"
            className={cn(
              'px-2.5 py-0.5 text-[10px] font-bold uppercase tracking-wider',
              headerData.statusClassName
            )}
          >
            {headerData.statusLabel}
          </Badge>
        </div>

        <div className="flex items-center gap-3">
          {/* View Toggle Button */}
          <Button
            variant="outline"
            size="sm"
            onClick={() => onViewModeChange(viewMode === 'details' ? 'pdf' : 'details')}
            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-white border border-gray-200 text-gray-700"
          >
            {viewMode === 'details' ? (
              <>
                <Eye className="h-4 w-4" />
                Preview PDF
              </>
            ) : (
              <>
                <FileText className="h-4 w-4" />
                View Details
              </>
            )}
          </Button>
        </div>
      </div>

      {/* Meta Info Row */}
      <div className="flex flex-wrap items-center gap-x-5 gap-y-1.5 text-sm mt-3">
        <div className="flex items-center gap-2 text-slate-600">
          <div className="p-1 rounded bg-slate-100">
            <Building2 className="size-3 text-slate-500" />
          </div>
          <span className="font-medium text-slate-700">{headerData.customerName || '-'}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <div className="p-1 rounded bg-slate-100">
            <Calendar className="size-3 text-slate-500" />
          </div>
          <span>Calibrated: {formatDate(headerData.dateOfCalibration)}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <span className="text-slate-300">|</span>
          <span>Revision {headerData.currentRevision}</span>
        </div>
      </div>
    </div>
  )
}
