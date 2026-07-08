'use client'

/**
 * <DataTable> — thin orchestrator: headless core + status resolution +
 * renderer switch. All logic lives in useDataTable; both renderers read
 * DataTableContext, so swapping them cannot lose state.
 */
import { AlertCircle, SearchX } from 'lucide-react'
import { Button } from '@/components/ui/button'
import { EmptyState } from '@/components/ui/empty-state'
import { DataTableContextProvider } from './context'
import { DataTableSkeleton } from './data-table-skeleton'
import { LoadMoreFooter } from './features/load-more'
import { CardView } from './renderers/card-view'
import { TableView } from './renderers/table-view'
import type { DataTableProps } from './types'
import { useDataTable } from './use-data-table'

export function DataTable<TData>(props: DataTableProps<TData>) {
  const result = useDataTable(props)
  const { table, view, renderItems, containerProps, containerWidth } = result
  const { status, slots, loadMore, data } = props

  const isInitialLoading = Boolean(status?.isLoading) && data.length === 0

  let content: React.ReactNode
  if (status?.error) {
    content = slots?.error ?? (
      <EmptyState
        icon={
          <EmptyState.Icon>
            <AlertCircle className="h-8 w-8 text-muted-foreground" />
          </EmptyState.Icon>
        }
        title="Något gick fel"
        description={status.error.message}
        action={
          status.error.retry ? (
            <Button variant="outline" onClick={status.error.retry}>
              Försök igen
            </Button>
          ) : undefined
        }
        className="rounded-md border"
      />
    )
  } else if (isInitialLoading) {
    content = slots?.skeleton ?? <DataTableSkeleton variant={view} />
  } else if (data.length === 0) {
    if (status?.isFiltered) {
      content = slots?.filteredEmpty ?? (
        <EmptyState
          icon={
            <EmptyState.Icon>
              <SearchX className="h-8 w-8 text-muted-foreground" />
            </EmptyState.Icon>
          }
          description="Inga resultat matchar filtren."
          className="rounded-md border"
        />
      )
    } else {
      content = slots?.empty ?? (
        <EmptyState
          description="Här är det tomt än så länge."
          className="rounded-md border"
        />
      )
    }
  } else {
    content = view === 'card' ? <CardView<TData> /> : <TableView<TData> />
  }

  return (
    <DataTableContextProvider
      value={{
        table: table as never,
        view,
        renderItems: renderItems as never,
        props: props as never,
        containerWidth,
      }}
    >
      <div ref={containerProps.ref} className={containerProps.className}>
        {content}
        {slots?.footer}
        {!status?.error && !isInitialLoading && (
          <LoadMoreFooter strategy={loadMore} />
        )}
      </div>
    </DataTableContextProvider>
  )
}
