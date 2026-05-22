/**
 * Story 14.24, Task 10.2: tests for the DRAFT_DOCUMENT approval renderer.
 * Covers PENDING (title/excerpt/controls), the canvas seam ("Visa hela utkastet"
 * → openDetail), context-link chip dismiss, "Öppna i editor" → openDraftInEditor
 * + navigation, APPROVED (document link), and the IN_EDITOR frame state.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import type { PendingAgentAction } from '@prisma/client'

const { mockPush, mockOpenDraftInEditor, mockOpenDetail, mockToastError } =
  vi.hoisted(() => ({
    mockPush: vi.fn(),
    mockOpenDraftInEditor: vi.fn(),
    mockOpenDetail: vi.fn(),
    mockToastError: vi.fn(),
  }))

vi.mock('next/navigation', () => ({ useRouter: () => ({ push: mockPush }) }))
vi.mock('sonner', () => ({
  toast: { error: mockToastError, success: vi.fn() },
}))
vi.mock('@/app/actions/pending-agent-actions', () => ({
  openDraftInEditor: mockOpenDraftInEditor,
}))
vi.mock('@/lib/ai/chat-detail-context', () => ({
  useChatDetailSafe: () => ({ openDetail: mockOpenDetail }),
}))

import { DraftDocumentRenderer } from '@/components/features/ai-chat/agent-action-renderers/draft-document-renderer'

const validDoc = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [{ type: 'text', text: 'Rubrik' }],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Syfte och omfattning.' }],
    },
    { type: 'paragraph', content: [{ type: 'text', text: 'Ansvar.' }] },
  ],
}

const baseParams = {
  title: 'Arbetsmiljöpolicy',
  docType: 'POLICY',
  contentJson: validDoc,
  contextLinks: [{ kind: 'LIST_ITEM', id: 'li_1' }],
}

function action(
  overrides: Partial<PendingAgentAction> = {}
): PendingAgentAction {
  return {
    id: 'pa_1',
    workspace_id: 'ws_1',
    user_id: 'user_1',
    conversation_id: null,
    chat_message_id: 'cm_1',
    context_type: 'GLOBAL',
    context_id: null,
    action_type: 'DRAFT_DOCUMENT',
    status: 'PENDING',
    params: baseParams,
    result_ref: null,
    created_at: new Date(),
    decided_at: null,
    expires_at: new Date(Date.now() + 1_000_000),
    ...overrides,
  } as PendingAgentAction
}

const handlers = () => ({
  onApprove: vi.fn(),
  onReject: vi.fn(),
  onParamsChange: vi.fn(),
})

const expandJustera = () => fireEvent.click(screen.getByText('Justera'))

beforeEach(() => vi.clearAllMocks())

describe('DraftDocumentRenderer', () => {
  it('PENDING: shows the summary, and (behind Justera) title + Öppna i editor + Godkänn', () => {
    const h = handlers()
    render(
      <DraftDocumentRenderer action={action()} isSubmitting={false} {...h} />
    )
    expect(
      screen.getByText(/Utkast: Policy "Arbetsmiljöpolicy"/)
    ).toBeInTheDocument()
    expect(
      screen.queryByDisplayValue('Arbetsmiljöpolicy')
    ).not.toBeInTheDocument()
    expandJustera()
    expect(screen.getByDisplayValue('Arbetsmiljöpolicy')).toBeInTheDocument()
    expect(
      screen.getByRole('button', { name: /Öppna i editor/ })
    ).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Godkänn/ }))
    expect(h.onApprove).toHaveBeenCalledOnce()
  })

  it('disables Godkänn when the title is empty', () => {
    const h = handlers()
    render(
      <DraftDocumentRenderer
        action={action({ params: { ...baseParams, title: '' } as never })}
        isSubmitting={false}
        {...h}
      />
    )
    expect(screen.getByRole('button', { name: /Godkänn/ })).toBeDisabled()
  })

  it('"Visa hela utkastet" opens the draft in the detail panel (canvas seam)', () => {
    render(
      <DraftDocumentRenderer
        action={action()}
        isSubmitting={false}
        {...handlers()}
      />
    )
    expandJustera()
    fireEvent.click(screen.getByRole('button', { name: /Visa hela utkastet/ }))
    expect(mockOpenDetail).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'document-draft', id: 'pa_1' })
    )
  })

  it('dismissing a context-link chip removes it', () => {
    render(
      <DraftDocumentRenderer
        action={action()}
        isSubmitting={false}
        {...handlers()}
      />
    )
    expandJustera()
    expect(screen.getByText('Lag')).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Ta bort koppling/ }))
    expect(screen.queryByText('Lag')).not.toBeInTheDocument()
  })

  it('shows the snapshotted link title when present (not the generic kind label)', () => {
    const withTitle = action({
      params: {
        ...baseParams,
        contextLinks: [{ kind: 'LIST_ITEM', id: 'li_1', title: 'Miljöbalken' }],
      } as never,
    })
    render(
      <DraftDocumentRenderer
        action={withTitle}
        isSubmitting={false}
        {...handlers()}
      />
    )
    expandJustera()
    expect(screen.getByText('Miljöbalken')).toBeInTheDocument()
    expect(screen.queryByText('Lag')).not.toBeInTheDocument()
  })

  it('"Öppna i editor" calls openDraftInEditor and navigates to the editor', async () => {
    mockOpenDraftInEditor.mockResolvedValue({
      success: true,
      data: { documentId: 'doc_1' },
    })
    render(
      <DraftDocumentRenderer
        action={action()}
        isSubmitting={false}
        {...handlers()}
      />
    )
    expandJustera()
    fireEvent.click(screen.getByRole('button', { name: /Öppna i editor/ }))
    await waitFor(() =>
      expect(mockOpenDraftInEditor).toHaveBeenCalledWith('pa_1')
    )
    await waitFor(() =>
      expect(mockPush).toHaveBeenCalledWith(
        '/workspace/styrdokument/doc_1/edit?agentApprovalId=pa_1'
      )
    )
  })

  it('APPROVED: shows confirmation + a link to the created document', () => {
    render(
      <DraftDocumentRenderer
        action={action({
          status: 'APPROVED',
          result_ref: { documentId: 'doc_1' } as never,
        })}
        isSubmitting={false}
        {...handlers()}
      />
    )
    expect(screen.getByText(/dokument skapat/i)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /Öppna dokument/ })
    expect(link).toHaveAttribute('href', '/workspace/styrdokument/doc_1/edit')
  })

  it('IN_EDITOR: shows the editor fallback text and an Avvisa control', () => {
    const h = handlers()
    render(
      <DraftDocumentRenderer
        action={action({
          status: 'IN_EDITOR',
          result_ref: { documentId: 'doc_1' } as never,
        })}
        isSubmitting={false}
        {...h}
      />
    )
    expect(screen.getByText(/Öppet i editor/)).toBeInTheDocument()
    fireEvent.click(screen.getByRole('button', { name: /Avvisa/ }))
    expect(h.onReject).toHaveBeenCalledOnce()
  })

  it('compact: renders the one-line summary', () => {
    render(
      <DraftDocumentRenderer
        action={action()}
        isSubmitting={false}
        compact
        {...handlers()}
      />
    )
    expect(
      screen.getByText(/Utkast: Policy "Arbetsmiljöpolicy"/)
    ).toBeInTheDocument()
  })
})
