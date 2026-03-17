import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TATBadge, formatHours, type TATStatus } from '../tat'

describe('formatHours', () => {
  it('formats hours less than 24 as hours only', () => {
    expect(formatHours(0)).toBe('0h')
    expect(formatHours(1)).toBe('1h')
    expect(formatHours(12)).toBe('12h')
    expect(formatHours(23)).toBe('23h')
  })

  it('formats exactly 24 hours as 1 day', () => {
    expect(formatHours(24)).toBe('1d')
  })

  it('formats multiple days without remaining hours', () => {
    expect(formatHours(48)).toBe('2d')
    expect(formatHours(72)).toBe('3d')
    expect(formatHours(168)).toBe('7d')
  })

  it('formats days with remaining hours', () => {
    expect(formatHours(25)).toBe('1d 1h')
    expect(formatHours(36)).toBe('1d 12h')
    expect(formatHours(50)).toBe('2d 2h')
    expect(formatHours(75)).toBe('3d 3h')
  })
})

describe('TATBadge', () => {
  describe('rendering', () => {
    it('renders the TAT value', () => {
      const tat: TATStatus = { hours: 12, status: 'ok' }
      render(<TATBadge tat={tat} />)

      expect(screen.getByText('TAT: 12h')).toBeInTheDocument()
    })

    it('renders formatted days and hours', () => {
      const tat: TATStatus = { hours: 36, status: 'ok' }
      render(<TATBadge tat={tat} />)

      expect(screen.getByText('TAT: 1d 12h')).toBeInTheDocument()
    })
  })

  describe('status styling', () => {
    it('applies green styling for ok status', () => {
      const tat: TATStatus = { hours: 4, status: 'ok' }
      const { container } = render(<TATBadge tat={tat} />)

      const badge = container.firstChild
      expect(badge).toHaveClass('bg-green-50')
      expect(badge).toHaveClass('text-green-700')
      expect(badge).toHaveClass('border-green-200')
    })

    it('applies amber styling for warning status', () => {
      const tat: TATStatus = { hours: 24, status: 'warning' }
      const { container } = render(<TATBadge tat={tat} />)

      const badge = container.firstChild
      expect(badge).toHaveClass('bg-amber-50')
      expect(badge).toHaveClass('text-amber-700')
      expect(badge).toHaveClass('border-amber-200')
    })

    it('applies red styling for overdue status', () => {
      const tat: TATStatus = { hours: 72, status: 'overdue' }
      const { container } = render(<TATBadge tat={tat} />)

      const badge = container.firstChild
      expect(badge).toHaveClass('bg-red-50')
      expect(badge).toHaveClass('text-red-700')
      expect(badge).toHaveClass('border-red-200')
    })
  })

  describe('overdue indicator', () => {
    it('shows "Overdue" label when status is overdue', () => {
      const tat: TATStatus = { hours: 72, status: 'overdue' }
      render(<TATBadge tat={tat} />)

      expect(screen.getByText('Overdue')).toBeInTheDocument()
    })

    it('does not show "Overdue" label for ok status', () => {
      const tat: TATStatus = { hours: 4, status: 'ok' }
      render(<TATBadge tat={tat} />)

      expect(screen.queryByText('Overdue')).not.toBeInTheDocument()
    })

    it('does not show "Overdue" label for warning status', () => {
      const tat: TATStatus = { hours: 24, status: 'warning' }
      render(<TATBadge tat={tat} />)

      expect(screen.queryByText('Overdue')).not.toBeInTheDocument()
    })
  })
})
