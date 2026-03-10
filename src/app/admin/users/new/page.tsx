'use client'

import { useState, useEffect } from 'react'
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
import { ArrowLeft, Loader2, Eye, EyeOff } from 'lucide-react'

interface HoD {
  id: string
  name: string
  email: string
  engineerCount: number
}

export default function CreateUserPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [showConfirm, setShowConfirm] = useState(false)
  const [hods, setHods] = useState<HoD[]>([])

  const [formData, setFormData] = useState({
    email: '',
    name: '',
    password: '',
    confirmPassword: '',
    role: 'ENGINEER',
    assignedHodId: '',
    isAdmin: false,
  })

  useEffect(() => {
    // Fetch HoDs for assignment dropdown
    fetch('/api/admin/users/hods')
      .then((res) => res.json())
      .then((data) => setHods(data.hods || []))
      .catch(console.error)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    // Validation
    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match')
      return
    }

    if (formData.password.length < 8) {
      setError('Password must be at least 8 characters')
      return
    }

    if (!/\d/.test(formData.password)) {
      setError('Password must contain at least one number')
      return
    }

    if (formData.role === 'ENGINEER' && !formData.assignedHodId) {
      setError('Please select an HoD for this engineer')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/admin/users', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          email: formData.email,
          name: formData.name,
          password: formData.password,
          role: formData.role,
          assignedHodId: formData.role === 'ENGINEER' ? formData.assignedHodId : undefined,
          isAdmin: formData.role === 'HOD' ? formData.isAdmin : false,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create user')
      }

      router.push('/admin/users')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create user')
    } finally {
      setLoading(false)
    }
  }

  return (
    <div className="p-3 h-full">
      {/* Master Bounding Box */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full">
        <div className="p-6 overflow-auto h-full">
          <div className="max-w-2xl">
            {/* Back Link */}
            <Link
              href="/admin/users"
              className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-6"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Users
            </Link>

            <Card>
              <CardHeader>
                <CardTitle>Create Staff User</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-6">
                  {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
                      {error}
                    </div>
                  )}

                  {/* Email */}
                  <div className="space-y-2">
                    <Label htmlFor="email">Email Address</Label>
                    <Input
                      id="email"
                      type="email"
                      placeholder="user@htaipl.com"
                      value={formData.email}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, email: e.target.value }))
                      }
                      required
                    />
                  </div>

                  {/* Name */}
                  <div className="space-y-2">
                    <Label htmlFor="name">Full Name</Label>
                    <Input
                      id="name"
                      type="text"
                      placeholder="John Doe"
                      value={formData.name}
                      onChange={(e) =>
                        setFormData((prev) => ({ ...prev, name: e.target.value }))
                      }
                      required
                    />
                  </div>

                  {/* Password */}
                  <div className="space-y-2">
                    <Label htmlFor="password">Password</Label>
                    <div className="relative">
                      <Input
                        id="password"
                        type={showPassword ? 'text' : 'password'}
                        placeholder="At least 8 characters with 1 number"
                        value={formData.password}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, password: e.target.value }))
                        }
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowPassword(!showPassword)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Confirm Password */}
                  <div className="space-y-2">
                    <Label htmlFor="confirmPassword">Confirm Password</Label>
                    <div className="relative">
                      <Input
                        id="confirmPassword"
                        type={showConfirm ? 'text' : 'password'}
                        placeholder="Re-enter password"
                        value={formData.confirmPassword}
                        onChange={(e) =>
                          setFormData((prev) => ({
                            ...prev,
                            confirmPassword: e.target.value,
                          }))
                        }
                        required
                      />
                      <button
                        type="button"
                        onClick={() => setShowConfirm(!showConfirm)}
                        className="absolute right-3 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-600"
                      >
                        {showConfirm ? (
                          <EyeOff className="h-4 w-4" />
                        ) : (
                          <Eye className="h-4 w-4" />
                        )}
                      </button>
                    </div>
                  </div>

                  {/* Role */}
                  <div className="space-y-2">
                    <Label htmlFor="role">Role</Label>
                    <Select
                      value={formData.role}
                      onValueChange={(value) =>
                        setFormData((prev) => ({ ...prev, role: value, assignedHodId: '', isAdmin: false }))
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
                      {hods.length === 0 && (
                        <p className="text-sm text-amber-600">
                          No HoDs available. Create an HoD first.
                        </p>
                      )}
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
                      disabled={loading}
                    >
                      Cancel
                    </Button>
                    <Button
                      type="submit"
                      className="bg-green-600 hover:bg-green-700"
                      disabled={loading}
                    >
                      {loading && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
                      Create User
                    </Button>
                  </div>
                </form>
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  )
}
