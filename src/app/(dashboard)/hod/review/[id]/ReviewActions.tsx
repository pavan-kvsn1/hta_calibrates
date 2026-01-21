'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { Button } from '@/components/ui/button'
import { Label } from '@/components/ui/label'
import { CheckCircle, XCircle, MessageSquare } from 'lucide-react'

interface ReviewActionsProps {
  certificateId: string
  currentStatus: string
  versionId: string
}

export function ReviewActions({
  certificateId,
  currentStatus,
  versionId,
}: ReviewActionsProps) {
  const router = useRouter()
  const [comment, setComment] = useState('')
  const [isSubmitting, setIsSubmitting] = useState(false)
  const [error, setError] = useState<string | null>(null)

  const canReview = currentStatus === 'PENDING_HOD_REVIEW'

  const handleAction = async (action: 'approve' | 'reject' | 'revision') => {
    if (action !== 'approve' && !comment.trim()) {
      setError('Please provide a comment for rejection or revision request')
      return
    }

    setIsSubmitting(true)
    setError(null)

    try {
      const response = await fetch(`/api/certificates/${certificateId}/review`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          action,
          comment: comment.trim() || undefined,
          versionId,
        }),
      })

      if (!response.ok) {
        const data = await response.json()
        throw new Error(data.error || 'Failed to submit review')
      }

      router.push('/hod/dashboard')
      router.refresh()
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsSubmitting(false)
    }
  }

  if (!canReview) {
    return (
      <div className="bg-white rounded-lg border p-6">
        <p className="text-gray-500 text-center">
          This certificate is not pending review.
        </p>
      </div>
    )
  }

  return (
    <div className="bg-white rounded-lg border p-6 sticky top-6">
      <h2 className="text-lg font-semibold text-gray-900 mb-4">Review Actions</h2>

      {error && (
        <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-md">
          <p className="text-sm text-red-600">{error}</p>
        </div>
      )}

      {/* Comment Field */}
      <div className="mb-6">
        <Label htmlFor="comment" className="flex items-center gap-2 mb-2">
          <MessageSquare className="h-4 w-4" />
          Review Comment
        </Label>
        <textarea
          id="comment"
          value={comment}
          onChange={(e) => setComment(e.target.value)}
          placeholder="Add comments for the engineer (required for rejection/revision)..."
          className="w-full h-32 px-3 py-2 border rounded-md text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-500"
          disabled={isSubmitting}
        />
      </div>

      {/* Action Buttons */}
      <div className="space-y-3">
        <Button
          onClick={() => handleAction('approve')}
          disabled={isSubmitting}
          className="w-full bg-green-600 hover:bg-green-700"
        >
          <CheckCircle className="h-4 w-4 mr-2" />
          {isSubmitting ? 'Processing...' : 'Approve Certificate'}
        </Button>

        <Button
          onClick={() => handleAction('revision')}
          disabled={isSubmitting}
          variant="outline"
          className="w-full border-orange-500 text-orange-600 hover:bg-orange-50"
        >
          <MessageSquare className="h-4 w-4 mr-2" />
          Request Revision
        </Button>

        <Button
          onClick={() => handleAction('reject')}
          disabled={isSubmitting}
          variant="outline"
          className="w-full border-red-500 text-red-600 hover:bg-red-50"
        >
          <XCircle className="h-4 w-4 mr-2" />
          Reject Certificate
        </Button>
      </div>

      {/* Help Text */}
      <p className="text-xs text-gray-500 mt-4">
        Approving will send the certificate for customer approval. Requesting revision will return it to the engineer for changes.
      </p>
    </div>
  )
}
