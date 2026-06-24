'use client'

/**
 * Story 21.5 + Story 21.16 — Items tab content for /laglistor/kontroller/[cycleId].
 *
 * Pure presentation + local interaction. The parent (CycleDetailPage) owns
 * SWR state, mutation callbacks, AND the selected-item state that drives the
 * CycleItemModal. Clicking a row calls `onSelectItem(row.id)` which opens the
 * modal; chevron + expanded-row-drawer pattern was removed in Story 21.16 per
 * UX redesign (replaced by the modal).
 */

import { useMemo, useRef, useState, type RefObject } from 'react'
import Link from 'next/link'
import { ExternalLink } from 'lucide-react'
import { useVirtualizer, type Virtualizer } from '@tanstack/react-virtual'
import { cn } from '@/lib/utils'
import {
  ItemBedomningSelect,
  ItemMotiveringEditor,
  ItemSignOffButton,
} from '@/components/features/compliance-audit/item-bedomning-editor'
import { COMPLIANCE_STATUS_OPTIONS } from '@/components/features/document-list/table-cell-editors/compliance-status-editor'
import { CellErrorBoundary } from '@/components/features/document-list/table-cells/cell-error-boundary'
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

// Mirror compliance-detail-table.tsx conventions so behaviour is predictable.
const VIRTUALIZATION_THRESHOLD = 100
const ESTIMATED_ROW_HEIGHT = 72
const OVERSCAN_COUNT = 5

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
  const scrollRef = useRef<HTMLDivElement>(null)
  const shouldVirtualise = items.length > VIRTUALIZATION_THRESHOLD

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => scrollRef.current,
    estimateSize: () => ESTIMATED_ROW_HEIGHT,
    overscan: OVERSCAN_COUNT,
    measureElement: (el) => el.getBoundingClientRect().height,
  })

  // Local sort over the value columns (see compareItems). Default (null) keeps
  // the incoming law-list order.
  const [sort, setSort] = useState<{ key: ItemSortKey; desc: boolean } | null>(
    null
  )
  const sortCol = (key: ItemSortKey): SortColumn => ({
    getIsSorted: () =>
      sort?.key === key ? (sort.desc ? 'desc' : 'asc') : false,
    toggleSorting: (desc?: boolean) => setSort({ key, desc: desc ?? false }),
  })
  const sortedItems = useMemo(() => {
    if (!sort) return items
    const dir = sort.desc ? -1 : 1
    return [...items].sort((a, b) => compareItems(a, b, sort.key) * dir)
  }, [items, sort])

  if (items.length === 0) {
    return (
      <div className="rounded-md border p-8 text-center text-sm italic text-muted-foreground">
        Kontrollen har inga dokument.
      </div>
    )
  }

  return (
    <div className="rounded-md border overflow-x-auto">
      <TableHeader sortCol={sortCol} />
      {shouldVirtualise ? (
        <VirtualisedBody
          items={sortedItems}
          virtualizer={virtualizer}
          scrollRef={scrollRef}
          highlightedRowId={highlightedRowId}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
          readOnly={readOnly}
          cycleStatus={cycleStatus}
          onBedomningChange={onBedomningChange}
          onMotiveringChange={onMotiveringChange}
          onSign={onSign}
          onUnsign={onUnsign}
          findings={findings}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          leadAuditorUserId={leadAuditorUserId}
        />
      ) : (
        <PlainBody
          items={sortedItems}
          highlightedRowId={highlightedRowId}
          selectedItemId={selectedItemId}
          onSelectItem={onSelectItem}
          readOnly={readOnly}
          cycleStatus={cycleStatus}
          onBedomningChange={onBedomningChange}
          onMotiveringChange={onMotiveringChange}
          onSign={onSign}
          onUnsign={onUnsign}
          findings={findings}
          currentUserId={currentUserId}
          currentUserRole={currentUserRole}
          leadAuditorUserId={leadAuditorUserId}
        />
      )}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Presentation
// ---------------------------------------------------------------------------

// Story 21.16: chevron column removed. Row becomes pure navigation — clicking
// anywhere outside the inline controls opens the modal.
const COLUMN_CLASS = {
  lag: 'min-w-[240px] flex-[2_0_0%] px-4',
  nuvarande: 'w-44 px-4',
  bedomning: 'w-40 px-4',
  motivering: 'min-w-[200px] flex-[3_0_0%] px-4',
  ansvarig: 'w-40 px-4',
  signerad: 'w-48 px-4',
} as const

// ---------------------------------------------------------------------------
// Sorting — local, value-column-only (the inline-editor columns stay in the
// underlying law-list order). Drives the shared <SortableHeader> primitive via
// a tiny adapter, same as the cycle-list table.
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

interface SortColumn {
  getIsSorted: () => 'asc' | 'desc' | false
  toggleSorting: (_desc?: boolean) => void
}

function TableHeader({
  sortCol,
}: {
  sortCol: (_key: ItemSortKey) => SortColumn
}) {
  return (
    <div
      role="rowheader"
      className="flex h-12 items-center border-b text-sm font-medium text-muted-foreground"
    >
      <div className={COLUMN_CLASS.lag}>
        <SortableHeader column={sortCol('dokument')} label="Dokument" />
      </div>
      <div className={cn(COLUMN_CLASS.nuvarande, 'whitespace-nowrap')}>
        <SortableHeader
          column={sortCol('nuvarande')}
          label="Nuvarande status"
        />
      </div>
      <div className={COLUMN_CLASS.bedomning}>Bedömning</div>
      <div className={COLUMN_CLASS.motivering}>Motivering</div>
      <div className={COLUMN_CLASS.ansvarig}>
        <SortableHeader column={sortCol('ansvarig')} label="Ansvarig" />
      </div>
      <div className={COLUMN_CLASS.signerad}>
        <SortableHeader column={sortCol('signerad')} label="Signerad" />
      </div>
    </div>
  )
}

interface RowRenderProps {
  row: CycleItemRow
  highlighted: boolean
  selected: boolean
  onSelect: () => void
  readOnly: boolean
  cycleStatus: ComplianceCycleStatus
  onBedomningChange: (_next: EfterlevnadsBedomning | null) => Promise<void>
  onMotiveringChange: (_next: string | null) => Promise<void>
  onSign: () => Promise<void>
  onUnsign: () => Promise<void>
  itemFindings: FindingRow[]
  currentUserId: string
  currentUserRole: WorkspaceRole
  leadAuditorUserId: string
}

function RowContent({
  row,
  highlighted,
  selected,
  onSelect,
  readOnly,
  cycleStatus,
  onBedomningChange,
  onMotiveringChange,
  onSign,
  onUnsign,
  itemFindings,
  currentUserId,
  currentUserRole,
  leadAuditorUserId,
}: RowRenderProps) {
  const statusOption = COMPLIANCE_STATUS_OPTIONS.find(
    (o) => o.value === row.sourceComplianceStatus
  )

  const itemReadOnly = readOnly || row.signedOffAt !== null
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

  return (
    <div
      role="row"
      data-cycle-item-id={row.id}
      data-testid={`cycle-item-row-${row.id}`}
      aria-selected={selected}
      className={cn(
        'transition-colors',
        highlighted && 'ring-2 ring-primary',
        selected && 'bg-muted/40 shadow-[inset_2px_0_0_hsl(var(--primary))]'
      )}
    >
      <div
        className="flex items-center border-b py-3 transition-colors hover:bg-muted/50 cursor-pointer"
        onClick={onSelect}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ' ') {
            // Prevent scrolling on Space
            if (e.target === e.currentTarget) {
              e.preventDefault()
              onSelect()
            }
          }
        }}
        role="button"
        tabIndex={0}
        aria-label={`Öppna ${row.lawTitle}`}
      >
        <div className={COLUMN_CLASS.lag}>
          <div className="flex items-start gap-1">
            <div className="flex-1 min-w-0">
              <div className="flex items-center gap-1 min-w-0">
                <span
                  className="text-sm font-medium truncate"
                  title={row.lawTitle}
                >
                  {row.lawTitle}
                </span>
                <Link
                  href="/laglistor"
                  target="_blank"
                  rel="noopener noreferrer"
                  onClick={(e) => e.stopPropagation()}
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
          </div>
        </div>

        <div className={COLUMN_CLASS.nuvarande}>
          {statusOption ? (
            (() => {
              const props = getStatusBadgeProps(
                'compliance-status',
                statusOption.value
              )
              return (
                <Badge tone={props.tone} variant={props.variant}>
                  {props.label}
                </Badge>
              )
            })()
          ) : (
            <span className="text-xs text-muted-foreground">—</span>
          )}
        </div>

        {/* Inline controls — stopPropagation so clicking them doesn't also
            open the modal. */}
        {/* Stop-propagation zone: clicking the inline Bedömning control
            shouldn't bubble to the row-level click-to-open-modal handler. */}
        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          className={COLUMN_CLASS.bedomning}
          role="presentation"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <CellErrorBoundary>
            <ItemBedomningSelect
              value={row.efterlevnadsbedomning}
              onChange={onBedomningChange}
              readOnly={itemReadOnly}
            />
          </CellErrorBoundary>
        </div>

        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          className={COLUMN_CLASS.motivering}
          role="presentation"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          <CellErrorBoundary>
            <ItemMotiveringEditor
              value={row.motivering}
              onChange={onMotiveringChange}
              readOnly={itemReadOnly}
            />
          </CellErrorBoundary>
        </div>

        <div className={COLUMN_CLASS.ansvarig}>
          <span className="text-sm">
            {row.sourceResponsibleUser?.name ?? '—'}
          </span>
        </div>

        {/* eslint-disable-next-line jsx-a11y/no-static-element-interactions */}
        <div
          className={COLUMN_CLASS.signerad}
          role="presentation"
          onClick={(e) => e.stopPropagation()}
          onKeyDown={(e) => e.stopPropagation()}
        >
          {readOnly && row.signedOffAt === null ? (
            <span className="text-xs text-muted-foreground">—</span>
          ) : (
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
          )}
        </div>
      </div>
    </div>
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
// Plain (non-virtualised) body — used when items ≤ 100
// ---------------------------------------------------------------------------

interface BodyProps {
  items: CycleItemRow[]
  highlightedRowId: string | null
  selectedItemId: string | null
  onSelectItem: (_itemId: string) => void
  readOnly: boolean
  cycleStatus: ComplianceCycleStatus
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
  findings: FindingRow[]
  currentUserId: string
  currentUserRole: WorkspaceRole
  leadAuditorUserId: string
}

function PlainBody({
  items,
  highlightedRowId,
  selectedItemId,
  onSelectItem,
  readOnly,
  cycleStatus,
  onBedomningChange,
  onMotiveringChange,
  onSign,
  onUnsign,
  findings,
  currentUserId,
  currentUserRole,
  leadAuditorUserId,
}: BodyProps) {
  return (
    <div
      role="grid"
      aria-rowcount={items.length}
      data-testid="cycle-items-list"
    >
      {items.map((row) => {
        const itemFindings = findings.filter(
          (f) => f.lawListItemId === row.lawListItemId
        )
        return (
          <RowContent
            key={row.id}
            row={row}
            highlighted={highlightedRowId === row.id}
            selected={selectedItemId === row.id}
            onSelect={() => onSelectItem(row.id)}
            readOnly={readOnly}
            cycleStatus={cycleStatus}
            onBedomningChange={(next) => onBedomningChange(row, next)}
            onMotiveringChange={(next) => onMotiveringChange(row, next)}
            onSign={() => onSign(row)}
            onUnsign={() => onUnsign(row)}
            itemFindings={itemFindings}
            currentUserId={currentUserId}
            currentUserRole={currentUserRole}
            leadAuditorUserId={leadAuditorUserId}
          />
        )
      })}
    </div>
  )
}

// ---------------------------------------------------------------------------
// Virtualised body — used when items > 100
// ---------------------------------------------------------------------------

interface VirtualisedBodyProps extends BodyProps {
  virtualizer: Virtualizer<HTMLDivElement, Element>
  scrollRef: RefObject<HTMLDivElement | null>
}

function VirtualisedBody({
  items,
  virtualizer,
  scrollRef,
  highlightedRowId,
  selectedItemId,
  onSelectItem,
  readOnly,
  cycleStatus,
  onBedomningChange,
  onMotiveringChange,
  onSign,
  onUnsign,
  findings,
  currentUserId,
  currentUserRole,
  leadAuditorUserId,
}: VirtualisedBodyProps) {
  return (
    <div
      ref={scrollRef}
      className="max-h-[calc(100vh-18rem)] overflow-auto"
      role="grid"
      aria-rowcount={items.length}
      data-testid="cycle-items-list-virtualized"
    >
      <div
        style={{
          height: `${virtualizer.getTotalSize()}px`,
          width: '100%',
          position: 'relative',
        }}
      >
        {virtualizer.getVirtualItems().map((virtualRow) => {
          const row = items[virtualRow.index]
          if (!row) return null
          const itemFindings = findings.filter(
            (f) => f.lawListItemId === row.lawListItemId
          )
          return (
            <div
              key={row.id}
              data-index={virtualRow.index}
              ref={(node) => {
                if (node) virtualizer.measureElement(node)
              }}
              style={{
                position: 'absolute',
                top: 0,
                left: 0,
                width: '100%',
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <RowContent
                row={row}
                highlighted={highlightedRowId === row.id}
                selected={selectedItemId === row.id}
                onSelect={() => onSelectItem(row.id)}
                readOnly={readOnly}
                cycleStatus={cycleStatus}
                onBedomningChange={(next) => onBedomningChange(row, next)}
                onMotiveringChange={(next) => onMotiveringChange(row, next)}
                onSign={() => onSign(row)}
                onUnsign={() => onUnsign(row)}
                itemFindings={itemFindings}
                currentUserId={currentUserId}
                currentUserRole={currentUserRole}
                leadAuditorUserId={leadAuditorUserId}
              />
            </div>
          )
        })}
      </div>
    </div>
  )
}
