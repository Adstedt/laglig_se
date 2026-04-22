'use client'

/**
 * Story 21.3 — Scope selection component (ScopeSelector).
 *
 * Lets a KMA-samordnare declare a compliance audit cycle's scope using the
 * same grouped laglista layout as `/laglistor`. Emits a ScopeDefinition
 * compatible with Story 21.2's `createCycle` server action.
 *
 * ScopeDefinition type is owned by Story 21.2 at
 * `app/actions/compliance-audit-cycle.ts:44-47` — imported, never redeclared.
 */

import { useEffect, useMemo, useRef, useState, useCallback, useId } from 'react'
import useSWR from 'swr'
import {
  ChevronRight,
  Minus,
  Check,
  AlertTriangle,
  RotateCcw,
} from 'lucide-react'
import * as CheckboxPrimitive from '@radix-ui/react-checkbox'
import { Button } from '@/components/ui/button'
import { Skeleton } from '@/components/ui/skeleton'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { cn } from '@/lib/utils'
import {
  getDocumentListItems,
  getListGroups,
  type DocumentListItem,
  type ListGroupSummary,
} from '@/app/actions/document-list'
import type { ScopeDefinition } from '@/app/actions/compliance-audit-cycle'
import {
  SCOPE_SUMMARY_EMPTY,
  scopeSummaryAll,
  scopeSummaryGroups,
  scopeSummaryItems,
} from '@/components/features/compliance-audit/scope-summary-copy'

// ============================================================================
// Types
// ============================================================================

export interface ScopeSelectorProps {
  listId: string
  value?: ScopeDefinition
  defaultValue?: ScopeDefinition
  onChange: (_scope: ScopeDefinition) => void
  disabled?: boolean
  className?: string
  /**
   * Story 21.4: if true, all groups render collapsed on initial mount.
   * Default (false) preserves Story 21.3 AC 4 ("Group panels default to expanded").
   * User interaction with the chevron still toggles individual groups normally.
   */
  defaultCollapsed?: boolean
}

type CheckedState = boolean | 'indeterminate'

interface GroupBucket {
  id: string | null // null = "Ogrupperad" pseudo-group
  name: string
  position: number
  items: DocumentListItem[]
}

interface GroupedData {
  groups: GroupBucket[]
  allItemIds: Set<string>
}

// ============================================================================
// Pure helpers (exported via __private for direct unit testing)
// ============================================================================

/** Item checkbox state — binary, never indeterminate. */
function getItemState(selection: Set<string>, itemId: string): CheckedState {
  return selection.has(itemId)
}

/**
 * Group checkbox state based on its items' membership in the selection.
 * Empty groups are always `false` (an empty group cannot be "all-selected").
 */
function getGroupState(
  selection: Set<string>,
  groupItems: DocumentListItem[]
): CheckedState {
  if (groupItems.length === 0) return false
  let count = 0
  for (const item of groupItems) {
    if (selection.has(item.id)) count += 1
  }
  if (count === 0) return false
  if (count === groupItems.length) return true
  return 'indeterminate'
}

/** Master "Välj alla" state across every item in every group. */
function getMasterState(
  selection: Set<string>,
  allItemIds: Set<string>
): CheckedState {
  if (allItemIds.size === 0) return false
  if (selection.size === 0) return false
  if (selection.size === allItemIds.size) return true
  return 'indeterminate'
}

/**
 * Reduce current selection to a ScopeDefinition.
 * Returns `null` iff selection is empty (no emission — the Zod schema
 * rejects `{kind:'items', itemIds:[]}` and `{kind:'groups', groupIds:[]}`
 * via `.min(1)` on both arrays).
 */
function deriveScope(
  selection: Set<string>,
  grouped: GroupedData
): ScopeDefinition | null {
  if (selection.size === 0) return null
  if (selection.size === grouped.allItemIds.size) return { kind: 'all' }

  const fullGroups: GroupBucket[] = []
  let partialGroupCount = 0
  let ungroupedSelectedCount = 0

  for (const group of grouped.groups) {
    let selectedInGroup = 0
    for (const item of group.items) {
      if (selection.has(item.id)) selectedInGroup += 1
    }
    if (selectedInGroup === 0) continue

    if (group.id === null) {
      ungroupedSelectedCount += selectedInGroup
      continue
    }

    if (selectedInGroup === group.items.length && group.items.length > 0) {
      fullGroups.push(group)
    } else {
      partialGroupCount += 1
    }
  }

  if (
    partialGroupCount === 0 &&
    ungroupedSelectedCount === 0 &&
    fullGroups.length > 0
  ) {
    return {
      kind: 'groups',
      groupIds: fullGroups
        .slice()
        .sort((a, b) => a.position - b.position)
        .map((g) => g.id as string),
    }
  }

  // Build itemIds sorted by (groupPosition asc, itemPosition asc, id asc).
  const itemPositionIndex = new Map<
    string,
    { groupPosition: number; itemPosition: number }
  >()
  for (const group of grouped.groups) {
    // Ungrouped pseudo-group gets a sentinel position that sorts it last —
    // matches the visual order.
    const groupPosition =
      group.id === null ? Number.MAX_SAFE_INTEGER : group.position
    for (const item of group.items) {
      itemPositionIndex.set(item.id, {
        groupPosition,
        itemPosition: item.position,
      })
    }
  }

  const sortedItemIds = [...selection].sort((a, b) => {
    const pa = itemPositionIndex.get(a)
    const pb = itemPositionIndex.get(b)
    if (!pa || !pb) return a.localeCompare(b)
    if (pa.groupPosition !== pb.groupPosition)
      return pa.groupPosition - pb.groupPosition
    if (pa.itemPosition !== pb.itemPosition)
      return pa.itemPosition - pb.itemPosition
    return a.localeCompare(b)
  })

  return { kind: 'items', itemIds: sortedItemIds }
}

/**
 * Swedish-locale live summary text.
 * Exact strings are asserted in tests — keep in sync with AC 7 / Dev Notes table.
 */
function formatScopeSummary(
  selection: Set<string>,
  scope: ScopeDefinition | null,
  totalItems: number
): string {
  if (selection.size === 0) return SCOPE_SUMMARY_EMPTY
  if (scope?.kind === 'all') return scopeSummaryAll(totalItems)
  if (scope?.kind === 'groups') {
    return scopeSummaryGroups(selection.size, scope.groupIds.length)
  }
  return scopeSummaryItems(selection.size)
}

/** Resolve a ScopeDefinition → the Set of selected item ids. */
function resolveInitialSelection(
  scope: ScopeDefinition | undefined,
  grouped: GroupedData | null
): Set<string> {
  if (!scope || !grouped) return new Set()
  if (scope.kind === 'all') return new Set(grouped.allItemIds)
  if (scope.kind === 'groups') {
    const ids = new Set<string>()
    for (const group of grouped.groups) {
      if (group.id !== null && scope.groupIds.includes(group.id)) {
        for (const item of group.items) ids.add(item.id)
      }
    }
    return ids
  }
  return new Set(scope.itemIds)
}

// ============================================================================
// Component
// ============================================================================

/**
 * ScopeSelector — grouped, tri-state checkbox picker for a laglista scope.
 *
 * Emits a ScopeDefinition to `onChange` after user-driven selection changes.
 * Never emits in response to `value` prop changes (controlled-mode loop guard
 * via `userDrivenRef`).
 */
export default function ScopeSelector({
  listId,
  value,
  defaultValue,
  onChange,
  disabled = false,
  className,
  defaultCollapsed = false,
}: ScopeSelectorProps) {
  const masterId = useId()

  // ---- Data fetch (parallel, isolated SWR keys) --------------------------
  const {
    data: itemsResult,
    isLoading: itemsLoading,
    error: itemsError,
    mutate: mutateItems,
  } = useSWR(
    `scope-selector:items:${listId}`,
    async () => {
      const result = await getDocumentListItems({
        listId,
        page: 1,
        limit: 500,
      })
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Kunde inte hämta lagar')
      }
      return result.data
    },
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  )

  const {
    data: groupsResult,
    isLoading: groupsLoading,
    error: groupsError,
    mutate: mutateGroups,
  } = useSWR(
    `scope-selector:groups:${listId}`,
    async () => {
      const result = await getListGroups(listId)
      if (!result.success || !result.data) {
        throw new Error(result.error ?? 'Kunde inte hämta grupper')
      }
      return result.data
    },
    { revalidateOnFocus: false, dedupingInterval: 30_000 }
  )

  const isLoading = itemsLoading || groupsLoading
  const error = itemsError || groupsError

  // ---- Grouped data structure (memoized) ---------------------------------
  const grouped = useMemo<GroupedData | null>(() => {
    if (!itemsResult || !groupsResult) return null
    return buildGroupedData(itemsResult.items, groupsResult)
  }, [itemsResult, groupsResult])

  // ---- Selection state ---------------------------------------------------
  const [selection, setSelection] = useState<Set<string>>(() =>
    resolveInitialSelection(value ?? defaultValue, null)
  )

  // Hydrate selection once `grouped` is available if we had an initial scope.
  const hydratedRef = useRef(false)
  useEffect(() => {
    if (grouped && !hydratedRef.current) {
      const initial = value ?? defaultValue
      if (initial) {
        setSelection(resolveInitialSelection(initial, grouped))
      }
      hydratedRef.current = true
    }
  }, [grouped, value, defaultValue])

  // Controlled mode: mirror `value` on every change (does NOT set userDrivenRef).
  useEffect(() => {
    if (value !== undefined && grouped) {
      setSelection(resolveInitialSelection(value, grouped))
    }
  }, [value, grouped])

  // ---- Toggle handlers (each flips userDrivenRef before mutation) --------
  const userDrivenRef = useRef(false)

  const toggleItem = useCallback(
    (itemId: string) => {
      if (disabled) return
      userDrivenRef.current = true
      setSelection((prev) => {
        const next = new Set(prev)
        if (next.has(itemId)) next.delete(itemId)
        else next.add(itemId)
        return next
      })
    },
    [disabled]
  )

  const toggleGroup = useCallback(
    (groupId: string | null) => {
      if (disabled || !grouped) return
      userDrivenRef.current = true
      setSelection((prev) => {
        const targetGroup = grouped.groups.find((g) => g.id === groupId)
        if (!targetGroup) return prev
        const next = new Set(prev)
        const allSelected = targetGroup.items.every((item) => next.has(item.id))
        if (allSelected) {
          for (const item of targetGroup.items) next.delete(item.id)
        } else {
          for (const item of targetGroup.items) next.add(item.id)
        }
        return next
      })
    },
    [disabled, grouped]
  )

  const toggleMaster = useCallback(() => {
    if (disabled || !grouped) return
    userDrivenRef.current = true
    setSelection((prev) => {
      if (prev.size === grouped.allItemIds.size) return new Set()
      return new Set(grouped.allItemIds)
    })
  }, [disabled, grouped])

  // ---- Emission hook: onChange only on user-driven changes ---------------
  const lastEmittedRef = useRef<string | null>(null)
  useEffect(() => {
    if (!grouped) return
    if (!userDrivenRef.current) return // skip mount-hydration + value-prop updates
    const next = deriveScope(selection, grouped)
    if (next === null) {
      userDrivenRef.current = false
      return
    }
    const serialized = JSON.stringify(next)
    if (serialized !== lastEmittedRef.current) {
      lastEmittedRef.current = serialized
      onChange(next)
    }
    userDrivenRef.current = false
  }, [selection, grouped, onChange])

  // ---- Collapse/expand state (cosmetic) ----------------------------------
  const [collapsedGroups, setCollapsedGroups] = useState<Set<string | null>>(
    () => new Set()
  )
  const collapsedInitialisedRef = useRef(false)
  // On first groups-load, seed the collapsed set with every group id if the
  // caller opted in via `defaultCollapsed`. We only do this once so that
  // subsequent user expand/collapse clicks are not undone by re-renders.
  useEffect(() => {
    if (collapsedInitialisedRef.current) return
    if (!defaultCollapsed) {
      collapsedInitialisedRef.current = true
      return
    }
    if (!grouped) return
    const allIds = new Set<string | null>(grouped.groups.map((g) => g.id))
    setCollapsedGroups(allIds)
    collapsedInitialisedRef.current = true
    // Run only when grouped first becomes available.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grouped, defaultCollapsed])
  const toggleCollapsed = useCallback((groupId: string | null) => {
    setCollapsedGroups((prev) => {
      const next = new Set(prev)
      if (next.has(groupId)) next.delete(groupId)
      else next.add(groupId)
      return next
    })
  }, [])

  // ---- Render: loading skeleton ------------------------------------------
  if (isLoading) {
    return (
      <div
        className={cn(
          'rounded-lg border border-border bg-card p-4 shadow-sm',
          className
        )}
      >
        <div className="space-y-3">
          <Skeleton className="h-8 w-1/3" />
          <div className="space-y-2 pl-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-2/3" />
          </div>
          <div className="space-y-2 pl-4">
            <Skeleton className="h-6 w-full" />
            <Skeleton className="h-6 w-5/6" />
          </div>
        </div>
      </div>
    )
  }

  // ---- Render: error ----------------------------------------------------
  if (error || !grouped) {
    return (
      <Alert
        variant="destructive"
        className={cn('flex items-center justify-between gap-3', className)}
      >
        <AlertDescription className="flex-1">
          Kunde inte hämta lagar
        </AlertDescription>
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => {
            void mutateItems()
            void mutateGroups()
          }}
        >
          <RotateCcw className="mr-1.5 h-3.5 w-3.5" />
          Försök igen
        </Button>
      </Alert>
    )
  }

  // ---- Render: main -----------------------------------------------------
  const masterState = getMasterState(selection, grouped.allItemIds)
  const currentScope = deriveScope(selection, grouped)
  const summaryText = formatScopeSummary(
    selection,
    currentScope,
    grouped.allItemIds.size
  )
  const truncated = itemsResult?.hasMore === true

  return (
    <fieldset
      className={cn(
        'rounded-lg border border-border bg-card p-4 shadow-sm',
        disabled && 'opacity-60',
        className
      )}
      // NOTE: intentionally NOT setting the native `disabled` attribute here.
      // HTML5 `<fieldset disabled>` disables every form control AND button
      // inside the subtree, which would block the chevron expand/collapse
      // buttons — Task 7.5 requires those to stay interactive in disabled mode
      // so users can still inspect the selection. Instead, `disabled` is
      // threaded explicitly to every `TriStateCheckbox` + drives the opacity
      // styling on the wrapper.
    >
      <legend className="sr-only">Välj omfattning</legend>

      {truncated && (
        <Alert className="mb-4 border-amber-300 bg-amber-50 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
          <AlertTriangle className="h-4 w-4" />
          <AlertDescription className="text-sm">
            Laglistan innehåller fler än 500 lagar. Endast de 500 första visas.
            Kontakta support om du behöver omfatta en större lista.
          </AlertDescription>
        </Alert>
      )}

      {/* Master row */}
      <div className="flex items-center gap-2 border-b border-border pb-3">
        <TriStateCheckbox
          id={masterId}
          checked={masterState}
          onCheckedChange={toggleMaster}
          aria-label="Välj alla"
          disabled={disabled}
        />
        <label
          htmlFor={masterId}
          className={cn(
            'text-sm font-medium text-foreground',
            !disabled && 'cursor-pointer'
          )}
        >
          Välj alla
        </label>
        <span className="ml-auto text-xs text-muted-foreground">
          {grouped.allItemIds.size} dokument totalt
        </span>
      </div>

      {/* Group panels */}
      <div className="mt-2 space-y-1">
        {grouped.groups.map((group) => {
          const groupState = getGroupState(selection, group.items)
          const isCollapsed = collapsedGroups.has(group.id)
          return (
            <GroupPanel
              key={group.id ?? '__ungrouped__'}
              group={group}
              selection={selection}
              groupState={groupState}
              isCollapsed={isCollapsed}
              onToggleCollapsed={toggleCollapsed}
              onToggleGroup={toggleGroup}
              onToggleItem={toggleItem}
              disabled={disabled}
            />
          )
        })}
      </div>

      {/* Live summary */}
      <div
        role="status"
        aria-live="polite"
        className="mt-4 border-t border-border pt-3 text-sm text-muted-foreground"
      >
        {summaryText}
      </div>
    </fieldset>
  )
}

// ============================================================================
// Sub-components
// ============================================================================

/**
 * Tri-state checkbox — extends shadcn's `Checkbox` with indeterminate styling
 * and explicit `aria-checked="mixed"`. Scoped to this feature; does not
 * modify the shared `components/ui/checkbox.tsx`.
 */
const TriStateCheckbox = ({
  checked,
  onCheckedChange,
  disabled,
  id,
  'aria-label': ariaLabel,
  className,
}: {
  checked: CheckedState
  onCheckedChange: (_checked: boolean) => void
  disabled?: boolean
  id?: string
  'aria-label'?: string
  className?: string
}) => {
  const ariaChecked: 'mixed' | 'true' | 'false' =
    checked === 'indeterminate' ? 'mixed' : checked ? 'true' : 'false'
  return (
    <CheckboxPrimitive.Root
      id={id}
      checked={checked}
      onCheckedChange={onCheckedChange}
      disabled={disabled}
      aria-label={ariaLabel}
      aria-checked={ariaChecked}
      className={cn(
        'grid place-content-center peer h-4 w-4 shrink-0 rounded-sm border border-primary ring-offset-background',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2',
        'disabled:cursor-not-allowed disabled:opacity-50',
        'data-[state=checked]:bg-primary data-[state=checked]:text-primary-foreground',
        'data-[state=indeterminate]:bg-primary data-[state=indeterminate]:text-primary-foreground',
        className
      )}
    >
      <CheckboxPrimitive.Indicator className="grid place-content-center text-current">
        {checked === 'indeterminate' ? (
          <Minus className="h-2.5 w-2.5" strokeWidth={3} />
        ) : (
          <Check className="h-2.5 w-2.5" strokeWidth={3} />
        )}
      </CheckboxPrimitive.Indicator>
    </CheckboxPrimitive.Root>
  )
}

/** Per-group collapsible panel with header row + item list. */
function GroupPanel({
  group,
  selection,
  groupState,
  isCollapsed,
  onToggleCollapsed,
  onToggleGroup,
  onToggleItem,
  disabled,
}: {
  group: GroupBucket
  selection: Set<string>
  groupState: CheckedState
  isCollapsed: boolean
  onToggleCollapsed: (_groupId: string | null) => void
  onToggleGroup: (_groupId: string | null) => void
  onToggleItem: (_itemId: string) => void
  disabled: boolean
}) {
  return (
    <section
      role="group"
      aria-label={`Grupp: ${group.name}`}
      className="rounded-md"
    >
      <div className="flex items-center gap-2 rounded-md px-2 py-2 hover:bg-muted/50">
        <button
          type="button"
          onClick={() => onToggleCollapsed(group.id)}
          className="flex h-5 w-5 items-center justify-center rounded text-muted-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={
            isCollapsed
              ? `Expandera grupp: ${group.name}`
              : `Komprimera grupp: ${group.name}`
          }
          aria-expanded={!isCollapsed}
        >
          <ChevronRight
            className={cn(
              'h-4 w-4 transition-transform',
              !isCollapsed && 'rotate-90'
            )}
          />
        </button>
        <TriStateCheckbox
          checked={groupState}
          onCheckedChange={() => onToggleGroup(group.id)}
          aria-label={`Välj grupp: ${group.name}`}
          disabled={disabled || group.items.length === 0}
        />
        <span className="text-sm font-medium text-foreground">
          {group.name}
        </span>
        <span className="text-xs text-muted-foreground">
          ({group.items.length})
        </span>
      </div>

      {!isCollapsed && group.items.length > 0 && (
        <ul className="ml-8 space-y-px border-l border-border pl-3 py-1">
          {group.items.map((item) => {
            const itemState = getItemState(selection, item.id)
            return (
              <li key={item.id}>
                <label
                  className={cn(
                    // `min-w-0` + the inner `flex-1 min-w-0` on the title
                    // are required for long titles to wrap instead of
                    // pushing the row wider than its parent (Story 21.4
                    // QA fix — was causing horizontal scroll on 68-law lists).
                    'flex min-w-0 items-start gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50',
                    !disabled && 'cursor-pointer'
                  )}
                >
                  <TriStateCheckbox
                    checked={itemState}
                    onCheckedChange={() => onToggleItem(item.id)}
                    aria-label={`Välj: ${item.document.title}`}
                    disabled={disabled}
                    className="mt-0.5"
                  />
                  <span className="min-w-0 flex-1 break-words text-foreground">
                    {item.document.title}
                  </span>
                  <span className="ml-2 shrink-0 self-center whitespace-nowrap text-xs text-muted-foreground">
                    {item.document.documentNumber}
                  </span>
                </label>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}

// ============================================================================
// Data-shaping helper (exposed for tests)
// ============================================================================

function buildGroupedData(
  items: DocumentListItem[],
  groupSummaries: ListGroupSummary[]
): GroupedData {
  const itemsByGroupId = new Map<string | null, DocumentListItem[]>()
  for (const item of items) {
    const key = item.groupId
    const bucket = itemsByGroupId.get(key)
    if (bucket) bucket.push(item)
    else itemsByGroupId.set(key, [item])
  }
  for (const bucket of itemsByGroupId.values()) {
    bucket.sort((a, b) => a.position - b.position)
  }

  const groups: GroupBucket[] = groupSummaries
    .slice()
    .sort((a, b) => a.position - b.position)
    .map((g) => ({
      id: g.id,
      name: g.name,
      position: g.position,
      items: itemsByGroupId.get(g.id) ?? [],
    }))

  const ungroupedItems = itemsByGroupId.get(null)
  if (ungroupedItems && ungroupedItems.length > 0) {
    groups.push({
      id: null,
      name: 'Ogrupperad',
      position: Number.MAX_SAFE_INTEGER,
      items: ungroupedItems,
    })
  }

  const allItemIds = new Set<string>()
  for (const group of groups) {
    for (const item of group.items) allItemIds.add(item.id)
  }

  return { groups, allItemIds }
}

// ============================================================================
// Private exports (for direct unit testing)
// ============================================================================

export const __private = {
  getItemState,
  getGroupState,
  getMasterState,
  deriveScope,
  formatScopeSummary,
  resolveInitialSelection,
  buildGroupedData,
}
