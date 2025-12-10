import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CatalogueSearchBar } from '@/components/features/catalogue/catalogue-search-bar'

// Mock Next.js navigation
const mockPush = vi.fn()
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

// Mock the autocomplete action
vi.mock('@/app/actions/browse', () => ({
  catalogueAutocompleteAction: vi.fn().mockResolvedValue({
    suggestions: [
      {
        title: 'Arbetsmiljölag (1977:1160)',
        slug: 'arbetsmiljolag-1977-1160',
        type: 'SFS_LAW',
        documentNumber: 'SFS 1977:1160',
      },
    ],
  }),
}))

describe('CatalogueSearchBar', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders search input', () => {
    render(<CatalogueSearchBar initialQuery="" basePath="/rattskallor" />)
    expect(
      screen.getByPlaceholderText('Sök lagar, rättsfall, EU-lagstiftning...')
    ).toBeInTheDocument()
  })

  it('renders with initial query', () => {
    render(
      <CatalogueSearchBar initialQuery="arbetsmiljö" basePath="/rattskallor" />
    )
    expect(screen.getByDisplayValue('arbetsmiljö')).toBeInTheDocument()
  })

  it('renders search button', () => {
    render(<CatalogueSearchBar initialQuery="" basePath="/rattskallor" />)
    expect(screen.getByRole('button', { name: 'Sök' })).toBeInTheDocument()
  })

  it('shows clear button when query is entered', async () => {
    render(<CatalogueSearchBar initialQuery="" basePath="/rattskallor" />)

    const input = screen.getByPlaceholderText(
      'Sök lagar, rättsfall, EU-lagstiftning...'
    )
    await userEvent.type(input, 'test')

    // Clear button should appear
    await waitFor(() => {
      const clearButton = screen.getByRole('button', { name: '' })
      expect(clearButton).toBeInTheDocument()
    })
  })

  it('submits search on form submit', async () => {
    render(<CatalogueSearchBar initialQuery="" basePath="/rattskallor" />)

    const input = screen.getByPlaceholderText(
      'Sök lagar, rättsfall, EU-lagstiftning...'
    )
    await userEvent.type(input, 'arbetsmiljö')

    const form = input.closest('form')!
    fireEvent.submit(form)

    expect(mockPush).toHaveBeenCalledWith('/rattskallor?q=arbetsmilj%C3%B6')
  })

  it('clears search when clear button is clicked', async () => {
    render(
      <CatalogueSearchBar initialQuery="arbetsmiljö" basePath="/rattskallor" />
    )

    // Find the clear button (X icon button)
    const buttons = screen.getAllByRole('button')
    const clearButton = buttons.find((btn) => !btn.textContent?.includes('Sök'))
    if (clearButton) {
      await userEvent.click(clearButton)
      expect(mockPush).toHaveBeenCalledWith('/rattskallor')
    }
  })

  it('preserves basePath in navigation', async () => {
    render(<CatalogueSearchBar initialQuery="" basePath="/rattskallor/lagar" />)

    const input = screen.getByPlaceholderText(
      'Sök lagar, rättsfall, EU-lagstiftning...'
    )
    await userEvent.type(input, 'test')

    const form = input.closest('form')!
    fireEvent.submit(form)

    expect(mockPush).toHaveBeenCalledWith('/rattskallor/lagar?q=test')
  })
})
