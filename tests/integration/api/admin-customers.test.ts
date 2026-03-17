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

  describe('Customer Requests', () => {
    it('should create a user addition request', async () => {
      const account = await createCustomerAccount(prisma)
      const poc = await createCustomerUser(prisma, account.id, { name: 'POC User' })

      const request = await prisma.customerRequest.create({
        data: {
          type: 'USER_ADDITION',
          status: 'PENDING',
          customerAccountId: account.id,
          requestedById: poc.id,
          data: JSON.stringify({
            email: 'newmember@company.com',
            name: 'New Team Member',
          }),
        },
      })

      expect(request).toBeDefined()
      expect(request.status).toBe('PENDING')
      expect(request.type).toBe('USER_ADDITION')
    })

    it('should list pending customer requests', async () => {
      const account = await createCustomerAccount(prisma)
      const poc = await createCustomerUser(prisma, account.id, { name: 'POC User' })

      await prisma.customerRequest.create({
        data: {
          type: 'USER_ADDITION',
          status: 'PENDING',
          customerAccountId: account.id,
          requestedById: poc.id,
          data: JSON.stringify({ email: 'member1@company.com', name: 'Member 1' }),
        },
      })

      await prisma.customerRequest.create({
        data: {
          type: 'USER_ADDITION',
          status: 'APPROVED',
          customerAccountId: account.id,
          requestedById: poc.id,
          reviewedAt: new Date(),
          data: JSON.stringify({ email: 'member2@company.com', name: 'Member 2' }),
        },
      })

      const pending = await prisma.customerRequest.findMany({
        where: { status: 'PENDING' },
      })

      expect(pending).toHaveLength(1)
    })

    it('should approve customer request', async () => {
      const account = await createCustomerAccount(prisma)
      const poc = await createCustomerUser(prisma, account.id, { name: 'POC User' })

      const request = await prisma.customerRequest.create({
        data: {
          type: 'USER_ADDITION',
          status: 'PENDING',
          customerAccountId: account.id,
          requestedById: poc.id,
          data: JSON.stringify({ email: 'approve@company.com', name: 'To Approve' }),
        },
      })

      const approved = await prisma.customerRequest.update({
        where: { id: request.id },
        data: {
          status: 'APPROVED',
          reviewedAt: new Date(),
        },
      })

      expect(approved.status).toBe('APPROVED')
      expect(approved.reviewedAt).toBeDefined()
    })

    it('should reject customer request', async () => {
      const account = await createCustomerAccount(prisma)
      const poc = await createCustomerUser(prisma, account.id, { name: 'POC User' })

      const request = await prisma.customerRequest.create({
        data: {
          type: 'USER_ADDITION',
          status: 'PENDING',
          customerAccountId: account.id,
          requestedById: poc.id,
          data: JSON.stringify({ email: 'reject@company.com', name: 'To Reject' }),
        },
      })

      const rejected = await prisma.customerRequest.update({
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
