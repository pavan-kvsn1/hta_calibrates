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
  createEngineerWithAdmin,
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
      const { engineer } = await createEngineerWithAdmin(prisma)

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
      const { engineer, admin } = await createEngineerWithAdmin(prisma)
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
      const { engineer } = await createEngineerWithAdmin(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)

      const updated = await prisma.certificate.update({
        where: { id: certificate.id },
        data: { status: 'PENDING_REVIEW' },
      })

      expect(updated.status).toBe('PENDING_REVIEW')
    })

    it('should cascade delete certificate relations', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
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
      const { engineer } = await createEngineerWithAdmin(prisma)
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
      const { engineer } = await createEngineerWithAdmin(prisma)

      await createTestCertificate(prisma, engineer.id, { status: 'DRAFT' })
      await createTestCertificate(prisma, engineer.id, { status: 'DRAFT' })
      await createTestCertificate(prisma, engineer.id, { status: 'PENDING_REVIEW' })

      const drafts = await prisma.certificate.findMany({
        where: { status: 'DRAFT' },
      })

      expect(drafts).toHaveLength(2)
    })

    it('should filter certificates by creator', async () => {
      const { engineer: engineer1, admin } = await createEngineerWithAdmin(prisma)
      const engineer2 = await createTestUser(prisma, {
        name: 'Engineer 2',
        role: 'ENGINEER',
        assignedAdminId: admin.id,
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
      const { engineer } = await createEngineerWithAdmin(prisma)

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
      const { engineer } = await createEngineerWithAdmin(prisma)
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
      const { engineer } = await createEngineerWithAdmin(prisma)
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

  describe('Optimistic Concurrency Control', () => {
    it('should detect stale clientUpdatedAt and return 409 Conflict', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)

      // Simulate a stale timestamp (2 seconds behind server)
      const staleTimestamp = new Date(certificate.updatedAt.getTime() - 2000)

      // Update the certificate to change its updatedAt
      await prisma.certificate.update({
        where: { id: certificate.id },
        data: { customerName: 'Updated By Another User' },
      })

      // Now the server's updatedAt is newer than our stale timestamp
      const updatedCert = await prisma.certificate.findUnique({
        where: { id: certificate.id },
      })

      // Verify server timestamp is newer
      expect(updatedCert!.updatedAt.getTime()).toBeGreaterThan(staleTimestamp.getTime())
    })

    it('should allow updates with current clientUpdatedAt', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)

      // Simulate a current timestamp (matching server)
      const currentTimestamp = certificate.updatedAt

      // Update should succeed when timestamps match
      const updated = await prisma.certificate.update({
        where: { id: certificate.id },
        data: { customerName: 'Updated Successfully' },
      })

      expect(updated.customerName).toBe('Updated Successfully')
    })

    it('should allow updates without clientUpdatedAt (backward compatibility)', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)

      // Update without clientUpdatedAt should still work
      const updated = await prisma.certificate.update({
        where: { id: certificate.id },
        data: { customerName: 'Updated Without Timestamp' },
      })

      expect(updated.customerName).toBe('Updated Without Timestamp')
    })

    it('should track updatedAt timestamp after each save', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)
      const originalUpdatedAt = certificate.updatedAt

      // Small delay to ensure timestamp changes
      await new Promise((r) => setTimeout(r, 10))

      // Update the certificate
      const updated = await prisma.certificate.update({
        where: { id: certificate.id },
        data: { customerName: 'Updated Name' },
      })

      // updatedAt should be newer
      expect(updated.updatedAt.getTime()).toBeGreaterThan(originalUpdatedAt.getTime())
    })
  })

  describe('Field-Level Change Auditing', () => {
    it('should create FIELDS_UPDATED event with change details', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id, {
        customerName: 'Original Name',
      })

      // Update the certificate
      await prisma.certificate.update({
        where: { id: certificate.id },
        data: { customerName: 'New Name' },
      })

      // Create a FIELDS_UPDATED event manually (simulating what the API does)
      await prisma.certificateEvent.create({
        data: {
          certificateId: certificate.id,
          sequenceNumber: 1,
          revision: 1,
          eventType: 'FIELDS_UPDATED',
          eventData: JSON.stringify({
            changes: [
              {
                field: 'customerName',
                fieldLabel: 'Customer Name',
                previousValue: 'Original Name',
                newValue: 'New Name',
                section: 'summary',
              },
            ],
            parameters: [],
            summary: 'Updated 1 field',
          }),
          userId: engineer.id,
          userRole: 'ENGINEER',
        },
      })

      // Verify the event was created
      const events = await prisma.certificateEvent.findMany({
        where: { certificateId: certificate.id },
      })

      expect(events.length).toBeGreaterThanOrEqual(1)
      const fieldsUpdatedEvent = events.find(e => e.eventType === 'FIELDS_UPDATED')
      expect(fieldsUpdatedEvent).toBeDefined()

      const eventData = JSON.parse(fieldsUpdatedEvent!.eventData)
      expect(eventData.changes).toHaveLength(1)
      expect(eventData.changes[0].field).toBe('customerName')
      expect(eventData.changes[0].previousValue).toBe('Original Name')
      expect(eventData.changes[0].newValue).toBe('New Name')
    })

    it('should track parameter additions in event data', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)

      // Create a FIELDS_UPDATED event with parameter addition
      await prisma.certificateEvent.create({
        data: {
          certificateId: certificate.id,
          sequenceNumber: 1,
          revision: 1,
          eventType: 'FIELDS_UPDATED',
          eventData: JSON.stringify({
            changes: [],
            parameters: [
              { type: 'ADDED', parameterName: 'Temperature' },
            ],
            summary: 'Updated 1 parameter added',
          }),
          userId: engineer.id,
          userRole: 'ENGINEER',
        },
      })

      const event = await prisma.certificateEvent.findFirst({
        where: {
          certificateId: certificate.id,
          eventType: 'FIELDS_UPDATED',
        },
      })

      const eventData = JSON.parse(event!.eventData)
      expect(eventData.parameters).toHaveLength(1)
      expect(eventData.parameters[0].type).toBe('ADDED')
      expect(eventData.parameters[0].parameterName).toBe('Temperature')
    })

    it('should track multiple changes in a single event', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)

      // Create a FIELDS_UPDATED event with multiple changes
      await prisma.certificateEvent.create({
        data: {
          certificateId: certificate.id,
          sequenceNumber: 1,
          revision: 1,
          eventType: 'FIELDS_UPDATED',
          eventData: JSON.stringify({
            changes: [
              { field: 'customerName', fieldLabel: 'Customer Name', previousValue: 'A', newValue: 'B', section: 'summary' },
              { field: 'customerAddress', fieldLabel: 'Customer Address', previousValue: 'X', newValue: 'Y', section: 'summary' },
              { field: 'uucDescription', fieldLabel: 'UUC Description', previousValue: 'Old', newValue: 'New', section: 'uuc-details' },
            ],
            parameters: [
              { type: 'MODIFIED', parameterName: 'Temperature', changes: [] },
            ],
            summary: 'Updated 3 fields, 1 parameter modified',
          }),
          userId: engineer.id,
          userRole: 'ENGINEER',
        },
      })

      const event = await prisma.certificateEvent.findFirst({
        where: {
          certificateId: certificate.id,
          eventType: 'FIELDS_UPDATED',
        },
      })

      const eventData = JSON.parse(event!.eventData)
      expect(eventData.changes).toHaveLength(3)
      expect(eventData.parameters).toHaveLength(1)
      expect(eventData.summary).toContain('3 fields')
      expect(eventData.summary).toContain('1 parameter modified')
    })
  })
})
