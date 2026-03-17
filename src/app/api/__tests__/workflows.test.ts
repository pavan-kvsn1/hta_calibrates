import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../certificates/[id]/submit/route'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    certificate: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    user: {
      findUnique: vi.fn(),
    },
    certificateEvent: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    signature: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    reviewFeedback: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/services/notifications', () => ({
  notifyReviewerOnSubmit: vi.fn(),
  notifyReviewerOnAssigneeResponse: vi.fn(),
}))

vi.mock('@/lib/feature-flags', () => ({
  isFeatureEnabled: vi.fn(() => true),
}))

vi.mock('@/lib/stores/signing-evidence', () => ({
  appendSigningEvidence: vi.fn(),
  collectServerEvidence: vi.fn(() => ({})),
  buildSigningEvidencePayload: vi.fn(() => ({})),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function createRequest(url: string, options?: RequestInit): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'), options)
}

describe('Certificate Submit Workflow API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('POST /api/certificates/[id]/submit', () => {
    const mockContext = { params: Promise.resolve({ id: 'cert-1' }) }

    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const request = createRequest('/api/certificates/cert-1/submit', {
        method: 'POST',
        body: JSON.stringify({
          signatureData: 'base64data',
          signerName: 'Engineer Name',
          reviewerId: 'reviewer-1',
        }),
      })
      const response = await POST(request, mockContext)
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 400 when signature is missing', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'engineer-123', name: 'Engineer Name', email: 'eng@test.com', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })

      const request = createRequest('/api/certificates/cert-1/submit', {
        method: 'POST',
        body: JSON.stringify({
          reviewerId: 'reviewer-1',
        }),
      })
      const response = await POST(request, mockContext)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Signature and signer name are required')
    })

    it('should return 400 when signer name does not match profile', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'engineer-123', name: 'John Doe', email: 'eng@test.com', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })

      const request = createRequest('/api/certificates/cert-1/submit', {
        method: 'POST',
        body: JSON.stringify({
          signatureData: 'base64data',
          signerName: 'Wrong Name',
          reviewerId: 'reviewer-1',
        }),
      })
      const response = await POST(request, mockContext)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Signer name must match your profile name')
    })

    it('should return 404 when certificate not found', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'engineer-123', name: 'Engineer Name', email: 'eng@test.com', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue(null)

      const request = createRequest('/api/certificates/cert-1/submit', {
        method: 'POST',
        body: JSON.stringify({
          signatureData: 'base64data',
          signerName: 'Engineer Name',
          reviewerId: 'reviewer-1',
        }),
      })
      const response = await POST(request, mockContext)
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Certificate not found')
    })

    it('should return 400 when reviewer is not selected (new workflow)', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'engineer-123', name: 'Engineer Name', email: 'eng@test.com', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
        id: 'cert-1',
        status: 'DRAFT',
        createdById: 'engineer-123',
        reviewerId: null,
        parameters: [],
        masterInstruments: [],
      })

      const request = createRequest('/api/certificates/cert-1/submit', {
        method: 'POST',
        body: JSON.stringify({
          signatureData: 'base64data',
          signerName: 'Engineer Name',
          // No reviewerId provided
        }),
      })
      const response = await POST(request, mockContext)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Please select a reviewer for the certificate')
    })

    it('should return 400 when trying to self-review', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'engineer-123', name: 'Engineer Name', email: 'eng@test.com', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
        id: 'cert-1',
        status: 'DRAFT',
        createdById: 'engineer-123',
        reviewerId: null,
        parameters: [],
        masterInstruments: [],
      })
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'engineer-123',
        name: 'Engineer Name',
        email: 'eng@test.com',
        role: 'ENGINEER',
        isActive: true,
      })

      const request = createRequest('/api/certificates/cert-1/submit', {
        method: 'POST',
        body: JSON.stringify({
          signatureData: 'base64data',
          signerName: 'Engineer Name',
          reviewerId: 'engineer-123', // Same as current user
        }),
      })
      const response = await POST(request, mockContext)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('You cannot review your own certificate')
    })

    it('should return 403 when user is not the certificate owner', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'engineer-456', name: 'Other Engineer', email: 'other@test.com', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
        id: 'cert-1',
        status: 'DRAFT',
        createdById: 'engineer-123', // Different from logged in user
        reviewerId: null,
        parameters: [],
        masterInstruments: [],
      })
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'reviewer-1',
        name: 'Reviewer',
        email: 'reviewer@test.com',
        role: 'ADMIN',
        isActive: true,
      })

      const request = createRequest('/api/certificates/cert-1/submit', {
        method: 'POST',
        body: JSON.stringify({
          signatureData: 'base64data',
          signerName: 'Other Engineer',
          reviewerId: 'reviewer-1',
        }),
      })
      const response = await POST(request, mockContext)
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Forbidden')
    })

    it('should return 400 when certificate status is invalid for submission', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'engineer-123', name: 'Engineer Name', email: 'eng@test.com', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
        id: 'cert-1',
        status: 'PENDING_REVIEW', // Already submitted
        createdById: 'engineer-123',
        reviewerId: 'reviewer-1',
        parameters: [],
        masterInstruments: [],
      })
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'reviewer-1',
        name: 'Reviewer',
        email: 'reviewer@test.com',
        role: 'ADMIN',
        isActive: true,
      })

      const request = createRequest('/api/certificates/cert-1/submit', {
        method: 'POST',
        body: JSON.stringify({
          signatureData: 'base64data',
          signerName: 'Engineer Name',
          reviewerId: 'reviewer-1',
        }),
      })
      const response = await POST(request, mockContext)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Cannot submit certificate with status')
    })

    it('should return validation errors when required fields are missing', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'engineer-123', name: 'Engineer Name', email: 'eng@test.com', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
        id: 'cert-1',
        status: 'DRAFT',
        createdById: 'engineer-123',
        reviewerId: null,
        dateOfCalibration: null, // Missing
        customerName: null, // Missing
        customerAddress: null, // Missing
        uucDescription: null, // Missing
        uucMake: null,
        uucModel: null,
        uucSerialNumber: null,
        ambientTemperature: null,
        relativeHumidity: null,
        calibrationStatus: null,
        selectedConclusionStatements: null,
        parameters: [],
        masterInstruments: [], // Empty
      })
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        id: 'reviewer-1',
        name: 'Reviewer',
        email: 'reviewer@test.com',
        role: 'ADMIN',
        isActive: true,
      })

      const request = createRequest('/api/certificates/cert-1/submit', {
        method: 'POST',
        body: JSON.stringify({
          signatureData: 'base64data',
          signerName: 'Engineer Name',
          reviewerId: 'reviewer-1',
        }),
      })
      const response = await POST(request, mockContext)
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.validationErrors).toContain('Date of calibration is required')
      expect(data.validationErrors).toContain('Customer name is required')
      expect(data.validationErrors).toContain('At least one master instrument is required')
    })

    it('should handle database errors gracefully', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'engineer-123', name: 'Engineer Name', email: 'eng@test.com', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })
      vi.mocked(prisma.certificate.findUnique).mockRejectedValue(new Error('DB error'))

      const request = createRequest('/api/certificates/cert-1/submit', {
        method: 'POST',
        body: JSON.stringify({
          signatureData: 'base64data',
          signerName: 'Engineer Name',
          reviewerId: 'reviewer-1',
        }),
      })
      const response = await POST(request, mockContext)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })
})
