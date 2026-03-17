import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../customer/dashboard/route'

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

// Mock prisma
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

const mockCustomerSession = {
  user: {
    id: 'customer-123',
    email: 'customer@testcorp.com',
    role: 'CUSTOMER',
  },
  expires: new Date().toISOString(),
}

const mockCustomer = {
  id: 'customer-123',
  email: 'customer@testcorp.com',
  name: 'John Customer',
  companyName: 'Test Corp',
  customerAccount: {
    id: 'account-123',
    companyName: 'Test Corp',
    primaryPocId: 'customer-123',
  },
}

describe('GET /api/customer/dashboard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(auth).mockResolvedValue(mockCustomerSession)
    vi.mocked(prisma.customerUser.findUnique).mockResolvedValue(mockCustomer as any)
    vi.mocked(prisma.customerUser.count).mockResolvedValue(3)
    vi.mocked(prisma.approvalToken.findMany).mockResolvedValue([])
    vi.mocked(prisma.certificate.findMany).mockResolvedValue([])
    vi.mocked(prisma.signature.findMany).mockResolvedValue([])
    vi.mocked(prisma.certificateMasterInstrument.findMany).mockResolvedValue([])
  })

  describe('authentication', () => {
    it('returns 401 when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })

    it('returns 401 when user is not a customer', async () => {
      vi.mocked(auth).mockResolvedValue({
        user: { id: 'user-123', email: 'user@test.com', role: 'ENGINEER' },
        expires: new Date().toISOString(),
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(401)
      expect(data.error).toBe('Unauthorized')
    })
  })

  describe('customer validation', () => {
    it('returns 404 when customer not found', async () => {
      vi.mocked(prisma.customerUser.findUnique).mockResolvedValue(null)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(404)
      expect(data.error).toBe('Customer not found')
    })
  })

  describe('successful response', () => {
    it('returns empty counts when no certificates', async () => {
      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.counts).toEqual({
        pending: 0,
        awaiting: 0,
        completed: 0,
        authorized: 0,
        traceability: 0,
      })
      expect(data.companyName).toBe('Test Corp')
      expect(data.isPrimaryPoc).toBe(true)
      expect(data.userCount).toBe(3)
    })

    it('returns pending certificates with tokens', async () => {
      vi.mocked(prisma.approvalToken.findMany).mockResolvedValue([
        {
          id: 'token-1',
          token: 'abc123',
          createdAt: new Date('2024-01-15'),
          expiresAt: new Date('2024-01-22'),
          certificate: {
            id: 'cert-1',
            certificateNumber: 'HTA-001',
            uucDescription: 'Test Equipment',
            uucMake: 'Make A',
            uucModel: 'Model X',
            srfNumber: 'SRF-001',
            dateOfCalibration: new Date('2024-01-10'),
            events: [{
              eventType: 'SENT_TO_CUSTOMER',
              eventData: JSON.stringify({ message: 'Please review' }),
            }],
          },
        },
      ] as any)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.counts.pending).toBe(1)
      expect(data.pending[0]).toMatchObject({
        id: 'cert-1',
        certificateNumber: 'HTA-001',
        hasToken: true,
        tokenId: 'abc123',
        adminMessage: 'Please review',
      })
    })

    it('returns pending certificates matched by company name', async () => {
      vi.mocked(prisma.certificate.findMany).mockImplementation(async ({ where }: any) => {
        if (where?.status === 'PENDING_CUSTOMER_APPROVAL') {
          return [{
            id: 'cert-2',
            certificateNumber: 'HTA-002',
            uucDescription: 'Equipment 2',
            uucMake: 'Make B',
            uucModel: 'Model Y',
            customerName: 'Test Corp',
            updatedAt: new Date('2024-01-16'),
            srfNumber: null,
            dateOfCalibration: null,
          }] as any
        }
        return []
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.counts.pending).toBe(1)
      expect(data.pending[0]).toMatchObject({
        id: 'cert-2',
        certificateNumber: 'HTA-002',
        hasToken: false,
      })
    })

    it('returns awaiting response certificates', async () => {
      vi.mocked(prisma.certificate.findMany).mockImplementation(async ({ where }: any) => {
        if (where?.status?.in?.includes('CUSTOMER_REVISION_REQUIRED')) {
          return [{
            id: 'cert-3',
            certificateNumber: 'HTA-003',
            uucDescription: 'Equipment 3',
            uucMake: 'Make C',
            uucModel: 'Model Z',
            customerName: 'Test Corp',
            status: 'CUSTOMER_REVISION_REQUIRED',
            updatedAt: new Date('2024-01-17'),
            events: [
              {
                eventType: 'CUSTOMER_REVISION_REQUESTED',
                eventData: JSON.stringify({ notes: 'Please fix issues' }),
                createdAt: new Date('2024-01-16'),
              },
              {
                eventType: 'ADMIN_REPLIED_TO_CUSTOMER',
                eventData: JSON.stringify({ response: 'Fixed the issues' }),
                createdAt: new Date('2024-01-17'),
                user: { name: 'Admin User' },
              },
            ],
          }] as any
        }
        return []
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.counts.awaiting).toBe(1)
      expect(data.awaiting[0]).toMatchObject({
        id: 'cert-3',
        certificateNumber: 'HTA-003',
        internalStatus: 'CUSTOMER_REVISION_REQUIRED',
        customerFeedback: 'Please fix issues',
        adminResponse: 'Fixed the issues',
        adminName: 'Admin User',
      })
    })

    it('returns completed certificates (pending admin authorization)', async () => {
      // Mock completed signatures
      vi.mocked(prisma.signature.findMany).mockImplementation(async ({ where }: any) => {
        if (where?.certificate?.status === 'PENDING_ADMIN_AUTHORIZATION') {
          return [{
            id: 'sig-1',
            signerName: 'John Customer',
            signedAt: new Date('2024-01-18'),
            certificate: {
              id: 'cert-4',
              certificateNumber: 'HTA-004',
              uucDescription: 'Equipment 4',
              uucMake: 'Make D',
              uucModel: 'Model W',
              signatures: [
                { signerType: 'ASSIGNEE' },
                { signerType: 'REVIEWER' },
                { signerType: 'CUSTOMER' },
              ],
            },
          }] as any
        }
        return []
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.counts.completed).toBe(1)
      expect(data.completed[0]).toMatchObject({
        id: 'cert-4',
        certificateNumber: 'HTA-004',
        hasEngineerSig: true,
        hasReviewerSig: true,
        hasCustomerSig: true,
        hasAdminSig: false,
      })
    })

    it('returns authorized certificates', async () => {
      vi.mocked(prisma.signature.findMany).mockImplementation(async ({ where }: any) => {
        if (where?.certificate?.status?.in?.includes('AUTHORIZED')) {
          return [{
            id: 'sig-2',
            signedAt: new Date('2024-01-19'),
            certificate: {
              id: 'cert-5',
              certificateNumber: 'HTA-005',
              uucDescription: 'Equipment 5',
              uucMake: 'Make E',
              uucModel: 'Model V',
              dateOfCalibration: new Date('2024-01-15'),
              calibrationDueDate: new Date('2025-01-15'),
              signedPdfPath: '/pdfs/HTA-005.pdf',
            },
          }] as any
        }
        return []
      })

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.counts.authorized).toBe(1)
      expect(data.authorized[0]).toMatchObject({
        id: 'cert-5',
        certificateNumber: 'HTA-005',
        signedPdfPath: '/pdfs/HTA-005.pdf',
      })
    })

    it('returns traceability data for master instruments', async () => {
      vi.mocked(prisma.certificateMasterInstrument.findMany).mockResolvedValue([
        {
          masterInstrumentId: 'mi-1',
          description: 'Digital Multimeter',
          serialNumber: 'DMM-001',
          category: 'Electrical',
          make: 'Fluke',
          model: '87V',
          reportNo: 'CAL-001',
          calibrationDueDate: '2025-06-01',
          calibratedAt: '2024-06-01',
          certificate: {
            id: 'cert-6',
            certificateNumber: 'HTA-006',
            uucDescription: 'Test Device',
            dateOfCalibration: new Date('2024-01-20'),
            customerName: 'Test Corp',
          },
        },
        {
          masterInstrumentId: 'mi-1',
          description: 'Digital Multimeter',
          serialNumber: 'DMM-001',
          category: 'Electrical',
          make: 'Fluke',
          model: '87V',
          reportNo: 'CAL-001',
          calibrationDueDate: '2025-06-01',
          calibratedAt: '2024-06-01',
          certificate: {
            id: 'cert-7',
            certificateNumber: 'HTA-007',
            uucDescription: 'Another Device',
            dateOfCalibration: new Date('2024-01-21'),
            customerName: 'Test Corp',
          },
        },
      ] as any)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.counts.traceability).toBe(1) // One unique instrument
      expect(data.traceability[0]).toMatchObject({
        id: 'mi-1',
        description: 'Digital Multimeter',
        serialNumber: 'DMM-001',
      })
      expect(data.traceability[0].certificatesUsedIn).toHaveLength(2)
    })

    it('handles customer without account', async () => {
      vi.mocked(prisma.customerUser.findUnique).mockResolvedValue({
        ...mockCustomer,
        customerAccount: null,
      } as any)
      vi.mocked(prisma.customerUser.count).mockResolvedValue(0)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.isPrimaryPoc).toBe(false)
      expect(data.userCount).toBe(0)
    })

    it('uses fallback company name when account has no company name', async () => {
      vi.mocked(prisma.customerUser.findUnique).mockResolvedValue({
        ...mockCustomer,
        companyName: 'Fallback Corp',
        customerAccount: {
          id: 'account-123',
          companyName: null,
          primaryPocId: null,
        },
      } as any)

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data.companyName).toBe('Fallback Corp')
    })
  })

  describe('error handling', () => {
    it('returns 500 on unexpected error', async () => {
      vi.mocked(prisma.customerUser.findUnique).mockRejectedValue(new Error('Database error'))

      const response = await GET()
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch dashboard data')
    })
  })
})
