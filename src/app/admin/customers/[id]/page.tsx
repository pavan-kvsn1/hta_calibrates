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
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
} from '@/components/ui/dialog'
import {
  ChevronLeft,
  Loader2,
  Users,
  FileText,
  Building2,
  Crown,
  UserPlus,
  Eye,
  Plus,
  Bell,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import { format, formatDistanceToNow } from 'date-fns'

interface CustomerAccount {
  id: string
  companyName: string
  address: string | null
  contactEmail: string | null
  contactPhone: string | null
  isActive: boolean
  assignedHod: { id: string; name: string; email: string } | null
  primaryPocId: string | null
  primaryPoc: {
    id: string
    name: string
    email: string
    isActive: boolean
    activatedAt: string | null
    createdAt: string
  } | null
  createdAt: string
  updatedAt: string
}

interface CustomerUser {
  id: string
  email: string
  name: string
  isPoc: boolean
  isActive: boolean
  activatedAt: string | null
  createdAt: string
}

interface CustomerRequest {
  id: string
  type: 'USER_ADDITION' | 'POC_CHANGE'
  data: { name?: string; email?: string; newPocUserId?: string; reason?: string }
  requestedBy: { id: string; name: string; email: string } | null
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

type TabType = 'info' | 'users' | 'requests' | 'certificates'

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
  const [activeTab, setActiveTab] = useState<TabType>('info')
  const [account, setAccount] = useState<CustomerAccount | null>(null)
  const [users, setUsers] = useState<CustomerUser[]>([])
  const [pendingRequests, setPendingRequests] = useState<CustomerRequest[]>([])
  const [recentCertificates, setRecentCertificates] = useState<Certificate[]>([])
  const [certificateCount, setCertificateCount] = useState(0)
  const [hods, setHods] = useState<HoD[]>([])
  const [isEditing, setIsEditing] = useState(false)
  const [showAddUserDialog, setShowAddUserDialog] = useState(false)
  const [addingUser, setAddingUser] = useState(false)
  const [newUser, setNewUser] = useState({ name: '', email: '' })

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
        setPendingRequests(data.pendingRequests || [])
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

  const handleAddUser = async () => {
    if (!newUser.name.trim() || !newUser.email.trim()) {
      setError('Name and email are required')
      return
    }

    setAddingUser(true)
    setError('')

    try {
      const res = await fetch(`/api/admin/customers/${id}/users`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(newUser),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to add user')
      }

      setShowAddUserDialog(false)
      setNewUser({ name: '', email: '' })
      fetchData()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to add user')
    } finally {
      setAddingUser(false)
    }
  }

  if (loading) {
    return (
      <div className="p-3 h-full">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full">
          <div className="p-6 flex items-center justify-center h-full">
            <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
          </div>
        </div>
      </div>
    )
  }

  if (!account) {
    return (
      <div className="p-3 h-full">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full">
          <div className="p-6">
            <p className="text-red-600">Customer account not found</p>
          </div>
        </div>
      </div>
    )
  }

  const tabs = [
    { id: 'info' as TabType, label: 'Account Info', icon: Building2 },
    { id: 'users' as TabType, label: `Users (${users.length})`, icon: Users },
    { id: 'requests' as TabType, label: `Pending Requests (${pendingRequests.length})`, icon: Bell, highlight: pendingRequests.length > 0 },
    { id: 'certificates' as TabType, label: `Certificates`, icon: FileText },
  ]

  return (
    <div className="p-3 h-full">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full">
        <div className="p-6 overflow-auto h-full">
          {/* Header */}
          <div className="flex items-start justify-between mb-6">
            <div>
              <div className="flex items-center gap-3">
                <Link
                  href="/admin/customers"
                  className="text-slate-400 hover:text-slate-600 transition-colors"
                >
                  <ChevronLeft className="size-6" strokeWidth={2} />
                </Link>
                <span className="text-slate-300 text-xl">|</span>
                <h1 className="text-2xl font-bold text-slate-900 tracking-tight">{account.companyName}</h1>
                <Badge
                  className={cn(
                    account.isActive
                      ? 'bg-green-100 text-green-800'
                      : 'bg-slate-100 text-slate-500'
                  )}
                >
                  {account.isActive ? 'Active' : 'Inactive'}
                </Badge>
              </div>
            </div>
            {activeTab === 'info' && !isEditing && (
              <Button variant="outline" onClick={() => setIsEditing(true)}>
                Edit
              </Button>
            )}
          </div>

          {/* Tabs */}
          <div className="flex gap-1">
            {tabs.map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'px-4 py-2.5 text-sm font-medium rounded-t-lg flex items-center gap-2 transition-colors border border-b-0',
                  activeTab === tab.id
                    ? 'bg-white text-blue-600 border-slate-200 relative z-10'
                    : 'bg-slate-100 text-slate-500 hover:text-slate-700 hover:bg-slate-50 border-transparent',
                  tab.highlight && activeTab !== tab.id && 'text-amber-600 bg-amber-50 hover:bg-amber-100'
                )}
              >
                <tab.icon className="h-4 w-4" />
                {tab.label}
              </button>
            ))}
          </div>

          {/* Tab Content Panel */}
          <div className="border border-slate-200 rounded-b-lg rounded-tr-lg bg-white p-6 -mt-px">
            {error && (
              <div className="p-3 mb-4 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
                {error}
              </div>
            )}

            {/* Account Info Tab */}
            {activeTab === 'info' && (
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
              <Card>
                <CardHeader>
                  <CardTitle className="text-lg font-semibold">Company Details</CardTitle>
                </CardHeader>
                <CardContent>
                  {isEditing ? (
                    <div className="space-y-4">
                      <div className="space-y-2">
                        <Label className="font-bold text-base">Company Name</Label>
                        <Input
                          value={formData.companyName}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, companyName: e.target.value }))
                          }
                          className='text-xs font-semibold'
                        />
                      </div>
                      <div className="space-y-2">
                        <Label className="font-bold text-base">Address</Label>
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
                    <dl className="space-y-4">
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <dt className="text-sm font-semibold text-slate-700">Company Name</dt>
                          <dd className="text-xs text-slate-600 mt-0.5">{account.companyName}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-semibold text-slate-700">Status</dt>
                          <dd className="mt-0.5">
                            <Badge
                              className={cn(
                                'text-xs',
                                account.isActive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-slate-100 text-slate-500'
                              )}
                            >
                              {account.isActive ? 'Active' : 'Inactive'}
                            </Badge>
                          </dd>
                        </div>
                      </div>
                      {account.address && (
                        <div>
                          <dt className="text-sm font-semibold text-slate-700">Address</dt>
                          <dd className="text-xs text-slate-600 mt-0.5">{account.address}</dd>
                        </div>
                      )}
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <dt className="text-sm font-semibold text-slate-700">Contact Email</dt>
                          <dd className="text-xs text-slate-600 mt-0.5">{account.contactEmail || '-'}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-semibold text-slate-700">Contact Phone</dt>
                          <dd className="text-xs text-slate-600 mt-0.5">{account.contactPhone || '-'}</dd>
                        </div>
                      </div>
                      <div className="grid grid-cols-2 gap-4">
                        <div>
                          <dt className="text-sm font-semibold text-slate-700">Assigned HoD</dt>
                          <dd className="text-xs text-slate-600 mt-0.5">{account.assignedHod?.name || 'Not assigned'}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-semibold text-slate-700">Created</dt>
                          <dd className="text-xs text-slate-600 mt-0.5">{format(new Date(account.createdAt), 'PPP')}</dd>
                        </div>
                      </div>
                    </dl>
                  )}
                </CardContent>
              </Card>

              {/* Primary POC Card */}
              {account.primaryPoc ? (
                <Card className="h-fit">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Crown className="h-5 w-5 text-amber-500" />
                      Primary Point of Contact
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <div className="flex items-start gap-4">
                      <div className="h-12 w-12 bg-amber-100 rounded-full flex items-center justify-center flex-shrink-0">
                        <Crown className="h-6 w-6 text-amber-600" />
                      </div>
                      <dl className="space-y-3 flex-1">
                        <div>
                          <dt className="text-sm font-semibold text-slate-700">Name</dt>
                          <dd className="text-xs text-slate-600 mt-0.5">{account.primaryPoc.name}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-semibold text-slate-700">Email</dt>
                          <dd className="text-xs text-slate-600 mt-0.5">{account.primaryPoc.email}</dd>
                        </div>
                        <div>
                          <dt className="text-sm font-semibold text-slate-700">Status</dt>
                          <dd className="mt-0.5 flex items-center gap-2">
                            <Badge
                              className={cn(
                                'text-xs',
                                account.primaryPoc.isActive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-amber-100 text-amber-700'
                              )}
                            >
                              {account.primaryPoc.isActive ? 'Active' : 'Pending Activation'}
                            </Badge>
                            {account.primaryPoc.activatedAt && (
                              <span className="text-xs text-slate-500">
                                Activated {format(new Date(account.primaryPoc.activatedAt), 'PPP')}
                              </span>
                            )}
                          </dd>
                        </div>
                      </dl>
                    </div>
                  </CardContent>
                </Card>
              ) : (
                <Card className="h-fit">
                  <CardHeader>
                    <CardTitle className="flex items-center gap-2">
                      <Crown className="h-5 w-5 text-slate-300" />
                      Primary Point of Contact
                    </CardTitle>
                  </CardHeader>
                  <CardContent>
                    <p className="text-sm text-slate-500">No primary POC assigned</p>
                  </CardContent>
                </Card>
              )}
            </div>
            )}

            {/* Users Tab */}
            {activeTab === 'users' && (
            <div>
              <div className="flex justify-between items-center mb-4">
                <h3 className="font-semibold">Users</h3>
                <Button onClick={() => setShowAddUserDialog(true)}>
                  <Plus className="h-4 w-4 mr-2" />
                  Add User
                </Button>
              </div>

              {users.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Users className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>No users registered yet</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Name</TableHead>
                        <TableHead>Email</TableHead>
                        <TableHead>Role</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Joined</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {users.map((user) => (
                        <TableRow key={user.id}>
                          <TableCell className="font-medium">
                            <div className="flex items-center gap-2">
                              {user.isPoc && <Crown className="h-4 w-4 text-amber-500" />}
                              {user.name}
                            </div>
                          </TableCell>
                          <TableCell className="text-slate-500">{user.email}</TableCell>
                          <TableCell>
                            {user.isPoc ? (
                              <Badge className="bg-amber-100 text-amber-700">POC</Badge>
                            ) : (
                              <Badge variant="secondary">User</Badge>
                            )}
                          </TableCell>
                          <TableCell>
                            <Badge
                              className={cn(
                                user.isActive
                                  ? 'bg-green-100 text-green-800'
                                  : 'bg-amber-100 text-amber-700'
                              )}
                            >
                              {user.isActive ? 'Active' : 'Pending'}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-500 text-sm">
                            {format(new Date(user.createdAt), 'PP')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}

              {/* Legend */}
              <div className="mt-4 flex flex-wrap gap-4 text-xs text-slate-500">
                <div className="flex items-center gap-1">
                  <Crown className="h-3 w-3 text-amber-500" /> = Primary POC
                </div>
                <div className="flex items-center gap-1">
                  <Badge className="bg-amber-100 text-amber-700 text-[10px] px-1.5 py-0">Pending</Badge> = Awaiting activation
                </div>
              </div>
            </div>
            )}

            {/* Pending Requests Tab */}
            {activeTab === 'requests' && (
              <div>
              {pendingRequests.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <Bell className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>No pending requests</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {pendingRequests.map((request) => (
                    <div
                      key={request.id}
                      className="p-4 bg-slate-50 rounded-lg border flex items-center justify-between"
                    >
                      <div className="flex items-center gap-4">
                        <div className={cn(
                          'p-2 rounded-lg',
                          request.type === 'USER_ADDITION' ? 'bg-blue-100' : 'bg-purple-100'
                        )}>
                          {request.type === 'USER_ADDITION' ? (
                            <UserPlus className="h-5 w-5 text-blue-600" />
                          ) : (
                            <Crown className="h-5 w-5 text-purple-600" />
                          )}
                        </div>
                        <div>
                          <div className="flex items-center gap-2">
                            <Badge className={cn(
                              request.type === 'USER_ADDITION'
                                ? 'bg-blue-100 text-blue-700'
                                : 'bg-purple-100 text-purple-700'
                            )}>
                              {request.type === 'USER_ADDITION' ? 'User Addition' : 'POC Change'}
                            </Badge>
                          </div>
                          {request.type === 'USER_ADDITION' && (
                            <p className="text-sm mt-1">
                              {request.data.name} ({request.data.email})
                            </p>
                          )}
                          {request.type === 'POC_CHANGE' && (
                            <p className="text-sm mt-1">
                              POC change requested
                            </p>
                          )}
                          <p className="text-xs text-slate-500 mt-1">
                            {request.requestedBy
                              ? `Requested by ${request.requestedBy.name}`
                              : 'Admin initiated'}{' '}
                            {formatDistanceToNow(new Date(request.createdAt), { addSuffix: true })}
                          </p>
                        </div>
                      </div>
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => router.push(`/admin/customers/requests/${request.id}`)}
                      >
                        <Eye className="h-4 w-4 mr-1" />
                        View
                      </Button>
                    </div>
                  ))}
                </div>
              )}
              </div>
            )}

            {/* Certificates Tab */}
            {activeTab === 'certificates' && (
              <div>
              <p className="text-sm text-slate-500 mb-4">
                Showing {Math.min(10, certificateCount)} of {certificateCount} certificates
              </p>
              {recentCertificates.length === 0 ? (
                <div className="text-center py-12 text-slate-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p>No certificates yet</p>
                </div>
              ) : (
                <div className="bg-white rounded-lg border">
                  <Table>
                    <TableHeader>
                      <TableRow>
                        <TableHead>Certificate #</TableHead>
                        <TableHead>Description</TableHead>
                        <TableHead>Status</TableHead>
                        <TableHead>Created</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {recentCertificates.map((cert) => (
                        <TableRow key={cert.id}>
                          <TableCell className="font-medium">{cert.certificateNumber}</TableCell>
                          <TableCell className="text-slate-500 max-w-xs truncate">
                            {cert.uucDescription || '-'}
                          </TableCell>
                          <TableCell>
                            <Badge variant="secondary">
                              {cert.status.replace(/_/g, ' ')}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-slate-500 text-sm">
                            {format(new Date(cert.createdAt), 'PP')}
                          </TableCell>
                        </TableRow>
                      ))}
                    </TableBody>
                  </Table>
                </div>
              )}
            </div>
            )}
          </div>
        </div>
      </div>

      {/* Add User Dialog */}
      <Dialog open={showAddUserDialog} onOpenChange={setShowAddUserDialog}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Add User</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <Label htmlFor="userName">Name *</Label>
              <Input
                id="userName"
                value={newUser.name}
                onChange={(e) => setNewUser((prev) => ({ ...prev, name: e.target.value }))}
                placeholder="John Smith"
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="userEmail">Email *</Label>
              <Input
                id="userEmail"
                type="email"
                value={newUser.email}
                onChange={(e) => setNewUser((prev) => ({ ...prev, email: e.target.value }))}
                placeholder="john@company.com"
              />
            </div>
            <div className="p-3 bg-blue-50 border border-blue-200 rounded-lg text-sm text-blue-800">
              An invitation email will be sent to the user to activate their account.
            </div>
          </div>
          <DialogFooter>
            <Button variant="outline" onClick={() => setShowAddUserDialog(false)}>
              Cancel
            </Button>
            <Button
              onClick={handleAddUser}
              disabled={addingUser}
              className="bg-green-600 hover:bg-green-700"
            >
              {addingUser && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Add User
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  )
}
