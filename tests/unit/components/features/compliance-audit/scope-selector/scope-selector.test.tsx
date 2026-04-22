/**
 * Story 21.3 — ScopeSelector component tests.
 *
 * Covers AC 10 (functional), AC 9 (a11y), IV2 (SWR key isolation),
 * IV3 (500-item perf microtest).
 */

import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import type {
  DocumentListItem,
  ListGroupSummary,
} from '@/app/actions/document-list'
import type { ScopeDefinition } from '@/app/actions/compliance-audit-cycle'

// ============================================================================
// SWR mock — stores per-key fixtures. Tests populate it before rendering.
// ============================================================================

interface SwrFixtureItems {
  items: DocumentListItem[]
  total: number
  hasMore: boolean
}

const mockSwrData = new Map<string, SwrFixtureItems | ListGroupSummary[]>()
const swrKeysSeen: string[] = []

vi.mock('swr', () => ({
  default: (key: string | null) => {
    if (key && typeof key === 'string') swrKeysSeen.push(key)
    if (!key || typeof key !== 'string') {
      return { data: undefined, isLoading: false, error: null, mutate: vi.fn() }
    }
    const data = mockSwrData.get(key)
    return {
      data,
      isLoading: false,
      error: null,
      mutate: vi.fn(),
    }
  },
}))

// ============================================================================
// Server-action mocks — imports must resolve even though the SWR mock
// short-circuits the fetcher.
// ============================================================================

vi.mock('@/app/actions/document-list', async () => {
  const actual = await vi.importActual<
    typeof import('@/app/actions/document-list')
  >('@/app/actions/document-list')
  return {
    ...actual,
    getDocumentListItems: vi.fn(),
    getListGroups: vi.fn(),
  }
})

// ============================================================================
// Component under test (imported AFTER mocks are in place)
// ============================================================================

import ScopeSelector, {
  __private,
} from '@/components/features/compliance-audit/scope-selector/ScopeSelector'

const {
  getItemState,
  getGroupState,
  getMasterState,
  deriveScope,
  formatScopeSummary,
  buildGroupedData,
} = __private

// ============================================================================
// Fixture helpers
// ============================================================================

// RFC 4122 v4-like UUIDs (deterministic across runs).
const LIST_ID = '00000000-0000-4000-8000-000000000001'
const GROUP_A_ID = '00000000-0000-4000-8000-00000000000A'
const GROUP_B_ID = '00000000-0000-4000-8000-00000000000B'

function makeItem(
  id: string,
  groupId: string | null,
  title: string,
  position = 0
): DocumentListItem {
  return {
    id,
    position,
    commentary: null,
    status: 'NOT_STARTED' as DocumentListItem['status'],
    priority: 'MEDIUM' as DocumentListItem['priority'],
    notes: null,
    addedAt: new Date('2026-04-22T00:00:00Z'),
    dueDate: null,
    assignee: null,
    groupId,
    groupName:
      groupId === GROUP_A_ID
        ? 'Grupp A'
        : groupId === GROUP_B_ID
          ? 'Grupp B'
          : null,
    complianceStatus: 'EJ_PABORJAD' as DocumentListItem['complianceStatus'],
    responsibleUser: null,
    category: null,
    businessContext: null,
    businessContextUpdatedAt: null,
    businessContextUpdatedBy: null,
    complianceActions: null,
    complianceActionsUpdatedAt: null,
    complianceActionsUpdatedBy: null,
    updatedAt: new Date('2026-04-22T00:00:00Z'),
    pendingChangeCount: 0,
    document: {
      id: `doc-${id}`,
      title,
      documentNumber: `SFS ${id.slice(-4)}`,
      contentType: 'SFS_LAW' as DocumentListItem['document']['contentType'],
      slug: `sfs-${id.slice(-4)}`,
      summary: null,
      effectiveDate: null,
      sourceUrl: null,
      status: 'ACTIVE',
    },
  }
}

function makeGroup(
  id: string,
  name: string,
  position: number,
  itemCount = 3
): ListGroupSummary {
  return {
    id,
    name,
    position,
    itemCount,
    createdAt: new Date('2026-04-22T00:00:00Z'),
  }
}

/**
 * Seed fixture: 2 groups × 3 items each. No ungrouped items.
 *   Grupp A @ pos=0 → items a1 (pos=0), a2 (pos=1), a3 (pos=2)
 *   Grupp B @ pos=1 → items b1 (pos=0), b2 (pos=1), b3 (pos=2)
 */
function buildStandardFixture(): {
  items: DocumentListItem[]
  groups: ListGroupSummary[]
  itemIds: {
    a1: string
    a2: string
    a3: string
    b1: string
    b2: string
    b3: string
  }
} {
  const itemIds = {
    a1: '00000000-0000-4000-8000-00000000A001',
    a2: '00000000-0000-4000-8000-00000000A002',
    a3: '00000000-0000-4000-8000-00000000A003',
    b1: '00000000-0000-4000-8000-00000000B001',
    b2: '00000000-0000-4000-8000-00000000B002',
    b3: '00000000-0000-4000-8000-00000000B003',
  }
  const items = [
    makeItem(itemIds.a1, GROUP_A_ID, 'Lag A1', 0),
    makeItem(itemIds.a2, GROUP_A_ID, 'Lag A2', 1),
    makeItem(itemIds.a3, GROUP_A_ID, 'Lag A3', 2),
    makeItem(itemIds.b1, GROUP_B_ID, 'Lag B1', 0),
    makeItem(itemIds.b2, GROUP_B_ID, 'Lag B2', 1),
    makeItem(itemIds.b3, GROUP_B_ID, 'Lag B3', 2),
  ]
  const groups = [
    makeGroup(GROUP_A_ID, 'Grupp A', 0),
    makeGroup(GROUP_B_ID, 'Grupp B', 1),
  ]
  return { items, groups, itemIds }
}

function seed(
  items: DocumentListItem[],
  groups: ListGroupSummary[],
  hasMore = false
) {
  mockSwrData.clear()
  swrKeysSeen.length = 0
  mockSwrData.set(`scope-selector:items:${LIST_ID}`, {
    items,
    total: items.length,
    hasMore,
  })
  mockSwrData.set(`scope-selector:groups:${LIST_ID}`, groups)
}

beforeEach(() => {
  mockSwrData.clear()
  swrKeysSeen.length = 0
})

// ============================================================================
// __private helper tests (fast lane — no mounting)
// ============================================================================

describe('__private helpers', () => {
  describe('getItemState', () => {
    it('returns true when item id is in selection', () => {
      expect(getItemState(new Set(['a']), 'a')).toBe(true)
    })

    it('returns false when item id is not in selection', () => {
      expect(getItemState(new Set(['b']), 'a')).toBe(false)
    })
  })

  describe('getGroupState', () => {
    const { items, itemIds } = buildStandardFixture()
    const groupAItems = items.filter((i) => i.groupId === GROUP_A_ID)

    it('returns false for empty selection', () => {
      expect(getGroupState(new Set(), groupAItems)).toBe(false)
    })

    it('returns true when all group items are selected', () => {
      const sel = new Set([itemIds.a1, itemIds.a2, itemIds.a3])
      expect(getGroupState(sel, groupAItems)).toBe(true)
    })

    it('returns "indeterminate" when some-but-not-all group items are selected', () => {
      const sel = new Set([itemIds.a1])
      expect(getGroupState(sel, groupAItems)).toBe('indeterminate')
    })

    it('returns false for empty group (empty group cannot be fully-selected)', () => {
      expect(getGroupState(new Set(['anything']), [])).toBe(false)
    })
  })

  describe('getMasterState', () => {
    const { itemIds } = buildStandardFixture()
    const allIds = new Set(Object.values(itemIds))

    it('returns false when no items exist', () => {
      expect(getMasterState(new Set(), new Set())).toBe(false)
    })

    it('returns false for empty selection', () => {
      expect(getMasterState(new Set(), allIds)).toBe(false)
    })

    it('returns true when every item is selected', () => {
      expect(getMasterState(allIds, allIds)).toBe(true)
    })

    it('returns "indeterminate" for partial selection', () => {
      expect(getMasterState(new Set([itemIds.a1]), allIds)).toBe(
        'indeterminate'
      )
    })
  })

  describe('deriveScope', () => {
    const { items, groups, itemIds } = buildStandardFixture()
    const grouped = buildGroupedData(items, groups)

    it('returns null for empty selection', () => {
      expect(deriveScope(new Set(), grouped)).toBeNull()
    })

    it('returns { kind: "all" } when every item is selected', () => {
      const scope = deriveScope(new Set(grouped.allItemIds), grouped)
      expect(scope).toEqual({ kind: 'all' })
    })

    it('returns { kind: "groups" } when one full group is selected (no partials, no ungrouped)', () => {
      const sel = new Set([itemIds.a1, itemIds.a2, itemIds.a3])
      expect(deriveScope(sel, grouped)).toEqual({
        kind: 'groups',
        groupIds: [GROUP_A_ID],
      })
    })

    it('short-circuits to { kind: "all" } when the full-group selection covers every item', () => {
      // Full selection of every group in a 2-group fixture equals the entire
      // laglista — deriveScope's `selection.size === allItemIds.size` branch
      // wins before the groups-only branch is reached.
      const sel = new Set([
        itemIds.a1,
        itemIds.a2,
        itemIds.a3,
        itemIds.b1,
        itemIds.b2,
        itemIds.b3,
      ])
      expect(deriveScope(sel, grouped)).toEqual({ kind: 'all' })
    })

    it('returns { kind: "groups" } when strict subset of groups fully selected', () => {
      // Create a 3-group fixture so selecting 2 full groups is a strict subset.
      const C_ID = '00000000-0000-4000-8000-00000000000C'
      const cItem = makeItem(
        '00000000-0000-4000-8000-00000000C001',
        C_ID,
        'Lag C1',
        0
      )
      const extendedItems = [...items, cItem]
      const extendedGroups = [...groups, makeGroup(C_ID, 'Grupp C', 2, 1)]
      const extended = buildGroupedData(extendedItems, extendedGroups)
      const sel = new Set([
        itemIds.a1,
        itemIds.a2,
        itemIds.a3,
        itemIds.b1,
        itemIds.b2,
        itemIds.b3,
      ])
      expect(deriveScope(sel, extended)).toEqual({
        kind: 'groups',
        groupIds: [GROUP_A_ID, GROUP_B_ID],
      })
    })

    it('returns { kind: "items" } when selection has a partial group', () => {
      const sel = new Set([itemIds.a1, itemIds.a2]) // 2 of 3 in group A
      expect(deriveScope(sel, grouped)).toEqual({
        kind: 'items',
        itemIds: [itemIds.a1, itemIds.a2],
      })
    })

    it('returns { kind: "items" } when selection includes an ungrouped item alongside a full group', () => {
      const U_ID = '00000000-0000-4000-8000-00000000U001'
      const uItem = makeItem(U_ID, null, 'Ogrupperad lag', 0)
      const extendedItems = [...items, uItem]
      const extended = buildGroupedData(extendedItems, groups)
      const sel = new Set([itemIds.a1, itemIds.a2, itemIds.a3, U_ID])
      const scope = deriveScope(sel, extended)
      expect(scope?.kind).toBe('items')
      expect((scope as { itemIds: string[] }).itemIds).toContain(U_ID)
    })

    it('deterministic itemIds sort: groupPosition asc → itemPosition asc → id asc', () => {
      const sel = new Set([itemIds.b2, itemIds.a3, itemIds.a1])
      const scope = deriveScope(sel, grouped)
      // Group A pos=0 comes before Group B pos=1. Within A, pos asc.
      expect(scope).toEqual({
        kind: 'items',
        itemIds: [itemIds.a1, itemIds.a3, itemIds.b2],
      })
    })
  })

  describe('formatScopeSummary', () => {
    it('returns "Inga dokument valda" for empty selection', () => {
      expect(formatScopeSummary(new Set(), null, 10)).toBe(
        'Inga dokument valda'
      )
    })

    it('returns "Alla N dokument valda" for kind=all', () => {
      expect(
        formatScopeSummary(new Set(['a', 'b', 'c']), { kind: 'all' }, 3)
      ).toBe('Alla 3 dokument valda')
    })

    it('returns singular "1 dokument valt i 1 grupp" for kind=groups with 1 item + 1 group', () => {
      expect(
        formatScopeSummary(
          new Set(['a']),
          { kind: 'groups', groupIds: ['g1'] },
          10
        )
      ).toBe('1 dokument valt i 1 grupp')
    })

    it('returns plural "N dokument valda i M grupper" for kind=groups with N+M plural', () => {
      const sel = new Set(['a', 'b', 'c'])
      expect(
        formatScopeSummary(sel, { kind: 'groups', groupIds: ['g1', 'g2'] }, 10)
      ).toBe('3 dokument valda i 2 grupper')
    })

    it('returns "1 dokument valt" for kind=items with 1 item', () => {
      expect(
        formatScopeSummary(
          new Set(['a']),
          { kind: 'items', itemIds: ['a'] },
          10
        )
      ).toBe('1 dokument valt')
    })

    it('returns "N dokument valda" for kind=items with 2+ items', () => {
      expect(
        formatScopeSummary(
          new Set(['a', 'b']),
          { kind: 'items', itemIds: ['a', 'b'] },
          10
        )
      ).toBe('2 dokument valda')
    })
  })
})

// ============================================================================
// Component render tests
// ============================================================================

describe('ScopeSelector — rendering', () => {
  it('renders the master checkbox + all group headers + all items', () => {
    const { items, groups } = buildStandardFixture()
    seed(items, groups)
    render(<ScopeSelector listId={LIST_ID} onChange={vi.fn()} />)

    expect(screen.getByRole('checkbox', { name: 'Välj alla' })).toBeDefined()
    expect(screen.getByRole('group', { name: 'Grupp: Grupp A' })).toBeDefined()
    expect(screen.getByRole('group', { name: 'Grupp: Grupp B' })).toBeDefined()
    expect(screen.getByRole('checkbox', { name: 'Välj: Lag A1' })).toBeDefined()
    expect(screen.getByRole('checkbox', { name: 'Välj: Lag B3' })).toBeDefined()
  })

  it('does not render an Ogrupperad panel when all items belong to a group', () => {
    const { items, groups } = buildStandardFixture()
    seed(items, groups)
    render(<ScopeSelector listId={LIST_ID} onChange={vi.fn()} />)
    expect(screen.queryByText('Ogrupperad')).toBeNull()
  })

  it('renders an Ogrupperad panel when at least one item has groupId === null', () => {
    const { items, groups } = buildStandardFixture()
    const uItem = makeItem(
      '00000000-0000-4000-8000-00000000U001',
      null,
      'Ogrupperad lag',
      0
    )
    seed([...items, uItem], groups)
    render(<ScopeSelector listId={LIST_ID} onChange={vi.fn()} />)
    expect(screen.getByText('Ogrupperad')).toBeDefined()
  })
})

describe('ScopeSelector — SWR key isolation (IV2)', () => {
  it('reads only scope-selector:* keys and never /laglistor-prefixed keys', () => {
    const { items, groups } = buildStandardFixture()
    seed(items, groups)
    render(<ScopeSelector listId={LIST_ID} onChange={vi.fn()} />)

    const seen = swrKeysSeen.filter((k) => !k.startsWith('scope-selector:'))
    expect(seen).toEqual([])
    expect(swrKeysSeen).toContain(`scope-selector:items:${LIST_ID}`)
    expect(swrKeysSeen).toContain(`scope-selector:groups:${LIST_ID}`)
  })
})

describe('ScopeSelector — tri-state propagation (AC 5)', () => {
  it('selecting all items in a group sets group=checked, master=indeterminate', async () => {
    const user = userEvent.setup()
    const { items, groups, itemIds } = buildStandardFixture()
    seed(items, groups)
    render(<ScopeSelector listId={LIST_ID} onChange={vi.fn()} />)

    await user.click(screen.getByRole('checkbox', { name: 'Välj: Lag A1' }))
    await user.click(screen.getByRole('checkbox', { name: 'Välj: Lag A2' }))
    await user.click(screen.getByRole('checkbox', { name: 'Välj: Lag A3' }))

    expect(
      screen.getByRole('checkbox', { name: 'Välj grupp: Grupp A' })
    ).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('checkbox', { name: 'Välj alla' })).toHaveAttribute(
      'aria-checked',
      'mixed'
    )
    void itemIds // silence unused
  })

  it('selecting one item in a group sets group=indeterminate, master=indeterminate', async () => {
    const user = userEvent.setup()
    const { items, groups } = buildStandardFixture()
    seed(items, groups)
    render(<ScopeSelector listId={LIST_ID} onChange={vi.fn()} />)

    await user.click(screen.getByRole('checkbox', { name: 'Välj: Lag A1' }))

    expect(
      screen.getByRole('checkbox', { name: 'Välj grupp: Grupp A' })
    ).toHaveAttribute('aria-checked', 'mixed')
    expect(screen.getByRole('checkbox', { name: 'Välj alla' })).toHaveAttribute(
      'aria-checked',
      'mixed'
    )
  })

  it('clicking an indeterminate group-header selects every item in the group', async () => {
    const user = userEvent.setup()
    const { items, groups } = buildStandardFixture()
    seed(items, groups)
    render(<ScopeSelector listId={LIST_ID} onChange={vi.fn()} />)

    await user.click(screen.getByRole('checkbox', { name: 'Välj: Lag A1' }))
    await user.click(
      screen.getByRole('checkbox', { name: 'Välj grupp: Grupp A' })
    )

    expect(
      screen.getByRole('checkbox', { name: 'Välj: Lag A1' })
    ).toHaveAttribute('aria-checked', 'true')
    expect(
      screen.getByRole('checkbox', { name: 'Välj: Lag A2' })
    ).toHaveAttribute('aria-checked', 'true')
    expect(
      screen.getByRole('checkbox', { name: 'Välj: Lag A3' })
    ).toHaveAttribute('aria-checked', 'true')
  })

  it('clicking a checked master deselects everything', async () => {
    const user = userEvent.setup()
    const { items, groups } = buildStandardFixture()
    seed(items, groups)
    render(<ScopeSelector listId={LIST_ID} onChange={vi.fn()} />)

    const master = screen.getByRole('checkbox', { name: 'Välj alla' })
    await user.click(master) // select all
    expect(master).toHaveAttribute('aria-checked', 'true')

    await user.click(master) // deselect all
    expect(master).toHaveAttribute('aria-checked', 'false')
  })
})

describe('ScopeSelector — onChange emission (AC 6)', () => {
  it('emits { kind: "all" } when master is toggled on', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { items, groups } = buildStandardFixture()
    seed(items, groups)
    render(<ScopeSelector listId={LIST_ID} onChange={onChange} />)

    await user.click(screen.getByRole('checkbox', { name: 'Välj alla' }))

    await waitFor(() => {
      expect(onChange).toHaveBeenCalled()
    })
    expect(onChange).toHaveBeenLastCalledWith({ kind: 'all' })
  })

  it('emits { kind: "groups" } when a strict subset of full groups is selected', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    // Extend to 3 groups so 2 full groups is a strict subset.
    const { items, groups } = buildStandardFixture()
    const C_ID = '00000000-0000-4000-8000-00000000000C'
    const cItem = makeItem(
      '00000000-0000-4000-8000-00000000C001',
      C_ID,
      'Lag C1',
      0
    )
    seed([...items, cItem], [...groups, makeGroup(C_ID, 'Grupp C', 2, 1)])
    render(<ScopeSelector listId={LIST_ID} onChange={onChange} />)

    await user.click(
      screen.getByRole('checkbox', { name: 'Välj grupp: Grupp A' })
    )
    await user.click(
      screen.getByRole('checkbox', { name: 'Välj grupp: Grupp B' })
    )

    await waitFor(() => {
      const last = onChange.mock.calls.at(-1)?.[0]
      expect(last).toEqual({
        kind: 'groups',
        groupIds: [GROUP_A_ID, GROUP_B_ID],
      })
    })
  })

  it('emits { kind: "items" } when a partial selection exists inside one group', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { items, groups, itemIds } = buildStandardFixture()
    seed(items, groups)
    render(<ScopeSelector listId={LIST_ID} onChange={onChange} />)

    await user.click(screen.getByRole('checkbox', { name: 'Välj: Lag A1' }))
    await user.click(screen.getByRole('checkbox', { name: 'Välj: Lag A2' }))

    await waitFor(() => {
      const last = onChange.mock.calls.at(-1)?.[0]
      expect(last).toEqual({
        kind: 'items',
        itemIds: [itemIds.a1, itemIds.a2],
      })
    })
  })

  it('emits { kind: "items" } (never "groups") when an ungrouped item is part of the selection', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { items, groups } = buildStandardFixture()
    const U_ID = '00000000-0000-4000-8000-00000000U001'
    const uItem = makeItem(U_ID, null, 'Ogrupperad lag', 0)
    seed([...items, uItem], groups)
    render(<ScopeSelector listId={LIST_ID} onChange={onChange} />)

    await user.click(
      screen.getByRole('checkbox', { name: 'Välj grupp: Grupp A' })
    )
    await user.click(
      screen.getByRole('checkbox', { name: 'Välj: Ogrupperad lag' })
    )

    await waitFor(() => {
      const last = onChange.mock.calls.at(-1)?.[0] as ScopeDefinition
      expect(last.kind).toBe('items')
    })
  })

  it('never fires onChange with an empty itemIds/groupIds payload', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { items, groups } = buildStandardFixture()
    seed(items, groups)
    render(<ScopeSelector listId={LIST_ID} onChange={onChange} />)

    await user.click(screen.getByRole('checkbox', { name: 'Välj: Lag A1' }))
    await user.click(screen.getByRole('checkbox', { name: 'Välj: Lag A1' })) // deselect

    // After the select→deselect cycle the selection is empty; onChange MUST NOT
    // have been called with an empty-array payload.
    for (const call of onChange.mock.calls) {
      const payload = call[0] as ScopeDefinition
      if (payload.kind === 'items')
        expect(payload.itemIds.length).toBeGreaterThan(0)
      if (payload.kind === 'groups')
        expect(payload.groupIds.length).toBeGreaterThan(0)
    }
  })

  it('{ kind: "all" } flip-flop works — select-all then deselect-all leaves selection empty', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { items, groups } = buildStandardFixture()
    seed(items, groups)
    render(<ScopeSelector listId={LIST_ID} onChange={onChange} />)

    const master = screen.getByRole('checkbox', { name: 'Välj alla' })
    await user.click(master) // emits { kind: 'all' }
    await waitFor(() => {
      expect(onChange).toHaveBeenCalledWith({ kind: 'all' })
    })

    await user.click(master) // deselect — MUST NOT emit empty items
    expect(master).toHaveAttribute('aria-checked', 'false')
  })
})

describe('ScopeSelector — live summary (AC 7)', () => {
  it('reads "Inga dokument valda" when nothing is selected', () => {
    const { items, groups } = buildStandardFixture()
    seed(items, groups)
    render(<ScopeSelector listId={LIST_ID} onChange={vi.fn()} />)
    expect(screen.getByRole('status').textContent).toBe('Inga dokument valda')
  })

  it('reads "Alla N dokument valda" when everything is selected', async () => {
    const user = userEvent.setup()
    const { items, groups } = buildStandardFixture()
    seed(items, groups)
    render(<ScopeSelector listId={LIST_ID} onChange={vi.fn()} />)

    await user.click(screen.getByRole('checkbox', { name: 'Välj alla' }))
    expect(screen.getByRole('status').textContent).toBe('Alla 6 dokument valda')
  })

  it('reads "N dokument valda i M grupper" for kind=groups', async () => {
    const user = userEvent.setup()
    const { items, groups } = buildStandardFixture()
    const C_ID = '00000000-0000-4000-8000-00000000000C'
    const cItem = makeItem(
      '00000000-0000-4000-8000-00000000C001',
      C_ID,
      'Lag C1',
      0
    )
    seed([...items, cItem], [...groups, makeGroup(C_ID, 'Grupp C', 2, 1)])
    render(<ScopeSelector listId={LIST_ID} onChange={vi.fn()} />)

    await user.click(
      screen.getByRole('checkbox', { name: 'Välj grupp: Grupp A' })
    )
    await user.click(
      screen.getByRole('checkbox', { name: 'Välj grupp: Grupp B' })
    )

    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe(
        '6 dokument valda i 2 grupper'
      )
    })
  })

  it('reads "1 dokument valt" for single-item items-shape selection', async () => {
    const user = userEvent.setup()
    const { items, groups } = buildStandardFixture()
    seed(items, groups)
    render(<ScopeSelector listId={LIST_ID} onChange={vi.fn()} />)

    await user.click(screen.getByRole('checkbox', { name: 'Välj: Lag A1' }))
    await waitFor(() => {
      expect(screen.getByRole('status').textContent).toBe('1 dokument valt')
    })
  })
})

describe('ScopeSelector — disabled prop', () => {
  it('disables every checkbox and blocks onChange on click', async () => {
    const user = userEvent.setup()
    const onChange = vi.fn()
    const { items, groups } = buildStandardFixture()
    seed(items, groups)
    render(<ScopeSelector listId={LIST_ID} onChange={onChange} disabled />)

    const master = screen.getByRole('checkbox', { name: 'Välj alla' })
    expect(master).toBeDisabled()
    await user.click(master)
    expect(onChange).not.toHaveBeenCalled()
  })

  it('keeps group-expand/collapse chevrons interactive even when disabled (Task 7.5)', async () => {
    // Read-only inspection remains useful — users must still be able to
    // collapse/expand groups to inspect selection state. `<fieldset disabled>`
    // would block every button inside; the component deliberately omits the
    // native attribute and disables only the checkboxes.
    const user = userEvent.setup()
    const { items, groups } = buildStandardFixture()
    seed(items, groups)
    render(<ScopeSelector listId={LIST_ID} onChange={vi.fn()} disabled />)

    // Grupp A is initially expanded → its items are visible.
    expect(screen.getByRole('checkbox', { name: 'Välj: Lag A1' })).toBeDefined()

    const chevron = screen.getByRole('button', {
      name: /Komprimera grupp: Grupp A/i,
    })
    expect(chevron).not.toBeDisabled()
    await user.click(chevron)

    // After collapse, Lag A1's checkbox disappears from the DOM.
    expect(screen.queryByRole('checkbox', { name: 'Välj: Lag A1' })).toBeNull()
  })
})

describe('ScopeSelector — controlled value + no-emit guard (AC 9 / Task 9.4)', () => {
  it('renders with value={kind:"groups"} showing group A fully checked on mount, without firing onChange', () => {
    const onChange = vi.fn()
    const { items, groups } = buildStandardFixture()
    seed(items, groups)
    render(
      <ScopeSelector
        listId={LIST_ID}
        value={{ kind: 'groups', groupIds: [GROUP_A_ID] }}
        onChange={onChange}
      />
    )

    expect(onChange).not.toHaveBeenCalled()
    expect(
      screen.getByRole('checkbox', { name: 'Välj grupp: Grupp A' })
    ).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('checkbox', { name: 'Välj alla' })).toHaveAttribute(
      'aria-checked',
      'mixed'
    )
  })

  it('does not fire onChange when parent passes a new value prop externally', () => {
    const onChange = vi.fn()
    const { items, groups, itemIds } = buildStandardFixture()
    seed(items, groups)
    const { rerender } = render(
      <ScopeSelector
        listId={LIST_ID}
        value={{ kind: 'groups', groupIds: [GROUP_A_ID] }}
        onChange={onChange}
      />
    )
    rerender(
      <ScopeSelector
        listId={LIST_ID}
        value={{ kind: 'items', itemIds: [itemIds.b1, itemIds.b2] }}
        onChange={onChange}
      />
    )

    expect(onChange).not.toHaveBeenCalled()
  })

  it('supports defaultValue (uncontrolled) — no onChange fires on mount', () => {
    const onChange = vi.fn()
    const { items, groups } = buildStandardFixture()
    seed(items, groups)
    render(
      <ScopeSelector
        listId={LIST_ID}
        defaultValue={{ kind: 'groups', groupIds: [GROUP_A_ID] }}
        onChange={onChange}
      />
    )
    expect(onChange).not.toHaveBeenCalled()
  })
})

describe('ScopeSelector — truncation banner (Task 2.4)', () => {
  it('renders the Swedish warning banner when hasMore=true', () => {
    const { items, groups } = buildStandardFixture()
    seed(items, groups, true)
    render(<ScopeSelector listId={LIST_ID} onChange={vi.fn()} />)
    expect(
      screen.getByText(
        /Laglistan innehåller fler än 500 lagar\. Endast de 500 första visas\./
      )
    ).toBeDefined()
  })

  it('does not render the banner when hasMore=false', () => {
    const { items, groups } = buildStandardFixture()
    seed(items, groups, false)
    render(<ScopeSelector listId={LIST_ID} onChange={vi.fn()} />)
    expect(
      screen.queryByText(/Laglistan innehåller fler än 500 lagar/)
    ).toBeNull()
  })
})

// ============================================================================
// Performance microtest (IV3)
// ============================================================================

describe('ScopeSelector — performance (IV3)', () => {
  // Target on a real browser is < 500ms; jsdom is measurably slower and, under
  // full-suite concurrency, mount time has been observed at ~1600ms on CI
  // (560ms when run in isolation). We keep the ceiling generous at 3000ms —
  // this microtest is a soft guard against egregious N² regressions, not a
  // hard perf wall. Same thresholding convention used in Story 21.2's Task 9.7.
  it('renders a 500-item laglista in under 3000ms (jsdom+CI ceiling; target <500ms real browser)', () => {
    const { items, groups } = build500ItemFixture()
    seed(items, groups)

    const start = performance.now()
    render(<ScopeSelector listId={LIST_ID} onChange={vi.fn()} />)
    const elapsed = performance.now() - start

    expect(elapsed).toBeLessThan(3000)
  })
})

function build500ItemFixture(): {
  items: DocumentListItem[]
  groups: ListGroupSummary[]
} {
  const groups: ListGroupSummary[] = []
  const items: DocumentListItem[] = []
  // 50 groups × 10 items = 500 items.
  for (let gi = 0; gi < 50; gi += 1) {
    const groupId = `00000000-0000-4000-8000-${gi.toString(16).padStart(12, '0')}`
    groups.push(makeGroup(groupId, `Grupp ${gi}`, gi, 10))
    for (let ii = 0; ii < 10; ii += 1) {
      const itemId = `00000000-0000-4000-8000-${gi.toString(16).padStart(4, '0')}${ii.toString(16).padStart(8, '0')}`
      items.push(makeItem(itemId, groupId, `Lag ${gi}.${ii}`, ii))
    }
  }
  return { items, groups }
}
