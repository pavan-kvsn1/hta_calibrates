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
  getSignatureWidgets: vi.fn(() => [{ page: 1, x: 100, y: 100, width: 200, height: 50 }]),
  withRetry: vi.fn((fn: () => Promise<unknown>) => fn()),
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

// Helper to create a transaction mock that executes the callback for approvals
function createApprovalTransactionMock(returnValue: { certificate: any; reviewerSignature: any; tokenResult: any }) {
  return vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
    const tx = {
      certificateEvent: {
        findFirst: vi.fn().mockResolvedValue({ sequenceNumber: 1 }),
        create: vi.fn().mockResolvedValue({ id: 'event-1' }),
      },
      certificate: {
        update: vi.fn().mockResolvedValue(returnValue.certificate),
      },
      reviewFeedback: {
        findFirst: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({}),
      },
      signature: {
        deleteMany: vi.fn().mockResolvedValue({ count: 0 }),
        create: vi.fn().mockResolvedValue(returnValue.reviewerSignature),
      },
      customerUser: {
        findUnique: vi.fn().mockResolvedValue(null),
        create: vi.fn().mockResolvedValue({ id: 'customer-1' }),
      },
      approvalToken: {
        create: vi.fn().mockResolvedValue({ id: 'token-1', token: 'test-token', expiresAt: new Date() }),
      },
    }
    await fn(tx)
    return returnValue
  })
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
      createApprovalTransactionMock({
        certificate: { ...mockCertificate, status: 'APPROVED', currentRevision: 1 },
        reviewerSignature: mockSignature,
        tokenResult: null,
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
        createApprovalTransactionMock({
          certificate: { ...mockCertificate, status: 'PENDING_CUSTOMER_APPROVAL', currentRevision: 1 },
          reviewerSignature: mockSignature,
          tokenResult: mockToken,
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
    // Helper for revision/reject transaction mocks
    const createRevisionTransactionMock = () => {
      return vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          certificateEvent: {
            findFirst: vi.fn().mockResolvedValue({ sequenceNumber: 1 }),
            create: vi.fn().mockResolvedValue({ id: 'event-1' }),
          },
          certificate: {
            update: vi.fn().mockResolvedValue({ ...mockCertificate, status: 'REVISION_REQUIRED' }),
          },
          reviewFeedback: {
            create: vi.fn().mockResolvedValue({}),
          },
        }
        await fn(tx)
        return undefined
      })
    }

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
      createRevisionTransactionMock()

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
      createRevisionTransactionMock()

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
    const createRejectTransactionMock = () => {
      return vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          certificateEvent: {
            findFirst: vi.fn().mockResolvedValue({ sequenceNumber: 1 }),
            create: vi.fn().mockResolvedValue({ id: 'event-1' }),
          },
          certificate: {
            update: vi.fn().mockResolvedValue({ ...mockCertificate, status: 'REJECTED' }),
          },
          reviewFeedback: {
            create: vi.fn().mockResolvedValue({}),
          },
        }
        await fn(tx)
        return undefined
      })
    }

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
      createRejectTransactionMock()

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

    it('successfully rejects with target section', async () => {
      createRejectTransactionMock()

      const request = createRequest({
        action: 'reject',
        comment: 'Invalid calibration results',
        targetSection: 'results',
      })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('approval with edits', () => {
    it('successfully approves with auto-calculated edits', async () => {
      const mockSignature = { id: 'sig-123' }
      createApprovalTransactionMock({
        certificate: { ...mockCertificate, status: 'APPROVED', currentRevision: 1 },
        reviewerSignature: mockSignature,
        tokenResult: null,
      })

      const request = createRequest({
        action: 'approve',
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'John Reviewer',
        edits: [{
          field: 'calibrationDueDate',
          fieldLabel: 'Calibration Due Date',
          originalValue: '2024-12-01',
          newValue: '2025-01-01',
          reason: '',
          autoCalculated: true,
        }],
      })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('successfully approves with manual edits and reason', async () => {
      const mockSignature = { id: 'sig-123' }
      createApprovalTransactionMock({
        certificate: { ...mockCertificate, status: 'APPROVED', currentRevision: 1 },
        reviewerSignature: mockSignature,
        tokenResult: null,
      })

      const request = createRequest({
        action: 'approve',
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'John Reviewer',
        edits: [{
          field: 'dateOfCalibration',
          fieldLabel: 'Date of Calibration',
          originalValue: '2024-01-01',
          newValue: '2024-01-15',
          reason: 'Corrected calibration date',
        }],
      })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('approval with client evidence', () => {
    it('captures signing evidence when client evidence provided', async () => {
      const mockSignature = { id: 'sig-123' }
      createApprovalTransactionMock({
        certificate: { ...mockCertificate, status: 'APPROVED', currentRevision: 1 },
        reviewerSignature: mockSignature,
        tokenResult: null,
      })

      const request = createRequest({
        action: 'approve',
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'John Reviewer',
        clientEvidence: {
          userAgent: 'Mozilla/5.0',
          screenResolution: '1920x1080',
          timezone: 'UTC',
          timestamp: new Date().toISOString(),
        },
      })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('customer feedback forwarding', () => {
    it('forwards customer feedback when status is CUSTOMER_REVISION_REQUIRED', async () => {
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
        ...mockCertificate,
        status: 'CUSTOMER_REVISION_REQUIRED',
      } as any)

      // Use createRevisionTransactionMock from revision request flow
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          certificateEvent: {
            findFirst: vi.fn().mockResolvedValue({ sequenceNumber: 1 }),
            create: vi.fn().mockResolvedValue({ id: 'event-1' }),
          },
          certificate: {
            update: vi.fn().mockResolvedValue({ ...mockCertificate, status: 'REVISION_REQUIRED' }),
          },
          reviewFeedback: {
            create: vi.fn().mockResolvedValue({}),
          },
        }
        await fn(tx)
        return undefined
      })

      const request = createRequest({
        action: 'request_revision',
        sectionFeedbacks: [
          { section: 'summary', comment: 'Customer wants this fixed' },
        ],
      })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('Customer feedback forwarded')
    })

    it('handles mixed section feedbacks and general notes', async () => {
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        const tx = {
          certificateEvent: {
            findFirst: vi.fn().mockResolvedValue({ sequenceNumber: 1 }),
            create: vi.fn().mockResolvedValue({ id: 'event-1' }),
          },
          certificate: {
            update: vi.fn().mockResolvedValue({ ...mockCertificate, status: 'REVISION_REQUIRED' }),
          },
          reviewFeedback: {
            create: vi.fn().mockResolvedValue({}),
          },
        }
        await fn(tx)
        return undefined
      })

      const request = createRequest({
        action: 'request_revision',
        sectionFeedbacks: [
          { section: 'summary', comment: 'Update summary' },
        ],
        generalNotes: 'Please review all sections carefully',
      })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toContain('2 feedback item')
    })
  })

  describe('send to customer with message', () => {
    it('successfully sends to customer with optional message', async () => {
      const mockSignature = { id: 'sig-123' }
      const mockToken = {
        token: 'token-456',
        customerId: 'customer-789',
        expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
      }
      createApprovalTransactionMock({
        certificate: { ...mockCertificate, status: 'PENDING_CUSTOMER_APPROVAL', currentRevision: 1 },
        reviewerSignature: mockSignature,
        tokenResult: mockToken,
      })

      const request = createRequest({
        action: 'approve',
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'John Reviewer',
        sendToCustomer: {
          email: 'customer@test.com',
          name: 'Customer Name',
          message: 'Please review this certificate at your earliest convenience.',
        },
      })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.customerToken.reviewUrl).toContain('customer/review/')
    })
  })

  describe('error handling', () => {
    it('returns 500 on unexpected error', async () => {
      vi.mocked(prisma.certificate.findUnique).mockRejectedValue(new Error('Database error'))

      const request = createRequest({
        action: 'approve',
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'John Reviewer',
      })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to process review')
    })

    it('returns 400 for invalid action', async () => {
      const request = createRequest({
        action: 'invalid_action',
      })
      const response = await reviewPOST(request, { params: Promise.resolve({ id: 'cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toContain('Invalid action')
    })
  })
})
