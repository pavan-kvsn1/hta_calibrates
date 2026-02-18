'use client'

import { useState } from 'react'
import Image from 'next/image'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { signOut } from 'next-auth/react'
import { Button } from '@/components/ui/button'
import { SignatureModal } from '@/components/signatures'
import type { SignatureData } from '@/types/signatures'
import { CustomerPDFViewer } from './CustomerPDFViewer'
import {
  Clock,
  Calendar,
  Building2,
  CheckCircle,
  Loader2,
  ChevronLeft,
  LogOut,
  Send,
  MessageSquare,
  FileEdit,
} from 'lucide-react'

interface CertificateData {
  id: string
  certificateNumber: string
  status: string
  customerName: string | null
  customerAddress: string | null
  uucDescription: string | null
  uucMake: string | null
  uucModel: string | null
  uucSerialNumber: string | null
  dateOfCalibration: string | null
  calibrationDueDate: string | null
  currentRevision: number
}

interface CustomerData {
  id: string
  name: string
  email: string
  companyName: string
}

interface RevisionHistoryItem {
  id: string
  type: 'customer_request' | 'hod_response' | 'sent_to_customer'
  message: string
  createdAt: string
  userName?: string
  companyName?: string
}

interface CustomerReviewClientProps {
  token: string
  certificate: CertificateData
  customer: CustomerData
  expiresAt: string | null // null for session-based access (no token)
  revisionHistory?: RevisionHistoryItem[]
}

function formatDate(dateStr: string | null): string {
  if (!dateStr) return '-'
  return new Date(dateStr).toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  })
}

function getInitials(name: string): string {
  if (!name) return 'C'
  const parts = name.split(' ')
  if (parts.length >= 2) {
    return `${parts[0][0]}${parts[parts.length - 1][0]}`.toUpperCase()
  }
  return name.substring(0, 2).toUpperCase()
}

export function CustomerReviewClient({
  token,
  certificate,
  customer,
  expiresAt,
  revisionHistory = [],
}: CustomerReviewClientProps) {
  const router = useRouter()
  const [showApproveModal, setShowApproveModal] = useState(false)
  const [revisionNotes, setRevisionNotes] = useState('')
  const [isRequestingRevision, setIsRequestingRevision] = useState(false)
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [submitError, setSubmitError] = useState<string | null>(null)
  const [revisionError, setRevisionError] = useState<string | null>(null)

  // Check if certificate is being revised by engineer (no approval allowed)
  const isBeingRevised = certificate.status === 'REVISION_REQUIRED'

  // Check if certificate is already approved/completed (read-only mode)
  const isCompleted = ['APPROVED', 'PENDING_ADMIN_AUTHORIZATION', 'PENDING_ADMIN_APPROVAL', 'AUTHORIZED'].includes(certificate.status)

  const handleApprove = async (data: SignatureData) => {
    setIsSubmitting(true)
    setSubmitError(null)

    try {
      // Encode token to handle special characters like colon in cert:ID format
      const encodedToken = encodeURIComponent(token)
      const response = await fetch(`/api/customer/review/${encodedToken}/approve`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureData: data.signatureImage,
          signerName: data.signerName,
          signerEmail: customer.email,
          clientEvidence: data.clientEvidence,
        }),
      })

      if (response.ok) {
        // For session-based access, redirect to dashboard instead of token-based success page
        if (token.startsWith('cert:')) {
          router.push('/customer/dashboard')
        } else {
          router.push(`/customer/review/${encodedToken}/success`)
        }
      } else {
        // Try to parse error response, handle empty responses
        let errorMessage = 'Failed to approve certificate'
        try {
          const text = await response.text()
          if (text) {
            const responseData = JSON.parse(text)
            errorMessage = responseData.error || errorMessage
          }
        } catch {
          // Response was not JSON or empty
          errorMessage = `Server error (${response.status})`
        }
        setSubmitError(errorMessage)
      }
    } catch (error) {
      console.error('Approval error:', error)
      setSubmitError('An error occurred. Please try again.')
    } finally {
      setIsSubmitting(false)
    }
  }

  const handleRequestRevision = async () => {
    if (!revisionNotes.trim()) {
      setRevisionError('Please provide feedback for the revision request')
      return
    }

    setIsRequestingRevision(true)
    setRevisionError(null)

    try {
      // Encode token to handle special characters like colon in cert:ID format
      const encodedToken = encodeURIComponent(token)
      const response = await fetch(`/api/customer/review/${encodedToken}/reject`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ notes: revisionNotes }),
      })

      if (response.ok) {
        // For session-based access, redirect to dashboard instead of token-based success page
        if (token.startsWith('cert:')) {
          router.push('/customer/dashboard')
        } else {
          router.push(`/customer/review/${encodedToken}/revision-requested`)
        }
      } else {
        // Try to parse error response, handle empty responses
        let errorMessage = 'Failed to submit revision request'
        try {
          const text = await response.text()
          if (text) {
            const data = JSON.parse(text)
            errorMessage = data.error || errorMessage
          }
        } catch {
          // Response was not JSON or empty
          errorMessage = `Server error (${response.status})`
        }
        setRevisionError(errorMessage)
      }
    } catch (error) {
      console.error('Revision request error:', error)
      setRevisionError('An error occurred. Please try again.')
    } finally {
      setIsRequestingRevision(false)
    }
  }

  return (
    <div className="h-screen bg-gray-50 flex flex-col overflow-hidden">
      {/* Header */}
      <header className="bg-white border-b px-4 py-2.5 z-50 flex-shrink-0">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Image
              src="/hta-logo.jpg"
              alt="HTA Instrumentation"
              width={50}
              height={25}
              className="object-contain"
            />
            <div className="h-5 w-px bg-gray-300" />
            <span className="text-sm font-bold text-gray-700">
              Certificate Review: {certificate.certificateNumber}
            </span>
          </div>

          {/* Right: User Info */}
          <div className="flex items-center gap-3">
            {/* Token Expiry (if token-based) */}
            {expiresAt && (
              <div className="hidden md:flex items-center gap-2 text-xs text-gray-500">
                <Clock className="h-3.5 w-3.5" />
                <span>Expires: {formatDate(expiresAt)}</span>
              </div>
            )}

            {/* Company Name Badge */}
            <div className="hidden md:flex items-center gap-1.5 text-xs text-gray-600 bg-gray-50 px-2.5 py-1 rounded-full border border-gray-100">
              <Building2 className="h-3.5 w-3.5" />
              <span>{customer.companyName}</span>
            </div>

            {/* User Avatar and Info */}
            <div className="flex items-center gap-2 pl-3 border-l border-gray-200">
              <div className="flex items-center gap-2">
                <div className="h-7 w-7 rounded-full ring-1 ring-gray-100 bg-green-600 text-white flex items-center justify-center font-bold text-xs">
                  {getInitials(customer.name)}
                </div>
                <div className="hidden sm:block">
                  <p className="text-xs font-semibold text-gray-800">{customer.name}</p>
                  <p className="text-[10px] text-gray-500">Customer</p>
                </div>
              </div>

              <button
                onClick={() => signOut({ callbackUrl: '/customer/login' })}
                className="p-1.5 hover:bg-gray-50 rounded-full transition-colors text-gray-500 hover:text-gray-700"
                title="Sign out"
              >
                <LogOut className="h-3.5 w-3.5" />
              </button>
            </div>
          </div>
        </div>
      </header>

      {/* Certificate Info Banner */}
      <div className="bg-white border-b px-4 py-2 flex-shrink-0">
        <div className="flex items-center justify-between">
          {/* Left: Back to Dashboard */}
          <Link href="/customer/dashboard" className="text-sm font-semibold hover:text-gray-700 flex items-center gap-1">
            <ChevronLeft className="h-4 w-4" />
            Back to Dashboard
          </Link>

          {/* Right: Certificate Info */}
          <div className="flex flex-wrap items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-gray-500">Instrument:</span>
              <span className="font-medium">{certificate.uucDescription || 'N/A'}</span>
            </div>
            {certificate.uucMake && (
              <>
                <div className="h-4 w-px bg-gray-300" />
                <span className="text-gray-500">{certificate.uucMake} {certificate.uucModel}</span>
              </>
            )}
            <div className="h-4 w-px bg-gray-300" />
            <div className="flex items-center gap-2">
              <Calendar className="h-4 w-4 text-gray-400" />
              <span>Calibration: {formatDate(certificate.dateOfCalibration)}</span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content - Full Width & Full Height */}
      <div className="flex-1 w-full px-4 py-4 overflow-hidden flex flex-col min-h-0">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-4 flex-1 min-h-0">
          {/* PDF Preview Panel */}
          <div className="lg:col-span-2 bg-white rounded-lg border shadow-sm overflow-hidden flex flex-col min-h-0">
            <CustomerPDFViewer
              token={token}
              certificateNumber={certificate.certificateNumber}
            />
          </div>

          {/* Right Side Panels */}
          <div className="flex flex-col gap-4 overflow-hidden min-h-0">
            {/* Revision History Panel - WhatsApp Style */}
            <div className="bg-white rounded-lg border shadow-sm flex flex-col flex-1 overflow-hidden min-h-0">
              <div className="px-4 py-3 border-b bg-gray-50">
                <div className="flex items-center gap-2">
                  <MessageSquare className="h-4 w-4 text-gray-500" />
                  <h2 className="font-semibold text-gray-900 text-[13px]">Conversation</h2>
                  {revisionHistory.length > 0 && (
                    <span className="text-[10px] px-1.5 py-0.5 rounded-full bg-gray-200 text-gray-600 font-medium">
                      {revisionHistory.length}
                    </span>
                  )}
                </div>
              </div>

              {/* Chat Messages */}
              <div className="flex-1 p-3 overflow-y-auto bg-gray-50 flex flex-col-reverse">
                {revisionHistory.length === 0 ? (
                  <div className="text-[12px] text-gray-500 text-center py-4">
                    <p>No messages yet.</p>
                    <p className="text-[11px] mt-1">Send feedback below if changes are needed.</p>
                  </div>
                ) : (
                  <div className="flex flex-col gap-2">
                    {/* Sort oldest first for chat display */}
                    {[...revisionHistory].reverse().map((item) => {
                      const isOwnMessage = item.type === 'customer_request'
                      return (
                        <div
                          key={item.id}
                          className={`flex ${isOwnMessage ? 'justify-end' : 'justify-start'}`}
                        >
                          <div
                            className={`relative max-w-[85%] px-3 py-2 rounded-lg text-[12px] border ${
                              isOwnMessage
                                ? 'bg-purple-50 border-purple-200 rounded-br-none'
                                : item.type === 'hod_response'
                                ? 'bg-orange-50 border-orange-200 rounded-bl-none'
                                : 'bg-blue-50 border-blue-200 rounded-bl-none'
                            }`}
                          >
                            {/* Sender label for non-self messages */}
                            {!isOwnMessage && (
                              <p className={`text-[10px] font-semibold mb-0.5 ${
                                item.type === 'hod_response' ? 'text-orange-600' : 'text-blue-600'
                              }`}>
                                {item.type === 'hod_response' ? 'HoD' : 'HTA'}
                                {item.userName && ` • ${item.userName}`}
                              </p>
                            )}
                            {/* Message content */}
                            <p className="text-gray-700 whitespace-pre-wrap">{item.message}</p>
                            {/* Timestamp */}
                            <p className={`text-[9px] mt-1 ${isOwnMessage ? 'text-purple-400 text-right' : 'text-gray-400'}`}>
                              {new Date(item.createdAt).toLocaleString('en-IN', {
                                day: 'numeric',
                                month: 'short',
                                hour: '2-digit',
                                minute: '2-digit',
                              })}
                            </p>
                          </div>
                        </div>
                      )
                    })}
                  </div>
                )}
              </div>

              {/* Message Input */}
              {isCompleted ? (
                <div className="p-3 border-t bg-green-50">
                  <div className="flex items-center gap-2 text-green-700">
                    <CheckCircle className="h-4 w-4" />
                    <span className="text-[12px] font-medium">Certificate approved</span>
                  </div>
                </div>
              ) : (
                <div className="p-2 border-t bg-gray-50">
                  <div className="flex gap-2 items-end">
                    <textarea
                      value={revisionNotes}
                      onChange={(e) => setRevisionNotes(e.target.value)}
                      placeholder="Type a message..."
                      className="flex-1 p-2 border border-gray-200 rounded-lg text-xs resize-none focus:ring-2 focus:ring-purple-500 focus:border-purple-500 max-h-20 bg-white"
                      rows={1}
                      onInput={(e) => {
                        const target = e.target as HTMLTextAreaElement
                        target.style.height = 'auto'
                        target.style.height = Math.min(target.scrollHeight, 80) + 'px'
                      }}
                    />
                    <Button
                      onClick={handleRequestRevision}
                      disabled={!revisionNotes.trim() || isRequestingRevision}
                      size="sm"
                      className="h-8 w-8 rounded-full p-0 flex-shrink-0"
                    >
                      {isRequestingRevision ? (
                        <Loader2 className="h-4 w-4 animate-spin" />
                      ) : (
                        <Send className="h-4 w-4" />
                      )}
                    </Button>
                  </div>
                  {revisionError && (
                    <p className="text-[11px] text-red-600 mt-1 px-2">{revisionError}</p>
                  )}
                </div>
              )}
            </div>

            {/* Approval Panel */}
            {isCompleted ? (
              /* Certificate is approved/completed */
              <div className="bg-white rounded-lg border shadow-sm flex flex-col">
                <div className="px-4 py-3 border-b bg-green-50">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <h2 className="font-semibold text-green-800 text-[13px]">
                      {certificate.status === 'AUTHORIZED' ? 'Completed' : 'Approved'}
                    </h2>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-[12px] text-gray-600 text-center">
                    {certificate.status === 'AUTHORIZED'
                      ? 'This certificate has been fully authorized and completed.'
                      : 'This certificate has been approved and signed. Awaiting final admin authorization.'}
                  </p>
                </div>

                {/* Customer Info */}
                <div className="px-4 py-3 border-t bg-gray-50">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{customer.companyName}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Reviewed as: {customer.email}</p>
                </div>
              </div>
            ) : isBeingRevised ? (
              /* Certificate is being revised by engineer - no approval allowed */
              <div className="bg-white rounded-lg border shadow-sm flex flex-col">
                <div className="px-4 py-3 border-b bg-blue-50">
                  <div className="flex items-center gap-2">
                    <FileEdit className="h-4 w-4 text-blue-600" />
                    <h2 className="font-semibold text-blue-800 text-[13px]">Under Revision</h2>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-[12px] text-gray-600 text-center">
                    Your feedback has been forwarded to the engineer. The certificate is being updated.
                  </p>
                </div>

                {/* Customer Info */}
                <div className="px-4 py-3 border-t bg-gray-50">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{customer.companyName}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Reviewing as: {customer.email}</p>
                </div>
              </div>
            ) : (
              /* Customer can approve or request changes */
              <div className="bg-white rounded-lg border shadow-sm flex flex-col">
                <div className="px-4 py-3 border-b bg-gray-50">
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-4 w-4 text-green-600" />
                    <h2 className="font-semibold text-gray-900 text-[13px]">Approval</h2>
                  </div>
                </div>
                <div className="p-4">
                  <p className="text-[11px] text-gray-500 mb-3 text-center">
                    By approving, you confirm all details are correct.
                  </p>
                  <Button
                    onClick={() => setShowApproveModal(true)}
                    className="w-full bg-green-600 hover:bg-green-700 text-sm h-10"
                  >
                    <CheckCircle className="h-4 w-4 mr-2" />
                    Approve & Sign
                  </Button>
                </div>

                {/* Customer Info */}
                <div className="px-4 py-3 border-t bg-gray-50">
                  <div className="flex items-center gap-2 text-xs text-gray-600">
                    <Building2 className="h-3.5 w-3.5" />
                    <span>{customer.companyName}</span>
                  </div>
                  <p className="text-[11px] text-gray-400 mt-1">Reviewing as: {customer.email}</p>
                </div>
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Approve Modal */}
      <SignatureModal
        isOpen={showApproveModal}
        onClose={() => {
          setShowApproveModal(false)
          setSubmitError(null)
        }}
        onConfirm={handleApprove}
        defaultName={customer.name}
        nameReadOnly={true}
        title="Approve Certificate"
        description="Please sign below to approve this calibration certificate. Your signature will be added to the final document."
        confirmLabel="Confirm Approval"
        loading={isSubmitting}
        error={submitError}
      />

    </div>
  )
}
