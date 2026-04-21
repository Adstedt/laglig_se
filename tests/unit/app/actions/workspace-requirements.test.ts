/**
 * Story 20.2: workspace-scoped krav aggregation unit tests.
 * Mocks Prisma + workspace-context, mirrors the pattern in
 * `tests/unit/app/actions/workspace-activity.test.ts`.
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'

// ---------------------------------------------------------------------------
// Mocks (must be declared before imports that consume them)
// ---------------------------------------------------------------------------

const mockRequirementFindMany = vi.fn()
const mockRequirementCount = vi.fn()

vi.mock('@/lib/prisma', () => ({
  prisma: {
    lawListItemRequirement: {
      findMany: (...args: unknown[]) => mockRequirementFindMany(...args),
      count: (...args: unknown[]) => mockRequirementCount(...args),
    },
  },
}))

const MOCK_WORKSPACE_ID = '11111111-1111-4111-8111-111111111111'
const MOCK_USER_ID = '22222222-2222-4222-8222-222222222222'
const OTHER_USER_ID = '33333333-3333-4333-8333-333333333333'

vi.mock('@/lib/auth/workspace-context', () => ({
  withWorkspace: vi.fn(
    async (
      fn: (_ctx: { workspaceId: string; userId: string }) => Promise<unknown>,
      _mode?: string
    ) => fn({ workspaceId: MOCK_WORKSPACE_ID, userId: MOCK_USER_ID })
  ),
}))

// ---------------------------------------------------------------------------
// Imports under test (after mocks)
// ---------------------------------------------------------------------------

import {
  buildRequirementWhere,
  getWorkspaceRequirements,
  getWorkspaceRequirementCounts,
} from '@/app/actions/workspace-requirements'
import { resolveEffectiveAssignee } from '@/lib/requirements/helpers'
import * as workspaceContext from '@/lib/auth/workspace-context'

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

function makeRow(overrides: Record<string, unknown> = {}) {
  const id = (overrides.id as string | undefined) ?? 'req-1'
  return {
    id,
    text: `Text for ${id}`,
    comment: null,
    is_fulfilled: false,
    bevis_required: false,
    position: 1000,
    created_at: new Date('2026-04-01T10:00:00Z'),
    updated_at: new Date('2026-04-20T10:00:00Z'),
    created_by: MOCK_USER_ID,
    responsible_user_id: null,
    list_item: {
      id: 'list-item-1',
      responsible_user_id: null,
      document: { id: 'doc-1', title: 'SFS 2020:123' },
      law_list: { id: 'list-1', name: 'Huvudlista' },
    },
    _count: { evidence_links: 0 },
    ...overrides,
  }
}

// ---------------------------------------------------------------------------
// buildRequirementWhere (shared helper)
// ---------------------------------------------------------------------------

describe('buildRequirementWhere', () => {
  const ctx = { workspaceId: MOCK_WORKSPACE_ID, userId: MOCK_USER_ID }

  it('all filter: workspace scope only', () => {
    const where = buildRequirementWhere(ctx, 'all')
    expect(where).toEqual({
      list_item: { law_list: { workspace_id: MOCK_WORKSPACE_ID } },
    })
  })

  it('gaps filter: adds is_fulfilled = false', () => {
    const where = buildRequirementWhere(ctx, 'gaps')
    expect(where).toMatchObject({ is_fulfilled: false })
  })

  it('mine filter: OR clause matches resolveEffectiveAssignee semantics', () => {
    const where = buildRequirementWhere(ctx, 'mine')
    expect(where.OR).toEqual([
      { responsible_user_id: MOCK_USER_ID },
      {
        responsible_user_id: null,
        list_item: {
          law_list: { workspace_id: MOCK_WORKSPACE_ID },
          responsible_user_id: MOCK_USER_ID,
        },
      },
    ])
  })

  it('needs_evidence filter: bevis_required + no evidence_links', () => {
    const where = buildRequirementWhere(ctx, 'needs_evidence')
    expect(where).toMatchObject({
      bevis_required: true,
      evidence_links: { none: {} },
    })
  })

  it('search: trimmed case-insensitive contains is AND-combined', () => {
    const where = buildRequirementWhere(ctx, 'gaps', '  arbetsmiljö  ')
    expect(where).toMatchObject({
      text: { contains: 'arbetsmiljö', mode: 'insensitive' },
      is_fulfilled: false,
    })
  })

  it('search: empty/whitespace is NOT applied', () => {
    const where = buildRequirementWhere(ctx, 'all', '   ')
    expect(where).not.toHaveProperty('text')
  })

  // ---- TEST-003 (QA gate 20.2): filter + search AND-composition ----
  it('composition: search + mine → text AND the OR clause both present at top level', () => {
    const where = buildRequirementWhere(ctx, 'mine', 'arbetsmiljö')
    // Prisma treats top-level properties as AND — so text contains AND (direct OR inherited).
    expect(where).toMatchObject({
      list_item: { law_list: { workspace_id: MOCK_WORKSPACE_ID } },
      text: { contains: 'arbetsmiljö', mode: 'insensitive' },
    })
    expect(where.OR).toEqual([
      { responsible_user_id: MOCK_USER_ID },
      {
        responsible_user_id: null,
        list_item: {
          law_list: { workspace_id: MOCK_WORKSPACE_ID },
          responsible_user_id: MOCK_USER_ID,
        },
      },
    ])
  })

  it('composition: search + needs_evidence → text AND bevis_required AND evidence_links:none', () => {
    const where = buildRequirementWhere(ctx, 'needs_evidence', 'bevis')
    expect(where).toMatchObject({
      text: { contains: 'bevis', mode: 'insensitive' },
      bevis_required: true,
      evidence_links: { none: {} },
    })
  })
})

// ---------------------------------------------------------------------------
// Parity guard: SQL mine filter vs resolveEffectiveAssignee (Epic 20 primary risk)
// ---------------------------------------------------------------------------

describe('mine filter parity with resolveEffectiveAssignee', () => {
  // The 3x3 truth table: for each combination of (krav override, parent assignee),
  // the SQL `OR` clause's membership must match the resolver's `{ userId === me }`.
  const cases: Array<{
    kravResponsible: string | null
    parentResponsible: string | null
    expected: boolean
    label: string
  }> = [
    {
      kravResponsible: MOCK_USER_ID,
      parentResponsible: null,
      expected: true,
      label: 'direct override to me',
    },
    {
      kravResponsible: MOCK_USER_ID,
      parentResponsible: OTHER_USER_ID,
      expected: true,
      label: 'direct override to me (parent is other)',
    },
    {
      kravResponsible: MOCK_USER_ID,
      parentResponsible: MOCK_USER_ID,
      expected: true,
      label: 'direct override to me AND parent also me (both paths agree)',
    },
    {
      kravResponsible: null,
      parentResponsible: MOCK_USER_ID,
      expected: true,
      label: 'inherited from parent = me',
    },
    {
      kravResponsible: null,
      parentResponsible: null,
      expected: false,
      label: 'both null → not mine',
    },
    {
      kravResponsible: null,
      parentResponsible: OTHER_USER_ID,
      expected: false,
      label: 'inherited from other',
    },
    {
      kravResponsible: OTHER_USER_ID,
      parentResponsible: MOCK_USER_ID,
      expected: false,
      label: 'direct override to other (overrides my parent assignment)',
    },
    {
      kravResponsible: OTHER_USER_ID,
      parentResponsible: null,
      expected: false,
      label: 'direct override to other',
    },
    {
      kravResponsible: OTHER_USER_ID,
      parentResponsible: OTHER_USER_ID,
      expected: false,
      label: 'both other',
    },
  ]

  it.each(cases)(
    'case: $label → resolver and SQL OR agree',
    ({ kravResponsible, parentResponsible, expected }) => {
      // Resolver-side (JS truth).
      const effective = resolveEffectiveAssignee(
        { responsibleUserId: kravResponsible },
        { responsibleUserId: parentResponsible }
      )
      const isMineByResolver = effective.userId === MOCK_USER_ID
      expect(isMineByResolver).toBe(expected)

      // SQL-side: simulate the `OR` predicate against this row.
      // Clause A: responsible_user_id === me (direct override path).
      const matchesA = kravResponsible === MOCK_USER_ID
      // Clause B: responsible_user_id === null AND parent === me (inherited path).
      const matchesB =
        kravResponsible === null && parentResponsible === MOCK_USER_ID
      const isMineBySql = matchesA || matchesB
      expect(isMineBySql).toBe(expected)

      // Both paths MUST agree on every row — the core parity invariant.
      expect(isMineBySql).toBe(isMineByResolver)
    }
  )
})

// ---------------------------------------------------------------------------
// getWorkspaceRequirements
// ---------------------------------------------------------------------------

describe('getWorkspaceRequirements', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workspaceContext.withWorkspace).mockImplementation(async (fn) =>
      fn({ workspaceId: MOCK_WORKSPACE_ID, userId: MOCK_USER_ID })
    )
  })

  it('maps Prisma rows to the flat WorkspaceRequirementRow shape', async () => {
    mockRequirementFindMany.mockResolvedValue([
      makeRow({
        id: 'req-1',
        text: 'Krav A',
        is_fulfilled: true,
        bevis_required: true,
        responsible_user_id: OTHER_USER_ID,
        _count: { evidence_links: 2 },
        list_item: {
          id: 'list-item-1',
          responsible_user_id: MOCK_USER_ID,
          document: { id: 'doc-1', title: 'SFS 2020:123' },
          law_list: { id: 'list-1', name: 'Huvudlista' },
        },
      }),
    ])

    const result = await getWorkspaceRequirements({ filter: 'all' })

    expect(result.success).toBe(true)
    expect(result.data?.items).toHaveLength(1)
    expect(result.data?.items[0]).toEqual({
      id: 'req-1',
      text: 'Krav A',
      comment: null,
      isFulfilled: true,
      bevisRequired: true,
      responsibleUserId: OTHER_USER_ID,
      effectiveAssignee: { userId: OTHER_USER_ID, isInherited: false },
      evidenceCount: 2,
      lawItemId: 'list-item-1',
      lawId: 'doc-1',
      lawName: 'SFS 2020:123',
      laglistaId: 'list-1',
      laglistaName: 'Huvudlista',
      updatedAt: new Date('2026-04-20T10:00:00Z'),
    })
  })

  it('computes effectiveAssignee via the shared resolver (inherited branch)', async () => {
    mockRequirementFindMany.mockResolvedValue([
      makeRow({
        id: 'req-2',
        responsible_user_id: null,
        list_item: {
          id: 'list-item-2',
          responsible_user_id: OTHER_USER_ID,
          document: { id: 'doc-1', title: 'SFS 2020:123' },
          law_list: { id: 'list-1', name: 'Huvudlista' },
        },
      }),
    ])

    const result = await getWorkspaceRequirements({ filter: 'all' })
    expect(result.data?.items[0]?.effectiveAssignee).toEqual({
      userId: OTHER_USER_ID,
      isInherited: true,
    })
  })

  it('cursor pagination: returns nextCursor when there is another page', async () => {
    // Default limit 50 → mock returns 51 rows → nextCursor = rows[49].id
    const rows = Array.from({ length: 51 }, (_, i) =>
      makeRow({ id: `req-${i}` })
    )
    mockRequirementFindMany.mockResolvedValue(rows)

    const result = await getWorkspaceRequirements({ filter: 'all' })
    expect(result.success).toBe(true)
    expect(result.data?.items).toHaveLength(50)
    expect(result.data?.nextCursor).toBe('req-49')
  })

  it('cursor pagination: nextCursor is null on the last page', async () => {
    const rows = Array.from({ length: 10 }, (_, i) =>
      makeRow({ id: `req-${i}` })
    )
    mockRequirementFindMany.mockResolvedValue(rows)

    const result = await getWorkspaceRequirements({
      filter: 'all',
      limit: 50,
    })
    expect(result.data?.items).toHaveLength(10)
    expect(result.data?.nextCursor).toBeNull()
  })

  it('cursor pagination: applies cursor + skip when a cursor is supplied', async () => {
    mockRequirementFindMany.mockResolvedValue([])

    await getWorkspaceRequirements({
      filter: 'all',
      cursor: '44444444-4444-4444-8444-444444444444',
      limit: 10,
    })

    const call = mockRequirementFindMany.mock.calls[0]?.[0] as {
      cursor?: { id: string }
      skip?: number
      take: number
    }
    expect(call.cursor).toEqual({ id: '44444444-4444-4444-8444-444444444444' })
    expect(call.skip).toBe(1)
    expect(call.take).toBe(11) // limit + 1 for hasMore detection
  })

  it('sort determinism: always includes an { id: asc } tiebreaker', async () => {
    mockRequirementFindMany.mockResolvedValue([])

    await getWorkspaceRequirements({
      filter: 'all',
      sort: { field: 'laglista_name', direction: 'asc' },
    })

    const orderBy = mockRequirementFindMany.mock.calls[0]?.[0].orderBy
    expect(orderBy).toEqual([
      { list_item: { law_list: { name: 'asc' } } },
      { id: 'asc' },
    ])
  })

  it('default sort: updated_at desc + id tiebreaker', async () => {
    mockRequirementFindMany.mockResolvedValue([])

    await getWorkspaceRequirements({ filter: 'all' })

    const orderBy = mockRequirementFindMany.mock.calls[0]?.[0].orderBy
    expect(orderBy).toEqual([{ updated_at: 'desc' }, { id: 'asc' }])
  })

  it('law_name sort maps to list_item.document.title', async () => {
    mockRequirementFindMany.mockResolvedValue([])

    await getWorkspaceRequirements({
      filter: 'all',
      sort: { field: 'law_name', direction: 'asc' },
    })

    const orderBy = mockRequirementFindMany.mock.calls[0]?.[0].orderBy
    expect(orderBy).toEqual([
      { list_item: { document: { title: 'asc' } } },
      { id: 'asc' },
    ])
  })

  it('workspace isolation: every query carries workspace_id scope', async () => {
    mockRequirementFindMany.mockResolvedValue([])

    await getWorkspaceRequirements({ filter: 'gaps' })

    const where = mockRequirementFindMany.mock.calls[0]?.[0].where
    expect(where.list_item.law_list.workspace_id).toBe(MOCK_WORKSPACE_ID)
  })

  it('empty result: returns success with empty items + null cursor', async () => {
    mockRequirementFindMany.mockResolvedValue([])

    const result = await getWorkspaceRequirements({ filter: 'all' })
    expect(result).toEqual({
      success: true,
      data: { items: [], nextCursor: null },
    })
  })

  it('Zod rejection: invalid filter enum returns Valideringsfel', async () => {
    const result = await getWorkspaceRequirements(
      // @ts-expect-error — exercising runtime Zod rejection
      { filter: 'banana' }
    )
    expect(result.success).toBe(false)
    expect(mockRequirementFindMany).not.toHaveBeenCalled()
  })

  it('Zod rejection: limit > 200 is rejected', async () => {
    const result = await getWorkspaceRequirements({ filter: 'all', limit: 500 })
    expect(result.success).toBe(false)
  })

  it('Zod rejection: cursor must be a UUID', async () => {
    const result = await getWorkspaceRequirements({
      filter: 'all',
      cursor: 'not-a-uuid',
    })
    expect(result.success).toBe(false)
  })

  // ---- TEST-005 (QA gate 20.2): search max-length boundary ----
  it('Zod boundary: search = 200 chars is accepted', async () => {
    mockRequirementFindMany.mockResolvedValue([])
    const result = await getWorkspaceRequirements({
      filter: 'all',
      search: 'a'.repeat(200),
    })
    expect(result.success).toBe(true)
    expect(mockRequirementFindMany).toHaveBeenCalled()
  })

  it('Zod boundary: search = 201 chars is rejected', async () => {
    const result = await getWorkspaceRequirements({
      filter: 'all',
      search: 'a'.repeat(201),
    })
    expect(result.success).toBe(false)
    expect(mockRequirementFindMany).not.toHaveBeenCalled()
  })

  it('returns Swedish error on unexpected failure', async () => {
    mockRequirementFindMany.mockRejectedValueOnce(new Error('DB kaput'))

    const result = await getWorkspaceRequirements({ filter: 'all' })
    expect(result).toEqual({
      success: false,
      error: 'Kunde inte hämta kravpunkter',
    })
  })

  it('passes the read permission to withWorkspace', async () => {
    mockRequirementFindMany.mockResolvedValue([])

    await getWorkspaceRequirements({ filter: 'all' })

    expect(workspaceContext.withWorkspace).toHaveBeenCalledWith(
      expect.any(Function),
      'read'
    )
  })

  // ---- AC 19 / §22.2.3: ≤3 Prisma queries per call ----
  it('performance budget: issues exactly ONE findMany and no count (≤3 query budget)', async () => {
    mockRequirementFindMany.mockResolvedValue([])

    await getWorkspaceRequirements({ filter: 'all' })

    expect(mockRequirementFindMany).toHaveBeenCalledTimes(1)
    expect(mockRequirementCount).not.toHaveBeenCalled()
  })

  // ---- AC 20 / §22.2.3: payload under 100KB on a default page ----
  it('payload size: default-limit full page serialises to <100KB on realistic data', async () => {
    const rows = Array.from({ length: 50 }, (_, i) =>
      makeRow({
        id: `00000000-0000-4000-8000-${String(i).padStart(12, '0')}`,
        // Realistic upper bound for krav text (500-char max per Zod schema).
        text: 'Rutinen finns dokumenterad och utbildad '.repeat(12),
        comment: 'Anteckning om kravpunkten '.repeat(20),
        _count: { evidence_links: 3 },
      })
    )
    mockRequirementFindMany.mockResolvedValue(rows)

    const result = await getWorkspaceRequirements({ filter: 'all' })
    expect(result.success).toBe(true)
    const bytes = JSON.stringify(result.data).length
    expect(bytes).toBeLessThan(100_000)
  })
})

// ---------------------------------------------------------------------------
// getWorkspaceRequirementCounts
// ---------------------------------------------------------------------------

describe('getWorkspaceRequirementCounts', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(workspaceContext.withWorkspace).mockImplementation(async (fn) =>
      fn({ workspaceId: MOCK_WORKSPACE_ID, userId: MOCK_USER_ID })
    )
  })

  it('returns the four preset counts via parallel Prisma calls', async () => {
    // Each preset returns a distinct count so we can verify mapping.
    mockRequirementCount
      .mockResolvedValueOnce(100) // all
      .mockResolvedValueOnce(40) // gaps
      .mockResolvedValueOnce(15) // mine
      .mockResolvedValueOnce(7) // needs_evidence

    const result = await getWorkspaceRequirementCounts()

    expect(result).toEqual({
      success: true,
      data: { all: 100, gaps: 40, mine: 15, needs_evidence: 7 },
    })
    expect(mockRequirementCount).toHaveBeenCalledTimes(4)
  })

  it('scopes every count query by workspace_id', async () => {
    mockRequirementCount.mockResolvedValue(0)

    await getWorkspaceRequirementCounts()

    for (const call of mockRequirementCount.mock.calls) {
      const where = (
        call[0] as {
          where: { list_item: { law_list: { workspace_id: string } } }
        }
      ).where
      expect(where.list_item.law_list.workspace_id).toBe(MOCK_WORKSPACE_ID)
    }
  })

  it('returns Swedish error on unexpected failure', async () => {
    mockRequirementCount.mockRejectedValueOnce(new Error('DB kaput'))

    const result = await getWorkspaceRequirementCounts()
    expect(result).toEqual({
      success: false,
      error: 'Kunde inte hämta kravräkningar',
    })
  })
})
