'use client'

import { useEffect, useState, useCallback } from 'react'
import Link from 'next/link'
import { ArrowLeft, Eye, Send, Cloud, Clock, Save } from 'lucide-react'
import { Header } from '@/components/layout/Header'
import {
  SummarySection,
  UUCSection,
  MasterInstrumentSection,
  EnvironmentalSection,
  ResultsSection,
  RemarksSection,
  ConclusionSection,
  FinalizeSection,
} from '@/components/forms'
import { useCertificateStore } from '@/lib/certificate-store'
import { cn } from '@/lib/utils'
import { Badge } from '@/components/ui/badge'

const SECTIONS = [
  { id: 'summary', label: 'Summary' },
  { id: 'uuc-details', label: 'UUC Details' },
  { id: 'master-inst', label: 'Master Inst' },
  { id: 'environment', label: 'Environment' },
  { id: 'results', label: 'Results' },
  { id: 'remarks', label: 'Remarks' },
  { id: 'conclusion', label: 'Conclusion' },
  { id: 'submit', label: 'Submit' },
]

export default function NewCertificatePage() {
  const { formData, isDirty, isSaving, saveDraft, hydrate } = useCertificateStore()
  const [activeSection, setActiveSection] = useState('summary')
  const [isScrolled, setIsScrolled] = useState(false)
  const [saveError, setSaveError] = useState<string | null>(null)

  // Hydrate store on mount (generates certificate number on client)
  useEffect(() => {
    hydrate()
  }, [hydrate])

  // Auto-save functionality - calls the real API
  const autoSave = useCallback(async () => {
    if (!isDirty) return

    setSaveError(null)
    const result = await saveDraft()
    if (!result.success) {
      setSaveError(result.error || 'Failed to save')
      console.error('Auto-save failed:', result.error)
    }
  }, [isDirty, saveDraft])

  // Auto-save every 30 seconds
  useEffect(() => {
    const interval = setInterval(() => {
      autoSave()
    }, 30000)

    return () => clearInterval(interval)
  }, [autoSave])

  // Track scroll position for sticky header and active section
  useEffect(() => {
    const handleScroll = () => {
      const scrollTop = window.scrollY
      setIsScrolled(scrollTop > 150)

      // Update active section based on scroll position
      const sections = SECTIONS.map((s) => ({
        id: s.id,
        element: document.getElementById(s.id),
      })).filter((s) => s.element)

      for (let i = sections.length - 1; i >= 0; i--) {
        const section = sections[i]
        if (section.element && section.element.offsetTop - 200 <= scrollTop) {
          setActiveSection(section.id)
          break
        }
      }
    }

    window.addEventListener('scroll', handleScroll)
    return () => window.removeEventListener('scroll', handleScroll)
  }, [])

  // Scroll to section when nav link clicked
  const scrollToSection = (sectionId: string) => {
    const element = document.getElementById(sectionId)
    if (element) {
      element.scrollIntoView({ behavior: 'smooth', block: 'start' })
    }
  }

  // Format last saved time
  const formatLastSaved = () => {
    if (!formData.lastSaved) return 'Not saved yet'
    const now = new Date()
    const diff = Math.floor((now.getTime() - formData.lastSaved.getTime()) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
    return formData.lastSaved.toLocaleTimeString()
  }

  return (
    <div className={cn('min-h-screen bg-background', isScrolled && 'scrolled')}>
      <Header title="Create New Certificate" />

      {/* Combined Sticky Header - Appears when scrolled */}
      <div
        className={cn(
          'fixed top-[75px] left-0 right-0 bg-white/95 backdrop-blur-md border-b border-slate-200 z-[55] shadow-sm transition-all duration-300',
          isScrolled ? 'translate-y-0 opacity-100' : '-translate-y-full opacity-0 pointer-events-none'
        )}
      >
        {/* Row 1: Customer Info + Action Buttons */}
        <div className="px-6 py-2 flex items-center justify-between border-b border-slate-100">
          <div className="flex items-center gap-4 text-sm">
            <div className="flex items-center gap-2">
              <span className="text-slate-400 font-bold uppercase text-[10px]">Customer:</span>
              <span className="font-bold text-slate-900 truncate max-w-[300px]">
                {formData.customerName || 'Not specified'}
              </span>
            </div>
            <div className="h-4 w-px bg-slate-200" />
            <Badge
              variant="outline"
              className="px-2 py-0.5 bg-amber-50 text-amber-600 text-[10px] font-bold border-amber-100 uppercase tracking-wider"
            >
              Draft
            </Badge>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={autoSave}
              disabled={isSaving || !isDirty}
              className="bg-slate-100 text-slate-700 text-xs font-bold px-4 py-1.5 rounded-lg hover:bg-slate-200 transition-colors disabled:opacity-50 flex items-center gap-1.5"
            >
              <Save className="size-3.5" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={() => scrollToSection('submit')}
              className="bg-primary text-white text-xs font-bold px-4 py-1.5 rounded-lg hover:bg-primary/90 transition-colors flex items-center gap-1.5"
            >
              <Send className="size-3.5" />
              Submit
            </button>
          </div>
        </div>
        {/* Row 2: Navigation Tabs */}
        <div className="px-4 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 py-1 min-w-max">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                className={cn(
                  'px-3 py-1.5 text-xs font-semibold text-slate-600 hover:text-primary hover:bg-slate-50 rounded-md transition-all border-b-2',
                  activeSection === section.id
                    ? 'border-primary text-primary font-bold bg-primary/5'
                    : 'border-transparent'
                )}
              >
                {section.label}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="max-w-[1200px] mx-auto px-4 sm:px-6 lg:px-8 py-6">
        {/* Page Header */}
        <div className="mb-8 flex flex-col md:flex-row md:items-end justify-between gap-4">
          <div>
            <Link
              href="/dashboard"
              className="text-slate-500 hover:text-primary transition-colors flex items-center gap-1 text-sm font-semibold mb-4"
            >
              <ArrowLeft className="size-4" />
              Back to Dashboard
            </Link>
            <div className="flex items-baseline gap-4">
              <h1 className="text-3xl font-bold text-slate-900 tracking-tight">
                Create New Certificate
              </h1>
              <Badge
                variant="outline"
                className="px-3 py-1 bg-amber-50 text-amber-600 text-[11px] font-bold border-amber-100 uppercase tracking-wider"
              >
                Draft
              </Badge>
            </div>
            <div className="flex gap-4 mt-2 text-sm text-slate-500">
              <p>
                Certificate #: <span className="font-bold text-slate-800">{formData.certificateNumber || '...'}</span>{' '}
                (Auto-generated)
              </p>
              <p>•</p>
              <p>Last saved: {formatLastSaved()}</p>
            </div>
          </div>
          <div className="flex gap-3">
            <button
              onClick={autoSave}
              disabled={isSaving || !isDirty}
              className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all flex items-center gap-2 disabled:opacity-50"
            >
              <Save className="size-4" />
              {isSaving ? 'Saving...' : 'Save Draft'}
            </button>
            <button
              onClick={() => scrollToSection('submit')}
              className="px-5 py-2.5 rounded-xl border border-slate-200 bg-white text-slate-700 font-bold text-sm hover:bg-slate-50 transition-all flex items-center gap-2"
            >
              <Eye className="size-4" />
              Preview PDF
            </button>
            <button
              onClick={() => scrollToSection('submit')}
              className="px-5 py-2.5 rounded-xl bg-primary text-white font-bold text-sm hover:bg-primary/90 transition-all shadow-md flex items-center gap-2"
            >
              <Send className="size-4" />
              Submit for Review
            </button>
          </div>
        </div>

        {/* Quick Navigation - Normal position (sticky header takes over when scrolled) */}
        <nav className="bg-white border border-slate-200/60 rounded-2xl shadow-sm mb-8 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-1 p-2 min-w-max">
            {SECTIONS.map((section) => (
              <button
                key={section.id}
                type="button"
                onClick={() => scrollToSection(section.id)}
                className={cn(
                  'px-4 py-2 text-sm font-semibold text-slate-600 hover:text-primary hover:bg-slate-50 rounded-lg transition-all border-b-2',
                  activeSection === section.id
                    ? 'border-primary text-primary font-bold'
                    : 'border-transparent'
                )}
              >
                {section.label}
              </button>
            ))}
          </div>
        </nav>

        {/* Form Sections */}
        <div className="space-y-10 pb-20">
          <SummarySection />
          <UUCSection />
          <MasterInstrumentSection />
          <EnvironmentalSection />
          <ResultsSection />
          <RemarksSection />
          <ConclusionSection />
          <FinalizeSection />
        </div>
      </div>

      {/* Footer */}
      <footer className="bg-white border-t border-slate-200 py-6">
        <div className="max-w-[1200px] mx-auto px-6 flex flex-wrap items-center justify-center gap-8 text-slate-400 text-[10px] font-extrabold uppercase tracking-[0.2em]">
          <div className="flex items-center gap-2">
            <span className="size-2 rounded-full bg-green-500" />
            System Online
          </div>
          <div className="flex items-center gap-2">
            Secure Connection
          </div>
          <div className="flex items-center gap-2">
            Support Hub
          </div>
        </div>
      </footer>
    </div>
  )
}
