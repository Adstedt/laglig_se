/**
 * Story 17.11b: unit tests for the add_document_section tool.
 *
 * Covers tool-time guards (AC 4 — workspace, DRAFT/IN_REVIEW status, missing
 * current version, duplicate heading, missing position-target, empty body,
 * malformed content), AC 2 params shape (entity_version ISO string + position
 * + documentTitle), and the AC 5 pending-row creation envelope.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: {
    workspaceDocument: { findFirst: vi.fn() },
    pendingAgentAction: { create: vi.fn() },
  },
}))

import { createAddDocumentSectionTool } from '@/lib/agent/tools/add-document-section'
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
    title: string
  }> = {}
) {
  return {
    id: 'd_1',
    title: overrides.title ?? 'Arbetsmiljöpolicy',
    status: overrides.status ?? ('DRAFT' as const),
    updated_at: UPDATED_AT,
    current_version: {
      content_json:
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
              content: [{ type: 'text', text: 'Purpose body.' }],
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
        } as Record<string, unknown>),
    },
  }
}

const NEW_BODY = [
  {
    type: 'paragraph',
    content: [{ type: 'text', text: 'Ny avsnittstext.' }],
  },
]

beforeEach(() => {
  vi.clearAllMocks()
  fn(prisma.pendingAgentAction.create).mockResolvedValue({ id: 'pa_xyz' })
})

describe('add_document_section — happy path', () => {
  it('creates an ADD_DOCUMENT_SECTION row with documentTitle + ISO entity_version + position', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(makeDoc())

    const result = await execOf(createAddDocumentSectionTool('ws_1', CTX))({
      document_id: 'd_1',
      new_section_heading: 'Inledning',
      new_section_level: 2,
      new_section_content: NEW_BODY,
      change_summary: 'Lägg till inledning',
      position: { at: 'start' },
    })

    expect(fn(prisma.pendingAgentAction.create)).toHaveBeenCalledTimes(1)
    const call = fn(prisma.pendingAgentAction.create).mock.calls[0]![0]
    expect(call.data.action_type).toBe('ADD_DOCUMENT_SECTION')
    expect(call.data.status).toBe('PENDING')
    expect(call.data.workspace_id).toBe('ws_1')

    const params = call.data.params
    expect(params.documentId).toBe('d_1')
    expect(params.documentTitle).toBe('Arbetsmiljöpolicy')
    expect(params.newSectionHeading).toBe('Inledning')
    expect(params.newSectionLevel).toBe(2)
    expect(params.newSectionContentJson).toEqual(NEW_BODY)
    expect(params.position).toEqual({ at: 'start' })
    expect(params.changeSummary).toBe('Lägg till inledning')
    expect(params.entity_version).toBe('2026-06-01T10:00:00.000Z')

    expect(result.confirmation_required).toBe(true)
    expect(result.data).toEqual({ pendingActionId: 'pa_xyz' })
  })

  it('accepts position { at: "after", heading } when the target heading exists', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(makeDoc())

    const result = await execOf(createAddDocumentSectionTool('ws_1', CTX))({
      document_id: 'd_1',
      new_section_heading: 'Mellan',
      new_section_level: 2,
      new_section_content: NEW_BODY,
      change_summary: 'X',
      position: { at: 'after', heading: 'Syfte' },
    })

    expect(result.error).toBeUndefined()
    const params = fn(prisma.pendingAgentAction.create).mock.calls[0]![0].data
      .params
    expect(params.position).toEqual({ at: 'after', heading: 'Syfte' })
  })

  it('matches position.heading case-insensitively at tool time', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(makeDoc())

    const result = await execOf(createAddDocumentSectionTool('ws_1', CTX))({
      document_id: 'd_1',
      new_section_heading: 'Mellan',
      new_section_level: 2,
      new_section_content: NEW_BODY,
      change_summary: 'X',
      position: { at: 'after', heading: 'SYFTE' },
    })

    expect(result.error).toBeUndefined()
  })

  it('accepts new_section_content as a doc-node and normalizes to body nodes', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(makeDoc())

    await execOf(createAddDocumentSectionTool('ws_1', CTX))({
      document_id: 'd_1',
      new_section_heading: 'Inledning',
      new_section_level: 2,
      new_section_content: { type: 'doc', content: NEW_BODY },
      change_summary: 'X',
      position: { at: 'end' },
    })

    const params = fn(prisma.pendingAgentAction.create).mock.calls[0]![0].data
      .params
    expect(params.newSectionContentJson).toEqual(NEW_BODY)
  })

  it('accepts new_section_content as a JSON-stringified array', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(makeDoc())

    await execOf(createAddDocumentSectionTool('ws_1', CTX))({
      document_id: 'd_1',
      new_section_heading: 'Inledning',
      new_section_level: 2,
      new_section_content: JSON.stringify(NEW_BODY),
      change_summary: 'X',
      position: { at: 'end' },
    })

    const params = fn(prisma.pendingAgentAction.create).mock.calls[0]![0].data
      .params
    expect(params.newSectionContentJson).toEqual(NEW_BODY)
  })

  it('allows adding to an IN_REVIEW document', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(
      makeDoc({ status: 'IN_REVIEW' })
    )

    const result = await execOf(createAddDocumentSectionTool('ws_1', CTX))({
      document_id: 'd_1',
      new_section_heading: 'Inledning',
      new_section_level: 2,
      new_section_content: NEW_BODY,
      change_summary: 'X',
      position: { at: 'end' },
    })

    expect(result.error).toBeUndefined()
    expect(fn(prisma.pendingAgentAction.create)).toHaveBeenCalled()
  })
})

describe('add_document_section — AC 4 guards (no pending row on failure)', () => {
  it('rejects when the document is not found in the workspace', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(null)

    const result = await execOf(createAddDocumentSectionTool('ws_1', CTX))({
      document_id: 'd_missing',
      new_section_heading: 'Inledning',
      new_section_level: 2,
      new_section_content: NEW_BODY,
      change_summary: 'X',
      position: { at: 'end' },
    })

    expect(result.error).toBe(true)
    expect(result.message).toMatch(/hittades inte/)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })

  it.each(['APPROVED', 'SUPERSEDED', 'ARCHIVED'] as const)(
    'rejects status %s and guides toward createDraftFromApproved',
    async (status) => {
      fn(prisma.workspaceDocument.findFirst).mockResolvedValue(
        makeDoc({ status })
      )

      const result = await execOf(createAddDocumentSectionTool('ws_1', CTX))({
        document_id: 'd_1',
        new_section_heading: 'Inledning',
        new_section_level: 2,
        new_section_content: NEW_BODY,
        change_summary: 'X',
        position: { at: 'end' },
      })

      expect(result.error).toBe(true)
      expect(result.message).toContain(status)
      expect(result.guidance).toMatch(/förgrena|redigerbar/)
      expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
    }
  )

  it('rejects when the document has no current version', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue({
      ...makeDoc(),
      current_version: null,
    })

    const result = await execOf(createAddDocumentSectionTool('ws_1', CTX))({
      document_id: 'd_1',
      new_section_heading: 'Inledning',
      new_section_level: 2,
      new_section_content: NEW_BODY,
      change_summary: 'X',
      position: { at: 'end' },
    })

    expect(result.error).toBe(true)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })

  it('rejects when the new heading already exists (case-insensitive)', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(makeDoc())

    const result = await execOf(createAddDocumentSectionTool('ws_1', CTX))({
      document_id: 'd_1',
      new_section_heading: 'SYFTE',
      new_section_level: 2,
      new_section_content: NEW_BODY,
      change_summary: 'X',
      position: { at: 'end' },
    })

    expect(result.error).toBe(true)
    expect(result.message).toMatch(/finns redan/)
    expect(result.guidance).toMatch(/update_document/)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })

  it('rejects when position.heading missing (at: "after")', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(makeDoc())

    const result = await execOf(createAddDocumentSectionTool('ws_1', CTX))({
      document_id: 'd_1',
      new_section_heading: 'Mellan',
      new_section_level: 2,
      new_section_content: NEW_BODY,
      change_summary: 'X',
      position: { at: 'after', heading: 'Saknad' },
    })

    expect(result.error).toBe(true)
    expect(result.message).toMatch(/Saknad/)
    expect(result.message).toMatch(/finns inte/)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })

  it('rejects when position.heading missing (at: "before")', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(makeDoc())

    const result = await execOf(createAddDocumentSectionTool('ws_1', CTX))({
      document_id: 'd_1',
      new_section_heading: 'Mellan',
      new_section_level: 2,
      new_section_content: NEW_BODY,
      change_summary: 'X',
      position: { at: 'before', heading: 'Saknad' },
    })

    expect(result.error).toBe(true)
    expect(result.message).toMatch(/Saknad/)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })

  it('rejects unparseable new_section_content shape', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(makeDoc())

    const result = await execOf(createAddDocumentSectionTool('ws_1', CTX))({
      document_id: 'd_1',
      new_section_heading: 'Inledning',
      new_section_level: 2,
      new_section_content: 12345 as unknown,
      change_summary: 'X',
      position: { at: 'end' },
    })

    expect(result.error).toBe(true)
    expect(result.message).toMatch(/Tiptap/)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })

  it('rejects an empty new_section_content array', async () => {
    fn(prisma.workspaceDocument.findFirst).mockResolvedValue(makeDoc())

    const result = await execOf(createAddDocumentSectionTool('ws_1', CTX))({
      document_id: 'd_1',
      new_section_heading: 'Inledning',
      new_section_level: 2,
      new_section_content: [],
      change_summary: 'X',
      position: { at: 'end' },
    })

    expect(result.error).toBe(true)
    expect(result.message).toMatch(/tomt/)
    expect(fn(prisma.pendingAgentAction.create)).not.toHaveBeenCalled()
  })
})
