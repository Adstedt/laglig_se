/**
 * Unit tests for search_law_list_items (Story 19.4a).
 * Mocks Prisma; asserts workspace scoping (isolation), the result shape incl.
 * listName (SF-1), the empty → wrapToolError path, and the Swedish definite-form
 * match fix ("arbetsmiljölagen" matches stored "Arbetsmiljölag…").
 */

import { it, expect, vi, beforeEach } from 'vitest'

vi.mock('@/lib/prisma', () => ({
  prisma: { lawListItem: { findMany: vi.fn() } },
}))

import { prisma } from '@/lib/prisma'
import { createSearchLawListItemsTool } from '@/lib/agent/tools/search-law-list-items'

const mockFindMany = (
  prisma as unknown as { lawListItem: { findMany: ReturnType<typeof vi.fn> } }
).lawListItem.findMany

const WS = 'ws-1'
const tool = createSearchLawListItemsTool(WS)
const execute = tool.execute as (
  _i: { query: string; limit?: number },
  _o: unknown
) => Promise<Record<string, unknown>>
const opts = {
  toolCallId: 'tc',
  messages: [],
  abortSignal: undefined as unknown as AbortSignal,
}

/** Collect every `{ contains: <string> }` value anywhere in the where tree. */
function containsValues(where: unknown): string[] {
  const out: string[] = []
  JSON.stringify(where, (_k, v) => {
    if (
      v &&
      typeof v === 'object' &&
      typeof (v as { contains?: unknown }).contains === 'string'
    ) {
      out.push((v as { contains: string }).contains)
    }
    return v
  })
  return out
}

function whereArg(): Record<string, unknown> {
  return mockFindMany.mock.calls[0][0].where as Record<string, unknown>
}

beforeEach(() => vi.clearAllMocks())

it('workspace-scoped; result shape includes listName (SF-1)', async () => {
  mockFindMany.mockResolvedValue([
    {
      id: 'item-1',
      compliance_status: 'PAGAENDE',
      document: {
        title: 'Arbetsmiljölag (1977:1160)',
        document_number: 'SFS 1977:1160',
      },
      law_list: { name: 'Huvudlista' },
    },
  ])

  const result = await execute({ query: 'arbetsmiljö', limit: 5 }, opts)

  expect(whereArg().law_list).toEqual({ workspace_id: WS })
  const data = result.data as Array<Record<string, unknown>>
  expect(data[0]).toMatchObject({
    lawListItemId: 'item-1',
    title: 'Arbetsmiljölag (1977:1160)',
    sfsNumber: 'SFS 1977:1160',
    complianceStatus: 'Delvis uppfylld', // canonical label, not raw PAGAENDE
    listName: 'Huvudlista',
  })
})

it('definite form "arbetsmiljölagen" also matches the stripped stem', async () => {
  mockFindMany.mockResolvedValue([])
  await execute({ query: 'arbetsmiljölagen', limit: 5 }, opts)

  const vals = containsValues(whereArg())
  // both the raw definite form and the -en-stripped stem are candidates; the
  // stem is what substring-matches the stored title "Arbetsmiljölag (…)".
  expect(vals).toContain('arbetsmiljölagen')
  expect(vals).toContain('arbetsmiljölag')
})

it('SFS-number query is matched as-is (not over-stemmed)', async () => {
  mockFindMany.mockResolvedValue([])
  await execute({ query: '1977:1160', limit: 5 }, opts)

  const vals = containsValues(whereArg())
  expect(vals).toContain('1977:1160')
})

it('no matches → wrapToolError', async () => {
  mockFindMany.mockResolvedValue([])
  const result = await execute({ query: 'zzzonexistent', limit: 5 }, opts)
  expect(result.error).toBe(true)
})
