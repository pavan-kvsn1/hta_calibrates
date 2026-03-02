/**
 * Certificate API Integration Tests
 *
 * Tests certificate CRUD operations with real database interactions.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanTestDatabase,
} from '../setup/test-db'
import {
  createTestUser,
  createEngineerWithHod,
  createTestCertificate,
  createTestParameter,
  createCalibrationResults,
} from '../setup/fixtures'

describe('Certificate API Integration', () => {
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

  describe('Certificate CRUD Operations', () => {
    it('should create a certificate with all required fields', async () => {
      const { engineer } = await createEngineerWithHod(prisma)

      const certificate = await createTestCertificate(prisma, engineer.id, {
        customerName: 'Integration Test Company',
        uucDescription: 'Test Multimeter',
      })

      expect(certificate).toBeDefined()
      expect(certificate.id).toBeDefined()
      expect(certificate.certificateNumber).toMatch(/^HTA\/CAL\//)
      expect(certificate.customerName).toBe('Integration Test Company')
      expect(certificate.status).toBe('DRAFT')
    })

    it('should retrieve a certificate with all relations', async () => {
      const { engineer, hod } = await createEngineerWithHod(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)
      const parameter = await createTestParameter(prisma, certificate.id)
      await createCalibrationResults(prisma, parameter.id, 3)

      const retrieved = await prisma.certificate.findUnique({
        where: { id: certificate.id },
        include: {
          createdBy: true,
          parameters: {
            include: { results: true },
          },
        },
      })

      expect(retrieved).toBeDefined()
      expect(retrieved?.createdBy.id).toBe(engineer.id)
      expect(retrieved?.parameters).toHaveLength(1)
      expect(retrieved?.parameters[0].results).toHaveLength(3)
    })

    it('should update certificate status', async () => {
      const { engineer } = await createEngineerWithHod(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)

      const updated = await prisma.certificate.update({
        where: { id: certificate.id },
        data: { status: 'PENDING_HOD_REVIEW' },
      })

      expect(updated.status).toBe('PENDING_HOD_REVIEW')
    })

    it('should cascade delete certificate relations', async () => {
      const { engineer } = await createEngineerWithHod(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)
      const parameter = await createTestParameter(prisma, certificate.id)
      await createCalibrationResults(prisma, parameter.id, 3)

      // Delete the certificate
      await prisma.certificate.delete({
        where: { id: certificate.id },
      })

      // Verify parameters and results are also deleted
      const deletedParam = await prisma.parameter.findUnique({
        where: { id: parameter.id },
      })
      expect(deletedParam).toBeNull()

      const results = await prisma.calibrationResult.findMany({
        where: { parameterId: parameter.id },
      })
      expect(results).toHaveLength(0)
    })

    it('should enforce unique certificate numbers', async () => {
      const { engineer } = await createEngineerWithHod(prisma)
      const certNumber = `HTA/CAL/TEST/UNIQUE-001`

      await createTestCertificate(prisma, engineer.id, {
        certificateNumber: certNumber,
      })

      // Attempt to create another with same number
      await expect(
        createTestCertificate(prisma, engineer.id, {
          certificateNumber: certNumber,
        })
      ).rejects.toThrow()
    })
  })

  describe('Certificate Query Operations', () => {
    it('should filter certificates by status', async () => {
      const { engineer } = await createEngineerWithHod(prisma)

      await createTestCertificate(prisma, engineer.id, { status: 'DRAFT' })
      await createTestCertificate(prisma, engineer.id, { status: 'DRAFT' })
      await createTestCertificate(prisma, engineer.id, { status: 'PENDING_HOD_REVIEW' })

      const drafts = await prisma.certificate.findMany({
        where: { status: 'DRAFT' },
      })

      expect(drafts).toHaveLength(2)
    })

    it('should filter certificates by creator', async () => {
      const { engineer: engineer1, hod } = await createEngineerWithHod(prisma)
      const engineer2 = await createTestUser(prisma, {
        name: 'Engineer 2',
        role: 'ENGINEER',
        assignedHodId: hod.id,
      })

      await createTestCertificate(prisma, engineer1.id)
      await createTestCertificate(prisma, engineer1.id)
      await createTestCertificate(prisma, engineer2.id)

      const engineer1Certs = await prisma.certificate.findMany({
        where: { createdById: engineer1.id },
      })

      expect(engineer1Certs).toHaveLength(2)
    })

    it('should order certificates by date', async () => {
      const { engineer } = await createEngineerWithHod(prisma)

      const cert1 = await createTestCertificate(prisma, engineer.id)
      // Small delay to ensure different timestamps
      await new Promise((r) => setTimeout(r, 10))
      const cert2 = await createTestCertificate(prisma, engineer.id)

      const ordered = await prisma.certificate.findMany({
        orderBy: { createdAt: 'desc' },
      })

      expect(ordered[0].id).toBe(cert2.id)
      expect(ordered[1].id).toBe(cert1.id)
    })
  })

  describe('Certificate with Parameters', () => {
    it('should add multiple parameters to a certificate', async () => {
      const { engineer } = await createEngineerWithHod(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)

      await createTestParameter(prisma, certificate.id, {
        parameterName: 'Voltage DC',
        parameterUnit: 'V',
      })
      await createTestParameter(prisma, certificate.id, {
        parameterName: 'Current AC',
        parameterUnit: 'A',
      })
      await createTestParameter(prisma, certificate.id, {
        parameterName: 'Resistance',
        parameterUnit: 'Ω',
      })

      const params = await prisma.parameter.findMany({
        where: { certificateId: certificate.id },
      })

      expect(params).toHaveLength(3)
    })

    it('should calculate total calibration points', async () => {
      const { engineer } = await createEngineerWithHod(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)

      const param1 = await createTestParameter(prisma, certificate.id)
      const param2 = await createTestParameter(prisma, certificate.id)

      await createCalibrationResults(prisma, param1.id, 5)
      await createCalibrationResults(prisma, param2.id, 3)

      const totalResults = await prisma.calibrationResult.count({
        where: {
          parameter: { certificateId: certificate.id },
        },
      })

      expect(totalResults).toBe(8)
    })
  })
})
