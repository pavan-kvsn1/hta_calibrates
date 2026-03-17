import { describe, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import { FeedbackItem, ApprovalItem } from '../feedback/shared/FeedbackItem'
import type { Feedback } from '../feedback/shared/feedback-utils'

const createMockFeedback = (overrides: Partial<Feedback> = {}): Feedback => ({
  id: 'fb-1',
  feedbackType: 'REVISION_REQUEST',
  comment: 'Please update the calibration data',
  createdAt: '2024-01-15T10:30:00.000Z',
  revisionNumber: 1,
  targetSection: 'results',
  user: {
    name: 'John Reviewer',
    role: 'ADMIN',
  },
  ...overrides,
})

describe('FeedbackItem', () => {
  describe('rendering', () => {
    it('renders user name', () => {
      render(<FeedbackItem feedback={createMockFeedback()} />)

      expect(screen.getByText('John Reviewer')).toBeInTheDocument()
    })

    it('renders comment text', () => {
      render(<FeedbackItem feedback={createMockFeedback()} />)

      expect(screen.getByText('Please update the calibration data')).toBeInTheDocument()
    })

    it('renders feedback type label', () => {
      render(<FeedbackItem feedback={createMockFeedback({ feedbackType: 'REVISION_REQUEST' })} />)

      expect(screen.getByText('Revision Request')).toBeInTheDocument()
    })

    it('renders user initials in avatar', () => {
      render(<FeedbackItem feedback={createMockFeedback()} />)

      expect(screen.getByText('JR')).toBeInTheDocument()
    })
  })

  describe('feedback types', () => {
    it('renders revision request styling', () => {
      const { container } = render(
        <FeedbackItem feedback={createMockFeedback({ feedbackType: 'REVISION_REQUEST' })} />
      )

      expect(container.querySelector('.bg-orange-50')).toBeInTheDocument()
    })

    it('renders approval styling', () => {
      const { container } = render(
        <FeedbackItem feedback={createMockFeedback({ feedbackType: 'APPROVED' })} />
      )

      expect(container.querySelector('.bg-green-50')).toBeInTheDocument()
    })

    it('renders engineer response styling', () => {
      const { container } = render(
        <FeedbackItem
          feedback={createMockFeedback({
            feedbackType: 'ENGINEER_RESPONSE',
            user: { name: 'Jane Engineer', role: 'ENGINEER' },
          })}
        />
      )

      expect(container.querySelector('.bg-blue-50')).toBeInTheDocument()
    })

    it('renders customer feedback styling', () => {
      const { container } = render(
        <FeedbackItem
          feedback={createMockFeedback({
            feedbackType: 'CUSTOMER_REVISION_REQUEST',
            user: { name: 'Customer Name', role: 'CUSTOMER' },
          })}
        />
      )

      expect(container.querySelector('.bg-purple-50')).toBeInTheDocument()
    })

    it('renders rejection styling', () => {
      render(
        <FeedbackItem feedback={createMockFeedback({ feedbackType: 'REJECTED' })} />
      )

      expect(screen.getByText('Rejected')).toBeInTheDocument()
    })
  })

  describe('current user highlighting', () => {
    it('shows "You" for current user', () => {
      render(
        <FeedbackItem
          feedback={createMockFeedback({ user: { name: 'Current User', role: 'ENGINEER' } })}
          currentUserName="Current User"
        />
      )

      expect(screen.getByText('You')).toBeInTheDocument()
    })

    it('shows actual name for different user', () => {
      render(
        <FeedbackItem
          feedback={createMockFeedback({ user: { name: 'Other User', role: 'ENGINEER' } })}
          currentUserName="Current User"
        />
      )

      expect(screen.getByText('Other User')).toBeInTheDocument()
    })

    it('handles case-insensitive name comparison', () => {
      render(
        <FeedbackItem
          feedback={createMockFeedback({ user: { name: 'CURRENT USER', role: 'ENGINEER' } })}
          currentUserName="current user"
        />
      )

      expect(screen.getByText('You')).toBeInTheDocument()
    })
  })

  describe('timeline connector', () => {
    it('shows timeline connector when showTimeline is true and not last', () => {
      const { container } = render(
        <FeedbackItem feedback={createMockFeedback()} showTimeline isLast={false} />
      )

      expect(container.querySelector('.bg-slate-200')).toBeInTheDocument()
    })

    it('hides timeline connector when isLast is true', () => {
      const { container } = render(
        <FeedbackItem feedback={createMockFeedback()} showTimeline isLast />
      )

      // Timeline connector should not be present
      const timelineDiv = container.querySelector('.absolute.left-\\[14px\\]')
      expect(timelineDiv).not.toBeInTheDocument()
    })
  })

  describe('variants', () => {
    it('renders compact variant with smaller padding', () => {
      const { container } = render(
        <FeedbackItem feedback={createMockFeedback()} variant="compact" />
      )

      expect(container.querySelector('.p-2')).toBeInTheDocument()
    })

    it('renders default variant with normal padding', () => {
      const { container } = render(
        <FeedbackItem feedback={createMockFeedback()} variant="default" />
      )

      expect(container.querySelector('.p-3')).toBeInTheDocument()
    })
  })

  describe('reviewer edits display', () => {
    it('renders reviewer edits when provided', () => {
      render(
        <FeedbackItem
          feedback={createMockFeedback({
            reviewerEdits: [
              {
                field: 'calibrationDueDate',
                fieldLabel: 'Calibration Due Date',
                previousValue: '2024-01-01',
                newValue: '2024-06-01',
                reason: 'Extended warranty',
              },
            ],
          })}
        />
      )

      expect(screen.getByText('Edits Applied')).toBeInTheDocument()
      expect(screen.getByText('Calibration Due Date')).toBeInTheDocument()
    })

    it('does not render edits section when no edits', () => {
      render(<FeedbackItem feedback={createMockFeedback()} />)

      expect(screen.queryByText('Edits Applied')).not.toBeInTheDocument()
    })
  })

  describe('empty comment handling', () => {
    it('renders without comment when comment is null', () => {
      render(<FeedbackItem feedback={createMockFeedback({ comment: null })} />)

      expect(screen.getByText('John Reviewer')).toBeInTheDocument()
    })

    it('renders without comment when comment is empty string', () => {
      render(<FeedbackItem feedback={createMockFeedback({ comment: '' })} />)

      expect(screen.getByText('John Reviewer')).toBeInTheDocument()
    })
  })

  describe('unknown user handling', () => {
    it('shows "Unknown" for user without name', () => {
      render(
        <FeedbackItem
          feedback={createMockFeedback({ user: { name: '', role: 'ENGINEER' } })}
        />
      )

      expect(screen.getByText('Unknown')).toBeInTheDocument()
    })
  })
})

describe('ApprovalItem', () => {
  it('renders approval with green styling', () => {
    const { container } = render(
      <ApprovalItem feedback={createMockFeedback({ feedbackType: 'APPROVED' })} />
    )

    expect(container.querySelector('.border-green-100')).toBeInTheDocument()
  })

  it('renders user name', () => {
    render(<ApprovalItem feedback={createMockFeedback({ feedbackType: 'APPROVED' })} />)

    expect(screen.getByText('John Reviewer')).toBeInTheDocument()
  })

  it('shows "Approved" badge', () => {
    render(<ApprovalItem feedback={createMockFeedback({ feedbackType: 'APPROVED' })} />)

    expect(screen.getByText('Approved')).toBeInTheDocument()
  })

  it('renders approval comment when provided', () => {
    render(
      <ApprovalItem
        feedback={createMockFeedback({
          feedbackType: 'APPROVED',
          comment: 'Great work on the calibration!',
        })}
      />
    )

    expect(screen.getByText('Great work on the calibration!')).toBeInTheDocument()
  })
})
