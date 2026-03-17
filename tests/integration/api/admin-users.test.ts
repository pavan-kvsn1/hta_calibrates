/**
 * Admin Users API Integration Tests
 *
 * Tests admin user management CRUD operations with real database interactions.
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
  createTestUser,
} from '../setup/fixtures'

describe('Admin Users API Integration', () => {
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

  describe('User CRUD Operations', () => {
    it('should create an admin user', async () => {
      const admin = await createTestUser(prisma, {
        name: 'New Admin',
        role: 'ADMIN',
        isAdmin: true,
      })

      expect(admin).toBeDefined()
      expect(admin.id).toBeDefined()
      expect(admin.role).toBe('ADMIN')
      expect(admin.isAdmin).toBe(true)
    })

    it('should create an engineer user', async () => {
      const { admin } = await createEngineerWithAdmin(prisma)

      const engineer = await createTestUser(prisma, {
        name: 'New Engineer',
        role: 'ENGINEER',
        assignedAdminId: admin.id,
      })

      expect(engineer).toBeDefined()
      expect(engineer.role).toBe('ENGINEER')
      expect(engineer.assignedAdminId).toBe(admin.id)
    })

    it('should list all users', async () => {
      await createEngineerWithAdmin(prisma)
      await createTestUser(prisma, { role: 'ADMIN', isAdmin: true })

      const users = await prisma.user.findMany({
        orderBy: { name: 'asc' },
      })

      expect(users.length).toBeGreaterThanOrEqual(3)
    })

    it('should filter users by role', async () => {
      await createEngineerWithAdmin(prisma)
      await createTestUser(prisma, { role: 'ADMIN', isAdmin: true })

      const admins = await prisma.user.findMany({
        where: { role: 'ADMIN' },
      })

      const engineers = await prisma.user.findMany({
        where: { role: 'ENGINEER' },
      })

      expect(admins.length).toBeGreaterThanOrEqual(2)
      expect(engineers.length).toBeGreaterThanOrEqual(1)
    })

    it('should filter users by active status', async () => {
      const { admin } = await createEngineerWithAdmin(prisma)

      // Deactivate the admin
      await prisma.user.update({
        where: { id: admin.id },
        data: { isActive: false },
      })

      const activeUsers = await prisma.user.findMany({
        where: { isActive: true },
      })

      const inactiveUsers = await prisma.user.findMany({
        where: { isActive: false },
      })

      expect(activeUsers.length).toBeGreaterThanOrEqual(1)
      expect(inactiveUsers.length).toBeGreaterThanOrEqual(1)
    })

    it('should search users by name', async () => {
      await createTestUser(prisma, { name: 'John Smith', role: 'ENGINEER' })
      await createTestUser(prisma, { name: 'Jane Doe', role: 'ENGINEER' })

      const results = await prisma.user.findMany({
        where: {
          name: { contains: 'John' },
        },
      })

      expect(results).toHaveLength(1)
      expect(results[0].name).toBe('John Smith')
    })

    it('should search users by email', async () => {
      const user = await createTestUser(prisma, {
        email: 'specific-email@test.com',
        role: 'ENGINEER',
      })

      const results = await prisma.user.findMany({
        where: {
          email: { contains: 'specific-email' },
        },
      })

      expect(results).toHaveLength(1)
      expect(results[0].id).toBe(user.id)
    })

    it('should update user details', async () => {
      const user = await createTestUser(prisma, {
        name: 'Original Name',
        role: 'ENGINEER',
      })

      const updated = await prisma.user.update({
        where: { id: user.id },
        data: { name: 'Updated Name' },
      })

      expect(updated.name).toBe('Updated Name')
    })

    it('should deactivate a user', async () => {
      const user = await createTestUser(prisma, { role: 'ENGINEER' })

      expect(user.isActive).toBe(true)

      const deactivated = await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false },
      })

      expect(deactivated.isActive).toBe(false)
    })

    it('should reactivate a user', async () => {
      const user = await createTestUser(prisma, { role: 'ENGINEER' })

      // Deactivate first
      await prisma.user.update({
        where: { id: user.id },
        data: { isActive: false },
      })

      // Reactivate
      const reactivated = await prisma.user.update({
        where: { id: user.id },
        data: { isActive: true },
      })

      expect(reactivated.isActive).toBe(true)
    })
  })

  describe('User Relationships', () => {
    it('should include assigned admin for engineers', async () => {
      const { engineer, admin } = await createEngineerWithAdmin(prisma)

      const userWithAdmin = await prisma.user.findUnique({
        where: { id: engineer.id },
        include: {
          assignedAdmin: {
            select: { id: true, name: true, email: true },
          },
        },
      })

      expect(userWithAdmin?.assignedAdmin).toBeDefined()
      expect(userWithAdmin?.assignedAdmin?.id).toBe(admin.id)
    })

    it('should count certificates created by user', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)

      // Create some certificates
      await prisma.certificate.create({
        data: {
          certificateNumber: 'HTA/CAL/001',
          status: 'DRAFT',
          createdById: engineer.id,
          lastModifiedById: engineer.id,
        },
      })

      await prisma.certificate.create({
        data: {
          certificateNumber: 'HTA/CAL/002',
          status: 'DRAFT',
          createdById: engineer.id,
          lastModifiedById: engineer.id,
        },
      })

      const userWithCount = await prisma.user.findUnique({
        where: { id: engineer.id },
        include: {
          _count: {
            select: { createdCertificates: true },
          },
        },
      })

      expect(userWithCount?._count.createdCertificates).toBe(2)
    })

    it('should list engineers assigned to an admin', async () => {
      const admin = await createTestUser(prisma, { role: 'ADMIN', isAdmin: true })

      await createTestUser(prisma, { role: 'ENGINEER', assignedAdminId: admin.id })
      await createTestUser(prisma, { role: 'ENGINEER', assignedAdminId: admin.id })
      await createTestUser(prisma, { role: 'ENGINEER', assignedAdminId: admin.id })

      const assignedEngineers = await prisma.user.findMany({
        where: {
          role: 'ENGINEER',
          assignedAdminId: admin.id,
        },
      })

      expect(assignedEngineers).toHaveLength(3)
    })
  })

  describe('User Pagination', () => {
    it('should paginate user list', async () => {
      // Create multiple users
      for (let i = 0; i < 5; i++) {
        await createTestUser(prisma, {
          name: `User ${i + 1}`,
          role: 'ENGINEER',
        })
      }

      const page1 = await prisma.user.findMany({
        orderBy: { name: 'asc' },
        take: 2,
        skip: 0,
      })

      const page2 = await prisma.user.findMany({
        orderBy: { name: 'asc' },
        take: 2,
        skip: 2,
      })

      expect(page1).toHaveLength(2)
      expect(page2).toHaveLength(2)
      expect(page1[0].id).not.toBe(page2[0].id)
    })

    it('should return total count for pagination', async () => {
      for (let i = 0; i < 5; i++) {
        await createTestUser(prisma, { role: 'ENGINEER' })
      }

      const total = await prisma.user.count()

      expect(total).toBeGreaterThanOrEqual(5)
    })
  })

  describe('Admin Type Handling', () => {
    it('should create master admin', async () => {
      const masterAdmin = await prisma.user.create({
        data: {
          email: 'master@test.com',
          name: 'Master Admin',
          role: 'ADMIN',
          isAdmin: true,
          adminType: 'MASTER',
          passwordHash: 'hash',
        },
      })

      expect(masterAdmin.adminType).toBe('MASTER')
    })

    it('should create worker admin', async () => {
      const workerAdmin = await prisma.user.create({
        data: {
          email: 'worker@test.com',
          name: 'Worker Admin',
          role: 'ADMIN',
          isAdmin: true,
          adminType: 'WORKER',
          passwordHash: 'hash',
        },
      })

      expect(workerAdmin.adminType).toBe('WORKER')
    })

    it('should list admins by type', async () => {
      await prisma.user.create({
        data: {
          email: 'master1@test.com',
          name: 'Master 1',
          role: 'ADMIN',
          isAdmin: true,
          adminType: 'MASTER',
          passwordHash: 'hash',
        },
      })

      await prisma.user.create({
        data: {
          email: 'worker1@test.com',
          name: 'Worker 1',
          role: 'ADMIN',
          isAdmin: true,
          adminType: 'WORKER',
          passwordHash: 'hash',
        },
      })

      const masterAdmins = await prisma.user.findMany({
        where: { adminType: 'MASTER' },
      })

      const workerAdmins = await prisma.user.findMany({
        where: { adminType: 'WORKER' },
      })

      expect(masterAdmins.length).toBeGreaterThanOrEqual(1)
      expect(workerAdmins.length).toBeGreaterThanOrEqual(1)
    })
  })

  describe('Unique Constraints', () => {
    it('should enforce unique email', async () => {
      await createTestUser(prisma, { email: 'unique@test.com' })

      await expect(
        createTestUser(prisma, { email: 'unique@test.com' })
      ).rejects.toThrow()
    })
  })
})
