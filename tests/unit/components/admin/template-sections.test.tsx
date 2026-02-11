import { render, screen } from '@testing-library/react'
import { vi, describe, beforeEach, it, expect } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock('@/app/actions/admin-templates', () => ({
  createTemplateSection: vi.fn(),
  updateTemplateSection: vi.fn(),
  reorderTemplateSections: vi.fn(),
  deleteTemplateSection: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock the section items component to avoid fetch calls
vi.mock('@/components/admin/template-section-items', () => ({
  TemplateSectionItems: () => <div data-testid="section-items">Items</div>,
}))

import { TemplateSections } from '@/components/admin/template-sections'

const mockSections = [
  {
    id: 'sec-1',
    section_number: '1',
    name: 'Allmänna bestämmelser',
    description: null,
    position: 1,
    item_count: 8,
  },
  {
    id: 'sec-2',
    section_number: '2',
    name: 'Arbetsgivarens ansvar',
    description: null,
    position: 2,
    item_count: 2,
  },
  {
    id: 'sec-3',
    section_number: '3',
    name: 'Övrigt',
    description: null,
    position: 3,
    item_count: 25,
  },
]

describe('TemplateSections', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders section list with names and counts', () => {
    render(
      <TemplateSections
        templateId="tmpl-1"
        sections={mockSections}
        totalDocs={35}
      />
    )

    expect(screen.getByText('Sektioner (3)')).toBeInTheDocument()
    expect(screen.getByText('Allmänna bestämmelser')).toBeInTheDocument()
    expect(screen.getByText('Arbetsgivarens ansvar')).toBeInTheDocument()
    expect(screen.getByText('Övrigt')).toBeInTheDocument()
    expect(screen.getByText('8 dok')).toBeInTheDocument()
    expect(screen.getByText('2 dok')).toBeInTheDocument()
    expect(screen.getByText('25 dok')).toBeInTheDocument()
  })

  it('shows warning for section with fewer than 3 docs', () => {
    render(
      <TemplateSections
        templateId="tmpl-1"
        sections={mockSections}
        totalDocs={35}
      />
    )

    expect(screen.getByText('Färre än 3 dokument')).toBeInTheDocument()
  })

  it('shows warning for section with more than 30% of total docs', () => {
    render(
      <TemplateSections
        templateId="tmpl-1"
        sections={mockSections}
        totalDocs={35}
      />
    )

    // Section 3 has 25 docs out of 35 total = 71% > 30%
    expect(
      screen.getByText('Mer än 30% av totala dokument')
    ).toBeInTheDocument()
  })

  it('shows empty state when no sections', () => {
    render(<TemplateSections templateId="tmpl-1" sections={[]} totalDocs={0} />)

    expect(
      screen.getByText(
        'Inga sektioner ännu. Lägg till en sektion för att komma igång.'
      )
    ).toBeInTheDocument()
  })

  it('shows section numbers as badges', () => {
    render(
      <TemplateSections
        templateId="tmpl-1"
        sections={mockSections}
        totalDocs={35}
      />
    )

    expect(screen.getByText('1')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    // '3' is also present as section number
  })

  it('has add section button', () => {
    render(
      <TemplateSections
        templateId="tmpl-1"
        sections={mockSections}
        totalDocs={35}
      />
    )

    expect(screen.getByText('Lägg till sektion')).toBeInTheDocument()
  })

  it('has drag handles with accessibility labels', () => {
    render(
      <TemplateSections
        templateId="tmpl-1"
        sections={mockSections}
        totalDocs={35}
      />
    )

    const dragHandles = screen.getAllByLabelText('Dra för att ändra ordning')
    expect(dragHandles).toHaveLength(3)
  })
})
