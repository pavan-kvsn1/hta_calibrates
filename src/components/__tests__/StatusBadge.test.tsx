import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { StatusBadge } from '../StatusBadge'

describe('StatusBadge', () => {
  describe('renders correct label for each status', () => {
    it('renders Draft status', () => {
      render(<StatusBadge status="DRAFT" />)
      expect(screen.getByText('Draft')).toBeInTheDocument()
    })

    it('renders Pending Review status', () => {
      render(<StatusBadge status="PENDING_REVIEW" />)
      expect(screen.getByText('Pending Review')).toBeInTheDocument()
    })

    it('renders Revision Required status', () => {
      render(<StatusBadge status="REVISION_REQUIRED" />)
      expect(screen.getByText('Revision Required')).toBeInTheDocument()
    })

    it('renders Pending Customer status', () => {
      render(<StatusBadge status="PENDING_CUSTOMER_APPROVAL" />)
      expect(screen.getByText('Pending Customer')).toBeInTheDocument()
    })

    it('renders Customer Revision status', () => {
      render(<StatusBadge status="CUSTOMER_REVISION_REQUIRED" />)
      expect(screen.getByText('Customer Revision')).toBeInTheDocument()
    })

    it('renders Approved status', () => {
      render(<StatusBadge status="APPROVED" />)
      expect(screen.getByText('Approved')).toBeInTheDocument()
    })

    it('renders Rejected status', () => {
      render(<StatusBadge status="REJECTED" />)
      expect(screen.getByText('Rejected')).toBeInTheDocument()
    })
  })

  describe('styling', () => {
    it('applies correct colors for DRAFT status', () => {
      render(<StatusBadge status="DRAFT" />)
      const badge = screen.getByText('Draft')
      expect(badge).toHaveClass('bg-gray-100', 'text-gray-700')
    })

    it('applies correct colors for APPROVED status', () => {
      render(<StatusBadge status="APPROVED" />)
      const badge = screen.getByText('Approved')
      expect(badge).toHaveClass('bg-green-100', 'text-green-800')
    })

    it('applies correct colors for REJECTED status', () => {
      render(<StatusBadge status="REJECTED" />)
      const badge = screen.getByText('Rejected')
      expect(badge).toHaveClass('bg-red-100', 'text-red-800')
    })

    it('applies correct colors for PENDING_REVIEW status', () => {
      render(<StatusBadge status="PENDING_REVIEW" />)
      const badge = screen.getByText('Pending Review')
      expect(badge).toHaveClass('bg-yellow-100', 'text-yellow-800')
    })
  })

  describe('fallback behavior', () => {
    it('renders unknown status as-is with default styling', () => {
      render(<StatusBadge status="UNKNOWN_STATUS" />)
      const badge = screen.getByText('UNKNOWN_STATUS')
      expect(badge).toBeInTheDocument()
      expect(badge).toHaveClass('bg-gray-100', 'text-gray-700')
    })
  })

  describe('custom className', () => {
    it('merges custom className with default styles', () => {
      render(<StatusBadge status="DRAFT" className="custom-class" />)
      const badge = screen.getByText('Draft')
      expect(badge).toHaveClass('custom-class')
      expect(badge).toHaveClass('rounded-full') // Still has default styles
    })
  })
})
