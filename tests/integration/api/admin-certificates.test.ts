/**
 * Admin Certificates API Integration Tests
 *
 * Tests admin certificate management with real database interactions.
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
  createCertificateWithHistory,
} from '../setup/fixtures'

describe('Admin Certificates API Integration', () => {
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

  describe('Certificate Listing', () => {
    it('should list all certificates', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      await createTestCertificate(prisma, engineer.id, { status: 'DRAFT' })
      await createTestCertificate(prisma, engineer.id, { status: 'PENDING_REVIEW' })

      const certificates = await prisma.certificate.findMany({
        orderBy: { updatedAt: 'desc' },
      })

      expect(certificates).toHaveLength(2)
    })

    it('should filter certificates by status', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      await createTestCertificate(prisma, engineer.id, { status: 'DRAFT' })
      await createTestCertificate(prisma, engineer.id, { status: 'PENDING_REVIEW' })
      await createTestCertificate(prisma, engineer.id, { status: 'APPROVED' })

      const pendingCerts = await prisma.certificate.findMany({
        where: { status: 'PENDING_REVIEW' },
      })

      expect(pendingCerts).toHaveLength(1)
    })

    it('should search certificates by number', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      await createTestCertificate(prisma, engineer.id, {
        certificateNumber: 'HTA/CAL/2024/001',
      })
      await createTestCertificate(prisma, engineer.id, {
        certificateNumber: 'HTA/CAL/2024/002',
      })

      const results = await prisma.certificate.findMany({
        where: {
          certificateNumber: { contains: '001' },
        },
      })

      expect(results).toHaveLength(1)
      expect(results[0].certificateNumber).toContain('001')
    })

    it('should search certificates by customer name', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      await createTestCertificate(prisma, engineer.id, {
        customerName: 'Acme Corporation',
      })
      await createTestCertificate(prisma, engineer.id, {
        customerName: 'Beta Industries',
      })

      const results = await prisma.certificate.findMany({
        where: {
          customerName: { contains: 'Acme' },
        },
      })

      expect(results).toHaveLength(1)
      expect(results[0].customerName).toBe('Acme Corporation')
    })

    it('should search certificates by UUC description', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      await createTestCertificate(prisma, engineer.id, {
        uucDescription: 'Digital Multimeter',
      })
      await createTestCertificate(prisma, engineer.id, {
        uucDescription: 'Pressure Gauge',
      })

      const results = await prisma.certificate.findMany({
        where: {
          uucDescription: { contains: 'Multimeter' },
        },
      })

      expect(results).toHaveLength(1)
    })

    it('should include creator details', async () => {
      const { engineer, admin } = await createEngineerWithAdmin(prisma)
      await createTestCertificate(prisma, engineer.id)

      const certificates = await prisma.certificate.findMany({
        include: {
          createdBy: {
            select: {
              id: true,
              name: true,
              email: true,
              assignedAdmin: {
                select: { id: true, name: true },
              },
            },
          },
        },
      })

      expect(certificates[0].createdBy).toBeDefined()
      expect(certificates[0].createdBy.assignedAdmin?.id).toBe(admin.id)
    })

    it('should paginate certificate list', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      for (let i = 0; i < 5; i++) {
        await createTestCertificate(prisma, engineer.id)
        await new Promise((r) => setTimeout(r, 10))
      }

      const page1 = await prisma.certificate.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 2,
        skip: 0,
      })

      const page2 = await prisma.certificate.findMany({
        orderBy: { updatedAt: 'desc' },
        take: 2,
        skip: 2,
      })

      expect(page1).toHaveLength(2)
      expect(page2).toHaveLength(2)
      expect(page1[0].id).not.toBe(page2[0].id)
    })
  })

  describe('Certificate Statistics', () => {
    it('should count certificates by status', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)

      await createTestCertificate(prisma, engineer.id, { status: 'DRAFT' })
      await createTestCertificate(prisma, engineer.id, { status: 'DRAFT' })
      await createTestCertificate(prisma, engineer.id, { status: 'PENDING_REVIEW' })
      await createTestCertificate(prisma, engineer.id, { status: 'APPROVED' })
      await createTestCertificate(prisma, engineer.id, { status: 'AUTHORIZED' })

      const [draft, pending, approved, authorized, total] = await Promise.all([
        prisma.certificate.count({ where: { status: 'DRAFT' } }),
        prisma.certificate.count({ where: { status: 'PENDING_REVIEW' } }),
        prisma.certificate.count({ where: { status: 'APPROVED' } }),
        prisma.certificate.count({ where: { status: 'AUTHORIZED' } }),
        prisma.certificate.count(),
      ])

      expect(draft).toBe(2)
      expect(pending).toBe(1)
      expect(approved).toBe(1)
      expect(authorized).toBe(1)
      expect(total).toBe(5)
    })
  })

  describe('Certificate Details', () => {
    it('should retrieve certificate with full details', async () => {
      const { engineer, admin } = await createEngineerWithAdmin(prisma)
      const cert = await createCertificateWithHistory(prisma, engineer, admin, 'PENDING_REVIEW')

      const fullCert = await prisma.certificate.findUnique({
        where: { id: cert.id },
        include: {
          createdBy: true,
          lastModifiedBy: true,
          events: {
            orderBy: { createdAt: 'desc' },
          },
          parameters: {
            include: {
              results: true,
            },
          },
        },
      })

      expect(fullCert).toBeDefined()
      expect(fullCert?.events.length).toBeGreaterThanOrEqual(1)
    })

    it('should track certificate events', async () => {
      const { engineer, admin } = await createEngineerWithAdmin(prisma)
      const cert = await createCertificateWithHistory(prisma, engineer, admin, 'PENDING_REVIEW')

      const events = await prisma.certificateEvent.findMany({
        where: { certificateId: cert.id },
        orderBy: { sequenceNumber: 'asc' },
      })

      expect(events.length).toBeGreaterThanOrEqual(2)
      expect(events[0].eventType).toBe('CERTIFICATE_CREATED')
      expect(events[1].eventType).toBe('SUBMITTED_FOR_REVIEW')
    })
  })

  describe('Certificate Edit by Admin', () => {
    it('should allow admin to edit certificate data', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const cert = await createTestCertificate(prisma, engineer.id, {
        customerName: 'Original Customer',
      })

      const updated = await prisma.certificate.update({
        where: { id: cert.id },
        data: { customerName: 'Updated Customer' },
      })

      expect(updated.customerName).toBe('Updated Customer')
    })

    it('should track who last modified the certificate', async () => {
      const { engineer, admin } = await createEngineerWithAdmin(prisma)
      const cert = await createTestCertificate(prisma, engineer.id)

      const updated = await prisma.certificate.update({
        where: { id: cert.id },
        data: {
          customerName: 'Modified by Admin',
          lastModifiedById: admin.id,
        },
      })

      expect(updated.lastModifiedById).toBe(admin.id)
    })
  })

  describe('Certificate Multi-Status Queries', () => {
    it('should query certificates in multiple statuses', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      await createTestCertificate(prisma, engineer.id, { status: 'DRAFT' })
      await createTestCertificate(prisma, engineer.id, { status: 'PENDING_REVIEW' })
      await createTestCertificate(prisma, engineer.id, { status: 'REVISION_REQUIRED' })
      await createTestCertificate(prisma, engineer.id, { status: 'APPROVED' })

      const reviewable = await prisma.certificate.findMany({
        where: {
          status: { in: ['PENDING_REVIEW', 'REVISION_REQUIRED'] },
        },
      })

      expect(reviewable).toHaveLength(2)
    })

    it('should exclude draft certificates from certain queries', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      await createTestCertificate(prisma, engineer.id, { status: 'DRAFT' })
      await createTestCertificate(prisma, engineer.id, { status: 'PENDING_REVIEW' })

      const submitted = await prisma.certificate.findMany({
        where: {
          status: { not: 'DRAFT' },
        },
      })

      expect(submitted).toHaveLength(1)
      expect(submitted[0].status).toBe('PENDING_REVIEW')
    })
  })

  describe('Certificate Sorting', () => {
    it('should sort certificates by updated date', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)

      const cert1 = await createTestCertificate(prisma, engineer.id)
      await new Promise((r) => setTimeout(r, 50))
      const cert2 = await createTestCertificate(prisma, engineer.id)
      await new Promise((r) => setTimeout(r, 50))
      const cert3 = await createTestCertificate(prisma, engineer.id)

      const sorted = await prisma.certificate.findMany({
        orderBy: { updatedAt: 'desc' },
      })

      expect(sorted[0].id).toBe(cert3.id)
      expect(sorted[2].id).toBe(cert1.id)
    })

    it('should sort certificates by certificate number', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)

      await createTestCertificate(prisma, engineer.id, { certificateNumber: 'HTA/003' })
      await createTestCertificate(prisma, engineer.id, { certificateNumber: 'HTA/001' })
      await createTestCertificate(prisma, engineer.id, { certificateNumber: 'HTA/002' })

      const sorted = await prisma.certificate.findMany({
        orderBy: { certificateNumber: 'asc' },
      })

      expect(sorted[0].certificateNumber).toBe('HTA/001')
      expect(sorted[1].certificateNumber).toBe('HTA/002')
      expect(sorted[2].certificateNumber).toBe('HTA/003')
    })
  })
})
