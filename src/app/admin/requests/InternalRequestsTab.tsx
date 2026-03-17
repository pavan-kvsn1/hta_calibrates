'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { Badge } from '@/components/ui/badge'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Loader2,
  Unlock,
  Eye,
  ChevronLeft,
  ChevronRight,
  Inbox,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { formatDistanceToNow } from 'date-fns'

interface InternalRequest {
  id: string
  type: 'SECTION_UNLOCK'
  status: 'PENDING' | 'APPROVED' | 'REJECTED'
  data: { sections: string[]; reason: string }
  certificate: { id: string; certificateNumber: string; status: string } | null
  requestedBy: { id: string; name: string; email: string }
  reviewedBy: { id: string; name: string } | null
  reviewedAt: string | null
  adminNote: string | null
  createdAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

interface Counts {
  pending: number
  approved: number
  rejected: number
}

// Section label mapping
const SECTION_LABELS: Record<string, string> = {
  'summary': 'Summary',
  'uuc-details': 'UUC Details',
  'master-inst': 'Master Instruments',
  'environment': 'Environmental',
  'results': 'Results',
  'remarks': 'Remarks',
  'conclusion': 'Conclusion',
}

export function InternalRequestsTab() {
  const router = useRouter()
  const [requests, setRequests] = useState<InternalRequest[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [counts, setCounts] = useState<Counts>({ pending: 0, approved: 0, rejected: 0 })
  const [loading, setLoading] = useState(true)
  const [statusFilter, setStatusFilter] = useState('PENDING')
  const [typeFilter, setTypeFilter] = useState('ALL')
  const [page, setPage] = useState(1)

  const fetchRequests = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      params.set('status', statusFilter)
      if (typeFilter !== 'ALL') params.set('type', typeFilter)
      params.set('page', page.toString())
      params.set('limit', '15')

      const res = await fetch(`/api/admin/internal-requests?${params}`)
      if (res.ok) {
        const data = await res.json()
        setRequests(data.requests)
        setPagination(data.pagination)
        setCounts(data.counts)
      }
    } catch (error) {
      console.error('Failed to fetch requests:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchRequests()
  }, [statusFilter, typeFilter, page])

  const getTypeBadge = (type: string) => {
    switch (type) {
      case 'SECTION_UNLOCK':
        return (
          <Badge className="bg-indigo-100 text-indigo-700">
            <Unlock className="h-3 w-3 mr-1" />
            Sect Unlock
          </Badge>
        )
      default:
        return <Badge>{type}</Badge>
    }
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING':
        return <Badge className="bg-amber-100 text-amber-700">Pending</Badge>
      case 'APPROVED':
        return <Badge className="bg-green-100 text-green-700">Approved</Badge>
      case 'REJECTED':
        return <Badge className="bg-red-100 text-red-700">Rejected</Badge>
      default:
        return <Badge>{status}</Badge>
    }
  }

  const getSectionLabels = (sections: string[]) => {
    return sections.map(s => SECTION_LABELS[s] || s).join(', ')
  }

  return (
    <>
      {/* Status Tabs */}
      <div className="flex gap-2 mb-6 border-b">
        <button
          onClick={() => { setStatusFilter('PENDING'); setPage(1) }}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
            statusFilter === 'PENDING'
              ? 'border-amber-500 text-amber-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          )}
        >
          Pending ({counts.pending})
        </button>
        <button
          onClick={() => { setStatusFilter('APPROVED'); setPage(1) }}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
            statusFilter === 'APPROVED'
              ? 'border-green-500 text-green-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          )}
        >
          Approved ({counts.approved})
        </button>
        <button
          onClick={() => { setStatusFilter('REJECTED'); setPage(1) }}
          className={cn(
            'px-4 py-2 text-sm font-medium border-b-2 -mb-px',
            statusFilter === 'REJECTED'
              ? 'border-red-500 text-red-600'
              : 'border-transparent text-slate-500 hover:text-slate-700'
          )}
        >
          Rejected ({counts.rejected})
        </button>
      </div>

      {/* Filters */}
      <div className="flex gap-4 mb-6">
        <Select value={typeFilter} onValueChange={(v) => { setTypeFilter(v); setPage(1) }}>
          <SelectTrigger className="w-[180px]">
            <SelectValue placeholder="All Types" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="ALL">All Types</SelectItem>
            <SelectItem value="SECTION_UNLOCK">Section Unlock</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        ) : requests.length === 0 ? (
          <div className="text-center py-12 text-slate-500">
            <Inbox className="h-12 w-12 mx-auto mb-3 text-slate-300" />
            <p>No {statusFilter.toLowerCase()} requests found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Certificate</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Details</TableHead>
                <TableHead>Requested</TableHead>
                {statusFilter !== 'PENDING' && <TableHead>Status</TableHead>}
                <TableHead className="w-[80px]">Action</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {requests.map((request) => (
                <TableRow key={request.id}>
                  <TableCell>
                    <div>
                      <span className="font-medium">{request.certificate?.certificateNumber || '-'}</span>
                      <p className="text-xs text-slate-500">by {request.requestedBy.name}</p>
                    </div>
                  </TableCell>
                  <TableCell>{getTypeBadge(request.type)}</TableCell>
                  <TableCell>
                    <span className="text-sm">
                      {getSectionLabels(request.data.sections)}
                    </span>
                  </TableCell>
                  <TableCell className="text-slate-500 text-sm">
                    {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                  </TableCell>
                  {statusFilter !== 'PENDING' && (
                    <TableCell>{getStatusBadge(request.status)}</TableCell>
                  )}
                  <TableCell>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => router.push(`/admin/requests/${request.id}?type=internal`)}
                    >
                      <Eye className="h-4 w-4" />
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-slate-500">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} requests
            </p>
            <div className="flex gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={page === 1}
                onClick={() => setPage((p) => p - 1)}
              >
                <ChevronLeft className="h-4 w-4" />
              </Button>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= pagination.totalPages}
                onClick={() => setPage((p) => p + 1)}
              >
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </div>
        )}
      </div>
    </>
  )
}
