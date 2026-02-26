import { describe, it, expect } from 'vitest'

// Certificate status constants
const CERTIFICATE_STATUSES = {
  DRAFT: 'DRAFT',
  PENDING_REVIEW: 'PENDING_REVIEW',
  REVISION_REQUIRED: 'REVISION_REQUIRED',
  PENDING_CUSTOMER_APPROVAL: 'PENDING_CUSTOMER_APPROVAL',
  CUSTOMER_REVISION_REQUIRED: 'CUSTOMER_REVISION_REQUIRED',
  APPROVED: 'APPROVED',
  PENDING_ADMIN_AUTHORIZATION: 'PENDING_ADMIN_AUTHORIZATION',
  AUTHORIZED: 'AUTHORIZED',
  REJECTED: 'REJECTED',
} as const

type CertificateStatus = typeof CERTIFICATE_STATUSES[keyof typeof CERTIFICATE_STATUSES]

// Status transition validation
const VALID_TRANSITIONS: Record<CertificateStatus, CertificateStatus[]> = {
  DRAFT: ['PENDING_REVIEW'],
  PENDING_REVIEW: ['REVISION_REQUIRED', 'PENDING_CUSTOMER_APPROVAL', 'REJECTED'],
  REVISION_REQUIRED: ['PENDING_REVIEW'],
  PENDING_CUSTOMER_APPROVAL: ['CUSTOMER_REVISION_REQUIRED', 'APPROVED'],
  CUSTOMER_REVISION_REQUIRED: ['PENDING_CUSTOMER_APPROVAL', 'REVISION_REQUIRED'],
  APPROVED: ['PENDING_ADMIN_AUTHORIZATION'],
  PENDING_ADMIN_AUTHORIZATION: ['AUTHORIZED'],
  AUTHORIZED: [],
  REJECTED: [],
}

function canTransition(from: CertificateStatus, to: CertificateStatus): boolean {
  return VALID_TRANSITIONS[from]?.includes(to) ?? false
}

function isTerminalStatus(status: CertificateStatus): boolean {
  return status === 'AUTHORIZED' || status === 'REJECTED'
}

function requiresCustomerAction(status: CertificateStatus): boolean {
  return status === 'PENDING_CUSTOMER_APPROVAL' || status === 'CUSTOMER_REVISION_REQUIRED'
}

function requiresStaffAction(status: CertificateStatus): boolean {
  return ['DRAFT', 'PENDING_REVIEW', 'REVISION_REQUIRED', 'PENDING_ADMIN_AUTHORIZATION'].includes(status)
}

describe('Certificate Status Transitions', () => {
  describe('canTransition', () => {
    it('allows DRAFT → PENDING_REVIEW', () => {
      expect(canTransition('DRAFT', 'PENDING_REVIEW')).toBe(true)
    })

    it('prevents DRAFT → APPROVED (skip steps)', () => {
      expect(canTransition('DRAFT', 'APPROVED')).toBe(false)
    })

    it('allows PENDING_REVIEW → REVISION_REQUIRED', () => {
      expect(canTransition('PENDING_REVIEW', 'REVISION_REQUIRED')).toBe(true)
    })

    it('allows PENDING_REVIEW → PENDING_CUSTOMER_APPROVAL', () => {
      expect(canTransition('PENDING_REVIEW', 'PENDING_CUSTOMER_APPROVAL')).toBe(true)
    })

    it('allows PENDING_CUSTOMER_APPROVAL → APPROVED', () => {
      expect(canTransition('PENDING_CUSTOMER_APPROVAL', 'APPROVED')).toBe(true)
    })

    it('allows PENDING_CUSTOMER_APPROVAL → CUSTOMER_REVISION_REQUIRED', () => {
      expect(canTransition('PENDING_CUSTOMER_APPROVAL', 'CUSTOMER_REVISION_REQUIRED')).toBe(true)
    })

    it('allows APPROVED → PENDING_ADMIN_AUTHORIZATION', () => {
      expect(canTransition('APPROVED', 'PENDING_ADMIN_AUTHORIZATION')).toBe(true)
    })

    it('allows PENDING_ADMIN_AUTHORIZATION → AUTHORIZED', () => {
      expect(canTransition('PENDING_ADMIN_AUTHORIZATION', 'AUTHORIZED')).toBe(true)
    })

    it('prevents any transition from AUTHORIZED (terminal)', () => {
      expect(canTransition('AUTHORIZED', 'DRAFT')).toBe(false)
      expect(canTransition('AUTHORIZED', 'PENDING_REVIEW')).toBe(false)
    })

    it('prevents any transition from REJECTED (terminal)', () => {
      expect(canTransition('REJECTED', 'DRAFT')).toBe(false)
      expect(canTransition('REJECTED', 'PENDING_REVIEW')).toBe(false)
    })
  })

  describe('isTerminalStatus', () => {
    it('returns true for AUTHORIZED', () => {
      expect(isTerminalStatus('AUTHORIZED')).toBe(true)
    })

    it('returns true for REJECTED', () => {
      expect(isTerminalStatus('REJECTED')).toBe(true)
    })

    it('returns false for DRAFT', () => {
      expect(isTerminalStatus('DRAFT')).toBe(false)
    })

    it('returns false for PENDING_REVIEW', () => {
      expect(isTerminalStatus('PENDING_REVIEW')).toBe(false)
    })
  })

  describe('requiresCustomerAction', () => {
    it('returns true for PENDING_CUSTOMER_APPROVAL', () => {
      expect(requiresCustomerAction('PENDING_CUSTOMER_APPROVAL')).toBe(true)
    })

    it('returns true for CUSTOMER_REVISION_REQUIRED', () => {
      expect(requiresCustomerAction('CUSTOMER_REVISION_REQUIRED')).toBe(true)
    })

    it('returns false for PENDING_REVIEW', () => {
      expect(requiresCustomerAction('PENDING_REVIEW')).toBe(false)
    })

    it('returns false for DRAFT', () => {
      expect(requiresCustomerAction('DRAFT')).toBe(false)
    })
  })

  describe('requiresStaffAction', () => {
    it('returns true for DRAFT', () => {
      expect(requiresStaffAction('DRAFT')).toBe(true)
    })

    it('returns true for PENDING_REVIEW', () => {
      expect(requiresStaffAction('PENDING_REVIEW')).toBe(true)
    })

    it('returns true for REVISION_REQUIRED', () => {
      expect(requiresStaffAction('REVISION_REQUIRED')).toBe(true)
    })

    it('returns true for PENDING_ADMIN_AUTHORIZATION', () => {
      expect(requiresStaffAction('PENDING_ADMIN_AUTHORIZATION')).toBe(true)
    })

    it('returns false for PENDING_CUSTOMER_APPROVAL', () => {
      expect(requiresStaffAction('PENDING_CUSTOMER_APPROVAL')).toBe(false)
    })
  })
})
