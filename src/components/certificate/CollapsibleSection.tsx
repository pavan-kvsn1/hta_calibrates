'use client'

import { ChevronUp, ChevronDown } from 'lucide-react'

export interface CollapsibleSectionProps {
  title: string
  isExpanded: boolean
  onToggle: () => void
  children: React.ReactNode
  badge?: React.ReactNode
  /** Optional slot for feedback content, rendered before children */
  feedbackSlot?: React.ReactNode
}

/**
 * Collapsible section component for certificate content display.
 * Used across Admin, Reviewer, and Customer certificate views.
 */
export function CollapsibleSection({
  title,
  isExpanded,
  onToggle,
  children,
  badge,
  feedbackSlot,
}: CollapsibleSectionProps) {
  return (
    <div className="bg-white rounded-lg border overflow-hidden">
      <button
        onClick={onToggle}
        className="w-full px-4 py-3 flex items-center justify-between bg-gray-50 hover:bg-gray-100 transition-colors"
      >
        <div className="flex items-center gap-2">
          <span className="font-semibold text-gray-700 text-sm">
            {title}
          </span>
          {badge}
        </div>
        {isExpanded ? (
          <ChevronUp className="h-5 w-5 text-gray-400" />
        ) : (
          <ChevronDown className="h-5 w-5 text-gray-400" />
        )}
      </button>
      {isExpanded && (
        <div className="p-4">
          {feedbackSlot}
          {children}
        </div>
      )}
    </div>
  )
}
