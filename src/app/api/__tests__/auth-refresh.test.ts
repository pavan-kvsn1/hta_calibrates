import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest } from 'next/server'
import { cookies } from 'next/headers'

// Mock dependencies
vi.mock('next/headers', () => ({
  cookies: vi.fn(),
}))

vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

vi.mock('@/lib/prisma', () => ({
  prisma: {
    user: { findUnique: vi.fn() },
    customerUser: { findUnique: vi.fn() },
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

vi.mock('@/lib/refresh-token', () => ({
  validateRefreshToken: vi.fn(),
  rotateRefreshToken: vi.fn(),
  createRefreshToken: vi.fn(),
  revokeRefreshToken: vi.fn(),
  REFRESH_TOKEN_CONFIG: {
    expiresInMs: 7 * 24 * 60 * 60 * 1000,
    accessTokenExpiresInMs: 15 * 60 * 1000,
    tokenBytes: 32,
  },
}))

vi.mock('next-auth/jwt', () => ({
  encode: vi.fn().mockResolvedValue('new-jwt-token'),
}))

import { POST, DELETE } from '../auth/refresh/route'
import { POST as issueRefreshToken } from '../auth/issue-refresh-token/route'
import { auth } from '@/lib/auth'
import { prisma } from '@/lib/prisma'
import {
  validateRefreshToken,
  rotateRefreshToken,
  createRefreshToken,
  revokeRefreshToken,
} from '@/lib/refresh-token'

// Helper to create mock request
function createMockRequest(options: { headers?: Record<string, string> } = {}) {
  return {
    headers: {
      get: (name: string) => options.headers?.[name] || null,
    },
  } as NextRequest
}

describe('POST /api/auth/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    // Set required environment variable for JWT encoding
    process.env.AUTH_SECRET = 'test-secret-for-jwt-encoding-minimum-32-chars'
  })

  it('should return 401 when no refresh token cookie', async () => {
    const mockCookieStore = {
      get: vi.fn().mockReturnValue(undefined),
    }
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never)

    const request = createMockRequest()
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('No refresh token provided')
  })

  it('should return 401 for invalid refresh token', async () => {
    const mockCookieStore = {
      get: vi.fn().mockReturnValue({ value: 'invalid-token' }),
    }
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never)
    vi.mocked(validateRefreshToken).mockResolvedValue(null)

    const request = createMockRequest()
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Invalid or expired refresh token')
  })

  it('should return 401 when staff user is deactivated', async () => {
    const mockCookieStore = {
      get: vi.fn().mockReturnValue({ value: 'valid-token' }),
    }
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never)
    vi.mocked(validateRefreshToken).mockResolvedValue({
      userId: 'user-123',
      customerId: undefined,
      userType: 'STAFF',
      tokenId: 'token-123',
    })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-123',
      email: 'user@example.com',
      name: 'Test User',
      role: 'ENGINEER',
      isAdmin: false,
      adminType: null,
      isActive: false, // DEACTIVATED
      passwordHash: 'hash',
      signatureUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      googleId: null,
      authProvider: 'PASSWORD',
      profileImageUrl: null,
      assignedAdminId: null,
    })

    const request = createMockRequest()
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('User account is deactivated')
  })

  it('should successfully refresh token for valid staff user', async () => {
    const mockCookieStore = {
      get: vi.fn().mockReturnValue({ value: 'valid-token' }),
    }
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never)
    vi.mocked(validateRefreshToken).mockResolvedValue({
      userId: 'user-123',
      customerId: undefined,
      userType: 'STAFF',
      tokenId: 'token-123',
    })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-123',
      email: 'user@example.com',
      name: 'Test User',
      role: 'ENGINEER',
      isAdmin: false,
      adminType: null,
      isActive: true,
      passwordHash: 'hash',
      signatureUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      googleId: null,
      authProvider: 'PASSWORD',
      profileImageUrl: null,
      assignedAdminId: null,
    })
    vi.mocked(rotateRefreshToken).mockResolvedValue({
      refreshToken: 'new-refresh-token',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    const request = createMockRequest({
      headers: {
        'user-agent': 'Mozilla/5.0',
        'x-forwarded-for': '192.168.1.1',
      },
    })
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.expiresAt).toBeDefined()
  })

  it('should successfully refresh token for valid customer user', async () => {
    const mockCookieStore = {
      get: vi.fn().mockReturnValue({ value: 'valid-token' }),
    }
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never)
    vi.mocked(validateRefreshToken).mockResolvedValue({
      userId: undefined,
      customerId: 'customer-123',
      userType: 'CUSTOMER',
      tokenId: 'token-123',
    })
    vi.mocked(prisma.customerUser.findUnique).mockResolvedValue({
      id: 'customer-123',
      email: 'customer@example.com',
      name: 'Test Customer',
      passwordHash: 'hash',
      companyName: 'Test Company',
      customerAccountId: 'account-123',
      isActive: true,
      createdAt: new Date(),
      updatedAt: new Date(),
      isPoc: false,
      activatedAt: new Date(),
      activationToken: null,
      activationExpiry: null,
      customerAccount: {
        id: 'account-123',
        companyName: 'Test Company',
        primaryPocId: 'customer-123',
        address: null,
        contactEmail: null,
        contactPhone: null,
        assignedAdminId: null,
        isActive: true,
        createdAt: new Date(),
        updatedAt: new Date(),
      },
    })
    vi.mocked(rotateRefreshToken).mockResolvedValue({
      refreshToken: 'new-refresh-token',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    const request = createMockRequest()
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
  })

  it('should return 500 when token rotation fails', async () => {
    const mockCookieStore = {
      get: vi.fn().mockReturnValue({ value: 'valid-token' }),
    }
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never)
    vi.mocked(validateRefreshToken).mockResolvedValue({
      userId: 'user-123',
      customerId: undefined,
      userType: 'STAFF',
      tokenId: 'token-123',
    })
    vi.mocked(prisma.user.findUnique).mockResolvedValue({
      id: 'user-123',
      email: 'user@example.com',
      name: 'Test User',
      role: 'ENGINEER',
      isAdmin: false,
      adminType: null,
      isActive: true,
      passwordHash: 'hash',
      signatureUrl: null,
      createdAt: new Date(),
      updatedAt: new Date(),
      googleId: null,
      authProvider: 'PASSWORD',
      profileImageUrl: null,
      assignedAdminId: null,
    })
    vi.mocked(rotateRefreshToken).mockResolvedValue(null)

    const request = createMockRequest()
    const response = await POST(request)
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to rotate refresh token')
  })
})

describe('DELETE /api/auth/refresh', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should revoke refresh token on logout', async () => {
    const mockCookieStore = {
      get: vi.fn().mockReturnValue({ value: 'valid-token' }),
    }
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never)
    vi.mocked(revokeRefreshToken).mockResolvedValue(true)

    const response = await DELETE()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(revokeRefreshToken).toHaveBeenCalledWith('valid-token', 'LOGOUT')
  })

  it('should succeed even without refresh token cookie', async () => {
    const mockCookieStore = {
      get: vi.fn().mockReturnValue(undefined),
    }
    vi.mocked(cookies).mockResolvedValue(mockCookieStore as never)

    const response = await DELETE()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(revokeRefreshToken).not.toHaveBeenCalled()
  })
})

describe('POST /api/auth/issue-refresh-token', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const request = createMockRequest()
    const response = await issueRefreshToken(request)
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Not authenticated')
  })

  it('should issue refresh token for authenticated staff user', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: 'user-123',
        email: 'user@example.com',
        name: 'Test User',
        role: 'ENGINEER',
      },
      expires: new Date(Date.now() + 1000000).toISOString(),
    })
    vi.mocked(createRefreshToken).mockResolvedValue({
      refreshToken: 'new-refresh-token',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    const request = createMockRequest({
      headers: {
        'user-agent': 'Mozilla/5.0',
        'x-forwarded-for': '192.168.1.1',
      },
    })
    const response = await issueRefreshToken(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(data.expiresAt).toBeDefined()
    expect(createRefreshToken).toHaveBeenCalledWith({
      userId: 'user-123',
      customerId: undefined,
      userType: 'STAFF',
      userAgent: 'Mozilla/5.0',
      ipAddress: '192.168.1.1',
    })
  })

  it('should issue refresh token for authenticated customer user', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: {
        id: 'customer-123',
        email: 'customer@example.com',
        name: 'Test Customer',
        role: 'CUSTOMER',
      },
      expires: new Date(Date.now() + 1000000).toISOString(),
    })
    vi.mocked(createRefreshToken).mockResolvedValue({
      refreshToken: 'new-refresh-token',
      expiresAt: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000),
    })

    const request = createMockRequest()
    const response = await issueRefreshToken(request)
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.success).toBe(true)
    expect(createRefreshToken).toHaveBeenCalledWith({
      userId: undefined,
      customerId: 'customer-123',
      userType: 'CUSTOMER',
      userAgent: undefined,
      ipAddress: undefined,
    })
  })
})
