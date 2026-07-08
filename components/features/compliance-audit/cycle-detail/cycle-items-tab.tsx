'use client'

/**
 * Story 21.5 + Story 21.16 — Items tab content for /laglistor/kontroller/[cycleId].
 * Migrated onto the unified DataTable core (Epic 28 follow-up): the hand-rolled
 * div-grid, virtualizer and stop-propagation wrappers are gone — the core
 * supplies sortable headers, the interactive-element click guard, tall rows,
 * virtualization above 100 items and the narrow-container card renderer.
 *
 * Pure presentation + local interaction. The parent (CycleDetailPage) owns
 * SWR state, mutation callbacks, AND the selected-item state that drives the
 * CycleItemModal. Clicking a row calls `onSelectItem(row.id)`.
 *
 * DOM contract kept: the Dokument cell carries `data-cycle-item-id` — the
 * progress cluster's jump buttons querySelector + scrollIntoView it.
 */

import { useMemo, useState } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import type { ColumnDef, SortingState } from '@tanstack/react-table'
import { cn } from '@/lib/utils'
import {
  ItemBedomningSelect,
  ItemMotiveringEditor,
  ItemSignOffButton,
} from '@/components/features/compliance-audit/item-bedomning-editor'
import { COMPLIANCE_STATUS_OPTIONS } from '@/components/features/document-list/table-cell-editors/compliance-status-editor'
import { CellErrorBoundary } from '@/components/features/document-list/table-cells/cell-error-boundary'
import { DataTable } from '@/components/ui/data-table'
import { SortableHeader } from '@/components/ui/sortable-header'
import { Badge } from '@/components/ui/badge'
import { getStatusBadgeProps } from '@/lib/ui/badge-tones'
import type { CycleItemRow } from '@/app/actions/compliance-audit-item'
import type { FindingRow } from '@/app/actions/compliance-finding'
import {
  EfterlevnadsBedomning,
  FindingSeverity,
  FindingType,
  type ComplianceCycleStatus,
  type WorkspaceRole,
} from '@prisma/client'
import { canSignOffItem } from '@/lib/compliance-audit/authorization-shared'
import { getCycleReadOnlyReason } from '@/components/features/compliance-audit/cycle-copy'

// Story 21.16: max number of finding dots rendered inline per row. Beyond
// this we truncate to "+N" to keep the row compact at high finding counts.
const MAX_INLINE_FINDING_DOTS = 6

interface CycleItemsTabProps {
  items: CycleItemRow[]
  readOnly: boolean
  cycleStatus: ComplianceCycleStatus
  highlightedRowId: string | null
  /** Story 21.16 — row currently open in the modal. Paints a subtle bar on
   *  the left edge so users remember where they are when the modal closes. */
  selectedItemId: string | null
  /** Story 21.16 — open the CycleItemModal on this row. Parent writes to
   *  state + URL; this component is purely presentational. */
  onSelectItem: (_itemId: string) => void
  onBedomningChange: (
    _row: CycleItemRow,
    _next: EfterlevnadsBedomning | null
  ) => Promise<void>
  onMotiveringChange: (
    _row: CycleItemRow,
    _next: string | null
  ) => Promise<void>
  onSign: (_row: CycleItemRow) => Promise<void>
  onUnsign: (_row: CycleItemRow) => Promise<void>
  /** Story 21.7 — findings array (hoisted at the page level). Used for the
   *  inline finding-dot signals under each law row. */
  findings: FindingRow[]
  /** Per-row sign-off authorization input. Allows the Signera button to
   *  render disabled+tooltip for users who aren't lead auditor / responsible
   *  user / OWNER+ADMIN. Mirrored server-side in `signOffItem`. */
  currentUserId: string
  currentUserRole: WorkspaceRole
  leadAuditorUserId: string
}

// ---------------------------------------------------------------------------
// Sorting — local, value-column-only (the inline-editor columns stay in the
// underlying law-list order). Default (no sort) keeps the incoming order.
// ---------------------------------------------------------------------------
type ItemSortKey = 'dokument' | 'nuvarande' | 'ansvarig' | 'signerad'

const statusOrder = (
  status: CycleItemRow['sourceComplianceStatus']
): number => {
  const i = COMPLIANCE_STATUS_OPTIONS.findIndex((o) => o.value === status)
  return i === -1 ? COMPLIANCE_STATUS_OPTIONS.length : i
}

function compareItems(
  a: CycleItemRow,
  b: CycleItemRow,
  key: ItemSortKey
): number {
  switch (key) {
    case 'dokument':
      return a.lawTitle.localeCompare(b.lawTitle, 'sv')
    case 'nuvarande':
      return (
        statusOrder(a.sourceComplianceStatus) -
        statusOrder(b.sourceComplianceStatus)
      )
    case 'ansvarig':
      return (a.sourceResponsibleUser?.name ?? '').localeCompare(
        b.sourceResponsibleUser?.name ?? '',
        'sv'
      )
    case 'signerad': {
      // Unsigned rows (null) sort to the bottom on ascending.
      const ta = a.signedOffAt ? new Date(a.signedOffAt).getTime() : Infinity
      const tb = b.signedOffAt ? new Date(b.signedOffAt).getTime() : Infinity
      return ta - tb
    }
  }
}

// ---------------------------------------------------------------------------
// Cells
// ---------------------------------------------------------------------------

function DokumentCell({
  row,
  itemFindings,
}: {
  row: CycleItemRow
  itemFindings: FindingRow[]
}) {
  return (
    <div
      // Progress-cluster jump target (cycle-detail-page querySelector) +
      // unit-test hook. Lives on the cell so it exists in BOTH renderers.
      data-cycle-item-id={row.id}
      data-testid={`cycle-item-row-${row.id}`}
      className="min-w-0"
    >
      <div className="flex items-center gap-1 min-w-0">
        <span className="text-sm font-medium truncate" title={row.lawTitle}>
          {row.lawTitle}
        </span>
        <Link
          href="/laglistor"
          target="_blank"
          rel="noopener noreferrer"
          className="shrink-0 opacity-0 transition-opacity hover:text-primary group-hover:opacity-100"
          aria-label="Öppna i laglistan (ny flik)"
        >
          <ExternalLink className="h-3 w-3" aria-hidden="true" />
        </Link>
      </div>
      <div className="mt-0.5 flex items-center gap-2 text-xs text-muted-foreground">
        <span>{row.lawDocumentNumber}</span>
        <FindingDots findings={itemFindings} />
      </div>
    </div>
  )
}

function NuvarandeStatusCell({ row }: { row: CycleItemRow }) {
  const statusOption = COMPLIANCE_STATUS_OPTIONS.find(
    (o) => o.value === row.sourceComplianceStatus
  )
  if (!statusOption) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  const props = getStatusBadgeProps('compliance-status', statusOption.value)
  return (
    <Badge tone={props.tone} variant={props.variant}>
      {props.label}
    </Badge>
  )
}

function SigneradCell({
  row,
  readOnly,
  cycleStatus,
  currentUserId,
  currentUserRole,
  leadAuditorUserId,
  onSign,
  onUnsign,
}: {
  row: CycleItemRow
  readOnly: boolean
  cycleStatus: ComplianceCycleStatus
  currentUserId: string
  currentUserRole: WorkspaceRole
  leadAuditorUserId: string
  onSign: () => Promise<void>
  onUnsign: () => Promise<void>
}) {
  const hasMotivering =
    row.motivering !== null && row.motivering.trim().length > 0
  const userCanSignOff = canSignOffItem({
    role: currentUserRole,
    userId: currentUserId,
    leadAuditorUserId,
    responsibleUserId: row.sourceResponsibleUser?.id ?? null,
  })
  const canSign =
    !readOnly &&
    row.signedOffAt === null &&
    row.efterlevnadsbedomning !== null &&
    hasMotivering &&
    userCanSignOff
  const canUnsign = !readOnly && row.signedOffAt !== null && userCanSignOff

  const signDisabledReason = readOnly
    ? (getCycleReadOnlyReason(cycleStatus) ?? 'Kontrollen kan inte redigeras')
    : row.efterlevnadsbedomning === null
      ? 'Ange bedömning innan signering'
      : !hasMotivering
        ? 'Skriv en motivering innan signering'
        : !userCanSignOff
          ? 'Endast ansvarig revisor, dokumentets ansvarige eller administratörer kan signera'
          : undefined

  if (readOnly && row.signedOffAt === null) {
    return <span className="text-xs text-muted-foreground">—</span>
  }
  return (
    <CellErrorBoundary>
      <ItemSignOffButton
        signedOffAt={row.signedOffAt}
        signedOffBy={row.signedOffBy}
        canSign={canSign}
        canUnsign={canUnsign}
        onSign={onSign}
        onUnsign={onUnsign}
        disabledReason={signDisabledReason}
      />
    </CellErrorBoundary>
  )
}

/**
 * Story 21.16: inline row signal for open findings. One dot per open finding
 * (up to MAX_INLINE_FINDING_DOTS), colored by severity:
 *   - red    = AVVIKELSE + MAJOR
 *   - orange = AVVIKELSE + MINOR
 *   - amber  = OBSERVATION
 *   - blue   = FORBATTRING
 * Followed by a count tail. When no open findings exist, renders nothing
 * (keeps the row clean).
 */
function FindingDots({ findings }: { findings: FindingRow[] }) {
  const openFindings = findings.filter((f) => f.closedAt === null)
  if (openFindings.length === 0) return null

  const visible = openFindings.slice(0, MAX_INLINE_FINDING_DOTS)
  const overflow = openFindings.length - visible.length

  return (
    <span className="inline-flex items-center gap-0.5" aria-hidden="true">
      {visible.map((f) => (
        <span
          key={f.id}
          className={cn('h-1.5 w-1.5 rounded-full', findingDotColor(f))}
        />
      ))}
      {overflow > 0 ? (
        <span className="ml-1 text-[10px]">+{overflow}</span>
      ) : null}
      <span className="ml-1.5">
        {openFindings.length} {openFindings.length === 1 ? 'öppen' : 'öppna'}
      </span>
    </span>
  )
}

function findingDotColor(f: FindingRow): string {
  if (f.type === FindingType.AVVIKELSE) {
    return f.severity === FindingSeverity.MAJOR ? 'bg-red-500' : 'bg-orange-500'
  }
  if (f.type === FindingType.OBSERVATION) return 'bg-amber-500'
  return 'bg-blue-500'
}

// ---------------------------------------------------------------------------
// Component
// ---------------------------------------------------------------------------

export function CycleItemsTab({
  items,
  readOnly,
  cycleStatus,
  highlightedRowId,
  selectedItemId,
  onSelectItem,
  onBedomningChange,
  onMotiveringChange,
  onSign,
  onUnsign,
  findings,
  currentUserId,
  currentUserRole,
  leadAuditorUserId,
}: CycleItemsTabProps) {
  const [sorting, setSorting] = useState<SortingState>([])
  const sortingAdapter = useMemo(
    () => ({ sorting, onSortingChange: setSorting, manual: true as const }),
    [sorting]
  )

  const findingsByItem = useMemo(() => {
    const map = new Map<string, FindingRow[]>()
    for (const f of findings) {
      if (f.lawListItemId === null) continue
      const list = map.get(f.lawListItemId)
      if (list) list.push(f)
      else map.set(f.lawListItemId, [f])
    }
    return map
  }, [findings])

  const sortedItems = useMemo(() => {
    const active = sorting[0]
    if (!active) return items
    const dir = active.desc ? -1 : 1
    return [...items].sort(
      (a, b) => compareItems(a, b, active.id as ItemSortKey) * dir
    )
  }, [items, sorting])

  const columns = useMemo<ColumnDef<CycleItemRow, unknown>[]>(
    () => [
      {
        id: 'dokument',
        accessorFn: (row) => row.lawTitle,
        header: ({ column }) => (
          <SortableHeader column={column} label="Dokument" />
        ),
        cell: ({ row }) => (
          <DokumentCell
            row={row.original}
            itemFindings={findingsByItem.get(row.original.lawListItemId) ?? []}
          />
        ),
        enableSorting: true,
        size: 280,
        minSize: 240,
        meta: {
          dt: { label: 'Dokument', fill: true, card: { role: 'title' } },
        },
      },
      {
        id: 'nuvarande',
        accessorFn: (row) => row.sourceComplianceStatus,
        header: ({ column }) => (
          <SortableHeader column={column} label="Nuvarande status" />
        ),
        cell: ({ row }) => <NuvarandeStatusCell row={row.original} />,
        enableSorting: true,
        size: 176,
        meta: {
          dt: {
            label: 'Nuvarande status',
            nowrap: true,
            card: { role: 'badge', priority: 0 },
          },
        },
      },
      {
        id: 'bedomning',
        header: 'Bedömning',
        cell: ({ row }) => (
          <CellErrorBoundary>
            <ItemBedomningSelect
              value={row.original.efterlevnadsbedomning}
              onChange={(next) => onBedomningChange(row.original, next)}
              readOnly={readOnly || row.original.signedOffAt !== null}
            />
          </CellErrorBoundary>
        ),
        enableSorting: false,
        size: 160,
        meta: {
          dt: {
            label: 'Bedömning',
            card: { role: 'meta', priority: 1, interactive: true },
          },
        },
      },
      {
        id: 'motivering',
        header: 'Motivering',
        cell: ({ row }) => (
          <CellErrorBoundary>
            <ItemMotiveringEditor
              value={row.original.motivering}
              onChange={(next) => onMotiveringChange(row.original, next)}
              readOnly={readOnly || row.original.signedOffAt !== null}
            />
          </CellErrorBoundary>
        ),
        enableSorting: false,
        size: 240,
        minSize: 200,
        meta: {
          dt: {
            label: 'Motivering',
            card: { role: 'meta', priority: 2, interactive: true },
          },
        },
      },
      {
        id: 'ansvarig',
        accessorFn: (row) => row.sourceResponsibleUser?.name ?? '',
        header: ({ column }) => (
          <SortableHeader column={column} label="Ansvarig" />
        ),
        cell: ({ row }) => (
          <span className="text-sm">
            {row.original.sourceResponsibleUser?.name ?? '—'}
          </span>
        ),
        enableSorting: true,
        size: 160,
        meta: {
          dt: { label: 'Ansvarig', card: { role: 'meta', priority: 3 } },
        },
      },
      {
        id: 'signerad',
        accessorFn: (row) =>
          row.signedOffAt ? new Date(row.signedOffAt).getTime() : Infinity,
        header: ({ column }) => (
          <SortableHeader column={column} label="Signerad" />
        ),
        cell: ({ row }) => (
          <SigneradCell
            row={row.original}
            readOnly={readOnly}
            cycleStatus={cycleStatus}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            leadAuditorUserId={leadAuditorUserId}
            onSign={() => onSign(row.original)}
            onUnsign={() => onUnsign(row.original)}
          />
        ),
        enableSorting: true,
        size: 192,
        meta: {
          dt: {
            label: 'Signerad',
            card: { role: 'meta', priority: 4, interactive: true },
          },
        },
      },
    ],
    [
      findingsByItem,
      readOnly,
      cycleStatus,
      currentUserId,
      currentUserRole,
      leadAuditorUserId,
      onBedomningChange,
      onMotiveringChange,
      onSign,
      onUnsign,
    ]
  )

  if (items.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-sm italic text-muted-foreground">
        Kontrollen har inga dokument.
      </div>
    )
  }

  return (
    <div data-testid="cycle-items-list">
      <DataTable<CycleItemRow>
        data={sortedItems}
        columns={columns}
        getRowId={(row) => row.id}
        sorting={sortingAdapter}
        rowInteraction={{
          onRowClick: (row) => onSelectItem(row.id),
          getRowClassName: (row) =>
            cn(
              highlightedRowId === row.id && 'ring-2 ring-primary',
              selectedItemId === row.id &&
                'bg-muted/40 shadow-[inset_2px_0_0_hsl(var(--primary))]'
            ),
        }}
        rowHeight="tall"
        virtualization={{ maxHeight: 'calc(100vh - 18rem)' }}
        view={{ cardBelow: 800 }}
      />
    </div>
  )
}
