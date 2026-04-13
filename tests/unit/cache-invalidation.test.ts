/**
 * Cache Invalidation Unit Tests
 *
 * Tests for the cache invalidation functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock the cache module - must use inline object, not external variable
vi.mock('@/lib/cache', () => ({
  cache: {
    get: vi.fn(),
    set: vi.fn(),
    delete: vi.fn(),
    deletePattern: vi.fn().mockResolvedValue(1),
    exists: vi.fn(),
    mget: vi.fn(),
    mset: vi.fn(),
    incr: vi.fn(),
    expire: vi.fn(),
    ttl: vi.fn(),
    ping: vi.fn(),
    close: vi.fn(),
  },
  logCache: vi.fn(),
}))

// Import after mocking
import {
  invalidateOnEvent,
  invalidateOnCertificateCreate,
  invalidateOnCertificateUpdate,
  invalidateOnCertificateStatusChange,
  invalidateOnCertificateDelete,
  invalidateOnCustomerCreate,
  invalidateOnCustomerUpdate,
  invalidateOnUserCreate,
  invalidateOnUserUpdate,
  invalidateSession,
  invalidateAllUserSessions,
  invalidateOnInstrumentChange,
  clearAllCache,
} from '@/lib/cache/invalidation'
import { cache } from '@/lib/cache'

describe('Cache Invalidation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(cache.deletePattern).mockResolvedValue(1)
  })

  describe('invalidateOnEvent', () => {
    it('should return 0 for unknown event', async () => {
      const result = await invalidateOnEvent('unknown:event')

      expect(result).toBe(0)
      expect(cache.deletePattern).not.toHaveBeenCalled()
    })

    it('should delete patterns for certificate:created event', async () => {
      vi.mocked(cache.deletePattern).mockResolvedValue(2)

      const result = await invalidateOnEvent('certificate:created', undefined, { userId: 'user-1' })

      expect(result).toBeGreaterThan(0)
      expect(cache.deletePattern).toHaveBeenCalled()
    })

    it('should delete patterns for certificate:updated event', async () => {
      vi.mocked(cache.deletePattern).mockResolvedValue(1)

      const result = await invalidateOnEvent('certificate:updated', 'cert-123', { userId: 'user-1' })

      expect(result).toBeGreaterThan(0)
      // Should include cert:cert-123 pattern
      const calls = vi.mocked(cache.deletePattern).mock.calls.map(c => c[0])
      expect(calls).toContain('cert:cert-123')
    })

    it('should delete patterns for certificate:deleted event', async () => {
      const result = await invalidateOnEvent('certificate:deleted', 'cert-456', { userId: 'user-2' })

      expect(result).toBeGreaterThan(0)
      const calls = vi.mocked(cache.deletePattern).mock.calls.map(c => c[0])
      expect(calls).toContain('cert:cert-456')
    })

    it('should delete patterns for certificate:status_changed event', async () => {
      const result = await invalidateOnEvent('certificate:status_changed', 'cert-789', { userId: 'user-3' })

      expect(result).toBeGreaterThan(0)
      const calls = vi.mocked(cache.deletePattern).mock.calls.map(c => c[0])
      expect(calls).toContain('cert:cert-789')
      expect(calls).toContain('dropdown:reviewers:*')
    })

    it('should delete patterns for customer:created event', async () => {
      const result = await invalidateOnEvent('customer:created')

      expect(result).toBeGreaterThan(0)
      const calls = vi.mocked(cache.deletePattern).mock.calls.map(c => c[0])
      expect(calls).toContain('customers:list:*')
      expect(calls).toContain('dropdown:customers')
    })

    it('should delete patterns for customer:updated event', async () => {
      const result = await invalidateOnEvent('customer:updated', 'cust-123')

      expect(result).toBeGreaterThan(0)
      const calls = vi.mocked(cache.deletePattern).mock.calls.map(c => c[0])
      expect(calls).toContain('customer:cust-123')
    })

    it('should delete patterns for customer:deleted event', async () => {
      const result = await invalidateOnEvent('customer:deleted', 'cust-456')

      expect(result).toBeGreaterThan(0)
    })

    it('should delete patterns for user:created event', async () => {
      const result = await invalidateOnEvent('user:created')

      expect(result).toBeGreaterThan(0)
      const calls = vi.mocked(cache.deletePattern).mock.calls.map(c => c[0])
      expect(calls).toContain('dropdown:admins')
      expect(calls).toContain('dropdown:reviewers:*')
    })

    it('should delete patterns for user:updated event', async () => {
      const result = await invalidateOnEvent('user:updated', 'user-123')

      expect(result).toBeGreaterThan(0)
      const calls = vi.mocked(cache.deletePattern).mock.calls.map(c => c[0])
      expect(calls).toContain('user:user-123')
    })

    it('should delete patterns for user:deleted event', async () => {
      const result = await invalidateOnEvent('user:deleted', 'user-456')

      expect(result).toBeGreaterThan(0)
      const calls = vi.mocked(cache.deletePattern).mock.calls.map(c => c[0])
      expect(calls).toContain('user:user-456')
      expect(calls).toContain('session:*')
    })

    it('should delete patterns for session:invalidated event', async () => {
      const result = await invalidateOnEvent('session:invalidated', 'token-abc')

      expect(result).toBeGreaterThan(0)
      const calls = vi.mocked(cache.deletePattern).mock.calls.map(c => c[0])
      expect(calls).toContain('session:token-abc')
    })

    it('should delete patterns for session:all_invalidated event', async () => {
      const result = await invalidateOnEvent('session:all_invalidated', undefined, { userId: 'user-789' })

      expect(result).toBeGreaterThan(0)
    })

    it('should delete patterns for instrument:created event', async () => {
      const result = await invalidateOnEvent('instrument:created')

      expect(result).toBeGreaterThan(0)
      const calls = vi.mocked(cache.deletePattern).mock.calls.map(c => c[0])
      expect(calls).toContain('dropdown:instruments')
    })

    it('should delete patterns for instrument:updated event', async () => {
      const result = await invalidateOnEvent('instrument:updated', 'inst-123')

      expect(result).toBeGreaterThan(0)
      const calls = vi.mocked(cache.deletePattern).mock.calls.map(c => c[0])
      expect(calls).toContain('instrument:inst-123')
    })

    it('should sum up total deleted entries', async () => {
      vi.mocked(cache.deletePattern)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(3)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1)
        .mockResolvedValueOnce(4)
        .mockResolvedValueOnce(0)

      const result = await invalidateOnEvent('certificate:created', undefined, { userId: 'user-1' })

      expect(result).toBe(15) // 5 + 3 + 2 + 1 + 4 + 0
    })

    it('should return 0 when no patterns match anything', async () => {
      vi.mocked(cache.deletePattern).mockResolvedValue(0)

      const result = await invalidateOnEvent('customer:created')

      expect(result).toBe(0)
    })
  })

  describe('convenience functions', () => {
    describe('invalidateOnCertificateCreate', () => {
      it('should invalidate certificate creation cache', async () => {
        await invalidateOnCertificateCreate('user-123')

        expect(cache.deletePattern).toHaveBeenCalled()
      })
    })

    describe('invalidateOnCertificateUpdate', () => {
      it('should invalidate specific certificate cache', async () => {
        await invalidateOnCertificateUpdate('cert-123', 'user-456')

        const calls = vi.mocked(cache.deletePattern).mock.calls.map(c => c[0])
        expect(calls).toContain('cert:cert-123')
      })
    })

    describe('invalidateOnCertificateStatusChange', () => {
      it('should invalidate cache on status change', async () => {
        await invalidateOnCertificateStatusChange('cert-789', 'user-123')

        const calls = vi.mocked(cache.deletePattern).mock.calls.map(c => c[0])
        expect(calls).toContain('cert:cert-789')
        expect(calls).toContain('dropdown:reviewers:*')
      })
    })

    describe('invalidateOnCertificateDelete', () => {
      it('should invalidate deleted certificate cache', async () => {
        await invalidateOnCertificateDelete('cert-999', 'user-111')

        const calls = vi.mocked(cache.deletePattern).mock.calls.map(c => c[0])
        expect(calls).toContain('cert:cert-999')
      })
    })

    describe('invalidateOnCustomerCreate', () => {
      it('should invalidate customer list cache', async () => {
        await invalidateOnCustomerCreate()

        const calls = vi.mocked(cache.deletePattern).mock.calls.map(c => c[0])
        expect(calls).toContain('customers:list:*')
        expect(calls).toContain('dropdown:customers')
      })
    })

    describe('invalidateOnCustomerUpdate', () => {
      it('should invalidate specific customer cache', async () => {
        await invalidateOnCustomerUpdate('cust-123')

        const calls = vi.mocked(cache.deletePattern).mock.calls.map(c => c[0])
        expect(calls).toContain('customer:cust-123')
      })
    })

    describe('invalidateOnUserCreate', () => {
      it('should invalidate user-related cache', async () => {
        await invalidateOnUserCreate()

        const calls = vi.mocked(cache.deletePattern).mock.calls.map(c => c[0])
        expect(calls).toContain('dropdown:admins')
        expect(calls).toContain('dropdown:reviewers:*')
      })
    })

    describe('invalidateOnUserUpdate', () => {
      it('should invalidate specific user cache', async () => {
        await invalidateOnUserUpdate('user-555')

        const calls = vi.mocked(cache.deletePattern).mock.calls.map(c => c[0])
        expect(calls).toContain('user:user-555')
      })
    })

    describe('invalidateSession', () => {
      it('should invalidate specific session', async () => {
        await invalidateSession('token-xyz')

        const calls = vi.mocked(cache.deletePattern).mock.calls.map(c => c[0])
        expect(calls).toContain('session:token-xyz')
      })
    })

    describe('invalidateAllUserSessions', () => {
      it('should invalidate all sessions for a user', async () => {
        await invalidateAllUserSessions('user-999')

        expect(cache.deletePattern).toHaveBeenCalled()
      })
    })

    describe('invalidateOnInstrumentChange', () => {
      it('should invalidate instrument update cache when id provided', async () => {
        await invalidateOnInstrumentChange('inst-456')

        const calls = vi.mocked(cache.deletePattern).mock.calls.map(c => c[0])
        expect(calls).toContain('instrument:inst-456')
      })

      it('should invalidate instrument creation cache when no id', async () => {
        await invalidateOnInstrumentChange()

        const calls = vi.mocked(cache.deletePattern).mock.calls.map(c => c[0])
        expect(calls).toContain('dropdown:instruments')
      })
    })

    describe('clearAllCache', () => {
      it('should clear all cache entries', async () => {
        vi.mocked(cache.deletePattern).mockResolvedValue(100)

        const result = await clearAllCache()

        expect(result).toBe(100)
        expect(cache.deletePattern).toHaveBeenCalledWith('*')
      })
    })
  })
})
