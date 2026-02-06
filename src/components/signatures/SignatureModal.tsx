'use client'

import { useRef, useState, useCallback } from 'react'
import { Button } from '@/components/ui/button'
import SignatureCanvas, { type SignatureCanvasHandle } from './SignatureCanvas'
import type { SignatureData } from '@/types/signatures'
import {
  CheckCircle,
  Loader2,
  AlertTriangle,
  X,
} from 'lucide-react'

interface SignatureModalProps {
  isOpen: boolean
  onClose: () => void
  onConfirm: (data: SignatureData) => void | Promise<void>
  defaultName?: string
  title?: string
  description?: string
  confirmLabel?: string
  loading?: boolean
  error?: string | null
}

export default function SignatureModal({
  isOpen,
  onClose,
  onConfirm,
  defaultName = '',
  title = 'Sign Certificate',
  description = 'Please sign below. Your signature will be added to the document.',
  confirmLabel = 'Confirm & Sign',
  loading = false,
  error = null,
}: SignatureModalProps) {
  const canvasRef = useRef<SignatureCanvasHandle>(null)
  const [hasSignature, setHasSignature] = useState(false)
  const [signerName, setSignerName] = useState(defaultName)
  const [localError, setLocalError] = useState<string | null>(null)

  const displayError = error || localError

  const handleSignatureChange = useCallback((hasSig: boolean) => {
    setHasSignature(hasSig)
    if (hasSig) setLocalError(null)
  }, [])

  const handleConfirm = async () => {
    if (!hasSignature || !signerName.trim()) {
      setLocalError('Please sign and enter your name')
      return
    }

    setLocalError(null)
    const signatureImage = canvasRef.current?.toDataURL() || ''
    await onConfirm({ signatureImage, signerName: signerName.trim() })
  }

  const handleClose = () => {
    if (loading) return
    // Reset local state on close
    setLocalError(null)
    setHasSignature(false)
    setSignerName(defaultName)
    canvasRef.current?.clear()
    onClose()
  }

  if (!isOpen) return null

  return (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-lg w-full max-h-[90vh] overflow-y-auto">
        {/* Header */}
        <div className="px-6 py-4 border-b flex items-center justify-between">
          <h2 className="text-lg font-semibold">{title}</h2>
          <button
            onClick={handleClose}
            disabled={loading}
            className="p-1 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600 disabled:opacity-50"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        {/* Content */}
        <div className="p-6 space-y-4">
          <p className="text-sm text-gray-600">{description}</p>

          {/* Signature Pad */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Your Signature
            </label>
            <SignatureCanvas
              ref={canvasRef}
              onSignatureChange={handleSignatureChange}
            />
            <button
              type="button"
              onClick={() => canvasRef.current?.clear()}
              className="text-sm text-gray-500 hover:text-gray-700 mt-2"
            >
              Clear signature
            </button>
          </div>

          {/* Signer Name */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Your Name
            </label>
            <input
              type="text"
              value={signerName}
              onChange={(e) => {
                setSignerName(e.target.value)
                if (localError) setLocalError(null)
              }}
              className="w-full px-3 py-2 border rounded-lg focus:ring-2 focus:ring-green-500 focus:border-green-500"
              placeholder="Enter your full name"
            />
          </div>

          {/* Error Display */}
          {displayError && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-600">
              <AlertTriangle className="h-4 w-4 flex-shrink-0" />
              {displayError}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t bg-gray-50 flex justify-end gap-3">
          <Button
            variant="outline"
            onClick={handleClose}
            disabled={loading}
          >
            Cancel
          </Button>
          <Button
            onClick={handleConfirm}
            disabled={loading || !hasSignature}
            className="bg-green-600 hover:bg-green-700"
          >
            {loading ? (
              <Loader2 className="h-4 w-4 animate-spin mr-2" />
            ) : (
              <CheckCircle className="h-4 w-4 mr-2" />
            )}
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>
  )
}
