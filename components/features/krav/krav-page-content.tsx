'use client'

/**
 * Story 20.3: Client orchestrator for the /krav workspace overview.
 *
 * Owns:
 *   - URL state (filter / search / sort / dir) via `useSearchParams` +
 *     `router.replace(url, { scroll: false })` (mirrors
 *     `document-list-page-content.tsx:257` convention).
 *   - Graceful fallback for malformed URL params (AC 18) — unknown values
 *     coerce to defaults on first render, stripped on next replace.
 *   - SWR wiring (via useWorkspaceRequirements + useWorkspaceRequirementCounts).
 *   - "Ladda fler" cursor pagination with row accumulation.
 *   - Inline-edit orchestration (status toggle + assignee change) with
 *     optimistic updates + toast-on-error + counts cache invalidation.
 *   - Modal deep-link: clicking the Lag cell opens <LegalDocumentModal> with
 *     `focusField="kravpunkter"` + `focusRequirementId` so the target row
 *     is scrolled into view and briefly highlighted inside the checklist.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import Link from 'next/link'
import { useRouter, useSearchParams } from 'next/navigation'
import { toast } from 'sonner'
import { mutate as globalMutate } from 'swr'
import { Skeleton } from '@/components/ui/skeleton'
import { Button } from '@/components/ui/button'
import { PageHeader } from '@/components/ui/page-header'
import { LegalDocumentModal } from '@/components/features/document-list/legal-document-modal'
import { SearchInput } from '@/components/features/document-list/search-input'
import { updateRequirement } from '@/app/actions/law-list-item-requirements'
import {
  getWorkspaceRequirements,
  type GetWorkspaceRequirementsInput,
  type WorkspaceRequirementRow,
  type WorkspaceRequirementsFilter,
  type WorkspaceRequirementsSortField,
  type WorkspaceRequirementsSortDirection,
} from '@/app/actions/workspace-requirements'
import type { WorkspaceMemberOption } from '@/app/actions/document-list'
import { KravFilterChips } from './krav-filter-chips'
import { KravFacetFilters, type KravLawListOption } from './krav-facet-filters'
import { KravTable, type KravTableSort } from './krav-table'
import {
  useWorkspaceRequirements,
  useWorkspaceRequirementCounts,
  WORKSPACE_REQUIREMENTS_KEY,
  WORKSPACE_REQUIREMENT_COUNTS_KEY,
} from './hooks/use-workspace-requirements'

// ============================================================================
// URL parsing (with graceful fallback per AC 18)
// ============================================================================

const VALID_FILTERS = ['all', 'gaps', 'mine', 'needs_evidence'] as const
const VALID_SORT_FIELDS = [
  'updated_at',
  'law_name',
  'laglista_name',
  'is_fulfilled',
] as const
const VALID_DIRECTIONS = ['asc', 'desc'] as const

function parseFilter(raw: string | undefined): WorkspaceRequirementsFilter {
  return (VALID_FILTERS as readonly string[]).includes(raw ?? '')
    ? (raw as WorkspaceRequirementsFilter)
    : 'gaps'
}

function parseSortField(
  raw: string | undefined
): WorkspaceRequirementsSortField {
  return (VALID_SORT_FIELDS as readonly string[]).includes(raw ?? '')
    ? (raw as WorkspaceRequirementsSortField)
    : 'updated_at'
}

function parseSortDirection(
  raw: string | undefined
): WorkspaceRequirementsSortDirection {
  return (VALID_DIRECTIONS as readonly string[]).includes(raw ?? '')
    ? (raw as WorkspaceRequirementsSortDirection)
    : 'desc'
}

function buildUrlParams(state: {
  filter: WorkspaceRequirementsFilter
  search: string
  sort: KravTableSort
  laglistaIds: string[]
  responsibleUserIds: string[]
}): string {
  const params = new URLSearchParams()
  if (state.filter !== 'gaps') params.set('filter', state.filter)
  if (state.search.trim().length > 0) params.set('search', state.search.trim())
  if (state.sort.field !== 'updated_at') params.set('sort', state.sort.field)
  if (state.sort.direction !== 'desc') params.set('dir', state.sort.direction)
  if (state.laglistaIds.length > 0)
    params.set('laglista', state.laglistaIds.join(','))
  if (state.responsibleUserIds.length > 0)
    params.set('ansvarig', state.responsibleUserIds.join(','))
  const s = params.toString()
  return s.length > 0 ? `/krav?${s}` : '/krav'
}

/** Parse a comma-separated id list from a URL param. */
function parseIdList(raw: string | null | undefined): string[] {
  if (!raw) return []
  return raw
    .split(',')
    .map((s) => s.trim())
    .filter(Boolean)
}

// ============================================================================
// Main component
// ============================================================================

export interface KravPageContentProps {
  initialFilter?: string | undefined
  initialSearch?: string | undefined
  initialSortField?: string | undefined
  initialSortDirection?: string | undefined
  initialLaglista?: string | undefined
  initialResponsible?: string | undefined
  members: WorkspaceMemberOption[]
  lawLists: KravLawListOption[]
}

export function KravPageContent({
  initialFilter,
  initialSearch,
  initialSortField,
  initialSortDirection,
  initialLaglista,
  initialResponsible,
  members,
  lawLists,
}: KravPageContentProps) {
  const router = useRouter()
  const searchParams = useSearchParams()

  // Derive URL-driven state. useSearchParams keeps us in sync when the user
  // navigates via back/forward; initial* props seed SSR hydration so the
  // first render matches the server.
  const urlFilter = parseFilter(
    searchParams.get('filter') ?? initialFilter ?? undefined
  )
  const urlSearch = searchParams.get('search') ?? initialSearch ?? ''
  const urlSortField = parseSortField(
    searchParams.get('sort') ?? initialSortField ?? undefined
  )
  const urlSortDirection = parseSortDirection(
    searchParams.get('dir') ?? initialSortDirection ?? undefined
  )

  // Memoise so the object identity is stable across renders when the URL-side
  // values are unchanged. Without this, every render would construct a new
  // `sort` object and thrash every useCallback/useMemo that depends on it.
  const sort: KravTableSort = useMemo(
    () => ({ field: urlSortField, direction: urlSortDirection }),
    [urlSortField, urlSortDirection]
  )

  // Facet selections live in the URL too (comma-separated). Serialise to a
  // string key first so the memo identity only changes when the values do —
  // splitting on every render would thrash the query memo + reset effect.
  const laglistaKey = searchParams.get('laglista') ?? initialLaglista ?? ''
  const responsibleKey =
    searchParams.get('ansvarig') ?? initialResponsible ?? ''
  const laglistaIds = useMemo(() => parseIdList(laglistaKey), [laglistaKey])
  const responsibleUserIds = useMemo(
    () => parseIdList(responsibleKey),
    [responsibleKey]
  )

  // Search → URL. SearchInput owns its own debounced buffer; we just push
  // the post-debounce value into the URL via this callback.
  const handleSearchChange = useCallback(
    (next: string) => {
      if (next === urlSearch) return
      const url = buildUrlParams({
        filter: urlFilter,
        search: next,
        sort,
        laglistaIds,
        responsibleUserIds,
      })
      router.replace(url, { scroll: false })
    },
    [router, urlSearch, urlFilter, sort, laglistaIds, responsibleUserIds]
  )

  // Malformed URL params were coerced on read; on first render strip the
  // invalid values from the URL so subsequent shares stay clean.
  useEffect(() => {
    const rawFilter = searchParams.get('filter')
    const rawSort = searchParams.get('sort')
    const rawDir = searchParams.get('dir')
    const needsCleaning =
      (rawFilter !== null &&
        !(VALID_FILTERS as readonly string[]).includes(rawFilter)) ||
      (rawSort !== null &&
        !(VALID_SORT_FIELDS as readonly string[]).includes(rawSort)) ||
      (rawDir !== null &&
        !(VALID_DIRECTIONS as readonly string[]).includes(rawDir))
    if (needsCleaning) {
      router.replace(
        buildUrlParams({
          filter: urlFilter,
          search: urlSearch,
          sort,
          laglistaIds,
          responsibleUserIds,
        }),
        { scroll: false }
      )
    }
    // Run once on mount — subsequent URL writes come from user actions.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  // --------------------------------------------------------------------------
  // Filter + sort handlers (URL writers)
  // --------------------------------------------------------------------------

  const handleFilterChange = useCallback(
    (next: WorkspaceRequirementsFilter) => {
      router.replace(
        buildUrlParams({
          filter: next,
          search: urlSearch,
          sort,
          laglistaIds,
          responsibleUserIds,
        }),
        { scroll: false }
      )
    },
    [router, urlSearch, sort, laglistaIds, responsibleUserIds]
  )

  const handleSortChange = useCallback(
    (next: KravTableSort) => {
      router.replace(
        buildUrlParams({
          filter: urlFilter,
          search: urlSearch,
          sort: next,
          laglistaIds,
          responsibleUserIds,
        }),
        { scroll: false }
      )
    },
    [router, urlFilter, urlSearch, laglistaIds, responsibleUserIds]
  )

  // Facet writers — toggle a single id in/out of the relevant set, then push
  // the new selection to the URL (which re-derives state + refetches).
  const writeFacets = useCallback(
    (nextLaglista: string[], nextResponsible: string[]) => {
      router.replace(
        buildUrlParams({
          filter: urlFilter,
          search: urlSearch,
          sort,
          laglistaIds: nextLaglista,
          responsibleUserIds: nextResponsible,
        }),
        { scroll: false }
      )
    },
    [router, urlFilter, urlSearch, sort]
  )

  const handleToggleLaglista = useCallback(
    (id: string) => {
      const next = laglistaIds.includes(id)
        ? laglistaIds.filter((x) => x !== id)
        : [...laglistaIds, id]
      writeFacets(next, responsibleUserIds)
    },
    [laglistaIds, responsibleUserIds, writeFacets]
  )

  const handleToggleResponsible = useCallback(
    (id: string) => {
      const next = responsibleUserIds.includes(id)
        ? responsibleUserIds.filter((x) => x !== id)
        : [...responsibleUserIds, id]
      writeFacets(laglistaIds, next)
    },
    [laglistaIds, responsibleUserIds, writeFacets]
  )

  const handleClearFacets = useCallback(() => {
    writeFacets([], [])
  }, [writeFacets])

  const handleClear = useCallback(() => {
    router.replace('/krav', { scroll: false })
  }, [router])

  // --------------------------------------------------------------------------
  // Data fetching
  // --------------------------------------------------------------------------

  // "Ladda fler" accumulation — each click fires an imperative fetch with the
  // stored cursor; its rows concat onto the primary page. We track each page's
  // nextCursor here too so the button can disappear on the final page.
  const [extraPages, setExtraPages] = useState<
    {
      cursor: string
      rows: WorkspaceRequirementRow[]
      nextCursor: string | null
    }[]
  >([])
  const [loadingMore, setLoadingMore] = useState(false)

  // Reset accumulated pages when filter/search/sort/facets change.
  useEffect(() => {
    setExtraPages([])
  }, [
    urlFilter,
    urlSearch,
    urlSortField,
    urlSortDirection,
    laglistaIds,
    responsibleUserIds,
  ])

  const primaryQuery: GetWorkspaceRequirementsInput = useMemo(
    () => ({
      filter: urlFilter,
      ...(urlSearch.trim() ? { search: urlSearch.trim() } : {}),
      ...(laglistaIds.length > 0 ? { laglistaIds } : {}),
      ...(responsibleUserIds.length > 0 ? { responsibleUserIds } : {}),
      sort,
      limit: 50,
    }),
    // `sort` + facet arrays are all memoised above, so including them is both
    // correct and minimal.
    [urlFilter, urlSearch, sort, laglistaIds, responsibleUserIds]
  )

  const {
    data: primary,
    error: primaryError,
    isLoading: primaryLoading,
    mutate: mutatePrimary,
  } = useWorkspaceRequirements(primaryQuery)

  const { data: counts, mutate: mutateCounts } = useWorkspaceRequirementCounts()

  // Merged view: primary page + any accumulated "Ladda fler" pages.
  const rows: WorkspaceRequirementRow[] = useMemo(() => {
    const base = primary?.items ?? []
    if (extraPages.length === 0) return base
    return [...base, ...extraPages.flatMap((p) => p.rows)]
  }, [primary, extraPages])

  // The effective next cursor is the nextCursor of whichever page was fetched
  // most recently (either the primary page or the last "Ladda fler" page).
  const effectiveNextCursor: string | null =
    extraPages.length > 0
      ? (extraPages[extraPages.length - 1]?.nextCursor ?? null)
      : (primary?.nextCursor ?? null)

  const handleLoadMore = useCallback(async () => {
    const cursor = effectiveNextCursor
    if (!cursor || loadingMore) return
    setLoadingMore(true)
    try {
      // Imperative fetch — we deliberately bypass SWR here because the
      // "Ladda fler" UX accumulates pages rather than replacing them.
      const result = await getWorkspaceRequirements({
        ...primaryQuery,
        cursor,
      })
      if (!result.success || !result.data) {
        toast.error('Kunde inte ladda fler', {
          description: result.error ?? 'Försök igen.',
        })
        return
      }
      setExtraPages((prev) => [
        ...prev,
        {
          cursor,
          rows: result.data!.items,
          nextCursor: result.data!.nextCursor,
        },
      ])
    } finally {
      setLoadingMore(false)
    }
  }, [effectiveNextCursor, loadingMore, primaryQuery])

  // --------------------------------------------------------------------------
  // Inline edits
  // --------------------------------------------------------------------------

  const invalidate = useCallback(async () => {
    await Promise.all([
      mutatePrimary(),
      mutateCounts(),
      // Keep sibling surfaces (legal-document-modal kravpunkter checklist)
      // in sync by invalidating every SWR key that starts with the shared
      // requirements namespace.
      globalMutate(
        (key) =>
          typeof key === 'string' && key.startsWith('list-item-requirements')
      ),
      globalMutate(
        (key) =>
          Array.isArray(key) &&
          (key[0] === WORKSPACE_REQUIREMENTS_KEY ||
            key[0] === WORKSPACE_REQUIREMENT_COUNTS_KEY)
      ),
    ])
  }, [mutatePrimary, mutateCounts])

  const handleToggleFulfilled = useCallback(
    async (row: WorkspaceRequirementRow) => {
      const prev = row.isFulfilled
      const result = await updateRequirement(row.id, {
        isFulfilled: !prev,
      })
      if (!result.success) {
        toast.error('Kunde inte uppdatera kravpunkt', {
          description: result.error,
        })
        return
      }
      await invalidate()
    },
    [invalidate]
  )

  const handleAssigneeChange = useCallback(
    async (row: WorkspaceRequirementRow, newUserId: string | null) => {
      const result = await updateRequirement(row.id, {
        responsibleUserId: newUserId,
      })
      if (!result.success) {
        toast.error('Kunde inte uppdatera ansvarig', {
          description: result.error,
        })
        return
      }
      await invalidate()
    },
    [invalidate]
  )

  const handleResetAssignee = useCallback(
    async (row: WorkspaceRequirementRow) => {
      await handleAssigneeChange(row, null)
    },
    [handleAssigneeChange]
  )

  // --------------------------------------------------------------------------
  // Modal deep-link state
  // --------------------------------------------------------------------------

  const [modalTarget, setModalTarget] = useState<{
    lawItemId: string
    requirementId: string
  } | null>(null)

  const handleOpenLawItem = useCallback((row: WorkspaceRequirementRow) => {
    setModalTarget({ lawItemId: row.lawItemId, requirementId: row.id })
  }, [])

  // --------------------------------------------------------------------------
  // Render state branches
  // --------------------------------------------------------------------------

  const totalRowsInWorkspace = counts?.all ?? null
  const hasSearch = urlSearch.trim().length > 0

  return (
    <div className="space-y-4">
      <PageHeader
        title="Krav"
        subtitle="Alla kravpunkter i din arbetsyta — filtrera efter luckor, mina krav eller krav som saknar bevis."
      />

      {/* Preset chips + facet filters + search (single row, wraps on narrow) */}
      <div className="flex flex-wrap items-center gap-3">
        <KravFilterChips
          active={urlFilter}
          counts={counts}
          hasSearch={hasSearch}
          onChange={handleFilterChange}
          onClear={handleClear}
        />

        {/* Subtle divider between presets and facets (mirrors laglistor) */}
        <div className="h-5 w-px bg-border/60 hidden sm:block" />

        <KravFacetFilters
          lawLists={lawLists}
          members={members}
          laglistaIds={laglistaIds}
          responsibleUserIds={responsibleUserIds}
          onToggleLaglista={handleToggleLaglista}
          onToggleResponsible={handleToggleResponsible}
          onClearFacets={handleClearFacets}
        />

        <div className="ml-auto w-full sm:w-72">
          <SearchInput
            initialValue={urlSearch}
            onSearch={handleSearchChange}
            placeholder="Sök kravpunkter..."
            className="w-full"
          />
        </div>
      </div>

      {/* Table body: loading / error / empty / filtered-empty / rows */}
      {primaryLoading && !primary ? (
        <KravTableSkeleton />
      ) : primaryError ? (
        <ErrorState onRetry={() => mutatePrimary()} />
      ) : totalRowsInWorkspace === 0 ? (
        <EmptyWorkspaceState />
      ) : rows.length === 0 ? (
        <FilteredEmptyState
          adjustments={
            (urlFilter !== 'gaps' ? 1 : 0) +
            (hasSearch ? 1 : 0) +
            (laglistaIds.length > 0 ? 1 : 0) +
            (responsibleUserIds.length > 0 ? 1 : 0)
          }
          onClear={handleClear}
        />
      ) : (
        <KravTable
          rows={rows}
          members={members}
          sort={sort}
          onSortChange={handleSortChange}
          onToggleFulfilled={handleToggleFulfilled}
          onAssigneeChange={handleAssigneeChange}
          onResetAssignee={handleResetAssignee}
          onOpenLawItem={handleOpenLawItem}
          nextCursor={effectiveNextCursor}
          onLoadMore={handleLoadMore}
          isLoadingMore={loadingMore}
        />
      )}

      {/* Modal deep-link */}
      {modalTarget && (
        <LegalDocumentModal
          listItemId={modalTarget.lawItemId}
          onClose={() => setModalTarget(null)}
          focusField="kravpunkter"
          focusRequirementId={modalTarget.requirementId}
          workspaceMembers={members}
        />
      )}
    </div>
  )
}

// ============================================================================
// State-branch components
// ============================================================================

function KravTableSkeleton() {
  return (
    <div className="rounded-md border overflow-hidden">
      <div className="bg-muted/40 h-9 border-b" />
      {Array.from({ length: 10 }).map((_, i) => (
        <div
          key={i}
          className="flex items-center gap-3 border-t px-3 py-2.5 h-12"
        >
          <Skeleton className="h-4 w-4 rounded" />
          <Skeleton className="h-4 flex-1 max-w-[40%]" />
          <Skeleton className="h-4 w-32" />
          <Skeleton className="h-4 w-24" />
          <Skeleton className="h-7 w-7 rounded-full" />
          <Skeleton className="h-4 w-10" />
          <Skeleton className="h-4 w-20" />
        </div>
      ))}
    </div>
  )
}

function ErrorState({ onRetry }: { onRetry: () => void }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <h3 className="text-base font-medium">Kunde inte ladda krav</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Något gick fel när kravpunkterna hämtades.
      </p>
      <Button type="button" variant="outline" size="sm" onClick={onRetry}>
        Försök igen
      </Button>
    </div>
  )
}

function EmptyWorkspaceState() {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <h3 className="text-base font-medium">Du har inga kravpunkter ännu.</h3>
      <p className="text-sm text-muted-foreground max-w-sm">
        Lägg till krav genom att öppna en laglista och fylla i kravpunkterna på
        respektive lag.
      </p>
      <Link
        href="/laglistor"
        className="text-sm text-primary underline-offset-2 hover:underline"
      >
        Öppna Laglistor
      </Link>
    </div>
  )
}

function FilteredEmptyState({
  adjustments,
  onClear,
}: {
  adjustments: number
  onClear: () => void
}) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center gap-3">
      <h3 className="text-base font-medium">
        Inga kravpunkter matchar de aktiva filtren.
      </h3>
      <Button type="button" variant="outline" size="sm" onClick={onClear}>
        Rensa ({adjustments})
      </Button>
    </div>
  )
}
