'use client'

import { useState, useEffect } from 'react'
import { useRouter } from 'next/navigation'
import { CustomerHeader } from '@/components/layout/CustomerHeader'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import { Textarea } from '@/components/ui/textarea'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from '@/components/ui/dialog'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select'
import {
  Loader2,
  UserPlus,
  Crown,
  Users,
  CheckCircle,
  Clock,
  AlertCircle,
  ArrowLeft,
} from 'lucide-react'
import { format } from 'date-fns'
import Link from 'next/link'

interface TeamMember {
  id: string
  name: string
  email: string
  isActive: boolean
  activatedAt: string | null
  createdAt: string
}

interface PendingRequest {
  id: string
  type: 'USER_ADDITION' | 'POC_CHANGE'
  data: { name?: string; email?: string; newPocUserId?: string; reason?: string }
  createdAt: string
}

interface TeamData {
  account: {
    id: string
    companyName: string
    primaryPocId: string | null
  }
  users: TeamMember[]
  primaryPoc: TeamMember | null
  pendingRequests: PendingRequest[]
  currentUserId: string
  isPrimaryPoc: boolean
}

export default function TeamManagementPage() {
  const router = useRouter()
  const [teamData, setTeamData] = useState<TeamData | null>(null)
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')

  // Add User Dialog
  const [addUserOpen, setAddUserOpen] = useState(false)
  const [addUserName, setAddUserName] = useState('')
  const [addUserEmail, setAddUserEmail] = useState('')
  const [addUserSubmitting, setAddUserSubmitting] = useState(false)
  const [addUserError, setAddUserError] = useState('')

  // POC Change Dialog
  const [pocChangeOpen, setPocChangeOpen] = useState(false)
  const [newPocUserId, setNewPocUserId] = useState('')
  const [pocChangeReason, setPocChangeReason] = useState('')
  const [pocChangeSubmitting, setPocChangeSubmitting] = useState(false)
  const [pocChangeError, setPocChangeError] = useState('')

  const fetchTeamData = async () => {
    try {
      const res = await fetch('/api/customer/team')
      if (!res.ok) {
        if (res.status === 403) {
          router.push('/customer/dashboard')
          return
        }
        throw new Error('Failed to fetch team data')
      }
      const data = await res.json()
      setTeamData(data)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to load team data')
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    fetchTeamData()
  }, [])

  const handleAddUser = async (e: React.FormEvent) => {
    e.preventDefault()
    setAddUserError('')
    setAddUserSubmitting(true)

    try {
      const res = await fetch('/api/customer/team/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'USER_ADDITION',
          data: {
            name: addUserName,
            email: addUserEmail,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit request')
      }

      // Refresh data and close dialog
      await fetchTeamData()
      setAddUserOpen(false)
      setAddUserName('')
      setAddUserEmail('')
    } catch (err) {
      setAddUserError(err instanceof Error ? err.message : 'Failed to submit request')
    } finally {
      setAddUserSubmitting(false)
    }
  }

  const handlePocChange = async (e: React.FormEvent) => {
    e.preventDefault()
    setPocChangeError('')
    setPocChangeSubmitting(true)

    try {
      const res = await fetch('/api/customer/team/request', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          type: 'POC_CHANGE',
          data: {
            newPocUserId,
            reason: pocChangeReason,
          },
        }),
      })

      const data = await res.json()
      if (!res.ok) {
        throw new Error(data.error || 'Failed to submit request')
      }

      // Refresh data and close dialog
      await fetchTeamData()
      setPocChangeOpen(false)
      setNewPocUserId('')
      setPocChangeReason('')
    } catch (err) {
      setPocChangeError(err instanceof Error ? err.message : 'Failed to submit request')
    } finally {
      setPocChangeSubmitting(false)
    }
  }

  // Get eligible users for POC transfer (active users except current user)
  const eligiblePocUsers = teamData?.users.filter(
    (user) => user.id !== teamData.currentUserId && user.isActive
  ) || []

  if (loading) {
    return (
      <div className="min-h-screen bg-gray-50">
        <CustomerHeader title="Team Management" />
        <div className="flex items-center justify-center h-[calc(100vh-64px)]">
          <Loader2 className="h-8 w-8 animate-spin text-slate-400" />
        </div>
      </div>
    )
  }

  if (error || !teamData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <CustomerHeader title="Team Management" />
        <div className="p-6 text-center">
          <AlertCircle className="h-12 w-12 text-red-400 mx-auto mb-4" />
          <p className="text-red-600 mb-4">{error || 'Failed to load team data'}</p>
          <Link href="/customer/dashboard">
            <Button variant="outline">
              <ArrowLeft className="h-4 w-4 mr-2" />
              Back to Dashboard
            </Button>
          </Link>
        </div>
      </div>
    )
  }

  // Check if there's a pending POC change request
  const hasPendingPocChange = teamData.pendingRequests.some(
    (req) => req.type === 'POC_CHANGE'
  )

  return (
    <div className="min-h-screen bg-gray-50">
      <CustomerHeader title="Team Management" />

      <div className="p-6 max-w-4xl mx-auto">
        {/* Back Link */}
        <Link
          href="/customer/dashboard"
          className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-6"
        >
          <ArrowLeft className="h-4 w-4 mr-1" />
          Back to Dashboard
        </Link>

        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Team Management</h1>
            <p className="text-slate-500 mt-1">{teamData.account.companyName}</p>
          </div>
          {teamData.isPrimaryPoc && (
            <Dialog open={addUserOpen} onOpenChange={setAddUserOpen}>
              <DialogTrigger asChild>
                <Button className="bg-green-600 hover:bg-green-700">
                  <UserPlus className="h-4 w-4 mr-2" />
                  Request New User
                </Button>
              </DialogTrigger>
              <DialogContent>
                <form onSubmit={handleAddUser}>
                  <DialogHeader>
                    <DialogTitle>Request New Team Member</DialogTitle>
                    <DialogDescription>
                      Submit a request to add a new user to your team. HTA admin will review and approve the request.
                    </DialogDescription>
                  </DialogHeader>

                  {addUserError && (
                    <div className="my-4 p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
                      {addUserError}
                    </div>
                  )}

                  <div className="space-y-4 my-4">
                    <div className="space-y-2">
                      <Label htmlFor="name">Full Name</Label>
                      <Input
                        id="name"
                        value={addUserName}
                        onChange={(e) => setAddUserName(e.target.value)}
                        placeholder="John Smith"
                        required
                        disabled={addUserSubmitting}
                      />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="email">Email Address</Label>
                      <Input
                        id="email"
                        type="email"
                        value={addUserEmail}
                        onChange={(e) => setAddUserEmail(e.target.value)}
                        placeholder="john.smith@company.com"
                        required
                        disabled={addUserSubmitting}
                      />
                    </div>
                  </div>

                  <DialogFooter>
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => setAddUserOpen(false)}
                      disabled={addUserSubmitting}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="bg-green-600 hover:bg-green-700"
                      disabled={addUserSubmitting}
                    >
                      {addUserSubmitting ? (
                        <>
                          <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                          Submitting...
                        </>
                      ) : (
                        'Submit Request'
                      )}
                    </Button>
                  </DialogFooter>
                </form>
              </DialogContent>
            </Dialog>
          )}
        </div>

        {/* Pending Requests */}
        {teamData.pendingRequests.length > 0 && (
          <Card className="mb-6 border-amber-200 bg-amber-50">
            <CardHeader className="pb-3">
              <CardTitle className="text-base flex items-center gap-2 text-amber-800">
                <Clock className="h-4 w-4" />
                Pending Requests
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {teamData.pendingRequests.map((req) => (
                <div
                  key={req.id}
                  className="flex items-center justify-between bg-white p-3 rounded-lg border border-amber-200"
                >
                  <div className="flex items-center gap-3">
                    {req.type === 'USER_ADDITION' ? (
                      <UserPlus className="h-5 w-5 text-blue-600" />
                    ) : (
                      <Crown className="h-5 w-5 text-purple-600" />
                    )}
                    <div>
                      <p className="font-medium text-slate-900">
                        {req.type === 'USER_ADDITION'
                          ? `Add: ${req.data.name} (${req.data.email})`
                          : 'POC Change Request'}
                      </p>
                      <p className="text-sm text-slate-500">
                        Submitted {format(new Date(req.createdAt), 'PPP')}
                      </p>
                    </div>
                  </div>
                  <Badge className="bg-amber-100 text-amber-700">Pending Review</Badge>
                </div>
              ))}
            </CardContent>
          </Card>
        )}

        {/* Team Members */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Users className="h-5 w-5 text-slate-400" />
              Team Members ({teamData.users.length})
            </CardTitle>
            {teamData.isPrimaryPoc && eligiblePocUsers.length > 0 && !hasPendingPocChange && (
              <Dialog open={pocChangeOpen} onOpenChange={setPocChangeOpen}>
                <DialogTrigger asChild>
                  <Button variant="outline" size="sm">
                    <Crown className="h-4 w-4 mr-2" />
                    Transfer POC
                  </Button>
                </DialogTrigger>
                <DialogContent>
                  <form onSubmit={handlePocChange}>
                    <DialogHeader>
                      <DialogTitle>Request POC Transfer</DialogTitle>
                      <DialogDescription>
                        Request to transfer your Primary Point of Contact role to another team member.
                        HTA admin will review and approve the request.
                      </DialogDescription>
                    </DialogHeader>

                    {pocChangeError && (
                      <div className="my-4 p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
                        {pocChangeError}
                      </div>
                    )}

                    <div className="space-y-4 my-4">
                      <div className="space-y-2">
                        <Label htmlFor="newPoc">New POC</Label>
                        <Select value={newPocUserId} onValueChange={setNewPocUserId}>
                          <SelectTrigger>
                            <SelectValue placeholder="Select a team member" />
                          </SelectTrigger>
                          <SelectContent>
                            {eligiblePocUsers.map((user) => (
                              <SelectItem key={user.id} value={user.id}>
                                {user.name} ({user.email})
                              </SelectItem>
                            ))}
                          </SelectContent>
                        </Select>
                      </div>
                      <div className="space-y-2">
                        <Label htmlFor="reason">Reason (optional)</Label>
                        <Textarea
                          id="reason"
                          value={pocChangeReason}
                          onChange={(e) => setPocChangeReason(e.target.value)}
                          placeholder="e.g., Role change, leaving company..."
                          rows={3}
                          disabled={pocChangeSubmitting}
                        />
                      </div>
                    </div>

                    <DialogFooter>
                      <Button
                        type="button"
                        variant="outline"
                        onClick={() => setPocChangeOpen(false)}
                        disabled={pocChangeSubmitting}
                      >
                        Cancel
                      </Button>
                      <Button
                        type="submit"
                        className="bg-purple-600 hover:bg-purple-700"
                        disabled={pocChangeSubmitting || !newPocUserId}
                      >
                        {pocChangeSubmitting ? (
                          <>
                            <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                            Submitting...
                          </>
                        ) : (
                          'Submit Request'
                        )}
                      </Button>
                    </DialogFooter>
                  </form>
                </DialogContent>
              </Dialog>
            )}
          </CardHeader>
          <CardContent>
            <div className="space-y-3">
              {teamData.users.map((user) => {
                const isPoc = user.id === teamData.account.primaryPocId
                const isCurrentUser = user.id === teamData.currentUserId

                return (
                  <div
                    key={user.id}
                    className="flex items-center justify-between p-4 bg-slate-50 rounded-lg border border-slate-200"
                  >
                    <div className="flex items-center gap-3">
                      <div className="h-10 w-10 bg-green-100 rounded-full flex items-center justify-center">
                        {isPoc ? (
                          <Crown className="h-5 w-5 text-amber-600" />
                        ) : (
                          <span className="text-green-700 font-bold text-sm">
                            {user.name.substring(0, 2).toUpperCase()}
                          </span>
                        )}
                      </div>
                      <div>
                        <div className="flex items-center gap-2">
                          <p className="font-medium text-slate-900">{user.name}</p>
                          {isPoc && (
                            <Badge className="bg-amber-100 text-amber-700 text-xs">
                              Primary POC
                            </Badge>
                          )}
                          {isCurrentUser && (
                            <Badge variant="outline" className="text-xs">
                              You
                            </Badge>
                          )}
                        </div>
                        <p className="text-sm text-slate-500">{user.email}</p>
                      </div>
                    </div>
                    <div className="flex items-center gap-2">
                      {user.isActive ? (
                        <div className="flex items-center gap-1 text-green-600 text-sm">
                          <CheckCircle className="h-4 w-4" />
                          <span>Active</span>
                        </div>
                      ) : (
                        <Badge className="bg-slate-100 text-slate-600">Pending Activation</Badge>
                      )}
                    </div>
                  </div>
                )
              })}
            </div>
          </CardContent>
        </Card>

        {/* Info for non-POC users */}
        {!teamData.isPrimaryPoc && (
          <div className="mt-6 p-4 bg-blue-50 border border-blue-200 rounded-lg">
            <div className="flex gap-3">
              <AlertCircle className="h-5 w-5 text-blue-600 flex-shrink-0" />
              <div>
                <p className="font-medium text-blue-800">View Only</p>
                <p className="text-sm text-blue-700 mt-1">
                  Only the Primary Point of Contact can request new team members or transfer the POC role.
                  Contact {teamData.primaryPoc?.name || 'your POC'} if you need to make changes.
                </p>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  )
}
