/**
 * Customer Portal API Integration Tests
 *
 * Tests customer-facing functionality with real database interactions.
 */

import { describe, it, expect, beforeAll, afterAll, beforeEach } from 'vitest'
import { PrismaClient } from '@prisma/client'
import { randomUUID } from 'crypto'
import {
  setupTestDatabase,
  teardownTestDatabase,
  cleanTestDatabase,
} from '../setup/test-db'
import {
  createEngineerWithAdmin,
  createCustomerAccount,
  createCustomerUser,
  createTestCertificate,
} from '../setup/fixtures'

describe('Customer Portal API Integration', () => {
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

  describe('Customer Dashboard', () => {
    it('should retrieve pending certificates for customer', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const account = await createCustomerAccount(prisma, {
        companyName: 'Test Company',
      })
      const customer = await createCustomerUser(prisma, account.id)

      // Create certificate for this customer's company
      await prisma.certificate.create({
        data: {
          certificateNumber: 'HTA/PENDING/001',
          customerName: 'Test Company',
          status: 'PENDING_CUSTOMER_APPROVAL',
          createdById: engineer.id,
          lastModifiedById: engineer.id,
        },
      })

      const pendingCerts = await prisma.certificate.findMany({
        where: {
          status: 'PENDING_CUSTOMER_APPROVAL',
        },
      })

      expect(pendingCerts.length).toBeGreaterThanOrEqual(1)
    })

    it('should retrieve authorized certificates for customer', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const companyName = 'Authorized Test Company'

      // Create authorized certificates
      await prisma.certificate.create({
        data: {
          certificateNumber: 'HTA/AUTH/001',
          customerName: companyName,
          status: 'AUTHORIZED',
          signedPdfPath: '/signed/001.pdf',
          createdById: engineer.id,
          lastModifiedById: engineer.id,
        },
      })

      await prisma.certificate.create({
        data: {
          certificateNumber: 'HTA/AUTH/002',
          customerName: companyName,
          status: 'AUTHORIZED',
          signedPdfPath: '/signed/002.pdf',
          createdById: engineer.id,
          lastModifiedById: engineer.id,
        },
      })

      const authorized = await prisma.certificate.findMany({
        where: {
          status: 'AUTHORIZED',
          customerName: companyName,
        },
      })

      expect(authorized).toHaveLength(2)
    })

    it('should count certificates by status for dashboard', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const companyName = 'Dashboard Stats Company'

      // Create certificates in various statuses
      await prisma.certificate.create({
        data: {
          certificateNumber: 'HTA/D/001',
          customerName: companyName,
          status: 'PENDING_CUSTOMER_APPROVAL',
          createdById: engineer.id,
          lastModifiedById: engineer.id,
        },
      })

      await prisma.certificate.create({
        data: {
          certificateNumber: 'HTA/D/002',
          customerName: companyName,
          status: 'PENDING_ADMIN_AUTHORIZATION',
          createdById: engineer.id,
          lastModifiedById: engineer.id,
        },
      })

      await prisma.certificate.create({
        data: {
          certificateNumber: 'HTA/D/003',
          customerName: companyName,
          status: 'AUTHORIZED',
          createdById: engineer.id,
          lastModifiedById: engineer.id,
        },
      })

      const counts = {
        pending: await prisma.certificate.count({
          where: { customerName: companyName, status: 'PENDING_CUSTOMER_APPROVAL' },
        }),
        completed: await prisma.certificate.count({
          where: { customerName: companyName, status: 'PENDING_ADMIN_AUTHORIZATION' },
        }),
        authorized: await prisma.certificate.count({
          where: { customerName: companyName, status: 'AUTHORIZED' },
        }),
      }

      expect(counts.pending).toBe(1)
      expect(counts.completed).toBe(1)
      expect(counts.authorized).toBe(1)
    })
  })

  describe('Approval Tokens', () => {
    it('should create approval token for certificate', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const account = await createCustomerAccount(prisma)
      const customer = await createCustomerUser(prisma, account.id)

      const cert = await createTestCertificate(prisma, engineer.id, {
        status: 'PENDING_CUSTOMER_APPROVAL',
      })

      const token = await prisma.approvalToken.create({
        data: {
          token: randomUUID(),
          certificateId: cert.id,
          customerId: customer.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), // 7 days
        },
      })

      expect(token).toBeDefined()
      expect(token.token).toBeDefined()
      expect(token.usedAt).toBeNull()
    })

    it('should find valid (unused, unexpired) tokens', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const account = await createCustomerAccount(prisma)
      const customer = await createCustomerUser(prisma, account.id)
      const cert = await createTestCertificate(prisma, engineer.id, {
        status: 'PENDING_CUSTOMER_APPROVAL',
      })

      // Create valid token
      await prisma.approvalToken.create({
        data: {
          token: 'valid-token',
          certificateId: cert.id,
          customerId: customer.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      })

      // Create expired token
      await prisma.approvalToken.create({
        data: {
          token: 'expired-token',
          certificateId: cert.id,
          customerId: customer.id,
          expiresAt: new Date(Date.now() - 1000), // Already expired
        },
      })

      const validTokens = await prisma.approvalToken.findMany({
        where: {
          customerId: customer.id,
          usedAt: null,
          expiresAt: { gt: new Date() },
        },
      })

      expect(validTokens).toHaveLength(1)
      expect(validTokens[0].token).toBe('valid-token')
    })

    it('should mark token as used after approval', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const account = await createCustomerAccount(prisma)
      const customer = await createCustomerUser(prisma, account.id)
      const cert = await createTestCertificate(prisma, engineer.id, {
        status: 'PENDING_CUSTOMER_APPROVAL',
      })

      const token = await prisma.approvalToken.create({
        data: {
          token: 'to-be-used-token',
          certificateId: cert.id,
          customerId: customer.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      })

      const used = await prisma.approvalToken.update({
        where: { id: token.id },
        data: { usedAt: new Date() },
      })

      expect(used.usedAt).toBeDefined()
    })
  })

  describe('Customer Certificate Review', () => {
    it('should retrieve certificate for review via token', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const account = await createCustomerAccount(prisma)
      const customer = await createCustomerUser(prisma, account.id)
      const cert = await createTestCertificate(prisma, engineer.id, {
        status: 'PENDING_CUSTOMER_APPROVAL',
        customerName: 'Token Review Company',
      })

      const tokenStr = randomUUID()
      await prisma.approvalToken.create({
        data: {
          token: tokenStr,
          certificateId: cert.id,
          customerId: customer.id,
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        },
      })

      const tokenData = await prisma.approvalToken.findUnique({
        where: { token: tokenStr },
        include: {
          certificate: true,
          customer: true,
        },
      })

      expect(tokenData).toBeDefined()
      expect(tokenData?.certificate.id).toBe(cert.id)
      expect(tokenData?.customer.id).toBe(customer.id)
    })

    it('should allow customer to approve certificate', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const cert = await createTestCertificate(prisma, engineer.id, {
        status: 'PENDING_CUSTOMER_APPROVAL',
      })

      // Simulate customer approval - update status
      const approved = await prisma.certificate.update({
        where: { id: cert.id },
        data: { status: 'APPROVED' },
      })

      expect(approved.status).toBe('APPROVED')
    })

    it('should allow customer to request revision', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const cert = await createTestCertificate(prisma, engineer.id, {
        status: 'PENDING_CUSTOMER_APPROVAL',
      })

      // Simulate customer revision request
      const revised = await prisma.certificate.update({
        where: { id: cert.id },
        data: { status: 'CUSTOMER_REVISION_REQUIRED' },
      })

      // Create revision event
      await prisma.certificateEvent.create({
        data: {
          certificateId: cert.id,
          eventType: 'CUSTOMER_REVISION_REQUESTED',
          eventData: JSON.stringify({ notes: 'Please correct the serial number' }),
          sequenceNumber: 1,
          revision: 1,
          userRole: 'CUSTOMER',
        },
      })

      expect(revised.status).toBe('CUSTOMER_REVISION_REQUIRED')
    })
  })

  describe('Customer Signatures', () => {
    it('should record customer signature', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const cert = await createTestCertificate(prisma, engineer.id, {
        status: 'PENDING_CUSTOMER_APPROVAL',
      })

      const signature = await prisma.signature.create({
        data: {
          certificateId: cert.id,
          signerType: 'CUSTOMER',
          signerName: 'John Customer',
          signerEmail: 'john@customer.com',
          signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          signedAt: new Date(),
        },
      })

      expect(signature).toBeDefined()
      expect(signature.signerType).toBe('CUSTOMER')
    })

    it('should check if customer has signed', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const cert = await createTestCertificate(prisma, engineer.id)

      await prisma.signature.create({
        data: {
          certificateId: cert.id,
          signerType: 'CUSTOMER',
          signerName: 'Customer Signer',
          signerEmail: 'signer@customer.com',
          signatureData: 'data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAADUlEQVR42mNk+M9QDwADhgGAWjR9awAAAABJRU5ErkJggg==',
          signedAt: new Date(),
        },
      })

      const signatures = await prisma.signature.findMany({
        where: {
          certificateId: cert.id,
          signerType: 'CUSTOMER',
        },
      })

      expect(signatures).toHaveLength(1)
    })
  })

  describe('Customer Chat/Notes', () => {
    it('should create customer note on certificate', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const cert = await createTestCertificate(prisma, engineer.id, {
        status: 'PENDING_CUSTOMER_APPROVAL',
      })

      const event = await prisma.certificateEvent.create({
        data: {
          certificateId: cert.id,
          eventType: 'CUSTOMER_NOTE_ADDED',
          eventData: JSON.stringify({
            note: 'Please verify the calibration date',
          }),
          sequenceNumber: 1,
          revision: 1,
          userRole: 'CUSTOMER',
        },
      })

      expect(event).toBeDefined()
      expect(event.eventType).toBe('CUSTOMER_NOTE_ADDED')
    })

    it('should retrieve customer communication history', async () => {
      const { engineer, admin } = await createEngineerWithAdmin(prisma)
      const cert = await createTestCertificate(prisma, engineer.id)

      // Customer note
      await prisma.certificateEvent.create({
        data: {
          certificateId: cert.id,
          eventType: 'CUSTOMER_NOTE_ADDED',
          eventData: JSON.stringify({ note: 'Question about readings' }),
          sequenceNumber: 1,
          revision: 1,
          userRole: 'CUSTOMER',
        },
      })

      // Admin reply
      await prisma.certificateEvent.create({
        data: {
          certificateId: cert.id,
          eventType: 'ADMIN_REPLIED_TO_CUSTOMER',
          eventData: JSON.stringify({ response: 'Readings are correct' }),
          userId: admin.id,
          userRole: 'ADMIN',
          sequenceNumber: 2,
          revision: 1,
        },
      })

      const events = await prisma.certificateEvent.findMany({
        where: {
          certificateId: cert.id,
          eventType: { in: ['CUSTOMER_NOTE_ADDED', 'ADMIN_REPLIED_TO_CUSTOMER'] },
        },
        orderBy: { sequenceNumber: 'asc' },
      })

      expect(events).toHaveLength(2)
    })
  })

  describe('Traceability Data', () => {
    it('should retrieve master instruments used in customer certificates', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const companyName = 'Traceability Company'

      const cert = await prisma.certificate.create({
        data: {
          certificateNumber: 'HTA/TRACE/001',
          customerName: companyName,
          status: 'AUTHORIZED',
          createdById: engineer.id,
          lastModifiedById: engineer.id,
        },
      })

      // Create master instrument link
      await prisma.certificateMasterInstrument.create({
        data: {
          masterInstrumentId: 'MI-001',
          certificateId: cert.id,
          description: 'Reference Multimeter',
          serialNumber: 'SN12345',
          category: 'Electro-Technical',
          sopReference: 'SOP/CAL/001',
        },
      })

      const instruments = await prisma.certificateMasterInstrument.findMany({
        where: { certificateId: cert.id },
      })

      expect(instruments).toHaveLength(1)
      expect(instruments[0].description).toBe('Reference Multimeter')
    })
  })

  describe('Customer Team Management', () => {
    it('should list team members', async () => {
      const account = await createCustomerAccount(prisma, {
        companyName: 'Team Company',
      })

      await createCustomerUser(prisma, account.id, { name: 'Member 1' })
      await createCustomerUser(prisma, account.id, { name: 'Member 2' })
      await createCustomerUser(prisma, account.id, { name: 'Member 3' })

      const team = await prisma.customerUser.findMany({
        where: { customerAccountId: account.id },
      })

      expect(team).toHaveLength(3)
    })

    it('should identify primary POC', async () => {
      const account = await createCustomerAccount(prisma)
      const poc = await createCustomerUser(prisma, account.id, { name: 'Primary POC' })
      await createCustomerUser(prisma, account.id, { name: 'Other Member' })

      await prisma.customerAccount.update({
        where: { id: account.id },
        data: { primaryPocId: poc.id },
      })

      const accountWithPoc = await prisma.customerAccount.findUnique({
        where: { id: account.id },
        include: { primaryPoc: true },
      })

      expect(accountWithPoc?.primaryPoc?.name).toBe('Primary POC')
    })

    it('should create user addition request', async () => {
      const account = await createCustomerAccount(prisma)
      const poc = await createCustomerUser(prisma, account.id, { name: 'POC User' })

      const request = await prisma.customerRequest.create({
        data: {
          type: 'USER_ADDITION',
          status: 'PENDING',
          customerAccountId: account.id,
          requestedById: poc.id,
          data: JSON.stringify({ name: 'New Member', email: 'newmember@team.com' }),
        },
      })

      expect(request).toBeDefined()
      expect(request.status).toBe('PENDING')
    })
  })
})
