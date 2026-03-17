import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '../chat/threads/route'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/services/chat', () => ({
  getThreadsForUser: vi.fn(),
  getOrCreateThread: vi.fn(),
  getUnreadCountsByThread: vi.fn(),
}))

import { auth } from '@/lib/auth'
import { getThreadsForUser, getOrCreateThread, getUnreadCountsByThread } from '@/lib/services/chat'

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options)
}

describe('Chat Threads API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/chat/threads', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const request = createRequest('/api/chat/threads')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return threads with unread counts', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })

      const mockThreads = [
        {
          id: 'thread-1',
          certificateId: 'cert-1',
          threadType: 'ASSIGNEE_REVIEWER',
          createdAt: new Date('2024-01-15'),
        },
        {
          id: 'thread-2',
          certificateId: 'cert-2',
          threadType: 'REVIEWER_CUSTOMER',
          createdAt: new Date('2024-01-16'),
        },
      ]

      const mockUnreadCounts = {
        'thread-1': 3,
        'thread-2': 0,
      }

      vi.mocked(getThreadsForUser).mockResolvedValue(mockThreads)
      vi.mocked(getUnreadCountsByThread).mockResolvedValue(mockUnreadCounts)

      const request = createRequest('/api/chat/threads')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.threads).toHaveLength(2)
      expect(data.threads[0].unreadCount).toBe(3)
      expect(data.threads[1].unreadCount).toBe(0)
    })

    it('should handle empty threads list', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })

      vi.mocked(getThreadsForUser).mockResolvedValue([])
      vi.mocked(getUnreadCountsByThread).mockResolvedValue({})

      const request = createRequest('/api/chat/threads')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.threads).toEqual([])
    })

    it('should handle service errors gracefully', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })

      vi.mocked(getThreadsForUser).mockRejectedValue(new Error('Service error'))

      const request = createRequest('/api/chat/threads')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to get threads')
    })
  })

  describe('POST /api/chat/threads', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const request = createRequest('/api/chat/threads', {
        method: 'POST',
        body: JSON.stringify({ certificateId: 'cert-1', threadType: 'ASSIGNEE_REVIEWER' }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 400 when certificateId is missing', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })

      const request = createRequest('/api/chat/threads', {
        method: 'POST',
        body: JSON.stringify({ threadType: 'ASSIGNEE_REVIEWER' }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('certificateId and threadType are required')
    })

    it('should return 400 when threadType is missing', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })

      const request = createRequest('/api/chat/threads', {
        method: 'POST',
        body: JSON.stringify({ certificateId: 'cert-1' }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('certificateId and threadType are required')
    })

    it('should return 400 for invalid threadType', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })

      const request = createRequest('/api/chat/threads', {
        method: 'POST',
        body: JSON.stringify({ certificateId: 'cert-1', threadType: 'INVALID_TYPE' }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid threadType')
    })

    it('should create thread for ASSIGNEE_REVIEWER type', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })

      const mockThread = {
        id: 'thread-new',
        certificateId: 'cert-1',
        threadType: 'ASSIGNEE_REVIEWER',
        createdAt: new Date(),
      }

      vi.mocked(getOrCreateThread).mockResolvedValue(mockThread)

      const request = createRequest('/api/chat/threads', {
        method: 'POST',
        body: JSON.stringify({ certificateId: 'cert-1', threadType: 'ASSIGNEE_REVIEWER' }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.thread.id).toBe('thread-new')
      expect(getOrCreateThread).toHaveBeenCalledWith({
        certificateId: 'cert-1',
        threadType: 'ASSIGNEE_REVIEWER',
      })
    })

    it('should create thread for REVIEWER_CUSTOMER type', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', role: 'ADMIN' },
        expires: new Date().toISOString(),
      })

      const mockThread = {
        id: 'thread-new',
        certificateId: 'cert-1',
        threadType: 'REVIEWER_CUSTOMER',
        createdAt: new Date(),
      }

      vi.mocked(getOrCreateThread).mockResolvedValue(mockThread)

      const request = createRequest('/api/chat/threads', {
        method: 'POST',
        body: JSON.stringify({ certificateId: 'cert-1', threadType: 'REVIEWER_CUSTOMER' }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.thread.threadType).toBe('REVIEWER_CUSTOMER')
    })

    it('should handle service errors gracefully', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })

      vi.mocked(getOrCreateThread).mockRejectedValue(new Error('Service error'))

      const request = createRequest('/api/chat/threads', {
        method: 'POST',
        body: JSON.stringify({ certificateId: 'cert-1', threadType: 'ASSIGNEE_REVIEWER' }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to create thread')
    })
  })
})
