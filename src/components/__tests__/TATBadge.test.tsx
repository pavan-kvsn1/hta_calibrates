import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { TATBadge, formatHours, calculateTAT } from '../tat'

describe('formatHours', () => {
  it('formats less than 1 hour as minutes', () => {
    expect(formatHours(0)).toBe('0m')
    expect(formatHours(0.5)).toBe('30m')
  })

  it('formats hours less than 24 correctly', () => {
    expect(formatHours(1)).toBe('1h')
    expect(formatHours(12)).toBe('12h')
    expect(formatHours(23)).toBe('23h')
  })

  it('formats hours with remaining minutes', () => {
    expect(formatHours(1.5)).toBe('1h 30m')
    expect(formatHours(2.25)).toBe('2h 15m')
  })

  it('formats exactly 24 hours as 1 day', () => {
    expect(formatHours(24)).toBe('1d')
  })

  it('formats multiple days correctly', () => {
    expect(formatHours(48)).toBe('2d')
    expect(formatHours(72)).toBe('3d')
  })

  it('formats days with remaining hours', () => {
    expect(formatHours(25)).toBe('1d 1h')
    expect(formatHours(36)).toBe('1d 12h')
    expect(formatHours(50)).toBe('2d 2h')
  })

  it('handles negative hours by taking absolute value', () => {
    expect(formatHours(-5)).toBe('5h')
  })
})

describe('calculateTAT', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  it('returns on_track status when elapsed time is less than 75% of target', () => {
    const now = new Date('2024-01-01T12:00:00Z')
    vi.setSystemTime(now)

    const createdAt = new Date('2024-01-01T00:00:00Z') // 12 hours ago
    const result = calculateTAT(createdAt, null, 48) // 48 hour target

    expect(result.status).toBe('on_track')
    expect(result.label).toBe('On Track')
    expect(result.elapsedHours).toBeCloseTo(12, 0)
  })

  it('returns warning status when elapsed time is between 75% and 100% of target', () => {
    const now = new Date('2024-01-02T12:00:00Z')
    vi.setSystemTime(now)

    const createdAt = new Date('2024-01-01T00:00:00Z') // 36 hours ago
    const result = calculateTAT(createdAt, null, 48) // 48 hour target (75% = 36h)

    expect(result.status).toBe('warning')
    expect(result.label).toBe('Warning')
  })

  it('returns overdue status when elapsed time exceeds target', () => {
    const now = new Date('2024-01-03T12:00:00Z')
    vi.setSystemTime(now)

    const createdAt = new Date('2024-01-01T00:00:00Z') // 60 hours ago
    const result = calculateTAT(createdAt, null, 48) // 48 hour target

    expect(result.status).toBe('overdue')
    expect(result.label).toBe('Overdue')
  })

  it('returns completed status when completedAt is provided', () => {
    const createdAt = new Date('2024-01-01T00:00:00Z')
    const completedAt = new Date('2024-01-02T00:00:00Z') // 24 hours later
    const result = calculateTAT(createdAt, completedAt, 48)

    expect(result.status).toBe('completed')
    expect(result.label).toBe('Completed On Time')
  })

  it('indicates late completion when completed after target', () => {
    const createdAt = new Date('2024-01-01T00:00:00Z')
    const completedAt = new Date('2024-01-03T12:00:00Z') // 60 hours later
    const result = calculateTAT(createdAt, completedAt, 48)

    expect(result.status).toBe('completed')
    expect(result.label).toBe('Completed Late')
  })
})

describe('TATBadge', () => {
  beforeEach(() => {
    vi.useFakeTimers()
  })

  afterEach(() => {
    vi.useRealTimers()
  })

  describe('rendering', () => {
    it('renders with default variant', () => {
      const now = new Date('2024-01-01T12:00:00Z')
      vi.setSystemTime(now)

      const createdAt = new Date('2024-01-01T00:00:00Z')
      render(<TATBadge createdAt={createdAt} />)

      expect(screen.getByText('On Track')).toBeInTheDocument()
    })

    it('renders elapsed time', () => {
      const now = new Date('2024-01-01T12:00:00Z')
      vi.setSystemTime(now)

      const createdAt = new Date('2024-01-01T00:00:00Z') // 12 hours ago
      render(<TATBadge createdAt={createdAt} />)

      expect(screen.getByText('12h')).toBeInTheDocument()
    })

    it('renders with compact variant', () => {
      const now = new Date('2024-01-01T12:00:00Z')
      vi.setSystemTime(now)

      const createdAt = new Date('2024-01-01T00:00:00Z')
      render(<TATBadge createdAt={createdAt} variant="compact" />)

      expect(screen.getByText('On Track')).toBeInTheDocument()
    })
  })

  describe('status display', () => {
    it('shows On Track for new certificates', () => {
      const now = new Date('2024-01-01T12:00:00Z')
      vi.setSystemTime(now)

      const createdAt = new Date('2024-01-01T00:00:00Z')
      render(<TATBadge createdAt={createdAt} targetHours={48} />)

      expect(screen.getByText('On Track')).toBeInTheDocument()
    })

    it('shows Warning when approaching deadline', () => {
      const now = new Date('2024-01-02T12:00:00Z')
      vi.setSystemTime(now)

      const createdAt = new Date('2024-01-01T00:00:00Z') // 36 hours ago
      render(<TATBadge createdAt={createdAt} targetHours={48} />)

      expect(screen.getByText('Warning')).toBeInTheDocument()
    })

    it('shows Overdue when past deadline', () => {
      const now = new Date('2024-01-03T12:00:00Z')
      vi.setSystemTime(now)

      const createdAt = new Date('2024-01-01T00:00:00Z') // 60 hours ago
      render(<TATBadge createdAt={createdAt} targetHours={48} />)

      expect(screen.getByText('Overdue')).toBeInTheDocument()
    })

    it('shows Completed On Time when finished before deadline', () => {
      const createdAt = new Date('2024-01-01T00:00:00Z')
      const completedAt = new Date('2024-01-02T00:00:00Z')
      render(<TATBadge createdAt={createdAt} completedAt={completedAt} targetHours={48} />)

      expect(screen.getByText('Completed On Time')).toBeInTheDocument()
    })

    it('shows Completed Late when finished after deadline', () => {
      const createdAt = new Date('2024-01-01T00:00:00Z')
      const completedAt = new Date('2024-01-03T12:00:00Z')
      render(<TATBadge createdAt={createdAt} completedAt={completedAt} targetHours={48} />)

      expect(screen.getByText('Completed Late')).toBeInTheDocument()
    })
  })

  describe('custom target hours', () => {
    it('uses custom target hours for calculation', () => {
      const now = new Date('2024-01-01T20:00:00Z')
      vi.setSystemTime(now)

      const createdAt = new Date('2024-01-01T00:00:00Z') // 20 hours ago
      render(<TATBadge createdAt={createdAt} targetHours={24} />)

      // 20 hours is > 75% of 24 hours (18h), so should be warning
      expect(screen.getByText('Warning')).toBeInTheDocument()
    })
  })
})
