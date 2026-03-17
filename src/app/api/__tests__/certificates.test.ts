import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { GET } from '../certificates/check-number/route'

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

// Mock prisma
vi.mock('@/lib/prisma', () => ({
  prisma: {
    certificate: {
      findFirst: vi.fn(),
    },
  },
}))

import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'

function createRequest(url: string): NextRequest {
  return new NextRequest(new URL(url, 'http://localhost:3000'))
}

describe('GET /api/certificates/check-number', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const request = createRequest('/api/certificates/check-number?number=HTA-001')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return 400 when certificate number is missing', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-123', role: 'ENGINEER' },
      expires: new Date().toISOString(),
    })

    const request = createRequest('/api/certificates/check-number')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(400)
    expect(data.error).toBe('Certificate number is required')
  })

  it('should return exists: false when certificate number is available', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-123', role: 'ENGINEER' },
      expires: new Date().toISOString(),
    })
    vi.mocked(prisma.certificate.findFirst).mockResolvedValue(null)

    const request = createRequest('/api/certificates/check-number?number=HTA-NEW-001')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.exists).toBe(false)
    expect(data.certificateNumber).toBe('HTA-NEW-001')
  })

  it('should return exists: true when certificate number already exists', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-123', role: 'ENGINEER' },
      expires: new Date().toISOString(),
    })
    vi.mocked(prisma.certificate.findFirst).mockResolvedValue({
      id: 'cert-123',
      certificateNumber: 'HTA-001',
    })

    const request = createRequest('/api/certificates/check-number?number=HTA-001')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.exists).toBe(true)
    expect(data.certificateNumber).toBe('HTA-001')
  })

  it('should exclude current certificate when excludeId is provided', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-123', role: 'ENGINEER' },
      expires: new Date().toISOString(),
    })
    vi.mocked(prisma.certificate.findFirst).mockResolvedValue(null)

    const request = createRequest('/api/certificates/check-number?number=HTA-001&excludeId=cert-123')
    await GET(request)

    expect(prisma.certificate.findFirst).toHaveBeenCalledWith({
      where: {
        certificateNumber: 'HTA-001',
        NOT: { id: 'cert-123' },
      },
      select: {
        id: true,
        certificateNumber: true,
      },
    })
  })

  it('should return 500 on database error', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-123', role: 'ENGINEER' },
      expires: new Date().toISOString(),
    })
    vi.mocked(prisma.certificate.findFirst).mockRejectedValue(new Error('DB error'))

    const request = createRequest('/api/certificates/check-number?number=HTA-001')
    const response = await GET(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Internal server error')
  })
})
