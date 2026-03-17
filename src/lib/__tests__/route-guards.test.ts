import { describe, it, expect, vi, beforeEach } from 'vitest'

// Mock next/navigation before importing route-guards
vi.mock('next/navigation', () => ({
  redirect: vi.fn((url: string) => {
    throw new Error(`REDIRECT:${url}`)
  }),
}))

// Mock the auth module
vi.mock('@/lib/auth', () => ({
  auth: vi.fn(),
  isMasterAdmin: vi.fn((user) => user?.role === 'ADMIN' && user?.adminType === 'MASTER'),
  isWorkerAdmin: vi.fn((user) => user?.role === 'ADMIN' && user?.adminType === 'WORKER'),
  isAdmin: vi.fn((user) => user?.role === 'ADMIN'),
  canReviewCertificate: vi.fn((user, cert) => {
    if (!user) return false
    if (user.role === 'ADMIN') return true
    return cert.reviewerId === user.id
  }),
}))

import { redirect } from 'next/navigation'
import { auth } from '@/lib/auth'
import {
  requireAuth,
  requireCustomerAuth,
  requireEngineer,
  requireAdmin,
  requireMasterAdmin,
  requireAdminWithTierCheck,
  requireReviewAccess,
  requireAssigneeAccess,
  requireCertificateAccess,
  getRoleDisplayName,
  isNewWorkflowEnabled,
} from '@/lib/utils/route-guards'

describe('Route Guards', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('requireAuth', () => {
    it('returns user when authenticated', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com', name: 'Test', role: 'ENGINEER' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      const result = await requireAuth()

      expect(result).toEqual(mockUser)
    })

    it('redirects to /login when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null as never)

      await expect(requireAuth()).rejects.toThrow('REDIRECT:/login')
    })

    it('redirects to /login when session has no user', async () => {
      vi.mocked(auth).mockResolvedValue({ user: null } as never)

      await expect(requireAuth()).rejects.toThrow('REDIRECT:/login')
    })
  })

  describe('requireCustomerAuth', () => {
    it('returns user when authenticated as customer', async () => {
      const mockUser = { id: 'cust-1', email: 'cust@example.com', name: 'Customer', role: 'CUSTOMER' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      const result = await requireCustomerAuth()

      expect(result).toEqual(mockUser)
    })

    it('redirects to /customer/login when not authenticated', async () => {
      vi.mocked(auth).mockResolvedValue(null as never)

      await expect(requireCustomerAuth()).rejects.toThrow('REDIRECT:/customer/login')
    })

    it('redirects to /customer/login when not a customer', async () => {
      const mockUser = { id: 'user-1', email: 'test@example.com', name: 'Test', role: 'ENGINEER' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      await expect(requireCustomerAuth()).rejects.toThrow('REDIRECT:/customer/login')
    })
  })

  describe('requireEngineer', () => {
    it('returns user when authenticated as engineer', async () => {
      const mockUser = { id: 'eng-1', email: 'eng@example.com', name: 'Engineer', role: 'ENGINEER' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      const result = await requireEngineer()

      expect(result).toEqual(mockUser)
    })

    it('returns user when authenticated as admin', async () => {
      const mockUser = { id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'ADMIN' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      const result = await requireEngineer()

      expect(result).toEqual(mockUser)
    })

    it('redirects to /dashboard when not engineer or admin', async () => {
      const mockUser = { id: 'cust-1', email: 'cust@example.com', name: 'Customer', role: 'CUSTOMER' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      await expect(requireEngineer()).rejects.toThrow('REDIRECT:/dashboard')
    })
  })

  describe('requireAdmin', () => {
    it('returns user when authenticated as admin', async () => {
      const mockUser = { id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'ADMIN' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      const result = await requireAdmin()

      expect(result).toEqual(mockUser)
    })

    it('redirects to /dashboard when not admin', async () => {
      const mockUser = { id: 'eng-1', email: 'eng@example.com', name: 'Engineer', role: 'ENGINEER' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      await expect(requireAdmin()).rejects.toThrow('REDIRECT:/dashboard')
    })
  })

  describe('requireMasterAdmin', () => {
    it('returns user when authenticated as master admin', async () => {
      const mockUser = { id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'ADMIN', adminType: 'MASTER' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      const result = await requireMasterAdmin()

      expect(result).toEqual(mockUser)
    })

    it('redirects to /admin when worker admin', async () => {
      const mockUser = { id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'ADMIN', adminType: 'WORKER' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      await expect(requireMasterAdmin()).rejects.toThrow('REDIRECT:/admin')
    })

    it('redirects to /dashboard when not admin', async () => {
      const mockUser = { id: 'eng-1', email: 'eng@example.com', name: 'Engineer', role: 'ENGINEER' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      await expect(requireMasterAdmin()).rejects.toThrow('REDIRECT:/dashboard')
    })
  })

  describe('requireAdminWithTierCheck', () => {
    it('returns user for master admin on any route', async () => {
      const mockUser = { id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'ADMIN', adminType: 'MASTER' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      const result = await requireAdminWithTierCheck('/admin/customers')

      expect(result).toEqual(mockUser)
    })

    it('returns user for worker admin on non-restricted route', async () => {
      const mockUser = { id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'ADMIN', adminType: 'WORKER' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      const result = await requireAdminWithTierCheck('/admin/certificates')

      expect(result).toEqual(mockUser)
    })

    it('redirects worker admin from /admin/customers', async () => {
      const mockUser = { id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'ADMIN', adminType: 'WORKER' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      await expect(requireAdminWithTierCheck('/admin/customers')).rejects.toThrow('REDIRECT:/admin')
    })

    it('redirects worker admin from /admin/registrations', async () => {
      const mockUser = { id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'ADMIN', adminType: 'WORKER' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      await expect(requireAdminWithTierCheck('/admin/registrations')).rejects.toThrow('REDIRECT:/admin')
    })

    it('redirects worker admin from nested customer routes', async () => {
      const mockUser = { id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'ADMIN', adminType: 'WORKER' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      await expect(requireAdminWithTierCheck('/admin/customers/123')).rejects.toThrow('REDIRECT:/admin')
    })
  })

  describe('requireReviewAccess', () => {
    it('returns user when user can review certificate', async () => {
      const mockUser = { id: 'reviewer-1', email: 'rev@example.com', name: 'Reviewer', role: 'ADMIN' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      const result = await requireReviewAccess({ reviewerId: 'other' })

      expect(result).toEqual(mockUser)
    })

    it('returns user when user is the assigned reviewer', async () => {
      const mockUser = { id: 'reviewer-1', email: 'rev@example.com', name: 'Reviewer', role: 'ENGINEER' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      const result = await requireReviewAccess({ reviewerId: 'reviewer-1' })

      expect(result).toEqual(mockUser)
    })

    it('redirects when user cannot review certificate', async () => {
      const mockUser = { id: 'other-1', email: 'other@example.com', name: 'Other', role: 'ENGINEER' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      await expect(requireReviewAccess({ reviewerId: 'reviewer-1' })).rejects.toThrow('REDIRECT:/dashboard')
    })
  })

  describe('requireAssigneeAccess', () => {
    it('returns user when user is admin', async () => {
      const mockUser = { id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'ADMIN' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      const result = await requireAssigneeAccess({ createdById: 'other' })

      expect(result).toEqual(mockUser)
    })

    it('returns user when user is the creator', async () => {
      const mockUser = { id: 'creator-1', email: 'creator@example.com', name: 'Creator', role: 'ENGINEER' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      const result = await requireAssigneeAccess({ createdById: 'creator-1' })

      expect(result).toEqual(mockUser)
    })

    it('redirects when user is not creator or admin', async () => {
      const mockUser = { id: 'other-1', email: 'other@example.com', name: 'Other', role: 'ENGINEER' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      await expect(requireAssigneeAccess({ createdById: 'creator-1' })).rejects.toThrow('REDIRECT:/dashboard')
    })
  })

  describe('requireCertificateAccess', () => {
    it('returns user when user is admin', async () => {
      const mockUser = { id: 'admin-1', email: 'admin@example.com', name: 'Admin', role: 'ADMIN' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      const result = await requireCertificateAccess({ createdById: 'other', reviewerId: 'other2' })

      expect(result).toEqual(mockUser)
    })

    it('returns user when user is the creator', async () => {
      const mockUser = { id: 'creator-1', email: 'creator@example.com', name: 'Creator', role: 'ENGINEER' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      const result = await requireCertificateAccess({ createdById: 'creator-1', reviewerId: 'other' })

      expect(result).toEqual(mockUser)
    })

    it('returns user when user is the reviewer', async () => {
      const mockUser = { id: 'reviewer-1', email: 'rev@example.com', name: 'Reviewer', role: 'ENGINEER' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      const result = await requireCertificateAccess({ createdById: 'other', reviewerId: 'reviewer-1' })

      expect(result).toEqual(mockUser)
    })

    it('redirects when user has no access', async () => {
      const mockUser = { id: 'other-1', email: 'other@example.com', name: 'Other', role: 'ENGINEER' }
      vi.mocked(auth).mockResolvedValue({ user: mockUser } as never)

      await expect(requireCertificateAccess({ createdById: 'creator-1', reviewerId: 'reviewer-1' })).rejects.toThrow('REDIRECT:/dashboard')
    })
  })

  describe('getRoleDisplayName', () => {
    it('returns "Master Admin" for ADMIN with MASTER adminType', () => {
      const user = { id: '1', email: 'a@b.com', name: 'Test', role: 'ADMIN', adminType: 'MASTER' as const }
      expect(getRoleDisplayName(user)).toBe('Master Admin')
    })

    it('returns "Worker Admin" for ADMIN with WORKER adminType', () => {
      const user = { id: '1', email: 'a@b.com', name: 'Test', role: 'ADMIN', adminType: 'WORKER' as const }
      expect(getRoleDisplayName(user)).toBe('Worker Admin')
    })

    it('returns "Admin" for ADMIN without adminType', () => {
      const user = { id: '1', email: 'a@b.com', name: 'Test', role: 'ADMIN', adminType: null }
      expect(getRoleDisplayName(user)).toBe('Admin')
    })

    it('returns "Engineer" for ENGINEER role', () => {
      const user = { id: '1', email: 'a@b.com', name: 'Test', role: 'ENGINEER' }
      expect(getRoleDisplayName(user)).toBe('Engineer')
    })

    it('returns "Customer" for CUSTOMER role', () => {
      const user = { id: '1', email: 'a@b.com', name: 'Test', role: 'CUSTOMER' }
      expect(getRoleDisplayName(user)).toBe('Customer')
    })

    it('returns role as-is for unknown roles', () => {
      const user = { id: '1', email: 'a@b.com', name: 'Test', role: 'UNKNOWN' }
      expect(getRoleDisplayName(user)).toBe('UNKNOWN')
    })
  })

  describe('isNewWorkflowEnabled', () => {
    const originalEnv = process.env.FEATURE_NEW_WORKFLOW

    afterEach(() => {
      process.env.FEATURE_NEW_WORKFLOW = originalEnv
    })

    it('returns true when FEATURE_NEW_WORKFLOW is "true"', () => {
      process.env.FEATURE_NEW_WORKFLOW = 'true'
      expect(isNewWorkflowEnabled()).toBe(true)
    })

    it('returns false when FEATURE_NEW_WORKFLOW is "false"', () => {
      process.env.FEATURE_NEW_WORKFLOW = 'false'
      expect(isNewWorkflowEnabled()).toBe(false)
    })

    it('returns false when FEATURE_NEW_WORKFLOW is undefined', () => {
      delete process.env.FEATURE_NEW_WORKFLOW
      expect(isNewWorkflowEnabled()).toBe(false)
    })
  })
})
