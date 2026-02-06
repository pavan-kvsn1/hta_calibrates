'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import {
  Mail,
  User,
  Calendar,
  Clock,
  CheckCircle,
  Copy,
  RefreshCw,
  ExternalLink,
  Loader2,
  AlertTriangle,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface SentToCustomerStatusProps {
  certificateId: string
  certificateNumber: string
  uucDescription: string | null
  sentTo: {
    email: string
    name: string
    sentAt: string
  }
  token: {
    token: string
    expiresAt: string
  }
  reviewUrl: string
  message?: string | null
}

export function SentToCustomerStatus({
  certificateId,
  certificateNumber,
  uucDescription,
  sentTo,
  token,
  reviewUrl,
  message,
}: SentToCustomerStatusProps) {
  const router = useRouter()
  const [isResending, setIsResending] = useState(false)
  const [copied, setCopied] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [successMessage, setSuccessMessage] = useState<string | null>(null)

  const isExpired = new Date(token.expiresAt) < new Date()
  const expiresDate = new Date(token.expiresAt)
  const daysRemaining = Math.max(0, Math.ceil((expiresDate.getTime() - Date.now()) / (1000 * 60 * 60 * 24)))

  const handleCopyLink = async () => {
    try {
      await navigator.clipboard.writeText(reviewUrl)
      setCopied(true)
      setTimeout(() => setCopied(false), 2000)
    } catch (err) {
      setError('Failed to copy link')
    }
  }

  const handleResend = async () => {
    setIsResending(true)
    setError(null)
    setSuccessMessage(null)

    try {
      const response = await fetch(`/api/certificates/${certificateId}/send-to-customer`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          customerEmail: sentTo.email,
          customerName: sentTo.name,
          message: message || undefined,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to resend')
      }

      setSuccessMessage('Review link resent successfully')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to resend')
    } finally {
      setIsResending(false)
    }
  }

  return (
    <div className="space-y-4">
      {/* Status Banner */}
      <div className={cn(
        "rounded-xl border-2 p-4",
        isExpired
          ? "bg-red-50 border-red-200"
          : "bg-amber-50 border-amber-200"
      )}>
        <div className="flex items-center gap-3">
          <div className={cn(
            "p-2 rounded-lg",
            isExpired ? "bg-red-100" : "bg-amber-100"
          )}>
            <Clock className={cn(
              "h-5 w-5",
              isExpired ? "text-red-600" : "text-amber-600"
            )} />
          </div>
          <div>
            <p className={cn(
              "font-semibold",
              isExpired ? "text-red-800" : "text-amber-800"
            )}>
              {isExpired ? 'Link Expired' : 'Awaiting Customer Response'}
            </p>
            <p className={cn(
              "text-sm",
              isExpired ? "text-red-600" : "text-amber-600"
            )}>
              {isExpired
                ? 'The review link has expired. Please resend.'
                : `${daysRemaining} day${daysRemaining !== 1 ? 's' : ''} remaining`
              }
            </p>
          </div>
        </div>
      </div>

      {/* Sent Details Card */}
      <div className="bg-white rounded-xl border-2 border-slate-200 overflow-hidden shadow-sm">
        <div className="px-5 py-4 bg-gradient-to-r from-slate-50 to-slate-100 border-b-2 border-slate-100">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-white rounded-lg shadow-sm border border-slate-200">
              <Mail className="h-5 w-5 text-primary" />
            </div>
            <div>
              <h3 className="font-semibold text-slate-800">Sent to Customer</h3>
              <p className="text-xs text-slate-500">Review link sent via email</p>
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

          {/* Customer Details */}
          <div className="space-y-3">
            <div className="flex items-center gap-3">
              <Mail className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Email</p>
                <p className="text-sm font-medium text-slate-800">{sentTo.email}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <User className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Name</p>
                <p className="text-sm font-medium text-slate-800">{sentTo.name}</p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Calendar className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Sent At</p>
                <p className="text-sm font-medium text-slate-800">
                  {new Date(sentTo.sentAt).toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>

            <div className="flex items-center gap-3">
              <Clock className="h-4 w-4 text-slate-400" />
              <div>
                <p className="text-xs text-slate-500">Expires At</p>
                <p className={cn(
                  "text-sm font-medium",
                  isExpired ? "text-red-600" : "text-slate-800"
                )}>
                  {expiresDate.toLocaleDateString('en-GB', {
                    day: 'numeric',
                    month: 'short',
                    year: 'numeric',
                    hour: '2-digit',
                    minute: '2-digit',
                  })}
                </p>
              </div>
            </div>
          </div>

          {/* Message if present */}
          {message && (
            <div className="p-3 bg-slate-50 rounded-lg border border-slate-200">
              <p className="text-xs text-slate-500 mb-1">Message sent:</p>
              <p className="text-sm text-slate-700 italic">"{message}"</p>
            </div>
          )}

          {/* Error / Success Messages */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2 p-3 bg-green-50 border border-green-200 rounded-lg">
              <CheckCircle className="h-4 w-4 text-green-600 flex-shrink-0" />
              <p className="text-sm text-green-600">{successMessage}</p>
            </div>
          )}

          {/* Action Buttons */}
          <div className="space-y-2 pt-2">
            <Button
              onClick={handleCopyLink}
              variant="outline"
              className="w-full h-9 text-sm"
              disabled={isExpired}
            >
              {copied ? (
                <>
                  <CheckCircle className="h-4 w-4 mr-2 text-green-600" />
                  Copied!
                </>
              ) : (
                <>
                  <Copy className="h-4 w-4 mr-2" />
                  Copy Review Link
                </>
              )}
            </Button>

            <Button
              onClick={handleResend}
              variant="outline"
              className={cn(
                "w-full h-9 text-sm",
                isExpired && "border-primary text-primary hover:bg-primary/5"
              )}
              disabled={isResending}
            >
              {isResending ? (
                <>
                  <Loader2 className="h-4 w-4 mr-2 animate-spin" />
                  Resending...
                </>
              ) : (
                <>
                  <RefreshCw className="h-4 w-4 mr-2" />
                  {isExpired ? 'Resend (Generate New Link)' : 'Resend Email'}
                </>
              )}
            </Button>

            {!isExpired && (
              <a
                href={reviewUrl}
                target="_blank"
                rel="noopener noreferrer"
                className="flex items-center justify-center gap-2 w-full h-9 text-sm border border-slate-200 rounded-lg hover:bg-slate-50 text-slate-700 transition-colors"
              >
                <ExternalLink className="h-4 w-4" />
                Preview Customer View
              </a>
            )}
          </div>

          {/* Help Text */}
          <p className="text-xs text-slate-400 text-center pt-2">
            Customer will receive an email with a link to review and approve the certificate.
          </p>
        </div>
      </div>
    </div>
  )
}
