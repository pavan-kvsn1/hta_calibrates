import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { ViewToggleButton, type ViewToggleButtonProps } from './ViewToggleButton'

describe('ViewToggleButton', () => {
  const defaultProps: ViewToggleButtonProps = {
    viewMode: 'details',
    onViewModeChange: vi.fn(),
  }

  describe('rendering in details mode', () => {
    it('shows "Preview PDF" button when not authorized', () => {
      render(<ViewToggleButton {...defaultProps} />)

      expect(screen.getByText('Preview PDF')).toBeInTheDocument()
    })

    it('shows "Download PDF" button when authorized', () => {
      render(<ViewToggleButton {...defaultProps} isAuthorized={true} onDownload={vi.fn()} />)

      expect(screen.getByText('Download PDF')).toBeInTheDocument()
      expect(screen.queryByText('Preview PDF')).not.toBeInTheDocument()
    })

    it('shows "Downloading..." when isDownloading is true', () => {
      render(
        <ViewToggleButton
          {...defaultProps}
          isAuthorized={true}
          onDownload={vi.fn()}
          isDownloading={true}
        />
      )

      expect(screen.getByText('Downloading...')).toBeInTheDocument()
    })
  })

  describe('rendering in PDF mode', () => {
    it('shows "View Details" button', () => {
      render(<ViewToggleButton {...defaultProps} viewMode="pdf" />)

      expect(screen.getByText('View Details')).toBeInTheDocument()
    })

    it('shows "View Details" even when authorized', () => {
      render(<ViewToggleButton {...defaultProps} viewMode="pdf" isAuthorized={true} />)

      expect(screen.getByText('View Details')).toBeInTheDocument()
    })
  })

  describe('click behavior', () => {
    it('calls onViewModeChange with "pdf" when clicking Preview PDF', () => {
      const onViewModeChange = vi.fn()
      render(<ViewToggleButton {...defaultProps} onViewModeChange={onViewModeChange} />)

      fireEvent.click(screen.getByText('Preview PDF'))

      expect(onViewModeChange).toHaveBeenCalledWith('pdf')
    })

    it('calls onViewModeChange with "details" when in PDF mode', () => {
      const onViewModeChange = vi.fn()
      render(
        <ViewToggleButton {...defaultProps} viewMode="pdf" onViewModeChange={onViewModeChange} />
      )

      fireEvent.click(screen.getByText('View Details'))

      expect(onViewModeChange).toHaveBeenCalledWith('details')
    })

    it('calls onDownload when authorized and clicking Download PDF', () => {
      const onDownload = vi.fn()
      const onViewModeChange = vi.fn()
      render(
        <ViewToggleButton
          {...defaultProps}
          isAuthorized={true}
          onDownload={onDownload}
          onViewModeChange={onViewModeChange}
        />
      )

      fireEvent.click(screen.getByText('Download PDF'))

      expect(onDownload).toHaveBeenCalled()
      expect(onViewModeChange).not.toHaveBeenCalled()
    })

    it('does not call onDownload when not provided', () => {
      const onViewModeChange = vi.fn()
      render(
        <ViewToggleButton
          {...defaultProps}
          isAuthorized={true}
          onViewModeChange={onViewModeChange}
        />
      )

      fireEvent.click(screen.getByText('Download PDF'))

      // Should fall back to view mode change if no download handler
      expect(onViewModeChange).toHaveBeenCalledWith('pdf')
    })
  })

  describe('disabled state', () => {
    it('disables button when downloading', () => {
      render(
        <ViewToggleButton
          {...defaultProps}
          isAuthorized={true}
          onDownload={vi.fn()}
          isDownloading={true}
        />
      )

      const button = screen.getByRole('button')
      expect(button).toBeDisabled()
    })

    it('enables button when not downloading', () => {
      render(
        <ViewToggleButton
          {...defaultProps}
          isAuthorized={true}
          onDownload={vi.fn()}
          isDownloading={false}
        />
      )

      const button = screen.getByRole('button')
      expect(button).not.toBeDisabled()
    })
  })

  describe('styling', () => {
    it('applies blue styling when authorized in details mode', () => {
      const { container } = render(
        <ViewToggleButton {...defaultProps} isAuthorized={true} onDownload={vi.fn()} />
      )

      const button = container.querySelector('button')
      expect(button).toHaveClass('bg-blue-600')
      expect(button).toHaveClass('text-white')
    })

    it('applies default styling when not authorized', () => {
      const { container } = render(<ViewToggleButton {...defaultProps} />)

      const button = container.querySelector('button')
      expect(button).toHaveClass('bg-white')
      expect(button).toHaveClass('text-gray-700')
    })

    it('applies default styling in PDF mode even when authorized', () => {
      const { container } = render(
        <ViewToggleButton {...defaultProps} viewMode="pdf" isAuthorized={true} />
      )

      const button = container.querySelector('button')
      expect(button).toHaveClass('bg-white')
    })
  })
})
