import { vi, describe, beforeEach, it, expect } from 'vitest'
import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type { TemplateDetailSection } from '@/lib/db/queries/template-catalog'

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

import { TemplateSectionsAccordion } from '@/components/features/templates/template-sections-accordion'

const mockSections: TemplateDetailSection[] = [
  {
    id: 'section-1',
    section_number: '01',
    name: 'Grundläggande regelverk',
    description: 'Övergripande lagar.',
    item_count: 2,
    position: 1,
    items: [
      {
        id: 'item-1',
        index: '0100',
        position: 1,
        compliance_summary: 'Vi ska bedriva systematiskt arbetsmiljöarbete.',
        expert_commentary:
          'Arbetsmiljölagen är grundstenen i svenskt arbetsmiljöarbete.',
        source_type: 'lag',
        regulatory_body: 'Riksdagen',
        document: {
          id: 'doc-1',
          document_number: 'SFS 1977:1160',
          title: 'Arbetsmiljölag',
          slug: 'sfs-1977-1160',
        },
      },
      {
        id: 'item-2',
        index: '0101',
        position: 2,
        compliance_summary: 'Följa föreskrifter om SAM.',
        expert_commentary: null,
        source_type: 'foreskrift',
        regulatory_body: 'Arbetsmiljöverket',
        document: {
          id: 'doc-2',
          document_number: 'AFS 2023:1',
          title: 'Systematiskt arbetsmiljöarbete',
          slug: 'afs-2023-1',
        },
      },
    ],
  },
  {
    id: 'section-2',
    section_number: '02',
    name: 'Fysisk arbetsmiljö',
    description: 'Krav på den fysiska arbetsmiljön.',
    item_count: 1,
    position: 2,
    items: [
      {
        id: 'item-3',
        index: '0200',
        position: 1,
        compliance_summary: null,
        expert_commentary: null,
        source_type: 'eu-forordning',
        regulatory_body: 'EU',
        document: {
          id: 'doc-3',
          document_number: 'EU 2016/425',
          title: 'Personlig skyddsutrustning',
          slug: 'eu-2016-425',
        },
      },
    ],
  },
]

describe('TemplateSectionsAccordion', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  describe('multi-section', () => {
    it('renders correct number of accordion items', () => {
      render(<TemplateSectionsAccordion sections={mockSections} />)

      expect(screen.getByText('Grundläggande regelverk')).toBeInTheDocument()
      expect(screen.getByText('Fysisk arbetsmiljö')).toBeInTheDocument()
    })

    it('shows section number badges', () => {
      render(<TemplateSectionsAccordion sections={mockSections} />)

      expect(screen.getByText('01')).toBeInTheDocument()
      expect(screen.getByText('02')).toBeInTheDocument()
    })

    it('shows document count badges for each section', () => {
      render(<TemplateSectionsAccordion sections={mockSections} />)

      expect(screen.getByText('2 dokument')).toBeInTheDocument()
      expect(screen.getByText('1 dokument')).toBeInTheDocument()
    })

    it('shows section description', () => {
      render(<TemplateSectionsAccordion sections={mockSections} />)

      expect(screen.getByText('Övergripande lagar.')).toBeInTheDocument()
    })

    it('shows two-column table with Typ and Dokument headers when expanded', async () => {
      const user = userEvent.setup()
      render(<TemplateSectionsAccordion sections={mockSections} />)

      await user.click(screen.getByText('Grundläggande regelverk'))

      expect(screen.getByText('Typ')).toBeInTheDocument()
      expect(screen.getByText('Dokument')).toBeInTheDocument()
      // Summary column removed
      expect(screen.queryByText('Sammanfattning')).not.toBeInTheDocument()
    })

    it('shows document titles and numbers when expanded', async () => {
      const user = userEvent.setup()
      render(<TemplateSectionsAccordion sections={mockSections} />)

      await user.click(screen.getByText('Grundläggande regelverk'))

      expect(screen.getByText('Arbetsmiljölag')).toBeInTheDocument()
      expect(screen.getByText('SFS 1977:1160')).toBeInTheDocument()
      expect(
        screen.getByText('Systematiskt arbetsmiljöarbete')
      ).toBeInTheDocument()
      expect(screen.getByText('AFS 2023:1')).toBeInTheDocument()
    })

    it('shows source type icon badges with title attributes', async () => {
      const user = userEvent.setup()
      render(<TemplateSectionsAccordion sections={mockSections} />)

      await user.click(screen.getByText('Grundläggande regelverk'))

      expect(screen.getByTitle('Lag')).toBeInTheDocument()
      expect(screen.getByTitle('Föreskrift')).toBeInTheDocument()
    })
  })

  describe('row expand with tabs', () => {
    it('shows tabs when item has both compliance_summary and expert_commentary', async () => {
      const user = userEvent.setup()
      render(<TemplateSectionsAccordion sections={mockSections} />)

      await user.click(screen.getByText('Grundläggande regelverk'))
      await user.click(screen.getByText('Arbetsmiljölag'))

      // Tab triggers visible
      expect(screen.getByRole('tab', { name: 'Krav' })).toBeInTheDocument()
      expect(screen.getByRole('tab', { name: 'Om lagen' })).toBeInTheDocument()

      // Krav tab active by default — shows compliance summary
      expect(
        screen.getByText('Vi ska bedriva systematiskt arbetsmiljöarbete.')
      ).toBeInTheDocument()
    })

    it('switches to Om lagen tab to show expert commentary', async () => {
      const user = userEvent.setup()
      render(<TemplateSectionsAccordion sections={mockSections} />)

      await user.click(screen.getByText('Grundläggande regelverk'))
      await user.click(screen.getByText('Arbetsmiljölag'))

      // Switch tab
      await user.click(screen.getByRole('tab', { name: 'Om lagen' }))

      expect(
        screen.getByText(
          'Arbetsmiljölagen är grundstenen i svenskt arbetsmiljöarbete.'
        )
      ).toBeInTheDocument()
    })

    it('shows content directly without tabs when only compliance_summary exists', async () => {
      const user = userEvent.setup()
      render(<TemplateSectionsAccordion sections={mockSections} />)

      await user.click(screen.getByText('Grundläggande regelverk'))
      await user.click(screen.getByText('Systematiskt arbetsmiljöarbete'))

      // No tabs — content shown directly
      expect(screen.queryByRole('tab')).not.toBeInTheDocument()
      expect(screen.getByText('Följa föreskrifter om SAM.')).toBeInTheDocument()
    })

    it('collapses expanded row on second click', async () => {
      const user = userEvent.setup()
      render(<TemplateSectionsAccordion sections={mockSections} />)

      await user.click(screen.getByText('Grundläggande regelverk'))

      // Expand
      await user.click(screen.getByText('Arbetsmiljölag'))
      expect(screen.getByRole('tab', { name: 'Krav' })).toBeInTheDocument()

      // Collapse
      await user.click(screen.getByText('Arbetsmiljölag'))
      expect(screen.queryByRole('tab')).not.toBeInTheDocument()
    })

    it('does not expand row when item has no content', async () => {
      const user = userEvent.setup()
      render(<TemplateSectionsAccordion sections={mockSections} />)

      await user.click(screen.getByText('Fysisk arbetsmiljö'))

      const row = screen.getByText('Personlig skyddsutrustning').closest('tr')
      expect(row).toBeInTheDocument()

      await user.click(screen.getByText('Personlig skyddsutrustning'))

      const table = screen
        .getByText('Personlig skyddsutrustning')
        .closest('table')
      expect(table).toBeInTheDocument()
      const rows = within(table!).getAllByRole('row')
      // 1 header row + 1 data row = 2
      expect(rows).toHaveLength(2)
    })
  })

  describe('bullet formatting', () => {
    it('renders bullet lines as a proper list', async () => {
      const user = userEvent.setup()
      const sectionWithBullets: TemplateDetailSection[] = [
        {
          id: 'section-bullets',
          section_number: '01',
          name: 'Bullets test',
          description: null,
          item_count: 1,
          position: 1,
          items: [
            {
              id: 'item-bullets',
              index: '0100',
              position: 1,
              compliance_summary:
                'Vi ska göra följande:\n\n- Punkt ett\n- Punkt två\n- Punkt tre',
              expert_commentary: null,
              source_type: 'lag',
              regulatory_body: null,
              document: {
                id: 'doc-b',
                document_number: 'SFS 2000:1',
                title: 'Testlag',
                slug: 'test',
              },
            },
          ],
        },
        {
          ...mockSections[1]!,
        },
      ]

      render(<TemplateSectionsAccordion sections={sectionWithBullets} />)

      await user.click(screen.getByText('Bullets test'))
      await user.click(screen.getByText('Testlag'))

      // Bullet content rendered
      expect(screen.getByText('Punkt ett')).toBeInTheDocument()
      expect(screen.getByText('Punkt två')).toBeInTheDocument()
      expect(screen.getByText('Punkt tre')).toBeInTheDocument()
    })
  })

  describe('single-section', () => {
    it('renders without accordion chrome for single section', () => {
      const singleSection = [mockSections[0]!]
      render(<TemplateSectionsAccordion sections={singleSection} />)

      expect(screen.getByText('Grundläggande regelverk')).toBeInTheDocument()
      // Items visible directly without expanding
      expect(screen.getByText('Arbetsmiljölag')).toBeInTheDocument()
      expect(screen.getByText('SFS 1977:1160')).toBeInTheDocument()
    })

    it('shows "Sektionsindelning kommer snart" note', () => {
      const singleSection = [mockSections[0]!]
      render(<TemplateSectionsAccordion sections={singleSection} />)

      expect(
        screen.getByText('Sektionsindelning kommer snart')
      ).toBeInTheDocument()
    })
  })

  describe('empty section', () => {
    it('shows placeholder message for empty items', async () => {
      const user = userEvent.setup()
      const emptySection: TemplateDetailSection = {
        id: 'empty-section',
        section_number: '03',
        name: 'Tom sektion',
        description: null,
        item_count: 0,
        position: 3,
        items: [],
      }

      render(
        <TemplateSectionsAccordion sections={[...mockSections, emptySection]} />
      )

      await user.click(screen.getByText('Tom sektion'))

      expect(
        screen.getByText('Inga dokument i denna sektion ännu')
      ).toBeInTheDocument()
    })
  })
})
