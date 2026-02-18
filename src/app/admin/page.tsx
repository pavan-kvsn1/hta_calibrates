import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Users,
  Building2,
  UserCheck,
  Wrench,
  FileText,
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  Plus,
  Upload,
} from 'lucide-react'
import Link from 'next/link'

async function getAdminStats() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const thirtyDaysFromNow = new Date(today)
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const [
    // Overview stats
    staffByRole,
    totalCustomerAccounts,
    activeCertificates,
    totalInstruments,

    // Attention items
    pendingRegistrations,
    expiredInstruments,
    expiringInstruments,
    staleCertificates,

    // Recent activity data
    recentCertificateEvents,
    recentRegistrations,
  ] = await Promise.all([
    // Staff users grouped by role
    prisma.user.groupBy({
      by: ['role'],
      where: { isActive: true },
      _count: true,
    }),

    // Customer accounts
    prisma.customerAccount.count({ where: { isActive: true } }),

    // Active certificates (not in terminal state)
    prisma.certificate.count({
      where: {
        status: { notIn: ['APPROVED', 'REJECTED'] },
      },
    }),

    // Total active instruments
    prisma.masterInstrument.count({ where: { isActive: true } }),

    // Pending registrations
    prisma.customerRegistration.count({ where: { status: 'PENDING' } }),

    // Expired instruments
    prisma.masterInstrument.count({
      where: {
        isActive: true,
        calibrationDueDate: { lt: today },
      },
    }),

    // Expiring within 30 days
    prisma.masterInstrument.count({
      where: {
        isActive: true,
        calibrationDueDate: { gte: today, lte: thirtyDaysFromNow },
      },
    }),

    // Stale certificates (in revision > 7 days)
    prisma.certificate.count({
      where: {
        status: { in: ['REVISION_REQUIRED', 'CUSTOMER_REVISION_REQUIRED'] },
        updatedAt: { lt: sevenDaysAgo },
      },
    }),

    // Recent certificate events
    prisma.certificateEvent.findMany({
      where: {
        eventType: {
          in: [
            'CREATED',
            'SUBMITTED_FOR_REVIEW',
            'HOD_APPROVED',
            'HOD_REJECTED',
            'CUSTOMER_APPROVED',
            'CUSTOMER_REJECTED',
          ],
        },
      },
      orderBy: { createdAt: 'desc' },
      take: 15,
      include: {
        certificate: {
          select: { certificateNumber: true },
        },
        user: {
          select: { name: true },
        },
      },
    }),

    // Recent registrations
    prisma.customerRegistration.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        email: true,
        status: true,
        createdAt: true,
      },
    }),
  ])

  // Calculate total staff
  const totalStaff = staffByRole.reduce((sum, group) => sum + group._count, 0)
  const staffBreakdown = staffByRole.reduce(
    (acc, group) => {
      acc[group.role] = group._count
      return acc
    },
    {} as Record<string, number>
  )

  return {
    // Overview stats
    totalStaff,
    staffBreakdown,
    totalCustomerAccounts,
    activeCertificates,
    totalInstruments,

    // Attention items
    pendingRegistrations,
    expiredInstruments,
    expiringInstruments,
    staleCertificates,

    // Recent activity
    recentCertificateEvents,
    recentRegistrations,
  }
}

function formatEventDescription(event: {
  eventType: string
  certificate: { certificateNumber: string }
  user: { name: string } | null
}) {
  const certNumber = event.certificate.certificateNumber
  const userName = event.user?.name || 'System'

  switch (event.eventType) {
    case 'CREATED':
      return `${userName} created ${certNumber}`
    case 'SUBMITTED_FOR_REVIEW':
      return `${userName} submitted ${certNumber}`
    case 'HOD_APPROVED':
      return `${userName} approved ${certNumber}`
    case 'HOD_REJECTED':
      return `${userName} returned ${certNumber} for revision`
    case 'CUSTOMER_APPROVED':
      return `Customer approved ${certNumber}`
    case 'CUSTOMER_REJECTED':
      return `Customer requested revision for ${certNumber}`
    default:
      return `${event.eventType} on ${certNumber}`
  }
}

function formatRelativeTime(date: Date) {
  const now = new Date()
  const diffMs = now.getTime() - date.getTime()
  const diffMins = Math.floor(diffMs / 60000)
  const diffHours = Math.floor(diffMs / 3600000)
  const diffDays = Math.floor(diffMs / 86400000)

  if (diffMins < 1) return 'Just now'
  if (diffMins < 60) return `${diffMins}m ago`
  if (diffHours < 24) return `${diffHours}h ago`
  if (diffDays === 1) return 'Yesterday'
  if (diffDays < 7) return `${diffDays}d ago`
  return date.toLocaleDateString()
}

function groupByDate(
  events: Array<{ createdAt: Date; description: string; type: 'event' | 'registration' }>
) {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const yesterday = new Date(today)
  yesterday.setDate(yesterday.getDate() - 1)

  const groups: { label: string; items: typeof events }[] = [
    { label: 'Today', items: [] },
    { label: 'Yesterday', items: [] },
    { label: 'Earlier', items: [] },
  ]

  events.forEach((event) => {
    const eventDate = new Date(event.createdAt)
    eventDate.setHours(0, 0, 0, 0)

    if (eventDate.getTime() === today.getTime()) {
      groups[0].items.push(event)
    } else if (eventDate.getTime() === yesterday.getTime()) {
      groups[1].items.push(event)
    } else {
      groups[2].items.push(event)
    }
  })

  return groups.filter((g) => g.items.length > 0)
}

export default async function AdminDashboard() {
  const stats = await getAdminStats()

  // Combine and sort activity
  const allActivity = [
    ...stats.recentCertificateEvents.map((e) => ({
      createdAt: e.createdAt,
      description: formatEventDescription(e),
      type: 'event' as const,
    })),
    ...stats.recentRegistrations.map((r) => ({
      createdAt: r.createdAt,
      description:
        r.status === 'PENDING'
          ? `New registration: ${r.email}`
          : r.status === 'APPROVED'
            ? `Registration approved: ${r.email}`
            : `Registration rejected: ${r.email}`,
      type: 'registration' as const,
    })),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 15)

  const groupedActivity = groupByDate(allActivity)

  // Overview stat cards
  const overviewCards = [
    {
      title: 'Staff Users',
      value: stats.totalStaff,
      subtitle: `${stats.staffBreakdown['ENGINEER'] || 0} Engineers, ${stats.staffBreakdown['HOD'] || 0} HoD`,
      icon: Users,
      href: '/admin/users',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Customer Accounts',
      value: stats.totalCustomerAccounts,
      subtitle: 'Active accounts',
      icon: Building2,
      href: '/admin/customers',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Active Certificates',
      value: stats.activeCertificates,
      subtitle: 'In progress',
      icon: FileText,
      href: '/admin/certificates',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Master Instruments',
      value: stats.totalInstruments,
      subtitle: 'In database',
      icon: Wrench,
      href: '/admin/instruments',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
  ]

  // Attention items
  const attentionItems = [
    {
      count: stats.pendingRegistrations,
      label: 'customer registrations pending approval',
      href: '/admin/registrations',
      action: 'Review registrations',
      severity: 'critical' as const,
      show: stats.pendingRegistrations > 0,
    },
    {
      count: stats.expiredInstruments,
      label: 'instruments have expired calibration',
      href: '/admin/instruments?status=expired',
      action: 'View expired instruments',
      severity: 'critical' as const,
      show: stats.expiredInstruments > 0,
    },
    {
      count: stats.expiringInstruments,
      label: 'instruments expiring within 30 days',
      href: '/admin/instruments?status=expiring',
      action: 'View expiring instruments',
      severity: 'warning' as const,
      show: stats.expiringInstruments > 0,
    },
    {
      count: stats.staleCertificates,
      label: 'certificates in revision for > 7 days',
      href: '/admin/certificates?status=REVISION_REQUIRED',
      action: 'View stale certificates',
      severity: 'warning' as const,
      show: stats.staleCertificates > 0,
    },
  ].filter((item) => item.show)

  return (
    <div className="p-8">
      {/* Header */}
      <div className="mb-8">
        <h1 className="text-2xl font-bold text-gray-900">Admin Dashboard</h1>
        <p className="text-gray-500 mt-1">System overview and management</p>
      </div>

      {/* Overview Stats Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 mb-8">
        {overviewCards.map((stat) => (
          <Link key={stat.title} href={stat.href}>
            <Card className="hover:shadow-md transition-shadow cursor-pointer h-full">
              <CardContent className="p-5">
                <div className="flex items-start justify-between">
                  <div>
                    <p className="text-sm font-medium text-gray-500">{stat.title}</p>
                    <p className="text-3xl font-bold text-gray-900 mt-1">{stat.value}</p>
                    <p className="text-xs text-gray-400 mt-1">{stat.subtitle}</p>
                  </div>
                  <div className={`p-3 rounded-lg ${stat.bgColor}`}>
                    <stat.icon className={`h-6 w-6 ${stat.color}`} />
                  </div>
                </div>
              </CardContent>
            </Card>
          </Link>
        ))}
      </div>

      {/* Attention Items */}
      {attentionItems.length > 0 && (
        <Card className="mb-8 border-l-4 border-l-amber-400">
          <CardHeader className="pb-3">
            <CardTitle className="text-lg flex items-center gap-2">
              <AlertTriangle className="h-5 w-5 text-amber-500" />
              Attention Required
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3">
            {attentionItems.map((item, idx) => (
              <Link
                key={idx}
                href={item.href}
                className={`flex items-center justify-between p-3 rounded-lg border transition-colors ${
                  item.severity === 'critical'
                    ? 'border-red-200 bg-red-50 hover:bg-red-100'
                    : 'border-amber-200 bg-amber-50 hover:bg-amber-100'
                }`}
              >
                <div className="flex items-center gap-3">
                  {item.severity === 'critical' ? (
                    <AlertCircle className="h-5 w-5 text-red-500" />
                  ) : (
                    <Clock className="h-5 w-5 text-amber-500" />
                  )}
                  <span
                    className={
                      item.severity === 'critical' ? 'text-red-800' : 'text-amber-800'
                    }
                  >
                    <strong>{item.count}</strong> {item.label}
                  </span>
                </div>
                <span
                  className={`text-sm flex items-center gap-1 ${
                    item.severity === 'critical' ? 'text-red-600' : 'text-amber-600'
                  }`}
                >
                  {item.action}
                  <ArrowRight className="h-4 w-4" />
                </span>
              </Link>
            ))}
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Quick Actions */}
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Quick Actions</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-2 gap-3">
            <Link
              href="/admin/users/new"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors text-center"
            >
              <div className="p-3 bg-blue-50 rounded-lg">
                <Plus className="h-5 w-5 text-blue-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Create Staff User</p>
                <p className="text-xs text-gray-500">Add engineer or HoD</p>
              </div>
            </Link>

            <Link
              href="/admin/customers/new"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors text-center"
            >
              <div className="p-3 bg-green-50 rounded-lg">
                <Building2 className="h-5 w-5 text-green-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Create Customer</p>
                <p className="text-xs text-gray-500">New company account</p>
              </div>
            </Link>

            {stats.pendingRegistrations > 0 && (
              <Link
                href="/admin/registrations"
                className="flex flex-col items-center gap-2 p-4 rounded-lg border border-orange-200 bg-orange-50 hover:bg-orange-100 transition-colors text-center"
              >
                <div className="p-3 bg-orange-100 rounded-lg relative">
                  <UserCheck className="h-5 w-5 text-orange-600" />
                  <Badge className="absolute -top-1 -right-1 bg-orange-500 text-white text-xs px-1.5 py-0.5">
                    {stats.pendingRegistrations}
                  </Badge>
                </div>
                <div>
                  <p className="font-medium text-orange-900 text-sm">Review Registrations</p>
                  <p className="text-xs text-orange-700">Pending approval</p>
                </div>
              </Link>
            )}

            <Link
              href="/admin/instruments"
              className="flex flex-col items-center gap-2 p-4 rounded-lg border border-gray-200 hover:bg-gray-50 hover:border-gray-300 transition-colors text-center"
            >
              <div className="p-3 bg-purple-50 rounded-lg">
                <Upload className="h-5 w-5 text-purple-600" />
              </div>
              <div>
                <p className="font-medium text-gray-900 text-sm">Manage Instruments</p>
                <p className="text-xs text-gray-500">Import or update</p>
              </div>
            </Link>
          </CardContent>
        </Card>

        {/* Recent Activity */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between">
            <CardTitle className="text-lg flex items-center gap-2">
              <Clock className="h-5 w-5 text-gray-400" />
              Recent Activity
            </CardTitle>
          </CardHeader>
          <CardContent>
            {groupedActivity.length === 0 ? (
              <div className="text-center py-8 text-gray-500">
                <FileText className="h-12 w-12 mx-auto mb-3 text-gray-300" />
                <p className="text-sm">No recent activity</p>
              </div>
            ) : (
              <div className="space-y-4 max-h-80 overflow-y-auto">
                {groupedActivity.map((group) => (
                  <div key={group.label}>
                    <p className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
                      {group.label}
                    </p>
                    <div className="space-y-2">
                      {group.items.map((item, idx) => (
                        <div
                          key={idx}
                          className="flex items-start gap-2 text-sm py-1.5 border-b border-gray-100 last:border-0"
                        >
                          {item.type === 'registration' ? (
                            <UserCheck className="h-4 w-4 text-orange-500 mt-0.5 flex-shrink-0" />
                          ) : (
                            <CheckCircle className="h-4 w-4 text-green-500 mt-0.5 flex-shrink-0" />
                          )}
                          <span className="text-gray-700 flex-1">{item.description}</span>
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {formatRelativeTime(item.createdAt)}
                          </span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </CardContent>
        </Card>
      </div>
    </div>
  )
}
