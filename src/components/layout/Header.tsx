'use client'

import { Bell, ChevronDown, Clock } from 'lucide-react'
import { useCertificateStore } from '@/lib/certificate-store'

export function Header() {
  const { formData, isSaving } = useCertificateStore()

  const formatLastSaved = () => {
    if (!formData.lastSaved) return 'Not saved yet'
    const now = new Date()
    const diff = Math.floor((now.getTime() - formData.lastSaved.getTime()) / 1000)
    if (diff < 60) return `${diff}s ago`
    if (diff < 3600) return `${Math.floor(diff / 60)} min ago`
    return formData.lastSaved.toLocaleTimeString()
  }

  return (
    <header className="flex items-center justify-between whitespace-nowrap border-b border-slate-200 bg-white px-6 py-3 sticky top-0 z-[60] shadow-sm">
      <div className="flex items-center gap-4">
        {/* Logo */}
        <div className="size-8 text-primary">
          <svg fill="none" viewBox="0 0 48 48" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M44 11.2727C44 14.0109 39.8386 16.3957 33.69 17.6364C39.8386 18.877 44 21.2618 44 24C44 26.7382 39.8386 29.123 33.69 30.3636C39.8386 31.6043 44 33.9891 44 36.7273C44 40.7439 35.0457 44 24 44C12.9543 44 4 40.7439 4 36.7273C4 33.9891 8.16144 31.6043 14.31 30.3636C8.16144 29.123 4 26.7382 4 24C4 21.2618 8.16144 18.877 14.31 17.6364C8.16144 16.3957 4 14.0109 4 11.2727C4 7.25611 12.9543 4 24 4C35.0457 4 44 7.25611 44 11.2727Z"
              fill="currentColor"
            />
          </svg>
        </div>
        <div className="h-6 w-px bg-slate-200" />
        <h2 className="text-slate-800 text-lg font-bold tracking-tight">HTA Calibration</h2>
      </div>

      <div className="flex flex-1 justify-end gap-6 items-center">
        {/* Auto-save indicator */}
        <div className="hidden md:flex items-center gap-2 text-sm text-slate-500 bg-slate-50 px-3 py-1.5 rounded-full border border-slate-100">
          <Clock className="size-4" />
          <span>
            {isSaving ? 'Saving...' : `Last auto-save: ${formatLastSaved()}`}
          </span>
        </div>

        {/* Notifications */}
        <button className="relative p-2 hover:bg-slate-50 rounded-full transition-colors text-slate-600">
          <Bell className="size-5" />
          <span className="absolute top-2 right-2 size-2 bg-red-500 rounded-full border border-white" />
        </button>

        {/* User menu */}
        <div className="flex items-center gap-2 cursor-pointer group">
          <div
            className="bg-center bg-no-repeat bg-cover rounded-full size-9 ring-2 ring-slate-100 bg-primary text-white flex items-center justify-center font-bold text-sm"
          >
            RK
          </div>
          <span className="text-sm font-semibold text-slate-700 hidden sm:block">Ramesh K</span>
          <ChevronDown className="size-4 text-slate-400" />
        </div>
      </div>
    </header>
  )
}
