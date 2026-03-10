'use client'

import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Badge } from '@/components/ui/badge'
import {
  ChevronLeft,
  Clock,
  User,
  Building2,
  MapPin,
  Eye,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import type { HeaderData } from './AdminCertificateClient'

interface AdminCertificateHeaderProps {
  headerData: HeaderData
  viewMode: 'details' | 'pdf'
  onViewModeChange: (mode: 'details' | 'pdf') => void
}

function formatTAT(hours: number): string {
  if (hours < 24) {
    return `${hours}h`
  }
  const days = Math.floor(hours / 24)
  const remainingHours = hours % 24
  if (remainingHours === 0) {
    return `${days}d`
  }
  return `${days}d ${remainingHours}h`
}

export function AdminCertificateHeader({
  headerData,
  viewMode,
  onViewModeChange,
}: AdminCertificateHeaderProps) {
  return (
    <div className="flex-shrink-0 border-b border-slate-200 px-6 py-4">
      {/* Header Content */}
      <div className="flex flex-col lg:flex-row lg:items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/admin/certificates"
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
          {/* TAT Badge */}
          <div
            className={cn(
              'flex items-center gap-2 px-3 py-2 rounded-lg text-sm font-semibold',
              headerData.tat.status === 'ok' && 'bg-green-50 text-green-700 border border-green-200',
              headerData.tat.status === 'warning' && 'bg-amber-50 text-amber-700 border border-amber-200',
              headerData.tat.status === 'overdue' && 'bg-red-50 text-red-700 border border-red-200'
            )}
          >
            <Clock className="size-4" />
            <span>TAT: {formatTAT(headerData.tat.hours)}</span>
            {headerData.tat.status === 'overdue' && <span className="text-[10px] uppercase">Overdue</span>}
          </div>
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
            <User className="size-3 text-slate-500" />
          </div>
          <span className="font-medium text-slate-700">{headerData.assigneeName}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <div className="p-1 rounded bg-slate-100">
            <Building2 className="size-3 text-slate-500" />
          </div>
          <span>{headerData.customerName}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-600">
          <div className="p-1 rounded bg-slate-100">
            <MapPin className="size-3 text-slate-500" />
          </div>
          <span>{headerData.calibratedAt === 'LAB' ? 'Laboratory' : 'Site'}</span>
        </div>
        <div className="flex items-center gap-2 text-slate-500">
          <span className="text-slate-300">|</span>
          <span>Revision {headerData.currentRevision}</span>
        </div>
      </div>
    </div>
  )
}
