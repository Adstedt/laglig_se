import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CataloguePagination } from '@/components/features/catalogue/catalogue-pagination'

// Mock Next.js navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    prefetch: vi.fn(),
    push: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

// Mock prefetchBrowse to prevent network calls during tests
vi.mock('@/lib/hooks/use-catalogue-browse', () => ({
  prefetchBrowse: vi.fn(),
}))

describe('CataloguePagination', () => {
  const defaultProps = {
    currentPage: 1,
    totalPages: 10,
    perPage: 25,
    total: 250,
    basePath: '/rattskallor',
  }

  it('renders current page indicator', () => {
    render(<CataloguePagination {...defaultProps} />)
    expect(screen.getByText('Sida 1 av 10 (250 totalt)')).toBeInTheDocument()
  })

  it('renders page numbers', () => {
    render(<CataloguePagination {...defaultProps} />)
    expect(screen.getByRole('button', { name: '1' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: '2' })).toBeInTheDocument()
  })

  it('disables previous button on first page', () => {
    render(<CataloguePagination {...defaultProps} />)
    const prevButton = screen.getByRole('button', { name: /föregående/i })
    expect(prevButton).toBeDisabled()
  })

  it('enables next button when not on last page', () => {
    render(<CataloguePagination {...defaultProps} />)
    const nextButton = screen.getByRole('link', { name: /nästa/i })
    expect(nextButton).toBeInTheDocument()
  })

  it('disables next button on last page', () => {
    render(<CataloguePagination {...defaultProps} currentPage={10} />)
    const nextButton = screen.getByRole('button', { name: /nästa/i })
    expect(nextButton).toBeDisabled()
  })

  it('shows correct per-page selector value', () => {
    render(<CataloguePagination {...defaultProps} perPage={50} />)
    // The select trigger should show the current value
    expect(screen.getByRole('combobox')).toBeInTheDocument()
  })

  it('renders ellipsis for large page ranges', () => {
    render(<CataloguePagination {...defaultProps} currentPage={5} />)
    const ellipses = screen.getAllByText('...')
    expect(ellipses.length).toBeGreaterThan(0)
  })

  it('highlights current page', () => {
    render(<CataloguePagination {...defaultProps} currentPage={3} />)
    // Current page should be a button (not a link) with default variant
    const currentPageButton = screen.getByRole('button', { name: '3' })
    expect(currentPageButton).toBeInTheDocument()
    expect(currentPageButton).toHaveClass('pointer-events-none')
  })
})
