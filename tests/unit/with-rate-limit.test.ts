/**
 * Rate Limit Wrapper Unit Tests
 *
 * Tests for the rate limiting middleware and higher-order functions
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import {
  checkRateLimitForRequest,
  withRateLimit,
  applyRateLimitHeaders,
} from '@/lib/security/with-rate-limit'
import * as rateLimiter from '@/lib/security/rate-limiter'

// Mock the rate limiter module
vi.mock('@/lib/security/rate-limiter', () => ({
  checkRateLimit: vi.fn(),
  getClientIP: vi.fn(),
  createRateLimitHeaders: vi.fn(),
  RateLimitConfig: {
    LOGIN: { limit: 5, windowSeconds: 900, keyPrefix: 'ratelimit:login:' },
    API_GENERAL: { limit: 100, windowSeconds: 60, keyPrefix: 'ratelimit:api:' },
  },
}))

// Helper to create mock request
function createMockRequest(
  method: string = 'POST',
  headers: Record<string, string> = {}
): NextRequest {
  return {
    method,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] || null,
    },
  } as unknown as NextRequest
}

describe('Rate Limit Wrapper', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(rateLimiter.getClientIP).mockReturnValue('192.168.1.1')
    vi.mocked(rateLimiter.createRateLimitHeaders).mockReturnValue({
      'X-RateLimit-Limit': '5',
      'X-RateLimit-Remaining': '4',
      'X-RateLimit-Reset': '1700000000',
    })
  })

  describe('checkRateLimitForRequest', () => {
    it('should return null when request is within limits', async () => {
      vi.mocked(rateLimiter.checkRateLimit).mockResolvedValue({
        allowed: true,
        remaining: 4,
        limit: 5,
        resetAt: 1700000000,
      })

      const request = createMockRequest()
      const result = await checkRateLimitForRequest(request, 'LOGIN')

      expect(result).toBeNull()
      expect(rateLimiter.getClientIP).toHaveBeenCalledWith(request)
      expect(rateLimiter.checkRateLimit).toHaveBeenCalledWith('192.168.1.1', 'LOGIN')
    })

    it('should return 429 response when rate limited', async () => {
      vi.mocked(rateLimiter.checkRateLimit).mockResolvedValue({
        allowed: false,
        remaining: 0,
        limit: 5,
        resetAt: Math.floor(Date.now() / 1000) + 300,
      })

      const request = createMockRequest()
      const result = await checkRateLimitForRequest(request, 'LOGIN')

      expect(result).not.toBeNull()
      expect(result?.status).toBe(429)

      const body = await result?.json()
      expect(body.error).toBe('Too many requests. Please try again later.')
      expect(body.retryAfter).toBeGreaterThan(0)
    })

    it('should use custom identifier when provided', async () => {
      vi.mocked(rateLimiter.checkRateLimit).mockResolvedValue({
        allowed: true,
        remaining: 4,
        limit: 5,
        resetAt: 1700000000,
      })

      const request = createMockRequest()
      await checkRateLimitForRequest(request, 'LOGIN', 'custom-id')

      expect(rateLimiter.checkRateLimit).toHaveBeenCalledWith('custom-id', 'LOGIN')
      expect(rateLimiter.getClientIP).not.toHaveBeenCalled()
    })

    it('should include rate limit headers in 429 response', async () => {
      vi.mocked(rateLimiter.checkRateLimit).mockResolvedValue({
        allowed: false,
        remaining: 0,
        limit: 5,
        resetAt: Math.floor(Date.now() / 1000) + 300,
      })

      const request = createMockRequest()
      const result = await checkRateLimitForRequest(request, 'LOGIN')

      expect(result?.headers.get('X-RateLimit-Limit')).toBe('5')
      expect(result?.headers.get('X-RateLimit-Remaining')).toBe('4')
      expect(result?.headers.get('Retry-After')).toBeDefined()
    })
  })

  describe('withRateLimit', () => {
    it('should execute handler when within limits', async () => {
      vi.mocked(rateLimiter.checkRateLimit).mockResolvedValue({
        allowed: true,
        remaining: 4,
        limit: 5,
        resetAt: 1700000000,
      })

      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )

      const wrappedHandler = withRateLimit(mockHandler, { type: 'LOGIN' })
      const request = createMockRequest()
      const response = await wrappedHandler(request)

      expect(mockHandler).toHaveBeenCalledWith(request)
      expect(response.status).toBe(200)
    })

    it('should add rate limit headers to successful response', async () => {
      vi.mocked(rateLimiter.checkRateLimit).mockResolvedValue({
        allowed: true,
        remaining: 4,
        limit: 5,
        resetAt: 1700000000,
      })

      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )

      const wrappedHandler = withRateLimit(mockHandler, { type: 'LOGIN' })
      const request = createMockRequest()
      const response = await wrappedHandler(request)

      expect(response.headers.get('X-RateLimit-Limit')).toBe('5')
      expect(response.headers.get('X-RateLimit-Remaining')).toBe('4')
    })

    it('should return 429 without calling handler when rate limited', async () => {
      vi.mocked(rateLimiter.checkRateLimit).mockResolvedValue({
        allowed: false,
        remaining: 0,
        limit: 5,
        resetAt: Math.floor(Date.now() / 1000) + 300,
      })

      const mockHandler = vi.fn()
      const wrappedHandler = withRateLimit(mockHandler, { type: 'LOGIN' })
      const request = createMockRequest()
      const response = await wrappedHandler(request)

      expect(mockHandler).not.toHaveBeenCalled()
      expect(response.status).toBe(429)
    })

    it('should use custom identifier function', async () => {
      vi.mocked(rateLimiter.checkRateLimit).mockResolvedValue({
        allowed: true,
        remaining: 4,
        limit: 5,
        resetAt: 1700000000,
      })

      const customGetIdentifier = vi.fn().mockReturnValue('user:123')
      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )

      const wrappedHandler = withRateLimit(mockHandler, {
        type: 'LOGIN',
        getIdentifier: customGetIdentifier,
      })

      const request = createMockRequest()
      await wrappedHandler(request)

      expect(customGetIdentifier).toHaveBeenCalledWith(request)
      expect(rateLimiter.checkRateLimit).toHaveBeenCalledWith('user:123', 'LOGIN')
    })

    it('should use custom error message', async () => {
      vi.mocked(rateLimiter.checkRateLimit).mockResolvedValue({
        allowed: false,
        remaining: 0,
        limit: 5,
        resetAt: Math.floor(Date.now() / 1000) + 300,
      })

      const wrappedHandler = withRateLimit(
        vi.fn().mockResolvedValue(NextResponse.json({})),
        {
          type: 'LOGIN',
          errorMessage: 'Custom rate limit message',
        }
      )

      const request = createMockRequest()
      const response = await wrappedHandler(request)
      const body = await response.json()

      expect(body.error).toBe('Custom rate limit message')
    })

    it('should support async identifier function', async () => {
      vi.mocked(rateLimiter.checkRateLimit).mockResolvedValue({
        allowed: true,
        remaining: 4,
        limit: 5,
        resetAt: 1700000000,
      })

      const asyncGetIdentifier = vi.fn().mockResolvedValue('async-user:456')
      const mockHandler = vi.fn().mockResolvedValue(
        NextResponse.json({ success: true })
      )

      const wrappedHandler = withRateLimit(mockHandler, {
        type: 'API_GENERAL',
        getIdentifier: asyncGetIdentifier,
      })

      const request = createMockRequest()
      await wrappedHandler(request)

      expect(asyncGetIdentifier).toHaveBeenCalled()
      expect(rateLimiter.checkRateLimit).toHaveBeenCalledWith('async-user:456', 'API_GENERAL')
    })
  })

  describe('applyRateLimitHeaders', () => {
    it('should add rate limit headers to response', async () => {
      vi.mocked(rateLimiter.checkRateLimit).mockResolvedValue({
        allowed: true,
        remaining: 50,
        limit: 100,
        resetAt: 1700000000,
      })

      const response = NextResponse.json({ data: 'test' })
      const result = await applyRateLimitHeaders(response, 'API_GENERAL', '192.168.1.1')

      expect(rateLimiter.checkRateLimit).toHaveBeenCalledWith('192.168.1.1', 'API_GENERAL')
      expect(result.headers.get('X-RateLimit-Limit')).toBe('5')
    })
  })
})
