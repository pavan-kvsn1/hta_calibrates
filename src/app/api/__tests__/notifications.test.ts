import { describe, it, expect, vi, beforeEach } from 'vitest'
import { GET } from '../notifications/unread-count/route'

// Mock auth
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
}))

// Mock notifications service
vi.mock('@/lib/services/notifications', () => ({
  getUnreadCount: vi.fn(),
}))

import { auth } from '@/lib/auth'
import { getUnreadCount } from '@/lib/services/notifications'

describe('GET /api/notifications/unread-count', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('should return 401 when not authenticated', async () => {
    vi.mocked(auth).mockResolvedValue(null)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(401)
    expect(data.error).toBe('Unauthorized')
  })

  it('should return unread count for authenticated user', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-123', role: 'ADMIN' },
      expires: new Date().toISOString(),
    })
    vi.mocked(getUnreadCount).mockResolvedValue(5)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.count).toBe(5)
    expect(getUnreadCount).toHaveBeenCalledWith({
      userId: 'user-123',
      customerId: undefined,
      filterByInvolvement: false,
    })
  })

  it('should handle customer role differently', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'customer-123', role: 'CUSTOMER' },
      expires: new Date().toISOString(),
    })
    vi.mocked(getUnreadCount).mockResolvedValue(3)

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(200)
    expect(data.count).toBe(3)
    expect(getUnreadCount).toHaveBeenCalledWith({
      userId: undefined,
      customerId: 'customer-123',
      filterByInvolvement: false,
    })
  })

  it('should filter by involvement for engineers', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'engineer-123', role: 'ENGINEER' },
      expires: new Date().toISOString(),
    })
    vi.mocked(getUnreadCount).mockResolvedValue(2)

    const response = await GET()

    expect(getUnreadCount).toHaveBeenCalledWith({
      userId: 'engineer-123',
      customerId: undefined,
      filterByInvolvement: true,
    })
  })

  it('should return 500 on service error', async () => {
    vi.mocked(auth).mockResolvedValue({
      user: { id: 'user-123', role: 'ADMIN' },
      expires: new Date().toISOString(),
    })
    vi.mocked(getUnreadCount).mockRejectedValue(new Error('Database error'))

    const response = await GET()
    const data = await response.json()

    expect(response.status).toBe(500)
    expect(data.error).toBe('Failed to fetch unread count')
  })
})
