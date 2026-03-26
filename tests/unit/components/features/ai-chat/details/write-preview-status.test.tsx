import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatDetailProvider } from '@/lib/ai/chat-detail-context'
import { WritePreviewStatus } from '@/components/features/ai-chat/details/write-preview-status'
import type { WriteToolResponse } from '@/lib/agent/tools/types'

const mockUpdateListItem = vi.fn()
vi.mock('@/app/actions/document-list', () => ({
  updateListItem: (...args: unknown[]) => mockUpdateListItem(...args),
}))

const mockWriteResponse: WriteToolResponse<unknown> = {
  confirmation_required: true,
  action: 'update_compliance_status',
  params: {
    listItemId: 'item-1',
    lawTitle: 'Arbetsmiljölagen',
    oldStatus: 'EJ_PABORJAD',
    complianceStatus: 'PAGAENDE',
  },
  preview: 'Jag föreslår att ändra status till "I arbete".',
  _meta: {
    tool: 'update_compliance_status',
    executionTimeMs: 30,
    resultCount: 0,
    sidebarHint: 'open',
  },
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ChatDetailProvider>{children}</ChatDetailProvider>
}

describe('WritePreviewStatus', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('renders old and new status', () => {
    render(
      <TestWrapper>
        <WritePreviewStatus data={mockWriteResponse} />
      </TestWrapper>
    )

    expect(screen.getByText('Nuvarande:')).toBeDefined()
    expect(screen.getByText('Ej påbörjad')).toBeDefined()
    expect(screen.getByText('Arbetsmiljölagen')).toBeDefined()
  })

  it('confirm calls updateListItem with correct params', async () => {
    mockUpdateListItem.mockResolvedValue({ success: true })

    render(
      <TestWrapper>
        <WritePreviewStatus data={mockWriteResponse} />
      </TestWrapper>
    )

    fireEvent.click(screen.getByText('Bekräfta'))

    await waitFor(() => {
      expect(mockUpdateListItem).toHaveBeenCalledWith({
        listItemId: 'item-1',
        complianceStatus: 'PAGAENDE',
      })
    })
  })

  it('shows success state after confirm', async () => {
    mockUpdateListItem.mockResolvedValue({ success: true })

    render(
      <TestWrapper>
        <WritePreviewStatus data={mockWriteResponse} />
      </TestWrapper>
    )

    fireEvent.click(screen.getByText('Bekräfta'))

    await waitFor(() => {
      expect(screen.getByText('Status uppdaterad')).toBeDefined()
    })
  })

  it('shows error on failure and keeps form editable', async () => {
    mockUpdateListItem.mockResolvedValue({
      success: false,
      error: 'Något gick fel',
    })

    render(
      <TestWrapper>
        <WritePreviewStatus data={mockWriteResponse} />
      </TestWrapper>
    )

    fireEvent.click(screen.getByText('Bekräfta'))

    await waitFor(() => {
      expect(screen.getByText('Något gick fel')).toBeDefined()
    })

    // Form still available
    expect(screen.getByText('Ny status')).toBeDefined()
  })
})
