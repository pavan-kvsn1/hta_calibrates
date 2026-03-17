'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { ShieldCheck, CheckCircle, ChevronDown, ChevronRight, User } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { SignatureModal } from '@/components/signatures'
import type { SignatureData } from '@/types/signatures'
import { cn } from '@/lib/utils'

interface AdminAuthorizationPanelProps {
  certificateId: string
  isAuthorized: boolean
  currentRevision: number
  createdByName: string | null
}

export function AdminAuthorizationPanel({
  certificateId,
  isAuthorized,
  currentRevision,
  createdByName,
}: AdminAuthorizationPanelProps) {
  const router = useRouter()
  const [isExpanded, setIsExpanded] = useState(true)
  const [showAuthorizeModal, setShowAuthorizeModal] = useState(false)
  const [isAuthorizing, setIsAuthorizing] = useState(false)
  const [authorizeError, setAuthorizeError] = useState<string | null>(null)

  // Authorize certificate
  const handleAuthorize = async (data: SignatureData) => {
    setIsAuthorizing(true)
    setAuthorizeError(null)

    try {
      const response = await fetch(`/api/admin/authorization/${certificateId}/authorize`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          signatureData: data.signatureImage,
          signerName: data.signerName,
          clientEvidence: data.clientEvidence,
        }),
      })

      if (response.ok) {
        router.push('/admin/authorization')
      } else {
        let errorMessage = 'Failed to authorize certificate'
        try {
          const text = await response.text()
          if (text) {
            const responseData = JSON.parse(text)
            errorMessage = responseData.error || errorMessage
          }
        } catch {
          errorMessage = `Server error (${response.status})`
        }
        setAuthorizeError(errorMessage)
      }
    } catch (err) {
      console.error('Authorization error:', err)
      setAuthorizeError('An error occurred. Please try again.')
    } finally {
      setIsAuthorizing(false)
    }
  }

  return (
    <>
      <div className="flex flex-col bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden flex-shrink-0">
        {/* Header - Collapsible */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            'flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors',
            isAuthorized ? 'bg-green-50' : ''
          )}
        >
          <div className="flex items-center gap-2">
            {isExpanded ? (
              <ChevronDown className="size-4 text-slate-400" />
            ) : (
              <ChevronRight className="size-4 text-slate-400" />
            )}
            <span
              className={cn(
                'text-xs font-bold uppercase tracking-wider',
                isAuthorized ? 'text-green-700' : 'text-slate-700'
              )}
            >
              Authorization
            </span>
            {isAuthorized && (
              <CheckCircle className="size-4 text-green-600" />
            )}
          </div>
        </button>

        {/* Content - Only when expanded */}
        {isExpanded && (
          <div className="border-t border-slate-100">
            <div className="p-4">
              {isAuthorized ? (
                <div className="text-center py-2">
                  <div className="size-12 rounded-full bg-green-100 flex items-center justify-center mx-auto mb-3">
                    <CheckCircle className="h-6 w-6 text-green-600" />
                  </div>
                  <p className="text-sm font-medium text-green-800">Certificate Authorized</p>
                  <p className="text-xs text-green-600 mt-1">
                    This certificate has been authorized and is now complete.
                  </p>
                </div>
              ) : (
                <>
                  <p className="text-xs text-slate-500 mb-4 text-center">
                    By authorizing, you confirm this certificate is complete and has been approved
                    by the customer.
                  </p>
                  <Button
                    onClick={() => setShowAuthorizeModal(true)}
                    className="w-full bg-blue-600 hover:bg-blue-700 text-sm h-10"
                  >
                    <ShieldCheck className="h-4 w-4 mr-2" />
                    Authorize & Sign
                  </Button>
                </>
              )}
            </div>

            {/* Certificate Info */}
            <div className="px-4 py-3 border-t bg-slate-50">
              <div className="flex items-center gap-4 text-xs text-slate-600">
                <div className="flex items-center gap-1.5">
                  <span className="text-slate-400">Revision:</span>
                  <span className="font-medium">{currentRevision}</span>
                </div>
                <div className="h-3 w-px bg-slate-300" />
                <div className="flex items-center gap-1.5">
                  <User className="size-3 text-slate-400" />
                  <span className="text-slate-400">Created by:</span>
                  <span className="font-medium">{createdByName || '-'}</span>
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Authorize Modal */}
      <SignatureModal
        isOpen={showAuthorizeModal}
        onClose={() => {
          setShowAuthorizeModal(false)
          setAuthorizeError(null)
        }}
        onConfirm={handleAuthorize}
        title="Authorize Certificate"
        description="Please sign below to authorize this calibration certificate. Your signature will be added as the final authorization."
        confirmLabel="Confirm Authorization"
        loading={isAuthorizing}
        error={authorizeError}
      />
    </>
  )
}
