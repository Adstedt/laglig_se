/**
 * Story 8.1 Task 5: PriorityFilter component tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { PriorityFilter } from '@/components/features/changes/priority-filter'

// Mock next/navigation
const mockReplace = vi.fn()
let mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    replace: mockReplace,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
}))

describe('PriorityFilter (Story 8.1)', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    mockSearchParams = new URLSearchParams()
  })

  it('renders all filter options', () => {
    render(<PriorityFilter />)

    expect(screen.getByText('Alla')).toBeInTheDocument()
    expect(screen.getByText('Hög')).toBeInTheDocument()
    expect(screen.getByText('Medel')).toBeInTheDocument()
    expect(screen.getByText('Låg')).toBeInTheDocument()
  })

  it('shows "Visa:" label', () => {
    render(<PriorityFilter />)
    expect(screen.getByText('Visa:')).toBeInTheDocument()
  })

  it('sets URL param when HIGH is clicked', async () => {
    const user = userEvent.setup()
    render(<PriorityFilter />)

    await user.click(screen.getByText('Hög'))

    expect(mockReplace).toHaveBeenCalledWith(
      expect.stringContaining('priority=HIGH'),
      { scroll: false }
    )
  })

  it('removes priority param when "Alla" is clicked', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('priority=HIGH')
    render(<PriorityFilter />)

    await user.click(screen.getByText('Alla'))

    expect(mockReplace).toHaveBeenCalled()
    const calledUrl = mockReplace.mock.calls[0]?.[0] as string
    expect(calledUrl).not.toContain('priority=')
  })

  it('preserves existing params (tab, document) when changing filter', async () => {
    const user = userEvent.setup()
    mockSearchParams = new URLSearchParams('tab=changes&document=doc-1')
    render(<PriorityFilter />)

    await user.click(screen.getByText('Medel'))

    const calledUrl = mockReplace.mock.calls[0]?.[0] as string
    expect(calledUrl).toContain('tab=changes')
    expect(calledUrl).toContain('document=doc-1')
    expect(calledUrl).toContain('priority=MEDIUM')
  })
})
