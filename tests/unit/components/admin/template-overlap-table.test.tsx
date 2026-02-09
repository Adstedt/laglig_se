import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    refresh: vi.fn(),
    prefetch: vi.fn(),
  }),
  useSearchParams: () => new URLSearchParams(),
  usePathname: () => '/admin/templates/overlap',
}))

vi.mock('@/app/actions/admin-templates', () => ({
  syncTemplateSummaries: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { TemplateOverlapTable } from '@/components/admin/template-overlap-table'
import type { TemplateOverlapItem } from '@/lib/admin/template-queries'

const mockData: TemplateOverlapItem[] = [
  {
    documentId: 'doc-1',
    documentTitle: 'Arbetsmiljölag (1977:1160)',
    documentNumber: 'SFS 1977:1160',
    templateCount: 2,
    entries: [
      {
        templateId: 'tmpl-1',
        templateName: 'Arbetsmiljö Standard',
        templateSlug: 'arbetsmiljo',
        itemId: 'item-1',
        compliance_summary: 'Summary A',
        expert_commentary: null,
        content_status: 'AI_GENERATED',
      },
      {
        templateId: 'tmpl-2',
        templateName: 'Miljö Grundmall',
        templateSlug: 'miljo',
        itemId: 'item-2',
        compliance_summary: 'Summary B',
        expert_commentary: 'Commentary B',
        content_status: 'HUMAN_REVIEWED',
      },
    ],
    isInconsistent: true,
  },
  {
    documentId: 'doc-2',
    documentTitle: 'Miljöbalk (1998:808)',
    documentNumber: 'SFS 1998:808',
    templateCount: 2,
    entries: [
      {
        templateId: 'tmpl-1',
        templateName: 'Arbetsmiljö Standard',
        templateSlug: 'arbetsmiljo',
        itemId: 'item-3',
        compliance_summary: 'Same summary',
        expert_commentary: null,
        content_status: 'STUB',
      },
      {
        templateId: 'tmpl-2',
        templateName: 'Miljö Grundmall',
        templateSlug: 'miljo',
        itemId: 'item-4',
        compliance_summary: 'Same summary',
        expert_commentary: null,
        content_status: 'STUB',
      },
    ],
    isInconsistent: false,
  },
]

describe('TemplateOverlapTable', () => {
  it('renders correct number of rows for overlapping documents', () => {
    render(<TemplateOverlapTable data={mockData} />)

    expect(screen.getByText('Arbetsmiljölag (1977:1160)')).toBeInTheDocument()
    expect(screen.getByText('Miljöbalk (1998:808)')).toBeInTheDocument()
  })

  it('shows inconsistency indicator on inconsistent rows', () => {
    render(<TemplateOverlapTable data={mockData} />)

    expect(screen.getByText('Inkonsekvent')).toBeInTheDocument()
    expect(screen.getByText('Konsekvent')).toBeInTheDocument()
  })

  it('filter toggle hides consistent rows', () => {
    render(<TemplateOverlapTable data={mockData} />)

    // Both rows visible initially
    expect(screen.getByText('Arbetsmiljölag (1977:1160)')).toBeInTheDocument()
    expect(screen.getByText('Miljöbalk (1998:808)')).toBeInTheDocument()

    // Click filter checkbox
    fireEvent.click(screen.getByLabelText('Visa bara inkonsekvenser'))

    // Only inconsistent row visible
    expect(screen.getByText('Arbetsmiljölag (1977:1160)')).toBeInTheDocument()
    expect(screen.queryByText('Miljöbalk (1998:808)')).not.toBeInTheDocument()
  })

  it('expanding a row shows per-template summaries', () => {
    render(<TemplateOverlapTable data={mockData} />)

    // Summaries not visible initially
    expect(screen.queryByText('Summary A')).not.toBeInTheDocument()

    // Click first row to expand
    fireEvent.click(screen.getByText('Arbetsmiljölag (1977:1160)'))

    // Now summaries are visible
    expect(screen.getByText('Summary A')).toBeInTheDocument()
    expect(screen.getByText('Summary B')).toBeInTheDocument()
    expect(screen.getByText('Commentary B')).toBeInTheDocument()
  })

  it('shows document numbers in the table', () => {
    render(<TemplateOverlapTable data={mockData} />)

    expect(screen.getByText('SFS 1977:1160')).toBeInTheDocument()
    expect(screen.getByText('SFS 1998:808')).toBeInTheDocument()
  })

  it('shows template names as badges', () => {
    render(<TemplateOverlapTable data={mockData} />)

    // Each template name appears multiple times (once per document row)
    const arbetsmiljoBadges = screen.getAllByText('Arbetsmiljö Standard')
    expect(arbetsmiljoBadges.length).toBeGreaterThanOrEqual(2)
  })

  it('shows empty state when filter produces no results', () => {
    const consistentOnlyData = [mockData[1]]
    render(<TemplateOverlapTable data={consistentOnlyData} />)

    // Click filter checkbox
    fireEvent.click(screen.getByLabelText('Visa bara inkonsekvenser'))

    expect(screen.getByText('Inga inkonsekvenser hittades')).toBeInTheDocument()
  })
})
