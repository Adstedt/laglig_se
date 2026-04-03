import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatDetailProvider } from '@/lib/ai/chat-detail-context'
import { WritePreviewNote } from '@/components/features/ai-chat/details/write-preview-note'
import type { WriteToolResponse } from '@/lib/agent/tools/types'

const mockUpdateListItem = vi.fn()
vi.mock('@/app/actions/document-list', () => ({
  updateListItem: (...args: unknown[]) => mockUpdateListItem(...args),
}))

const mockWriteResponse: WriteToolResponse<unknown> = {
  confirmation_required: true,
  action: 'add_context_note',
  params: {
    listItemId: 'item-1',
    lawTitle: 'Arbetsmiljölagen',
    existingNotes: 'Befintlig anteckning.',
    note: 'Ny anteckning om kemikaliehantering.',
  },
  preview: 'Jag föreslår att lägga till en anteckning.',
  _meta: {
    tool: 'add_context_note',
    executionTimeMs: 20,
    resultCount: 0,
    sidebarHint: 'open',
  },
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ChatDetailProvider>{children}</ChatDetailProvider>
}

describe('WritePreviewNote', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('shows existing notes and pre-fills new note', () => {
    render(
      <TestWrapper>
        <WritePreviewNote data={mockWriteResponse} />
      </TestWrapper>
    )

    expect(screen.getByText('Befintlig anteckning.')).toBeDefined()
    expect(
      screen.getByDisplayValue('Ny anteckning om kemikaliehantering.')
    ).toBeDefined()
  })

  it('confirm calls updateListItem with appended notes', async () => {
    mockUpdateListItem.mockResolvedValue({ success: true })

    render(
      <TestWrapper>
        <WritePreviewNote data={mockWriteResponse} />
      </TestWrapper>
    )

    fireEvent.click(screen.getByText('Bekräfta'))

    await waitFor(() => {
      expect(mockUpdateListItem).toHaveBeenCalledWith({
        listItemId: 'item-1',
        notes: 'Befintlig anteckning.\n\nNy anteckning om kemikaliehantering.',
      })
    })
  })

  it('shows success state after confirm', async () => {
    mockUpdateListItem.mockResolvedValue({ success: true })

    render(
      <TestWrapper>
        <WritePreviewNote data={mockWriteResponse} />
      </TestWrapper>
    )

    fireEvent.click(screen.getByText('Bekräfta'))

    await waitFor(() => {
      expect(screen.getByText('Anteckning tillagd')).toBeDefined()
    })
  })

  it('shows error on failure', async () => {
    mockUpdateListItem.mockResolvedValue({
      success: false,
      error: 'Fel vid sparning',
    })

    render(
      <TestWrapper>
        <WritePreviewNote data={mockWriteResponse} />
      </TestWrapper>
    )

    fireEvent.click(screen.getByText('Bekräfta'))

    await waitFor(() => {
      expect(screen.getByText('Fel vid sparning')).toBeDefined()
    })
  })
})
