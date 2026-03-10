'use client'

import { useState, useEffect, use } from 'react'
import { useRouter } from 'next/navigation'
import Link from 'next/link'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
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
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from '@/components/ui/alert-dialog'
import { ArrowLeft, Loader2, Users, FileText, Clock } from 'lucide-react'
import { cn } from '@/lib/utils'

interface User {
  id: string
  email: string
  name: string
  role: string
  isAdmin: boolean
  isActive: boolean
  authProvider: string
  signatureUrl: string | null
  assignedHod: { id: string; name: string } | null
  engineers: { id: string; name: string; email: string }[]
  createdAt: string
  updatedAt: string
}

interface Stats {
  total: number
  byStatus: Record<string, number>
}

interface HoD {
  id: string
  name: string
  email: string
  engineerCount: number
}

export default function EditUserPage({
  params,
}: {
  params: Promise<{ id: string }>
}) {
  const { id } = use(params)
  const router = useRouter()
  const [loading, setLoading] = useState(true)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState('')
  const [user, setUser] = useState<User | null>(null)
  const [stats, setStats] = useState<Stats | null>(null)
  const [hods, setHods] = useState<HoD[]>([])
  const [showDeactivateDialog, setShowDeactivateDialog] = useState(false)
  const [showReactivateDialog, setShowReactivateDialog] = useState(false)

  const [formData, setFormData] = useState({
    name: '',
    role: '',
    assignedHodId: '',
    isAdmin: false,
  })

  useEffect(() => {
    Promise.all([
      fetch(`/api/admin/users/${id}`).then((res) => res.json()),
      fetch('/api/admin/users/hods').then((res) => res.json()),
    ])
      .then(([userData, hodsData]) => {
        if (userData.user) {
          setUser(userData.user)
          setStats(userData.stats)
          setFormData({
            name: userData.user.name,
            role: userData.user.role,
            assignedHodId: userData.user.assignedHod?.id || '',
            isAdmin: userData.user.isAdmin || false,
          })
        }
        setHods(hodsData.hods || [])
      })
      .catch(console.error)
      .finally(() => setLoading(false))
  }, [id])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (formData.role === 'ENGINEER' && !formData.assignedHodId) {
      setError('Please select an HoD for this engineer')
      return
    }

    setSaving(true)

    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: formData.name,
          role: formData.role,
          assignedHodId: formData.role === 'ENGINEER' ? formData.assignedHodId : null,
          isAdmin: formData.role === 'HOD' ? formData.isAdmin : false,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to update user')
      }

      router.push('/admin/users')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to update user')
    } finally {
      setSaving(false)
    }
  }

  const handleDeactivate = async () => {
    try {
      const res = await fetch(`/api/admin/users/${id}`, {
        method: 'DELETE',
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to deactivate user')
      }

      router.push('/admin/users')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to deactivate user')
      setShowDeactivateDialog(false)
    }
  }

  const handleReactivate = async () => {
    try {
      const res = await fetch(`/api/admin/users/${id}/reactivate`, {
        method: 'PUT',
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to reactivate user')
      }

      // Refresh user data
      const userRes = await fetch(`/api/admin/users/${id}`)
      const userData = await userRes.json()
      if (userData.user) {
        setUser(userData.user)
      }
      setShowReactivateDialog(false)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to reactivate user')
      setShowReactivateDialog(false)
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

  if (!user) {
    return (
      <div className="p-3 h-full">
        <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full">
          <div className="p-6">
            <p className="text-red-600">User not found</p>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="p-3 h-full">
      {/* Master Bounding Box */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full">
        <div className="p-6 overflow-auto h-full">
          {/* Back Link */}
          <Link
            href="/admin/users"
            className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-6"
          >
            <ArrowLeft className="h-4 w-4 mr-1" />
            Back to Users
          </Link>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 h-[calc(100%-3rem)]">
              {/* Main Form */}
              <div className="lg:col-span-2">
                <Card>
                  <CardHeader className="flex flex-row items-center justify-between">
                    <CardTitle>Edit Staff User</CardTitle>
                    {user.isActive ? (
                      <Button
                        variant="outline"
                        className="text-red-600 border-red-200 hover:bg-red-50"
                        onClick={() => setShowDeactivateDialog(true)}
                      >
                        Deactivate User
                      </Button>
                    ) : (
                      <Button
                        variant="outline"
                        className="text-green-600 border-green-200 hover:bg-green-50"
                        onClick={() => setShowReactivateDialog(true)}
                      >
                        Reactivate User
                      </Button>
                    )}
                  </CardHeader>
                  <CardContent>
                    <form onSubmit={handleSubmit} className="space-y-6">
                      {error && (
                        <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
                          {error}
                        </div>
                      )}

                      {/* Status Badge */}
                      {!user.isActive && (
                        <div className="p-3 bg-amber-50 border border-amber-200 rounded-lg">
                          <p className="text-sm text-amber-800">
                            This user is currently deactivated and cannot log in.
                          </p>
                        </div>
                      )}

                      {/* Email (read-only) */}
                      <div className="space-y-2">
                        <Label htmlFor="email">Email Address</Label>
                        <Input
                          id="email"
                          type="email"
                          value={user.email}
                          disabled
                          className="bg-slate-50"
                        />
                        <p className="text-xs text-slate-500">Email cannot be changed</p>
                      </div>

                      {/* Name */}
                      <div className="space-y-2">
                        <Label htmlFor="name">Full Name</Label>
                        <Input
                          id="name"
                          type="text"
                          value={formData.name}
                          onChange={(e) =>
                            setFormData((prev) => ({ ...prev, name: e.target.value }))
                          }
                          required
                        />
                      </div>

                      {/* Role */}
                      <div className="space-y-2">
                        <Label htmlFor="role">Role</Label>
                        <Select
                          value={formData.role}
                          onValueChange={(value) =>
                            setFormData((prev) => ({
                              ...prev,
                              role: value,
                              assignedHodId: value !== 'ENGINEER' ? '' : prev.assignedHodId,
                              isAdmin: value === 'HOD' ? prev.isAdmin : false,
                            }))
                          }
                        >
                          <SelectTrigger>
                            <SelectValue />
                          </SelectTrigger>
                          <SelectContent>
                            <SelectItem value="ENGINEER">Engineer</SelectItem>
                            <SelectItem value="HOD">Head of Department (HoD)</SelectItem>
                            <SelectItem value="ADMIN">Administrator</SelectItem>
                          </SelectContent>
                        </Select>
                        {user.role === 'HOD' && user.engineers.length > 0 && formData.role !== 'HOD' && (
                          <p className="text-sm text-amber-600">
                            This HoD has {user.engineers.length} assigned engineers. Reassign them before
                            changing role.
                          </p>
                        )}
                      </div>

                      {/* HoD Assignment (for Engineers) */}
                      {formData.role === 'ENGINEER' && (
                        <div className="space-y-2">
                          <Label htmlFor="assignedHodId">Assign to HoD</Label>
                          <Select
                            value={formData.assignedHodId}
                            onValueChange={(value) =>
                              setFormData((prev) => ({ ...prev, assignedHodId: value }))
                            }
                          >
                            <SelectTrigger>
                              <SelectValue placeholder="Select HoD..." />
                            </SelectTrigger>
                            <SelectContent>
                              {hods.map((hod) => (
                                <SelectItem key={hod.id} value={hod.id}>
                                  {hod.name}{' '}
                                  <span className="text-slate-500">
                                    ({hod.engineerCount} engineers)
                                  </span>
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </div>
                      )}

                      {/* Admin Access (for HoD) */}
                      {formData.role === 'HOD' && (
                        <div className="space-y-2">
                          <div className="flex items-start gap-3 p-4 bg-blue-50 rounded-lg border border-blue-200">
                            <input
                              type="checkbox"
                              id="isAdmin"
                              checked={formData.isAdmin}
                              onChange={(e) =>
                                setFormData((prev) => ({ ...prev, isAdmin: e.target.checked }))
                              }
                              className="mt-1 h-4 w-4 rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div>
                              <Label htmlFor="isAdmin" className="font-medium text-blue-900">
                                Grant Admin Access
                              </Label>
                              <p className="text-sm text-blue-700 mt-1">
                                Allows this HoD to access admin features like user management,
                                customer accounts, and system settings.
                              </p>
                            </div>
                          </div>
                        </div>
                      )}

                      {/* Actions */}
                      <div className="flex gap-3 pt-4">
                        <Button
                          type="button"
                          variant="outline"
                          onClick={() => router.push('/admin/users')}
                          disabled={saving}
                        >
                          Cancel
                        </Button>
                        <Button
                          type="submit"
                          className="bg-green-600 hover:bg-green-700"
                          disabled={saving}
                        >
                          {saving && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                          Save Changes
                        </Button>
                      </div>
                    </form>
                  </CardContent>
                </Card>
              </div>

              {/* Sidebar Info */}
              <div className="space-y-6">
                {/* User Info Card */}
                <Card>
                  <CardHeader>
                    <CardTitle className="text-base">User Info</CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-3 text-sm">
                    <div className="flex justify-between">
                      <span className="text-slate-500">Status</span>
                      <Badge
                        className={cn(
                          user.isActive
                            ? 'bg-green-100 text-green-800'
                            : 'bg-slate-100 text-slate-500'
                        )}
                      >
                        {user.isActive ? 'Active' : 'Inactive'}
                      </Badge>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Auth</span>
                      <span>{user.authProvider}</span>
                    </div>
                    <div className="flex justify-between">
                      <span className="text-slate-500">Created</span>
                      <span>{new Date(user.createdAt).toLocaleDateString()}</span>
                    </div>
                  </CardContent>
                </Card>

                {/* Stats Card */}
                {stats && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <FileText className="h-4 w-4 text-slate-400" />
                        Certificates
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2 text-sm">
                      <div className="flex justify-between">
                        <span className="text-slate-500">Total Created</span>
                        <span className="font-medium">{stats.total}</span>
                      </div>
                      {Object.entries(stats.byStatus).map(([status, count]) => (
                        <div key={status} className="flex justify-between text-xs">
                          <span className="text-slate-400">{status}</span>
                          <span>{count}</span>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}

                {/* Managed Engineers (for HoDs) */}
                {user.role === 'HOD' && user.engineers.length > 0 && (
                  <Card>
                    <CardHeader>
                      <CardTitle className="text-base flex items-center gap-2">
                        <Users className="h-4 w-4 text-slate-400" />
                        Managed Engineers ({user.engineers.length})
                      </CardTitle>
                    </CardHeader>
                    <CardContent className="space-y-2">
                      {user.engineers.map((eng) => (
                        <div key={eng.id} className="text-sm">
                          <p className="font-medium">{eng.name}</p>
                          <p className="text-xs text-slate-500">{eng.email}</p>
                        </div>
                      ))}
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
        </div>
      </div>

      {/* Deactivate Dialog */}
      <AlertDialog open={showDeactivateDialog} onOpenChange={setShowDeactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Deactivate User?</AlertDialogTitle>
            <AlertDialogDescription>
              This will prevent {user.name} from logging in. Their certificates and data
              will be preserved. You can reactivate them later.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDeactivate}
              className="bg-red-600 hover:bg-red-700"
            >
              Deactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>

      {/* Reactivate Dialog */}
      <AlertDialog open={showReactivateDialog} onOpenChange={setShowReactivateDialog}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Reactivate User?</AlertDialogTitle>
            <AlertDialogDescription>
              This will allow {user.name} to log in again with their existing credentials.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleReactivate}
              className="bg-green-600 hover:bg-green-700"
            >
              Reactivate
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  )
}
