import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../instruments/route'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    masterInstrument: {
      findMany: vi.fn(),
    },
  },
}))

import { prisma } from '@/lib/prisma'

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'))
}

describe('Instruments API', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('GET /api/instruments', () => {
    it('should return all active instruments', async () => {
      const mockInstruments = [
        {
          id: 'inst-1',
          legacyId: 1001,
          category: 'ELECTRICAL',
          description: 'Digital Multimeter',
          make: 'Fluke',
          model: '87V',
          assetNumber: 'AST-001',
          serialNumber: 'SN12345',
          usage: 'Voltage measurement',
          calibratedAtLocation: 'Lab A',
          reportNo: 'RPT-001',
          calibrationDueDate: new Date('2025-01-15'),
          rangeData: JSON.stringify([{ min: 0, max: 1000 }]),
          remarks: 'Primary instrument',
        },
      ]

      vi.mocked(prisma.masterInstrument.findMany).mockResolvedValue(mockInstruments)

      const request = createRequest('/api/instruments')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data).toHaveLength(1)
      expect(data[0].instrument_desc).toBe('Digital Multimeter')
      expect(data[0].make).toBe('Fluke')
      expect(data[0].dbId).toBe('inst-1')
      expect(data[0].type).toBe('ELECTRICAL')
    })

    it('should filter instruments by category', async () => {
      vi.mocked(prisma.masterInstrument.findMany).mockResolvedValue([])

      const request = createRequest('/api/instruments?category=ELECTRICAL')
      await GET(request)

      expect(prisma.masterInstrument.findMany).toHaveBeenCalledWith({
        where: { isActive: true, category: 'ELECTRICAL' },
        orderBy: [{ category: 'asc' }, { description: 'asc' }],
      })
    })

    it('should only return active instruments', async () => {
      vi.mocked(prisma.masterInstrument.findMany).mockResolvedValue([])

      const request = createRequest('/api/instruments')
      await GET(request)

      expect(prisma.masterInstrument.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: expect.objectContaining({ isActive: true }),
        })
      )
    })

    it('should transform date to MM/DD/YYYY format', async () => {
      const mockInstruments = [
        {
          id: 'inst-1',
          legacyId: null,
          category: 'MECHANICAL',
          description: 'Pressure Gauge',
          make: 'Ashcroft',
          model: 'PG-100',
          assetNumber: null,
          serialNumber: 'SN-PG-001',
          usage: null,
          calibratedAtLocation: null,
          reportNo: null,
          calibrationDueDate: new Date('2025-03-20'),
          rangeData: null,
          remarks: null,
        },
      ]

      vi.mocked(prisma.masterInstrument.findMany).mockResolvedValue(mockInstruments)

      const request = createRequest('/api/instruments')
      const response = await GET(request)
      const data = await response.json()

      expect(data[0].next_due_on).toBe('03/20/2025')
    })

    it('should handle null values gracefully', async () => {
      const mockInstruments = [
        {
          id: 'inst-1',
          legacyId: null,
          category: 'THERMAL',
          description: 'Thermocouple',
          make: null,
          model: null,
          assetNumber: null,
          serialNumber: null,
          usage: null,
          calibratedAtLocation: null,
          reportNo: null,
          calibrationDueDate: null,
          rangeData: null,
          remarks: null,
        },
      ]

      vi.mocked(prisma.masterInstrument.findMany).mockResolvedValue(mockInstruments)

      const request = createRequest('/api/instruments')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(200)
      expect(data[0].usage).toBe('')
      expect(data[0].calibrated_at).toBe('')
      expect(data[0].next_due_on).toBe('')
      expect(data[0].range).toEqual([])
    })

    it('should parse rangeData JSON correctly', async () => {
      const rangeData = [
        { min: 0, max: 100, unit: 'V' },
        { min: 0, max: 10, unit: 'A' },
      ]
      const mockInstruments = [
        {
          id: 'inst-1',
          legacyId: 5001,
          category: 'ELECTRICAL',
          description: 'Power Analyzer',
          make: 'Hioki',
          model: 'PW3198',
          assetNumber: 'AST-005',
          serialNumber: 'SN-PA-001',
          usage: 'Power analysis',
          calibratedAtLocation: 'Lab B',
          reportNo: 'RPT-005',
          calibrationDueDate: new Date('2025-06-15'),
          rangeData: JSON.stringify(rangeData),
          remarks: null,
        },
      ]

      vi.mocked(prisma.masterInstrument.findMany).mockResolvedValue(mockInstruments)

      const request = createRequest('/api/instruments')
      const response = await GET(request)
      const data = await response.json()

      expect(data[0].range).toEqual(rangeData)
    })

    it('should set cache headers', async () => {
      vi.mocked(prisma.masterInstrument.findMany).mockResolvedValue([])

      const request = createRequest('/api/instruments')
      const response = await GET(request)

      expect(response.headers.get('Cache-Control')).toBe(
        'public, max-age=300, stale-while-revalidate=60'
      )
    })

    it('should handle database errors gracefully', async () => {
      vi.mocked(prisma.masterInstrument.findMany).mockRejectedValue(new Error('DB error'))

      const request = createRequest('/api/instruments')
      const response = await GET(request)
      const data = await response.json()

      expect(response.status).toBe(500)
      expect(data.error).toBe('Failed to fetch instruments')
    })

    it('should generate ID from UUID when legacyId is null', async () => {
      const mockInstruments = [
        {
          id: 'abcd1234-5678-90ab-cdef-ghijklmnopqr',
          legacyId: null,
          category: 'DIMENSIONAL',
          description: 'Caliper',
          make: 'Mitutoyo',
          model: 'CD-6"',
          assetNumber: null,
          serialNumber: 'SN-CAL-001',
          usage: null,
          calibratedAtLocation: null,
          reportNo: null,
          calibrationDueDate: null,
          rangeData: null,
          remarks: null,
        },
      ]

      vi.mocked(prisma.masterInstrument.findMany).mockResolvedValue(mockInstruments)

      const request = createRequest('/api/instruments')
      const response = await GET(request)
      const data = await response.json()

      expect(typeof data[0].id).toBe('number')
    })
  })
})
