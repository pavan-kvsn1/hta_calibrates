import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../customer/dashboard/route'

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    customerUser: {
      findUnique: vi.fn(),
      count: vi.fn(),
    },
    approvalToken: {
      findMany: vi.fn(),
    },
    certificate: {
      findMany: vi.fn(),
    },
    signature: {
      findMany: vi.fn(),
    },
    certificateMasterInstrument: {
      findMany: vi.fn(),
    },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

describe('Customer Dashboard API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/customer/dashboard', () => {
    it('should return 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 401 when user is not a customer', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', role: 'ENGINEER', email: 'eng@test.com' },
        expires: new Date().toISOString(),
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('should return 404 when customer not found', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'customer-123', role: 'CUSTOMER', email: 'customer@test.com' },
        expires: new Date().toISOString(),
      })
      vi.mocked(prisma.customerUser.findUnique).mockResolvedValue(null)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Customer not found')
    })

    it('should return dashboard data for authenticated customer', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'customer-123', role: 'CUSTOMER', email: 'customer@test.com' },
        expires: new Date().toISOString(),
      })

      vi.mocked(prisma.customerUser.findUnique).mockResolvedValue({
        id: 'customer-123',
        email: 'customer@test.com',
        companyName: 'Test Company',
        customerAccount: {
          id: 'account-1',
          companyName: 'Test Company',
          primaryPocId: 'customer-123',
        },
      })

      vi.mocked(prisma.customerUser.count).mockResolvedValue(3)
      vi.mocked(prisma.approvalToken.findMany).mockResolvedValue([])
      vi.mocked(prisma.certificate.findMany).mockResolvedValue([])
      vi.mocked(prisma.signature.findMany).mockResolvedValue([])
      vi.mocked(prisma.certificateMasterInstrument.findMany).mockResolvedValue([])

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.counts).toBeDefined()
      expect(data.pending).toEqual([])
      expect(data.awaiting).toEqual([])
      expect(data.completed).toEqual([])
      expect(data.authorized).toEqual([])
      expect(data.traceability).toEqual([])
      expect(data.isPrimaryPoc).toBe(true)
      expect(data.companyName).toBe('Test Company')
      expect(data.userCount).toBe(3)
    })

    it('should return pending certificates with tokens', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'customer-123', role: 'CUSTOMER', email: 'customer@test.com' },
        expires: new Date().toISOString(),
      })

      vi.mocked(prisma.customerUser.findUnique).mockResolvedValue({
        id: 'customer-123',
        email: 'customer@test.com',
        companyName: 'Test Company',
        customerAccount: null,
      })

      const mockToken = {
        token: 'token-abc',
        createdAt: new Date('2024-01-15'),
        expiresAt: new Date('2024-01-22'),
        certificate: {
          id: 'cert-1',
          certificateNumber: 'HTA/CAL/2024/001',
          uucDescription: 'Test Device',
          uucMake: 'Make',
          uucModel: 'Model',
          srfNumber: 'SRF-001',
          dateOfCalibration: new Date('2024-01-10'),
          events: [
            {
              eventType: 'SENT_TO_CUSTOMER',
              eventData: JSON.stringify({ message: 'Please review' }),
            },
          ],
        },
      }

      vi.mocked(prisma.approvalToken.findMany).mockResolvedValue([mockToken])
      vi.mocked(prisma.certificate.findMany).mockResolvedValue([])
      vi.mocked(prisma.signature.findMany).mockResolvedValue([])
      vi.mocked(prisma.certificateMasterInstrument.findMany).mockResolvedValue([])

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.pending).toHaveLength(1)
      expect(data.pending[0].certificateNumber).toBe('HTA/CAL/2024/001')
      expect(data.pending[0].hasToken).toBe(true)
      expect(data.pending[0].adminMessage).toBe('Please review')
    })

    it('should return authorized certificates with signatures', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'customer-123', role: 'CUSTOMER', email: 'customer@test.com' },
        expires: new Date().toISOString(),
      })

      vi.mocked(prisma.customerUser.findUnique).mockResolvedValue({
        id: 'customer-123',
        email: 'customer@test.com',
        companyName: 'Test Company',
        customerAccount: null,
      })

      const mockSignature = {
        signedAt: new Date('2024-01-20'),
        signerName: 'John Customer',
        certificate: {
          id: 'cert-1',
          certificateNumber: 'HTA/CAL/2024/001',
          uucDescription: 'Test Device',
          uucMake: 'Make',
          uucModel: 'Model',
          dateOfCalibration: new Date('2024-01-10'),
          calibrationDueDate: new Date('2025-01-10'),
          signedPdfPath: '/pdfs/cert-1.pdf',
        },
      }

      vi.mocked(prisma.approvalToken.findMany).mockResolvedValue([])
      vi.mocked(prisma.certificate.findMany).mockResolvedValue([])
      vi.mocked(prisma.signature.findMany)
        .mockResolvedValueOnce([]) // completed signatures
        .mockResolvedValueOnce([mockSignature]) // authorized signatures
      vi.mocked(prisma.certificateMasterInstrument.findMany).mockResolvedValue([])

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.authorized).toHaveLength(1)
      expect(data.authorized[0].certificateNumber).toBe('HTA/CAL/2024/001')
      expect(data.authorized[0].signedPdfPath).toBe('/pdfs/cert-1.pdf')
    })

    it('should handle database errors gracefully', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'customer-123', role: 'CUSTOMER', email: 'customer@test.com' },
        expires: new Date().toISOString(),
      })
      vi.mocked(prisma.customerUser.findUnique).mockRejectedValue(new Error('DB error'))

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch dashboard data')
    })

    it('should correctly identify primary POC', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'customer-456', role: 'CUSTOMER', email: 'secondary@test.com' },
        expires: new Date().toISOString(),
      })

      vi.mocked(prisma.customerUser.findUnique).mockResolvedValue({
        id: 'customer-456',
        email: 'secondary@test.com',
        companyName: 'Test Company',
        customerAccount: {
          id: 'account-1',
          companyName: 'Test Company',
          primaryPocId: 'customer-123', // Different from current user
        },
      })

      vi.mocked(prisma.customerUser.count).mockResolvedValue(2)
      vi.mocked(prisma.approvalToken.findMany).mockResolvedValue([])
      vi.mocked(prisma.certificate.findMany).mockResolvedValue([])
      vi.mocked(prisma.signature.findMany).mockResolvedValue([])
      vi.mocked(prisma.certificateMasterInstrument.findMany).mockResolvedValue([])

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.isPrimaryPoc).toBe(false)
    })
  })
})
