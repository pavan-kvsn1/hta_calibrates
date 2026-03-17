import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST as reviewPOST } from '../certificates/[id]/review/route'

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
    certificateEvent: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    reviewFeedback: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    signature: {
      deleteMany: vi.fn(),
      create: vi.fn(),
    },
    customerUser: {
      findUnique: vi.fn(),
      create: vi.fn(),
    },
    approvalToken: {
      create: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

// Mock signing evidence
vi.mock('@/lib/stores/signing-evidence', () => ({
  appendSigningEvidence: vi.fn(),
  collectServerEvidence: vi.fn(() => ({ ip: '127.0.0.1', timestamp: new Date().toISOString() })),
  buildSigningEvidencePayload: vi.fn(() => ({})),
}))

// Mock notifications
vi.mock('@/lib/services/notifications', () => ({
  notifyAssigneeOnReview: vi.fn(() => Promise.resolve()),
  notifyOnSentToCustomer: vi.fn(() => Promise.resolve()),
}))

// Mock OpenSign
vi.mock('@/lib/services/opensign', () => ({
  isOpenSignHealthy: vi.fn(() => false),
  selfSignDocument: vi.fn(),
  getSignatureWidgets: vi.fn(),
  withRetry: vi.fn(),
}))

// Mock PDF generator
vi.mock('@/lib/services/pdf/generator', () => ({
  generateSignedPDF: vi.fn(),
  getPageCountFromBuffer: vi.fn(() => 1),
}))

// Mock queue - the route uses dynamic import so we need to return enqueue that returns a Promise
vi.mock('@/lib/services/queue', () => ({
  enqueue: vi.fn(() => Promise.resolve()),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function createRequest(body: object): NextRequest {
  return new NextRequest('http://localhost:3000/api/certificates/cert-123/review', {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const mockSession = {
  user: {
    id: 'reviewer-123',
    name: 'John Reviewer',
    email: 'reviewer@test.com',
    role: 'ENGINEER',
  },
  expires: new Date().toISOString(),
}

const mockCertificate = {
  id: 'cert-123',
  certificateNumber: 'HTA-001',
  status: 'PENDING_REVIEW',
  currentRevision: 1,
  reviewerId: 'reviewer-123',
  createdById: 'engineer-456',
  createdBy: { id: 'engineer-456', name: 'Jane Engineer', email: 'engineer@test.com' },
  customerName: 'Test Corp',
  dateOfCalibration: new Date('2024-01-01'),
  calibrationDueDate: new Date('2025-01-01'),
}

describe('POST /api/certificates/[id]/review', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockSession)
    vi.mocked(prisma.certificate.findUnique).mockResolvedValue(mockCertificate as any)
  })

  describe('authentication', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const request = createRequest({ action: 'approve' })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('certificate validation', () => {
    it('returns 404 when certificate not found', async () => {
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue(null)

      const request = createRequest({ action: 'approve' })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Certificate not found')
    })

    it('returns 400 when no reviewer assigned', async () => {
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
        ...mockCertificate,
        reviewerId: null,
      } as any)

      const request = createRequest({ action: 'approve' })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('No reviewer assigned to this certificate')
    })

    it('returns 400 when certificate not in reviewable state', async () => {
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
        ...mockCertificate,
        status: 'DRAFT',
      } as any)

      const request = createRequest({ action: 'approve' })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('not in a reviewable state')
    })

    it('returns 403 when user is not the reviewer', async () => {
      vi.mocked(auth).mockResolvedValue({
        ...mockSession,
        user: { ...mockSession.user, id: 'different-user' },
      })

      const request = createRequest({ action: 'approve' })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('You are not the reviewer for this certificate')
    })
  })

  describe('action validation', () => {
    it('returns 400 for invalid action', async () => {
      const request = createRequest({ action: 'invalid' })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid action')
    })
  })

  describe('approval flow', () => {
    it('returns 400 when signature is missing for approval', async () => {
      const request = createRequest({
        action: 'approve',
        signerName: 'John Reviewer',
      })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Signature and signer name are required for approval')
    })

    it('returns 400 when signer name is missing for approval', async () => {
      const request = createRequest({
        action: 'approve',
        signatureData: 'data:image/png;base64,abc123',
      })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Signature and signer name are required for approval')
    })

    it('returns 400 when signer name does not match profile', async () => {
      const request = createRequest({
        action: 'approve',
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'Wrong Name',
      })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Signer name must match your profile name')
    })

    it('successfully approves certificate with valid signature', async () => {
      const mockSignature = { id: 'sig-123' }
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        return {
          certificate: { ...mockCertificate, status: 'APPROVED', currentRevision: 1 },
          reviewerSignature: mockSignature,
          tokenResult: null,
        }
      })

      const request = createRequest({
        action: 'approve',
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'John Reviewer',
      })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Certificate approved successfully')
    })

    describe('send to customer flow', () => {
      it('returns 400 when customer email is missing', async () => {
        const request = createRequest({
          action: 'approve',
          signatureData: 'data:image/png;base64,abc123',
          signerName: 'John Reviewer',
          sendToCustomer: {
            name: 'Customer Name',
          },
        })
        const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Customer email is required for sending to customer')
      })

      it('returns 400 when customer name is missing', async () => {
        const request = createRequest({
          action: 'approve',
          signatureData: 'data:image/png;base64,abc123',
          signerName: 'John Reviewer',
          sendToCustomer: {
            email: 'customer@test.com',
          },
        })
        const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Customer name is required for sending to customer')
      })

      it('returns 400 for invalid customer email', async () => {
        const request = createRequest({
          action: 'approve',
          signatureData: 'data:image/png;base64,abc123',
          signerName: 'John Reviewer',
          sendToCustomer: {
            email: 'invalid-email',
            name: 'Customer Name',
          },
        })
        const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Please enter a valid customer email address')
      })

      it('successfully approves and sends to customer', async () => {
        const mockSignature = { id: 'sig-123' }
        const mockToken = {
          token: 'token-123',
          customerId: 'customer-456',
          expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
        }
        vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
          return {
            certificate: { ...mockCertificate, status: 'PENDING_CUSTOMER_APPROVAL', currentRevision: 1 },
            reviewerSignature: mockSignature,
            tokenResult: mockToken,
          }
        })

        const request = createRequest({
          action: 'approve',
          signatureData: 'data:image/png;base64,abc123',
          signerName: 'John Reviewer',
          sendToCustomer: {
            email: 'customer@test.com',
            name: 'Customer Name',
          },
        })
        const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
        const data = await response.json()

        expect(response.status).toBe(200)
        expect(data.success).toBe(true)
        expect(data.message).toBe('Certificate approved and sent to customer for review')
        expect(data.customerToken).toBeDefined()
        expect(data.customerToken.token).toBe('token-123')
      })
    })

    describe('pending edits validation', () => {
      it('returns 400 when edit has no field', async () => {
        const request = createRequest({
          action: 'approve',
          signatureData: 'data:image/png;base64,abc123',
          signerName: 'John Reviewer',
          edits: [{ newValue: '2025-01-01' }],
        })
        const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Invalid edit: field and newValue are required')
      })

      it('returns 400 when edit has no reason and is not auto-calculated', async () => {
        const request = createRequest({
          action: 'approve',
          signatureData: 'data:image/png;base64,abc123',
          signerName: 'John Reviewer',
          edits: [{
            field: 'calibrationDueDate',
            fieldLabel: 'Calibration Due Date',
            newValue: '2025-01-01',
          }],
        })
        const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
        const data = await response.json()

        expect(response.status).toBe(400)
        expect(data.error).toBe('Reason is required for editing Calibration Due Date')
      })
    })
  })

  describe('revision request flow', () => {
    it('returns 400 when no feedback provided', async () => {
      const request = createRequest({
        action: 'request_revision',
      })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Please provide at least one section feedback or general notes')
    })

    it('returns 400 when empty sectionFeedbacks provided', async () => {
      const request = createRequest({
        action: 'request_revision',
        sectionFeedbacks: [{ section: 'summary', comment: '' }],
      })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Please provide at least one section feedback or general notes')
    })

    it('successfully requests revision with comment', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        // Simulate transaction completion
        return undefined
      })

      const request = createRequest({
        action: 'request_revision',
        comment: 'Please update the calibration data',
      })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('Revision requested')
    })

    it('successfully requests revision with section feedbacks', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        return undefined
      })

      const request = createRequest({
        action: 'request_revision',
        sectionFeedbacks: [
          { section: 'summary', comment: 'Update summary' },
          { section: 'results', comment: 'Check results' },
        ],
      })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('2 feedback item')
    })
  })

  describe('rejection flow', () => {
    it('returns 400 when comment is missing for rejection', async () => {
      const request = createRequest({
        action: 'reject',
      })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Comment is required for rejections')
    })

    it('returns 400 when comment is empty for rejection', async () => {
      const request = createRequest({
        action: 'reject',
        comment: '   ',
      })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Comment is required for rejections')
    })

    it('successfully rejects certificate', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        return undefined
      })

      const request = createRequest({
        action: 'reject',
        comment: 'Certificate has invalid data',
      })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Certificate rejected')
    })
  })
})
