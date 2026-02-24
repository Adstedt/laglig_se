import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import { CatalogueResultCard } from '@/components/features/catalogue/catalogue-result-card'
import type { BrowseResult } from '@/app/actions/browse'

// Mock next/navigation
vi.mock('next/navigation', () => ({
  useRouter: () => ({
    prefetch: vi.fn(),
    push: vi.fn(),
    replace: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

// Mock prefetch manager
vi.mock('@/lib/prefetch', () => ({
  prefetchManager: {
    init: vi.fn(),
    add: vi.fn(),
  },
}))

// Mock IntersectionObserver as a proper class
class MockIntersectionObserver {
  readonly root: Element | null = null
  readonly rootMargin: string = ''
  readonly thresholds: ReadonlyArray<number> = []
  observe = vi.fn()
  unobserve = vi.fn()
  disconnect = vi.fn()
  takeRecords = vi.fn(() => [])
}

beforeEach(() => {
  global.IntersectionObserver =
    MockIntersectionObserver as unknown as typeof IntersectionObserver
})

afterEach(() => {
  vi.clearAllMocks()
})

describe('CatalogueResultCard', () => {
  const mockDocument: BrowseResult = {
    id: '123',
    title: 'Arbetsmiljölag (1977:1160)',
    documentNumber: 'SFS 1977:1160',
    contentType: 'SFS_LAW',
    category: 'Arbetsrätt',
    summary: 'Lagen innehåller bestämmelser om arbetsmiljön...',
    effectiveDate: '1978-07-01T00:00:00.000Z',
    status: 'ACTIVE',
    slug: 'arbetsmiljolag-1977-1160',
    snippet: 'Lagen innehåller <mark>bestämmelser</mark> om arbetsmiljön...',
  }

  it('renders document title', () => {
    render(
      <CatalogueResultCard document={mockDocument} query="" position={1} />
    )
    expect(screen.getByText('Arbetsmiljölag (1977:1160)')).toBeInTheDocument()
  })

  it('renders document number', () => {
    render(
      <CatalogueResultCard document={mockDocument} query="" position={1} />
    )
    expect(screen.getByText('SFS 1977:1160')).toBeInTheDocument()
  })

  it('renders content type badge', () => {
    render(
      <CatalogueResultCard document={mockDocument} query="" position={1} />
    )
    expect(screen.getByText('Lag')).toBeInTheDocument()
  })

  it('renders active status badge', () => {
    render(
      <CatalogueResultCard document={mockDocument} query="" position={1} />
    )
    expect(screen.getByText('Gällande')).toBeInTheDocument()
  })

  it('renders repealed status badge', () => {
    const repealedDoc: BrowseResult = {
      ...mockDocument,
      status: 'REPEALED',
    }
    render(<CatalogueResultCard document={repealedDoc} query="" position={1} />)
    expect(screen.getByText('Upphävd')).toBeInTheDocument()
  })

  it('renders effective date', () => {
    render(
      <CatalogueResultCard document={mockDocument} query="" position={1} />
    )
    expect(screen.getByText('1978-07-01')).toBeInTheDocument()
  })

  it('renders snippet with HTML markup', () => {
    render(
      <CatalogueResultCard document={mockDocument} query="" position={1} />
    )
    // Check that the snippet text is rendered
    const snippetElement = screen.getByText(/bestämmelser/i)
    expect(snippetElement).toBeInTheDocument()
  })

  it('renders category tag', () => {
    render(
      <CatalogueResultCard document={mockDocument} query="" position={1} />
    )
    expect(screen.getByText('Arbetsrätt')).toBeInTheDocument()
  })

  it('links to correct document URL', () => {
    render(
      <CatalogueResultCard document={mockDocument} query="" position={1} />
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/lagar/arbetsmiljolag-1977-1160')
  })

  it('renders court case with correct theme', () => {
    const courtCase: BrowseResult = {
      ...mockDocument,
      contentType: 'COURT_CASE_AD',
      title: 'AD 2023 nr 45',
      documentNumber: 'AD 2023 nr 45',
      slug: 'ad-2023-nr-45',
    }
    render(<CatalogueResultCard document={courtCase} query="" position={1} />)
    expect(screen.getByText('Arbetsdomstolen')).toBeInTheDocument()
  })

  it('renders EU document with correct theme', () => {
    const euDoc: BrowseResult = {
      ...mockDocument,
      contentType: 'EU_REGULATION',
      title: 'GDPR',
      documentNumber: 'EU 2016/679',
      slug: 'eu-2016-679',
    }
    render(<CatalogueResultCard document={euDoc} query="" position={1} />)
    expect(screen.getByText('EU-förordning')).toBeInTheDocument()
  })

  it('handles missing effective date', () => {
    const docWithoutDate: BrowseResult = {
      ...mockDocument,
      effectiveDate: null,
    }
    render(
      <CatalogueResultCard document={docWithoutDate} query="" position={1} />
    )
    // Should not crash and should render without date
    expect(screen.getByText('Arbetsmiljölag (1977:1160)')).toBeInTheDocument()
  })

  it('handles missing category', () => {
    const docWithoutCategory: BrowseResult = {
      ...mockDocument,
      category: null,
    }
    render(
      <CatalogueResultCard
        document={docWithoutCategory}
        query=""
        position={1}
      />
    )
    // Should not crash and should render without category
    expect(screen.getByText('Arbetsmiljölag (1977:1160)')).toBeInTheDocument()
    expect(screen.queryByText('Arbetsrätt')).not.toBeInTheDocument()
  })
})
