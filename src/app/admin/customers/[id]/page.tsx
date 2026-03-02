'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
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
  ArrowLeft,
  Loader2,
  Users,
  FileText,
  UserCheck,
  Building2,
  CheckCircle,
  XCircle,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface CustomerAccount {
  id: string
  companyName: string
  address: string | null
  contactEmail: string | null
  contactPhone: string | null
  isActive: boolean
  assignedHod: { id: string; name: string; email: string } | null
  createdAt: string
}

interface CustomerUser {
  id: string
  email: string
  name: string
  isActive: boolean
  createdAt: string
}

interface Registration {
  id: string
  email: string
  name: string
  createdAt: string
}

interface Certificate {
  id: string
  certificateNumber: string
  uucDescription: string | null
  status: string
  createdAt: string
}

interface HoD {
  id: string
  name: string
  email: string
}

export default function CustomerDetailPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [account, setAccount] = useState<CustomerAccount | null>(null)
  const [users, setUsers] = useState<CustomerUser[]>([])
  const [pendingRegistrations, setPendingRegistrations] = useState<Registration[]>([])
  const [recentCertificates, setRecentCertificates] = useState<Certificate[]>([])
  const [certificateCount, setCertificateCount] = useState(0)
  const [hods, setHods] = useState<HoD[]>([])
  const [isEditing, setIsEditing] = useState(false)

  const [formData, setFormData] = useState({
    companyName: '',
    address: '',
    contactEmail: '',
    contactPhone: '',
    assignedHodId: '',
  })

  const fetchData = async () => {
    try {
      const [accountRes, hodsRes] = await Promise.all([
        fetch(`/api/admin/customers/${id}`),
        fetch('/api/admin/users/hods'),
      ])

      if (accountRes.ok) {
        const data = await accountRes.json()
        setAccount(data.account)
        setUsers(data.users)
        setPendingRegistrations(data.pendingRegistrations)
        setRecentCertificates(data.recentCertificates)
        setCertificateCount(data.certificateCount)
        setFormData({
          companyName: data.account.companyName,
          address: data.account.address || '',
          contactEmail: data.account.contactEmail || '',
          contactPhone: data.account.contactPhone || '',
          assignedHodId: data.account.assignedHod?.id || '',
        })
      }

      if (hodsRes.ok) {
        const hodsData = await hodsRes.json()
        setHods(hodsData.hods || [])
      }
    } catch (error) {
      console.error('Failed to fetch data:', error)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchData()
  }, [id])

  const handleSave = async () => {
    setError('')
    setSaving(true)

    try {
      const res = await fetch(`/api/admin/customers/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: formData.companyName,
          address: formData.address || null,
          contactEmail: formData.contactEmail || null,
          contactPhone: formData.contactPhone || null,
          assignedHodId: formData.assignedHodId || null,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update account')
      }

      setIsEditing(false)
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update account')
    } finally {
      setSaving(false)
    }
  }

  const handleApproveRegistration = async (registrationId: string) => {
    try {
      const res = await fetch(`/api/admin/registrations/${registrationId}/approve`, {
        method: 'POST',
      })

      if (res.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Failed to approve registration:', error)
    }
  }

  const handleRejectRegistration = async (registrationId: string) => {
    const reason = prompt('Enter rejection reason:')
    if (!reason) return

    try {
      const res = await fetch(`/api/admin/registrations/${registrationId}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ reason }),
      })

      if (res.ok) {
        fetchData()
      }
    } catch (error) {
      console.error('Failed to reject registration:', error)
    }
  }

  if (loading) {
    return (
      <div className="p-8 flex items-center justify-center">
        <Loader2 className="h-8 w-8 animate-spin text-gray-400" />
      </div>
    )
  }

  if (!account) {
    return (
      <div className="p-8">
        <p className="text-red-600">Customer account not found</p>
      </div>
    )
  }

  return (
    <div className="p-8">
      {/* Back Link */}
      <Link
        href="/admin/customers"
        className="inline-flex items-center text-sm text-gray-600 hover:text-gray-900 mb-6"
      >
        <ArrowLeft className="h-4 w-4 mr-1" />
        Back to Customer Accounts
      </Link>

      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Account Details */}
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader className="flex flex-row items-center justify-between">
              <CardTitle className="flex items-center gap-2">
                <Building2 className="h-5 w-5 text-gray-400" />
                Account Details
              </CardTitle>
              {!isEditing && (
                <Button variant="outline" onClick={() => setIsEditing(true)}>
                  Edit
                </Button>
              )}
            </CardHeader>
            <CardContent>
              {error && (
                <div className="p-3 mb-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
                  {error}
                </div>
              )}

              {isEditing ? (
                <div className="space-y-4">
                  <div className="space-y-2">
                    <Label>Company Name</Label>
                    <Input
                      value={formData.companyName}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, companyName: e.target.value }))
                      }
                    />
                  </div>
                  <div className="space-y-2">
                    <Label>Address</Label>
                    <Textarea
                      value={formData.address}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, address: e.target.value }))
                      }
                      rows={2}
                    />
                  </div>
                  <div className="grid grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label>Contact Email</Label>
                      <Input
                        type="email"
                        value={formData.contactEmail}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, contactEmail: e.target.value }))
                        }
                      />
                    </div>
                    <div className="space-y-2">
                      <Label>Contact Phone</Label>
                      <Input
                        value={formData.contactPhone}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, contactPhone: e.target.value }))
                        }
                      />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label>Assigned HoD</Label>
                    <Select
                      value={formData.assignedHodId || 'none'}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, assignedHodId: value === 'none' ? '' : value }))
                      }
                    >
                      <SelectTrigger>
                        <SelectValue placeholder="Select HoD..." />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="none">No HoD assigned</SelectItem>
                        {hods.map((hod) => (
                          <SelectItem key={hod.id} value={hod.id}>
                            {hod.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                  <div className="flex gap-2 pt-2">
                    <Button
                      variant="outline"
                      onClick={() => setIsEditing(false)}
                      disabled={saving}
                    >
                      Cancel
                    </Button>
                    <Button
                      onClick={handleSave}
                      disabled={saving}
                      className="bg-green-600 hover:bg-green-700"
                    >
                      {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Save Changes
                    </Button>
                  </div>
                </div>
              ) : (
                <dl className="space-y-3 text-sm">
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Company</dt>
                    <dd className="font-medium">{account.companyName}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Status</dt>
                    <dd>
                      <Badge
                        className={cn(
                          account.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-gray-100 text-gray-500'
                        )}
                      >
                        {account.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </dd>
                  </div>
                  {account.address && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Address</dt>
                      <dd className="text-right max-w-xs">{account.address}</dd>
                    </div>
                  )}
                  {account.contactEmail && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Email</dt>
                      <dd>{account.contactEmail}</dd>
                    </div>
                  )}
                  {account.contactPhone && (
                    <div className="flex justify-between">
                      <dt className="text-gray-500">Phone</dt>
                      <dd>{account.contactPhone}</dd>
                    </div>
                  )}
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Assigned HoD</dt>
                    <dd>{account.assignedHod?.name || 'Not assigned'}</dd>
                  </div>
                  <div className="flex justify-between">
                    <dt className="text-gray-500">Created</dt>
                    <dd>{new Date(account.createdAt).toLocaleDateString()}</dd>
                  </div>
                </dl>
              )}
            </CardContent>
          </Card>

          {/* Users */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Users className="h-5 w-5 text-gray-400" />
                Users ({users.length})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {users.length === 0 ? (
                <p className="text-gray-500 text-sm">No users registered yet</p>
              ) : (
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Name</TableHead>
                      <TableHead>Email</TableHead>
                      <TableHead>Status</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {users.map((user) => (
                      <TableRow key={user.id}>
                        <TableCell className="font-medium">{user.name}</TableCell>
                        <TableCell className="text-gray-500">{user.email}</TableCell>
                        <TableCell>
                          <Badge
                            className={cn(
                              user.isActive
                                ? 'bg-green-100 text-green-800'
                                : 'bg-gray-100 text-gray-500'
                            )}
                          >
                            {user.isActive ? 'Active' : 'Inactive'}
                          </Badge>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              )}
            </CardContent>
          </Card>

          {/* Pending Registrations */}
          {pendingRegistrations.length > 0 && (
            <Card>
              <CardHeader>
                <CardTitle className="flex items-center gap-2">
                  <UserCheck className="h-5 w-5 text-orange-500" />
                  Pending Registrations ({pendingRegistrations.length})
                </CardTitle>
              </CardHeader>
              <CardContent>
                <div className="space-y-3">
                  {pendingRegistrations.map((reg) => (
                    <div
                      key={reg.id}
                      className="flex items-center justify-between p-3 bg-orange-50 rounded-lg border border-orange-200"
                    >
                      <div>
                        <p className="font-medium">{reg.name}</p>
                        <p className="text-sm text-gray-500">{reg.email}</p>
                      </div>
                      <div className="flex gap-2">
                        <Button
                          size="sm"
                          className="bg-green-600 hover:bg-green-700"
                          onClick={() => handleApproveRegistration(reg.id)}
                        >
                          <CheckCircle className="h-4 w-4 mr-1" />
                          Approve
                        </Button>
                        <Button
                          size="sm"
                          variant="outline"
                          className="text-red-600 border-red-200 hover:bg-red-50"
                          onClick={() => handleRejectRegistration(reg.id)}
                        >
                          <XCircle className="h-4 w-4 mr-1" />
                          Reject
                        </Button>
                      </div>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </div>

        {/* Sidebar - Recent Certificates */}
        <div>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-base">
                <FileText className="h-5 w-5 text-gray-400" />
                Certificates ({certificateCount})
              </CardTitle>
            </CardHeader>
            <CardContent>
              {recentCertificates.length === 0 ? (
                <p className="text-gray-500 text-sm">No certificates yet</p>
              ) : (
                <div className="space-y-3">
                  {recentCertificates.map((cert) => (
                    <div key={cert.id} className="text-sm">
                      <p className="font-medium">{cert.certificateNumber}</p>
                      <p className="text-xs text-gray-500 truncate">
                        {cert.uucDescription || 'No description'}
                      </p>
                      <Badge
                        variant="secondary"
                        className="text-xs mt-1"
                      >
                        {cert.status.replace(/_/g, ' ')}
                      </Badge>
                    </div>
                  ))}
                  {certificateCount > 10 && (
                    <p className="text-xs text-gray-400 pt-2">
                      Showing 10 of {certificateCount} certificates
                    </p>
                  )}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  )
}
