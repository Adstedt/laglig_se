/**
 * Unit tests for list_unassessed_changes (Story 19.3).
 * Asserts: SF-A delegation to loadUnacknowledgedChanges with the CLOSURE
 * workspaceId, true count = full length (capped display), field mapping +
 * priority label, and core-failure → wrapToolError.
 */

import { it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/app/actions/change-events', () => ({
  loadUnacknowledgedChanges: vi.fn(),
}))

import { loadUnacknowledgedChanges } from '@/app/actions/change-events'
import { createListUnassessedChangesTool } from '@/lib/agent/tools/list-unassessed-changes'

const mockLoad = loadUnacknowledgedChanges as ReturnType<typeof vi.fn>

const WS = 'ws-1'
type Exec = (
  _i: { limit?: number },
  _o: unknown
) => Promise<Record<string, unknown>>
const opts = {
  toolCallId: 'tc',
  messages: [],
  abortSignal: undefined as unknown as AbortSignal,
}

function change(over: Record<string, unknown> = {}) {
  return {
    id: 'ce1',
    documentId: 'doc1',
    documentTitle: 'Arbetsmiljölag',
    documentNumber: 'SFS 1977:1160',
    contentType: 'LAW',
    changeType: 'AMENDMENT',
    amendmentSfs: 'SFS 2025:1',
    aiSummary: 'Ändring av 3 §',
    detectedAt: new Date('2026-03-01'),
    priority: 'MEDIUM',
    listId: 'l1',
    listName: 'Min lista',
    lawListItemId: 'item-1',
    ...over,
  }
}

const execute = createListUnassessedChangesTool(WS).execute as Exec

beforeEach(() => vi.clearAllMocks())

it('calls loadUnacknowledgedChanges with the closure workspaceId (SF-A)', async () => {
  mockLoad.mockResolvedValue({ success: true, data: [] })
  await execute({}, opts)
  expect(mockLoad).toHaveBeenCalledWith(WS)
})

it('count = full length; display capped; maps fields + priority label', async () => {
  mockLoad.mockResolvedValue({
    success: true,
    data: [change(), change({ id: 'ce2' })],
  })
  const result = await execute({ limit: 1 }, opts)
  const data = result.data as {
    count: number
    changes: Array<Record<string, unknown>>
  }
  expect(data.count).toBe(2) // true total
  expect(data.changes).toHaveLength(1) // capped to limit
  expect(data.changes[0]).toMatchObject({
    changeEventId: 'ce1',
    lawListItemId: 'item-1',
    lawName: 'Arbetsmiljölag',
    sfsNumber: 'SFS 1977:1160',
    changeType: 'Ändring', // AMENDMENT → Swedish label (AC 3, no raw enum)
    amendmentSfs: 'SFS 2025:1',
    priority: 'Medel', // MEDIUM → Swedish label
  })
})

it('core failure → wrapToolError', async () => {
  mockLoad.mockResolvedValue({
    success: false,
    error: 'Kunde inte hämta ändringar',
  })
  const result = await execute({}, opts)
  expect(result.error).toBe(true)
  expect(mockLoad).toHaveBeenCalledWith(WS)
})
