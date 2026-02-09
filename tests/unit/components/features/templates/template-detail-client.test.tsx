import { vi, describe, beforeEach, it, expect } from 'vitest'
import { render, screen } from '@testing-library/react'
import type { TemplateDetail } from '@/lib/db/queries/template-catalog'

const mockPush = vi.fn()

vi.mock('next/navigation', () => ({
  useRouter: () => ({
    push: mockPush,
    back: vi.fn(),
    forward: vi.fn(),
    refresh: vi.fn(),
    replace: vi.fn(),
    prefetch: vi.fn(),
  }),
}))

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

// Mock adoptTemplate to prevent server action resolution issues
vi.mock('@/app/actions/template-adoption', () => ({
  adoptTemplate: vi.fn(),
}))

import { TemplateDetailClient } from '@/components/features/templates/template-detail-client'

const defaultWorkspaces = [
  { id: 'ws_1', name: 'Test Workspace', slug: 'test-ws' },
]

const baseTemplate: TemplateDetail = {
  id: 'uuid-1',
  name: 'Arbetsmiljö',
  slug: 'arbetsmiljo',
  description: 'Arbetsmiljölagstiftning.',
  domain: 'arbetsmiljo',
  target_audience: 'Alla arbetsgivare',
  document_count: 112,
  section_count: 9,
  primary_regulatory_bodies: ['Arbetsmiljöverket'],
  is_variant: false,
  updated_at: '2026-02-10T00:00:00.000Z',
  parent_slug: null,
  variants: [],
  sections: [
    {
      id: 'section-1',
      section_number: '01',
      name: 'Grundläggande regelverk',
      description: null,
      item_count: 1,
      position: 1,
      items: [
        {
          id: 'item-1',
          index: '0100',
          position: 1,
          compliance_summary: null,
          expert_commentary: null,
          source_type: 'lag',
          regulatory_body: null,
          document: {
            id: 'doc-1',
            document_number: 'SFS 1977:1160',
            title: 'Arbetsmiljölag',
            slug: 'sfs-1977-1160',
          },
        },
      ],
    },
  ],
}

describe('TemplateDetailClient', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders header component with template name', () => {
    render(
      <TemplateDetailClient
        template={baseTemplate}
        workspaces={defaultWorkspaces}
        currentWorkspaceId="ws_1"
      />
    )

    const heading = screen.getByRole('heading', { name: 'Arbetsmiljö' })
    expect(heading.tagName).toBe('H1')
  })

  it('renders accordion/sections component', () => {
    render(
      <TemplateDetailClient
        template={baseTemplate}
        workspaces={defaultWorkspaces}
        currentWorkspaceId="ws_1"
      />
    )

    // Single section renders as flat list
    expect(screen.getByText('Grundläggande regelverk')).toBeInTheDocument()
    expect(screen.getByText('Arbetsmiljölag')).toBeInTheDocument()
  })

  it('renders CTA component', () => {
    render(
      <TemplateDetailClient
        template={baseTemplate}
        workspaces={defaultWorkspaces}
        currentWorkspaceId="ws_1"
      />
    )

    expect(screen.getByText('Använd denna mall')).toBeInTheDocument()
  })

  it('shows variant toggle for parent templates with variants', () => {
    const withVariants: TemplateDetail = {
      ...baseTemplate,
      variants: [
        {
          id: 'variant-1',
          name: 'Tjänsteversion',
          slug: 'arbetsmiljo-tjansteforetag',
          document_count: 55,
          section_count: 7,
          target_audience: 'Tjänsteföretag',
        },
      ],
    }
    render(
      <TemplateDetailClient
        template={withVariants}
        workspaces={defaultWorkspaces}
        currentWorkspaceId="ws_1"
      />
    )

    expect(
      screen.getByText('Visa version för tjänsteföretag')
    ).toBeInTheDocument()
  })

  it('hides variant toggle for templates without variants', () => {
    render(
      <TemplateDetailClient
        template={baseTemplate}
        workspaces={defaultWorkspaces}
        currentWorkspaceId="ws_1"
      />
    )

    expect(
      screen.queryByText('Visa version för tjänsteföretag')
    ).not.toBeInTheDocument()
  })

  it('shows parent link for variant templates', () => {
    const variant: TemplateDetail = {
      ...baseTemplate,
      is_variant: true,
      parent_slug: 'arbetsmiljo',
      variants: [],
    }
    render(
      <TemplateDetailClient
        template={variant}
        workspaces={defaultWorkspaces}
        currentWorkspaceId="ws_1"
      />
    )

    const link = screen.getByText('Visa fullständig version')
    expect(link.closest('a')).toHaveAttribute(
      'href',
      '/laglistor/mallar/arbetsmiljo'
    )
  })

  it('does not show parent link for non-variant templates', () => {
    render(
      <TemplateDetailClient
        template={baseTemplate}
        workspaces={defaultWorkspaces}
        currentWorkspaceId="ws_1"
      />
    )

    expect(
      screen.queryByText('Visa fullständig version')
    ).not.toBeInTheDocument()
  })
})
