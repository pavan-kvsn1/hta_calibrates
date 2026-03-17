import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import {
  calculateCertificateTAT,
  aggregateTATMetrics,
  compareWeeklyMetrics,
  type CertificateEvent,
  type CertificateTATMetrics,
} from '@/lib/utils/tat-calculator'

// Helper to create events with proper dates
function createEvent(
  eventType: string,
  hoursFromStart: number,
  certificateId: string = 'cert-1'
): CertificateEvent {
  const baseDate = new Date('2024-01-01T00:00:00.000Z')
  const eventDate = new Date(baseDate.getTime() + hoursFromStart * 60 * 60 * 1000)
  return {
    id: `event-${hoursFromStart}-${eventType}`,
    eventType,
    createdAt: eventDate,
    certificateId,
  }
}

describe('TAT Calculator', () => {
  describe('calculateCertificateTAT', () => {
    describe('basic functionality', () => {
      it('returns null for empty events array', () => {
        expect(calculateCertificateTAT([])).toBeNull()
      })

      it('returns metrics with certificateId from first event', () => {
        const events = [createEvent('SUBMITTED_FOR_REVIEW', 0, 'cert-123')]
        const result = calculateCertificateTAT(events)
        expect(result?.certificateId).toBe('cert-123')
      })

      it('sorts events by createdAt before processing', () => {
        const events = [
          createEvent('REVIEWER_APPROVED', 5),
          createEvent('SUBMITTED_FOR_REVIEW', 0), // Out of order
        ]
        const result = calculateCertificateTAT(events)
        expect(result?.reviewer.cycleCount).toBe(1)
        expect(result?.reviewer.totalHours).toBeCloseTo(5, 1)
      })
    })

    describe('total TAT calculation', () => {
      it('calculates total TAT from SUBMITTED_FOR_REVIEW to ADMIN_AUTHORIZED', () => {
        const events = [
          createEvent('SUBMITTED_FOR_REVIEW', 0),
          createEvent('REVIEWER_APPROVED', 10),
          createEvent('SENT_TO_CUSTOMER', 12),
          createEvent('CUSTOMER_APPROVED', 24),
          createEvent('ADMIN_AUTHORIZED', 30),
        ]
        const result = calculateCertificateTAT(events)

        expect(result?.totalTAT.isComplete).toBe(true)
        expect(result?.totalTAT.hours).toBeCloseTo(30, 1)
        expect(result?.totalTAT.startedAt).toEqual(new Date('2024-01-01T00:00:00.000Z'))
        expect(result?.totalTAT.completedAt).toEqual(new Date('2024-01-02T06:00:00.000Z'))
      })

      it('marks TAT as incomplete when ADMIN_AUTHORIZED is missing', () => {
        const events = [
          createEvent('SUBMITTED_FOR_REVIEW', 0),
          createEvent('REVIEWER_APPROVED', 10),
        ]
        const result = calculateCertificateTAT(events)

        expect(result?.totalTAT.isComplete).toBe(false)
        expect(result?.totalTAT.startedAt).not.toBeNull()
        expect(result?.totalTAT.completedAt).toBeNull()
      })

      it('sets startedAt to null when no SUBMITTED_FOR_REVIEW event', () => {
        const events = [createEvent('REVIEWER_APPROVED', 0)]
        const result = calculateCertificateTAT(events)

        expect(result?.totalTAT.startedAt).toBeNull()
        expect(result?.totalTAT.isComplete).toBe(false)
      })
    })

    describe('reviewer stage TAT', () => {
      it('calculates reviewer TAT from SUBMITTED_FOR_REVIEW to REVIEWER_APPROVED', () => {
        const events = [
          createEvent('SUBMITTED_FOR_REVIEW', 0),
          createEvent('REVIEWER_APPROVED', 8),
        ]
        const result = calculateCertificateTAT(events)

        expect(result?.reviewer.cycleCount).toBe(1)
        expect(result?.reviewer.totalHours).toBeCloseTo(8, 1)
        expect(result?.reviewer.avgHours).toBeCloseTo(8, 1)
      })

      it('calculates reviewer TAT from SUBMITTED_FOR_REVIEW to REVISION_REQUESTED', () => {
        const events = [
          createEvent('SUBMITTED_FOR_REVIEW', 0),
          createEvent('REVISION_REQUESTED', 4),
        ]
        const result = calculateCertificateTAT(events)

        expect(result?.reviewer.cycleCount).toBe(1)
        expect(result?.reviewer.totalHours).toBeCloseTo(4, 1)
      })

      it('handles multiple reviewer cycles', () => {
        const events = [
          createEvent('SUBMITTED_FOR_REVIEW', 0),
          createEvent('REVISION_REQUESTED', 4),
          createEvent('RESUBMITTED_FOR_REVIEW', 8),
          createEvent('REVISION_REQUESTED', 12),
          createEvent('RESUBMITTED_FOR_REVIEW', 20),
          createEvent('REVIEWER_APPROVED', 24),
        ]
        const result = calculateCertificateTAT(events)

        expect(result?.reviewer.cycleCount).toBe(3)
        expect(result?.reviewer.totalHours).toBeCloseTo(4 + 4 + 4, 1) // 12 hours total
        expect(result?.reviewer.avgHours).toBeCloseTo(4, 1)
      })
    })

    describe('engineer revision stage TAT', () => {
      it('calculates engineer revision TAT from REVISION_REQUESTED to RESUBMITTED', () => {
        const events = [
          createEvent('SUBMITTED_FOR_REVIEW', 0),
          createEvent('REVISION_REQUESTED', 4),
          createEvent('RESUBMITTED_FOR_REVIEW', 12),
        ]
        const result = calculateCertificateTAT(events)

        expect(result?.engineerRevision.cycleCount).toBe(1)
        expect(result?.engineerRevision.totalHours).toBeCloseTo(8, 1)
        expect(result?.engineerRevision.avgHours).toBeCloseTo(8, 1)
      })

      it('handles multiple engineer revision cycles', () => {
        const events = [
          createEvent('SUBMITTED_FOR_REVIEW', 0),
          createEvent('REVISION_REQUESTED', 2),
          createEvent('RESUBMITTED_FOR_REVIEW', 6),
          createEvent('REVISION_REQUESTED', 8),
          createEvent('RESUBMITTED_FOR_REVIEW', 14),
        ]
        const result = calculateCertificateTAT(events)

        expect(result?.engineerRevision.cycleCount).toBe(2)
        expect(result?.engineerRevision.totalHours).toBeCloseTo(4 + 6, 1) // 10 hours total
        expect(result?.engineerRevision.avgHours).toBeCloseTo(5, 1)
      })
    })

    describe('customer stage TAT', () => {
      it('calculates customer TAT from SENT_TO_CUSTOMER to CUSTOMER_APPROVED', () => {
        const events = [
          createEvent('SENT_TO_CUSTOMER', 0),
          createEvent('CUSTOMER_APPROVED', 24),
        ]
        const result = calculateCertificateTAT(events)

        expect(result?.customer.cycleCount).toBe(1)
        expect(result?.customer.totalHours).toBeCloseTo(24, 1)
        expect(result?.customer.avgHours).toBeCloseTo(24, 1)
      })

      it('calculates customer TAT from SENT_TO_CUSTOMER to CUSTOMER_REVISION_REQUESTED', () => {
        const events = [
          createEvent('SENT_TO_CUSTOMER', 0),
          createEvent('CUSTOMER_REVISION_REQUESTED', 48),
        ]
        const result = calculateCertificateTAT(events)

        expect(result?.customer.cycleCount).toBe(1)
        expect(result?.customer.totalHours).toBeCloseTo(48, 1)
      })

      it('handles multiple customer review cycles', () => {
        const events = [
          createEvent('SENT_TO_CUSTOMER', 0),
          createEvent('CUSTOMER_REVISION_REQUESTED', 10),
          createEvent('SENT_TO_CUSTOMER', 20),
          createEvent('CUSTOMER_APPROVED', 30),
        ]
        const result = calculateCertificateTAT(events)

        expect(result?.customer.cycleCount).toBe(2)
        expect(result?.customer.totalHours).toBeCloseTo(10 + 10, 1) // 20 hours total
        expect(result?.customer.avgHours).toBeCloseTo(10, 1)
      })
    })

    describe('customer revision stage TAT', () => {
      it('calculates customer revision TAT from CUSTOMER_REVISION_REQUESTED to SENT_TO_CUSTOMER', () => {
        const events = [
          createEvent('SENT_TO_CUSTOMER', 0),
          createEvent('CUSTOMER_REVISION_REQUESTED', 10),
          createEvent('SENT_TO_CUSTOMER', 18),
        ]
        const result = calculateCertificateTAT(events)

        expect(result?.customerRevision.cycleCount).toBe(1)
        expect(result?.customerRevision.totalHours).toBeCloseTo(8, 1)
      })

      it('closes customer revision on CUSTOMER_APPROVED', () => {
        const events = [
          createEvent('SENT_TO_CUSTOMER', 0),
          createEvent('CUSTOMER_REVISION_REQUESTED', 10),
          createEvent('CUSTOMER_APPROVED', 20),
        ]
        const result = calculateCertificateTAT(events)

        expect(result?.customerRevision.cycleCount).toBe(1)
        expect(result?.customerRevision.totalHours).toBeCloseTo(10, 1)
      })

      it('closes customer revision on ADMIN_REPLIED_TO_CUSTOMER', () => {
        const events = [
          createEvent('SENT_TO_CUSTOMER', 0),
          createEvent('CUSTOMER_REVISION_REQUESTED', 10),
          createEvent('ADMIN_REPLIED_TO_CUSTOMER', 14),
        ]
        const result = calculateCertificateTAT(events)

        expect(result?.customerRevision.cycleCount).toBe(1)
        expect(result?.customerRevision.totalHours).toBeCloseTo(4, 1)
      })
    })

    describe('admin approval stage TAT', () => {
      it('calculates admin approval TAT from CUSTOMER_APPROVED to ADMIN_AUTHORIZED', () => {
        const events = [
          createEvent('CUSTOMER_APPROVED', 0),
          createEvent('ADMIN_AUTHORIZED', 6),
        ]
        const result = calculateCertificateTAT(events)

        expect(result?.adminApproval.cycleCount).toBe(1)
        expect(result?.adminApproval.totalHours).toBeCloseTo(6, 1)
        expect(result?.adminApproval.avgHours).toBeCloseTo(6, 1)
      })
    })

    describe('complete workflow', () => {
      it('tracks all stages in a complete certificate lifecycle', () => {
        const events = [
          createEvent('SUBMITTED_FOR_REVIEW', 0),
          createEvent('REVISION_REQUESTED', 4),       // Reviewer: 4h
          createEvent('RESUBMITTED_FOR_REVIEW', 12),  // Engineer revision: 8h
          createEvent('REVIEWER_APPROVED', 16),       // Reviewer: 4h
          createEvent('SENT_TO_CUSTOMER', 17),
          createEvent('CUSTOMER_REVISION_REQUESTED', 25), // Customer: 8h
          createEvent('SENT_TO_CUSTOMER', 30),        // Customer revision: 5h
          createEvent('CUSTOMER_APPROVED', 42),       // Customer: 12h
          createEvent('ADMIN_AUTHORIZED', 48),        // Admin: 6h
        ]
        const result = calculateCertificateTAT(events)

        expect(result?.totalTAT.isComplete).toBe(true)
        expect(result?.totalTAT.hours).toBeCloseTo(48, 1)

        expect(result?.reviewer.cycleCount).toBe(2)
        expect(result?.reviewer.totalHours).toBeCloseTo(8, 1)

        expect(result?.engineerRevision.cycleCount).toBe(1)
        expect(result?.engineerRevision.totalHours).toBeCloseTo(8, 1)

        expect(result?.customer.cycleCount).toBe(2)
        expect(result?.customer.totalHours).toBeCloseTo(20, 1)

        expect(result?.customerRevision.cycleCount).toBe(1)
        expect(result?.customerRevision.totalHours).toBeCloseTo(5, 1)

        expect(result?.adminApproval.cycleCount).toBe(1)
        expect(result?.adminApproval.totalHours).toBeCloseTo(6, 1)
      })
    })
  })

  describe('aggregateTATMetrics', () => {
    it('returns zero metrics for empty array', () => {
      const result = aggregateTATMetrics([])

      expect(result.certificateCount).toBe(0)
      expect(result.totalTAT.avgHours).toBe(0)
      expect(result.totalTAT.completedCount).toBe(0)
      expect(result.totalTAT.overdueCount).toBe(0)
      expect(result.reviewer.avgHours).toBe(0)
    })

    it('calculates average total TAT for completed certificates', () => {
      const metrics: CertificateTATMetrics[] = [
        {
          certificateId: 'cert-1',
          totalTAT: { hours: 24, isComplete: true, startedAt: new Date(), completedAt: new Date() },
          reviewer: { totalHours: 8, cycleCount: 1, avgHours: 8 },
          engineerRevision: { totalHours: 0, cycleCount: 0, avgHours: 0 },
          customer: { totalHours: 10, cycleCount: 1, avgHours: 10 },
          customerRevision: { totalHours: 0, cycleCount: 0, avgHours: 0 },
          adminApproval: { totalHours: 6, cycleCount: 1, avgHours: 6 },
        },
        {
          certificateId: 'cert-2',
          totalTAT: { hours: 36, isComplete: true, startedAt: new Date(), completedAt: new Date() },
          reviewer: { totalHours: 12, cycleCount: 2, avgHours: 6 },
          engineerRevision: { totalHours: 4, cycleCount: 1, avgHours: 4 },
          customer: { totalHours: 12, cycleCount: 1, avgHours: 12 },
          customerRevision: { totalHours: 0, cycleCount: 0, avgHours: 0 },
          adminApproval: { totalHours: 8, cycleCount: 1, avgHours: 8 },
        },
      ]

      const result = aggregateTATMetrics(metrics)

      expect(result.certificateCount).toBe(2)
      expect(result.totalTAT.completedCount).toBe(2)
      expect(result.totalTAT.avgHours).toBeCloseTo(30, 1) // (24 + 36) / 2
    })

    it('excludes incomplete certificates from total TAT average', () => {
      const metrics: CertificateTATMetrics[] = [
        {
          certificateId: 'cert-1',
          totalTAT: { hours: 24, isComplete: true, startedAt: new Date(), completedAt: new Date() },
          reviewer: { totalHours: 8, cycleCount: 1, avgHours: 8 },
          engineerRevision: { totalHours: 0, cycleCount: 0, avgHours: 0 },
          customer: { totalHours: 10, cycleCount: 1, avgHours: 10 },
          customerRevision: { totalHours: 0, cycleCount: 0, avgHours: 0 },
          adminApproval: { totalHours: 6, cycleCount: 1, avgHours: 6 },
        },
        {
          certificateId: 'cert-2',
          totalTAT: { hours: 100, isComplete: false, startedAt: new Date(), completedAt: null },
          reviewer: { totalHours: 20, cycleCount: 1, avgHours: 20 },
          engineerRevision: { totalHours: 0, cycleCount: 0, avgHours: 0 },
          customer: { totalHours: 0, cycleCount: 0, avgHours: 0 },
          customerRevision: { totalHours: 0, cycleCount: 0, avgHours: 0 },
          adminApproval: { totalHours: 0, cycleCount: 0, avgHours: 0 },
        },
      ]

      const result = aggregateTATMetrics(metrics)

      expect(result.totalTAT.completedCount).toBe(1)
      expect(result.totalTAT.avgHours).toBeCloseTo(24, 1) // Only completed cert
    })

    it('counts overdue certificates (>48 hours)', () => {
      const metrics: CertificateTATMetrics[] = [
        {
          certificateId: 'cert-1',
          totalTAT: { hours: 24, isComplete: true, startedAt: new Date(), completedAt: new Date() },
          reviewer: { totalHours: 8, cycleCount: 1, avgHours: 8 },
          engineerRevision: { totalHours: 0, cycleCount: 0, avgHours: 0 },
          customer: { totalHours: 10, cycleCount: 1, avgHours: 10 },
          customerRevision: { totalHours: 0, cycleCount: 0, avgHours: 0 },
          adminApproval: { totalHours: 6, cycleCount: 1, avgHours: 6 },
        },
        {
          certificateId: 'cert-2',
          totalTAT: { hours: 72, isComplete: true, startedAt: new Date(), completedAt: new Date() },
          reviewer: { totalHours: 24, cycleCount: 2, avgHours: 12 },
          engineerRevision: { totalHours: 16, cycleCount: 1, avgHours: 16 },
          customer: { totalHours: 24, cycleCount: 1, avgHours: 24 },
          customerRevision: { totalHours: 0, cycleCount: 0, avgHours: 0 },
          adminApproval: { totalHours: 8, cycleCount: 1, avgHours: 8 },
        },
      ]

      const result = aggregateTATMetrics(metrics)

      expect(result.totalTAT.overdueCount).toBe(1)
    })

    it('calculates stage averages across all cycles', () => {
      const metrics: CertificateTATMetrics[] = [
        {
          certificateId: 'cert-1',
          totalTAT: { hours: 24, isComplete: true, startedAt: new Date(), completedAt: new Date() },
          reviewer: { totalHours: 8, cycleCount: 2, avgHours: 4 },
          engineerRevision: { totalHours: 4, cycleCount: 1, avgHours: 4 },
          customer: { totalHours: 0, cycleCount: 0, avgHours: 0 },
          customerRevision: { totalHours: 0, cycleCount: 0, avgHours: 0 },
          adminApproval: { totalHours: 0, cycleCount: 0, avgHours: 0 },
        },
        {
          certificateId: 'cert-2',
          totalTAT: { hours: 36, isComplete: true, startedAt: new Date(), completedAt: new Date() },
          reviewer: { totalHours: 12, cycleCount: 2, avgHours: 6 },
          engineerRevision: { totalHours: 8, cycleCount: 2, avgHours: 4 },
          customer: { totalHours: 0, cycleCount: 0, avgHours: 0 },
          customerRevision: { totalHours: 0, cycleCount: 0, avgHours: 0 },
          adminApproval: { totalHours: 0, cycleCount: 0, avgHours: 0 },
        },
      ]

      const result = aggregateTATMetrics(metrics)

      // Reviewer: (8 + 12) / 4 cycles = 5 hours avg per cycle
      expect(result.reviewer.avgHours).toBeCloseTo(5, 1)
      expect(result.reviewer.totalCycles).toBe(4)
      expect(result.reviewer.avgCycles).toBe(2) // 4 cycles / 2 certs

      // Engineer: (4 + 8) / 3 cycles = 4 hours avg per cycle
      expect(result.engineerRevision.avgHours).toBeCloseTo(4, 1)
      expect(result.engineerRevision.totalCycles).toBe(3)
    })
  })

  describe('compareWeeklyMetrics', () => {
    const createAggregatedMetrics = (overrides = {}): ReturnType<typeof aggregateTATMetrics> => ({
      totalTAT: { avgHours: 24, completedCount: 10, overdueCount: 2 },
      reviewer: { avgHours: 4, avgCycles: 1.5, totalCycles: 15 },
      engineerRevision: { avgHours: 2, avgCycles: 0.5, totalCycles: 5 },
      customer: { avgHours: 12, avgCycles: 1, totalCycles: 10 },
      customerRevision: { avgHours: 4, avgCycles: 0.3, totalCycles: 3 },
      adminApproval: { avgHours: 2, avgCycles: 1, totalCycles: 10 },
      certificateCount: 10,
      ...overrides,
    })

    it('calculates changes between two weeks', () => {
      const thisWeek = createAggregatedMetrics({
        totalTAT: { avgHours: 20, completedCount: 12, overdueCount: 1 },
      })
      const lastWeek = createAggregatedMetrics({
        totalTAT: { avgHours: 25, completedCount: 10, overdueCount: 3 },
      })

      const result = compareWeeklyMetrics(thisWeek, lastWeek)

      expect(result.thisWeek).toBe(thisWeek)
      expect(result.lastWeek).toBe(lastWeek)
      expect(result.changes.totalTAT.hours).toBeCloseTo(-5, 1) // 20 - 25
      expect(result.changes.totalTAT.percent).toBe(-20) // -5/25 = -20%
      expect(result.changes.overdue.count).toBe(-2) // 1 - 3
    })

    it('calculates percentage changes for stages', () => {
      const thisWeek = createAggregatedMetrics({
        reviewer: { avgHours: 6, avgCycles: 2, totalCycles: 20 },
      })
      const lastWeek = createAggregatedMetrics({
        reviewer: { avgHours: 4, avgCycles: 1, totalCycles: 10 },
      })

      const result = compareWeeklyMetrics(thisWeek, lastWeek)

      expect(result.changes.reviewer.hours).toBeCloseTo(2, 1) // 6 - 4
      expect(result.changes.reviewer.hoursPercent).toBe(50) // 2/4 = 50%
      expect(result.changes.reviewer.cycles).toBe(1) // 2 - 1
      expect(result.changes.reviewer.cyclesPercent).toBe(100) // 1/1 = 100%
    })

    it('handles division by zero for percentage changes', () => {
      const thisWeek = createAggregatedMetrics({
        reviewer: { avgHours: 5, avgCycles: 2, totalCycles: 20 },
      })
      const lastWeek = createAggregatedMetrics({
        reviewer: { avgHours: 0, avgCycles: 0, totalCycles: 0 },
      })

      const result = compareWeeklyMetrics(thisWeek, lastWeek)

      expect(result.changes.reviewer.hoursPercent).toBe(100)
      expect(result.changes.reviewer.cyclesPercent).toBe(100)
    })

    it('returns 0 percent when both values are 0', () => {
      const thisWeek = createAggregatedMetrics({
        engineerRevision: { avgHours: 0, avgCycles: 0, totalCycles: 0 },
      })
      const lastWeek = createAggregatedMetrics({
        engineerRevision: { avgHours: 0, avgCycles: 0, totalCycles: 0 },
      })

      const result = compareWeeklyMetrics(thisWeek, lastWeek)

      expect(result.changes.engineerRevision.hoursPercent).toBe(0)
      expect(result.changes.engineerRevision.cyclesPercent).toBe(0)
    })

    it('calculates changes for all stages', () => {
      const thisWeek = createAggregatedMetrics()
      const lastWeek = createAggregatedMetrics()

      const result = compareWeeklyMetrics(thisWeek, lastWeek)

      expect(result.changes).toHaveProperty('totalTAT')
      expect(result.changes).toHaveProperty('overdue')
      expect(result.changes).toHaveProperty('reviewer')
      expect(result.changes).toHaveProperty('engineerRevision')
      expect(result.changes).toHaveProperty('customer')
      expect(result.changes).toHaveProperty('customerRevision')
      expect(result.changes).toHaveProperty('adminApproval')
    })
  })
})
