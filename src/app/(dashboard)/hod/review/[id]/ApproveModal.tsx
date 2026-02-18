'use client'

import { useState, useRef, useCallback, useEffect } from 'react'
import { useSession } from 'next-auth/react'
import { createPortal } from 'react-dom'
import { Button } from '@/components/ui/button'
import { Input } from '@/components/ui/input'
import { Label } from '@/components/ui/label'
import {
  CheckCircle,
  Mail,
  X,
  Loader2,
  AlertTriangle,
  FileText,
} from 'lucide-react'
import { cn } from '@/lib/utils'
import TypedSignature, { type TypedSignatureHandle } from '@/components/signatures/TypedSignature'
import { CONSENT_STATEMENTS, CONSENT_VERSION } from '@/lib/consent-text'
import type { ClientEvidence } from '@/types/signatures'

interface ApproveModalProps {
  isOpen: boolean
  onClose: () => void
  certificateId: string
  certificateNumber: string
  uucDescription: string | null
  customerName: string | null
  customerEmail: string | null
  pendingEditsCount: number
  onApprove: (sendEmail: boolean, customerData?: { email: string; name: string; message?: string }, signatureInfo?: { signatureImage: string; signerName: string; clientEvidence: ClientEvidence }) => Promise<void>
}

type ApprovalOption = 'approve-only' | 'approve-send'

export function ApproveModal({
  isOpen,
  onClose,
  certificateId,
  certificateNumber,
  uucDescription,
  customerName,
  customerEmail,
  pendingEditsCount,
  onApprove,
}: ApproveModalProps) {
  const { data: session } = useSession()
  const [selectedOption, setSelectedOption] = useState<ApprovalOption>('approve-send')
  const [email, setEmail] = useState(customerEmail || '')
  const [name, setName] = useState(customerName || '')
  const [message, setMessage] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Signature state - pre-fill with session user's name
  const signatureRef = useRef<TypedSignatureHandle>(null)
  const [hasSignature, setHasSignature] = useState(false)
  const signerName = session?.user?.name || '' // Read-only from session
  const [mounted, setMounted] = useState(false)

  // Consent state
  const [consentAccepted, setConsentAccepted] = useState(false)
  const [consentAcceptedAt, setConsentAcceptedAt] = useState<number | null>(null)

  // For SSR safety - only render portal after mount
  useEffect(() => {
    setMounted(true)
  }, [])

  const handleSignatureReady = useCallback((hasSig: boolean) => {
    setHasSignature(hasSig)
  }, [])

  if (!isOpen || !mounted) return null

  const handleSubmit = async () => {
    setError(null)

    // Validate consent
    if (!consentAccepted) {
      setError('Please accept the consent statements before signing')
      return
    }

    // Validate signature
    if (!hasSignature) {
      setError('Please sign to approve this certificate')
      return
    }
    if (!signerName.trim()) {
      setError('Please enter your name')
      return
    }

    if (selectedOption === 'approve-send') {
      if (!email.trim()) {
        setError('Customer email is required')
        return
      }
      if (!name.trim()) {
        setError('Customer name is required')
        return
      }
      // Basic email validation
      if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
        setError('Please enter a valid email address')
        return
      }
    }

    setIsSubmitting(true)

    const signatureImage = signatureRef.current?.toDataURL() || ''

    // Collect client evidence
    const clientEvidence: ClientEvidence = {
      clientTimestamp: Date.now(),
      userAgent: navigator.userAgent,
      screenResolution: `${screen.width}x${screen.height}`,
      timezone: Intl.DateTimeFormat().resolvedOptions().timeZone,
      canvasSize: { width: 400, height: 150 },
      consentVersion: CONSENT_VERSION,
      consentAcceptedAt: consentAcceptedAt!,
    }

    const signatureInfo = { signatureImage, signerName: signerName.trim(), clientEvidence }

    try {
      if (selectedOption === 'approve-send') {
        await onApprove(true, { email, name, message: message.trim() || undefined }, signatureInfo)
      } else {
        await onApprove(false, undefined, signatureInfo)
      }
      onClose()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  return createPortal(
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-[100] p-4">
      <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="p-2 bg-green-100 rounded-lg">
              <CheckCircle className="h-5 w-5 text-green-600" />
            </div>
            <h2 className="text-lg font-semibold text-gray-900">Approve Certificate</h2>
          </div>
          <button
            onClick={onClose}
            className="p-1 hover:bg-gray-100 rounded-lg transition-colors"
          >
            <X className="h-5 w-5 text-gray-500" />
          </button>
        </div>

        {/* Certificate Info */}
        <div className="px-6 py-4 bg-gray-50 border-b">
          <div className="flex items-center gap-3">
            <FileText className="h-5 w-5 text-gray-400" />
            <div>
              <p className="font-medium text-gray-900">{certificateNumber}</p>
              <p className="text-sm text-gray-500">{uucDescription || 'No description'}</p>
            </div>
          </div>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">
            How would you like to notify the customer?
          </p>

          {/* Option 1: Approve Only */}
          <button
            type="button"
            onClick={() => setSelectedOption('approve-only')}
            className={cn(
              "w-full p-4 rounded-lg border-2 text-left transition-all",
              selectedOption === 'approve-only'
                ? "border-green-500 bg-green-50"
                : "border-gray-200 hover:border-gray-300"
            )}
          >
            <div className="flex items-start gap-3">
              <div className={cn(
                "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                selectedOption === 'approve-only'
                  ? "border-green-500 bg-green-500"
                  : "border-gray-300"
              )}>
                {selectedOption === 'approve-only' && (
                  <div className="w-2 h-2 bg-white rounded-full" />
                )}
              </div>
              <div>
                <p className="font-medium text-gray-900">Approve Only</p>
                <p className="text-sm text-gray-500 mt-1">
                  Customer will see it when they log into their dashboard.
                  No email notification will be sent.
                </p>
              </div>
            </div>
          </button>

          {/* Option 2: Approve & Send Email */}
          <div
            className={cn(
              "rounded-lg border-2 transition-all",
              selectedOption === 'approve-send'
                ? "border-green-500 bg-green-50"
                : "border-gray-200"
            )}
          >
            <button
              type="button"
              onClick={() => setSelectedOption('approve-send')}
              className="w-full p-4 text-left"
            >
              <div className="flex items-start gap-3">
                <div className={cn(
                  "w-5 h-5 rounded-full border-2 flex items-center justify-center flex-shrink-0 mt-0.5",
                  selectedOption === 'approve-send'
                    ? "border-green-500 bg-green-500"
                    : "border-gray-300"
                )}>
                  {selectedOption === 'approve-send' && (
                    <div className="w-2 h-2 bg-white rounded-full" />
                  )}
                </div>
                <div>
                  <div className="flex items-center gap-2">
                    <p className="font-medium text-gray-900">Approve & Send Email</p>
                    <span className="text-xs px-2 py-0.5 bg-green-100 text-green-700 rounded font-medium">
                      Recommended
                    </span>
                  </div>
                  <p className="text-sm text-gray-500 mt-1">
                    Send review link directly to customer's email.
                  </p>
                </div>
              </div>
            </button>

            {/* Email Form - Only shown when this option is selected */}
            {selectedOption === 'approve-send' && (
              <div className="px-4 pb-4 pt-2 space-y-4 border-t border-green-200 mt-2">
                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Customer Email <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="customer@company.com"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Customer Name <span className="text-red-500">*</span>
                  </Label>
                  <Input
                    type="text"
                    value={name}
                    onChange={(e) => setName(e.target.value)}
                    placeholder="Contact person name"
                    className="mt-1"
                  />
                </div>

                <div>
                  <Label className="text-sm font-medium text-gray-700">
                    Message (optional)
                  </Label>
                  <textarea
                    value={message}
                    onChange={(e) => setMessage(e.target.value)}
                    placeholder="Add a personal message to the email..."
                    className="mt-1 w-full px-3 py-2 border rounded-lg text-sm resize-none focus:ring-2 focus:ring-green-500 focus:border-green-500"
                    rows={3}
                  />
                </div>
              </div>
            )}
          </div>

          {/* Pending Edits Warning */}
          {pendingEditsCount > 0 && (
            <div className="flex items-center gap-2 p-3 bg-amber-50 border border-amber-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-amber-600 flex-shrink-0" />
              <p className="text-sm text-amber-700">
                {pendingEditsCount} pending edit{pendingEditsCount > 1 ? 's' : ''} will be applied.
              </p>
            </div>
          )}

          {/* Consent Section */}
          <div className="space-y-3 pt-2 border-t border-gray-200">
            <p className="text-sm font-medium text-gray-700">Before signing, please confirm:</p>
            <ul className="text-sm text-gray-600 space-y-1 ml-4 list-disc">
              {CONSENT_STATEMENTS.map((statement, i) => (
                <li key={i}>{statement}</li>
              ))}
            </ul>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={consentAccepted}
                onChange={(e) => {
                  setConsentAccepted(e.target.checked)
                  if (e.target.checked) setConsentAcceptedAt(Date.now())
                }}
                className="rounded border-gray-300 text-green-600 focus:ring-green-500"
              />
              <span className="text-sm font-medium text-gray-700">I agree to the above statements</span>
            </label>
          </div>

          {/* Signature Section */}
          <div className={cn("space-y-3 pt-2 border-t border-gray-200", !consentAccepted && "opacity-50 pointer-events-none")}>
            <div>
              <Label className="text-sm font-medium text-gray-700">
                Your Name <span className="text-xs text-gray-500 font-normal ml-2">(from your profile)</span>
              </Label>
              <Input
                type="text"
                value={signerName}
                readOnly
                className="mt-1 bg-gray-100 cursor-not-allowed"
              />
            </div>

            <div>
              <Label className="text-sm font-medium text-gray-700">
                Your Signature
              </Label>
              <div className="mt-1">
                <TypedSignature
                  ref={signatureRef}
                  name={signerName}
                  onSignatureReady={handleSignatureReady}
                />
              </div>
            </div>
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg">
              <AlertTriangle className="h-4 w-4 text-red-600 flex-shrink-0" />
              <p className="text-sm text-red-600">{error}</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={onClose}
            disabled={isSubmitting}
          >
            Cancel
          </Button>
          <Button
            onClick={handleSubmit}
            disabled={isSubmitting}
            className="bg-green-600 hover:bg-green-700"
          >
            {isSubmitting ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : selectedOption === 'approve-send' ? (
              <Mail className="h-4 w-4 mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            {isSubmitting
              ? 'Processing...'
              : selectedOption === 'approve-send'
                ? 'Approve & Send'
                : 'Approve Certificate'
            }
          </Button>
        </div>
      </div>
    </div>,
    document.body
  )
}
