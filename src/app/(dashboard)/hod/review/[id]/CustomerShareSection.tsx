'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  Send,
  Mail,
  User,
  Building2,
  MessageSquare,
  CheckCircle,
  Loader2,
  AlertTriangle,
  FileText,
  Clock,
} from 'lucide-react'

interface CustomerShareSectionProps {
  certificateId: string
  certificateNumber: string
  uucDescription: string | null
  customerName: string | null
  customerEmail: string | null
  approvedAt?: string | null
  approvedBy?: string | null
}

export function CustomerShareSection({
  certificateId,
  certificateNumber,
  uucDescription,
  customerName: defaultCustomerName,
  customerEmail: defaultCustomerEmail,
  approvedAt,
  approvedBy,
}: CustomerShareSectionProps) {
  const router = useRouter()
  const [email, setEmail] = useState(defaultCustomerEmail || '')
  const [name, setName] = useState(defaultCustomerName || '')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const handleSendToCustomer = async () => {
    setError(null)

    // Validation
    if (!email.trim()) {
      setError('Customer email is required')
      return
    }
    if (!name.trim()) {
      setError('Customer name is required')
      return
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      setError('Please enter a valid email address')
      return
    }

    setIsSubmitting(true)

    try {
      const response = await fetch(`/api/certificates/${certificateId}/send-to-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: email,
          customerName: name,
          message: message.trim() || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to send to customer')
      }

      // Refresh the page to show the sent status
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Approval Status Banner */}
      <div className="bg-green-50 rounded-xl border-2 border-green-200 p-4">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-green-100 rounded-lg">
            <CheckCircle className="h-5 w-5 text-green-600" />
          </div>
          <div>
            <p className="font-semibold text-green-800">Approved by HoD</p>
            {approvedAt && (
              <p className="text-sm text-green-600">
                {new Date(approvedAt).toLocaleDateString('en-GB', {
                  day: 'numeric',
                  month: 'short',
                  year: 'numeric',
                  hour: '2-digit',
                  minute: '2-digit',
                })}
                {approvedBy && ` by ${approvedBy}`}
              </p>
            )}
          </div>
        </div>
      </div>

      {/* Send to Customer Section */}
      <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
              <Send className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Send to Customer</h3>
              <p className="text-xs text-slate-500">Send review link to customer email</p>
            </div>
          </div>
        </div>

        <div className="p-5 space-y-4">
          {/* Certificate Info */}
          <div className="flex items-center gap-3 p-3 bg-slate-50 rounded-lg border border-slate-200">
            <FileText className="h-5 w-5 text-slate-400" />
            <div>
              <p className="font-medium text-slate-900 text-sm">{certificateNumber}</p>
              <p className="text-xs text-slate-500">{uucDescription || 'No description'}</p>
            </div>
          </div>

          {/* Customer Email */}
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
              <Mail className="h-4 w-4" />
              Customer Email <span className="text-red-500">*</span>
            </Label>
            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="customer@company.com"
              className="text-sm"
              disabled={isSubmitting}
            />
          </div>

          {/* Customer Name */}
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
              <User className="h-4 w-4" />
              Customer Name <span className="text-red-500">*</span>
            </Label>
            <Input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Contact person name"
              className="text-sm"
              disabled={isSubmitting}
            />
          </div>

          {/* Optional Message */}
          <div>
            <Label className="text-sm font-medium text-slate-700 mb-2 flex items-center gap-2">
              <MessageSquare className="h-4 w-4" />
              Message (optional)
            </Label>
            <textarea
              value={message}
              onChange={(e) => setMessage(e.target.value)}
              placeholder="Add a personal message to the email..."
              className="w-full px-3 py-2 border border-slate-200 rounded-lg text-sm resize-none focus:ring-2 focus:ring-primary focus:border-primary"
              rows={3}
              disabled={isSubmitting}
            />
          </div>

          {/* Error Display */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {/* Send Button */}
          <Button
            onClick={handleSendToCustomer}
            disabled={isSubmitting}
            className="w-full h-10 bg-primary hover:bg-primary/90"
          >
            {isSubmitting ? (
              <>
                <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                Sending...
              </>
            ) : (
              <>
                <Mail className="h-4 w-4 mr-2" />
                Send to Customer
              </>
            )}
          </Button>

          {/* Info Text */}
          <div className="flex items-start gap-2 p-3 bg-blue-50 border border-blue-200 rounded-lg">
            <Clock className="h-4 w-4 text-blue-600 flex-shrink-0 mt-0.5" />
            <p className="text-xs text-blue-700">
              A secure review link will be generated and sent to the customer. The link will expire in 7 days.
            </p>
          </div>
        </div>
      </div>
    </div>
  )
}
