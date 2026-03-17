import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../certificates/[id]/submit/route'

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

// Mock prisma
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
    reviewFeedback: {
      create: vi.fn(),
    },
    auditLog: {
      create: vi.fn(),
    },
    signature: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// Mock feature flags
vi.mock('@/lib/feature-flags', () => ({
  isFeatureEnabled: vi.fn(() => true),
}))

// Mock signing evidence
vi.mock('@/lib/stores/signing-evidence', () => ({
  appendSigningEvidence: vi.fn(() => Promise.resolve()),
  collectServerEvidence: vi.fn(() => ({ ip: '127.0.0.1', timestamp: new Date().toISOString() })),
  buildSigningEvidencePayload: vi.fn(() => ({})),
}))

// Mock notifications
vi.mock('@/lib/services/notifications', () => ({
  notifyReviewerOnSubmit: vi.fn(() => Promise.resolve()),
  notifyReviewerOnAssigneeResponse: vi.fn(() => Promise.resolve()),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import { isFeatureEnabled } from '@/lib/feature-flags'
import { notifyReviewerOnSubmit, notifyReviewerOnAssigneeResponse } from '@/lib/services/notifications'

function createRequest(body: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/certificates/cert-123/submit', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const mockSession = {
  user: {
    id: 'engineer-123',
    name: 'Jane Engineer',
    email: 'engineer@test.com',
    role: 'ENGINEER',
  },
  expires: new Date().toISOString(),
}

const mockCertificate = {
  id: 'cert-123',
  certificateNumber: 'HTA-001',
  status: 'DRAFT',
  currentRevision: 1,
  createdById: 'engineer-123',
  reviewerId: null,
  dateOfCalibration: new Date('2024-01-01'),
  customerName: 'Test Corp',
  customerAddress: '123 Test St',
  uucDescription: 'Test Equipment',
  uucMake: 'Test Make',
  uucModel: 'Test Model',
  uucSerialNumber: 'SN-001',
  ambientTemperature: '25°C',
  relativeHumidity: '50%',
  calibrationStatus: JSON.stringify(['PASS']),
  selectedConclusionStatements: JSON.stringify(['Equipment calibrated successfully']),
  masterInstruments: [{ id: 'mi-1', name: 'Master Instrument 1' }],
  parameters: [{
    id: 'param-1',
    results: [{
      id: 'result-1',
      standardReading: '100',
      beforeAdjustment: '99.5',
    }],
  }],
}

const mockReviewer = {
  id: 'reviewer-456',
  name: 'John Reviewer',
  email: 'reviewer@test.com',
  role: 'ENGINEER',
  isActive: true,
}

// Helper to create a transaction mock that executes the callback
const createTransactionMock = (returnValue: { cert: any; signature: any }) => {
  return vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
    // Create mock tx object with all needed methods
    const tx = {
      certificateEvent: {
        findFirst: vi.fn().mockResolvedValue({ sequenceNumber: 1 }),
        create: vi.fn().mockResolvedValue({ id: 'event-1' }),
      },
      certificate: {
        update: vi.fn().mockResolvedValue(returnValue.cert),
      },
      reviewFeedback: {
        create: vi.fn().mockResolvedValue({}),
      },
      auditLog: {
        create: vi.fn().mockResolvedValue({}),
      },
      signature: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue(returnValue.signature),
      },
    }
    // Execute the callback to cover the transaction code
    await fn(tx)
    return returnValue
  })
}

describe('POST /api/certificates/[id]/submit', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.certificate.findUnique).mockResolvedValue(mockCertificate as any)
    vi.mocked(prisma.user.findUnique).mockResolvedValue(mockReviewer as any)
    vi.mocked(isFeatureEnabled).mockReturnValue(true)
  })

  describe('authentication', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const request = createRequest({
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'Jane Engineer',
        reviewerId: 'reviewer-456',
      })
      const response = await POST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('signature validation', () => {
    it('returns 400 when signature is missing', async () => {
      const request = createRequest({
        signerName: 'Jane Engineer',
        reviewerId: 'reviewer-456',
      })
      const response = await POST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Signature and signer name are required')
    })

    it('returns 400 when signer name is missing', async () => {
      const request = createRequest({
        signatureData: 'data:image/png;base64,abc123',
        reviewerId: 'reviewer-456',
      })
      const response = await POST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Signature and signer name are required')
    })

    it('returns 400 when signer name does not match profile', async () => {
      const request = createRequest({
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'Wrong Name',
        reviewerId: 'reviewer-456',
      })
      const response = await POST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Signer name must match your profile name')
    })
  })

  describe('certificate validation', () => {
    it('returns 404 when certificate not found', async () => {
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue(null)

      const request = createRequest({
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'Jane Engineer',
        reviewerId: 'reviewer-456',
      })
      const response = await POST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Certificate not found')
    })

    it('returns 403 when user is not the owner', async () => {
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
        ...mockCertificate,
        createdById: 'different-user',
      } as any)

      const request = createRequest({
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'Jane Engineer',
        reviewerId: 'reviewer-456',
      })
      const response = await POST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('Forbidden')
    })

    it('returns 400 when certificate status is not submittable', async () => {
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
        ...mockCertificate,
        status: 'APPROVED',
      } as any)

      const request = createRequest({
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'Jane Engineer',
        reviewerId: 'reviewer-456',
      })
      const response = await POST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Cannot submit certificate with status')
    })
  })

  describe('reviewer validation', () => {
    it('returns 400 when no reviewer selected', async () => {
      const request = createRequest({
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'Jane Engineer',
      })
      const response = await POST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Please select a reviewer for the certificate')
    })

    it('returns 400 when selected reviewer is inactive', async () => {
      vi.mocked(prisma.user.findUnique).mockResolvedValue({
        ...mockReviewer,
        isActive: false,
      } as any)

      const request = createRequest({
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'Jane Engineer',
        reviewerId: 'reviewer-456',
      })
      const response = await POST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Selected reviewer is not available')
    })

    it('returns 400 when trying to review own certificate', async () => {
      const request = createRequest({
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'Jane Engineer',
        reviewerId: 'engineer-123', // Same as session user
      })
      const response = await POST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('You cannot review your own certificate')
    })
  })

  describe('field validation', () => {
    it('returns validation errors for missing required fields', async () => {
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
        ...mockCertificate,
        dateOfCalibration: null,
        customerName: null,
        uucDescription: null,
      } as any)

      const request = createRequest({
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'Jane Engineer',
        reviewerId: 'reviewer-456',
      })
      const response = await POST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Validation failed')
      expect(data.validationErrors).toBeDefined()
      expect(data.validationErrors).toContain('Date of calibration is required')
      expect(data.validationErrors).toContain('Customer name is required')
      expect(data.validationErrors).toContain('UUC description is required')
    })

    it('returns validation error when no master instruments', async () => {
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
        ...mockCertificate,
        masterInstruments: [],
      } as any)

      const request = createRequest({
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'Jane Engineer',
        reviewerId: 'reviewer-456',
      })
      const response = await POST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.validationErrors).toContain('At least one master instrument is required')
    })

    it('returns validation error when no calibration results', async () => {
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
        ...mockCertificate,
        parameters: [{ id: 'param-1', results: [] }],
      } as any)

      const request = createRequest({
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'Jane Engineer',
        reviewerId: 'reviewer-456',
      })
      const response = await POST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.validationErrors).toContain('At least one calibration result is required')
    })
  })

  describe('successful submission', () => {
    it('successfully submits new certificate', async () => {
      const mockSignature = { id: 'sig-123' }
      createTransactionMock({
        cert: { ...mockCertificate, status: 'PENDING_REVIEW' },
        signature: mockSignature,
      })

      const request = createRequest({
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'Jane Engineer',
        reviewerId: 'reviewer-456',
      })
      const response = await POST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('submitted for peer review')
      expect(data.certificate.status).toBe('PENDING_REVIEW')
    })

    it('successfully submits with client evidence', async () => {
      const mockSignature = { id: 'sig-123' }
      createTransactionMock({
        cert: { ...mockCertificate, status: 'PENDING_REVIEW' },
        signature: mockSignature,
      })

      const request = createRequest({
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'Jane Engineer',
        reviewerId: 'reviewer-456',
        clientEvidence: {
          userAgent: 'Mozilla/5.0',
          screenResolution: '1920x1080',
          timezone: 'UTC',
          timestamp: new Date().toISOString(),
        },
      })
      const response = await POST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('successfully resubmits certificate with revision required status', async () => {
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
        ...mockCertificate,
        status: 'REVISION_REQUIRED',
        reviewerId: 'reviewer-456', // Already has reviewer
      } as any)

      const mockSignature = { id: 'sig-123' }
      createTransactionMock({
        cert: { ...mockCertificate, status: 'PENDING_REVIEW', currentRevision: 2 },
        signature: mockSignature,
      })

      const request = createRequest({
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'Jane Engineer',
        engineerNotes: 'Fixed the issues mentioned',
        sectionResponses: {
          summary: 'Updated summary section',
          results: 'Corrected calibration results',
        },
      })
      const response = await POST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('resubmitted for peer review')
    })

    it('allows admin to submit on behalf of engineer', async () => {
      vi.mocked(auth).mockResolvedValue({
        ...mockSession,
        user: { ...mockSession.user, id: 'admin-123', role: 'ADMIN', name: 'Admin User' },
      })

      const mockSignature = { id: 'sig-123' }
      createTransactionMock({
        cert: { ...mockCertificate, status: 'PENDING_REVIEW' },
        signature: mockSignature,
      })

      const request = createRequest({
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'Admin User',
        reviewerId: 'reviewer-456',
      })
      const response = await POST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('handles evidence capture failure gracefully', async () => {
      const mockSignature = { id: 'sig-123' }
      createTransactionMock({
        cert: { ...mockCertificate, status: 'PENDING_REVIEW' },
        signature: mockSignature,
      })

      // Make evidence capture fail
      const { appendSigningEvidence } = await import('@/lib/stores/signing-evidence')
      vi.mocked(appendSigningEvidence).mockRejectedValueOnce(new Error('Evidence capture failed'))

      const request = createRequest({
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'Jane Engineer',
        reviewerId: 'reviewer-456',
        clientEvidence: {
          userAgent: 'Mozilla/5.0',
          screenResolution: '1920x1080',
          timezone: 'UTC',
          timestamp: new Date().toISOString(),
        },
      })
      const response = await POST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      // Should still succeed even if evidence capture fails
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('error handling', () => {
    it('returns 500 on unexpected error', async () => {
      vi.mocked(prisma.certificate.findUnique).mockRejectedValue(new Error('Database error'))

      const request = createRequest({
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'Jane Engineer',
        reviewerId: 'reviewer-456',
      })
      const response = await POST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Internal server error')
    })
  })

  describe('notification failure handling', () => {
    it('handles notification failure gracefully on initial submit', async () => {
      const mockSignature = { id: 'sig-123' }
      createTransactionMock({
        cert: { ...mockCertificate, status: 'PENDING_REVIEW' },
        signature: mockSignature,
      })
      vi.mocked(notifyReviewerOnSubmit).mockRejectedValueOnce(new Error('Notification failed'))

      const request = createRequest({
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'Jane Engineer',
        reviewerId: 'reviewer-456',
      })
      const response = await POST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      // Should still succeed - notification is fire-and-forget
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // Wait for async notification to settle
      await new Promise(resolve => setTimeout(resolve, 50))
    })

    it('handles notification failure gracefully on resubmission', async () => {
      // Set up certificate in REVISION_REQUIRED status (resubmission)
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
        ...mockCertificate,
        status: 'REVISION_REQUIRED',
        reviewerId: 'reviewer-456',
      } as any)

      const mockSignature = { id: 'sig-123' }
      createTransactionMock({
        cert: { ...mockCertificate, status: 'PENDING_REVIEW' },
        signature: mockSignature,
      })
      vi.mocked(notifyReviewerOnAssigneeResponse).mockRejectedValueOnce(new Error('Notification failed'))

      const request = createRequest({
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'Jane Engineer',
        reviewerId: 'reviewer-456',
      })
      const response = await POST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      // Should still succeed - notification is fire-and-forget
      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      // Wait for async notification to settle
      await new Promise(resolve => setTimeout(resolve, 50))
    })
  })
})
