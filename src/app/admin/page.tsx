import { prisma } from '@/lib/prisma'
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card'
import {
  Building2,
  Users,
  UserPlus,
  Wrench,
  FileText,
  AlertTriangle,
  ArrowRight,
  ShieldCheck,
  TrendingDown,
  TrendingUp,
  Clock,
  UserCheck,
  RefreshCw,
  Building,
  MessageSquare,
  CheckCircle2,
  AlertCircle,
  BadgeCheck,
} from 'lucide-react'
import Link from 'next/link'
import {
  calculateCertificateTAT,
  aggregateTATMetrics,
  compareWeeklyMetrics,
} from '@/lib/utils/tat-calculator'

// Format hours - show minutes if hours rounds to 0, seconds if minutes rounds to 0
function formatTATHours(hours: number): string {
  if (hours === 0) return '0h'
  if (hours < 1) {
    const minutes = Math.round(hours * 60)
    if (minutes === 0) {
      // Less than 30 seconds would round to 0 minutes, show seconds instead
      const seconds = Math.round(hours * 3600)
      return `${Math.max(1, seconds)}s`
    }
    return `${minutes}m`
  }
  return `${Math.round(hours)}h`
}

async function getAdminStats() {
  const today = new Date()
  today.setHours(0, 0, 0, 0)

  const thirtyDaysFromNow = new Date(today)
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30)

  const sevenDaysAgo = new Date(today)
  sevenDaysAgo.setDate(sevenDaysAgo.getDate() - 7)

  const fourteenDaysAgo = new Date(today)
  fourteenDaysAgo.setDate(fourteenDaysAgo.getDate() - 14)

  const fortyEightHoursAgo = new Date()
  fortyEightHoursAgo.setHours(fortyEightHoursAgo.getHours() - 48)

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

    // Certificates with events for TAT calculation (last 2 weeks)
    certificatesWithEvents,

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
          in: ['PENDING_REVIEW', 'PENDING_CUSTOMER_APPROVAL'],
        },
        updatedAt: { lt: fortyEightHoursAgo },
      },
    }),

    // Certificates with events in the last 2 weeks (for TAT calculation)
    prisma.certificate.findMany({
      where: {
        events: {
          some: {
            createdAt: { gte: fourteenDaysAgo },
          },
        },
      },
      select: {
        id: true,
        status: true,
        currentRevision: true,
        events: {
          select: {
            id: true,
            eventType: true,
            createdAt: true,
            certificateId: true,
          },
          orderBy: { createdAt: 'asc' },
        },
      },
    }),

    // Recent certificate events
    prisma.certificateEvent.findMany({
      where: {
        eventType: {
          in: [
            'CREATED',
            'SUBMITTED_FOR_REVIEW',
            'REVIEWER_APPROVED',
            'REVIEWER_REJECTED',
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

  // Calculate TAT metrics using event-based calculation
  // Separate certificates by which week they were completed (authorized)
  const thisWeekCerts: typeof certificatesWithEvents = []
  const lastWeekCerts: typeof certificatesWithEvents = []

  certificatesWithEvents.forEach((cert) => {
    // Find ADMIN_SIGNED event to determine completion date
    const adminSignedEvent = cert.events.find(e => e.eventType === 'ADMIN_AUTHORIZED')

    if (adminSignedEvent) {
      const completedAt = new Date(adminSignedEvent.createdAt)
      if (completedAt >= sevenDaysAgo) {
        thisWeekCerts.push(cert)
      } else if (completedAt >= fourteenDaysAgo) {
        lastWeekCerts.push(cert)
      }
    } else {
      // Not completed - include in this week's active metrics
      // Check if it had activity this week
      const hasThisWeekActivity = cert.events.some(
        e => new Date(e.createdAt) >= sevenDaysAgo
      )
      if (hasThisWeekActivity) {
        thisWeekCerts.push(cert)
      }
    }
  })

  // Calculate metrics for each certificate
  const thisWeekMetrics = thisWeekCerts
    .map(cert => calculateCertificateTAT(cert.events))
    .filter((m): m is NonNullable<typeof m> => m !== null)

  const lastWeekMetrics = lastWeekCerts
    .map(cert => calculateCertificateTAT(cert.events))
    .filter((m): m is NonNullable<typeof m> => m !== null)

  // Aggregate metrics
  const thisWeekAggregated = aggregateTATMetrics(thisWeekMetrics)
  const lastWeekAggregated = aggregateTATMetrics(lastWeekMetrics)

  // Calculate week-over-week comparison
  const tatComparison = compareWeeklyMetrics(thisWeekAggregated, lastWeekAggregated)

  // Calculate revision-based cycles (simpler: currentRevision - 1 = number of revision cycles)
  const thisWeekRevisionCycles = thisWeekCerts.reduce((sum, cert) => sum + Math.max(0, cert.currentRevision - 1), 0)
  const lastWeekRevisionCycles = lastWeekCerts.reduce((sum, cert) => sum + Math.max(0, cert.currentRevision - 1), 0)
  const thisWeekAvgRevisions = thisWeekCerts.length > 0
    ? Math.round((thisWeekRevisionCycles / thisWeekCerts.length) * 10) / 10
    : 0
  const lastWeekAvgRevisions = lastWeekCerts.length > 0
    ? Math.round((lastWeekRevisionCycles / lastWeekCerts.length) * 10) / 10
    : 0
  const revisionCycleChange = lastWeekAvgRevisions > 0
    ? Math.round(((thisWeekAvgRevisions - lastWeekAvgRevisions) / lastWeekAvgRevisions) * 100)
    : 0

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

    // TAT metrics with week-over-week comparison
    tatComparison,

    // Revision-based cycle stats (simpler calculation)
    revisionStats: {
      thisWeekAvg: thisWeekAvgRevisions,
      lastWeekAvg: lastWeekAvgRevisions,
      totalThisWeek: thisWeekRevisionCycles,
      changePercent: revisionCycleChange,
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
    case 'REVIEWER_APPROVED':
      return `${userName} approved ${certNumber}`
    case 'REVIEWER_REJECTED':
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
      href: '/admin/requests',
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

          {/* TAT Metrics - Week over Week */}
          <Card className="mb-6">
            {/* Header with week-over-week trend summary */}
            <CardHeader className="pb-0">
              <div className="flex items-center justify-between">
                <div>
                  <CardTitle className="text-base font-semibold text-slate-900 flex items-center gap-2">
                    <Clock className="h-5 w-5 text-slate-500" />
                    Turn Around Time
                  </CardTitle>
                  <p className="text-slate-500 text-sm mt-0.5">This week&apos;s performance vs last week</p>
                </div>
                <div className="flex items-center gap-3">
                  {/* TAT Trend Badge */}
                  {(() => {
                    const change = stats.tatComparison.changes.totalTAT
                    const isImproved = change.hours < 0
                    const isWorse = change.hours > 0
                    return (
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${
                        isImproved ? 'bg-green-50 text-green-700 border-green-200' :
                        isWorse ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {isImproved ? <TrendingDown className="h-4 w-4" /> :
                         isWorse ? <TrendingUp className="h-4 w-4" /> :
                         <span className="text-xs">—</span>}
                        <span>TAT {isImproved ? `${Math.abs(change.percent)}% faster` :
                                   isWorse ? `${Math.abs(change.percent)}% slower` :
                                   'No change'}</span>
                      </div>
                    )
                  })()}
                  {/* Cycles Trend Badge */}
                  {(() => {
                    const change = stats.revisionStats.changePercent
                    const isImproved = change < 0
                    const isWorse = change > 0
                    return (
                      <div className={`flex items-center gap-1.5 px-3 py-1.5 rounded-full text-sm font-medium border ${
                        isImproved ? 'bg-green-50 text-green-700 border-green-200' :
                        isWorse ? 'bg-red-50 text-red-700 border-red-200' :
                        'bg-slate-50 text-slate-600 border-slate-200'
                      }`}>
                        {isImproved ? <TrendingDown className="h-4 w-4" /> :
                         isWorse ? <TrendingUp className="h-4 w-4" /> :
                         <span className="text-xs">—</span>}
                        <span>Revisions {isImproved ? `${Math.abs(change)}% fewer` :
                                        isWorse ? `${Math.abs(change)}% more` :
                                        'No change'}</span>
                      </div>
                    )
                  })()}
                </div>
              </div>
            </CardHeader>

            <CardContent className="p-0">
              {/* Summary Stats Row */}
              <div className="grid grid-cols-4 divide-x divide-slate-100 bg-slate-50/50 border-b border-slate-100">
                <div className="py-3 px-4 text-center">
                  <div className="text-xl font-bold text-slate-900">{formatTATHours(stats.tatComparison.thisWeek.totalTAT.avgHours)}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Avg Total TAT</div>
                </div>
                <div className="py-3 px-4 text-center">
                  <div className="text-xl font-bold text-slate-900">{stats.revisionStats.thisWeekAvg}</div>
                  <div className="text-xs text-slate-500 mt-0.5">Avg Revisions</div>
                </div>
                <div className="py-3 px-4 text-center">
                  <div className="text-xl font-bold text-green-600 flex items-center justify-center gap-1">
                    <CheckCircle2 className="h-4 w-4" />
                    {stats.tatComparison.thisWeek.totalTAT.completedCount}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">Completed</div>
                </div>
                <div className="py-3 px-4 text-center">
                  <div className={`text-xl font-bold flex items-center justify-center gap-1 ${
                    stats.tatComparison.thisWeek.totalTAT.overdueCount > 0 ? 'text-red-600' : 'text-slate-400'
                  }`}>
                    {stats.tatComparison.thisWeek.totalTAT.overdueCount > 0 && <AlertCircle className="h-4 w-4" />}
                    {stats.tatComparison.thisWeek.totalTAT.overdueCount}
                  </div>
                  <div className="text-xs text-slate-500 mt-0.5">Overdue</div>
                </div>
              </div>

              {/* Stage Breakdown */}
              <div className="p-4">
                <div className="text-xs font-semibold text-slate-500 uppercase tracking-wider mb-3">Stage Breakdown</div>
                <div className="grid grid-cols-2 lg:grid-cols-5 gap-3">
                  {/* Reviewer Stage */}
                  <div className="relative rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 rounded-lg bg-amber-100">
                        <UserCheck className="h-4 w-4 text-amber-600" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">Reviewer</span>
                    </div>
                    {/* TAT */}
                    <div className="mb-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-bold text-slate-900">{formatTATHours(stats.tatComparison.thisWeek.reviewer.avgHours)}</span>
                        {stats.tatComparison.changes.reviewer.hours !== 0 && (
                          <span className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${
                            stats.tatComparison.changes.reviewer.hours < 0
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {stats.tatComparison.changes.reviewer.hours < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                            {Math.abs(stats.tatComparison.changes.reviewer.hoursPercent)}%
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">avg response time</div>
                    </div>
                    {/* Cycles */}
                    <div className="pt-3 border-t border-slate-100">
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-semibold text-slate-700">{stats.tatComparison.thisWeek.reviewer.avgCycles}</span>
                        {stats.tatComparison.changes.reviewer.cyclesPercent !== 0 && (
                          <span className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${
                            stats.tatComparison.changes.reviewer.cyclesPercent < 0
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {stats.tatComparison.changes.reviewer.cyclesPercent < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                            {Math.abs(stats.tatComparison.changes.reviewer.cyclesPercent)}%
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">review cycles</div>
                    </div>
                  </div>

                  {/* Engineer Revision Stage */}
                  <div className="relative rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 rounded-lg bg-orange-100">
                        <RefreshCw className="h-4 w-4 text-orange-600" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">Engineer Rev.</span>
                    </div>
                    {/* TAT */}
                    <div className="mb-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-bold text-slate-900">{formatTATHours(stats.tatComparison.thisWeek.engineerRevision.avgHours)}</span>
                        {stats.tatComparison.changes.engineerRevision.hours !== 0 && (
                          <span className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${
                            stats.tatComparison.changes.engineerRevision.hours < 0
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {stats.tatComparison.changes.engineerRevision.hours < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                            {Math.abs(stats.tatComparison.changes.engineerRevision.hoursPercent)}%
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">avg revision time</div>
                    </div>
                    {/* Cycles */}
                    <div className="pt-3 border-t border-slate-100">
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-semibold text-slate-700">{stats.tatComparison.thisWeek.engineerRevision.avgCycles}</span>
                        {stats.tatComparison.changes.engineerRevision.cyclesPercent !== 0 && (
                          <span className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${
                            stats.tatComparison.changes.engineerRevision.cyclesPercent < 0
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {stats.tatComparison.changes.engineerRevision.cyclesPercent < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                            {Math.abs(stats.tatComparison.changes.engineerRevision.cyclesPercent)}%
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">revision cycles</div>
                    </div>
                  </div>

                  {/* Customer Stage */}
                  <div className="relative rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 rounded-lg bg-blue-100">
                        <Building className="h-4 w-4 text-blue-600" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">Customer</span>
                    </div>
                    {/* TAT */}
                    <div className="mb-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-bold text-slate-900">{formatTATHours(stats.tatComparison.thisWeek.customer.avgHours)}</span>
                        {stats.tatComparison.changes.customer.hours !== 0 && (
                          <span className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${
                            stats.tatComparison.changes.customer.hours < 0
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {stats.tatComparison.changes.customer.hours < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                            {Math.abs(stats.tatComparison.changes.customer.hoursPercent)}%
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">avg approval time</div>
                    </div>
                    {/* Cycles */}
                    <div className="pt-3 border-t border-slate-100">
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-semibold text-slate-700">{stats.tatComparison.thisWeek.customer.avgCycles}</span>
                        {stats.tatComparison.changes.customer.cyclesPercent !== 0 && (
                          <span className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${
                            stats.tatComparison.changes.customer.cyclesPercent < 0
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {stats.tatComparison.changes.customer.cyclesPercent < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                            {Math.abs(stats.tatComparison.changes.customer.cyclesPercent)}%
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">approval cycles</div>
                    </div>
                  </div>

                  {/* Customer Revision Stage */}
                  <div className="relative rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 rounded-lg bg-purple-100">
                        <MessageSquare className="h-4 w-4 text-purple-600" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">Cust. Revision</span>
                    </div>
                    {/* TAT */}
                    <div className="mb-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-bold text-slate-900">{formatTATHours(stats.tatComparison.thisWeek.customerRevision.avgHours)}</span>
                        {stats.tatComparison.changes.customerRevision.hours !== 0 && (
                          <span className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${
                            stats.tatComparison.changes.customerRevision.hours < 0
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {stats.tatComparison.changes.customerRevision.hours < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                            {Math.abs(stats.tatComparison.changes.customerRevision.hoursPercent)}%
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">avg response time</div>
                    </div>
                    {/* Cycles */}
                    <div className="pt-3 border-t border-slate-100">
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-semibold text-slate-700">{stats.tatComparison.thisWeek.customerRevision.avgCycles}</span>
                        {stats.tatComparison.changes.customerRevision.cyclesPercent !== 0 && (
                          <span className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${
                            stats.tatComparison.changes.customerRevision.cyclesPercent < 0
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {stats.tatComparison.changes.customerRevision.cyclesPercent < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                            {Math.abs(stats.tatComparison.changes.customerRevision.cyclesPercent)}%
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">revision cycles</div>
                    </div>
                  </div>

                  {/* Admin Approval Stage */}
                  <div className="relative rounded-xl border border-slate-200 bg-white p-4 hover:shadow-md transition-shadow">
                    <div className="flex items-center gap-2 mb-3">
                      <div className="p-1.5 rounded-lg bg-green-100">
                        <BadgeCheck className="h-4 w-4 text-green-600" />
                      </div>
                      <span className="text-sm font-semibold text-slate-700">Admin</span>
                    </div>
                    {/* TAT */}
                    <div className="mb-3">
                      <div className="flex items-baseline justify-between">
                        <span className="text-2xl font-bold text-slate-900">{formatTATHours(stats.tatComparison.thisWeek.adminApproval.avgHours)}</span>
                        {stats.tatComparison.changes.adminApproval.hours !== 0 && (
                          <span className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${
                            stats.tatComparison.changes.adminApproval.hours < 0
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {stats.tatComparison.changes.adminApproval.hours < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                            {Math.abs(stats.tatComparison.changes.adminApproval.hoursPercent)}%
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">avg approval time</div>
                    </div>
                    {/* Cycles */}
                    <div className="pt-3 border-t border-slate-100">
                      <div className="flex items-baseline justify-between">
                        <span className="text-lg font-semibold text-slate-700">{stats.tatComparison.thisWeek.adminApproval.avgCycles}</span>
                        {stats.tatComparison.changes.adminApproval.cyclesPercent !== 0 && (
                          <span className={`flex items-center gap-0.5 text-xs font-semibold px-1.5 py-0.5 rounded ${
                            stats.tatComparison.changes.adminApproval.cyclesPercent < 0
                              ? 'bg-green-100 text-green-700'
                              : 'bg-red-100 text-red-700'
                          }`}>
                            {stats.tatComparison.changes.adminApproval.cyclesPercent < 0 ? <TrendingDown className="h-3 w-3" /> : <TrendingUp className="h-3 w-3" />}
                            {Math.abs(stats.tatComparison.changes.adminApproval.cyclesPercent)}%
                          </span>
                        )}
                      </div>
                      <div className="text-xs text-slate-500">approvals</div>
                    </div>
                  </div>
                </div>
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
