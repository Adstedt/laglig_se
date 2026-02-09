import { render, screen, fireEvent } from '@testing-library/react'
import { vi, describe, beforeEach, it, expect } from 'vitest'

const mockPush = vi.fn()
const mockSearchParams = new URLSearchParams()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    prefetch: vi.fn(),
  }),
  useSearchParams: () => mockSearchParams,
  usePathname: () => '/admin/templates',
}))

vi.mock('@/app/actions/admin-templates', () => ({
  createTemplate: vi.fn(),
}))

vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

import { TemplateTable } from '@/components/admin/template-table'
import type { TemplateListItem } from '@/lib/admin/template-queries'

const mockData: TemplateListItem[] = [
  {
    id: 'tmpl-1',
    name: 'Arbetsmiljö Standard',
    slug: 'arbetsmiljo',
    domain: 'Arbetsmiljö',
    status: 'PUBLISHED',
    document_count: 42,
    section_count: 5,
    published_at: new Date('2025-01-15'),
    updated_at: new Date('2025-06-01'),
    is_variant: false,
    parent: null,
  },
  {
    id: 'tmpl-2',
    name: 'Miljö Grundmall',
    slug: 'miljo',
    domain: 'Miljö',
    status: 'DRAFT',
    document_count: 15,
    section_count: 3,
    published_at: null,
    updated_at: new Date('2025-05-20'),
    is_variant: false,
    parent: null,
  },
  {
    id: 'tmpl-3',
    name: 'Arbetsmiljö – Tjänsteföretag',
    slug: 'arbetsmiljo-tjansteforetag',
    domain: 'Arbetsmiljö',
    status: 'IN_REVIEW',
    document_count: 30,
    section_count: 4,
    published_at: null,
    updated_at: new Date('2025-05-25'),
    is_variant: true,
    parent: { name: 'Arbetsmiljö' },
  },
]

describe('TemplateTable', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders all columns correctly', () => {
    render(
      <TemplateTable
        data={mockData}
        total={3}
        page={1}
        pageSize={25}
        currentSortBy="updated_at"
        currentSortDir="desc"
      />
    )

    expect(screen.getByText('Namn')).toBeInTheDocument()
    expect(screen.getByText('Domän')).toBeInTheDocument()
    expect(screen.getByText('Status')).toBeInTheDocument()
    expect(screen.getByText('Dokument')).toBeInTheDocument()
    expect(screen.getByText('Sektioner')).toBeInTheDocument()
    expect(screen.getByText('Uppdaterad')).toBeInTheDocument()
    // "Publicerad" appears as both column header and status badge
    expect(screen.getAllByText('Publicerad').length).toBeGreaterThanOrEqual(1)
  })

  it('renders template data in rows', () => {
    render(
      <TemplateTable
        data={mockData}
        total={3}
        page={1}
        pageSize={25}
        currentSortBy="updated_at"
        currentSortDir="desc"
      />
    )

    expect(screen.getByText('Arbetsmiljö Standard')).toBeInTheDocument()
    expect(screen.getByText('Miljö Grundmall')).toBeInTheDocument()
    expect(screen.getByText('42')).toBeInTheDocument()
    expect(screen.getByText('15')).toBeInTheDocument()
    expect(screen.getByText('5')).toBeInTheDocument()
  })

  it('renders status badges with correct labels', () => {
    render(
      <TemplateTable
        data={mockData}
        total={3}
        page={1}
        pageSize={25}
        currentSortBy="updated_at"
        currentSortDir="desc"
      />
    )

    // "Publicerad" appears as both column header and status badge
    expect(screen.getAllByText('Publicerad').length).toBeGreaterThanOrEqual(2)
    expect(screen.getByText('Utkast')).toBeInTheDocument()
    expect(screen.getByText('Under granskning')).toBeInTheDocument()
  })

  it('renders variant indicator for variant templates', () => {
    render(
      <TemplateTable
        data={mockData}
        total={3}
        page={1}
        pageSize={25}
        currentSortBy="updated_at"
        currentSortDir="desc"
      />
    )

    expect(screen.getByText('Variant')).toBeInTheDocument()
  })

  it('shows empty state when no data', () => {
    render(
      <TemplateTable
        data={[]}
        total={0}
        page={1}
        pageSize={25}
        currentSortBy="updated_at"
        currentSortDir="desc"
      />
    )

    expect(screen.getByText('Inga mallar hittades')).toBeInTheDocument()
  })

  it('navigates to detail page on row click', () => {
    render(
      <TemplateTable
        data={mockData}
        total={3}
        page={1}
        pageSize={25}
        currentSortBy="updated_at"
        currentSortDir="desc"
      />
    )

    // Use unique name that only appears in name column
    const nameCell = screen.getByText('Arbetsmiljö Standard')
    const row = nameCell.closest('tr')
    if (row) fireEvent.click(row)

    expect(mockPush).toHaveBeenCalledWith('/admin/templates/tmpl-1')
  })

  it('has status filter select', () => {
    render(
      <TemplateTable
        data={mockData}
        total={3}
        page={1}
        pageSize={25}
        currentSortBy="updated_at"
        currentSortDir="desc"
      />
    )

    expect(screen.getByText('Alla statusar')).toBeInTheDocument()
  })

  it('has search input', () => {
    render(
      <TemplateTable
        data={mockData}
        total={3}
        page={1}
        pageSize={25}
        currentSortBy="updated_at"
        currentSortDir="desc"
      />
    )

    expect(
      screen.getByPlaceholderText('Sök namn eller slug...')
    ).toBeInTheDocument()
  })

  it('renders pagination info', () => {
    render(
      <TemplateTable
        data={mockData}
        total={50}
        page={2}
        pageSize={25}
        currentSortBy="updated_at"
        currentSortDir="desc"
      />
    )

    expect(screen.getByText('Visar 26–50 av 50 mallar')).toBeInTheDocument()
    expect(screen.getByText('Sida 2 av 2')).toBeInTheDocument()
  })

  it('renders "Skapa mall" button', () => {
    render(
      <TemplateTable
        data={mockData}
        total={3}
        page={1}
        pageSize={25}
        currentSortBy="updated_at"
        currentSortDir="desc"
      />
    )

    expect(screen.getByText('Skapa mall')).toBeInTheDocument()
  })

  it('renders domain badges', () => {
    render(
      <TemplateTable
        data={mockData}
        total={3}
        page={1}
        pageSize={25}
        currentSortBy="updated_at"
        currentSortDir="desc"
      />
    )

    // Domain badges
    const arbetsmiljoBadges = screen.getAllByText('Arbetsmiljö')
    expect(arbetsmiljoBadges.length).toBeGreaterThanOrEqual(2) // 2 templates with this domain
    expect(screen.getByText('Miljö')).toBeInTheDocument()
  })
})
