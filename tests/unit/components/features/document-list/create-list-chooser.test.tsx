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
    expect(screen.getByText('112 dokument')).toBeInTheDocument()
    expect(screen.getByText('98 dokument')).toBeInTheDocument()
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
      btn.textContent?.includes('98 dokument')
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

  it('renders Laglig tab active by default', () => {
    render(
      <CreateListChooser
        templates={mockTemplates}
        onSelectTemplate={vi.fn()}
        onSelectBlank={vi.fn()}
      />
    )

    const lagligTab = screen.getByRole('tab', { name: 'Laglig' })
    expect(lagligTab).toBeInTheDocument()
    expect(lagligTab).toHaveAttribute('data-state', 'active')

    const communityTab = screen.getByRole('tab', { name: 'Community' })
    expect(communityTab).toBeInTheDocument()
    expect(communityTab).toHaveAttribute('data-state', 'inactive')
  })

  it('shows "Kommer snart" when Community tab is clicked', async () => {
    const user = userEvent.setup()
    render(
      <CreateListChooser
        templates={mockTemplates}
        onSelectTemplate={vi.fn()}
        onSelectBlank={vi.fn()}
      />
    )

    const communityTab = screen.getByRole('tab', { name: 'Community' })
    await user.click(communityTab)

    expect(screen.getByText('Kommer snart')).toBeInTheDocument()
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

  // --- Story 24.6: Importera card ---

  it('renders the "Importera" card when onSelectImport is provided', () => {
    render(
      <CreateListChooser
        templates={mockTemplates}
        onSelectTemplate={vi.fn()}
        onSelectBlank={vi.fn()}
        onSelectImport={vi.fn()}
      />
    )

    expect(screen.getByText('Importera')).toBeInTheDocument()
    expect(
      screen.getByText(
        'Ladda upp en befintlig laglista från Excel, CSV eller klistra in raderna'
      )
    ).toBeInTheDocument()
  })

  it('does NOT render the "Importera" card when onSelectImport is omitted', () => {
    render(
      <CreateListChooser
        templates={mockTemplates}
        onSelectTemplate={vi.fn()}
        onSelectBlank={vi.fn()}
      />
    )

    expect(screen.queryByText('Importera')).not.toBeInTheDocument()
  })

  it('calls onSelectImport when "Importera" card is clicked', async () => {
    const user = userEvent.setup()
    const onSelectImport = vi.fn()
    render(
      <CreateListChooser
        templates={mockTemplates}
        onSelectTemplate={vi.fn()}
        onSelectBlank={vi.fn()}
        onSelectImport={onSelectImport}
      />
    )

    const allButtons = screen.getAllByRole('button')
    const importCard = allButtons.find((btn) =>
      btn.textContent?.includes('Importera')
    )
    expect(importCard).toBeDefined()
    await user.click(importCard!)

    expect(onSelectImport).toHaveBeenCalledOnce()
  })

  it('Importera card is keyboard accessible (Enter)', async () => {
    const user = userEvent.setup()
    const onSelectImport = vi.fn()
    render(
      <CreateListChooser
        templates={mockTemplates}
        onSelectTemplate={vi.fn()}
        onSelectBlank={vi.fn()}
        onSelectImport={onSelectImport}
      />
    )

    const allButtons = screen.getAllByRole('button')
    const importCard = allButtons.find((btn) =>
      btn.textContent?.includes('Importera')
    )
    importCard!.focus()
    await user.keyboard('{Enter}')

    expect(onSelectImport).toHaveBeenCalledOnce()
  })

  it('uses 3-column grid (lg breakpoint) when import card is shown', () => {
    const { container } = render(
      <CreateListChooser
        templates={mockTemplates}
        onSelectTemplate={vi.fn()}
        onSelectBlank={vi.fn()}
        onSelectImport={vi.fn()}
      />
    )

    // Find the option-cards grid wrapper. Smoke check on the layout class —
    // 1 col on mobile, 2 cols at sm, 3 cols at lg. (`sm:grid-cols-3` was
    // considered but rejected in PO NICE-001 review for breathing room.)
    const grid = container.querySelector('.lg\\:grid-cols-3')
    expect(grid).not.toBeNull()
  })

  it('uses 2-column grid when import card is hidden', () => {
    const { container } = render(
      <CreateListChooser
        templates={mockTemplates}
        onSelectTemplate={vi.fn()}
        onSelectBlank={vi.fn()}
      />
    )

    // No 3-col grid class when import card not rendered.
    const lgGrid = container.querySelector('.lg\\:grid-cols-3')
    expect(lgGrid).toBeNull()
    const smGrid = container.querySelector('.sm\\:grid-cols-2')
    expect(smGrid).not.toBeNull()
  })
})
