/**
 * Story 8.1 Task 6: ChangeIndicator component tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ChangeIndicator } from '@/components/features/changes/change-indicator'

// Mock next/navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    replace: vi.fn(),
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

describe('ChangeIndicator (Story 8.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders with count when pendingChangeCount > 0', () => {
    render(<ChangeIndicator count={2} documentId="doc-1" />)
    expect(screen.getByText('2 ändringar')).toBeInTheDocument()
  })

  it('renders singular form for count = 1', () => {
    render(<ChangeIndicator count={1} documentId="doc-1" />)
    expect(screen.getByText('1 ändring')).toBeInTheDocument()
  })

  it('renders nothing when count is 0', () => {
    const { container } = render(
      <ChangeIndicator count={0} documentId="doc-1" />
    )
    expect(container.innerHTML).toBe('')
  })

  it('navigates to changes tab filtered by document on click', async () => {
    const user = userEvent.setup()
    render(<ChangeIndicator count={1} documentId="doc-42" />)

    const button = screen.getByRole('button')
    await user.click(button)

    expect(mockPush).toHaveBeenCalledWith(
      '/laglistor?tab=changes&document=doc-42'
    )
  })

  it('has accessible aria-label for 1 change', () => {
    render(<ChangeIndicator count={1} documentId="doc-1" />)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', '1 oläst ändring')
  })

  it('has accessible aria-label for multiple changes', () => {
    render(<ChangeIndicator count={3} documentId="doc-1" />)
    const button = screen.getByRole('button')
    expect(button).toHaveAttribute('aria-label', '3 olästa ändringar')
  })

  it('stops event propagation to prevent row click', async () => {
    const user = userEvent.setup()
    const parentClick = vi.fn()

    render(
      // eslint-disable-next-line jsx-a11y/no-static-element-interactions, jsx-a11y/click-events-have-key-events
      <div onClick={parentClick}>
        <ChangeIndicator count={1} documentId="doc-1" />
      </div>
    )

    const button = screen.getByRole('button')
    await user.click(button)

    expect(parentClick).not.toHaveBeenCalled()
    expect(mockPush).toHaveBeenCalled()
  })
})
