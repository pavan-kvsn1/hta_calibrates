import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import {
  Building2,
  UserCheck,
  Users,
  UserPlus,
  Wrench,
  FileText,
  Clock,
  AlertTriangle,
  AlertCircle,
  CheckCircle,
  ArrowRight,
  ShieldCheck,
  TrendingUp,
} from 'lucide-react'
import Link from 'next/link'

async function getAdminStats() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const thirtyDaysFromNow = new Date(today)
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const fortyEightHoursAgo = new Date()
  fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48)

  const twentyFourHoursAgo = new Date()
  twentyFourHoursAgo.setHours(twentyFourHoursAgo.getHours() - 24)

  const [
    // Overview stats (matching wireframe: Engineers, Customers, Certificates, Instruments)
    totalEngineers,
    totalCustomerAccounts,
    totalCertificates,
    totalInstruments,

    // Attention items
    pendingRequests,
    expiredInstruments,
    expiringInstruments,
    staleCertificates,
    overdueCertificates,

    // TAT metrics - certificates in active workflow states
    activeCertificatesForTAT,

    // Recent activity data
    recentCertificateEvents,
    recentRequests,
  ] = await Promise.all([
    // Total engineers (staff users with ENGINEER role)
    prisma.user.count({
      where: { role: 'ENGINEER', isActive: true },
    }),

    // Customer accounts
    prisma.customerAccount.count({ where: { isActive: true } }),

    // Total certificates
    prisma.certificate.count(),

    // Total active instruments
    prisma.masterInstrument.count({ where: { isActive: true } }),

    // Pending customer requests (user additions, POC changes)
    prisma.customerRequest.count({ where: { status: 'PENDING' } }),

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

    // Overdue certificates (TAT > 48h, still in active workflow)
    prisma.certificate.count({
      where: {
        status: {
          in: ['PENDING_REVIEW', 'PENDING_HOD_REVIEW', 'PENDING_CUSTOMER_APPROVAL'],
        },
        updatedAt: { lt: fortyEightHoursAgo },
      },
    }),

    // Active certificates for TAT calculation
    prisma.certificate.findMany({
      where: {
        status: {
          notIn: ['DRAFT', 'APPROVED', 'REJECTED'],
        },
      },
      select: {
        updatedAt: true,
        status: true,
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

    // Recent customer requests
    prisma.customerRequest.findMany({
      orderBy: { createdAt: 'desc' },
      take: 10,
      select: {
        id: true,
        type: true,
        status: true,
        data: true,
        createdAt: true,
        customerAccount: {
          select: { companyName: true },
        },
      },
    }),
  ])

  // Calculate TAT metrics
  const now = new Date()
  let totalTATHours = 0
  let onTrackCount = 0
  let warningCount = 0
  let overdueCount = 0

  activeCertificatesForTAT.forEach((cert) => {
    const hoursElapsed = Math.floor(
      (now.getTime() - cert.updatedAt.getTime()) / (1000 * 60 * 60)
    )
    totalTATHours += hoursElapsed

    if (hoursElapsed <= 24) {
      onTrackCount++
    } else if (hoursElapsed <= 48) {
      warningCount++
    } else {
      overdueCount++
    }
  })

  const totalActive = activeCertificatesForTAT.length
  const averageTAT = totalActive > 0 ? Math.round(totalTATHours / totalActive) : 0
  const onTrackPercent = totalActive > 0 ? Math.round((onTrackCount / totalActive) * 100) : 100
  const warningPercent = totalActive > 0 ? Math.round((warningCount / totalActive) * 100) : 0
  const overduePercent = totalActive > 0 ? Math.round((overdueCount / totalActive) * 100) : 0

  return {
    // Overview stats
    totalEngineers,
    totalCustomerAccounts,
    totalCertificates,
    totalInstruments,

    // Attention items
    pendingRequests,
    expiredInstruments,
    expiringInstruments,
    staleCertificates,
    overdueCertificates,

    // TAT metrics
    tatMetrics: {
      averageTAT,
      onTrackPercent,
      warningPercent,
      overduePercent,
      totalActive,
    },

    // Recent activity
    recentCertificateEvents,
    recentRequests,
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
  events: Array<{ createdAt: Date; description: string; type: 'event' | 'request' }>
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
    ...stats.recentRequests.map((r) => {
      const data = r.data as { name?: string; email?: string }
      const label = r.type === 'USER_ADDITION'
        ? `User addition: ${data.name || data.email || 'Unknown'}`
        : 'POC change request'
      return {
        createdAt: r.createdAt,
        description:
          r.status === 'PENDING'
            ? `New ${label} (${r.customerAccount.companyName})`
            : r.status === 'APPROVED'
              ? `Approved: ${label}`
              : `Rejected: ${label}`,
        type: 'request' as const,
      }
    }),
  ]
    .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime())
    .slice(0, 15)

  const groupedActivity = groupByDate(allActivity)

  // Overview stat cards (matching wireframe: Engineers, Customers, Certificates, Instruments)
  const overviewCards = [
    {
      title: 'Engineers',
      value: stats.totalEngineers,
      subtitle: 'Active staff',
      icon: Users,
      href: '/admin/users',
      color: 'text-blue-600',
      bgColor: 'bg-blue-50',
    },
    {
      title: 'Customers',
      value: stats.totalCustomerAccounts,
      subtitle: 'Active accounts',
      icon: Building2,
      href: '/admin/customers',
      color: 'text-green-600',
      bgColor: 'bg-green-50',
    },
    {
      title: 'Certificates',
      value: stats.totalCertificates,
      subtitle: 'Total created',
      icon: FileText,
      href: '/admin/certificates',
      color: 'text-purple-600',
      bgColor: 'bg-purple-50',
    },
    {
      title: 'Instruments',
      value: stats.totalInstruments,
      subtitle: 'In database',
      icon: Wrench,
      href: '/admin/instruments',
      color: 'text-indigo-600',
      bgColor: 'bg-indigo-50',
    },
  ]

  // Attention items (matching wireframe)
  const attentionItems = [
    {
      count: stats.pendingRequests,
      label: 'Pending customer requests',
      href: '/admin/customers/requests',
      action: 'Review',
      severity: 'critical' as const,
      show: stats.pendingRequests > 0,
    },
    {
      count: stats.expiredInstruments,
      label: 'Instruments with expired calibration',
      href: '/admin/instruments?status=expired',
      action: 'View',
      severity: 'critical' as const,
      show: stats.expiredInstruments > 0,
    },
    {
      count: stats.expiringInstruments,
      label: 'Instruments expiring within 30 days',
      href: '/admin/instruments?status=expiring',
      action: 'View',
      severity: 'warning' as const,
      show: stats.expiringInstruments > 0,
    },
    {
      count: stats.overdueCertificates,
      label: 'Certificates overdue (TAT > 48h)',
      href: '/admin/certificates?status=overdue',
      action: 'View',
      severity: 'critical' as const,
      show: stats.overdueCertificates > 0,
    },
    {
      count: stats.staleCertificates,
      label: 'Certificates in revision > 7 days',
      href: '/admin/certificates?status=REVISION_REQUIRED',
      action: 'View',
      severity: 'warning' as const,
      show: stats.staleCertificates > 0,
    },
  ].filter((item) => item.show)

  return (
    <div className="p-3 h-full">
      {/* Master Bounding Box */}
      <div className="bg-white rounded-xl border border-slate-200 shadow-sm overflow-hidden h-full">
        <div className="p-6 overflow-auto h-full">
          {/* Header */}
          <div className="mb-8">
            <h1 className="text-2xl font-bold text-slate-900">Admin Dashboard</h1>
            <p className="text-slate-500 mt-1">System overview and management</p>
          </div>

          {/* Overview Stats Grid - Compact */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
            {overviewCards.map((stat) => (
              <Link key={stat.title} href={stat.href}>
                <Card className="hover:shadow-md transition-shadow cursor-pointer">
                  <CardContent className="p-3">
                    <div className="flex items-center gap-3">
                      <div className={`p-2 rounded-lg ${stat.bgColor}`}>
                        <stat.icon className={`h-5 w-5 ${stat.color}`} />
                      </div>
                      <div>
                        <p className="text-2xl font-bold text-slate-900">{stat.value}</p>
                        <p className="text-xs text-slate-500">{stat.title}</p>
                      </div>
                    </div>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>

          {/* TAT Metrics */}
          <Card className="mb-6">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wider">TAT Metrics</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="flex flex-wrap items-center gap-8 mb-3">
                <div>
                  <span className="text-slate-600">Average TAT: </span>
                  <span className="font-bold text-slate-900">{stats.tatMetrics.averageTAT}h</span>
                </div>
                <div>
                  <span className="text-slate-600">On Track: </span>
                  <span className="font-bold text-green-600">{stats.tatMetrics.onTrackPercent}%</span>
                </div>
                <div>
                  <span className="text-slate-600">Overdue: </span>
                  <span className="font-bold text-red-600">{stats.tatMetrics.overduePercent}%</span>
                </div>
              </div>
              <div className="h-3 w-full bg-slate-100 rounded-full overflow-hidden flex">
                <div
                  className="bg-green-500 h-full"
                  style={{ width: `${stats.tatMetrics.onTrackPercent}%` }}
                />
                <div
                  className="bg-amber-500 h-full"
                  style={{ width: `${stats.tatMetrics.warningPercent}%` }}
                />
                <div
                  className="bg-red-500 h-full"
                  style={{ width: `${stats.tatMetrics.overduePercent}%` }}
                />
              </div>
            </CardContent>
          </Card>

          {/* Attention Required - Wireframe style */}
          {attentionItems.length > 0 && (
            <div className="mb-6">
              <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3 flex items-center gap-2">
                <AlertTriangle className="h-4 w-4 text-amber-500" />
                Attention Required
              </h3>
              <Card>
                <CardContent className="p-0">
                  <div className="divide-y divide-slate-100">
                    {attentionItems.map((item, idx) => (
                      <Link
                        key={idx}
                        href={item.href}
                        className="flex items-center justify-between px-4 py-3 hover:bg-slate-50 transition-colors group"
                      >
                        <div className="flex items-center gap-3">
                          <span className={`h-2.5 w-2.5 rounded-full ${
                            item.severity === 'critical' ? 'bg-red-500' : 'bg-amber-400'
                          }`} />
                          <span className="text-sm text-slate-700">
                            <strong>{item.count}</strong> {item.label}
                          </span>
                        </div>
                        <span className={`text-xs font-medium px-3 py-1 rounded-full flex items-center gap-1 transition-colors ${
                          item.severity === 'critical'
                            ? 'bg-red-100 text-red-700 group-hover:bg-red-200'
                            : 'bg-amber-100 text-amber-700 group-hover:bg-amber-200'
                        }`}>
                          {item.action}
                          <ArrowRight className="h-3 w-3" />
                        </span>
                      </Link>
                    ))}
                  </div>
                </CardContent>
              </Card>
            </div>
          )}

          {/* Quick Actions */}
          <div className="mb-6">
            <h3 className="text-sm font-semibold text-slate-500 uppercase tracking-wider mb-3">Quick Actions</h3>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              <Link
                href="/admin/users/new"
                className="flex items-center justify-center gap-2 px-5 py-3 bg-white hover:bg-blue-50 rounded-lg text-sm font-semibold text-slate-800 transition-colors border border-slate-200 hover:border-blue-300 shadow-sm"
              >
                <UserPlus className="h-4 w-4 text-blue-600" />
                New User
              </Link>
              <Link
                href="/admin/customers/new"
                className="flex items-center justify-center gap-2 px-5 py-3 bg-white hover:bg-green-50 rounded-lg text-sm font-semibold text-slate-800 transition-colors border border-slate-200 hover:border-green-300 shadow-sm"
              >
                <Building2 className="h-4 w-4 text-green-600" />
                Customer
              </Link>
              <Link
                href="/admin/authorization"
                className="flex items-center justify-center gap-2 px-5 py-3 bg-white hover:bg-amber-50 rounded-lg text-sm font-semibold text-slate-800 transition-colors border border-slate-200 hover:border-amber-300 shadow-sm"
              >
                <ShieldCheck className="h-4 w-4 text-amber-600" />
                Authorize
              </Link>
              <Link
                href="/admin/instruments"
                className="flex items-center justify-center gap-2 px-5 py-3 bg-white hover:bg-purple-50 rounded-lg text-sm font-semibold text-slate-800 transition-colors border border-slate-200 hover:border-purple-300 shadow-sm"
              >
                <Wrench className="h-4 w-4 text-purple-600" />
                Instruments
              </Link>
            </div>
          </div>

          {/* Recent Activity */}
          <Card>
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-semibold text-slate-500 uppercase tracking-wider">Recent Activity</CardTitle>
            </CardHeader>
            <CardContent>
              {groupedActivity.length === 0 ? (
                <div className="text-center py-8 text-slate-500">
                  <FileText className="h-12 w-12 mx-auto mb-3 text-slate-300" />
                  <p className="text-sm">No recent activity</p>
                </div>
              ) : (
                <div className="space-y-4">
                  {groupedActivity.map((group) => (
                    <div key={group.label}>
                      <p className="text-sm font-medium text-slate-900 mb-2">
                        {group.label}
                      </p>
                      <div className="space-y-1.5">
                        {group.items.map((item, idx) => (
                          <div
                            key={idx}
                            className="flex items-center justify-between text-sm py-1"
                          >
                            <span className="text-slate-600">• {item.description}</span>
                            <span className="text-slate-400 text-xs ml-4 flex-shrink-0">
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
    </div>
  )
}
