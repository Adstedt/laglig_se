'use client'

/**
 * Story 28.5: shared scaffolding for the admin list tables (templates /
 * workspaces / users), which were three ~90% identical bespoke TanStack
 * implementations. Each table keeps its own columns, filters and header —
 * URL state plumbing, debounced search, sorting adapter and the paginated
 * DataTable wiring live here, once.
 */

import { useCallback, useEffect, useMemo, useState } from 'react'
import { usePathname, useRouter, useSearchParams } from 'next/navigation'
import type { ColumnDef, SortingState, Updater } from '@tanstack/react-table'
import { DataTable, type SortingAdapter } from '@/components/ui/data-table'

/**
 * Push merged search-param updates. Any update that isn't itself a page
 * change resets pagination (the legacy tables' shared convention).
 */
export function useUpdateSearchParams() {
  const router = useRouter()
  const pathname = usePathname()
  const searchParams = useSearchParams()

  return useCallback(
    (updates: Record<string, string | null>) => {
      const params = new URLSearchParams(searchParams.toString())
      for (const [key, value] of Object.entries(updates)) {
        if (value === null) params.delete(key)
        else params.set(key, value)
      }
      if (!('page' in updates)) params.delete('page')
      router.push(`${pathname}?${params.toString()}`)
    },
    [router, pathname, searchParams]
  )
}

/** Debounced search input state synced to the `search` URL param. */
export function useAdminSearch(currentSearch: string | undefined) {
  const updateParams = useUpdateSearchParams()
  const [searchValue, setSearchValue] = useState(currentSearch ?? '')

  useEffect(() => {
    setSearchValue(currentSearch ?? '')
  }, [currentSearch])

  useEffect(() => {
    const timer = setTimeout(() => {
      if (searchValue !== (currentSearch ?? '')) {
        updateParams({ search: searchValue || null })
      }
    }, 300)
    return () => clearTimeout(timer)
  }, [searchValue, currentSearch, updateParams])

  return { searchValue, setSearchValue, updateParams }
}

/** URL-driven sorting adapter (sortBy/sortDir params, page reset on change). */
export function useAdminSorting(
  currentSortBy: string,
  currentSortDir: 'asc' | 'desc'
): SortingAdapter {
  const updateParams = useUpdateSearchParams()
  const sorting: SortingState = useMemo(
    () => [{ id: currentSortBy, desc: currentSortDir === 'desc' }],
    [currentSortBy, currentSortDir]
  )
  const onSortingChange = useCallback(
    (updater: Updater<SortingState>) => {
      const next = typeof updater === 'function' ? updater(sorting) : updater
      const first = next[0]
      if (!first) return
      updateParams({
        sortBy: first.id,
        sortDir: first.desc ? 'desc' : 'asc',
        page: null,
      })
    },
    [sorting, updateParams]
  )
  return useMemo(
    () => ({ sorting, onSortingChange, manual: true }),
    [sorting, onSortingChange]
  )
}

export interface AdminDataTableProps<TData> {
  data: TData[]
  columns: ColumnDef<TData, unknown>[]
  getRowId: (_row: TData) => string
  sorting: SortingAdapter
  total: number
  page: number
  pageSize: number
  /** "mallar" / "arbetsytor" / "användare" — feeds the summary line. */
  entityLabel: string
  /** Row click navigates here. */
  detailHref: (_row: TData) => string
  emptyMessage: string
}

export function AdminDataTable<TData>({
  data,
  columns,
  getRowId,
  sorting,
  total,
  page,
  pageSize,
  entityLabel,
  detailHref,
  emptyMessage,
}: AdminDataTableProps<TData>) {
  const router = useRouter()
  const updateParams = useUpdateSearchParams()
  const totalPages = Math.ceil(total / pageSize)

  const summary =
    total > 0
      ? `Visar ${(page - 1) * pageSize + 1}–${Math.min(page * pageSize, total)} av ${total} ${entityLabel}`
      : `Inga ${entityLabel} att visa`

  return (
    <DataTable<TData>
      data={data}
      columns={columns}
      getRowId={getRowId}
      sorting={sorting}
      rowInteraction={{
        onRowClick: (row) => router.push(detailHref(row)),
      }}
      loadMore={{
        kind: 'pagination',
        page,
        pageCount: totalPages,
        onPageChange: (next) => updateParams({ page: String(next) }),
        summary,
      }}
      status={{ isFiltered: false }}
      slots={{
        empty: (
          <div className="rounded-md border py-8 text-center text-sm text-muted-foreground">
            {emptyMessage}
          </div>
        ),
      }}
    />
  )
}
