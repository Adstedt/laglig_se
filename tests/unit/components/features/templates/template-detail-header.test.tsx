import { vi, describe, beforeEach, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { TemplateDetail } from '@/lib/db/queries/template-catalog'

vi.mock('next/link', () => ({
  default: ({
    children,
    href,
    ...props
  }: {
    children: React.ReactNode
    href: string
    className?: string
  }) => (
    <a href={href} {...props}>
      {children}
    </a>
  ),
}))

import { TemplateDetailHeader } from '@/components/features/templates/template-detail-header'

const mockTemplate: TemplateDetail = {
  id: 'uuid-1',
  name: 'Arbetsmiljö',
  slug: 'arbetsmiljo',
  description: 'Omfattande lagkrav för alla svenska arbetsgivare.',
  domain: 'arbetsmiljo',
  target_audience: 'Alla svenska arbetsgivare oavsett bransch',
  document_count: 112,
  section_count: 9,
  primary_regulatory_bodies: ['Arbetsmiljöverket', 'Riksdagen'],
  is_variant: false,
  updated_at: '2026-02-10T00:00:00.000Z',
  parent_slug: null,
  variants: [],
  sections: [],
}

describe('TemplateDetailHeader', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders template name as heading', () => {
    render(<TemplateDetailHeader template={mockTemplate} />)

    expect(
      screen.getByRole('heading', { name: 'Arbetsmiljö' })
    ).toBeInTheDocument()
  })

  it('renders description', () => {
    render(<TemplateDetailHeader template={mockTemplate} />)

    expect(
      screen.getByText('Omfattande lagkrav för alla svenska arbetsgivare.')
    ).toBeInTheDocument()
  })

  it('shows domain badge with correct label', () => {
    render(<TemplateDetailHeader template={mockTemplate} />)

    // Both heading and badge contain "Arbetsmiljö"
    const elements = screen.getAllByText('Arbetsmiljö')
    expect(elements.length).toBeGreaterThanOrEqual(2)
  })

  it('shows target audience badge when present', () => {
    render(<TemplateDetailHeader template={mockTemplate} />)

    expect(
      screen.getByText('Alla svenska arbetsgivare oavsett bransch')
    ).toBeInTheDocument()
  })

  it('does not render target audience badge when null', () => {
    const noAudience = { ...mockTemplate, target_audience: null }
    render(<TemplateDetailHeader template={noAudience} />)

    expect(
      screen.queryByText('Alla svenska arbetsgivare oavsett bransch')
    ).not.toBeInTheDocument()
  })

  it('shows regulatory body badges', () => {
    render(<TemplateDetailHeader template={mockTemplate} />)

    expect(screen.getByText('Arbetsmiljöverket')).toBeInTheDocument()
    expect(screen.getByText('Riksdagen')).toBeInTheDocument()
  })

  it('shows stats bar with document count', () => {
    render(<TemplateDetailHeader template={mockTemplate} />)

    expect(screen.getByText(/112 lagar/)).toBeInTheDocument()
  })

  it('shows stats bar with section count', () => {
    render(<TemplateDetailHeader template={mockTemplate} />)

    expect(screen.getByText(/9 kategorier/)).toBeInTheDocument()
  })

  it('shows stats bar with formatted date', () => {
    render(<TemplateDetailHeader template={mockTemplate} />)

    // date-fns sv locale formats as "10 feb 2026" → displayed as "Uppdaterad 10 feb. 2026" or similar
    expect(screen.getByText(/Uppdaterad.*2026/)).toBeInTheDocument()
  })

  it('does not render description when null', () => {
    const noDesc = { ...mockTemplate, description: null }
    render(<TemplateDetailHeader template={noDesc} />)

    expect(
      screen.queryByText('Omfattande lagkrav för alla svenska arbetsgivare.')
    ).not.toBeInTheDocument()
  })
})
