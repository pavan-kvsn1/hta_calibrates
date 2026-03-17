import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { POST } from '../customer/review/[token]/approve/route'

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    approvalToken: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    certificate: {
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    signature: {
      create: vi.fn(),
    },
    certificateEvent: {
      findFirst: vi.fn(),
      create: vi.fn(),
    },
    customerUser: {
      findUnique: vi.fn(),
    },
    openSignDocument: {
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
  notifyOnCustomerApproval: vi.fn(() => Promise.resolve()),
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
  generateSignedPDF: vi.fn(() => Buffer.from('mock-pdf')),
  getPageCountFromBuffer: vi.fn(() => 1),
}))

// Mock PDF storage
vi.mock('@/lib/services/pdf/storage', () => ({
  storePDF: vi.fn(() => '/path/to/pdf'),
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function createRequest(token: string, body: object): NextRequest {
  return new NextRequest(`http://localhost:3000/api/customer/review/${token}/approve`, {
    method: 'POST',
    body: JSON.stringify(body),
  })
}

const mockCustomer = {
  id: 'customer-123',
  name: 'John Customer',
  email: 'customer@test.com',
  companyName: 'Test Corp',
}

const mockCertificate = {
  id: 'cert-123',
  certificateNumber: 'HTA-001',
  status: 'PENDING_CUSTOMER_APPROVAL',
  currentRevision: 1,
  createdById: 'engineer-456',
  createdBy: { id: 'engineer-456', name: 'Jane Engineer', email: 'engineer@test.com' },
  reviewerId: 'reviewer-789',
  customerName: 'Test Corp',
}

const mockToken = {
  id: 'token-123',
  token: 'valid-token',
  certificateId: 'cert-123',
  customerId: 'customer-123',
  expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
  usedAt: null,
  certificate: mockCertificate,
  customer: mockCustomer,
}

describe('POST /api/customer/review/[token]/approve', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(prisma.approvalToken.findUnique).mockResolvedValue(mockToken as any)
  })

  describe('input validation', () => {
    it('returns 400 when signature is missing', async () => {
      const request = createRequest('valid-token', {
        signerName: 'John Customer',
      })
      const response = await POST(request, { params: Promise.resolve({ token: 'valid-token' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Signature and name are required')
    })

    it('returns 400 when signer name is missing', async () => {
      const request = createRequest('valid-token', {
        signatureData: 'data:image/png;base64,abc123',
      })
      const response = await POST(request, { params: Promise.resolve({ token: 'valid-token' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Signature and name are required')
    })
  })

  describe('token-based approval', () => {
    it('returns 404 for invalid token', async () => {
      vi.mocked(prisma.approvalToken.findUnique).mockResolvedValue(null)

      const request = createRequest('invalid-token', {
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'John Customer',
      })
      const response = await POST(request, { params: Promise.resolve({ token: 'invalid-token' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Invalid token')
    })

    it('returns 400 for already used token', async () => {
      vi.mocked(prisma.approvalToken.findUnique).mockResolvedValue({
        ...mockToken,
        usedAt: new Date(),
      } as any)

      const request = createRequest('valid-token', {
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'John Customer',
      })
      const response = await POST(request, { params: Promise.resolve({ token: 'valid-token' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('This certificate has already been reviewed')
    })

    it('returns 400 for expired token', async () => {
      vi.mocked(prisma.approvalToken.findUnique).mockResolvedValue({
        ...mockToken,
        expiresAt: new Date(Date.now() - 1000), // Expired
      } as any)

      const request = createRequest('valid-token', {
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'John Customer',
      })
      const response = await POST(request, { params: Promise.resolve({ token: 'valid-token' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('This review link has expired')
    })

    it('returns 400 when certificate is not available for approval', async () => {
      vi.mocked(prisma.approvalToken.findUnique).mockResolvedValue({
        ...mockToken,
        certificate: { ...mockCertificate, status: 'DRAFT' },
      } as any)

      const request = createRequest('valid-token', {
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'John Customer',
      })
      const response = await POST(request, { params: Promise.resolve({ token: 'valid-token' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Certificate is not available for approval')
    })

    it('returns 400 when signer name does not match registered name', async () => {
      const request = createRequest('valid-token', {
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'Wrong Name',
      })
      const response = await POST(request, { params: Promise.resolve({ token: 'valid-token' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Signer name must match your registered name')
    })

    it('allows approval when certificate is CUSTOMER_REVISION_REQUIRED', async () => {
      vi.mocked(prisma.approvalToken.findUnique).mockResolvedValue({
        ...mockToken,
        certificate: { ...mockCertificate, status: 'CUSTOMER_REVISION_REQUIRED' },
      } as any)

      const mockSignature = { id: 'sig-123' }
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        return { customerSignature: mockSignature }
      })

      const request = createRequest('valid-token', {
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'John Customer',
      })
      const response = await POST(request, { params: Promise.resolve({ token: 'valid-token' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })

    it('successfully approves certificate', async () => {
      const mockSignature = { id: 'sig-123' }
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        return { customerSignature: mockSignature }
      })

      const request = createRequest('valid-token', {
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'John Customer',
      })
      const response = await POST(request, { params: Promise.resolve({ token: 'valid-token' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Certificate approved successfully')
    })

    it('handles case-insensitive name comparison', async () => {
      const mockSignature = { id: 'sig-123' }
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        return { customerSignature: mockSignature }
      })

      const request = createRequest('valid-token', {
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'JOHN CUSTOMER', // Different case
      })
      const response = await POST(request, { params: Promise.resolve({ token: 'valid-token' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
    })
  })

  describe('session-based approval', () => {
    const sessionMockCustomer = {
      ...mockCustomer,
      customerAccount: { companyName: 'Test Corp' },
    }

    beforeEach(() => {
      vi.mocked(auth).mockResolvedValue({
        user: {
          id: 'customer-123',
          email: 'customer@test.com',
          role: 'CUSTOMER',
        },
        expires: new Date().toISOString(),
      })
      vi.mocked(prisma.customerUser.findUnique).mockResolvedValue(sessionMockCustomer as any)
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue(mockCertificate as any)
    })

    it('returns 401 when not logged in as customer', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const request = createRequest('cert:cert-123', {
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'John Customer',
      })
      const response = await POST(request, { params: Promise.resolve({ token: 'cert:cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized - please log in')
    })

    it('returns 401 when logged in with non-customer role', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: {
          id: 'user-123',
          email: 'engineer@test.com',
          role: 'ENGINEER',
        },
        expires: new Date().toISOString(),
      })

      const request = createRequest('cert:cert-123', {
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'John Customer',
      })
      const response = await POST(request, { params: Promise.resolve({ token: 'cert:cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized - please log in')
    })

    it('returns 404 when customer not found', async () => {
      vi.mocked(prisma.customerUser.findUnique).mockResolvedValue(null)

      const request = createRequest('cert:cert-123', {
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'John Customer',
      })
      const response = await POST(request, { params: Promise.resolve({ token: 'cert:cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Customer not found')
    })

    it('returns 404 when certificate not found', async () => {
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue(null)

      const request = createRequest('cert:cert-123', {
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'John Customer',
      })
      const response = await POST(request, { params: Promise.resolve({ token: 'cert:cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Certificate not found')
    })

    it('returns 403 when customer company does not match certificate', async () => {
      vi.mocked(prisma.customerUser.findUnique).mockResolvedValue({
        ...sessionMockCustomer,
        customerAccount: { companyName: 'Different Corp' },
        companyName: 'Different Corp',
      } as any)

      const request = createRequest('cert:cert-123', {
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'John Customer',
      })
      const response = await POST(request, { params: Promise.resolve({ token: 'cert:cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(403)
      expect(data.error).toBe('You do not have permission to approve this certificate')
    })

    it('returns 400 when certificate not available for approval', async () => {
      vi.mocked(prisma.certificate.findUnique).mockResolvedValue({
        ...mockCertificate,
        status: 'DRAFT',
      } as any)

      const request = createRequest('cert:cert-123', {
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'John Customer',
      })
      const response = await POST(request, { params: Promise.resolve({ token: 'cert:cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Certificate is not available for approval')
    })

    it('returns 400 when signer name does not match customer name', async () => {
      const request = createRequest('cert:cert-123', {
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'Wrong Name',
      })
      const response = await POST(request, { params: Promise.resolve({ token: 'cert:cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(400)
      expect(data.error).toBe('Signer name must match your registered name')
    })

    it('successfully approves via session', async () => {
      const mockSignature = { id: 'sig-123' }
      vi.mocked(prisma.$transaction).mockImplementation(async (fn: any) => {
        return { customerSignature: mockSignature }
      })

      const request = createRequest('cert:cert-123', {
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'John Customer',
      })
      const response = await POST(request, { params: Promise.resolve({ token: 'cert:cert-123' }) })
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.success).toBe(true)
      expect(data.message).toBe('Certificate approved successfully')
    })
  })

  describe('error handling', () => {
    it('returns 500 on unexpected error', async () => {
      vi.mocked(prisma.approvalToken.findUnique).mockRejectedValue(new Error('Database error'))

      const request = createRequest('valid-token', {
        signatureData: 'data:image/png;base64,abc123',
        signerName: 'John Customer',
      })
      const response = await POST(request, { params: Promise.resolve({ token: 'valid-token' }) })
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to approve certificate')
    })
  })
})
