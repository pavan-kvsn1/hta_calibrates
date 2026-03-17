import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'
import { createRef } from 'react'
import TypedSignature, { type TypedSignatureHandle } from '../signatures/TypedSignature'

// Mock canvas context
const mockContext = {
  clearRect: vi.fn(),
  fillText: vi.fn(),
  measureText: vi.fn(() => ({ width: 100 })),
  font: '',
  fillStyle: '',
  textBaseline: '',
}

// Mock canvas element
const mockCanvas = {
  getContext: vi.fn(() => mockContext),
  toDataURL: vi.fn(() => 'data:image/png;base64,mockSignature'),
  width: 320,
  height: 120,
}

describe('TypedSignature', () => {
  beforeEach(() => {
    vi.clearAllMocks()

    // Mock document.fonts
    Object.defineProperty(document, 'fonts', {
      value: {
        ready: Promise.resolve(),
        check: vi.fn(() => true),
      },
      writable: true,
    })

    // Mock HTMLCanvasElement
    vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => mockContext as unknown as CanvasRenderingContext2D)
    vi.spyOn(HTMLCanvasElement.prototype, 'toDataURL').mockImplementation(() => 'data:image/png;base64,mockSignature')
  })

  afterEach(() => {
    vi.restoreAllMocks()
  })

  describe('rendering', () => {
    it('renders with placeholder when name is empty', async () => {
      render(<TypedSignature name="" />)

      await waitFor(() => {
        expect(screen.getByText('Your signature')).toBeInTheDocument()
      })
    })

    it('renders the provided name', async () => {
      render(<TypedSignature name="John Doe" />)

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
    })

    it('shows helper text when name is empty', async () => {
      render(<TypedSignature name="" />)

      await waitFor(() => {
        expect(screen.getByText('Enter your name above to generate signature')).toBeInTheDocument()
      })
    })

    it('hides helper text when name is provided', async () => {
      render(<TypedSignature name="John Doe" />)

      await waitFor(() => {
        expect(screen.queryByText('Enter your name above to generate signature')).not.toBeInTheDocument()
      })
    })

    it('applies custom className', async () => {
      const { container } = render(<TypedSignature name="Test" className="custom-class" />)

      expect(container.firstChild).toHaveClass('custom-class')
    })
  })

  describe('imperative handle', () => {
    it('provides clear method', async () => {
      const ref = createRef<TypedSignatureHandle>()
      render(<TypedSignature name="John Doe" ref={ref} />)

      await waitFor(() => {
        expect(ref.current).toBeDefined()
      })

      act(() => {
        ref.current?.clear()
      })

      expect(mockContext.clearRect).toHaveBeenCalled()
    })

    it('provides isEmpty method', async () => {
      const ref = createRef<TypedSignatureHandle>()
      render(<TypedSignature name="" ref={ref} />)

      await waitFor(() => {
        expect(ref.current).toBeDefined()
      })

      expect(ref.current?.isEmpty()).toBe(true)
    })

    it('isEmpty returns false when name is provided', async () => {
      const ref = createRef<TypedSignatureHandle>()
      render(<TypedSignature name="John Doe" ref={ref} />)

      await waitFor(() => {
        expect(ref.current?.isEmpty()).toBe(false)
      })
    })

    it('provides toDataURL method', async () => {
      const ref = createRef<TypedSignatureHandle>()
      render(<TypedSignature name="John Doe" ref={ref} />)

      await waitFor(() => {
        expect(ref.current).toBeDefined()
      })

      const dataUrl = ref.current?.toDataURL()
      // toDataURL returns a string (either empty or data URL)
      expect(typeof dataUrl).toBe('string')
    })

    it('toDataURL returns empty string when no signature', async () => {
      const ref = createRef<TypedSignatureHandle>()
      render(<TypedSignature name="" ref={ref} />)

      await waitFor(() => {
        expect(ref.current).toBeDefined()
      })

      const dataUrl = ref.current?.toDataURL()
      expect(dataUrl).toBe('')
    })
  })

  describe('onSignatureReady callback', () => {
    it('calls onSignatureReady with true when name is provided', async () => {
      const onSignatureReady = vi.fn()
      render(<TypedSignature name="John Doe" onSignatureReady={onSignatureReady} />)

      await waitFor(() => {
        expect(onSignatureReady).toHaveBeenCalledWith(true)
      })
    })

    it('calls onSignatureReady with false when name is empty', async () => {
      const onSignatureReady = vi.fn()
      render(<TypedSignature name="" onSignatureReady={onSignatureReady} />)

      await waitFor(() => {
        expect(onSignatureReady).toHaveBeenCalledWith(false)
      })
    })

    it('calls onSignatureReady with false after clear', async () => {
      const onSignatureReady = vi.fn()
      const ref = createRef<TypedSignatureHandle>()
      render(<TypedSignature name="John Doe" ref={ref} onSignatureReady={onSignatureReady} />)

      await waitFor(() => {
        expect(onSignatureReady).toHaveBeenCalledWith(true)
      })

      act(() => {
        ref.current?.clear()
      })

      expect(onSignatureReady).toHaveBeenLastCalledWith(false)
    })
  })

  describe('canvas dimensions', () => {
    it('uses default dimensions', () => {
      const { container } = render(<TypedSignature name="Test" />)

      const canvas = container.querySelector('canvas')
      expect(canvas).toHaveAttribute('width', '320')
      expect(canvas).toHaveAttribute('height', '120')
    })

    it('accepts custom dimensions', () => {
      const { container } = render(<TypedSignature name="Test" width={500} height={200} />)

      const canvas = container.querySelector('canvas')
      expect(canvas).toHaveAttribute('width', '500')
      expect(canvas).toHaveAttribute('height', '200')
    })
  })

  describe('name trimming', () => {
    it('trims whitespace from name', async () => {
      render(<TypedSignature name="  John Doe  " />)

      await waitFor(() => {
        expect(screen.getByText('John Doe')).toBeInTheDocument()
      })
    })

    it('treats whitespace-only name as empty', async () => {
      render(<TypedSignature name="   " />)

      await waitFor(() => {
        expect(screen.getByText('Your signature')).toBeInTheDocument()
      })
    })
  })
})
