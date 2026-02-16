/**
 * Story 12.10b: ManageListModal Multi-Step Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { ManageListModal } from '@/components/features/document-list/manage-list-modal'
import type { PublishedTemplate } from '@/lib/db/queries/template-catalog'

// Mock server actions
vi.mock('@/app/actions/document-list', () => ({
  createDocumentList: vi.fn(),
  updateDocumentList: vi.fn(),
  deleteDocumentList: vi.fn(),
}))

// Mock adoptTemplate
vi.mock('@/app/actions/template-adoption', () => ({
  adoptTemplate: vi.fn(),
}))

// Mock sonner toast
vi.mock('sonner', () => ({
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}))

// Mock framer-motion to avoid animation complexity in tests
vi.mock('framer-motion', () => ({
  motion: {
    div: ({
      children,
      ...props
    }: {
      children: React.ReactNode
      [key: string]: unknown
    }) => {
      // Filter out framer-motion-specific props before passing to DOM
      const {
        initial: _initial,
        animate: _animate,
        exit: _exit,
        variants: _variants,
        transition: _transition,
        custom: _custom,
        ...domProps
      } = props
      return <div {...domProps}>{children}</div>
    },
  },
  AnimatePresence: ({ children }: { children: React.ReactNode }) => (
    <>{children}</>
  ),
}))

const mockTemplates: PublishedTemplate[] = [
  {
    id: 'uuid-1',
    name: 'Arbetsmiljö',
    slug: 'arbetsmiljo',
    description: 'Arbetsmiljölagstiftning',
    domain: 'arbetsmiljo',
    target_audience: null,
    document_count: 112,
    section_count: 9,
    primary_regulatory_bodies: ['Arbetsmiljöverket'],
    is_variant: false,
    variants: [],
  },
  {
    id: 'uuid-2',
    name: 'Miljö',
    slug: 'miljo',
    description: 'Miljölagstiftning',
    domain: 'miljo',
    target_audience: null,
    document_count: 98,
    section_count: 9,
    primary_regulatory_bodies: ['Naturvårdsverket'],
    is_variant: false,
    variants: [],
  },
]

const defaultProps = {
  open: true,
  onOpenChange: vi.fn(),
  mode: 'create' as const,
  onCreated: vi.fn(),
  onUpdated: vi.fn(),
  onDeleted: vi.fn(),
}

describe('ManageListModal', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  // --- Chooser rendering ---

  it('renders chooser with two option cards when templates are provided', () => {
    render(<ManageListModal {...defaultProps} templates={mockTemplates} />)

    expect(screen.getByText('Börja från mall')).toBeInTheDocument()
    // "Tom lista" may appear as the option card text
    const tomListaElements = screen.getAllByText('Tom lista')
    expect(tomListaElements.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('Skapa ny laglista')).toBeInTheDocument()
  })

  it('skips chooser and shows plain form when templates is empty array', () => {
    render(<ManageListModal {...defaultProps} templates={[]} />)

    // Should show the plain create form
    expect(screen.getByText('Skapa ny lista')).toBeInTheDocument()
    expect(screen.getByLabelText('Namn')).toBeInTheDocument()
    expect(screen.queryByText('Börja från mall')).not.toBeInTheDocument()
  })

  it('skips chooser and shows plain form when templates is undefined', () => {
    render(<ManageListModal {...defaultProps} templates={undefined} />)

    expect(screen.getByText('Skapa ny lista')).toBeInTheDocument()
    expect(screen.getByLabelText('Namn')).toBeInTheDocument()
    expect(screen.queryByText('Börja från mall')).not.toBeInTheDocument()
  })

  // --- Edit mode ---

  it('edit mode renders current form (no chooser)', () => {
    const editList = {
      id: 'list-1',
      name: 'Min lista',
      description: 'Beskrivning',
      isDefault: false,
      itemCount: 5,
      createdAt: new Date().toISOString(),
    }

    render(
      <ManageListModal
        {...defaultProps}
        mode="edit"
        list={editList}
        templates={mockTemplates}
      />
    )

    expect(screen.getByText('Redigera lista')).toBeInTheDocument()
    expect(screen.getByLabelText('Namn')).toHaveValue('Min lista')
    expect(screen.queryByText('Börja från mall')).not.toBeInTheDocument()
  })

  // --- Navigation ---

  it('"Tom lista" card click navigates to blank form step', async () => {
    const user = userEvent.setup()
    render(<ManageListModal {...defaultProps} templates={mockTemplates} />)

    // Click the "Tom lista" card
    const allButtons = screen.getAllByRole('button')
    const blankCard = allButtons.find((btn) =>
      btn.textContent?.includes('Tom lista')
    )
    expect(blankCard).toBeDefined()
    await user.click(blankCard!)

    // Should now show the form
    expect(screen.getByLabelText('Namn')).toBeInTheDocument()
    expect(screen.getByText('Skapa ny lista')).toBeInTheDocument()
  })

  it('template card click navigates to template preview step', async () => {
    const user = userEvent.setup()
    render(<ManageListModal {...defaultProps} templates={mockTemplates} />)

    // Click the Arbetsmiljö template card in the popular templates section
    const allButtons = screen.getAllByRole('button')
    const templateCard = allButtons.find((btn) =>
      btn.textContent?.includes('112 dokument')
    )
    expect(templateCard).toBeDefined()
    await user.click(templateCard!)

    // Should now show the template preview/adopt step
    // "Skapa från mall" appears as both dialog title and button text — use getAllByText
    const skapaFromMall = screen.getAllByText('Skapa från mall')
    expect(skapaFromMall.length).toBeGreaterThanOrEqual(1)
    // Name input pre-filled
    expect(screen.getByLabelText('Namn')).toHaveValue('Arbetsmiljö')
  })

  it('back button from template preview returns to chooser', async () => {
    const user = userEvent.setup()
    render(<ManageListModal {...defaultProps} templates={mockTemplates} />)

    // Navigate to template preview
    const allButtons = screen.getAllByRole('button')
    const templateCard = allButtons.find((btn) =>
      btn.textContent?.includes('112 dokument')
    )
    await user.click(templateCard!)

    // Click back
    const backBtn = screen.getByRole('button', { name: /tillbaka/i })
    await user.click(backBtn)

    // Should be back at chooser
    expect(screen.getByText('Börja från mall')).toBeInTheDocument()
    expect(screen.getByText('Tom lista')).toBeInTheDocument()
  })

  it('back button from blank form returns to chooser (if templates exist)', async () => {
    const user = userEvent.setup()
    render(<ManageListModal {...defaultProps} templates={mockTemplates} />)

    // Navigate to blank form
    const allButtons = screen.getAllByRole('button')
    const blankCard = allButtons.find((btn) =>
      btn.textContent?.includes('Tom lista')
    )
    await user.click(blankCard!)

    // Click Tillbaka
    const backBtn = screen.getByRole('button', { name: /tillbaka/i })
    await user.click(backBtn)

    // Should be back at chooser
    expect(screen.getByText('Börja från mall')).toBeInTheDocument()
  })

  // --- Modal reset ---

  it('modal resets to initial step when re-opened', async () => {
    const user = userEvent.setup()
    const onOpenChange = vi.fn()
    const { rerender } = render(
      <ManageListModal
        {...defaultProps}
        onOpenChange={onOpenChange}
        templates={mockTemplates}
      />
    )

    // Navigate to blank form
    const allButtons = screen.getAllByRole('button')
    const blankCard = allButtons.find((btn) =>
      btn.textContent?.includes('Tom lista')
    )
    await user.click(blankCard!)

    // Modal is now showing blank form
    expect(screen.getByLabelText('Namn')).toBeInTheDocument()

    // Simulate re-open: set open to false then true
    rerender(
      <ManageListModal
        {...defaultProps}
        open={false}
        onOpenChange={onOpenChange}
        templates={mockTemplates}
      />
    )
    rerender(
      <ManageListModal
        {...defaultProps}
        open={true}
        onOpenChange={onOpenChange}
        templates={mockTemplates}
      />
    )

    // Should be back at chooser
    expect(screen.getByText('Börja från mall')).toBeInTheDocument()
  })

  // --- Modal width ---

  it('modal title changes based on step', async () => {
    const user = userEvent.setup()
    render(<ManageListModal {...defaultProps} templates={mockTemplates} />)

    // Chooser step: title is "Skapa ny laglista"
    expect(screen.getByText('Skapa ny laglista')).toBeInTheDocument()

    // Navigate to blank form
    const allButtons = screen.getAllByRole('button')
    const blankCard = allButtons.find((btn) =>
      btn.textContent?.includes('Tom lista')
    )
    await user.click(blankCard!)

    // Blank step: title is "Skapa ny lista"
    expect(screen.getByText('Skapa ny lista')).toBeInTheDocument()
  })
})
