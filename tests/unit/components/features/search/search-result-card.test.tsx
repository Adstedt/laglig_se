import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import { SearchResultCard } from '@/components/features/search/search-result-card'
import type { SearchResult } from '@/app/actions/search'

// Mock next/link
vi.mock('next/link', () => ({
  default: ({
    children,
    href,
  }: {
    children: React.ReactNode
    href: string
  }) => <a href={href}>{children}</a>,
}))

// Mock the search action
vi.mock('@/app/actions/search', () => ({
  trackSearchClickAction: vi.fn(),
}))

describe('SearchResultCard', () => {
  const mockDocument: SearchResult = {
    id: '123',
    title: 'Arbetsmiljölagen (1977:1160)',
    summary: 'Lag om arbetsmiljö',
    slug: 'arbetsmiljolagen-1977-1160',
    documentNumber: 'SFS 1977:1160',
    contentType: 'SFS_LAW',
    status: 'ACTIVE',
    publicationDate: '1977-12-01',
    score: 0.95,
  }

  it('renders document title', () => {
    render(
      <SearchResultCard
        document={mockDocument}
        query="arbetsmiljö"
        position={1}
      />
    )
    expect(screen.getByText(mockDocument.title)).toBeInTheDocument()
  })

  it('uses public URL when isWorkspace is false', () => {
    render(
      <SearchResultCard
        document={mockDocument}
        query="arbetsmiljö"
        position={1}
        isWorkspace={false}
      />
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', `/lagar/${mockDocument.slug}`)
  })

  it('uses workspace URL when isWorkspace is true', () => {
    render(
      <SearchResultCard
        document={mockDocument}
        query="arbetsmiljö"
        position={1}
        isWorkspace={true}
      />
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', `/browse/lagar/${mockDocument.slug}`)
  })

  it('uses correct court case URL for workspace', () => {
    const courtCaseDocument: SearchResult = {
      ...mockDocument,
      id: '456',
      contentType: 'COURT_CASE_HD',
      slug: 'nja-2020-s-123',
    }

    render(
      <SearchResultCard
        document={courtCaseDocument}
        query="test"
        position={1}
        isWorkspace={true}
      />
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute(
      'href',
      `/browse/rattsfall/hd/${courtCaseDocument.slug}`
    )
  })

  it('uses correct EU directive URL for workspace', () => {
    const euDocument: SearchResult = {
      ...mockDocument,
      id: '789',
      contentType: 'EU_DIRECTIVE',
      slug: 'gdpr-2016-679',
    }

    render(
      <SearchResultCard
        document={euDocument}
        query="gdpr"
        position={1}
        isWorkspace={true}
      />
    )
    const link = screen.getByRole('link')
    expect(link).toHaveAttribute(
      'href',
      `/browse/eu/direktiv/${euDocument.slug}`
    )
  })
})
