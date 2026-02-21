'use client'

/**
 * Story 8.1 Task 4: Changes Tab Container
 * Displays unacknowledged ChangeEvents in a table layout
 * matching the existing document list design language.
 *
 * Perf: receives initialChanges from server-side fetch (via laglistor/page.tsx
 * → LawListTabs → here), eliminating client-side waterfall.
 */

import { useMemo } from 'react'
import { useSearchParams } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChangeRow } from './change-row'
import { PriorityFilter } from './priority-filter'
import type {
  UnacknowledgedChange,
  ChangePriority,
} from '@/lib/changes/change-utils'

interface ChangesTabProps {
  initialChanges?: UnacknowledgedChange[]
}

export function ChangesTab({ initialChanges = [] }: ChangesTabProps) {
  const searchParams = useSearchParams()

  // URL-driven filters
  const priorityFilter =
    (searchParams.get('priority') as ChangePriority | null) ?? null
  const documentFilter = searchParams.get('document') ?? null

  // Apply client-side filters
  const filteredChanges = useMemo(() => {
    let items = initialChanges

    // Filter by document (from indicator click or modal link)
    if (documentFilter) {
      items = items.filter((c) => c.documentId === documentFilter)
    }

    // Filter by priority
    if (priorityFilter) {
      items = items.filter((c) => c.priority === priorityFilter)
    }

    return items
  }, [initialChanges, priorityFilter, documentFilter])

  // Empty state
  if (initialChanges.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
        <div className="rounded-full bg-muted p-4">
          <CheckCircle className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-sm text-muted-foreground">
          Inga olästa lagändringar
        </p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Info row + Priority filter */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredChanges.length} av {initialChanges.length} ändringar
        </p>
        <PriorityFilter />
      </div>

      {/* Filtered empty state */}
      {filteredChanges.length === 0 ? (
        <div className="flex flex-col items-center justify-center gap-3 py-12 text-center">
          <p className="text-sm text-muted-foreground">
            Inga ändringar matchar filtret
          </p>
        </div>
      ) : (
        /* Changes table */
        <div className="rounded-md border">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead className="w-[120px]">Typ</TableHead>
                <TableHead>Dokument</TableHead>
                <TableHead>Lista</TableHead>
                <TableHead className="w-[100px]">Prioritet</TableHead>
                <TableHead className="w-[160px]">Upptäckt</TableHead>
                <TableHead className="w-[100px]">Status</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredChanges.map((change) => (
                <ChangeRow
                  key={`${change.id}-${change.listId}`}
                  change={change}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}
    </div>
  )
}
