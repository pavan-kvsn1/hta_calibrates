import { NextRequest, NextResponse } from 'next/server'
import { prisma } from '@/lib/prisma'
import { auth } from '@/lib/auth'
import { createLogger } from '@/lib/logger'

const logger = createLogger('analytics')

export const dynamic = 'force-dynamic'

interface StageMetrics {
  avgHours: number
  medianHours: number
  count: number
  changePercent: number
}

interface SectionCount {
  section: string
  count: number
}

function calculateMedian(values: number[]): number {
  if (values.length === 0) return 0
  const sorted = [...values].sort((a, b) => a - b)
  const mid = Math.floor(sorted.length / 2)
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2
}

function hoursBetween(start: Date, end: Date): number {
  return (end.getTime() - start.getTime()) / (1000 * 60 * 60)
}

export async function GET(request: NextRequest) {
  try {
    const session = await auth()
    if (!session?.user || session.user.role !== 'ADMIN') {
      return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    }

    const searchParams = request.nextUrl.searchParams
    const days = parseInt(searchParams.get('days') || '30')
    const customerId = searchParams.get('customerId')
    const engineerId = searchParams.get('engineerId')

    const startDate = new Date()
    startDate.setDate(startDate.getDate() - days)

    const prevStartDate = new Date(startDate)
    prevStartDate.setDate(prevStartDate.getDate() - days)

    // Build where clause for filtering
    const whereClause: Record<string, unknown> = {
      createdAt: { gte: startDate },
    }

    // Note: Customer filtering not supported - Certificate stores customerName as text only
    // If needed, could implement by fetching CustomerAccount name and matching against customerName

    if (engineerId && engineerId !== 'all') {
      whereClause.createdById = engineerId
    }

    // Fetch certificates with events
    const certificates = await prisma.certificate.findMany({
      where: whereClause,
      include: {
        createdBy: {
          select: { name: true },
        },
        events: {
          orderBy: { createdAt: 'asc' },
          select: {
            eventType: true,
            createdAt: true,
            eventData: true,
          },
        },
        feedbacks: {
          select: {
            feedbackType: true,
            targetSection: true,
            createdAt: true,
            user: {
              select: { role: true },
            },
          },
        },
      },
    })

    // Fetch previous period certificates for comparison
    const prevCertificates = await prisma.certificate.findMany({
      where: {
        ...whereClause,
        createdAt: { gte: prevStartDate, lt: startDate },
      },
      include: {
        events: {
          orderBy: { createdAt: 'asc' },
          select: {
            eventType: true,
            createdAt: true,
          },
        },
        feedbacks: {
          select: {
            feedbackType: true,
            targetSection: true,
          },
        },
      },
    })

    // Fetch section unlock requests (using InternalRequest model with type SECTION_UNLOCK)
    const unlockRequests = await prisma.internalRequest.findMany({
      where: {
        type: 'SECTION_UNLOCK',
        createdAt: { gte: startDate },
      },
      select: {
        status: true,
        data: true,
        createdAt: true,
        reviewedAt: true,
      },
    })

    // Calculate stage TAT metrics
    const stageTATs = {
      createdToSubmitted: [] as number[],
      submittedToReviewed: [] as number[],
      reviewedToCustomer: [] as number[],
      customerToAuthorized: [] as number[],
      total: [] as number[],
    }

    const prevStageTATs = {
      createdToSubmitted: [] as number[],
      submittedToReviewed: [] as number[],
      reviewedToCustomer: [] as number[],
      customerToAuthorized: [] as number[],
      total: [] as number[],
    }

    // Process current period certificates
    const certificateDetails = certificates.map((cert) => {
      const events = cert.events
      const stages: { name: string; hours: number; status: 'ok' | 'slow' | 'stuck' }[] = []

      // Find key events - use cert.createdAt as the creation time (more reliable than event)
      const createdAt = cert.createdAt
      const submitted = events.find((e) => e.eventType === 'SUBMITTED_FOR_REVIEW')
      const reviewed = events.find(
        (e) =>
          e.eventType === 'APPROVED' ||
          e.eventType === 'REVIEWER_APPROVED' ||
          e.eventType === 'REVIEWER_APPROVED_SENT_TO_CUSTOMER'
      )
      const customerApproved = events.find((e) => e.eventType === 'CUSTOMER_APPROVED')
      const authorized = events.find((e) => e.eventType === 'ADMIN_AUTHORIZED')

      // Created → Submitted (use cert.createdAt for reliability)
      if (submitted) {
        const hours = hoursBetween(createdAt, submitted.createdAt)
        stageTATs.createdToSubmitted.push(hours)
        stages.push({
          name: 'Draft',
          hours,
          status: hours > 48 ? 'stuck' : hours > 24 ? 'slow' : 'ok',
        })
      }

      // Submitted → Reviewed
      if (submitted && reviewed) {
        const hours = hoursBetween(submitted.createdAt, reviewed.createdAt)
        stageTATs.submittedToReviewed.push(hours)
        stages.push({
          name: 'Review',
          hours,
          status: hours > 48 ? 'stuck' : hours > 24 ? 'slow' : 'ok',
        })
      }

      // Reviewed → Customer Approved
      if (reviewed && customerApproved) {
        const hours = hoursBetween(reviewed.createdAt, customerApproved.createdAt)
        stageTATs.reviewedToCustomer.push(hours)
        stages.push({
          name: 'Customer',
          hours,
          status: hours > 48 ? 'stuck' : hours > 24 ? 'slow' : 'ok',
        })
      }

      // Customer Approved → Authorized
      if (customerApproved && authorized) {
        const hours = hoursBetween(customerApproved.createdAt, authorized.createdAt)
        stageTATs.customerToAuthorized.push(hours)
        stages.push({
          name: 'Authorization',
          hours,
          status: hours > 48 ? 'stuck' : hours > 24 ? 'slow' : 'ok',
        })
      }

      // Total TAT (createdAt → authorized)
      if (authorized) {
        const hours = hoursBetween(createdAt, authorized.createdAt)
        stageTATs.total.push(hours)
      }

      // Count revisions
      const reviewerRevisions = cert.feedbacks.filter(
        (f) =>
          f.feedbackType === 'REVISION_REQUEST' ||
          f.feedbackType === 'REVISION_REQUESTED'
      ).length

      const customerRevisions = cert.feedbacks.filter(
        (f) => f.feedbackType === 'CUSTOMER_REVISION_FORWARDED'
      ).length

      // Count unlocks (from events)
      const unlocks = events.filter((e) => e.eventType === 'SECTION_UNLOCK_REQUESTED').length

      const totalTATHours = authorized ? hoursBetween(createdAt, authorized.createdAt) : 0

      return {
        id: cert.id,
        certificateNumber: cert.certificateNumber,
        customer: cert.customerName || 'Unknown',
        engineer: cert.createdBy?.name || 'Unassigned',
        totalTATHours,
        reviewerRevisions,
        customerRevisions,
        unlocks,
        status: cert.status,
        stages,
      }
    })

    // Process previous period for comparison
    prevCertificates.forEach((cert) => {
      const events = cert.events
      const createdAt = cert.createdAt

      const submitted = events.find((e) => e.eventType === 'SUBMITTED_FOR_REVIEW')
      const reviewed = events.find(
        (e) =>
          e.eventType === 'APPROVED' ||
          e.eventType === 'REVIEWER_APPROVED' ||
          e.eventType === 'REVIEWER_APPROVED_SENT_TO_CUSTOMER'
      )
      const customerApproved = events.find((e) => e.eventType === 'CUSTOMER_APPROVED')
      const authorized = events.find((e) => e.eventType === 'ADMIN_AUTHORIZED')

      if (submitted) {
        prevStageTATs.createdToSubmitted.push(hoursBetween(createdAt, submitted.createdAt))
      }
      if (submitted && reviewed) {
        prevStageTATs.submittedToReviewed.push(
          hoursBetween(submitted.createdAt, reviewed.createdAt)
        )
      }
      if (reviewed && customerApproved) {
        prevStageTATs.reviewedToCustomer.push(
          hoursBetween(reviewed.createdAt, customerApproved.createdAt)
        )
      }
      if (customerApproved && authorized) {
        prevStageTATs.customerToAuthorized.push(
          hoursBetween(customerApproved.createdAt, authorized.createdAt)
        )
      }
      if (authorized) {
        prevStageTATs.total.push(hoursBetween(createdAt, authorized.createdAt))
      }
    })

    // Helper to calculate metrics
    function calcMetrics(current: number[], prev: number[]): StageMetrics {
      const avg = current.length > 0 ? current.reduce((a, b) => a + b, 0) / current.length : 0
      const prevAvg = prev.length > 0 ? prev.reduce((a, b) => a + b, 0) / prev.length : 0
      const changePercent =
        prevAvg > 0 ? Math.round(((avg - prevAvg) / prevAvg) * 100) : 0

      return {
        avgHours: Math.round(avg * 10) / 10,
        medianHours: Math.round(calculateMedian(current) * 10) / 10,
        count: current.length,
        changePercent,
      }
    }

    // Determine bottleneck (highest avg TAT)
    const avgTATs = [
      { stage: 'submitted', avg: stageTATs.submittedToReviewed.length > 0 ? stageTATs.submittedToReviewed.reduce((a, b) => a + b, 0) / stageTATs.submittedToReviewed.length : 0 },
      { stage: 'customer', avg: stageTATs.reviewedToCustomer.length > 0 ? stageTATs.reviewedToCustomer.reduce((a, b) => a + b, 0) / stageTATs.reviewedToCustomer.length : 0 },
      { stage: 'authorization', avg: stageTATs.customerToAuthorized.length > 0 ? stageTATs.customerToAuthorized.reduce((a, b) => a + b, 0) / stageTATs.customerToAuthorized.length : 0 },
    ]
    const bottleneck = avgTATs.sort((a, b) => b.avg - a.avg)[0]?.stage || null

    // Unlock metrics
    const approvedUnlocks = unlockRequests.filter((u) => u.status === 'APPROVED')
    const rejectedUnlocks = unlockRequests.filter((u) => u.status === 'REJECTED')

    const unlockTATs = unlockRequests
      .filter((u) => u.reviewedAt)
      .map((u) => hoursBetween(u.createdAt, u.reviewedAt!))

    const unlockSectionCounts: Record<string, number> = {}
    unlockRequests.forEach((u) => {
      try {
        const data = JSON.parse(u.data)
        const sections = (data.sections || []) as string[]
        sections.forEach((s) => {
          unlockSectionCounts[s] = (unlockSectionCounts[s] || 0) + 1
        })
      } catch {
        // Skip if data parsing fails
      }
    })

    const unlockBySections: SectionCount[] = Object.entries(unlockSectionCounts)
      .map(([section, count]) => ({ section, count }))
      .sort((a, b) => b.count - a.count)

    // Revision metrics
    const reviewerFeedbacks = certificates.flatMap((c) =>
      c.feedbacks.filter(
        (f) =>
          (f.feedbackType === 'REVISION_REQUEST' || f.feedbackType === 'REVISION_REQUESTED') &&
          f.user?.role !== 'CUSTOMER'
      )
    )

    const customerFeedbacks = certificates.flatMap((c) =>
      c.feedbacks.filter((f) => f.feedbackType === 'CUSTOMER_REVISION_FORWARDED')
    )

    const reviewerSectionCounts: Record<string, number> = {}
    reviewerFeedbacks.forEach((f) => {
      const section = f.targetSection || 'general'
      reviewerSectionCounts[section] = (reviewerSectionCounts[section] || 0) + 1
    })

    const customerSectionCounts: Record<string, number> = {}
    customerFeedbacks.forEach((f) => {
      const section = f.targetSection || 'general'
      customerSectionCounts[section] = (customerSectionCounts[section] || 0) + 1
    })

    // Previous period revision counts for comparison
    const prevReviewerFeedbacks = prevCertificates.flatMap((c) =>
      c.feedbacks.filter(
        (f) => f.feedbackType === 'REVISION_REQUEST' || f.feedbackType === 'REVISION_REQUESTED'
      )
    )
    const prevReviewerRevisions = prevReviewerFeedbacks.length

    const prevCustomerFeedbacks = prevCertificates.flatMap((c) =>
      c.feedbacks.filter((f) => f.feedbackType === 'CUSTOMER_REVISION_FORWARDED')
    )
    const prevCustomerRevisions = prevCustomerFeedbacks.length

    // First pass rate calculation - current period
    const certsWithNoReviewerRevisions = certificates.filter(
      (c) =>
        !c.feedbacks.some(
          (f) => f.feedbackType === 'REVISION_REQUEST' || f.feedbackType === 'REVISION_REQUESTED'
        )
    ).length

    const certsWithNoCustomerRevisions = certificates.filter(
      (c) => !c.feedbacks.some((f) => f.feedbackType === 'CUSTOMER_REVISION_FORWARDED')
    ).length

    const reviewerFirstPassRate =
      certificates.length > 0
        ? Math.round((certsWithNoReviewerRevisions / certificates.length) * 100)
        : 100

    const customerFirstPassRate =
      certificates.length > 0
        ? Math.round((certsWithNoCustomerRevisions / certificates.length) * 100)
        : 100

    // First pass rate calculation - previous period
    const prevCertsWithNoReviewerRevisions = prevCertificates.filter(
      (c) =>
        !c.feedbacks.some(
          (f) => f.feedbackType === 'REVISION_REQUEST' || f.feedbackType === 'REVISION_REQUESTED'
        )
    ).length

    const prevCertsWithNoCustomerRevisions = prevCertificates.filter(
      (c) => !c.feedbacks.some((f) => f.feedbackType === 'CUSTOMER_REVISION_FORWARDED')
    ).length

    const prevReviewerFirstPassRate =
      prevCertificates.length > 0
        ? Math.round((prevCertsWithNoReviewerRevisions / prevCertificates.length) * 100)
        : 100

    const prevCustomerFirstPassRate =
      prevCertificates.length > 0
        ? Math.round((prevCertsWithNoCustomerRevisions / prevCertificates.length) * 100)
        : 100

    // Previous period avg per cert
    const prevReviewerAvgPerCert =
      prevCertificates.length > 0
        ? Math.round((prevReviewerRevisions / prevCertificates.length) * 10) / 10
        : 0

    const prevCustomerAvgPerCert =
      prevCertificates.length > 0
        ? Math.round((prevCustomerRevisions / prevCertificates.length) * 10) / 10
        : 0

    return NextResponse.json({
      stageTAT: {
        createdToSubmitted: calcMetrics(
          stageTATs.createdToSubmitted,
          prevStageTATs.createdToSubmitted
        ),
        submittedToReviewed: calcMetrics(
          stageTATs.submittedToReviewed,
          prevStageTATs.submittedToReviewed
        ),
        reviewedToCustomer: calcMetrics(
          stageTATs.reviewedToCustomer,
          prevStageTATs.reviewedToCustomer
        ),
        customerToAuthorized: calcMetrics(
          stageTATs.customerToAuthorized,
          prevStageTATs.customerToAuthorized
        ),
        total: calcMetrics(stageTATs.total, prevStageTATs.total),
      },
      bottleneck,
      unlockMetrics: {
        total: unlockRequests.length,
        avgTATHours:
          unlockTATs.length > 0
            ? Math.round((unlockTATs.reduce((a, b) => a + b, 0) / unlockTATs.length) * 10) / 10
            : 0,
        approvedPercent:
          unlockRequests.length > 0
            ? Math.round((approvedUnlocks.length / unlockRequests.length) * 100)
            : 0,
        rejectedPercent:
          unlockRequests.length > 0
            ? Math.round((rejectedUnlocks.length / unlockRequests.length) * 100)
            : 0,
        bySections: unlockBySections,
      },
      reviewerRevisions: {
        total: reviewerFeedbacks.length,
        avgPerCert:
          certificates.length > 0
            ? Math.round((reviewerFeedbacks.length / certificates.length) * 10) / 10
            : 0,
        avgTATHours: 4.2, // TODO: Calculate actual revision TAT
        firstPassRate: reviewerFirstPassRate,
        // Previous period data
        prevTotal: prevReviewerRevisions,
        prevAvgPerCert: prevReviewerAvgPerCert,
        prevAvgTATHours: 5.1, // TODO: Calculate actual revision TAT
        prevFirstPassRate: prevReviewerFirstPassRate,
        hasPrevData: prevCertificates.length > 0,
        bySections: Object.entries(reviewerSectionCounts)
          .map(([section, count]) => ({ section, count }))
          .sort((a, b) => b.count - a.count),
      },
      customerRevisions: {
        total: customerFeedbacks.length,
        avgPerCert:
          certificates.length > 0
            ? Math.round((customerFeedbacks.length / certificates.length) * 10) / 10
            : 0,
        avgTATHours: 6.8, // TODO: Calculate actual revision TAT
        firstPassRate: customerFirstPassRate,
        // Previous period data
        prevTotal: prevCustomerRevisions,
        prevAvgPerCert: prevCustomerAvgPerCert,
        prevAvgTATHours: 8.2, // TODO: Calculate actual revision TAT
        prevFirstPassRate: prevCustomerFirstPassRate,
        hasPrevData: prevCertificates.length > 0,
        bySections: Object.entries(customerSectionCounts)
          .map(([section, count]) => ({ section, count }))
          .sort((a, b) => b.count - a.count),
      },
      certificates: certificateDetails,
      totalCertificates: certificates.length,
    })
  } catch (error) {
    logger.error({ err: error }, 'Failed to fetch analytics')
    return NextResponse.json({ error: 'Failed to fetch analytics' }, { status: 500 })
  }
}
