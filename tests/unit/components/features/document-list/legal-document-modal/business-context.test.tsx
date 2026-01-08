/**
 * Story 6.3: Business Context Unit Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BusinessContext } from '@/components/features/document-list/legal-document-modal/business-context'

// Mock the server action
vi.mock('@/app/actions/legal-document-modal', () => ({
  updateListItemBusinessContext: vi.fn().mockResolvedValue({ success: true }),
}))

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

describe('BusinessContext', () => {
  const defaultProps = {
    listItemId: 'test-item-123',
    initialContent: null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with empty content', () => {
    render(<BusinessContext {...defaultProps} />)

    expect(screen.getByText(/hur påverkar denna lag oss/i)).toBeInTheDocument()
    expect(screen.getByRole('textbox')).toBeInTheDocument()
  })

  it('renders with initial content', () => {
    render(
      <BusinessContext
        {...defaultProps}
        initialContent="This law affects our HR processes."
      />
    )

    expect(screen.getByRole('textbox')).toHaveValue(
      'This law affects our HR processes.'
    )
  })

  it('updates content on typing', async () => {
    const user = userEvent.setup()
    render(<BusinessContext {...defaultProps} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'New business context')

    expect(textarea).toHaveValue('New business context')
  })

  it('shows "Stödjer Markdown-formatering" helper text', () => {
    render(<BusinessContext {...defaultProps} />)

    expect(screen.getByText(/stödjer markdown/i)).toBeInTheDocument()
  })

  it('has placeholder text', () => {
    render(<BusinessContext {...defaultProps} />)

    expect(
      screen.getByPlaceholderText(/beskriv hur denna lag/i)
    ).toBeInTheDocument()
  })

  it('shows saving indicator when saving', async () => {
    const user = userEvent.setup()

    // Make the mock delay a bit
    const { updateListItemBusinessContext } = await import(
      '@/app/actions/legal-document-modal'
    )
    vi.mocked(updateListItemBusinessContext).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ success: true }), 100)
        )
    )

    render(<BusinessContext {...defaultProps} />)

    const textarea = screen.getByRole('textbox')
    await user.type(textarea, 'Test')

    // Wait for the debounce (1000ms) and then check for saving indicator
    await waitFor(
      () => {
        expect(screen.getByText(/sparar/i)).toBeInTheDocument()
      },
      { timeout: 2000 }
    )
  })
})
