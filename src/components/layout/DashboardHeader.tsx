'use client'

import { useSession } from 'next-auth/react'
import Link from 'next/link'
import { Settings, Menu } from 'lucide-react'

interface DashboardHeaderProps {
  onMobileMenuToggle: () => void
}

export function DashboardHeader({ onMobileMenuToggle }: DashboardHeaderProps) {
  const { data: session } = useSession()

  return (
    <header className="flex items-center justify-between whitespace-nowrap bg-blue-600 px-4 sm:px-6 h-16 sticky top-0 z-[60]">
      <div className="flex items-center gap-3">
        {/* Mobile Menu Button */}
        <button
          onClick={onMobileMenuToggle}
          className="lg:hidden p-2 -ml-2 rounded-lg hover:bg-blue-500 text-white"
          aria-label="Toggle menu"
        >
          <Menu className="h-5 w-5" />
        </button>

        <h1 className="text-base font-semibold text-white">
          Calibration Engineer Portal
        </h1>
      </div>

      <div className="flex flex-1 justify-end gap-3 items-center">
        {/* Admin Link (for Admin users or HoD with isAdmin) */}
        {(session?.user?.role === 'ADMIN' || session?.user?.isAdmin) && (
          <Link
            href="/admin"
            className="flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700 bg-white px-2.5 py-1.5 rounded-md hover:bg-blue-50 transition-colors"
          >
            <Settings className="size-3.5" />
            <span className="hidden sm:inline">Admin Panel</span>
          </Link>
        )}
      </div>
    </header>
  )
}
