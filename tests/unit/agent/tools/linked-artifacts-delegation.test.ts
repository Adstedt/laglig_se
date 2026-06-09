/**
 * Story 19.4 (SF-A) delegation test for the linked-artifacts action.
 *
 * Task 3 called for asserting that the public, session-scoped
 * `getLinkedArtifactsForListItem` still returns the same
 * `{ artifacts, tasksWithoutAttachmentCount }` shape by delegating to the
 * extracted `loadLinkedArtifacts(listItemId, workspaceId)` core. Here we mock
 * `withWorkspace` to invoke its callback with a fake `ctx.workspaceId` and mock
 * prisma so the delegation runs end-to-end with no HTTP request scope.
 */

import { it, expect, vi, beforeEach } from 'vitest'

const WS = 'ws-1'
const LIST_ITEM_ID = '11111111-1111-4111-8111-111111111111'

vi.mock('@/lib/prisma', () => ({
  prisma: { lawListItem: { findFirst: vi.fn() } },
}))

// withWorkspace short-circuits auth and replays the callback with a stub ctx
// (no cookies()/request scope) — mirrors the established action-test pattern.
vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: vi.fn((callback: (_ctx: { workspaceId: string }) => unknown) =>
    callback({ workspaceId: WS })
  ),
}))

import { prisma } from '@/lib/prisma'
import { getLinkedArtifactsForListItem } from '@/app/actions/linked-artifacts'

const mockFindFirst = (
  prisma as unknown as { lawListItem: { findFirst: ReturnType<typeof vi.fn> } }
).lawListItem.findFirst

/** Minimal item whose law_list.workspace_id matches the stub ctx workspace. */
function matchingItem() {
  return {
    id: LIST_ITEM_ID,
    law_list: { workspace_id: WS },
    file_links: [],
    workspace_document_links: [],
    requirements: [],
    task_links: [],
  }
}

beforeEach(() => vi.clearAllMocks())

it('getLinkedArtifactsForListItem delegates → documented result shape (SF-A)', async () => {
  mockFindFirst.mockResolvedValue(matchingItem())
  const result = await getLinkedArtifactsForListItem(LIST_ITEM_ID)

  expect(result.success).toBe(true)
  // The delegated core returns exactly { artifacts, tasksWithoutAttachmentCount }.
  expect(result.data).toEqual({
    artifacts: [],
    tasksWithoutAttachmentCount: 0,
  })
})

it('rejects a cross-workspace item (workspace isolation)', async () => {
  mockFindFirst.mockResolvedValue({
    ...matchingItem(),
    law_list: { workspace_id: 'ws-other' },
  })
  const result = await getLinkedArtifactsForListItem(LIST_ITEM_ID)
  expect(result.success).toBe(false)
  expect(result.data).toBeUndefined()
})
