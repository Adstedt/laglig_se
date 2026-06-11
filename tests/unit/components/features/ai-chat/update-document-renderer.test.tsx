/**
 * Story 17.11, Task 7: tests for the UPDATE_DOCUMENT approval renderer.
 *
 * Covers PENDING (heading + before/after excerpts + secondary "Visa mer"),
 * APPROVED (document link with version chip), REJECTED + EXPIRED (frame
 * surfaces the muted state), and the CP-001 guardrail — no raw
 * `documentId` / `pendingActionId` / un-natural identifier-style copy.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent } from '@testing-library/react'
import type { PendingAgentAction } from '@prisma/client'

const { mockOpenDetail } = vi.hoisted(() => ({
  mockOpenDetail: vi.fn(),
}))

vi.mock('@/lib/ai/chat-detail-context', () => ({
  useChatDetailSafe: () => ({ openDetail: mockOpenDetail }),
}))

import { UpdateDocumentRenderer } from '@/components/features/ai-chat/agent-action-renderers/update-document-renderer'

const oldBody = [
  {
    type: 'paragraph',
    content: [{ type: 'text', text: 'Gammalt syfte.' }],
  },
]
const newBody = [
  {
    type: 'paragraph',
    content: [{ type: 'text', text: 'Nytt skärpt syfte.' }],
  },
]

const RAW_DOC_ID = '11111111-1111-1111-1111-111111111111'
const RAW_PENDING_ID = 'pa_22222222'

const baseParams = {
  documentId: RAW_DOC_ID,
  documentTitle: 'Arbetsmiljöpolicy',
  sectionHeading: 'Syfte',
  oldSectionContentJson: oldBody,
  newSectionContentJson: newBody,
  changeSummary: 'Skärpt syftesformulering',
  entity_version: '2026-06-01T10:00:00.000Z',
}

function action(
  overrides: Partial<PendingAgentAction> = {}
): PendingAgentAction {
  return {
    id: RAW_PENDING_ID,
    workspace_id: 'ws_1',
    user_id: 'user_1',
    conversation_id: null,
    chat_message_id: 'cm_1',
    context_type: 'GLOBAL',
    context_id: null,
    action_type: 'UPDATE_DOCUMENT',
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
  isSubmitting: false,
})

beforeEach(() => {
  vi.clearAllMocks()
})

/** ActionRendererFrame collapses the editable body behind a "Justera"
 *  disclosure on PENDING — expand it so the diff rows are queryable. */
function expandJustera() {
  const trigger = screen.queryByRole('button', { name: /justera/i })
  if (trigger) fireEvent.click(trigger)
}

describe('UpdateDocumentRenderer — PENDING', () => {
  it('renders the document title and section heading as natural text', () => {
    render(<UpdateDocumentRenderer action={action()} {...handlers()} />)
    expandJustera()

    // Document title appears (in the summary line).
    expect(screen.getAllByText(/Arbetsmiljöpolicy/).length).toBeGreaterThan(0)
    // Section heading appears in the diff body — match the literal heading text.
    expect(screen.getAllByText('Syfte').length).toBeGreaterThan(0)
  })

  it('shows a word-level diff with removed (struck) and added text', () => {
    render(<UpdateDocumentRenderer action={action()} {...handlers()} />)
    expandJustera()
    // The before/after blocks were replaced by a single inline word-diff under
    // the "Ändring" label: removed words are struck, added words highlighted.
    expect(screen.getByText('Ändring')).toBeInTheDocument()
    const removed = document.querySelector('.line-through')
    expect(removed?.textContent).toContain('Gammalt')
    const added = document.querySelector('.bg-emerald-100')
    expect(added?.textContent).toMatch(/Nytt|skärpt/)
  })

  it('shows the change summary when provided', () => {
    render(<UpdateDocumentRenderer action={action()} {...handlers()} />)
    expandJustera()
    expect(screen.getByText('Skärpt syftesformulering')).toBeInTheDocument()
  })

  it('no longer renders a redundant "Visa mer" panel button (inline diff replaces it)', () => {
    render(<UpdateDocumentRenderer action={action()} {...handlers()} />)
    expect(
      screen.queryByRole('button', { name: /visa mer/i })
    ).not.toBeInTheDocument()
    expect(mockOpenDetail).not.toHaveBeenCalled()
  })

  it('CP-001: never renders raw documentId / pendingActionId / quoted identifier copy in PENDING', () => {
    const { container } = render(
      <UpdateDocumentRenderer action={action()} {...handlers()} />
    )
    const html = container.innerHTML

    // Raw uuid / pending-action id MUST NOT leak into the rendered DOM.
    expect(html).not.toContain(RAW_DOC_ID)
    expect(html).not.toContain(RAW_PENDING_ID)

    // Section heading should NOT be rendered as code-style / monospaced
    // identifier (`<code>Syfte</code>` would be a CP-001 violation).
    expect(container.querySelectorAll('code')).toHaveLength(0)
  })

  it('handles missing snapshots without crashing — shows a "(tom)" placeholder', () => {
    const params = {
      ...baseParams,
      oldSectionContentJson: undefined,
      newSectionContentJson: undefined,
    }
    render(
      <UpdateDocumentRenderer
        action={action({ params: params as never })}
        {...handlers()}
      />
    )
    expandJustera()
    // Both snapshots empty → empty diff → a single "(tom)" placeholder.
    expect(screen.getByText('(tom)')).toBeInTheDocument()
  })
})

describe('UpdateDocumentRenderer — APPROVED', () => {
  it('renders the success line + a link to the document at the new version', () => {
    render(
      <UpdateDocumentRenderer
        action={action({
          status: 'APPROVED',
          result_ref: { documentId: RAW_DOC_ID, versionNumber: 3 } as never,
          decided_at: new Date(),
        })}
        {...handlers()}
      />
    )
    expect(screen.getByText(/dokumentet uppdaterat/i)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /öppna dokument/i })
    expect(link).toHaveAttribute(
      'href',
      `/workspace/styrdokument/${RAW_DOC_ID}/edit`
    )
    expect(screen.getByText(/v3/)).toBeInTheDocument()
  })
})

describe('UpdateDocumentRenderer — terminal states', () => {
  it('renders without throwing in REJECTED', () => {
    const { container } = render(
      <UpdateDocumentRenderer
        action={action({ status: 'REJECTED', decided_at: new Date() })}
        {...handlers()}
      />
    )
    expect(container).toBeTruthy()
  })

  it('renders without throwing in EXPIRED', () => {
    const { container } = render(
      <UpdateDocumentRenderer
        action={action({ status: 'EXPIRED', decided_at: new Date() })}
        {...handlers()}
      />
    )
    expect(container).toBeTruthy()
  })
})

// ============================================================================
// Story 17.11c AC 9 — auto-branch header row
// ============================================================================

describe('UpdateDocumentRenderer — Story 17.11c auto-branch header', () => {
  it('renders the "Skapar nytt utkast v{N+1}" header when creates_draft=true on PENDING', () => {
    render(
      <UpdateDocumentRenderer
        action={action({
          params: { ...baseParams, creates_draft: true, newVersionNumber: 4 },
        })}
        {...handlers()}
      />
    )
    expandJustera()

    // Header line names the new version + document title in natural Swedish.
    expect(
      screen.getByText(/Skapar nytt utkast v4 av Arbetsmiljöpolicy/)
    ).toBeInTheDocument()
  })

  it('does NOT render the header when creates_draft is absent (existing Row 1/2 path)', () => {
    render(<UpdateDocumentRenderer action={action()} {...handlers()} />)
    expandJustera()

    expect(screen.queryByText(/Skapar nytt utkast/)).not.toBeInTheDocument()
  })

  it('CP-001: header copy uses natural-language title + version number — no raw IDs', () => {
    const { container } = render(
      <UpdateDocumentRenderer
        action={action({
          params: { ...baseParams, creates_draft: true, newVersionNumber: 4 },
        })}
        {...handlers()}
      />
    )
    expandJustera()
    // Raw document ID and pendingActionId must never leak into the DOM —
    // checked across the whole rendered tree.
    expect(container.textContent ?? '').not.toContain(RAW_DOC_ID)
    expect(container.textContent ?? '').not.toContain(RAW_PENDING_ID)
  })

  it('does NOT render the header on APPROVED (post-approval resultRef takes over)', () => {
    render(
      <UpdateDocumentRenderer
        action={action({
          status: 'APPROVED',
          decided_at: new Date(),
          params: { ...baseParams, creates_draft: true, newVersionNumber: 4 },
          result_ref: {
            documentId: RAW_DOC_ID,
            versionId: 'v_4',
            versionNumber: 4,
          },
        })}
        {...handlers()}
      />
    )

    expect(screen.queryByText(/Skapar nytt utkast/)).not.toBeInTheDocument()
  })
})
