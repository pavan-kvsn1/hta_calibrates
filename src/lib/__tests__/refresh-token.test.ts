import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { createHash, randomBytes } from 'crypto'

// Mock prisma before importing the module
vi.mock('@/lib/prisma', () => ({
  prisma: {
    refreshToken: {
      create: vi.fn(),
      findUnique: vi.fn(),
      update: vi.fn(),
      updateMany: vi.fn(),
      deleteMany: vi.fn(),
      findMany: vi.fn(),
    },
    $transaction: vi.fn(),
  },
}))

import { prisma } from '@/lib/prisma'
import {
  createRefreshToken,
  validateRefreshToken,
  rotateRefreshToken,
  revokeRefreshToken,
  revokeAllUserTokens,
  cleanupExpiredTokens,
  getUserActiveSessions,
  revokeSessionById,
  REFRESH_TOKEN_CONFIG,
} from '../refresh-token'

// Helper to hash token (same as in refresh-token.ts)
function hashToken(token: string): string {
  return createHash('sha256').update(token).digest('hex')
}

describe('Refresh Token Utilities', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T10:00:00.000Z'))
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('REFRESH_TOKEN_CONFIG', () => {
    it('should have correct access token expiry (15 minutes)', () => {
      expect(REFRESH_TOKEN_CONFIG.accessTokenExpiresInMs).toBe(15 * 60 * 1000)
    })

    it('should have correct refresh token expiry (7 days)', () => {
      expect(REFRESH_TOKEN_CONFIG.expiresInMs).toBe(7 * 24 * 60 * 60 * 1000)
    })

    it('should have correct token byte length (32 bytes)', () => {
      expect(REFRESH_TOKEN_CONFIG.tokenBytes).toBe(32)
    })
  })

  describe('createRefreshToken', () => {
    it('should create a refresh token for staff user', async () => {
      const mockCreatedToken = {
        id: 'token-id-123',
        token: 'hashed-token',
        userId: 'user-123',
        customerId: null,
        userType: 'STAFF',
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_CONFIG.expiresInMs),
        createdAt: new Date(),
        revokedAt: null,
        revokedReason: null,
        replacedById: null,
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      }

      vi.mocked(prisma.refreshToken.create).mockResolvedValue(mockCreatedToken)

      const result = await createRefreshToken({
        userId: 'user-123',
        userType: 'STAFF',
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      })

      expect(result.refreshToken).toBeDefined()
      expect(result.refreshToken.length).toBeGreaterThan(0)
      expect(result.expiresAt).toEqual(
        new Date(Date.now() + REFRESH_TOKEN_CONFIG.expiresInMs)
      )
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-123',
          userType: 'STAFF',
          userAgent: 'Mozilla/5.0',
          ipAddress: '192.168.1.1',
        }),
      })
    })

    it('should create a refresh token for customer user', async () => {
      const mockCreatedToken = {
        id: 'token-id-456',
        token: 'hashed-token',
        userId: null,
        customerId: 'customer-123',
        userType: 'CUSTOMER',
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_CONFIG.expiresInMs),
        createdAt: new Date(),
        revokedAt: null,
        revokedReason: null,
        replacedById: null,
        userAgent: null,
        ipAddress: null,
      }

      vi.mocked(prisma.refreshToken.create).mockResolvedValue(mockCreatedToken)

      const result = await createRefreshToken({
        customerId: 'customer-123',
        userType: 'CUSTOMER',
      })

      expect(result.refreshToken).toBeDefined()
      expect(prisma.refreshToken.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          customerId: 'customer-123',
          userType: 'CUSTOMER',
        }),
      })
    })

    it('should store hashed token in database', async () => {
      vi.mocked(prisma.refreshToken.create).mockResolvedValue({
        id: 'token-id',
        token: 'will-be-hashed',
        userId: 'user-123',
        customerId: null,
        userType: 'STAFF',
        expiresAt: new Date(),
        createdAt: new Date(),
        revokedAt: null,
        revokedReason: null,
        replacedById: null,
        userAgent: null,
        ipAddress: null,
      })

      const result = await createRefreshToken({
        userId: 'user-123',
        userType: 'STAFF',
      })

      // The raw token should NOT be the same as what's stored
      const createCall = vi.mocked(prisma.refreshToken.create).mock.calls[0][0]
      const storedToken = createCall.data.token
      const hashedRawToken = hashToken(result.refreshToken)

      expect(storedToken).toBe(hashedRawToken)
    })
  })

  describe('validateRefreshToken', () => {
    it('should return null for non-existent token', async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue(null)

      const result = await validateRefreshToken('non-existent-token')

      expect(result).toBeNull()
    })

    it('should return null for revoked token', async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: 'token-id',
        token: hashToken('valid-token'),
        userId: 'user-123',
        customerId: null,
        userType: 'STAFF',
        expiresAt: new Date(Date.now() + 1000000),
        createdAt: new Date(),
        revokedAt: new Date(), // REVOKED
        revokedReason: 'LOGOUT',
        replacedById: null,
        userAgent: null,
        ipAddress: null,
      })

      const result = await validateRefreshToken('valid-token')

      expect(result).toBeNull()
    })

    it('should return null for expired token', async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: 'token-id',
        token: hashToken('expired-token'),
        userId: 'user-123',
        customerId: null,
        userType: 'STAFF',
        expiresAt: new Date(Date.now() - 1000), // EXPIRED
        createdAt: new Date(),
        revokedAt: null,
        revokedReason: null,
        replacedById: null,
        userAgent: null,
        ipAddress: null,
      })

      const result = await validateRefreshToken('expired-token')

      expect(result).toBeNull()
    })

    it('should return user info for valid staff token', async () => {
      const rawToken = 'valid-staff-token'
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: 'token-id-123',
        token: hashToken(rawToken),
        userId: 'user-123',
        customerId: null,
        userType: 'STAFF',
        expiresAt: new Date(Date.now() + 1000000),
        createdAt: new Date(),
        revokedAt: null,
        revokedReason: null,
        replacedById: null,
        userAgent: null,
        ipAddress: null,
      })

      const result = await validateRefreshToken(rawToken)

      expect(result).toEqual({
        userId: 'user-123',
        customerId: undefined,
        userType: 'STAFF',
        tokenId: 'token-id-123',
      })
    })

    it('should return customer info for valid customer token', async () => {
      const rawToken = 'valid-customer-token'
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: 'token-id-456',
        token: hashToken(rawToken),
        userId: null,
        customerId: 'customer-123',
        userType: 'CUSTOMER',
        expiresAt: new Date(Date.now() + 1000000),
        createdAt: new Date(),
        revokedAt: null,
        revokedReason: null,
        replacedById: null,
        userAgent: null,
        ipAddress: null,
      })

      const result = await validateRefreshToken(rawToken)

      expect(result).toEqual({
        userId: undefined,
        customerId: 'customer-123',
        userType: 'CUSTOMER',
        tokenId: 'token-id-456',
      })
    })
  })

  describe('rotateRefreshToken', () => {
    it('should return null for invalid old token', async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue(null)

      const result = await rotateRefreshToken('invalid-token', {
        userId: 'user-123',
        userType: 'STAFF',
      })

      expect(result).toBeNull()
    })

    it('should return null for already revoked token', async () => {
      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue({
        id: 'token-id',
        token: hashToken('revoked-token'),
        userId: 'user-123',
        customerId: null,
        userType: 'STAFF',
        expiresAt: new Date(Date.now() + 1000000),
        createdAt: new Date(),
        revokedAt: new Date(), // Already revoked
        revokedReason: 'LOGOUT',
        replacedById: null,
        userAgent: null,
        ipAddress: null,
      })

      const result = await rotateRefreshToken('revoked-token', {
        userId: 'user-123',
        userType: 'STAFF',
      })

      expect(result).toBeNull()
    })

    it('should rotate valid token and return new token', async () => {
      const oldRawToken = 'old-valid-token'
      const oldTokenRecord = {
        id: 'old-token-id',
        token: hashToken(oldRawToken),
        userId: 'user-123',
        customerId: null,
        userType: 'STAFF',
        expiresAt: new Date(Date.now() + 1000000),
        createdAt: new Date(),
        revokedAt: null,
        revokedReason: null,
        replacedById: null,
        userAgent: null,
        ipAddress: null,
      }

      vi.mocked(prisma.refreshToken.findUnique).mockResolvedValue(oldTokenRecord)

      const newTokenRecord = {
        id: 'new-token-id',
        token: 'new-hashed-token',
        userId: 'user-123',
        customerId: null,
        userType: 'STAFF',
        expiresAt: new Date(Date.now() + REFRESH_TOKEN_CONFIG.expiresInMs),
        createdAt: new Date(),
        revokedAt: null,
        revokedReason: null,
        replacedById: null,
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      }

      vi.mocked(prisma.$transaction).mockImplementation(async (callback: (tx: unknown) => Promise<unknown>) => {
        const mockTx = {
          refreshToken: {
            update: vi.fn().mockResolvedValue({}),
            create: vi.fn().mockResolvedValue(newTokenRecord),
          },
        }
        return callback(mockTx)
      })

      const result = await rotateRefreshToken(oldRawToken, {
        userId: 'user-123',
        userType: 'STAFF',
        userAgent: 'Mozilla/5.0',
        ipAddress: '192.168.1.1',
      })

      expect(result).not.toBeNull()
      expect(result?.refreshToken).toBeDefined()
      expect(result?.expiresAt).toBeDefined()
    })
  })

  describe('revokeRefreshToken', () => {
    it('should revoke token with LOGOUT reason', async () => {
      vi.mocked(prisma.refreshToken.update).mockResolvedValue({
        id: 'token-id',
        token: 'hashed',
        userId: 'user-123',
        customerId: null,
        userType: 'STAFF',
        expiresAt: new Date(),
        createdAt: new Date(),
        revokedAt: new Date(),
        revokedReason: 'LOGOUT',
        replacedById: null,
        userAgent: null,
        ipAddress: null,
      })

      const result = await revokeRefreshToken('some-token', 'LOGOUT')

      expect(result).toBe(true)
      expect(prisma.refreshToken.update).toHaveBeenCalledWith({
        where: { token: hashToken('some-token') },
        data: {
          revokedAt: expect.any(Date),
          revokedReason: 'LOGOUT',
        },
      })
    })

    it('should return false if token not found', async () => {
      vi.mocked(prisma.refreshToken.update).mockRejectedValue(new Error('Not found'))

      const result = await revokeRefreshToken('non-existent-token')

      expect(result).toBe(false)
    })
  })

  describe('revokeAllUserTokens', () => {
    it('should revoke all tokens for staff user', async () => {
      vi.mocked(prisma.refreshToken.updateMany).mockResolvedValue({ count: 3 })

      const count = await revokeAllUserTokens('user-123', 'STAFF', 'PASSWORD_CHANGE')

      expect(count).toBe(3)
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { userId: 'user-123', revokedAt: null },
        data: {
          revokedAt: expect.any(Date),
          revokedReason: 'PASSWORD_CHANGE',
        },
      })
    })

    it('should revoke all tokens for customer user', async () => {
      vi.mocked(prisma.refreshToken.updateMany).mockResolvedValue({ count: 2 })

      const count = await revokeAllUserTokens('customer-123', 'CUSTOMER', 'ADMIN_REVOKE')

      expect(count).toBe(2)
      expect(prisma.refreshToken.updateMany).toHaveBeenCalledWith({
        where: { customerId: 'customer-123', revokedAt: null },
        data: {
          revokedAt: expect.any(Date),
          revokedReason: 'ADMIN_REVOKE',
        },
      })
    })
  })

  describe('cleanupExpiredTokens', () => {
    it('should delete tokens older than 30 days', async () => {
      vi.mocked(prisma.refreshToken.deleteMany).mockResolvedValue({ count: 10 })

      const count = await cleanupExpiredTokens()

      expect(count).toBe(10)
      expect(prisma.refreshToken.deleteMany).toHaveBeenCalledWith({
        where: {
          OR: [
            { expiresAt: { lt: expect.any(Date) } },
            { revokedAt: { lt: expect.any(Date) } },
          ],
        },
      })
    })
  })

  describe('getUserActiveSessions', () => {
    it('should return active sessions for staff user', async () => {
      const sessions = [
        {
          id: 'session-1',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 1000000),
          userAgent: 'Chrome',
          ipAddress: '192.168.1.1',
        },
        {
          id: 'session-2',
          createdAt: new Date(),
          expiresAt: new Date(Date.now() + 1000000),
          userAgent: 'Firefox',
          ipAddress: '192.168.1.2',
        },
      ]

      vi.mocked(prisma.refreshToken.findMany).mockResolvedValue(sessions)

      const result = await getUserActiveSessions('user-123', 'STAFF')

      expect(result).toEqual(sessions)
      expect(prisma.refreshToken.findMany).toHaveBeenCalledWith({
        where: {
          userId: 'user-123',
          revokedAt: null,
          expiresAt: { gt: expect.any(Date) },
        },
        select: {
          id: true,
          createdAt: true,
          expiresAt: true,
          userAgent: true,
          ipAddress: true,
        },
        orderBy: { createdAt: 'desc' },
      })
    })
  })

  describe('revokeSessionById', () => {
    it('should revoke specific session for user', async () => {
      vi.mocked(prisma.refreshToken.update).mockResolvedValue({
        id: 'session-1',
        token: 'hashed',
        userId: 'user-123',
        customerId: null,
        userType: 'STAFF',
        expiresAt: new Date(),
        createdAt: new Date(),
        revokedAt: new Date(),
        revokedReason: 'LOGOUT',
        replacedById: null,
        userAgent: null,
        ipAddress: null,
      })

      const result = await revokeSessionById('session-1', 'user-123', 'STAFF')

      expect(result).toBe(true)
    })

    it('should return false if session not found or not owned by user', async () => {
      vi.mocked(prisma.refreshToken.update).mockRejectedValue(new Error('Not found'))

      const result = await revokeSessionById('session-1', 'wrong-user', 'STAFF')

      expect(result).toBe(false)
    })
  })
})
