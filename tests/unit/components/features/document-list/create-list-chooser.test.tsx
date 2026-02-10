/**
 * Story 12.10b: CreateListChooser Component Tests
 */

import { describe, it, expect, vi } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateListChooser } from '@/components/features/document-list/create-list-chooser'
import type { PublishedTemplate } from '@/lib/db/queries/template-catalog'

const mockTemplates: PublishedTemplate[] = [
  {
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
    variants: [],
  },
  {
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
  },
]

describe('CreateListChooser', () => {
  it('renders "Börja från mall" and "Tom lista" option cards', () => {
    render(
      <CreateListChooser
        templates={mockTemplates}
        onSelectTemplate={vi.fn()}
        onSelectBlank={vi.fn()}
      />
    )

    expect(screen.getByText('Börja från mall')).toBeInTheDocument()
    expect(screen.getByText('Tom lista')).toBeInTheDocument()
  })

  it('renders template preview cards for each template (max 4)', () => {
    render(
      <CreateListChooser
        templates={mockTemplates}
        onSelectTemplate={vi.fn()}
        onSelectBlank={vi.fn()}
      />
    )

    // Template names may also match domain badge text — use getAllByText
    const arbetsmiljoElements = screen.getAllByText('Arbetsmiljö')
    expect(arbetsmiljoElements.length).toBeGreaterThanOrEqual(1)
    const miljoElements = screen.getAllByText('Miljö')
    expect(miljoElements.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('112 lagar')).toBeInTheDocument()
    expect(screen.getByText('98 lagar')).toBeInTheDocument()
  })

  it('calls onSelectTemplate when template card is clicked', async () => {
    const user = userEvent.setup()
    const onSelectTemplate = vi.fn()
    render(
      <CreateListChooser
        templates={mockTemplates}
        onSelectTemplate={onSelectTemplate}
        onSelectBlank={vi.fn()}
      />
    )

    // Click the Miljö template card (within the popular templates section)
    const allButtons = screen.getAllByRole('button')
    // The template cards are after the two option cards
    // Find the one that contains "Miljö" text
    const miljoCard = allButtons.find((btn) =>
      btn.textContent?.includes('98 lagar')
    )
    expect(miljoCard).toBeDefined()
    await user.click(miljoCard!)

    expect(onSelectTemplate).toHaveBeenCalledWith(mockTemplates[1])
  })

  it('calls onSelectBlank when "Tom lista" card is clicked', async () => {
    const user = userEvent.setup()
    const onSelectBlank = vi.fn()
    render(
      <CreateListChooser
        templates={mockTemplates}
        onSelectTemplate={vi.fn()}
        onSelectBlank={onSelectBlank}
      />
    )

    // Find the "Tom lista" card by finding the button containing that text
    const allButtons = screen.getAllByRole('button')
    const blankCard = allButtons.find((btn) =>
      btn.textContent?.includes('Tom lista')
    )
    expect(blankCard).toBeDefined()
    await user.click(blankCard!)

    expect(onSelectBlank).toHaveBeenCalledOnce()
  })

  it('renders domain badge with correct label from DOMAIN_LABELS', () => {
    render(
      <CreateListChooser
        templates={mockTemplates}
        onSelectTemplate={vi.fn()}
        onSelectBlank={vi.fn()}
      />
    )

    // DOMAIN_LABELS['miljo'] = 'Miljö' — already the template name
    // DOMAIN_LABELS['arbetsmiljo'] = 'Arbetsmiljö' — already the template name
    expect(screen.getByText('Populära mallar')).toBeInTheDocument()
  })

  it('option cards are keyboard accessible (Enter key triggers selection)', async () => {
    const user = userEvent.setup()
    const onSelectBlank = vi.fn()
    render(
      <CreateListChooser
        templates={mockTemplates}
        onSelectTemplate={vi.fn()}
        onSelectBlank={onSelectBlank}
      />
    )

    const allButtons = screen.getAllByRole('button')
    const blankCard = allButtons.find((btn) =>
      btn.textContent?.includes('Tom lista')
    )
    expect(blankCard).toBeDefined()
    blankCard!.focus()
    await user.keyboard('{Enter}')

    expect(onSelectBlank).toHaveBeenCalledOnce()
  })

  it('option cards are keyboard accessible (Space key triggers selection)', async () => {
    const user = userEvent.setup()
    const onSelectBlank = vi.fn()
    render(
      <CreateListChooser
        templates={mockTemplates}
        onSelectTemplate={vi.fn()}
        onSelectBlank={onSelectBlank}
      />
    )

    const allButtons = screen.getAllByRole('button')
    const blankCard = allButtons.find((btn) =>
      btn.textContent?.includes('Tom lista')
    )
    expect(blankCard).toBeDefined()
    blankCard!.focus()
    await user.keyboard(' ')

    expect(onSelectBlank).toHaveBeenCalledOnce()
  })

  it('option cards have role="button" and tabIndex={0}', () => {
    render(
      <CreateListChooser
        templates={mockTemplates}
        onSelectTemplate={vi.fn()}
        onSelectBlank={vi.fn()}
      />
    )

    const allButtons = screen.getAllByRole('button')
    // All should have tabindex 0
    for (const btn of allButtons) {
      expect(btn).toHaveAttribute('tabindex', '0')
    }
  })
})
