import { redirect } from 'next/navigation'
import { auth, canAccessAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { AdminSidebar } from '@/components/admin/AdminSidebar'

async function getSidebarBadges() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const thirtyDaysFromNow = new Date(today)
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const [pendingRegistrations, expiredInstruments, expiringInstruments, pendingAuthorizations] = await Promise.all([
    prisma.customerRegistration.count({ where: { status: 'PENDING' } }),
    prisma.masterInstrument.count({
      where: {
        isActive: true,
        calibrationDueDate: { lt: today },
      },
    }),
    prisma.masterInstrument.count({
      where: {
        isActive: true,
        calibrationDueDate: { gte: today, lte: thirtyDaysFromNow },
      },
    }),
    prisma.certificate.count({ where: { status: 'PENDING_ADMIN_AUTHORIZATION' } }),
  ])

  return {
    pendingRegistrations,
    instrumentAlerts: expiredInstruments + expiringInstruments,
    pendingAuthorizations,
  }
}

export default async function AdminLayout({
  children,
}: {
  children: React.ReactNode
}) {
  const session = await auth()

  // Redirect non-authenticated users to login
  if (!session?.user) {
    redirect('/login')
  }

  // Check if user can access admin (ADMIN role OR HoD with isAdmin flag)
  if (!canAccessAdmin(session.user)) {
    redirect('/dashboard')
  }

  const badges = await getSidebarBadges()

  // Check if this is an HoD with admin access (to show "Switch to Manager" link)
  const isHodWithAdmin = session.user.role === 'HOD' && session.user.isAdmin === true

  return (
    <div className="min-h-screen bg-white">
      <div className="flex">
        {/* Sidebar */}
        <AdminSidebar
          userName={session.user.name}
          userEmail={session.user.email}
          pendingRegistrations={badges.pendingRegistrations}
          instrumentAlerts={badges.instrumentAlerts}
          pendingAuthorizations={badges.pendingAuthorizations}
          isHodWithAdmin={isHodWithAdmin}
        />

        {/* Main Content */}
        <main className="flex-1 ml-64">
          {children}
        </main>
      </div>
    </div>
  )
}
