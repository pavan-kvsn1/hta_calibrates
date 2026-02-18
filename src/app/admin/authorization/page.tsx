'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import {
  Loader2,
  ShieldCheck,
  Clock,
  CheckCircle,
  Eye,
  FileText,
} from 'lucide-react'

interface Certificate {
  id: string
  certificateNumber: string
  customerName: string | null
  uucDescription: string | null
  uucMake: string | null
  uucModel: string | null
  uucSerialNumber: string | null
  dateOfCalibration: string | null
  status: string
  currentRevision: number
  createdBy: { id: string; name: string; email: string } | null
  createdAt: string
  updatedAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function AuthorizationPage() {
  const [certificates, setCertificates] = useState<Certificate[]>([])
  const [loading, setLoading] = useState(true)
  const [pagination, setPagination] = useState<Pagination>({
    page: 1,
    limit: 20,
    total: 0,
    totalPages: 0,
  })
  const [statusFilter, setStatusFilter] = useState('PENDING_ADMIN_AUTHORIZATION')

  const fetchCertificates = async (page = 1, status = statusFilter) => {
    setLoading(true)
    try {
      const params = new URLSearchParams({
        page: page.toString(),
        limit: '20',
        status,
      })
      const res = await fetch(`/api/admin/authorization?${params}`)
      if (res.ok) {
        const data = await res.json()
        setCertificates(data.certificates)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Failed to fetch certificates:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchCertificates()
  }, [])

  const handleStatusChange = (value: string) => {
    setStatusFilter(value)
    fetchCertificates(1, value)
  }

  const getStatusBadge = (status: string) => {
    switch (status) {
      case 'PENDING_ADMIN_AUTHORIZATION':
        return (
          <Badge className="bg-blue-100 text-blue-800">
            <Clock className="h-3 w-3 mr-1" />
            Pending Authorization
          </Badge>
        )
      case 'AUTHORIZED':
        return (
          <Badge className="bg-green-100 text-green-800">
            <CheckCircle className="h-3 w-3 mr-1" />
            Authorized
          </Badge>
        )
      default:
        return <Badge>{status}</Badge>
    }
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Certificate Authorization</h1>
          <p className="text-gray-600 mt-1">
            Review and authorize certificates that have been approved by customers
          </p>
        </div>
      </div>

      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <CardTitle className="flex items-center gap-2">
              <ShieldCheck className="h-5 w-5 text-gray-400" />
              Certificates Awaiting Authorization
            </CardTitle>
            <div className="flex items-center gap-4">
              <Select value={statusFilter} onValueChange={handleStatusChange}>
                <SelectTrigger className="w-52">
                  <SelectValue placeholder="Filter by status" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="PENDING_ADMIN_AUTHORIZATION">Pending Authorization</SelectItem>
                  <SelectItem value="AUTHORIZED">Authorized</SelectItem>
                  <SelectItem value="ALL">All</SelectItem>
                </SelectContent>
              </Select>
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="h-6 w-6 animate-spin text-gray-400" />
            </div>
          ) : certificates.length === 0 ? (
            <div className="text-center py-8 text-gray-500">
              <ShieldCheck className="h-12 w-12 mx-auto mb-4 text-gray-300" />
              <p className="font-medium">No certificates found</p>
              <p className="text-sm mt-1">
                {statusFilter === 'PENDING_ADMIN_AUTHORIZATION'
                  ? 'All certificates have been authorized'
                  : 'No certificates match the selected filter'}
              </p>
            </div>
          ) : (
            <>
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Certificate #</TableHead>
                    <TableHead>Customer</TableHead>
                    <TableHead>UUC Description</TableHead>
                    <TableHead>Make / Model</TableHead>
                    <TableHead>Calibration Date</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead>Engineer</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {certificates.map((cert) => (
                    <TableRow key={cert.id}>
                      <TableCell className="font-medium">
                        <div className="flex items-center gap-2">
                          <FileText className="h-4 w-4 text-gray-400" />
                          {cert.certificateNumber}
                        </div>
                      </TableCell>
                      <TableCell>{cert.customerName || '-'}</TableCell>
                      <TableCell className="max-w-[200px] truncate">
                        {cert.uucDescription || '-'}
                      </TableCell>
                      <TableCell>
                        {cert.uucMake && cert.uucModel
                          ? `${cert.uucMake} / ${cert.uucModel}`
                          : cert.uucMake || cert.uucModel || '-'}
                      </TableCell>
                      <TableCell className="text-gray-500">
                        {cert.dateOfCalibration
                          ? new Date(cert.dateOfCalibration).toLocaleDateString()
                          : '-'}
                      </TableCell>
                      <TableCell>{getStatusBadge(cert.status)}</TableCell>
                      <TableCell className="text-gray-500">
                        {cert.createdBy?.name || '-'}
                      </TableCell>
                      <TableCell className="text-right">
                        <Link href={`/admin/authorization/${cert.id}`}>
                          <Button
                            size="sm"
                            variant={cert.status === 'PENDING_ADMIN_AUTHORIZATION' ? 'default' : 'outline'}
                            className={
                              cert.status === 'PENDING_ADMIN_AUTHORIZATION'
                                ? 'bg-blue-600 hover:bg-blue-700'
                                : ''
                            }
                          >
                            <Eye className="h-4 w-4 mr-1" />
                            {cert.status === 'PENDING_ADMIN_AUTHORIZATION' ? 'Review' : 'View'}
                          </Button>
                        </Link>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>

              {/* Pagination */}
              {pagination.totalPages > 1 && (
                <div className="flex items-center justify-between pt-4 border-t mt-4">
                  <p className="text-sm text-gray-500">
                    Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
                    {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
                    {pagination.total} certificates
                  </p>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchCertificates(pagination.page - 1)}
                      disabled={pagination.page === 1}
                    >
                      Previous
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => fetchCertificates(pagination.page + 1)}
                      disabled={pagination.page === pagination.totalPages}
                    >
                      Next
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  )
}
