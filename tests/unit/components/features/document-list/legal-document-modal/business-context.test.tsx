/**
 * Story 6.3: Business Context Unit Tests
 * Updated to match Jira-style click-to-edit with RichTextEditor/RichTextDisplay
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { BusinessContext } from '@/components/features/document-list/legal-document-modal/business-context'
import { Accordion } from '@/components/ui/accordion'

// Mock the server action
vi.mock('@/app/actions/legal-document-modal', () => ({
  updateListItemBusinessContext: vi.fn().mockResolvedValue({ success: true }),
}))

// Mock sonner
vi.mock('sonner', () => ({
  toast: {
    error: vi.fn(),
  },
}))

// Mock swr (used for cache mutation)
vi.mock('swr', () => ({
  mutate: vi.fn(),
}))

// Track the latest onChange callback from RichTextEditor
let _latestOnChange: ((_content: string) => void) | null = null

// Mock the RichTextEditor and RichTextDisplay components
vi.mock('@/components/ui/rich-text-editor', () => ({
  RichTextEditor: ({
    content,
    onChange,
    placeholder,
  }: {
    content: string
    onChange: (_content: string) => void
    placeholder?: string
  }) => {
    _latestOnChange = onChange
    return (
      <div data-testid="rich-text-editor">
        <textarea
          data-testid="rte-textarea"
          value={content}
          placeholder={placeholder}
          onChange={(e) => onChange(e.target.value)}
        />
      </div>
    )
  },
  RichTextDisplay: ({ content }: { content: string }) => (
    <div data-testid="rich-text-display">{content || 'Ingen beskrivning'}</div>
  ),
}))

/** Helper to render BusinessContext inside an Accordion wrapper */
function renderBusinessContext(
  props: Partial<Parameters<typeof BusinessContext>[0]> = {}
) {
  const defaultProps = {
    listItemId: 'test-item-123',
    initialContent: null,
  }
  return render(
    <Accordion type="multiple" defaultValue={['business-context']}>
      <BusinessContext {...defaultProps} {...props} />
    </Accordion>
  )
}

describe('BusinessContext', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    _latestOnChange = null
  })

  it('renders the accordion trigger with title', () => {
    renderBusinessContext()

    expect(screen.getByText(/hur påverkar denna lag oss/i)).toBeInTheDocument()
  })

  it('renders in view mode by default showing RichTextDisplay', () => {
    renderBusinessContext()

    expect(screen.getByTestId('rich-text-display')).toBeInTheDocument()
    expect(screen.queryByTestId('rich-text-editor')).not.toBeInTheDocument()
  })

  it('shows "Ingen beskrivning" when content is empty', () => {
    renderBusinessContext({ initialContent: null })

    expect(screen.getByText('Ingen beskrivning')).toBeInTheDocument()
  })

  it('shows initial content in display mode', () => {
    renderBusinessContext({
      initialContent: 'This law affects our HR processes.',
    })

    expect(
      screen.getByText('This law affects our HR processes.')
    ).toBeInTheDocument()
  })

  it('enters edit mode when clicking the display area', async () => {
    const user = userEvent.setup()
    renderBusinessContext({ initialContent: 'Some content' })

    // Click the clickable display area (role="button")
    const editButton =
      screen
        .getByRole('button', { name: /klicka för att redigera/i })
        .closest('[role="button"]') ||
      screen.getByTestId('rich-text-display').closest('[role="button"]')
    if (editButton) {
      await user.click(editButton)
    }

    await waitFor(() => {
      expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument()
    })
  })

  it('shows Save and Cancel buttons in edit mode', async () => {
    const user = userEvent.setup()
    renderBusinessContext({ initialContent: 'Some content' })

    // Click display area to enter edit mode
    const displayArea = screen
      .getByTestId('rich-text-display')
      .closest('[role="button"]')
    if (displayArea) {
      await user.click(displayArea)
    }

    await waitFor(() => {
      expect(screen.getByText('Spara')).toBeInTheDocument()
      expect(screen.getByText('Avbryt')).toBeInTheDocument()
    })
  })

  it('auto-starts in edit mode when autoEdit is true', () => {
    renderBusinessContext({ autoEdit: true })

    expect(screen.getByTestId('rich-text-editor')).toBeInTheDocument()
    expect(screen.getByText('Spara')).toBeInTheDocument()
  })

  it('shows saving indicator when Save is clicked', async () => {
    const user = userEvent.setup()

    // Make the mock delay long enough to observe saving state
    const { updateListItemBusinessContext } = await import(
      '@/app/actions/legal-document-modal'
    )
    vi.mocked(updateListItemBusinessContext).mockImplementation(
      () =>
        new Promise((resolve) =>
          setTimeout(() => resolve({ success: true }), 5000)
        )
    )

    renderBusinessContext({ autoEdit: true, initialContent: null })

    // Type some content via the mock textarea
    const textarea = screen.getByTestId('rte-textarea')
    await user.clear(textarea)
    await user.type(textarea, 'New context')

    // Click Save
    const saveButton = screen.getByRole('button', { name: /spara/i })
    await user.click(saveButton)

    // Should show saving indicator (in button text "Sparar..." and in SaveStatusIndicator)
    await waitFor(() => {
      const savingElements = screen.getAllByText(/sparar/i)
      expect(savingElements.length).toBeGreaterThan(0)
    })
  })

  it('cancels editing and reverts content', async () => {
    const user = userEvent.setup()
    renderBusinessContext({
      initialContent: 'Original content',
      autoEdit: true,
    })

    // Click Cancel
    await user.click(screen.getByText('Avbryt'))

    // Should be back in view mode showing original content
    await waitFor(() => {
      expect(screen.getByTestId('rich-text-display')).toBeInTheDocument()
      expect(screen.getByText('Original content')).toBeInTheDocument()
    })
  })
})
