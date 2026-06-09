/**
 * Story 17.11: unit tests for the update_document tool.
 *
 * Covers tool-time guards (AC 4 — workspace, DRAFT/IN_REVIEW status, missing
 * heading, no-op edit), AC 2 params shape (entity_version ISO string +
 * oldSectionContentJson snapshot), and the AC 5 pending-row creation envelope.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceDocument: { findFirst: vi.fn() },
    pendingAgentAction: { create: vi.fn() },
  },
}))

import { createUpdateDocumentTool } from '@/lib/agent/tools/update-document'
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

const UPDATED_AT = new Date('2026-06-01T10:00:00.000Z')

function makeDoc(
  overrides: Partial<{
    status: 'DRAFT' | 'IN_REVIEW' | 'APPROVED' | 'SUPERSEDED' | 'ARCHIVED'
    contentJson: unknown
  }> = {}
) {
  const status = overrides.status ?? ('DRAFT' as const)
  const contentJson =
    overrides.contentJson ??
    ({
      type: 'doc',
      content: [
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Syfte' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Old purpose body.' }],
        },
        {
          type: 'heading',
          attrs: { level: 2 },
          content: [{ type: 'text', text: 'Ansvar' }],
        },
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Responsibility.' }],
        },
      ],
    } as Record<string, unknown>)
  // Story 17.16: dual-pointer fields. DRAFT/IN_REVIEW → draft pointer set;
  // APPROVED → approved pointer set; SUPERSEDED/ARCHIVED → approved pointer
  // (the historical anchor — both states correctly trigger the writeable
  // predicate to refuse).
  const isDraft = status === 'DRAFT' || status === 'IN_REVIEW'
  return {
    id: 'd_1',
    title: 'Arbetsmiljöpolicy',
    status,
    updated_at: UPDATED_AT,
    // Story 17.11c AC 6: tool reads current_version_number to compute
    // newVersionNumber for the renderer header copy.
    current_version_number: 3,
    current_draft_version_id: isDraft ? 'v_draft' : null,
    current_approved_version_id: isDraft ? null : 'v_approved',
    current_draft_version: isDraft ? { content_json: contentJson } : null,
    current_approved_version: isDraft ? null : { content_json: contentJson },
  }
}

const NEW_BODY = [
  {
    type: 'paragraph',
    content: [{ type: 'text', text: 'New purpose body.' }],
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  fn(prisma.pendingAgentAction.create).mockResolvedValue({ id: 'pa_xyz' })
})

describe('update_document — happy path', () => {
  it('creates an UPDATE_DOCUMENT row with both snapshots and the ISO entity_version', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(makeDoc())

    const result = await execOf(createUpdateDocumentTool('ws_1', CTX))({
      document_id: 'd_1',
      section_heading: 'Syfte',
      updated_content: NEW_BODY,
      change_summary: 'Skärpt syftesformulering',
    })

    expect(fn(prisma.pendingAgentAction.create)).toHaveBeenCalledTimes(1)
    const call = fn(prisma.pendingAgentAction.create).mock.calls[0]![0]
    expect(call.data.action_type).toBe('UPDATE_DOCUMENT')
    expect(call.data.status).toBe('PENDING')
    expect(call.data.workspace_id).toBe('ws_1')

    // AC 2 + AC 6 (CP-001): params shape — both snapshots, ISO-string
    // entity_version, AND documentTitle for natural-Swedish renderer copy.
    const params = call.data.params
    expect(params.documentId).toBe('d_1')
    expect(params.documentTitle).toBe('Arbetsmiljöpolicy')
    expect(params.sectionHeading).toBe('Syfte')
    expect(params.changeSummary).toBe('Skärpt syftesformulering')
    expect(params.entity_version).toBe('2026-06-01T10:00:00.000Z')
    expect(params.oldSectionContentJson).toEqual([
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Old purpose body.' }],
      },
    ])
    expect(params.newSectionContentJson).toEqual(NEW_BODY)

    // AC 5: write-tool envelope + pendingActionId data field.
    expect(result.confirmation_required).toBe(true)
    expect(result.data).toEqual({ pendingActionId: 'pa_xyz' })
  })

  it('accepts updated_content as a doc-node and normalizes to body nodes', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(makeDoc())

    await execOf(createUpdateDocumentTool('ws_1', CTX))({
      document_id: 'd_1',
      section_heading: 'Syfte',
      updated_content: { type: 'doc', content: NEW_BODY },
      change_summary: 'X',
    })

    const params = fn(prisma.pendingAgentAction.create).mock.calls[0]![0].data
      .params
    expect(params.newSectionContentJson).toEqual(NEW_BODY)
  })

  it('accepts updated_content as a JSON-stringified array', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(makeDoc())

    await execOf(createUpdateDocumentTool('ws_1', CTX))({
      document_id: 'd_1',
      section_heading: 'Syfte',
      updated_content: JSON.stringify(NEW_BODY),
      change_summary: 'X',
    })

    const params = fn(prisma.pendingAgentAction.create).mock.calls[0]![0].data
      .params
    expect(params.newSectionContentJson).toEqual(NEW_BODY)
  })

  it('allows updating an IN_REVIEW document', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(
      makeDoc({ status: 'IN_REVIEW' })
    )

    const result = await execOf(createUpdateDocumentTool('ws_1', CTX))({
      document_id: 'd_1',
      section_heading: 'Syfte',
      updated_content: NEW_BODY,
      change_summary: 'X',
    })

    expect(result.error).toBeUndefined()
    expect(fn(prisma.pendingAgentAction.create)).toHaveBeenCalled()
  })
})

describe('update_document — AC 4 guards (no pending row on failure)', () => {
  it('rejects when the document is not found in the workspace', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(null)

    const result = await execOf(createUpdateDocumentTool('ws_1', CTX))({
      document_id: 'd_missing',
      section_heading: 'Syfte',
      updated_content: NEW_BODY,
      change_summary: 'X',
    })

    expect(result.error).toBe(true)
    expect(result.message).toMatch(/hittades inte/)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })

  // Story 17.11c: APPROVED-no-draft moved out of the refusal set into the
  // auto-branch path. Only SUPERSEDED + ARCHIVED stay non-writeable now.
  it.each(['SUPERSEDED', 'ARCHIVED'] as const)(
    'rejects status %s (still non-writeable post-17.11c)',
    async (status) => {
      fn(prisma.workspaceDocument.findFirst).mockResolvedValue(
        makeDoc({ status })
      )

      const result = await execOf(createUpdateDocumentTool('ws_1', CTX))({
        document_id: 'd_1',
        section_heading: 'Syfte',
        updated_content: NEW_BODY,
        change_summary: 'X',
      })

      expect(result.error).toBe(true)
      expect(result.message).toContain(status)
      // Refreshed refusal copy for the narrower non-writeable set.
      expect(result.guidance).toMatch(/Upphävda|arkiverade/i)
      expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
    }
  )

  it('rejects when the document has no current version', async () => {
    // Story 17.16: under the dual-pointer model the tool reads
    // current_draft_version / current_approved_version (NEVER the alias). Both
    // are nulled to simulate a doc with no current content to edit.
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      ...makeDoc(),
      current_draft_version: null,
      current_approved_version: null,
    })

    const result = await execOf(createUpdateDocumentTool('ws_1', CTX))({
      document_id: 'd_1',
      section_heading: 'Syfte',
      updated_content: NEW_BODY,
      change_summary: 'X',
    })

    expect(result.error).toBe(true)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })

  it('rejects when section_heading is not found (case-insensitive search)', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(makeDoc())

    const result = await execOf(createUpdateDocumentTool('ws_1', CTX))({
      document_id: 'd_1',
      section_heading: 'Saknad rubrik',
      updated_content: NEW_BODY,
      change_summary: 'X',
    })

    expect(result.error).toBe(true)
    expect(result.message).toMatch(/Saknad rubrik/)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })

  it('rejects unparseable updated_content shape', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(makeDoc())

    const result = await execOf(createUpdateDocumentTool('ws_1', CTX))({
      document_id: 'd_1',
      section_heading: 'Syfte',
      updated_content: 12345 as unknown,
      change_summary: 'X',
    })

    expect(result.error).toBe(true)
    expect(result.message).toMatch(/Tiptap/)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })

  it('rejects a no-op edit (deep-equal to current section body) — AC 4 NTH-2', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(makeDoc())

    const result = await execOf(createUpdateDocumentTool('ws_1', CTX))({
      document_id: 'd_1',
      section_heading: 'Syfte',
      // Same as the fixture's current section body.
      updated_content: [
        {
          type: 'paragraph',
          content: [{ type: 'text', text: 'Old purpose body.' }],
        },
      ],
      change_summary: 'X',
    })

    expect(result.error).toBe(true)
    expect(result.message).toMatch(/Inga ändringar/)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })

  it('treats key-order shuffles as no-ops (canonical compare)', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(makeDoc())

    // Same data, keys in a different order — canonicalJson should detect this.
    const result = await execOf(createUpdateDocumentTool('ws_1', CTX))({
      document_id: 'd_1',
      section_heading: 'Syfte',
      updated_content: [
        {
          content: [{ text: 'Old purpose body.', type: 'text' }],
          type: 'paragraph',
        },
      ],
      change_summary: 'X',
    })

    expect(result.error).toBe(true)
    expect(result.message).toMatch(/Inga ändringar/)
  })
})

// ============================================================================
// Story 17.11c — APPROVED-no-draft auto-branch acceptance (AC 3, 6)
// ============================================================================

describe('update_document — Story 17.11c auto-branch on APPROVED', () => {
  it('APPROVED-no-draft: accepts the proposal with creates_draft=true + newVersionNumber=N+1', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(
      makeDoc({ status: 'APPROVED' })
    )

    const result = await execOf(createUpdateDocumentTool('ws_1', CTX))({
      document_id: 'd_1',
      section_heading: 'Syfte',
      updated_content: NEW_BODY,
      change_summary: 'Skärpt syftesformulering på godkänd policy',
    })

    expect(result.error).toBeUndefined()
    expect(fn(prisma.pendingAgentAction.create)).toHaveBeenCalledTimes(1)

    const call = fn(prisma.pendingAgentAction.create).mock.calls[0]![0]
    expect(call.data.action_type).toBe('UPDATE_DOCUMENT')
    const params = call.data.params
    expect(params.creates_draft).toBe(true)
    // makeDoc fixture: current_version_number = 3 → newVersionNumber = 4.
    expect(params.newVersionNumber).toBe(4)
    // Approved content was the source, so the captured old snapshot is the
    // approved version's body (proves dispatch will apply the edit against
    // approved content).
    expect(params.oldSectionContentJson).toEqual([
      {
        type: 'paragraph',
        content: [{ type: 'text', text: 'Old purpose body.' }],
      },
    ])
  })

  it('DRAFT with no approved: creates_draft=false (existing Row 1 path unchanged)', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(
      makeDoc({ status: 'DRAFT' })
    )

    const result = await execOf(createUpdateDocumentTool('ws_1', CTX))({
      document_id: 'd_1',
      section_heading: 'Syfte',
      updated_content: NEW_BODY,
      change_summary: 'X',
    })

    expect(result.error).toBeUndefined()
    const params = fn(prisma.pendingAgentAction.create).mock.calls[0]![0].data
      .params
    expect(params.creates_draft).toBe(false)
    expect(params.newVersionNumber).toBe(4)
  })
})
