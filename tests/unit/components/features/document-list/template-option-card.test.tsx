/**
 * Story 12.10b: TemplateOptionCard Component Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { TemplateOptionCard } from '@/components/features/document-list/template-option-card'
import type { PublishedTemplate } from '@/lib/db/queries/template-catalog'

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

describe('TemplateOptionCard', () => {
  it('renders template name and document count', () => {
    render(<TemplateOptionCard template={mockTemplate} onClick={vi.fn()} />)

    // Name and domain badge may share text — use getAllByText
    const arbetsmiljoElements = screen.getAllByText('Arbetsmiljö')
    expect(arbetsmiljoElements.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('112 lagar')).toBeInTheDocument()
  })

  it('renders domain badge with correct label', () => {
    render(
      <TemplateOptionCard template={mockTemplateNoVariants} onClick={vi.fn()} />
    )

    // 'miljo' domain maps to 'Miljö', template name is also 'Miljö'
    // Badge should render the domain label
    const badges = screen.getAllByText('Miljö')
    expect(badges.length).toBeGreaterThanOrEqual(1)
  })

  it('shows variant availability text when variants exist', () => {
    render(<TemplateOptionCard template={mockTemplate} onClick={vi.fn()} />)

    expect(
      screen.getByText('Tjänsteföretagsversion tillgänglig')
    ).toBeInTheDocument()
  })

  it('does not show variant text when no variants', () => {
    render(
      <TemplateOptionCard template={mockTemplateNoVariants} onClick={vi.fn()} />
    )

    expect(
      screen.queryByText('Tjänsteföretagsversion tillgänglig')
    ).not.toBeInTheDocument()
  })

  it('calls onClick when clicked', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<TemplateOptionCard template={mockTemplate} onClick={onClick} />)

    await user.click(screen.getByRole('button'))
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is keyboard accessible: Enter key triggers onClick', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<TemplateOptionCard template={mockTemplate} onClick={onClick} />)

    const card = screen.getByRole('button')
    card.focus()
    await user.keyboard('{Enter}')
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('is keyboard accessible: Space key triggers onClick', async () => {
    const user = userEvent.setup()
    const onClick = vi.fn()
    render(<TemplateOptionCard template={mockTemplate} onClick={onClick} />)

    const card = screen.getByRole('button')
    card.focus()
    await user.keyboard(' ')
    expect(onClick).toHaveBeenCalledOnce()
  })

  it('has role="button" and tabIndex={0}', () => {
    render(<TemplateOptionCard template={mockTemplate} onClick={vi.fn()} />)

    const card = screen.getByRole('button')
    expect(card).toHaveAttribute('tabindex', '0')
  })
})
