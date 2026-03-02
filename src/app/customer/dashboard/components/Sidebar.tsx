'use client'

import { cn } from '@/lib/utils'
import {
  Bell,
  Clock,
  CheckCircle,
  FileText,
  Microscope,
} from 'lucide-react'

export type ViewType = 'pending' | 'awaiting' | 'completed' | 'authorized' | 'traceability'

interface SidebarProps {
  activeView: ViewType
  onViewChange: (view: ViewType) => void
  counts: {
    pending: number
    awaiting: number
    completed: number
    authorized: number
    traceability: number
  }
}

const menuItems = [
  {
    id: 'pending' as const,
    label: 'Pending Review',
    icon: Bell,
    section: 'certificates',
  },
  {
    id: 'awaiting' as const,
    label: 'Awaiting Response',
    icon: Clock,
    section: 'certificates',
  },
  {
    id: 'completed' as const,
    label: 'Completed',
    icon: CheckCircle,
    section: 'certificates',
  },
  {
    id: 'authorized' as const,
    label: 'Authorized',
    icon: FileText,
    section: 'certificates',
  },
  {
    id: 'traceability' as const,
    label: 'Master Instruments',
    icon: Microscope,
    section: 'traceability',
  },
]

export function Sidebar({ activeView, onViewChange, counts }: SidebarProps) {
  return (
    <aside className="w-64 bg-white border-r border-gray-200 min-h-[calc(100vh-64px)] flex-shrink-0">
      <nav className="p-4 space-y-6">
        {/* Certificates Section */}
        <div>
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Certificates
          </h3>
          <div className="mt-2 space-y-1">
            {menuItems
              .filter((item) => item.section === 'certificates')
              .map((item) => (
                <SidebarButton
                  key={item.id}
                  item={item}
                  count={counts[item.id]}
                  isActive={activeView === item.id}
                  onClick={() => onViewChange(item.id)}
                />
              ))}
          </div>
        </div>

        {/* Traceability Section */}
        <div>
          <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
            Traceability
          </h3>
          <div className="mt-2 space-y-1">
            {menuItems
              .filter((item) => item.section === 'traceability')
              .map((item) => (
                <SidebarButton
                  key={item.id}
                  item={item}
                  count={counts[item.id]}
                  isActive={activeView === item.id}
                  onClick={() => onViewChange(item.id)}
                />
              ))}
          </div>
        </div>
      </nav>
    </aside>
  )
}

function SidebarButton({
  item,
  count,
  isActive,
  onClick,
}: {
  item: (typeof menuItems)[number]
  count: number
  isActive: boolean
  onClick: () => void
}) {
  const Icon = item.icon

  return (
    <button
      onClick={onClick}
      className={cn(
        'w-full flex items-center justify-between px-3 py-2 text-sm font-medium rounded-lg transition-colors',
        isActive
          ? 'bg-blue-50 text-blue-700 border border-blue-200'
          : 'text-gray-700 hover:bg-gray-100'
      )}
    >
      <span className="flex items-center gap-3">
        <Icon className="h-4 w-4" />
        {item.label}
      </span>
      {count > 0 && (
        <span
          className={cn(
            'px-2 py-0.5 text-xs font-medium rounded-full',
            isActive ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-600'
          )}
        >
          {count}
        </span>
      )}
    </button>
  )
}
