'use client'

import { useState, useEffect, useCallback } from 'react'
import {
  Sidebar,
  ViewType,
  PendingReviewTable,
  PendingCertificate,
  AwaitingResponseTable,
  AwaitingCertificate,
  CompletedTable,
  CompletedCertificate,
  AuthorizedTable,
  AuthorizedCertificate,
  TraceabilityTable,
  MasterInstrumentItem,
} from './index'

interface DashboardData {
  counts: {
    pending: number
    awaiting: number
    completed: number
    authorized: number
    traceability: number
  }
  pending: PendingCertificate[]
  awaiting: AwaitingCertificate[]
  completed: CompletedCertificate[]
  authorized: AuthorizedCertificate[]
  traceability: MasterInstrumentItem[]
}

const viewTitles: Record<ViewType, string> = {
  pending: 'Pending Review',
  awaiting: 'Awaiting Response',
  completed: 'Completed',
  authorized: 'Authorized Certificates',
  traceability: 'Master Instrument Traceability',
}

const viewDescriptions: Record<ViewType, string> = {
  pending: 'Certificates awaiting your review and signature',
  awaiting: 'Certificates where you are waiting for HTA to respond',
  completed: 'Certificates you have signed, awaiting Admin authorization',
  authorized: 'Fully authorized and completed certificates',
  traceability: 'Calibration certificates for master instruments used in your calibrations',
}

export function DashboardClient() {
  const [activeView, setActiveView] = useState<ViewType>('pending')
  const [data, setData] = useState<DashboardData | null>(null)
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const fetchData = useCallback(async () => {
    try {
      setIsLoading(true)
      setError(null)
      const response = await fetch('/api/customer/dashboard')
      if (!response.ok) {
        throw new Error('Failed to fetch dashboard data')
      }
      const result = await response.json()
      setData(result)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'An error occurred')
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    fetchData()
  }, [fetchData])

  const counts = data?.counts || {
    pending: 0,
    awaiting: 0,
    completed: 0,
    authorized: 0,
    traceability: 0,
  }

  return (
    <div className="flex min-h-[calc(100vh-64px)]">
      <Sidebar activeView={activeView} onViewChange={setActiveView} counts={counts} />

      <main className="flex-1 p-6 bg-gray-50">
        <div className="max-w-7xl mx-auto">
          {/* Header */}
          <div className="mb-6">
            <h1 className="text-2xl font-bold text-gray-900">{viewTitles[activeView]}</h1>
            <p className="text-gray-600 mt-1">{viewDescriptions[activeView]}</p>
          </div>

          {/* Error State */}
          {error && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4 mb-6">
              <p className="text-red-600">{error}</p>
              <button
                onClick={fetchData}
                className="mt-2 text-sm text-red-700 underline hover:no-underline"
              >
                Try again
              </button>
            </div>
          )}

          {/* Content */}
          {activeView === 'pending' && (
            <PendingReviewTable
              certificates={data?.pending || []}
              isLoading={isLoading}
            />
          )}
          {activeView === 'awaiting' && (
            <AwaitingResponseTable
              certificates={data?.awaiting || []}
              isLoading={isLoading}
            />
          )}
          {activeView === 'completed' && (
            <CompletedTable
              certificates={data?.completed || []}
              isLoading={isLoading}
            />
          )}
          {activeView === 'authorized' && (
            <AuthorizedTable
              certificates={data?.authorized || []}
              isLoading={isLoading}
            />
          )}
          {activeView === 'traceability' && (
            <TraceabilityTable
              instruments={data?.traceability || []}
              isLoading={isLoading}
            />
          )}
        </div>
      </main>
    </div>
  )
}
