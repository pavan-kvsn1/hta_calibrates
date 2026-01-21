'use client'

import { useState } from 'react'
import Link from 'next/link'
import { StatusBadge } from './StatusBadge'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Input } from '@/components/ui/input'
import { Eye, Edit, FileText, Search } from 'lucide-react'

export interface CertificateListItem {
  id: string
  certificateNumber: string
  status: string
  customerName: string
  uucDescription: string
  dateOfCalibration: string
  currentVersion: number
  createdAt: string
}

interface CertificateTableProps {
  certificates: CertificateListItem[]
  userRole: 'ENGINEER' | 'HOD' | 'ADMIN'
  showActions?: boolean
}

const statusFilters = [
  { value: 'all', label: 'All Status' },
  { value: 'DRAFT', label: 'Draft' },
  { value: 'PENDING_HOD_REVIEW', label: 'Pending HoD Review' },
  { value: 'REVISION_REQUIRED', label: 'Revision Required' },
  { value: 'PENDING_CUSTOMER_APPROVAL', label: 'Pending Customer' },
  { value: 'APPROVED', label: 'Approved' },
  { value: 'REJECTED', label: 'Rejected' },
]

export function CertificateTable({
  certificates,
  userRole,
  showActions = true,
}: CertificateTableProps) {
  const [statusFilter, setStatusFilter] = useState('all')
  const [searchQuery, setSearchQuery] = useState('')

  const filteredCertificates = certificates.filter((cert) => {
    const matchesStatus =
      statusFilter === 'all' || cert.status === statusFilter
    const matchesSearch =
      searchQuery === '' ||
      cert.certificateNumber.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cert.customerName.toLowerCase().includes(searchQuery.toLowerCase()) ||
      cert.uucDescription.toLowerCase().includes(searchQuery.toLowerCase())
    return matchesStatus && matchesSearch
  })

  const formatDate = (dateStr: string) => {
    const date = new Date(dateStr)
    return date.toLocaleDateString('en-GB', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
    })
  }

  return (
    <div className="space-y-4">
      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-4">
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by certificate no., customer, or instrument..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={statusFilter} onValueChange={setStatusFilter}>
          <SelectTrigger className="w-full sm:w-[200px]">
            <SelectValue placeholder="Filter by status" />
          </SelectTrigger>
          <SelectContent>
            {statusFilters.map((filter) => (
              <SelectItem key={filter.value} value={filter.value}>
                {filter.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b">
              <tr>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Certificate No.
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Customer
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Instrument
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Cal. Date
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Status
                </th>
                <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Version
                </th>
                {showActions && (
                  <th className="px-4 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Actions
                  </th>
                )}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-200">
              {filteredCertificates.length === 0 ? (
                <tr>
                  <td
                    colSpan={showActions ? 7 : 6}
                    className="px-4 py-8 text-center text-gray-500"
                  >
                    No certificates found
                  </td>
                </tr>
              ) : (
                filteredCertificates.map((cert) => (
                  <tr key={cert.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="font-medium text-gray-900">
                        {cert.certificateNumber}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-700">{cert.customerName}</span>
                    </td>
                    <td className="px-4 py-3">
                      <span className="text-gray-700 line-clamp-1">
                        {cert.uucDescription}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-gray-600">
                        {formatDate(cert.dateOfCalibration)}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <StatusBadge status={cert.status} />
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className="text-gray-600">v{cert.currentVersion}</span>
                    </td>
                    {showActions && (
                      <td className="px-4 py-3 whitespace-nowrap text-right">
                        <div className="flex justify-end gap-2">
                          <Link href={`/certificates/${cert.id}`}>
                            <Button variant="ghost" size="sm" title="View">
                              <Eye className="h-4 w-4" />
                            </Button>
                          </Link>
                          {userRole === 'ENGINEER' &&
                            (cert.status === 'DRAFT' ||
                              cert.status === 'REVISION_REQUIRED') && (
                              <Link href={`/certificates/${cert.id}/edit`}>
                                <Button variant="ghost" size="sm" title="Edit">
                                  <Edit className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                          {userRole === 'HOD' &&
                            cert.status === 'PENDING_HOD_REVIEW' && (
                              <Link href={`/hod/review/${cert.id}`}>
                                <Button variant="ghost" size="sm" title="Review">
                                  <FileText className="h-4 w-4" />
                                </Button>
                              </Link>
                            )}
                        </div>
                      </td>
                    )}
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Results count */}
      <div className="text-sm text-gray-500">
        Showing {filteredCertificates.length} of {certificates.length} certificates
      </div>
    </div>
  )
}
