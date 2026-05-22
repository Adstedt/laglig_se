/**
 * Story 14.24, Task 10.1: unit tests for the draft_styrdokument tool.
 * Covers the AC 3a content-quality gate, pending-row creation (DRAFT_DOCUMENT),
 * contextLinks persistence, and plaintext preview extraction from Tiptap JSON.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    pendingAgentAction: { create: vi.fn() },
    lawListItem: { findFirst: vi.fn() },
    task: { findFirst: vi.fn() },
  },
}))

import { createDraftStyrdokumentTool } from '@/lib/agent/tools/draft-styrdokument'
import { prisma } from '@/lib/prisma'

type ExecFn = (
  _input: Record<string, unknown>
) => Promise<Record<string, unknown>>
function execOf(tool: unknown): ExecFn {
  return (tool as { execute: ExecFn }).execute
}

const fn = (m: unknown) => m as ReturnType<typeof vi.fn>
const CTX = {
  userId: 'u_1',
  assistantMessageId: 'cm_1',
  contextType: 'GLOBAL' as const,
}

/** Valid Tiptap doc: 3 top-level blocks incl. a heading (passes AC 3a). */
const validDoc = {
  type: 'doc',
  content: [
    {
      type: 'heading',
      attrs: { level: 1 },
      content: [
        { type: 'text', text: 'Policy för systematiskt arbetsmiljöarbete' },
      ],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Syfte och omfattning för policyn.' }],
    },
    {
      type: 'paragraph',
      content: [{ type: 'text', text: 'Ansvar och roller i organisationen.' }],
    },
  ],
}

beforeEach(() => {
  vi.clearAllMocks()
  fn(prisma.pendingAgentAction.create).mockResolvedValue({ id: 'pa_x' })
  // Default: context links resolve to valid workspace entities (tests that need a
  // dropped/invalid link override these with mockResolvedValue(null)).
  fn(prisma.lawListItem.findFirst).mockResolvedValue({
    document: { title: 'Miljöbalken', document_number: 'SFS 1998:808' },
  })
  fn(prisma.task.findFirst).mockResolvedValue({ title: 'Brandskydd' })
})

describe('draft_styrdokument', () => {
  it('creates a DRAFT_DOCUMENT row for a valid draft and returns the pendingActionId', async () => {
    const result = await execOf(createDraftStyrdokumentTool('ws_1', CTX))({
      title: 'Arbetsmiljöpolicy',
      docType: 'POLICY',
      contentJson: validDoc,
      contextLinks: [{ kind: 'LIST_ITEM', id: 'li_1' }],
    })

    const call = fn(prisma.pendingAgentAction.create).mock.calls[0][0]
    expect(call.data.action_type).toBe('DRAFT_DOCUMENT')
    expect(call.data.status).toBe('PENDING')
    expect(call.data.params).toMatchObject({
      title: 'Arbetsmiljöpolicy',
      docType: 'POLICY',
      contextLinks: [{ kind: 'LIST_ITEM', id: 'li_1' }],
    })
    expect(result.confirmation_required).toBe(true)
    expect(result.data).toEqual({ pendingActionId: 'pa_x' })
  })

  it('extracts a plaintext preview from the Tiptap JSON into the envelope', async () => {
    const result = await execOf(createDraftStyrdokumentTool('ws_1', CTX))({
      title: 'Arbetsmiljöpolicy',
      docType: 'POLICY',
      contentJson: validDoc,
    })
    expect(result.preview).toContain(
      'Policy för systematiskt arbetsmiljöarbete'
    )
    expect(result.preview).toContain('Syfte och omfattning')
  })

  it('defaults contextLinks to an empty array when omitted', async () => {
    await execOf(createDraftStyrdokumentTool('ws_1', CTX))({
      title: 'Rutin',
      docType: 'PROCEDURE',
      contentJson: validDoc,
    })
    const call = fn(prisma.pendingAgentAction.create).mock.calls[0][0]
    expect(call.data.params.contextLinks).toEqual([])
  })

  it('auto-derives a LIST_ITEM link (with snapshotted law title) from a LAW-context chat', async () => {
    fn(prisma.lawListItem.findFirst).mockResolvedValue({
      document: { title: 'Miljöbalken', document_number: 'SFS 1998:808' },
    })
    const LAW_CTX = { ...CTX, contextType: 'LAW' as const, contextId: 'li_ctx' }
    await execOf(createDraftStyrdokumentTool('ws_1', LAW_CTX))({
      title: 'Policy',
      docType: 'POLICY',
      contentJson: validDoc,
    })
    const call = fn(prisma.pendingAgentAction.create).mock.calls[0][0]
    expect(call.data.params.contextLinks).toContainEqual({
      kind: 'LIST_ITEM',
      id: 'li_ctx',
      title: 'Miljöbalken',
    })
  })

  it('auto-derives a TASK link (with snapshotted task title) from a TASK-context chat', async () => {
    fn(prisma.task.findFirst).mockResolvedValue({ title: 'Brandskydd' })
    const TASK_CTX = {
      ...CTX,
      contextType: 'TASK' as const,
      contextId: 't_ctx',
    }
    await execOf(createDraftStyrdokumentTool('ws_1', TASK_CTX))({
      title: 'Policy',
      docType: 'POLICY',
      contentJson: validDoc,
    })
    const call = fn(prisma.pendingAgentAction.create).mock.calls[0][0]
    expect(call.data.params.contextLinks).toContainEqual({
      kind: 'TASK',
      id: 't_ctx',
      title: 'Brandskydd',
    })
  })

  it('drops an agent-supplied link that does not resolve to a workspace entity', async () => {
    fn(prisma.lawListItem.findFirst).mockResolvedValue(null) // invalid id
    await execOf(createDraftStyrdokumentTool('ws_1', CTX))({
      title: 'Policy',
      docType: 'POLICY',
      contentJson: validDoc,
      contextLinks: [{ kind: 'LIST_ITEM', id: 'bogus' }],
    })
    const call = fn(prisma.pendingAgentAction.create).mock.calls[0][0]
    expect(call.data.params.contextLinks).toEqual([])
  })

  it('strips a dangerous link href (javascript:) but keeps a safe one', async () => {
    const docWithLinks = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Rubrik' }],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Klicka',
              marks: [{ type: 'link', attrs: { href: 'javascript:alert(1)' } }],
            },
          ],
        },
        {
          type: 'paragraph',
          content: [
            {
              type: 'text',
              text: 'Säker',
              marks: [{ type: 'link', attrs: { href: 'https://example.com' } }],
            },
          ],
        },
      ],
    }
    await execOf(createDraftStyrdokumentTool('ws_1', CTX))({
      title: 'Policy',
      docType: 'POLICY',
      contentJson: docWithLinks,
    })
    const persisted = JSON.stringify(
      fn(prisma.pendingAgentAction.create).mock.calls[0][0].data.params
        .contentJson
    )
    expect(persisted).not.toContain('javascript:alert')
    expect(persisted).toContain('https://example.com')
    expect(persisted).toContain('Klicka') // text kept, only the link mark dropped
  })

  it('does not duplicate a context link the agent already provided', async () => {
    const LAW_CTX = { ...CTX, contextType: 'LAW' as const, contextId: 'li_ctx' }
    await execOf(createDraftStyrdokumentTool('ws_1', LAW_CTX))({
      title: 'Policy',
      docType: 'POLICY',
      contentJson: validDoc,
      contextLinks: [{ kind: 'LIST_ITEM', id: 'li_ctx' }],
    })
    const call = fn(prisma.pendingAgentAction.create).mock.calls[0][0]
    const matches = call.data.params.contextLinks.filter(
      (l: { kind: string; id: string }) => l.id === 'li_ctx'
    )
    expect(matches).toHaveLength(1)
  })

  it('accepts a bare blocks ARRAY (model shape) and persists a normalized doc node', async () => {
    const result = await execOf(createDraftStyrdokumentTool('ws_1', CTX))({
      title: 'Policy',
      docType: 'POLICY',
      contentJson: validDoc.content, // array, not a {type:'doc'} wrapper
    })
    const call = fn(prisma.pendingAgentAction.create).mock.calls[0][0]
    expect(call.data.action_type).toBe('DRAFT_DOCUMENT')
    expect(call.data.params.contentJson).toMatchObject({ type: 'doc' })
    expect(result.data).toEqual({ pendingActionId: 'pa_x' })
  })

  it('accepts a JSON-STRING contentJson (model occasionally stringifies it)', async () => {
    const result = await execOf(createDraftStyrdokumentTool('ws_1', CTX))({
      title: 'Policy',
      docType: 'POLICY',
      contentJson: JSON.stringify(validDoc),
    })
    expect(fn(prisma.pendingAgentAction.create)).toHaveBeenCalled()
    expect(result.data).toEqual({ pendingActionId: 'pa_x' })
  })

  it('strips a leading heading that duplicates the title (title is a separate field)', async () => {
    const docWithTitleHeading = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Miljöpolicy' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: '1. Syfte' }],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Stycke ett.' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Stycke två.' }] },
      ],
    }
    await execOf(createDraftStyrdokumentTool('ws_1', CTX))({
      title: 'Miljöpolicy',
      docType: 'POLICY',
      contentJson: docWithTitleHeading,
    })
    const persisted = fn(prisma.pendingAgentAction.create).mock.calls[0][0].data
      .params.contentJson
    expect(persisted.content).toHaveLength(3)
    expect(persisted.content[0].content[0].text).toBe('1. Syfte')
  })

  it('AC 3a: rejects a draft with fewer than 3 top-level blocks (no row created)', async () => {
    const shortDoc = {
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 1 },
          content: [{ type: 'text', text: 'Titel' }],
        },
        { type: 'paragraph', content: [{ type: 'text', text: 'Ett stycke.' }] },
      ],
    }
    const result = await execOf(createDraftStyrdokumentTool('ws_1', CTX))({
      title: 'För kort',
      docType: 'POLICY',
      contentJson: shortDoc,
    })
    expect(result.error).toBe(true)
    expect(result.guidance).toContain('minst en rubrik och tre stycken')
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })

  it('AC 3a: rejects a draft with no heading node (no row created)', async () => {
    const headinglessDoc = {
      type: 'doc',
      content: [
        { type: 'paragraph', content: [{ type: 'text', text: 'Stycke ett.' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Stycke två.' }] },
        { type: 'paragraph', content: [{ type: 'text', text: 'Stycke tre.' }] },
      ],
    }
    const result = await execOf(createDraftStyrdokumentTool('ws_1', CTX))({
      title: 'Utan rubrik',
      docType: 'POLICY',
      contentJson: headinglessDoc,
    })
    expect(result.error).toBe(true)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })
})
