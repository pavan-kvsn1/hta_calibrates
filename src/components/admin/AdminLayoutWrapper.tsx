'use client'

import { useState, useEffect } from 'react'
import { cn } from '@/lib/utils'
import { AdminHeader } from './AdminHeader'

const STORAGE_KEY = 'admin-sidebar-collapsed'

interface AdminLayoutWrapperProps {
  children: React.ReactNode
  showEngineerSwitch?: boolean
}

export function AdminLayoutWrapper({ children, showEngineerSwitch = false }: AdminLayoutWrapperProps) {
  const [isCollapsed, setIsCollapsed] = useState(false)

  // Sync with sidebar state from localStorage
  useEffect(() => {
    const checkCollapsed = () => {
      const saved = localStorage.getItem(STORAGE_KEY)
      setIsCollapsed(saved === 'true')
    }

    // Initial check
    checkCollapsed()

    // Listen for storage changes (cross-tab)
    const handleStorage = (e: StorageEvent) => {
      if (e.key === STORAGE_KEY) {
        setIsCollapsed(e.newValue === 'true')
      }
    }

    // Listen for custom events (same tab)
    const handleCustomEvent = () => checkCollapsed()

    window.addEventListener('storage', handleStorage)
    window.addEventListener('sidebar-toggle', handleCustomEvent)

    return () => {
      window.removeEventListener('storage', handleStorage)
      window.removeEventListener('sidebar-toggle', handleCustomEvent)
    }
  }, [])

  return (
    <div
      className={cn(
        'min-h-screen flex flex-col transition-all duration-200',
        isCollapsed ? 'ml-16' : 'ml-56'
      )}
    >
      {/* Title Bar */}
      <AdminHeader showEngineerSwitch={showEngineerSwitch} />

      {/* Main Content */}
      <main className="flex-1">
        {children}
      </main>
    </div>
  )
}
