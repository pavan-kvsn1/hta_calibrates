'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import { ArrowLeft, Users, Unlock } from 'lucide-react'
import { cn } from '@/lib/utils'
import { CustomerRequestsTab } from './CustomerRequestsTab'
import { InternalRequestsTab } from './InternalRequestsTab'

type TabType = 'customer' | 'internal'

interface TabCounts {
  customer: number
  internal: number
}

export default function AdminRequestsPage() {
  const [activeTab, setActiveTab] = useState<TabType>('internal')
  const [counts, setCounts] = useState<TabCounts>({ customer: 0, internal: 0 })

  // Fetch counts for both tabs
  useEffect(() => {
    const fetchCounts = async () => {
      try {
        const [customerRes, internalRes] = await Promise.all([
          fetch('/api/admin/customers/requests?status=PENDING&limit=1'),
          fetch('/api/admin/internal-requests?status=PENDING&limit=1'),
        ])

        if (customerRes.ok && internalRes.ok) {
          const customerData = await customerRes.json()
          const internalData = await internalRes.json()
          setCounts({
            customer: customerData.counts?.pending || 0,
            internal: internalData.counts?.pending || 0,
          })
        }
      } catch (error) {
        console.error('Failed to fetch counts:', error)
      }
    }

    fetchCounts()
  }, [])

  const tabs = [
    {
      id: 'internal' as TabType,
      label: 'Internal Requests',
      icon: Unlock,
      count: counts.internal,
      activeColor: 'bg-blue-500',
      activeBg: 'bg-white',
      inactiveBg: 'bg-slate-100',
      badgeActive: 'bg-blue-100 text-blue-700',
      badgeInactive: 'bg-slate-200 text-slate-600',
    },
    {
      id: 'customer' as TabType,
      label: 'Customer Requests',
      icon: Users,
      count: counts.customer,
      activeColor: 'bg-purple-500',
      activeBg: 'bg-white',
      inactiveBg: 'bg-slate-100',
      badgeActive: 'bg-purple-100 text-purple-700',
      badgeInactive: 'bg-slate-200 text-slate-600',
    },
  ]

  return (
    <div className="p-3 h-full">
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full flex flex-col">
        {/* Header Section */}
        <div className="bg-white border-b border-slate-200 px-6 py-4">
          {/* Back Link */}
          <Link
            href="/admin"
            className="inline-flex items-center text-sm text-slate-500 hover:text-slate-900 mb-3 transition-colors"
          >
            <ArrowLeft className="h-4 w-4 mr-1.5" />
            Back to Admin
          </Link>

          {/* Title */}
          <div>
            <h1 className="text-2xl font-bold text-slate-900">Requests</h1>
            <p className="text-slate-500 text-sm mt-0.5">
              Review and manage customer and internal requests
            </p>
          </div>
        </div>

        {/* File Tabs Bar */}
        <div className="bg-white px-4 pt-3 flex items-end gap-1">
          {tabs.map((tab) => {
            const isActive = activeTab === tab.id
            const Icon = tab.icon

            return (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={cn(
                  'group relative flex-1 flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-t-xl transition-all',
                  isActive
                    ? 'bg-white text-slate-900 shadow-sm'
                    : 'bg-slate-200 text-slate-500 hover:bg-slate-100 hover:text-slate-700'
                )}
              >
                {/* Active indicator bar */}
                {isActive && (
                  <div className={cn(
                    'absolute top-0 left-4 right-4 h-1 rounded-b',
                    tab.activeColor
                  )} />
                )}

                <Icon className={cn(
                  'h-4 w-4 transition-colors',
                  isActive ? 'text-slate-700' : 'text-slate-400 group-hover:text-slate-500'
                )} />

                <span>{tab.label}</span>

                {/* Badge */}
                {tab.count > 0 && (
                  <span className={cn(
                    'px-1.5 py-0.5 text-[10px] font-bold rounded-full min-w-[18px] text-center transition-colors',
                    isActive ? tab.badgeActive : tab.badgeInactive
                  )}>
                    {tab.count > 99 ? '99+' : tab.count}
                  </span>
                )}

                {/* Bottom border cover for active tab */}
                {isActive && (
                  <div className="absolute -bottom-px left-0 right-0 h-px bg-white" />
                )}
              </button>
            )
          })}
        </div>

        {/* Tab Content Area */}
        <div className="flex-1 bg-white overflow-auto">
          <div className="p-6">
            {activeTab === 'customer' ? (
              <CustomerRequestsTab />
            ) : (
              <InternalRequestsTab />
            )}
          </div>
        </div>
      </div>
    </div>
  )
}
