import { describe, it, expect, vi } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import { CitedLawsSummary } from '@/components/features/cross-references/cited-laws-summary'

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

describe('CitedLawsSummary', () => {
  const mockCitedLaws = [
    {
      id: '1',
      title: 'Arbetsmiljölagen',
      slug: 'arbetsmiljolagen-1977-1160',
      document_number: 'SFS 1977:1160',
    },
    {
      id: '2',
      title: 'Diskrimineringslagen',
      slug: 'diskrimineringslagen-2008-567',
      document_number: 'SFS 2008:567',
    },
  ]

  it('does not render when citedLaws is empty', () => {
    const { container } = render(<CitedLawsSummary citedLaws={[]} />)
    expect(container.firstChild).toBeNull()
  })

  it('renders the cited laws count', () => {
    render(<CitedLawsSummary citedLaws={mockCitedLaws} />)
    expect(screen.getByText('2 lagar')).toBeInTheDocument()
  })

  it('shows law links when expanded', () => {
    render(<CitedLawsSummary citedLaws={mockCitedLaws} />)

    // Click to expand
    fireEvent.click(screen.getByText('Citerade lagar'))

    // Check links are visible
    expect(screen.getByText('Arbetsmiljölagen')).toBeInTheDocument()
    expect(screen.getByText('Diskrimineringslagen')).toBeInTheDocument()
  })

  it('uses public URLs when isWorkspace is false', () => {
    render(<CitedLawsSummary citedLaws={mockCitedLaws} isWorkspace={false} />)

    // Expand to show links
    fireEvent.click(screen.getByText('Citerade lagar'))

    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute(
      'href',
      '/lagar/arbetsmiljolagen-1977-1160'
    )
    expect(links[1]).toHaveAttribute(
      'href',
      '/lagar/diskrimineringslagen-2008-567'
    )
  })

  it('uses workspace URLs when isWorkspace is true', () => {
    render(<CitedLawsSummary citedLaws={mockCitedLaws} isWorkspace={true} />)

    // Expand to show links
    fireEvent.click(screen.getByText('Citerade lagar'))

    const links = screen.getAllByRole('link')
    expect(links[0]).toHaveAttribute(
      'href',
      '/browse/lagar/arbetsmiljolagen-1977-1160'
    )
    expect(links[1]).toHaveAttribute(
      'href',
      '/browse/lagar/diskrimineringslagen-2008-567'
    )
  })
})
