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

import { TemplateCatalogClient } from '@/components/features/templates/template-catalog-client'

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

const allTemplates = [mockTemplate, mockTemplateNoVariants]
const allDomains = ['arbetsmiljo', 'miljo']

describe('TemplateCatalogClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders correct number of template cards', () => {
    render(
      <TemplateCatalogClient templates={allTemplates} domains={allDomains} />
    )

    // Both template names appear (also in filter badges, so use getAllByText)
    expect(screen.getAllByText('Arbetsmiljö').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Miljö').length).toBeGreaterThanOrEqual(1)
    // Both descriptions should be visible (unique to cards)
    expect(screen.getByText(/Omfattande lagkrav/)).toBeInTheDocument()
    expect(screen.getByText(/Miljölagstiftning/)).toBeInTheDocument()
  })

  it('renders domain filter badges including "Alla"', () => {
    render(
      <TemplateCatalogClient templates={allTemplates} domains={allDomains} />
    )

    expect(screen.getByText('Alla')).toBeInTheDocument()
    // Domain labels are rendered in the filter row and on cards
    expect(screen.getAllByText('Arbetsmiljö').length).toBeGreaterThanOrEqual(1)
    expect(screen.getAllByText('Miljö').length).toBeGreaterThanOrEqual(1)
  })

  it('filters by domain when a domain badge is clicked', async () => {
    const user = userEvent.setup()
    render(
      <TemplateCatalogClient templates={allTemplates} domains={allDomains} />
    )

    // Click Miljö filter button
    const filterButtons = screen.getAllByText('Miljö')
    await user.click(filterButtons[0]!)

    // Arbetsmiljö card description should be gone (card filtered out)
    expect(screen.queryByText(/Omfattande lagkrav/)).not.toBeInTheDocument()
    // Miljö card description still shown
    expect(
      screen.getByText('Miljölagstiftning för verksamheter med miljöpåverkan.')
    ).toBeInTheDocument()
  })

  it('"Alla" filter shows all templates', async () => {
    const user = userEvent.setup()
    render(
      <TemplateCatalogClient templates={allTemplates} domains={allDomains} />
    )

    // First filter to Miljö
    const filterButtons = screen.getAllByText('Miljö')
    await user.click(filterButtons[0]!)

    // Then click Alla
    await user.click(screen.getByText('Alla'))

    // Both template descriptions should be visible again
    expect(screen.getByText(/Omfattande lagkrav/)).toBeInTheDocument()
    expect(
      screen.getByText('Miljölagstiftning för verksamheter med miljöpåverkan.')
    ).toBeInTheDocument()
  })

  it('shows per-domain empty state when no templates match filter', async () => {
    const user = userEvent.setup()
    // Only arbetsmiljo templates, but we list gdpr as a domain
    render(
      <TemplateCatalogClient
        templates={[mockTemplate]}
        domains={['arbetsmiljo', 'gdpr']}
      />
    )

    // Click GDPR filter
    await user.click(screen.getByText('GDPR'))

    expect(
      screen.getByText('Inga mallar för detta område ännu — kommer snart')
    ).toBeInTheDocument()
  })

  it('renders full empty state when templates array is empty', () => {
    render(<TemplateCatalogClient templates={[]} domains={[]} />)

    expect(
      screen.getByText('Mallbiblioteket är tomt just nu')
    ).toBeInTheDocument()
    expect(
      screen.getByText('Mallar publiceras inom kort — kom tillbaka snart!')
    ).toBeInTheDocument()
    expect(screen.getByText('Tillbaka till laglistor')).toBeInTheDocument()
  })
})
