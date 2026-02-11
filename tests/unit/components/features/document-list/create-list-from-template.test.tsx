/**
 * Story 12.10b: CreateListFromTemplate Component Tests
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { CreateListFromTemplate } from '@/components/features/document-list/create-list-from-template'
import type { PublishedTemplate } from '@/lib/db/queries/template-catalog'

// Mock adoptTemplate server action
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

import { adoptTemplate } from '@/app/actions/template-adoption'
import { toast } from 'sonner'

const mockTemplate: PublishedTemplate = {
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
}

describe('CreateListFromTemplate', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders template name, document count, and regulatory bodies', () => {
    render(
      <CreateListFromTemplate
        template={mockTemplate}
        onBack={vi.fn()}
        onCreated={vi.fn()}
      />
    )

    // Template name appears as heading and also pre-filled in input
    const nameElements = screen.getAllByText('Arbetsmiljö')
    expect(nameElements.length).toBeGreaterThanOrEqual(1)
    expect(screen.getByText('112 lagar')).toBeInTheDocument()
    expect(screen.getByText('9 kategorier')).toBeInTheDocument()
    expect(screen.getByText('Arbetsmiljöverket')).toBeInTheDocument()
    expect(screen.getByText('Riksdagen')).toBeInTheDocument()
  })

  it('pre-fills name input with template name', () => {
    render(
      <CreateListFromTemplate
        template={mockTemplate}
        onBack={vi.fn()}
        onCreated={vi.fn()}
      />
    )

    const nameInput = screen.getByLabelText('Namn')
    expect(nameInput).toHaveValue('Arbetsmiljö')
  })

  it('pre-fills description textarea with template description', () => {
    render(
      <CreateListFromTemplate
        template={mockTemplate}
        onBack={vi.fn()}
        onCreated={vi.fn()}
      />
    )

    const descInput = screen.getByLabelText('Beskrivning (valfritt)')
    expect(descInput).toHaveValue(mockTemplate.description)
  })

  it('name input is editable', async () => {
    const user = userEvent.setup()
    render(
      <CreateListFromTemplate
        template={mockTemplate}
        onBack={vi.fn()}
        onCreated={vi.fn()}
      />
    )

    const nameInput = screen.getByLabelText('Namn')
    await user.clear(nameInput)
    await user.type(nameInput, 'Min lista')

    expect(nameInput).toHaveValue('Min lista')
  })

  it('calls adoptTemplate with correct templateSlug and user-edited name on submit', async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    vi.mocked(adoptTemplate).mockResolvedValue({
      success: true,
      data: { listId: 'list-1', listName: 'Anpassat namn', itemCount: 112 },
    })

    render(
      <CreateListFromTemplate
        template={mockTemplate}
        onBack={vi.fn()}
        onCreated={onCreated}
      />
    )

    const nameInput = screen.getByLabelText('Namn')
    await user.clear(nameInput)
    await user.type(nameInput, 'Anpassat namn')

    const submitBtn = screen.getByRole('button', { name: /skapa från mall/i })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(adoptTemplate).toHaveBeenCalledWith({
        templateSlug: 'arbetsmiljo',
        name: 'Anpassat namn',
        description: mockTemplate.description,
        isDefault: false,
      })
    })
  })

  it('calls adoptTemplate with original template name when name is not edited', async () => {
    const user = userEvent.setup()
    vi.mocked(adoptTemplate).mockResolvedValue({
      success: true,
      data: { listId: 'list-1', listName: 'Arbetsmiljö', itemCount: 112 },
    })

    render(
      <CreateListFromTemplate
        template={mockTemplate}
        onBack={vi.fn()}
        onCreated={vi.fn()}
      />
    )

    const submitBtn = screen.getByRole('button', { name: /skapa från mall/i })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(adoptTemplate).toHaveBeenCalledWith({
        templateSlug: 'arbetsmiljo',
        name: 'Arbetsmiljö',
        description: mockTemplate.description,
        isDefault: false,
      })
    })
  })

  it('shows success toast on successful adoption', async () => {
    const user = userEvent.setup()
    const onCreated = vi.fn()
    vi.mocked(adoptTemplate).mockResolvedValue({
      success: true,
      data: { listId: 'list-1', listName: 'Arbetsmiljö', itemCount: 112 },
    })

    render(
      <CreateListFromTemplate
        template={mockTemplate}
        onBack={vi.fn()}
        onCreated={onCreated}
      />
    )

    const submitBtn = screen.getByRole('button', { name: /skapa från mall/i })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(toast.success).toHaveBeenCalledWith(
        "Mallen 'Arbetsmiljö' har lagts till med 112 lagar"
      )
    })

    await waitFor(() => {
      expect(onCreated).toHaveBeenCalledWith('list-1')
    })
  })

  it('shows error toast on failed adoption', async () => {
    const user = userEvent.setup()
    vi.mocked(adoptTemplate).mockResolvedValue({
      success: false,
      error: 'Mallen hittades inte',
    })

    render(
      <CreateListFromTemplate
        template={mockTemplate}
        onBack={vi.fn()}
        onCreated={vi.fn()}
      />
    )

    const submitBtn = screen.getByRole('button', { name: /skapa från mall/i })
    await user.click(submitBtn)

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Mallen hittades inte')
    })
  })

  it('back button calls onBack', async () => {
    const user = userEvent.setup()
    const onBack = vi.fn()
    render(
      <CreateListFromTemplate
        template={mockTemplate}
        onBack={onBack}
        onCreated={vi.fn()}
      />
    )

    const backBtn = screen.getByRole('button', { name: /tillbaka/i })
    await user.click(backBtn)

    expect(onBack).toHaveBeenCalledOnce()
  })

  it('renders description text from template', () => {
    render(
      <CreateListFromTemplate
        template={mockTemplate}
        onBack={vi.fn()}
        onCreated={vi.fn()}
      />
    )

    // Description appears in summary (as <p>) and pre-filled in textarea
    // Use getAllByText since both render the same text
    const descElements = screen.getAllByText(
      'Omfattande lagkrav för alla svenska arbetsgivare inom arbetsmiljöområdet.'
    )
    expect(descElements.length).toBeGreaterThanOrEqual(1)
  })
})
