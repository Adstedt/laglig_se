import { vi, describe, beforeEach, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { PublishedTemplate } from '@/lib/db/queries/template-catalog'

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

import { TemplateCard } from '@/components/features/templates/template-card'

const mockTemplate: PublishedTemplate = {
  id: 'uuid-1',
  name: 'Arbetsmiljö',
  slug: 'arbetsmiljo',
  description:
    'Omfattande lagkrav för alla svenska arbetsgivare inom arbetsmiljöområdet.',
  domain: 'arbetsmiljo',
  target_audience: 'Alla svenska arbetsgivare oavsett bransch',
  document_count: 112,
  section_count: 9,
  primary_regulatory_bodies: ['Arbetsmiljöverket', 'Riksdagen'],
  is_variant: false,
  variants: [
    {
      id: 'uuid-2',
      name: 'Arbetsmiljö för tjänsteföretag',
      slug: 'arbetsmiljo-tjansteforetag',
      document_count: 55,
      section_count: 7,
      target_audience: 'Tjänsteföretag',
    },
  ],
}

const mockTemplateNoVariants: PublishedTemplate = {
  id: 'uuid-3',
  name: 'Miljö',
  slug: 'miljo',
  description: 'Miljölagstiftning för verksamheter med miljöpåverkan.',
  domain: 'miljo',
  target_audience: 'Verksamheter med miljöpåverkan',
  document_count: 98,
  section_count: 9,
  primary_regulatory_bodies: ['Naturvårdsverket', 'Riksdagen'],
  is_variant: false,
  variants: [],
}

describe('TemplateCard', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders template name, domain badge, and stats', () => {
    render(<TemplateCard template={mockTemplate} />)

    // Name and badge both contain "Arbetsmiljö"
    const elements = screen.getAllByText('Arbetsmiljö')
    expect(elements.length).toBeGreaterThanOrEqual(2)
    expect(screen.getByTestId('document-count')).toHaveTextContent('112')
    expect(screen.getByTestId('section-count')).toHaveTextContent('9')
  })

  it('renders description truncated to ~120 chars', () => {
    const longDesc =
      'A'.repeat(130) + ' extra text that should be cut off from the card'
    const template = { ...mockTemplateNoVariants, description: longDesc }
    render(<TemplateCard template={template} />)

    const desc = screen.getByText(/^A+\.\.\./)
    expect(desc).toBeInTheDocument()
  })

  it('renders target audience text', () => {
    render(<TemplateCard template={mockTemplate} />)

    expect(
      screen.getByText(/För:.*Alla svenska arbetsgivare oavsett bransch/)
    ).toBeInTheDocument()
  })

  it('renders regulatory bodies as dot-separated text', () => {
    render(<TemplateCard template={mockTemplate} />)

    expect(screen.getByText(/Arbetsmiljöverket/)).toBeInTheDocument()
    expect(screen.getByText(/Riksdagen/)).toBeInTheDocument()
  })

  it('links to correct detail page URL', () => {
    render(<TemplateCard template={mockTemplate} />)

    const link = screen.getByRole('link')
    expect(link).toHaveAttribute('href', '/laglistor/mallar/arbetsmiljo')
  })

  it('shows variant toggle only on cards with variants', () => {
    render(<TemplateCard template={mockTemplate} />)

    expect(screen.getByText('Visa tjänsteföretagsversion')).toBeInTheDocument()
  })

  it('does not show variant toggle on cards without variants', () => {
    render(<TemplateCard template={mockTemplateNoVariants} />)

    expect(
      screen.queryByText('Visa tjänsteföretagsversion')
    ).not.toBeInTheDocument()
  })

  it('updates stats and link when variant toggle is activated', async () => {
    const user = userEvent.setup()
    render(<TemplateCard template={mockTemplate} />)

    // Initial state: parent stats
    expect(screen.getByTestId('document-count')).toHaveTextContent('112')
    expect(screen.getByTestId('section-count')).toHaveTextContent('9')
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/laglistor/mallar/arbetsmiljo'
    )

    // Toggle on
    const toggle = screen.getByRole('switch')
    await user.click(toggle)

    // Variant stats
    expect(screen.getByTestId('document-count')).toHaveTextContent('55')
    expect(screen.getByTestId('section-count')).toHaveTextContent('7')
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/laglistor/mallar/arbetsmiljo-tjansteforetag'
    )

    // Toggle off — back to parent
    await user.click(toggle)

    expect(screen.getByTestId('document-count')).toHaveTextContent('112')
    expect(screen.getByRole('link')).toHaveAttribute(
      'href',
      '/laglistor/mallar/arbetsmiljo'
    )
  })
})
