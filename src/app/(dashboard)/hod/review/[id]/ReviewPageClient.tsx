'use client'

import { useState } from 'react'
import { FeedbackSidebar } from '@/components/feedback'

interface HoDEdit {
  field: string
  fieldLabel: string
  previousValue: string | null
  newValue: string
  reason: string
  autoCalculated: boolean
}

interface Feedback {
  id: string
  feedbackType: string
  comment: string | null
  createdAt: string
  revisionNumber: number
  user: {
    name: string
    role: string
  }
  hodEdits?: HoDEdit[] | null
}

interface ReviewPageClientProps {
  feedbacks: Feedback[]
  currentRevision: number
}

export function ReviewPageClient({ feedbacks, currentRevision }: ReviewPageClientProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  if (feedbacks.length === 0) {
    return null
  }

  return (
    <FeedbackSidebar
      feedbacks={feedbacks}
      isOpen={isSidebarOpen}
      onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      currentRevision={currentRevision}
    />
  )
}
