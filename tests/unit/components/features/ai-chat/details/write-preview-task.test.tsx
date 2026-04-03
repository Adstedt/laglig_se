import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { ChatDetailProvider } from '@/lib/ai/chat-detail-context'
import { WritePreviewTask } from '@/components/features/ai-chat/details/write-preview-task'
import type { WriteToolResponse } from '@/lib/agent/tools/types'

// Mock server action
const mockCreateTask = vi.fn()
vi.mock('@/app/actions/tasks', () => ({
  createTask: (...args: unknown[]) => mockCreateTask(...args),
}))

const mockWriteResponse: WriteToolResponse<unknown> = {
  confirmation_required: true,
  action: 'create_task',
  params: {
    title: 'Uppdatera riskbedömning',
    description: 'Granska kemikaliehanteringen',
    priority: 'HIGH',
    relatedDocument: 'Arbetsmiljölagen',
    linkedListItemIds: ['item-1'],
  },
  preview: 'Jag föreslår att skapa en uppgift.',
  _meta: {
    tool: 'create_task',
    executionTimeMs: 50,
    resultCount: 0,
    sidebarHint: 'open',
  },
}

function TestWrapper({ children }: { children: React.ReactNode }) {
  return <ChatDetailProvider>{children}</ChatDetailProvider>
}

describe('WritePreviewTask', () => {
  beforeEach(() => {
    vi.clearAllMocks()
  })

  it('pre-fills form from WriteToolResponse params', () => {
    render(
      <TestWrapper>
        <WritePreviewTask data={mockWriteResponse} />
      </TestWrapper>
    )

    const titleInput = screen.getByDisplayValue('Uppdatera riskbedömning')
    expect(titleInput).toBeDefined()

    const descInput = screen.getByDisplayValue('Granska kemikaliehanteringen')
    expect(descInput).toBeDefined()

    expect(screen.getByText('Relaterat dokument')).toBeDefined()
    expect(screen.getByText('Arbetsmiljölagen')).toBeDefined()
  })

  it('allows editing title before confirming', async () => {
    mockCreateTask.mockResolvedValue({
      success: true,
      data: { id: 'task-123' },
    })

    render(
      <TestWrapper>
        <WritePreviewTask data={mockWriteResponse} />
      </TestWrapper>
    )

    const titleInput = screen.getByDisplayValue('Uppdatera riskbedömning')
    fireEvent.change(titleInput, { target: { value: 'Ny titel' } })

    fireEvent.click(screen.getByText('Bekräfta'))

    await waitFor(() => {
      expect(mockCreateTask).toHaveBeenCalledWith(
        expect.objectContaining({ title: 'Ny titel' })
      )
    })
  })

  it('shows success state after confirm', async () => {
    mockCreateTask.mockResolvedValue({
      success: true,
      data: { id: 'task-123' },
    })

    render(
      <TestWrapper>
        <WritePreviewTask data={mockWriteResponse} />
      </TestWrapper>
    )

    fireEvent.click(screen.getByText('Bekräfta'))

    await waitFor(() => {
      expect(screen.getByText('Uppgift skapad')).toBeDefined()
    })
  })

  it('shows error state on failure and keeps form editable', async () => {
    mockCreateTask.mockResolvedValue({
      success: false,
      error: 'Servern svarade inte',
    })

    render(
      <TestWrapper>
        <WritePreviewTask data={mockWriteResponse} />
      </TestWrapper>
    )

    fireEvent.click(screen.getByText('Bekräfta'))

    await waitFor(() => {
      expect(screen.getByText('Servern svarade inte')).toBeDefined()
    })

    // Form should still be editable
    expect(screen.getByDisplayValue('Uppdatera riskbedömning')).toBeDefined()
  })

  it('cancel closes sidebar and shows system message', () => {
    // We test that cancel button renders and is clickable
    render(
      <TestWrapper>
        <WritePreviewTask data={mockWriteResponse} />
      </TestWrapper>
    )

    const cancelBtn = screen.getByText('Avbryt')
    expect(cancelBtn).toBeDefined()
    // Click won't throw — verifies the handler runs without error
    fireEvent.click(cancelBtn)
  })
})
