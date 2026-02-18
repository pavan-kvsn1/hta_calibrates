'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
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
  Plus,
  Search,
  Building2,
  Loader2,
  ChevronLeft,
  ChevronRight,
  AlertCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CustomerAccount {
  id: string
  companyName: string
  contactEmail: string | null
  isActive: boolean
  assignedHod: { id: string; name: string } | null
  userCount: number
  pendingRegistrations: number
  certificateCount: number
  createdAt: string
}

interface Pagination {
  page: number
  limit: number
  total: number
  totalPages: number
}

export default function CustomersPage() {
  const router = useRouter()
  const [accounts, setAccounts] = useState<CustomerAccount[]>([])
  const [pagination, setPagination] = useState<Pagination | null>(null)
  const [loading, setLoading] = useState(true)
  const [search, setSearch] = useState('')
  const [activeFilter, setActiveFilter] = useState('true')
  const [page, setPage] = useState(1)

  const fetchAccounts = async () => {
    setLoading(true)
    try {
      const params = new URLSearchParams()
      if (search) params.set('search', search)
      params.set('isActive', activeFilter)
      params.set('page', page.toString())
      params.set('limit', '15')

      const res = await fetch(`/api/admin/customers?${params}`)
      if (res.ok) {
        const data = await res.json()
        setAccounts(data.accounts)
        setPagination(data.pagination)
      }
    } catch (error) {
      console.error('Failed to fetch accounts:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchAccounts()
  }, [activeFilter, page])

  // Debounced search
  useEffect(() => {
    const timer = setTimeout(() => {
      setPage(1)
      fetchAccounts()
    }, 300)
    return () => clearTimeout(timer)
  }, [search])

  return (
    <div className="p-8">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Customer Accounts</h1>
          <p className="text-gray-500 mt-1">
            Manage customer companies and their users
          </p>
        </div>
        <Link href="/admin/customers/new">
          <Button className="bg-green-600 hover:bg-green-700">
            <Plus className="h-4 w-4 mr-2" />
            Create Account
          </Button>
        </Link>
      </div>

      {/* Filters */}
      <div className="flex flex-wrap gap-4 mb-6">
        <div className="relative flex-1 min-w-[200px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-400" />
          <Input
            placeholder="Search by company name or email..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="pl-10"
          />
        </div>
        <Select value={activeFilter} onValueChange={setActiveFilter}>
          <SelectTrigger className="w-[150px]">
            <SelectValue placeholder="Status" />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="true">Active</SelectItem>
            <SelectItem value="false">Inactive</SelectItem>
            <SelectItem value="ALL">All</SelectItem>
          </SelectContent>
        </Select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-lg border shadow-sm">
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
          </div>
        ) : accounts.length === 0 ? (
          <div className="text-center py-12 text-gray-500">
            <Building2 className="h-12 w-12 mx-auto mb-3 text-gray-300" />
            <p>No customer accounts found</p>
          </div>
        ) : (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Company</TableHead>
                <TableHead>Contact Email</TableHead>
                <TableHead>Users</TableHead>
                <TableHead>HoD</TableHead>
                <TableHead>Certificates</TableHead>
                <TableHead>Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {accounts.map((account) => (
                <TableRow
                  key={account.id}
                  className="cursor-pointer hover:bg-gray-50"
                  onClick={() => router.push(`/admin/customers/${account.id}`)}
                >
                  <TableCell>
                    <div className="flex items-center gap-2">
                      <span className="font-medium">{account.companyName}</span>
                      {account.pendingRegistrations > 0 && (
                        <Badge className="bg-orange-100 text-orange-700 text-xs">
                          {account.pendingRegistrations} pending
                        </Badge>
                      )}
                    </div>
                  </TableCell>
                  <TableCell className="text-gray-500">
                    {account.contactEmail || '-'}
                  </TableCell>
                  <TableCell>{account.userCount}</TableCell>
                  <TableCell className="text-gray-500">
                    {account.assignedHod?.name || (
                      <span className="flex items-center gap-1 text-amber-600">
                        <AlertCircle className="h-3 w-3" />
                        Unassigned
                      </span>
                    )}
                  </TableCell>
                  <TableCell>{account.certificateCount}</TableCell>
                  <TableCell>
                    <Badge
                      className={cn(
                        account.isActive
                          ? 'bg-green-100 text-green-800 hover:bg-green-100'
                          : 'bg-gray-100 text-gray-500'
                      )}
                    >
                      {account.isActive ? 'Active' : 'Inactive'}
                    </Badge>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}

        {/* Pagination */}
        {pagination && pagination.totalPages > 1 && (
          <div className="flex items-center justify-between px-4 py-3 border-t">
            <p className="text-sm text-gray-500">
              Showing {(pagination.page - 1) * pagination.limit + 1} to{' '}
              {Math.min(pagination.page * pagination.limit, pagination.total)} of{' '}
              {pagination.total} accounts
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

      <p className="mt-4 text-xs text-gray-500">Click row to view details</p>
    </div>
  )
}
