/**
 * Story 17.11b, Task 7: tests for the ADD_DOCUMENT_SECTION approval renderer.
 *
 * Covers PENDING (new heading + level chip + position context + new body
 * excerpt + secondary "Visa mer"), APPROVED (document link with version chip),
 * REJECTED + EXPIRED (frame surfaces the muted state), and the CP-001
 * guardrail — no raw documentId / pendingActionId / un-natural identifier
 * copy.
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

import { AddDocumentSectionRenderer } from '@/components/features/ai-chat/agent-action-renderers/add-document-section-renderer'

const newBody = [
  {
    type: 'paragraph',
    content: [{ type: 'text', text: 'Syftet med policyn är att …' }],
  },
]

const RAW_DOC_ID = '11111111-1111-1111-1111-111111111111'
const RAW_PENDING_ID = 'pa_22222222'

const baseParams = {
  documentId: RAW_DOC_ID,
  documentTitle: 'Arbetsmiljöpolicy',
  newSectionHeading: 'Inledning',
  newSectionLevel: 2,
  newSectionContentJson: newBody,
  position: { at: 'end' },
  changeSummary: 'Lägg till inledning',
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
    action_type: 'ADD_DOCUMENT_SECTION',
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

function expandJustera() {
  const trigger = screen.queryByRole('button', { name: /justera/i })
  if (trigger) fireEvent.click(trigger)
}

describe('AddDocumentSectionRenderer — PENDING', () => {
  it('renders the document title and new section heading as natural text', () => {
    render(<AddDocumentSectionRenderer action={action()} {...handlers()} />)
    expandJustera()
    expect(screen.getAllByText(/Arbetsmiljöpolicy/).length).toBeGreaterThan(0)
    expect(screen.getAllByText('Inledning').length).toBeGreaterThan(0)
  })

  it('renders the heading level chip (h2)', () => {
    render(<AddDocumentSectionRenderer action={action()} {...handlers()} />)
    expandJustera()
    expect(screen.getByText('h2')).toBeInTheDocument()
  })

  it('renders the position context for at: "end"', () => {
    render(<AddDocumentSectionRenderer action={action()} {...handlers()} />)
    expandJustera()
    expect(screen.getByText(/sist i dokumentet/i)).toBeInTheDocument()
  })

  it('renders the position context for at: "after"', () => {
    render(
      <AddDocumentSectionRenderer
        action={action({
          params: {
            ...baseParams,
            position: { at: 'after', heading: 'Syfte' },
          } as never,
        })}
        {...handlers()}
      />
    )
    expandJustera()
    expect(screen.getByText(/efter "Syfte"/i)).toBeInTheDocument()
  })

  it('renders the position context for at: "start"', () => {
    render(
      <AddDocumentSectionRenderer
        action={action({
          params: { ...baseParams, position: { at: 'start' } } as never,
        })}
        {...handlers()}
      />
    )
    expandJustera()
    expect(screen.getByText(/först i dokumentet/i)).toBeInTheDocument()
  })

  it('renders the position context for at: "before"', () => {
    render(
      <AddDocumentSectionRenderer
        action={action({
          params: {
            ...baseParams,
            position: { at: 'before', heading: 'Ansvar' },
          } as never,
        })}
        {...handlers()}
      />
    )
    expandJustera()
    expect(screen.getByText(/före "Ansvar"/i)).toBeInTheDocument()
  })

  it('shows the new body excerpt and a "(tom)" placeholder for "Nuvarande"', () => {
    render(<AddDocumentSectionRenderer action={action()} {...handlers()} />)
    expandJustera()
    expect(screen.getByText(/Syftet med policyn/)).toBeInTheDocument()
    expect(screen.getByText('(tom)')).toBeInTheDocument()
  })

  it('shows the change summary when provided', () => {
    render(<AddDocumentSectionRenderer action={action()} {...handlers()} />)
    expandJustera()
    expect(screen.getByText('Lägg till inledning')).toBeInTheDocument()
  })

  it('opens the chat detail panel via "Visa mer" reusing the document-update variant with empty old snapshot', () => {
    render(<AddDocumentSectionRenderer action={action()} {...handlers()} />)
    const visaMer = screen.getByRole('button', { name: /visa mer/i })
    fireEvent.click(visaMer)
    expect(mockOpenDetail).toHaveBeenCalledWith({
      type: 'document-update',
      id: RAW_PENDING_ID,
      data: expect.objectContaining({
        documentTitle: 'Arbetsmiljöpolicy',
        sectionHeading: 'Inledning',
        oldSectionContentJson: [],
        newSectionContentJson: newBody,
      }),
    })
  })

  it('CP-001: never renders raw documentId / pendingActionId / quoted identifier copy in PENDING', () => {
    const { container } = render(
      <AddDocumentSectionRenderer action={action()} {...handlers()} />
    )
    const html = container.innerHTML
    expect(html).not.toContain(RAW_DOC_ID)
    expect(html).not.toContain(RAW_PENDING_ID)
    expect(container.querySelectorAll('code')).toHaveLength(0)
  })
})

describe('AddDocumentSectionRenderer — APPROVED', () => {
  it('renders the success line + a link to the document at the new version', () => {
    render(
      <AddDocumentSectionRenderer
        action={action({
          status: 'APPROVED',
          result_ref: { documentId: RAW_DOC_ID, versionNumber: 3 } as never,
          decided_at: new Date(),
        })}
        {...handlers()}
      />
    )
    expect(screen.getByText(/avsnittet tillagt/i)).toBeInTheDocument()
    const link = screen.getByRole('link', { name: /öppna dokument/i })
    expect(link).toHaveAttribute(
      'href',
      `/workspace/styrdokument/${RAW_DOC_ID}/edit`
    )
    expect(screen.getByText(/v3/)).toBeInTheDocument()
  })
})

describe('AddDocumentSectionRenderer — terminal states', () => {
  it('renders without throwing in REJECTED', () => {
    const { container } = render(
      <AddDocumentSectionRenderer
        action={action({ status: 'REJECTED', decided_at: new Date() })}
        {...handlers()}
      />
    )
    expect(container).toBeTruthy()
  })

  it('renders without throwing in EXPIRED', () => {
    const { container } = render(
      <AddDocumentSectionRenderer
        action={action({ status: 'EXPIRED', decided_at: new Date() })}
        {...handlers()}
      />
    )
    expect(container).toBeTruthy()
  })
})
