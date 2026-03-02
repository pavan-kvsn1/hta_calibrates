/**
 * Database Transaction Integration Tests
 *
 * Tests transaction behavior, rollbacks, and data integrity.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanTestDatabase,
} from '../setup/test-db'
import {
  createEngineerWithHod,
  createTestCertificate,
  createTestParameter,
} from '../setup/fixtures'

describe('Database Transaction Integration', () => {
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

  describe('Transaction Commits', () => {
    it('should commit all changes in a successful transaction', async () => {
      const { engineer } = await createEngineerWithHod(prisma)

      await prisma.$transaction(async (tx) => {
        const certificate = await tx.certificate.create({
          data: {
            certificateNumber: 'TXN-TEST-001',
            createdById: engineer.id,
            lastModifiedById: engineer.id,
          },
        })

        await tx.parameter.create({
          data: {
            certificateId: certificate.id,
            parameterName: 'Voltage',
            parameterUnit: 'V',
          },
        })

        await tx.certificateEvent.create({
          data: {
            certificateId: certificate.id,
            sequenceNumber: 1,
            revision: 1,
            eventType: 'CERTIFICATE_CREATED',
            eventData: '{}',
            userId: engineer.id,
            userRole: 'ENGINEER',
          },
        })
      })

      // Verify all were committed
      const certificate = await prisma.certificate.findUnique({
        where: { certificateNumber: 'TXN-TEST-001' },
        include: { parameters: true, events: true },
      })

      expect(certificate).toBeDefined()
      expect(certificate?.parameters).toHaveLength(1)
      expect(certificate?.events).toHaveLength(1)
    })

    it('should handle nested creates in transaction', async () => {
      const { engineer, hod } = await createEngineerWithHod(prisma)

      const result = await prisma.$transaction(async (tx) => {
        const certificate = await tx.certificate.create({
          data: {
            certificateNumber: 'NESTED-001',
            createdById: engineer.id,
            lastModifiedById: engineer.id,
            parameters: {
              create: [
                { parameterName: 'Voltage', parameterUnit: 'V' },
                { parameterName: 'Current', parameterUnit: 'A' },
              ],
            },
          },
          include: { parameters: true },
        })

        return certificate
      })

      expect(result.parameters).toHaveLength(2)
    })
  })

  describe('Transaction Rollbacks', () => {
    it('should rollback all changes on error', async () => {
      const { engineer } = await createEngineerWithHod(prisma)

      const certNumber = 'ROLLBACK-TEST-001'

      try {
        await prisma.$transaction(async (tx) => {
          await tx.certificate.create({
            data: {
              certificateNumber: certNumber,
              createdById: engineer.id,
              lastModifiedById: engineer.id,
            },
          })

          // This should fail due to duplicate certificate number
          await tx.certificate.create({
            data: {
              certificateNumber: certNumber, // Duplicate - will fail
              createdById: engineer.id,
              lastModifiedById: engineer.id,
            },
          })
        })
      } catch {
        // Expected to fail
      }

      // Verify nothing was committed
      const certificate = await prisma.certificate.findUnique({
        where: { certificateNumber: certNumber },
      })

      expect(certificate).toBeNull()
    })

    it('should rollback on thrown error', async () => {
      const { engineer } = await createEngineerWithHod(prisma)

      try {
        await prisma.$transaction(async (tx) => {
          await tx.certificate.create({
            data: {
              certificateNumber: 'ERROR-ROLLBACK-001',
              createdById: engineer.id,
              lastModifiedById: engineer.id,
            },
          })

          // Manually throw error
          throw new Error('Intentional rollback')
        })
      } catch {
        // Expected
      }

      const certificate = await prisma.certificate.findUnique({
        where: { certificateNumber: 'ERROR-ROLLBACK-001' },
      })

      expect(certificate).toBeNull()
    })
  })

  describe('Constraint Violations', () => {
    it('should reject duplicate unique values', async () => {
      const { engineer } = await createEngineerWithHod(prisma)

      await createTestCertificate(prisma, engineer.id, {
        certificateNumber: 'UNIQUE-001',
      })

      await expect(
        createTestCertificate(prisma, engineer.id, {
          certificateNumber: 'UNIQUE-001',
        })
      ).rejects.toThrow()
    })

    it('should reject invalid foreign key references', async () => {
      await expect(
        prisma.certificate.create({
          data: {
            certificateNumber: 'INVALID-FK-001',
            createdById: 'non-existent-user-id',
            lastModifiedById: 'non-existent-user-id',
          },
        })
      ).rejects.toThrow()
    })

    it('should enforce unique constraint on certificate events', async () => {
      const { engineer } = await createEngineerWithHod(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)

      await prisma.certificateEvent.create({
        data: {
          certificateId: certificate.id,
          sequenceNumber: 1,
          revision: 1,
          eventType: 'CERTIFICATE_CREATED',
          eventData: '{}',
          userId: engineer.id,
          userRole: 'ENGINEER',
        },
      })

      await expect(
        prisma.certificateEvent.create({
          data: {
            certificateId: certificate.id,
            sequenceNumber: 1, // Duplicate
            revision: 1,
            eventType: 'FIELD_UPDATED',
            eventData: '{}',
            userId: engineer.id,
            userRole: 'ENGINEER',
          },
        })
      ).rejects.toThrow()
    })
  })

  describe('Cascade Operations', () => {
    it('should cascade delete parameters when certificate is deleted', async () => {
      const { engineer } = await createEngineerWithHod(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)
      const parameter = await createTestParameter(prisma, certificate.id)

      await prisma.certificate.delete({
        where: { id: certificate.id },
      })

      const deletedParam = await prisma.parameter.findUnique({
        where: { id: parameter.id },
      })

      expect(deletedParam).toBeNull()
    })

    it('should cascade delete events when certificate is deleted', async () => {
      const { engineer } = await createEngineerWithHod(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)

      await prisma.certificateEvent.create({
        data: {
          certificateId: certificate.id,
          sequenceNumber: 1,
          revision: 1,
          eventType: 'CERTIFICATE_CREATED',
          eventData: '{}',
          userId: engineer.id,
          userRole: 'ENGINEER',
        },
      })

      await prisma.certificate.delete({
        where: { id: certificate.id },
      })

      const events = await prisma.certificateEvent.findMany({
        where: { certificateId: certificate.id },
      })

      expect(events).toHaveLength(0)
    })

    it('should cascade delete calibration results when parameter is deleted', async () => {
      const { engineer } = await createEngineerWithHod(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)
      const parameter = await createTestParameter(prisma, certificate.id)

      await prisma.calibrationResult.createMany({
        data: [
          { parameterId: parameter.id, pointNumber: 1 },
          { parameterId: parameter.id, pointNumber: 2 },
        ],
      })

      await prisma.parameter.delete({
        where: { id: parameter.id },
      })

      const results = await prisma.calibrationResult.findMany({
        where: { parameterId: parameter.id },
      })

      expect(results).toHaveLength(0)
    })
  })

  describe('Concurrent Operations', () => {
    it('should handle concurrent certificate creation', async () => {
      const { engineer } = await createEngineerWithHod(prisma)

      // Create 10 certificates concurrently
      const promises = Array.from({ length: 10 }, (_, i) =>
        createTestCertificate(prisma, engineer.id, {
          certificateNumber: `CONCURRENT-${i}`,
        })
      )

      const results = await Promise.all(promises)

      expect(results).toHaveLength(10)

      // Verify all were created
      const certificates = await prisma.certificate.findMany({
        where: {
          certificateNumber: {
            startsWith: 'CONCURRENT-',
          },
        },
      })

      expect(certificates).toHaveLength(10)
    })

    it('should handle concurrent updates atomically', async () => {
      const { engineer } = await createEngineerWithHod(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)

      // Increment currentRevision multiple times concurrently
      const updates = Array.from({ length: 5 }, () =>
        prisma.certificate.update({
          where: { id: certificate.id },
          data: {
            currentRevision: {
              increment: 1,
            },
          },
        })
      )

      await Promise.all(updates)

      const updated = await prisma.certificate.findUnique({
        where: { id: certificate.id },
      })

      // All increments should have been applied
      expect(updated?.currentRevision).toBe(6) // 1 (initial) + 5 increments
    })
  })

  describe('Data Integrity', () => {
    it('should maintain referential integrity', async () => {
      const { engineer, hod } = await createEngineerWithHod(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)

      // Verify relations are intact
      const certWithRelations = await prisma.certificate.findUnique({
        where: { id: certificate.id },
        include: {
          createdBy: {
            include: { assignedHod: true },
          },
        },
      })

      expect(certWithRelations?.createdBy.id).toBe(engineer.id)
      expect(certWithRelations?.createdBy.assignedHod?.id).toBe(hod.id)
    })

    it('should preserve event ordering after updates', async () => {
      const { engineer } = await createEngineerWithHod(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)

      // Create events with specific order
      for (let i = 1; i <= 5; i++) {
        await prisma.certificateEvent.create({
          data: {
            certificateId: certificate.id,
            sequenceNumber: i,
            revision: 1,
            eventType: `EVENT_${i}`,
            eventData: JSON.stringify({ order: i }),
            userId: engineer.id,
            userRole: 'ENGINEER',
          },
        })
      }

      // Retrieve and verify order
      const events = await prisma.certificateEvent.findMany({
        where: { certificateId: certificate.id },
        orderBy: { sequenceNumber: 'asc' },
      })

      expect(events).toHaveLength(5)
      events.forEach((event, index) => {
        expect(event.sequenceNumber).toBe(index + 1)
        expect(event.eventType).toBe(`EVENT_${index + 1}`)
      })
    })
  })
})
