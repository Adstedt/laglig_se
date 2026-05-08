'use client'

/**
 * Story 8.1 Task 4: Changes Tab Container
 * Displays unacknowledged ChangeEvents in a table layout
 * matching the existing document list design language.
 *
 * Perf: receives initialChanges from server-side fetch (via laglistor/page.tsx
 * → LawListTabs → here), eliminating client-side waterfall.
 */

import { useMemo, useEffect, useRef, useState, useCallback } from 'react'
import { useRouter, useSearchParams } from 'next/navigation'
import { CheckCircle } from 'lucide-react'
import {
  Table,
  TableBody,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table'
import { ChangeRow } from './change-row'
import { ChangeAssessmentModal } from './change-assessment-modal'
import { PriorityFilter } from './priority-filter'
import { LawListTabsStrip } from './law-list-tabs-strip'
import type {
  UnacknowledgedChange,
  ChangePriority,
} from '@/lib/changes/change-utils'
import { getAssessmentStatusByChangeEventIds } from '@/app/actions/change-assessment'
import type { AssessmentStatus } from '@prisma/client'

interface ChangesTabProps {
  initialChanges?: UnacknowledgedChange[]
  changeCount?: number
}

export function ChangesTab({
  initialChanges = [],
  changeCount = 0,
}: ChangesTabProps) {
  const router = useRouter()
  const searchParams = useSearchParams()
  const [statusMap, setStatusMap] = useState<Record<string, AssessmentStatus>>(
    {}
  )
  const [selectedChange, setSelectedChange] =
    useState<UnacknowledgedChange | null>(null)
  const savedDuringSession = useRef(false)

  const handleSelectChange = useCallback((change: UnacknowledgedChange) => {
    savedDuringSession.current = false
    setSelectedChange(change)
  }, [])

  const handleAssessmentSaved = useCallback(() => {
    savedDuringSession.current = true
  }, [])

  const handleCloseModal = useCallback(() => {
    setSelectedChange(null)
    if (savedDuringSession.current) {
      savedDuringSession.current = false
      router.refresh()
    }
  }, [router])

  // Fetch assessment statuses for all change events
  useEffect(() => {
    if (initialChanges.length === 0) return
    const ids = [...new Set(initialChanges.map((c) => c.id))]
    getAssessmentStatusByChangeEventIds(ids).then((result) => {
      if (result.success && result.data) {
        setStatusMap(result.data)
      }
    })
  }, [initialChanges])

  // URL-driven filters
  const priorityFilter =
    (searchParams.get('priority') as ChangePriority | null) ?? null
  const documentFilter = searchParams.get('document') ?? null

  // Apply client-side filters and enrich with assessment status
  const filteredChanges = useMemo(() => {
    let items = initialChanges.map((c) => ({
      ...c,
      assessmentStatus: statusMap[c.id] ?? null,
    }))

    // Filter by document (from indicator click or modal link)
    if (documentFilter) {
      items = items.filter((c) => c.documentId === documentFilter)
    }

    // Filter by priority
    if (priorityFilter) {
      items = items.filter((c) => c.priority === priorityFilter)
    }

    return items
  }, [initialChanges, priorityFilter, documentFilter, statusMap])

  // Empty state
  if (initialChanges.length === 0) {
    return (
      <div className="space-y-4">
        <div className="border-b border-border/60 py-2">
          <LawListTabsStrip changeCount={changeCount} />
        </div>
        <div className="flex flex-col items-center justify-center gap-3 py-16 text-center">
          <div className="rounded-full bg-muted p-4">
            <CheckCircle className="h-8 w-8 text-muted-foreground" />
          </div>
          <p className="text-sm text-muted-foreground">
            Inga olästa lagändringar
          </p>
        </div>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 border-b border-border/60 py-2 flex-wrap">
        <LawListTabsStrip changeCount={changeCount} />
        <div className="flex-1" />
        <PriorityFilter />
      </div>

      {/* Info row */}
      <div className="flex items-center justify-between">
        <p className="text-sm text-muted-foreground">
          {filteredChanges.length} av {initialChanges.length} ändringar
        </p>
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
                  onSelect={handleSelectChange}
                />
              ))}
            </TableBody>
          </Table>
        </div>
      )}

      {/* Change assessment modal */}
      <ChangeAssessmentModal
        change={selectedChange}
        onClose={handleCloseModal}
        onAssessmentSaved={handleAssessmentSaved}
      />
    </div>
  )
}
