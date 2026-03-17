import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../internal-requests/route'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    certificate: {
      findUnique: vi.fn(),
    },
    internalRequest: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    certificateEvent: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options)
}

describe('Internal Requests API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/internal-requests', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const request = createRequest('/api/internal-requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'SECTION_UNLOCK',
          certificateId: 'cert-1',
          sections: ['calibrationData'],
          reason: 'Need to correct values',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 403 when user is a customer', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'customer-123', role: 'CUSTOMER' },
        expires: new Date().toISOString(),
      })

      const request = createRequest('/api/internal-requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'SECTION_UNLOCK',
          certificateId: 'cert-1',
          sections: ['calibrationData'],
          reason: 'Need to correct values',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Forbidden')
    })

    it('should return 400 for invalid request type', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'engineer-123', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })

      const request = createRequest('/api/internal-requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'INVALID_TYPE',
          certificateId: 'cert-1',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Invalid request type')
    })

    it('should return 400 when required fields are missing', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'engineer-123', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })

      const request = createRequest('/api/internal-requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'SECTION_UNLOCK',
          certificateId: 'cert-1',
          // missing sections and reason
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Missing required fields')
    })

    it('should return 400 when sections is empty array', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'engineer-123', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })

      const request = createRequest('/api/internal-requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'SECTION_UNLOCK',
          certificateId: 'cert-1',
          sections: [],
          reason: 'Need to correct values',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Missing required fields')
    })

    it('should return 404 when certificate not found', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'engineer-123', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue(null)

      const request = createRequest('/api/internal-requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'SECTION_UNLOCK',
          certificateId: 'cert-nonexistent',
          sections: ['calibrationData'],
          reason: 'Need to correct values',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Certificate not found')
    })

    it('should return 400 when certificate is not in REVISION_REQUIRED status', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'engineer-123', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
        id: 'cert-1',
        status: 'DRAFT',
        certificateNumber: 'HTA/CAL/2024/001',
        createdById: 'engineer-123',
        currentRevision: 1,
      })

      const request = createRequest('/api/internal-requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'SECTION_UNLOCK',
          certificateId: 'cert-1',
          sections: ['calibrationData'],
          reason: 'Need to correct values',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('REVISION_REQUIRED status')
    })

    it('should return 403 when user is not the certificate creator', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'engineer-456', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
        id: 'cert-1',
        status: 'REVISION_REQUIRED',
        certificateNumber: 'HTA/CAL/2024/001',
        createdById: 'engineer-123', // Different from logged in user
        currentRevision: 1,
      })

      const request = createRequest('/api/internal-requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'SECTION_UNLOCK',
          certificateId: 'cert-1',
          sections: ['calibrationData'],
          reason: 'Need to correct values',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Only the certificate assignee can request section unlocks')
    })

    it('should allow admin to create request for any certificate', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'admin-123', role: 'ADMIN' },
        expires: new Date().toISOString(),
      })
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
        id: 'cert-1',
        status: 'REVISION_REQUIRED',
        certificateNumber: 'HTA/CAL/2024/001',
        createdById: 'engineer-123',
        currentRevision: 1,
      })
      vi.mocked(prisma.internalRequest.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.internalRequest.create).mockResolvedValue({
        id: 'req-1',
        type: 'SECTION_UNLOCK',
        status: 'PENDING',
        createdAt: new Date(),
        requestedBy: { id: 'admin-123', name: 'Admin', email: 'admin@test.com' },
        certificate: { id: 'cert-1', certificateNumber: 'HTA/CAL/2024/001' },
      })
      vi.mocked(prisma.certificateEvent.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.certificateEvent.create).mockResolvedValue({})

      const request = createRequest('/api/internal-requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'SECTION_UNLOCK',
          certificateId: 'cert-1',
          sections: ['calibrationData'],
          reason: 'Admin override',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('should return 400 when pending request already exists', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'engineer-123', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
        id: 'cert-1',
        status: 'REVISION_REQUIRED',
        certificateNumber: 'HTA/CAL/2024/001',
        createdById: 'engineer-123',
        currentRevision: 1,
      })
      vi.mocked(prisma.internalRequest.findFirst).mockResolvedValue({
        id: 'existing-req',
        type: 'SECTION_UNLOCK',
        status: 'PENDING',
      })

      const request = createRequest('/api/internal-requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'SECTION_UNLOCK',
          certificateId: 'cert-1',
          sections: ['calibrationData'],
          reason: 'Need to correct values',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('pending section unlock request already exists')
    })

    it('should create section unlock request successfully', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'engineer-123', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
        id: 'cert-1',
        status: 'REVISION_REQUIRED',
        certificateNumber: 'HTA/CAL/2024/001',
        createdById: 'engineer-123',
        currentRevision: 2,
      })
      vi.mocked(prisma.internalRequest.findFirst).mockResolvedValue(null)
      vi.mocked(prisma.internalRequest.create).mockResolvedValue({
        id: 'req-1',
        type: 'SECTION_UNLOCK',
        status: 'PENDING',
        createdAt: new Date('2024-01-15'),
        requestedBy: { id: 'engineer-123', name: 'Engineer', email: 'eng@test.com' },
        certificate: { id: 'cert-1', certificateNumber: 'HTA/CAL/2024/001' },
      })
      vi.mocked(prisma.certificateEvent.findFirst).mockResolvedValue({ sequenceNumber: 5 })
      vi.mocked(prisma.certificateEvent.create).mockResolvedValue({})

      const request = createRequest('/api/internal-requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'SECTION_UNLOCK',
          certificateId: 'cert-1',
          sections: ['calibrationData', 'uncertaintyBudget'],
          reason: 'Need to correct calibration values',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.request.id).toBe('req-1')
      expect(data.request.status).toBe('PENDING')
      expect(data.request.data.sections).toEqual(['calibrationData', 'uncertaintyBudget'])
      expect(prisma.certificateEvent.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            eventType: 'SECTION_UNLOCK_REQUESTED',
            sequenceNumber: 6,
            revision: 2,
          }),
        })
      )
    })

    it('should handle database errors gracefully', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'engineer-123', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })
      vi.mocked(prisma.certificate.findUnique).mockRejectedValue(new Error('DB connection error'))

      const request = createRequest('/api/internal-requests', {
        method: 'POST',
        body: JSON.stringify({
          type: 'SECTION_UNLOCK',
          certificateId: 'cert-1',
          sections: ['calibrationData'],
          reason: 'Need to correct values',
        }),
      })
      const response = await POST(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toContain('Failed to create internal request')
    })
  })
})
