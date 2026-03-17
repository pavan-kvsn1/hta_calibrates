/**
 * Database Query Integration Tests
 *
 * Tests complex database queries and relations.
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
  createTestParameter,
  createCalibrationResults,
  createCustomerAccount,
  createCustomerUser,
  createMasterInstrument,
  createTestNotification,
  createFullTestScenario,
} from '../setup/fixtures'

describe('Database Query Integration', () => {
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

  describe('Complex Joins', () => {
    it('should retrieve certificate with all nested relations', async () => {
      const scenario = await createFullTestScenario(prisma)

      const certificate = await prisma.certificate.findUnique({
        where: { id: scenario.certificate.id },
        include: {
          createdBy: {
            include: { assignedAdmin: true },
          },
          parameters: {
            include: { results: true },
          },
          events: {
            orderBy: { sequenceNumber: 'asc' },
          },
        },
      })

      expect(certificate).toBeDefined()
      expect(certificate?.createdBy.assignedAdmin).toBeDefined()
      expect(certificate?.parameters.length).toBeGreaterThan(0)
      expect(certificate?.parameters[0].results.length).toBeGreaterThan(0)
    })

    it('should retrieve user with all certificate relations', async () => {
      const { engineer, admin } = await createEngineerWithAdmin(prisma)

      await createTestCertificate(prisma, engineer.id)
      await createTestCertificate(prisma, engineer.id)

      const userWithCerts = await prisma.user.findUnique({
        where: { id: engineer.id },
        include: {
          createdCertificates: true,
          assignedAdmin: true,
        },
      })

      expect(userWithCerts?.createdCertificates).toHaveLength(2)
      expect(userWithCerts?.assignedAdmin?.id).toBe(admin.id)
    })
  })

  describe('Aggregation Queries', () => {
    it('should count certificates by status', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)

      await createTestCertificate(prisma, engineer.id, { status: 'DRAFT' })
      await createTestCertificate(prisma, engineer.id, { status: 'DRAFT' })
      await createTestCertificate(prisma, engineer.id, { status: 'PENDING_REVIEW' })
      await createTestCertificate(prisma, engineer.id, { status: 'APPROVED' })

      const statusCounts = await prisma.certificate.groupBy({
        by: ['status'],
        _count: { status: true },
      })

      const draftCount = statusCounts.find((s) => s.status === 'DRAFT')?._count.status
      const pendingCount = statusCounts.find((s) => s.status === 'PENDING_REVIEW')?._count.status

      expect(draftCount).toBe(2)
      expect(pendingCount).toBe(1)
    })

    it('should count calibration results per certificate', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const cert1 = await createTestCertificate(prisma, engineer.id)
      const cert2 = await createTestCertificate(prisma, engineer.id)

      const param1 = await createTestParameter(prisma, cert1.id)
      const param2 = await createTestParameter(prisma, cert2.id)

      await createCalibrationResults(prisma, param1.id, 5)
      await createCalibrationResults(prisma, param2.id, 10)

      // Count results for cert1
      const cert1Results = await prisma.calibrationResult.count({
        where: {
          parameter: { certificateId: cert1.id },
        },
      })

      expect(cert1Results).toBe(5)
    })

    it('should get average error per parameter', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)
      const parameter = await createTestParameter(prisma, certificate.id)

      // Create results with known errors
      await prisma.calibrationResult.createMany({
        data: [
          { parameterId: parameter.id, pointNumber: 1, errorObserved: 0.1 },
          { parameterId: parameter.id, pointNumber: 2, errorObserved: 0.2 },
          { parameterId: parameter.id, pointNumber: 3, errorObserved: 0.3 },
        ],
      })

      const avgError = await prisma.calibrationResult.aggregate({
        where: { parameterId: parameter.id },
        _avg: { errorObserved: true },
      })

      expect(avgError._avg.errorObserved).toBeCloseTo(0.2, 1)
    })
  })

  describe('Filtering and Pagination', () => {
    it('should paginate certificates', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)

      // Create 10 certificates
      for (let i = 0; i < 10; i++) {
        await createTestCertificate(prisma, engineer.id)
      }

      // Get page 1 (first 5)
      const page1 = await prisma.certificate.findMany({
        take: 5,
        skip: 0,
        orderBy: { createdAt: 'desc' },
      })

      // Get page 2 (next 5)
      const page2 = await prisma.certificate.findMany({
        take: 5,
        skip: 5,
        orderBy: { createdAt: 'desc' },
      })

      expect(page1).toHaveLength(5)
      expect(page2).toHaveLength(5)
      expect(page1[0].id).not.toBe(page2[0].id)
    })

    it('should filter by date range', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)

      const now = new Date()
      const yesterday = new Date(now.getTime() - 24 * 60 * 60 * 1000)
      const tomorrow = new Date(now.getTime() + 24 * 60 * 60 * 1000)

      await createTestCertificate(prisma, engineer.id)

      const certificates = await prisma.certificate.findMany({
        where: {
          createdAt: {
            gte: yesterday,
            lte: tomorrow,
          },
        },
      })

      expect(certificates.length).toBeGreaterThan(0)
    })

    it('should search by text fields', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)

      await createTestCertificate(prisma, engineer.id, {
        customerName: 'Acme Corporation',
      })
      await createTestCertificate(prisma, engineer.id, {
        customerName: 'Beta Industries',
      })
      await createTestCertificate(prisma, engineer.id, {
        customerName: 'Acme Labs',
      })

      const acmeCerts = await prisma.certificate.findMany({
        where: {
          customerName: {
            contains: 'Acme',
          },
        },
      })

      expect(acmeCerts).toHaveLength(2)
    })
  })

  describe('Relational Queries', () => {
    it('should find certificates for an admin\'s engineers', async () => {
      const { engineer, admin } = await createEngineerWithAdmin(prisma)

      await createTestCertificate(prisma, engineer.id)
      await createTestCertificate(prisma, engineer.id)

      const adminCerts = await prisma.certificate.findMany({
        where: {
          createdBy: {
            assignedAdminId: admin.id,
          },
        },
      })

      expect(adminCerts).toHaveLength(2)
    })

    it('should find unread notifications with certificate details', async () => {
      const { engineer, admin } = await createEngineerWithAdmin(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)

      await createTestNotification(prisma, admin.id, certificate.id, {
        read: false,
        title: 'Certificate Submitted',
      })

      const notifications = await prisma.notification.findMany({
        where: {
          userId: admin.id,
          read: false,
        },
        include: {
          certificate: {
            select: {
              certificateNumber: true,
              status: true,
            },
          },
        },
      })

      expect(notifications).toHaveLength(1)
      expect(notifications[0].certificate).toBeDefined()
    })
  })

  describe('Master Instruments', () => {
    it('should find latest version of instrument', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)

      // Create instrument with multiple versions
      const instrumentId = 'shared-instrument-id'

      await prisma.masterInstrument.create({
        data: {
          instrumentId,
          version: 1,
          isLatest: false,
          category: 'Electro-Technical',
          description: 'Multimeter v1',
          make: 'Fluke',
          model: '87V',
          assetNumber: 'AST-001',
          serialNumber: 'SN-001',
          createdById: engineer.id,
        },
      })

      await prisma.masterInstrument.create({
        data: {
          instrumentId,
          version: 2,
          isLatest: true,
          category: 'Electro-Technical',
          description: 'Multimeter v2 (Updated)',
          make: 'Fluke',
          model: '87V',
          assetNumber: 'AST-001',
          serialNumber: 'SN-001-REV',
          createdById: engineer.id,
        },
      })

      const latest = await prisma.masterInstrument.findFirst({
        where: {
          instrumentId,
          isLatest: true,
        },
      })

      expect(latest).toBeDefined()
      expect(latest?.version).toBe(2)
      expect(latest?.description).toContain('v2')
    })

    it('should filter instruments by category', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)

      await createMasterInstrument(prisma, engineer.id, {
        category: 'Electro-Technical',
        description: 'Multimeter',
      })
      await createMasterInstrument(prisma, engineer.id, {
        category: 'Electro-Technical',
        description: 'Oscilloscope',
      })
      await createMasterInstrument(prisma, engineer.id, {
        category: 'Thermal',
        description: 'Thermometer',
      })

      const electroTech = await prisma.masterInstrument.findMany({
        where: {
          category: 'Electro-Technical',
          isLatest: true,
        },
      })

      expect(electroTech).toHaveLength(2)
    })

    it('should find instruments due for calibration', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const now = new Date()
      const pastDate = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000) // 30 days ago
      const futureDate = new Date(now.getTime() + 30 * 24 * 60 * 60 * 1000) // 30 days from now

      await prisma.masterInstrument.create({
        data: {
          instrumentId: 'overdue-1',
          category: 'Electro-Technical',
          description: 'Overdue Instrument',
          make: 'Test',
          model: 'Test',
          assetNumber: 'OVERDUE-001',
          serialNumber: 'SN-OVERDUE',
          calibrationDueDate: pastDate,
          createdById: engineer.id,
        },
      })

      await prisma.masterInstrument.create({
        data: {
          instrumentId: 'upcoming-1',
          category: 'Electro-Technical',
          description: 'Future Instrument',
          make: 'Test',
          model: 'Test',
          assetNumber: 'FUTURE-001',
          serialNumber: 'SN-FUTURE',
          calibrationDueDate: futureDate,
          createdById: engineer.id,
        },
      })

      const overdue = await prisma.masterInstrument.findMany({
        where: {
          calibrationDueDate: {
            lt: now,
          },
          isLatest: true,
        },
      })

      expect(overdue).toHaveLength(1)
      expect(overdue[0].description).toBe('Overdue Instrument')
    })
  })
})
