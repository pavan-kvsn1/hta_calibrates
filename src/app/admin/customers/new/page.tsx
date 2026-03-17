'use client'

import { useState, useEffect } from 'react'
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
import { ArrowLeft, Loader2, Info } from 'lucide-react'

interface Admin {
  id: string
  name: string
  email: string
  adminType: string | null
}

export default function CreateCustomerPage() {
  const router = useRouter()
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [admins, setAdmins] = useState<Admin[]>([])

  const [formData, setFormData] = useState({
    companyName: '',
    address: '',
    contactEmail: '',
    contactPhone: '',
    assignedAdminId: '',
    pocName: '',
    pocEmail: '',
  })

  useEffect(() => {
    // Fetch Admins for assignment dropdown
    fetch('/api/admin/users/admins')
      .then((res) => res.json())
      .then((data) => setAdmins(data.admins || []))
      .catch(console.error)
  }, [])

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault()
    setError('')

    if (!formData.companyName.trim()) {
      setError('Company name is required')
      return
    }

    if (!formData.pocName.trim()) {
      setError('POC name is required')
      return
    }

    if (!formData.pocEmail.trim()) {
      setError('POC email is required')
      return
    }

    // Basic email validation
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
    if (!emailRegex.test(formData.pocEmail)) {
      setError('Please enter a valid POC email address')
      return
    }

    setLoading(true)

    try {
      const res = await fetch('/api/admin/customers', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          companyName: formData.companyName,
          address: formData.address || undefined,
          contactEmail: formData.contactEmail || undefined,
          contactPhone: formData.contactPhone || undefined,
          assignedAdminId: formData.assignedAdminId || undefined,
          pocName: formData.pocName,
          pocEmail: formData.pocEmail,
        }),
      })

      const data = await res.json()

      if (!res.ok) {
        throw new Error(data.error || 'Failed to create customer account')
      }

      router.push('/admin/customers')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to create account')
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
              href="/admin/customers"
              className="inline-flex items-center text-sm text-slate-600 hover:text-slate-900 mb-6"
            >
              <ArrowLeft className="h-4 w-4 mr-1" />
              Back to Customer Accounts
            </Link>

            <Card>
              <CardHeader>
                <CardTitle>Create Customer Account</CardTitle>
              </CardHeader>
              <CardContent>
                <form onSubmit={handleSubmit} className="space-y-8">
                  {error && (
                    <div className="p-3 text-sm text-red-600 bg-red-50 rounded-lg border border-red-200">
                      {error}
                    </div>
                  )}

                  {/* Company Information Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">
                      Company Information
                    </h3>

                    {/* Company Name */}
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Company Name *</Label>
                      <Input
                        id="companyName"
                        type="text"
                        placeholder="Acme Industries Pvt Ltd"
                        value={formData.companyName}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, companyName: e.target.value }))
                        }
                        required
                      />
                    </div>

                    {/* Address */}
                    <div className="space-y-2">
                      <Label htmlFor="address">Address</Label>
                      <Textarea
                        id="address"
                        placeholder="123 Industrial Area, City, State"
                        value={formData.address}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, address: e.target.value }))
                        }
                        rows={3}
                      />
                    </div>

                    {/* Contact Email */}
                    <div className="space-y-2">
                      <Label htmlFor="contactEmail">Contact Email</Label>
                      <Input
                        id="contactEmail"
                        type="email"
                        placeholder="info@company.com"
                        value={formData.contactEmail}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, contactEmail: e.target.value }))
                        }
                      />
                    </div>

                    {/* Contact Phone */}
                    <div className="space-y-2">
                      <Label htmlFor="contactPhone">Contact Phone</Label>
                      <Input
                        id="contactPhone"
                        type="tel"
                        placeholder="+91 9876543210"
                        value={formData.contactPhone}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, contactPhone: e.target.value }))
                        }
                      />
                    </div>
                  </div>

                  {/* Primary POC Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">
                      Primary Point of Contact (POC)
                    </h3>

                    {/* POC Name */}
                    <div className="space-y-2">
                      <Label htmlFor="pocName">POC Name *</Label>
                      <Input
                        id="pocName"
                        type="text"
                        placeholder="John Smith"
                        value={formData.pocName}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, pocName: e.target.value }))
                        }
                        required
                      />
                    </div>

                    {/* POC Email */}
                    <div className="space-y-2">
                      <Label htmlFor="pocEmail">POC Email *</Label>
                      <Input
                        id="pocEmail"
                        type="email"
                        placeholder="john.smith@company.com"
                        value={formData.pocEmail}
                        onChange={(e) =>
                          setFormData((prev) => ({ ...prev, pocEmail: e.target.value }))
                        }
                        required
                      />
                    </div>

                    <div className="flex gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
                      <Info className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
                      <p className="text-blue-800 text-sm">
                        An activation email will be sent to the POC upon creation.
                        The POC will set their password when activating their account.
                      </p>
                    </div>
                  </div>

                  {/* Assignment Section */}
                  <div className="space-y-4">
                    <h3 className="text-lg font-semibold text-slate-900 border-b pb-2">
                      Assignment
                    </h3>

                    {/* Assigned Admin */}
                    <div className="space-y-2">
                      <Label htmlFor="assignedAdminId">Assigned Admin</Label>
                      <Select
                        value={formData.assignedAdminId || 'none'}
                        onValueChange={(value) =>
                          setFormData((prev) => ({ ...prev, assignedAdminId: value === 'none' ? '' : value }))
                        }
                      >
                        <SelectTrigger>
                          <SelectValue placeholder="Select Admin (optional)..." />
                        </SelectTrigger>
                        <SelectContent>
                          <SelectItem value="none">No Admin assigned</SelectItem>
                          {admins.map((admin) => (
                            <SelectItem key={admin.id} value={admin.id}>
                              {admin.name}
                            </SelectItem>
                          ))}
                        </SelectContent>
                      </Select>
                      <p className="text-xs text-slate-500">
                        The assigned Admin will manage customer communications for certificates
                      </p>
                    </div>
                  </div>

                  {/* Actions */}
                  <div className="flex gap-3 pt-4 border-t">
                    <Button
                      type="button"
                      variant="outline"
                      onClick={() => router.push('/admin/customers')}
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
                      Create Account
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
