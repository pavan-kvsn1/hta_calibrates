/**
 * CORS Unit Tests
 *
 * Tests for CORS configuration and middleware
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { NextRequest, NextResponse } from 'next/server'
import {
  getCorsConfig,
  isOriginAllowed,
  createCorsHeaders,
  handleCorsPreflightRequest,
  applyCorsHeaders,
  withCors,
  CorsConfig,
} from '@/lib/security/cors'

// Helper to create mock request
function createMockRequest(
  method: string = 'GET',
  headers: Record<string, string> = {}
): NextRequest {
  return {
    method,
    headers: {
      get: (name: string) => headers[name.toLowerCase()] || null,
    },
  } as unknown as NextRequest
}

describe('CORS', () => {
  const originalEnv = process.env

  beforeEach(() => {
    vi.resetModules()
    process.env = { ...originalEnv }
  })

  afterEach(() => {
    process.env = originalEnv
  })

  describe('getCorsConfig', () => {
    it('should return default config when no env vars set', () => {
      delete process.env.CORS_ALLOWED_ORIGINS
      delete process.env.FRONTEND_URL
      delete process.env.NEXTAUTH_URL

      const config = getCorsConfig()

      expect(config.allowedOrigins).toEqual([])
      expect(config.allowedMethods).toContain('GET')
      expect(config.allowedMethods).toContain('POST')
      expect(config.allowedHeaders).toContain('Content-Type')
      expect(config.allowedHeaders).toContain('Authorization')
      expect(config.credentials).toBe(true)
      expect(config.maxAge).toBe(86400)
    })

    it('should parse CORS_ALLOWED_ORIGINS', () => {
      process.env.CORS_ALLOWED_ORIGINS = 'https://app.example.com, https://admin.example.com'

      const config = getCorsConfig()

      expect(config.allowedOrigins).toContain('https://app.example.com')
      expect(config.allowedOrigins).toContain('https://admin.example.com')
    })

    it('should fallback to FRONTEND_URL and NEXTAUTH_URL', () => {
      delete process.env.CORS_ALLOWED_ORIGINS
      process.env.FRONTEND_URL = 'https://frontend.example.com'
      process.env.NEXTAUTH_URL = 'https://auth.example.com'

      const config = getCorsConfig()

      expect(config.allowedOrigins).toContain('https://frontend.example.com')
      expect(config.allowedOrigins).toContain('https://auth.example.com')
    })

    it('should prefer CORS_ALLOWED_ORIGINS over fallbacks', () => {
      process.env.CORS_ALLOWED_ORIGINS = 'https://explicit.example.com'
      process.env.FRONTEND_URL = 'https://frontend.example.com'

      const config = getCorsConfig()

      expect(config.allowedOrigins).toContain('https://explicit.example.com')
      expect(config.allowedOrigins).not.toContain('https://frontend.example.com')
    })
  })

  describe('isOriginAllowed', () => {
    const config: CorsConfig = {
      allowedOrigins: ['https://example.com', '*.example.org'],
      allowedMethods: ['GET'],
      allowedHeaders: [],
      exposedHeaders: [],
      credentials: true,
      maxAge: 3600,
    }

    it('should return false for null origin', () => {
      expect(isOriginAllowed(null, config)).toBe(false)
    })

    it('should allow exact match', () => {
      expect(isOriginAllowed('https://example.com', config)).toBe(true)
    })

    it('should reject non-matching origin', () => {
      expect(isOriginAllowed('https://other.com', config)).toBe(false)
    })

    it('should support wildcard subdomains', () => {
      expect(isOriginAllowed('https://app.example.org', config)).toBe(true)
      expect(isOriginAllowed('https://admin.example.org', config)).toBe(true)
    })

    it('should allow localhost in development', () => {
      const originalNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'development'

      expect(isOriginAllowed('http://localhost:3000', config)).toBe(true)
      expect(isOriginAllowed('http://127.0.0.1:3000', config)).toBe(true)

      process.env.NODE_ENV = originalNodeEnv
    })

    it('should not allow localhost in production', () => {
      const originalNodeEnv = process.env.NODE_ENV
      process.env.NODE_ENV = 'production'

      expect(isOriginAllowed('http://localhost:3000', config)).toBe(false)

      process.env.NODE_ENV = originalNodeEnv
    })
  })

  describe('createCorsHeaders', () => {
    const config: CorsConfig = {
      allowedOrigins: ['https://example.com'],
      allowedMethods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type', 'Authorization'],
      exposedHeaders: ['X-RateLimit-Limit'],
      credentials: true,
      maxAge: 3600,
    }

    it('should create headers for allowed origin', () => {
      const request = createMockRequest('GET', { origin: 'https://example.com' })
      const headers = createCorsHeaders(request, config)

      expect(headers.get('Access-Control-Allow-Origin')).toBe('https://example.com')
      expect(headers.get('Access-Control-Allow-Credentials')).toBe('true')
      expect(headers.get('Access-Control-Allow-Methods')).toBe('GET, POST')
      expect(headers.get('Access-Control-Allow-Headers')).toBe('Content-Type, Authorization')
      expect(headers.get('Access-Control-Expose-Headers')).toBe('X-RateLimit-Limit')
      expect(headers.get('Access-Control-Max-Age')).toBe('3600')
    })

    it('should not create headers for disallowed origin', () => {
      const request = createMockRequest('GET', { origin: 'https://malicious.com' })
      const headers = createCorsHeaders(request, config)

      expect(headers.get('Access-Control-Allow-Origin')).toBeNull()
    })

    it('should not create headers when no origin provided', () => {
      const request = createMockRequest('GET', {})
      const headers = createCorsHeaders(request, config)

      expect(headers.get('Access-Control-Allow-Origin')).toBeNull()
    })
  })

  describe('handleCorsPreflightRequest', () => {
    const config: CorsConfig = {
      allowedOrigins: ['https://example.com'],
      allowedMethods: ['GET', 'POST'],
      allowedHeaders: ['Content-Type'],
      exposedHeaders: [],
      credentials: true,
      maxAge: 3600,
    }

    it('should return null for non-OPTIONS request', () => {
      const request = createMockRequest('POST', { origin: 'https://example.com' })
      const response = handleCorsPreflightRequest(request, config)

      expect(response).toBeNull()
    })

    it('should return 204 for valid preflight', () => {
      const request = createMockRequest('OPTIONS', { origin: 'https://example.com' })
      const response = handleCorsPreflightRequest(request, config)

      expect(response).not.toBeNull()
      expect(response?.status).toBe(204)
    })

    it('should return 403 for disallowed origin', () => {
      const request = createMockRequest('OPTIONS', { origin: 'https://malicious.com' })
      const response = handleCorsPreflightRequest(request, config)

      expect(response).not.toBeNull()
      expect(response?.status).toBe(403)
    })

    it('should return 403 for missing origin', () => {
      const request = createMockRequest('OPTIONS', {})
      const response = handleCorsPreflightRequest(request, config)

      expect(response).not.toBeNull()
      expect(response?.status).toBe(403)
    })

    it('should include CORS headers in preflight response', () => {
      const request = createMockRequest('OPTIONS', { origin: 'https://example.com' })
      const response = handleCorsPreflightRequest(request, config)

      expect(response?.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com')
      expect(response?.headers.get('Access-Control-Allow-Methods')).toContain('GET')
    })
  })

  describe('applyCorsHeaders', () => {
    const config: CorsConfig = {
      allowedOrigins: ['https://example.com'],
      allowedMethods: ['GET'],
      allowedHeaders: ['Content-Type'],
      exposedHeaders: [],
      credentials: true,
      maxAge: 3600,
    }

    it('should apply CORS headers to existing response', () => {
      const request = createMockRequest('GET', { origin: 'https://example.com' })
      const response = NextResponse.json({ data: 'test' })

      const result = applyCorsHeaders(request, response, config)

      expect(result.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com')
    })
  })

  describe('withCors', () => {
    it('should handle preflight requests', async () => {
      process.env.CORS_ALLOWED_ORIGINS = 'https://example.com'
      const request = createMockRequest('OPTIONS', { origin: 'https://example.com' })

      const handler = vi.fn()
      const response = await withCors(request, handler)

      expect(handler).not.toHaveBeenCalled()
      expect(response.status).toBe(204)
    })

    it('should execute handler and add CORS headers for regular requests', async () => {
      process.env.CORS_ALLOWED_ORIGINS = 'https://example.com'
      const request = createMockRequest('POST', { origin: 'https://example.com' })

      const handler = vi.fn().mockResolvedValue(NextResponse.json({ success: true }))
      const response = await withCors(request, handler)

      expect(handler).toHaveBeenCalled()
      expect(response.headers.get('Access-Control-Allow-Origin')).toBe('https://example.com')
    })
  })
})
