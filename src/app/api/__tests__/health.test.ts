import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../health/route'

describe('GET /api/health', () => {
  beforeEach(() => {
    vi.useFakeTimers()
    vi.setSystemTime(new Date('2024-01-15T10:00:00.000Z'))
  })

  it('should return healthy status', async () => {
    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.status).toBe('healthy')
    expect(data.timestamp).toBe('2024-01-15T10:00:00.000Z')
    expect(data.environment).toBeDefined()
    expect(typeof data.uptime).toBe('number')
  })

  it('should include version information', async () => {
    const response = await GET()
    const data = await response.json()

    expect(data.version).toBeDefined()
    expect(typeof data.version).toBe('string')
  })
})
