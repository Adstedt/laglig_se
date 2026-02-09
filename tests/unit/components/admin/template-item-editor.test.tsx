import { render, screen } from '@testing-library/react'
import { vi, describe, it, expect } from 'vitest'

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: vi.fn(),
    prefetch: vi.fn(),
    refresh: vi.fn(),
  }),
}))

vi.mock('@/app/actions/admin-templates', () => ({
  updateTemplateItemContent: vi.fn(),
  reviewTemplateItem: vi.fn(),
  approveTemplateItem: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { TemplateItemEditor } from '@/components/admin/template-item-editor'

const mockItem = {
  id: 'item-1',
  index: '1.1',
  position: 1,
  compliance_summary: 'Test compliance summary',
  expert_commentary: 'Test expert commentary',
  content_status: 'AI_GENERATED' as const,
  source_type: 'SFS',
  regulatory_body: 'Arbetsmiljöverket',
  last_amendment: 'SFS 2023:100',
  replaces_old_reference: null,
  is_service_company_relevant: true,
  generated_by: 'system',
  reviewed_by: null,
  reviewer_name: null,
  reviewed_at: null,
  created_at: '2026-01-01T00:00:00.000Z',
  updated_at: '2026-01-01T00:00:00.000Z',
  document_title: 'Arbetsmiljölag (1977:1160)',
  document_number: 'SFS 1977:1160',
  document_slug: 'sfs-1977-1160',
  section_id: 'sec-1',
  section_name: 'Allmänna skyldigheter',
  section_number: '1',
  template_id: 'tmpl-1',
  template_name: 'Arbetsmiljö',
}

const mockAdjacentItems = {
  previousId: null,
  previousTitle: null,
  nextId: 'item-2',
  nextTitle: 'Diskrimineringslag (2008:567)',
}

describe('TemplateItemEditor', () => {
  it('renders document title', () => {
    render(
      <TemplateItemEditor item={mockItem} adjacentItems={mockAdjacentItems} />
    )

    expect(screen.getByText('Arbetsmiljölag (1977:1160)')).toBeInTheDocument()
  })

  it('renders content status badge', () => {
    render(
      <TemplateItemEditor item={mockItem} adjacentItems={mockAdjacentItems} />
    )

    expect(screen.getByText('AI-genererad')).toBeInTheDocument()
  })

  it('renders compliance summary in textarea', () => {
    render(
      <TemplateItemEditor item={mockItem} adjacentItems={mockAdjacentItems} />
    )

    const textarea = screen.getByLabelText('Sammanfattning')
    expect(textarea).toHaveValue('Test compliance summary')
  })

  it('renders expert commentary in textarea', () => {
    render(
      <TemplateItemEditor item={mockItem} adjacentItems={mockAdjacentItems} />
    )

    const textarea = screen.getByLabelText('Expertkommentar')
    expect(textarea).toHaveValue('Test expert commentary')
  })

  it('renders action buttons', () => {
    render(
      <TemplateItemEditor item={mockItem} adjacentItems={mockAdjacentItems} />
    )

    expect(screen.getByText('Spara')).toBeInTheDocument()
    expect(screen.getByText('Markera som granskad')).toBeInTheDocument()
    expect(screen.getByText('Godkänn')).toBeInTheDocument()
  })

  it('renders metadata fields', () => {
    render(
      <TemplateItemEditor item={mockItem} adjacentItems={mockAdjacentItems} />
    )

    expect(screen.getByText('Arbetsmiljö')).toBeInTheDocument() // template name
    expect(screen.getByText('SFS')).toBeInTheDocument() // source type
    expect(screen.getByText('Arbetsmiljöverket')).toBeInTheDocument() // regulatory body
  })

  it('renders next navigation link', () => {
    render(
      <TemplateItemEditor item={mockItem} adjacentItems={mockAdjacentItems} />
    )

    expect(
      screen.getByText('Diskrimineringslag (2008:567)')
    ).toBeInTheDocument()
  })

  it('renders reviewer info when reviewed', () => {
    render(
      <TemplateItemEditor
        item={{
          ...mockItem,
          content_status: 'HUMAN_REVIEWED',
          reviewer_name: 'Anna Admin',
          reviewed_at: '2026-01-15T10:30:00.000Z',
        }}
        adjacentItems={mockAdjacentItems}
      />
    )

    expect(screen.getByText('Anna Admin')).toBeInTheDocument()
  })
})
