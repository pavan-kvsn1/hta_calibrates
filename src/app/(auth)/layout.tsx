'use client'

import { AppFooter } from '@/components/layout/AppFooter'

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <div className="min-h-screen flex flex-col bg-gray-50">
      {/* Main content - centered */}
      <main className="flex-1 flex items-center justify-center">
        {children}
      </main>

      {/* Footer */}
      <AppFooter />
    </div>
  )
}
