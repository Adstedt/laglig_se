import { render, screen, waitFor } from '@testing-library/react'
import { vi, describe, beforeEach, it, expect } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
}))

vi.mock('@/app/actions/admin-templates', () => ({
  moveTemplateItem: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { TemplateSectionItems } from '@/components/admin/template-section-items'
import type { TemplateSectionItem } from '@/lib/admin/template-queries'

const mockItems: TemplateSectionItem[] = [
  {
    id: 'item-1',
    index: '1.1',
    position: 1,
    compliance_summary:
      'Arbetsgivaren ska vidta alla åtgärder som behövs för att förebygga att arbetstagare utsätts för ohälsa eller olycksfall.',
    content_status: 'AI_GENERATED',
    source_type: 'SFS',
    regulatory_body: 'Arbetsmiljöverket',
    document: {
      id: 'doc-1',
      title: 'Arbetsmiljölag (1977:1160)',
      document_number: 'SFS 1977:1160',
    },
  },
  {
    id: 'item-2',
    index: '1.2',
    position: 2,
    compliance_summary: null,
    content_status: 'STUB',
    source_type: null,
    regulatory_body: null,
    document: {
      id: 'doc-2',
      title: 'Arbetsmiljöförordning (1977:1166)',
      document_number: null,
    },
  },
]

const mockSections = [
  { id: 'sec-1', name: 'Allmänna bestämmelser' },
  { id: 'sec-2', name: 'Arbetsgivarens ansvar' },
  { id: 'sec-3', name: 'Övrigt' },
]

describe('TemplateSectionItems', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows loading state initially', () => {
    // Mock fetch to never resolve
    global.fetch = vi.fn(() => new Promise(() => {}))

    render(<TemplateSectionItems sectionId="sec-1" templateId="tmpl-1" />)

    expect(screen.getByText('Laddar objekt...')).toBeInTheDocument()
  })

  it('renders items after fetch', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: mockItems }),
    })

    render(<TemplateSectionItems sectionId="sec-1" templateId="tmpl-1" />)

    await waitFor(() => {
      expect(screen.getByText('Arbetsmiljölag (1977:1160)')).toBeInTheDocument()
    })

    expect(screen.getByText('SFS 1977:1160')).toBeInTheDocument()
    expect(
      screen.getByText('Arbetsmiljöförordning (1977:1166)')
    ).toBeInTheDocument()
    expect(screen.getByText('AI-genererad')).toBeInTheDocument()
    expect(screen.getByText('Stub')).toBeInTheDocument()
  })

  it('shows empty state when no items', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [] }),
    })

    render(<TemplateSectionItems sectionId="sec-1" templateId="tmpl-1" />)

    await waitFor(() => {
      expect(
        screen.getByText('Inga objekt i denna sektion')
      ).toBeInTheDocument()
    })
  })

  it('shows error state on fetch failure', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 500,
    })

    render(<TemplateSectionItems sectionId="sec-1" templateId="tmpl-1" />)

    await waitFor(() => {
      expect(screen.getByText('Kunde inte hämta objekt')).toBeInTheDocument()
    })
  })

  it('truncates long compliance summaries to 100 chars', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: mockItems }),
    })

    render(<TemplateSectionItems sectionId="sec-1" templateId="tmpl-1" />)

    await waitFor(() => {
      // The first item has a summary longer than 100 chars
      const truncated = screen.getByText(/Arbetsgivaren ska vidta.*\.\.\./)
      expect(truncated).toBeInTheDocument()
    })
  })

  it('renders move-to dropdown when availableSections provided', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: mockItems }),
    })

    render(
      <TemplateSectionItems
        sectionId="sec-1"
        templateId="tmpl-1"
        availableSections={mockSections}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Flytta till')).toBeInTheDocument()
    })

    // Should show "Flytta..." placeholders (one per item)
    const triggers = screen.getAllByText('Flytta...')
    expect(triggers).toHaveLength(2)
  })

  it('does not render move column when no other sections available', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: mockItems }),
    })

    render(
      <TemplateSectionItems
        sectionId="sec-1"
        templateId="tmpl-1"
        availableSections={[{ id: 'sec-1', name: 'Allmänna bestämmelser' }]}
      />
    )

    await waitFor(() => {
      expect(screen.getByText('Arbetsmiljölag (1977:1160)')).toBeInTheDocument()
    })

    expect(screen.queryByText('Flytta till')).not.toBeInTheDocument()
  })

  it('shows dash for null document_number and source_type', async () => {
    global.fetch = vi.fn().mockResolvedValue({
      ok: true,
      json: () => Promise.resolve({ items: [mockItems[1]] }),
    })

    render(<TemplateSectionItems sectionId="sec-1" templateId="tmpl-1" />)

    await waitFor(() => {
      expect(
        screen.getByText('Arbetsmiljöförordning (1977:1166)')
      ).toBeInTheDocument()
    })

    // Both document_number and source_type are null, so two dashes
    const dashes = screen.getAllByText('—')
    expect(dashes.length).toBeGreaterThanOrEqual(2)
  })
})
