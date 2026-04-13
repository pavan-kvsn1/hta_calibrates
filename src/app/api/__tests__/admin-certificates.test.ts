import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../admin/certificates/route'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  canAccessAdmin: vi.fn(),
}))

// Mock cache to bypass caching
vi.mock('@/lib/cache', () => ({
  cached: vi.fn(async (_key: string, fn: () => Promise<unknown>) => fn()),
  CacheKeys: {
    certificateStats: () => 'stats:certificates',
  },
  CacheTTL: {
    VERY_SHORT: 30,
  },
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    certificate: {
      findMany: vi.fn(),
      count: vi.fn(),
    },
  },
}))

import { auth, canAccessAdmin } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'))
}

describe('Admin Certificates API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/admin/certificates', () => {
    it('should return 403 when user is not admin', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })
      vi.mocked(canAccessAdmin).mockReturnValue(false)

      const request = createRequest('/api/admin/certificates')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Forbidden')
    })

    it('should return paginated certificates with stats', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-123', role: 'ADMIN' },
        expires: new Date().toISOString(),
      })
      vi.mocked(canAccessAdmin).mockReturnValue(true)

      const mockCertificates = [
        {
          id: 'cert-1',
          certificateNumber: 'HTA/CAL/2024/001',
          status: 'DRAFT',
          customerName: 'Test Customer',
          uucDescription: 'Test Device',
          uucMake: 'Make',
          uucModel: 'Model',
          dateOfCalibration: new Date('2024-01-15'),
          calibrationDueDate: new Date('2025-01-15'),
          currentRevision: 1,
          createdAt: new Date('2024-01-01'),
          updatedAt: new Date('2024-01-01'),
          createdBy: {
            id: 'eng-1',
            name: 'Engineer',
            email: 'eng@test.com',
            assignedAdmin: { id: 'admin-1', name: 'Admin', email: 'admin@test.com' },
          },
          lastModifiedBy: { id: 'eng-1', name: 'Engineer' },
        },
      ]

      vi.mocked(prisma.certificate.findMany).mockResolvedValue(mockCertificates)
      // Mock count calls for stats (total + 8 status counts + main count)
      vi.mocked(prisma.certificate.count)
        .mockResolvedValueOnce(1) // main count
        .mockResolvedValueOnce(10) // total
        .mockResolvedValueOnce(2) // draft
        .mockResolvedValueOnce(3) // pending review
        .mockResolvedValueOnce(1) // revision required
        .mockResolvedValueOnce(2) // pending customer
        .mockResolvedValueOnce(0) // customer revision
        .mockResolvedValueOnce(1) // pending admin
        .mockResolvedValueOnce(1) // authorized
        .mockResolvedValueOnce(0) // rejected

      const request = createRequest('/api/admin/certificates?page=1&limit=20')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.certificates).toHaveLength(1)
      expect(data.certificates[0].certificateNumber).toBe('HTA/CAL/2024/001')
      expect(data.pagination.total).toBe(1)
      expect(data.stats).toBeDefined()
    })

    it('should filter certificates by status', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-123', role: 'ADMIN' },
        expires: new Date().toISOString(),
      })
      vi.mocked(canAccessAdmin).mockReturnValue(true)
      vi.mocked(prisma.certificate.findMany).mockResolvedValue([])
      vi.mocked(prisma.certificate.count).mockResolvedValue(0)

      const request = createRequest('/api/admin/certificates?status=PENDING_REVIEW')
      await GET(request)

      expect(prisma.certificate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ status: 'PENDING_REVIEW' }),
        })
      )
    })

    it('should search certificates by multiple fields', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-123', role: 'ADMIN' },
        expires: new Date().toISOString(),
      })
      vi.mocked(canAccessAdmin).mockReturnValue(true)
      vi.mocked(prisma.certificate.findMany).mockResolvedValue([])
      vi.mocked(prisma.certificate.count).mockResolvedValue(0)

      const request = createRequest('/api/admin/certificates?search=multimeter')
      await GET(request)

      expect(prisma.certificate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({
            OR: [
              { certificateNumber: { contains: 'multimeter' } },
              { customerName: { contains: 'multimeter' } },
              { uucDescription: { contains: 'multimeter' } },
              { uucMake: { contains: 'multimeter' } },
              { uucModel: { contains: 'multimeter' } },
            ],
          }),
        })
      )
    })

    it('should handle pagination correctly', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-123', role: 'ADMIN' },
        expires: new Date().toISOString(),
      })
      vi.mocked(canAccessAdmin).mockReturnValue(true)
      vi.mocked(prisma.certificate.findMany).mockResolvedValue([])
      vi.mocked(prisma.certificate.count).mockResolvedValue(50)

      const request = createRequest('/api/admin/certificates?page=3&limit=10')
      await GET(request)

      expect(prisma.certificate.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          skip: 20, // (3-1) * 10
          take: 10,
        })
      )
    })

    it('should handle database errors gracefully', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-123', role: 'ADMIN' },
        expires: new Date().toISOString(),
      })
      vi.mocked(canAccessAdmin).mockReturnValue(true)
      vi.mocked(prisma.certificate.findMany).mockRejectedValue(new Error('DB error'))

      const request = createRequest('/api/admin/certificates')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch certificates')
    })
  })
})
