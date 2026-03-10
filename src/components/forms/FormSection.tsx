'use client'

import { useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { cn } from '@/lib/utils'

interface FormSectionProps {
  id: string
  sectionNumber: string
  title: string
  children: React.ReactNode
  className?: string
  headerClassName?: string
  isDark?: boolean
  /** Optional feedback element to render inside the section, below the header */
  feedbackSlot?: React.ReactNode
}

export function FormSection({
  id,
  sectionNumber,
  title,
  children,
  className,
  headerClassName,
  isDark = false,
  feedbackSlot,
}: FormSectionProps) {
  const [isExpanded, setIsExpanded] = useState(true)

  return (
    <section className="scroll-mt-32" id={id}>
      <div className={cn(
        "bg-white rounded-2xl shadow-sm border border-slate-200/60 overflow-hidden",
        className
      )}>
        <button
          type="button"
          onClick={() => setIsExpanded(!isExpanded)}
          className={cn(
            "w-full px-8 py-5 flex items-center justify-between text-left group border-b border-slate-100",
            isDark
              ? "bg-slate-900 text-white"
              : "bg-gradient-to-r from-slate-50 to-white",
            headerClassName
          )}
        >
          <div>
            <span className={cn(
              "text-[10px] font-extrabold uppercase tracking-widest mb-1 block",
              isDark ? "text-primary" : "text-primary"
            )}>
              {sectionNumber}
            </span>
            <h2 className={cn(
              "text-xl font-extrabold tracking-tight",
              isDark ? "text-white" : "text-slate-900"
            )}>
              {title}
            </h2>
          </div>
          <ChevronDown
            className={cn(
              "size-5 transition-transform duration-200",
              isDark ? "text-slate-400" : "text-slate-400 group-hover:text-primary",
              !isExpanded && "-rotate-90"
            )}
          />
        </button>

        {isExpanded && (
          <>
            {/* Feedback slot - renders inside the section, below header */}
            {feedbackSlot && (
              <div className="px-8 pt-4">
                {feedbackSlot}
              </div>
            )}
            <div className="p-8 pt-4">
              {children}
            </div>
          </>
        )}
      </div>
    </section>
  )
}
