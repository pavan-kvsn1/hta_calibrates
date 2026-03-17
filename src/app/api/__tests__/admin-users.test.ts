import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET, POST } from '../admin/users/route'

// Mock dependencies
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  canAccessAdmin: vi.fn(),
  hashPassword: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: {
      findMany: vi.fn(),
      findUnique: vi.fn(),
      findFirst: vi.fn(),
      count: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { auth, canAccessAdmin, hashPassword } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options)
}

describe('Admin Users API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/admin/users', () => {
    it('should return 403 when user is not admin', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })
      vi.mocked(canAccessAdmin).mockReturnValue(false)

      const request = createRequest('/api/admin/users')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Forbidden')
    })

    it('should return paginated users list', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-123', role: 'ADMIN' },
        expires: new Date().toISOString(),
      })
      vi.mocked(canAccessAdmin).mockReturnValue(true)

      const mockUsers = [
        {
          id: 'user-1',
          email: 'engineer@test.com',
          name: 'Test Engineer',
          role: 'ENGINEER',
          isActive: true,
          authProvider: 'PASSWORD',
          assignedAdmin: { id: 'admin-1', name: 'Admin', email: 'admin@test.com' },
          _count: { createdCertificates: 5 },
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
        },
      ]

      vi.mocked(prisma.user.findMany).mockResolvedValue(mockUsers)
      vi.mocked(prisma.user.count).mockResolvedValue(1)

      const request = createRequest('/api/admin/users?page=1&limit=20')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.users).toHaveLength(1)
      expect(data.users[0].email).toBe('engineer@test.com')
      expect(data.users[0].certificateCount).toBe(5)
      expect(data.pagination.total).toBe(1)
    })

    it('should filter users by role', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-123', role: 'ADMIN' },
        expires: new Date().toISOString(),
      })
      vi.mocked(canAccessAdmin).mockReturnValue(true)
      vi.mocked(prisma.user.findMany).mockResolvedValue([])
      vi.mocked(prisma.user.count).mockResolvedValue(0)

      const request = createRequest('/api/admin/users?role=ENGINEER')
      await GET(request)

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ role: 'ENGINEER' }),
        })
      )
    })

    it('should filter users by active status', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-123', role: 'ADMIN' },
        expires: new Date().toISOString(),
      })
      vi.mocked(canAccessAdmin).mockReturnValue(true)
      vi.mocked(prisma.user.findMany).mockResolvedValue([])
      vi.mocked(prisma.user.count).mockResolvedValue(0)

      const request = createRequest('/api/admin/users?isActive=true')
      await GET(request)

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        })
      )
    })

    it('should search users by name or email', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-123', role: 'ADMIN' },
        expires: new Date().toISOString(),
      })
      vi.mocked(canAccessAdmin).mockReturnValue(true)
      vi.mocked(prisma.user.findMany).mockResolvedValue([])
      vi.mocked(prisma.user.count).mockResolvedValue(0)

      const request = createRequest('/api/admin/users?search=john')
      await GET(request)

      expect(prisma.user.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { name: { contains: 'john' } },
              { email: { contains: 'john' } },
            ],
          }),
        })
      )
    })

    it('should handle database errors gracefully', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-123', role: 'ADMIN' },
        expires: new Date().toISOString(),
      })
      vi.mocked(canAccessAdmin).mockReturnValue(true)
      vi.mocked(prisma.user.findMany).mockRejectedValue(new Error('DB error'))

      const request = createRequest('/api/admin/users')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch users')
    })
  })

  describe('POST /api/admin/users', () => {
    it('should return 403 when user is not admin', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })
      vi.mocked(canAccessAdmin).mockReturnValue(false)

      const request = createRequest('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@test.com', name: 'Test', password: 'Password123', role: 'ENGINEER' }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Forbidden')
    })

    it('should return 400 when required fields are missing', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-123', role: 'ADMIN' },
        expires: new Date().toISOString(),
      })
      vi.mocked(canAccessAdmin).mockReturnValue(true)

      const request = createRequest('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({ email: 'test@test.com' }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Email, name, password, and role are required')
    })

    it('should return 400 for invalid role', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-123', role: 'ADMIN' },
        expires: new Date().toISOString(),
      })
      vi.mocked(canAccessAdmin).mockReturnValue(true)

      const request = createRequest('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@test.com',
          name: 'Test',
          password: 'Password123',
          role: 'INVALID_ROLE',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid role. Must be ENGINEER or ADMIN')
    })

    it('should return 400 when password is too short', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-123', role: 'ADMIN' },
        expires: new Date().toISOString(),
      })
      vi.mocked(canAccessAdmin).mockReturnValue(true)

      const request = createRequest('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@test.com',
          name: 'Test',
          password: 'short',
          role: 'ENGINEER',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Password must be at least 8 characters')
    })

    it('should return 400 when password has no number', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-123', role: 'ADMIN' },
        expires: new Date().toISOString(),
      })
      vi.mocked(canAccessAdmin).mockReturnValue(true)

      const request = createRequest('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@test.com',
          name: 'Test',
          password: 'PasswordNoNumber',
          role: 'ENGINEER',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Password must contain at least one number')
    })

    it('should return 400 when email already exists', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-123', role: 'ADMIN' },
        expires: new Date().toISOString(),
      })
      vi.mocked(canAccessAdmin).mockReturnValue(true)
      vi.mocked(prisma.user.findUnique).mockResolvedValue({ id: 'existing-user' })

      const request = createRequest('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'existing@test.com',
          name: 'Test',
          password: 'Password123',
          role: 'ADMIN',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('A user with this email already exists')
    })

    it('should return 400 when engineer has no assigned admin', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-123', role: 'ADMIN' },
        expires: new Date().toISOString(),
      })
      vi.mocked(canAccessAdmin).mockReturnValue(true)
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)

      const request = createRequest('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'engineer@test.com',
          name: 'Engineer',
          password: 'Password123',
          role: 'ENGINEER',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Engineers must be assigned to an Admin')
    })

    it('should return 400 when assigned admin is invalid', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-123', role: 'ADMIN' },
        expires: new Date().toISOString(),
      })
      vi.mocked(canAccessAdmin).mockReturnValue(true)
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.user.findFirst).mockResolvedValue(null)

      const request = createRequest('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'engineer@test.com',
          name: 'Engineer',
          password: 'Password123',
          role: 'ENGINEER',
          assignedAdminId: 'invalid-admin-id',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid Admin selected')
    })

    it('should create engineer successfully', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-123', role: 'ADMIN' },
        expires: new Date().toISOString(),
      })
      vi.mocked(canAccessAdmin).mockReturnValue(true)
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      vi.mocked(prisma.user.findFirst).mockResolvedValue({ id: 'admin-1', role: 'ADMIN', isActive: true })
      vi.mocked(hashPassword).mockResolvedValue('hashed-password')
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'new-user-id',
        email: 'engineer@test.com',
        name: 'New Engineer',
        role: 'ENGINEER',
        adminType: null,
        assignedAdmin: { id: 'admin-1', name: 'Admin' },
      })

      const request = createRequest('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'engineer@test.com',
          name: 'New Engineer',
          password: 'Password123',
          role: 'ENGINEER',
          assignedAdminId: 'admin-1',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.user.email).toBe('engineer@test.com')
      expect(data.user.role).toBe('ENGINEER')
    })

    it('should create admin successfully', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-123', role: 'ADMIN' },
        expires: new Date().toISOString(),
      })
      vi.mocked(canAccessAdmin).mockReturnValue(true)
      vi.mocked(prisma.user.findUnique).mockResolvedValue(null)
      vi.mocked(hashPassword).mockResolvedValue('hashed-password')
      vi.mocked(prisma.user.create).mockResolvedValue({
        id: 'new-admin-id',
        email: 'newadmin@test.com',
        name: 'New Admin',
        role: 'ADMIN',
        adminType: 'WORKER',
        assignedAdmin: null,
      })

      const request = createRequest('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'newadmin@test.com',
          name: 'New Admin',
          password: 'Password123',
          role: 'ADMIN',
          adminType: 'WORKER',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.user.role).toBe('ADMIN')
      expect(data.user.adminType).toBe('WORKER')
    })

    it('should handle database errors gracefully', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-123', role: 'ADMIN' },
        expires: new Date().toISOString(),
      })
      vi.mocked(canAccessAdmin).mockReturnValue(true)
      vi.mocked(prisma.user.findUnique).mockRejectedValue(new Error('DB error'))

      const request = createRequest('/api/admin/users', {
        method: 'POST',
        body: JSON.stringify({
          email: 'test@test.com',
          name: 'Test',
          password: 'Password123',
          role: 'ADMIN',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to create user')
    })
  })
})
