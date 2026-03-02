'use client'

import { useState } from 'react'
import { HistorySidebar } from '@/components/feedback'

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

interface CustomerEvent {
  id: string
  eventType: string
  eventData: {
    notes?: string
    message?: string
    customerEmail?: string
    customerName?: string
    customerCompany?: string
    requestedAt?: string
    sentAt?: string
    approvedAt?: string
  }
  createdAt: string
  revision: number
  user?: {
    name: string
    role: string
  }
}

interface ReviewPageClientProps {
  feedbacks: Feedback[]
  customerEvents: CustomerEvent[]
  currentRevision: number
}

export function ReviewPageClient({ feedbacks, customerEvents, currentRevision }: ReviewPageClientProps) {
  const [isSidebarOpen, setIsSidebarOpen] = useState(false)

  return (
    <HistorySidebar
      engineerFeedbacks={feedbacks}
      customerEvents={customerEvents}
      isOpen={isSidebarOpen}
      onToggle={() => setIsSidebarOpen(!isSidebarOpen)}
      currentRevision={currentRevision}
    />
  )
}
