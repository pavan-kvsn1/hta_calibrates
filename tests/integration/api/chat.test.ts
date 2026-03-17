/**
 * Chat API Integration Tests
 *
 * Tests chat and messaging functionality with real database interactions.
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
  createCustomerAccount,
  createCustomerUser,
} from '../setup/fixtures'

describe('Chat API Integration', () => {
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

  describe('Chat Thread Operations', () => {
    it('should create an ASSIGNEE_REVIEWER chat thread', async () => {
      const { engineer, admin } = await createEngineerWithAdmin(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)

      const thread = await prisma.chatThread.create({
        data: {
          certificateId: certificate.id,
          threadType: 'ASSIGNEE_REVIEWER',
        },
      })

      expect(thread).toBeDefined()
      expect(thread.certificateId).toBe(certificate.id)
      expect(thread.threadType).toBe('ASSIGNEE_REVIEWER')
    })

    it('should create a REVIEWER_CUSTOMER chat thread', async () => {
      const { engineer, admin } = await createEngineerWithAdmin(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)
      const customerAccount = await createCustomerAccount(prisma, {
        assignedAdminId: admin.id,
      })

      const thread = await prisma.chatThread.create({
        data: {
          certificateId: certificate.id,
          threadType: 'REVIEWER_CUSTOMER',
        },
      })

      expect(thread).toBeDefined()
      expect(thread.threadType).toBe('REVIEWER_CUSTOMER')
    })

    it('should retrieve a thread with its messages', async () => {
      const { engineer, admin } = await createEngineerWithAdmin(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)

      const thread = await prisma.chatThread.create({
        data: {
          certificateId: certificate.id,
          threadType: 'ASSIGNEE_REVIEWER',
        },
      })

      // Add messages to the thread
      await prisma.chatMessage.create({
        data: {
          threadId: thread.id,
          senderId: engineer.id,
          senderType: 'ENGINEER',
          content: 'First message from engineer',
        },
      })

      await prisma.chatMessage.create({
        data: {
          threadId: thread.id,
          senderId: admin.id,
          senderType: 'ADMIN',
          content: 'Response from admin',
        },
      })

      const threadWithMessages = await prisma.chatThread.findUnique({
        where: { id: thread.id },
        include: { messages: true },
      })

      expect(threadWithMessages?.messages).toHaveLength(2)
    })
  })

  describe('Chat Message Operations', () => {
    it('should create a message in a thread', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)

      const thread = await prisma.chatThread.create({
        data: {
          certificateId: certificate.id,
          threadType: 'ASSIGNEE_REVIEWER',
        },
      })

      const message = await prisma.chatMessage.create({
        data: {
          threadId: thread.id,
          senderId: engineer.id,
          senderType: 'ENGINEER',
          content: 'Test message content',
        },
      })

      expect(message).toBeDefined()
      expect(message.content).toBe('Test message content')
      expect(message.senderType).toBe('ENGINEER')
    })

    it('should track read status for messages', async () => {
      const { engineer, admin } = await createEngineerWithAdmin(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)

      const thread = await prisma.chatThread.create({
        data: {
          certificateId: certificate.id,
          threadType: 'ASSIGNEE_REVIEWER',
        },
      })

      const message = await prisma.chatMessage.create({
        data: {
          threadId: thread.id,
          senderId: engineer.id,
          senderType: 'ENGINEER',
          content: 'Message to track',
        },
      })

      // Initially unread
      expect(message.readAt).toBeNull()

      // Mark as read
      const updatedMessage = await prisma.chatMessage.update({
        where: { id: message.id },
        data: { readAt: new Date() },
      })

      expect(updatedMessage.readAt).not.toBeNull()
    })

    it('should order messages by creation time', async () => {
      const { engineer, admin } = await createEngineerWithAdmin(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)

      const thread = await prisma.chatThread.create({
        data: {
          certificateId: certificate.id,
          threadType: 'ASSIGNEE_REVIEWER',
        },
      })

      const message1 = await prisma.chatMessage.create({
        data: {
          threadId: thread.id,
          senderId: engineer.id,
          senderType: 'ENGINEER',
          content: 'First message',
        },
      })

      await new Promise((r) => setTimeout(r, 10))

      const message2 = await prisma.chatMessage.create({
        data: {
          threadId: thread.id,
          senderId: admin.id,
          senderType: 'ADMIN',
          content: 'Second message',
        },
      })

      const messages = await prisma.chatMessage.findMany({
        where: { threadId: thread.id },
        orderBy: { createdAt: 'asc' },
      })

      expect(messages[0].id).toBe(message1.id)
      expect(messages[1].id).toBe(message2.id)
    })
  })

  describe('Thread Uniqueness', () => {
    it('should enforce unique threads per certificate and type', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)

      // Create first thread
      await prisma.chatThread.create({
        data: {
          certificateId: certificate.id,
          threadType: 'ASSIGNEE_REVIEWER',
        },
      })

      // Attempt to create duplicate - should fail
      await expect(
        prisma.chatThread.create({
          data: {
            certificateId: certificate.id,
            threadType: 'ASSIGNEE_REVIEWER',
          },
        })
      ).rejects.toThrow()
    })

    it('should allow different thread types for same certificate', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)

      const thread1 = await prisma.chatThread.create({
        data: {
          certificateId: certificate.id,
          threadType: 'ASSIGNEE_REVIEWER',
        },
      })

      const thread2 = await prisma.chatThread.create({
        data: {
          certificateId: certificate.id,
          threadType: 'REVIEWER_CUSTOMER',
        },
      })

      expect(thread1.id).not.toBe(thread2.id)
    })
  })

  describe('Message Deletion', () => {
    it('should cascade delete messages when thread is deleted', async () => {
      const { engineer } = await createEngineerWithAdmin(prisma)
      const certificate = await createTestCertificate(prisma, engineer.id)

      const thread = await prisma.chatThread.create({
        data: {
          certificateId: certificate.id,
          threadType: 'ASSIGNEE_REVIEWER',
        },
      })

      const message = await prisma.chatMessage.create({
        data: {
          threadId: thread.id,
          senderId: engineer.id,
          senderType: 'ENGINEER',
          content: 'Test message',
        },
      })

      // Delete the thread
      await prisma.chatThread.delete({
        where: { id: thread.id },
      })

      // Verify message is also deleted
      const deletedMessage = await prisma.chatMessage.findUnique({
        where: { id: message.id },
      })

      expect(deletedMessage).toBeNull()
    })
  })
})
