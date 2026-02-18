import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import { CustomerHeader } from '@/components/layout/CustomerHeader'
import { DashboardClient } from './components/DashboardClient'

export default async function CustomerDashboard() {
  const session = await auth()

  if (!session?.user || session.user.role !== 'CUSTOMER') {
    redirect('/customer/login')
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <CustomerHeader title="Dashboard" />
      <DashboardClient />
    </div>
  )
}
