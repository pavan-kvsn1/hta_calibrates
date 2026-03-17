/**
 * Internal Requests API Integration Tests
 *
 * Tests internal request workflows (unlock requests, etc.) with real database interactions.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanTestDatabase,
} from '../setup/test-db'
import {
  createEngineerWithAdmin,
  createTestCertificate,
} from '../setup/fixtures'

describe('Internal Requests API Integration', () => {
  let prisma: PrismaClient

  beforeAll(async () => {
    prisma = await setupTestDatabase()
  })

  afterAll(async () => {
    await teardownTestDatabase()
  })

  beforeEach(async () => {
    await cleanTestDatabase()
  })

  describe('Unlock Request Management', () => {
    it('should create an unlock request', async () => {
      const { engineer, admin } = await createEngineerWithAdmin(prisma)
      const cert = await createTestCertificate(prisma, engineer.id, {
        status: 'PENDING_REVIEW',
      })

      const request = await prisma.internalRequest.create({
        data: {
          type: 'UNLOCK',
          certificateId: cert.id,
          requestedById: engineer.id,
          reason: 'Need to correct calibration data entry error',
          status: 'PENDING',
        },
      })

      expect(request).toBeDefined()
      expect(request.type).toBe('UNLOCK')
      expect(request.status).toBe('PENDING')
    })

    it('should list pending unlock requests', async () => {
      const { engineer, admin } = await createEngineerWithAdmin(prisma)
      const cert1 = await createTestCertificate(prisma, engineer.id, { status: 'PENDING_REVIEW' })
      const cert2 = await createTestCertificate(prisma, engineer.id, { status: 'APPROVED' })

      await prisma.internalRequest.create({
        data: {
          type: 'UNLOCK',
          certificateId: cert1.id,
          requestedById: engineer.id,
          reason: 'Reason 1',
          status: 'PENDING',
        },
      })

      await prisma.internalRequest.create({
        data: {
          type: 'UNLOCK',
          certificateId: cert2.id,
          requestedById: engineer.id,
          reason: 'Reason 2',
          status: 'PENDING',
        },
      })

      const pending = await prisma.internalRequest.findMany({
        where: { status: 'PENDING' },
      })

      expect(pending).toHaveLength(2)
    })

    it('should approve an unlock request', async () => {
      const { engineer, admin } = await createEngineerWithAdmin(prisma)
      const cert = await createTestCertificate(prisma, engineer.id, { status: 'PENDING_REVIEW' })

      const request = await prisma.internalRequest.create({
        data: {
          type: 'UNLOCK',
          certificateId: cert.id,
          requestedById: engineer.id,
          reason: 'Need to unlock',
          status: 'PENDING',
        },
      })

      const approved = await prisma.internalRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          reviewedById: admin.id,
          reviewedAt: new Date(),
          reviewNote: 'Approved for correction',
        },
      })

      expect(approved.status).toBe('APPROVED')
      expect(approved.reviewedById).toBe(admin.id)
    })

    it('should reject an unlock request', async () => {
      const { engineer, admin } = await createEngineerWithAdmin(prisma)
      const cert = await createTestCertificate(prisma, engineer.id, { status: 'PENDING_REVIEW' })

      const request = await prisma.internalRequest.create({
        data: {
          type: 'UNLOCK',
          certificateId: cert.id,
          requestedById: engineer.id,
          reason: 'Want to unlock',
          status: 'PENDING',
        },
      })

      const rejected = await prisma.internalRequest.update({
        where: { id: request.id },
        data: {
          status: 'REJECTED',
          reviewedById: admin.id,
          reviewedAt: new Date(),
          reviewNote: 'Request not justified',
        },
      })

      expect(rejected.status).toBe('REJECTED')
      expect(rejected.reviewNote).toContain('not justified')
    })

    it('should track request history for a certificate', async () => {
      const { engineer, admin } = await createEngineerWithAdmin(prisma)
      const cert = await createTestCertificate(prisma, engineer.id, { status: 'PENDING_REVIEW' })

      // Create multiple requests
      await prisma.internalRequest.create({
        data: {
          type: 'UNLOCK',
          certificateId: cert.id,
          requestedById: engineer.id,
          reason: 'First request',
          status: 'REJECTED',
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      })

      await prisma.internalRequest.create({
        data: {
          type: 'UNLOCK',
          certificateId: cert.id,
          requestedById: engineer.id,
          reason: 'Second request with better justification',
          status: 'APPROVED',
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      })

      const history = await prisma.internalRequest.findMany({
        where: { certificateId: cert.id },
        orderBy: { createdAt: 'asc' },
      })

      expect(history).toHaveLength(2)
      expect(history[0].status).toBe('REJECTED')
      expect(history[1].status).toBe('APPROVED')
    })
  })

  describe('Request Filtering', () => {
    it('should filter requests by type', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const cert = await createTestCertificate(prisma, engineer.id)

      await prisma.internalRequest.create({
        data: {
          type: 'UNLOCK',
          certificateId: cert.id,
          requestedById: engineer.id,
          reason: 'Unlock',
          status: 'PENDING',
        },
      })

      await prisma.internalRequest.create({
        data: {
          type: 'REVISION',
          certificateId: cert.id,
          requestedById: engineer.id,
          reason: 'Revision',
          status: 'PENDING',
        },
      })

      const unlockRequests = await prisma.internalRequest.findMany({
        where: { type: 'UNLOCK' },
      })

      const revisionRequests = await prisma.internalRequest.findMany({
        where: { type: 'REVISION' },
      })

      expect(unlockRequests).toHaveLength(1)
      expect(revisionRequests).toHaveLength(1)
    })

    it('should filter requests by requester', async () => {
      const { engineer, admin } = await createEngineerWithAdmin(prisma)
      const engineer2 = await prisma.user.create({
        data: {
          email: 'engineer2@test.com',
          name: 'Engineer 2',
          role: 'ENGINEER',
          passwordHash: 'hash',
          assignedAdminId: admin.id,
        },
      })

      const cert1 = await createTestCertificate(prisma, engineer.id)
      const cert2 = await createTestCertificate(prisma, engineer2.id)

      await prisma.internalRequest.create({
        data: {
          type: 'UNLOCK',
          certificateId: cert1.id,
          requestedById: engineer.id,
          reason: 'Engineer 1 request',
          status: 'PENDING',
        },
      })

      await prisma.internalRequest.create({
        data: {
          type: 'UNLOCK',
          certificateId: cert2.id,
          requestedById: engineer2.id,
          reason: 'Engineer 2 request',
          status: 'PENDING',
        },
      })

      const engineer1Requests = await prisma.internalRequest.findMany({
        where: { requestedById: engineer.id },
      })

      expect(engineer1Requests).toHaveLength(1)
    })

    it('should filter requests by status', async () => {
      const { engineer, admin } = await createEngineerWithAdmin(prisma)
      const cert = await createTestCertificate(prisma, engineer.id)

      await prisma.internalRequest.create({
        data: {
          type: 'UNLOCK',
          certificateId: cert.id,
          requestedById: engineer.id,
          reason: 'Pending',
          status: 'PENDING',
        },
      })

      await prisma.internalRequest.create({
        data: {
          type: 'UNLOCK',
          certificateId: cert.id,
          requestedById: engineer.id,
          reason: 'Approved',
          status: 'APPROVED',
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      })

      const pending = await prisma.internalRequest.findMany({
        where: { status: 'PENDING' },
      })

      const approved = await prisma.internalRequest.findMany({
        where: { status: 'APPROVED' },
      })

      expect(pending).toHaveLength(1)
      expect(approved).toHaveLength(1)
    })
  })

  describe('Request Relationships', () => {
    it('should include certificate details', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const cert = await createTestCertificate(prisma, engineer.id, {
        certificateNumber: 'HTA/REQ/001',
        customerName: 'Request Test Company',
      })

      await prisma.internalRequest.create({
        data: {
          type: 'UNLOCK',
          certificateId: cert.id,
          requestedById: engineer.id,
          reason: 'Test',
          status: 'PENDING',
        },
      })

      const requests = await prisma.internalRequest.findMany({
        include: {
          certificate: {
            select: {
              certificateNumber: true,
              customerName: true,
              status: true,
            },
          },
        },
      })

      expect(requests[0].certificate.certificateNumber).toBe('HTA/REQ/001')
      expect(requests[0].certificate.customerName).toBe('Request Test Company')
    })

    it('should include requester details', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const cert = await createTestCertificate(prisma, engineer.id)

      await prisma.internalRequest.create({
        data: {
          type: 'UNLOCK',
          certificateId: cert.id,
          requestedById: engineer.id,
          reason: 'Test',
          status: 'PENDING',
        },
      })

      const requests = await prisma.internalRequest.findMany({
        include: {
          requestedBy: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      expect(requests[0].requestedBy.id).toBe(engineer.id)
    })

    it('should include reviewer details when reviewed', async () => {
      const { engineer, admin } = await createEngineerWithAdmin(prisma)
      const cert = await createTestCertificate(prisma, engineer.id)

      const request = await prisma.internalRequest.create({
        data: {
          type: 'UNLOCK',
          certificateId: cert.id,
          requestedById: engineer.id,
          reason: 'Test',
          status: 'PENDING',
        },
      })

      await prisma.internalRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          reviewedById: admin.id,
          reviewedAt: new Date(),
        },
      })

      const reviewed = await prisma.internalRequest.findUnique({
        where: { id: request.id },
        include: {
          reviewedBy: {
            select: { id: true, name: true },
          },
        },
      })

      expect(reviewed?.reviewedBy?.id).toBe(admin.id)
    })
  })

  describe('Request Pagination', () => {
    it('should paginate request list', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)

      for (let i = 0; i < 5; i++) {
        const cert = await createTestCertificate(prisma, engineer.id)
        await prisma.internalRequest.create({
          data: {
            type: 'UNLOCK',
            certificateId: cert.id,
            requestedById: engineer.id,
            reason: `Request ${i + 1}`,
            status: 'PENDING',
          },
        })
        await new Promise((r) => setTimeout(r, 10))
      }

      const page1 = await prisma.internalRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take: 2,
        skip: 0,
      })

      const page2 = await prisma.internalRequest.findMany({
        orderBy: { createdAt: 'desc' },
        take: 2,
        skip: 2,
      })

      expect(page1).toHaveLength(2)
      expect(page2).toHaveLength(2)
      expect(page1[0].id).not.toBe(page2[0].id)
    })

    it('should count total requests', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)

      for (let i = 0; i < 3; i++) {
        const cert = await createTestCertificate(prisma, engineer.id)
        await prisma.internalRequest.create({
          data: {
            type: 'UNLOCK',
            certificateId: cert.id,
            requestedById: engineer.id,
            reason: `Request ${i}`,
            status: 'PENDING',
          },
        })
      }

      const total = await prisma.internalRequest.count()

      expect(total).toBe(3)
    })
  })

  describe('Request Statistics', () => {
    it('should count requests by status', async () => {
      const { engineer, admin } = await createEngineerWithAdmin(prisma)

      for (let i = 0; i < 3; i++) {
        const cert = await createTestCertificate(prisma, engineer.id)
        await prisma.internalRequest.create({
          data: {
            type: 'UNLOCK',
            certificateId: cert.id,
            requestedById: engineer.id,
            reason: 'Pending',
            status: 'PENDING',
          },
        })
      }

      for (let i = 0; i < 2; i++) {
        const cert = await createTestCertificate(prisma, engineer.id)
        await prisma.internalRequest.create({
          data: {
            type: 'UNLOCK',
            certificateId: cert.id,
            requestedById: engineer.id,
            reason: 'Approved',
            status: 'APPROVED',
            reviewedById: admin.id,
            reviewedAt: new Date(),
          },
        })
      }

      const [pendingCount, approvedCount] = await Promise.all([
        prisma.internalRequest.count({ where: { status: 'PENDING' } }),
        prisma.internalRequest.count({ where: { status: 'APPROVED' } }),
      ])

      expect(pendingCount).toBe(3)
      expect(approvedCount).toBe(2)
    })
  })
})
