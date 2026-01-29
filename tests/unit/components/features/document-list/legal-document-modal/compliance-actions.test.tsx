/**
 * Story 6.18: ComplianceActions Component Tests
 * Tests the modal accordion section for "Hur efterlever vi kraven?"
 * Mirrors business-context.test.tsx patterns
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { Accordion } from '@/components/ui/accordion'
import { ComplianceActions } from '@/components/features/document-list/legal-document-modal/compliance-actions'

// Mock the server action
vi.mock('@/app/actions/legal-document-modal', () => ({
  updateListItemComplianceActions: vi.fn().mockResolvedValue({ success: true }),
}))

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

// Mock SWR mutate
vi.mock('swr', () => ({
  mutate: vi.fn(),
}))

// Mock RichTextEditor and RichTextDisplay
vi.mock('@/components/ui/rich-text-editor', () => ({
  RichTextEditor: ({
    content,
    onChange,
    placeholder,
  }: {
    content: string
    onChange: (_val: string) => void
    placeholder?: string
  }) => (
    <textarea
      data-testid="rich-text-editor"
      value={content}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
    />
  ),
  RichTextDisplay: ({ content }: { content: string }) => (
    <div data-testid="rich-text-display">{content}</div>
  ),
}))

/** Wrapper to provide required Accordion context with section open */
function renderInAccordion(ui: React.ReactElement) {
  return render(
    <Accordion type="multiple" defaultValue={['compliance-actions']}>
      {ui}
    </Accordion>
  )
}

describe('ComplianceActions', () => {
  const defaultProps = {
    listItemId: 'test-item-123',
    initialContent: null as string | null,
  }

  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders accordion with correct title', () => {
    renderInAccordion(<ComplianceActions {...defaultProps} />)

    expect(screen.getByText('Hur efterlever vi kraven?')).toBeInTheDocument()
  })

  it('renders in display mode by default when content exists', () => {
    renderInAccordion(
      <ComplianceActions {...defaultProps} initialContent="Existing content" />
    )

    expect(screen.getByTestId('rich-text-display')).toBeInTheDocument()
    expect(screen.queryByTestId('rich-text-editor')).not.toBeInTheDocument()
  })

  it('switches to edit mode when clicking display area', async () => {
    const user = userEvent.setup()
    renderInAccordion(
      <ComplianceActions {...defaultProps} initialContent="Existing content" />
    )

    // The display area is a div with role="button"
    const editArea = screen
      .getByTestId('rich-text-display')
      .closest('[role="button"]')!
    await user.click(editArea)

    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument()
  })

  it('starts in edit mode when autoEdit is true', () => {
    renderInAccordion(<ComplianceActions {...defaultProps} autoEdit={true} />)

    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument()
  })

  it('shows Save and Cancel buttons in edit mode', () => {
    renderInAccordion(<ComplianceActions {...defaultProps} autoEdit={true} />)

    expect(screen.getByText('Spara')).toBeInTheDocument()
    expect(screen.getByText('Avbryt')).toBeInTheDocument()
  })

  it('returns to display mode on Cancel click', async () => {
    const user = userEvent.setup()
    renderInAccordion(
      <ComplianceActions
        {...defaultProps}
        initialContent="Existing content"
        autoEdit={true}
      />
    )

    await user.click(screen.getByText('Avbryt'))

    expect(screen.getByTestId('rich-text-display')).toBeInTheDocument()
    expect(screen.queryByTestId('rich-text-editor')).not.toBeInTheDocument()
  })

  it('calls server action on Save', async () => {
    const user = userEvent.setup()
    const { updateListItemComplianceActions } = await import(
      '@/app/actions/legal-document-modal'
    )

    renderInAccordion(<ComplianceActions {...defaultProps} autoEdit={true} />)

    const editor = screen.getByTestId('rich-text-editor')
    await user.clear(editor)
    await user.type(editor, 'New compliance actions')

    await user.click(screen.getByText('Spara'))

    await waitFor(() => {
      expect(updateListItemComplianceActions).toHaveBeenCalledWith(
        'test-item-123',
        'New compliance actions'
      )
    })
  })

  it('shows error toast on save failure', async () => {
    const user = userEvent.setup()
    const { updateListItemComplianceActions } = await import(
      '@/app/actions/legal-document-modal'
    )
    const { toast } = await import('sonner')

    vi.mocked(updateListItemComplianceActions).mockResolvedValueOnce({
      success: false,
      error: 'Server error',
    })

    renderInAccordion(<ComplianceActions {...defaultProps} autoEdit={true} />)

    const editor = screen.getByTestId('rich-text-editor')
    await user.clear(editor)
    await user.type(editor, 'New content')
    await user.click(screen.getByText('Spara'))

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Kunde inte spara', {
        description: 'Server error',
      })
    })
  })

  it('displays metadata when provided', () => {
    renderInAccordion(
      <ComplianceActions
        {...defaultProps}
        initialContent="Some content"
        updatedAt={new Date('2026-01-20')}
        updatedByName="Anna Svensson"
      />
    )

    expect(
      screen.getByText(/senast uppdaterad.*anna svensson/i)
    ).toBeInTheDocument()
  })

  it('shows placeholder text in editor', () => {
    renderInAccordion(<ComplianceActions {...defaultProps} autoEdit={true} />)

    expect(
      screen.getByPlaceholderText(/beskriv hur ni efterlever/i)
    ).toBeInTheDocument()
  })

  it('calls onContentChange after successful save', async () => {
    const user = userEvent.setup()
    const onContentChange = vi.fn()

    renderInAccordion(
      <ComplianceActions
        {...defaultProps}
        autoEdit={true}
        onContentChange={onContentChange}
      />
    )

    const editor = screen.getByTestId('rich-text-editor')
    await user.clear(editor)
    await user.type(editor, 'Updated actions')
    await user.click(screen.getByText('Spara'))

    await waitFor(() => {
      expect(onContentChange).toHaveBeenCalledWith('Updated actions')
    })
  })
})
