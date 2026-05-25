/**
 * Unit tests for list_linked_artifacts (Story 19.4).
 * Asserts: it calls the workspaceId-parameterized `loadLinkedArtifacts` core
 * (SF-A) with the CLOSURE workspaceId (no session dependency), maps to the
 * bounded view, and surfaces a file's id as the read_file fileId.
 */

import { it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/app/actions/linked-artifacts', () => ({
  loadLinkedArtifacts: vi.fn(),
}))

import { loadLinkedArtifacts } from '@/app/actions/linked-artifacts'
import { createListLinkedArtifactsTool } from '@/lib/agent/tools/list-linked-artifacts'

const mockLoad = loadLinkedArtifacts as ReturnType<typeof vi.fn>

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

beforeEach(() => vi.clearAllMocks())

it('calls loadLinkedArtifacts with the closure workspaceId (SF-A, no session)', async () => {
  mockLoad.mockResolvedValue({
    success: true,
    data: { artifacts: [], tasksWithoutAttachmentCount: 0 },
  })
  const tool = createListLinkedArtifactsTool(WS, {
    userId: 'u',
    lawListItemId: 'item-1',
  })
  await (tool.execute as Exec)({}, opts)
  // closure workspaceId passed explicitly — not derived from session
  expect(mockLoad).toHaveBeenCalledWith('item-1', WS)
})

it('maps artifacts; a file exposes its id as the read_file fileId', async () => {
  mockLoad.mockResolvedValue({
    success: true,
    data: {
      artifacts: [
        {
          kind: 'file',
          id: 'file-9',
          filename: 'bevis.pdf',
          directLink: true,
          requirements: [{ id: 'r1', text: 'Krav' }],
          tasks: [],
        },
        {
          kind: 'document',
          id: 'doc-3',
          title: 'Policy',
          directLink: false,
          requirements: [],
          tasks: [{ id: 't1', title: 'Task' }],
        },
      ],
      tasksWithoutAttachmentCount: 1,
    },
  })
  const tool = createListLinkedArtifactsTool(WS)
  const result = await (tool.execute as Exec)({ lawListItemId: 'item-1' }, opts)
  const data = result.data as {
    artifacts: Array<Record<string, unknown>>
    tasksWithoutAttachmentCount: number
  }
  expect(data.artifacts[0]).toMatchObject({
    kind: 'file',
    id: 'file-9', // == fileId for read_file
    name: 'bevis.pdf',
    directLink: true,
  })
  expect(data.artifacts[1]).toMatchObject({ kind: 'document', name: 'Policy' })
  expect(data.tasksWithoutAttachmentCount).toBe(1)
})

it('missing id + no context → wrapToolError, core not called', async () => {
  const tool = createListLinkedArtifactsTool(WS)
  const result = await (tool.execute as Exec)({}, opts)
  expect(result.error).toBe(true)
  expect(mockLoad).not.toHaveBeenCalled()
})

it('core failure (e.g. cross-workspace) → wrapToolError', async () => {
  mockLoad.mockResolvedValue({
    success: false,
    error: 'Laglistpost hittades inte',
  })
  const tool = createListLinkedArtifactsTool(WS)
  const result = await (tool.execute as Exec)(
    { lawListItemId: 'foreign' },
    opts
  )
  expect(result.error).toBe(true)
})
