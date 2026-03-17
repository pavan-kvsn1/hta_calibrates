import { describe, it, expect } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { FeedbackTimeline } from '../feedback/shared/FeedbackTimeline'
import type { Feedback } from '../feedback/shared/feedback-utils'

const createMockFeedback = (overrides: Partial<Feedback> = {}): Feedback => ({
  id: 'fb-1',
  feedbackType: 'REVISION_REQUEST',
  comment: 'Please fix this',
  createdAt: '2024-01-15T10:30:00.000Z',
  revisionNumber: 1,
  targetSection: 'summary',
  user: {
    name: 'John Reviewer',
    role: 'ADMIN',
  },
  ...overrides,
})

describe('FeedbackTimeline', () => {
  describe('empty state', () => {
    it('renders empty message when no feedbacks', () => {
      render(<FeedbackTimeline feedbacks={[]} currentRevision={1} />)

      expect(screen.getByText('No feedback history yet')).toBeInTheDocument()
    })

    it('renders custom empty message', () => {
      render(
        <FeedbackTimeline
          feedbacks={[]}
          currentRevision={1}
          emptyMessage="No reviews available"
        />
      )

      expect(screen.getByText('No reviews available')).toBeInTheDocument()
    })

    it('shows helper text in empty state', () => {
      render(<FeedbackTimeline feedbacks={[]} currentRevision={1} />)

      expect(screen.getByText('Feedback from reviewers will appear here.')).toBeInTheDocument()
    })
  })

  describe('header', () => {
    it('renders default title', () => {
      render(<FeedbackTimeline feedbacks={[createMockFeedback()]} currentRevision={1} />)

      expect(screen.getByText('Feedback History')).toBeInTheDocument()
    })

    it('renders custom title', () => {
      render(
        <FeedbackTimeline
          feedbacks={[createMockFeedback()]}
          currentRevision={1}
          title="Review Comments"
        />
      )

      expect(screen.getByText('Review Comments')).toBeInTheDocument()
    })

    it('toggles collapse when header is clicked', () => {
      render(<FeedbackTimeline feedbacks={[createMockFeedback()]} currentRevision={1} />)

      const header = screen.getByText('Feedback History')
      fireEvent.click(header)

      // After collapse, the revision content should be hidden
      expect(screen.queryByText('Please fix this')).not.toBeInTheDocument()
    })
  })

  describe('revision groups', () => {
    it('groups feedbacks by revision', () => {
      const feedbacks = [
        createMockFeedback({ id: 'fb-1', revisionNumber: 1 }),
        createMockFeedback({ id: 'fb-2', revisionNumber: 1 }),
        createMockFeedback({ id: 'fb-3', revisionNumber: 2 }),
      ]

      render(<FeedbackTimeline feedbacks={feedbacks} currentRevision={2} />)

      // Should show revision headers
      expect(screen.getByText(/Revision 1/)).toBeInTheDocument()
      expect(screen.getByText(/Revision 2/)).toBeInTheDocument()
    })

    it('shows revision count in header', () => {
      const feedbacks = [
        createMockFeedback({ id: 'fb-1', revisionNumber: 1 }),
        createMockFeedback({ id: 'fb-2', revisionNumber: 2 }),
      ]

      render(<FeedbackTimeline feedbacks={feedbacks} currentRevision={2} />)

      // Collapse the main timeline
      const header = screen.getByText('Feedback History')
      fireEvent.click(header)

      expect(screen.getByText('2 revision cycles')).toBeInTheDocument()
    })

    it('marks current revision as "Latest"', () => {
      const feedbacks = [
        createMockFeedback({ id: 'fb-1', revisionNumber: 1 }),
        createMockFeedback({ id: 'fb-2', revisionNumber: 2 }),
      ]

      render(<FeedbackTimeline feedbacks={feedbacks} currentRevision={2} />)

      expect(screen.getByText('Latest')).toBeInTheDocument()
    })

    it('marks current revision as "Current" in sidebar variant', () => {
      const feedbacks = [createMockFeedback({ id: 'fb-1', revisionNumber: 1 })]

      render(<FeedbackTimeline feedbacks={feedbacks} currentRevision={1} variant="sidebar" />)

      expect(screen.getByText('Current')).toBeInTheDocument()
    })
  })

  describe('revision transition display', () => {
    it('shows revision transition format by default', () => {
      render(
        <FeedbackTimeline feedbacks={[createMockFeedback()]} currentRevision={1} />
      )

      expect(screen.getByText(/Revision 1 → 2/)).toBeInTheDocument()
    })

    it('shows version format when showRevisionTransition is false', () => {
      render(
        <FeedbackTimeline
          feedbacks={[createMockFeedback()]}
          currentRevision={1}
          showRevisionTransition={false}
        />
      )

      expect(screen.getByText(/Version 1/)).toBeInTheDocument()
    })
  })

  describe('section grouping', () => {
    it('groups feedbacks by section when enabled', () => {
      const feedbacks = [
        createMockFeedback({ id: 'fb-1', targetSection: 'summary' }),
        createMockFeedback({ id: 'fb-2', targetSection: 'results' }),
      ]

      render(
        <FeedbackTimeline feedbacks={feedbacks} currentRevision={1} groupBySection />
      )

      expect(screen.getByText('Summary')).toBeInTheDocument()
      expect(screen.getByText('Calibration Results')).toBeInTheDocument()
    })

    it('shows flat list when groupBySection is false', () => {
      const feedbacks = [
        createMockFeedback({ id: 'fb-1', targetSection: 'summary' }),
        createMockFeedback({ id: 'fb-2', targetSection: 'results' }),
      ]

      render(
        <FeedbackTimeline feedbacks={feedbacks} currentRevision={1} groupBySection={false} />
      )

      // Section headers should not appear
      expect(screen.queryByText('Summary')).not.toBeInTheDocument()
    })
  })

  describe('approvals', () => {
    it('shows approval feedbacks separately', () => {
      const feedbacks = [
        createMockFeedback({ id: 'fb-1', feedbackType: 'REVISION_REQUEST' }),
        createMockFeedback({ id: 'fb-2', feedbackType: 'APPROVED', comment: 'Looks good!' }),
      ]

      render(<FeedbackTimeline feedbacks={feedbacks} currentRevision={1} />)

      // There may be multiple "Approved" elements (badge and header)
      expect(screen.getAllByText('Approved').length).toBeGreaterThan(0)
      expect(screen.getByText('Looks good!')).toBeInTheDocument()
    })

    it('shows approval checkmark in revision header', () => {
      const feedbacks = [
        createMockFeedback({ id: 'fb-1', feedbackType: 'APPROVED' }),
      ]

      render(<FeedbackTimeline feedbacks={feedbacks} currentRevision={1} />)

      expect(screen.getByText('✓ Approved')).toBeInTheDocument()
    })
  })

  describe('customer feedback', () => {
    it('integrates customer feedback into timeline', () => {
      const customerFeedback = {
        notes: 'Needs correction',
        sectionFeedbacks: [
          { section: 'summary', comment: 'Wrong date' },
        ],
        generalNotes: 'Please review',
        customerName: 'Customer Corp',
        customerEmail: 'customer@test.com',
        requestedAt: '2024-01-15T10:30:00.000Z',
        revision: 1,
      }

      render(
        <FeedbackTimeline
          feedbacks={[]}
          currentRevision={1}
          customerFeedback={customerFeedback}
        />
      )

      expect(screen.getByText('Wrong date')).toBeInTheDocument()
      expect(screen.getByText('Please review')).toBeInTheDocument()
    })

    it('shows customer name in feedback items', () => {
      const customerFeedback = {
        notes: '',
        sectionFeedbacks: [{ section: 'summary', comment: 'Fix this' }],
        generalNotes: null,
        customerName: 'Acme Corp',
        customerEmail: 'acme@test.com',
        requestedAt: '2024-01-15T10:30:00.000Z',
        revision: 1,
      }

      render(
        <FeedbackTimeline
          feedbacks={[]}
          currentRevision={1}
          customerFeedback={customerFeedback}
        />
      )

      expect(screen.getByText('Acme Corp')).toBeInTheDocument()
    })
  })

  describe('expanded state', () => {
    it('expands current revision by default', () => {
      const feedbacks = [
        createMockFeedback({ id: 'fb-1', revisionNumber: 1 }),
        createMockFeedback({ id: 'fb-2', revisionNumber: 2, comment: 'Current revision feedback' }),
      ]

      render(<FeedbackTimeline feedbacks={feedbacks} currentRevision={2} />)

      expect(screen.getByText('Current revision feedback')).toBeInTheDocument()
    })

    it('respects defaultExpandedRevisions prop', () => {
      const feedbacks = [
        createMockFeedback({ id: 'fb-1', revisionNumber: 1, comment: 'Revision 1 feedback' }),
        createMockFeedback({ id: 'fb-2', revisionNumber: 2, comment: 'Revision 2 feedback' }),
      ]

      render(
        <FeedbackTimeline
          feedbacks={feedbacks}
          currentRevision={2}
          defaultExpandedRevisions={[1, 2]}
        />
      )

      expect(screen.getByText('Revision 1 feedback')).toBeInTheDocument()
      expect(screen.getByText('Revision 2 feedback')).toBeInTheDocument()
    })

    it('toggles revision expansion when clicked', () => {
      const feedbacks = [
        createMockFeedback({ id: 'fb-1', revisionNumber: 1, comment: 'Revision 1 feedback' }),
      ]

      render(
        <FeedbackTimeline
          feedbacks={feedbacks}
          currentRevision={1}
          defaultExpandedRevisions={[]}
        />
      )

      // Initially collapsed (not in defaultExpandedRevisions)
      expect(screen.queryByText('Revision 1 feedback')).not.toBeInTheDocument()

      // Click to expand
      const revisionHeader = screen.getByText(/Revision 1/)
      fireEvent.click(revisionHeader)

      expect(screen.getByText('Revision 1 feedback')).toBeInTheDocument()
    })
  })

  describe('feedback count', () => {
    it('shows feedback count in revision header', () => {
      const feedbacks = [
        createMockFeedback({ id: 'fb-1', revisionNumber: 1 }),
        createMockFeedback({ id: 'fb-2', revisionNumber: 1 }),
        createMockFeedback({ id: 'fb-3', revisionNumber: 1 }),
      ]

      render(<FeedbackTimeline feedbacks={feedbacks} currentRevision={1} />)

      expect(screen.getByText(/3 feedbacks/)).toBeInTheDocument()
    })

    it('shows singular "feedback" for single item', () => {
      const feedbacks = [createMockFeedback({ id: 'fb-1', revisionNumber: 1 })]

      render(<FeedbackTimeline feedbacks={feedbacks} currentRevision={1} />)

      expect(screen.getByText(/1 feedback(?!s)/)).toBeInTheDocument()
    })

    it('shows section count in revision header', () => {
      const feedbacks = [
        createMockFeedback({ id: 'fb-1', targetSection: 'summary' }),
        createMockFeedback({ id: 'fb-2', targetSection: 'results' }),
      ]

      render(<FeedbackTimeline feedbacks={feedbacks} currentRevision={1} groupBySection />)

      expect(screen.getByText(/2 sections/)).toBeInTheDocument()
    })
  })

  describe('variants', () => {
    it('applies sidebar variant styling', () => {
      render(
        <FeedbackTimeline
          feedbacks={[createMockFeedback()]}
          currentRevision={1}
          variant="sidebar"
        />
      )

      expect(screen.getByText('Current')).toBeInTheDocument()
    })

    it('applies compact variant to feedback items', () => {
      const { container } = render(
        <FeedbackTimeline
          feedbacks={[createMockFeedback()]}
          currentRevision={1}
          variant="compact"
        />
      )

      // Compact variant applies to internal FeedbackItem components
      expect(container.querySelector('.p-2')).toBeInTheDocument()
    })
  })

  describe('current user name', () => {
    it('passes currentUserName to feedback items', () => {
      const feedbacks = [
        createMockFeedback({
          id: 'fb-1',
          user: { name: 'Current Engineer', role: 'ENGINEER' },
          feedbackType: 'ENGINEER_RESPONSE',
        }),
      ]

      render(
        <FeedbackTimeline
          feedbacks={feedbacks}
          currentRevision={1}
          currentUserName="Current Engineer"
        />
      )

      expect(screen.getByText('You')).toBeInTheDocument()
    })
  })
})
