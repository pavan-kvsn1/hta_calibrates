/**
 * Admin Customers API Integration Tests
 *
 * Tests admin customer management with real database interactions.
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
  createCustomerAccount,
  createCustomerUser,
} from '../setup/fixtures'

describe('Admin Customers API Integration', () => {
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

  describe('Customer Account Management', () => {
    it('should create a customer account', async () => {
      const { admin } = await createEngineerWithAdmin(prisma)

      const account = await createCustomerAccount(prisma, {
        companyName: 'Acme Corporation',
        address: '123 Main St, City',
        contactEmail: 'contact@acme.com',
        assignedAdminId: admin.id,
      })

      expect(account).toBeDefined()
      expect(account.id).toBeDefined()
      expect(account.companyName).toBe('Acme Corporation')
    })

    it('should list all customer accounts', async () => {
      await createCustomerAccount(prisma, { companyName: 'Company A' })
      await createCustomerAccount(prisma, { companyName: 'Company B' })
      await createCustomerAccount(prisma, { companyName: 'Company C' })

      const accounts = await prisma.customerAccount.findMany({
        orderBy: { companyName: 'asc' },
      })

      expect(accounts.length).toBeGreaterThanOrEqual(3)
    })

    it('should search customer accounts by name', async () => {
      await createCustomerAccount(prisma, { companyName: 'Alpha Tech' })
      await createCustomerAccount(prisma, { companyName: 'Beta Industries' })
      await createCustomerAccount(prisma, { companyName: 'Alpha Solutions' })

      const results = await prisma.customerAccount.findMany({
        where: {
          companyName: { contains: 'Alpha' },
        },
      })

      expect(results).toHaveLength(2)
    })

    it('should update customer account details', async () => {
      const account = await createCustomerAccount(prisma, {
        companyName: 'Original Name',
        address: 'Original Address',
      })

      const updated = await prisma.customerAccount.update({
        where: { id: account.id },
        data: {
          companyName: 'Updated Name',
          address: 'Updated Address',
        },
      })

      expect(updated.companyName).toBe('Updated Name')
      expect(updated.address).toBe('Updated Address')
    })

    it('should include assigned admin in account details', async () => {
      const { admin } = await createEngineerWithAdmin(prisma)

      const account = await createCustomerAccount(prisma, {
        assignedAdminId: admin.id,
      })

      const withAdmin = await prisma.customerAccount.findUnique({
        where: { id: account.id },
        include: {
          assignedAdmin: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      expect(withAdmin?.assignedAdmin).toBeDefined()
      expect(withAdmin?.assignedAdmin?.id).toBe(admin.id)
    })
  })

  describe('Customer User Management', () => {
    it('should create a customer user', async () => {
      const account = await createCustomerAccount(prisma)

      const user = await createCustomerUser(prisma, account.id, {
        name: 'John Customer',
        email: 'john@customer.com',
      })

      expect(user).toBeDefined()
      expect(user.name).toBe('John Customer')
      expect(user.customerAccountId).toBe(account.id)
    })

    it('should list users for a customer account', async () => {
      const account = await createCustomerAccount(prisma)

      await createCustomerUser(prisma, account.id, { name: 'User 1' })
      await createCustomerUser(prisma, account.id, { name: 'User 2' })
      await createCustomerUser(prisma, account.id, { name: 'User 3' })

      const users = await prisma.customerUser.findMany({
        where: { customerAccountId: account.id },
      })

      expect(users).toHaveLength(3)
    })

    it('should count users per account', async () => {
      const account = await createCustomerAccount(prisma)

      await createCustomerUser(prisma, account.id)
      await createCustomerUser(prisma, account.id)

      const count = await prisma.customerUser.count({
        where: { customerAccountId: account.id },
      })

      expect(count).toBe(2)
    })

    it('should set primary POC for account', async () => {
      const account = await createCustomerAccount(prisma)
      const user = await createCustomerUser(prisma, account.id)

      const updated = await prisma.customerAccount.update({
        where: { id: account.id },
        data: { primaryPocId: user.id },
      })

      expect(updated.primaryPocId).toBe(user.id)
    })

    it('should identify primary POC', async () => {
      const account = await createCustomerAccount(prisma)
      const primaryUser = await createCustomerUser(prisma, account.id)
      await createCustomerUser(prisma, account.id)

      await prisma.customerAccount.update({
        where: { id: account.id },
        data: { primaryPocId: primaryUser.id },
      })

      const accountWithPoc = await prisma.customerAccount.findUnique({
        where: { id: account.id },
        include: {
          primaryPoc: true,
          users: true,
        },
      })

      expect(accountWithPoc?.primaryPoc?.id).toBe(primaryUser.id)
      expect(accountWithPoc?.users).toHaveLength(2)
    })
  })

  describe('Customer Registration Requests', () => {
    it('should create a registration request', async () => {
      const request = await prisma.registrationRequest.create({
        data: {
          email: 'newcustomer@company.com',
          name: 'New Customer',
          companyName: 'New Company Inc',
          companyAddress: '456 New St',
          phone: '+1234567890',
          status: 'PENDING',
        },
      })

      expect(request).toBeDefined()
      expect(request.status).toBe('PENDING')
    })

    it('should list pending registration requests', async () => {
      await prisma.registrationRequest.create({
        data: {
          email: 'req1@company.com',
          name: 'Request 1',
          companyName: 'Company 1',
          status: 'PENDING',
        },
      })

      await prisma.registrationRequest.create({
        data: {
          email: 'req2@company.com',
          name: 'Request 2',
          companyName: 'Company 2',
          status: 'APPROVED',
        },
      })

      const pending = await prisma.registrationRequest.findMany({
        where: { status: 'PENDING' },
      })

      expect(pending).toHaveLength(1)
    })

    it('should approve registration request', async () => {
      const request = await prisma.registrationRequest.create({
        data: {
          email: 'approve@company.com',
          name: 'To Approve',
          companyName: 'Approve Co',
          status: 'PENDING',
        },
      })

      const approved = await prisma.registrationRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
        },
      })

      expect(approved.status).toBe('APPROVED')
      expect(approved.reviewedAt).toBeDefined()
    })

    it('should reject registration request with reason', async () => {
      const request = await prisma.registrationRequest.create({
        data: {
          email: 'reject@company.com',
          name: 'To Reject',
          companyName: 'Reject Co',
          status: 'PENDING',
        },
      })

      const rejected = await prisma.registrationRequest.update({
        where: { id: request.id },
        data: {
          status: 'REJECTED',
          reviewedAt: new Date(),
          rejectionReason: 'Invalid company details',
        },
      })

      expect(rejected.status).toBe('REJECTED')
      expect(rejected.rejectionReason).toBe('Invalid company details')
    })
  })

  describe('Team Access Requests', () => {
    it('should create team access request', async () => {
      const account = await createCustomerAccount(prisma)

      const request = await prisma.teamAccessRequest.create({
        data: {
          email: 'newmember@company.com',
          name: 'New Team Member',
          customerAccountId: account.id,
          status: 'PENDING',
        },
      })

      expect(request).toBeDefined()
      expect(request.status).toBe('PENDING')
      expect(request.customerAccountId).toBe(account.id)
    })

    it('should list pending team access requests', async () => {
      const account = await createCustomerAccount(prisma)

      await prisma.teamAccessRequest.create({
        data: {
          email: 'member1@company.com',
          name: 'Member 1',
          customerAccountId: account.id,
          status: 'PENDING',
        },
      })

      await prisma.teamAccessRequest.create({
        data: {
          email: 'member2@company.com',
          name: 'Member 2',
          customerAccountId: account.id,
          status: 'PENDING',
        },
      })

      const pending = await prisma.teamAccessRequest.findMany({
        where: {
          customerAccountId: account.id,
          status: 'PENDING',
        },
      })

      expect(pending).toHaveLength(2)
    })

    it('should approve team access request', async () => {
      const account = await createCustomerAccount(prisma)

      const request = await prisma.teamAccessRequest.create({
        data: {
          email: 'approved@company.com',
          name: 'Approved Member',
          customerAccountId: account.id,
          status: 'PENDING',
        },
      })

      const approved = await prisma.teamAccessRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
        },
      })

      expect(approved.status).toBe('APPROVED')
    })

    it('should reject team access request', async () => {
      const account = await createCustomerAccount(prisma)

      const request = await prisma.teamAccessRequest.create({
        data: {
          email: 'rejected@company.com',
          name: 'Rejected Member',
          customerAccountId: account.id,
          status: 'PENDING',
        },
      })

      const rejected = await prisma.teamAccessRequest.update({
        where: { id: request.id },
        data: {
          status: 'REJECTED',
          reviewedAt: new Date(),
        },
      })

      expect(rejected.status).toBe('REJECTED')
    })
  })

  describe('Customer-Certificate Associations', () => {
    it('should find certificates for a customer company', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const companyName = 'Test Company Ltd'

      await prisma.certificate.create({
        data: {
          certificateNumber: 'HTA/001',
          customerName: companyName,
          status: 'AUTHORIZED',
          createdById: engineer.id,
          lastModifiedById: engineer.id,
        },
      })

      await prisma.certificate.create({
        data: {
          certificateNumber: 'HTA/002',
          customerName: companyName,
          status: 'PENDING_REVIEW',
          createdById: engineer.id,
          lastModifiedById: engineer.id,
        },
      })

      await prisma.certificate.create({
        data: {
          certificateNumber: 'HTA/003',
          customerName: 'Other Company',
          status: 'AUTHORIZED',
          createdById: engineer.id,
          lastModifiedById: engineer.id,
        },
      })

      const customerCerts = await prisma.certificate.findMany({
        where: { customerName: companyName },
      })

      expect(customerCerts).toHaveLength(2)
    })
  })
})
