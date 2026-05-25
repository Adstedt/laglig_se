/**
 * Unit tests for get_law_list_item (Story 19.4).
 * Asserts: default-from-context + workspace scoping, caps at the Prisma `take`
 * level (SF-1), names-not-IDs, and the handle/field mapping.
 */

import { it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { lawListItem: { findFirst: vi.fn() } },
}))

import { prisma } from '@/lib/prisma'
import { createGetLawListItemTool } from '@/lib/agent/tools/get-law-list-item'

const mockFindFirst = (
  prisma as unknown as { lawListItem: { findFirst: ReturnType<typeof vi.fn> } }
).lawListItem.findFirst

const WS = 'ws-1'
type Exec = (
  _i: { lawListItemId?: string },
  _o: unknown
) => Promise<Record<string, unknown>>
const opts = {
  toolCallId: 'tc',
  messages: [],
  abortSignal: undefined as unknown as AbortSignal,
}

function item(over: Record<string, unknown> = {}) {
  return {
    id: 'item-1',
    compliance_status: 'PAGAENDE',
    priority: 'MEDIUM',
    due_date: null,
    category: null,
    business_context: 'Vi hanterar kemikalier.',
    compliance_narrative: null,
    responsible_user: { name: 'Anna', email: 'anna@x.se' },
    document: {
      id: 'doc-1',
      title: 'Arbetsmiljölag',
      document_number: 'SFS 1977:1160',
    },
    requirements: [
      {
        id: 'r1',
        text: 'Dokumentera riskbedömning',
        is_fulfilled: false,
        bevis_required: true,
        _count: { evidence_links: 2 },
      },
    ],
    change_assessments: [
      {
        id: 'a1',
        impact_level: 'HIGH',
        ai_analysis: 'AI-analys',
        user_notes: 'Bedömd icke-påverkande',
        assessed_at: new Date('2026-03-01'),
        change_event: { amendment_sfs: 'SFS 2025:1' },
      },
    ],
    compliance_status_logs: [
      {
        previous_status: 'EJ_PABORJAD',
        new_status: 'PAGAENDE',
        reason: 'Startade arbetet',
        changed_at: new Date('2026-02-01'),
        changed_by_user: { name: 'Bob', email: 'bob@x.se' },
      },
    ],
    task_links: [{ task: { id: 't1', title: 'Översyn' } }],
    _count: { file_links: 1, workspace_document_links: 0 },
    ...over,
  }
}

const tool = createGetLawListItemTool(WS, {
  userId: 'u',
  lawListItemId: 'item-1',
})
const execute = tool.execute as Exec

beforeEach(() => vi.clearAllMocks())

it('defaults to context.lawListItemId + workspace-scoped where', async () => {
  mockFindFirst.mockResolvedValue(item())
  const result = await execute({}, opts)

  expect(mockFindFirst).toHaveBeenCalledWith(
    expect.objectContaining({
      where: { id: 'item-1', law_list: { workspace_id: WS } },
    })
  )
  expect((result.data as { complianceStatus: string }).complianceStatus).toBe(
    'PAGAENDE'
  )
})

it('caps collections at the Prisma `take` level (SF-1)', async () => {
  mockFindFirst.mockResolvedValue(item())
  await execute({ lawListItemId: 'item-1' }, opts)
  const include = mockFindFirst.mock.calls[0][0].include
  expect(include.requirements.take).toBe(15)
  expect(include.change_assessments.take).toBe(5)
  expect(include.compliance_status_logs.take).toBe(5)
  expect(include.task_links.take).toBe(20)
})

it('exposes participant NAMES, not raw user ids', async () => {
  mockFindFirst.mockResolvedValue(item())
  const result = await execute({ lawListItemId: 'item-1' }, opts)
  const data = result.data as Record<string, unknown>
  expect(data.responsibleName).toBe('Anna')
  expect((data.statusLogSummary as Array<{ byName: string }>)[0].byName).toBe(
    'Bob'
  )
  // never leak the raw relation objects / ids
  expect(data).not.toHaveProperty('responsible_user')
  expect(data).not.toHaveProperty('responsible_user_id')
})

it('maps bevisCount, amendmentSfs, and neighbour handles', async () => {
  mockFindFirst.mockResolvedValue(item())
  const result = await execute({ lawListItemId: 'item-1' }, opts)
  const data = result.data as Record<string, unknown>
  expect(
    (data.requirements as Array<{ bevisCount: number }>)[0].bevisCount
  ).toBe(2)
  expect(
    (data.changeAssessments as Array<{ amendmentSfs: string }>)[0].amendmentSfs
  ).toBe('SFS 2025:1')
  expect((data.linkedTasks as Array<unknown>)[0]).toMatchObject({
    id: 't1',
    type: 'task',
    label: 'Översyn',
  })
  expect(data.document).toMatchObject({ id: 'doc-1', type: 'document' })
  expect(data.linkedArtifacts).toEqual({
    directFileCount: 1,
    directDocumentCount: 0,
  })
})

it('missing id (no arg, no context) → wrapToolError', async () => {
  const noCtxTool = createGetLawListItemTool(WS, { userId: 'u' })
  const result = await (noCtxTool.execute as Exec)({}, opts)
  expect(result.error).toBe(true)
  expect(mockFindFirst).not.toHaveBeenCalled()
})

it('not found → wrapToolError', async () => {
  mockFindFirst.mockResolvedValue(null)
  const result = await execute({ lawListItemId: 'x' }, opts)
  expect(result.error).toBe(true)
})
